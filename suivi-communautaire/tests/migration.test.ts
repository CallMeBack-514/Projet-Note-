import { beforeEach, describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { applyD1Migrations, reset } from "cloudflare:test";
import { seed, login, request } from "./helpers";
import { authenticate } from "../src/auth";
import { createRecord } from "../src/records";
import { createNote } from "../src/notes";
// @ts-expect-error module JavaScript des scripts d'exploitation
import { fixtureQueries } from "../scripts/fixtures.mjs";
// @ts-expect-error module JavaScript des scripts d'exploitation
import { casesQuery, precheck, validateManifest, manifestStatements } from "../scripts/reconciliation.mjs";
const upTo = (n: string) => env.TEST_MIGRATIONS.filter((m) => m.name < n);
const only = (a: string, b: string) => env.TEST_MIGRATIONS.filter((m) => m.name >= a && m.name < b);
const run = (sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).run();
const n = async (table: string) => env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>("n");
const hasService = async () => (await env.DB.prepare("SELECT 1 FROM pragma_table_info('cases') WHERE name='service'").first()) !== null;
// Schéma antérieur (0001 à 0003) avec dossiers multiples créés par les anciens déclencheurs.
async function legacy() {
  await reset();
  await applyD1Migrations(env.DB, upTo("0004"));
  await seed();
  for (const [id, user] of [["sess-a", "a"], ["sess-s1", "s1"], ["sess-c", "c"], ["sess-d", "d"]])
    await run("INSERT INTO session(id,expiresAt,token,createdAt,updatedAt,userId) VALUES(?,?,?,0,0,?)", id, Date.now() + 36e5, "tok-" + id, user);
  const person = (id: string, org: string, name: string) =>
    run("INSERT INTO clients(id,organisation_id,name,creation_operation) VALUES(?,?,?,?)", id, org, name, "op-" + id);
  const kase = (id: string, org: string, client: string, owner: string, actor: string, session: string, service: string, op: string) =>
    run(
      "INSERT INTO cases(id,organisation_id,client_id,service,owner_id,last_actor_id,last_session_id,last_operation_id) VALUES(?,?,?,?,?,?,?,?)",
      id, org, client, service, owner, actor, session, op,
    );
  await person("p1", "o1", "Personne simple");
  await kase("c1", "o1", "p1", "a", "a", "sess-a", "Logement", "op-p1");
  await person("p2", "o1", "Même responsable");
  await kase("c2a", "o1", "p2", "a", "a", "sess-a", "Logement", "op-p2");
  await kase("c2b", "o1", "p2", "a", "a", "sess-a", "Alimentation", "op-c2b");
  await person("p3", "o1", "Responsables distincts");
  await kase("c3a", "o1", "p3", "a", "a", "sess-a", "Logement", "op-p3");
  await kase("c3b", "o1", "p3", "c", "s1", "sess-s1", "Emploi", "op-c3b");
  await person("p4", "o1", "Jean Homonyme");
  await kase("c4", "o1", "p4", "a", "a", "sess-a", "Accueil", "op-p4");
  await person("p5", "o1", "Jean Homonyme");
  await kase("c5", "o1", "p5", "c", "s1", "sess-s1", "Accueil", "op-p5");
  await person("p6", "o2", "Jean Homonyme");
  await kase("c6", "o2", "p6", "d", "d", "sess-d", "Accueil", "op-p6");
}
const rows = async () => (await env.DB.prepare(casesQuery).all()).results;
type Over = Record<string, unknown>;
async function manifest(p2: Over = {}, p3: Over = {}) {
  const report = precheck(await rows());
  for (const g of report.blocking) {
    const base =
      g.client_id === "p2"
        ? { canonical_case_id: "c2a", final_owner_id: "a", decided_by: "s1", decided_at: "2026-10-18T12:00:00Z" }
        : { canonical_case_id: "c3a", final_owner_id: "c", decided_by: "s1", decided_at: "2026-10-18T12:00:00Z" };
    g.decision = { ...base, ...(g.client_id === "p2" ? p2 : p3) };
  }
  return report;
}
async function load(m: { blocking: unknown[] }) {
  await applyD1Migrations(env.DB, only("0004", "0005"));
  for (const s of manifestStatements(m)) await run(s.sql, ...s.params);
}
describe("Reprise vers un dossier unique par personne", () => {
  beforeEach(legacy);
  it("précontrôle en lecture seule : simple, même responsable, responsables distincts, homonymes et organismes", async () => {
    const before = JSON.stringify(await rows());
    const report = precheck(await rows());
    expect(report).toMatchObject({ people: 6, cases: 8, simple: 4 });
    expect(report.blocking.map((g: any) => [g.client_id, g.kind])).toEqual([
      ["p2", "meme_responsable"],
      ["p3", "responsables_distincts"],
    ]);
    expect(JSON.stringify(report)).not.toContain("Homonyme");
    expect(JSON.stringify(await rows())).toBe(before);
  });
  it("refuse une migration sans manifeste complet et ne touche à rien", async () => {
    await expect(applyD1Migrations(env.DB, upTo("0007"))).rejects.toBeDefined();
    expect(await n("cases")).toBe(8);
    expect(await hasService()).toBe(true);
    const m = await manifest();
    m.blocking.pop();
    await load(m);
    await expect(applyD1Migrations(env.DB, only("0005", "0006"))).rejects.toBeDefined();
    expect(await n("cases")).toBe(8);
    expect(await hasService()).toBe(true);
    expect(await n("legacy_case_provenance")).toBe(0);
  });
  it.each([
    ["manifeste périmé", {}, true],
    ["décideur non autorisé", { decided_by: "a" }, false],
    ["responsable final inadmissible", { final_owner_id: "s2" }, false],
    ["dossier canonique hors regroupement", { canonical_case_id: "c1" }, false],
    ["décideur d’un autre organisme", { decided_by: "s3" }, false],
  ] as const)("annule entièrement la transformation : %s", async (_name, over, stale) => {
    const m: any = await manifest({}, over);
    if (stale) m.blocking[1].sources[1].version = 99;
    await load(m);
    await expect(applyD1Migrations(env.DB, only("0005", "0006"))).rejects.toBeDefined();
    expect(await n("cases")).toBe(8);
    expect(await hasService()).toBe(true);
    expect(await n("legacy_case_provenance")).toBe(0);
  });
  it("applique les décisions, conserve identifiants, provenance, audits et clés étrangères", async () => {
    const events = (await env.DB.prepare("SELECT id,occurred_at,case_ids FROM audit_events ORDER BY id").all()).results as any[];
    await load(await manifest());
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    expect(await n("cases")).toBe(6);
    expect(await env.DB.prepare("SELECT owner_id,version FROM cases WHERE id='c1'").first()).toEqual({ owner_id: "a", version: 1 });
    expect(await env.DB.prepare("SELECT owner_id,version FROM cases WHERE id='c3a'").first()).toEqual({ owner_id: "c", version: 2 });
    expect(await env.DB.prepare("SELECT id FROM cases WHERE id IN ('c2b','c3b')").first()).toBeNull();
    const prov = await env.DB.prepare("SELECT legacy_case_id,canonical_case_id,service FROM legacy_case_provenance ORDER BY legacy_case_id").all();
    expect(prov.results.map((r: any) => [r.legacy_case_id, r.canonical_case_id, r.service])).toEqual([
      ["c2a", "c2a", "Logement"],
      ["c2b", "c2a", "Alimentation"],
      ["c3a", "c3a", "Logement"],
      ["c3b", "c3a", "Emploi"],
    ]);
    const after = (
      await env.DB.prepare("SELECT id,occurred_at,case_ids FROM audit_events WHERE id IN (" + events.map(() => "?").join(",") + ") ORDER BY id")
        .bind(...events.map((e) => e.id))
        .all()
    ).results;
    expect(after).toEqual(events);
    expect(await n("audit_events")).toBe(events.length + 1);
    expect((await env.DB.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
    expect(await n("clients")).toBe(6);
    await expect(run("DELETE FROM legacy_case_provenance")).rejects.toBeDefined();
  });
  it("résout les anciens liens vers le dossier canonique seulement après autorisation courante", async () => {
    await load(await manifest());
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const a = await login("a"),
      c = await login("c"),
      s2 = await login("s2"),
      d = await login("d");
    const viaC = await request("/dossiers/c3b", c);
    expect([viaC.status, viaC.headers.get("location")]).toEqual([303, "/dossiers/c3a"]);
    expect((await request("/dossiers/c3b", a)).status).toBe(404);
    expect((await request("/dossiers/c3a", a)).status).toBe(404);
    expect((await request("/dossiers/c2b", a)).status).toBe(303);
    expect((await request("/dossiers/c2b", d)).status).toBe(404);
    expect((await request("/dossiers/c2b", s2)).headers.get("location")).toBe("/dossiers/c2a");
    expect((await request("/dossiers/inconnu", a)).status).toBe(404);
  });
  it("le contrôle opérateur du manifeste détecte les incohérences", async () => {
    const good = await manifest();
    expect(validateManifest(good, await rows())).toEqual([]);
    expect(validateManifest({ ...good, blocking: [] }, await rows()).length).toBe(2);
    const bad = await manifest({}, { canonical_case_id: "c1" });
    expect(validateManifest(bad, await rows())[0]).toContain("canonique");
  });
});

describe("Scripts de démonstration sur une base déjà migrée", () => {
  it("setup/demo relancés ne détruisent ni ne dupliquent personnes, dossiers, notes et audits", async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const demo = async () => {
      for (const q of await fixtureQueries("Demonstration-seulement-2026!")) await env.DB.prepare(q.sql).bind(...q.params).run();
    };
    await demo();
    const cookie = await (await import("./helpers")).login("a");
    const actor = (await authenticate(env, new Headers({ Cookie: cookie })))!;
    expect(actor.id).toBe("a");
    const id = await createRecord(env.DB, actor, { name: "Personne fictive" });
    await createNote(env.DB, actor, id, { body: "x", nature: "y", date: "2025-10-01", time: "10:00", tz: "America/Toronto" });
    const snapshot = async () => JSON.stringify(await Promise.all(["user", "profiles", "organisations", "clients", "cases", "case_notes", "audit_events"].map((t) => n(t))));
    const before = await snapshot();
    await demo();
    expect(await snapshot()).toBe(before);
  });
});

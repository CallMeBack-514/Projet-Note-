import { beforeEach, describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { SELF, applyD1Migrations, reset } from "cloudflare:test";
import { seed, login, request, origin } from "./helpers";
import { authenticate, type Actor } from "../src/auth";
import { createRecord, transfer, setStatus } from "../src/records";
import { createNote } from "../src/notes";
import { canViewAudit, parseAuditFilters, viewAudit, recordDenial } from "../src/audit";
let cookies: Record<string, string>, actors: Record<string, Actor>;
async function signIn() {
  await seed();
  cookies = {};
  actors = {};
  for (const id of ["a", "b", "c", "s1", "s2", "d", "s3"]) {
    cookies[id] = await login(id);
    actors[id] = (await authenticate(env, new Headers({ Cookie: cookies[id] })))!;
  }
}
const one = async (sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).first<any>();
const all = async (sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).all<any>()).results;
const count = async (where = "1=1") => (await one(`SELECT COUNT(*) AS n FROM audit_events WHERE ${where}`)).n as number;
const create = (who = "a", name = "Personne fictive") => createRecord(env.DB, actors[who], { name });
const view = async (who: string, query: Record<string, string> = {}, cursor?: string) =>
  viewAudit(env.DB, actors[who], env.AUTH_SECRET, parseAuditFilters(query), cursor);
const problem = (p: Promise<unknown>, status: number) => expect(p).rejects.toMatchObject({ status });
// Événement synthétique à horodatage contrôlé (insertion SQL directe, comme le ferait un déclencheur).
let n = 0;
beforeEach(() => {
  n = 0;
});
const ev = (ts: string, over: { actor?: string; org?: string; cases?: string[]; action?: string } = {}) =>
  env.DB.prepare("INSERT INTO audit_events(id,organisation_id,actor_id,action,occurred_at,case_ids) VALUES(?,?,?,?,?,?)")
    .bind(`ev-${String(++n).padStart(4, "0")}`, over.org ?? "o1", over.actor ?? "a", over.action ?? "read", ts, JSON.stringify(over.cases ?? ["c-x"]))
    .run();
const html = async (path: string, who: string) => (await request(path, cookies[who])).text();
describe("1. Évolution du journal canonique", () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter((m) => m.name < "0010" || m.name.startsWith("0011")));
    await signIn();
  });
  it("migre sans perdre identifiants, dates, références ni opérations, avec séquence dans l’ordre d’insertion", async () => {
    const id = await create();
    await createNote(env.DB, actors.a, id, { body: "t", nature: "n", date: "2025-10-01", time: "10:00", tz: "America/Toronto", follow_description: "x" });
    await setStatus(env.DB, actors.a, id, "Inactif", 1);
    await transfer(env.DB, actors.s1, id, "b", 2);
    await env.DB.prepare("INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type) VALUES('r1','o1','a','read','[]','case')").run();
    const before = await all("SELECT * FROM audit_events ORDER BY rowid");
    const perAction = await all("SELECT action,COUNT(*) AS n FROM audit_events GROUP BY action ORDER BY action");
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const after = await all("SELECT * FROM audit_events ORDER BY sequence");
    expect(after.map((e) => e.sequence)).toEqual(before.map((_, i) => i + 1));
    expect(after.map(({ sequence, result, viewed_event_ids, route_code, ...rest }) => rest)).toEqual(before);
    expect(after.every((e) => e.result === "success" && e.viewed_event_ids === null && e.route_code === null)).toBe(true);
    expect(await all("SELECT action,COUNT(*) AS n FROM audit_events GROUP BY action ORDER BY action")).toEqual(perAction);
    // Les déclencheurs existants continuent d'écrire (insertions qui omettent la séquence) et la séquence croît.
    const second = await create("a", "Autre");
    await createNote(env.DB, actors.a, second, { body: "t", nature: "n", date: "2025-10-01", time: "10:00", tz: "America/Toronto" });
    const seqs = (await all("SELECT sequence FROM audit_events ORDER BY sequence")).map((e) => e.sequence);
    expect(seqs).toEqual([...seqs].sort((x, y) => x - y));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect(seqs.at(-1)).toBe(before.length + 2);
    expect((await env.DB.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  });
  it("refuse les métadonnées invalides, les mises à jour et les suppressions", async () => {
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    const insert = (cols: string, vals: unknown[]) =>
      env.DB.prepare(`INSERT INTO audit_events(id,organisation_id,actor_id,${cols}) VALUES(?,'o1','a',${vals.map(() => "?").join(",")})`).bind(crypto.randomUUID(), ...vals).run();
    const denied = "action,result,case_ids,route_code";
    await insert(denied, ["access_denied", "denied", "[]", "case_read"]);
    await expect(insert(denied, ["access_denied", "denied", '["x"]', "case_read"])).rejects.toBeDefined();
    await expect(insert(denied, ["access_denied", "denied", "[]", "http://secret/url"])).rejects.toBeDefined();
    await expect(insert(denied, ["access_denied", "success", "[]", "case_read"])).rejects.toBeDefined();
    await expect(insert("action,result,case_ids", ["access_denied", "denied", "[]"])).rejects.toBeDefined();
    await expect(insert("action,result,case_ids,route_code,resource_id", ["access_denied", "denied", "[]", "case_read", "cible"])).rejects.toBeDefined();
    const read = "action,case_ids,resource_type,viewed_event_ids";
    await insert(read, ["audit_read", "[]", "audit_log", JSON.stringify(Array.from({ length: 25 }, (_, i) => "e" + i))]);
    await expect(insert(read, ["audit_read", "[]", "audit_log", JSON.stringify(Array.from({ length: 26 }, (_, i) => "e" + i))])).rejects.toBeDefined();
    await expect(insert(read, ["audit_read", '["c"]', "audit_log", "[]"])).rejects.toBeDefined();
    await expect(insert(read, ["audit_read", "[]", "case", "[]"])).rejects.toBeDefined();
    await expect(insert(read, ["read", "[]", "case", "[]"])).rejects.toBeDefined();
    await expect(insert("action,case_ids,result", ["read", "[]", "denied"])).rejects.toBeDefined();
    await expect(insert("action,case_ids", ["supprimer", "[]"])).rejects.toBeDefined();
    await expect(env.DB.prepare("UPDATE audit_events SET result='success'").run()).rejects.toThrow("audit_immutable");
    await expect(env.DB.prepare("DELETE FROM audit_events").run()).rejects.toThrow("audit_immutable");
    const first = await one("SELECT sequence FROM audit_events ORDER BY sequence LIMIT 1");
    await env.DB.prepare("INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids) VALUES('z','o1','a','read','[]')").run();
    expect((await one("SELECT MAX(sequence) AS m FROM audit_events")).m).toBeGreaterThan(first.sequence);
  });
});
describe("2. Lecture autorisée, filtrée et tracée", () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await signIn();
  });
  it("réserve audit:view aux superviseurs actifs et dans leur organisme", async () => {
    await ev("2025-10-01T10:00:00.000Z", { org: "o2", actor: "d" });
    await ev("2025-10-01T11:00:00.000Z");
    for (const who of ["a", "b", "c", "d"]) {
      expect(await canViewAudit(env.DB, actors[who])).toBe(false);
      await problem(view(who), 403);
    }
    for (const who of ["s1", "s2"]) {
      const page = await view(who);
      expect(page.rows.filter((r) => r.action !== "audit_read").map((r) => r.id)).toEqual(["ev-0002"]);
      expect(page.actors.map((a) => a.id).sort()).toEqual(["a", "b", "c", "s1", "s2"]);
    }
    const other = await view("s3");
    expect(other.rows.filter((r) => r.action !== "audit_read").map((r) => r.id)).toEqual(["ev-0001"]);
    expect(other.actors.map((a) => a.id).sort()).toEqual(["d", "s3"]);
    expect(await canViewAudit(env.DB, actors.s1, "o2")).toBe(false);
    // Perte de permission entre le précontrôle et la requête : session ou profil.
    const traces = await count("action='audit_read'");
    const stale = { ...actors.s2 };
    await env.DB.prepare("DELETE FROM session WHERE id=?").bind(stale.sessionId).run();
    await problem(viewAudit(env.DB, stale, env.AUTH_SECRET, parseAuditFilters({})), 403);
    await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id='s1'").run();
    await problem(view("s1"), 403);
    await env.DB.prepare("UPDATE profiles SET supervisor_id='s1' WHERE user_id='c'").run();
    await env.DB.prepare("UPDATE profiles SET role='intervenant',supervisor_id='s3' WHERE user_id='s3'").run().catch(() => {});
    expect(await count("action='audit_read'")).toBe(traces);
  });
  it("trace une consultation par page, exactement les lignes servies, sans récursion", async () => {
    await ev("2025-10-01T10:00:00.000Z");
    await ev("2025-10-01T11:00:00.000Z");
    const first = await view("s1");
    const traces = await all("SELECT * FROM audit_events WHERE action='audit_read'");
    expect(traces).toHaveLength(1);
    expect(traces[0]).toMatchObject({ actor_id: "s1", organisation_id: "o1", result: "success", case_ids: "[]", resource_type: "audit_log", resource_id: null });
    expect(JSON.parse(traces[0].viewed_event_ids)).toEqual(first.rows.map((r) => r.id));
    expect(first.rows.some((r) => r.action === "audit_read")).toBe(false);
    const second = await view("s2");
    const previous = second.rows.find((r) => r.action === "audit_read")!;
    expect(previous).toBeDefined();
    expect(previous.viewed_event_ids).toBe(traces[0].viewed_event_ids);
    expect(await count("action='audit_read'")).toBe(2);
    expect(JSON.parse((await all("SELECT viewed_event_ids FROM audit_events WHERE action='audit_read' ORDER BY sequence"))[1].viewed_event_ids)).toEqual(second.rows.map((r) => r.id));
    const empty = await view("s1", { dossier: "inconnu" });
    expect(empty.rows).toEqual([]);
    expect((await all("SELECT viewed_event_ids FROM audit_events WHERE action='audit_read' ORDER BY sequence")).at(-1)!.viewed_event_ids).toBe("[]");
  });
  it("ne retourne aucune donnée si la trace échoue ou si la permission disparaît", async () => {
    await ev("2025-10-01T10:00:00.000Z");
    await env.DB.exec("CREATE TRIGGER fail_audit_read BEFORE INSERT ON audit_events WHEN NEW.action='audit_read' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(view("s1")).rejects.toBeDefined();
    const res = await request("/audit", cookies.s1);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("ev-0001");
    expect(text).not.toContain("Maison");
    expect(await count("action='audit_read'")).toBe(0);
  });
  it("filtre par dossier, acteur, action et période UTC, avec dossier canonique et anciennes références", async () => {
    await ev("2025-10-01T10:00:00.000Z", { actor: "a", cases: ["c-1"] });
    await ev("2025-10-02T10:00:00.000Z", { actor: "b", cases: ["c-1", "c-2"], action: "update" });
    await ev("2025-10-03T10:00:00.000Z", { actor: "a", cases: ["c-2"] });
    await ev("2025-10-04T10:00:00.000Z", { org: "o2", actor: "d", cases: ["c-1"] });
    const idsOf = async (q: Record<string, string>) => (await view("s1", q)).rows.filter((r) => r.action !== "audit_read").map((r) => r.id);
    expect(await idsOf({ dossier: "c-1" })).toEqual(["ev-0002", "ev-0001"]);
    expect(await idsOf({ dossier: "c-1", acteur: "a" })).toEqual(["ev-0001"]);
    expect(await idsOf({ action: "update" })).toEqual(["ev-0002"]);
    expect(await idsOf({ du: "2025-10-02", au: "2025-10-02" })).toEqual(["ev-0002"]);
    expect(await idsOf({ du: "2025-10-02T10:00:00Z", au: "2025-10-03T10:00:00Z" })).toEqual(["ev-0002"]);
    expect(await idsOf({ du: "2025-10-03" })).toEqual(["ev-0003"]);
    // Anciennes références : le filtre sur le canonique (ou l'ancien) retrouve les deux, dans le même organisme.
    await env.DB.prepare("INSERT INTO legacy_case_provenance(legacy_case_id,organisation_id,client_id,canonical_case_id,service,previous_owner_id,opened_at,legacy_version) VALUES('c-2','o1','x','c-1','S','a','2025-01-01',1)").run();
    expect(await idsOf({ dossier: "c-1" })).toEqual(["ev-0003", "ev-0002", "ev-0001"]);
    expect(await idsOf({ dossier: "c-2" })).toEqual(["ev-0003", "ev-0002", "ev-0001"]);
    // Références extérieures, absentes ou d'un autre organisme : même page vide, sans fuite.
    expect(await idsOf({ dossier: "c-1", acteur: "d" })).toEqual([]);
    expect(await idsOf({ acteur: "inexistant" })).toEqual([]);
    expect((await view("s3", { dossier: "c-1" })).rows.map((r) => r.id)).toEqual(["ev-0004"]);
    const outside = await html("/audit?acteur=d", "s1");
    const absent = await html("/audit?acteur=zzz", "s1");
    expect(outside.replace(/\d{4}-\d{2}-\d{2}/g, "")).toContain("Aucun événement trouvé");
    expect(absent).toContain("Aucun événement trouvé");
  });
  it("refuse période inversée, action inconnue, dates impossibles et curseurs falsifiés", async () => {
    const invalid: Record<string, string>[] = [{ du: "2025-10-05", au: "2025-10-01" }, { du: "2025-02-30" }, { au: "pas-une-date" }, { du: "2025-10-01T10:00:00" }, { action: "supprimer" }, { dossier: "x".repeat(101) }];
    for (const q of invalid)
      await problem(view("s1", q), 400);
    await ev("2025-10-01T10:00:00.000Z");
    for (let i = 0; i < 30; i++) await ev(`2025-10-01T10:${String(i).padStart(2, "0")}:00.000Z`);
    const page = await view("s1");
    expect(page.next).toBeDefined();
    await problem(view("s1", {}, page.next + "x"), 400);
    await problem(view("s1", {}, "n.importe"), 400);
    await problem(view("s1", { action: "read" }, page.next), 400);
    await problem(view("s2", {}, page.next), 400);
    const forged = page.next!.split(".");
    forged[0] = btoa(JSON.stringify({ w: 0, t: "2000-01-01T00:00:00.000Z", i: "a", f: "[]", s: "x", o: "o1", v: 1 })).replace(/=+$/, "");
    await problem(view("s1", {}, forged.join(".")), 400);
    expect((await view("s1", {}, page.next)).rows.length).toBeGreaterThan(0);
  });
  it("pagine par 25 avec un ordre stable, des horodatages égaux et un watermark insensible aux ajouts ultérieurs", async () => {
    for (let i = 0; i < 60; i++) await ev(i < 40 ? "2025-10-01T10:00:00.000Z" : `2025-10-02T10:${String(i).padStart(2, "0")}:00.000Z`);
    const p1 = await view("s1");
    expect(p1.rows).toHaveLength(25);
    expect(p1.next).toBeDefined();
    // Insertions ultérieures, dont une antidatée au milieu du parcours : absentes des pages suivantes.
    await ev("2025-10-01T10:00:00.000Z");
    await ev("2025-10-02T10:50:30.000Z");
    const p2 = await view("s1", {}, p1.next);
    expect(p2.rows).toHaveLength(25);
    const p3 = await view("s1", {}, p2.next);
    expect(p3.rows).toHaveLength(10);
    expect(p3.next).toBeUndefined();
    const seen = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.id).filter((id) => id.startsWith("ev-"));
    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60);
    expect(seen).not.toContain("ev-0061");
    expect(seen).not.toContain("ev-0062");
    const ordered = [...p1.rows, ...p2.rows, ...p3.rows].map((r) => r.occurred_at + "|" + r.id);
    expect(ordered).toEqual([...ordered].sort().reverse());
    expect(await count("action='audit_read'")).toBe(3);
    // Les traces ultérieures ne perturbent pas non plus un nouveau parcours.
    expect((await view("s1")).rows.some((r) => r.action === "audit_read")).toBe(true);
  });
  it("sert GET /audit et POST /audit/acces avec no-store, sans trace de polling et avec organisme initial", async () => {
    await ev("2025-10-01T10:00:00.000Z");
    const res = await request("/audit", cookies.s1);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const page = await res.text();
    expect(page).toContain("Journal des accès");
    expect(page).not.toMatch(/method="post"[^>]*action="\/audit/);
    const traces = await count("action='audit_read'");
    const poll = (cookie: string, org: string) =>
      SELF.fetch(origin + "/audit/acces", { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ organisation: org }) });
    const ok = await poll(cookies.s1, "o1");
    expect(await ok.json()).toEqual({ allowed: true });
    expect(ok.headers.get("cache-control")).toContain("no-store");
    expect(await (await poll(cookies.s1, "o2")).json()).toEqual({ allowed: false });
    expect(await (await poll(cookies.a, "o1")).json()).toEqual({ allowed: false });
    expect((await poll("better-auth.session_token=expire", "o1")).status).toBe(401);
    await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id='s2'").run();
    expect(await (await poll(cookies.s2, "o1")).json()).toEqual({ allowed: false });
    expect(await count("action='audit_read'")).toBe(traces);
    expect(await count("action='access_denied'")).toBe(0);
  });
});
describe("3. Refus minimisés", () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await signIn();
  });
  it("trace une seule fois les refus authentifiés avec une catégorie fixe et sans cible", async () => {
    const mine = await create("a", "Nom confidentiel");
    const other = await create("d", "Autre organisme");
    const before = await count();
    const responses = [
      await request("/dossiers/inexistant", cookies.b),
      await request("/dossiers/" + mine, cookies.b),
      await request("/dossiers/" + other, cookies.a),
    ];
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404]);
    expect(new Set(await Promise.all(responses.slice(0, 2).map((r) => r.text()))).size).toBe(1);
    const denials = await all("SELECT * FROM audit_events WHERE action='access_denied' ORDER BY sequence");
    expect(denials).toHaveLength(3);
    expect(denials.map((d) => [d.actor_id, d.organisation_id, d.route_code, d.result])).toEqual([
      ["b", "o1", "case_read", "denied"],
      ["b", "o1", "case_read", "denied"],
      ["a", "o1", "case_read", "denied"],
    ]);
    const dump = JSON.stringify(denials);
    for (const secret of [mine, other, "inexistant", "o2", "Nom confidentiel", "/dossiers"]) expect(dump).not.toContain(secret);
    expect(denials.every((d) => d.case_ids === "[]" && d.resource_id === null && d.resource_type === null && d.viewed_event_ids === null)).toBe(true);
    expect(await count("action='read'")).toBe(0);
    expect(await count()).toBe(before + 3);
    // Autres catégories.
    await request(`/dossiers/${mine}/notes/nouvelle`, cookies.b);
    await request(`/dossiers/${mine}/notes`, cookies.b, { body: "x" });
    await request(`/dossiers/${mine}/transfert`, cookies.b, { owner_id: "c", version: "1" });
    await request(`/dossiers/${mine}/statut`, cookies.b, { status: "Inactif", version: "1" });
    await request("/modeles", cookies.a);
    await request("/audit", cookies.a);
    expect((await all("SELECT route_code FROM audit_events WHERE action='access_denied' ORDER BY sequence")).slice(3).map((d) => d.route_code)).toEqual([
      "content_read",
      "content_write",
      "case_write",
      "case_write",
      "content_read",
      "audit_read",
    ]);
  });
  it("ne traite pas anonymes, saisies invalides, conflits ni polling comme des refus", async () => {
    const id = await create("a");
    const none = async (p: Promise<Response>) => {
      const before = await count("action='access_denied'");
      await p;
      expect(await count("action='access_denied'")).toBe(before);
    };
    await none(SELF.fetch(origin + "/dossiers/" + id, { redirect: "manual" }));
    await none(SELF.fetch(origin + "/audit", { redirect: "manual" }));
    await none(Promise.resolve(request("/dossiers", cookies.a, { name: "" })));
    await none(Promise.resolve(request("/dossiers?statut=ferme", cookies.a)));
    await none(Promise.resolve(request(`/dossiers/${id}/statut`, cookies.a, { status: "Fermé", version: "1" })));
    await none(Promise.resolve(request(`/dossiers/${id}/statut`, cookies.a, { status: "Inactif", version: "1" })));
    await none(Promise.resolve(request(`/dossiers/${id}/statut`, cookies.s1, { status: "Inactif", version: "1" })));
    await none(Promise.resolve(request("/acces", cookies.b, { "ids[]": id })));
    await none(SELF.fetch(origin + "/audit/acces", { method: "POST", headers: { Cookie: cookies.b, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body: "organisation=o1" }));
    await none(Promise.resolve(request("/audit?du=2025-10-05&au=2025-10-01", cookies.s1)));
    await none(SELF.fetch(origin + "/dossiers", { method: "POST", headers: { Cookie: cookies.a, Origin: "https://hostile.example", "Content-Type": "application/x-www-form-urlencoded" }, body: "name=x" }));
    expect(await count("action='access_denied'")).toBe(0);
  });
  it("refuse l’accès sans fuite ni boucle quand le refus ne peut pas être enregistré", async () => {
    const id = await create("a", "Nom confidentiel");
    await env.DB.exec("CREATE TRIGGER fail_denial BEFORE INSERT ON audit_events WHEN NEW.action='access_denied' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    const res = await request("/dossiers/" + id, cookies.b);
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("Nom confidentiel");
    expect(text).not.toContain("introuvable");
    expect(await count("action='access_denied'")).toBe(0);
    await expect(recordDenial(env.DB, actors.b, "case_read")).rejects.toBeDefined();
  });
});
describe("4. Présentation protégée", () => {
  beforeEach(async () => {
    await reset();
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
    await signIn();
  });
  it("présente références et libellés sans contenu, échappés, avec comptes désactivés et refus distincts", async () => {
    const id = await create("a", "<b>Nom confidentiel</b>");
    await createNote(env.DB, actors.a, id, { body: "Texte secret", nature: "Nature secrète", participants: "Proche secret", date: "2025-10-01", time: "10:00", tz: "America/Toronto", follow_description: "Tâche secrète" });
    await setStatus(env.DB, actors.a, id, "Inactif", 1);
    await request("/dossiers/" + id, cookies.a);
    await request("/dossiers/" + id, cookies.b);
    await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id='b'").run();
    const page = await html("/audit", "s1");
    for (const secret of ["Nom confidentiel", "Texte secret", "Nature secrète", "Proche secret", "Tâche secrète", "<b>"]) expect(page).not.toContain(secret);
    expect(page).toContain("Refus d’accès");
    expect(page).toContain("Consultation réussie");
    expect(page).toContain("Changement de statut");
    expect(page).toContain("Actif → Inactif");
    expect(page).toContain("Catégorie : lecture de dossier");
    expect(page).toContain("Malik");
    expect(page).toContain("(compte désactivé)");
    expect(page).toContain(id.slice(0, 8).toUpperCase());
    expect(page).not.toContain(id);
    expect(page).not.toMatch(/method="post"[^>]*action="\/audit/);
    const second = await html("/audit", "s1");
    expect(second).toContain("Consultation du journal");
    expect(second).toContain("événement");
    expect(await html("/audit?dossier=" + id, "s3")).toContain("Aucun événement trouvé");
    expect((await request("/audit?du=2025-10-05&au=2025-10-01", cookies.s1)).status).toBe(400);
    expect((await request("/audit?action=supprimer", cookies.s1)).status).toBe(400);
    expect(await count("action='audit_read'")).toBeGreaterThanOrEqual(2);
  });
  it("expose la navigation aux seuls superviseurs et marque l’écran pour la révocation", async () => {
    expect(await html("/dossiers", "s1")).toContain("Journal des accès");
    expect(await html("/dossiers", "a")).not.toContain("Journal des accès");
    const page = await html("/audit", "s2");
    expect(page).toContain("data-requires-supervisor");
    expect(page).toContain('data-audit-org="o1"');
    expect(page).toContain("Réinitialiser");
  });
});

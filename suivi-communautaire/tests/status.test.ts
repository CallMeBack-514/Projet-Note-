import { beforeEach, describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { SELF, applyD1Migrations, reset } from "cloudflare:test";
import { seed, login, request, origin } from "./helpers";
import { authenticate, type Actor } from "../src/auth";
import { createRecord, transfer, record, setStatus, listing } from "../src/records";
import { createNote, listNotes } from "../src/notes";
import { createTemplate, getTemplate } from "../src/document-templates";
import { createDocument } from "../src/documents";
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
const count = async (table: string, where = "1=1") => (await one(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)).n as number;
const create = (who = "a", name = "Personne fictive") => createRecord(env.DB, actors[who], { name });
const problem = (p: Promise<unknown>, status: number) => expect(p).rejects.toMatchObject({ status });
const statusEvents = () => all("SELECT * FROM audit_events WHERE action='status_change' ORDER BY rowid");
const note = { body: "Texte", nature: "Appel", date: "2025-10-01", time: "10:00", tz: "America/Toronto" };
describe("Migration Ouvert → Actif sur une base peuplée", () => {
  beforeEach(async () => {
    await reset();
    // 0011 (colonnes ajoutées à clients) est indépendant de 0009 et requis par les lectures actuelles.
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter((m) => m.name < "0009" || m.name.startsWith("0011")));
    await signIn();
  });
  it("convertit sans perdre identifiants, contenus ni événements, et sans fabriquer de transition", async () => {
    const id = await create();
    await createNote(env.DB, actors.a, id, { ...note, follow_description: "Suivi" });
    const t = await createTemplate(env.DB, actors.s1, "Modèle", [{ id: "", label: "Champ", type: "text", required: false, help: "", options: "" }]);
    const field = (await getTemplate(env.DB, actors.s1, t)).fields[0].id;
    await createDocument(env.DB, actors.a, id, t, 1, { ["a." + field]: "réponse" });
    const before = {
      row: await one("SELECT id,client_id,owner_id,opened_at,version FROM cases"),
      events: await all("SELECT * FROM audit_events ORDER BY rowid"),
      counts: [await count("clients"), await count("case_notes"), await count("note_follow_ups"), await count("case_documents")],
    };
    expect((await one("SELECT status FROM cases")).status).toBe("Ouvert");
    await applyD1Migrations(env.DB, env.TEST_MIGRATIONS.filter((m) => m.name < "0010" || m.name.startsWith("0011")));
    expect(await one("SELECT id,client_id,owner_id,opened_at,version FROM cases")).toEqual(before.row);
    expect((await one("SELECT status FROM cases")).status).toBe("Actif");
    expect(await all("SELECT * FROM audit_events ORDER BY rowid")).toEqual(before.events);
    expect([await count("clients"), await count("case_notes"), await count("note_follow_ups"), await count("case_documents")]).toEqual(before.counts);
    expect((await env.DB.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
    expect(await statusEvents()).toEqual([]);
    await expect(env.DB.prepare("UPDATE cases SET status='Ouvert'").run()).rejects.toBeDefined();
    await expect(env.DB.prepare("UPDATE cases SET status='Autre'").run()).rejects.toBeDefined();
    const fresh = await login("a");
    const actor = (await authenticate(env, new Headers({ Cookie: fresh })))!;
    expect((await listNotes(env.DB, actor, id)).rows).toHaveLength(1);
    expect(await setStatus(env.DB, actor, id, "Inactif", 1)).toBe(true);
  });
  it("ne laisse aucune valeur inattendue atteindre la migration (CHECK d’origine) et garde un contrôle en profondeur", async () => {
    await create();
    await expect(env.DB.prepare("UPDATE cases SET status='Fermé'").run()).rejects.toBeDefined();
    expect((await one("SELECT status FROM cases")).status).toBe("Ouvert");
    const sql = env.TEST_MIGRATIONS.find((m) => m.name.startsWith("0009"))!.queries.join(" ");
    expect(sql).toContain("unexpected_status");
  });
});
describe("Statuts Actif / Inactif", () => {
  beforeEach(signIn);
  it("crée Actif et refuse les écritures SQL invalides sans faux événement de transfert", async () => {
    const id = await create();
    expect((await record(env.DB, actors.a, id)).status).toBe("Actif");
    const mutate = (set: string, ...args: unknown[]) =>
      env.DB.prepare(`UPDATE cases SET ${set},version=version+1,last_actor_id=?,last_session_id=?,last_operation_id=? WHERE id=?`)
        .bind(...args, "a", actors.a.sessionId, crypto.randomUUID(), id)
        .run();
    await expect(mutate("status='Inactif',owner_id='b'", ...[])).rejects.toThrow("invalid_mutation");
    await expect(mutate("status='Ouvert'")).rejects.toBeDefined();
    await expect(mutate("owner_id=owner_id")).rejects.toThrow("invalid_mutation");
    await expect(mutate("client_id='x',status='Inactif'")).rejects.toBeDefined();
    await expect(env.DB.prepare("UPDATE cases SET status='Inactif',version=version+1,last_actor_id='a',last_session_id=?,last_operation_id=? WHERE id=?").bind(actors.b.sessionId, crypto.randomUUID(), id).run()).rejects.toThrow("access_denied");
    expect(await count("audit_events", "action='transfer' OR action='status_change'")).toBe(0);
    await setStatus(env.DB, actors.a, id, "Inactif", 1);
    expect(await count("audit_events", "action='transfer'")).toBe(0);
    await transfer(env.DB, actors.s1, id, "b", 2);
    expect(await count("audit_events", "action='status_change'")).toBe(1);
    expect(await count("audit_events", "action='transfer'")).toBe(1);
  });
  it("autorise responsable et superviseurs, refuse collègue, autre organisme, session révoquée et compte désactivé", async () => {
    const id = await create();
    await setStatus(env.DB, actors.s2, id, "Inactif", 1);
    expect((await record(env.DB, actors.s2, id)).owner_id).toBe("a");
    await setStatus(env.DB, actors.a, id, "Actif", 2);
    await problem(setStatus(env.DB, actors.b, id, "Inactif", 3), 404);
    await problem(setStatus(env.DB, actors.c, id, "Inactif", 3), 404);
    await problem(setStatus(env.DB, actors.d, id, "Inactif", 3), 404);
    await problem(setStatus(env.DB, actors.s3, id, "Inactif", 3), 404);
    await problem(setStatus(env.DB, actors.a, id, "Fermé", 3), 400);
    await problem(setStatus(env.DB, actors.a, id, "", 3), 400);
    await problem(setStatus(env.DB, actors.a, id, "Inactif", 0), 400);
    await problem(setStatus(env.DB, actors.a, id, "Inactif", NaN), 400);
    const stale = { ...actors.a };
    await env.DB.prepare("DELETE FROM session WHERE id=?").bind(stale.sessionId).run();
    await problem(setStatus(env.DB, stale, id, "Inactif", 3), 404);
    await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id='a'").run();
    await problem(setStatus(env.DB, actors.a, id, "Inactif", 3), 404);
    expect((await record(env.DB, actors.s1, id)).status).toBe("Actif");
    // Un superviseur peut agir sur un dossier dont le responsable est désactivé, sans changer ce responsable.
    await setStatus(env.DB, actors.s1, id, "Inactif", 3);
    expect(await one("SELECT owner_id,version,status FROM cases")).toEqual({ owner_id: "a", version: 4, status: "Inactif" });
    expect(await count("audit_events", "action='status_change'")).toBe(3);
  });
  it("accepte une seule mutation concurrente (statut/statut et statut/transfert) depuis une même version", async () => {
    let id = await create();
    const two = await Promise.allSettled([setStatus(env.DB, actors.a, id, "Inactif", 1), setStatus(env.DB, actors.s1, id, "Inactif", 1)]);
    expect(two.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await count("audit_events", "action='status_change'")).toBe(1);
    id = await create("a", "Seconde personne");
    const mixed = await Promise.allSettled([setStatus(env.DB, actors.a, id, "Inactif", 1), transfer(env.DB, actors.s1, id, "c", 1)]);
    expect(mixed.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const loser = mixed.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect([404, 409]).toContain(loser.reason.status);
    expect((await record(env.DB, actors.s1, id)).version).toBe(2);
  });
  it("répond 404 à l’ancien responsable et 409 à l’acteur encore autorisé, même si le statut cible est déjà atteint", async () => {
    const id = await create();
    await setStatus(env.DB, actors.a, id, "Inactif", 1);
    await problem(setStatus(env.DB, actors.s1, id, "Inactif", 1), 409);
    await transfer(env.DB, actors.s1, id, "b", 2);
    await problem(setStatus(env.DB, actors.a, id, "Actif", 3), 404);
    await problem(setStatus(env.DB, actors.a, id, "Inactif", 2), 404);
    await problem(setStatus(env.DB, actors.b, id, "Actif", 2), 409);
    await problem(transfer(env.DB, actors.s1, id, "c", 2), 409);
    expect(await count("audit_events", "action='status_change'")).toBe(1);
  });
  it("traite statut et version courants comme sans effet et conserve responsable, dates et contenus", async () => {
    const id = await create();
    const opened = (await one("SELECT opened_at FROM cases")).opened_at;
    await createNote(env.DB, actors.a, id, note);
    expect(await setStatus(env.DB, actors.a, id, "Actif", 1)).toBe(false);
    expect(await one("SELECT version FROM cases")).toEqual({ version: 1 });
    expect(await count("audit_events", "action='status_change'")).toBe(0);
    expect(await setStatus(env.DB, actors.a, id, "Inactif", 1)).toBe(true);
    expect(await setStatus(env.DB, actors.a, id, "Inactif", 2)).toBe(false);
    expect(await count("audit_events", "action='status_change'")).toBe(1);
    // Inactif : consultation, ajout de contenu et transfert restent possibles.
    await createNote(env.DB, actors.a, id, { ...note, nature: "Autre" });
    expect((await listNotes(env.DB, actors.a, id)).rows).toHaveLength(2);
    await transfer(env.DB, actors.a, id, "b", 2);
    await setStatus(env.DB, actors.b, id, "Actif", 3);
    expect(await one("SELECT owner_id,opened_at,status FROM cases")).toEqual({ owner_id: "b", opened_at: opened, status: "Actif" });
    expect((await listNotes(env.DB, actors.b, id)).rows).toHaveLength(2);
    expect(await count("clients")).toBe(1);
  });
  it("trace chaque transition avec acteur, statuts et version, sans contenu, de façon immuable et indivisible", async () => {
    const id = await create("a", "Nom confidentiel");
    await setStatus(env.DB, actors.a, id, "Inactif", 1);
    await transfer(env.DB, actors.a, id, "c", 2);
    await setStatus(env.DB, actors.c, id, "Actif", 3);
    const events = await statusEvents();
    expect(events.map((e) => [e.actor_id, e.previous_status, e.new_status, e.resource_type, e.resource_id, e.case_ids, e.resource_version])).toEqual([
      ["a", "Actif", "Inactif", "case", id, JSON.stringify([id]), 2],
      ["c", "Inactif", "Actif", "case", id, JSON.stringify([id]), 4],
    ]);
    expect(events.every((e) => e.previous_owner_id === null && e.new_owner_id === null && e.template_id === null)).toBe(true);
    expect(JSON.stringify(events)).not.toContain("Nom confidentiel");
    expect((await all("SELECT action FROM audit_events ORDER BY rowid")).map((e) => e.action)).toEqual(["create", "status_change", "transfer", "status_change"]);
    await expect(env.DB.prepare("UPDATE audit_events SET new_status='Actif'").run()).rejects.toBeDefined();
    await expect(env.DB.prepare("DELETE FROM audit_events WHERE action='status_change'").run()).rejects.toBeDefined();
    await env.DB.exec("CREATE TRIGGER fail_status BEFORE INSERT ON audit_events WHEN NEW.action='status_change' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(setStatus(env.DB, actors.c, id, "Inactif", 4)).rejects.toBeDefined();
    expect(await one("SELECT status,version FROM cases")).toEqual({ status: "Actif", version: 4 });
    expect(await count("audit_events", "action='status_change'")).toBe(2);
    // L'ancien responsable n'a aucun accès au dossier par ses événements.
    expect((await request("/dossiers/" + id, cookies.a)).status).toBe(404);
  });
});
describe("Parcours HTTP des statuts", () => {
  beforeEach(signIn);
  const post = (id: string, cookie: string, body: Record<string, string>, extra: Record<string, string> = {}) =>
    SELF.fetch(origin + `/dossiers/${id}/statut`, {
      method: "POST",
      headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/x-www-form-urlencoded", ...extra },
      body: new URLSearchParams(body),
      redirect: "manual",
    });
  it("redirige en 303 vers l’état réel, contrôle origine et type, et refuse sans fuite", async () => {
    const id = await create("a", "Nom confidentiel");
    const res = await post(id, cookies.a, { status: "Inactif", version: "1" });
    expect(res.status).toBe(303);
    const page = await (await request(res.headers.get("location")!, cookies.a)).text();
    expect(page).toContain("Le dossier est maintenant inactif.");
    expect(page).toContain("Réactiver");
    expect(page).toContain("Ce dossier est inactif");
    expect(page).toContain('value="2"');
    expect(page).toContain("Ajouter une note");
    expect((await post(id, cookies.a, { status: "Inactif", version: "1" }, { Origin: "https://hostile.example" })).status).toBe(403);
    const wrongType = await SELF.fetch(origin + `/dossiers/${id}/statut`, { method: "POST", headers: { Cookie: cookies.a, Origin: origin, "Content-Type": "application/json" }, body: "{}" });
    expect(wrongType.status).toBe(415);
    const stale = await post(id, cookies.s1, { status: "Actif", version: "1" });
    expect(stale.status).toBe(409);
    expect(await stale.text()).toContain("Actualisez la page");
    expect((await post(id, cookies.a, { status: "Fermé", version: "2" })).status).toBe(400);
    const gone = await post(id, cookies.b, { status: "Actif", version: "2" });
    expect(gone.status).toBe(404);
    expect(await gone.text()).toBe(await (await request("/dossiers/inexistant", cookies.b)).text());
    expect(await count("audit_events", "action='status_change'")).toBe(1);
    await transfer(env.DB, actors.s1, id, "c", 2);
    expect((await post(id, cookies.a, { status: "Actif", version: "3" })).status).toBe(404);
    expect((await post(id, cookies.c, { status: "Actif", version: "3" })).status).toBe(303);
  });
  it("renvoie 503 sans donnée nominative ni confirmation si l’audit échoue", async () => {
    const id = await create("a", "Nom confidentiel");
    await env.DB.exec("CREATE TRIGGER fail_status BEFORE INSERT ON audit_events WHEN NEW.action='status_change' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    const res = await post(id, cookies.a, { status: "Inactif", version: "1" });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("Nom confidentiel");
    expect(text).not.toContain("maintenant inactif");
    expect((await record(env.DB, actors.a, id)).status).toBe("Actif");
  });
  it("filtre par statut avec droits, total, pagination, valeur inconnue et état vide", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 27; i++) ids.push(await create("a", "Usager " + String(i).padStart(2, "0")));
    const other = await create("c", "Usager autre équipe");
    const hidden = await create("d", "Usager autre organisme");
    for (let i = 0; i < 26; i++) await setStatus(env.DB, actors.a, ids[i], "Inactif", 1);
    await setStatus(env.DB, actors.d, hidden, "Inactif", 1);
    const all_ = await listing(env.DB, actors.a, "Usager");
    expect(all_.total).toBe(27);
    expect((await listing(env.DB, actors.a, "Usager", 1, "inactif")).total).toBe(26);
    expect((await listing(env.DB, actors.a, "Usager", 2, "inactif")).rows).toHaveLength(1);
    expect((await listing(env.DB, actors.a, "Usager", 1, "actif")).total).toBe(1);
    expect((await listing(env.DB, actors.s2, "Usager", 1, "inactif")).total).toBe(26);
    expect((await listing(env.DB, actors.s1, "", 1, "inactif")).total).toBe(26);
    expect((await listing(env.DB, actors.s3, "", 1, "inactif")).total).toBe(1);
    await setStatus(env.DB, actors.c, other, "Inactif", 1);
    expect((await listing(env.DB, actors.a, "", 1, "inactif")).total).toBe(26);
    const initial = await (await request("/dossiers", cookies.a)).text();
    expect(initial).toContain("27 dossiers");
    expect(initial).toContain("Inactif");
    expect(initial).toContain("Actif");
    const page2 = await (await request("/dossiers?q=Usager&statut=inactif&page=2", cookies.a)).text();
    expect(page2).toContain("26 dossiers inactifs");
    expect(page2).toContain("Page 2 sur 2");
    const page1 = await (await request("/dossiers?q=Usager&statut=inactif", cookies.a)).text();
    expect(page1).toContain("q=Usager&amp;statut=inactif&amp;page=2");
    expect((await request("/dossiers?statut=ferme", cookies.a)).status).toBe(400);
    const empty = await (await request("/dossiers?q=zzz&statut=actif", cookies.a)).text();
    expect(empty).toContain("Aucun dossier trouvé");
    expect(empty).not.toContain("Usager 00");
    expect(empty).toContain("0 dossier");
  });
  it("parcours intégré : création Actif, contenu, inactivation, édition, transfert, réactivation par le nouveau responsable", async () => {
    const id = await create("a", "Parcours intégré");
    await createNote(env.DB, actors.a, id, { ...note, body: "Contenu conservé" });
    expect((await post(id, cookies.s2, { status: "Inactif", version: "1" })).status).toBe(303);
    expect((await request(`/dossiers/${id}/notes`, cookies.a, { ...note, nature: "Pendant inactivité" })).status).toBe(303);
    expect((await post(id, cookies.s1, { status: "Actif", version: "2" })).status).toBe(303);
    expect((await post(id, cookies.s1, { status: "Inactif", version: "3" })).status).toBe(303);
    await transfer(env.DB, actors.s1, id, "c", 4);
    expect((await post(id, cookies.c, { status: "Actif", version: "5" })).status).toBe(303);
    for (const gone of [cookies.a, cookies.b, cookies.d]) expect((await request("/dossiers/" + id, gone)).status).toBe(404);
    const page = await (await request("/dossiers/" + id, cookies.c)).text();
    expect(page).toContain("Contenu conservé");
    expect(page).toContain("Pendant inactivité");
    for (const who of ["s1", "s2"]) expect((await request("/dossiers/" + id, cookies[who])).status).toBe(200);
    expect((await all("SELECT action FROM audit_events WHERE resource_type='case' AND action<>'read' ORDER BY rowid")).map((e) => e.action)).toEqual([
      "create",
      "status_change",
      "status_change",
      "status_change",
      "transfer",
      "status_change",
    ]);
  });
});

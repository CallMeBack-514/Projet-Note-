import { beforeEach, describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { seed, login, request, origin } from "./helpers";
import { authenticate, type Actor } from "../src/auth";
import { createRecord, transfer, record } from "../src/records";
import { createNote, listNotes, updateFollowUp, validateNote } from "../src/notes";
import {
  createTemplate,
  updateTemplate,
  retireTemplate,
  getTemplate,
  listTemplates,
  applyOperation,
  readDraft,
  type DraftField,
} from "../src/document-templates";
import { createDocument, getDocument, listDocuments, updateDocument } from "../src/documents";
let cookies: Record<string, string>, actors: Record<string, Actor>;
beforeEach(async () => {
  await seed();
  cookies = {};
  actors = {};
  for (const id of ["a", "b", "c", "s1", "s2", "d", "s3"]) {
    cookies[id] = await login(id);
    actors[id] = (await authenticate(env, new Headers({ Cookie: cookies[id] })))!;
  }
});
const create = (who = "a", name = "Personne fictive") => createRecord(env.DB, actors[who], { name });
const one = async (sql: string, ...args: unknown[]) => env.DB.prepare(sql).bind(...args).first<any>();
const all = async (sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).all<any>()).results;
const count = async (table: string, where = "1=1") => (await one(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`)).n as number;
const events = (where = "1=1") => all(`SELECT * FROM audit_events WHERE ${where} ORDER BY rowid`);
const noteForm = (over: Record<string, string> = {}) => ({
  body: "Texte de la note",
  nature: "Rencontre",
  participants: "Proche, partenaire",
  date: "2025-10-01",
  time: "10:30",
  tz: "America/Toronto",
  ...over,
});
const draft = (...fields: Partial<DraftField>[]): DraftField[] =>
  fields.map((f) => ({ id: "", label: "Champ", type: "text", required: false, help: "", options: "", ...f }));
const financing = () =>
  draft(
    { label: "Situation", type: "textarea", required: true },
    { label: "Montant demandé", type: "number", required: true },
    { label: "Programme", type: "choice", options: "Logement\nAlimentation" },
    { label: "Date de la demande", type: "date" },
    { label: "Résumé", type: "text" },
  );
const problem = (p: Promise<unknown>, status: number) => expect(p).rejects.toMatchObject({ status });
const fieldsOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e: any) {
    return e.fields as Record<string, string>;
  }
  throw new Error("aucune erreur de champ");
};
describe("2. Contrat d’audit et lectures cohérentes", () => {
  it("minimise les événements de contenu et lie note et suivi par une opération commune", async () => {
    const id = await create();
    await createNote(env.DB, actors.a, id, noteForm({ follow_description: "Rappeler la personne", follow_due: "2025-11-01" }));
    const [created, note, follow] = await events();
    expect(created).toMatchObject({ action: "create", resource_type: "case", resource_id: id });
    expect(note).toMatchObject({ action: "create", resource_type: "note", actor_id: "a", case_ids: JSON.stringify([id]) });
    expect(follow).toMatchObject({ action: "create", resource_type: "follow_up", new_state: "todo", resource_version: 1 });
    expect(note.operation_id).toBe(follow.operation_id);
    const dump = JSON.stringify([note, follow]);
    for (const secret of ["Texte de la note", "Proche", "Rappeler"]) expect(dump).not.toContain(secret);
    await expect(env.DB.prepare("UPDATE audit_events SET actor_id='b'").run()).rejects.toBeDefined();
    await expect(env.DB.prepare("DELETE FROM audit_events").run()).rejects.toBeDefined();
  });
  it("sert exactement les éléments tracés par page, sans trace pour une page vide", async () => {
    const id = await create();
    expect((await listNotes(env.DB, actors.a, id)).rows).toEqual([]);
    expect(await events("action='read'")).toHaveLength(0);
    for (let i = 0; i < 27; i++) await createNote(env.DB, actors.a, id, noteForm({ time: `${String(i % 24).padStart(2, "0")}:00`, date: `2025-09-${String(1 + Math.floor(i / 24)).padStart(2, "0")}`, follow_description: i % 2 ? "x" : "" }));
    const first = await listNotes(env.DB, actors.a, id, 1),
      second = await listNotes(env.DB, actors.a, id, 2);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(2);
    expect(first.total).toBe(27);
    const read = await events("action='read' AND resource_type='note'");
    expect(read.map((e) => e.resource_id).sort()).toEqual([...first.rows, ...second.rows].map((r) => r.id).sort());
    const followReads = await events("action='read' AND resource_type='follow_up'");
    expect(followReads.length).toBe([...first.rows, ...second.rows].filter((r) => r.fu_id).length);
    expect(followReads.every((e) => e.resource_version === 1)).toBe(true);
  });
  it("ne retourne ni ne trace rien après révocation et n’expose aucun contenu si la trace échoue", async () => {
    const id = await create();
    await createNote(env.DB, actors.a, id, noteForm());
    await transfer(env.DB, actors.a, id, "b", 1);
    const before = await count("audit_events");
    expect((await listNotes(env.DB, actors.a, id)).rows).toEqual([]);
    expect(await count("audit_events")).toBe(before);
    await env.DB.exec("CREATE TRIGGER fail_note_read BEFORE INSERT ON audit_events WHEN NEW.action='read' AND NEW.resource_type='note' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(listNotes(env.DB, actors.b, id)).rejects.toBeDefined();
    const res = await request("/dossiers/" + id, cookies.b);
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("Texte de la note");
  });
});
describe("3. Notes et suivis", () => {
  it("attribue l’auteur et la date de saisie côté serveur, refuse un auteur falsifié", async () => {
    const id = await create();
    await problem(createNote(env.DB, actors.a, id, noteForm({ author_id: "b" })), 403);
    await problem(createNote(env.DB, actors.a, id, noteForm({ organisation_id: "o2" })), 403);
    expect(await count("case_notes")).toBe(0);
    const noteId = await createNote(env.DB, actors.a, id, noteForm());
    const row = await one("SELECT * FROM case_notes WHERE id=?", noteId);
    expect(row).toMatchObject({ author_id: "a", organisation_id: "o1", occurred_at: "2025-10-01T14:30:00.000Z", utc_offset_minutes: -240 });
    expect(Date.parse(row.recorded_at)).toBeGreaterThan(Date.parse(row.occurred_at));
    expect(Date.now() - Date.parse(row.recorded_at)).toBeLessThan(60000);
  });
  it("valide champs obligatoires, limites en caractères et saisies multioctets", async () => {
    const id = await create();
    expect(await fieldsOf(createNote(env.DB, actors.a, id, noteForm({ body: "  ", nature: "" })))).toMatchObject({ body: expect.any(String), nature: expect.any(String) });
    expect(await fieldsOf(createNote(env.DB, actors.a, id, noteForm({ body: "é".repeat(10001) })))).toHaveProperty("body");
    expect(await fieldsOf(createNote(env.DB, actors.a, id, noteForm({ participants: "x".repeat(2001) })))).toHaveProperty("participants");
    expect(await fieldsOf(createNote(env.DB, actors.a, id, noteForm({ follow_due: "2025-11-01" })))).toHaveProperty("follow_description");
    expect(await fieldsOf(createNote(env.DB, actors.a, id, noteForm({ follow_description: "x", follow_due: "2025-02-30" })))).toHaveProperty("follow_due");
    expect(await fieldsOf(createNote(env.DB, actors.a, id, noteForm({ date: "2999-01-01" })))).toHaveProperty("date");
    await createNote(env.DB, actors.a, id, noteForm({ body: "é".repeat(10000), participants: "" }));
    expect(await count("case_notes")).toBe(1);
  });
  it("refuse une heure inexistante, exige le décalage d’une heure répétée et ne décale jamais en silence", () => {
    const at = (over: Record<string, string>) => validateNote({ ...noteForm(), ...over }, Date.parse("2027-01-01"));
    expect(() => at({ date: "2025-03-09", time: "02:30" })).toThrow();
    try {
      at({ date: "2025-03-09", time: "02:30" });
    } catch (e: any) {
      expect(e.fields.time).toContain("n’existe pas");
    }
    try {
      at({ date: "2025-11-02", time: "01:30" });
      throw new Error("devait échouer");
    } catch (e: any) {
      expect(e.fields.offset).toContain("se répète");
    }
    expect(at({ date: "2025-11-02", time: "01:30", offset: "-240" }).when.instant).toBe("2025-11-02T05:30:00.000Z");
    expect(at({ date: "2025-11-02", time: "01:30", offset: "-300" }).when.instant).toBe("2025-11-02T06:30:00.000Z");
    expect(() => at({ date: "2025-11-02", time: "01:30", offset: "-120" })).toThrow();
    expect(() => at({ date: "2025-10-01", time: "10:30", offset: "-300" })).toThrow();
    expect(at({ date: "2025-03-09", time: "03:30" }).when.instant).toBe("2025-03-09T07:30:00.000Z");
    expect(at({ date: "2025-01-15", time: "09:00" }).when).toMatchObject({ instant: "2025-01-15T14:00:00.000Z", offset: -300 });
    expect(() => at({ tz: "Mars/Olympus" })).toThrow();
    expect(() => at({ date: "2025-13-40" })).toThrow();
  });
  it("annule note et suivi ensemble et protège le corps des notes", async () => {
    const id = await create();
    await env.DB.exec("CREATE TRIGGER fail_follow BEFORE INSERT ON audit_events WHEN NEW.resource_type='follow_up' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(createNote(env.DB, actors.a, id, noteForm({ follow_description: "Suivi" }))).rejects.toBeDefined();
    expect(await count("case_notes")).toBe(0);
    expect(await count("note_follow_ups")).toBe(0);
    expect(await events("resource_type='note'")).toHaveLength(0);
    await env.DB.exec("DROP TRIGGER fail_follow");
    const noteId = await createNote(env.DB, actors.a, id, noteForm({ follow_description: "Suivi" }));
    await expect(env.DB.prepare("UPDATE case_notes SET body='Réécrit' WHERE id=?").bind(noteId).run()).rejects.toThrow("note_immutable");
    await expect(env.DB.prepare("DELETE FROM case_notes WHERE id=?").bind(noteId).run()).rejects.toThrow("note_immutable");
    await expect(env.DB.prepare("DELETE FROM note_follow_ups").run()).rejects.toBeDefined();
    await expect(
      env.DB.prepare("INSERT INTO case_notes(id,organisation_id,case_id,body,nature,occurred_at,time_zone,utc_offset_minutes,author_id,session_id,operation_id) VALUES('x','o2',?,'t','n','2025-10-01T14:30:00.000Z','UTC',0,'d',?,'op')")
        .bind(id, actors.d.sessionId)
        .run(),
    ).rejects.toBeDefined();
  });
  it("modifie le suivi avec concurrence, provenance de clôture et droits courants après transfert", async () => {
    const id = await create();
    const noteId = await createNote(env.DB, actors.a, id, noteForm({ follow_description: "Rappeler", follow_due: "2025-11-01" }));
    const values = (over: Record<string, string> = {}) => ({ description: "Rappeler", due: "2025-11-01", state: "todo", version: "1", ...over });
    const results = await Promise.allSettled([
      updateFollowUp(env.DB, actors.a, id, noteId, values({ state: "done" })),
      updateFollowUp(env.DB, actors.s1, id, noteId, values({ description: "Autre" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await events("action='update' AND resource_type='follow_up'")).toHaveLength(1);
    await updateFollowUp(env.DB, actors.a, id, noteId, values({ state: "done", version: String((await one("SELECT version FROM note_follow_ups")).version) }));
    await transfer(env.DB, actors.a, id, "b", 1);
    await problem(updateFollowUp(env.DB, actors.a, id, noteId, values({ version: "3" })), 404);
    const current = (await one("SELECT * FROM note_follow_ups")).version;
    await updateFollowUp(env.DB, actors.b, id, noteId, values({ state: "todo", version: String(current) }));
    expect(await one("SELECT state,closed_by,closed_at FROM note_follow_ups")).toEqual({ state: "todo", closed_by: null, closed_at: null });
    await updateFollowUp(env.DB, actors.b, id, noteId, values({ state: "done", version: String(current + 1) }));
    expect(await one("SELECT state,closed_by FROM note_follow_ups")).toMatchObject({ state: "done", closed_by: "b" });
    expect((await one("SELECT author_id FROM case_notes")).author_id).toBe("a");
    const last = (await events("resource_type='follow_up'")).at(-1);
    expect(last).toMatchObject({ actor_id: "b", previous_state: "todo", new_state: "done" });
    await problem(updateFollowUp(env.DB, actors.s2, id, "inconnu", values()), 404);
  });
  it("retire les droits de l’ancien responsable même auteur, conserve le contenu pour le nouveau et les superviseurs", async () => {
    const id = await create();
    await createNote(env.DB, actors.a, id, noteForm({ body: "Contenu visible du nouveau responsable" }));
    await transfer(env.DB, actors.a, id, "c", 1);
    await problem(createNote(env.DB, actors.a, id, noteForm()), 404);
    expect((await request(`/dossiers/${id}/notes/nouvelle`, cookies.a)).status).toBe(404);
    expect((await request(`/dossiers/${id}/notes`, cookies.a, noteForm())).status).toBe(404);
    for (const who of ["c", "s1", "s2"]) {
      expect((await listNotes(env.DB, actors[who], id)).rows[0]).toMatchObject({ author_name: "Émilie" });
    }
    expect(await (await request("/dossiers/" + id, cookies.c)).text()).toContain("Contenu visible du nouveau responsable");
    expect((await request("/dossiers/" + id, cookies.d)).status).toBe(404);
    expect((await request(`/dossiers/${id}/notes/nouvelle`, cookies.s3)).status).toBe(404);
    await problem(createNote(env.DB, actors.d, id, noteForm()), 404);
  });
  it("sert les écrans de notes échappés, sans cache, avec erreurs de champs et CSRF", async () => {
    const id = await create();
    const form = await request(`/dossiers/${id}/notes/nouvelle`, cookies.a);
    expect(form.status).toBe(200);
    expect(form.headers.get("cache-control")).toContain("no-store");
    const bad = await request(`/dossiers/${id}/notes`, cookies.a, noteForm({ body: "<script>alert(1)</script>", nature: "" }));
    expect(bad.status).toBe(400);
    const html = await bad.text();
    expect(html).toContain("Indiquez la nature");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert");
    const ok = await request(`/dossiers/${id}/notes`, cookies.a, noteForm({ body: "<img src=x onerror=alert(1)>", follow_description: "<b>tâche</b>" }));
    expect(ok.status).toBe(303);
    const detail = await (await request(ok.headers.get("location")!, cookies.a)).text();
    expect(detail).toContain("&lt;img");
    expect(detail).not.toContain("<img src=x");
    expect(detail).toContain("ne peut pas être modifiée");
    const hostile = await SELF.fetch(origin + `/dossiers/${id}/notes`, {
      method: "POST",
      headers: { Cookie: cookies.a, Origin: "https://hostile.example", "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(noteForm()),
    });
    expect(hostile.status).toBe(403);
    expect(await count("case_notes")).toBe(1);
  });
  it("limite les corps par parcours sans fuite de contenu", async () => {
    const id = await create();
    const post = (path: string, body: string, cookie = cookies.a) =>
      SELF.fetch(origin + path, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/x-www-form-urlencoded" }, body, redirect: "manual" });
    const long = new URLSearchParams(noteForm({ body: "é".repeat(10000), participants: "ü".repeat(1900) })).toString();
    expect(long.length).toBeGreaterThan(16 * 1024);
    expect((await post(`/dossiers/${id}/notes`, long)).status).toBe(303);
    const huge = "body=" + "SECRET".repeat(50000);
    const res = await post(`/dossiers/${id}/notes`, huge);
    expect(res.status).toBe(413);
    expect(await res.text()).not.toContain("SECRET");
    expect((await post("/dossiers", "name=" + "x".repeat(17000))).status).toBe(413);
    expect((await post("/dossiers/" + id + "/transfert", "owner_id=b&version=1&x=" + "x".repeat(17000))).status).toBe(413);
    expect((await post("/modeles", "title=" + "x".repeat(300000), cookies.s1)).status).toBe(413);
  });
});
describe("4. Modèles de documents", () => {
  it("réserve l’administration aux superviseurs et isole les organismes", async () => {
    await problem(createTemplate(env.DB, actors.a, "Interdit", draft({ label: "x" })), 403);
    const t = await createTemplate(env.DB, actors.s1, "Demande de financement", financing());
    expect(await listTemplates(env.DB, actors.s2)).toHaveLength(1);
    expect(await listTemplates(env.DB, actors.a)).toHaveLength(1);
    expect(await listTemplates(env.DB, actors.s3)).toEqual([]);
    await problem(getTemplate(env.DB, actors.s3, t), 404);
    await problem(getTemplate(env.DB, actors.d, t), 404);
    await problem(updateTemplate(env.DB, actors.a, t, 1, "Modifié", draft({ label: "x" })), 403);
    await problem(updateTemplate(env.DB, actors.s3, t, 1, "Autre organisme", draft({ label: "x" })), 404);
    await problem(retireTemplate(env.DB, actors.a, t, 1), 403);
    expect((await request("/modeles", cookies.a)).status).toBe(403);
    expect((await request("/modeles/" + t, cookies.s3)).status).toBe(404);
    expect((await request("/modeles/" + t, cookies.s3)).status).toBe((await request("/modeles/inconnu", cookies.s3)).status);
    expect((await request("/modeles", cookies.s1, { op: "save", title: "Direct", "f.0.label": "x", "f.0.type": "text" })).status).toBe(303);
    expect((await request("/modeles", cookies.a, { op: "save", title: "Direct", "f.0.label": "x" })).status).toBe(403);
    expect(await count("document_templates")).toBe(2);
  });
  it("refuse les définitions inexploitables avec les éléments à corriger", async () => {
    const bad = (fields: DraftField[], title = "Titre") => fieldsOf(createTemplate(env.DB, actors.s1, title, fields));
    expect(await bad(draft({ label: "x" }), " ")).toHaveProperty("title");
    expect(await bad(draft({ label: "" }))).toHaveProperty(["f.0.label"]);
    expect(await bad(draft({ label: "x", id: "dup" }, { label: "y", id: "dup" }))).toHaveProperty(["f.1.label"]);
    expect(await bad(draft({ label: "x", type: "choice", options: "  \n" }))).toHaveProperty(["f.0.options"]);
    expect(await bad(draft({ label: "x", type: "choice", options: "A\nA" }))).toHaveProperty(["f.0.options"]);
    expect(await bad(draft({ label: "x", type: "inconnu" }))).toHaveProperty(["f.0.type"]);
    expect(await bad([])).toHaveProperty("fields");
    expect(await bad(Array.from({ length: 31 }, () => draft({ label: "x" })[0]))).toHaveProperty("fields");
    expect(await bad(draft({ label: "x".repeat(161) }))).toHaveProperty(["f.0.label"]);
    expect(await bad(draft({ label: "x", id: "ID invalide!" }))).toBeDefined();
    expect(await count("document_templates")).toBe(0);
  });
  it("conserve l’ordre et les identifiants stables, et trace création, version et retrait sans contenu", async () => {
    const t = await createTemplate(env.DB, actors.s1, "Évaluation du risque", financing());
    const v1 = await getTemplate(env.DB, actors.s1, t);
    expect(v1.fields.map((f) => f.label)).toEqual(["Situation", "Montant demandé", "Programme", "Date de la demande", "Résumé"]);
    expect(v1.fields[2].options).toEqual([{ id: "o1", label: "Logement" }, { id: "o2", label: "Alimentation" }]);
    expect(new Set(v1.fields.map((f) => f.id)).size).toBe(5);
    const v2 = await updateTemplate(env.DB, actors.s2, t, 1, "Évaluation du risque", [...draft(...v1.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, required: f.required, options: (f.options ?? []).map((o) => o.label).join("\n") }))), ...draft({ label: "Nouveau champ", required: true })]);
    expect(v2).toBe(2);
    expect((await getTemplate(env.DB, actors.s1, t, 1)).fields).toHaveLength(5);
    expect((await getTemplate(env.DB, actors.s1, t)).fields).toHaveLength(6);
    await retireTemplate(env.DB, actors.s1, t, 2);
    const ev = await events("resource_type='document_template'");
    expect(ev.map((e) => [e.action, e.template_version, e.previous_state, e.new_state, e.case_ids])).toEqual([
      ["create", 1, null, "available", "[]"],
      ["update", 2, "available", "available", "[]"],
      ["update", 2, "available", "retired", "[]"],
    ]);
    expect(JSON.stringify(ev)).not.toContain("Situation");
    await problem(updateTemplate(env.DB, actors.s1, t, 2, "Retiré", draft({ label: "x" })), 409);
    await problem(retireTemplate(env.DB, actors.s1, t, 2), 409);
    await expect(env.DB.prepare("UPDATE document_template_versions SET title='x'").run()).rejects.toBeDefined();
    await expect(env.DB.prepare("DELETE FROM document_templates").run()).rejects.toBeDefined();
  });
  it("accepte une seule des deux modifications concurrentes d’une même version et annule l’audit en cas d’échec", async () => {
    const t = await createTemplate(env.DB, actors.s1, "Modèle", draft({ label: "x" }));
    const results = await Promise.allSettled([
      updateTemplate(env.DB, actors.s1, t, 1, "A", draft({ label: "a" })),
      updateTemplate(env.DB, actors.s2, t, 1, "B", draft({ label: "b" })),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect((await one("SELECT current_version FROM document_templates")).current_version).toBe(2);
    expect(await count("document_template_versions")).toBe(2);
    await env.DB.exec("CREATE TRIGGER fail_t BEFORE INSERT ON audit_events WHEN NEW.resource_type='document_template' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(createTemplate(env.DB, actors.s1, "Rien", draft({ label: "x" }))).rejects.toBeDefined();
    await expect(updateTemplate(env.DB, actors.s1, t, 2, "Rien", draft({ label: "x" }))).rejects.toBeDefined();
    expect(await count("document_templates")).toBe(1);
    expect((await one("SELECT current_version FROM document_templates")).current_version).toBe(2);
    expect(await count("document_template_versions")).toBe(2);
  });
  it("offre des opérations clavier d’ajout, retrait et déplacement", () => {
    const base = draft({ label: "A" }, { label: "B" }, { label: "C" });
    const labels = (f: DraftField[]) => f.map((x) => x.label);
    expect(labels(applyOperation(base, "add"))).toEqual(["A", "B", "C", ""]);
    expect(labels(applyOperation(base, "remove:1"))).toEqual(["A", "C"]);
    expect(labels(applyOperation(base, "up:2"))).toEqual(["A", "C", "B"]);
    expect(labels(applyOperation(base, "down:0"))).toEqual(["B", "A", "C"]);
    expect(labels(applyOperation(base, "up:0"))).toEqual(["A", "B", "C"]);
    expect(labels(applyOperation(base, "remove:9"))).toEqual(["A", "B", "C"]);
    expect(readDraft({ "f.1.label": "B", "f.0.label": "A", "f.0.required": "1", "f.0.type": "date", autre: "x" }).map((f) => [f.label, f.required, f.type])).toEqual([["A", true, "date"], ["B", false, "text"]]);
  });
  it("sert le constructeur échappé, accessible au clavier et sans cache", async () => {
    const page = await request("/modeles/nouveau", cookies.s1);
    expect(page.status).toBe(200);
    const added = await request("/modeles", cookies.s1, { op: "add", title: "<b>x</b>", "f.0.label": "<script>1</script>", "f.0.type": "text" });
    const html = await added.text();
    expect(html).toContain("Champ 2");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>1");
    expect(html).toContain('value="up:1"');
    expect(added.headers.get("cache-control")).toContain("no-store");
    const invalid = await request("/modeles", cookies.s1, { op: "save", title: "", "f.0.label": "" });
    expect(invalid.status).toBe(400);
    expect(await invalid.text()).toContain("Donnez un titre");
    expect(await count("document_templates")).toBe(0);
  });
});
describe("5. Documents remplis", () => {
  let caseId: string, templateId: string, fields: Record<string, string>;
  const answers = (over: Record<string, string> = {}) => ({
    ["a." + fields.situation]: "Situation décrite",
    ["a." + fields.amount]: "1250,50",
    ["a." + fields.program]: "o2",
    ["a." + fields.date]: "2025-09-30",
    ...over,
  });
  beforeEach(async () => {
    caseId = await create();
    templateId = await createTemplate(env.DB, actors.s1, "Demande de financement", financing());
    const t = await getTemplate(env.DB, actors.s1, templateId);
    fields = { situation: t.fields[0].id, amount: t.fields[1].id, program: t.fields[2].id, date: t.fields[3].id, text: t.fields[4].id };
  });
  const make = (who = "a", over: Record<string, string> = {}, version = 1) => createDocument(env.DB, actors[who], caseId, templateId, version, answers(over));
  it("enregistre un document rattaché à la version du modèle avec auteur et événements minimisés", async () => {
    const id = await make();
    expect(await one("SELECT * FROM case_documents WHERE id=?", id)).toMatchObject({ template_version: 1, created_by: "a", updated_by: "a", version: 1 });
    expect(JSON.parse((await one("SELECT answers FROM case_documents")).answers)).toEqual({ [fields.situation]: "Situation décrite", [fields.amount]: 1250.5, [fields.program]: "o2", [fields.date]: "2025-09-30" });
    const ev = (await events("resource_type='document'"))[0];
    expect(ev).toMatchObject({ action: "create", template_id: templateId, template_version: 1, case_ids: JSON.stringify([caseId]), actor_id: "a" });
    expect(JSON.stringify(ev)).not.toContain("Situation décrite");
  });
  it("valide types, options, champs obligatoires et références falsifiées sans document partiel", async () => {
    const bad = (over: Record<string, string>) => fieldsOf(make("a", over));
    expect(await bad({ ["a." + fields.situation]: "" })).toHaveProperty(["a." + fields.situation]);
    expect(await bad({ ["a." + fields.amount]: "abc" })).toHaveProperty(["a." + fields.amount]);
    expect(await bad({ ["a." + fields.amount]: "Infinity" })).toHaveProperty(["a." + fields.amount]);
    expect(await bad({ ["a." + fields.program]: "o9" })).toHaveProperty(["a." + fields.program]);
    expect(await bad({ ["a." + fields.date]: "2025-02-30" })).toHaveProperty(["a." + fields.date]);
    expect(await bad({ ["a." + fields.text]: "x".repeat(501) })).toHaveProperty(["a." + fields.text]);
    expect(await bad({ ["a." + fields.text]: "deux\nlignes" })).toHaveProperty(["a." + fields.text]);
    await problem(make("a", { "a.inconnu": "x" }), 400);
    await problem(createDocument(env.DB, actors.d, caseId, templateId, 1, answers()), 404);
    await problem(createDocument(env.DB, actors.b, caseId, templateId, 1, answers()), 404);
    const other = await createRecord(env.DB, actors.d, { name: "Autre organisme" });
    await problem(createDocument(env.DB, actors.d, other, templateId, 1, answers()), 404);
    await problem(createDocument(env.DB, actors.a, caseId, templateId, 1, answers({ created_by: "b" })), 403);
    await problem(createDocument(env.DB, actors.a, caseId, templateId, 7, answers()), 404);
    expect(await count("case_documents")).toBe(0);
    expect(await events("resource_type='document'")).toHaveLength(0);
  });
  it("annule le document si l’audit échoue", async () => {
    await env.DB.exec("CREATE TRIGGER fail_d BEFORE INSERT ON audit_events WHEN NEW.resource_type='document' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(make()).rejects.toBeDefined();
    expect(await count("case_documents")).toBe(0);
  });
  it("garde la version d’origine quand le modèle évolue et refuse un ancien formulaire après retrait", async () => {
    const first = await make();
    await updateTemplate(env.DB, actors.s2, templateId, 1, "Demande de financement v2", draft({ label: "Seulement ceci", required: true }));
    const old = await getDocument(env.DB, actors.a, caseId, first);
    expect(old.template_version).toBe(1);
    expect(old.fields.map((f) => f.label)).toContain("Situation");
    expect(old.template_title).toBe("Demande de financement");
    const stillV1 = await make("a", {}, 1);
    expect((await one("SELECT template_version FROM case_documents WHERE id=?", stillV1)).template_version).toBe(1);
    const v2fields = (await getTemplate(env.DB, actors.s1, templateId)).fields;
    const second = await createDocument(env.DB, actors.a, caseId, templateId, 2, { ["a." + v2fields[0].id]: "ok" });
    expect((await getDocument(env.DB, actors.a, caseId, second)).fields).toHaveLength(1);
    await retireTemplate(env.DB, actors.s1, templateId, 2);
    await problem(make(), 409);
    await problem(createDocument(env.DB, actors.a, caseId, templateId, 2, { ["a." + v2fields[0].id]: "ok" }), 409);
    expect(await count("case_documents")).toBe(3);
    await updateDocument(env.DB, actors.a, caseId, first, 1, answers({ ["a." + fields.situation]: "Corrigée après retrait" }));
    expect((await getDocument(env.DB, actors.a, caseId, first)).answers[fields.situation]).toBe("Corrigée après retrait");
    expect((await one("SELECT status FROM document_templates")).status).toBe("retired");
  });
  it("modifie avec version attendue, conserve la création et refuse l’ancien responsable", async () => {
    const id = await make();
    const concurrent = await Promise.allSettled([
      updateDocument(env.DB, actors.a, caseId, id, 1, answers({ ["a." + fields.situation]: "Version A" })),
      updateDocument(env.DB, actors.s1, caseId, id, 1, answers({ ["a." + fields.situation]: "Version S1" })),
    ]);
    expect(concurrent.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(concurrent.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } });
    expect(await events("action='update' AND resource_type='document'")).toHaveLength(1);
    await transfer(env.DB, actors.a, caseId, "b", 1);
    await problem(updateDocument(env.DB, actors.a, caseId, id, 2, answers()), 404);
    await problem(getDocument(env.DB, actors.a, caseId, id), 404);
    expect((await request(`/dossiers/${caseId}/documents/${id}`, cookies.a)).status).toBe(404);
    expect((await request(`/dossiers/${caseId}/documents/${id}`, cookies.a, { version: "2" })).status).toBe(404);
    await updateDocument(env.DB, actors.b, caseId, id, 2, answers({ ["a." + fields.situation]: "Par le nouveau responsable" }));
    const row = await one("SELECT * FROM case_documents");
    expect(row).toMatchObject({ created_by: "a", updated_by: "b", version: 3, case_id: caseId });
    const ev = await events("resource_type IN ('case','document') AND action<>'read'");
    expect(ev.map((e) => [e.action, e.actor_id])).toEqual([["create", "a"], ["create", "a"], ["update", expect.any(String)], ["transfer", "a"], ["update", "b"]]);
    await problem(updateDocument(env.DB, actors.b, caseId, id, 99, answers()), 409);
    await problem(updateDocument(env.DB, actors.b, caseId, id, 3, { ...answers(), "a.inconnu": "x" }), 400);
    await expect(env.DB.prepare("UPDATE case_documents SET case_id='autre',version=version+1,last_operation_id='z'").run()).rejects.toBeDefined();
  });
  it("liste et sert les documents avec leurs traces de lecture, pour toutes les équipes des superviseurs", async () => {
    const id = await make();
    await make("a", { ["a." + fields.situation]: "<script>alert(1)</script>" });
    const list = await listDocuments(env.DB, actors.s2, caseId);
    expect(list.rows).toHaveLength(2);
    const reads = await events("action='read' AND resource_type='document'");
    expect(reads.map((e) => e.resource_id).sort()).toEqual(list.rows.map((r) => r.id).sort());
    expect(reads.every((e) => e.template_id === templateId && e.template_version === 1)).toBe(true);
    expect(JSON.stringify(reads)).not.toContain("alert");
    const page = await request(`/dossiers/${caseId}`, cookies.a);
    const html = await page.text();
    expect(html).toContain("Demande de financement");
    expect(html).toContain("Version 1 du modèle");
    const detail = await request(`/dossiers/${caseId}/documents/${id}`, cookies.a);
    expect(detail.status).toBe(200);
    expect(detail.headers.get("cache-control")).toContain("no-store");
    const dirty = (await listDocuments(env.DB, actors.a, caseId)).rows.find((r) => r.id !== id)!;
    const dirtyHtml = await (await request(`/dossiers/${caseId}/documents/${dirty.id}`, cookies.a)).text();
    expect(dirtyHtml).toContain("&lt;script&gt;");
    expect(dirtyHtml).not.toContain("<script>alert");
    expect(await getDocument(env.DB, actors.s2, caseId, id)).toMatchObject({ created_by_name: "Émilie" });
    await env.DB.exec("CREATE TRIGGER fail_dr BEFORE INSERT ON audit_events WHEN NEW.action='read' AND NEW.resource_type='document' BEGIN SELECT RAISE(ABORT,'simulated'); END;");
    await expect(getDocument(env.DB, actors.a, caseId, id)).rejects.toBeDefined();
    const failed = await request(`/dossiers/${caseId}/documents/${id}`, cookies.a);
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("Situation décrite");
  });
  it("propose le formulaire dynamique, l’état vide et réaffiche les valeurs après contrôle d’accès", async () => {
    const choice = await (await request(`/dossiers/${caseId}/documents/nouveau`, cookies.a)).text();
    expect(choice).toContain("Demande de financement");
    const form = await request(`/dossiers/${caseId}/documents/nouveau/${templateId}?v=1`, cookies.a);
    const html = await form.text();
    expect(html).toContain("Situation *");
    expect(html).toContain("Montant demandé *");
    expect(html).toContain("Alimentation");
    const missingField = await request(`/dossiers/${caseId}/documents`, cookies.a, { template_id: templateId, template_version: "1", ["a." + fields.amount]: "12" });
    expect(missingField.status).toBe(400);
    const retry = await missingField.text();
    expect(retry).toContain("Ce champ est obligatoire");
    expect(retry).toContain('value="12"');
    const saved = await request(`/dossiers/${caseId}/documents`, cookies.a, { template_id: templateId, template_version: "1", ...answers() });
    expect(saved.status).toBe(303);
    await transfer(env.DB, actors.s1, caseId, "c", 1);
    const stale = await request(`/dossiers/${caseId}/documents`, cookies.a, { template_id: templateId, template_version: "1", ["a." + fields.amount]: "12" });
    expect(stale.status).toBe(404);
    expect(await stale.text()).not.toContain('value="12"');
    await retireTemplate(env.DB, actors.s1, templateId, 1);
    const empty = await (await request(`/dossiers/${caseId}/documents/nouveau`, cookies.c)).text();
    expect(empty).toContain("Aucun modèle disponible");
    expect((await request(`/dossiers/${caseId}/documents/nouveau/${templateId}?v=1`, cookies.c)).status).toBe(404);
  });
});
describe("6. Fiche et dossier unique", () => {
  it("remplace la duplication par les actions Ajouter une note et Ajouter un document", async () => {
    const id = await create();
    const html = await (await request("/dossiers/" + id, cookies.a)).text();
    expect(html).toContain("Ajouter une note");
    expect(html).toContain("Ajouter un document");
    expect(html).not.toContain("Créer un autre dossier");
    expect(html).toContain("Aucune note pour l’instant");
    expect((await request("/dossiers/nouveau?source=" + id, cookies.b)).status).toBe(404);
    expect((await record(env.DB, actors.s1, id)).owner_name).toBe("Émilie");
  });
  it("pagine notes et documents indépendamment", async () => {
    const id = await create();
    for (let i = 0; i < 26; i++) await createNote(env.DB, actors.a, id, noteForm({ nature: "Note " + String(i).padStart(2, "0"), time: `${String(i % 24).padStart(2, "0")}:00`, date: i < 24 ? "2025-09-01" : "2025-09-02" }));
    const html = await (await request(`/dossiers/${id}?np=2`, cookies.a)).text();
    expect(html).toContain("Page 2 sur 2");
    expect(html).toContain("Page précédente");
    expect((html.match(/data-note/g) ?? []).length).toBe(1);
  });
});

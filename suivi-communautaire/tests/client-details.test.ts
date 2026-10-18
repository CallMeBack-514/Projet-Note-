import { beforeEach, describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { reset, applyD1Migrations } from "cloudflare:test";
import { seed, login, request } from "./helpers";
import { authenticate, type Actor } from "../src/auth";
import { createRecord, record, updateClientDetails } from "../src/records";
let cookies: Record<string, string>, actors: Record<string, Actor>;
beforeEach(async () => {
  await reset();
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await seed();
  cookies = {};
  actors = {};
  for (const id of ["a", "b", "s1", "s3"]) {
    cookies[id] = await login(id);
    actors[id] = (await authenticate(env, new Headers({ Cookie: cookies[id] })))!;
  }
});
const all = async (sql: string, ...args: unknown[]) => (await env.DB.prepare(sql).bind(...args).all<any>()).results;
const full = { name: "Personne fictive", email: "p@exemple.ca", phone: "514 555 0100", address: "123 rue Exemple, Montréal", date_of_birth: "1985-03-12" };
describe("Renseignements de l’usager (adresse, date de naissance)", () => {
  it("une personne nouvellement créée n’a ni adresse ni date de naissance", async () => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    const row = await record(env.DB, actors.a, id);
    expect([row.address, row.date_of_birth]).toEqual(["", ""]);
  });
  it("le responsable modifie, ajoute adresse et date, et un événement d’audit sans texte saisi est écrit", async () => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    expect(await updateClientDetails(env.DB, actors.a, id, full)).toBe(true);
    const row = await record(env.DB, actors.a, id);
    expect(row).toMatchObject(full);
    const [event, ...rest] = await all("SELECT * FROM audit_events WHERE action='update'");
    expect(rest).toEqual([]);
    expect(event).toMatchObject({ actor_id: "a", resource_type: "case", resource_id: id, case_ids: JSON.stringify([id]) });
    expect(JSON.stringify(event)).not.toContain("Exemple");
    expect(JSON.stringify(event)).not.toContain("1985");
  });
  it("un superviseur de l’organisme peut modifier", async () => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    expect(await updateClientDetails(env.DB, actors.s1, id, full)).toBe(true);
  });
  it("sans changement : aucun événement ni écriture", async () => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    expect(await updateClientDetails(env.DB, actors.a, id, { name: "Personne fictive" })).toBe(false);
    expect(await all("SELECT 1 FROM audit_events WHERE action='update'")).toEqual([]);
  });
  it("un autre intervenant ou un autre organisme obtient 404 et rien n’est modifié", async () => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    await expect(updateClientDetails(env.DB, actors.b, id, full)).rejects.toMatchObject({ status: 404 });
    await expect(updateClientDetails(env.DB, actors.s3, id, full)).rejects.toMatchObject({ status: 404 });
    expect((await record(env.DB, actors.a, id)).address).toBe("");
    expect(await all("SELECT 1 FROM audit_events WHERE action='update'")).toEqual([]);
  });
  it.each([
    ["nom vide", { ...full, name: " " }, "name"],
    ["courriel invalide", { ...full, email: "pas-un-courriel" }, "email"],
    ["adresse trop longue", { ...full, address: "x".repeat(301) }, "address"],
    ["date inexistante", { ...full, date_of_birth: "2023-02-31" }, "date_of_birth"],
    ["date future", { ...full, date_of_birth: "2999-01-01" }, "date_of_birth"],
    ["date avant 1900", { ...full, date_of_birth: "1850-01-01" }, "date_of_birth"],
    ["date mal formée", { ...full, date_of_birth: "12/03/1985" }, "date_of_birth"],
  ])("refuse : %s", async (_, input, field) => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    await expect(updateClientDetails(env.DB, actors.a, id, input)).rejects.toMatchObject({ status: 400, fields: { [field]: expect.any(String) } });
    expect((await record(env.DB, actors.a, id)).name).toBe("Personne fictive");
  });
  it("parcours HTTP : formulaire, enregistrement, affichage, refus pour un tiers", async () => {
    const id = await createRecord(env.DB, actors.a, { name: "Personne fictive" });
    const form = await request(`/dossiers/${id}/modifier`, cookies.a);
    expect(form.status).toBe(200);
    const html = await form.text();
    expect(html).toContain('name="address"');
    expect(html).toContain('name="date_of_birth"');
    const post = (cookie: string, body: Record<string, string>) => request(`/dossiers/${id}/modifier`, cookie, body);
    const res = await post(cookies.a, full);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/dossiers/${id}?ok=infos`);
    const detail = await (await request(`/dossiers/${id}`, cookies.a)).text();
    expect(detail).toContain("123 rue Exemple, Montréal");
    expect(detail).toContain("12 mars 1985");
    expect(detail).toContain(`/dossiers/${id}/modifier`);
    const bad = await post(cookies.a, { ...full, date_of_birth: "2023-02-31" });
    expect(bad.status).toBe(400);
    expect(await bad.text()).toContain("date de naissance valide");
    expect((await request(`/dossiers/${id}/modifier`, cookies.b)).status).toBe(404);
    expect((await post(cookies.b, full)).status).toBe(404);
  });
});

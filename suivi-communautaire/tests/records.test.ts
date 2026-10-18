import { beforeEach, describe, it, expect } from "vitest";
import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { seed, login, request, origin } from "./helpers";
import { authenticate, type Actor } from "../src/auth";
import {
  createRecord,
  transfer,
  listing,
  record,
  accessCheck,
} from "../src/records";
let cookies: Record<string, string>, actors: Record<string, Actor>;
beforeEach(async () => {
  await seed();
  cookies = {};
  actors = {};
  for (const id of ["a", "b", "c", "s1", "s2", "d", "s3"]) {
    cookies[id] = await login(id);
    actors[id] = (await authenticate(
      env,
      new Headers({ Cookie: cookies[id] }),
    ))!;
  }
});
const create = (who = "a", name = "Personne fictive", other = {}) =>
  createRecord(env.DB, actors[who], { name, service: "Logement", ...other });
const count = async (table: string) =>
  env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<number>("n");
describe("Périmètre réel et transferts atomiques", () => {
  it("isole les collègues, équipes et organismes dans liste, recherche, total et détail", async () => {
    const id = await create();
    await create("c", "Autre équipe");
    await create("d", "Autre organisme");
    expect((await listing(env.DB, actors.a)).total).toBe(1);
    for (const u of ["b", "c", "d", "s3"]) {
      await expect(record(env.DB, actors[u], id)).rejects.toMatchObject({
        status: 404,
      });
      expect((await listing(env.DB, actors[u], "Personne")).total).toBe(0);
    }
    for (const u of ["s1", "s2"])
      expect((await listing(env.DB, actors[u])).total).toBe(2);
  });
  it("transfère entre équipes et retire les anciens droits avec les mêmes cookies", async () => {
    const id = await create();
    await transfer(env.DB, actors.a, id, "c", 1);
    await expect(record(env.DB, actors.a, id)).rejects.toMatchObject({
      status: 404,
    });
    expect((await record(env.DB, actors.c, id)).version).toBe(2);
    expect((await request("/dossiers/" + id, cookies.a)).status).toBe(404);
    expect((await request("/dossiers/" + id, cookies.c)).status).toBe(200);
    for (const u of ["s1", "s2"])
      expect((await record(env.DB, actors[u], id)).owner_id).toBe("c");
    const event = await env.DB.prepare(
      "SELECT * FROM audit_events WHERE action='transfer'",
    ).first();
    expect(event).toMatchObject({
      actor_id: "a",
      previous_owner_id: "a",
      new_owner_id: "c",
    });
  });
  it("autorise tout superviseur et les transferts successifs", async () => {
    const id = await create();
    await transfer(env.DB, actors.s2, id, "c", 1);
    await transfer(env.DB, actors.c, id, "b", 2);
    await transfer(env.DB, actors.s1, id, "a", 3);
    expect((await record(env.DB, actors.a, id)).version).toBe(4);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) n FROM audit_events WHERE action='transfer'",
      ).first("n"),
    ).toBe(3);
  });
  it("refuse auto-transfert, collègue, autre organisme, superviseur destinataire et désactivation", async () => {
    const id = await create();
    for (const target of ["a", "d", "s1", "inconnu"])
      await expect(
        transfer(env.DB, actors.a, id, target, 1),
      ).rejects.toBeDefined();
    await expect(transfer(env.DB, actors.b, id, "c", 1)).rejects.toMatchObject({
      status: 404,
    });
    await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id=?")
      .bind("b")
      .run();
    await expect(transfer(env.DB, actors.a, id, "b", 1)).rejects.toBeDefined();
    await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id=?")
      .bind("a")
      .run();
    await expect(transfer(env.DB, actors.a, id, "c", 1)).rejects.toBeDefined();
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) n FROM audit_events WHERE action='transfer'",
      ).first("n"),
    ).toBe(0);
  });
  it("n’accepte qu’un transfert concurrent pour une même version", async () => {
    const id = await create();
    const results = await Promise.allSettled([
      transfer(env.DB, actors.s1, id, "b", 1),
      transfer(env.DB, actors.s2, id, "c", 1),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(
      await env.DB.prepare(
        "SELECT COUNT(*) n FROM audit_events WHERE action='transfer'",
      ).first("n"),
    ).toBe(1);
  });
  it("annule création et transfert si l’audit échoue", async () => {
    const id = await create();
    await env.DB.exec(
      "CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'simulated_audit_failure'); END;",
    );
    await expect(transfer(env.DB, actors.a, id, "b", 1)).rejects.toBeDefined();
    expect((await record(env.DB, actors.a, id)).version).toBe(1);
    await expect(create("a", "Ne doit pas rester")).rejects.toBeDefined();
    expect(await count("clients")).toBe(1);
    expect(await count("cases")).toBe(1);
  });
  it("revérifie les droits SQL après une révocation pendant une opération", async () => {
    const id = await create();
    const stale = actors.a;
    await transfer(env.DB, actors.s1, id, "b", 1);
    await expect(transfer(env.DB, stale, id, "c", 1)).rejects.toMatchObject({
      status: 404,
    });
    await env.DB.prepare("DELETE FROM session WHERE id=?")
      .bind(stale.sessionId)
      .run();
    await expect(
      createRecord(env.DB, stale, { name: "Non", service: "Non" }),
    ).rejects.toBeDefined();
  });
  it("ne révèle pas les autres dossiers d’une même personne", async () => {
    const first = await create();
    const person = (await record(env.DB, actors.a, first)).client_id;
    const second = await create("a", "", {
      client_id: person,
      service: "Alimentation",
    });
    await transfer(env.DB, actors.a, first, "b", 1);
    expect((await listing(env.DB, actors.a)).rows.map((r) => r.id)).toEqual([
      second,
    ]);
    expect(await accessCheck(env.DB, actors.a, [first, second])).toEqual([
      second,
    ]);
    await expect(create("c", "", { client_id: person })).rejects.toMatchObject({
      status: 404,
    });
  });
  it("préserve les contraintes et l’immutabilité des audits", async () => {
    const id = await create();
    await expect(
      env.DB.prepare("UPDATE audit_events SET actor_id=?").bind("b").run(),
    ).rejects.toBeDefined();
    await expect(env.DB.exec("DELETE FROM audit_events")).rejects.toBeDefined();
    await expect(
      env.DB.prepare("UPDATE cases SET organisation_id=? WHERE id=?")
        .bind("o2", id)
        .run(),
    ).rejects.toBeDefined();
    await expect(
      env.DB.prepare("DELETE FROM clients").run(),
    ).rejects.toBeDefined();
  });
});
describe("Parcours HTTP et confidentialité", () => {
  it("sert les écrans échappés sans cache et garde les erreurs interdit/absent identiques", async () => {
    const id = await create("a", "<img src=x onerror=alert(1)>");
    const res = await request("/dossiers", cookies.a);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const html = await res.text();
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
    expect(await (await request("/dossiers/" + id, cookies.b)).text()).toBe(
      await (await request("/dossiers/inexistant", cookies.b)).text(),
    );
  });
  it("crée par HTTP et retrouve les données après reconnexion", async () => {
    const res = await request("/dossiers", cookies.a, {
      name: "Usager fictif",
      service: "Soutien",
    });
    expect(res.status).toBe(303);
    const fresh = await login("a");
    expect(
      await (await request(res.headers.get("Location")!, fresh)).text(),
    ).toContain("Usager fictif");
    expect((await request("/dossiers/nouveau", cookies.s1)).status).toBe(200);
  });
  it("valide champs, attribution falsifiée, organisme et CSRF", async () => {
    for (const data of [
      { name: "", service: "x" },
      { name: "x", service: "" },
      { name: "x", service: "x", email: "invalide" },
    ] satisfies Record<string, string>[] as Record<string, string>[])
      expect((await request("/dossiers", cookies.a, data)).status).toBe(400);
    expect(
      (
        await request("/dossiers", cookies.a, {
          name: "x",
          service: "x",
          owner_id: "b",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await request("/dossiers", cookies.a, {
          name: "x",
          service: "x",
          organisation_id: "o2",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await SELF.fetch(origin + "/dossiers", {
          method: "POST",
          headers: {
            Cookie: cookies.a,
            Origin: "https://hostile.example",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: "name=x&service=x",
        })
      ).status,
    ).toBe(403);
    expect(await count("clients")).toBe(0);
  });
  it("protège la sélection de personne et un formulaire conservé après transfert", async () => {
    const id = await create();
    const person = (await record(env.DB, actors.a, id)).client_id;
    expect(
      (await request("/dossiers/nouveau?source=" + id, cookies.b)).status,
    ).toBe(404);
    expect(
      (
        await request("/dossiers", cookies.a, {
          client_id: person,
          service: "x",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request("/dossiers", cookies.a, {
          client_id: person,
          source: id,
          service: "Autre suivi",
        })
      ).status,
    ).toBe(303);
    await transfer(env.DB, actors.s1, id, "c", 1);
    expect(
      (
        await request("/dossiers", cookies.a, {
          client_id: person,
          source: id,
          service: "x",
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await request("/dossiers/" + id + "/transfert", cookies.a, {
          owner_id: "b",
          version: "1",
        })
      ).status,
    ).toBe(404);
  });
  it("journalise seulement les lectures réussies, sans contenu personnel", async () => {
    const id = await create("a", "Nom confidentiel");
    await request("/dossiers", cookies.a);
    await request("/dossiers/" + id, cookies.a);
    await request("/dossiers/" + id, cookies.b);
    const events = await env.DB.prepare(
      "SELECT * FROM audit_events WHERE action='read'",
    ).all();
    expect(events.results).toHaveLength(2);
    expect(JSON.stringify(events)).not.toContain("Nom confidentiel");
    expect(
      events.results.every((e) => e.case_ids === JSON.stringify([id])),
    ).toBe(true);
    expect(
      (await request("/audit", cookies.s1, { action: "delete" })).status,
    ).toBe(404);
  });
  it("ne retourne aucune donnée nominative lorsque la journalisation est indisponible", async () => {
    const id = await create("a", "Nom confidentiel");
    await env.DB.exec(
      "CREATE TRIGGER fail_read BEFORE INSERT ON audit_events WHEN NEW.action='read' BEGIN SELECT RAISE(ABORT,'simulated'); END;",
    );
    for (const path of [
      "/dossiers",
      "/dossiers/" + id,
      "/dossiers/" + id + "/transfert",
      "/dossiers/nouveau?source=" + id,
    ]) {
      const res = await request(path, cookies.a);
      expect(res.status).toBe(503);
      expect(await res.text()).not.toContain("Nom confidentiel");
    }
  });
  it("contrôle les identifiants sans audit de consultation ni donnée nominative", async () => {
    const id = await create();
    const n = await count("audit_events");
    const res = await request("/acces", cookies.a, { "ids[]": id });
    expect(await res.json()).toEqual({ allowed: [id] });
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(await count("audit_events")).toBe(n);
    await transfer(env.DB, actors.s1, id, "b", 1);
    expect(
      await (await request("/acces", cookies.a, { "ids[]": id })).json(),
    ).toEqual({ allowed: [] });
  });
  it("refuse un compte sans profil métier même avec une session valide", async () => {
    await env.DB.prepare("DELETE FROM profiles WHERE user_id=?")
      .bind("a")
      .run();
    expect((await request("/dossiers", cookies.a)).status).toBe(302);
    expect((await request("/acces", cookies.a, { "ids[]": "x" })).status).toBe(
      401,
    );
  });
});

describe('Scénarios complémentaires du premier parcours', () => {
  it('pagine exclusivement les dossiers autorisés', async () => {
    for (let i=0;i<26;i++) await create('a','Usager '+String(i).padStart(2,'0'));
    await create('b','Usager interdit');
    const first=await listing(env.DB,actors.a,'Usager',1),second=await listing(env.DB,actors.a,'Usager',2);
    expect(first.total).toBe(26);expect(first.rows).toHaveLength(25);expect(second.rows).toHaveLength(1);
    expect(new Set([...first.rows,...second.rows].map(r=>r.id)).size).toBe(26);
  });
  it('permet au superviseur de créer pour une autre équipe puis reprendre un compte désactivé',async()=>{
    const res=await request('/dossiers',cookies.s1,{name:'Suivi fictif',service:'Accueil',owner_id:'c'});expect(res.status).toBe(303);
    const id=res.headers.get('location')!.split('/').pop()!;
    expect((await record(env.DB,actors.c,id)).owner_id).toBe('c');
    await env.DB.prepare('UPDATE profiles SET active=0 WHERE user_id=?').bind('c').run();
    expect((await record(env.DB,actors.s2,id)).owner_id).toBe('c');await transfer(env.DB,actors.s2,id,'a',1);
    expect((await record(env.DB,actors.a,id)).owner_id).toBe('a');
  });
  it('refuse les écritures SQL différées après désactivation de la cible ou de l’acteur',async()=>{
    const id=await create();
    const mutation=()=>env.DB.prepare('UPDATE cases SET owner_id=?,version=version+1,last_actor_id=?,last_session_id=?,last_operation_id=? WHERE id=?').bind('b','a',actors.a.sessionId,crypto.randomUUID(),id).run();
    await record(env.DB,actors.a,id);
    await env.DB.prepare('UPDATE profiles SET active=0 WHERE user_id=?').bind('b').run();await expect(mutation()).rejects.toThrow('invalid_destination');
    await env.DB.prepare('UPDATE profiles SET active=1 WHERE user_id=?').bind('b').run();await env.DB.prepare('UPDATE profiles SET active=0 WHERE user_id=?').bind('a').run();await expect(mutation()).rejects.toThrow('access_denied');
    expect((await record(env.DB,actors.s1,id)).version).toBe(1);
  });
});

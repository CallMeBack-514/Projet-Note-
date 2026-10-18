import { env } from "cloudflare:workers";
import { expect, test } from "vitest";
import { fixtureQueries } from "../scripts/fixtures.mjs";
import { authenticate } from "../src/auth";
import { transfer } from "../src/records";
import { login, password, request } from "./helpers";

async function provision() {
  const queries = await fixtureQueries(password);
  return env.DB.batch(queries.map(({ sql, params }) => env.DB.prepare(sql).bind(...params)));
}

test("fresh demo has working accounts, scoped cases and creation audit without seed sessions", async () => {
  await provision();
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM cases").first("n")).toBe(8);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first("n")).toBe(8);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='create'").first("n")).toBe(8);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM session").first("n")).toBe(0);
  const worker = await (await request("/dossiers", await login("a"))).text();
  expect(worker).toContain("Anne Beaulieu (fictif)");
  expect(worker).toContain("Jules Mercier (fictif)");
  expect(worker).not.toContain("Samir Bouchard (fictif)");
  expect(worker).not.toContain("Maya Gauthier (fictif)");
  const supervisor = await (await request("/dossiers", await login("s2"))).text();
  expect(supervisor).toContain("Anne Beaulieu (fictif)");
  expect(supervisor).toContain("Samir Bouchard (fictif)");
  expect(supervisor).toContain("Louise Pelletier (fictif)");
  expect(supervisor).not.toContain("Maya Gauthier (fictif)");
  const other = await (await request("/dossiers", await login("d"))).text();
  expect(other).toContain("Maya Gauthier (fictif)");
  expect(other).not.toContain("Anne Beaulieu (fictif)");
});

test("rerunning demo preserves passwords, transfers, disabled accounts and audit", async () => {
  await provision();
  const cookie = await login("a");
  const actor = await authenticate(env, new Headers({ Cookie: cookie }));
  if (!actor) throw new Error("Demo account did not authenticate");
  await transfer(env.DB, actor, "demo-logement", "c", 1);
  await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id='b'").run();
  const originalHash = await env.DB.prepare("SELECT password FROM account WHERE userId='a'").first("password");
  await provision();
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM cases").first("n")).toBe(8);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM clients").first("n")).toBe(8);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM user").first("n")).toBe(7);
  expect(await env.DB.prepare("SELECT owner_id FROM cases WHERE id='demo-logement'").first("owner_id")).toBe("c");
  expect(await env.DB.prepare("SELECT active FROM profiles WHERE user_id='b'").first("active")).toBe(0);
  expect(await env.DB.prepare("SELECT password FROM account WHERE userId='a'").first("password")).toBe(originalHash);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='create'").first("n")).toBe(8);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE action='transfer'").first("n")).toBe(1);
  expect(await env.DB.prepare("SELECT COUNT(*) AS n FROM session WHERE id LIKE 'demo-seed-%'").first("n")).toBe(0);
  expect((await request("/dossiers/demo-logement", cookie)).status).toBe(404);
  expect((await request("/dossiers/demo-logement", await login("c"))).status).toBe(200);
});

test("failed demo audit rolls back accounts, cases and temporary sessions", async () => {
  await env.DB.prepare("CREATE TRIGGER fail_demo_audit BEFORE INSERT ON audit_events BEGIN SELECT RAISE(ABORT,'audit_unavailable'); END").run();
  await expect(provision()).rejects.toThrow();
  for (const table of ["organisations", "user", "profiles", "clients", "cases", "session", "audit_events"]) {
    expect(await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first("n")).toBe(0);
  }
});

import { env, SELF } from "cloudflare:test";
import { expect, test } from "vitest";
test("le Worker et les migrations D1 fonctionnent localement", async () => {
  expect((await SELF.fetch("http://localhost:5173/health")).status).toBe(200);
  expect(
    await env.DB.prepare("SELECT COUNT(*) AS n FROM user").first("n"),
  ).toBe(0);
});

import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { test, expect } from "vitest";
import { seed, login, origin } from "./helpers";
import { authenticate } from "../src/auth";
test("connexion, profil courant, désactivation et déconnexion", async () => {
  await seed();
  const cookie = await login();
  expect((await authenticate(env, new Headers({ Cookie: cookie })))?.role).toBe(
    "intervenant",
  );
  await env.DB.prepare("UPDATE profiles SET active=0 WHERE user_id=?")
    .bind("a")
    .run();
  expect(await authenticate(env, new Headers({ Cookie: cookie }))).toBeNull();
  await env.DB.prepare("UPDATE profiles SET active=1 WHERE user_id=?")
    .bind("a")
    .run();
  const res = await SELF.fetch(origin + "/api/auth/sign-out", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  expect(res.ok).toBe(true);
  expect(await authenticate(env, new Headers({ Cookie: cookie }))).toBeNull();
});
test("expiration, mauvais mot de passe et inscription interdite", async () => {
  await seed();
  const cookie = await login();
  await env.DB.prepare("UPDATE session SET expiresAt=0").run();
  expect(await authenticate(env, new Headers({ Cookie: cookie }))).toBeNull();
  for (const [route, body] of [
    ["sign-in/email", { email: "a@demo.example", password: "incorrect" }],
    [
      "sign-up/email",
      { email: "x@demo.example", password: "a-long-password-here", name: "X" },
    ],
  ] as const) {
    const res = await SELF.fetch(origin + "/api/auth/" + route, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.ok).toBe(false);
  }
});
test("rattachements invalides refusés et rôles non modifiables publiquement", async () => {
  await seed();
  for (const supervisor of ["d", "s3", "b", null]) {
    await expect(
      env.DB.prepare("UPDATE profiles SET supervisor_id=? WHERE user_id=?")
        .bind(supervisor, "a")
        .run(),
    ).rejects.toThrow();
  }
  const cookie = await login();
  await SELF.fetch(origin + "/api/auth/update-user", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "superviseur",
      organisation_id: "o2",
      active: 1,
    }),
  });
  expect((await authenticate(env, new Headers({ Cookie: cookie })))?.role).toBe(
    "intervenant",
  );
});

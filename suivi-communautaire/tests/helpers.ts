import { env } from "cloudflare:workers";
import { SELF } from "cloudflare:test";
import { hashPassword } from "better-auth/crypto";
export const origin = "http://localhost:5173";
export const password = "Demonstration-seulement-2026!";
const people = [
  ["s1", "Camille", "superviseur", "o1", null],
  ["s2", "Alex", "superviseur", "o1", null],
  ["a", "Émilie", "intervenant", "o1", "s1"],
  ["b", "Malik", "intervenant", "o1", "s1"],
  ["c", "Sofia", "intervenant", "o1", "s2"],
  ["s3", "Louise", "superviseur", "o2", null],
  ["d", "Noah", "intervenant", "o2", "s3"],
];
export async function seed() {
  const now = Date.now();
  const hash = await hashPassword(password);
  const statements = [
    env.DB.prepare("INSERT INTO organisations VALUES (?,?)").bind(
      "o1",
      "Maison des liens",
    ),
    env.DB.prepare("INSERT INTO organisations VALUES (?,?)").bind(
      "o2",
      "Autre organisme",
    ),
  ];
  for (const [id, name, role, org, supervisor] of people) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)",
      ).bind(id, name, `${id}@demo.example`, now, now),
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,'credential',?,?,?,?)",
      ).bind(`account-${id}`, id, id, hash, now, now),
    );
    statements.push(
      env.DB.prepare(
        "INSERT INTO profiles (user_id,organisation_id,role,supervisor_id) VALUES (?,?,?,?)",
      ).bind(id, org, role, supervisor),
    );
  }
  await env.DB.batch(statements);
}
export async function login(id = "a") {
  const res = await SELF.fetch(origin + "/api/auth/sign-in/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email: `${id}@demo.example`, password }),
  });
  if (!res.ok)
    throw new Error(`Connexion impossible: ${res.status} ${await res.text()}`);
  return res.headers
    .getSetCookie()
    .map((s) => s.split(";")[0])
    .join("; ");
}
export function request(
  path: string,
  cookie: string,
  body?: Record<string, string>,
) {
  return SELF.fetch(origin + path, {
    method: body ? "POST" : "GET",
    headers: {
      Cookie: cookie,
      Origin: origin,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body ? new URLSearchParams(body) : undefined,
    redirect: "manual",
  });
}

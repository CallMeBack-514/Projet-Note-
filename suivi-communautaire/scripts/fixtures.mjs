import { hashPassword } from "better-auth/crypto";
export const people = [
  ["s1", "Camille Roy", "superviseur", "o1", null],
  ["s2", "Alex Nguyen", "superviseur", "o1", null],
  ["a", "Émilie Gagnon", "intervenant", "o1", "s1"],
  ["b", "Malik Fortin", "intervenant", "o1", "s1"],
  ["c", "Sofia Tremblay", "intervenant", "o1", "s2"],
  ["s3", "Louise Martin", "superviseur", "o2", null],
  ["d", "Noah Dubois", "intervenant", "o2", "s3"],
];
export async function fixtureQueries(password) {
  const hash = await hashPassword(password);
  const now = Date.now();
  const q = [
    {
      sql: "INSERT OR IGNORE INTO organisations VALUES (?,?)",
      params: ["o1", "Maison des liens — Démonstration"],
    },
    {
      sql: "INSERT OR IGNORE INTO organisations VALUES (?,?)",
      params: ["o2", "Le Trait d’union — Démonstration"],
    },
  ];
  for (const [id, name, role, org, supervisor] of people) {
    q.push({
      sql: "INSERT OR IGNORE INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES (?,?,?,1,?,?)",
      params: [id, name, `${id}@demo.example`, String(now), String(now)],
    });
    q.push({
      sql: "INSERT OR IGNORE INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt) VALUES (?,?,'credential',?,?,?,?)",
      params: [`account-${id}`, id, id, hash, String(now), String(now)],
    });
    q.push({
      sql: `INSERT OR IGNORE INTO profiles (user_id,organisation_id,role,supervisor_id) VALUES (?,?,?,${supervisor ? "?" : "NULL"})`,
      params: supervisor ? [id, org, role, supervisor] : [id, org, role],
    });
  }
  return q;
}

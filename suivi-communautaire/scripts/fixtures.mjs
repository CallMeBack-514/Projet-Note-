import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";
import records from "./demo-data.json" with { type: "json" };
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
  // Temporary sessions let the existing SQL guards and audit triggers run.
  // They are created and removed inside the same local D1 batch; no login
  // token is printed or left available after provisioning.
  const sessions = new Map();
  for (const [org, supervisor] of [["o1", "s1"], ["o2", "s3"]]) {
    const session = `demo-seed-${randomUUID()}`;
    sessions.set(org, { id: session, supervisor });
    q.push({
      sql: "INSERT INTO session (id,expiresAt,token,createdAt,updatedAt,userId) VALUES (?,unixepoch()*1000+60000,?,unixepoch()*1000,unixepoch()*1000,?)",
      params: [session, randomUUID(), supervisor],
    });
  }
  for (const record of records) {
    const client = `${record.id}-person`;
    const operation = `${record.id}-created`;
    const session = sessions.get(record.organisation);
    q.push({
      sql: "INSERT INTO clients (id,organisation_id,name,email,phone,creation_operation) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM clients WHERE id=?)",
      params: [client, record.organisation, record.name, record.email, record.phone, operation, client],
    });
    q.push({
      // Skip existing cases before INSERT, so reruns do not retrigger guards,
      // duplicate audit events, or undo transfers made while exploring.
      sql: "INSERT INTO cases (id,organisation_id,client_id,service,owner_id,opened_at,last_actor_id,last_session_id,last_operation_id) SELECT ?,?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM cases WHERE id=?)",
      params: [record.id, record.organisation, client, record.service, record.owner, record.openedAt, session.supervisor, session.id, operation, record.id],
    });
  }
  for (const session of sessions.values()) {
    q.push({ sql: "DELETE FROM session WHERE id=?", params: [session.id] });
  }
  return q;
}

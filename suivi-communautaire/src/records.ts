import type { Actor } from "./auth";
export class Problem extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 503,
    message: string,
  ) {
    super(message);
  }
}
export const missing = () =>
  new Problem(404, "Ce dossier est introuvable ou n’est plus accessible.");
export type RecordRow = {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  owner_id: string;
  owner_name: string;
  status: string;
  opened_at: string;
  version: number;
};
// All reads join the live profile and session, including counts and access checks.
const access = `JOIN profiles actor ON actor.user_id=? AND actor.active=1 AND actor.organisation_id=c.organisation_id
 JOIN session ses ON ses.id=? AND ses.userId=actor.user_id AND ses.expiresAt>unixepoch('subsec')*1000`;
const visible = `(actor.role='superviseur' OR c.owner_id=actor.user_id)`;
const select = `SELECT c.id,c.client_id,cl.name,cl.phone,cl.email,c.service,c.owner_id,u.name AS owner_name,c.status,c.opened_at,c.version
 FROM cases c JOIN clients cl ON cl.id=c.client_id AND cl.organisation_id=c.organisation_id JOIN user u ON u.id=c.owner_id ${access}`;
export async function record(db: D1Database, actor: Actor, id: string) {
  const row = await db
    .prepare(`${select} WHERE ${visible} AND c.id=?`)
    .bind(actor.id, actor.sessionId, id)
    .first<RecordRow>();
  if (!row) throw missing();
  return row;
}
export async function listing(
  db: D1Database,
  actor: Actor,
  query = "",
  page = 1,
) {
  // instr treats user input literally, without LIKE wildcards or a hidden global search.
  const condition = `${visible} AND (instr(lower(cl.name),lower(?))>0 OR instr(lower(c.id),lower(?))>0)`;
  const args = [actor.id, actor.sessionId, query, query];
  const rows = await db
    .prepare(
      `${select} WHERE ${condition} ORDER BY c.opened_at DESC,c.id LIMIT 25 OFFSET ?`,
    )
    .bind(...args, (page - 1) * 25)
    .all<RecordRow>();
  const count = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM cases c JOIN clients cl ON cl.id=c.client_id ${access} WHERE ${condition}`,
    )
    .bind(...args)
    .first<number>("n");
  return { rows: rows.results, total: count ?? 0 };
}
export async function auditRead(db: D1Database, actor: Actor, ids: string[]) {
  if (!ids.length) return;
  await db
    .prepare(
      "INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids) VALUES(?,?,?,'read',?)",
    )
    .bind(
      crypto.randomUUID(),
      actor.organisation_id,
      actor.id,
      JSON.stringify(ids),
    )
    .run();
}
export async function destinations(db: D1Database, actor: Actor, exclude = "") {
  return (
    await db
      .prepare(
        `SELECT p.user_id AS id,u.name FROM profiles p JOIN user u ON u.id=p.user_id
    JOIN profiles a ON a.user_id=? AND a.organisation_id=p.organisation_id AND a.active=1
    JOIN session s ON s.id=? AND s.userId=a.user_id AND s.expiresAt>unixepoch('subsec')*1000
    WHERE p.role='intervenant' AND p.active=1 AND p.user_id<>? ORDER BY u.name`,
      )
      .bind(actor.id, actor.sessionId, exclude)
      .all<{ id: string; name: string }>()
  ).results;
}
export async function accessCheck(db: D1Database, actor: Actor, ids: string[]) {
  if (ids.length > 25) throw new Problem(400, "Trop de dossiers demandés.");
  if (!ids.length) return [];
  const rows = await db
    .prepare(
      `SELECT c.id FROM cases c ${access} WHERE ${visible} AND c.id IN (${ids.map(() => "?").join(",")})`,
    )
    .bind(actor.id, actor.sessionId, ...ids)
    .all<{ id: string }>();
  return rows.results.map((r) => r.id);
}
export type CreateInput = {
  name?: string;
  phone?: string;
  email?: string;
  service?: string;
  owner_id?: string;
  client_id?: string;
  organisation_id?: string;
};
export async function createRecord(
  db: D1Database,
  actor: Actor,
  input: CreateInput,
) {
  if (input.organisation_id && input.organisation_id !== actor.organisation_id)
    throw new Problem(403, "Opération non autorisée.");
  const service = input.service?.trim() ?? "";
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (
    !service ||
    service.length > 160 ||
    (!input.client_id && (!name || name.length > 160)) ||
    email.length > 254 ||
    phone.length > 60 ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )
    throw new Problem(
      400,
      "Indiquez un nom et un service valides. Vérifiez aussi les coordonnées saisies.",
    );
  const owner =
    input.owner_id || (actor.role === "intervenant" ? actor.id : "");
  if (actor.role === "intervenant" && owner !== actor.id)
    throw new Problem(403, "Un nouveau dossier doit vous être attribué.");
  if (!owner || !(await destinations(db, actor)).some((p) => p.id === owner))
    throw new Problem(
      400,
      "Choisissez un intervenant actif de votre organisme.",
    );
  const id = crypto.randomUUID(),
    operation = crypto.randomUUID(),
    clientId = input.client_id || crypto.randomUUID();
  const batch: D1PreparedStatement[] = [];
  if (!input.client_id)
    batch.push(
      db
        .prepare(
          "INSERT INTO clients(id,organisation_id,name,email,phone,creation_operation) VALUES(?,?,?,?,?,?)",
        )
        .bind(clientId, actor.organisation_id, name, email, phone, operation),
    );
  batch.push(
    db
      .prepare(
        `INSERT INTO cases(id,organisation_id,client_id,service,owner_id,last_actor_id,last_session_id,last_operation_id)
    VALUES(?,?,?,?,?,?,?,?)`,
      )
      .bind(
        id,
        actor.organisation_id,
        clientId,
        service,
        owner,
        actor.id,
        actor.sessionId,
        operation,
      ),
  );
  try {
    await db.batch(batch);
  } catch (e) {
    if (
      e instanceof Error &&
      /access_denied|client_not_visible/.test(e.message)
    )
      throw missing();
    if (e instanceof Error && /invalid_destination/.test(e.message))
      throw new Problem(400, "Ce destinataire n’est plus disponible.");
    throw e;
  }
  return id;
}
export async function transfer(
  db: D1Database,
  actor: Actor,
  id: string,
  target: string,
  version: number,
) {
  await record(db, actor, id);
  if (!Number.isInteger(version) || version < 1)
    throw new Problem(400, "Version du dossier invalide. Actualisez la page.");
  const result = await db
    .prepare(
      `UPDATE cases SET owner_id=?, version=version+1, last_actor_id=?,last_session_id=?,last_operation_id=?
    WHERE id=? AND version=? AND owner_id<>?
    AND EXISTS(SELECT 1 FROM profiles a JOIN session s ON s.userId=a.user_id WHERE a.user_id=? AND a.active=1 AND a.organisation_id=cases.organisation_id AND (a.role='superviseur' OR a.user_id=cases.owner_id) AND s.id=? AND s.expiresAt>unixepoch('subsec')*1000)
    AND EXISTS(SELECT 1 FROM profiles p WHERE p.user_id=? AND p.active=1 AND p.role='intervenant' AND p.organisation_id=cases.organisation_id)
    RETURNING id`,
    )
    .bind(
      target,
      actor.id,
      actor.sessionId,
      crypto.randomUUID(),
      id,
      version,
      target,
      actor.id,
      actor.sessionId,
      target,
    )
    .all<{ id: string }>();
  if (result.results.length === 1) return;
  const current = await record(db, actor, id);
  if (current.version !== version)
    throw new Problem(
      409,
      "Ce dossier a déjà été transféré. Actualisez la page avant de réessayer.",
    );
  throw new Problem(
    400,
    "Choisissez un autre intervenant actif de votre organisme.",
  );
}

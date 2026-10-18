import type { Actor } from "./auth";
import { Problem, FieldProblem, missing, access, visible } from "./access";
import { limits } from "./limits";
export { Problem, missing } from "./access";
export type RecordRow = {
  id: string;
  client_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  date_of_birth: string;
  owner_id: string;
  owner_name: string;
  status: string;
  opened_at: string;
  version: number;
};
const select = `SELECT c.id,c.client_id,cl.name,cl.phone,cl.email,cl.address,cl.date_of_birth,c.owner_id,u.name AS owner_name,c.status,c.opened_at,c.version
 FROM cases c JOIN clients cl ON cl.id=c.client_id AND cl.organisation_id=c.organisation_id JOIN user u ON u.id=c.owner_id ${access}`;
export async function record(db: D1Database, actor: Actor, id: string) {
  const row = await db
    .prepare(`${select} WHERE ${visible} AND c.id=?`)
    .bind(actor.id, actor.sessionId, id)
    .first<RecordRow>();
  if (!row) throw missing();
  return row;
}
export type StatusFilter = "tous" | "actif" | "inactif";
export const statusValues = ["Actif", "Inactif"] as const;
export type Status = (typeof statusValues)[number];
const filterValue: Record<Exclude<StatusFilter, "tous">, Status> = { actif: "Actif", inactif: "Inactif" };
export function parseFilter(value: string | undefined): StatusFilter {
  if (value === undefined || value === "" || value === "tous") return "tous";
  if (value === "actif" || value === "inactif") return value;
  throw new Problem(400, "Filtre de statut inconnu. Choisissez Tous, Actifs ou Inactifs.");
}
export async function listing(
  db: D1Database,
  actor: Actor,
  query = "",
  page = 1,
  filter: StatusFilter = "tous",
) {
  // instr treats user input literally, without LIKE wildcards or a hidden global search.
  // Le filtre de statut s'applique au même prédicat que les lignes et le total, après les droits.
  const condition = `${visible} AND (instr(lower(cl.name),lower(?))>0 OR instr(lower(c.id),lower(?))>0)${filter === "tous" ? "" : " AND c.status=?"}`;
  const args: unknown[] = [actor.id, actor.sessionId, query, query];
  if (filter !== "tous") args.push(filterValue[filter]);
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
  owner_id?: string;
  client_id?: string;
  organisation_id?: string;
};
// Un dossier par personne enregistrée : une personne déjà accessible conduit à son dossier existant.
export async function existingForClient(
  db: D1Database,
  actor: Actor,
  clientId: string,
) {
  const row = await db
    .prepare(`SELECT c.id FROM cases c ${access} WHERE ${visible} AND c.client_id=?`)
    .bind(actor.id, actor.sessionId, clientId)
    .first<{ id: string }>();
  if (!row) throw missing();
  return row.id;
}
// Les anciens identifiants de dossiers fusionnés ne sont résolus qu'après autorisation courante.
export async function resolveCase(db: D1Database, actor: Actor, id: string) {
  try {
    return await record(db, actor, id);
  } catch (e) {
    if (!(e instanceof Problem) || e.status !== 404) throw e;
    const legacy = await db
      .prepare(
        "SELECT canonical_case_id AS id FROM legacy_case_provenance WHERE legacy_case_id=? AND organisation_id=?",
      )
      .bind(id, actor.organisation_id)
      .first<{ id: string }>();
    if (!legacy) throw e;
    return record(db, actor, legacy.id);
  }
}
export async function createRecord(
  db: D1Database,
  actor: Actor,
  input: CreateInput,
) {
  if (input.organisation_id && input.organisation_id !== actor.organisation_id)
    throw new Problem(403, "Opération non autorisée.");
  if (input.client_id) return existingForClient(db, actor, input.client_id);
  const name = input.name?.trim() ?? "";
  const email = input.email?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  if (
    !name ||
    name.length > limits.name ||
    email.length > limits.email ||
    phone.length > limits.phone ||
    (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  )
    throw new Problem(
      400,
      "Indiquez un nom valide. Vérifiez aussi les coordonnées saisies.",
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
    clientId = crypto.randomUUID();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO clients(id,organisation_id,name,email,phone,creation_operation) VALUES(?,?,?,?,?,?)",
        )
        .bind(clientId, actor.organisation_id, name, email, phone, operation),
      db
        .prepare(
          `INSERT INTO cases(id,organisation_id,client_id,owner_id,last_actor_id,last_session_id,last_operation_id)
    VALUES(?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          actor.organisation_id,
          clientId,
          owner,
          actor.id,
          actor.sessionId,
          operation,
        ),
    ]);
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
      "Ce dossier a été modifié entre-temps (transfert ou changement de statut). Actualisez la page avant de réessayer.",
    );
  throw new Problem(
    400,
    "Choisissez un autre intervenant actif de votre organisme.",
  );
}
// Changement de statut : même version partagée que le transfert (cases.version).
export async function setStatus(
  db: D1Database,
  actor: Actor,
  id: string,
  status: string,
  version: number,
) {
  if (!(statusValues as readonly string[]).includes(status))
    throw new Problem(400, "Statut non reconnu. Choisissez Actif ou Inactif.");
  if (!Number.isInteger(version) || version < 1)
    throw new Problem(400, "Version du dossier invalide. Actualisez la page.");
  const before = await record(db, actor, id);
  // Statut et version déjà courants : succès sans écriture, sans incrément ni événement.
  if (before.status === status && before.version === version) return false;
  const result = await db
    .prepare(
      `UPDATE cases SET status=?,version=version+1,last_actor_id=?,last_session_id=?,last_operation_id=?
    WHERE id=? AND version=? AND status<>?
    AND EXISTS(SELECT 1 FROM profiles a JOIN session s ON s.userId=a.user_id WHERE a.user_id=? AND a.active=1 AND a.organisation_id=cases.organisation_id AND (a.role='superviseur' OR a.user_id=cases.owner_id) AND s.id=? AND s.expiresAt>unixepoch('subsec')*1000)
    RETURNING id`,
    )
    .bind(status, actor.id, actor.sessionId, crypto.randomUUID(), id, version, status, actor.id, actor.sessionId)
    .all<{ id: string }>();
  if (result.results.length === 1) return true;
  // Aucune ligne modifiée : revérifier l'accès avant d'expliquer (404 identique si révoqué).
  const current = await record(db, actor, id);
  if (current.version === version && current.status === status) return false;
  throw new Problem(
    409,
    "Ce dossier a été modifié entre-temps (transfert ou changement de statut). Actualisez la page avant de réessayer.",
  );
}
export type ClientInput = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
};
// Date ISO AAAA-MM-JJ réelle (pas de 31 février), postérieure à 1900 et non future.
function validBirthDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false;
  return y >= 1900 && date.getTime() <= Date.now();
}
// Modification des renseignements de l'usager : mêmes droits que le dossier (superviseur ou responsable).
// L'écriture et l'événement d'audit (identifiants seulement, jamais le texte saisi) partagent un batch
// et le même prédicat d'accès recalculé : sans droit actuel, ni l'un ni l'autre n'est écrit.
export async function updateClientDetails(db: D1Database, actor: Actor, id: string, input: ClientInput) {
  const before = await record(db, actor, id);
  const v = {
    name: input.name?.trim() ?? "",
    email: input.email?.trim() ?? "",
    phone: input.phone?.trim() ?? "",
    address: input.address?.trim() ?? "",
    date_of_birth: input.date_of_birth?.trim() ?? "",
  };
  const errors: Record<string, string> = {};
  if (!v.name) errors.name = "Indiquez le nom complet.";
  else if (v.name.length > limits.name) errors.name = `Le nom ne peut pas dépasser ${limits.name} caractères.`;
  if (v.email.length > limits.email) errors.email = `Le courriel ne peut pas dépasser ${limits.email} caractères.`;
  else if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = "Indiquez un courriel valide, par exemple nom@exemple.ca.";
  if (v.phone.length > limits.phone) errors.phone = `Le téléphone ne peut pas dépasser ${limits.phone} caractères.`;
  if (v.address.length > limits.address) errors.address = `L’adresse ne peut pas dépasser ${limits.address} caractères.`;
  if (v.date_of_birth && !validBirthDate(v.date_of_birth))
    errors.date_of_birth = "Indiquez une date de naissance valide, passée et postérieure à 1900.";
  if (Object.keys(errors).length) throw new FieldProblem(errors);
  // Aucun changement : succès sans écriture ni événement.
  if (before.name === v.name && before.email === v.email && before.phone === v.phone && before.address === v.address && before.date_of_birth === v.date_of_birth)
    return false;
  const operation = crypto.randomUUID();
  const [, result] = await db.batch([
    db
      .prepare(
        `INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,resource_version,operation_id)
 SELECT ?,c.organisation_id,?,'update',json_array(c.id),'case',c.id,c.version,? FROM cases c ${access} WHERE ${visible} AND c.id=?`,
      )
      .bind(operation, actor.id, operation, actor.id, actor.sessionId, id),
    db
      .prepare(
        `UPDATE clients SET name=?,email=?,phone=?,address=?,date_of_birth=?
 WHERE id=? AND organisation_id=? AND EXISTS(SELECT 1 FROM cases c ${access} WHERE ${visible} AND c.id=? AND c.client_id=clients.id)
 RETURNING id`,
      )
      .bind(v.name, v.email, v.phone, v.address, v.date_of_birth, before.client_id, actor.organisation_id, actor.id, actor.sessionId, id),
  ]);
  if (result.results.length !== 1) throw missing();
  return true;
}

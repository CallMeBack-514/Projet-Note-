import type { Actor } from "./auth";
import { Problem } from "./access";
import { resolveLocal } from "./time";
// Contrat d'audit commun (voir README « Contrat d'audit »). Les événements ne contiennent que des
// identifiants, des versions et des états techniques : jamais de texte saisi ni de réponse.
export async function auditRead(db: D1Database, actor: Actor, ids: string[]) {
  if (!ids.length) return;
  await db
    .prepare(
      "INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type) VALUES(?,?,?,'read',?,'case')",
    )
    .bind(
      crypto.randomUUID(),
      actor.organisation_id,
      actor.id,
      JSON.stringify(ids),
    )
    .run();
}
export type ReadSpec = {
  type: "note" | "follow_up" | "document";
  // Colonnes de la sélection portant l'identifiant de la ressource et de son dossier.
  idCol: string;
  caseCol: string;
  versionCol?: string;
  templateIdCol?: string;
  templateVersionCol?: string;
  // Condition facultative : la ressource n'existe dans cette ligne que si la colonne n'est pas nulle.
  presentCol?: string;
};
// Lecture et trace dans un même batch D1 : les événements sont insérés depuis la sélection
// exacte retournée (pagination et versions comprises), puis la sélection est renvoyée. Un échec
// d'insertion annule le batch et aucune donnée n'est transmise à l'appelant.
export async function readWithAudit<T>(
  db: D1Database,
  actor: Actor,
  select: string,
  args: unknown[],
  specs: ReadSpec[],
): Promise<T[]> {
  const operation = crypto.randomUUID();
  const statements = specs.map((s) =>
    db
      .prepare(
        `INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,resource_version,template_id,template_version,operation_id)
 SELECT lower(hex(randomblob(16))),?,?,'read',json_array(t.${s.caseCol}),?,t.${s.idCol},${s.versionCol ? "t." + s.versionCol : "NULL"},${s.templateIdCol ? "t." + s.templateIdCol : "NULL"},${s.templateVersionCol ? "t." + s.templateVersionCol : "NULL"},?
 FROM (${select}) t${s.presentCol ? ` WHERE t.${s.presentCol} IS NOT NULL` : ""}`,
      )
      .bind(actor.organisation_id, actor.id, s.type, operation, ...args),
  );
  statements.push(db.prepare(select).bind(...args));
  const results = await db.batch(statements);
  return results[results.length - 1].results as T[];
}
// ---- Consultation du journal (permission audit:view) ----
export const auditActions = ["create", "read", "update", "transfer", "status_change", "audit_read", "access_denied"] as const;
export type AuditAction = (typeof auditActions)[number];
// À incrémenter lorsque la table audit_events est reconstruite : invalide les curseurs émis auparavant.
export const AUDIT_SCHEMA = 1;
export type RouteCode = "case_read" | "case_write" | "content_read" | "content_write" | "audit_read";
export const auditPageSize = 25;
const liveSupervisor = (p = "p", s = "s") =>
  `${p}.active=1 AND ${p}.role='superviseur' AND ${s}.expiresAt>unixepoch('subsec')*1000`;
// Permission nommée audit:view : session vivante, profil actif, rôle superviseur, organisme courant.
export async function canViewAudit(db: D1Database, actor: Actor, organisation = actor.organisation_id) {
  const row = await db
    .prepare(
      `SELECT 1 AS ok FROM profiles p JOIN session s ON s.userId=p.user_id
 WHERE p.user_id=? AND p.organisation_id=? AND s.id=? AND ${liveSupervisor()}`,
    )
    .bind(actor.id, organisation, actor.sessionId)
    .first();
  return row !== null;
}
export type AuditFilters = {
  case: string;
  actor: string;
  action: string;
  from: string;
  to: string;
  // Valeurs normalisées en UTC (début inclus, fin exclue).
  fromUtc?: string;
  toUtc?: string;
};
const zone = "America/Toronto";
const isoWithZone = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/;
function boundary(value: string, end: boolean) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const start = resolveLocal(value, "00:00", zone).instant;
    if (!end) return start;
    const next = new Date(Date.parse(value + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
    return resolveLocal(next, "00:00", zone).instant;
  }
  const t = Date.parse(value);
  if (!isoWithZone.test(value) || Number.isNaN(t)) throw new Problem(400, "Période invalide : indiquez des dates valides.");
  return new Date(t).toISOString();
}
export function parseAuditFilters(query: Record<string, string | undefined>): AuditFilters {
  const f: AuditFilters = {
    case: (query.dossier ?? "").trim(),
    actor: (query.acteur ?? "").trim(),
    action: (query.action ?? "").trim(),
    from: (query.du ?? "").trim(),
    to: (query.au ?? "").trim(),
  };
  if (f.case.length > 100 || f.actor.length > 100) throw new Problem(400, "Filtre invalide : identifiant trop long.");
  if (f.action && !(auditActions as readonly string[]).includes(f.action))
    throw new Problem(400, "Filtre invalide : action inconnue.");
  try {
    if (f.from) f.fromUtc = boundary(f.from, false);
    if (f.to) f.toUtc = boundary(f.to, true);
  } catch (e) {
    if (e instanceof Problem) throw e;
    throw new Problem(400, "Période invalide : indiquez des dates valides.");
  }
  if (f.fromUtc && f.toUtc && f.fromUtc >= f.toUtc) throw new Problem(400, "Période invalide : la fin doit suivre le début.");
  return f;
}
// ---- Curseur signé lié au contexte (filtres, session, organisme, schéma, watermark) ----
const b64 = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const hmac = (secret: string) =>
  crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
const filterKey = (f: AuditFilters) => JSON.stringify([f.case, f.actor, f.action, f.fromUtc ?? "", f.toUtc ?? ""]);
export type Cursor = { w: number; t: string; i: string; f: string; s: string; o: string; v: number };
export async function signCursor(secret: string, c: Cursor) {
  const body = b64(new TextEncoder().encode(JSON.stringify(c)));
  const sig = await crypto.subtle.sign("HMAC", await hmac(secret), new TextEncoder().encode(body));
  return body + "." + b64(sig);
}
export const verifyCursor = (secret: string, token: string, f: AuditFilters, actor: Actor) =>
  verifyCursorKey(secret, token, filterKey(f), actor);
export async function verifyCursorKey(secret: string, token: string, key: string, actor: Actor): Promise<Cursor> {
  const bad = () => new Problem(400, "Curseur de pagination invalide. Recommencez la recherche.");
  const [body, sig] = token.split(".");
  if (!body || !sig || token.length > 600) throw bad();
  let ok = false;
  try {
    ok = await crypto.subtle.verify("HMAC", await hmac(secret), unb64(sig), new TextEncoder().encode(body));
  } catch {
    throw bad();
  }
  if (!ok) throw bad();
  let c: Cursor;
  try {
    c = JSON.parse(new TextDecoder().decode(unb64(body)));
  } catch {
    throw bad();
  }
  if (c.v !== AUDIT_SCHEMA || c.f !== key || c.s !== actor.sessionId || c.o !== actor.organisation_id || !Number.isInteger(c.w)) throw bad();
  return c;
}
export type AuditRow = {
  sequence: number;
  id: string;
  occurred_at: string;
  action: AuditAction;
  result: "success" | "denied";
  actor_id: string;
  actor_name: string;
  actor_active: number | null;
  case_ids: string;
  resource_type: string | null;
  resource_id: string | null;
  template_id: string | null;
  template_version: number | null;
  previous_status: string | null;
  new_status: string | null;
  previous_owner_id: string | null;
  new_owner_id: string | null;
  previous_state: string | null;
  new_state: string | null;
  viewed_event_ids: string | null;
  route_code: RouteCode | null;
};
export type AuditPage = {
  rows: AuditRow[];
  next?: string;
  actors: { id: string; name: string }[];
};
export async function viewAudit(
  db: D1Database,
  actor: Actor,
  secret: string,
  f: AuditFilters,
  cursorToken?: string,
): Promise<AuditPage> {
  if (!(await canViewAudit(db, actor))) throw new Problem(403, "Cette page est réservée aux superviseurs.");
  const cursor = cursorToken ? await verifyCursor(secret, cursorToken, f, actor) : undefined;
  const watermark =
    cursor?.w ??
    (await db
      .prepare("SELECT COALESCE(MAX(sequence),0) AS w FROM audit_events WHERE organisation_id=?")
      .bind(actor.organisation_id)
      .first<number>("w")) ??
    0;
  // Conditions et paramètres : l'organisme et la permission vivante ne viennent jamais du client.
  const conds = [
    "e.organisation_id=?",
    "e.sequence<=?",
    `EXISTS(SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id WHERE p.user_id=? AND p.organisation_id=e.organisation_id AND s.id=? AND ${liveSupervisor()})`,
  ];
  const args: unknown[] = [actor.organisation_id, watermark, actor.id, actor.sessionId];
  if (f.action) {
    conds.push("e.action=?");
    args.push(f.action);
  }
  if (f.actor) {
    conds.push("e.actor_id=?");
    args.push(f.actor);
  }
  if (f.fromUtc) {
    conds.push("e.occurred_at>=?");
    args.push(f.fromUtc);
  }
  if (f.toUtc) {
    conds.push("e.occurred_at<?");
    args.push(f.toUtc);
  }
  if (f.case) {
    // Dossier canonique puis anciennes références du même organisme (provenance de la reprise).
    conds.push(`EXISTS(SELECT 1 FROM json_each(e.case_ids) j WHERE j.value IN (
 SELECT ? UNION
 SELECT lp.legacy_case_id FROM legacy_case_provenance lp WHERE lp.organisation_id=e.organisation_id AND lp.canonical_case_id IN (
   SELECT ? UNION SELECT canonical_case_id FROM legacy_case_provenance WHERE organisation_id=e.organisation_id AND legacy_case_id=?)
 UNION SELECT canonical_case_id FROM legacy_case_provenance WHERE organisation_id=e.organisation_id AND legacy_case_id=?))`);
    args.push(f.case, f.case, f.case, f.case);
  }
  if (cursor) {
    conds.push("(e.occurred_at<? OR (e.occurred_at=? AND e.id<?))");
    args.push(cursor.t, cursor.t, cursor.i);
  }
  const where = conds.join(" AND ");
  const order = "ORDER BY e.occurred_at DESC,e.id DESC";
  const columns = `e.sequence,e.id,e.occurred_at,e.action,e.result,e.actor_id,
 COALESCE((SELECT u.name FROM user u JOIN profiles pa ON pa.user_id=u.id AND pa.organisation_id=e.organisation_id WHERE u.id=e.actor_id),'Compte indisponible') AS actor_name,
 (SELECT pa.active FROM profiles pa WHERE pa.user_id=e.actor_id AND pa.organisation_id=e.organisation_id) AS actor_active,
 e.case_ids,e.resource_type,e.resource_id,e.template_id,e.template_version,e.previous_status,e.new_status,e.previous_owner_id,e.new_owner_id,
 e.previous_state,e.new_state,e.viewed_event_ids,e.route_code`;
  const operation = crypto.randomUUID();
  // Un seul batch : trace conditionnée à la permission vivante et construite depuis les lignes exactement servies,
  // puis lecture de ces mêmes lignes. La trace créée (sequence > watermark) n'entre pas dans sa propre page.
  const results = await db.batch([
    db
      .prepare(
        `INSERT INTO audit_events(id,organisation_id,actor_id,action,result,case_ids,resource_type,viewed_event_ids)
 SELECT ?,p.organisation_id,p.user_id,'audit_read','success','[]','audit_log',
  COALESCE((SELECT json_group_array(id) FROM (SELECT e.id FROM audit_events e WHERE ${where} ${order} LIMIT ${auditPageSize})),'[]')
 FROM profiles p JOIN session s ON s.userId=p.user_id WHERE p.user_id=? AND p.organisation_id=? AND s.id=? AND ${liveSupervisor()}`,
      )
      .bind(operation, ...args, actor.id, actor.organisation_id, actor.sessionId),
    db.prepare(`SELECT ${columns} FROM audit_events e WHERE ${where} ${order} LIMIT ${auditPageSize}`).bind(...args),
    db.prepare(`SELECT 1 AS more FROM audit_events e WHERE ${where} ${order} LIMIT 1 OFFSET ${auditPageSize}`).bind(...args),
    db
      .prepare(
        `SELECT p.user_id AS id,u.name FROM profiles p JOIN user u ON u.id=p.user_id JOIN profiles me ON me.user_id=? AND me.organisation_id=p.organisation_id
 JOIN session s ON s.id=? AND s.userId=me.user_id WHERE p.organisation_id=? AND ${liveSupervisor("me")} ORDER BY u.name`,
      )
      .bind(actor.id, actor.sessionId, actor.organisation_id),
  ]);
  if ((results[0].meta.changes ?? 0) !== 1) throw new Problem(403, "Cette page est réservée aux superviseurs.");
  const rows = results[1].results as AuditRow[];
  const more = (results[2].results as unknown[]).length > 0;
  const last = rows.at(-1);
  return {
    rows,
    next:
      more && last
        ? await signCursor(secret, { w: watermark, t: last.occurred_at, i: last.id, f: filterKey(f), s: actor.sessionId, o: actor.organisation_id, v: AUDIT_SCHEMA })
        : undefined,
    actors: results[3].results as { id: string; name: string }[],
  };
}
// Refus authentifié : catégorie fixe, aucune cible, aucune URL ni texte d'erreur.
export async function recordDenial(db: D1Database, actor: Actor, route: RouteCode) {
  await db
    .prepare(
      "INSERT INTO audit_events(id,organisation_id,actor_id,action,result,case_ids,route_code) VALUES(?,?,?,'access_denied','denied','[]',?)",
    )
    .bind(crypto.randomUUID(), actor.organisation_id, actor.id, route)
    .run();
}

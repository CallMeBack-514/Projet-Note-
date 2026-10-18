import type { Actor } from "./auth";
import { access, visible, missing } from "./access";
import { AUDIT_SCHEMA, signCursor, verifyCursorKey } from "./audit";
import { limits } from "./limits";
import { resolveCase } from "./records";
export type HistoryRow = {
  sequence: number;
  id: string;
  occurred_at: string;
  action: "create" | "transfer" | "status_change" | "update";
  resource_type: string | null;
  resource_id: string | null;
  actor_id: string;
  actor_name: string;
  actor_active: number | null;
  previous_owner_name: string | null;
  new_owner_name: string | null;
  previous_status: string | null;
  new_status: string | null;
  template_id: string | null;
  template_version: number | null;
  operation_id: string | null;
  legacy_source: string | null;
  available: number;
};
export type HistoryPage = { rows: HistoryRow[]; next?: string };
// Projection d'une source unique : les actions métier retenues, jamais de lecture, refus, modèle ou suivi.
// Les événements créés avant `resource_type` (NULL) ne contenaient que des créations et transferts de dossier.
export const historyFilter = `(
 (e.action IN ('create','transfer') AND (e.resource_type='case' OR e.resource_type IS NULL))
 OR (e.action='status_change' AND e.resource_type='case')
 OR (e.action='create' AND e.resource_type='note')
 OR (e.action IN ('create','update') AND e.resource_type='document'))`;
const key = (caseId: string) => "history:" + caseId;
export async function caseHistory(
  db: D1Database,
  actor: Actor,
  secret: string,
  id: string,
  opts: { cursor?: string; trace: boolean },
): Promise<HistoryPage & { caseId: string }> {
  // Autorisation d'abord sur le dossier canonique (anciens identifiants résolus seulement si autorisé).
  const row = await resolveCase(db, actor, id);
  const caseId = row.id;
  const cursor = opts.cursor ? await verifyCursorKey(secret, opts.cursor, key(caseId), actor) : undefined;
  const watermark =
    cursor?.w ??
    (await db
      .prepare("SELECT COALESCE(MAX(sequence),0) AS w FROM audit_events WHERE organisation_id=?")
      .bind(actor.organisation_id)
      .first<number>("w")) ??
    0;
  const conds = [
    "e.organisation_id=c.organisation_id",
    "e.sequence<=?",
    historyFilter,
    // Dossier canonique et ses sources rapprochées du même organisme, dédupliqués par événement.
    `EXISTS(SELECT 1 FROM json_each(e.case_ids) j WHERE j.value=c.id OR j.value IN (
      SELECT lp.legacy_case_id FROM legacy_case_provenance lp WHERE lp.organisation_id=c.organisation_id AND lp.canonical_case_id=c.id))`,
  ];
  const args: unknown[] = [watermark];
  if (cursor) {
    conds.push("(e.occurred_at<? OR (e.occurred_at=? AND e.sequence<?))");
    args.push(cursor.t, cursor.t, Number(cursor.i));
  }
  const where = conds.join(" AND ");
  const from = `FROM audit_events e JOIN cases c ON c.id=? ${access}`;
  const base = [caseId, actor.id, actor.sessionId];
  const order = "ORDER BY e.occurred_at DESC,e.sequence DESC";
  const name = (col: string) =>
    `(SELECT u.name FROM user u JOIN profiles p ON p.user_id=u.id AND p.organisation_id=e.organisation_id WHERE u.id=e.${col})`;
  const columns = `e.sequence,e.id,e.occurred_at,e.action,e.resource_type,e.resource_id,e.actor_id,
 COALESCE(${name("actor_id")},'Compte indisponible') AS actor_name,
 (SELECT p.active FROM profiles p WHERE p.user_id=e.actor_id AND p.organisation_id=e.organisation_id) AS actor_active,
 CASE WHEN e.previous_owner_id IS NULL THEN NULL ELSE COALESCE(${name("previous_owner_id")},'Compte indisponible') END AS previous_owner_name,
 CASE WHEN e.new_owner_id IS NULL THEN NULL ELSE COALESCE(${name("new_owner_id")},'Compte indisponible') END AS new_owner_name,
 e.previous_status,e.new_status,e.template_id,e.template_version,e.operation_id,
 (SELECT j.value FROM json_each(e.case_ids) j WHERE j.value<>c.id AND j.value IN (
   SELECT lp.legacy_case_id FROM legacy_case_provenance lp WHERE lp.organisation_id=c.organisation_id AND lp.canonical_case_id=c.id) LIMIT 1) AS legacy_source,
 CASE e.resource_type
  WHEN 'document' THEN EXISTS(SELECT 1 FROM case_documents d WHERE d.id=e.resource_id AND d.case_id=c.id)
  WHEN 'note' THEN EXISTS(SELECT 1 FROM case_notes n WHERE n.id=e.resource_id AND n.case_id=c.id)
  ELSE 1 END AS available`;
  const page = `SELECT ${columns} ${from} WHERE ${visible} AND ${where} ${order} LIMIT ${limits.pageSize}`;
  const statements = [];
  if (opts.trace)
    // Lecture du dossier tracée dans le même batch, conditionnée aux mêmes droits vivants.
    statements.push(
      db
        .prepare(
          `INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,resource_version,operation_id)
 SELECT ?,c.organisation_id,actor.user_id,'read',json_array(c.id),'case',c.id,c.version,? FROM cases c ${access} WHERE ${visible} AND c.id=?`,
        )
        .bind(crypto.randomUUID(), crypto.randomUUID(), actor.id, actor.sessionId, caseId),
    );
  statements.push(db.prepare(page).bind(...base, ...args));
  statements.push(
    db.prepare(`SELECT 1 AS more ${from} WHERE ${visible} AND ${where} ${order} LIMIT 1 OFFSET ${limits.pageSize}`).bind(...base, ...args),
  );
  const results = await db.batch(statements);
  if (opts.trace && (results[0].meta.changes ?? 0) !== 1) throw missing();
  const rows = results[opts.trace ? 1 : 0].results as HistoryRow[];
  const more = (results[opts.trace ? 2 : 1].results as unknown[]).length > 0;
  const last = rows.at(-1);
  return {
    caseId,
    rows,
    next:
      more && last
        ? await signCursor(secret, { w: watermark, t: last.occurred_at, i: String(last.sequence), f: key(caseId), s: actor.sessionId, o: actor.organisation_id, v: AUDIT_SCHEMA })
        : undefined,
  };
}

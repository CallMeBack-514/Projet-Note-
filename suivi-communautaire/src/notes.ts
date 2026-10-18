import type { Actor } from "./auth";
import {
  Problem,
  FieldProblem,
  access,
  visible,
  missing,
  missingItem,
} from "./access";
import { readWithAudit } from "./audit";
import { limits } from "./limits";
import { record } from "./records";
import { resolveLocal, defaultZone, validZone } from "./time";
export type NoteRow = {
  id: string;
  case_id: string;
  body: string;
  nature: string;
  participants: string;
  occurred_at: string;
  time_zone: string;
  utc_offset_minutes: number;
  recorded_at: string;
  author_name: string;
  fu_id: string | null;
  fu_description: string | null;
  fu_due: string | null;
  fu_state: "todo" | "done" | null;
  fu_version: number | null;
  fu_closed_at: string | null;
  fu_closed_by_name: string | null;
};
export const chars = (s: string) => [...s].length;
export const normalize = (s: unknown) =>
  typeof s === "string" ? s.replace(/\r\n?/g, "\n") : "";
const noteSelect = `SELECT n.id,n.case_id,n.body,n.nature,n.participants,n.occurred_at,n.time_zone,n.utc_offset_minutes,n.recorded_at,
 COALESCE(au.name,'Compte indisponible') AS author_name,
 f.note_id AS fu_id,f.description AS fu_description,f.due_date AS fu_due,f.state AS fu_state,f.version AS fu_version,
 f.closed_at AS fu_closed_at,COALESCE(cu.name,CASE WHEN f.closed_by IS NULL THEN NULL ELSE 'Compte indisponible' END) AS fu_closed_by_name
 FROM case_notes n JOIN cases c ON c.id=n.case_id AND c.organisation_id=n.organisation_id ${access}
 LEFT JOIN user au ON au.id=n.author_id
 LEFT JOIN note_follow_ups f ON f.note_id=n.id
 LEFT JOIN user cu ON cu.id=f.closed_by
 WHERE ${visible} AND n.case_id=? ORDER BY n.occurred_at DESC,n.id DESC LIMIT ${limits.pageSize} OFFSET ?`;
// Page de notes avec trace de lecture cohérente : chaque note et chaque suivi réellement servis.
export async function listNotes(
  db: D1Database,
  actor: Actor,
  caseId: string,
  page = 1,
) {
  const rows = await readWithAudit<NoteRow>(
    db,
    actor,
    noteSelect,
    [actor.id, actor.sessionId, caseId, (page - 1) * limits.pageSize],
    [
      { type: "note", idCol: "id", caseCol: "case_id" },
      {
        type: "follow_up",
        idCol: "fu_id",
        caseCol: "case_id",
        versionCol: "fu_version",
        presentCol: "fu_id",
      },
    ],
  );
  const total = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM case_notes n JOIN cases c ON c.id=n.case_id AND c.organisation_id=n.organisation_id ${access} WHERE ${visible} AND n.case_id=?`,
    )
    .bind(actor.id, actor.sessionId, caseId)
    .first<number>("n");
  return { rows, total: total ?? 0 };
}
export type NoteValues = Record<string, string>;
function pick(raw: NoteValues, keys: string[]) {
  const out: NoteValues = {};
  for (const k of keys) out[k] = normalize(raw[k]);
  return out;
}
export const noteKeys = [
  "body",
  "nature",
  "participants",
  "date",
  "time",
  "tz",
  "offset",
  "follow_description",
  "follow_due",
];
// Valide le formulaire d'une note; l'auteur et l'organisme ne viennent jamais du formulaire.
export function validateNote(raw: NoteValues, now = Date.now()) {
  const v = pick(raw, noteKeys);
  const errors: Record<string, string> = {};
  const body = v.body.trim(),
    nature = v.nature.trim(),
    participants = v.participants.trim(),
    description = v.follow_description.trim(),
    due = v.follow_due.trim();
  if (!body) errors.body = "Rédigez la note.";
  else if (chars(body) > limits.note)
    errors.body = `La note ne peut pas dépasser ${limits.note} caractères.`;
  if (!nature) errors.nature = "Indiquez la nature de l’interaction.";
  else if (chars(nature) > limits.nature)
    errors.nature = `La nature ne peut pas dépasser ${limits.nature} caractères.`;
  if (chars(participants) > limits.participants)
    errors.participants = `Les personnes présentes ne peuvent pas dépasser ${limits.participants} caractères.`;
  if (chars(description) > limits.followUp)
    errors.follow_description = `La tâche ne peut pas dépasser ${limits.followUp} caractères.`;
  if (due && !description)
    errors.follow_description = "Décrivez la tâche pour y associer une échéance.";
  if (due && !validDate(due)) errors.follow_due = "Indiquez une échéance valide.";
  const zone = v.tz.trim() || defaultZone;
  let when: ReturnType<typeof resolveLocal> | undefined;
  try {
    when = resolveLocal(v.date.trim(), v.time.trim(), zone, v.offset.trim());
    if (Date.parse(when.instant) > now + 5 * 60000)
      errors.date = "L’interaction ne peut pas être dans le futur.";
  } catch (e) {
    if (e instanceof FieldProblem) Object.assign(errors, e.fields);
    else throw e;
  }
  if (!validZone(zone)) errors.tz = "Choisissez un fuseau horaire valide.";
  if (Object.keys(errors).length) throw new FieldProblem(errors);
  return {
    body,
    nature,
    participants,
    description,
    due: due || null,
    zone,
    when: when!,
  };
}
export function validDate(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] && +m[1] >= 1990;
}
export async function createNote(
  db: D1Database,
  actor: Actor,
  caseId: string,
  raw: NoteValues,
) {
  if (
    (raw.author_id && raw.author_id !== actor.id) ||
    (raw.organisation_id && raw.organisation_id !== actor.organisation_id)
  )
    throw new Problem(403, "Opération non autorisée.");
  await record(db, actor, caseId);
  const v = validateNote(raw);
  const noteId = crypto.randomUUID(),
    operation = crypto.randomUUID();
  const batch = [
    db
      .prepare(
        `INSERT INTO case_notes(id,organisation_id,case_id,body,nature,participants,occurred_at,time_zone,utc_offset_minutes,author_id,session_id,operation_id)
 VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        noteId,
        actor.organisation_id,
        caseId,
        v.body,
        v.nature,
        v.participants,
        v.when.instant,
        v.zone,
        v.when.offset,
        actor.id,
        actor.sessionId,
        operation,
      ),
  ];
  if (v.description)
    batch.push(
      db
        .prepare(
          `INSERT INTO note_follow_ups(note_id,organisation_id,case_id,description,due_date,created_by,updated_by,last_session_id,last_operation_id)
 VALUES(?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          noteId,
          actor.organisation_id,
          caseId,
          v.description,
          v.due,
          actor.id,
          actor.id,
          actor.sessionId,
          operation,
        ),
    );
  try {
    await db.batch(batch);
  } catch (e) {
    if (e instanceof Error && /access_denied/.test(e.message)) throw missing();
    throw e;
  }
  return noteId;
}
export type FollowUpValues = Record<string, string>;
export async function updateFollowUp(
  db: D1Database,
  actor: Actor,
  caseId: string,
  noteId: string,
  raw: FollowUpValues,
) {
  await record(db, actor, caseId);
  const description = normalize(raw.description).trim(),
    due = normalize(raw.due).trim(),
    state = raw.state,
    version = Number(raw.version);
  const errors: Record<string, string> = {};
  if (!description) errors.description = "Décrivez la tâche.";
  else if (chars(description) > limits.followUp)
    errors.description = `La tâche ne peut pas dépasser ${limits.followUp} caractères.`;
  if (due && !validDate(due)) errors.due = "Indiquez une échéance valide.";
  if (state !== "todo" && state !== "done") errors.state = "Choisissez un état.";
  if (!Number.isInteger(version) || version < 1)
    throw new Problem(400, "Version du suivi invalide. Actualisez la page.");
  if (Object.keys(errors).length) throw new FieldProblem(errors);
  const result = await db
    .prepare(
      `UPDATE note_follow_ups SET description=?,due_date=?,state=?,version=version+1,
 updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),
 closed_by=CASE WHEN ?='done' THEN COALESCE(closed_by,?) ELSE NULL END,
 closed_at=CASE WHEN ?='done' THEN COALESCE(closed_at,strftime('%Y-%m-%dT%H:%M:%fZ','now')) ELSE NULL END,
 last_session_id=?,last_operation_id=?
 WHERE note_id=? AND case_id=? AND version=?
 AND EXISTS(SELECT 1 FROM cases c ${access} WHERE c.id=note_follow_ups.case_id AND c.organisation_id=note_follow_ups.organisation_id AND ${visible})
 RETURNING note_id`,
    )
    .bind(
      description,
      due || null,
      state,
      actor.id,
      state,
      actor.id,
      state,
      actor.sessionId,
      crypto.randomUUID(),
      noteId,
      caseId,
      version,
      actor.id,
      actor.sessionId,
    )
    .all<{ note_id: string }>()
    .catch((e) => {
      if (e instanceof Error && /access_denied/.test(e.message)) throw missing();
      throw e;
    });
  if (result.results.length === 1) return;
  await record(db, actor, caseId);
  const current = await db
    .prepare(
      "SELECT version FROM note_follow_ups WHERE note_id=? AND case_id=? AND organisation_id=?",
    )
    .bind(noteId, caseId, actor.organisation_id)
    .first<{ version: number }>();
  if (!current) throw missingItem();
  throw new Problem(
    409,
    "Ce suivi a été modifié entre-temps. Actualisez la page avant de réessayer.",
  );
}

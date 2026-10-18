import type { Actor } from "./auth";
import { Problem, FieldProblem, access, visible, missing, missingItem, missingTemplate } from "./access";
import { readWithAudit } from "./audit";
import { limits } from "./limits";
import { record } from "./records";
import { chars, normalize, validDate } from "./notes";
import type { Field } from "./document-templates";
export type DocumentSummary = {
  id: string;
  case_id: string;
  template_id: string;
  template_version: number;
  version: number;
  created_at: string;
  updated_at: string;
  template_title: string;
  created_by_name: string;
  updated_by_name: string;
};
export type DocumentRow = DocumentSummary & {
  answers: Record<string, string | number>;
  fields: Field[];
  template_status: "available" | "retired";
};
const joins = `FROM case_documents d JOIN cases c ON c.id=d.case_id AND c.organisation_id=d.organisation_id ${access}
 JOIN document_template_versions v ON v.template_id=d.template_id AND v.version=d.template_version
 JOIN document_templates t ON t.id=d.template_id
 LEFT JOIN user cu ON cu.id=d.created_by LEFT JOIN user uu ON uu.id=d.updated_by`;
const names = `COALESCE(cu.name,'Compte indisponible') AS created_by_name,COALESCE(uu.name,'Compte indisponible') AS updated_by_name`;
const docSpec = {
  type: "document" as const,
  idCol: "id",
  caseCol: "case_id",
  versionCol: "version",
  templateIdCol: "template_id",
  templateVersionCol: "template_version",
};
// Page de métadonnées (sans réponses) avec trace de lecture pour chaque document servi.
export async function listDocuments(db: D1Database, actor: Actor, caseId: string, page = 1) {
  const rows = await readWithAudit<DocumentSummary>(
    db,
    actor,
    `SELECT d.id,d.case_id,d.template_id,d.template_version,d.version,d.created_at,d.updated_at,v.title AS template_title,${names}
 ${joins} WHERE ${visible} AND d.case_id=? ORDER BY d.updated_at DESC,d.id DESC LIMIT ${limits.pageSize} OFFSET ?`,
    [actor.id, actor.sessionId, caseId, (page - 1) * limits.pageSize],
    [docSpec],
  );
  const total = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM case_documents d JOIN cases c ON c.id=d.case_id AND c.organisation_id=d.organisation_id ${access} WHERE ${visible} AND d.case_id=?`,
    )
    .bind(actor.id, actor.sessionId, caseId)
    .first<number>("n");
  return { rows, total: total ?? 0 };
}
export async function getDocument(db: D1Database, actor: Actor, caseId: string, id: string): Promise<DocumentRow> {
  const rows = await readWithAudit<DocumentSummary & { answers: string; definition: string; template_status: "available" | "retired" }>(
    db,
    actor,
    `SELECT d.id,d.case_id,d.template_id,d.template_version,d.version,d.created_at,d.updated_at,d.answers,v.title AS template_title,
 v.definition AS definition,t.status AS template_status,${names}
 ${joins} WHERE ${visible} AND d.case_id=? AND d.id=? LIMIT 1`,
    [actor.id, actor.sessionId, caseId, id],
    [docSpec],
  );
  if (!rows.length) throw missingItem();
  const { answers, definition, ...rest } = rows[0];
  return { ...rest, answers: JSON.parse(answers), fields: JSON.parse(definition) };
}
// ---- Validation des réponses selon la définition persistée de la version ----
export const answerKey = (id: string) => "a." + id;
export function validateAnswers(fields: Field[], raw: Record<string, string>) {
  const errors: Record<string, string> = {};
  const answers: Record<string, string | number> = {};
  const known = new Set(fields.map((f) => answerKey(f.id)));
  for (const k of Object.keys(raw))
    if (k.startsWith("a.") && !known.has(k))
      throw new Problem(400, "Le formulaire ne correspond pas à ce modèle. Rouvrez le document.");
  for (const f of fields) {
    const k = answerKey(f.id);
    const value = normalize(raw[k]).trim();
    if (!value) {
      if (f.required) errors[k] = "Ce champ est obligatoire.";
      continue;
    }
    if (f.type === "text" || f.type === "textarea") {
      const max = f.type === "text" ? limits.shortAnswer : limits.longAnswer;
      if (chars(value) > max) errors[k] = `Cette réponse ne peut pas dépasser ${max} caractères.`;
      else if (f.type === "text" && value.includes("\n")) errors[k] = "Cette réponse tient sur une seule ligne.";
      else answers[f.id] = value;
    } else if (f.type === "date") {
      if (!validDate(value)) errors[k] = "Indiquez une date valide.";
      else answers[f.id] = value;
    } else if (f.type === "number") {
      const n = value.replace(",", ".");
      if (!/^-?\d{1,15}(\.\d{1,6})?$/.test(n) || !Number.isFinite(Number(n))) errors[k] = "Indiquez un nombre valide.";
      else answers[f.id] = Number(n);
    } else if (f.type === "choice") {
      if (!f.options?.some((o) => o.id === value)) errors[k] = "Choisissez l’une des options proposées.";
      else answers[f.id] = value;
    }
  }
  if (Object.keys(errors).length) throw new FieldProblem(errors);
  return answers;
}
const mapError = (e: unknown): never => {
  if (e instanceof Error) {
    if (/access_denied/.test(e.message)) throw missing();
    if (/template_unavailable/.test(e.message))
      throw new Problem(409, "Ce modèle n’est plus disponible. Choisissez un modèle disponible.");
  }
  throw e;
};
export async function createDocument(
  db: D1Database,
  actor: Actor,
  caseId: string,
  templateId: string,
  version: number,
  raw: Record<string, string>,
) {
  if (
    (raw.created_by && raw.created_by !== actor.id) ||
    (raw.organisation_id && raw.organisation_id !== actor.organisation_id)
  )
    throw new Problem(403, "Opération non autorisée.");
  await record(db, actor, caseId);
  const t = await db
    .prepare(
      `SELECT t.status,v.definition FROM document_templates t
 JOIN document_template_versions v ON v.template_id=t.id AND v.version=?
 WHERE t.id=? AND t.organisation_id=?`,
    )
    .bind(Number.isInteger(version) ? version : -1, templateId, actor.organisation_id)
    .first<{ status: string; definition: string }>();
  if (!t) throw missingTemplate();
  if (t.status !== "available")
    throw new Problem(409, "Ce modèle n’est plus disponible. Choisissez un modèle disponible.");
  const answers = validateAnswers(JSON.parse(t.definition), raw);
  const id = crypto.randomUUID();
  try {
    await db
      .prepare(
        `INSERT INTO case_documents(id,organisation_id,case_id,template_id,template_version,answers,created_by,updated_by,last_session_id,last_operation_id)
 VALUES(?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(id, actor.organisation_id, caseId, templateId, version, JSON.stringify(answers), actor.id, actor.id, actor.sessionId, crypto.randomUUID())
      .run();
  } catch (e) {
    mapError(e);
  }
  return id;
}
// Définition de la version du document, sans le servir : sert à valider une modification.
export async function documentDefinition(db: D1Database, actor: Actor, caseId: string, id: string) {
  const row = await db
    .prepare(
      `SELECT v.definition,v.title,d.template_id,d.template_version,d.version FROM case_documents d JOIN cases c ON c.id=d.case_id AND c.organisation_id=d.organisation_id ${access}
 JOIN document_template_versions v ON v.template_id=d.template_id AND v.version=d.template_version
 WHERE ${visible} AND d.case_id=? AND d.id=?`,
    )
    .bind(actor.id, actor.sessionId, caseId, id)
    .first<{ definition: string; title: string; template_id: string; template_version: number; version: number }>();
  if (!row) throw missingItem();
  return {
    fields: JSON.parse(row.definition) as Field[],
    title: row.title,
    id: row.template_id,
    version: row.template_version,
    document_version: row.version,
  };
}
export async function updateDocument(
  db: D1Database,
  actor: Actor,
  caseId: string,
  id: string,
  expected: number,
  raw: Record<string, string>,
) {
  await record(db, actor, caseId);
  if (!Number.isInteger(expected) || expected < 1)
    throw new Problem(400, "Version du document invalide. Actualisez la page.");
  const { fields } = await documentDefinition(db, actor, caseId, id);
  const answers = validateAnswers(fields, raw);
  const res = await db
    .prepare(
      `UPDATE case_documents SET answers=?,version=version+1,updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),last_session_id=?,last_operation_id=?
 WHERE id=? AND case_id=? AND version=?
 AND EXISTS(SELECT 1 FROM cases c ${access} WHERE c.id=case_documents.case_id AND c.organisation_id=case_documents.organisation_id AND ${visible})
 RETURNING id`,
    )
    .bind(JSON.stringify(answers), actor.id, actor.sessionId, crypto.randomUUID(), id, caseId, expected, actor.id, actor.sessionId)
    .all()
    .catch(mapError);
  if (res.results.length === 1) return;
  await record(db, actor, caseId);
  await documentDefinition(db, actor, caseId, id);
  throw new Problem(409, "Ce document a été modifié entre-temps. Relisez la version courante avant de réessayer.");
}

import type { Actor } from "./auth";
import { Problem, FieldProblem, missingTemplate } from "./access";
import { limits } from "./limits";
import { chars, normalize } from "./notes";
export type FieldType = "text" | "textarea" | "date" | "number" | "choice";
export const fieldTypes: { value: FieldType; label: string }[] = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte sur plusieurs lignes" },
  { value: "date", label: "Date" },
  { value: "number", label: "Nombre" },
  { value: "choice", label: "Choix unique" },
];
export type Field = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  help?: string;
  options?: { id: string; label: string }[];
};
// Représentation brute du constructeur : tout est du texte tel que saisi.
export type DraftField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  help: string;
  options: string;
};
export type TemplateRow = {
  id: string;
  status: "available" | "retired";
  current_version: number;
  version: number;
  title: string;
  fields: Field[];
  updated_at: string;
};
const base = `FROM document_templates t
 JOIN profiles actor ON actor.user_id=? AND actor.active=1 AND actor.organisation_id=t.organisation_id
 JOIN session ses ON ses.id=? AND ses.userId=actor.user_id AND ses.expiresAt>unixepoch('subsec')*1000
 JOIN document_template_versions v ON v.template_id=t.id`;
// Les intervenants ne voient que les modèles disponibles; la définition reste interne à l'organisme.
const scope = (actor: Actor) =>
  actor.role === "superviseur" ? "" : " AND t.status='available'";
export async function listTemplates(db: D1Database, actor: Actor) {
  const rows = await db
    .prepare(
      `SELECT t.id,t.status,t.current_version,v.version,v.title,t.updated_at ${base} AND v.version=t.current_version
 WHERE 1=1${scope(actor)} ORDER BY lower(v.title),t.id`,
    )
    .bind(actor.id, actor.sessionId)
    .all<Omit<TemplateRow, "fields">>();
  return rows.results;
}
export async function getTemplate(
  db: D1Database,
  actor: Actor,
  id: string,
  version?: number,
): Promise<TemplateRow> {
  const row = await db
    .prepare(
      `SELECT t.id,t.status,t.current_version,v.version,v.title,v.definition,t.updated_at ${base}
 AND v.version=COALESCE(?,t.current_version) WHERE t.id=?${scope(actor)}`,
    )
    .bind(
      actor.id,
      actor.sessionId,
      version !== undefined && Number.isInteger(version) ? version : null,
      id,
    )
    .first<Omit<TemplateRow, "fields"> & { definition: string }>();
  if (!row) throw missingTemplate();
  const { definition, ...rest } = row;
  return { ...rest, fields: JSON.parse(definition) as Field[] };
}
// ---- Constructeur : lecture du formulaire, opérations clavier, validation ----
const keyRe = /^f\.(\d+)\.(id|label|type|required|help|options)$/;
export function readDraft(raw: Record<string, string>): DraftField[] {
  const rows = new Map<number, DraftField>();
  for (const [k, v] of Object.entries(raw)) {
    const m = keyRe.exec(k);
    if (!m) continue;
    const i = Number(m[1]);
    if (i > limits.fields + 1) throw new FieldProblem({ fields: `Un modèle contient au plus ${limits.fields} champs.` });
    const row = rows.get(i) ?? { id: "", label: "", type: "text", required: false, help: "", options: "" };
    const key = m[2] as keyof DraftField;
    if (key === "required") row.required = v === "1";
    else (row[key] as string) = normalize(v);
    rows.set(i, row);
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);
}
export function newDraftField(): DraftField {
  return { id: "", label: "", type: "text", required: false, help: "", options: "" };
}
// Opérations accessibles au clavier : ajouter, retirer, monter, descendre.
export function applyOperation(fields: DraftField[], op: string): DraftField[] {
  const out = fields.map((f) => ({ ...f }));
  const m = /^(remove|up|down):(\d+)$/.exec(op);
  if (op === "add") {
    if (out.length < limits.fields) out.push(newDraftField());
  } else if (m) {
    const i = Number(m[2]);
    if (i >= 0 && i < out.length) {
      if (m[1] === "remove") out.splice(i, 1);
      else if (m[1] === "up" && i > 0) [out[i - 1], out[i]] = [out[i], out[i - 1]];
      else if (m[1] === "down" && i < out.length - 1) [out[i + 1], out[i]] = [out[i], out[i + 1]];
    }
  }
  return out;
}
export function draftFrom(fields: Field[]): DraftField[] {
  return fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    required: f.required,
    help: f.help ?? "",
    options: (f.options ?? []).map((o) => o.label).join("\n"),
  }));
}
const idRe = /^[a-z0-9_]{1,40}$/;
export function validateDefinition(title: string, draft: DraftField[]) {
  const errors: Record<string, string> = {};
  const t = normalize(title).trim();
  if (!t) errors.title = "Donnez un titre au modèle.";
  else if (chars(t) > limits.title) errors.title = `Le titre ne peut pas dépasser ${limits.title} caractères.`;
  if (!draft.length) errors.fields = "Ajoutez au moins un champ.";
  if (draft.length > limits.fields) errors.fields = `Un modèle contient au plus ${limits.fields} champs.`;
  const seen = new Set<string>();
  const fields: Field[] = [];
  draft.forEach((d, i) => {
    const k = (s: string) => `f.${i}.${s}`;
    const label = d.label.trim();
    if (!label) errors[k("label")] = "Indiquez le libellé du champ.";
    else if (chars(label) > limits.label) errors[k("label")] = `Le libellé ne peut pas dépasser ${limits.label} caractères.`;
    if (!fieldTypes.some((x) => x.value === d.type)) errors[k("type")] = "Choisissez un type de champ.";
    const help = d.help.trim();
    if (chars(help) > limits.instruction) errors[k("help")] = `L’instruction ne peut pas dépasser ${limits.instruction} caractères.`;
    let id = d.id.trim();
    if (id && !idRe.test(id)) errors[k("label")] = "Identifiant de champ invalide.";
    if (!id) id = "f_" + crypto.randomUUID().replaceAll("-", "").slice(0, 12);
    if (seen.has(id)) errors[k("label")] = "Identifiant de champ en doublon.";
    seen.add(id);
    const field: Field = { id, label, type: d.type as FieldType, required: d.required };
    if (help) field.help = help;
    if (d.type === "choice") {
      const labels = d.options.split("\n").map((s) => s.trim()).filter(Boolean);
      if (!labels.length) errors[k("options")] = "Indiquez au moins un choix (un par ligne).";
      else if (labels.length > limits.options) errors[k("options")] = `Un champ contient au plus ${limits.options} choix.`;
      else if (new Set(labels).size !== labels.length) errors[k("options")] = "Les choix doivent être différents.";
      else if (labels.some((l) => chars(l) > limits.label)) errors[k("options")] = `Chaque choix est limité à ${limits.label} caractères.`;
      field.options = labels.map((l, n) => ({ id: "o" + (n + 1), label: l }));
    }
    fields.push(field);
  });
  if (Object.keys(errors).length) throw new FieldProblem(errors);
  return { title: t, fields };
}
const supervisorOnly = (actor: Actor) => {
  if (actor.role !== "superviseur") throw new Problem(403, "Opération réservée aux superviseurs.");
};
const mapError = (e: unknown): never => {
  if (e instanceof Error) {
    if (/stale_template/.test(e.message))
      throw new Problem(409, "Ce modèle a été modifié ou retiré entre-temps. Rouvrez-le avant de réessayer.");
    if (/access_denied/.test(e.message)) throw new Problem(403, "Opération non autorisée.");
  }
  throw e;
};
export async function createTemplate(db: D1Database, actor: Actor, title: string, draft: DraftField[]) {
  supervisorOnly(actor);
  const def = validateDefinition(title, draft);
  const id = crypto.randomUUID(),
    op = crypto.randomUUID();
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO document_templates(id,organisation_id,created_by,updated_by,last_session_id,last_operation_id) VALUES(?,?,?,?,?,?)",
        )
        .bind(id, actor.organisation_id, actor.id, actor.id, actor.sessionId, op),
      db
        .prepare(
          "INSERT INTO document_template_versions(template_id,organisation_id,version,title,definition,created_by,session_id,operation_id) VALUES(?,?,1,?,?,?,?,?)",
        )
        .bind(id, actor.organisation_id, def.title, JSON.stringify(def.fields), actor.id, actor.sessionId, op),
    ]);
  } catch (e) {
    mapError(e);
  }
  return id;
}
// Nouvelle version immuable; `expected` est la version courante vue par le superviseur.
export async function updateTemplate(
  db: D1Database,
  actor: Actor,
  id: string,
  expected: number,
  title: string,
  draft: DraftField[],
) {
  supervisorOnly(actor);
  if (!Number.isInteger(expected) || expected < 1) throw new Problem(400, "Version du modèle invalide.");
  const current = await getTemplate(db, actor, id);
  if (current.status === "retired") throw new Problem(409, "Ce modèle est retiré et ne peut plus évoluer.");
  const def = validateDefinition(title, draft);
  try {
    await db
      .prepare(
        "INSERT INTO document_template_versions(template_id,organisation_id,version,title,definition,created_by,session_id,operation_id) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        actor.organisation_id,
        expected + 1,
        def.title,
        JSON.stringify(def.fields),
        actor.id,
        actor.sessionId,
        crypto.randomUUID(),
      )
      .run();
  } catch (e) {
    if (e instanceof Error && /UNIQUE|PRIMARY/i.test(e.message))
      throw new Problem(409, "Ce modèle a été modifié entre-temps. Rouvrez-le avant de réessayer.");
    mapError(e);
  }
  return expected + 1;
}
export async function retireTemplate(db: D1Database, actor: Actor, id: string, expected: number) {
  supervisorOnly(actor);
  if (!Number.isInteger(expected) || expected < 1) throw new Problem(400, "Version du modèle invalide.");
  await getTemplate(db, actor, id);
  const res = await db
    .prepare(
      `UPDATE document_templates SET status='retired',updated_by=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),last_session_id=?,last_operation_id=?
 WHERE id=? AND organisation_id=? AND status='available' AND current_version=? RETURNING id`,
    )
    .bind(actor.id, actor.sessionId, crypto.randomUUID(), id, actor.organisation_id, expected)
    .all()
    .catch(mapError);
  if (res.results.length !== 1)
    throw new Problem(409, "Ce modèle a été modifié ou retiré entre-temps. Rouvrez-le avant de réessayer.");
}

import type { Actor } from "./auth";
export type ProblemStatus = 400 | 403 | 404 | 409 | 413 | 503;
export class Problem extends Error {
  constructor(
    public status: ProblemStatus,
    message: string,
  ) {
    super(message);
  }
}
// Erreur de validation rattachée à des champs précis; ne contient jamais le contenu saisi.
export class FieldProblem extends Problem {
  constructor(
    public fields: Record<string, string>,
    message = "Corrigez les champs indiqués.",
    status: ProblemStatus = 400,
  ) {
    super(status, message);
  }
}
export const missing = () =>
  new Problem(404, "Ce dossier est introuvable ou n’est plus accessible.");
export const missingTemplate = () =>
  new Problem(404, "Ce modèle est introuvable ou n’est plus accessible.");
export const missingItem = () =>
  new Problem(404, "Cet élément est introuvable ou n’est plus accessible.");
// Toutes les lectures joignent le profil actif et la session vivante de l'acteur.
// `c` désigne la table cases; les prédicats sont recalculés à chaque requête.
export const access = `JOIN profiles actor ON actor.user_id=? AND actor.active=1 AND actor.organisation_id=c.organisation_id
 JOIN session ses ON ses.id=? AND ses.userId=actor.user_id AND ses.expiresAt>unixepoch('subsec')*1000`;
export const visible = `(actor.role='superviseur' OR c.owner_id=actor.user_id)`;
export const accessArgs = (actor: Actor) => [actor.id, actor.sessionId];
export const isoNow = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

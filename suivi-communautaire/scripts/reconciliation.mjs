// Logique pure du précontrôle et du manifeste de rapprochement (aucun accès base ici).
// Format du manifeste : voir docs/migration-dossier-personne.md.
export const casesQuery =
  "SELECT id,organisation_id,client_id,owner_id,service,opened_at,version FROM cases ORDER BY organisation_id,client_id,opened_at,id";
// Regroupe par (organisme, identifiant de personne). Aucun nom, aucune coordonnée, aucun rapprochement
// entre organismes : seuls les identifiants enregistrés servent de clé.
export function groupCases(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = r.organisation_id + "\u0000" + r.client_id;
    if (!groups.has(key))
      groups.set(key, { organisation_id: r.organisation_id, client_id: r.client_id, sources: [] });
    groups.get(key).sources.push({
      id: r.id,
      version: Number(r.version),
      owner_id: r.owner_id,
      service: r.service,
      opened_at: r.opened_at,
    });
  }
  return [...groups.values()].map((g) => ({
    ...g,
    kind: g.sources.length === 1 ? "simple" : new Set(g.sources.map((s) => s.owner_id)).size === 1 ? "meme_responsable" : "responsables_distincts",
  }));
}
export function precheck(rows) {
  const groups = groupCases(rows);
  const blocking = groups.filter((g) => g.kind !== "simple");
  return {
    people: groups.length,
    cases: rows.length,
    simple: groups.filter((g) => g.kind === "simple").length,
    blocking: blocking.map((g) => ({
      organisation_id: g.organisation_id,
      client_id: g.client_id,
      kind: g.kind,
      sources: g.sources,
      decision: { canonical_case_id: null, final_owner_id: null, decided_by: null, decided_at: null },
    })),
  };
}
// Contrôle côté opérateur avant chargement; la migration 0005 refait ces contrôles en SQL.
export function validateManifest(manifest, rows) {
  const problems = [];
  const groups = groupCases(rows).filter((g) => g.sources.length > 1);
  const decisions = Array.isArray(manifest?.blocking) ? manifest.blocking : [];
  for (const g of groups) {
    const d = decisions.find((x) => x.organisation_id === g.organisation_id && x.client_id === g.client_id);
    if (!d) {
      problems.push(`décision manquante pour la personne ${g.client_id}`);
      continue;
    }
    const dec = d.decision ?? {};
    if (!g.sources.some((s) => s.id === dec.canonical_case_id)) problems.push(`dossier canonique invalide pour ${g.client_id}`);
    for (const k of ["final_owner_id", "decided_by", "decided_at"]) if (!dec[k]) problems.push(`${k} manquant pour ${g.client_id}`);
    const same =
      Array.isArray(d.sources) &&
      d.sources.length === g.sources.length &&
      g.sources.every((s) => d.sources.some((x) => x.id === s.id && Number(x.version) === s.version));
    if (!same) problems.push(`sources périmées ou incomplètes pour ${g.client_id}`);
  }
  for (const d of decisions)
    if (!groups.some((g) => g.organisation_id === d.organisation_id && g.client_id === d.client_id))
      problems.push(`décision sans regroupement correspondant pour ${d.client_id}`);
  return problems;
}
export function manifestStatements(manifest) {
  return manifest.blocking.map((d) => ({
    sql: "INSERT OR REPLACE INTO reconciliation_decisions(organisation_id,client_id,canonical_case_id,final_owner_id,decided_by,decided_at,sources) VALUES(?,?,?,?,?,?,?)",
    params: [
      d.organisation_id,
      d.client_id,
      d.decision.canonical_case_id,
      d.decision.final_owner_id,
      d.decision.decided_by,
      d.decision.decided_at,
      JSON.stringify(d.sources.map((s) => ({ id: s.id, version: s.version }))),
    ],
  }));
}
export const decisionsTable = `CREATE TABLE IF NOT EXISTS reconciliation_decisions (
 organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 client_id TEXT NOT NULL,
 canonical_case_id TEXT NOT NULL,
 final_owner_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 decided_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 decided_at TEXT NOT NULL CHECK(length(decided_at) BETWEEN 10 AND 40),
 sources TEXT NOT NULL CHECK(json_valid(sources) AND json_type(sources)='array'),
 PRIMARY KEY(organisation_id,client_id)
)`;

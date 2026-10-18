-- Préparation de la reprise vers un dossier unique par personne (étape sans effet sur les dossiers).
-- Les décisions de rapprochement sont chargées ici par scripts/reconcile.mjs avant d'appliquer 0005.
CREATE TABLE IF NOT EXISTS reconciliation_decisions (
 organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 client_id TEXT NOT NULL,
 canonical_case_id TEXT NOT NULL,
 final_owner_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 decided_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 decided_at TEXT NOT NULL CHECK(length(decided_at) BETWEEN 10 AND 40),
 sources TEXT NOT NULL CHECK(json_valid(sources) AND json_type(sources)='array'),
 PRIMARY KEY(organisation_id,client_id)
);
CREATE TABLE IF NOT EXISTS legacy_case_provenance (
 legacy_case_id TEXT PRIMARY KEY,
 organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 client_id TEXT NOT NULL,
 canonical_case_id TEXT NOT NULL,
 service TEXT NOT NULL,
 previous_owner_id TEXT NOT NULL,
 opened_at TEXT NOT NULL,
 legacy_version INTEGER NOT NULL,
 migrated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS legacy_provenance_canonical ON legacy_case_provenance(organisation_id,canonical_case_id);
CREATE TRIGGER IF NOT EXISTS legacy_provenance_no_update BEFORE UPDATE ON legacy_case_provenance BEGIN SELECT RAISE(ABORT,'provenance_immutable'); END;
CREATE TRIGGER IF NOT EXISTS legacy_provenance_no_delete BEFORE DELETE ON legacy_case_provenance BEGIN SELECT RAISE(ABORT,'provenance_immutable'); END;

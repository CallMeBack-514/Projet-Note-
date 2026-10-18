-- Dossier unique par personne enregistrée. La reprise est tout ou rien : toute incohérence du manifeste
-- charge une ligne invalide dans _migration_guard et fait échouer l'ensemble de la migration.
DROP VIEW IF EXISTS _legacy_groups;
DROP TABLE IF EXISTS _migration_guard;
CREATE TABLE _migration_guard (check_name TEXT NOT NULL, ok INTEGER NOT NULL CHECK(ok=1));
CREATE VIEW _legacy_groups AS
 SELECT organisation_id,client_id,COUNT(*) AS n FROM cases GROUP BY organisation_id,client_id;
INSERT INTO _migration_guard SELECT 'manifest_missing',0 WHERE EXISTS(
 SELECT 1 FROM _legacy_groups g WHERE g.n>1 AND NOT EXISTS(
  SELECT 1 FROM reconciliation_decisions d WHERE d.organisation_id=g.organisation_id AND d.client_id=g.client_id));
INSERT INTO _migration_guard SELECT 'manifest_stale',0 WHERE EXISTS(
 SELECT 1 FROM reconciliation_decisions d WHERE NOT EXISTS(
  SELECT 1 FROM _legacy_groups g WHERE g.organisation_id=d.organisation_id AND g.client_id=d.client_id AND g.n>1));
INSERT INTO _migration_guard SELECT 'canonical_not_in_group',0 WHERE EXISTS(
 SELECT 1 FROM reconciliation_decisions d WHERE NOT EXISTS(
  SELECT 1 FROM cases c WHERE c.id=d.canonical_case_id AND c.organisation_id=d.organisation_id AND c.client_id=d.client_id));
INSERT INTO _migration_guard SELECT 'sources_incomplete',0 WHERE EXISTS(
 SELECT 1 FROM reconciliation_decisions d WHERE
  json_array_length(d.sources)<>(SELECT COUNT(*) FROM cases c WHERE c.organisation_id=d.organisation_id AND c.client_id=d.client_id)
  OR EXISTS(SELECT 1 FROM cases c WHERE c.organisation_id=d.organisation_id AND c.client_id=d.client_id AND NOT EXISTS(
   SELECT 1 FROM json_each(d.sources) j WHERE json_extract(j.value,'$.id')=c.id AND json_extract(j.value,'$.version')=c.version)));
INSERT INTO _migration_guard SELECT 'decider_not_authorised',0 WHERE EXISTS(
 SELECT 1 FROM reconciliation_decisions d WHERE NOT EXISTS(
  SELECT 1 FROM profiles p WHERE p.user_id=d.decided_by AND p.organisation_id=d.organisation_id AND p.role='superviseur' AND p.active=1));
INSERT INTO _migration_guard SELECT 'owner_not_admissible',0 WHERE EXISTS(
 SELECT 1 FROM reconciliation_decisions d WHERE NOT EXISTS(
  SELECT 1 FROM profiles p WHERE p.user_id=d.final_owner_id AND p.organisation_id=d.organisation_id AND p.role='intervenant' AND p.active=1));
DROP TABLE _migration_guard;

INSERT INTO legacy_case_provenance(legacy_case_id,organisation_id,client_id,canonical_case_id,service,previous_owner_id,opened_at,legacy_version)
SELECT c.id,c.organisation_id,c.client_id,d.canonical_case_id,c.service,c.owner_id,c.opened_at,c.version
FROM cases c JOIN reconciliation_decisions d ON d.organisation_id=c.organisation_id AND d.client_id=c.client_id;

INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,previous_owner_id,new_owner_id)
SELECT lower(hex(randomblob(16))),c.organisation_id,d.decided_by,'transfer',json_array(c.id),c.owner_id,d.final_owner_id
FROM reconciliation_decisions d JOIN cases c ON c.id=d.canonical_case_id WHERE c.owner_id<>d.final_owner_id;

DROP TRIGGER cases_create_guard;
DROP TRIGGER cases_transfer_guard;
DROP TRIGGER cases_created;
DROP TRIGGER cases_transferred;
DROP TRIGGER profile_owner_role;
CREATE TABLE cases_new (
 id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 client_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Ouvert' CHECK(status='Ouvert'),
 opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 last_actor_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 last_session_id TEXT NOT NULL, last_operation_id TEXT NOT NULL UNIQUE,
 UNIQUE(id,organisation_id),
 UNIQUE(organisation_id,client_id),
 FOREIGN KEY(client_id,organisation_id) REFERENCES clients(id,organisation_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_id,organisation_id) REFERENCES profiles(user_id,organisation_id) ON DELETE RESTRICT
);
INSERT INTO cases_new(id,organisation_id,client_id,owner_id,status,opened_at,version,last_actor_id,last_session_id,last_operation_id)
SELECT c.id,c.organisation_id,c.client_id,
 COALESCE(d.final_owner_id,c.owner_id),c.status,c.opened_at,
 CASE WHEN d.final_owner_id IS NOT NULL AND d.final_owner_id<>c.owner_id THEN c.version+1 ELSE c.version END,
 CASE WHEN d.final_owner_id IS NOT NULL AND d.final_owner_id<>c.owner_id THEN d.decided_by ELSE c.last_actor_id END,
 CASE WHEN d.final_owner_id IS NOT NULL AND d.final_owner_id<>c.owner_id THEN 'reconciliation' ELSE c.last_session_id END,
 CASE WHEN d.final_owner_id IS NOT NULL AND d.final_owner_id<>c.owner_id THEN lower(hex(randomblob(16))) ELSE c.last_operation_id END
FROM cases c LEFT JOIN reconciliation_decisions d ON d.canonical_case_id=c.id
WHERE NOT EXISTS(SELECT 1 FROM reconciliation_decisions x WHERE x.organisation_id=c.organisation_id AND x.client_id=c.client_id AND x.canonical_case_id<>c.id);
DROP VIEW _legacy_groups;
DROP TABLE cases;
ALTER TABLE cases_new RENAME TO cases;
CREATE INDEX cases_owner ON cases(organisation_id,owner_id,opened_at,id);

CREATE TRIGGER cases_create_guard BEFORE INSERT ON cases BEGIN
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id
  WHERE p.user_id=NEW.last_actor_id AND p.active=1 AND p.organisation_id=NEW.organisation_id
  AND s.id=NEW.last_session_id AND s.expiresAt>unixepoch('subsec')*1000
  AND (p.role='superviseur' OR p.user_id=NEW.owner_id)
 );
 SELECT RAISE(ABORT,'invalid_destination') WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE user_id=NEW.owner_id AND organisation_id=NEW.organisation_id AND role='intervenant' AND active=1
 );
 SELECT RAISE(ABORT,'client_not_visible') WHERE NOT EXISTS (
  SELECT 1 FROM clients cl WHERE cl.id=NEW.client_id AND cl.organisation_id=NEW.organisation_id
  AND cl.creation_operation=NEW.last_operation_id
 );
 SELECT RAISE(ABORT,'invalid_version') WHERE NEW.version<>1;
END;
CREATE TRIGGER cases_transfer_guard BEFORE UPDATE ON cases BEGIN
 SELECT RAISE(ABORT,'immutable_case') WHERE NEW.id<>OLD.id OR NEW.organisation_id<>OLD.organisation_id OR NEW.client_id<>OLD.client_id OR NEW.opened_at<>OLD.opened_at OR NEW.status<>OLD.status;
 SELECT RAISE(ABORT,'invalid_transfer') WHERE NEW.version<>OLD.version+1 OR NEW.owner_id=OLD.owner_id OR NEW.last_operation_id=OLD.last_operation_id;
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id
  WHERE p.user_id=NEW.last_actor_id AND p.active=1 AND p.organisation_id=OLD.organisation_id
  AND s.id=NEW.last_session_id AND s.expiresAt>unixepoch('subsec')*1000
  AND (p.role='superviseur' OR p.user_id=OLD.owner_id)
 );
 SELECT RAISE(ABORT,'invalid_destination') WHERE NOT EXISTS (
  SELECT 1 FROM profiles WHERE user_id=NEW.owner_id AND organisation_id=NEW.organisation_id AND role='intervenant' AND active=1
 );
END;
CREATE TRIGGER cases_created AFTER INSERT ON cases BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,new_owner_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'create',json_array(NEW.id),NEW.owner_id);
END;
CREATE TRIGGER cases_transferred AFTER UPDATE ON cases BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,previous_owner_id,new_owner_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'transfer',json_array(NEW.id),OLD.owner_id,NEW.owner_id);
END;
CREATE TRIGGER profile_owner_role BEFORE UPDATE OF role ON profiles
WHEN NEW.role<>'intervenant' AND EXISTS(SELECT 1 FROM cases WHERE owner_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'profile_owns_cases'); END;

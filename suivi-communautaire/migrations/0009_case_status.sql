-- Statuts Actif / Inactif du dossier-personne. Ouvert devient Actif; aucune valeur inattendue n'est convertie.
-- Le CHECK de cases.status exige de reconstruire la table. D1 ne permet pas de suspendre les clés étrangères
-- pendant la reconstruction d'un parent : les tables enfants (notes, suivis, documents) sont donc copiées vers
-- des tables de transit, recréées après la nouvelle table cases, puis rechargées avant leurs déclencheurs
-- (aucun événement d'audit n'est produit par la copie).
DROP TABLE IF EXISTS _migration_guard;
CREATE TABLE _migration_guard (check_name TEXT NOT NULL, ok INTEGER NOT NULL CHECK(ok=1));
INSERT INTO _migration_guard SELECT 'unexpected_status',0 WHERE EXISTS(SELECT 1 FROM cases WHERE status NOT IN ('Ouvert','Actif','Inactif'));
DROP TABLE _migration_guard;
CREATE TABLE _t_notes AS SELECT * FROM case_notes;
CREATE TABLE _t_follow_ups AS SELECT * FROM note_follow_ups;
CREATE TABLE _t_documents AS SELECT * FROM case_documents;
DROP TABLE case_documents;
DROP TABLE note_follow_ups;
DROP TABLE case_notes;
DROP TRIGGER cases_create_guard;
DROP TRIGGER cases_transfer_guard;
DROP TRIGGER cases_created;
DROP TRIGGER cases_transferred;
DROP TRIGGER profile_owner_role;
CREATE TABLE cases_new (
 id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 client_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Actif' CHECK(status IN ('Actif','Inactif')),
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
SELECT id,organisation_id,client_id,owner_id,CASE status WHEN 'Ouvert' THEN 'Actif' ELSE status END,opened_at,version,last_actor_id,last_session_id,last_operation_id FROM cases;
DROP TABLE cases;
ALTER TABLE cases_new RENAME TO cases;
CREATE INDEX cases_owner ON cases(organisation_id,owner_id,opened_at,id);
CREATE INDEX cases_status ON cases(organisation_id,status,opened_at,id);

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
 SELECT RAISE(ABORT,'invalid_status') WHERE NEW.status<>'Actif';
END;
-- Une mutation modifie soit le responsable (transfert), soit le statut, jamais les deux.
CREATE TRIGGER cases_mutation_guard BEFORE UPDATE ON cases BEGIN
 SELECT RAISE(ABORT,'immutable_case') WHERE NEW.id<>OLD.id OR NEW.organisation_id<>OLD.organisation_id OR NEW.client_id<>OLD.client_id OR NEW.opened_at<>OLD.opened_at;
 SELECT RAISE(ABORT,'invalid_mutation') WHERE (NEW.owner_id<>OLD.owner_id) = (NEW.status<>OLD.status);
 SELECT RAISE(ABORT,'invalid_version') WHERE NEW.version<>OLD.version+1 OR NEW.last_operation_id=OLD.last_operation_id;
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id
  WHERE p.user_id=NEW.last_actor_id AND p.active=1 AND p.organisation_id=OLD.organisation_id
  AND s.id=NEW.last_session_id AND s.expiresAt>unixepoch('subsec')*1000
  AND (p.role='superviseur' OR p.user_id=OLD.owner_id)
 );
 SELECT RAISE(ABORT,'invalid_destination') WHERE NEW.owner_id<>OLD.owner_id AND NOT EXISTS (
  SELECT 1 FROM profiles WHERE user_id=NEW.owner_id AND organisation_id=NEW.organisation_id AND role='intervenant' AND active=1
 );
END;
CREATE TRIGGER cases_created AFTER INSERT ON cases BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,new_owner_id,resource_type,resource_id,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'create',json_array(NEW.id),NEW.owner_id,'case',NEW.id,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER cases_transferred AFTER UPDATE ON cases WHEN NEW.owner_id<>OLD.owner_id BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,previous_owner_id,new_owner_id,resource_type,resource_id,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'transfer',json_array(NEW.id),OLD.owner_id,NEW.owner_id,'case',NEW.id,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER cases_status_changed AFTER UPDATE ON cases WHEN NEW.status<>OLD.status BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,previous_status,new_status,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'status_change',json_array(NEW.id),'case',NEW.id,OLD.status,NEW.status,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER profile_owner_role BEFORE UPDATE OF role ON profiles
WHEN NEW.role<>'intervenant' AND EXISTS(SELECT 1 FROM cases WHERE owner_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'profile_owns_cases'); END;


-- Notes d'interaction (immuables) et tâches de suivi (une au plus par note).
CREATE TABLE case_notes (
 id TEXT PRIMARY KEY,
 organisation_id TEXT NOT NULL,
 case_id TEXT NOT NULL,
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 10000),
 nature TEXT NOT NULL CHECK(length(trim(nature)) BETWEEN 1 AND 160),
 participants TEXT NOT NULL DEFAULT '' CHECK(length(participants)<=2000),
 occurred_at TEXT NOT NULL CHECK(length(occurred_at)=24),
 time_zone TEXT NOT NULL CHECK(length(time_zone) BETWEEN 1 AND 64),
 utc_offset_minutes INTEGER NOT NULL CHECK(utc_offset_minutes BETWEEN -1080 AND 1080),
 author_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 session_id TEXT NOT NULL,
 operation_id TEXT NOT NULL,
 UNIQUE(id,organisation_id,case_id),
 FOREIGN KEY(case_id,organisation_id) REFERENCES cases(id,organisation_id) ON DELETE RESTRICT,
 FOREIGN KEY(author_id,organisation_id) REFERENCES profiles(user_id,organisation_id) ON DELETE RESTRICT
);
CREATE INDEX case_notes_order ON case_notes(case_id,occurred_at DESC,id DESC);
CREATE TABLE note_follow_ups (
 note_id TEXT PRIMARY KEY,
 organisation_id TEXT NOT NULL,
 case_id TEXT NOT NULL,
 description TEXT NOT NULL CHECK(length(trim(description)) BETWEEN 1 AND 2000),
 due_date TEXT CHECK(due_date IS NULL OR (length(due_date)=10 AND date(due_date)=due_date)),
 state TEXT NOT NULL DEFAULT 'todo' CHECK(state IN ('todo','done')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 closed_by TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
 closed_at TEXT,
 last_session_id TEXT NOT NULL,
 last_operation_id TEXT NOT NULL,
 CHECK((state='todo' AND closed_by IS NULL AND closed_at IS NULL) OR (state='done' AND closed_by IS NOT NULL AND closed_at IS NOT NULL)),
 FOREIGN KEY(note_id,organisation_id,case_id) REFERENCES case_notes(id,organisation_id,case_id) ON DELETE RESTRICT
);
CREATE INDEX follow_ups_case ON note_follow_ups(case_id,state,due_date);


CREATE TABLE case_documents (
 id TEXT PRIMARY KEY,
 organisation_id TEXT NOT NULL,
 case_id TEXT NOT NULL,
 template_id TEXT NOT NULL,
 template_version INTEGER NOT NULL,
 answers TEXT NOT NULL CHECK(json_valid(answers) AND json_type(answers)='object' AND length(answers)<=262144),
 created_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 last_session_id TEXT NOT NULL,
 last_operation_id TEXT NOT NULL,
 FOREIGN KEY(case_id,organisation_id) REFERENCES cases(id,organisation_id) ON DELETE RESTRICT,
 FOREIGN KEY(template_id,template_version,organisation_id) REFERENCES document_template_versions(template_id,version,organisation_id) ON DELETE RESTRICT
);
CREATE INDEX case_documents_order ON case_documents(case_id,updated_at DESC,id DESC);


INSERT INTO case_notes SELECT * FROM _t_notes;
INSERT INTO note_follow_ups SELECT * FROM _t_follow_ups;
INSERT INTO case_documents SELECT * FROM _t_documents;
DROP TABLE _t_notes;
DROP TABLE _t_follow_ups;
DROP TABLE _t_documents;

CREATE TRIGGER notes_guard BEFORE INSERT ON case_notes BEGIN
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM cases c JOIN profiles p ON p.user_id=NEW.author_id AND p.active=1 AND p.organisation_id=c.organisation_id
  JOIN session s ON s.id=NEW.session_id AND s.userId=p.user_id AND s.expiresAt>unixepoch('subsec')*1000
  WHERE c.id=NEW.case_id AND c.organisation_id=NEW.organisation_id AND (p.role='superviseur' OR c.owner_id=p.user_id)
 );
END;
CREATE TRIGGER notes_created AFTER INSERT ON case_notes BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.author_id,'create',json_array(NEW.case_id),'note',NEW.id,NEW.operation_id);
END;
CREATE TRIGGER notes_no_update BEFORE UPDATE ON case_notes BEGIN SELECT RAISE(ABORT,'note_immutable'); END;
CREATE TRIGGER notes_no_delete BEFORE DELETE ON case_notes BEGIN SELECT RAISE(ABORT,'note_immutable'); END;

CREATE TRIGGER follow_up_guard BEFORE INSERT ON note_follow_ups BEGIN
 SELECT RAISE(ABORT,'invalid_follow_up') WHERE NEW.state<>'todo' OR NEW.version<>1 OR NEW.created_by<>NEW.updated_by
  OR NOT EXISTS(SELECT 1 FROM case_notes n WHERE n.id=NEW.note_id AND n.author_id=NEW.created_by AND n.operation_id=NEW.last_operation_id);
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM cases c JOIN profiles p ON p.user_id=NEW.created_by AND p.active=1 AND p.organisation_id=c.organisation_id
  JOIN session s ON s.id=NEW.last_session_id AND s.userId=p.user_id AND s.expiresAt>unixepoch('subsec')*1000
  WHERE c.id=NEW.case_id AND c.organisation_id=NEW.organisation_id AND (p.role='superviseur' OR c.owner_id=p.user_id)
 );
END;
CREATE TRIGGER follow_up_created AFTER INSERT ON note_follow_ups BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.created_by,'create',json_array(NEW.case_id),'follow_up',NEW.note_id,NULL,NEW.state,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER follow_up_update_guard BEFORE UPDATE ON note_follow_ups BEGIN
 SELECT RAISE(ABORT,'immutable_follow_up') WHERE NEW.note_id<>OLD.note_id OR NEW.organisation_id<>OLD.organisation_id OR NEW.case_id<>OLD.case_id
  OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at;
 SELECT RAISE(ABORT,'invalid_follow_up') WHERE NEW.version<>OLD.version+1 OR NEW.last_operation_id=OLD.last_operation_id
  OR (NEW.state='done' AND OLD.state='todo' AND NEW.closed_by<>NEW.updated_by);
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM cases c JOIN profiles p ON p.user_id=NEW.updated_by AND p.active=1 AND p.organisation_id=c.organisation_id
  JOIN session s ON s.id=NEW.last_session_id AND s.userId=p.user_id AND s.expiresAt>unixepoch('subsec')*1000
  WHERE c.id=OLD.case_id AND c.organisation_id=OLD.organisation_id AND (p.role='superviseur' OR c.owner_id=p.user_id)
 );
END;
CREATE TRIGGER follow_up_updated AFTER UPDATE ON note_follow_ups BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.updated_by,'update',json_array(NEW.case_id),'follow_up',NEW.note_id,OLD.state,NEW.state,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER follow_up_no_delete BEFORE DELETE ON note_follow_ups BEGIN SELECT RAISE(ABORT,'follow_up_permanent'); END;

CREATE TRIGGER documents_guard BEFORE INSERT ON case_documents BEGIN
 SELECT RAISE(ABORT,'invalid_document') WHERE NEW.version<>1 OR NEW.created_by<>NEW.updated_by;
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM cases c JOIN profiles p ON p.user_id=NEW.created_by AND p.active=1 AND p.organisation_id=c.organisation_id
  JOIN session s ON s.id=NEW.last_session_id AND s.userId=p.user_id AND s.expiresAt>unixepoch('subsec')*1000
  WHERE c.id=NEW.case_id AND c.organisation_id=NEW.organisation_id AND (p.role='superviseur' OR c.owner_id=p.user_id)
 );
 SELECT RAISE(ABORT,'template_unavailable') WHERE NOT EXISTS (
  SELECT 1 FROM document_templates t WHERE t.id=NEW.template_id AND t.organisation_id=NEW.organisation_id AND t.status='available'
 );
END;
CREATE TRIGGER documents_created AFTER INSERT ON case_documents BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.created_by,'create',json_array(NEW.case_id),'document',NEW.id,NEW.template_id,NEW.template_version,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER documents_update_guard BEFORE UPDATE ON case_documents BEGIN
 SELECT RAISE(ABORT,'immutable_document') WHERE NEW.id<>OLD.id OR NEW.organisation_id<>OLD.organisation_id OR NEW.case_id<>OLD.case_id
  OR NEW.template_id<>OLD.template_id OR NEW.template_version<>OLD.template_version OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at;
 SELECT RAISE(ABORT,'invalid_document') WHERE NEW.version<>OLD.version+1 OR NEW.last_operation_id=OLD.last_operation_id;
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM cases c JOIN profiles p ON p.user_id=NEW.updated_by AND p.active=1 AND p.organisation_id=c.organisation_id
  JOIN session s ON s.id=NEW.last_session_id AND s.userId=p.user_id AND s.expiresAt>unixepoch('subsec')*1000
  WHERE c.id=OLD.case_id AND c.organisation_id=OLD.organisation_id AND (p.role='superviseur' OR c.owner_id=p.user_id)
 );
END;
CREATE TRIGGER documents_updated AFTER UPDATE ON case_documents BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.updated_by,'update',json_array(NEW.case_id),'document',NEW.id,NEW.template_id,NEW.template_version,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER documents_no_delete BEFORE DELETE ON case_documents BEGIN SELECT RAISE(ABORT,'document_permanent'); END;

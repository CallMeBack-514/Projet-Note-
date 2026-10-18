-- Contrat d'audit commun : les événements existants sont recopiés sans changement.
-- Aucun champ ne contient de texte libre, de réponse de formulaire ou de secret.
DROP TRIGGER cases_created;
DROP TRIGGER cases_transferred;
CREATE TABLE audit_events_new (
 id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN ('create','read','update','transfer','status_change')),
 occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 case_ids TEXT NOT NULL CHECK(json_valid(case_ids)),
 previous_owner_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
 new_owner_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
 resource_type TEXT CHECK(resource_type IS NULL OR resource_type IN ('case','note','follow_up','document','document_template')),
 resource_id TEXT,
 template_id TEXT,
 template_version INTEGER,
 previous_status TEXT,
 new_status TEXT,
 previous_state TEXT,
 new_state TEXT,
 resource_version INTEGER,
 operation_id TEXT
);
INSERT INTO audit_events_new(id,organisation_id,actor_id,action,occurred_at,case_ids,previous_owner_id,new_owner_id)
SELECT id,organisation_id,actor_id,action,occurred_at,case_ids,previous_owner_id,new_owner_id FROM audit_events;
DROP TABLE audit_events;
ALTER TABLE audit_events_new RENAME TO audit_events;
CREATE INDEX audit_org_time ON audit_events(organisation_id,occurred_at);
CREATE INDEX audit_resource ON audit_events(organisation_id,resource_type,resource_id);
CREATE INDEX audit_operation ON audit_events(operation_id);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER cases_created AFTER INSERT ON cases BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,new_owner_id,resource_type,resource_id,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'create',json_array(NEW.id),NEW.owner_id,'case',NEW.id,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER cases_transferred AFTER UPDATE ON cases BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,previous_owner_id,new_owner_id,resource_type,resource_id,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'transfer',json_array(NEW.id),OLD.owner_id,NEW.owner_id,'case',NEW.id,NEW.version,NEW.last_operation_id);
END;

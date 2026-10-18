-- Journal canonique consultable : séquence d'insertion monotone, actions audit_read et access_denied,
-- résultat succès/refus, références des événements affichés et catégories fixes de refus.
-- Les événements existants sont recopiés dans l'ordre de leur ancien rowid; id, dates, références et
-- operation_id sont inchangés. Les déclencheurs d'écriture d'audit sont recréés après la reconstruction.
DROP TRIGGER cases_created;
DROP TRIGGER cases_transferred;
DROP TRIGGER notes_created;
DROP TRIGGER follow_up_created;
DROP TRIGGER follow_up_updated;
DROP TRIGGER templates_created;
DROP TRIGGER templates_updated;
DROP TRIGGER documents_created;
DROP TRIGGER documents_updated;
DROP TRIGGER cases_status_changed;
CREATE TABLE audit_events_new (
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,
 id TEXT NOT NULL UNIQUE,
 organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN ('create','read','update','transfer','status_change','audit_read','access_denied')),
 occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 case_ids TEXT NOT NULL CHECK(json_valid(case_ids)),
 previous_owner_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
 new_owner_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
 resource_type TEXT CHECK(resource_type IS NULL OR resource_type IN ('case','note','follow_up','document','document_template','audit_log')),
 resource_id TEXT,
 template_id TEXT,
 template_version INTEGER,
 previous_status TEXT,
 new_status TEXT,
 previous_state TEXT,
 new_state TEXT,
 resource_version INTEGER,
 operation_id TEXT,
 result TEXT NOT NULL DEFAULT 'success' CHECK(result IN ('success','denied')),
 viewed_event_ids TEXT CHECK(viewed_event_ids IS NULL OR (json_valid(viewed_event_ids) AND json_type(viewed_event_ids)='array' AND json_array_length(viewed_event_ids)<=25)),
 route_code TEXT CHECK(route_code IS NULL OR route_code IN ('case_read','case_write','content_read','content_write','audit_read')),
 CHECK(
  (action='audit_read' AND result='success' AND resource_type='audit_log' AND resource_id IS NULL AND route_code IS NULL AND viewed_event_ids IS NOT NULL AND case_ids='[]' AND template_id IS NULL)
  OR (action='access_denied' AND result='denied' AND case_ids='[]' AND resource_type IS NULL AND resource_id IS NULL AND viewed_event_ids IS NULL AND route_code IS NOT NULL AND template_id IS NULL AND previous_owner_id IS NULL AND new_owner_id IS NULL AND operation_id IS NULL)
  OR (action NOT IN ('audit_read','access_denied') AND result='success' AND viewed_event_ids IS NULL AND route_code IS NULL)
 )
);
INSERT INTO audit_events_new(id,organisation_id,actor_id,action,occurred_at,case_ids,previous_owner_id,new_owner_id,resource_type,resource_id,template_id,template_version,previous_status,new_status,previous_state,new_state,resource_version,operation_id)
SELECT id,organisation_id,actor_id,action,occurred_at,case_ids,previous_owner_id,new_owner_id,resource_type,resource_id,template_id,template_version,previous_status,new_status,previous_state,new_state,resource_version,operation_id FROM audit_events ORDER BY rowid;
DROP TABLE audit_events;
ALTER TABLE audit_events_new RENAME TO audit_events;
CREATE INDEX audit_org_time ON audit_events(organisation_id,occurred_at DESC,id DESC);
CREATE INDEX audit_org_actor_time ON audit_events(organisation_id,actor_id,occurred_at DESC,id DESC);
CREATE INDEX audit_resource ON audit_events(organisation_id,resource_type,resource_id);
CREATE INDEX audit_operation ON audit_events(operation_id);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER cases_created AFTER INSERT ON cases BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,new_owner_id,resource_type,resource_id,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'create',json_array(NEW.id),NEW.owner_id,'case',NEW.id,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER cases_transferred AFTER UPDATE ON cases WHEN NEW.owner_id<>OLD.owner_id BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,previous_owner_id,new_owner_id,resource_type,resource_id,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'transfer',json_array(NEW.id),OLD.owner_id,NEW.owner_id,'case',NEW.id,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER notes_created AFTER INSERT ON case_notes BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.author_id,'create',json_array(NEW.case_id),'note',NEW.id,NEW.operation_id);
END;
CREATE TRIGGER follow_up_created AFTER INSERT ON note_follow_ups BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.created_by,'create',json_array(NEW.case_id),'follow_up',NEW.note_id,NULL,NEW.state,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER follow_up_updated AFTER UPDATE ON note_follow_ups BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.updated_by,'update',json_array(NEW.case_id),'follow_up',NEW.note_id,OLD.state,NEW.state,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER templates_created AFTER INSERT ON document_templates BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.created_by,'create','[]','document_template',NEW.id,NEW.id,NEW.current_version,NULL,NEW.status,NEW.current_version,NEW.last_operation_id);
END;
CREATE TRIGGER templates_updated AFTER UPDATE ON document_templates BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.updated_by,'update','[]','document_template',NEW.id,NEW.id,NEW.current_version,OLD.status,NEW.status,NEW.current_version,NEW.last_operation_id);
END;
CREATE TRIGGER documents_created AFTER INSERT ON case_documents BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.created_by,'create',json_array(NEW.case_id),'document',NEW.id,NEW.template_id,NEW.template_version,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER documents_updated AFTER UPDATE ON case_documents BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.updated_by,'update',json_array(NEW.case_id),'document',NEW.id,NEW.template_id,NEW.template_version,NEW.version,NEW.last_operation_id);
END;
CREATE TRIGGER cases_status_changed AFTER UPDATE ON cases WHEN NEW.status<>OLD.status BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,previous_status,new_status,resource_version,operation_id)
 VALUES(NEW.last_operation_id,NEW.organisation_id,NEW.last_actor_id,'status_change',json_array(NEW.id),'case',NEW.id,OLD.status,NEW.status,NEW.version,NEW.last_operation_id);
END;

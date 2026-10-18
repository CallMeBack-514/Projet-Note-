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

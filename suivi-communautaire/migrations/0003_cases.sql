CREATE TABLE clients (
 id TEXT PRIMARY KEY,
 organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
 email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '',
 creation_operation TEXT NOT NULL,
 UNIQUE(id,organisation_id)
);
CREATE TABLE cases (
 id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 client_id TEXT NOT NULL, service TEXT NOT NULL CHECK(length(trim(service)) BETWEEN 1 AND 160),
 owner_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Ouvert' CHECK(status='Ouvert'),
 opened_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 last_actor_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 last_session_id TEXT NOT NULL, last_operation_id TEXT NOT NULL UNIQUE,
 FOREIGN KEY(client_id,organisation_id) REFERENCES clients(id,organisation_id) ON DELETE RESTRICT,
 FOREIGN KEY(owner_id,organisation_id) REFERENCES profiles(user_id,organisation_id) ON DELETE RESTRICT
);
CREATE INDEX cases_owner ON cases(organisation_id,owner_id,opened_at,id);
CREATE INDEX cases_client ON cases(organisation_id,client_id);
CREATE INDEX clients_name ON clients(organisation_id,name);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY, organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 actor_id TEXT NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
 action TEXT NOT NULL CHECK(action IN ('create','read','transfer')),
 occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 case_ids TEXT NOT NULL CHECK(json_valid(case_ids)),
 previous_owner_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
 new_owner_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT
);
CREATE INDEX audit_org_time ON audit_events(organisation_id,occurred_at);
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
  AND (cl.creation_operation=NEW.last_operation_id OR EXISTS (
    SELECT 1 FROM cases c JOIN profiles p ON p.user_id=NEW.last_actor_id
    WHERE c.client_id=cl.id AND c.organisation_id=p.organisation_id AND (p.role='superviseur' OR c.owner_id=p.user_id)
  ))
 );
 SELECT RAISE(ABORT,'invalid_version') WHERE NEW.version<>1;
END;
CREATE TRIGGER cases_transfer_guard BEFORE UPDATE ON cases BEGIN
 SELECT RAISE(ABORT,'immutable_case') WHERE NEW.id<>OLD.id OR NEW.organisation_id<>OLD.organisation_id OR NEW.client_id<>OLD.client_id OR NEW.service<>OLD.service OR NEW.opened_at<>OLD.opened_at OR NEW.status<>OLD.status;
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
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT,'audit_immutable'); END;
CREATE TRIGGER profile_owner_role BEFORE UPDATE OF role ON profiles
WHEN NEW.role<>'intervenant' AND EXISTS(SELECT 1 FROM cases WHERE owner_id=OLD.user_id)
BEGIN SELECT RAISE(ABORT,'profile_owns_cases'); END;

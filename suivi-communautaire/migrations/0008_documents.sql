-- Modèles de documents versionnés (administrés par les superviseurs) et documents remplis.
CREATE TABLE document_templates (
 id TEXT PRIMARY KEY,
 organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','retired')),
 current_version INTEGER NOT NULL DEFAULT 1 CHECK(current_version>0),
 created_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 last_session_id TEXT NOT NULL,
 last_operation_id TEXT NOT NULL,
 UNIQUE(id,organisation_id)
);
CREATE INDEX templates_org ON document_templates(organisation_id,status,created_at);
CREATE TABLE document_template_versions (
 template_id TEXT NOT NULL,
 organisation_id TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 160),
 definition TEXT NOT NULL CHECK(json_valid(definition) AND json_type(definition)='array' AND json_array_length(definition) BETWEEN 1 AND 30),
 created_by TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 session_id TEXT NOT NULL,
 operation_id TEXT NOT NULL,
 PRIMARY KEY(template_id,version),
 UNIQUE(template_id,version,organisation_id),
 FOREIGN KEY(template_id,organisation_id) REFERENCES document_templates(id,organisation_id) ON DELETE RESTRICT
);
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

CREATE TRIGGER templates_guard BEFORE INSERT ON document_templates BEGIN
 SELECT RAISE(ABORT,'access_denied') WHERE NEW.current_version<>1 OR NEW.status<>'available' OR NEW.created_by<>NEW.updated_by OR NOT EXISTS (
  SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id
  WHERE p.user_id=NEW.created_by AND p.active=1 AND p.role='superviseur' AND p.organisation_id=NEW.organisation_id
  AND s.id=NEW.last_session_id AND s.expiresAt>unixepoch('subsec')*1000
 );
END;
CREATE TRIGGER templates_created AFTER INSERT ON document_templates BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.created_by,'create','[]','document_template',NEW.id,NEW.id,NEW.current_version,NULL,NEW.status,NEW.current_version,NEW.last_operation_id);
END;
CREATE TRIGGER template_versions_guard BEFORE INSERT ON document_template_versions BEGIN
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id
  WHERE p.user_id=NEW.created_by AND p.active=1 AND p.role='superviseur' AND p.organisation_id=NEW.organisation_id
  AND s.id=NEW.session_id AND s.expiresAt>unixepoch('subsec')*1000
 );
 SELECT RAISE(ABORT,'stale_template') WHERE NEW.version<>1 AND (
  NOT EXISTS(SELECT 1 FROM document_templates t WHERE t.id=NEW.template_id AND t.status='available' AND t.current_version+1=NEW.version)
 );
END;
CREATE TRIGGER template_versions_advance AFTER INSERT ON document_template_versions WHEN NEW.version>1 BEGIN
 UPDATE document_templates SET current_version=NEW.version,updated_by=NEW.created_by,updated_at=NEW.created_at,
  last_session_id=NEW.session_id,last_operation_id=NEW.operation_id WHERE id=NEW.template_id;
END;
CREATE TRIGGER template_versions_no_change BEFORE UPDATE ON document_template_versions BEGIN SELECT RAISE(ABORT,'version_immutable'); END;
CREATE TRIGGER template_versions_no_delete BEFORE DELETE ON document_template_versions BEGIN SELECT RAISE(ABORT,'version_immutable'); END;
CREATE TRIGGER templates_update_guard BEFORE UPDATE ON document_templates BEGIN
 SELECT RAISE(ABORT,'immutable_template') WHERE NEW.id<>OLD.id OR NEW.organisation_id<>OLD.organisation_id OR NEW.created_by<>OLD.created_by OR NEW.created_at<>OLD.created_at;
 SELECT RAISE(ABORT,'invalid_template_change') WHERE NEW.last_operation_id=OLD.last_operation_id
  OR NOT ((NEW.current_version=OLD.current_version+1 AND NEW.status=OLD.status AND OLD.status='available')
       OR (NEW.current_version=OLD.current_version AND OLD.status='available' AND NEW.status='retired'));
 SELECT RAISE(ABORT,'access_denied') WHERE NOT EXISTS (
  SELECT 1 FROM profiles p JOIN session s ON s.userId=p.user_id
  WHERE p.user_id=NEW.updated_by AND p.active=1 AND p.role='superviseur' AND p.organisation_id=OLD.organisation_id
  AND s.id=NEW.last_session_id AND s.expiresAt>unixepoch('subsec')*1000
 );
END;
CREATE TRIGGER templates_updated AFTER UPDATE ON document_templates BEGIN
 INSERT INTO audit_events(id,organisation_id,actor_id,action,case_ids,resource_type,resource_id,template_id,template_version,previous_state,new_state,resource_version,operation_id)
 VALUES(lower(hex(randomblob(16))),NEW.organisation_id,NEW.updated_by,'update','[]','document_template',NEW.id,NEW.id,NEW.current_version,OLD.status,NEW.status,NEW.current_version,NEW.last_operation_id);
END;
CREATE TRIGGER templates_no_delete BEFORE DELETE ON document_templates BEGIN SELECT RAISE(ABORT,'template_permanent'); END;

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

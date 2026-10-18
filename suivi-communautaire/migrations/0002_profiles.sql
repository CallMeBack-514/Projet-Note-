CREATE TABLE organisations (id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160));
CREATE TABLE profiles (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE RESTRICT,
  organisation_id TEXT NOT NULL REFERENCES organisations(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK(role IN ('intervenant','superviseur')),
  supervisor_id TEXT REFERENCES profiles(user_id) ON DELETE RESTRICT,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  UNIQUE(user_id, organisation_id),
  CHECK((role='intervenant' AND supervisor_id IS NOT NULL) OR (role='superviseur' AND supervisor_id IS NULL))
);
CREATE INDEX profiles_organisation ON profiles(organisation_id,role,active);
CREATE TRIGGER profile_valid_insert BEFORE INSERT ON profiles
WHEN NEW.role='intervenant'
BEGIN
  SELECT RAISE(ABORT,'invalid_supervisor') WHERE NOT EXISTS(
    SELECT 1 FROM profiles WHERE user_id=NEW.supervisor_id AND role='superviseur' AND organisation_id=NEW.organisation_id
  );
END;
CREATE TRIGGER profile_valid_update BEFORE UPDATE ON profiles
BEGIN
  SELECT RAISE(ABORT,'invalid_supervisor') WHERE NEW.role='intervenant' AND NOT EXISTS(
    SELECT 1 FROM profiles WHERE user_id=NEW.supervisor_id AND role='superviseur' AND organisation_id=NEW.organisation_id
  );
  SELECT RAISE(ABORT,'organisation_immutable') WHERE NEW.organisation_id<>OLD.organisation_id;
  SELECT RAISE(ABORT,'supervisor_has_team') WHERE NEW.role<>'superviseur' AND EXISTS(SELECT 1 FROM profiles WHERE supervisor_id=OLD.user_id);
END;

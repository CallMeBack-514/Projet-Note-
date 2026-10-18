-- Adresse et date de naissance de l'usager. Les dossiers existants gardent une valeur vide (« Non renseigné »).
-- La date de naissance est stockée au format ISO AAAA-MM-JJ ou vide; la validation métier est faite côté serveur.
ALTER TABLE clients ADD COLUMN address TEXT NOT NULL DEFAULT '' CHECK(length(address)<=300);
ALTER TABLE clients ADD COLUMN date_of_birth TEXT NOT NULL DEFAULT '' CHECK(date_of_birth='' OR date_of_birth GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]');

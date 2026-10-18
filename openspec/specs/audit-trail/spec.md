# audit-trail Specification

## Purpose
Conserver une trace attribuable des créations, des consultations et des transferts pour expliquer l'historique des accès et des responsabilités.

## Requirements

### Requirement: Événements attribuables et minimisés
Le système SHALL enregistrer l'organisme, l'acteur, l'action, la date et les identifiants de dossiers concernés pour toute création, consultation ou transfert réussi. Le transfert MUST aussi conserver les identifiants de l'ancien et du nouveau responsable. Le journal MUST NOT copier les noms, coordonnées, mots de passe, cookies ou contenus des dossiers.

#### Scenario: Création réussie
- **WHEN** un dossier est créé
- **THEN** un événement de création permet d'identifier l'acteur, l'organisme, le dossier, la date et son responsable initial.

#### Scenario: Consultation d'une liste ou d'une fiche
- **WHEN** une liste contenant des dossiers ou une fiche est retournée à un utilisateur
- **THEN** un événement identifie les dossiers effectivement retournés et l'acteur qui les consulte
- **AND** une simple vérification d'accès sans données nominatives ne produit pas un événement de consultation.

#### Scenario: Transfert réussi
- **WHEN** un dossier est transféré de A à B par S
- **THEN** un événement indique A comme ancien responsable, B comme nouveau responsable et S comme auteur du transfert.

### Requirement: Cohérence avec l'opération
Le système SHALL enregistrer les événements de création et transfert avec leur opération de façon indivisible. Une consultation MUST échouer sans données nominatives si sa trace ne peut pas être enregistrée. Un refus d'accès MUST NOT être enregistré comme une consultation réussie.

#### Scenario: Échec de création
- **WHEN** la création de l'usager, du dossier ou de son événement échoue
- **THEN** aucune de ces créations partielles ne persiste.

#### Scenario: Journal indisponible à la lecture
- **WHEN** l'événement de consultation ne peut pas être enregistré
- **THEN** les données du dossier ne sont pas retournées et un message d'indisponibilité est affiché.

#### Scenario: Tentative interdite
- **WHEN** un utilisateur tente de consulter un dossier non autorisé
- **THEN** aucun événement de consultation réussie n'est créé.

### Requirement: Journal protégé des modifications métier
Le système SHALL conserver les événements existants lors des transferts. Les utilisateurs métier MUST NOT pouvoir modifier ou supprimer les événements, ni accéder par le journal à des dossiers non autorisés.

#### Scenario: Plusieurs transferts successifs
- **WHEN** un dossier passe de A à B puis de B à C
- **THEN** les deux événements distincts sont conservés dans l'ordre avec leurs auteurs et destinataires.

#### Scenario: Modification directe d'un événement
- **WHEN** un intervenant ou superviseur tente de modifier ou supprimer un événement par l'application
- **THEN** aucune opération de ce type n'est disponible ou acceptée.

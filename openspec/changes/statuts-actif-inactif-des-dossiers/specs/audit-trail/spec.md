# Audit des changements de statut

## ADDED Requirements

### Requirement: Transition de statut attribuable
Le système SHALL enregistrer chaque transition réussie avec l’organisme, le dossier, l’acteur, la date réelle, l’ancien statut et le nouveau statut. L’événement SHALL être distinguable des créations, consultations, modifications de contenu et transferts. Il MUST NOT contenir de nom, de coordonnées, de motif libre ou de contenu du dossier.

#### Scenario: Inactivation puis réactivation
- **WHEN** A rend un dossier Inactif puis S le réactive
- **THEN** deux événements distincts identifient leurs auteurs et les transitions Actif vers Inactif puis Inactif vers Actif.

#### Scenario: Transition après transfert
- **WHEN** le nouveau responsable change le statut après un transfert
- **THEN** l’événement de statut identifie ce nouveau responsable comme acteur sans remplacer ni modifier l’événement de transfert.

### Requirement: Atomicité de la transition et de son audit
Le changement de statut et son événement SHALL être enregistrés de manière indivisible. Une erreur d’audit MUST laisser le statut et la version précédents intacts. Les refus d’accès, conflits, statuts invalides et demandes sans changement MUST NOT produire un événement de transition réussie.

#### Scenario: Audit indisponible
- **WHEN** l’enregistrement de l’événement de statut échoue
- **THEN** le statut et la version restent inchangés et l’utilisateur reçoit une erreur sans confirmation de transition.

#### Scenario: Conflit ou refus
- **WHEN** une transition est refusée pour concurrence ou absence de droits courants
- **THEN** aucun événement de transition réussie n’est enregistré.

#### Scenario: Demande sans changement
- **WHEN** un utilisateur autorisé soumet le statut et la version déjà courants
- **THEN** aucun événement de transition n’est créé.

### Requirement: Conservation des événements de statut
Les événements de statut SHALL bénéficier des protections du journal contre les modifications et suppressions métier. Ils SHALL rester conservés lors d’une réactivation, d’une modification du contenu ou d’un transfert. Leur existence MUST NOT accorder de droits sur le dossier à un ancien responsable.

#### Scenario: Transfert d'un dossier Inactif
- **WHEN** un dossier Inactif est transféré de A à B
- **THEN** les événements de statut restent présents
- **AND** A perd l’accès au dossier et à son historique tandis que B et les superviseurs autorisés le conservent.

#### Scenario: Modification d'un événement
- **WHEN** un utilisateur métier tente de modifier ou supprimer un événement de statut
- **THEN** l’opération est refusée et l’événement demeure inchangé.

# Organisation et accès

## Purpose

Identifier les utilisateurs et appliquer les rôles et les frontières entre organismes à chaque accès aux données des usagers.

## ADDED Requirements

### Requirement: Session authentifiée et compte actif
Le système SHALL exiger une session authentifiée et un compte actif pour accéder aux dossiers. La déconnexion et la désactivation du compte MUST empêcher les accès ultérieurs, même avec une session précédemment valide.

#### Scenario: Accès sans connexion
- **WHEN** une personne non authentifiée ouvre une liste ou un dossier
- **THEN** le système demande une connexion sans retourner de données nominatives.

#### Scenario: Compte désactivé ou session terminée
- **WHEN** une session est utilisée après déconnexion ou désactivation du compte
- **THEN** aucune lecture ni mutation de dossier n'est autorisée.

### Requirement: Rôles et rattachement hiérarchique
Le système SHALL représenter les rôles Intervenant et Superviseur. Chaque intervenant MUST avoir un superviseur du même organisme. Un superviseur SHALL pouvoir encadrer plusieurs intervenants. Un indicateur d'administration technique MUST NOT accorder à lui seul des droits sur les dossiers.

#### Scenario: Plusieurs intervenants pour un superviseur
- **WHEN** deux intervenants sont rattachés au même superviseur
- **THEN** les deux rattachements sont acceptés sans créer de droits croisés sur leurs dossiers.

#### Scenario: Rattachement invalide
- **WHEN** un intervenant est créé sans superviseur ou rattaché à un intervenant ou à un superviseur d'un autre organisme
- **THEN** l'opération est refusée sans enregistrer un rattachement invalide.

#### Scenario: Compte technique sans rôle métier
- **WHEN** un compte doté d'un statut d'administration technique mais sans rôle métier demande un dossier
- **THEN** l'accès est refusé.

### Requirement: Isolation de l'organisme
Le système SHALL déterminer l'organisme depuis le compte authentifié et limiter les lectures, créations, sélections de destinataires et transferts à cet organisme. Les paramètres envoyés par le client MUST NOT permettre de changer ce périmètre.

#### Scenario: Organisme falsifié
- **WHEN** un utilisateur soumet l'identifiant d'un autre organisme ou un identifiant de dossier qui lui appartient
- **THEN** le système ne divulgue aucune donnée de cet organisme et ne crée ni ne modifie de ressource pour lui.

### Requirement: Périmètre du rôle Intervenant
Le système SHALL autoriser un intervenant à consulter uniquement les dossiers dont il est le responsable actuel. Les listes, recherches, totaux et accès directs MUST respecter cette règle sans révéler les dossiers des collègues.

#### Scenario: Deux collègues dans la même équipe
- **WHEN** un intervenant consulte sa liste ou recherche un usager suivi seulement par un collègue
- **THEN** aucun dossier de ce collègue ni aucune information sur son usager n'est retourné.

### Requirement: Périmètre du rôle Superviseur
Le système SHALL autoriser un superviseur à consulter et transférer tous les dossiers de son organisme, y compris ceux des intervenants rattachés à un autre superviseur, sans accès aux autres organismes.

#### Scenario: Visibilité au-delà de son équipe
- **WHEN** un superviseur consulte un dossier d'une autre équipe de son organisme
- **THEN** le dossier est accessible avec la possibilité de le transférer.

#### Scenario: Superviseur d'un autre organisme
- **WHEN** un superviseur utilise un lien direct vers un dossier d'un autre organisme
- **THEN** le système retourne la même réponse non nominative que pour un dossier inexistant.

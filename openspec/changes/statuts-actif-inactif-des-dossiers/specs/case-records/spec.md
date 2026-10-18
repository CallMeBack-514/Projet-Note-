# Statuts du dossier-personne

## MODIFIED Requirements

### Requirement: Création complète et persistante
Le système SHALL permettre d’ouvrir un dossier pour une nouvelle personne. Son nom d’affichage MUST être renseigné; les coordonnées sont facultatives. Le dossier SHALL recevoir un identifiant interne, une date d’ouverture et le statut Actif. Une personne déjà enregistrée MUST être suivie dans son dossier existant.

#### Scenario: Création par un intervenant
- **WHEN** un intervenant soumet une nouvelle personne avec un nom valide
- **THEN** la personne et son dossier Actif sont enregistrés dans son organisme, avec cet intervenant comme responsable
- **AND** le dossier apparaît dans sa liste après une déconnexion et une reconnexion.

#### Scenario: Création par un superviseur
- **WHEN** un superviseur ouvre un dossier pour une nouvelle personne en choisissant un intervenant actif de son organisme
- **THEN** le dossier Actif est attribué à cet intervenant et accessible au superviseur.

#### Scenario: Formulaire incomplet ou échec d'enregistrement
- **WHEN** le nom manque, le destinataire est invalide ou une erreur empêche la création complète
- **THEN** un message exploitable est affiché et aucune personne orpheline ni aucun dossier partiel n’est enregistré.

#### Scenario: Réutilisation d'un usager accessible
- **WHEN** un utilisateur sélectionne une personne à laquelle il accède par son dossier
- **THEN** il est dirigé vers ce dossier pour ajouter une note ou un document, sans dupliquer la personne ni son dossier.

#### Scenario: Identifiant d'usager non autorisé
- **WHEN** un intervenant soumet l’identifiant d’une personne dont il n’est pas responsable
- **THEN** la demande d’accès ou d’ajout de contenu est refusée sans divulguer son existence ou ses coordonnées.

## ADDED Requirements

### Requirement: Cycle Actif et Inactif
Le système SHALL accepter exclusivement les statuts Actif et Inactif et permettre leur transition dans les deux sens. L’inactivation SHALL conserver l’identité du dossier, son contenu, son responsable, sa date d’ouverture et son historique. Elle MUST NOT supprimer, verrouiller le contenu ou modifier les droits. La réactivation SHALL reprendre le même dossier.

#### Scenario: Inactivation avec contenu
- **WHEN** un utilisateur autorisé passe un dossier Actif à Inactif
- **THEN** le dossier est présenté comme Inactif avec les mêmes contenus, responsable et droits
- **AND** les opérations de consultation, d’ajout, de modification de contenu et de transfert déjà permises restent disponibles.

#### Scenario: Reprise d'accompagnement
- **WHEN** un utilisateur autorisé réactive un dossier Inactif
- **THEN** ce même dossier devient Actif sans nouveau dossier ni modification de sa date d’ouverture ou de son attribution.

#### Scenario: Statut non reconnu
- **WHEN** une demande propose un statut autre que Actif ou Inactif
- **THEN** la demande est refusée avec une erreur exploitable sans mutation ni événement de transition réussie.

### Requirement: Autorisation courante des transitions
Le système SHALL permettre au responsable courant et à tout superviseur du même organisme de changer le statut. Il MUST vérifier la session, le compte actif, l’organisme et le responsable au moment de la mutation. Un statut Inactif MUST NOT donner un accès supplémentaire ni maintenir l’accès d’un ancien responsable.

#### Scenario: Superviseur d'une autre équipe
- **WHEN** un superviseur change le statut d’un dossier d’une autre équipe de son organisme
- **THEN** la transition est autorisée sans modifier le responsable.

#### Scenario: Ancien responsable après transfert
- **WHEN** l’ancien responsable soumet un changement de statut après un transfert validé
- **THEN** la mutation est refusée comme pour un dossier inexistant, sans révéler le statut ou la nouvelle attribution.

#### Scenario: Compte ou périmètre interdit
- **WHEN** un collègue non responsable, un utilisateur d’un autre organisme, un compte désactivé ou une session terminée tente une transition
- **THEN** aucun statut n’est modifié et aucune donnée de dossier non autorisé n’est retournée.

### Requirement: Concurrence des transitions et transferts
Le système SHALL appliquer une transition seulement à la version courante du statut et de l’attribution. Deux mutations concurrentes de ces propriétés depuis la même version MUST produire au plus un succès. Une demande avec la version courante et un statut inchangé SHALL être sans effet ni événement de transition. Un conflit SHALL demander une actualisation à l’utilisateur encore autorisé.

#### Scenario: Deux transitions concurrentes
- **WHEN** deux utilisateurs tentent de rendre Inactif le même dossier Actif depuis la même version
- **THEN** une seule transition réussit et l’autre demande reçoit un conflit.

#### Scenario: Transfert concurrent
- **WHEN** un transfert et une transition sont soumis depuis la même version
- **THEN** une seule mutation réussit
- **AND** l’autre demande est refusée pour conflit si l’acteur conserve l’accès, sinon comme un dossier inaccessible.

#### Scenario: Statut déjà courant
- **WHEN** un acteur autorisé demande Actif pour un dossier Actif avec sa version courante
- **THEN** la réponse confirme l’état courant sans incrément de version ni événement de transition.

#### Scenario: Répétition obsolète
- **WHEN** une demande répétée contient une ancienne version, même si son statut cible est déjà atteint
- **THEN** elle reçoit un conflit sans nouvel événement de transition.

### Requirement: Présentation et filtrage des statuts
Le système SHALL afficher le statut réel dans la liste et la fiche et proposer les filtres Tous, Actifs et Inactifs. Tous SHALL être le filtre initial. La recherche, les pages et les totaux MUST combiner le filtre et les droits courants. Les actions et erreurs de statut SHALL être en français, utilisables au clavier et à 375 pixels de largeur sans défilement horizontal.

#### Scenario: Liste initiale
- **WHEN** un utilisateur ouvre la liste sans filtre explicite
- **THEN** les dossiers Actifs et Inactifs auxquels il a accès sont proposés avec leur statut réel.

#### Scenario: Recherche filtrée
- **WHEN** un utilisateur recherche un nom avec le filtre Inactifs et parcourt les pages
- **THEN** les résultats et le total concernent uniquement les dossiers Inactifs autorisés correspondant à la recherche
- **AND** le filtre et la recherche sont conservés lors de la pagination.

#### Scenario: Filtre sans résultat
- **WHEN** aucun dossier accessible ne correspond au filtre
- **THEN** un état vide permet de changer le filtre sans révéler de compteur hors périmètre.

#### Scenario: Changement sur téléphone
- **WHEN** un utilisateur change le statut depuis la fiche à 375 pixels de largeur ou au clavier
- **THEN** l’action, la confirmation du nouvel état et les erreurs sont accessibles et lisibles.

### Requirement: Migration du statut Ouvert
La reprise SHALL convertir chaque ancien statut Ouvert en Actif sans changer l’identité, l’attribution, le contenu ou la date d’ouverture du dossier. Elle MUST conserver les événements existants sans inventer de transition métier attribuée à un utilisateur. Toute valeur inattendue SHALL bloquer la reprise concernée sans conversion implicite.

#### Scenario: Dossier existant Ouvert
- **WHEN** un dossier Ouvert est repris après la migration au dossier-personne
- **THEN** il devient Actif avec les mêmes identifiants, responsable, contenu et date d’ouverture
- **AND** aucun événement de transition humaine n’est fabriqué pour cette conversion.

#### Scenario: Valeur héritée inattendue
- **WHEN** le contrôle préalable découvre un statut non prévu
- **THEN** la migration est arrêtée avant activation du nouveau schéma et la valeur doit être résolue explicitement.

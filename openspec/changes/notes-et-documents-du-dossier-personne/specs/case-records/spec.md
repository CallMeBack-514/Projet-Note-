# Dossier-personne

## MODIFIED Requirements

### Requirement: Personne distincte de ses dossiers
Le système SHALL présenter un dossier de suivi unique par personne enregistrée dans un organisme. Les différentes interactions SHALL être consignées sous forme de notes et de documents dans ce dossier. Une personne enregistrée dans un autre organisme MUST rester hors de ce périmètre; aucun rapprochement interorganisme automatique n’est effectué.

#### Scenario: Deux services pour une personne
- **WHEN** une personne déjà enregistrée bénéficie de deux services dans le même organisme
- **THEN** les interactions sont consignées dans son dossier existant avec leur nature et leurs documents
- **AND** aucun dossier supplémentaire n’est créé pour représenter le second service.

### Requirement: Création complète et persistante
Le système SHALL permettre d’ouvrir un dossier pour une nouvelle personne. Son nom d’affichage MUST être renseigné; les coordonnées sont facultatives. Le dossier SHALL recevoir un identifiant interne, une date d’ouverture et le statut Ouvert. Une personne déjà enregistrée MUST être suivie dans son dossier existant.

#### Scenario: Création par un intervenant
- **WHEN** un intervenant soumet une nouvelle personne avec un nom valide
- **THEN** la personne et son dossier sont enregistrés dans son organisme, avec cet intervenant comme responsable
- **AND** le dossier apparaît dans sa liste après une déconnexion et une reconnexion.

#### Scenario: Création par un superviseur
- **WHEN** un superviseur ouvre un dossier pour une nouvelle personne en choisissant un intervenant actif de son organisme
- **THEN** le dossier est attribué à cet intervenant et accessible au superviseur.

#### Scenario: Formulaire incomplet ou échec d'enregistrement
- **WHEN** le nom manque, le destinataire est invalide ou une erreur empêche la création complète
- **THEN** un message exploitable est affiché et aucune personne orpheline ni aucun dossier partiel n’est enregistré.

#### Scenario: Réutilisation d'un usager accessible
- **WHEN** un utilisateur sélectionne une personne à laquelle il accède par son dossier
- **THEN** il est dirigé vers ce dossier pour ajouter une note ou un document, sans dupliquer la personne ni son dossier.

#### Scenario: Identifiant d'usager non autorisé
- **WHEN** un intervenant soumet l’identifiant d’une personne dont il n’est pas responsable
- **THEN** la demande d’accès ou d’ajout de contenu est refusée sans divulguer son existence ou ses coordonnées.

### Requirement: Liste et détail limités aux autorisations
Le système SHALL proposer une liste de dossiers-personnes recherchable par nom ou identifiant et une fiche contenant l’identité, les coordonnées, le statut, la date d’ouverture, le responsable, les notes et les documents. Les résultats, compteurs et contenus MUST être limités aux permissions courantes. La fiche SHALL proposer Ajouter une note et Ajouter un document.

#### Scenario: Liste vide
- **WHEN** un intervenant n’a aucun dossier attribué
- **THEN** un état vide propose d’ouvrir le dossier d’une nouvelle personne sans afficher de données de collègues.

#### Scenario: Lien direct interdit
- **WHEN** un utilisateur ouvre le détail d’un dossier non autorisé
- **THEN** la réponse est identique à celle d’un dossier inexistant et ne contient aucune donnée nominative.

#### Scenario: Continuer le suivi d'une personne
- **WHEN** un utilisateur autorisé ouvre une fiche
- **THEN** il peut ajouter une note ou un document et parcourir le contenu existant
- **AND** aucune action de création d’un autre dossier pour la même personne n’est proposée ou acceptée par une ancienne route.

### Requirement: Interface française utilisable sur téléphone
Le système SHALL proposer les écrans de connexion, liste, création, détail et transfert ainsi que les notes et documents en français, avec champs étiquetés, erreurs explicites et navigation au clavier. Le parcours MUST être utilisable à 375 pixels de largeur sans défilement horizontal de la page.

#### Scenario: Création sur téléphone
- **WHEN** un intervenant utilise le parcours à 375 pixels de largeur
- **THEN** les champs, erreurs et actions restent lisibles et accessibles, et le dossier d’une nouvelle personne peut être créé.

#### Scenario: Saisie d'une interaction sur téléphone
- **WHEN** un intervenant ajoute une note ou remplit un document à 375 pixels de largeur
- **THEN** il peut terminer la saisie et corriger les erreurs avec des champs et actions accessibles.

## ADDED Requirements

### Requirement: Reprise contrôlée des dossiers existants
Le passage au dossier-personne SHALL conserver les renseignements et la provenance des dossiers existants. Les regroupements ambigus ou impliquant des responsables distincts MUST être signalés avant activation de la reprise. Ils MUST NOT être fusionnés, supprimés ou attribués automatiquement sans une décision explicite de rapprochement et de responsabilité.

#### Scenario: Une personne avec un seul dossier
- **WHEN** une personne enregistrée possède un seul dossier existant
- **THEN** la reprise préserve son identité, ses coordonnées, son responsable, sa date d’ouverture et la traçabilité de son dossier.

#### Scenario: Plusieurs responsables pour une personne
- **WHEN** une personne enregistrée possède plusieurs dossiers confiés à des responsables différents
- **THEN** la reprise de ce regroupement est bloquée et un conflit est présenté à l’opérateur autorisé
- **AND** aucun intervenant ne reçoit automatiquement l’accès au contenu auparavant attribué à un collègue.

#### Scenario: Reprise interrompue
- **WHEN** une erreur empêche d’appliquer entièrement une décision de rapprochement
- **THEN** les données concernées restent dans un état cohérent sans perte de contenu ni attribution partielle.

#### Scenario: Personnes homonymes
- **WHEN** deux personnes enregistrées portent le même nom
- **THEN** elles ne sont pas fusionnées sur ce seul critère et leurs dossiers conservent leurs permissions distinctes.

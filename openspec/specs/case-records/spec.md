# case-records Specification

## Purpose
Permettre aux utilisateurs autorisés de créer et retrouver les dossiers d'accompagnement, en distinguant la personne des services qu'elle reçoit.

## Requirements

### Requirement: Personne distincte de ses dossiers
Le système SHALL distinguer l'usager du dossier et permettre plusieurs dossiers pour une personne dans un même organisme. L'accès à un dossier MUST NOT donner accès aux autres dossiers de cette personne.

#### Scenario: Deux services pour une personne
- **WHEN** une personne possède deux dossiers attribués à deux intervenants différents
- **THEN** chaque intervenant voit les coordonnées de la personne et son seul dossier autorisé, sans indication de l'autre dossier.

### Requirement: Création complète et persistante
Le système SHALL créer ensemble un usager et son premier dossier, ou créer un dossier pour un usager déjà accessible. Un nom d'affichage et un service MUST être renseignés; les coordonnées sont facultatives. Le dossier SHALL recevoir un identifiant interne, une date d'ouverture et le statut Ouvert.

#### Scenario: Création par un intervenant
- **WHEN** un intervenant soumet un nom et un service valides
- **THEN** l'usager et le dossier sont enregistrés dans son organisme, avec cet intervenant comme responsable
- **AND** le dossier apparaît dans sa liste après une déconnexion et une reconnexion.

#### Scenario: Création par un superviseur
- **WHEN** un superviseur crée un dossier en choisissant un intervenant actif de son organisme
- **THEN** le dossier est attribué à cet intervenant et accessible au superviseur.

#### Scenario: Formulaire incomplet ou échec d'enregistrement
- **WHEN** un champ obligatoire manque, le destinataire est invalide ou une erreur empêche la création complète
- **THEN** un message exploitable est affiché et aucun usager orphelin ni dossier partiel n'est enregistré.

#### Scenario: Réutilisation d'un usager accessible
- **WHEN** un utilisateur sélectionne un usager auquel il accède par au moins un dossier autorisé
- **THEN** le nouveau dossier référence cet usager sans dupliquer sa fiche.

#### Scenario: Identifiant d'usager non autorisé
- **WHEN** un intervenant soumet l'identifiant d'un usager dont il ne possède aucun dossier
- **THEN** la création est refusée sans divulguer l'existence ou les coordonnées de cet usager.

### Requirement: Liste et détail limités aux autorisations
Le système SHALL proposer une liste recherchable par nom ou identifiant de dossier, et un détail contenant les informations de l'usager, le service, le statut, la date d'ouverture et le responsable. Les résultats et leur nombre MUST être calculés dans le périmètre autorisé.

#### Scenario: Liste vide
- **WHEN** un intervenant n'a aucun dossier attribué
- **THEN** un état vide propose de créer un dossier sans afficher de données de collègues.

#### Scenario: Lien direct interdit
- **WHEN** un utilisateur ouvre le détail d'un dossier non autorisé
- **THEN** la réponse est identique à celle d'un dossier inexistant et ne contient aucune donnée nominative.

### Requirement: Interface française utilisable sur téléphone
Le système SHALL proposer les écrans de connexion, liste, création, détail et transfert en français, avec champs étiquetés, erreurs explicites et navigation au clavier. Le parcours MUST être utilisable à 375 pixels de largeur sans défilement horizontal de la page.

#### Scenario: Création sur téléphone
- **WHEN** un intervenant utilise le parcours à 375 pixels de largeur
- **THEN** les champs, erreurs et actions restent lisibles et accessibles, et le dossier peut être créé.

### Requirement: Données affichées après changement d'accès
Le système SHALL revérifier les droits à chaque requête. Une vue ouverte MUST masquer les informations révoquées au prochain contrôle, au plus tard dix secondes après un transfert dans un onglet actif avec réseau disponible, et revérifier au retour au premier plan. Les pages sensibles MUST empêcher leur stockage dans le cache HTTP.

#### Scenario: Transfert pendant la consultation
- **WHEN** un superviseur transfère un dossier qu'un intervenant consulte
- **THEN** les requêtes suivantes de cet intervenant sont refusées immédiatement après validation du transfert
- **AND** la vue masque les informations et explique que le dossier n'est plus accessible dans le délai de contrôle.

#### Scenario: Contrôle impossible
- **WHEN** la vérification d'accès échoue à cause du réseau ou d'une erreur serveur
- **THEN** la vue masque les informations jusqu'à une vérification réussie et signale que l'accès ne peut pas être vérifié.

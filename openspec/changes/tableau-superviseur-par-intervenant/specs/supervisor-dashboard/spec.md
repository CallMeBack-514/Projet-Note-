# Tableau de supervision

## Purpose

Permettre au superviseur de retrouver les dossiers-personnes attribués à chaque intervenant de son organisme et d'en consulter la répartition courante sans élargir les permissions.

## ADDED Requirements

### Requirement: Tableau réservé aux superviseurs de l'organisme
Le système SHALL réserver le tableau et ses lectures au superviseur authentifié dont le compte est actif. Les données et agrégats SHALL être limités à son organisme courant, y compris les autres équipes. Les paramètres client MUST NOT élargir ce périmètre ni donner accès au tableau à un intervenant.

#### Scenario: Toutes les équipes du même organisme
- **WHEN** un superviseur ouvre le tableau
- **THEN** il peut consulter les attributions des intervenants de toutes les équipes de son organisme, sans données des autres organismes.

#### Scenario: Accès direct interdit
- **WHEN** un intervenant ou un compte technique sans rôle Superviseur appelle directement une lecture du tableau
- **THEN** aucune identité de collègue, information de dossier ou agrégat de supervision n'est retourné.

#### Scenario: Intervenant d'un autre organisme
- **WHEN** un superviseur sélectionne par un paramètre falsifié un intervenant d'un autre organisme
- **THEN** la réponse est identique à celle d'un intervenant inexistant, sans donnée nominative ni compteur le concernant.

### Requirement: Répertoire des intervenants et attributions
Le système SHALL présenter les intervenants de l'organisme, y compris ceux sans dossier et les comptes désactivés, avec leur nombre de dossiers correspondant aux filtres. La sélection d'un intervenant SHALL afficher le nom des personnes, l'identifiant et le statut de leurs dossiers, avec un lien vers le détail autorisé. L'état du compte SHALL être distingué du statut des dossiers.

#### Scenario: Intervenant sans dossier
- **WHEN** un intervenant n'a aucun dossier correspondant aux filtres
- **THEN** il apparaît avec zéro et sa sélection présente un état vide sans supprimer sa ligne du répertoire.

#### Scenario: Compte désactivé responsable
- **WHEN** le responsable de dossiers Actifs et Inactifs est désactivé
- **THEN** le superviseur retrouve ces dossiers sous ce responsable et voit le compte signalé comme désactivé
- **AND** le lien vers le dossier permet d'utiliser le transfert existant vers un intervenant admissible.

### Requirement: Filtres et compteurs cohérents
Le système SHALL afficher les deux statuts Actif et Inactif par défaut et permettre de filtrer par statut et de rechercher une personne par nom ou identifiant de dossier. Les nombres par intervenant et par statut SHALL compter les dossiers-personnes correspondant aux mêmes permissions et filtres que le détail, sur toutes ses pages. Ils MUST NOT constituer un score de performance ou un indicateur clinique.

#### Scenario: Filtres combinés
- **WHEN** le superviseur recherche un nom et sélectionne le statut Inactif
- **THEN** le détail contient seulement les dossiers Inactifs correspondants du responsable sélectionné
- **AND** les compteurs reflètent ce même ensemble, avec zéro dossier Actif et un total égal au nombre de dossiers Inactifs correspondants.

#### Scenario: Statut et permissions distincts
- **WHEN** un dossier passe à Inactif sans changer de responsable
- **THEN** il reste visible avec le filtre Tous, est compté comme Inactif et conserve les mêmes droits de consultation et d'édition dans sa fiche.

### Requirement: Parcours paginé et stable
Le système SHALL paginer séparément le répertoire et les dossiers de l'intervenant sélectionné, avec au plus 25 entrées par page dans chaque liste. L'ordre SHALL être déterministe et les filtres conservés entre les pages. Un changement de filtre SHALL revenir à la première page des dossiers. Une page vide MUST NOT masquer un total non nul ni être présentée comme l'absence de dossiers dans l'organisme.

#### Scenario: Plus de vingt-cinq dossiers
- **WHEN** un intervenant possède 26 dossiers correspondant aux filtres et aucune attribution ne change pendant la navigation
- **THEN** la première page contient 25 dossiers, la seconde un dossier distinct et chaque page indique un total de 26.

#### Scenario: Page devenue vide
- **WHEN** un transfert retire le dernier dossier d'une page encore demandée
- **THEN** la vue indique que cette page est vide et permet de revenir à la première page en conservant les filtres, sans inventer un total nul.

### Requirement: Actualisation et révocation des vues ouvertes
Le système SHALL vérifier la session, le rôle et l'organisme courants à chaque lecture, y compris pour les compteurs et un tableau vide. Une vue active connectée SHALL refléter un transfert ou changement de statut en dix secondes au plus. Elle MUST masquer toutes ses données sensibles si le contrôle échoue, revérifier au retour au premier plan et empêcher une réponse ancienne de restaurer un état révoqué.

#### Scenario: Transfert entre intervenants
- **WHEN** un dossier passe de A à B pendant qu'un superviseur consulte le tableau
- **THEN** les requêtes suivantes le comptent et le listent seulement sous B
- **AND** la vue ouverte actualise le détail et les compteurs dans le délai prévu, bien que le superviseur conserve l'accès au dossier.

#### Scenario: Révocation du rôle sur un tableau sans dossier
- **WHEN** la session expire, le compte est désactivé ou le rôle Superviseur est retiré alors qu'aucun dossier n'est affiché
- **THEN** les lectures suivantes sont refusées et la vue masque aussi le répertoire et ses agrégats au prochain contrôle, en dix secondes au plus dans un onglet actif connecté.

#### Scenario: Réseau indisponible ou réponse retardée
- **WHEN** un contrôle échoue ou une réponse ancienne arrive après un nouveau filtre ou une révocation
- **THEN** la vue masque les informations non vérifiées et ignore la réponse ancienne
- **AND** seule une nouvelle vérification réussie permet d'afficher une vue actualisée.

### Requirement: Consultation minimisée et traçable
Le système SHALL journaliser les identifiants des seuls dossiers effectivement retournés dans le détail paginé avant de l'envoyer. Un échec d'audit MUST empêcher l'envoi de données de dossiers. Les agrégats seuls et les contrôles de fraîcheur sans données nominatives MUST NOT produire un événement contenant tous les dossiers comptés. Les réponses SHALL empêcher le cache HTTP sensible.

#### Scenario: Audit d'une page
- **WHEN** une page de 25 dossiers est retournée alors que le compteur vaut 200
- **THEN** la consultation identifie uniquement ces 25 dossiers, sans noms, recherche saisie ni contenu du dossier.

#### Scenario: Échec de journalisation
- **WHEN** la trace du détail demandé ne peut pas être enregistrée
- **THEN** aucune donnée de ce détail n'est retournée et un message d'indisponibilité est présenté.

#### Scenario: Vérification sans changement
- **WHEN** le contrôle d'une vue ouverte confirme que les données n'ont pas changé sans retourner de données nominatives
- **THEN** aucun événement de consultation de dossier n'est créé.

### Requirement: Consultation accessible en français
Le tableau SHALL être utilisable en français, au clavier et à 375 pixels de largeur sans défilement horizontal de la page. Les filtres SHALL être étiquetés, les liens de dossier explicites et les états vides, erreurs et mises à jour compréhensibles sans dépendre seulement d'une couleur.

#### Scenario: Consultation sur téléphone
- **WHEN** un superviseur sélectionne un intervenant, filtre ses dossiers puis ouvre une fiche à 375 pixels de largeur
- **THEN** les contrôles et résultats restent lisibles et accessibles, sans défilement horizontal de la page.

# Spec Delta

## ADDED Requirements

### Requirement: Permission de consultation du journal
Le système SHALL réserver la consultation du journal aux superviseurs actifs disposant d’une session valide, dans leur organisme courant. Cette permission MUST être vérifiée à chaque requête, indépendamment de l’affichage du lien. Une administration technique ou la responsabilité d’un dossier MUST NOT suffire à l’obtenir.

#### Scenario: Superviseur de plusieurs équipes
- **WHEN** un superviseur consulte le journal
- **THEN** il peut examiner les événements des différentes équipes de son organisme sans accès aux événements des autres organismes.

#### Scenario: Intervenant ou administrateur technique
- **WHEN** un intervenant ou un compte uniquement technique demande le journal directement
- **THEN** aucune trace, identité, sélection d’acteur ni total du journal ne lui est retourné.

#### Scenario: Permission révoquée
- **WHEN** le compte est désactivé, sa session termine ou son rôle cesse d’être Superviseur
- **THEN** toute requête suivante au journal est refusée
- **AND** l’écran ouvert masque ses données au prochain contrôle, au plus tard dix secondes dans un onglet actif avec réseau disponible, et vérifie de nouveau au retour au premier plan.

### Requirement: Recherche du journal dans le périmètre autorisé
Le système SHALL permettre de combiner des filtres par dossier, acteur, période et action, avec une pagination stable du plus récent au plus ancien. Les résultats, filtres proposés et indicateurs de pagination MUST rester dans l’organisme autorisé. Les identifiants interdits et inexistants MUST produire le même résultat non révélateur.

#### Scenario: Consultation filtrée
- **WHEN** un superviseur choisit un acteur, un dossier et une période valides
- **THEN** seuls les événements correspondant à tous les filtres sont affichés avec leur date, action, référence d’acteur et références de ressources autorisées.

#### Scenario: Identifiant extérieur ou inexistant
- **WHEN** un filtre contient un dossier ou un acteur d’un autre organisme, ou inexistant
- **THEN** le résultat est vide avec le même message, sans confirmer l’existence de cet identifiant.

#### Scenario: Horodatages identiques
- **WHEN** plusieurs événements ont le même horodatage et nécessitent plusieurs pages
- **THEN** leur ordre reste déterministe et aucun événement du parcours figé n’est répété ou omis du fait de cet égalité.

#### Scenario: Filtre invalide
- **WHEN** une période inversée, une action inconnue ou un curseur invalide est soumis
- **THEN** une erreur de filtre explicite est affichée sans résultat ni élargissement silencieux de la recherche.

### Requirement: Consultation du journal elle-même traçable
Le système SHALL enregistrer l’acteur, l’organisme, l’horodatage et les références des événements effectivement retournés lors d’une consultation du journal, même vide. Cette trace MUST être distincte d’une lecture de dossier et ne contenir aucun contenu métier ni recherche libre. Si elle échoue, aucune donnée du journal MUST être retournée.

#### Scenario: Page servie
- **WHEN** une page du journal est retournée
- **THEN** une seule trace de consultation du journal référence cette page effectivement servie
- **AND** la nouvelle trace ne s’ajoute pas récursivement à la page en cours.

#### Scenario: Audit de lecture indisponible
- **WHEN** la trace de consultation du journal ne peut pas être enregistrée
- **THEN** une indisponibilité est retournée sans événement, acteur, référence de dossier ou total.

#### Scenario: Consultation d'une consultation antérieure
- **WHEN** un superviseur consulte une trace de lecture du journal déjà enregistrée
- **THEN** seules ses références minimales sont présentées sans expansion récursive automatique de ses événements référencés.

### Requirement: Refus authentifiés minimisés
Le système SHALL distinguer les refus d’accès authentifiés aux dossiers, contenus et journal des consultations réussies. Leur trace MUST contenir seulement l’acteur authentifié, son organisme, la date et une catégorie fixe d’opération refusée. Elle MUST NOT conserver la cible soumise, son existence, un organisme cible, une URL brute ou un contenu personnel.

#### Scenario: Dossier interdit ou absent
- **WHEN** un utilisateur authentifié demande un dossier inaccessible ou inexistant
- **THEN** la même catégorie de refus est journalisée sans identifiant de cible
- **AND** la réponse reste identique dans les deux cas et aucun événement de lecture réussie n’est produit.

#### Scenario: Tentative interorganisme
- **WHEN** un intervenant de A soumet un identifiant appartenant à B
- **THEN** la trace de refus appartient à A et ne révèle aucune référence de B.

#### Scenario: Refus impossible à journaliser
- **WHEN** l’enregistrement du refus échoue
- **THEN** l’accès reste refusé sans données et une indisponibilité générique est signalée sans révéler la cible.

#### Scenario: Vérification d'accès périodique
- **WHEN** un contrôle périodique vérifie les droits sans servir de données métier
- **THEN** il ne produit ni événement de consultation ni événement de refus par identifiant vérifié.

### Requirement: Présentation minimisée et protégée du journal
Le système SHALL afficher les références et métadonnées autorisées sans recopier les contenus des dossiers, notes ou formulaires. Les noms d’acteurs résolus à l’affichage MUST appartenir à l’organisme autorisé; une référence stable MUST rester lisible si le compte est désactivé. La consultation MUST être française, accessible au clavier et utilisable à 375 pixels sans défilement horizontal de page.

#### Scenario: Auteur désactivé
- **WHEN** un événement a été réalisé par un compte désormais désactivé
- **THEN** sa référence reste identifiable sans réactiver le compte ni modifier l’événement.

#### Scenario: Référence sans contenu
- **WHEN** un événement concerne une note ou un document
- **THEN** le journal montre son type et ses références sans texte, participants, réponses de formulaire ou coordonnées de la personne.

#### Scenario: Contrôle de session impossible
- **WHEN** le contrôle de permission de l’écran d’audit échoue ou le navigateur revient au premier plan
- **THEN** ses données sont masquées jusqu’à une vérification réussie et les réponses ne sont pas stockées dans le cache HTTP.

# Spec Delta

## Purpose

Permettre la reprise du suivi d’une personne grâce à une chronologie des actions du dossier, attribuable à leurs auteurs et visible uniquement selon les autorisations courantes.

## ADDED Requirements

### Requirement: Actions métier attribuables du dossier
Le système SHALL présenter les événements persistés de création du dossier, transfert, changement de statut, ajout de note, ajout et modification de document. Chaque entrée MUST indiquer le type d’action, l’auteur, l’horodatage réel et la référence de l’élément concerné. Les lectures techniques, refus et événements de modèles de l’organisme MUST NOT apparaître dans cette chronologie.

#### Scenario: Reprise après transfert
- **WHEN** le nouveau responsable ouvre la chronologie du dossier
- **THEN** il voit les actions antérieures et le transfert, avec auteur, ancien responsable et nouveau responsable.

#### Scenario: Statut modifié
- **WHEN** un passage Actif vers Inactif ou Inactif vers Actif a réussi
- **THEN** l’entrée montre le statut précédent, le nouveau statut, l’auteur et la date de l’action.

#### Scenario: Document ajouté puis modifié
- **WHEN** un document a été créé puis modifié
- **THEN** deux entrées distinctes identifient ce document, son modèle et sa version de modèle sans afficher les réponses du formulaire.

#### Scenario: Note antidatée
- **WHEN** une note décrit une interaction antérieure à sa date d’enregistrement
- **THEN** son ajout est ordonné selon l’enregistrement réel et non la date d’interaction.

#### Scenario: Événements techniques et modèles
- **WHEN** des consultations, refus, lectures du journal ou changements de modèle existent
- **THEN** ces événements sont absents de la chronologie du dossier.

### Requirement: Chronologie sans reconstruction fictive
Le système SHALL utiliser les événements existants sans recréer d’événement métier lors de leur affichage. Les références historiques MUST être conservées lors des transferts. Un événement ancien dont certaines métadonnées sont absentes MUST être présenté avec ces limites sans déduire des valeurs historiques à partir de l’état courant.

#### Scenario: Affichages répétés
- **WHEN** un utilisateur ouvre plusieurs fois la chronologie
- **THEN** aucun événement métier n’est dupliqué et seules les traces de consultation nécessaires sont ajoutées au journal technique.

#### Scenario: Ancien événement incomplet
- **WHEN** un événement antérieur à l’évolution du modèle ne contient pas de version de document
- **THEN** l’interface signale que cette information n’a pas été enregistrée sans utiliser la version actuelle comme valeur passée.

#### Scenario: Période sans événements
- **WHEN** aucun événement n’a été enregistré pour une période
- **THEN** aucune action supposée n’est créée à partir des données courantes.

### Requirement: Accès courant à toute la chronologie
Le système SHALL vérifier les droits courants sur le dossier pour chaque page de chronologie et chaque lien vers un élément. L’intervenant responsable et les superviseurs actifs du même organisme ont accès; un ancien auteur ou responsable MUST NOT conserver d’accès fondé sur son historique. Les erreurs pour un dossier absent ou interdit MUST rester identiques.

#### Scenario: Ancien auteur après transfert
- **WHEN** un ancien responsable réutilise son URL de chronologie ou un lien de document après transfert
- **THEN** aucune donnée de la chronologie ou du document ne lui est retournée.

#### Scenario: Accès d'une autre équipe
- **WHEN** un superviseur consulte la chronologie d’un dossier d’une autre équipe du même organisme
- **THEN** il dispose du même historique que le responsable actuel.

#### Scenario: Autre organisme et curseur conservé
- **WHEN** un utilisateur utilise l’identifiant ou un curseur d’un dossier d’un autre organisme
- **THEN** aucun événement, acteur ou indicateur de pagination de ce dossier n’est divulgué.

### Requirement: Pagination chronologique stable
Le système SHALL présenter les actions les plus récentes en premier, avec un ordre déterministe pour les horodatages identiques et une navigation paginée. Une navigation commencée MUST rester cohérente si de nouvelles actions arrivent; l’utilisateur peut actualiser pour les voir. Une page vide et une lecture impossible MUST être distinguées.

#### Scenario: Même date et plusieurs pages
- **WHEN** des événements partageant la même date occupent plusieurs pages
- **THEN** le parcours affiche chaque événement de l’ensemble initial une seule fois, sans omission liée à cet égalité.

#### Scenario: Action pendant la pagination
- **WHEN** une nouvelle action est enregistrée après le chargement de la première page
- **THEN** elle ne décale pas les pages déjà parcourues et devient visible après actualisation.

#### Scenario: État vide ou indisponible
- **WHEN** la lecture réussit sans événement ou échoue
- **THEN** l’interface affiche respectivement un état vide explicite ou une indisponibilité, sans remplacer une erreur par un historique vide.

### Requirement: Présentation sans contenu sensible supplémentaire
Le système SHALL présenter des résumés d’actions sans texte de note, participants ou réponses de document. Les références d’auteurs désactivés MUST rester attribuables. Les liens vers les éléments MUST être vérifiés à leur ouverture; un élément indisponible MUST laisser une entrée compréhensible sans divulguer un contenu devenu inaccessible.

#### Scenario: Auteur désactivé
- **WHEN** l’auteur d’une action est désactivé
- **THEN** l’entrée conserve sa référence et une indication de compte désactivé sans lui rendre ses droits.

#### Scenario: Élément indisponible
- **WHEN** un ancien élément référencé n’est plus disponible dans le périmètre autorisé
- **THEN** l’action reste visible avec une référence et un libellé d’indisponibilité sans lien actif donnant accès à cet élément.

#### Scenario: Échec de journalisation de lecture
- **WHEN** la consultation de la chronologie ne peut pas être tracée
- **THEN** aucune entrée, référence d’auteur ou métadonnée de dossier n’est retournée.

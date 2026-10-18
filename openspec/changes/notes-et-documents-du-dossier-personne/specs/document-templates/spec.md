# Modèles de documents

## Purpose

Permettre aux superviseurs de définir les formulaires propres à leur organisme et de faire évoluer ces modèles sans altérer les documents déjà remplis.

## ADDED Requirements

### Requirement: Administration des modèles par les superviseurs
Le système SHALL permettre à tout superviseur actif de créer et modifier les modèles de documents de son organisme. Les intervenants SHALL pouvoir utiliser les modèles disponibles pour un dossier accessible, sans pouvoir en modifier la définition. Le système MUST NOT permettre la consultation ou l’administration des modèles d’un autre organisme.

#### Scenario: Créer un type de document
- **WHEN** un superviseur crée un modèle intitulé « Demande de financement »
- **THEN** le modèle est associé à son organisme et peut être utilisé par les intervenants de cet organisme.

#### Scenario: Modification par un intervenant
- **WHEN** un intervenant tente de modifier la définition d’un modèle, y compris par requête directe
- **THEN** la demande est refusée et le modèle reste inchangé.

#### Scenario: Modèle appartenant à un autre organisme
- **WHEN** un utilisateur fournit l’identifiant d’un modèle d’un autre organisme
- **THEN** le modèle n’est pas révélé et la réponse est identique à celle d’un modèle inexistant.

### Requirement: Définition d’un formulaire
Un modèle SHALL comporter un titre et une liste ordonnée de champs identifiables avec libellé, type et caractère obligatoire ou facultatif. Le système SHALL permettre au minimum le texte court, le texte multiligne, la date, le nombre et le choix unique. Les choix proposés SHALL être définis par le superviseur. Les définitions invalides MUST être refusées avec une explication.

#### Scenario: Formulaire configurable
- **WHEN** un superviseur définit un champ multiligne « Situation », un nombre « Montant demandé » et un choix unique « Programme »
- **THEN** ces champs sont proposés dans cet ordre avec les libellés, types et obligations définis.

#### Scenario: Définition inexploitable
- **WHEN** un modèle contient un titre vide, un champ sans libellé, des identifiants de champ en doublon ou un choix unique sans options
- **THEN** son enregistrement est refusé et les éléments à corriger sont indiqués.

### Requirement: Versions stables des modèles
Chaque document créé SHALL être associé à une version déterminée du modèle. Une modification de définition SHALL produire une nouvelle version pour les documents suivants. Le système MUST conserver les versions déjà utilisées et MUST NOT appliquer rétroactivement leurs changements aux documents existants.

#### Scenario: Ajout d’un champ au modèle
- **WHEN** un superviseur ajoute un champ obligatoire à un modèle déjà utilisé
- **THEN** les nouveaux documents utilisent la nouvelle version et les documents existants gardent leurs champs, réponses et règles de validation d’origine.

#### Scenario: Modèle modifié pendant la saisie
- **WHEN** un modèle évolue alors qu’un intervenant remplit un formulaire ouvert depuis la version précédente
- **THEN** l’enregistrement reste lié à la version affichée et aucune réponse n’est silencieusement déplacée vers un autre champ.

#### Scenario: Deux modifications concurrentes
- **WHEN** deux superviseurs tentent de modifier la même version d’un modèle
- **THEN** au plus une modification remplace la version courante et l’autre demande reçoit un conflit exploitable.

### Requirement: Retrait d’un modèle des nouveaux usages
Le système SHALL permettre au superviseur de retirer un modèle du choix des nouveaux documents. Ce retrait MUST conserver les documents et versions déjà utilisés. Un modèle retiré MUST NOT permettre la création d’un nouveau document depuis un ancien formulaire.

#### Scenario: Modèle retiré
- **WHEN** un superviseur retire un modèle
- **THEN** il n’apparaît plus dans le choix des nouveaux documents et les documents existants restent consultables et modifiables selon leur version et leurs permissions.

#### Scenario: Ancien formulaire soumis après retrait
- **WHEN** un intervenant tente de créer un document avec un modèle retiré depuis l’ouverture du formulaire
- **THEN** la création est refusée avec une invitation à choisir un modèle disponible, sans document partiel.

### Requirement: Contenu et présentation des modèles
Les titres, instructions et libellés des modèles SHALL être définis par l’organisme et affichés comme du contenu inerte. Ce parcours MUST NOT générer de conclusions cliniques, de scores de risque ni de décisions automatisées à partir des réponses. Les modèles SHALL rester utilisables en français, au clavier et à 375 pixels de largeur.

#### Scenario: Modèle d’évaluation défini par l’organisme
- **WHEN** un superviseur configure un modèle « Évaluation du risque de suicide » ou « Évaluation du risque homicidaire »
- **THEN** l’application restitue les champs définis et conserve les réponses saisies sans produire une évaluation ou une recommandation clinique automatique.

#### Scenario: Libellé contenant du balisage
- **WHEN** un libellé ou une instruction contient du code HTML ou un script
- **THEN** il est affiché sans exécuter ce contenu.

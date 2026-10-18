# Documents du dossier

## Purpose

Permettre aux utilisateurs autorisés de remplir et de maintenir des documents structurés dans le dossier de la personne, à partir des modèles de leur organisme.

## ADDED Requirements

### Requirement: Création d’un document depuis un modèle
Le système SHALL proposer, depuis un dossier accessible, les modèles disponibles de son organisme. L’utilisateur SHALL pouvoir remplir un formulaire et enregistrer un document rattaché à ce dossier et à la version du modèle affichée. La création MUST conserver l’auteur authentifié et l’horodatage d’enregistrement, sans créer un autre dossier.

#### Scenario: Remplir un document
- **WHEN** le responsable sélectionne un modèle disponible, complète ses champs requis et enregistre
- **THEN** le document apparaît dans le dossier avec le nom du modèle, sa version, l’auteur et la date de création.

#### Scenario: Aucun modèle disponible
- **WHEN** un intervenant ouvre l’ajout de document et aucun modèle n’est disponible dans son organisme
- **THEN** un état vide explique qu’un superviseur doit créer un modèle avant de pouvoir remplir un document.

### Requirement: Validation et enregistrement complet
Le système SHALL valider les réponses selon la version du modèle utilisée, ses types, options et champs obligatoires. Les identifiants de champs inconnus et les rattachements incohérents MUST être refusés. Un échec de validation ou d’enregistrement MUST NOT laisser de document partiel ou d’événement de succès.

#### Scenario: Champ obligatoire manquant
- **WHEN** un utilisateur soumet un document dont un champ requis est vide
- **THEN** le document n’est pas enregistré et le formulaire indique le champ à compléter en préservant les autres réponses autorisées.

#### Scenario: Réponse de type invalide
- **WHEN** une réponse n’est pas un nombre valide pour un champ numérique ou ne figure pas parmi les options d’un choix unique
- **THEN** l’enregistrement est refusé avec une erreur liée au champ concerné.

#### Scenario: Dossier ou modèle falsifié
- **WHEN** un utilisateur tente de rattacher le document à un dossier inaccessible ou à un modèle d’un autre organisme
- **THEN** aucune création n’a lieu et aucun renseignement sur l’élément interdit n’est révélé.

### Requirement: Consultation des documents du dossier
Le système SHALL permettre de parcourir les documents d’un dossier autorisé et de consulter leurs réponses avec les libellés de leur version de modèle. Les listes SHALL afficher le type de document, l’auteur, la date de création et la dernière modification. Les réponses MUST être affichées comme du contenu inerte et les pages sensibles MUST empêcher leur mise en cache HTTP.

#### Scenario: Relire un document ancien
- **WHEN** le modèle courant a changé depuis la création d’un document
- **THEN** le document est présenté avec les champs et les réponses de sa propre version, sans remplacement par la définition actuelle.

#### Scenario: Réponses contenant du code
- **WHEN** une réponse contient du code ou du balisage
- **THEN** la consultation l’affiche comme du texte sans exécution.

### Requirement: Modification attribuable d’un document
Le responsable courant du dossier et les superviseurs de son organisme SHALL pouvoir modifier les réponses d’un document autorisé. L’auteur et la date de création MUST être conservés; l’auteur et l’heure de la modification SHALL être enregistrés. La modification MUST respecter la version du modèle du document et MUST NOT changer son dossier de rattachement.

#### Scenario: Compléter une demande existante
- **WHEN** un utilisateur autorisé modifie des réponses valides d’une demande de financement
- **THEN** les nouvelles réponses sont enregistrées, la provenance de création demeure inchangée et la dernière modification identifie son auteur et sa date.

#### Scenario: Modification d’un document dont le modèle est retiré
- **WHEN** un utilisateur autorisé corrige un document créé avec un modèle désormais retiré des nouveaux usages
- **THEN** les réponses restent modifiables selon la version d’origine sans réactiver le modèle.

#### Scenario: Édition concurrente
- **WHEN** deux utilisateurs modifient un document depuis la même version enregistrée
- **THEN** au plus une modification est acceptée et l’autre reçoit un conflit invitant à relire la version courante, sans écrasement silencieux.

### Requirement: Droits courants sur le document
Le système SHALL contrôler les droits du dossier lors de chaque lecture et écriture de document. La qualité d’auteur MUST NOT créer de droit persistant. Un formulaire soumis après perte d’accès MUST être refusé sans restituer les réponses du document. Les vues ouvertes SHALL appliquer le délai de révocation et le masquage en cas de contrôle impossible prévus pour le dossier.

#### Scenario: Auteur devenu ancien responsable
- **WHEN** l’auteur d’un document tente de le consulter ou de le modifier après le transfert du dossier à un autre intervenant
- **THEN** l’accès est refusé malgré sa session ou son formulaire préexistant, avec la même réponse que pour un document absent.

#### Scenario: Nouveau responsable
- **WHEN** un dossier a été transféré à un intervenant admissible
- **THEN** cet intervenant peut consulter et modifier les documents du dossier selon leurs versions sans modifier leurs auteurs de création.

#### Scenario: Autre équipe du même organisme
- **WHEN** un superviseur consulte un document d’un dossier attribué à un intervenant relevant d’un autre superviseur de son organisme
- **THEN** le document reste accessible dans le périmètre de l’organisme.

### Requirement: Formulaires accessibles et utilisables sur téléphone
Les formulaires de documents SHALL être utilisables en français au clavier et à 375 pixels de largeur. Chaque champ SHALL présenter un libellé et son caractère obligatoire, et les erreurs SHALL identifier les réponses à corriger. Ce parcours MUST permettre d’enregistrer sans export, signature ou pièce jointe externe obligatoire.

#### Scenario: Remplir sur téléphone
- **WHEN** un intervenant remplit un modèle à 375 pixels de largeur
- **THEN** il peut lire les consignes, saisir les réponses, corriger les erreurs et enregistrer sans défilement horizontal de la page.

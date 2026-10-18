# Notes d’interaction

## Purpose

Consigner les interactions et les suites à donner dans le dossier d’une personne, avec une attribution claire et des accès alignés sur le responsable courant.

## ADDED Requirements

### Requirement: Note rattachée au dossier-personne
Le système SHALL permettre à un utilisateur autorisé d’ajouter une note à un dossier existant. Une note MUST appartenir à un seul dossier et au même organisme. Son ajout MUST NOT créer une nouvelle personne ni un nouveau dossier. Le texte libre et la nature de l’interaction MUST être renseignés.

#### Scenario: Consigner une nouvelle intervention
- **WHEN** le responsable ou un superviseur de l’organisme enregistre une note valide depuis un dossier accessible
- **THEN** la note est rattachée à ce dossier sans nouvelle fiche de personne ni dossier supplémentaire.

#### Scenario: Contenu obligatoire absent
- **WHEN** le texte ou la nature de l’interaction est vide
- **THEN** la note n’est pas enregistrée et les champs à compléter sont indiqués.

### Requirement: Date de l’interaction et provenance de la note
Le système SHALL enregistrer la date et l’heure de l’interaction saisies par l’utilisateur, avec un fuseau explicite. Il SHALL attribuer automatiquement l’auteur et l’horodatage d’enregistrement à partir de la session et de l’heure du système. Les deux dates MUST rester distinctes; le client MUST NOT pouvoir choisir un autre auteur.

#### Scenario: Saisie après une rencontre
- **WHEN** une note est saisie aujourd’hui pour une interaction ayant eu lieu la veille
- **THEN** elle conserve la date et l’heure de cette interaction ainsi que l’auteur et l’horodatage réel de sa saisie.

#### Scenario: Auteur falsifié
- **WHEN** le formulaire inclut l’identifiant d’un autre auteur
- **THEN** l’auteur enregistré reste celui de la session authentifiée ou la demande est refusée.

#### Scenario: Heure invalide ou ambiguë
- **WHEN** la date, l’heure ou le fuseau ne permettent pas d’identifier un instant valide sans ambiguïté
- **THEN** le système demande une correction sans enregistrer de valeur silencieusement décalée.

### Requirement: Participants et nature de l’interaction
Le système SHALL permettre de saisir plusieurs personnes présentes sous forme de noms ou descriptions libres, sans leur créer de compte. La nature de l’interaction SHALL être un texte libre. Les participants MUST rester des renseignements du dossier, sans créer d’accès pour les personnes mentionnées.

#### Scenario: Rencontre avec un proche et un partenaire
- **WHEN** l’auteur indique l’usager, un proche et un partenaire externe comme personnes présentes
- **THEN** ces renseignements sont conservés dans la note sans compte, invitation ni droit supplémentaire.

#### Scenario: Interaction sans autre personne présente
- **WHEN** l’auteur ne renseigne aucun participant supplémentaire
- **THEN** il peut enregistrer la note si ses autres champs requis sont valides.

### Requirement: Suite à donner associée à une note
Le système SHALL permettre d’associer à une note une tâche de suivi facultative comprenant une description, une échéance facultative et un état À faire ou Terminée. Le responsable courant du dossier ou un superviseur de l’organisme SHALL pouvoir modifier ce suivi; l’auteur et la date de clôture SHALL être conservés. Aucun rappel automatique n’est envoyé dans ce parcours.

#### Scenario: Suivi à effectuer
- **WHEN** une note est enregistrée avec la tâche « rappeler la personne » et une échéance
- **THEN** le suivi apparaît dans le dossier avec sa description, son échéance et l’état À faire.

#### Scenario: Clôture après transfert
- **WHEN** le nouveau responsable termine un suivi créé avant le transfert
- **THEN** le suivi passe à Terminée et identifie l’acteur et l’heure de clôture sans changer l’auteur de la note.

#### Scenario: Note sans tâche de suivi
- **WHEN** aucune tâche n’est renseignée
- **THEN** la note peut être enregistrée sans suivi vide ni tâche artificielle.

#### Scenario: Modifications concurrentes du suivi
- **WHEN** deux utilisateurs soumettent des changements depuis la même version d’un suivi
- **THEN** au plus un changement est accepté et l’autre utilisateur est invité à actualiser avant de réessayer.

### Requirement: Consultation et intégrité des notes
Le système SHALL présenter les notes du dossier avec leur date d’interaction, auteur, date de saisie, participants et suivi. Les nouvelles notes SHALL être ajoutées sans remplacer les précédentes. Dans ce parcours, le corps d’une note enregistrée MUST NOT être modifié ou supprimé; une correction SHALL être consignée par une nouvelle note.

#### Scenario: Relire les interactions
- **WHEN** un utilisateur autorisé ouvre les notes d’un dossier
- **THEN** il peut parcourir les notes par date d’interaction, de la plus récente à la plus ancienne, avec un ordre stable pour les égalités.

#### Scenario: Corriger une note enregistrée
- **WHEN** un intervenant doit compléter ou corriger un renseignement déjà enregistré
- **THEN** il peut ajouter une nouvelle note et la note d’origine demeure consultable avec sa provenance.

### Requirement: Accès aux notes et aux suivis
Le système SHALL appliquer les droits courants du dossier à toutes les lectures et mutations de notes et de suivis. Être auteur ou participant MUST NOT accorder de droit indépendant. Les vues ouvertes SHALL appliquer les mêmes règles de révocation, de masquage réseau et de non-cache que le dossier. Les textes MUST être affichés sans exécuter de contenu actif.

#### Scenario: Ancien auteur après transfert
- **WHEN** un intervenant réutilise le lien ou le formulaire d’une note après avoir transféré le dossier
- **THEN** l’accès est refusé sans exposer la note ni le suivi, même s’il en est l’auteur.

#### Scenario: Identifiant d’un autre organisme
- **WHEN** un utilisateur fournit l’identifiant d’une note ou d’un suivi d’un autre organisme
- **THEN** la réponse est identique à celle d’un élément inexistant et aucune mutation n’est effectuée.

#### Scenario: Texte ressemblant à du code
- **WHEN** une note contient du balisage ou du code de script
- **THEN** le texte est présenté comme du contenu inerte, sans exécution.

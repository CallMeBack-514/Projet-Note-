# Attribution et transfert

## Purpose

Maintenir un responsable unique par dossier et permettre un relais traçable entre intervenants sans conserver les anciens droits d'accès.

## ADDED Requirements

### Requirement: Responsable unique et attribution initiale
Le système SHALL associer chaque dossier à un seul intervenant responsable du même organisme. Un intervenant qui crée un dossier MUST en devenir responsable; un superviseur MUST choisir un intervenant actif de son organisme.

#### Scenario: Attribution falsifiée à la création
- **WHEN** un intervenant tente de créer un dossier directement au nom d'un collègue
- **THEN** la demande est refusée sans créer de dossier.

#### Scenario: Désactivation du responsable
- **WHEN** le compte du responsable d'un dossier est désactivé
- **THEN** le dossier reste attribué et visible aux superviseurs, qui peuvent le réattribuer
- **AND** le compte désactivé ne peut plus y accéder.

### Requirement: Acteurs autorisés au transfert
Le système SHALL permettre au responsable actuel et à tout superviseur du même organisme de transférer un dossier. Tout autre utilisateur MUST se voir refuser l'opération, y compris par requête directe.

#### Scenario: Transfert volontaire
- **WHEN** le responsable transfère son dossier à un collègue admissible
- **THEN** le transfert réussit sans nécessiter l'approbation du superviseur ou du destinataire.

#### Scenario: Transfert par le superviseur
- **WHEN** un superviseur transfère un dossier de son organisme dont le responsable relève d'un autre superviseur
- **THEN** le transfert est autorisé.

#### Scenario: Tentative d'un collègue
- **WHEN** un intervenant tente de transférer un dossier attribué à un autre intervenant
- **THEN** l'opération est refusée sans modifier le responsable ni révéler le dossier.

### Requirement: Destinataires admissibles
Le système SHALL proposer uniquement des intervenants actifs du même organisme, distincts du responsable actuel. Un transfert entre équipes MUST être possible sans modifier le rattachement hiérarchique des intervenants.

#### Scenario: Changement d'équipe
- **WHEN** le destinataire relève d'un autre superviseur du même organisme
- **THEN** le transfert réussit et chaque intervenant conserve son propre superviseur.

#### Scenario: Destinataire invalide
- **WHEN** la cible est inactive, superviseur, inexistante, responsable actuel ou membre d'un autre organisme
- **THEN** le transfert est refusé sans changement de droits.

### Requirement: Révocation atomique des droits
Le système SHALL remplacer le responsable et les droits associés dans une opération indivisible. Après validation du transfert, l'ancien responsable MUST perdre tout accès fondé sur son ancienne attribution, quelle que soit l'ancienneté de sa session. Le destinataire SHALL obtenir l'accès et les superviseurs de l'organisme SHALL le conserver.

#### Scenario: Ancienne session et ancien lien
- **WHEN** le dossier passe de A à B et A réutilise sa session, son ancien lien ou son formulaire de transfert
- **THEN** aucune lecture ou mutation de ce dossier n'est autorisée à A
- **AND** B et les superviseurs de l'organisme peuvent consulter le dossier.

#### Scenario: Autre dossier de la même personne
- **WHEN** A transfère un dossier mais demeure responsable d'un autre dossier de la même personne
- **THEN** A conserve seulement l'accès à cet autre dossier et aux informations de personne nécessaires à celui-ci.

### Requirement: Conflits et échecs de transfert
Le système SHALL refuser un transfert fondé sur une attribution devenue obsolète. Deux transferts concurrents basés sur la même version MUST produire au plus un succès. Un échec de transfert MUST conserver le responsable et les droits précédents, sans événement de succès.

#### Scenario: Deux superviseurs transfèrent simultanément
- **WHEN** deux superviseurs soumettent des destinations différentes depuis la même version du dossier
- **THEN** un seul transfert réussit et l'autre reçoit un conflit l'invitant à actualiser.

#### Scenario: Ancien responsable déjà remplacé
- **WHEN** A soumet son transfert après qu'un superviseur a transféré son dossier à B
- **THEN** la demande de A est refusée sans révéler la nouvelle attribution.

#### Scenario: Échec du journal d'audit
- **WHEN** l'enregistrement de l'événement de transfert échoue
- **THEN** le transfert est annulé et l'ancien responsable conserve ses droits.

# Transfert du dossier-personne

## MODIFIED Requirements

### Requirement: Révocation atomique des droits
Le système SHALL remplacer le responsable et les droits associés dans une opération indivisible. Après validation, l’ancien responsable MUST perdre l’accès au dossier-personne, à ses notes, suivis et documents, même s’il en est l’auteur. Le destinataire SHALL obtenir ces accès et les superviseurs de l’organisme SHALL les conserver. La session existante MUST NOT maintenir les anciens droits.

#### Scenario: Ancienne session et ancien lien
- **WHEN** le dossier passe de A à B et A réutilise sa session, son ancien lien ou son formulaire de transfert
- **THEN** aucune lecture ou mutation de ce dossier ni de son contenu n’est autorisée à A
- **AND** B et les superviseurs de l’organisme peuvent consulter le dossier et son contenu.

#### Scenario: Autre dossier de la même personne
- **WHEN** A transfère le dossier-personne et réutilise un ancien lien vers un autre dossier désormais rattaché à cette même personne après la reprise
- **THEN** ce lien ne maintient aucun accès au dossier-personne ni à son contenu pour A.

#### Scenario: Autre dossier après le transfert
- **WHEN** A transfère le dossier d’une personne mais demeure responsable du dossier d’une autre personne
- **THEN** A conserve l’accès à cet autre dossier sans obtenir ou conserver de droit sur la personne transférée.

#### Scenario: Note ou document dont l’ancien responsable est auteur
- **WHEN** A tente de consulter une note qu’il a rédigée ou de soumettre un document qu’il avait ouvert avant le transfert
- **THEN** la demande est refusée sans exposer le contenu ni le nouveau responsable
- **AND** la qualité d’auteur ne permet aucune exception aux droits courants.

#### Scenario: Continuité du suivi
- **WHEN** B reçoit le dossier-personne
- **THEN** B retrouve les notes, documents et tâches de suivi du dossier avec leurs auteurs et dates d’origine
- **AND** le rattachement hiérarchique des intervenants reste inchangé.

#### Scenario: Vues ouvertes pendant le transfert
- **WHEN** A consulte une note ou un document dans un onglet actif connecté au moment du transfert
- **THEN** le contenu révoqué est masqué au plus tard dix secondes après le transfert selon les règles de contrôle du dossier
- **AND** une ancienne réponse de contrôle ne peut pas le réafficher.

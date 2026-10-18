# Proposal

## Why

Les intervenants doivent consigner leurs interactions dans le dossier d’une personne, plutôt que créer un nouveau dossier pour chaque suivi. Les notes et les documents structurés permettront de conserver ce suivi au même endroit et de le transmettre au prochain intervenant responsable.

## What Changes

- **BREAKING** : faire du dossier la fiche de suivi d’une personne au sein d’un organisme, avec un responsable courant. Remplacer le parcours « créer un autre dossier pour cet usager » par l’ajout de notes et de documents; conserver l’ouverture d’un dossier pour une nouvelle personne.
- Ajouter des notes en texte libre avec date et heure de l’interaction, personnes présentes, nature de l’interaction et tâche de suivi associée. Identifier automatiquement l’auteur et la date d’enregistrement, distincte de celle de l’interaction.
- Permettre au superviseur de créer des types de documents propres à son organisme : modèles de formulaires que les intervenants peuvent remplir dans un dossier accessible. Les exemples demandés sont « Évaluation du risque de suicide », « Évaluation du risque homicidaire » et « Demande de financement »; leur contenu sera défini par l’organisme.
- Permettre l’ajout, la consultation et la modification des documents remplis. Conserver la version du modèle utilisée pour qu’une évolution du modèle ne réécrive pas les documents existants.
- Étendre les droits du dossier à ses notes, tâches de suivi et documents. Un transfert retire aussi ces accès à l’ancien responsable, même s’il est l’auteur d’une note ou d’un document; les superviseurs conservent leur accès à l’échelle de l’organisme.
- Étendre la journalisation aux nouvelles consultations et mutations, sans copier leur contenu dans l’audit. Préparer ainsi les événements nécessaires au futur historique du dossier.
- Prévoir la reprise des dossiers existants sans perte de données ni élargissement implicite des accès. Les personnes ayant plusieurs dossiers avec des responsables distincts nécessitent une règle de rapprochement explicite avant migration.

## Capabilities

### New Capabilities

- `case-notes` : rédaction et consultation des notes d’interaction, identification de l’auteur, participants et tâche de suivi dans le dossier autorisé.
- `document-templates` : gestion par les superviseurs des modèles de documents de leur organisme et de leurs versions.
- `case-documents` : création, remplissage, consultation et modification de documents associés au dossier et à une version de modèle.

### Modified Capabilities

- `case-records` : dossier centré sur la personne; parcours d’ajout de notes et documents remplaçant la création de dossiers supplémentaires pour un même usager.
- `case-assignment` : portée du transfert sur l’ensemble du dossier-personne et de son contenu, avec adaptation des scénarios fondés sur plusieurs dossiers pour une personne.
- `audit-trail` : traçabilité des lectures et mutations des notes, documents et modèles, avec les mêmes garanties de minimisation et de cohérence.

## Impact

Les écrans de liste et de fiche, les formulaires, les contrôles d’accès, les données persistées et les tests devront évoluer. L’architecture Cloudflare unifiée et les essais locaux restent le socle. La conception devra préciser la reprise des données, la modification des notes, les champs des modèles et le cycle de vie des tâches de suivi.

Les statuts Actif/Inactif, le tableau par intervenant, l’affichage de l’historique et l’analyse élargie des exigences de la Loi 25 restent dans leurs changements dédiés. Ce changement fournit la traçabilité de ses propres actions; il ne constitue pas une déclaration de conformité. Les notifications automatiques, pièces jointes libres, export PDF et fonctions d’évaluation clinique automatisée sont hors périmètre.

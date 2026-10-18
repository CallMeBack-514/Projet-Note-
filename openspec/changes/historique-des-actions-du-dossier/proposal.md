# Proposal

## Why

La fiche d’une personne doit permettre de comprendre les actions déjà effectuées et de reprendre son suivi après un transfert. Une chronologie métier rendra les changements de responsable, de statut et de documents visibles aux utilisateurs actuellement autorisés sur le dossier.

## What Changes

- Ajouter à la fiche du dossier-personne une chronologie en lecture seule, ordonnée par date d’action, avec auteur, nature de l’action et référence à l’élément concerné.
- Afficher les transferts avec ancien et nouveau responsable, les changements de statut Actif/Inactif avec ancien et nouveau statut, ainsi que les ajouts et modifications de documents. Inclure les ajouts de notes produits par le changement notes et documents, sans recopier leur texte ni les réponses aux formulaires dans les événements.
- Consommer les événements persistés par chaque fonctionnalité, sans générer une seconde trace à l’affichage ni inventer un historique manquant. Distinguer l’horodatage d’une action de la date d’interaction renseignée dans une note.
- Appliquer les droits courants du dossier à sa chronologie et aux liens vers ses éléments : l’intervenant responsable accède à son dossier, les superviseurs à tous ceux de leur organisme. L’ancien responsable perd aussi l’accès à l’historique après transfert, même s’il a réalisé certaines actions; le nouveau responsable peut consulter les actions antérieures.
- Conserver les événements lors des transferts et masquer la chronologie avec le reste de la fiche lors d’une révocation d’accès. Afficher un état vide ou une erreur explicite selon la situation, sans révéler de données d’un dossier interdit.
- Garder les consultations techniques et les tentatives d’accès hors de cette chronologie métier. Leur analyse relève de `audit-des-acces-et-exigences-loi-25` et de ses permissions dédiées.

## Capabilities

### New Capabilities

- `case-history` : consultation d’une chronologie métier attribuable du dossier, alimentée par ses événements persistés et limitée à ses autorisations courantes.

### Modified Capabilities

- `case-records` : présence de la chronologie dans la fiche du dossier-personne, avec les mêmes règles d’accès, de révocation et d’accessibilité que les autres informations affichées.

## Impact

La fiche, la lecture des événements et les vérifications d’accès devront prendre en charge l’historique en français, y compris sur téléphone. La conception précisera la pagination, l’ordre stable des événements simultanés, les libellés d’auteurs désactivés et les références à des éléments devenus indisponibles. L’historique ne constitue pas une sauvegarde intégrale des anciennes versions de documents.

Les transferts sont déjà tracés dans `audit-trail`. Les événements de notes et de documents dépendent de `notes-et-documents-du-dossier-personne`; ceux de statut dépendent de `statuts-actif-inactif-des-dossiers`. Ces changements demeurent responsables de l’enregistrement cohérent de leurs actions et ne dépendent pas de l’écran d’historique. Ce changement consomme ces événements sans modifier leur production ni créer une dépendance avec l’interface d’audit technique.

Le modèle dossier-personne et la reprise des dossiers existants relèvent du changement notes et documents. L’affichage devra respecter cette reprise sans fabriquer d’actions passées, et sans révéler d’autres dossiers ou organismes. Les contrôles juridiques élargis restent dans le changement consacré à l’audit et à la Loi 25.

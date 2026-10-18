# Proposal

## Why

Les intervenants et les superviseurs doivent distinguer les personnes dont l’accompagnement est actif de celles dont le dossier est inactif, tout en conservant leur suivi. Le statut actuel « Ouvert » ne permet pas cette distinction ni la reprise explicite d’un accompagnement.

## What Changes

- **BREAKING** : remplacer le statut « Ouvert » du dossier par les deux valeurs métier « Actif » et « Inactif ». Le statut s’applique au dossier-personne de l’organisme, pas à chaque note, document ou interaction.
- Permettre les transitions Actif vers Inactif et Inactif vers Actif, avec affichage du statut dans la liste et le détail, et filtrage des dossiers accessibles par statut.
- Proposer un statut Actif à la création. La correspondance des données existantes et le filtre affiché par défaut seront précisés avant la migration et la conception des parcours.
- Proposer que le responsable courant et tout superviseur du même organisme puissent changer le statut. Cette hypothèse suit la règle existante du transfert et devra être explicitée dans les spécifications; les contrôles seront effectués sur les droits courants, y compris après un transfert.
- Conserver le dossier, son responsable unique et son contenu lors d’un passage à Inactif. Le statut ne supprime aucune donnée, ne révoque ni n’accorde d’accès et ne remplace pas la désactivation d’un compte. Les superviseurs gardent leur visibilité sur tous les dossiers de leur organisme; un ancien responsable perd ses droits après transfert, quel que soit le statut.
- Enregistrer chaque transition réussie avec l’organisme, le dossier, l’acteur, la date, l’ancien statut et le nouveau statut, sans copier le contenu du dossier. La mutation et sa trace doivent réussir ensemble; un échec ne doit laisser ni changement partiel ni événement de succès.

## Capabilities

### New Capabilities

Aucune : le statut appartient déjà à la capacité `case-records`.

### Modified Capabilities

- `case-records` : cycle Actif/Inactif du dossier-personne, statut initial, transitions autorisées, affichage et filtrage dans le périmètre accessible, conservation du dossier et de son attribution.
- `audit-trail` : événements de changement de statut attribuables et minimisés, avec ancien et nouveau statuts et cohérence indivisible avec la mutation.

## Impact

Les données persistées, les opérations de création et de modification des dossiers, les écrans de liste et de détail, les contrôles des mutations et les tests devront intégrer ces deux statuts. La reprise du statut « Ouvert » devra être coordonnée avec celle du modèle de dossier-personne. L’architecture Cloudflare unifiée reste le socle, avec mise au point et vérification locales en premier.

Ce changement dépend conceptuellement de `notes-et-documents-du-dossier-personne`, qui définit un dossier par personne et par organisme. Il ne redéfinit ni ce modèle ni les notes et documents. Les règles d’isolation, de responsabilité unique et de transfert restent applicables. Les nouveaux événements de statut appartiennent à ce changement; leur affichage chronologique relève de `historique-des-actions-du-dossier`. Le tableau superviseur pourra exploiter ces statuts dans son propre changement.

La conception devra préciser la gestion des transitions concurrentes, le traitement d’une demande répétant le statut courant et la reprise des dossiers existants. Les critères métier d’inactivation, l’éventuelle saisie d’un motif et les conséquences éventuelles sur l’édition du contenu restent à préciser : aucune règle de consentement, durée de conservation, suppression automatique ou restriction supplémentaire d’accès n’est déduite du seul statut Inactif.

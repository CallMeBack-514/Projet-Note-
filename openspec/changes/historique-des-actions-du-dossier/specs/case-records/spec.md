# Spec Delta

## ADDED Requirements

### Requirement: Chronologie intégrée à la fiche personne
Le système SHALL proposer la chronologie métier dans la fiche du dossier-personne, en lecture seule et avec les mêmes autorisations que le dossier. La chronologie et ses métadonnées MUST être masquées avec la fiche lors d’une révocation ou d’un contrôle d’accès impossible. Sa navigation MUST rester française, accessible au clavier et utilisable à 375 pixels sans défilement horizontal de la page.

#### Scenario: Consultation de la fiche
- **WHEN** un utilisateur autorisé ouvre une fiche
- **THEN** il peut consulter sa chronologie et naviguer vers les pages antérieures sans quitter le périmètre de ce dossier.

#### Scenario: Révocation pendant la lecture
- **WHEN** le dossier est transféré pendant que son ancien responsable consulte la fiche
- **THEN** les requêtes suivantes de chronologie sont immédiatement refusées
- **AND** les entrées, auteurs, liens et indicateurs sont masqués au prochain contrôle, au plus tard dix secondes dans un onglet actif avec réseau disponible.

#### Scenario: Retour au premier plan ou perte du réseau
- **WHEN** la fiche revient au premier plan ou la vérification des droits échoue
- **THEN** sa chronologie reste masquée jusqu’à une vérification réussie et les réponses HTTP empêchent la mise en cache des données.

#### Scenario: Navigation sur téléphone et au clavier
- **WHEN** un utilisateur parcourt les entrées à 375 pixels de largeur ou au clavier
- **THEN** les dates, auteurs, actions et commandes de pagination restent lisibles et accessibles sans défilement horizontal de page.

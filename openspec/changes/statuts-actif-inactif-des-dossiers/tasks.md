# Tasks

## 1. Préparer la migration cumulative des statuts

- [x] 1.1 Vérifier que `notes-et-documents-du-dossier-personne` est implémenté et validé localement avant ce changement; consigner dans la validation les migrations appliquées, l’unicité du dossier-personne et la présence du contrat d’audit commun, sans reprendre ses tâches fonctionnelles ici.
- [x] 1.2 Ajouter dans `suivi-communautaire/migrations/` une migration postérieure au prérequis pour `Actif`/`Inactif`, défaut Actif et conversion Ouvert→Actif; vérifier sur une base locale peuplée la conservation des identifiants, dates, attributions, contenus et événements, ainsi que les clés étrangères et le blocage d’une valeur inattendue.
- [x] 1.3 Adapter dans cette migration les gardes de `cases` et les déclencheurs d’audit pour distinguer changement de statut et transfert, interdire une mutation combinant les deux et conserver les propriétés immuables; ajouter des tests D1 prouvant le refus des écritures invalides et l’absence de faux événement `transfer` lors d’une transition.
- [x] 1.4 Documenter dans le README le prérequis de migration, le mapping et la restauration locale coordonnée; vérifier les commandes documentées sur une base neuve et une copie peuplée, sans ressource distante.

## 2. Implémenter les transitions et leur audit

- [x] 2.1 Ajouter l’opération de statut dans `src/records.ts` avec validation du statut/version, UPDATE conditionnel et vérification SQL de session, profil, organisme et responsable courant; couvrir dans `tests/records.test.ts` le responsable, les superviseurs des autres équipes, le collègue interdit, l’autre organisme, la session révoquée et le compte désactivé.
- [x] 2.2 Coordonner statut et transfert avec `cases.version` en conservant les versions indépendantes du contenu; vérifier par tests concurrents qu’une seule mutation réussit depuis une même version, qu’un ancien responsable reçoit 404 et qu’un acteur encore autorisé reçoit 409, y compris lorsque le statut cible est déjà atteint.
- [x] 2.3 Rendre la demande au statut et à la version courants sans effet; vérifier qu’elle ne modifie ni la version ni l’audit et que l’inactivation/réactivation conserve le responsable, la date d’ouverture, les contenus et les opérations autorisées.
- [x] 2.4 Produire `status_change` dans `audit_events` avec `resource_type=case`, `resource_id`, `case_ids`, acteur, organisme, heure, ancien et nouveau statuts; tester la minimisation, la conservation des traces précédentes, leur immutabilité et l’annulation complète de la mutation si l’insertion d’audit échoue.
- [x] 2.5 Adapter le message de conflit du transfert existant pour couvrir une version devenue obsolète après changement de statut; vérifier son comportement sans divulgation à l’ancien responsable et documenter la version partagée dans la section cohérence du README.

## 3. Exposer les transitions et les filtres dans le parcours

- [x] 3.1 Ajouter `POST /dossiers/:id/statut` dans `src/index.tsx`, la redirection 303 après réussite et les réponses 400/404/409/503; compléter les tests HTTP pour l’origine, le type de contenu, le formulaire obsolète et l’échec d’audit sans donnée nominative ni confirmation de succès.
- [x] 3.2 Ajouter le paramètre validé `statut=tous|actif|inactif` à la route de liste et à `listing`, avec Tous par défaut et le même filtre pour résultats et total; tester recherche, pagination sur plus de 25 dossiers, valeur inconnue, état vide et absence de compteur d’un autre périmètre.
- [x] 3.3 Remplacer les badges « Ouvert » en dur et ajouter sur la fiche les actions Rendre inactif/Réactiver avec version courante, confirmation et erreurs; vérifier au navigateur l’affichage réel après redirection, le conflit sans réapplication automatique et le maintien des actions de contenu sur un dossier Inactif.
- [ ] 3.4 Ajouter le sélecteur Tous/Actifs/Inactifs, conserver la recherche et le filtre dans la pagination et adapter l’état vide; compléter `tests/browser/parcours.spec.ts` pour la navigation au clavier et le parcours à 375 pixels sans défilement horizontal.
- [x] 3.5 Actualiser le README avec le cycle manuel, le défaut Tous, l’absence de motif et la continuité des accès/éditions; vérifier le parcours documenté depuis des comptes fictifs responsable, destinataire et superviseur.

## 4. Vérifier l’intégration avec le dossier-personne

- [x] 4.1 Exécuter un parcours intégré de création Actif, ajout de contenu, inactivation, édition permise, transfert puis réactivation par le nouveau responsable; vérifier la perte d’accès de l’ancien responsable dans une vue ouverte, la visibilité des superviseurs, l’audit distinct de chaque action et la préservation du contenu.
- [ ] 4.2 Exécuter depuis `suivi-communautaire/` `npm test`, `npm run typecheck`, `npm run build` et `npm run test:browser` sur l’environnement local fictif; consigner les résultats et limites dans `VALIDATION.md`, avec les vérifications de migration de base neuve et peuplée.

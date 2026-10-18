# Tasks

## 1. Projection des événements existants

- [ ] 1.1 Ajouter `case-history.ts` sur le contrat notes/documents, statuts et séquence d’audit; tester le mapping des créations, transferts, statuts, ajouts de notes et ajouts/modifications de documents, ainsi que l’exclusion des lectures, refus, modèles et suivis.
- [ ] 1.2 Résoudre les références anciennes via `legacy_case_provenance` uniquement depuis le dossier canonique autorisé et dédupliquer par événement; tester une reprise de dossiers multiples sans modification des événements ni fuite par un ancien identifiant.
- [ ] 1.3 Implémenter les libellés de provenance, informations non enregistrées et auteurs indisponibles/désactivés; vérifier sur fixtures anciennes que ni statut courant, ni version actuelle de modèle, ni texte de contenu ne sont inventés comme valeurs historiques.
- [ ] 1.4 Documenter dans le README les événements affichés, les exclusions et la limite des anciennes données; vérifier la correspondance de cette liste avec les fixtures et la projection.

## 2. Requêtes et pagination protégées

- [ ] 2.1 Implémenter la requête paginée de 25 événements avec watermark de séquence et curseur signé lié au dossier/session/organisme; tester dates égales, plus de deux pages, nouvelle action antidatée pendant la pagination, actualisation et rejet des curseurs invalides.
- [ ] 2.2 Intégrer lecture de chronologie et trace de lecture du dossier au batch autorisé commun; tester absence de fuite après transfert/désactivation, session périmée, superviseur interéquipe, autre organisme et échec simulé d’audit.
- [ ] 2.3 Ajouter la route GET `/dossiers/:id/historique` et intégrer la première page au rendu de fiche; tester par HTTP le même refus pour absent/interdit, no-store, une trace de dossier par réponse et aucune mutation métier supplémentaire après plusieurs affichages.
- [ ] 2.4 Mesurer la requête sur un jeu local volumineux avec anciennes références et plusieurs organismes, ajouter seulement les index justifiés, et consigner les mesures et le plan de requête dans la documentation de validation.

## 3. Chronologie dans la fiche

- [ ] 3.1 Ajouter la section Historique et ses commandes françaises dans `views.tsx`, sous le conteneur canonique `data-case-id`, avec dates/fuseau, auteurs, transitions et références; vérifier l’ordre visible, les états vide/erreur et l’absence de texte de note ou de réponse de formulaire dans le HTML.
- [ ] 3.2 Relier les éléments consultables et afficher un repli pour les éléments indisponibles; vérifier qu’un ancien lien après transfert ou vers un autre organisme ne donne aucun accès, et qu’un auteur désactivé reste attribuable.
- [ ] 3.3 Ajouter les scénarios Playwright de transfert pendant lecture/pagination, hors ligne, retour au premier plan et réponse d’accès retardée; vérifier que l’historique et ses indicateurs sont retirés avec la fiche en moins de dix secondes et jamais réaffichés après révocation.
- [ ] 3.4 Vérifier la navigation clavier et les longues références à 375 pixels, avec pagination distincte de notes/documents; consigner les résultats visuels et d’accessibilité dans la validation locale.

## 4. Intégration locale

- [ ] 4.1 Exécuter le parcours complet création → note → document → modification → statut → transfert → consultation par le nouveau responsable, sur données fictives; vérifier les actions attendues dans l’ordre, les auteurs et l’exclusion des lectures/refus sans doublon d’événement métier.
- [ ] 4.2 Exécuter `npm test`, `npm run typecheck`, `npm run build` et `npm run test:browser` dans `suivi-communautaire/`, puis `openspec validate historique-des-actions-du-dossier --strict`; mettre à jour `VALIDATION.md` avec résultats et limites réels, sans modifier ni purger l’historique existant.

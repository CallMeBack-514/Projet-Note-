# Tasks

## 1. Préconditions et lecture de supervision

- [ ] 1.1 Vérifier localement les préconditions fournies par notes/documents puis statuts : unicité `(organisation_id, client_id)`, responsable conservé, valeurs Actif/Inactif et accès/édition inchangés pour Inactif; consigner les migrations présentes dans `VALIDATION.md` sans réimplémenter les changements dépendants.
- [ ] 1.2 Ajouter `src/supervision.ts` avec validation des filtres, sélection explicite d'intervenant et lecture SQL d'enveloppe cohérente, incluant contrôle vivant du superviseur, répertoire avec zéros/comptes désactivés, compteurs et deux pages limitées à 25; vérifier dans `tests/supervision.test.ts` les autres équipes, organismes, sélections étrangères et sessions ou objets Actor devenus obsolètes.
- [ ] 1.3 Couvrir dans ces tests les filtres combinés nom/identifiant/statut, Tous par défaut, 26 dossiers sur deux pages, plus de 25 intervenants, ordre déterministe, page devenue vide et compteurs égaux aux résultats sur toutes les pages; exécuter `npx vitest run tests/supervision.test.ts`.
- [ ] 1.4 Vérifier le plan de requête et le volume retourné sur un jeu fictif volumineux multi-organismes; ajouter un index ciblé seulement si le plan le justifie, et documenter dans `VALIDATION.md` le plan, le jeu utilisé et la borne de résultats sans enregistrer de données nominatives.

## 2. Routes et journalisation des lectures

- [ ] 2.1 Ajouter la route `/dossiers/supervision` avant la route générique de détail, avec authentification, contrôle Superviseur en SQL, réponses interdit/inexistant identiques pour une sélection et en-têtes sans cache; vérifier les réponses HTTP avec `SELF.fetch`, y compris compte désactivé, rôle retiré et paramètres falsifiés.
- [ ] 2.2 Intégrer le protocole de lecture/audit cohérent fourni par `audit.ts` pour la sélection paginée; vérifier par tests D1 que la trace contient exactement les identifiants retournés, au plus 25, sans noms ni recherche, qu'un échec d'audit bloque tout détail nominatif et qu'une révocation après préparation mais avant le batch refuse la lecture sans trace de succès; couvrir aussi un transfert concurrent sans divergence entre réponse et audit.
- [ ] 2.3 Ajouter les tests montrant qu'un répertoire seul, les compteurs, une sélection vide et un refus ne fabriquent pas de consultation de dossiers; vérifier qu'un compteur de 200 n'introduit pas 200 identifiants d'audit et documenter cette distinction dans `README.md`.

## 3. Interface du superviseur

- [ ] 3.1 Ajouter dans `src/views.tsx` la navigation réservée au superviseur et la vue répertoire/détail, avec états Actif/Inactif distincts de « Compte désactivé », zéros explicites et liens vers les fiches existantes; vérifier en Playwright la sélection d'un responsable d'une autre équipe et le parcours de transfert depuis sa fiche.
- [ ] 3.2 Ajouter filtres étiquetés, paginations indépendantes conservant les filtres, retour à la première page et états « Sélectionnez un intervenant »/page vide; vérifier en Playwright les valeurs par défaut, combinaisons, limites de pages et recherche littérale sans injection HTML.
- [ ] 3.3 Adapter `public/styles.css` en réutilisant le système visuel existant; vérifier le parcours au clavier et à 375 pixels sans défilement horizontal, et documenter dans `README.md` les filtres, la portée interéquipes et la signification descriptive des compteurs.

## 4. Fraîcheur et révocation de la vue

- [ ] 4.1 Ajouter l'empreinte HMAC de l'enveloppe et `/dossiers/supervision/controle`, liée à la session et aux paramètres validés, retournant seulement inchangé/actualisation nécessaire; vérifier en tests HTTP qu'une empreinte réutilisée avec une autre session ou des filtres falsifiés n'accorde aucun droit et qu'aucune donnée nominative ni événement de consultation ne sort du contrôle.
- [ ] 4.2 Étendre `public/app.js` avec le contrôleur dédié fonctionnant sur tableau vide, le délai commun contrôle/rafraîchissement, le remplacement atomique, le masquage intégral et les générations anti-réponses anciennes; vérifier en Playwright un transfert A vers B et un changement Actif/Inactif réalisés dans une autre session, avec actualisation du détail et des totaux sous dix secondes.
- [ ] 4.3 Vérifier en Playwright session expirée, rôle retiré et compte désactivé, avec et sans dossier affiché : tableau et compteurs masqués, aucun réaffichage tardif, lien vers `/dossiers` ou connexion; couvrir aussi hors ligne, retour au premier plan, historique navigateur et changement rapide de filtres.
- [ ] 4.4 Documenter dans `README.md` le délai et ses conditions, le masquage en échec et l'absence d'audit lors d'un contrôle inchangé; vérifier que les parcours intervenants continuent à utiliser leur contrôle existant et conservent leurs tests de révocation.

## 5. Vérification intégrée

- [ ] 5.1 Exécuter `npm test`, `npm run typecheck` et `npm run build` dans `suivi-communautaire`, puis `npm run test:browser` sur la démonstration locale fictive; consigner les résultats réels dans `VALIDATION.md` et corriger les régressions de création, notes/documents, statuts, transfert et permissions.
- [ ] 5.2 Vérifier le retrait du tableau en revenant à la liste générale sans annuler les migrations dossier-personne/statuts, puis confirmer la concordance des scénarios de `specs/supervisor-dashboard/spec.md` avec les résultats intégrés; consigner la procédure locale de retour dans `README.md`.

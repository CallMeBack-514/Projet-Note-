# Tasks

## 1. Évolution du journal canonique

- [x] 1.1 Après intégration notes/documents et statuts, créer la migration D1 ajoutant la séquence d’insertion monotone, `audit_read`, `access_denied`, résultat, références d’événements et catégories fixes; vérifier sur une copie locale que les identifiants, dates, références anciennes et opérations existants restent inchangés.
- [x] 1.2 Recréer les contraintes de formes d’événements, index et déclencheurs d’immutabilité; ajouter les tests D1 de séquence strictement croissante, inserts existants compatibles, refus des métadonnées invalides et refus UPDATE/DELETE.
- [x] 1.3 Documenter dans le README le contrat cumulatif et la procédure de migration/retour arrière sans perte de traces; vérifier la procédure sur une base locale issue du schéma initial avec provenance de dossiers rapprochés.

## 2. Lecture autorisée et traçable

- [x] 2.1 Ajouter la permission `audit:view` et les requêtes d’`audit.ts` sous session/profil/organisme courants; tester intervenant, superviseur autre équipe, autre organisme, compte technique, session expirée, désactivation et perte de rôle entre précontrôle et requête.
- [x] 2.2 Implémenter les filtres combinés, période UTC, résolution canonique/provenance et pagination de 25 événements avec watermark et curseur signé lié au contexte; vérifier avec plus de 25 événements, dates égales, insertion ultérieure antidatée, filtres extérieurs/inexistants, curseur falsifié et période invalide.
- [x] 2.3 Réunir sélection autorisée et trace `audit_read` dans un batch cohérent, y compris page vide; tester que les références tracées correspondent exactement aux lignes affichées, qu’aucune récursion n’apparaît et qu’une panne de trace ne retourne aucune donnée.
- [x] 2.4 Ajouter GET `/audit` et POST `/audit/acces` avec middleware explicite, réponse minimale du contrôle et no-store; vérifier par HTTP l’accès direct interdit, le changement d’organisme, la perte de rôle et l’absence de traces produites par le polling.

## 3. Refus minimisés

- [x] 3.1 Instrumenter une seule fois les refus authentifiés des routes dossiers/contenus/journal avec les catégories fixes et sans cible; tester que dossier absent, dossier interdit et dossier d’un autre organisme ne produisent ni identifiant soumis, ni contenu, ni organisme cible dans la trace.
- [x] 3.2 Tester les exceptions du périmètre : requêtes anonymes, saisie invalide, conflits 409 et polling ne deviennent pas des refus métier; vérifier aussi qu’une panne d’enregistrement refuse toujours l’accès, reste non révélatrice et ne déclenche pas de boucle.
- [x] 3.3 Documenter la portée des refus et leurs limites d’investigation dans le README; vérifier que les exemples et captures utilisent seulement des identités fictives et ne présentent jamais un refus comme un accès réussi.

## 4. Interface et révocation

- [x] 4.1 Ajouter navigation superviseur, filtres et présentation française des événements dans les vues existantes, avec références minimales et libellés de comptes désactivés; vérifier par tests HTTP l’échappement, l’absence de contenus personnels et les états vide/erreur.
- [ ] 4.2 Étendre le masquage de `public/app.js` au conteneur d’audit et à `/audit/acces`, en préservant annulation/génération des contrôles; tester sous Playwright la perte de rôle, la déconnexion, le changement d’organisme, le hors ligne et une ancienne réponse retardée sans réaffichage des données.
- [ ] 4.3 Vérifier au clavier et à 375 pixels les filtres, longues références et commandes de pagination; conserver dans la validation locale les résultats de lisibilité, absence de débordement et masquage en moins de dix secondes.

## 5. Cadrage documentaire de protection des renseignements

- [x] 5.1 Créer `suivi-communautaire/PRIVACY.md` avec la matrice source/exigence ou question/mesure/preuve/écart/responsable/décision; vérifier qu’elle couvre qualification du secteur, responsable, EFVP, fournisseurs et régions, conservation/destruction, incidents et droits des personnes, avec sources officielles datées et points inconnus explicitement marqués.
- [x] 5.2 Rattacher les preuves techniques réellement exécutées à la matrice et distinguer le journal d’accès du registre organisationnel des incidents; vérifier qu’aucune durée légale, certification ou clôture d’EFVP n’est affirmée sans décision documentée.
- [x] 5.3 Mettre à jour le README avec les conditions restant à établir avant un pilote réel et les limites du parcours local; vérifier que les décisions organisationnelles non disponibles sont visibles et qu’aucun test local n’est présenté comme une validation d’exploitation.

## 6. Intégration locale

- [ ] 6.1 Exécuter `npm test`, `npm run typecheck`, `npm run build` et `npm run test:browser` dans `suivi-communautaire/`, puis `openspec validate audit-des-acces-et-exigences-loi-25 --strict`; consigner les résultats réels et toute limitation dans `VALIDATION.md` sans déploiement distant.

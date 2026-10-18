# Tasks

Le premier parcours utilise un projet TypeScript dans `suivi-communautaire/`, Cloudflare Workers, Hono, Better Auth et D1. Les exigences sont définies dans les quatre fichiers `specs/*/spec.md`; les choix techniques sont détaillés dans `design.md`. Chaque tâche est terminée uniquement lorsque sa vérification a été exécutée avec succès.

## 1. Socle Cloudflare et environnement local

- [x] 1.1 Créer le projet TypeScript/Hono, verrouiller les dépendances compatibles avec Workers, configurer `cloudflare.config.ts`, les fichiers statiques publics et les scripts npm avec la CLI `cf`; documenter le démarrage — vérifier : installation reproductible, contrôle des types, compilation et réponse HTTP de l'application locale.
- [x] 1.2 Configurer le binding D1 local, les migrations SQL versionnées et Vitest dans le runtime Workers; documenter les commandes — vérifier : une migration et une requête D1 s'exécutent dans un test sur une base locale isolée, sans identifiant de base distante ni accès à des ressources de production.

## 2. Identités, profils et sessions

- [x] 2.1 Intégrer Better Auth au même Worker avec D1 et ses migrations, désactiver l'inscription publique et le cache de session dans les cookies, configurer les origines autorisées et les secrets — vérifier : tests de connexion valide/invalide, expiration et déconnexion réutilisant les anciens cookies; documenter les paramètres locaux nécessaires sans enregistrer de secret.
- [x] 2.2 Ajouter les organismes et profils métier avec rôle exclusif, état actif et rattachement intervenant–superviseur; protéger ces champs des modifications via les routes de compte — vérifier : tests de plusieurs intervenants pour un superviseur, refus d'un superviseur manquant ou invalide, des relations entre organismes et des tentatives d'auto-attribution d'un rôle; un compte sans profil métier ne reçoit aucun accès.
- [x] 2.3 Ajouter le provisioning contrôlé des comptes et rattachements ainsi qu'un jeu fictif de deux organismes, deux superviseurs dans le premier et plusieurs intervenants; documenter création et désactivation — vérifier : réexécution sans doublons, absence de route publique de provisioning, mots de passe traités par la bibliothèque et refus d'accès après désactivation avec une session préexistante.

## 3. Modèle des dossiers, autorisations et audit

- [x] 3.1 Créer les migrations des usagers, dossiers et événements d'audit, leurs index, contraintes de cohérence et déclencheurs de création/changement d'attribution — vérifier : tests D1 des liens entre organismes, du responsable unique, de la conservation des références et de l'audit avec auteur, ancien et nouveau responsables; un échec d'audit annule la mutation et une mutation sans ligne modifiée ne crée aucun événement; documenter les invariants SQL.
- [x] 3.2 Centraliser les requêtes autorisées sur la base primaire avec acteur obligatoire, compte actif, organisme et rôle ou responsable courant — vérifier : tests D1 des collègues de la même équipe, des autres équipes, des autres organismes, des comptes sans rôle et du périmètre global du superviseur; inclure listes, recherches, totaux, détail et sélection d'usager existant.
- [x] 3.3 Implémenter la trace des consultations avec les références effectivement retournées, avant l'envoi des données; protéger les événements des mutations métier — vérifier : tests des listes, fiches, lectures refusées, absence de contenu personnel recopié, indisponibilité de l'audit sans fuite dans la réponse, et absence d'endpoint de modification/suppression; documenter les événements et leurs limites.

## 4. Parcours de connexion, création et consultation

- [x] 4.1 Construire la mise en page française, la connexion, la liste paginée et recherchable, les états vides et la fiche détaillée; appliquer l'échappement HTML et les en-têtes de non-cache — vérifier : tests HTTP de contenu et de périmètre, réponse non nominative identique pour dossier absent ou interdit, puis inspection des écrans au clavier et à 375 pixels de largeur.
- [x] 4.2 Ajouter le formulaire de création d'un nouvel usager avec son dossier, l'attribution à soi pour l'intervenant et le choix du responsable pour le superviseur; protéger les POST contre les requêtes intersites — vérifier : tests D1/HTTP des champs requis, coordonnées facultatives, attribution falsifiée, destinataire invalide, organisme falsifié, CSRF et persistance après reconnexion; l'échec d'une étape ne laisse ni usager orphelin ni dossier partiel.
- [x] 4.3 Permettre la création d'un dossier pour un usager déjà accessible et documenter le parcours ainsi que la limite de détection des doublons — vérifier : tests d'une personne avec deux dossiers confiés à des intervenants distincts, d'un identifiant d'usager non autorisé et d'une révocation avant soumission; aucun autre dossier ni son existence n'est révélé.

## 5. Transfert et retrait d'accès

- [x] 5.1 Implémenter la mutation conditionnelle D1 du responsable, avec version attendue, session valide, acteur autorisé et destinataire admissible, en s'appuyant sur l'audit atomique — vérifier : tests de transfert par le responsable et par tout superviseur du même organisme, y compris vers une autre équipe; refus d'un collègue, d'un compte désactivé, d'un auto-transfert et d'un destinataire invalide, avec vérification des droits et de l'historique avant/après.
- [x] 5.2 Ajouter l'écran de transfert, la sélection limitée des destinataires, la confirmation et les erreurs de conflit ou de perte d'accès; documenter le relais — vérifier : tests HTTP réutilisant une ancienne session, un ancien lien et un ancien formulaire; l'ancien intervenant perd le dossier, le destinataire le voit, et les superviseurs conservent leur visibilité.
- [x] 5.3 Couvrir les courses de transfert dans le runtime Workers/D1 — vérifier : deux requêtes simultanées sur la même version produisent au plus un succès et un seul événement; tester le destinataire désactivé avant la mutation, l'acteur qui perd ses droits pendant l'opération, les transferts successifs et le retour arrière après échec d'audit; conserver les résultats dans la documentation de validation.

## 6. Vues ouvertes après révocation

- [x] 6.1 Ajouter l'endpoint de contrôle des identifiants affichés et l'actualisation des vues selon les délais de `case-records`, sans journaliser ces contrôles comme des consultations — vérifier : tests de l'absence de données nominatives dans les contrôles, de leur périmètre, de la révocation serveur immédiate et de l'absence de réponses mises en cache.
- [x] 6.2 Masquer les données au refus d'accès, à l'erreur réseau, à la reprise d'un onglet et au retour par l'historique; empêcher une réponse ancienne de les réafficher — vérifier : scénario navigateur avec deux sessions et transfert par un superviseur, retrait sous dix secondes dans un onglet actif connecté, reprise après perte réseau et conservation du seul autre dossier autorisé d'une même personne; documenter le comportement de l'écran.

## 7. Livraison locale et préparation Cloudflare

- [x] 7.1 Finaliser les scripts reproductibles de lancement, migrations et données fictives, les exemples de configuration sans secrets et la procédure de futur déploiement Cloudflare; distinguer les prérequis du pilote réel — vérifier : démarrage depuis une base locale vide à partir du README, compilation du Worker avec ses fichiers statiques et absence de secret ou compte de démonstration automatiquement publié; aucune ressource distante n'est modifiée par ce contrôle.

## 8. Vérification d'intégration

- [x] 8.1 Exécuter la suite complète Workers/D1, le contrôle des types, la compilation et la validation stricte OpenSpec — vérifier : résultats réussis et compte rendu des commandes réellement exécutées, sans présenter un contrôle local comme une validation distante.
- [x] 8.2 Vérifier le parcours intégré avec les deux rôles et deux organismes : connexion, création, recherche, consultation, transfert entre équipes et retrait des anciens droits — vérifier : démonstration navigateur sur ordinateur et téléphone, données persistantes après reconnexion, historique correct et aucune fuite entre organismes; consigner les éventuelles limites restantes.

## Workflow follow-up

- Archiver le changement après achèvement des tâches et des vérifications, puis vérifier les spécifications consolidées et le dossier d'archive.
- Traiter le déploiement effectif et les exigences d'exploitation du pilote dans les étapes ultérieures prévues par la conception.

## Résultats

Les 19 tâches ont été vérifiées localement. Voir `suivi-communautaire/VALIDATION.md` et `suivi-communautaire/README.md` pour les résultats, scénarios et limites. La revue visuelle Impeccable conclut `ship`; le déploiement distant reste une étape distincte.

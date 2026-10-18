# Design

## Context

Voir `proposal.md` pour la motivation et les quatre deltas de spécification pour les comportements attendus. Le projet possède des documents de planification, mais aucune application à migrer. L'utilisateur demande une implémentation simple et unifiée avec les outils Cloudflare pour l'hébergement. Node.js est disponible dans le workspace.

Les règles validées restent un responsable unique par dossier, un superviseur par intervenant, une visibilité des superviseurs sur tout leur organisme et le transfert sans approbation additionnelle avec perte d'accès de l'ancien responsable.

## Goals / Non-Goals

**Goals:**
- Livrer un seul projet TypeScript, un seul Worker et une base D1 pour le premier parcours.
- Développer et tester localement avec le runtime Workers et les migrations D1, puis disposer d'une procédure de déploiement sur Cloudflare.
- Garantir les permissions, la révocation et la cohérence de l'audit malgré les accès concurrents.

**Non-Goals:**
- Déployer un service public ou importer des données réelles pendant la planification.
- Ajouter une API publique, une application mobile native, un mode hors connexion ou un service de données externe.
- Construire les écrans de gestion des comptes, invitations et récupération de compte dans ce cycle; les comptes et rattachements seront provisionnés par un outil local contrôlé.
- Réaliser toutes les exigences d'exploitation du pilote dans ce changement. MFA, protections contre les tentatives de connexion, choix de localisation des données, restauration vérifiée et politique de conservation restent à traiter avant un usage réel.

## Decisions

### 1. Un projet web TypeScript sur Workers

Créer `suivi-communautaire/` avec TypeScript, Hono pour les routes et le rendu HTML côté serveur, du CSS responsive et un petit module JavaScript pour actualiser les droits des vues ouvertes. Le même Worker sert les pages, les actions et la connexion; Workers Static Assets sert uniquement les fichiers publics CSS, JavaScript et images. Les pages nominatives passent toujours par le Worker et ses contrôles.

Hono fournit une structure légère adaptée à ce parcours de formulaires. Les composants HTML peuvent utiliser JSX côté serveur sans introduire une application React côté client. Un framework plus large reste possible si un futur besoin le justifie; le premier parcours ne le nécessite pas.

Les deux ressources Cloudflare initiales sont le Worker et sa base D1. Les secrets sont configurés comme secrets Workers, jamais dans les fichiers statiques. Il n'y a pas de conteneur ni de serveur PostgreSQL à administrer.

Utiliser la CLI Cloudflare `cf` et `cloudflare.config.ts` pour ce nouveau projet, conformément au guide Cloudflare installé. Cette CLI est en bêta : fixer sa version, vérifier les commandes avec l'aide officielle et documenter celles qui auront réellement été exécutées. Prévoir des scripts npm de développement, compilation, migrations et tests. Verrouiller les versions des bibliothèques après vérification de leur compatibilité Workers lors de l'implémentation.

Sources : [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), [Hono sur Workers](https://hono.dev/docs/getting-started/cloudflare-workers), [développement avec cf](https://developers.cloudflare.com/cf/projects/).

### 2. D1 pour les données métier, les sessions et l'audit

Utiliser une base D1 par environnement avec les organismes séparés par `organisation_id`. Indexer notamment les dossiers par organisme et responsable. Toutes les requêtes utilisent des paramètres liés et des résultats paginés. Une base partagée réduit la configuration du premier cycle; une séparation physique par organisme pourra être étudiée si les volumes ou les exigences l'imposent.

| Entité | Champs structurants |
|---|---|
| Organisme | UUID, nom |
| Identité et session | Tables Better Auth pour comptes, mots de passe hachés, sessions et expirations |
| Profil métier | Identifiant d'utilisateur, organisme, rôle exclusif, superviseur nullable, état actif |
| Usager | UUID, organisme, nom d'affichage, téléphone et courriel facultatifs |
| Dossier | UUID, organisme, usager, service, responsable, statut Ouvert, date d'ouverture, version d'attribution, auteur et identifiant de la dernière opération |
| Événement d'audit | UUID d'opération, organisme, acteur, action, horodatage UTC, références des dossiers et responsables concernés |

Un profil Intervenant possède un superviseur du même organisme. Le rôle Superviseur n'est pas destinataire d'un dossier. Conserver les références historiques et désactiver les comptes au lieu de les supprimer. Utiliser les clés étrangères, contraintes et déclencheurs SQL nécessaires pour empêcher les associations entre organismes et les rattachements invalides, y compris par le provisioning.

Le modèle usager/dossier reste séparé : voir un dossier ne révèle ni le contenu ni l'existence des autres dossiers de la même personne. La sélection d'un usager existant est limitée aux personnes accessibles par au moins un dossier autorisé.

D1 est compatible avec la sémantique SQLite, pas avec les transactions interactives PostgreSQL. Les tests doivent exercer l'API D1 et ses migrations. Les limites vérifiées incluent 500 Mo par base sur l'offre gratuite et 10 Go sur l'offre payante; surveiller particulièrement la croissance de l'audit et les lectures fréquentes. Le choix ne présume pas que le pilote sera gratuit.

Sources : [API D1 et batch](https://developers.cloudflare.com/d1/worker-api/d1-database/), [limites](https://developers.cloudflare.com/d1/platform/limits/), [tarification](https://developers.cloudflare.com/d1/platform/pricing/).

### 3. Better Auth dans le Worker, avec autorisations métier séparées

Utiliser Better Auth comme bibliothèque de connexion dans le Worker, avec son intégration native D1 et des comptes courriel/mot de passe provisionnés. Désactiver l'inscription publique. Il n'y a pas de fournisseur d'authentification hébergé séparément à administrer. Générer et versionner ses migrations SQL avec les migrations métier; ne pas lancer de migrations sur les requêtes utilisateur.

Les sessions persistent dans D1. Désactiver explicitement le cache de session dans les cookies; vérifier la session, le profil actif et ses droits sur chaque requête. Les champs organisme, rôle, état et superviseur ne sont pas modifiables par les routes publiques de profil Better Auth. L'identité authentifiée seule ne donne aucun accès sans profil métier valide.

Le cookie de session est HttpOnly, Secure en HTTPS et configuré avec une politique SameSite adaptée. Valider les origines des requêtes et ajouter une protection CSRF aux actions métier; ne pas supposer que les contrôles des routes Better Auth couvrent les routes Hono. Tester la déconnexion, l'expiration et la désactivation avec une session déjà ouverte.

Source : [D1 natif dans Better Auth](https://better-auth.com/blog/1-5), [sessions et cache](https://better-auth.com/docs/concepts/session-management).

### 4. Politique d'accès commune, fondée sur les données courantes

Organiser les modules autour de l'identité et des organismes, des dossiers et transferts, et de l'audit. Les services métier reçoivent obligatoirement l'acteur authentifié. Le filtre commun est : compte actif, même organisme, puis superviseur ou responsable courant. Appliquer ce filtre dans les requêtes qui retournent les données, et pas seulement dans un contrôle préalable ou l'interface.

Pour ce cycle, utiliser le binding D1 directement sans Sessions API de réplication : les requêtes vont à la base primaire. Ne pas mettre en cache les permissions, les sessions ou les dossiers dans KV, un cookie ou le CDN. Si la réplication est introduite plus tard, elle devra préserver la lecture des autorisations courantes; un bookmark ancien ou une lecture sans contrainte ne suffit pas à garantir une révocation après le transfert effectué par un autre utilisateur.

La recherche d'usager suit les dossiers visibles. Elle peut manquer un doublon appartenant à un collègue; une détection globale révélerait des informations non autorisées. La consolidation supervisée des doublons sera un autre changement.

Un dossier inexistant et un dossier non autorisé produisent la même réponse 404 sans données nominatives. Les pages sensibles utilisent `Cache-Control: no-store, private`; aucune donnée de dossier n'est placée dans localStorage ou un service worker. Les logs techniques ne contiennent ni corps de formulaire ni secrets.

Source : [réplication D1 et lectures primaires](https://developers.cloudflare.com/d1/best-practices/read-replication/).

### 5. Création et transfert atomiques adaptés à D1

Ne pas traduire le verrouillage PostgreSQL en une suite de lectures et écritures JavaScript. D1 fournit des lots SQL atomiques via `batch()`, mais pas une transaction interactive traversant plusieurs appels du Worker.

La création d'un nouvel usager et de son dossier utilise un lot D1. Les vérifications d'intégrité et d'autorisation au moment des insertions doivent provoquer une erreur SQL si elles échouent afin d'annuler tout le lot. Un simple INSERT conditionnel qui n'insère aucune ligne ne suffit pas à annuler la création précédente de l'usager. Pour une personne existante, revérifier son accessibilité dans l'opération qui crée le dossier.

Le transfert utilise une seule mise à jour conditionnelle du dossier. Ses prédicats vérifient dans la même instruction la session encore valide, le profil actif, l'organisme, le rôle ou la responsabilité actuelle, la version attendue et le destinataire actif admissible. La mise à jour remplace le responsable, incrémente la version et inscrit l'acteur et l'identifiant d'opération.

Un déclencheur SQL sur la création et le changement d'attribution enregistre l'événement d'audit avec les valeurs ancienne et nouvelle. Son échec fait échouer la mutation. Le déclencheur ne se déclenche pas si aucune ligne n'est modifiée, ce qui évite les faux événements de transfert. Contraindre le changement de responsable à une nouvelle version et un identifiant d'opération distinct. Tester ces mécanismes avec les migrations D1 réelles avant de considérer la tâche complète.

Une mise à jour ne modifiant aucune ligne est un échec, pas un succès. Recontrôler le périmètre avant d'expliquer cet échec : 404 si l'acteur a perdu l'accès, 409 si la version est obsolète pour un acteur encore autorisé, erreur de formulaire si la destination est invalide. Les valeurs envoyées par le client ne fixent jamais l'identité de l'acteur.

Deux requêtes concurrentes portant la même version ne peuvent modifier qu'une fois cette version. Tester aussi la désactivation du destinataire pendant le transfert. Cette approche suffit pour le parcours initial sans ajouter un service de coordination distinct.

Sources : [transactions batch D1](https://developers.cloudflare.com/d1/worker-api/d1-database/), [SQL D1](https://developers.cloudflare.com/d1/sql-api/sql-statements/).

### 6. Écrans ouverts et audit des consultations

Après son propre transfert, l'intervenant revient à sa liste avec une confirmation sans données du dossier. Le superviseur peut rester sur le détail actualisé. Un endpoint de contrôle reçoit seulement les identifiants déjà affichés et retourne leur accessibilité sans identité d'usager ni nouveau responsable.

Vérifier toutes les cinq secondes dans un onglet actif, avec un délai réseau maximal de quatre secondes, ainsi qu'au retour au premier plan et à la restauration depuis l'historique. Masquer les données pendant la reprise d'un onglet. Au refus, retirer la ligne ou vider le détail et le formulaire; sur erreur réseau, masquer les informations et offrir de réessayer. Une réponse de contrôle plus ancienne ne doit pas réafficher des données déjà révoquées.

Le serveur refuse les requêtes postérieures à la validation du transfert sans attendre le contrôle visuel. Des informations déjà vues ou retournées avant le transfert ne peuvent pas être rappelées. Le contrôle sans contenu nominatif n'est pas une nouvelle consultation au sens de l'audit.

Pour une consultation réelle, matérialiser le résultat filtré, enregistrer l'acteur et les références effectivement retournées, puis envoyer la réponse. Si l'audit échoue, ne pas retourner les données. L'audit ne copie ni noms ni coordonnées. Aucun endpoint métier de modification ou suppression d'événement n'est exposé; ce dispositif ne prétend pas rendre les traces inviolables face à un administrateur de base.

### 7. Vérifications et services ajoutés au besoin

Utiliser Vitest dans le runtime de test Workers avec un binding D1 local et les migrations de l'application. Ne pas simuler les autorisations uniquement avec des mocks. Réutiliser les mêmes cookies avant et après transfert; envoyer deux requêtes de transfert concurrentes; provoquer un échec d'audit et vérifier l'annulation.

Le jeu fictif comprend deux organismes, deux superviseurs dans le premier et des intervenants de chaque équipe. Les vérifications navigateur couvrent le parcours complet, le clavier, 375 pixels de largeur, les vues ouvertes et la perte du réseau. Un contrôle de prévisualisation distant pourra compléter la validation locale au moment du déploiement, avec des données fictives; ne pas présenter un test local comme une preuve d'exécution distante.

R2 sera ajouté lorsqu'il faudra stocker pièces jointes ou audio. Queues et Workers AI seront évalués au cycle de dictée et rédaction, selon les modèles et les exigences de traitement. Aucun de ces services n'est provisionné pour le parcours actuel. L'application dispose d'une configuration locale et d'une cible Cloudflare séparée; les secrets et données de démonstration ne sont pas publiés automatiquement.

## Risks / Trade-offs

- Oubli d'un filtre d'organisme → politique commune, contraintes de cohérence et tests sur chaque route retournant des données.
- Absence de transactions interactives dans D1 → mutations conditionnelles, lots atomiques et déclencheurs d'audit; vérifications explicites des cas sans ligne modifiée.
- Sessions ou lectures obsolètes → sessions D1 sans cache de cookie, lecture primaire des droits et aucun cache de dossier.
- Bibliothèque d'authentification incompatible avec un détail du runtime → test de connexion/session et génération de migrations dès le socle, avant les écrans métier.
- Base partagée et audit croissant → index, pagination, suivi de la taille et du coût; revoir le partitionnement avant d'atteindre les limites.
- CLI cf en bêta → version verrouillée et commandes de build/dev vérifiées; ne pas multiplier les outils de déploiement par défaut.
- Localisation des données non décidée → aucun engagement de résidence au Canada déduit du choix Cloudflare; décision à documenter avant usage réel.
- Données déjà reçues par le navigateur → retrait visuel borné et refus serveur des nouvelles requêtes, sans promesse d'effacement à distance.

## Migration Plan

1. Créer le projet TypeScript et sa configuration Cloudflare, avec un binding D1 local.
2. Générer les migrations d'authentification et métier, puis vérifier leur application sur une base locale vide.
3. Charger explicitement le jeu fictif et ses comptes via un outil de provisioning documenté, avec secrets non versionnés.
4. Exécuter les tests Workers/D1, les contrôles navigateur et la compilation; documenter les commandes reproductibles.
5. Préparer les bindings, migrations et secrets nécessaires à un futur déploiement Cloudflare. Appliquer les migrations distantes uniquement à la cible identifiée lors de cette étape ultérieure.
6. Conserver les données lors d'un arrêt ou retour arrière; aucune suppression automatique de base. Il n'existe aucune application ni donnée de production à migrer depuis une autre pile.

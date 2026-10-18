# Validation du premier parcours

Validation locale effectuée les 17 et 18 octobre 2026, avec Node.js 24.14.0, le runtime Workers/D1 et Chrome piloté par Playwright. Aucune commande de déploiement ni modification de ressource Cloudflare distante n’a été exécutée.

| Contrôle exécuté | Résultat |
|---|---|
| Installation `npm ci` dans une copie temporaire sans base | Réussite, dépendances du lockfile, 0 vulnérabilité signalée |
| `npm run setup`, `npm run db:migrate` | Réussite; trois migrations appliquées à D1 local vide |
| `npm run demo`, relancé deux fois | 7 utilisateurs, 7 profils, 2 organismes, aucun doublon |
| Démarrage de cette installation vierge | `/health` et `/connexion` : HTTP 200; authentification réelle : HTTP 200 |
| Désactivation locale puis nouveau provisioning | Ancien cookie métier refusé, HTTP 401; désactivation conservée |
| `npm run typecheck` | Réussite |
| `npm test` | 24 tests réussis, 3 fichiers, 13,45 secondes lors du dernier passage |
| `npm run build` | Réussite; Worker et `styles.css` / `app.js` inclus |
| `npm audit --audit-level=high` | 0 vulnérabilité signalée |
| `npm run test:browser` | 1 scénario intégré réussi, 10,3 secondes lors du dernier passage |
| `openspec validate dossiers-attribution-et-transfert --strict` | Réussite avant archivage |
| Détecteur Impeccable sur les fichiers UI | Aucun signalement (`[]`) |
| Revue visuelle indépendante | `ship`, aucune correction matérielle sur les neuf captures |

## Autorisations et intégrité vérifiées

- Connexion valide/invalide, expiration, déconnexion avec anciens cookies, profil désactivé, compte sans profil métier, inscription publique refusée et auto-attribution du rôle ignorée.
- Rattachements hiérarchiques invalides refusés; collègues d’une même équipe isolés; superviseur couvrant toutes les équipes de son organisme; second organisme isolé.
- Listes, recherches, totaux et pagination de 26 dossiers sur deux pages limités aux dossiers autorisés; détail interdit et absent indistinguables; échappement HTML et absence de cache.
- Création par intervenant et superviseur, coordonnées facultatives, formulaire incomplet, falsification de responsable/organisme, CSRF, personne existante accessible et formulaire conservé après révocation.
- Transfert par responsable et superviseur, transfert interéquipes et transferts successifs. Destination invalide/inactive, auto-transfert et acteur non autorisé refusés. Responsable désactivé réattribuable par un superviseur.
- Deux transferts concurrents avec la même version : exactement un succès et un événement. Déclencheurs SQL testés avec un acteur ou une destination désactivés après lecture.
- Échec d’audit simulé : création usager+dossier annulée sans orphelin, transfert annulé sans changement de version. Audits immuables, sans copie des noms ou coordonnées. Lecture refusée sans événement de consultation; journal indisponible sans fuite nominative.
- Contrôle d’accès périodique : identifiants seulement, aucune consultation supplémentaire dans l’audit.

## Parcours navigateur

Quatre sessions distinctes : intervenant initial, superviseur d’une autre équipe, destinataire et intervenant du second organisme. Création d’une personne et de deux dossiers, autres personnes fictives, création à 375 px, recherche, consultation et reconnexion persistante. Transfert interéquipes : retrait du dossier dans la fiche déjà ouverte en moins de dix secondes et conservation du seul autre dossier autorisé dans la liste. Réseau coupé puis rétabli : masquage puis revérification. Une ancienne réponse d’accès artificiellement retardée ne réaffiche pas un dossier révoqué. Le retour par l’historique reste refusé. Aucun débordement horizontal aux dimensions contrôlées ni erreur JavaScript observée.

Les captures de revue utilisent des contextes fixes de 1440 × 960 et 375 × 812, avec capture de toute la page. Le premier lot après redimensionnement a révélé un artefact de capture Chrome sur trois images; elles ont été remplacées et vérifiées avant la revue indépendante. Les captures valides et le verdict sont sous `.impeccable/review/`.

## Limites de cette validation

Ce résultat concerne le premier parcours local avec des données fictives. Il ne valide pas un environnement Cloudflare distant, une exploitation avec données réelles, la conformité réglementaire, la résistance à une charge de production ou tous les navigateurs. La recherche n’effectue pas de normalisation des accents. Le retrait automatique des vues dépend de JavaScript et d’un navigateur actif; les droits serveur restent contrôlés à chaque requête. Les prochaines conditions d’exploitation sont décrites dans le README.

## Clôture OpenSpec

Le changement a été archivé le 18 octobre 2026 dans `openspec/changes/archive/2026-10-18-dossiers-attribution-et-transfert/`. Les 19 tâches sont terminées. Les quatre spécifications consolidées conservent leurs objectifs et leurs 18 exigences; `openspec validate --all --strict` réussit après archivage. Le conseil non bloquant de découper les changements dépassant dix exigences est conservé comme indication pour les prochains cycles.

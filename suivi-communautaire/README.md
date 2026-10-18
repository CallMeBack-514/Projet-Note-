# Suivi communautaire

Parcours en français : connexion, dossier de suivi unique par personne, recherche, attribution et transfert, notes d’interaction avec suivis, documents remplis à partir de modèles propres à l’organisme. Une application TypeScript/Hono, un Worker Cloudflare et une base D1. Better Auth gère les mots de passe et les sessions. Les essais locaux utilisent uniquement des données fictives.

## Démarrer localement

Node.js 24 recommandé, npm et Google Chrome pour les tests navigateur. Depuis ce dossier :

```sh
npm ci
npm run setup
npm run db:migrate
npm run demo
npm run dev
```

Ouvrir [l’application locale](http://localhost:5173). `setup` génère un secret dans `.dev.vars`; `demo` génère un mot de passe aléatoire et écrit les identifiants dans `.local/credentials.json`, accessible au seul utilisateur du système. Ces fichiers et la base sont ignorés par Git. Ne pas copier les comptes de démonstration dans un environnement réel.

Le port 5173 et l’origine `http://localhost:5173` sont intentionnellement fixes. Utiliser `localhost`, pas `127.0.0.1`, pour respecter les contrôles d’origine. Les migrations et le provisioning ciblent explicitement **D1 local**, sous `.cloudflare/state`, avec un UUID réservé au développement. Aucun compte Cloudflare n’est nécessaire.

| Compte fictif | Rôle | Organisme / rattachement |
|---|---|---|
| `s1@demo.example` — Camille Roy | Superviseur | Maison des liens |
| `s2@demo.example` — Alex Nguyen | Superviseur | Maison des liens |
| `a@demo.example` — Émilie Gagnon | Intervenant | Maison des liens / Camille |
| `b@demo.example` — Malik Fortin | Intervenant | Maison des liens / Camille |
| `c@demo.example` — Sofia Tremblay | Intervenant | Maison des liens / Alex |
| `s3@demo.example` — Louise Martin | Superviseur | Le Trait d’union |
| `d@demo.example` — Noah Dubois | Intervenant | Le Trait d’union / Louise |

Le provisioning est un script local, sans route web. Il utilise le hachage de Better Auth. Le relancer conserve comptes, mots de passe, dossiers et désactivations, sans doublon. Garder `.local/credentials.json` avec cette base : le supprimer ne réinitialise pas les mots de passe existants.

Pour désactiver un compte fictif, par exemple Malik :

```sh
npm run demo -- disable b
```

Ses sessions ne permettent plus aucun accès métier; ses dossiers restent attribués et visibles aux superviseurs, qui peuvent les transférer. La création de comptes réels et leur administration relèvent du prochain parcours d’exploitation, pas du script de démonstration.

## Essayer les rôles

1. Se connecter comme Émilie et créer un dossier. Le nom et le service sont requis; téléphone et courriel sont facultatifs.
2. Depuis la fiche, « Ajouter une note » (action principale) et « Ajouter un document » prolongent le suivi de la même personne : il n’existe **qu’un dossier par personne enregistrée**, et aucune action « autre dossier pour cet usager ». Il n’existe pas de recherche globale de personnes ni de détection des doublons entre dossiers invisibles.
3. Ouvrir une fenêtre privée comme Alex. Ce superviseur voit tous les dossiers de Maison des liens, y compris ceux de l’équipe de Camille.
4. Transférer un dossier à Sofia. Émilie perd immédiatement l’accès serveur; Sofia le gagne. Émilie conserve tout autre dossier qui lui est encore attribué, même pour la même personne.
5. Louise et Noah ne voient aucun dossier de Maison des liens. Une URL interdite donne la même réponse qu’un dossier absent.

La recherche porte sur le nom ou l’identifiant du dossier et reste limitée au périmètre courant, avec 25 résultats par page. La comparaison SQL ignore la casse ASCII, mais ne normalise pas encore les accents. Pour les noms accentués, conserver leur graphie ou rechercher une partie sans accent.

## Notes, suivis, documents et modèles

- **Notes** (texte libre, nature de l’interaction, personnes présentes en saisie libre, date et heure de l’interaction avec fuseau IANA). L’auteur et la date de saisie viennent de la session et de l’horloge serveur, jamais du formulaire. Le fuseau du navigateur est proposé et modifiable; une heure inexistante (changement d’heure) est refusée et une heure répétée exige le choix du décalage. **Une note enregistrée n’est ni modifiable ni supprimable** : une correction est une nouvelle note. Aucun rappel automatique n’est envoyé.
- **Suivi** facultatif par note (tâche, échéance, À faire / Terminée) modifiable par le responsable courant ou un superviseur, avec version attendue (un seul changement concurrent est accepté) et conservation de l’acteur et de l’heure de clôture.
- **Modèles de documents** : les superviseurs définissent, pour leur organisme, des formulaires (texte court, multiligne, date, nombre, choix unique; titre, libellés et instructions sont du contenu inerte). Aucun contenu clinique n’est préconfiguré et l’application ne calcule aucun score ni conclusion. Chaque modification crée une **version immuable**; un document garde sa version d’origine. Un modèle retiré n’accepte plus de nouveaux documents mais ses documents restent consultables et modifiables. Le constructeur (`/modeles`) fonctionne au clavier : Ajouter / Retirer / Monter / Descendre sont de vrais boutons, sans glisser-déposer.
- **Documents** remplis dans la fiche : validation serveur selon la définition persistée de la version, version attendue pour les modifications, auteur de création conservé, dernier auteur et date de modification enregistrés.
- Les droits sont ceux du dossier, recalculés à chaque lecture et écriture par SQL : le responsable courant et les superviseurs de l’organisme y ont accès; **être auteur n’accorde aucun droit**. Après un transfert, l’ancien responsable perd notes, suivis et documents; le nouveau les retrouve.
- Limites : 16 Kio de corps pour l’authentification et les opérations existantes, 256 Kio pour notes, documents et modèles (réponse 413 sans écho du contenu). Note 10 000 caractères, nature 160, personnes présentes 2 000, suivi 2 000, titre et libellé 160, 30 champs et 30 choix au plus, réponse courte 500 et multiligne 10 000 (`src/limits.ts` est la source commune de la validation et des formulaires).
- Les listes de notes et de documents sont paginées par 25. Une lecture qui sert des notes, suivis ou documents est **tracée dans le même batch D1** que la sélection : une panne d’audit n’envoie aucune donnée.

## Statuts Actif et Inactif

- Un dossier est **Actif** (statut initial) ou **Inactif**; la fiche propose « Rendre inactif » ou « Réactiver » (`POST /dossiers/:id/statut`). Le responsable courant et tout superviseur de l’organisme peuvent changer le statut; les droits sont revérifiés en SQL à l’écriture. Aucun motif n’est demandé ni stocké.
- Inactif **ne supprime rien et ne change aucun droit** : le responsable, la date d’ouverture, les notes et les documents sont conservés, et consultation, ajout de contenu, modification et transfert restent possibles. Les superviseurs voient toujours tous les dossiers de l’organisme; un ancien responsable perd ses droits après transfert, quel que soit le statut. Ce n’est pas une désactivation de compte.
- **Version partagée** : statut et transfert utilisent `cases.version`. Depuis une même version, une seule mutation réussit; l’autre reçoit 409 (« Ce dossier a été modifié entre-temps… ») si l’acteur est encore autorisé, sinon 404 identique à un dossier absent. Une demande répétant le statut et la version courants est sans effet (ni incrément ni événement); une ancienne version reste un conflit même si le statut cible est atteint. Les modifications de notes, suivis, documents et modèles ont leurs propres versions et n’en font pas varier `cases.version`.
- **Filtre** : `/dossiers?statut=tous|actif|inactif` (Tous par défaut, pour ne pas laisser croire qu’un dossier inactif a disparu); une valeur inconnue donne 400. Le filtre s’applique aux lignes et au total, après les droits, et est conservé avec la recherche dans la pagination.
- **Audit** : chaque transition réussie produit un événement `status_change` (`resource_type=case`, ancien et nouveau statut, acteur, version) dans la même transaction; il ne contient aucun contenu et n’est jamais un événement `transfer`.
- **Migration** (`0009_case_status.sql`, après `0005` à `0008`) : `Ouvert` devient `Actif` avec les mêmes identifiants, responsables, dates, contenus et événements; aucune transition humaine n’est fabriquée et toute valeur inattendue bloque la migration. D1 ne permet pas de reconstruire une table parent portant des enfants : la migration copie notes, suivis et documents vers des tables de transit, reconstruit `cases`, recrée les tables enfants et leurs déclencheurs puis les recharge. Vérifications sur base neuve et sur base peuplée dans `tests/status.test.ts`. **Restauration** : avant de nouvelles transitions, restaurer la sauvegarde (`cp -R .cloudflare/state.sauvegarde .cloudflare/state`) avec le code précédent; après de vraies transitions, corriger en avant — reconvertir en `Ouvert` perdrait la distinction.

## Journal des accès et refus

- **Permission `audit:view`** : session vivante, profil actif et rôle **superviseur** de l’organisme courant, vérifiés à chaque requête SQL (un intervenant, un compte sans profil métier ou un administrateur technique n’y a aucun droit; l’accès à un dossier n’y donne aucun accès). `GET /audit` consulte le journal de l’organisme (jamais d’autres organismes); `POST /audit/acces` ne renvoie qu’un booléen (permission **et** organisme initial de l’écran) et ne produit aucun événement.
- **Filtres** : dossier (le dossier canonique et ses anciennes références de la reprise), acteur, action et période. Les dates saisies sont interprétées dans le fuseau America/Toronto (ou ISO avec décalage explicite), converties en UTC, début inclus et fin exclue. Une période inversée, une action inconnue ou un curseur invalide donnent 400; un identifiant extérieur ou inexistant donne la même page vide.
- **Pagination** de 25 événements triés par `(occurred_at DESC, id DESC)` avec « Suivants » (aucun total global). Un **watermark** d’insertion (`audit_events.sequence`) est fixé à la première page et signé dans un curseur lié aux filtres, à la session, à l’organisme et à la version du schéma (`AUDIT_SCHEMA` : à incrémenter si la table est reconstruite). Les événements arrivés plus tard, même antidatés, n’altèrent pas le parcours.
- **Chaque consultation est tracée** (`audit_read`) dans le même batch D1 que la sélection, avec les identifiants des événements effectivement servis, même pour une page vide; la nouvelle trace n’apparaît pas dans sa propre page et les traces antérieures sont montrées sans expansion récursive. Si la trace échoue, rien n’est retourné (503).
- **Refus** (`access_denied`) : un refus authentifié (403/404) sur les routes de dossiers, de contenus, de modèles ou du journal enregistre une seule fois l’acteur, son organisme, l’heure et une catégorie fixe (`case_read`, `case_write`, `content_read`, `content_write`, `audit_read`) — **sans** identifiant de cible, existence, organisme cible, URL ni message. Dossier absent et dossier interdit sont indiscernables. Ne sont **pas** tracés : requêtes anonymes, erreurs de saisie (400), conflits (409), contrôles `/acces` et `/audit/acces`. Si l’écriture du refus échoue, l’accès reste refusé et une indisponibilité générique est renvoyée, sans nouvelle tentative. *Limite d’investigation* : ces traces disent qu’un refus a eu lieu, pas sur quoi; elles ne prouvent pas qu’une cible existe.
- **Migration** `0010_audit_log.sql` (après `0009`) : reconstruit `audit_events` avec `sequence INTEGER PRIMARY KEY AUTOINCREMENT` (assigné dans l’ordre des anciens rowid), les actions `audit_read` et `access_denied`, `result`, `viewed_event_ids`, `route_code` et des CHECK de forme; `id`, dates, références et `operation_id` sont inchangés et les anciens événements reçoivent `result='success'`. Les déclencheurs d’audit des autres tables et l’immutabilité sont recréés. Tester sur une base peuplée : `tests/audit.test.ts`. **Retour arrière** : avant l’ouverture, restaurer la sauvegarde (`cp -R .cloudflare/state.sauvegarde .cloudflare/state`) avec le code précédent; après de nouvelles traces, ne pas supprimer d’événements — conserver la base, désactiver l’écran `/audit` et corriger en avant.
- Ce journal est un registre technique, **pas** un registre d’incidents ni une preuve de conformité : voir [PRIVACY.md](PRIVACY.md) (matrice, décisions organisationnelles encore requises avant un pilote réel).

## Contrat d’audit commun

Les événements sont persistés dans `audit_events` par les déclencheurs SQL (mutations) ou dans le batch de lecture (`src/audit.ts`), jamais par une tâche détachée. Champs : `id`, `organisation_id`, `actor_id`, `action` (`create`, `read`, `update`, `transfer`, `status_change` réservé), `occurred_at`, `case_ids` (JSON; `[]` pour un modèle), `previous_owner_id`, `new_owner_id`, `resource_type` (`case`, `note`, `follow_up`, `document`, `document_template`), `resource_id`, `template_id`, `template_version`, `previous_status`, `new_status`, `previous_state`, `new_state` (états techniques seulement), `resource_version` et `operation_id` (commun à une note et à son suivi). Aucun texte de note, participant, réponse de formulaire ou description de tâche n’y est copié. Depuis `0010`, s’y ajoutent `sequence`, `result` (`success`/`denied`), `viewed_event_ids` (au plus 25 identifiants d’événements, pour `audit_read`) et `route_code` (catégories fixes des refus). Les événements sont immuables pour l’application. Les changements Statuts, Audit et Historique se branchent sur ce contrat sans seconde source d’événements.

## Reprise vers un dossier par personne

Voir [docs/migration-dossier-personne.md](docs/migration-dossier-personne.md) (précontrôle `npm run reconcile -- precheck`, manifeste de décisions, sauvegarde et restauration).

## Permissions et cohérence

Les permissions sont recalculées en base à chaque requête à partir du profil **actif**, de la session persistée, de l’organisme, du rôle et du responsable actuel. Aucun rôle envoyé dans un formulaire ou modification de compte Better Auth n’accorde d’accès. Le cache de session dans les cookies est désactivé; les sessions expirent après huit heures. L’inscription publique est désactivée.

Les intervenants ont un superviseur du même organisme. Le superviseur peut voir et transférer les dossiers de toutes les équipes de cet organisme. Les intervenants ne voient que leurs propres dossiers. Un compte technique ou sans profil métier n’a aucun accès aux dossiers.

Les clés étrangères composites empêchent de mélanger organismes, usagers et responsables. Les déclencheurs SQL revalident la session, l’acteur et la destination au moment de la mutation. La création usager+dossier utilise un batch D1 atomique. Le transfert et le changement de statut exigent la version courante (`cases.version`) et modifient le responsable ou le statut et la version en une seule instruction conditionnelle. Deux transferts concurrents fondés sur la même version ne peuvent pas réussir tous les deux. La base primaire est utilisée directement, sans lecture sur réplique.

L’audit stocke seulement les identifiants d’organisme, d’acteur et de dossiers, l’action, la date, l’ancien et le nouveau responsable. Les créations et transferts déclenchent leur audit dans la même transaction; son échec annule la mutation. Une consultation de liste, fiche ou formulaire nominatif est journalisée avant l’envoi. Un échec d’audit produit une réponse générique sans renseignements d’usager. Les contrôles d’accès périodiques ne constituent pas des consultations. Les événements sont immuables pour l’application; aucun endpoint d’édition, de suppression ou d’exploration de l’audit n’est exposé. Cet audit n’est pas un archivage externe inviolable contre un administrateur de base.

Les POST métier contrôlent l’origine et le type de contenu; Better Auth applique ses propres contrôles sur ses routes. Hono échappe les valeurs HTML. Les réponses métier portent `Cache-Control: no-store`; la politique de référence transmet seulement l’origine, jamais le chemin ni les termes de recherche. L’observabilité Cloudflare est désactivée dans cette première configuration pour éviter d’enregistrer des URL de recherche; l’application ne journalise qu’un code générique d’échec.

## Dossiers déjà ouverts

Le navigateur contrôle les identifiants affichés toutes les cinq secondes, avec un délai réseau maximal de quatre secondes. Après transfert, les éléments révoqués sont retirés du DOM et les autres dossiers restent visibles. En cas d’erreur réseau, les données sont masquées jusqu’à une vérification réussie. Le retour au premier plan, l’historique et la reprise de connexion déclenchent une vérification; une ancienne réponse ne peut pas réafficher les données. Aucune donnée nominative n’est stockée dans `localStorage`.

La révocation serveur est immédiate; le retrait d’un écran actif connecté intervient sous dix secondes. Cette mise à jour exige JavaScript et les timers du navigateur. Elle n’efface pas une information déjà lue, copiée ou capturée et ne garantit pas un délai dans un navigateur suspendu.

## Vérifications

```sh
npm test
npm run typecheck
npm run build
# Application locale et comptes fictifs déjà démarrés :
npm run test:browser
```

Vitest tourne dans le runtime Workers avec D1 isolé, réinitialisé par test; il ne modifie pas la démonstration. Playwright utilise Chrome et la base locale de démonstration : il y ajoute des dossiers explicitement fictifs et effectue des transferts. Ne jamais le pointer vers des données réelles. `node scripts/capture.mjs` capture les écrans actuels avec le compte Émilie; il exige au moins un dossier qui lui est attribué.

Les versions bêta de `cf` et du plugin Cloudflare sont verrouillées. La configuration génère les types dans `.cloudflare/types`. Le build regroupe le Worker et les fichiers de `public/`. Voir [VALIDATION.md](VALIDATION.md) pour les contrôles réellement exécutés et [DESIGN.md](DESIGN.md) pour le système visuel Impeccable.

## Déploiement Cloudflare ultérieur

Aucune ressource distante n’a été créée ou modifiée. Le démarrage local et les tests ne déploient rien. Pour la prochaine étape :

1. Choisir le compte Cloudflare, une origine HTTPS et l’environnement cible. Réévaluer les versions bêta et les exigences d’exploitation avant le pilote.
2. Configurer `APP_ORIGIN` dans l’environnement de compilation. Le mode `production` ne reprend pas l’UUID D1 local; il utilise le binding nommé `suivi-communautaire-db`. Fournir un secret `AUTH_SECRET` distinct dans un fichier protégé hors dépôt.
3. Après validation de cette étape, utiliser `cf deploy --mode production --secrets-file <fichier-protégé>`. La CLI peut provisionner le binding D1 distant. Relever son identifiant réel; ne jamais utiliser celui du développement.
4. Appliquer `cf d1 migrations apply <identifiant-distant> --dir migrations` à cette base distante. L’application reste inutilisable tant que le schéma n’est pas migré. Ne pas exécuter le script `demo` sur la base distante.
5. Provisionner des comptes réels par une procédure contrôlée, puis vérifier HTTPS, cookies sécurisés, sessions, rôles, migrations et révocations sur cet environnement.

Avant des données réelles : les décisions organisationnelles non établies (qualification du régime applicable, responsable de la protection, EFVP, conservation et destruction, gestion des incidents, droits des personnes, fournisseurs et régions) sont listées dans [PRIVACY.md](PRIVACY.md); aucun test local n’est une validation d’exploitation. Prévoir récupération des comptes, MFA, limitation des tentatives persistante, administration des profils, sauvegarde/restauration testée, conservation de l’audit et surveillance sans données nominatives. IA, pièces jointes, bilans et portail usager restent hors périmètre. Les vérifications locales ne remplacent pas ces validations d’exploitation.

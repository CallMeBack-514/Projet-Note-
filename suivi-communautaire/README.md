# Suivi communautaire

Premier parcours en français : connexion, usagers, dossiers, recherche, attribution et transfert. Une application TypeScript/Hono, un Worker Cloudflare et une base D1. Better Auth gère les mots de passe et les sessions. Les essais locaux utilisent uniquement des données fictives.

## Démarrer localement

Node.js 24 recommandé, npm et Google Chrome pour les tests navigateur. Depuis ce dossier :

```sh
npm ci
npm run demo:setup
npm run dev
```

Ouvrir [l’application locale](http://localhost:5173). `setup` génère un secret dans `.dev.vars`; `demo` génère un mot de passe aléatoire et écrit les identifiants dans `.local/credentials.json`, accessible au seul utilisateur du système. Ces fichiers et la base sont ignorés par Git. Ne pas copier les comptes de démonstration dans un environnement réel.

`demo:setup` enchaîne `setup`, `db:migrate` et `demo`. Le jeu versionné dans [scripts/demo-data.json](scripts/demo-data.json) ajoute huit dossiers fictifs : trois pour Émilie, deux pour Malik, deux pour Sofia et un pour Noah. Il comprend des coordonnées facultatives vides et des adresses `.example`. Chaque personne possède un dossier dans ce jeu, compatible avec le futur parcours centré sur la personne. Les notes, documents et statuts Actif/Inactif restent planifiés dans OpenSpec et ne sont pas encore des données disponibles.

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

Les dossiers sont créés avec les gardes SQL et l’audit habituels, sous des sessions temporaires des superviseurs fictifs supprimées dans le même batch. Une erreur annule le batch. Leurs dates d’ouverture sont fictives; leurs événements de création portent l’heure réelle du chargement. Les identifiants stables empêchent un second chargement de réattribuer un dossier transféré ou de dupliquer sa trace de création. Pour ajouter un exemple, ajouter un nouvel identifiant à `scripts/demo-data.json`, puis relancer `npm run demo`; modifier une entrée existante ne remplace pas les données de la base.

Pour désactiver un compte fictif, par exemple Malik :

```sh
npm run demo -- disable b
```

Ses sessions ne permettent plus aucun accès métier; ses dossiers restent attribués et visibles aux superviseurs, qui peuvent les transférer. La création de comptes réels et leur administration relèvent du prochain parcours d’exploitation, pas du script de démonstration.

## Essayer les rôles

1. Se connecter comme Émilie (`a@demo.example`) : trois dossiers fictifs sont déjà disponibles, dont celui d’Anne Beaulieu. Pour en créer un autre, le nom et le service sont requis; téléphone et courriel sont facultatifs.
2. Depuis la fiche, « Créer un autre dossier pour cet usager » réutilise la personne accessible. Il n’existe pas de recherche globale de personnes ni de détection des doublons entre dossiers invisibles.
3. Ouvrir une fenêtre privée comme Alex. Ce superviseur voit tous les dossiers de Maison des liens, y compris ceux de l’équipe de Camille.
4. Transférer un dossier à Sofia. Émilie perd immédiatement l’accès serveur; Sofia le gagne. Émilie conserve tout autre dossier qui lui est encore attribué, même pour la même personne.
5. Louise et Noah ne voient aucun dossier de Maison des liens. Une URL interdite donne la même réponse qu’un dossier absent.

La recherche porte sur le nom ou l’identifiant du dossier et reste limitée au périmètre courant, avec 25 résultats par page. La comparaison SQL ignore la casse ASCII, mais ne normalise pas encore les accents. Pour les noms accentués, conserver leur graphie ou rechercher une partie sans accent.

## Permissions et cohérence

Les permissions sont recalculées en base à chaque requête à partir du profil **actif**, de la session persistée, de l’organisme, du rôle et du responsable actuel. Aucun rôle envoyé dans un formulaire ou modification de compte Better Auth n’accorde d’accès. Le cache de session dans les cookies est désactivé; les sessions expirent après huit heures. L’inscription publique est désactivée.

Les intervenants ont un superviseur du même organisme. Le superviseur peut voir et transférer les dossiers de toutes les équipes de cet organisme. Les intervenants ne voient que leurs propres dossiers. Un compte technique ou sans profil métier n’a aucun accès aux dossiers.

Les clés étrangères composites empêchent de mélanger organismes, usagers et responsables. Les déclencheurs SQL revalident la session, l’acteur et la destination au moment de la mutation. La création usager+dossier utilise un batch D1 atomique. Le transfert exige la version courante et modifie le responsable et la version en une seule instruction conditionnelle. Deux transferts concurrents fondés sur la même version ne peuvent pas réussir tous les deux. La base primaire est utilisée directement, sans lecture sur réplique.

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

Avant des données réelles : prévoir récupération des comptes, MFA, limitation des tentatives persistante, administration des profils, sauvegarde/restauration testée, conservation de l’audit et surveillance sans données nominatives. Notes d’intervention, IA, documents, bilans et portail usager sont hors de ce premier parcours. Les vérifications locales ne remplacent pas ces validations d’exploitation.

# Migration vers un dossier unique par personne

Cette reprise passe de « plusieurs dossiers par personne, avec un service » à **un dossier de suivi par personne enregistrée dans un organisme** (contrainte unique `(organisation_id, client_id)`). Elle concerne le schéma D1 **local** de cette application; aucune ressource Cloudflare distante n’est touchée. Les migrations concernées sont `0004_reconciliation.sql` à `0006_audit_contract.sql`, puis `0007_notes.sql` et `0008_documents.sql`.

## Principe

- Une personne est identifiée par son `client_id`, jamais par son nom ni ses coordonnées. Les homonymes et les personnes d’organismes différents ne sont **jamais** rapprochés automatiquement.
- Un regroupement de plusieurs dossiers pour un même `client_id` exige une **décision explicite** d’un superviseur actif de l’organisme : dossier canonique conservé, responsable final (intervenant actif) et liste complète des sources avec leur version.
- La migration `0005` est tout ou rien. Toute incohérence (décision absente, périmée, décideur non autorisé, responsable inadmissible, dossier canonique hors regroupement) fait échouer la migration entière : aucune table n’est modifiée.
- Les anciens dossiers fusionnés ne sont pas supprimés silencieusement : leur identifiant, leur service, leur responsable, leur date d’ouverture et leur version sont conservés dans `legacy_case_provenance` (table immuable). Un ancien lien `/dossiers/<ancien-id>` mène au dossier canonique **seulement** si l’utilisateur a le droit courant d’y accéder; sinon la réponse est celle d’un dossier absent.
- Les événements d’audit existants sont recopiés tels quels (identifiants, dates, références). Aucune note ni aucun événement n’est fabriqué dans le passé; un changement de responsable décidé par la reprise produit un événement `transfer` daté du moment de la migration, au nom du superviseur décideur.

## Procédure (base locale)

1. **Arrêter les écritures** (arrêter `npm run dev`) et **sauvegarder** la base :

   ```sh
   cp -R .cloudflare/state .cloudflare/state.sauvegarde
   ```

2. **Précontrôle en lecture seule** (avant `0005`, schéma avec colonne `service`) :

   ```sh
   npm run reconcile -- precheck
   ```

   Le rapport (`.local/reconciliation-manifest.json`, permissions 0600) liste les regroupements à décider avec leurs identifiants seulement. Si le résultat indique « Aucune décision requise », passer à l’étape 5.

3. **Compléter les décisions** dans le fichier : pour chaque regroupement, renseigner `canonical_case_id`, `final_owner_id`, `decided_by` (superviseur de l’organisme) et `decided_at` (date ISO). Ne pas modifier la liste `sources`.

4. **Charger le manifeste** (contrôle côté opérateur, puis écriture dans `reconciliation_decisions`) :

   ```sh
   npm run reconcile -- apply .local/reconciliation-manifest.json
   ```

5. **Appliquer les migrations** :

   ```sh
   npm run db:migrate
   ```

6. **Vérifier** : nombre de dossiers = nombre de personnes; `legacy_case_provenance` contient tous les dossiers fusionnés; aucune erreur de clé étrangère (`PRAGMA foreign_key_check`); les audits d’avant la reprise sont présents.

## Restauration

- **Avant ouverture à de nouvelles saisies** : arrêter l’application, remplacer `.cloudflare/state` par la sauvegarde et rétablir la version précédente du code.
- **Après de nouvelles saisies** (notes, documents, modèles) : ne pas revenir automatiquement à l’ancien schéma. Arrêter les écritures, conserver une sauvegarde de l’état actuel et préparer une reprise contrôlée.

## Scripts de démonstration

`npm run setup` et `npm run demo` n’exécutent aucune suppression : ils utilisent `INSERT OR IGNORE`, ne créent pas de dossier et sont sans effet sur les personnes, notes ou documents existants. Relancer `npm run demo` ne duplique donc rien.

## Test automatisé

`tests/migration.test.ts` rejoue la procédure sur un ancien schéma fictif : cas simple, plusieurs dossiers du même responsable, responsables distincts, homonymes et organismes différents; manifeste incomplet, périmé ou non autorisé; conservation des audits, clés étrangères valides et résolution des anciens liens.

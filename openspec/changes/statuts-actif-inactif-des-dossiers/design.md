# Design

## Context

Voir `proposal.md` pour la motivation. L’application cible est `suivi-communautaire/`, un Worker Hono avec D1 et pages rendues dans `src/views.tsx`. `src/records.ts` applique l’accès courant dans ses requêtes et utilise `cases.version` pour les transferts. La migration `0003_cases.sql` impose `status='Ouvert'`; son déclencheur `cases_transfer_guard` interdit tout changement de statut et son déclencheur après mise à jour traite toute modification comme un transfert. Les badges de liste et de fiche affichent actuellement « Ouvert » en dur. Aucun endpoint de statut ni filtre correspondant n’existe.

Les tests `tests/records.test.ts` couvrent déjà les permissions, la concurrence des transferts et l’annulation sur panne d’audit. `tests/browser/parcours.spec.ts` vérifie le parcours à 375 pixels et la révocation des vues ouvertes. Ces suites constituent le socle de non-régression.

L’ordre de dépendance est `notes-et-documents-du-dossier-personne` puis ce changement. La création cumulée utilise donc une personne et son unique dossier, sans réintroduire le service obligatoire ou les dossiers supplémentaires. Le contrat d’audit commun est celui de la conception du changement notes; les nouveaux événements de transition sont la responsabilité de ce changement.

## Goals / Non-Goals

**Goals:** faire évoluer les contraintes D1, les mutations, la liste et la fiche sans affaiblir l’autorisation courante ou l’atomicité. Définir un contrat de statut exploitable ensuite par le tableau superviseur et l’historique.

**Non-Goals:** automatisation d’inactivation, motifs libres, suppression, archivage, consentement, durée de conservation, chronologie UI et agrégation par intervenant. Aucun service externe ni dépendance logicielle supplémentaire n’est nécessaire.

## Decisions

### 1. Deux valeurs stockées et une transition explicite

Conserver `cases.status` avec les valeurs canoniques `Actif` et `Inactif`, une contrainte CHECK et la valeur par défaut `Actif`. La conversion de `Ouvert` vers `Actif` est une migration de représentation. Elle ne produit pas d’événement métier attribué à un intervenant. Le statut Inactif ne désactive aucun contenu ni permission et ne change pas la date d’ouverture.

L’alternative d’un booléen séparé ferait coexister deux sources d’état avec l’ancien statut. Une table de statuts configurables ajouterait un cycle non demandé. Aucun motif n’est requis ou stocké dans cette version; la décision métier d’inactivation reste une action explicite de l’utilisateur autorisé.

### 2. Mutation conditionnelle et déclencheurs spécialisés

Ajouter à `src/records.ts` une opération de transition recevant l’identifiant du dossier, le statut cible et la version attendue. La mutation conditionnelle vérifie en base la session persistée, le profil actif, l’organisme, le rôle ou responsable courant et `cases.version`. Elle incrémente cette version exactement une fois et renouvelle les métadonnées d’opération. Le contrôle SQL au moment de l’écriture reste obligatoire même après une lecture de préparation.

Adapter les gardes D1 de façon explicite : une opération modifie soit le responsable, soit le statut, jamais les deux; les autres propriétés immuables restent protégées. Le garde de transfert conserve la validation du destinataire actif. Le garde de statut laisse le responsable inchangé, y compris lorsqu’un superviseur agit sur un dossier dont le responsable a un compte désactivé. Les déclencheurs d’audit ont des conditions distinctes sur les propriétés réellement modifiées; un statut ne doit jamais produire un événement `transfer`.

Le statut et le transfert partagent `cases.version`, car l’accès dépend du responsable. Une concurrence entre les deux accepte au plus une écriture depuis une même version. Les modifications de contenu conservent leurs versions propres définies dans le changement notes et ne font pas varier `cases.version`. Une version dédiée au seul statut empêcherait cette protection contre un formulaire préparé avant transfert.

Si aucune ligne n’est modifiée, revérifier l’accès avant d’expliquer le résultat : dossier absent ou révoqué → réponse 404 identique; version obsolète et accès conservé → 409; valeur/version invalide → 400; même statut et version courante → succès sans écriture, incrément ou événement de transition. Une répétition avec ancienne version reste un conflit, même si la cible est déjà atteinte. Une erreur de base ou d’audit donne l’erreur générique 503 existante.

### 3. Contrat d’audit commun

Utiliser la table immuable `audit_events` étendue par le changement notes, sans journal parallèle. Le contrat commun accepte les actions `create`, `read`, `update`, `transfer`, `status_change` et les types `case`, `note`, `follow_up`, `document`, `document_template`. Ici, chaque événement porte `action='status_change'`, `resource_type='case'`, `resource_id=cases.id`, `case_ids=[cases.id]`, l’organisme, l’acteur, l’heure réelle, `previous_status` et `new_status`. Les références de modèle/version et d’ancien/nouveau responsable restent vides pour cette action. Aucun contenu personnel ou motif libre n’est ajouté.

Le déclencheur après modification du statut écrit l’événement dans la même transaction D1 que l’UPDATE. Son échec annule statut, version et métadonnées d’opération. Les contraintes et déclencheurs d’immutabilité de l’audit sont préservés. Les événements historiques et les lectures restent inchangés; rendre une page après transition demeure une consultation auditée distincte. Un enregistrement asynchrone après la réponse exposerait une fenêtre de perte et est écarté.

### 4. Formulaire serveur et filtre explicite

Ajouter `POST /dossiers/:id/statut` avec `status` et `version`, sous les contrôles d’origine, de contenu et d’authentification existants. La fiche propose l’action correspondant à l’état courant : « Rendre inactif » ou « Réactiver ». Après réussite, redirection 303 vers la fiche et confirmation de l’état réel. Un conflit présente l’invitation à actualiser sans réappliquer automatiquement la demande; toute restitution nominative après erreur recontrôle l’accès et journalise sa lecture.

Sur `GET /dossiers`, ajouter `statut=tous|actif|inactif`, avec `tous` par défaut; refuser un filtre inconnu par une erreur 400 explicite. Traduire ce paramètre validé vers les valeurs SQL. L’option passe à `listing` et s’applique au même prédicat des lignes et du total, toujours après restriction aux dossiers autorisés. Conserver le filtre et la recherche dans les liens de pagination, et repartir à la première page lors d’un changement de recherche/filtre. Conserver la pagination actuelle de 25 dossiers. Les badges utilisent `row.status`, avec texte lisible sans dépendre de la couleur.

Le défaut Tous préserve la visibilité actuelle des dossiers accessibles. Masquer implicitement les Inactifs risquerait de faire croire à leur suppression. Le mécanisme existant de contrôle d’accès dans `public/app.js` reste fondé sur les permissions; un passage à Inactif ne doit pas être traité comme une révocation. Pas de mise à jour en temps réel du statut dans les autres onglets : l’actualisation ou la prochaine navigation relit l’état courant.

## Risks / Trade-offs

- [Reconstruction de `cases` avec références de notes/documents] → appliquer une migration additive après celle du dossier-personne, conserver tous identifiants et contraintes composites, recréer les gardes/index et vérifier les clés étrangères et les nombres d’objets avant activation.
- [Un déclencheur de transfert capture encore les changements de statut] → tester séparément les deux mutations et affirmer exactement une action d’audit appropriée par succès.
- [Un compte désactivé reste responsable] → permettre au superviseur de changer le statut et de transférer; ne pas réutiliser le contrôle de destinataire actif pour une mutation du seul statut.
- [Concurrence statut/transfert plus restrictive] → accepter le conflit explicite et une nouvelle lecture plutôt qu’une réapplication automatique; les modifications de contenu indépendantes ne causent pas de conflit artificiel.
- [Migration incompatible avec une ancienne version du Worker] → appliquer la migration et la nouvelle version dans une fenêtre contrôlée; aucun déploiement distant dans cette phase locale.
- [Statut perçu comme verrouillage] → l’interface conserve les actions de contenu et le parcours documente clairement la continuité des permissions.

## Migration Plan

1. Terminer et valider localement la migration dossier-personne du changement notes, y compris les décisions explicites pour les rapprochements ambigus. Réutiliser son schéma d’audit commun. Ne pas attribuer de numéro de migration qui entre en conflit avec ce prérequis.
2. Préparer une nouvelle migration versionnée après les migrations existantes; ne pas modifier `0003_cases.sql` déjà appliquée. Précontrôler les valeurs de statut et vérifier le schéma attendu. Sur copie locale, sauvegarder les données et établir les comptes/identifiants des dossiers, contenus, responsabilités et événements.
3. Modifier les contraintes/defaults de `cases` en conservant les clés référencées et convertir `Ouvert` en `Actif`. Recréer les déclencheurs spécialisés et préserver l’audit immuable. Ne pas exécuter les déclencheurs de transition lors de la copie de migration. Contrôler les clés étrangères, les totaux, les relations et l’absence d’événement humain inventé.
4. Tester une base neuve et une base peuplée migrée via le chemin D1 local du projet, puis exécuter les suites runtime et navigateur. Déployer ensemble schéma et code uniquement dans une étape ultérieure explicitement prévue pour l’environnement cible.
5. En cas d’échec avant activation, restaurer la copie locale précédente. Après de vraies transitions, préférer une correction en avant : une rétroconversion globale vers Ouvert perdrait la distinction et n’est pas une restauration valable. Un retour exceptionnel exige une restauration complète coordonnée avec le code correspondant et l’acceptation explicite de la perte des écritures postérieures; aucune restauration automatique n’est prévue.

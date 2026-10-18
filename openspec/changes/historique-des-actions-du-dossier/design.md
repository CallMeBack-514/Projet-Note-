# Design

## Context

Voir `proposal.md` et les deltas `case-history`/`case-records`. Dans `suivi-communautaire/`, `src/views.tsx` rend actuellement la fiche sous un conteneur `data-case-id`; `public/app.js` masque et retire ces conteneurs après les contrôles `/acces`. Le backend Hono vérifie le profil/session en SQL et journalise les lectures avant de rendre la réponse. Les tests D1 et Playwright couvrent déjà l’atomicité, les anciennes sessions, le transfert interéquipe et le retrait sous dix secondes.

Les événements actuels contiennent création, lecture et transfert. Notes/documents ajoute les ressources et leur provenance, statuts ajoute les transitions Actif/Inactif, et audit ajoute une séquence d’insertion monotone. Ces changements sont les producteurs; la chronologie reste une projection de leurs événements persistés. Le rapprochement des dossiers-personnes conserve les anciennes références dans `legacy_case_provenance` sans réécrire le journal.

## Goals / Non-Goals

**Goals:** fournir une projection stable et autorisée, réutiliser la révocation des vues et conserver les limites connues des événements anciens.

**Non-Goals:** deuxième table d’événements métier, reconstruction d’un historique absent, comparaison des anciennes réponses de documents, édition d’événement, moteur de notifications ou dépendance fonctionnelle à l’interface du journal d’audit.

## Decisions

### 1. Projection d’une source unique

Ajouter `case-history.ts`, qui reçoit un acteur authentifié, un identifiant de dossier et un curseur validé. Sa requête joint `audit_events` aux références du dossier autorisé. Elle sélectionne explicitement : `create/case`, `transfer/case`, `status_change/case`, `create/note`, `create/document`, `update/document`. Les anciennes créations/transferts sans `resource_type` sont interprétés comme des actions de dossier, car le schéma initial ne possédait que ces mutations. Les futures actions inconnues restent exclues jusqu’à décision explicite.

Exclure `read`, `audit_read`, `access_denied`, les événements de modèles et les modifications de suivi de cette première chronologie. Ils restent dans le journal technique. Les événements note et suivi d’une même opération ne deviennent pas deux entrées « Note ajoutée ». Conserver `operation_id` pour la provenance sans regrouper arbitrairement plusieurs actions distinctes. Aucun événement métier n’est créé par cette projection.

Une table d’historique dédiée dupliquerait les contraintes et risquerait de diverger du journal; elle n’est pas nécessaire au volume local attendu. Le libellé vient d’un mapping d’actions contrôlé dans l’application, jamais d’un texte injecté dans le journal.

### 2. Références historiques après rapprochement

Autoriser d’abord le dossier canonique via profil/session courants. Résoudre ensuite ses identifiants sources par `legacy_case_provenance` dans le même organisme. Sélectionner les événements dont `case_ids` contient le canonique ou une source ainsi autorisée, sans modifier les événements. Dédupliquer par identifiant d’événement lorsqu’un événement référence plusieurs sources rapprochées.

Afficher une mention de provenance lorsqu’un événement concerne un ancien dossier source. Les transferts des sources ne sont pas présentés comme des transferts du dossier canonique survenus après sa migration. La création du canonique ne fait pas disparaître les créations anciennes. Les services ou métadonnées absents ne sont pas reconstruits depuis l’état courant. Aucun ancien identifiant ne permet de contourner les droits du canonique.

### 3. Pagination stable

Afficher 25 événements par page, triés par `(occurred_at DESC, id DESC)`. La première lecture fixe le watermark maximal de `audit_events.sequence`, introduit par le changement d’audit comme compteur d’insertion monotone. Toute page impose `sequence <= watermark`; les bornes de page sont le dernier couple date/id. Des insertions futures, même avec une date égale ou antérieure, ne changent pas l’ensemble parcouru. Une actualisation recrée un snapshot.

Le curseur signé contient watermark, dernière date/id, dossier canonique, session, organisme et version de schéma. Il ne porte aucune autorisation : les droits sont revérifiés à chaque page et une cible interdite reste indiscernable d’une cible absente. Rejeter les curseurs malformés ou d’un autre contexte sans résultats. Un état vide indique l’absence d’événement; une panne de lecture donne une indisponibilité.

Cette dépendance à la séquence technique donne l’ordre d’intégration notes/documents → statuts → audit → historique. L’interface `/audit` n’est pas utilisée par le module d’historique et pourrait être désactivée sans casser la projection. Les changements producteurs ne dépendent pas de celui-ci.

### 4. Lecture et audit sous les mêmes droits

Réutiliser le service de lecture cohérente d’`audit.ts` et ses batches D1 plutôt qu’un précontrôle puis une lecture privilégiée. Toutes les sélections d’événements, références et auteurs sont conditionnées au dossier canonique autorisé, au profil actif et à la session vivante. Le batch enregistre une lecture `read` de ressource `case` pour la chronologie servie; sa sélection et sa trace portent sur la même version des droits. Aucune réponse n’est envoyée si la trace échoue.

Lors du rendu composé de la fiche, utiliser une seule trace de lecture du dossier couvrant ses métadonnées et l’historique, en plus des traces de contenus effectivement servis requises par notes/documents. Une requête distincte de pagination d’historique produit sa propre lecture de dossier. Ne pas enregistrer les entrées historiques comme de nouvelles mutations ni comme des lectures du contenu des notes/documents qui n’a pas été retourné.

Un transfert n’efface pas les événements, mais retire immédiatement à l’ancien responsable les pages et liens de l’historique. Les liens de document/note revérifient séparément leur accès à l’ouverture. Une désactivation ou un changement d’organisme de l’auteur ne fait pas disparaître son identifiant : résoudre son nom seulement dans le périmètre autorisé, sinon utiliser « Compte indisponible » et sa référence. Un compte désactivé du même organisme conserve l’indication « Compte désactivé ».

### 5. Interface intégrée et lisible

Étendre `Detail` avec une section « Historique » après les sections Notes et Documents. L’entrée présente action, date locale avec fuseau explicite, auteur, référence et, selon le type, ancien/nouveau responsable ou statut. Les versions de modèle sont des références stables; ne pas les remplacer par le titre d’un modèle courant lorsque le titre historique n’est pas disponible. Les réponses aux formulaires, participants et textes de notes ne sont pas chargés pour cette section.

Utiliser une liste sémantique avec séparateurs, un élément `time` et les commandes « Actions plus anciennes » et « Actualiser ». Réutiliser la palette et les contrôles existants; laisser les longues références revenir à la ligne. La pagination d’historique garde un paramètre distinct de celles des notes et documents. Les états vide, indisponible et élément indisponible sont explicites.

Placer tout l’historique, ses liens et ses indicateurs dans le conteneur `data-case-id` canonique. La révocation existante masque ainsi la fiche entière, y compris l’historique, sans nouveau polling métier. Réutiliser la protection contre les anciennes réponses asynchrones de `public/app.js`, les événements focus/pageshow/offline et les réponses no-store. Ajouter GET `/dossiers/:id/historique` pour les pages suivantes, utilisant le même conteneur et les mêmes contrôles; aucune action d’écriture métier ne passe par cette route.

## Risks / Trade-offs

- [Métadonnées anciennes incomplètes] → Présenter la référence et la limite explicitement, sans reconstitution fictive ni modification d’audit.
- [Élargissement involontaire après rapprochement] → Résoudre les sources seulement depuis un canonique autorisé et un manifeste de migration validé; tester les anciens liens.
- [Nouvel événement au même horodatage] → Watermark de séquence monotone plus curseur date/id.
- [Audit des lectures faisant grossir la chronologie] → Exclure toutes les lectures de la projection et tracer une seule lecture de dossier par page servie.
- [Coût de la recherche JSON/provenance] → 25 entrées par page, index organisme/date/id et mesure sur un jeu local volumineux; envisager un index relationnel dérivé uniquement si les mesures le justifient.
- [Masquage navigateur dépendant de JavaScript] → Maintenir les droits SQL à chaque requête; le retrait visuel complète ces contrôles sans les remplacer.

## Migration Plan

1. Intégrer et valider localement les contrats notes/documents, statuts et la séquence de l’audit. Réutiliser la provenance de migration existante sans la recalculer.
2. Ajouter le module de projection, les routes et les vues; aucun backfill d’événement métier n’est effectué. Ajouter seulement les index manquants, avec numérotation SQL attribuée à l’intégration.
3. Vérifier une base issue de l’ancien schéma et une base récente : créations/transferts anciens, sources rapprochées, documents, notes, statuts et comptes désactivés.
4. Exécuter les tests ciblés D1/HTTP/navigateur et mettre à jour les preuves locales. L’activation n’exige aucune migration destructive.
5. En cas de défaut d’affichage, désactiver la section et la route sans toucher au journal, à la provenance ni aux contenus. Ne pas effacer les lectures déjà enregistrées.

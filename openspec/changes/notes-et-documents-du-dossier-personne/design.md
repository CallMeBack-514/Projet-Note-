# Design

## Context

Voir `proposal.md` pour la motivation et les six deltas pour les comportements attendus. Le projet réel est `suivi-communautaire/` : Hono et vues JSX rendues côté serveur, Better Auth, un Worker et D1, développement avec `cf dev`. Aucun nouveau service Cloudflare n’est nécessaire.

`src/records.ts` et `migrations/0003_cases.sql` séparent actuellement `clients` et `cases`, autorisent plusieurs dossiers par personne, exigent un service et limitent le statut à `Ouvert`. Les écritures utilisent des contrôles SQL de session/profil courants et des déclencheurs d’audit atomiques. `src/index.tsx` impose une limite globale de formulaire de 16 Kio et des POST URL-encodés avec vérification d’origine. Les tests Workers/D1 et Playwright vérifient notamment les transferts concurrents, les organismes et la révocation des vues ouvertes.

## Goals / Non-Goals

**Goals:** étendre ces garanties aux contenus, conserver une architecture locale simple et fournir un contrat d’événements stable aux changements suivants. Le modèle doit permettre une migration vérifiable depuis les données actuelles.

**Non-Goals:** nouveaux services de stockage, éditeur riche, collaboration simultanée, sauvegarde automatique de brouillons ou contenu clinique préconfiguré. Les statuts restent `Ouvert` dans cette étape; le changement de statuts applique ensuite `Actif`/`Inactif`. Les interfaces d’audit et d’historique viennent dans leurs changements dédiés.

## Decisions

### 1. Conserver les identifiants et rendre le dossier unique

Conserver `clients` pour l’identité et `cases` pour le responsable, les droits et la date d’ouverture; ajouter une contrainte unique `(organisation_id, client_id)` après rapprochement. Supprimer la dépendance métier au champ `service`; préserver les anciennes valeurs dans une table de provenance de migration. Un nouveau dossier crée une nouvelle personne et son dossier dans la même opération. La réutilisation d’un `client_id` conduit à son dossier autorisé ou à une réponse générique; elle ne crée rien.

L’unicité concerne une personne **enregistrée**, identifiée par `client_id`, pas son nom ni ses coordonnées. Les homonymes et les personnes d’organismes distincts ne sont pas rapprochés automatiquement. Un contrôle global de doublons exposerait les personnes des collègues; il est exclu. Fusionner les tables identité et dossier apporterait peu tout en augmentant le risque de migration.

### 2. Petits modules métier autour du dossier

Conserver `records.ts` pour les dossiers/transferts et isoler les opérations dans `notes.ts`, `documents.ts`, `document-templates.ts` et `audit.ts`. Extraire uniquement les prédicats d’autorisation réellement communs dans un module partagé. Les interfaces métier reçoivent l’acteur authentifié et des entrées validées; les paramètres d’organisme et d’auteur viennent de la session, jamais du formulaire.

Chaque requête enfant joint son dossier, l’organisme, le profil actif et la session non expirée. Chaque écriture vérifie ces conditions au moment de l’écriture, comme les transferts actuels; une vérification HTTP préalable ne suffit pas. Les clefs étrangères composites empêchent les rattachements interorganisme. L’auteur historique ne donne aucun accès. Toute erreur sur un objet interdit est indiscernable d’un objet absent.

### 3. Données de notes et de suivis

Créer `case_notes` avec identifiant, organisme, dossier, texte, nature, participants, instant d’interaction UTC, fuseau IANA et décalage choisi, auteur et date de saisie serveur. Le texte, la nature, les participants et la provenance d’une note sont immuables après création. Une correction est une nouvelle note; ce choix évite un système supplémentaire de versions de notes pour le premier parcours.

Les participants sont des entrées libres, sans compte ni droits. Créer une table `note_follow_ups` avec au plus un suivi par note : description, échéance facultative de type date civile, état `todo`/`done`, version, auteur/date de dernière modification, auteur/date de clôture. L’état affiché est « À faire » ou « Terminée ». Un retour à À faire efface la clôture courante; les anciennes transitions restent dans l’audit. L’ajout d’une note et de son éventuel suivi est un seul batch atomique.

La saisie propose le fuseau du navigateur, explicitement visible et modifiable, avec défaut `America/Toronto`. Le serveur vérifie que date/heure, fuseau et décalage décrivent le même instant. Une heure inexistante est refusée; une heure répétée exige le choix du décalage. La date de saisie provient du serveur. Aucun horaire n’est corrigé silencieusement. Les tests couvrent les transitions d’heure de Toronto.

### 4. Modèles versionnés et réponses structurées

Créer `document_templates` (organisme, état disponible/retiré, version courante, compteur de concurrence, provenance), `document_template_versions` (définitions immuables, titre, champs ordonnés et version) et `case_documents` (dossier, version du modèle, réponses JSON, auteur/date de création, dernier auteur/date de modification, version du document).

Les champs possèdent un identifiant stable, un libellé, un type et une obligation; les choix uniques ont des options identifiables. La validation serveur utilise la définition persistée, jamais une définition envoyée avec les réponses. Elle refuse les champs inconnus, doublons, valeurs non finies, dates civiles impossibles et choix invalides. Le titre et les libellés restent ceux de la version utilisée.

Une modification du modèle crée une version immuable et avance son pointeur courant dans un batch unique. Un formulaire déjà ouvert peut utiliser sa version d’origine si le modèle est encore disponible. Le retrait interdit les nouvelles créations, même depuis un ancien formulaire, mais ne bloque pas les corrections des documents existants. L’édition d’un document ne change ni son dossier ni sa version de modèle. Une table de versions est préférable à une simple copie mutable du modèle courant, qui rendrait les anciens documents ambigus.

### 5. Concurrence et atomicité

Les transferts conservent `cases.version`; le futur statut utilisera ce même compteur. Les modifications de documents, suivis et modèles ont leurs propres compteurs. Elles utilisent une condition sur la version attendue et les droits vivants dans SQL. Une absence de ligne modifiée impose de revérifier l’accès avant de distinguer conflit 409 et entrée invalide; un ancien responsable ne reçoit pas les nouvelles valeurs.

Les déclencheurs contrôlent les invariants et écrivent les événements depuis les valeurs réellement enregistrées. Les créations multi-tables utilisent `DB.batch`, déjà employé et testé dans le projet. Une erreur d’audit fait annuler toute mutation. Aucun enregistrement réussi n’est suivi d’un audit détaché via une tâche de fond. Le contrôle du modèle retiré s’effectue aussi dans la transaction de création du document.

### 6. Contrat d’audit partagé avec les autres changements

Faire évoluer `audit_events` par une nouvelle migration conservant les événements existants. Conserver `id`, `organisation_id`, `actor_id`, `occurred_at`, `case_ids`, `previous_owner_id` et `new_owner_id`. Ajouter `resource_type`, `resource_id`, `template_id`, `template_version`, `previous_status`, `new_status`, `previous_state`, `new_state`, `resource_version` et `operation_id`, tous facultatifs quand inapplicables. `previous_state`/`new_state` représentent uniquement les états techniques de suivi ou de modèle, jamais un texte libre. Les actions métier sont `create`, `read`, `update`, `transfer`; réserver `status_change` au changement de statuts. Les types sont `case`, `note`, `follow_up`, `document`, `document_template`.

Une mutation produit un événement par ressource effectivement créée ou modifiée, lié à un identifiant d’opération commun si un batch touche note et suivi. Les créations et modifications de documents référencent le modèle et sa version. Un modèle sans dossier utilise `case_ids=[]`. Les listes de dossiers peuvent conserver un événement de lecture avec leurs seuls identifiants; les lectures de contenus utilisent des événements identifiant chaque ressource réellement servie. Les pages sont bornées à 25 éléments pour maîtriser les lectures et leurs traces. Les métadonnées de documents servies dans une liste sont aussi une lecture, même sans les réponses.

Le changement d’audit ajoutera la distinction succès/refus et la consultation administrative; celui d’historique filtrera les événements métier persistés. Il n’y aura pas de seconde source d’événements. Ne journaliser ni texte de note, ni participants, ni réponses, ni description de tâche, ni requête brute ou secret. Garder les identifiants d’auteurs désactivés et résoudre leur libellé au rendu autorisé, avec repli « Compte indisponible ».

Pour les nouvelles lectures, réunir la sélection autorisée et la trace dans une opération cohérente : batch de lectures et d’insertions conditionnées sur la même session et le même périmètre, sans envoyer la réponse avant succès complet. Les événements doivent correspondre exactement aux lignes retournées, y compris pagination et versions; ne pas journaliser une sélection préalable devenue périmée. Le contrôle `/acces`, sans données nominatives, demeure sans événement de lecture. Conserver l’immutabilité des événements dans les interfaces métier et les déclencheurs.

### 7. Parcours serveur et limites explicites

Étendre les routes sous `/dossiers/:id` : notes (liste, nouvelle note, création), suivis (modification), documents (liste, choix de modèle, création, détail, modification). Les modèles sont administrés sous `/modeles` avec le contrôle superviseur sur chaque route et requête. Les formulaires restent URL-encodés, avec contrôle d’origine et redirection 303 après succès. Aucun changement d’état ne passe par GET.

La fiche présente l’identité et le responsable, puis les sections Notes et Documents, chacune avec sa pagination indépendante. « Ajouter une note » devient l’action principale et « Ajouter un document » l’action secondaire; l’ouverture d’un dossier reste dans la liste pour une nouvelle personne. Le transfert conserve sa confirmation explicite. Le constructeur de modèle est une liste de champs avec contrôles ajouter, retirer, monter et descendre accessibles au clavier; aucun glisser-déposer obligatoire.

Réutiliser `DESIGN.md`, les contrôles de `views.tsx` et la palette actuelle. Étendre `public/app.js` à toutes les vues de contenu, y compris formulaires et modèles : masquage hors ligne et au retour d’historique, retrait après révocation dans le délai existant. Les valeurs saisies ne sont pas conservées dans localStorage ou les URL. Une erreur de validation ne réaffiche des réponses qu’après contrôle de l’accès courant. Les listes de modèles, hors dossier, revérifient session et rôle; leurs définitions restent internes à l’organisme.

Remplacer la limite globale de 16 Kio par des limites par parcours : 16 Kio pour authentification et opérations existantes, 256 Kio pour notes/documents/modèles. Définir et partager entre validation et formulaires : note 10 000 caractères, nature 160, participants 2 000 au total, suivi 2 000, titre/libellé 160, au plus 30 champs et 30 options par choix, réponse courte 500 et multiligne 10 000. Le corps encodé total reste borné à 256 Kio; les limites sont affichées et les dépassements retournent une erreur explicite sans contenu sensible. Ces bornes protègent le premier parcours sans introduire de pièces jointes.

## Risks / Trade-offs

- [Rapprochement élargissant les droits] → Exiger une décision explicite pour chaque personne ayant plusieurs dossiers; suspendre l’activation tant que le manifeste n’est pas complet.
- [Perte de contexte ancien] → Préserver service, dates, anciens responsables et identifiants dans la provenance de migration, avec les mêmes permissions que le dossier canonique.
- [Modèles trop longs pour un formulaire simple] → Limites visibles et tests de taille encodée; pas d’enregistrement partiel présenté comme un succès.
- [Corps de note non modifiable] → Correction par une nouvelle note et indication dans l’interface. Toute évolution de cette règle devra définir ses versions et sa traçabilité.
- [Accumulation de données sensibles et d’événements] → Pagination bornée et absence de contenu dans l’audit; politique de conservation traitée dans le changement Loi 25, sans promesse de conformité automatique.

## Migration Plan

1. Produire un précontrôle local en lecture seule depuis le schéma actuel : groupes par `(organisation_id, client_id)`, propriétaires, services et identifiants. Aucune comparaison de noms entre personnes et aucun rapprochement entre organismes.
2. Pour chaque groupe multiple, préparer un manifeste explicite choisissant le dossier canonique et le responsable final admissible, avec auteur de décision superviseur, date et liste complète des sources. Vérifier l’autorité du décideur et les versions des sources avant application. Un groupe sans décision bloque la migration globale; un groupe simple conserve son identifiant et son responsable, même désactivé. Aucun transfert implicite vers un intervenant arbitraire.
3. En maintenance, sauvegarder la base locale et appliquer la transformation contrôlée. Préserver les sources dans `legacy_case_provenance`, rendre leurs anciens identifiants résolvables vers le dossier canonique seulement après autorisation courante. Préserver les audits historiques et leurs références d’origine; les lectures d’historique pourront associer ces références via la provenance. Ne pas fabriquer de notes ou d’événements datés dans le passé.
4. Reconstruire les tables/contraintes affectées dans une migration additive versionnée, ajouter les tables de contenu, remettre les déclencheurs et vérifier les clefs étrangères. Tester l’ensemble sur une copie de l’ancien schéma avec dossiers multiples avant toute activation. L’opération doit échouer entièrement si le manifeste a changé, est incomplet ou si une contrainte échoue.
5. Vérifier les nombres de personnes et dossiers sources préservés, la correspondance des audits, les droits du dossier canonique et l’absence de voie d’accès par un ancien identifiant. Mettre à jour les fixtures et les scripts locaux sans réinitialiser silencieusement les données existantes.
6. En cas d’échec avant ouverture, restaurer la sauvegarde et l’ancienne version applicative. Après de nouvelles saisies, ne pas revenir automatiquement à l’ancien schéma : arrêter les écritures, préserver une sauvegarde et préparer une reprise contrôlée. Toute exécution cloud reste une étape distincte après validation locale.

L’ordre conseillé pour l’ensemble est notes/documents, statuts, audit, historique puis tableau superviseur; le tableau et l’audit peuvent être développés en parallèle une fois le socle notes/statuts stabilisé. Les migrations SQL reçoivent leurs numéros lors de l’intégration séquentielle pour éviter les collisions. Lors de la synchronisation OpenSpec, appliquer les deltas dans cet ordre et préserver les exigences cumulées sur `case-records` et `audit-trail`.

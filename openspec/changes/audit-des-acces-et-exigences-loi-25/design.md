# Design

## Context

Voir `proposal.md` pour la motivation et `specs/audit-trail/spec.md` pour les nouveaux comportements. Le projet cible est `suivi-communautaire/`. `src/records.ts` écrit les lectures dans `audit_events`; `migrations/0003_cases.sql` produit les créations/transferts avec des déclencheurs et interdit UPDATE/DELETE du journal. `src/index.tsx` refuse de servir les données si l’audit échoue, mais ne propose pas de route de consultation d’audit. Les erreurs absentes/interdites sont identiques. Les tests D1 couvrent déjà ces invariants.

La conception notes/documents étend le journal aux ressources, versions et identifiants d’opération. Le changement de statuts ajoute `status_change`. Les anciens identifiants de dossiers restent dans les événements et sont associés au dossier canonique par `legacy_case_provenance`. L’audit doit préserver ce contrat cumulatif.

## Goals / Non-Goals

**Goals:** fournir un accès vérifiable aux traces, rendre toute lecture du journal attribuable et établir un dossier documentaire des exigences et preuves avant un pilote réel.

**Non-Goals:** nouvelle plateforme d’observabilité, export de masse, détection automatique d’incidents, SIEM, purge automatique, certification juridique ou modification des contenus métier. La réalisation locale reste fondée sur des données fictives tant que les conditions d’exploitation ne sont pas établies.

## Decisions

### 1. Permission explicite fondée sur le rôle courant

Ajouter à `audit.ts` une opération dédiée de lecture du journal, avec un prédicat nommé de permission `audit:view` : session vivante, profil actif et rôle `superviseur`. Chaque requête SQL inclut l’organisme du profil courant. Aucun nouveau système d’attribution de permissions n’est nécessaire pour les deux rôles actuels; un indicateur d’administration technique est ignoré. Un contrôle de lien seul ou l’accès au dossier serait insuffisant pour protéger l’observation des activités des employés.

Ajouter GET `/audit` et POST `/audit/acces` sous un middleware authentifié explicite, car la protection actuelle ne couvre que `/dossiers/*`. Le second renvoie uniquement une permission booléenne et revérifie rôle, session et organisme initial de l’écran, sans donnée du journal. Un changement d’organisme invalide l’écran au lieu de réinterpréter ses références. Les paramètres clients ne fixent jamais l’organisme de la recherche.

### 2. Faire évoluer le journal canonique

Ajouter par migration les actions `audit_read` et `access_denied`, le type `audit_log`, un résultat `success`/`denied`, `viewed_event_ids` JSON et `route_code` limité à des catégories fixes. Ajouter `sequence INTEGER PRIMARY KEY AUTOINCREMENT` comme ordre d’insertion technique, tout en conservant `id` comme identifiant métier UNIQUE et toutes les colonnes/actions du contrat notes/statuts, dont `operation_id`. À la reconstruction initiale, affecter les séquences dans l’ordre des anciens rowid; aucune chronologie métier n’est déduite de cette séquence. Les insertions existantes qui omettent cette colonne obtiennent automatiquement la valeur suivante. Les anciens événements reçoivent `success`; aucune cible ancienne n’est réécrite. Les contraintes distinguent les formes valides : `audit_read` référence au plus les 25 événements affichés; `access_denied` possède `case_ids=[]`, aucune ressource cible et un résultat `denied`. Les contenus et chaînes libres ne sont pas admis dans ces nouveaux champs.

Le journal reste append-only par les voies applicatives. Ses déclencheurs sont recréés après toute reconstruction de contrainte CHECK. La durée de conservation et un éventuel processus de destruction habilité exigent une décision distincte; le premier parcours n’ajoute aucune commande de purge ni aucune durée présentée comme légale.

### 3. Page cohérente, bornée et journalisée

GET `/audit` valide dossier, acteur, action, dates ISO et curseur. Les dates saisies avec fuseau explicite sont normalisées en UTC et interprétées sur un intervalle début inclus/fin exclue. Une période inversée ou un curseur invalide donne 400. Les références extérieures et absentes donnent la même page vide; aucun sélecteur global n’est utilisé. Le filtre dossier autorise le dossier canonique puis associe ses anciennes références via la provenance du même organisme. Les références d’origine restent visibles comme telles.

Une page contient au plus 25 lignes, triées par `(occurred_at DESC, id DESC)`, avec « Suivants » plutôt qu’un total global coûteux. À la première page, fixer un watermark d’insertion `sequence` du journal dans l’organisme. Les pages suivantes imposent `sequence <= watermark` et un curseur sur date/id : des événements arrivant plus tard ne perturbent pas le parcours, même avec un horodatage égal. Le curseur signé lie watermark, filtres normalisés, session, organisme et version du schéma. Toute reconstruction de table invalide les curseurs. La séquence reste conservée lors des migrations ultérieures et ne remplace jamais l’identifiant métier ni la date de l’action.

Utiliser un batch D1 cohérent : une insertion `audit_read` conditionnée aux droits vivants sélectionne les identifiants réellement éligibles de la page; la lecture suivante ne retourne que ces identifiants, dans le même batch, avec les mêmes droits. Le test de présence d’une ligne suivante n’expose aucun événement supplémentaire. Un garde SQL fait échouer l’opération si la permission a disparu; une page vide produit néanmoins une trace vide. L’insert et la réponse sont indivisibles du point de vue de l’application : aucun résultat n’est envoyé avant réussite complète. La trace nouvellement créée est exclue du snapshot. Les événements `audit_read` ultérieurs sont consultables sans suivre récursivement leurs références.

Résoudre les libellés d’acteurs par jointure autorisée dans leur organisme; un compte désactivé conserve sa référence, un compte indisponible donne un libellé de repli. Ne pas lire les contenus de notes/documents pour construire les lignes. Prévoir les index organisme/date/id et organisme/acteur/date; la recherche `case_ids` emploie les références JSON et la provenance, sans table parallèle de vérité.

### 4. Refus authentifiés sans révéler les cibles

Les handlers de dossiers, contenus et journal enregistrent une seule tentative refusée par requête, après détermination du refus. Catégories fixes : lecture de dossier, écriture de dossier, lecture de contenu, écriture de contenu, consultation du journal. Les cas absent et interdit partagent la même catégorie. La trace appartient à l’organisme de l’acteur authentifié; elle n’enregistre ni identifiant demandé, ni existence de cible, ni URL, IP, recherche, formulaire, cookie ou texte d’erreur.

Ne pas instrumenter les requêtes anonymes, les erreurs de saisie ordinaires, les conflits 409 ou les contrôles périodiques `/acces` et `/audit/acces` comme des refus d’accès métier. En cas d’échec d’écriture d’un refus, retourner une indisponibilité générique sans donnée. Aucun retry récursif n’essaie de journaliser l’échec de la journalisation. Cette portée bornée évite que la trace révèle un dossier d’un autre organisme ou transforme le polling en flux de sécurité artificiel.

### 5. Interface et révocation

Ajouter un lien « Journal des accès » aux superviseurs, des filtres étiquetés et des lignes compactes réutilisant les styles existants de `views.tsx` et `public/styles.css`. Afficher action, résultat, date, acteur et références; distinguer visuellement « Refus » et « Consultation réussie » par le texte. Aucune modification/suppression n’est exposée. Les recherches n’affichent jamais le nom d’une personne suivie.

Étendre `public/app.js` avec un conteneur protégé par permission pour l’audit, en réutilisant ses mécanismes d’annulation et génération de requêtes. Interroger `/audit/acces` toutes les cinq secondes, masquer au retour au premier plan et hors ligne, et retirer données/filtres nominatifs après révocation. Conserver les en-têtes no-store. Un contrôle des seuls identifiants de dossiers ne suffit pas : les événements de modèles et les traces de refus n’ont pas de dossier.

### 6. Preuves et décisions pour l’exploitation

Créer à l’implémentation `suivi-communautaire/PRIVACY.md` : matrice « exigence ou question / source officielle / mesure / preuve / écart / responsable / décision ». Y séparer contrôles techniques démontrables et décisions organisationnelles. Documenter le secteur de l’organisme, le régime applicable, le responsable de protection, les flux/fournisseurs et régions, l’EFVP, conservation/destruction, incidents, accès/rectification et informations aux personnes. Un journal d’accès ne remplace pas un registre d’incidents.

La CAI décrit notamment les EFVP pour les projets de systèmes impliquant des renseignements personnels et les communications hors Québec, ainsi que des obligations de gouvernance et de gestion des incidents. Ces thèmes guident la matrice; leur application précise exige la qualification de l’organisme. [CAI, principaux changements aux lois, consultée le 18 octobre 2026](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25). La source LegisQuébec devra être vérifiée selon le régime retenu; sa page du secteur privé était indisponible lors du cadrage.

Ces décisions conditionnent un futur pilote réel; elles n’empêchent pas l’implémentation et la validation locales sur données fictives. Un point juridique non résolu est marqué comme tel, jamais comme une conformité acquise. Toute mesure produit supplémentaire révélée par cette analyse reçoit son propre changement avant activation réelle.

## Risks / Trade-offs

- [Le journal contient lui-même des renseignements sur les employés] → Accès superviseur explicite, minimisation, audit de ses lectures et examen de nécessité dans l’EFVP.
- [Croissance liée à la lecture du journal] → Une trace par page bornée, snapshot et aucune expansion récursive; conservation décidée avant exploitation.
- [Watermark invalidé par reconstruction] → Curseurs versionnés et rejet après migration; aucun événement n’est supprimé ou réécrit pour paginer.
- [Fuite par erreur ou filtre] → Cas absent/interdit identiques et aucun identifiant de cible dans les refus.
- [Contournement par une requête de données après perte de rôle] → Contrôles SQL vivants et tests avec anciens cookies; masquage navigateur en complément.

## Migration Plan

1. Intégrer les changements notes/documents puis statuts; allouer le numéro SQL suivant à l’intégration et sauvegarder la base locale.
2. Ajouter les champs, contraintes et index sans perdre événements, références anciennes ou `operation_id`; vérifier les comptes par action et l’immutabilité après migration.
3. Déployer localement les lectures, traces de refus et écrans ensemble, avec tests sur données fictives et invalidation des anciens curseurs.
4. En cas d’échec avant ouverture, restaurer la sauvegarde et le code précédent. Après nouvelles écritures, conserver la base et désactiver l’interface concernée; ne pas supprimer les nouvelles traces par un rollback destructif.
5. Produire les preuves locales et le registre des décisions encore requises. Aucune validation locale ni présence de la matrice ne constitue une autorisation d’exploitation avec des données réelles.

## Open Questions

Le nom du responsable organisationnel, le secteur exact, les durées approuvées et les conclusions de l’EFVP restent à renseigner avant un pilote réel. Le parcours technique décrit ici ne dépend pas de ces valeurs; toute conclusion nécessitant un autre comportement donnera lieu à un changement explicite.

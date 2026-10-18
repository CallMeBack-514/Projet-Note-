# Design

## Context

Voir `proposal.md` pour la motivation et `specs/supervisor-dashboard/spec.md` pour le contrat. L'application réelle se trouve dans `suivi-communautaire/` : Hono rend les vues HTML dans `src/views.tsx`; `src/index.tsx` gère les routes, l'authentification et les en-têtes sans cache; `src/records.ts` joint profil actif et session persistée aux lectures D1, y compris aux totaux. La base primaire est utilisée. `listing` retourne 25 dossiers et un total calculé séparément. `destinations` exclut les comptes désactivés : cette fonction ne peut pas fournir le répertoire du tableau.

Le schéma actuel autorise plusieurs dossiers par personne, avec le seul statut Ouvert. Les changements dossier-personne puis Actif/Inactif doivent donc être appliqués avant ce tableau. Leurs migrations et décisions de rapprochement restent leur responsabilité. Aucun doublon n'est rapproché ici, et aucun nom de personne ne sert de clé de dénombrement.

`public/app.js` contrôle au plus 25 identifiants toutes les cinq secondes avec un délai réseau de quatre secondes. Il ne s'initialise pas sans dossier et ne détecte pas un changement de responsable lorsqu'un superviseur garde l'accès. Les tests Workers/D1 et Playwright couvrent déjà les attributions, l'audit avant réponse, les autres équipes, les organismes, le réseau et les réponses retardées; ils fournissent le socle de vérification.

## Goals / Non-Goals

**Goals:** produire une lecture cohérente et bornée du répertoire, de ses agrégats et d'un détail sélectionné; appliquer le même contrôle vivant aux agrégats qu'aux dossiers; actualiser une vue sans fabriquer des événements d'audit pour les dossiers seulement comptés.

**Non-Goals:** changer les attributions ou statuts depuis le tableau, créer un entrepôt de statistiques, ajouter une bibliothèque frontend, exposer les coordonnées ou contenus cliniques dans cette vue, modifier les règles du transfert ou le stockage des notes et documents.

## Decisions

### 1. Une lecture dédiée sur le Worker existant

Ajouter `src/supervision.ts` pour les lectures et contrôles de supervision, une vue dédiée dans `src/views.tsx` et une entrée de navigation visible aux superviseurs. Utiliser `/dossiers/supervision`, enregistré avant `/dossiers/:id`, et `/dossiers/supervision/controle` pour le contrôle POST. Le middleware authentifie la session; chaque requête SQL exige aussi un profil actif de rôle Superviseur et la session non expirée. Un rôle tiré seulement de l'objet `Actor` ne suffit pas. Les sélections sont jointes à l'organisme de ce profil, jamais à un organisme fourni par le navigateur.

Une sélection d'intervenant inexistante ou étrangère reçoit la même erreur non nominative. Un refus de rôle refuse toute l'enveloppe plutôt que retourner un faux tableau vide. Les réponses de contrôle sont des erreurs structurées sans rendu HTML nominatif. Après retrait du rôle, le navigateur masque le tableau et propose « Revenir aux dossiers » vers `/dossiers`, qui revérifie les droits propres au parcours courant; une session invalide conduit à la connexion. Le contrôle POST réutilise les protections d'origine et de type de contenu existantes.

Alternative écartée : filtrer la liste générale en JavaScript. Cela chargerait des données inutiles, ne fournirait pas les intervenants sans dossier et risquerait de désynchroniser les permissions et les compteurs.

### 2. Deux listes paginées, une seule sélection

L'entrée présente un répertoire paginé de tous les profils Intervenant de l'organisme, actifs ou désactivés, même sans dossier; aucune personne suivie n'est retournée avant la sélection d'un intervenant. Le répertoire porte le nom, l'état du compte et les nombres Total, Actif et Inactif. Les lignes sont triées par nom puis identifiant; les dossiers sélectionnés par date d'ouverture décroissante puis identifiant. Chaque liste est limitée à 25 éléments.

Paramètres : `intervenant`, `statut` parmi Tous/Actif/Inactif, `q` limité à 160 caractères, `pageIntervenants` et `pageDossiers` entiers positifs bornés comme la liste actuelle. Une valeur de statut ou un format d'identifiant invalide reçoit une erreur 400; une page invalide revient à 1. Le changement de recherche ou statut ramène la page de dossiers à 1; changer d'intervenant fait de même. La sélection reste explicite même lorsqu'on change la page du répertoire. Une sélection absente affiche « Sélectionnez un intervenant », pas une liste générale de personnes.

Tous est le filtre initial. Le filtre de recherche porte littéralement sur le nom de personne ou l'identifiant du dossier, avec le comportement SQL existant pour la casse et les accents. Il filtre les dossiers et leurs compteurs, sans retirer les intervenants ayant zéro résultat. Sous Inactif, Total = Inactif et Actif = 0; les libellés précisent « selon les filtres ». Le compte désactivé est signalé distinctement. Une page devenue vide propose de revenir à la première page en conservant les filtres.

Alternative écartée : développer tous les dossiers sous chaque intervenant. Cela dépasserait la borne de lecture et d'audit et rendrait les vues mobiles difficiles à parcourir.

### 3. Calcul cohérent, sans cache d'agrégats

Une seule instruction SQL de lecture construit une enveloppe avec des CTE : acteur autorisé, répertoire autorisé, dossiers filtrés, agrégats par responsable, page de répertoire et page de dossiers du responsable sélectionné. Les jointures sur les profils incluent les comptes désactivés; les dossiers sont rattachés par organisme et responsable. Une jointure externe conserve les profils sans résultat. Un marqueur explicite distingue l'absence d'acteur autorisé d'un organisme vide. Les identifiants et filtres sont liés par paramètres.

L'enveloppe contient les 25 lignes de chaque page au plus et les totaux associés, issus du même état de lecture. Les données de dossier retournées sont limitées au nom, identifiant, responsable, statut, date d'ouverture et version utile au contrôle. Les autres champs de `RecordRow`, dont téléphone et courriel, ne sont pas chargés. Un transfert concurrent apparaît entièrement avant ou après cette lecture; une lecture ultérieure voit le nouvel état.

Réutiliser les index `profiles_organisation`, `cases_owner` et `clients_name`. Vérifier le plan de requête avec des données fictives multi-organismes. Ajouter seulement si nécessaire un index couvrant organisme, responsable et statut; aucune migration métier n'est nécessaire à ce changement. L'agrégation reste en SQL et ne matérialise pas tous les identifiants dans le Worker ou l'audit.

Alternative écartée : tableaux de compteurs persistés ou cache. Leur invalidation ajouterait des risques après transfert, changement de statut ou de rôle, sans besoin établi à ce stade.

### 4. Contrôle de fraîcheur propre au tableau

Le rendu initial produit une empreinte opaque de l'enveloppe bornée et des paramètres canoniques. La vérification POST reçoit cette empreinte et les filtres validés; elle recalcule l'enveloppe sous les droits actuels et retourne seulement « inchangé » ou « actualisation nécessaire ». L'empreinte est un HMAC lié à l'acteur et à la session, généré côté serveur avec un contexte distinct à partir du secret existant; aucune session, valeur secrète, recherche ou nom n'y figure en clair. Elle n'accorde jamais de droit. Le calcul couvre aussi noms, état de compte, versions, ordres, totaux et sélection pour détecter une modification visible sans changement d'accès.

Le contrôleur dédié dans `public/app.js` fonctionne même avec zéro dossier. Il conserve la cadence de cinq secondes, avec un délai commun de quatre secondes pour le contrôle et l'éventuel rechargement du fragment du tableau. Si le serveur signale un changement, il masque immédiatement le tableau sensible puis charge une version fraîche de la même route; le remplacement est atomique. Un échec de contrôle ou de rafraîchissement laisse toutes les données sensibles masquées, y compris répertoire, noms de responsables et compteurs. Une génération et l'annulation des requêtes empêchent une réponse ancienne de restaurer un état dépassé. Le retour au premier plan, pageshow, la reconnexion et un changement de filtres déclenchent une vérification; les contrôles s'arrêtent quand l'onglet est caché.

La borne de dix secondes signifie actualisation réussie ou masquage si la vérification ne peut aboutir, dans les mêmes conditions d'onglet actif et réseau que le parcours existant. Le contrôle existant `/acces` reste utilisé par les autres vues; il ne peut pas prouver la fraîcheur d'un regroupement de supervision.

Alternative écartée : renvoyer des données nominatives toutes les cinq secondes. Cela multiplierait les événements de consultation même sans modification visible. Le contrôle opaque n'en produit aucun; seuls les nouveaux rendus de dossiers sont journalisés.

### 5. Audit borné des dossiers effectivement rendus

Avant tout rendu initial ou fragment contenant des dossiers, appeler le contrat de consultation avec les seuls identifiants des lignes retournées, au maximum 25. Un échec renvoie une indisponibilité sans données du détail. Un répertoire seul ou une sélection vide ne crée pas de lecture de dossiers; ses compteurs ne sont pas développés en milliers d'identifiants. Aucun terme de recherche, nom, coordonnées ou contenu n'est copié dans l'audit.

Cette politique réutilise le contrat de `auditRead`, déplacé vers `audit.ts` par le changement notes/documents, et la capacité `audit-trail`. Reprendre son protocole de lecture cohérente : un batch D1 transactionnel sélectionne l'enveloppe et insère la trace à partir de la même sélection paginée sous les mêmes prédicats de session, rôle et organisme. Ne pas journaliser des identifiants collectés par une lecture séparée devenue périmée. Aucun résultat n'est envoyé avant le succès complet; les tests vérifient que les identifiants audités sont exactement ceux de la réponse. Une révocation avant le batch fait refuser toute la lecture, même si `Actor` ou une préparation antérieure était valide; aucune trace de consultation réussie n'est alors ajoutée. Un transfert ou changement de rôle concurrent est ordonné avant ou après cette opération cohérente; la requête suivante applique le nouvel état et le contrôle navigateur masque la vue révoquée. Le contrôle opaque, sans rendu de dossiers, effectue seulement la lecture.

Le changement d'audit élargi pourra enrichir les métadonnées de route indépendamment; il ne constitue pas une dépendance pour cette vue. Les contrôles et pages conservent `no-store` et aucune donnée métier ne va dans le stockage local du navigateur.

## Risks / Trade-offs

- [Base encore au modèle plusieurs dossiers/Ouvert] → appliquer et vérifier dossier-personne puis statuts avant d'activer le tableau; ne pas présenter de comptage de personnes distinctes à partir de l'ancien schéma.
- [Agrégation périodique coûteuse] → bornes de pages, requête SQL unique, vérification des index avec jeu volumineux fictif et arrêt en arrière-plan; aucun chargement de dossiers complets pour compter.
- [Pagination par décalage pendant des transferts] → ordre stable, totaux cohérents par réponse, actualisation automatique et lien vers la première page; aucune promesse d'instantané durable entre plusieurs navigations.
- [Vue sans dossier ignorée par le script actuel] → initialisation dédiée sur le conteneur de supervision et tests de révocation du rôle avec zéro dossier.
- [Interaction avec les tâches parallèles sur `index.tsx`, `views.tsx` et `app.js`] → appliquer dans l'ordre des dépendances et conserver des tests de non-régression sur les parcours intervenants, plutôt que remplacer le contrôle existant.

## Migration Plan

1. Valider l'application locale des changements dossier-personne puis statuts, leurs migrations et la conservation des attributions. Le statut Inactif conserve consultation et édition.
2. Ajouter les lectures, routes, vue et contrôleur du tableau sur la base existante; vérifier le plan SQL avant de décider d'un index additionnel.
3. Exécuter les scénarios Workers/D1 et Playwright dédiés, puis les vérifications existantes. La configuration `cf` et le binding D1 ne changent pas; cette planification ne déclenche aucun déploiement.
4. En cas de retrait, supprimer l'accès à la route et la navigation du tableau et revenir à la liste générale. Aucun retour arrière des données dossier-personne ou des statuts n'est nécessaire; un index additionnel éventuel peut rester sans effet fonctionnel.

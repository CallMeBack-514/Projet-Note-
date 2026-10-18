# Proposal

## Why

Le superviseur doit pouvoir repérer rapidement les personnes suivies par chaque intervenant, sans reconstituer cette répartition depuis une liste générale de dossiers. Une vue dédiée rendra les attributions courantes lisibles à l'échelle de son organisme, au moment où le modèle évolue vers un dossier par personne.

## What Changes

- Ajouter un tableau de supervision regroupant les dossiers-personnes par intervenant responsable, avec le nom de la personne, un identifiant de dossier et un accès au détail autorisé. Permettre de sélectionner un intervenant pour consulter ses dossiers.
- Afficher des nombres de dossiers par intervenant et distinguer les statuts Actif et Inactif définis dans le changement dédié. Les totaux doivent correspondre au même périmètre et aux mêmes filtres que les dossiers affichés; ils décrivent les attributions, sans évaluer la performance ni la complexité clinique.
- Couvrir tous les intervenants de l'organisme du superviseur, y compris ceux rattachés à d'autres superviseurs. Conserver visibles les dossiers attribués à un compte désactivé, conformément aux règles existantes, afin qu'ils puissent être retrouvés puis transférés depuis le parcours du dossier.
- Réserver la vue de supervision au rôle Superviseur. Appliquer les permissions courantes aux listes, recherches, regroupements, compteurs et liens directs : aucune donnée d'un autre organisme ne doit être révélée, et les intervenants continuent de voir uniquement leurs propres dossiers dans leur parcours habituel.
- Refléter les transferts et changements d'accès dans les regroupements et les totaux. Les requêtes doivent respecter immédiatement les droits courants; la vue ouverte doit reprendre les garanties existantes de revérification, de masquage en cas d'échec de contrôle et d'absence de cache HTTP sensible.
- Proposer une interface en français utilisable au clavier et sur téléphone, avec des états vides explicites. La vue consulte les attributions existantes; elle n'ajoute pas de circuit d'approbation ou d'attribution en lot.

## Capabilities

### New Capabilities

- `supervisor-dashboard` : consultation par le superviseur de la répartition courante des dossiers-personnes entre les intervenants de son organisme, avec navigation vers les dossiers, ventilation par statut et agrégats limités aux permissions courantes.

### Modified Capabilities

Aucune. Les règles de `organisation-access`, `case-assignment` et `case-records` sont réutilisées sans élargir les autorisations ni modifier le transfert.

## Impact

Les écrans de navigation du superviseur, les lectures et agrégations des dossiers, ainsi que les contrôles et tests d'accès devront intégrer cette vue. Aucun nouveau rôle ou droit transversal n'est nécessaire. L'architecture Cloudflare unifiée et les essais locaux restent le socle.

Le changement dépend de `notes-et-documents-du-dossier-personne` pour le modèle cible et le rapprochement des dossiers existants : la vue ne doit pas assimiler prématurément le nombre actuel de dossiers à un nombre de personnes distinctes. Il dépend de `statuts-actif-inactif-des-dossiers` pour la définition, la reprise et les règles des statuts; il les consomme sans définir leur cycle de vie. Le statut d'un dossier et l'activation d'un compte intervenant restent distincts.

La conception précisera les filtres affichés par défaut, la présentation des intervenants sans dossier et l'actualisation des regroupements après un transfert, dans le respect des garanties d'accès existantes. Ces choix ne doivent pas restreindre le superviseur à sa seule équipe. Les notes, documents, journaux d'historique ou d'audit, exports, alertes, classements de performance et ratios cliniques sont hors périmètre.

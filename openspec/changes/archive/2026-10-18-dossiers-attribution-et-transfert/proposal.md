# Proposal

## Why

Les organismes communautaires ont besoin de dossiers centralisés dont l'accès suit la responsabilité réelle des intervenants. Ce premier parcours doit permettre la création d'un usager et de son dossier, sa consultation autorisée et son transfert sans conserver les droits de l'ancien intervenant.

## What Changes

- Créer une application web en français, adaptée aux ordinateurs et téléphones, avec authentification et séparation des organismes, réunie dans un seul projet TypeScript hébergeable sur Cloudflare Workers avec D1.
- Implémenter les rôles Intervenant et Superviseur. Chaque intervenant appartient à un superviseur du même organisme; un superviseur encadre plusieurs intervenants.
- Séparer l'usager, qui représente une personne, du dossier, qui représente son accompagnement dans un service.
- Permettre à l'intervenant de créer un usager et un dossier initialement attribué à lui-même; permettre au superviseur de créer un dossier en choisissant un intervenant actif de son organisme.
- Limiter l'intervenant aux dossiers qui lui sont attribués. Donner au superviseur accès à tous les dossiers de son organisme, au-delà des seuls intervenants qui lui sont rattachés.
- Permettre au responsable actuel ou à un superviseur de transférer le dossier à un autre intervenant actif du même organisme, y compris dans une autre équipe.
- Remplacer le responsable et retirer les droits de l'ancien intervenant dans une même opération. Vérifier les droits côté serveur à chaque requête, même avec un lien direct ou une session déjà ouverte; actualiser les vues devenues non autorisées.
- Tracer les créations, consultations et transferts avec l'auteur, la date et les responsables concernés.
- Garder les notes, la dictée IA, les statistiques, les exports et les autres rôles pour des changements ultérieurs.

## Capabilities

### New Capabilities

- `organisation-access`: Authentification, rôles, rattachement hiérarchique et isolation entre organismes.
- `case-records`: Création des usagers et dossiers, listes et consultation selon les droits courants.
- `case-assignment`: Attribution unique, transfert autorisé et révocation des droits de l'ancien responsable.
- `audit-trail`: Traçabilité des créations, consultations et transferts de dossiers.

### Modified Capabilities

Aucune : le projet ne possède pas encore de spécifications applicatives.

## Impact

- Création du code applicatif dans un sous-dossier dédié du workspace; les fichiers de recherche existants ne font pas partie de l'application.
- Introduction de Cloudflare Workers pour l'application et les fichiers statiques, de D1 pour les données relationnelles et les sessions, et de migrations SQL. Hono et Better Auth s'exécutent dans le même Worker; les contrôles d'accès restent côté serveur.
- Introduction d'écrans de connexion, de liste, de création, de détail et de transfert.
- Tests d'intégration couvrant les deux rôles, plusieurs organismes, les transferts entre équipes, les sessions ouvertes et les accès concurrents.
- Documentation du lancement local avec données fictives et de la préparation au déploiement Cloudflare avec la CLI `cf`, sans serveur de base externe à administrer. Le déploiement effectif et les exigences du pilote réel restent des étapes distinctes.

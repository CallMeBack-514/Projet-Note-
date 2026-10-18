# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Architecture validée dans OpenSpec : un projet TypeScript, Hono, Better Auth, Cloudflare Workers et D1. Hébergement Cloudflare explicitement demandé; développement et tests locaux avant déploiement.

## Users

Intervenants et superviseurs d'organismes communautaires offrant de l'accompagnement psychosocial. Usage au bureau et sur téléphone après une intervention de terrain.

## Product Purpose

Créer, retrouver et transmettre les dossiers d'accompagnement en assurant une continuité de suivi et des accès limités aux responsabilités réelles.

## Operating Context

Un intervenant voit ses dossiers. Un superviseur voit tous les dossiers de son organisme. Chaque intervenant relève d'un superviseur. Les dossiers se transfèrent à un intervenant actif du même organisme; l'ancien responsable perd immédiatement l'accès côté serveur.

## Capabilities and Constraints

Premier parcours : connexion, création d'un usager et de son dossier, recherche, fiche, transfert, audit. Personne et dossier sont distincts. Les notes et l'IA viennent plus tard. Français; interface ordinateur et téléphone. Pas de données réelles ni de déploiement dans cette première livraison locale. Gestion des comptes par outil contrôlé, pas d'inscription publique.

## Evidence on Hand

Fiche technique utilisateur et proposition/specs/design dans ../openspec/changes/dossiers-attribution-et-transfert/. Aucun nom commercial ni logo confirmé. Nom de travail descriptif : Suivi communautaire. Données de démonstration explicitement fictives.

## Product Principles

- Montrer uniquement les dossiers autorisés.
- Rendre la responsabilité de chaque dossier compréhensible.
- Limiter les informations demandées à la création.
- Privilégier la continuité du travail et les actions explicites.

## Accessibility & Inclusion

Navigation clavier, champs étiquetés, erreurs compréhensibles en français, utilisation à 375 pixels sans défilement horizontal de la page.

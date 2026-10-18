# Proposal

## Why

L’organisme doit pouvoir déterminer qui a consulté quel dossier-personne et à quel moment, à partir des traces déjà enregistrées. Cette visibilité doit soutenir une démarche de protection des renseignements personnels et un cadrage des exigences applicables de la Loi 25 avant l’utilisation de données réelles.

## What Changes

- Rendre le journal technique consultable et filtrable par dossier, acteur, période et type d’action, dans le seul organisme autorisé. Distinguer les consultations effectivement servies des mutations réussies et des éventuels refus, sans présenter une tentative refusée comme un accès réussi.
- Définir une permission explicite de consultation du journal. L’hypothèse à confirmer en conception est un accès réservé aux superviseurs de l’organisme; le rôle d’administration technique seul ne confère aucun droit. Les intervenants ne reçoivent pas implicitement cette permission avec l’accès à leur dossier.
- Préserver les garanties existantes : événements attribuables et minimisés, absence de contenu des notes ou documents dans le journal, impossibilité de modification par les utilisateurs métier, cohérence des mutations avec leur trace et refus de servir les données lorsque leur consultation ne peut être journalisée.
- Contrôler aussi l’accès au journal et tracer ses consultations de manière minimisée. Aucun filtre, lien ou résultat ne doit contourner l’isolation entre organismes ou les droits courants sur les dossiers.
- Documenter les exigences applicables, les mesures déjà couvertes, les écarts et les décisions nécessaires avant un pilote réel : qualification de l’organisme et du régime juridique, responsable de la protection des renseignements personnels, EFVP, conservation et destruction, gestion des incidents, droits des personnes et flux de données ou fournisseurs hors Québec. Cette documentation de projet ne certifie pas la conformité du produit.
- Séparer cette consultation technique de la chronologie métier affichée sur la fiche. La génération des événements de notes, documents et statuts reste dans les changements qui introduisent ces actions.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `audit-trail` : consultation filtrée et autorisée des traces, contrôle et journalisation de l’accès au journal, sans altérer ses garanties de minimisation, de cohérence et de protection.

## Impact

La lecture du journal, ses contrôles d’accès, son interface française et les vérifications d’isolation devront évoluer. La conception précisera les personnes habilitées, la conservation des traces, les informations minimales nécessaires à leur interprétation et le traitement des refus d’accès. Aucun délai légal de conservation ni droit d’export général n’est présumé.

Le socle `audit-trail` existe déjà. `notes-et-documents-du-dossier-personne` et `statuts-actif-inactif-des-dossiers` produisent les événements propres à leurs fonctionnalités; ce changement les exploite lorsqu’ils sont disponibles sans les recréer. `historique-des-actions-du-dossier` reste indépendant de l’écran d’audit. Le passage au dossier-personne appartient au changement notes et documents; l’audit conserve les références existantes sans fusion implicite ni perte des traces.

Le cadrage juridique devra déterminer le secteur et les règles applicables à l’organisme. La CAI présente des obligations dépassant largement la journalisation, notamment en matière de gouvernance, d’incidents et d’EFVP pour les projets de systèmes impliquant des renseignements personnels; l’EFVP et les écarts devront être cadrés avant le pilote réel. La proposition ne vaut pas avis juridique ni affirmation de conformité. [Source officielle : CAI, principaux changements aux lois sur la protection des renseignements personnels, consultée le 18 octobre 2026](https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25).

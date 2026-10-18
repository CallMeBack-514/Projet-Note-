# Tasks

## 1. Reprise vers un dossier par personne

- [x] 1.1 Créer le précontrôle local et le format de manifeste de rapprochement décrits dans design.md; vérifier sur fixtures anciennes les cas simple, multiples de même responsable, responsables distincts, homonymes et organismes différents sans modifier la base.
- [x] 1.2 Implémenter la migration contrôlée vers l’unicité par personne et la provenance des anciens dossiers, en conservant identifiants, services, responsables et audits; vérifier sous D1 qu’un manifeste incomplet, périmé ou non autorisé annule la transformation et que les clefs étrangères restent valides.
- [x] 1.3 Adapter createRecord, les formulaires et la résolution des anciens liens au dossier unique sans service obligatoire; mettre à jour les tests records existants pour prouver la création atomique, la réutilisation autorisée, les refus génériques et l’absence de deuxième dossier pour le même client_id.
- [x] 1.4 Documenter précontrôle, maintenance, sauvegarde et restauration dans le README et un guide de migration; rejouer les commandes sur une copie locale fictive et constater que les scripts setup/demo ne détruisent ni ne dupliquent les données.

## 2. Autorisation et audit du contenu

- [x] 2.1 Extraire les contrôles partagés de session, profil et dossier sans affaiblir les requêtes SQL; vérifier les tests existants de collègue, autre équipe, autre organisme, expiration, désactivation et transfert concurrent.
- [x] 2.2 Ajouter le contrat étendu audit_events et le module audit.ts, en conservant les événements historiques et les protections contre modification/suppression; vérifier champs minimisés, références de ressource/version et opération commune dans des tests D1.
- [x] 2.3 Implémenter les lectures autorisées et leur audit cohérent dans un batch borné, sans envoyer de données en cas d’échec; tester exactement les objets retournés, la révocation entre étapes, une page vide et une panne d’audit. Documenter le contrat utilisable par statuts, audit et historique.

## 3. Notes et tâches de suivi

- [x] 3.1 Ajouter les tables, contraintes et déclencheurs de notes/suivis avec rattachement au même organisme et provenance serveur; vérifier qu’une note avec suivi invalide ou audit impossible ne laisse aucune écriture et qu’un corps de note ne peut pas être réécrit.
- [x] 3.2 Implémenter validation des notes, participants, nature et date/heure avec fuseau/décalage; tester auteur falsifié, saisie antidatée, heure inexistante ou répétée à Toronto, entrées vides et limites de longueur.
- [x] 3.3 Implémenter lecture paginée des notes et modification concurrente du suivi, y compris clôture/réouverture; vérifier ordre stable, droits après transfert, provenance de clôture et absence d’événement de succès après conflit.
- [x] 3.4 Ajouter routes et vues de saisie/lecture des notes et du suivi dans les composants existants; vérifier en HTTP le texte échappé, les erreurs de champs, CSRF, non-cache et redirection après succès. Documenter la correction par nouvelle note et l’absence de rappels automatiques.

## 4. Modèles de documents

- [x] 4.1 Ajouter modèles, versions immuables, validation partagée des cinq types de champs et opérations superviseur; tester champs/options en doublon, définition invalide, autre organisme, intervenant refusé et rollback de l’audit.
- [x] 4.2 Implémenter création de version et retrait sous contrôle de concurrence; vérifier deux superviseurs concurrents, conservation des versions utilisées et disponibilité revérifiée au moment de créer un document.
- [ ] 4.3 Ajouter le constructeur de modèle en français avec ordre des champs, types, obligation et choix; vérifier au clavier et à 375 pixels l’ajout/retrait/réorganisation, l’échappement des libellés et les erreurs. Documenter le rôle du superviseur et la définition du contenu par l’organisme.

## 5. Documents remplis

- [x] 5.1 Ajouter les documents rattachés à une version de modèle, validation des réponses et audit transactionnel; tester types/dates/options, champs inconnus, références falsifiées, modèle retiré et absence de document partiel.
- [x] 5.2 Implémenter édition avec version attendue et conservation de la provenance de création; vérifier conflits, modèle ayant évolué ou retiré, ancien formulaire valide sur sa version, et refus de l’ancien auteur après transfert.
- [x] 5.3 Ajouter choix de modèle, formulaire dynamique, liste paginée et détail de document; vérifier états vides, libellés de la version d’origine, dates/auteurs, conservation autorisée des valeurs après validation et rendu inerte. Documenter les possibilités et limites du formulaire.

## 6. Fiche, protection des vues et cohérence locale

- [x] 6.1 Remplacer l’action de dossier supplémentaire par Ajouter une note et Ajouter un document, avec sections et paginations indépendantes; vérifier que les anciennes routes ne contournent pas l’unicité et adapter PRODUCT.md, DESIGN.md et le contrat de surface à la nouvelle fiche.
- [ ] 6.2 Étendre public/app.js aux pages enfants et formulaires, ainsi qu’au contrôle de session/rôle des modèles; vérifier en Playwright les données retirées dans le délai existant après transfert, le masquage hors ligne, le retour d’historique et l’absence de stockage persistant des saisies.
- [x] 6.3 Appliquer les limites de corps par route et limites de champs partagées; vérifier notes/documents URL-encodés longs et multioctets, réponses 413 sans fuite, ainsi que la limite inchangée sur authentification et transferts.
- [ ] 6.4 Adapter le parcours Playwright aux personnes distinctes, notes, suivi et documents versionnés, avec deux organismes et plusieurs équipes; vérifier création, édition, transfert, ancien auteur refusé, nouveau responsable autorisé, superviseur transverse et ergonomie clavier/téléphone.
- [ ] 6.5 Exécuter npm run typecheck, npm test, npm run build et npm run test:browser depuis suivi-communautaire; consigner les résultats réels dans VALIDATION.md et confirmer que le parcours complet fonctionne avec D1 local sans ressource distante.

## Workflow follow-up

- Appliquer ensuite le changement de statuts; intégrer le contrat commun avant audit, historique et tableau superviseur.
- Synchroniser puis archiver après vérification de l’implémentation, en préservant les deltas cumulés avec les changements suivants.

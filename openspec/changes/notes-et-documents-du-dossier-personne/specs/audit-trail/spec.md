# Traçabilité du contenu des dossiers

## MODIFIED Requirements

### Requirement: Événements attribuables et minimisés
Le système SHALL tracer les créations, consultations, modifications et transferts réussis concernant les dossiers, notes, suivis, documents et modèles. Chaque événement SHALL identifier l’organisme, l’acteur, l’action, l’heure et les objets concernés, avec les dossiers lorsqu’applicables. Un transfert MUST identifier les anciens et nouveaux responsables. Le journal MUST NOT recopier de contenu personnel, de secret ou de réponse de formulaire.

#### Scenario: Création réussie
- **WHEN** un dossier est créé
- **THEN** un événement de création permet d’identifier l’acteur, l’organisme, le dossier, la date et son responsable initial.

#### Scenario: Consultation d'une liste ou d'une fiche
- **WHEN** une liste contenant des dossiers ou une fiche est retournée à un utilisateur
- **THEN** un événement identifie les dossiers effectivement retournés et l’acteur qui les consulte
- **AND** une simple vérification d’accès sans données nominatives ne produit pas un événement de consultation.

#### Scenario: Transfert réussi
- **WHEN** un dossier est transféré de A à B par S
- **THEN** un événement indique A comme ancien responsable, B comme nouveau responsable et S comme auteur du transfert.

#### Scenario: Note et suivi enregistrés
- **WHEN** une note avec un suivi est créée ou qu’un suivi est modifié
- **THEN** la trace identifie l’acteur, le dossier, les objets concernés et la nature de l’opération
- **AND** elle ne contient ni texte de la note, ni participants, ni description de la tâche de suivi.

#### Scenario: Document ajouté ou modifié
- **WHEN** un document est créé ou ses réponses sont modifiées
- **THEN** un événement identifie le dossier, le document, la version du modèle, l’acteur et l’horodatage réel de l’action
- **AND** aucune réponse du formulaire n’est copiée dans l’événement.

#### Scenario: Modèle créé, modifié ou retiré
- **WHEN** un superviseur crée, fait évoluer ou retire un modèle
- **THEN** un événement identifie l’organisme, le modèle, sa version, l’acteur et l’action
- **AND** aucun identifiant de dossier fictif n’est ajouté pour cette opération à l’échelle de l’organisme.

#### Scenario: Consultation ciblée d'une note ou d'un document
- **WHEN** des notes, suivis ou documents sont retournés à un utilisateur autorisé
- **THEN** la trace identifie les éléments effectivement servis et leur dossier
- **AND** elle ne mentionne pas comme consultés les éléments d’autres pages ou les éléments refusés.

### Requirement: Cohérence avec l'opération
Le système SHALL enregistrer chaque événement de mutation avec l’opération correspondante de façon indivisible. Une consultation MUST échouer sans données nominatives si sa trace ne peut pas être enregistrée. Un refus ou un conflit MUST NOT créer d’événement de succès. Cette cohérence SHALL couvrir les dossiers, notes, suivis, documents et modèles.

#### Scenario: Échec de création
- **WHEN** la création de l’usager, du dossier ou de son événement échoue
- **THEN** aucune de ces créations partielles ne persiste.

#### Scenario: Journal indisponible à la lecture
- **WHEN** l’événement de consultation ne peut pas être enregistré
- **THEN** les données du dossier ne sont pas retournées et un message d’indisponibilité est affiché.

#### Scenario: Tentative interdite
- **WHEN** un utilisateur tente de consulter un dossier non autorisé
- **THEN** aucun événement de consultation réussie n’est créé.

#### Scenario: Échec d'audit lors d'une mutation de contenu
- **WHEN** l’événement d’ajout de note, de modification de suivi ou de document, ou de gestion d’un modèle ne peut pas être enregistré
- **THEN** la mutation entière est annulée et les données précédentes sont conservées sans événement de succès.

#### Scenario: Note avec suivi partiellement invalide
- **WHEN** une note et sa tâche de suivi sont soumises ensemble mais que l’un des éléments ne peut pas être enregistré
- **THEN** ni la note ni le suivi ni leur événement de succès ne persistent.

#### Scenario: Modification concurrente refusée
- **WHEN** une modification est refusée parce que la version du document, du suivi ou du modèle est obsolète
- **THEN** aucun événement ne présente cette tentative comme une modification réussie.

#### Scenario: Consultation de contenu non journalisable
- **WHEN** l’événement nécessaire à la lecture d’une note ou d’un document échoue
- **THEN** ni le texte, ni les participants, ni les réponses ou tâches de suivi ne figurent dans la réponse d’erreur.

### Requirement: Journal protégé des modifications métier
Le système SHALL conserver les événements existants lors des transferts, changements de contenu et évolutions de modèles. Les utilisateurs métier MUST NOT pouvoir modifier ou supprimer les événements, ni accéder par leurs références à des dossiers ou éléments non autorisés. La provenance des auteurs SHALL rester interprétable après désactivation d’un compte.

#### Scenario: Plusieurs transferts successifs
- **WHEN** un dossier passe de A à B puis de B à C
- **THEN** les deux événements distincts sont conservés dans l’ordre avec leurs auteurs et destinataires.

#### Scenario: Modification directe d'un événement
- **WHEN** un intervenant ou superviseur tente de modifier ou supprimer un événement par l’application
- **THEN** aucune opération de ce type n’est disponible ou acceptée.

#### Scenario: Document modifié après transfert
- **WHEN** un document créé par A est modifié par B après transfert du dossier
- **THEN** les événements de création, de transfert et de modification restent distincts avec leurs auteurs respectifs.

#### Scenario: Auteur désactivé
- **WHEN** le compte d’un auteur d’événement est désactivé
- **THEN** sa référence de provenance et les événements existants sont conservés, sans maintenir d’accès pour ce compte.

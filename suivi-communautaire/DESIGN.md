---
name: "Suivi communautaire"
description: "Un espace de travail calme et lisible pour les dossiers et leur transmission."
colors:
  pine: "#234c40"
  pine-dark: "#183b30"
  sage: "#e3ece5"
  linen: "#f7f7f2"
  paper: "#fff"
  ink: "#233b32"
  muted: "#5a6b62"
  line: "#d5dfd7"
  error: "#8b2b29"
  focus: "#9b5b14"
  field-border: "#9bae9f"
  pressed: "#c8dacb"
  nav-current: "#365e4e"
  nav-hover: "#416c59"
  rail-text: "#f1f6ee"
  rail-secondary: "#d2e1d5"
  rail-note: "#c5d9cb"
  rail-divider: "#597666"
  logout-text: "#e2eee4"
  table-heading: "#f0f4ef"
  row-hover: "#f8faf7"
  notice-border: "#adc6b3"
  notice-bg: "#edf5ee"
  error-border: "#ddaaa0"
  error-bg: "#fcf0eb"
  selection: "#c7dfcb"
  scrollbar: "#7c9184"
  intro-text: "#eef6ed"
  intro-secondary: "#cfe0d2"
typography:
  display:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "2.6rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "2rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  headline-mobile:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.7rem"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  title:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "1.16rem"
    fontWeight: 650
    lineHeight: 1.35
  body:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.9rem"
    fontWeight: 550
    lineHeight: 1.5
  control:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.92rem"
    fontWeight: 600
    lineHeight: 1.5
  badge:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
  reference:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "0.73rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.035em"
rounded:
  badge: "4px"
  field: "6px"
  control: "8px"
  surface: "12px"
spacing:
  "8": "8px"
  "12": "12px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "28": "28px"
  "32": "32px"
  "36": "36px"
  "40": "40px"
  "48": "48px"
  "52": "52px"
components:
  button-primary:
    backgroundColor: "{colors.pine}"
    textColor: "{colors.paper}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.pine-dark}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.pine}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-secondary-hover:
    backgroundColor: "{colors.sage}"
  button-active:
    backgroundColor: "{colors.pressed}"
    textColor: "{colors.pine-dark}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  nav-current:
    backgroundColor: "{colors.nav-current}"
    textColor: "{colors.paper}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  nav-hover:
    backgroundColor: "{colors.nav-hover}"
  badge:
    backgroundColor: "{colors.sage}"
    textColor: "{colors.pine}"
    typography: "{typography.badge}"
    rounded: "{rounded.badge}"
    padding: "3px 8px"
  record-form:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.surface}"
    padding: "32px"
  notice:
    backgroundColor: "{colors.notice-bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "16px 20px"
  notice-error:
    backgroundColor: "{colors.error-bg}"
    textColor: "{colors.error}"
    rounded: "{rounded.control}"
    padding: "16px 20px"
---

# Design System: Suivi communautaire

## Overview

**Creative North Star: "L’accueil communautaire"**

Le système reprend les repères calmes d’un lieu d’accueil : pin profond, sauge pâle et fond lin. La typographie système et les contrôles familiers donnent la priorité à la lecture et aux gestes de travail. Les surfaces blanches et les séparateurs fins organisent l’information sans ajouter de décor.

La personnalité reste sobre et accessible, avec des angles doucement arrondis et des espaces réguliers. Le système livré utilise un petit signe SVG géométrique dans la marque; aucune image raster ni police externe n’est livrée.

**Key Characteristics:**

- Palette pin, sauge et lin; états fonctionnels différenciés.
- Typographie système, titres compacts et libellés explicites.
- Surfaces plates, bordures fines et coins modérément arrondis.
- Focus visible et composition adaptée au téléphone.

Cette référence décrit le code livré dans `public/styles.css` et `src/views.tsx`, après la revue de disposition `ship`. Les valeurs du frontmatter sont normatives; les noms descriptifs des couleurs littérales servent à les identifier sans créer de nouvelles variables CSS. Le contrat de chaque surface demeure dans `.impeccable/surfaces/`.

## Colors

La palette associe un vert profond à des neutres légèrement verts; les tons chauds sont réservés au focus et aux erreurs.

### Primary

- **Pin** (`pine`) : actions principales, liens, rail, introduction et texte des badges.
- **Pin profond** (`pine-dark`) : survol du bouton principal et texte lors d’une pression.
- **Sauge** (`sage`) : badge Ouvert et survol du bouton secondaire.
- **Pin de navigation** (`nav-current`, `nav-hover`) : fond du lien courant et son survol dans le rail.
- **Sauge de pression** (`pressed`) : état actif commun aux deux variantes de bouton.

### Neutral

- **Lin** (`linen`) : fond général; **papier** (`paper`) : surfaces et champs.
- **Encre** (`ink`) et **texte secondaire** (`muted`) : lecture principale, aides et métadonnées.
- **Séparateur** (`line`) et **bordure de champ** (`field-border`) : structure des surfaces et reconnaissance des contrôles.
- **En-tête de liste** (`table-heading`) et **survol de ligne** (`row-hover`) : repérage discret dans les dossiers.
- Les tons `rail-text`, `rail-secondary`, `rail-note`, `rail-divider`, `logout-text`, `intro-text` et `intro-secondary` sont les nuances déjà présentes sur les fonds sombres.

### Functional states

- **Information** (`notice-bg`, `notice-border`) : fond et bordure du message de statut; texte en encre.
- **Erreur** (`error`, `error-bg`, `error-border`) : texte, fond et bordure du message d’erreur.
- **Focus** (`focus`) : contour clavier commun; il n’est pas une couleur d’action principale.
- **Sélection** (`selection`) : sélection de texte avec texte pin profond; `scrollbar` : poignée de défilement.

Aucune gamme tonale à huit étapes n’existe dans les CSS. Le sidecar conserve les métadonnées de ces couleurs sans inventer de teintes intermédiaires.

## Typography

**Display Font / Body Font :** même pile système, définie dans le frontmatter. Aucune police distante.

La hiérarchie repose sur la taille, la graisse et l’espacement. La base est en `body`; les champs héritent de cette police. Les titres emploient une graisse intermédiaire forte sans capitales décoratives.

- **Display** : grand titre d’introduction de la connexion, masqué sur téléphone.
- **Headline** : titre de page; passe à `headline-mobile` au seuil mobile.
- **Title** : titres de sections. Le titre de connexion est une variation locale (1.75rem).
- **Body** : texte courant, interligne confortable; paragraphes limités à 70ch, introduction à 36ch.
- **Label / Control** : étiquettes et actions, avec une graisse distincte.
- **Badge / Reference** : état compact et identifiant. Les références et le décompte utilisent des chiffres tabulaires.

Les tailles locales des aides, métadonnées et liens secondaires restent celles de la feuille de styles; elles ne constituent pas de nouvelles familles typographiques.

## Layout

Sur ordinateur, la coque emploie un rail de 248px et une zone de contenu flexible. Le contenu est centré, limité à 1500px et espacé de 52px verticalement et 6% horizontalement. À 1100px et moins, le rail passe à 210px et la marge intérieure du contenu à 40px / 4%.

À 760px et moins, le rail devient un en-tête compact; la marque graphique, la navigation latérale et sa phrase secondaire sont masquées. Le contenu reçoit 28px / 20px, les titres et actions s’empilent et les lignes de dossiers deviennent une grille à deux colonnes avec service et responsable sur des lignes distinctes. Les étiquettes de ces deux informations deviennent visibles.

La fiche utilise deux colonnes (1.2fr / 1fr), puis une pile au seuil mobile. Les formulaires sont limités à 740px; les paires de champs passent de deux colonnes à une. La connexion utilise deux moitiés sur ordinateur, puis un en-tête court et un formulaire sur téléphone. Le formulaire de connexion a une largeur maximale de 460px.

Les espacements partagés sont relevés dans le frontmatter. Les contenus longs peuvent se couper dans les lignes, les valeurs de fiche et l’identité du compte sur téléphone. Les actions de formulaire et la pagination peuvent revenir à la ligne sur petit écran.

## Elevation & Depth

Aucune ombre n’est définie. La profondeur provient des fonds lin, papier et sauge, des bordures fines et des séparateurs. Le focus est un contour fonctionnel (3px, décalage 4px), pas une élévation. Aucune texture, transparence floutée ou animation d’entrée n’est présente.

## Shapes

Les surfaces ont un arrondi `surface`, les boutons et notices un arrondi `control`, les champs et la navigation un arrondi `field`, et les badges un arrondi `badge`. Les bordures structurelles font 1px. Les formes sont rectangulaires; le badge n’est pas une pilule. La marque présente deux carrés décalés en SVG au trait, sans image raster.

## Components

### Buttons

Deux variantes existent : principale pleine et secondaire transparente à bordure. Elles partagent une hauteur minimale de 44px, le token `control` et une transition de couleur et de fond de 160ms avec `ease`. Le survol principal emploie le pin profond; le secondaire la sauge. La pression utilise le fond `pressed` et le texte pin profond. Le bouton désactivé conserve sa variante avec une opacité de 0.55 et un curseur indisponible. Aucun style d’erreur de bouton n’est défini.

### Inputs / Fields

Champs et listes natives ont un fond papier, une bordure `field-border`, une hauteur minimale de 46px et une marge supérieure de 7px sous le libellé. Le texte d’exemple est secondaire et opaque. Le caret utilise le pin. Le contour commun de focus s’applique; aucun changement de bordure au survol, palette d’erreur par champ ou traitement visuel personnalisé de champ désactivé n’est défini.

### Navigation

Le lien Dossiers courant est un rectangle rempli dans le rail, avec texte blanc et graisse 600. Son survol emploie `nav-hover`. Les liens ordinaires utilisent le pin, un soulignement décalé de 4px et un trait de 2px au survol. Le lien de saut au contenu devient visible au focus. La déconnexion est un bouton textuel souligné, intégré au compte.

### Chips

Le badge **Ouvert** est une étiquette statique sauge/pin, compacte et légèrement arrondie. Aucun état sélectionné, survol ou pression n’est défini pour ce badge.

### Cards / Containers

La liste, la fiche et les formulaires sont des surfaces papier bordées, sans ombre. La liste masque le débordement à ses coins; le formulaire a une marge intérieure de 32px, réduite à 22px / 18px sur téléphone. La fiche passe de 36px à 28px au seuil intermédiaire, puis 24px sur téléphone. Les séparateurs distinguent les groupes, sans multiplier les cartes.

### Record rows

La ligne place l’usager et sa référence en premier, puis le service, le responsable et l’état. Sa hauteur minimale est de 100px, avec un survol pâle et une bordure supérieure. Seul le nom est un lien; la ligne entière n’est pas un bouton. La version téléphone garde l’état près du nom et rend les libellés de service et de responsable visibles.

### Notices

Les messages emploient le même cadre arrondi et deux palettes : information et erreur. Le statut porte `role="status"`; l’erreur porte `role="alert"`. Le texte exprime le résultat ou le problème en plus de la couleur. Le conteneur devient vertical sur téléphone.

### Transfer handoff

Le relais est un formulaire dédié : responsable actuel, séparateur, choix du nouvel intervenant, conséquence expliquée, puis confirmation et annulation. L’espacement de la pile est de 28px; le premier bloc a un séparateur après 24px. Il réutilise les champs et boutons existants, sans flèche décorative ni animation.

Le média `prefers-reduced-motion: reduce` supprime les transitions. Le sidecar reproduit les styles des composants et leurs états existants; ses exemples sont statiques et n’exécutent aucune opération métier.

## Do's and Don'ts

### Do:

- Do conserver les tokens observés et les états associés dans la feuille de styles.
- Do garder les libellés visibles, les champs natifs et le contour de focus sur les éléments interactifs.
- Do préserver les séparateurs et la hiérarchie typographique dans les listes et formulaires.
- Do adapter les colonnes au téléphone et autoriser le retour à la ligne des contenus longs.

### Don't:

- Don’t remplacer la police système ou la palette choisie sans décision explicite.
- Don’t ajouter d’ombres ou de textures à ce système plat par défaut.
- Don’t transformer le badge d’état statique en contrôle interactif sans concevoir son comportement.
- Don’t présenter une couleur ou un état absent des CSS comme un token déjà livré.

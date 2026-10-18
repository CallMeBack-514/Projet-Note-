---
name: "Suivi communautaire"
description: "Un espace de travail chaleureux et lisible pour les dossiers et leur transmission, bâti sur shadcn/ui."
colors:
  cream: "#ffffeb"
  ink: "#1a1a1a"
  paper: "#fffdf9"
  sand: "#e4e4d0"
  line: "#d1d1c1"
  muted: "#5c5c58"
  forest: "#034f46"
  lavender: "#f0d7ff"
  pink: "#ffbcf2"
  amber: "#ffa946"
  coral: "#ff6c4c"
  error: "#c20024"
typography:
  display:
    fontFamily: "\"EB Garamond\", Georgia, serif"
    fontSize: "4.5rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "\"EB Garamond\", Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "-0.03em"
  body:
    fontFamily: "\"Figtree\", system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "\"Figtree\", system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
rounded:
  control: "8px"
  surface: "16px"
  pill: "9999px"
---

# Design System: Suivi communautaire

## Overview

L'interface reprend le langage visuel de wisprflow.ai, recréé avec nos propres actifs : fond crème, encre presque noire, titres en EB Garamond, texte en Figtree, bordures franches de 2 px, accents pastel et un rail latéral vert profond. Aucun logo, nom ni texte de Wispr n'est utilisé ; le pictogramme est celui du projet (`public/logo.svg`, intégré dans `src/views.tsx`).

Les composants sont les sources **shadcn/ui v4** (Button, Input, Textarea, Label, Select natif, Field, Card, Badge, Alert, Empty, Separator, Table), portées en Hono JSX dans `src/ui/` : mêmes classes Tailwind, `cva`, `cn` et jetons CSS, sans React ni Radix. Les pages restent rendues par le serveur.

## Colors

Les jetons shadcn (`--background`, `--primary`, `--border`, …) sont définis dans `src/styles.css` et pointent vers cette palette.

- **Crème** (`--background`) : fond ; **papier** (`--card`) : surfaces et champs ; **sable** : bordures de cartes, segments et en-têtes de tableau.
- **Encre** (`--foreground`, `--input`) : texte et bordures de contrôles ; **muted** `#5c5c58` : textes secondaires (≥ 4.5:1 sur la crème).
- **Forêt** `#034f46` : rail latéral, badge « Ouvert », anneau de focus.
- **Lavande** `#f0d7ff` : action principale ; **ambre** : état « À faire » ; **rose** et **corail** : réservés.
- **Erreur** `#c20024` : texte, bordure et champs invalides. Toujours accompagnée d'un texte et d'une icône.

Pas de mode sombre : la marque est crème (`color-scheme: light`).

## Typography

Polices auto-hébergées (SIL OFL, `public/fonts/`), sans requête vers un service tiers : **EB Garamond** 400 pour les titres (`h1`, `h2`, légendes, titres de cartes), interlettrage −3 %, interligne ≈ 0,95 ; **Figtree** variable pour le reste. Corps 16 px, étiquettes 600.

## Layout

Rail latéral de 17 rem (`bg-forest`) sur ordinateur : marque, organisme, navigation (Dossiers, Modèles), signature, compte et déconnexion. Sous 768 px, il devient un en-tête empilé (marque, déconnexion, navigation). Le contenu est limité à `max-w-5xl`. Aucun défilement horizontal à 375 px.

## Elevation & Depth

Aucune ombre. La profondeur vient des fonds, des bordures de 2 px (sable pour les surfaces, encre pour les contrôles) et du rail vert.

## Components

- **Button** : défaut lavande + bordure encre ; `outline` papier + bordure encre ; `dark`, `secondary`, `ghost`, `destructive`, `link`. Hauteur 48 px (44 px minimum de cible).
- **Input / Select / Textarea** : bordure encre 2 px, fond papier, anneau de focus forêt de 3 px.
- **Card / FormCard** : rayon 16 px, bordure sable 2 px. **Badge** : pilule ; `success` (Ouvert, Disponible), `warning` (À faire), `secondary` (Retiré).
- **Alert** : `role="status"` (lavande) ou `role="alert"` (erreur). **Empty** : bordure pointillée sable.
- **Navigation** : lien courant en pilule papier sur le rail, `aria-current="page"`.

## Contrats à préserver

`data-case-id`, `data-private-count`, `data-requires-supervisor`, `#access-status` / `#access-message`, `hidden` et la classe `record-name` sont utilisés par `public/app.js` et les tests : ne pas les renommer. `public/styles.css` est généré (`npm run css`) à partir de `src/styles.css`.

## Do's and Don'ts

### Do:

- Do utiliser les composants de `src/ui/` et les jetons shadcn plutôt que des couleurs littérales.
- Do garder libellés visibles, champs natifs et focus visible.
- Do conserver des surfaces plates : bordures franches, pas d'ombres.

### Don't:

- Don't ajouter de police distante ni de mode sombre sans décision explicite.
- Don't transformer le badge d'état en contrôle interactif sans concevoir son comportement.
- Don't éditer `public/styles.css` à la main.

import { raw } from "hono/html";
import type { Child, JSX } from "hono/jsx";
import type { Actor } from "./auth";
import type { RecordRow } from "./records";
import { Button, LinkButton } from "./ui/button";
import { cn } from "./ui/cn";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLegend, FieldSet, Input, Label, NativeSelect, Textarea } from "./ui/form";
import { Icon } from "./ui/icons";
import { limits } from "./limits";
import { Alert, Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/surface";

// Logo vectorisé à partir du visuel fourni (public/logo.svg) ; la couleur suit le texte courant.
const brandMarkPath =
  "M86.8 197.2C83.7 196.2 82.5 194.6 82.3 191.5C82.2 190.3 82.4 183.7 82.6 181.1C82.7 180.3 82.8 176.4 82.9 172.6C83.0 168.8 83.2 165.3 83.2 164.8C83.6 162.1 84.0 144.2 83.8 142.6C83.5 140.5 81.8 138.5 79.4 137.6C78.3 137.2 76.1 136.5 75.6 136.4C75.3 136.4 74.3 136.1 73.4 135.9C72.4 135.6 70.8 135.2 69.6 134.9C67.0 134.2 64.7 133.3 63.9 132.8C61.1 130.6 61.2 125.4 64.3 123.4C66.1 122.1 68.4 122.0 71.7 123.0C72.3 123.2 73.3 123.5 73.8 123.6C74.4 123.7 75.3 123.9 75.9 124.1C76.6 124.3 77.5 124.6 78.1 124.7C78.7 124.9 79.4 125.1 79.7 125.2C80.5 125.4 83.7 126.0 84.5 126.0C86.0 126.0 88.5 125.4 89.5 124.9C91.4 123.8 93.2 121.4 93.6 119.3C93.7 118.9 93.9 118.3 94.0 118.0C94.2 117.7 94.5 116.9 94.7 116.3C95.7 113.6 95.9 113.0 96.6 112.0C96.9 111.5 97.3 111.0 97.3 111.0C97.4 111.0 97.8 110.7 98.2 110.4C99.3 109.6 101.0 109.0 102.5 108.9C103.5 108.9 103.6 108.9 104.5 109.2C104.9 109.4 105.6 109.7 105.9 109.8C106.7 109.9 108.6 111.7 108.9 112.5C109.0 112.8 109.2 113.2 109.4 113.4C109.6 113.7 109.8 114.2 109.9 114.6C109.9 114.9 110.1 115.5 110.3 115.8C110.5 116.1 110.7 116.7 110.8 117.1C110.9 117.6 111.2 118.3 111.4 118.8C111.6 119.2 111.7 119.7 111.7 119.8C111.7 119.9 112.1 120.6 112.5 121.5C113.2 122.7 113.4 123.1 114.0 123.6C115.6 125.0 116.1 125.2 118.8 125.7C121.3 126.1 122.2 126.1 125.2 125.2C125.8 125.1 126.9 124.8 127.8 124.6C128.7 124.3 129.6 124.1 129.8 124.0C130.0 123.9 130.9 123.7 131.9 123.4C132.8 123.2 134.0 122.9 134.5 122.7C135.9 122.3 138.9 122.3 139.9 122.7C142.3 123.7 143.9 126.7 143.4 129.2C143.2 130.1 142.4 131.8 141.9 132.4C141.3 133.1 138.9 134.2 137.5 134.5C136.9 134.6 135.3 135.0 133.8 135.4C132.3 135.8 130.5 136.3 129.8 136.4C127.4 137.0 125.4 137.7 124.5 138.3C123.6 138.9 122.4 140.3 121.9 141.3C121.3 142.5 121.1 145.0 121.4 148.9C121.4 150.0 121.6 153.6 121.6 156.9C121.7 160.1 121.8 163.5 121.9 164.4C122.2 168.2 122.5 174.2 122.6 178.9C122.7 181.7 122.8 185.4 122.9 187.1C123.1 191.7 122.9 193.1 122.0 194.6C121.2 195.9 120.4 196.5 118.4 197.3C117.0 197.7 116.2 197.8 115.0 197.3C114.6 197.1 113.9 196.8 113.6 196.7C112.5 196.3 111.9 195.8 111.3 194.8C110.9 194.3 110.6 193.7 110.6 193.6C110.5 193.4 110.3 192.9 110.1 192.5C109.8 191.7 109.7 191.3 109.6 189.5C109.4 187.5 109.4 187.3 108.9 186.3C108.1 184.4 107.4 183.6 105.6 182.7L104.7 182.2L102.7 182.2L100.7 182.2L99.6 182.7C97.5 183.8 96.2 185.5 95.9 187.7C95.7 189.4 95.0 192.7 94.8 193.3C94.7 193.8 94.0 195.0 93.6 195.6C93.3 196.0 92.1 196.7 91.3 197.0C90.9 197.1 90.4 197.3 90.1 197.4C89.3 197.8 88.2 197.7 86.8 197.2ZM180.4 155.1C178.6 154.7 177.6 153.9 176.8 152.2L176.4 151.3L176.5 146.8C176.5 144.2 176.6 141.5 176.6 140.6C176.7 139.8 176.8 138.1 176.9 136.8C176.9 135.6 177.1 134.1 177.2 133.6C177.3 133.0 177.4 131.4 177.4 129.0C177.5 124.6 177.5 124.4 176.4 123.8C175.5 123.2 175.0 123.2 173.7 124.3C172.5 125.2 171.4 125.5 169.6 125.6L168.2 125.7L167.1 125.2C165.9 124.7 164.3 123.4 163.9 122.5C162.9 120.6 162.7 118.5 163.4 116.9C163.9 115.7 164.5 115.0 173.8 105.7C178.1 101.4 179.5 99.8 179.5 99.1C179.5 99.0 179.7 98.5 179.9 97.9C180.1 97.3 180.3 96.2 180.4 95.4C180.5 94.7 180.8 93.7 180.9 93.2C181.2 92.5 181.2 92.2 181.2 87.8C181.2 83.0 181.1 81.2 180.6 78.3C180.5 77.8 180.4 77.1 180.4 76.9C180.4 76.6 180.2 75.5 179.9 74.5C179.6 73.4 179.4 72.3 179.4 72.2C179.4 71.7 178.2 68.9 177.9 68.6C177.8 68.5 177.5 68.1 177.2 67.8C176.5 66.8 175.8 66.0 166.6 56.8C162.3 52.4 161.9 52.0 161.3 50.3C160.6 48.5 160.6 47.7 161.4 45.9C162.6 42.8 165.5 41.4 168.9 42.2C170.2 42.5 170.9 43.0 172.9 44.9C173.7 45.8 174.8 46.8 175.2 47.2C175.6 47.6 177.0 48.9 178.2 50.1C181.0 52.9 181.3 53.1 183.7 53.1C185.4 53.1 185.4 53.1 186.4 52.6C186.9 52.4 187.6 51.9 187.9 51.6C189.2 50.6 189.9 50.3 192.0 50.3C193.6 50.3 193.9 50.4 194.5 50.6C194.9 50.7 195.5 50.9 195.9 51.1C196.6 51.2 196.7 51.4 198.0 52.6C199.5 54.2 199.6 54.4 200.2 56.2C201.2 59.0 201.3 60.1 201.4 63.9C201.5 65.4 201.6 67.6 201.7 68.8C201.8 69.9 201.9 72.6 201.9 74.8C202.1 84.0 202.4 93.7 202.6 95.9C202.7 97.1 202.7 98.4 202.7 98.7C202.7 99.0 202.7 99.9 202.8 100.8C202.9 101.7 202.9 104.1 202.9 106.1C203.0 111.0 203.2 116.7 203.4 117.8C203.4 118.3 203.5 118.8 203.4 119.0C203.4 119.1 203.4 120.2 203.5 121.4C203.6 122.6 203.7 126.7 203.8 130.6C203.9 134.5 204.1 138.7 204.1 139.9C204.2 141.1 204.2 142.4 204.2 142.8C204.1 143.2 204.2 144.9 204.2 146.5C204.5 151.0 204.2 152.1 202.8 153.7C201.2 155.3 198.9 155.7 196.5 154.6C195.3 154.0 195.0 153.6 194.0 152.1C193.0 150.6 193.0 150.6 191.7 150.1C190.7 149.7 190.7 149.7 189.8 149.9C187.9 150.2 187.2 150.7 186.4 152.4C185.4 154.3 182.6 155.6 180.4 155.1ZM5.2 154.8C3.3 154.2 2.4 153.5 1.6 151.9C0.9 150.5 0.9 150.3 1.2 144.6C1.3 142.2 1.4 138.6 1.5 136.6C1.6 134.6 1.6 132.8 1.7 132.6C1.7 132.4 1.8 129.1 1.9 125.4C1.9 121.6 2.1 118.0 2.1 117.3C2.4 115.0 2.6 107.6 2.8 99.9C2.9 93.1 3.0 88.9 3.4 83.7C3.4 82.7 3.6 79.6 3.6 76.7C4.1 59.3 4.1 58.6 5.5 55.5C6.9 52.3 10.4 50.2 13.8 50.6C15.0 50.7 15.3 50.8 17.1 52.0C19.4 53.6 20.7 54.0 22.5 53.6C24.0 53.2 24.6 52.8 29.6 47.9C34.7 42.8 34.8 42.7 36.7 42.4C39.0 42.1 40.5 42.5 42.2 44.1C43.2 45.0 43.4 45.3 43.8 46.9C44.2 48.8 43.9 50.3 42.9 51.8C42.6 52.3 39.5 55.5 35.2 59.8C31.2 63.8 27.8 67.3 27.5 67.6C26.6 68.8 26.1 69.9 25.8 71.0C25.7 71.7 25.4 72.4 25.3 72.7C25.2 73.1 25.0 73.8 24.9 74.5C24.8 75.1 24.6 76.0 24.5 76.4C24.2 77.4 24.0 78.6 23.9 80.5C23.9 81.4 23.8 83.0 23.7 84.1C23.4 87.0 23.9 94.2 24.4 95.8C24.5 96.1 24.8 97.0 24.9 97.7C25.4 100.2 25.2 99.9 34.6 109.4C41.3 116.1 41.4 116.2 41.6 118.1C41.9 120.3 41.4 122.0 40.1 123.5C38.1 125.6 34.4 125.9 32.0 124.1C30.2 122.7 29.2 122.6 28.2 123.5C27.2 124.3 27.0 125.8 27.4 128.8C27.6 130.8 27.9 134.5 27.9 136.1C27.9 138.3 28.1 142.1 28.4 145.5C28.7 149.5 28.7 150.1 28.3 151.1C28.2 151.6 28.0 152.1 27.9 152.3C27.7 153.4 25.5 154.7 23.8 154.8C23.0 154.9 22.9 154.9 21.7 154.4C20.2 153.7 19.9 153.5 18.9 151.9C18.1 150.8 18.0 150.6 17.0 150.0C16.0 149.4 15.9 149.4 15.0 149.4C13.2 149.4 12.4 149.9 10.7 152.2C9.5 153.7 9.1 154.1 7.7 154.5C6.9 154.8 5.7 154.9 5.2 154.8ZM87.0 89.4C84.7 88.6 84.0 87.9 82.7 85.3C82.3 84.4 82.1 82.5 82.2 81.0C82.3 79.4 82.8 69.7 82.9 65.4C83.0 60.6 83.3 53.6 83.5 51.6C83.7 49.1 83.9 37.9 83.7 37.4C83.4 36.2 82.2 35.8 80.5 36.3C80.1 36.4 79.0 36.7 78.1 36.9C77.1 37.1 76.1 37.3 75.8 37.4C75.5 37.5 74.6 37.7 73.9 37.8C73.2 37.9 72.1 38.1 71.4 38.3C67.7 39.2 65.0 38.7 63.4 36.9C61.1 34.2 61.3 30.9 63.7 28.4C64.6 27.5 66.3 26.8 68.1 26.5C69.0 26.4 70.0 26.2 70.3 26.1C70.6 26.0 71.4 25.8 72.1 25.6C72.8 25.5 73.8 25.3 74.3 25.1C74.8 25.0 75.8 24.8 76.5 24.6C77.2 24.5 78.2 24.3 78.7 24.1C79.2 24.0 80.2 23.8 81.1 23.6C82.0 23.5 82.9 23.3 83.1 23.1C83.4 23.0 83.9 22.8 84.2 22.7C85.4 22.3 86.4 21.6 88.9 19.0C91.6 16.4 92.3 15.4 92.8 13.9C92.8 13.6 93.0 13.0 93.2 12.7C93.4 12.4 93.6 11.7 93.7 11.2C93.9 10.7 94.1 10.1 94.2 9.9C94.4 9.6 94.6 9.1 94.7 8.6C94.8 8.2 95.0 7.6 95.2 7.2C95.3 6.9 95.6 6.4 95.7 6.0C96.0 4.8 97.5 2.9 98.7 2.2C100.7 1.1 103.0 0.8 104.6 1.5C105.0 1.7 105.7 1.9 105.9 1.9C106.5 2.1 107.6 3.0 108.3 4.1C108.6 4.5 109.0 5.1 109.3 5.4C109.5 5.8 109.8 6.3 109.9 6.7C110.0 7.0 110.2 7.7 110.4 8.1C110.6 8.5 110.8 9.2 110.9 9.6C111.0 10.1 111.3 10.8 111.4 11.2C111.6 11.6 111.7 11.9 111.8 12.0C111.8 12.4 113.1 15.4 113.7 16.3C114.6 17.6 118.1 21.0 119.8 22.2C120.4 22.6 123.1 23.4 124.3 23.6C124.8 23.7 125.8 23.9 126.5 24.1C127.2 24.3 128.4 24.6 129.1 24.7C129.8 24.8 130.9 25.0 131.4 25.2C131.9 25.3 132.9 25.6 133.5 25.7C134.2 25.8 135.1 26.0 135.5 26.2C136.0 26.4 136.9 26.6 137.5 26.6C139.7 26.9 141.1 27.7 142.2 29.2C143.1 30.5 143.4 31.2 143.4 32.6C143.4 36.1 141.7 38.3 138.7 38.7C137.7 38.9 135.2 38.7 133.7 38.3C133.1 38.1 132.0 37.9 131.3 37.8C130.6 37.7 129.7 37.5 129.2 37.4C128.1 37.0 125.4 36.4 124.0 36.2C122.6 36.0 122.2 36.2 121.7 37.0C121.2 37.6 121.3 37.3 121.5 44.6C121.7 51.6 121.8 56.0 122.0 57.9C122.1 59.4 122.3 62.1 122.5 67.4C122.8 74.2 122.9 84.4 122.6 85.2C122.3 86.1 120.5 88.2 119.5 88.8C119.1 89.0 116.5 89.9 116.2 89.9C115.1 89.9 112.5 89.0 111.5 88.3C110.5 87.5 109.5 85.9 108.8 84.1C108.7 83.8 108.7 81.5 108.6 77.7L108.6 71.8L108.1 70.8C107.3 69.1 105.8 68.0 103.8 67.4C102.1 66.9 99.7 67.8 98.1 69.5C97.1 70.4 97.1 70.6 96.5 73.4C96.4 73.7 96.4 76.0 96.4 78.6C96.4 83.2 96.3 84.3 95.9 85.4C95.5 86.7 93.4 88.8 92.2 89.2C91.9 89.3 91.3 89.5 90.9 89.6C89.8 90.0 88.7 90.0 87.0 89.4Z";
function BrandMark({ class: className }: { class?: string }) {
  return (
    <svg viewBox="0 0 205.25 198.5" width="32" height="32" aria-hidden="true" class={cn("size-8 shrink-0", className)}>
      <path d={brandMarkPath} fill="currentColor" fill-rule="evenodd" />
    </svg>
  );
}
// Logo + nom : le nom reprend la police des titres (EB Garamond) pour former un ensemble cohérent.
function Logo({ class: className, markClass }: { class?: string; markClass?: string }) {
  return (
    <span class={cn("flex items-center gap-3", className)}>
      <BrandMark class={markClass} />
      <span class="font-serif text-4xl leading-none tracking-tight">Superhero</span>
    </span>
  );
}
const sideFocus = "focus-visible:ring-[3px] focus-visible:ring-cream/70";
const navLink = cn(
  "flex items-center gap-3 rounded-xl px-4 py-3 text-base font-semibold whitespace-nowrap transition-colors outline-none",
  sideFocus,
);
export function Layout({
  title,
  actor,
  children,
  section = "dossiers",
}: {
  title: string;
  actor?: Actor;
  children: Child;
  section?: "dossiers" | "modeles" | "audit";
}) {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light" />
          <title>{title} · Superhero</title>
          <link rel="preload" href="/fonts/figtree-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
          <link rel="stylesheet" href="/styles.css" />
          <script src="/app.js" defer />
        </head>
        <body class="min-h-dvh">
          <a
            class="fixed top-2 left-2 z-50 -translate-y-24 rounded-lg border-2 border-foreground bg-card px-4 py-3 font-semibold focus:translate-y-0"
            href="#contenu"
          >
            Aller au contenu
          </a>
          {actor ? (
            <div class="min-h-dvh md:grid md:grid-cols-[17rem_minmax(0,1fr)]">
              <aside class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 bg-forest px-4 py-3 text-cream md:sticky md:top-0 md:h-dvh md:flex-col md:flex-nowrap md:items-stretch md:justify-start md:gap-0 md:overflow-y-auto md:px-5 md:py-7">
                <a class={cn("flex items-center gap-3 rounded-lg outline-none", sideFocus)} href="/dossiers">
                  <Logo markClass="size-10" />
                </a>
                <nav aria-label="Navigation principale" class="order-last flex w-full gap-1.5 md:order-none md:mt-8 md:flex-col">
                  <a
                    class={cn(navLink, section === "dossiers" ? "bg-card text-foreground" : "text-cream/85 hover:bg-cream/10 hover:text-cream")}
                    aria-current={section === "dossiers" ? "page" : undefined}
                    href="/dossiers"
                  >
                    <Icon name="folder" class="size-5" />
                    Dossiers
                  </a>
                  {actor.role === "superviseur" && (
                    <a
                      class={cn(navLink, section === "modeles" ? "bg-card text-foreground" : "text-cream/85 hover:bg-cream/10 hover:text-cream")}
                      aria-current={section === "modeles" ? "page" : undefined}
                      href="/modeles"
                    >
                      <Icon name="clipboard-list" class="size-5" />
                      Modèles
                    </a>
                  )}
                  {actor.role === "superviseur" && (
                    <a
                      class={cn(navLink, section === "audit" ? "bg-card text-foreground" : "text-cream/85 hover:bg-cream/10 hover:text-cream")}
                      aria-current={section === "audit" ? "page" : undefined}
                      href="/audit"
                    >
                      <Icon name="file-text" class="size-5" />
                      Journal des accès
                    </a>
                  )}
                </nav>
                <p class="mt-auto hidden font-serif text-xl leading-snug text-cream/90 italic md:block">
                  Un espace commun.
                  <br />
                  Un suivi à la fois.
                </p>
                <div class="flex items-center gap-3 md:mt-6 md:flex-col md:items-stretch md:gap-3 md:border-t-2 md:border-cream/20 md:pt-5">
                  <div class="hidden min-w-0 leading-tight sm:block">
                    <strong class="block truncate text-base">{actor.name}</strong>
                    <span class="block text-sm text-cream/75">{actor.role === "superviseur" ? "Superviseur" : "Intervenant"}</span>
                  </div>
                  <form method="post" action="/deconnexion">
                    <Button
                      variant="outline"
                      size="sm"
                      class="w-full border-cream bg-transparent text-cream hover:bg-cream/10 focus-visible:ring-cream/70 focus-visible:ring-offset-forest"
                    >
                      <Icon name="log-out" />
                      Se déconnecter
                    </Button>
                  </form>
                </div>
              </aside>
              <main id="contenu" class="mx-auto w-full max-w-5xl min-w-0 px-4 py-8 md:px-10 md:py-14">
                {children}
              </main>
            </div>
          ) : (
            <main id="contenu" class="mx-auto grid min-h-dvh max-w-6xl content-center gap-10 px-4 py-10 md:grid-cols-2 md:items-center md:gap-16 md:px-6">
              <div class="flex flex-col gap-6">
                <Logo markClass="size-11" />
                <h1 class="text-6xl leading-[0.95] tracking-[-0.03em] md:text-8xl">
                  Retrouver le fil
                  <br />
                  de chaque suivi.
                </h1>
                <p class="max-w-md text-xl font-medium text-muted-foreground">
                  Votre espace de travail pour les dossiers et le relais entre intervenants.
                </p>
              </div>
              <div>{children}</div>
            </main>
          )}
        </body>
      </html>
    </>
  );
}
export function PageHeading({ title, description, children }: { title: Child; description?: Child; children?: Child }) {
  return (
    <header class="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-10">
      <div class="max-w-3xl min-w-0">
        <h1 class="text-5xl leading-[0.95] tracking-[-0.03em] break-words md:text-7xl">{title}</h1>
        {description && <p class="mt-4 text-lg text-muted-foreground md:text-xl">{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function BackLink({ href, children }: { href: string; children: Child }) {
  return (
    <LinkButton href={href} variant="ghost" size="sm" class="mb-6 -ml-3">
      <Icon name="arrow-left" />
      {children}
    </LinkButton>
  );
}
export function Notice({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <Alert variant={error ? "destructive" : "default"} class="mb-6">
      <Icon name={error ? "circle-alert" : "info"} />
      <div>{message}</div>
    </Alert>
  );
}
export function AccessStatus() {
  return (
    <Alert id="access-status" hidden class="mb-6">
      <Icon name="info" />
      <div class="flex flex-wrap gap-x-3 gap-y-1">
        <span id="access-message" />
        <a class="font-semibold underline underline-offset-4" href="/dossiers">
          Revenir aux dossiers
        </a>
      </div>
    </Alert>
  );
}
/** Carte-formulaire : surface unique pour tous les formulaires. */
export function FormCard({ class: className, ...props }: JSX.IntrinsicElements["form"]) {
  return (
    <form
      class={cn("flex max-w-3xl flex-col gap-8 rounded-2xl border-2 border-sand bg-card p-5 md:p-8", className as string)}
      {...props}
    />
  );
}
export function FormActions({ children }: { children: Child }) {
  return <div class="flex flex-wrap items-center gap-x-5 gap-y-3">{children}</div>;
}
export function CancelLink({ href }: { href: string }) {
  return (
    <a class="text-base font-semibold underline underline-offset-4 hover:decoration-2" href={href}>
      Annuler
    </a>
  );
}
export const rowCard = "rounded-xl border-2 border-sand bg-card p-4 md:p-5";
export function DefList({ children }: { children: Child }) {
  return <dl class="grid gap-4">{children}</dl>;
}
export function DefItem({ term, children }: { term: Child; children: Child }) {
  return (
    <div>
      <dt class="text-sm font-medium text-muted-foreground">{term}</dt>
      <dd class="text-lg font-medium break-words">{children}</dd>
    </div>
  );
}
export type TextFieldProps = {
  name: string;
  label: string;
  value?: string;
  errors?: Record<string, string>;
  type?: string;
  required?: boolean;
  maxlength?: number;
  help?: string;
  list?: string;
  textarea?: number;
  autocomplete?: string;
};
export function TextField(props: TextFieldProps) {
  const err = props.errors?.[props.name];
  const common = {
    id: "f-" + props.name,
    name: props.name,
    required: props.required,
    maxlength: props.maxlength,
    autocomplete: props.autocomplete ?? "off",
    "aria-invalid": err ? "true" : undefined,
    "aria-describedby": [err ? "e-" + props.name : "", props.help ? "h-" + props.name : ""].filter(Boolean).join(" ") || undefined,
  };
  return (
    <Field data-invalid={err ? "true" : undefined}>
      <Label for={"f-" + props.name}>
        {props.label}
        {props.required ? " *" : ""}
      </Label>
      {props.help && <FieldDescription id={"h-" + props.name}>{props.help}</FieldDescription>}
      {props.textarea ? (
        <Textarea {...common} rows={props.textarea}>
          {props.value ?? ""}
        </Textarea>
      ) : (
        <Input {...common} type={props.type ?? "text"} value={props.value ?? ""} list={props.list} />
      )}
      {err && <FieldError id={"e-" + props.name}>{err}</FieldError>}
    </Field>
  );
}
export function PaginationNav({ page, pages, prev, next }: { page: number; pages: number; prev?: string; next?: string }) {
  return (
    <nav class="mt-6 flex flex-wrap items-center justify-between gap-3" aria-label="Pagination">
      {prev ? (
        <LinkButton variant="outline" size="sm" href={prev}>
          <Icon name="chevron-left" />
          Page précédente
        </LinkButton>
      ) : (
        <span />
      )}
      <span class="text-sm font-medium text-muted-foreground tabular-nums">
        Page {page} sur {pages}
      </span>
      {next ? (
        <LinkButton variant="outline" size="sm" href={next}>
          Page suivante
          <Icon name="chevron-right" />
        </LinkButton>
      ) : (
        <span />
      )}
    </nav>
  );
}
export function Login({ error }: { error?: string }) {
  return (
    <Layout title="Connexion">
      <Card class="gap-8 p-1 md:p-3">
        <CardHeader>
          <CardTitle class="text-4xl">Connexion</CardTitle>
          <CardDescription class="text-base">Utilisez le compte fourni par votre organisme.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-6">
          {error && <Notice message={error} error />}
          <form method="post" action="/connexion" class="flex flex-col gap-6">
            <Field>
              <Label for="email">Adresse courriel</Label>
              <Input id="email" name="email" type="email" autocomplete="username" required maxlength={254} />
            </Field>
            <Field>
              <Label for="password">Mot de passe</Label>
              <Input id="password" name="password" type="password" autocomplete="current-password" required />
            </Field>
            <Button size="lg">Se connecter</Button>
          </form>
          <p class="text-sm text-muted-foreground">Besoin d’un accès ? Contactez la personne responsable de votre organisme.</p>
        </CardContent>
      </Card>
    </Layout>
  );
}
export function List({
  actor,
  rows,
  total,
  query,
  page,
  filter = "tous",
  transferred,
}: {
  actor: Actor;
  rows: RecordRow[];
  total: number;
  query: string;
  page: number;
  filter?: "tous" | "actif" | "inactif";
  transferred: boolean;
}) {
  // La recherche et le filtre de statut sont conservés dans la pagination.
  const href = (p: number) =>
    "/dossiers?q=" + encodeURIComponent(query) + "&statut=" + filter + "&page=" + p;
  const filtered = Boolean(query) || filter !== "tous";
  return (
    <Layout title="Dossiers" actor={actor}>
      <PageHeading
        title={actor.role === "superviseur" ? "Dossiers de l’organisme" : "Mes dossiers"}
        description={
          actor.role === "superviseur"
            ? "Retrouvez les suivis de toutes les équipes."
            : "Retrouvez les suivis qui vous sont confiés."
        }
      >
        <LinkButton size="lg" href="/dossiers/nouveau">
          <Icon name="plus" />
          Nouveau dossier
        </LinkButton>
      </PageHeading>
      {transferred && <Notice message="Le dossier a été transféré. Le nouvel intervenant en est maintenant responsable." />}
      <AccessStatus />
      <section aria-label="Liste des dossiers" class="flex flex-col gap-5">
        <form class="flex flex-col gap-2" action="/dossiers" method="get">
          <Label for="q">Rechercher un usager ou un numéro de dossier</Label>
          <div class="flex flex-wrap items-center gap-3">
            <div class="relative min-w-60 flex-1">
              <Icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input id="q" name="q" type="search" value={query} maxlength={160} placeholder="Nom ou numéro de dossier" class="pl-11" />
            </div>
            <div class="flex items-center gap-2">
              <Label for="statut">Statut</Label>
              <NativeSelect id="statut" name="statut">
                <option value="tous" selected={filter === "tous"}>
                  Tous
                </option>
                <option value="actif" selected={filter === "actif"}>
                  Actifs
                </option>
                <option value="inactif" selected={filter === "inactif"}>
                  Inactifs
                </option>
              </NativeSelect>
            </div>
            <Button variant="outline">Rechercher</Button>
            {filtered && (
              <a class="text-base font-semibold underline underline-offset-4 hover:decoration-2" href="/dossiers">
                Effacer
              </a>
            )}
          </div>
        </form>
        <div class="text-sm font-medium text-muted-foreground tabular-nums" data-private-count>
          {total} dossier{total !== 1 ? "s" : ""}
          {filter === "actif" ? " actif" : filter === "inactif" ? " inactif" : ""}
          {filter !== "tous" && total !== 1 ? "s" : ""}
          {query ? " correspondant à votre recherche" : ""}
        </div>
        {rows.length ? (
          <div class="overflow-hidden rounded-2xl border-2 border-sand bg-card">
            <div
              class="hidden gap-4 border-b-2 border-sand bg-secondary/60 px-5 py-3 text-sm font-semibold md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_6rem]"
              aria-hidden="true"
            >
              <span>Usager / dossier</span>
              <span>Responsable</span>
              <span>État</span>
            </div>
            {rows.map((row) => (
              <article
                class="group relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b-2 border-sand px-5 py-4 transition-colors last:border-b-0 hover:bg-muted has-[a:focus-visible]:bg-muted md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_6rem] md:py-5"
                data-case-id={row.id}
              >
                <div class="min-w-0">
                  <a class="record-name font-serif text-2xl leading-tight break-words underline-offset-4 outline-none group-hover:underline after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-ring/60" href={"/dossiers/" + row.id}>
                    {row.name}
                  </a>
                  <span class="block text-xs tracking-wider text-muted-foreground tabular-nums">{row.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <Badge variant={row.status === "Inactif" ? "secondary" : "success"} class="row-start-1 col-start-2 md:col-start-3">
                  {row.status}
                </Badge>
                <div class="col-span-2 min-w-0 break-words md:col-span-1 md:col-start-2 md:row-start-1">
                  <span class="mr-2 text-sm text-muted-foreground md:hidden">Responsable</span>
                  {row.owner_name}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{filtered ? "Aucun dossier trouvé" : "Votre liste est prête"}</EmptyTitle>
              <EmptyDescription>
                {filtered
                  ? "Essayez un autre nom, numéro ou statut parmi vos dossiers accessibles, ou changez le filtre."
                  : "Ouvrez le dossier d’une nouvelle personne pour commencer son suivi."}
              </EmptyDescription>
            </EmptyHeader>
            {!filtered && (
              <LinkButton href="/dossiers/nouveau">
                <Icon name="plus" />
                Créer un dossier
              </LinkButton>
            )}
          </Empty>
        )}
        {total > 25 && (
          <PaginationNav
            page={page}
            pages={Math.ceil(total / 25)}
            prev={page > 1 ? href(page - 1) : undefined}
            next={page * 25 < total ? href(page + 1) : undefined}
          />
        )}
      </section>
    </Layout>
  );
}
export function NewRecord({
  actor,
  choices,
  error,
  values = {},
}: {
  actor: Actor;
  choices: { id: string; name: string }[];
  error?: string;
  values?: Record<string, string>;
}) {
  return (
    <Layout title="Nouveau dossier" actor={actor}>
      <BackLink href="/dossiers">Retour aux dossiers</BackLink>
      <AccessStatus />
      <div>
        <PageHeading
          title="Nouveau dossier"
          description="Ouvrez le dossier d’une nouvelle personne. Pour une personne déjà suivie, ajoutez une note ou un document dans son dossier."
        />
        {error && <Notice message={error} error />}
        <FormCard method="post" action="/dossiers">
          <p class="text-sm text-muted-foreground">Les champs marqués d’un astérisque (*) sont obligatoires.</p>
          <FieldSet>
            <FieldLegend>Usager</FieldLegend>
            <FieldGroup>
              <Field>
                <Label for="f-name">Nom complet *</Label>
                <Input id="f-name" name="name" required maxlength={160} autocomplete="off" value={values.name || ""} />
              </Field>
              <div class="grid gap-6 md:grid-cols-2">
                <Field>
                  <Label for="f-email">Courriel</Label>
                  <Input id="f-email" name="email" type="email" maxlength={254} value={values.email || ""} />
                </Field>
                <Field>
                  <Label for="f-phone">Téléphone</Label>
                  <Input id="f-phone" name="phone" type="tel" maxlength={60} value={values.phone || ""} />
                </Field>
              </div>
            </FieldGroup>
          </FieldSet>
          {actor.role === "superviseur" ? (
            <FieldSet>
              <FieldLegend>Suivi</FieldLegend>
              <Field>
                <Label for="f-owner">Intervenant responsable *</Label>
                <NativeSelect id="f-owner" name="owner_id" required>
                  <option value="">Choisir un intervenant</option>
                  {choices.map((p) => (
                    <option value={p.id} selected={values.owner_id === p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </FieldSet>
          ) : (
            <p class="text-base">
              Ce dossier vous sera attribué : <strong>{actor.name}</strong>.
            </p>
          )}
          <FormActions>
            <Button size="lg">Créer le dossier</Button>
            <CancelLink href="/dossiers" />
          </FormActions>
        </FormCard>
      </div>
    </Layout>
  );
}
export function EditRecord({
  actor,
  row,
  values,
  errors,
  error,
}: {
  actor: Actor;
  row: RecordRow;
  values?: Record<string, string>;
  errors?: Record<string, string>;
  error?: string;
}) {
  const v = values ?? { name: row.name, email: row.email, phone: row.phone, address: row.address, date_of_birth: row.date_of_birth };
  return (
    <Layout title="Modifier les renseignements" actor={actor}>
      <BackLink href={"/dossiers/" + row.id}>Retour au dossier</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title="Modifier les renseignements" description={row.name} />
        {error && <Notice message={error} error />}
        <FormCard method="post" action={"/dossiers/" + row.id + "/modifier"}>
          <p class="text-sm text-muted-foreground">Les champs marqués d’un astérisque (*) sont obligatoires.</p>
          <FieldSet>
            <FieldLegend>Usager</FieldLegend>
            <FieldGroup>
              <TextField name="name" label="Nom complet" value={v.name} errors={errors} required maxlength={limits.name} />
              <div class="grid gap-6 md:grid-cols-2">
                <TextField name="email" label="Courriel" type="email" value={v.email} errors={errors} maxlength={limits.email} autocomplete="email" />
                <TextField name="phone" label="Téléphone" type="tel" value={v.phone} errors={errors} maxlength={limits.phone} autocomplete="tel" />
              </div>
              <TextField name="address" label="Adresse" value={v.address} errors={errors} maxlength={limits.address} autocomplete="street-address" />
              <div class="md:max-w-xs">
                <TextField name="date_of_birth" label="Date de naissance" type="date" value={v.date_of_birth} errors={errors} autocomplete="bday" />
              </div>
            </FieldGroup>
          </FieldSet>
          <FormActions>
            <Button size="lg">Enregistrer</Button>
            <CancelLink href={"/dossiers/" + row.id} />
          </FormActions>
        </FormCard>
      </div>
    </Layout>
  );
}
export function Transfer({
  actor,
  row,
  choices,
  error,
}: {
  actor: Actor;
  row: RecordRow;
  choices: { id: string; name: string }[];
  error?: string;
}) {
  return (
    <Layout title="Transférer le dossier" actor={actor}>
      <BackLink href={"/dossiers/" + row.id}>Retour au dossier</BackLink>
      <AccessStatus />
      <div data-case-id={row.id}>
        <PageHeading title="Transférer le dossier" description={row.name} />
        {error && <Notice message={error} error />}
        <FormCard method="post" action={"/dossiers/" + row.id + "/transfert"}>
          <input type="hidden" name="version" value={row.version} />
          <div class="grid items-end gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div class="flex flex-col gap-1">
              <span class="text-base font-semibold">Responsable actuel</span>
              <strong class="flex min-h-12 items-center rounded-lg bg-secondary px-3.5 text-lg">{row.owner_name}</strong>
            </div>
            <Icon name="arrow-right-left" class="mx-auto hidden size-6 md:mb-3 md:block" />
            <Field>
              <Label for="f-new-owner">Nouvel intervenant responsable *</Label>
              <NativeSelect id="f-new-owner" name="owner_id" required>
                <option value="">Choisir un intervenant</option>
                {choices.map((p) => (
                  <option value={p.id}>{p.name}</option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <p class="max-w-prose text-base text-muted-foreground">
            Dès la confirmation, l’ancien intervenant perd l’accès à ce dossier. Le nouvel intervenant et les superviseurs de l’organisme pourront le consulter.
          </p>
          {!choices.length && <Notice message="Aucun autre intervenant actif n’est disponible. Contactez votre superviseur." />}
          <FormActions>
            <Button size="lg" disabled={!choices.length}>
              Confirmer le transfert
            </Button>
            <CancelLink href={"/dossiers/" + row.id} />
          </FormActions>
        </FormCard>
      </div>
    </Layout>
  );
}

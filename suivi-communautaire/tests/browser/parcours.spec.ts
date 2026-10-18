import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFileSync } from "node:fs";
const credentials = JSON.parse(readFileSync(".local/credentials.json", "utf8"));
async function login(page: Page, who: string) {
  await page.goto("/connexion");
  await page.getByLabel("Adresse courriel").fill(who + "@demo.example");
  await page.getByLabel("Mot de passe").fill(credentials.password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/\/dossiers$/);
}
async function create(page: Page, name: string) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nom complet").fill(name);
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dossiers\/[a-z0-9-]+$/);
  return page.url().split("/").pop()!;
}
async function settled(page: Page) {
  await expect(page.locator("html")).not.toHaveClass(/checking/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function capture(page: Page, file: string) {
  await settled(page);
  if (process.env.CAPTURE_UI === "1") await page.screenshot({
    path: ".impeccable/review/" + file + ".png",
    fullPage: true,
  });
}
async function supervisorTransfer(page: Page, id: string, who: string) {
  await page.goto("/dossiers/" + id + "/transfert");
  await page.getByLabel("Nouvel intervenant responsable").selectOption(who);
  await page.getByRole("button", { name: "Confirmer le transfert" }).click();
  await expect(page).toHaveURL(new RegExp("/dossiers/" + id + "$"));
}
test("parcours local complet, responsive et révocation des vues ouvertes", async ({
  browser,
}) => {
  const a = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    }),
    s = await browser.newContext(),
    b = await browser.newContext(),
    d = await browser.newContext();
  const page = await a.newPage(),
    supervisor = await s.newPage(),
    recipient = await b.newPage(),
    other = await d.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/connexion");
  await capture(page, "login-desktop");
  await login(page, "a");
  await login(supervisor, "s2");
  await login(recipient, "c");
  await login(other, "d");
  const id = await create(page, "Anne Beaulieu (fictif)");
  // Dossier unique : aucune action de duplication n'est proposée, les interactions deviennent des notes.
  await expect(page.getByRole("link", { name: "Créer un autre dossier" })).toHaveCount(0);
  await page.getByRole("link", { name: "Ajouter une note" }).click();
  await page.getByLabel("Nature de l’interaction").fill("Rencontre au bureau");
  await page.getByLabel("Texte de la note").fill("Première rencontre. <b>Texte inerte</b>");
  await page.getByLabel("Personnes présentes").fill("Proche, partenaire (fictifs)");
  await page.getByLabel("Tâche").fill("Rappeler la personne");
  await page.getByLabel("Échéance").fill("2026-12-01");
  await page.getByRole("button", { name: "Enregistrer la note" }).click();
  await expect(page.getByText("La note a été enregistrée.")).toBeVisible();
  await expect(page.locator(".note-body")).toContainText("<b>Texte inerte</b>");
  await expect(page.getByText("À faire")).toBeVisible();
  // Modèle administré au clavier par un superviseur, puis document rempli par l'intervenante.
  await supervisor.goto("/modeles/nouveau");
  await supervisor.getByLabel("Titre du modèle").fill("Demande de financement (fictif)");
  await supervisor.getByLabel("Libellé").first().fill("Situation");
  await supervisor.getByLabel("Type").first().selectOption("textarea");
  await supervisor.getByLabel("Réponse obligatoire").first().check();
  await supervisor.getByRole("button", { name: "Ajouter un champ" }).focus();
  await supervisor.keyboard.press("Enter");
  await supervisor.getByLabel("Libellé").nth(1).fill("Programme");
  await supervisor.getByLabel("Type").nth(1).selectOption("choice");
  await supervisor.getByRole("button", { name: "Monter" }).nth(1).click();
  await expect(supervisor.getByLabel("Libellé").first()).toHaveValue("Programme");
  await supervisor.getByLabel("Choix proposés").fill("Logement\nAlimentation");
  await supervisor.getByRole("button", { name: "Enregistrer le modèle" }).click();
  await expect(supervisor.getByText("Le modèle a été enregistré.")).toBeVisible();
  await page.goto("/dossiers/" + id + "/documents/nouveau");
  await page.getByRole("link", { name: "Demande de financement (fictif)" }).click();
  await page.getByLabel("Situation").fill("Situation décrite (fictive)");
  await page.getByLabel("Programme").selectOption({ label: "Alimentation" });
  await page.getByRole("button", { name: "Enregistrer le document" }).click();
  await expect(page.getByText("Le document a été enregistré.")).toBeVisible();
  // Statut : inactivation et réactivation au clavier, contenu et actions conservés, filtre de liste.
  await page.goto("/dossiers/" + id);
  await expect(page.getByText("Actif", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Rendre inactif" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Le dossier est maintenant inactif.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Ajouter une note" })).toBeVisible();
  await expect(page.locator(".note-body")).toContainText("Texte inerte");
  await page.goto("/dossiers?statut=inactif");
  await expect(page.getByRole("link", { name: "Anne Beaulieu (fictif)" })).toBeVisible();
  await page.goto("/dossiers?statut=actif&q=Anne");
  await expect(page.getByText("Aucun dossier trouvé")).toBeVisible();
  await page.goto("/dossiers/" + id);
  await page.getByRole("button", { name: "Réactiver" }).click();
  await expect(page.getByText("Le dossier est maintenant actif.")).toBeVisible();
  const retained = await create(page, "Jules Mercier (fictif)");
  await create(page, "Louise Pelletier (fictif)");
  await page.goto("/dossiers");
  await capture(page, "desktop");
  await page.setViewportSize({ width: 375, height: 812 });
  await capture(page, "mobile");
  await page
    .getByRole("link", { name: "Nouveau dossier", exact: true })
    .click();
  await capture(page, "new-mobile");
  await page.getByLabel("Nom complet").fill("Noémie Desrosiers (fictif)");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await capture(page, "detail-mobile");
  // Saisie d'une note et d'un document à 375 px, sans défilement horizontal.
  await page.goto("/dossiers/" + id + "/notes/nouvelle");
  await capture(page, "note-mobile");
  await page.goto("/dossiers/" + id + "/documents/nouveau");
  await page.getByRole("link", { name: "Demande de financement (fictif)" }).click();
  await capture(page, "document-mobile");
  await page.goto("/dossiers/" + id + "/transfert");
  await capture(page, "transfer-mobile");
  await page.setViewportSize({ width: 1440, height: 960 });
  await capture(page, "transfer-desktop");
  await page.goto("/dossiers/" + id);
  await capture(page, "detail-desktop");
  await other.goto("/dossiers/" + id);
  await expect(other.getByRole("alert")).toContainText("introuvable");
  const list = await a.newPage();
  await list.goto("/dossiers");
  await settled(list);
  const start = Date.now();
  await supervisorTransfer(supervisor, id, "c");
  await expect(page.locator("[data-case-id]")).toHaveCount(0, {
    timeout: 10000,
  });
  expect(Date.now() - start).toBeLessThan(10000);
  await expect(list.locator(`[data-case-id="${id}"]`)).toHaveCount(0, {
    timeout: 10000,
  });
  await expect(list.locator(`[data-case-id="${retained}"]`)).toBeVisible();
  await recipient.goto("/dossiers/" + id);
  await expect(
    recipient.getByRole("heading", { name: "Anne Beaulieu (fictif)" }),
  ).toBeVisible();
  // Le nouveau responsable retrouve notes et documents; l'ancien auteur n'a plus aucun droit.
  await expect(recipient.locator(".note-body")).toContainText("Texte inerte");
  await expect(recipient.getByRole("link", { name: "Demande de financement (fictif)" })).toBeVisible();
  await page.goto("/dossiers/" + id);
  await expect(page.getByRole("alert")).toContainText("introuvable");
  await page.goto("/dossiers/" + id + "/notes/nouvelle");
  await expect(page.getByRole("alert")).toContainText("introuvable");
  await page.goto("/dossiers/" + retained);
  await settled(page);
  await a.setOffline(true);
  await expect(page.locator("html")).toHaveClass(/checking/);
  await expect(page.locator("[data-case-id]")).toBeHidden();
  await a.setOffline(false);
  await settled(page);
  await expect(page.locator("[data-case-id]")).toBeVisible();
  // A stale delayed successful check must never restore a revoked view.
  let release: (() => void) | undefined;
  let held = false;
  await page.route("**/acces", async (route) => {
    if (!held) {
      held = true;
      await new Promise<void>((resolve) => (release = resolve));
      await route.fulfill({ json: { allowed: [retained] } }).catch(() => {});
    } else await route.continue();
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => held).toBe(true);
  await supervisorTransfer(supervisor, retained, "c");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator("[data-case-id]")).toHaveCount(0);
  release?.();
  await page.waitForTimeout(100);
  await expect(page.locator("[data-case-id]")).toHaveCount(0);
  await page.unroute("**/acces");
  await page.goto("/dossiers");
  await page.goBack();
  await expect(page.getByRole("alert")).toContainText("introuvable");
  await page.goto("/dossiers");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await login(page, "a");
  await expect(
    page.getByRole("link", { name: "Jules Mercier (fictif)" }).first(),
  ).toBeVisible();
  await page.getByLabel("Rechercher un usager ou un numéro de dossier").fill("Jules");
  await page.getByRole("button", {name:"Rechercher",exact:true}).click();
  await expect(page.locator(".record-name").first()).toContainText("Jules");
  await expect(page.locator(".record-name").filter({hasNotText:"Jules"})).toHaveCount(0);
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(
    "BODY",
  );
  expect(errors).toEqual([]);
  for (const context of [a, s, b, d]) await context.close();
});

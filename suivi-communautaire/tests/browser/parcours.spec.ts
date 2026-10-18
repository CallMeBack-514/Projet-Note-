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
async function create(page: Page, name: string, service: string) {
  await page.goto("/dossiers/nouveau");
  await page.getByLabel("Nom complet").fill(name);
  await page.getByLabel("Service").fill(service);
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
  const id = await create(
    page,
    "Anne Beaulieu (fictif)",
    "Accompagnement au logement",
  );
  await page.getByRole("link", { name: "Créer un autre dossier" }).click();
  await page.getByLabel("Service").fill("Soutien alimentaire");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  const retained = page.url().split("/").pop()!;
  await create(page, "Jules Mercier (fictif)", "Retour à l’emploi");
  await create(page, "Louise Pelletier (fictif)", "Soutien aux proches");
  await page.goto("/dossiers");
  await capture(page, "desktop");
  await page.setViewportSize({ width: 375, height: 812 });
  await capture(page, "mobile");
  await page
    .getByRole("link", { name: "Nouveau dossier", exact: true })
    .click();
  await capture(page, "new-mobile");
  await page.getByLabel("Nom complet").fill("Noémie Desrosiers (fictif)");
  await page.getByLabel("Service").fill("Accueil et orientation");
  await page
    .getByRole("button", { name: "Créer le dossier", exact: true })
    .click();
  await capture(page, "detail-mobile");
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
  await page.goto("/dossiers/" + id);
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

import { expect, test } from "@playwright/test";
import { horizontalOverflow } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await page.goto("./index.html");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("créer une partie et revenir à l'accueil", async ({ page }) => {
  await expect(page.locator("#parties")).toBeHidden();

  await page.fill("#parti", "Les Sans-Voix");
  await page.click('button[type="submit"]');
  await expect(page.locator("#toast")).toHaveText("Choisissez un.e chef.fe !");

  // clicking the leader's name selects it too
  await page.click('label[for="chef2"] h4');
  await page.click('button[type="submit"]');
  await page.waitForURL(/game\.html\?partie=/);
  await expect(page.locator("#title-revolution")).toHaveText("Les Sans-Voix");

  // first visit: the rules are shown
  await expect(page.locator("#overlay")).toBeVisible();
  await page.click("#overlay-close");

  await page.click("#home-button");
  await page.waitForURL(/index\.html/);
  await expect(page.locator(".party-item")).toHaveCount(1);
  await expect(page.locator(".party-info")).toContainText("Karl");
});

test("supprimer une partie", async ({ page }) => {
  await page.fill("#parti", "À supprimer");
  await page.click('label[for="chef1"] h4');
  await page.click('button[type="submit"]');
  await page.waitForURL(/game\.html/);
  await page.goto("./index.html");

  page.once("dialog", (dialog) => dialog.accept());
  await page.click(".party-delete");
  await expect(page.locator(".party-item")).toHaveCount(0);
});

test("une partie inconnue renvoie à l'accueil", async ({ page }) => {
  await page.goto("./game.html?partie=inconnue");
  await page.waitForURL(/index\.html/);
});

test("l'accueil tient dans l'écran", async ({ page }) => {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

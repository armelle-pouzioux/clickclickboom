import { expect, test } from "@playwright/test";
import { horizontalOverflow, openGame } from "./helpers.js";

test("cliquer recrute des révolutionnaires", async ({ page }) => {
  await openGame(page);
  for (let i = 0; i < 5; i++) await page.click("#bouton");
  await expect(page.locator("#counter")).toHaveText("5");
});

test("acheter des recruteurs par lot", async ({ page }) => {
  await openGame(page, { data: { counter: "80" } });
  await expect(page.locator("#unit-container")).toBeVisible();

  await page.click('.quantity-option[data-quantity="10"]');
  await expect(page.locator("#buy-recruiter")).toContainText("Recruter ×10 (Coût: 32 révolutionnaires)");
  await page.click("#buy-recruiter");

  await expect(page.locator("#recruiter-value")).toHaveText("10");
  await expect(page.locator("#toast")).toContainText("10 recruteurs formés");
  await expect(page.locator("#journal-list")).toContainText("10 recruteurs formés (n°1 à 10)");
  // the next batch costs more than what is left: greyed out
  await expect(page.locator("#buy-recruiter")).toBeDisabled();
});

test("un bonus n'est cliquable que s'il est abordable", async ({ page }) => {
  await openGame(page, { data: { counter: "110" } });
  await page.click("#megaphone");
  await expect(page.locator("#megaphone")).toHaveClass(/bought/);
  await expect(page.locator("#affiche")).toBeDisabled();
  await expect(page.locator("#tract")).toBeEnabled();
});

test("la partie est conservée après rechargement", async ({ page }) => {
  await openGame(page, { data: { counter: "200" } });
  await page.click("#megaphone");
  await page.reload();
  await expect(page.locator("#counter")).toHaveText("100");
  expect(await page.evaluate(() => window.clicker.state.clickPower)).toBe(6);
});

test("les statistiques et la force du mouvement s'affichent", async ({ page }) => {
  await openGame(page, { data: { counter: "800", unlockedItems: ["tract", "affiche", "megaphone"] } });
  await expect(page.locator("#movement-detail")).toHaveText("800 révolutionnaires + 160 en bonus = 960 / 4 345 410");
  await expect(page.locator(".stat-tile")).not.toHaveCount(0);
  await expect(page.locator("#stats-grid")).toContainText("3 / 22 bonus");
});

test("le chef parle quand on clique dessus", async ({ page }) => {
  await openGame(page, { chef: "img/chef3.png" });
  await page.click("#chef-button");
  await expect(page.locator("#chef-bubble")).toBeVisible();
  await expect(page.locator("#chef-bubble strong")).toHaveText("Olympe");
});

test("l'aide liste les 22 bonus", async ({ page }) => {
  await openGame(page);
  await page.click("#help-button");
  await expect(page.locator(".help-table tbody tr")).toHaveCount(22);
  await page.click("#overlay-close");
  await expect(page.locator("#overlay")).toBeHidden();
});

test("la page de jeu tient dans l'écran", async ({ page }) => {
  await openGame(page, { data: { counter: "800", recruiters: "12", unlockedItems: ["tract", "affiche", "megaphone"] } });
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
});

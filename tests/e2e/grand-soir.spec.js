import { expect, test } from "@playwright/test";
import { openGame } from "./helpers.js";

const allUpgrades = ["tract", "affiche", "megaphone", "manif", "comite", "reseau", "greve", "radio", "journal",
  "soulevement", "assemblee", "milice", "contreinfo", "international", "autogestion", "commune", "hacker",
  "utopie", "universite", "reseau_autogere", "alliance", "transformation"];

// the test decides every random roll: window.__forcedRandom, set before the game loads
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__forcedRandom = 0.999; // 0.999: every roll fails (no event, no choice, insurrection lost)
    Math.random = () => window.__forcedRandom;
  });
});

const forceRandom = (page, value) => page.evaluate((v) => { window.__forcedRandom = v; }, value);

test("le Grand Soir : échec, attente puis victoire", async ({ page }) => {
  await openGame(page, { chef: "img/chef3.png", data: { unlockedItems: allUpgrades, counter: "100000", recruiters: "60", propagandists: "3" } });

  const button = page.locator("#insurrection-button");
  await expect(button).toBeVisible();
  await expect(button).toContainText("Lancer l'insurrection");

  await button.click();
  await expect(page.locator("#overlay-body h2")).toHaveText("Le Grand Soir");
  await expect(page.locator(".insurrection-table")).toContainText("Chances de réussite");
  await page.click("#insurrection-launch");

  await expect(page.locator("#overlay-body h2")).toHaveText("L'insurrection a échoué…");
  await expect(page.locator("#journal-list")).toContainText("L'insurrection est écrasée");
  await page.click("#overlay-close");
  await expect(button).toBeDisabled();
  await expect(button).toContainText("Le mouvement se relève");
  await expect(page.locator("#active-effects")).toContainText("Contre-révolution");

  // the wait is over and this time luck is on our side
  await page.evaluate(() => {
    window.clicker.state.insurrectionCooldown = 0;
    window.clicker.render();
  });
  await forceRandom(page, 0);
  await button.click();
  await page.click("#insurrection-launch");

  await expect(page.locator("#overlay-body h2")).toHaveText("Victoire !");
  await expect(page.locator("#overlay-body")).toContainText("Il aura fallu 2 tentatives");

  await page.click("#replay-button");
  await expect(page.locator("#counter")).toHaveText("0");
  await expect(button).toBeHidden();
});

test("une décision met le jeu en pause", async ({ page }) => {
  await openGame(page, { data: { counter: "500", recruiters: "20" } });
  await forceRandom(page, 0);
  await page.evaluate(() => { window.clicker.state.secondsSinceChoice = 1000; });

  await expect(page.locator("#overlay-body h2")).toHaveText("Décision");
  const counter = await page.locator("#counter").textContent();
  await page.waitForTimeout(1500);
  await expect(page.locator("#counter")).toHaveText(counter);

  await page.locator(".choice-option").first().click();
  await expect(page.locator("#overlay")).toBeHidden();
  await expect(page.locator("#journal-list")).toContainText("Choix :");
});

import { describe, expect, it } from "vitest";
import {
  calculateProduction, calculateProtection, effectiveClick, movementPercent, movementStrength,
  propagandistChanges, propagandistCost, recruitCost, recruiterChanges, repressionOf,
} from "../../src/game/economy.js";
import { testState } from "./helpers.js";

describe("coûts", () => {
  it("un lot de recruteurs coûte la somme des prix un par un", () => {
    const state = testState();
    const oneByOne = Array.from({ length: 10 }, (_, i) => Math.floor(2 * 1.125 ** i)).reduce((a, b) => a + b, 0);
    expect(recruitCost(state, 10)).toBe(oneByOne);
    expect(recruitCost(state, 10)).toBe(32);
  });

  it("chaque recruteur coûte 12,5 % de plus que le précédent", () => {
    expect(recruitCost(testState({ recruiters: 0 }))).toBe(2);
    expect(recruitCost(testState({ recruiters: 20 }))).toBe(Math.floor(2 * 1.125 ** 20));
  });

  it("le coût des propagandistes augmente aussi", () => {
    expect(propagandistCost(testState({ propagandists: 0 }))).toBe(5);
    expect(propagandistCost(testState({ propagandists: 4 }))).toBe(Math.floor(5 * 1.125 ** 4));
  });
});

describe("production", () => {
  it("un recruteur produit 3 révolutionnaires par minute", () => {
    expect(calculateProduction(testState({ recruiters: 1 }))).toBe(3);
  });

  it("chaque propagandiste rend les recruteurs 2 % plus efficaces", () => {
    // 10 recruiters x 60 x 7 % = 42
    expect(calculateProduction(testState({ recruiters: 10, propagandists: 1 }))).toBe(42);
  });

  it("les bonus autoclick s'ajoutent", () => {
    expect(calculateProduction(testState({ unlockedItems: ["tract", "affiche"] }))).toBe(5);
  });

  it("un effet temporaire de production multiplie tout", () => {
    const state = testState({ recruiters: 10, activeEffects: [{ id: "x", kind: "production", factor: 2, remaining: 10 }] });
    expect(calculateProduction(state)).toBe(60);
  });

  it("les paliers de révolutionnaires donnent +3 % de production chacun", () => {
    const state = testState({ recruiters: 100, reachedMilestones: ["counter-10", "counter-100"] });
    expect(calculateProduction(state)).toBe(Math.floor(300 * 1.06));
  });

  it("le clic ne descend jamais sous 1", () => {
    const state = testState({ clickPower: 1, activeEffects: [{ id: "x", kind: "global", factor: 0.5, remaining: 10 }] });
    expect(effectiveClick(state)).toBe(1);
    expect(effectiveClick(testState({ clickPower: 6, activeEffects: [{ id: "y", kind: "click", factor: 0.5, remaining: 10 }] }))).toBe(3);
  });
});

describe("protection et répression", () => {
  it("la protection vaut 1000 + 50 par recruteur + 250 par propagandiste + le prix des bonus", () => {
    const state = testState({ recruiters: 4, propagandists: 2, unlockedItems: ["tract", "megaphone"] });
    expect(calculateProtection(state)).toBe(1000 + 200 + 500 + 110);
  });

  it("les paliers de propagandistes augmentent la protection de 5 %", () => {
    expect(calculateProtection(testState({ reachedMilestones: ["propagandists-1"] }))).toBe(1050);
  });

  it("la répression est la part de la protection déjà utilisée", () => {
    expect(repressionOf(testState({ counter: 500 }))).toBe(50);
  });
});

describe("force du mouvement", () => {
  it("additionne les révolutionnaires et la valeur des bonus achetés", () => {
    const strength = movementStrength(testState({ counter: 800, unlockedItems: ["tract", "affiche", "megaphone"] }));
    expect(strength).toMatchObject({ current: 800, invested: 160, value: 960 });
    expect(strength.target).toBe(4345410);
  });

  it("monte doucement au début et atteint 100 % à l'objectif", () => {
    expect(movementPercent(testState({ counter: 0 }))).toBe(0);
    expect(Math.floor(movementPercent(testState({ counter: 10 })))).toBe(7);
    expect(Math.floor(movementPercent(testState({ counter: 1000 })))).toBe(18);
    expect(movementPercent(testState({ counter: 5_000_000 }))).toBe(100);
  });
});

describe("prévisualisation des achats", () => {
  it("annonce la production et la protection gagnées par un lot de recruteurs", () => {
    expect(recruiterChanges(testState(), 10)).toEqual({ production: 30, protection: 500 });
  });

  it("un propagandiste trop cher annonce seulement son propre effet", () => {
    expect(propagandistChanges(testState({ recruiters: 1 }))).toEqual({ protection: 250, efficiency: 2 });
  });
});

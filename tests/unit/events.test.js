import { describe, expect, it } from "vitest";
import { maybeTriggerChoice, resolveChoice } from "../../src/game/choices.js";
import { CHOICES } from "../../src/game/content.js";
import { addEffect, applyEventEffect, eventGain } from "../../src/game/effects.js";
import { testState } from "./helpers.js";

describe("effets des événements", () => {
  it("un gain vaut N minutes de production ou N clics, le plus grand des deux", () => {
    const state = testState({ clickPower: 10, totalProductionPerMinute: 100 });
    expect(eventGain(state, { clicks: 15, minutes: 1 })).toBe(150);
    expect(eventGain(state, { clicks: 5, minutes: 3 })).toBe(300);
  });

  it("un gain ne pousse jamais la répression au-dessus de 95 %", () => {
    const state = testState({ counter: 900, clickPower: 1000 });
    expect(eventGain(state, { clicks: 15, minutes: 0 })).toBe(50); // 950 / 1000
  });

  it("un même effet n'est pas cumulé, sa durée est rafraîchie", () => {
    const state = testState();
    const buff = { id: "greve", label: "Grève", kind: "production", factor: 2, duration: 30 };
    addEffect(state, buff);
    state.activeEffects[0].remaining = 5;
    addEffect(state, buff);
    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects[0].remaining).toBe(30);
  });

  it("{chef} et {parti} sont remplacés dans les libellés", () => {
    const state = testState();
    addEffect(state, { id: "discours", label: "{chef} au micro", kind: "click", factor: 2, duration: 20 });
    expect(state.activeEffects[0].label).toBe("Olympe au micro");
  });

  it("un pari dépend du tirage", () => {
    const gamble = { type: "gamble", chance: 0.6, win: [{ type: "gain", minutes: 0, clicks: 10 }], lose: [{ type: "loss", percent: 20 }] };
    const won = testState({ counter: 100 });
    expect(applyEventEffect(won, gamble, () => 0.1)).toMatch(/^Réussite/);
    expect(won.counter).toBe(110);

    const lost = testState({ counter: 100 });
    expect(applyEventEffect(lost, gamble, () => 0.9)).toMatch(/^Échec/);
    expect(lost.counter).toBe(80);
  });

  it("la protection gagnée est permanente", () => {
    const state = testState();
    applyEventEffect(state, { type: "protection", percent: 10 });
    expect(state.bonusProtection).toBe(100);
  });
});

describe("décisions", () => {
  it("aucune décision avant 90 secondes de jeu", () => {
    const state = testState({ counter: 500 });
    for (let i = 0; i < 89; i++) expect(maybeTriggerChoice(state, true, () => 0)).toBeNull();
    expect(maybeTriggerChoice(state, true, () => 0)).not.toBeNull();
  });

  it("pas de décision quand une autre fenêtre est ouverte", () => {
    const state = testState({ counter: 500, secondsSinceChoice: 500 });
    expect(maybeTriggerChoice(state, false, () => 0)).toBeNull();
  });

  it("choisir applique les effets, l'écrit dans le journal et relance le compte à rebours", () => {
    const state = testState({ counter: 1000, secondsSinceChoice: 200 });
    state.pendingChoice = CHOICES.find((c) => c.id === "mecene");
    const result = resolveChoice(state, 1); // refuse: +5 % protection
    expect(result.results).toContain("protection");
    expect(state).toMatchObject({ pendingChoice: null, secondsSinceChoice: 0, bonusProtection: 50 });
    expect(state.journal[0].type).toBe("choix");
  });

  it("chaque décision a deux options avec au moins un effet", () => {
    CHOICES.forEach((choice) => {
      expect(choice.options).toHaveLength(2);
      choice.options.forEach((option) => expect(option.effects.length).toBeGreaterThan(0));
    });
  });
});

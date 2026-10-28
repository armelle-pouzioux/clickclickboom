import { describe, expect, it } from "vitest";
import { INSURRECTION } from "../../src/game/config.js";
import { insurrectionChances } from "../../src/game/grandSoir.js";
import { buyAllUpgrades, testEngine, testState } from "./helpers.js";

describe("chances de l'insurrection", () => {
  it("15 % de base, jusqu'à +40 % sans répression", () => {
    expect(insurrectionChances(testState({ repressionLevel: 0 })).total).toBe(55);
    expect(insurrectionChances(testState({ repressionLevel: 50 })).total).toBe(35);
  });

  it("les recruteurs et propagandistes comptent, avec un plafond chacun", () => {
    const parts = insurrectionChances(testState({ repressionLevel: 100, recruiters: 60, propagandists: 3 })).parts;
    expect(parts.map((p) => p.value)).toEqual([15, 0, 6, 6]);
    const capped = insurrectionChances(testState({ repressionLevel: 100, recruiters: 1000, propagandists: 100 })).parts;
    expect(capped.map((p) => p.value)).toEqual([15, 0, 15, 20]);
  });

  it("ne dépasse jamais 90 %", () => {
    expect(insurrectionChances(testState({ repressionLevel: 0, recruiters: 1000, propagandists: 100 })).total).toBe(INSURRECTION.cap);
  });
});

describe("le Grand Soir", () => {
  it("se débloque quand la force du mouvement atteint 100 %, et le reste", () => {
    const { state, engine, events } = testEngine();
    buyAllUpgrades(state, ["transformation"]);
    state.counter = 1_999_000;
    engine.refresh();
    expect(state.grandSoirUnlocked).toBe(false);

    state.counter = 2_000_000;
    engine.refresh();
    expect(state.grandSoirUnlocked).toBe(true);
    expect(events.some((e) => e.type === "toast" && e.payload.includes("Grand Soir"))).toBe(true);

    state.counter = 0;
    engine.refresh();
    expect(state.grandSoirUnlocked).toBe(true);
  });

  it("un échec coûte la moitié des révolutionnaires et impose une attente", () => {
    const { state, engine, events } = testEngine({ grandSoirUnlocked: true, counter: 1000, recruiters: 100 }, { rng: () => 0.999 });
    expect(engine.openInsurrection()).not.toBeNull();
    expect(engine.isPaused()).toBe(true);

    const result = engine.launchInsurrection();
    expect(result).toMatchObject({ success: false, lost: 500 });
    expect(state).toMatchObject({ counter: 500, insurrectionCooldown: INSURRECTION.failCooldown, insurrectionAttempts: 1 });
    expect(state.activeEffects.map((e) => e.id)).toContain("contre_revolution");
    expect(events.some((e) => e.type === "insurrection-failed")).toBe(true);

    // no new attempt during the cooldown
    expect(engine.openInsurrection()).toBeNull();
    expect(engine.launchInsurrection()).toBeNull();
  });

  it("une réussite gagne la partie et met le jeu en pause", () => {
    const { state, engine, events } = testEngine({ grandSoirUnlocked: true, recruiters: 100 }, { rng: () => 0 });
    expect(engine.launchInsurrection()).toMatchObject({ success: true });
    expect(state.won).toBe(true);
    expect(events.some((e) => e.type === "victory")).toBe(true);
    expect(engine.click()).toBe(0);
  });

  it("rejouer après la victoire repart de zéro", () => {
    const { state, engine } = testEngine({ grandSoirUnlocked: true, recruiters: 100 }, { rng: () => 0 });
    engine.launchInsurrection();
    engine.reset();
    expect(state).toMatchObject({ won: false, grandSoirUnlocked: false, recruiters: 0, insurrectionAttempts: 0 });
  });
});

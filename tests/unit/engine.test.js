import { describe, expect, it } from "vitest";
import { movementStrength } from "../../src/game/economy.js";
import { createState, loadState, saveState } from "../../src/game/state.js";
import { memoryStore, testEngine } from "./helpers.js";

describe("actions du joueur", () => {
  it("un clic ajoute la puissance de clic", () => {
    const { state, engine } = testEngine({ clickPower: 6 });
    engine.click();
    expect(state.counter).toBe(6);
  });

  it("acheter un bonus de clic coûte son prix et augmente le clic", () => {
    const { state, engine, events } = testEngine({ counter: 150 });
    expect(engine.buyUpgrade("megaphone")).toBe(true);
    expect(state.counter).toBe(50);
    expect(state.clickPower).toBe(6);
    expect(state.journal.find((e) => e.type === "achat")).toMatchObject({ text: "Mégaphone", detail: "+5 par clic · +100 protection" });
    expect(events.some((e) => e.type === "toast")).toBe(true);
  });

  it("refuse un achat trop cher ou déjà fait", () => {
    const { state, engine } = testEngine({ counter: 50 });
    expect(engine.buyUpgrade("megaphone")).toBe(false);
    state.counter = 500;
    engine.buyUpgrade("megaphone");
    expect(engine.buyUpgrade("megaphone")).toBe(false);
    expect(state.counter).toBe(400);
  });

  it("acheter un bonus ne fait pas reculer la force du mouvement", () => {
    const { state, engine } = testEngine({ counter: 150 });
    const before = movementStrength(state).value;
    engine.buyUpgrade("megaphone");
    expect(movementStrength(state).value).toBe(before);
  });

  it("achète les recruteurs par lot, jamais partiellement", () => {
    const { state, engine } = testEngine({ counter: 40 });
    expect(engine.buyRecruiters(10)).toBe(true);
    expect(state).toMatchObject({ recruiters: 10, counter: 8 });
    expect(state.journal.some((e) => e.text === "10 recruteurs formés (n°1 à 10)")).toBe(true);
    expect(engine.buyRecruiters(10)).toBe(false);
    expect(state.recruiters).toBe(10);
  });

  it("un propagandiste se paie en recruteurs", () => {
    const { state, engine } = testEngine({ recruiters: 7 });
    expect(engine.buyPropagandist()).toBe(true);
    expect(state).toMatchObject({ recruiters: 2, propagandists: 1 });
  });
});

describe("chaque seconde", () => {
  it("les petites productions s'accumulent : 1 par minute rapporte 1 en 60 s", () => {
    const { state, engine } = testEngine({ unlockedItems: ["tract"] });
    for (let i = 0; i < 59; i++) engine.tick();
    expect(state.counter).toBe(0);
    engine.tick();
    expect(state.counter).toBe(1);
  });

  it("le jeu est en pause pendant une décision", () => {
    const { state, engine } = testEngine({ recruiters: 100, pendingChoice: { id: "x", options: [] } });
    engine.tick();
    expect(state.counter).toBe(0);
    expect(engine.click()).toBe(0);
  });

  it("les effets temporaires expirent", () => {
    const { state, engine } = testEngine({ activeEffects: [{ id: "x", label: "x", kind: "click", factor: 2, remaining: 2 }] });
    engine.tick();
    expect(state.activeEffects).toHaveLength(1);
    engine.tick();
    expect(state.activeEffects).toHaveLength(0);
  });
});

describe("répression", () => {
  it("à 100 % de répression, la partie est écrasée et recommence", () => {
    const { state, engine, events } = testEngine({ counter: 999, recruiters: 0 });
    state.counter = 1000;
    engine.refresh();
    expect(events.map((e) => e.type)).toEqual(["reset", "gameover"]);
    expect(state).toMatchObject({ counter: 0, recruiters: 0, unlockedItems: [] });
    expect(state.journal[0].text).toContain("Tout recommence");
  });

  it("chaque palier de répression déclenche son malus, puis laisse un répit", () => {
    const { state, engine } = testEngine({ lastRepressionTier: 0 });
    state.counter = 300; // 30 %
    engine.refresh();
    expect(state.activeEffects.map((e) => e.id)).toEqual(["malus_light"]);
    expect(state.journal[0].type).toBe("repression");

    // back under 25 %, then up again: no new strike during the cooldown
    state.activeEffects = [];
    state.counter = 100;
    engine.refresh();
    state.counter = 300;
    engine.refresh();
    expect(state.activeEffects).toHaveLength(0);

    // escalation to a higher tier strikes anyway
    state.counter = 600;
    engine.refresh();
    expect(state.activeEffects.map((e) => e.id)).toEqual(["malus_mod_low"]);
  });
});

describe("paliers", () => {
  it("atteindre un palier l'écrit dans le journal et donne un bonus permanent", () => {
    const { state, engine } = testEngine({ counter: 10 });
    engine.refresh();
    expect(state.reachedMilestones).toContain("counter-10");
    expect(state.journal[0]).toMatchObject({ type: "palier", detail: "Bonus permanent : +3 % de production" });
  });

  it("une ancienne sauvegarde sans paliers ne remplit pas le journal d'un coup", () => {
    const { state, engine } = testEngine({ counter: 900, silentMilestones: true });
    engine.refresh();
    expect(state.reachedMilestones).toEqual(["counter-10", "counter-100", "counter-500"]);
    expect(state.journal).toHaveLength(0);
  });
});

describe("sauvegarde", () => {
  it("une partie sauvegardée se recharge à l'identique", () => {
    const store = memoryStore();
    const { state, engine } = testEngine({ counter: 500 }, { store });
    engine.buyUpgrade("megaphone");
    engine.buyRecruiters(5);

    const loaded = loadState(createState({ upgrades: state.upgrades, malusList: state.malusList }), store);
    expect(loaded).toMatchObject({
      counter: state.counter,
      recruiters: 5,
      unlockedItems: ["megaphone"],
      clickPower: 6,
      reachedMilestones: state.reachedMilestones,
    });
    expect(loaded.journal).toEqual(state.journal);
  });

  it("une sauvegarde abîmée ne casse pas le chargement", () => {
    const store = memoryStore();
    store.set("unlockedItems", "{pas du json");
    store.set("counter", "abc");
    const loaded = loadState(createState(), store);
    expect(loaded).toMatchObject({ counter: 0, unlockedItems: [] });
    saveState(loaded, store);
    expect(store.get("counter")).toBe("0");
  });
});

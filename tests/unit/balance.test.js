// Balance: a simulated player plays whole games. If a setting makes the game impossible,
// too easy or too long, these tests fail.
import { describe, expect, it } from "vitest";
import { RECRUITER_QUANTITIES } from "../../src/game/config.js";
import { propagandistCost, recruitCost } from "../../src/game/economy.js";
import { canLaunchInsurrection, insurrectionChances } from "../../src/game/grandSoir.js";
import { seededRandom, testEngine } from "./helpers.js";

// clicks at a human pace, buys the upgrades in order, organises itself when the repression
// gets high, and launches the insurrection once its chances reach `threshold`
function play({ seed, clicksPerSecond = 3, threshold = 75, maxMinutes = 40 }) {
  const rng = seededRandom(seed);
  const { state, engine, events } = testEngine({}, { rng });
  let seconds = 0;

  for (; seconds < maxMinutes * 60 && !state.won; seconds++) {
    for (let c = 0; c < clicksPerSecond; c++) engine.click();

    const next = state.upgrades.find((u) => !state.unlockedItems.includes(u.id));
    if (next && state.counter >= next.cost) engine.buyUpgrade(next.id);

    const preparing = state.grandSoirUnlocked && insurrectionChances(state).total < threshold;
    if (state.repressionLevel > 70 || preparing) {
      if (state.recruiters > 30 && state.recruiters >= propagandistCost(state)) {
        engine.buyPropagandist();
      } else {
        const batch = [...RECRUITER_QUANTITIES].reverse().find((q) => state.counter >= recruitCost(state, q));
        if (batch) engine.buyRecruiters(batch);
      }
    }

    if (canLaunchInsurrection(state) && insurrectionChances(state).total >= threshold) {
      engine.openInsurrection();
      engine.launchInsurrection();
      continue;
    }

    engine.tick({ canAskChoice: true });
    if (state.pendingChoice) engine.resolveChoice(Math.floor(rng() * state.pendingChoice.options.length));
  }

  return {
    won: state.won,
    minutes: seconds / 60,
    attempts: state.insurrectionAttempts,
    gameOvers: events.filter((e) => e.type === "gameover").length,
  };
}

describe("équilibrage", () => {
  const seeds = [1, 2, 3, 4, 5, 6];

  it.each(seeds)("une joueuse qui s'organise gagne en 5 à 20 minutes (partie n°%i)", (seed) => {
    const result = play({ seed });
    expect(result.won).toBe(true);
    expect(result.gameOvers).toBe(0);
    expect(result.minutes).toBeGreaterThan(5);
    expect(result.minutes).toBeLessThan(20);
  });

  it("le Grand Soir n'est pas gagné d'avance : il faut parfois plusieurs tentatives", () => {
    const attempts = seeds.map((seed) => play({ seed, threshold: 0 }).attempts);
    expect(Math.max(...attempts)).toBeGreaterThan(1);
  });

  it("qui accumule sans jamais rien acheter se fait écraser par la répression", () => {
    const { state, engine, events } = testEngine();
    // 1 per click and a protection of 1000: crushed after about 1000 clicks
    for (let i = 0; i < 1100; i++) {
      engine.click();
      engine.tick();
    }
    expect(events.some((e) => e.type === "gameover")).toBe(true);
    expect(state.counter).toBeLessThan(1000);
  });
});

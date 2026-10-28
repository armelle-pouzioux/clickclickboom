import malusList from "../../src/data/malus.json";
import upgrades from "../../src/data/upgrades.json";
import { createEngine } from "../../src/game/engine.js";
import { createState } from "../../src/game/state.js";

// a localStorage that lives in memory
export function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    keys: () => [...data.keys()],
  };
}

export function memoryStore() {
  const storage = memoryStorage();
  return { get: (name) => storage.getItem(name), set: (name, value) => storage.setItem(name, value) };
}

// deterministic random numbers (mulberry32), so a test replays the same game every time
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// never random: 0.999 makes every roll fail (no event, no choice, gambles lost)
export const noLuck = () => 0.999;

export function testState(overrides = {}) {
  const state = createState({
    upgrades: structuredClone(upgrades),
    malusList: structuredClone(malusList),
    party: { parti: "Les Sans-Voix", chef: "img/chef3.png" },
  });
  return Object.assign(state, overrides);
}

export function testEngine(overrides = {}, { rng = noLuck, store = null } = {}) {
  const state = testState(overrides);
  const engine = createEngine({ state, store, rng });
  const events = [];
  ["toast", "gameover", "reset", "choice", "victory", "insurrection-failed"].forEach((type) => {
    engine.on(type, (payload) => events.push({ type, payload }));
  });
  return { state, engine, events };
}

export function buyAllUpgrades(state, except = []) {
  state.upgrades.filter((u) => !except.includes(u.id)).forEach((u) => state.unlockedItems.push(u.id));
}

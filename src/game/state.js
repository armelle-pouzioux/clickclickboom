// The whole state of one game, in a single object.
// The localStorage keys are the same as in the first version, so existing saves still load.

export function createState({ upgrades = [], malusList = [], party = null } = {}) {
  return {
    upgrades,
    malusList,
    party,                       // { parti, chef }

    counter: 0,
    clickPower: 1,
    unlockedItems: [],
    recruiters: 0,
    propagandists: 0,
    totalProductionPerMinute: 0,
    accumulatedProduction: 0,
    repressionLevel: 0,

    journal: [],
    journalVersion: 0,           // bumped on every change, so the UI only redraws the journal when needed
    reachedMilestones: [],
    silentMilestones: false,     // an old save without milestones: mark them without flooding the journal
    lastRepressionTier: null,
    lastNarrative: null,

    activeEffects: [],
    bonusProtection: 0,
    repressionStrike: { tier: 0, cooldown: 0 },

    pendingChoice: null,
    secondsSinceChoice: 0,
    lastChoiceId: null,

    grandSoirUnlocked: false,
    insurrectionCooldown: 0,
    insurrectionAttempts: 0,
    insurrectionPending: false,
    won: false,
  };
}

function readJson(store, name, fallback) {
  try {
    return JSON.parse(store.get(name)) ?? fallback;
  } catch {
    return fallback;
  }
}

function readNumber(store, name, fallback = 0) {
  const value = Number.parseFloat(store.get(name));
  return Number.isFinite(value) ? value : fallback;
}

export function loadState(state, store) {
  state.counter = Math.floor(readNumber(store, "counter"));
  state.unlockedItems = readJson(store, "unlockedItems", []);
  state.recruiters = Math.floor(readNumber(store, "recruiters"));
  state.propagandists = Math.floor(readNumber(store, "propagandists"));
  state.totalProductionPerMinute = readNumber(store, "totalProductionPerMinute");

  state.journal = readJson(store, "journal", []);
  state.reachedMilestones = readJson(store, "milestones", []);
  state.silentMilestones = store.get("milestones") === null;

  state.activeEffects = readJson(store, "effects", []);
  state.bonusProtection = readNumber(store, "bonusProtection");

  state.grandSoirUnlocked = store.get("grandSoir") === "1";
  state.insurrectionCooldown = readNumber(store, "insurrectionCooldown");
  state.insurrectionAttempts = readNumber(store, "insurrectionAttempts");

  // click power always comes from the purchased upgrades
  state.clickPower = 1 + state.upgrades
    .filter((u) => u.type === "clickPower" && state.unlockedItems.includes(u.id))
    .reduce((sum, u) => sum + u.power, 0);
  return state;
}

export function saveState(state, store) {
  store.set("counter", state.counter);
  store.set("clickPower", state.clickPower);
  store.set("unlockedItems", JSON.stringify(state.unlockedItems));
  store.set("recruiters", state.recruiters);
  store.set("propagandists", state.propagandists);
  store.set("totalProductionPerMinute", state.totalProductionPerMinute);
  store.set("repressionLevel", state.repressionLevel);
  store.set("journal", JSON.stringify(state.journal));
  store.set("milestones", JSON.stringify(state.reachedMilestones));
  store.set("effects", JSON.stringify(state.activeEffects));
  store.set("bonusProtection", state.bonusProtection);
  store.set("grandSoir", state.grandSoirUnlocked ? "1" : "0");
  store.set("insurrectionCooldown", state.insurrectionCooldown);
  store.set("insurrectionAttempts", state.insurrectionAttempts);
}

// a new game for the same party: keeps the data (upgrades, malus) and the party
export function resetState(state) {
  const fresh = createState({ upgrades: state.upgrades, malusList: state.malusList, party: state.party });
  fresh.lastRepressionTier = 0;
  fresh.journalVersion = state.journalVersion + 1;
  Object.assign(state, fresh);
  return state;
}

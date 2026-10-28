// Gestion des parties : chaque partie a un id et ses propres clés dans le localStorage
// ("<id>:counter", "<id>:recruiters"...), ce qui permet d'en jouer plusieurs en parallèle.
export const PARTIES_KEY = "parties";
export const GAME_KEYS = [
  "counter", "clickPower", "unlockedItems", "recruiters", "propagandists", "totalProductionPerMinute",
  "repressionLevel", "journal", "milestones", "effects", "bonusProtection",
  "grandSoir", "insurrectionCooldown", "insurrectionAttempts",
];

export const CHEFS = {
  "img/chef1.png": "Rachel",
  "img/chef2.png": "Karl",
  "img/chef3.png": "Olympe",
};

export function listParties(storage = localStorage) {
  try {
    return JSON.parse(storage.getItem(PARTIES_KEY)) || [];
  } catch {
    return [];
  }
}

function saveParties(parties, storage) {
  storage.setItem(PARTIES_KEY, JSON.stringify(parties));
}

export function getParty(id, storage = localStorage) {
  return listParties(storage).find((p) => p.id === id);
}

export function partyKey(id, name) {
  return `${id}:${name}`;
}

export function createParty(parti, chef, storage = localStorage) {
  const party = { id: Date.now().toString(36), parti, chef, createdAt: Date.now() };
  saveParties([...listParties(storage), party], storage);
  return party;
}

export function deleteParty(id, storage = localStorage) {
  GAME_KEYS.forEach((name) => storage.removeItem(partyKey(id, name)));
  saveParties(listParties(storage).filter((p) => p.id !== id), storage);
}

// the keys of one game, read and written without the "<id>:" prefix
export function partyStore(id, storage = localStorage) {
  return {
    get: (name) => storage.getItem(partyKey(id, name)),
    set: (name, value) => storage.setItem(partyKey(id, name), value),
  };
}

// ancienne version : une seule partie avec des clés sans préfixe
export function migrateOldSave(storage = localStorage) {
  if (storage.getItem(PARTIES_KEY) !== null || storage.getItem("counter") === null) return;

  const party = createParty(storage.getItem("parti") || "Révolution", storage.getItem("chef-image") || "img/chef1.png", storage);
  GAME_KEYS.forEach((name) => {
    const value = storage.getItem(name);
    if (value !== null) storage.setItem(partyKey(party.id, name), value);
    storage.removeItem(name);
  });
}

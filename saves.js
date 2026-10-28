// Gestion des parties : chaque partie a un id et ses propres clés dans le localStorage
// ("<id>:counter", "<id>:recruiters"...), ce qui permet d'en jouer plusieurs en parallèle.
const PARTIES_KEY = "parties";
const GAME_KEYS = ["counter", "clickPower", "unlockedItems", "recruiters", "propagandists", "totalProductionPerMinute", "repressionLevel", "journal", "milestones", "effects", "bonusProtection", "grandSoir", "insurrectionCooldown", "insurrectionAttempts"];

const CHEFS = {
  "img/chef1.png": "Rachel",
  "img/chef2.png": "Karl",
  "img/chef3.png": "Olympe",
};

function listParties() {
  try {
    return JSON.parse(localStorage.getItem(PARTIES_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveParties(parties) {
  localStorage.setItem(PARTIES_KEY, JSON.stringify(parties));
}

function getParty(id) {
  return listParties().find((p) => p.id === id);
}

function partyKey(id, name) {
  return `${id}:${name}`;
}

function createParty(parti, chef) {
  const party = { id: Date.now().toString(36), parti, chef, createdAt: Date.now() };
  saveParties([...listParties(), party]);
  return party;
}

function deleteParty(id) {
  GAME_KEYS.forEach((name) => localStorage.removeItem(partyKey(id, name)));
  saveParties(listParties().filter((p) => p.id !== id));
}

// ancienne version : une seule partie avec des clés sans préfixe
function migrateOldSave() {
  if (localStorage.getItem(PARTIES_KEY) !== null || localStorage.getItem("counter") === null) return;

  const party = createParty(localStorage.getItem("parti") || "Révolution", localStorage.getItem("chef-image") || "img/chef1.png");
  GAME_KEYS.forEach((name) => {
    const value = localStorage.getItem(name);
    if (value !== null) localStorage.setItem(partyKey(party.id, name), value);
    localStorage.removeItem(name);
  });
}

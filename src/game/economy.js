// Numbers of the game: production, costs, protection, repression. No DOM here.
import { COSTS, MILESTONE_REWARDS, PROTECTION } from "./config.js";

export function isBought(state, upgrade) {
  return state.unlockedItems.includes(upgrade.id);
}

export function boughtCount(state) {
  return state.upgrades.filter((u) => isBought(state, u)).length;
}

// temporary effects of these kinds multiply each other
export function effectFactor(state, kinds) {
  return state.activeEffects
    .filter((effect) => kinds.includes(effect.kind))
    .reduce((factor, effect) => factor * effect.factor, 1);
}

// permanent bonus earned with milestones: 1 + rate x number of milestones of this kind
export function permanentBonus(state, kind) {
  const count = state.reachedMilestones.filter((key) => key.startsWith(`${kind}-`)).length;
  return 1 + MILESTONE_REWARDS[kind].rate * count;
}

// each propagandist makes every recruiter 2 % more efficient
export function recruiterEfficiency(propagandists) {
  return 5 + propagandists * 2;
}

// production per minute for a given army, used for display and purchase previews
export function calculateProduction(state, nbRecruiters = state.recruiters, nbPropagandists = state.propagandists) {
  const fromRecruiters = nbRecruiters * 60 * (recruiterEfficiency(nbPropagandists) / 100)
    * permanentBonus(state, "recruiters")
    * effectFactor(state, ["recruiters", "production", "global"]);

  const fromUpgrades = state.upgrades
    .filter((u) => u.type === "autoclick" && isBought(state, u))
    .reduce((sum, u) => sum + u.clicksPerMinute, 0)
    * effectFactor(state, ["autoclick", "production", "global"]);

  return Math.floor((fromRecruiters + fromUpgrades) * permanentBonus(state, "counter"));
}

// click power after temporary effects
export function effectiveClick(state) {
  return Math.max(1, Math.round(state.clickPower * effectFactor(state, ["click", "global"])));
}

// total cost of the next `quantity` recruiters: each one costs 12.5 % more than the previous
export function recruitCost(state, quantity = 1) {
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    total += Math.floor(COSTS.recruiterBase * Math.pow(COSTS.multiplier, state.recruiters + i));
  }
  return total;
}

// cost in recruiters of the next propagandist
export function propagandistCost(state) {
  return Math.floor(COSTS.propagandistBase * Math.pow(COSTS.multiplier, state.propagandists));
}

export function calculateProtection(state) {
  // every purchased upgrade organises the movement: its cost becomes protection
  const fromUpgrades = state.upgrades
    .filter((u) => isBought(state, u))
    .reduce((sum, u) => sum + u.cost, 0);

  return Math.floor((PROTECTION.base
    + state.recruiters * PROTECTION.recruiter
    + state.propagandists * PROTECTION.propagandist
    + fromUpgrades
    + state.bonusProtection) * permanentBonus(state, "propagandists"));
}

// % of the protection already used: at 100 % the movement is crushed
export function repressionOf(state) {
  return (state.counter / calculateProtection(state)) * 100;
}

// strength of the movement = revolutionaries + value of the upgrades already bought,
// so buying an upgrade does not make it go back. 100 % unlocks the Grand Soir.
export function movementStrength(state) {
  const invested = state.upgrades
    .filter((u) => isBought(state, u))
    .reduce((sum, u) => sum + u.cost, 0);
  const target = state.upgrades.reduce((sum, u) => sum + u.cost, 0);
  const current = Math.floor(state.counter);
  return { current, invested, value: current + invested, target };
}

// logarithmic scale: 10 → 100 moves the bar as much as 100 000 → 1 000 000,
// which follows the playing time (the end of the game goes much faster)
export function movementPercent(state) {
  const { value, target } = movementStrength(state);
  if (value >= target) return 100;
  return (Math.log10(1 + value) / Math.log10(1 + target)) * 100;
}

export function gameProgress(state) {
  const bought = boughtCount(state);
  const total = state.upgrades.length;
  return { bought, total, percent: total ? Math.min(100, (bought / total) * 100) : 0 };
}

// what a purchase changes, for the previews under the buttons
export function recruiterChanges(state, quantity = 1) {
  return {
    production: calculateProduction(state, state.recruiters + quantity) - calculateProduction(state),
    protection: PROTECTION.recruiter * quantity,
  };
}

export function propagandistChanges(state) {
  const cost = propagandistCost(state);
  // not affordable yet: show the propagandist's own effect
  if (state.recruiters < cost) {
    return { protection: PROTECTION.propagandist, efficiency: 2 };
  }
  return {
    production: calculateProduction(state, state.recruiters - cost, state.propagandists + 1) - calculateProduction(state),
    protection: PROTECTION.propagandist - cost * PROTECTION.recruiter,
    efficiency: 2,
  };
}

export function upgradeChanges(upgrade) {
  return {
    production: upgrade.type === "autoclick" ? upgrade.clicksPerMinute : 0,
    clickPower: upgrade.type === "clickPower" ? upgrade.power : 0,
    protection: upgrade.cost,
  };
}

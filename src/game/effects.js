// Temporary effects (repression malus, events, choices), counted in seconds of play
// and saved with the game, so reloading the page does not clear a malus. No DOM here.
import { SAFE_REPRESSION } from "./config.js";
import { calculateProtection, effectiveClick } from "./economy.js";
import { fillLore, formatFactor, fr } from "./text.js";

export function addEffect(state, effect) {
  const existing = state.activeEffects.find((e) => e.id === effect.id);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, effect.duration);
    return;
  }
  state.activeEffects.push({
    id: effect.id,
    label: fillLore(state, effect.label),
    kind: effect.kind,
    factor: effect.factor,
    remaining: effect.duration,
  });
}

export function tickEffects(state) {
  state.activeEffects.forEach((effect) => effect.remaining--);
  state.activeEffects = state.activeEffects.filter((effect) => effect.remaining > 0);

  const strike = state.repressionStrike;
  strike.cooldown = Math.max(0, strike.cooldown - 1);
  if (!strike.cooldown) strike.tier = 0;
}

// an entry of malus.json as a temporary effect
export function malusToEffect(malus) {
  const kinds = { clickPower: "click", autoclick: "autoclick", recruiters: "recruiters", global: "global" };
  return {
    id: malus.id,
    label: malus.label.split(":")[0].trim(),
    kind: kinds[malus.type] || "global",
    factor: 1 - malus.intensity,
    duration: malus.duration / 1000,
  };
}

// amount of an event gain right now, capped so it never triggers the repression
export function eventGain(state, effect) {
  const gain = Math.floor(Math.max(effect.clicks * effectiveClick(state), effect.minutes * state.totalProductionPerMinute));
  const room = Math.floor(SAFE_REPRESSION * calculateProtection(state) - state.counter);
  return Math.max(0, Math.min(gain, room));
}

// text of an effect with the numbers of the current game, used before applying it
export function describeEventEffect(state, effect) {
  switch (effect.type) {
    case "gain": return `+${fr(eventGain(state, effect))} révolutionnaires`;
    case "loss": return `−${fr(state.counter * effect.percent / 100)} révolutionnaires (−${effect.percent} %)`;
    case "buff": return `${fillLore(state, effect.label)} : ${formatFactor(effect)} pendant ${effect.duration} s`;
    case "protection": return `+${fr(calculateProtection(state) * effect.percent / 100)} protection (permanent)`;
    case "recruiterLoss": return `−${effect.count} recruteur`;
    case "gamble": {
      const win = effect.win.map((e) => describeEventEffect(state, e)).join(", ");
      const lose = effect.lose.map((e) => describeEventEffect(state, e)).join(", ");
      return `${Math.round(effect.chance * 100)} % de chances : ${win} — sinon : ${lose}`;
    }
    default: return "";
  }
}

// applies an effect and returns what happened, for the journal
export function applyEventEffect(state, effect, rng = Math.random) {
  const description = effect.type === "gamble" ? "" : describeEventEffect(state, effect);

  switch (effect.type) {
    case "gain":
      state.counter += eventGain(state, effect);
      break;
    case "loss":
      state.counter -= Math.floor(state.counter * effect.percent / 100);
      break;
    case "buff":
      addEffect(state, effect);
      break;
    case "protection":
      state.bonusProtection += Math.floor(calculateProtection(state) * effect.percent / 100);
      break;
    case "recruiterLoss":
      state.recruiters = Math.max(0, state.recruiters - effect.count);
      break;
    case "gamble": {
      const won = rng() < effect.chance;
      const results = (won ? effect.win : effect.lose).map((e) => applyEventEffect(state, e, rng)).join(" · ");
      return `${won ? "Réussite" : "Échec"} : ${results}`;
    }
  }
  return description;
}

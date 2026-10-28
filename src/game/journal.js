// Journal of the revolution: purchases, milestones, repression and stories. No DOM here.
import { JOURNAL_MAX, MILESTONE_REWARDS, NARRATIVE_CHANCE, REPRESSION_COOLDOWN } from "./config.js";
import { MILESTONES, NARRATIVE_EVENTS, REPRESSION_LINES } from "./content.js";
import { boughtCount } from "./economy.js";
import { addEffect, applyEventEffect, malusToEffect } from "./effects.js";
import { fillLore } from "./text.js";

export const JOURNAL_ICONS = { achat: "🛒", palier: "🏆", repression: "🚨", recit: "📜", choix: "⚖️" };

export function addJournal(state, type, text, detail = "") {
  state.journal.unshift({ type, text: fillLore(state, text), detail, time: Date.now() });
  state.journal.length = Math.min(state.journal.length, JOURNAL_MAX);
  state.journalVersion++;
}

// milestones give a permanent bonus; each new repression tier triggers its malus
export function checkMilestones(state) {
  const values = { counter: state.counter, recruiters: state.recruiters, propagandists: state.propagandists };

  Object.entries(MILESTONES).forEach(([kind, steps]) => {
    Object.entries(steps).forEach(([threshold, text]) => {
      const key = `${kind}-${threshold}`;
      if (values[kind] >= Number(threshold) && !state.reachedMilestones.includes(key)) {
        state.reachedMilestones.push(key);
        if (!state.silentMilestones) addJournal(state, "palier", text, `Bonus permanent : ${MILESTONE_REWARDS[kind].label}`);
      }
    });
  });
  state.silentMilestones = false;

  // after a strike, nothing for a while unless the repression escalates to a higher tier
  const tiers = Object.keys(REPRESSION_LINES).map(Number);
  const tier = tiers.filter((t) => state.repressionLevel >= t).pop() || 0;
  const strike = state.repressionStrike;
  const escalates = tier > strike.tier;

  if (state.lastRepressionTier !== null && tier > state.lastRepressionTier && (!strike.cooldown || escalates)) {
    const malus = state.malusList.find((m) => m.triggerThreshold === tier);
    strike.tier = tier;
    strike.cooldown = (malus ? malus.duration / 1000 : 0) + REPRESSION_COOLDOWN;

    let detail = "";
    if (malus) {
      addEffect(state, malusToEffect(malus));
      detail = `${malus.label} pendant ${malus.duration / 1000} s`;
    }
    addJournal(state, "repression", REPRESSION_LINES[tier], detail);
  }
  state.lastRepressionTier = tier;
}

function currentPhase(state) {
  const bought = boughtCount(state);
  if (bought >= 14) return "apogee";
  if (bought >= 5) return "essor";
  return "debut";
}

// about once a minute, a story from the current phase, sometimes with an effect
export function maybeAddNarrative(state, rng = Math.random) {
  if (rng() >= NARRATIVE_CHANCE) return null;

  const events = NARRATIVE_EVENTS[currentPhase(state)].filter((event) => event !== state.lastNarrative);
  const event = events[Math.floor(rng() * events.length)];
  state.lastNarrative = event;

  const detail = event.effect ? applyEventEffect(state, event.effect, rng) : "";
  addJournal(state, "recit", event.text, detail);
  return event;
}

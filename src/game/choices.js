// Decisions: every few minutes the player must choose. The game is paused meanwhile. No DOM here.
import { CHOICE_CHANCE, CHOICE_MIN_GAP } from "./config.js";
import { CHOICES } from "./content.js";
import { applyEventEffect } from "./effects.js";
import { addJournal } from "./journal.js";

// called every second; `canAsk` is false while something else is on screen
export function maybeTriggerChoice(state, canAsk, rng = Math.random) {
  state.secondsSinceChoice++;
  if (state.secondsSinceChoice < CHOICE_MIN_GAP || !canAsk || state.insurrectionPending) return null;
  if (rng() >= CHOICE_CHANCE) return null;

  const candidates = CHOICES.filter((choice) => choice.id !== state.lastChoiceId && choice.condition(state));
  if (!candidates.length) return null;

  const choice = candidates[Math.floor(rng() * candidates.length)];
  state.pendingChoice = choice;
  state.lastChoiceId = choice.id;
  return choice;
}

export function resolveChoice(state, index, rng = Math.random) {
  const choice = state.pendingChoice;
  const option = choice?.options[index];
  if (!option) return null;

  state.pendingChoice = null;
  state.secondsSinceChoice = 0;

  const results = option.effects.map((effect) => applyEventEffect(state, effect, rng)).join(" · ");
  addJournal(state, "choix", `${choice.text} Choix : ${option.label}.`, results);
  return { choice, option, results };
}

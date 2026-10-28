// The engine runs one game: player actions and the one-second tick. It changes the state,
// saves it, and tells the UI what happened through events. No DOM here, so it can be tested.
import { maybeTriggerChoice, resolveChoice as applyChoice } from "./choices.js";
import {
  calculateProduction, effectiveClick, isBought, propagandistChanges, propagandistCost,
  recruitCost, recruiterChanges, repressionOf, upgradeChanges,
} from "./economy.js";
import { tickEffects } from "./effects.js";
import {
  canLaunchInsurrection, checkGrandSoir, insurrectionChances, launchInsurrection as launch, tickGrandSoir,
} from "./grandSoir.js";
import { addJournal, checkMilestones, maybeAddNarrative } from "./journal.js";
import { resetState, saveState } from "./state.js";
import { describeChanges, upgradeName } from "./text.js";

export function createEngine({ state, store = null, rng = Math.random }) {
  const listeners = {};

  function emit(type, payload) {
    (listeners[type] || []).forEach((listener) => listener(payload));
  }

  function save() {
    if (store) saveState(state, store);
  }

  function isPaused() {
    return Boolean(state.pendingChoice || state.insurrectionPending || state.won);
  }

  // after every change: production, Grand Soir, repression (game over), milestones
  function refresh() {
    state.totalProductionPerMinute = calculateProduction(state);
    if (checkGrandSoir(state)) emit("toast", "Le Grand Soir est débloqué : lancez l'insurrection quand vous le souhaitez !");

    state.repressionLevel = repressionOf(state);
    if (state.repressionLevel >= 100) {
      reset();
      emit("gameover");
      return false;
    }

    checkMilestones(state);
    save();
    return true;
  }

  function reset() {
    resetState(state);
    addJournal(state, "recit", "Tout recommence. Dans une arrière-salle, {chef} rallume la flamme.");
    refresh();
    emit("reset");
  }

  function click() {
    if (isPaused()) return 0;
    const gained = effectiveClick(state);
    state.counter += gained;
    save();
    return gained;
  }

  function buyUpgrade(id) {
    const upgrade = state.upgrades.find((u) => u.id === id);
    if (!upgrade || isBought(state, upgrade) || state.counter < upgrade.cost || isPaused()) return false;

    const changes = describeChanges(upgradeChanges(upgrade));
    state.counter -= upgrade.cost;
    state.unlockedItems.push(upgrade.id);
    if (upgrade.type === "clickPower") state.clickPower += upgrade.power;

    addJournal(state, "achat", `${upgradeName(upgrade)}${upgrade.description ? ` — ${upgrade.description}` : ""}`, changes);
    refresh();
    emit("toast", `${upgradeName(upgrade)} : ${changes}`);
    return true;
  }

  function buyRecruiters(quantity = 1) {
    const cost = recruitCost(state, quantity);
    if (state.counter < cost || isPaused()) return false;

    const changes = describeChanges(recruiterChanges(state, quantity));
    const first = state.recruiters + 1;
    state.counter -= cost;
    state.recruiters += quantity;

    addJournal(state, "achat",
      quantity > 1 ? `${quantity} recruteurs formés (n°${first} à ${state.recruiters})` : `Recruteur n°${state.recruiters} formé`,
      changes);
    refresh();
    emit("toast", `${quantity > 1 ? `${quantity} recruteurs formés` : "Recruteur formé"} : ${changes}`);
    return true;
  }

  function buyPropagandist() {
    const cost = propagandistCost(state);
    if (state.recruiters < cost || isPaused()) return false;

    const changes = describeChanges(propagandistChanges(state));
    state.recruiters -= cost;
    state.propagandists++;

    addJournal(state, "achat", `Propagandiste n°${state.propagandists} formé`, changes);
    refresh();
    emit("toast", `Propagandiste formé : ${changes}`);
    return true;
  }

  // one second of game; `canAskChoice` is false while something else is on screen
  function tick({ canAskChoice = true } = {}) {
    if (isPaused()) return;

    state.totalProductionPerMinute = calculateProduction(state);
    // accumulate fractions so small bonuses still count
    state.accumulatedProduction += state.totalProductionPerMinute / 60;
    const added = Math.floor(state.accumulatedProduction);
    if (added > 0) {
      state.counter += added;
      state.accumulatedProduction -= added;
    }

    // propagandists sometimes convince someone to become a recruiter
    if (state.propagandists > 0 && state.recruiters > 0 && rng() < 0.0001 * state.propagandists) {
      state.recruiters++;
    }

    tickEffects(state);
    tickGrandSoir(state);
    if (!refresh()) return;

    if (maybeAddNarrative(state, rng)) refresh();

    const choice = maybeTriggerChoice(state, canAskChoice, rng);
    if (choice) emit("choice", choice);
    save();
  }

  function resolveChoice(index) {
    const result = applyChoice(state, index, rng);
    if (!result) return null;
    refresh();
    emit("toast", `${result.option.label} : ${result.results}`);
    return result;
  }

  // the game is paused while the player looks at the chances
  function openInsurrection() {
    if (!canLaunchInsurrection(state)) return null;
    state.insurrectionPending = true;
    return insurrectionChances(state);
  }

  function cancelInsurrection() {
    state.insurrectionPending = false;
  }

  function launchInsurrection() {
    if (!state.grandSoirUnlocked || state.insurrectionCooldown > 0 || state.won) return null;
    const result = launch(state, rng);
    if (result.success) {
      save();
      emit("victory", result);
    } else {
      refresh();
      emit("insurrection-failed", result);
    }
    return result;
  }

  return {
    state,
    on(type, listener) {
      (listeners[type] ||= []).push(listener);
    },
    isPaused,
    refresh,
    save,
    reset,
    click,
    buyUpgrade,
    buyRecruiters,
    buyPropagandist,
    tick,
    resolveChoice,
    openInsurrection,
    cancelInsurrection,
    launchInsurrection,
  };
}

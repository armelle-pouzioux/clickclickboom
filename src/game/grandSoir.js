// Victory: the Grand Soir. When the movement strength reaches 100 %, the insurrection is
// unlocked for good; its chances depend on the repression, the recruiters and the propagandists.
import { INSURRECTION } from "./config.js";
import { movementStrength } from "./economy.js";
import { addEffect } from "./effects.js";
import { addJournal } from "./journal.js";
import { fr, plural } from "./text.js";

export function insurrectionChances(state) {
  const repression = Math.min(100, Math.max(0, state.repressionLevel));
  const parts = [
    { label: "Base", value: INSURRECTION.base },
    {
      label: `Répression à ${Math.floor(repression)} %`,
      value: Math.round((1 - repression / 100) * INSURRECTION.repressionWeight),
      max: INSURRECTION.repressionWeight,
    },
    {
      label: plural(state.recruiters, "recruteur"),
      value: Math.min(INSURRECTION.recruitersMax, Math.floor(state.recruiters / INSURRECTION.recruitersPerPoint)),
      max: INSURRECTION.recruitersMax,
    },
    {
      label: plural(state.propagandists, "propagandiste"),
      value: Math.min(INSURRECTION.propagandistsMax, Math.round(state.propagandists * INSURRECTION.propagandistPoints)),
      max: INSURRECTION.propagandistsMax,
    },
  ];
  const total = Math.min(INSURRECTION.cap, parts.reduce((sum, part) => sum + part.value, 0));
  return { total, parts };
}

// returns true the moment the Grand Soir gets unlocked
export function checkGrandSoir(state) {
  if (state.grandSoirUnlocked) return false;
  const { value, target } = movementStrength(state);
  if (value < target) return false;

  state.grandSoirUnlocked = true;
  addJournal(state, "palier", "Le pays entier est prêt. {chef} peut appeler au Grand Soir.", "Insurrection débloquée");
  return true;
}

export function canLaunchInsurrection(state) {
  return state.grandSoirUnlocked && state.insurrectionCooldown <= 0 && !state.won;
}

export function tickGrandSoir(state) {
  if (state.insurrectionCooldown > 0) state.insurrectionCooldown--;
}

export function launchInsurrection(state, rng = Math.random) {
  const chance = insurrectionChances(state).total;
  state.insurrectionAttempts++;
  state.insurrectionPending = false;

  if (rng() * 100 < chance) {
    state.won = true;
    addJournal(state, "palier", "Le Grand Soir ! Le peuple prend les places, les ministères tombent un à un.", `Victoire avec ${chance} % de chances`);
    return { success: true, chance, lost: 0 };
  }

  const lost = Math.floor(state.counter * INSURRECTION.failLoss / 100);
  state.counter -= lost;
  state.insurrectionCooldown = INSURRECTION.failCooldown;
  addEffect(state, { id: "contre_revolution", label: "Contre-révolution", kind: "global", factor: 0.5, duration: INSURRECTION.failCooldown });
  addJournal(state, "repression", "L'insurrection est écrasée. Les survivants se cachent et préparent la suite.",
    `Échec (${chance} % de chances) : −${fr(lost)} révolutionnaires, contre-révolution pendant ${INSURRECTION.failCooldown} s`);
  return { success: false, chance, lost };
}

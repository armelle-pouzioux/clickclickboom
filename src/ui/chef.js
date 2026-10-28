// The leader speaks when clicked: a line of their own or advice on the current game.
import { CHEF_LINES } from "../game/content.js";
import { recruitCost } from "../game/economy.js";
import { insurrectionChances } from "../game/grandSoir.js";
import { chefName, describeUpgradeEffect, fr, upgradeName } from "../game/text.js";
import { byId } from "./dom.js";

// advice depending on the current state of the game
export function gameTips(state) {
  const tips = [];
  const next = state.upgrades.find((u) => !state.unlockedItems.includes(u.id));

  if (state.grandSoirUnlocked) tips.push(`Le Grand Soir est prêt : ${insurrectionChances(state).total} % de chances. Fais baisser la répression pour les augmenter.`);
  if (state.repressionLevel >= 60) tips.push("La répression monte ! Dépense tes révolutionnaires avant qu'elle ne frappe.");
  if (state.recruiters === 0 && state.counter >= recruitCost(state)) tips.push("Forme un recruteur : il recrute pour toi même quand tu ne cliques pas.");
  if (next && state.counter >= next.cost) tips.push(`Tu peux t'offrir : ${upgradeName(next)} (${describeUpgradeEffect(next)}).`);
  if (next && state.counter < next.cost) tips.push(`Prochain objectif : ${upgradeName(next)}, il te manque ${fr(next.cost - state.counter)} révolutionnaires.`);
  if (state.recruiters >= 20 && state.propagandists === 0) tips.push("Avec autant de recruteurs, un propagandiste devient rentable.");

  return tips;
}

let lastLine = null;
let bubbleTimeout = null;

export function chefSpeaks(state, rng = Math.random) {
  const lines = CHEF_LINES[state.party?.chef] || CHEF_LINES["img/chef1.png"];
  const tips = gameTips(state);

  // one time out of two, give advice when there is some
  const pool = tips.length && rng() < 0.5 ? tips : lines;
  let line = pool[Math.floor(rng() * pool.length)];
  if (line === lastLine && pool.length > 1) line = pool[(pool.indexOf(line) + 1) % pool.length];
  lastLine = line;

  const name = document.createElement("strong");
  name.textContent = chefName(state);
  const bubble = byId("chef-bubble");
  bubble.replaceChildren(name, ` : ${line}`);
  bubble.classList.remove("hidden");
  clearTimeout(bubbleTimeout);
  bubbleTimeout = setTimeout(() => bubble.classList.add("hidden"), 6000);
}

// Text helpers shared by the game logic (journal entries) and the UI. No DOM here.
import { CHEFS } from "../saves.js";

export const EFFECT_KINDS = {
  click: "par clic",
  production: "production",
  autoclick: "autoclick",
  recruiters: "recruteurs",
  global: "tout",
};

export function fr(value) {
  return Math.floor(value).toLocaleString("fr-FR");
}

export function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// {parti} and {chef} in the stories become the name of the party and of its leader
export function fillLore(state, text) {
  const party = state.party || {};
  return text
    .replaceAll("{parti}", `« ${party.parti || "Révolution"} »`)
    .replaceAll("{chef}", CHEFS[party.chef] || "le chef");
}

export function chefName(state) {
  return CHEFS[state.party?.chef] || "Chef";
}

export function formatSigned(value, unit) {
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toLocaleString("fr-FR")} ${unit}`;
}

// describes the difference between two states, e.g. "+3 par minute · +50 protection"
export function describeChanges(changes) {
  const parts = [];
  if (changes.production) parts.push(formatSigned(changes.production, "par minute"));
  if (changes.clickPower) parts.push(formatSigned(changes.clickPower, "par clic"));
  if (changes.protection) parts.push(formatSigned(changes.protection, "protection"));
  if (changes.efficiency) parts.push(formatSigned(changes.efficiency, "% efficacité des recruteurs"));
  return parts.join(" · ");
}

// "production ×2" or "par clic −30 %"
export function formatFactor(effect) {
  const kind = EFFECT_KINDS[effect.kind];
  if (effect.factor >= 1) return `${kind} ×${effect.factor.toLocaleString("fr-FR")}`;
  return `${kind} −${Math.round((1 - effect.factor) * 100)} %`;
}

export function describeUpgradeEffect(upgrade) {
  if (upgrade.type === "clickPower") return `+${fr(upgrade.power)} par clic`;
  return `+${fr(upgrade.clicksPerMinute)} par minute`;
}

// "Acheter Tract (10 Révolutionnaires)" -> "Tract"
export function upgradeName(upgrade) {
  return upgrade.label.replace(/^Acheter /, "").replace(/\s*\(.*\)\s*$/, "");
}

export function plural(count, word) {
  return `${count} ${word}${count > 1 ? "s" : ""}`;
}

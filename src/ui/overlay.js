// The overlay window: help, decisions, Grand Soir, game over and victory.
import { INSURRECTION, PROTECTION } from "../game/config.js";
import { effectiveClick, isBought } from "../game/economy.js";
import { describeEventEffect } from "../game/effects.js";
import { describeUpgradeEffect, escapeHtml, fillLore, fr, upgradeName } from "../game/text.js";
import { byId } from "./dom.js";

export function openOverlay(html, closable = true) {
  byId("overlay-body").innerHTML = html;
  byId("overlay-close").style.display = closable ? "" : "none";
  byId("overlay").dataset.closable = String(closable);
  byId("overlay").classList.remove("hidden");
}

// `force` closes even a window that must not be dismissed (decision, victory)
export function closeOverlay(force = false) {
  const overlay = byId("overlay");
  if (!force && overlay.dataset.closable === "false") return;
  overlay.classList.add("hidden");
}

export function isOverlayOpen() {
  return !byId("overlay").classList.contains("hidden");
}

export function setupOverlay() {
  byId("overlay-close").addEventListener("click", () => closeOverlay());
  byId("overlay").addEventListener("click", (event) => {
    if (event.target.id === "overlay") closeOverlay();
  });
}

export function showHelp(state) {
  const rows = state.upgrades.map((upgrade) => {
    const bought = isBought(state, upgrade);
    let status = "🔒";
    if (bought) status = "✅";
    else if (state.counter >= upgrade.cost) status = "🛒";

    return `
      <tr class="${bought ? "owned" : ""}">
        <td>${status}</td>
        <td><strong>${escapeHtml(upgradeName(upgrade))}</strong>${upgrade.description ? `<br><small>${escapeHtml(upgrade.description)}</small>` : ""}</td>
        <td>${fr(upgrade.cost)}</td>
        <td>${describeUpgradeEffect(upgrade)}</td>
      </tr>`;
  }).join("");

  openOverlay(`
    <h2>Comment jouer</h2>
    <p><strong>Objectif : le Grand Soir.</strong> Portez la <em>Force du mouvement</em> (vos révolutionnaires + la valeur de vos bonus)
      à 100 % pour débloquer l'insurrection, puis lancez-la. Vos chances (jusqu'à ${INSURRECTION.cap} %) dépendent de la répression
      (plus elle est basse, mieux c'est), de vos recruteurs et de vos propagandistes. En cas d'échec, vous perdez la moitié de vos
      révolutionnaires, mais vous pouvez retenter.</p>
    <p><strong>Cliquer</strong> sur le gros bouton recrute des révolutionnaires (${fr(effectiveClick(state))} par clic actuellement).</p>
    <p><strong>Recruteurs</strong> : produisent des révolutionnaires chaque minute et protègent de ${PROTECTION.recruiter} contre la répression.</p>
    <p><strong>Propagandistes</strong> : se forment avec des recruteurs, rendent chaque recruteur 2 % plus efficace
      et protègent de ${PROTECTION.propagandist} contre la répression.</p>
    <p><strong>Répression</strong> : plus vous accumulez de révolutionnaires sans les organiser, plus elle monte.
      À 100 %, le mouvement est écrasé et tout recommence. Votre protection de base est de ${fr(PROTECTION.base)},
      et chaque bonus acheté l'augmente de son prix. Dépensez au lieu d'accumuler !</p>
    <p><strong>Événements</strong> : le journal raconte la révolution, et certains événements ont un effet :
      gain ou perte de révolutionnaires, production ou clic boostés ou ralentis pendant quelques secondes.
      Les effets en cours s'affichent sous votre compteur.</p>
    <p><strong>Malus de répression</strong> : à 25, 50, 75 et 90 % de répression, un malus s'active pendant 60 s
      (clic, autoclick, recruteurs, puis tout). Ne laissez pas la jauge monter !</p>
    <p><strong>Décisions</strong> : toutes les quelques minutes, vous devez trancher. Chaque option affiche ses conséquences ;
      le jeu est en pause le temps de choisir.</p>
    <p><strong>Paliers</strong> 🏆 : chaque palier donne un bonus permanent
      (révolutionnaires : +3 % de production, recruteurs : +10 % de production des recruteurs, propagandistes : +5 % de protection).</p>

    <h3>Bonus &amp; Améliorations</h3>
    <p><small>🔒 pas encore abordable · 🛒 achetable · ✅ acheté</small></p>
    <table class="help-table">
      <thead><tr><th></th><th>Bonus</th><th>Coût</th><th>Effet</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

export function showGameOver() {
  openOverlay(`
    <h2>La répression a gagné…</h2>
    <p>Votre mouvement a grossi trop vite sans s'organiser : la répression l'a écrasé et tout est à refaire.</p>
    <p>Astuce : dépensez vos révolutionnaires en bonus, recruteurs et propagandistes. Chaque achat augmente votre protection.</p>
  `);
}

export function showVictory(state, onReplay) {
  const parti = escapeHtml(state.party?.parti || "La révolution");
  const attempts = state.insurrectionAttempts;

  openOverlay(`
    <h2>Victoire !</h2>
    <p>Le Grand Soir a réussi : le parti « ${parti} » a mené la révolution à son terme. Le peuple a gagné !</p>
    <p>${attempts > 1 ? `Il aura fallu ${attempts} tentatives d'insurrection.` : "Victoire dès la première insurrection !"}</p>
    <button id="replay-button" class="button">Rejouer</button>
  `, false);

  byId("replay-button").addEventListener("click", () => {
    closeOverlay(true);
    onReplay();
  });
}

export function showChoice(state, choice, onPick) {
  const options = choice.options.map((option, index) => `
    <button class="choice-option" data-index="${index}">
      <strong>${escapeHtml(option.label)}</strong>
      <small>${escapeHtml(option.effects.map((effect) => describeEventEffect(state, effect)).join(" · "))}</small>
    </button>`).join("");

  openOverlay(`
    <h2>Décision</h2>
    <p>${escapeHtml(fillLore(state, choice.text))}</p>
    <p><small>Le jeu est en pause pendant que vous décidez.</small></p>
    <div class="choice-options">${options}</div>
  `, false);

  document.querySelectorAll(".choice-option").forEach((button) => {
    button.addEventListener("click", () => {
      closeOverlay(true);
      onPick(Number(button.dataset.index));
    });
  });
}

export function showInsurrection(state, chances, { onLaunch, onWait }) {
  const rows = chances.parts.map((part) => `
    <tr>
      <td>${part.max !== undefined ? (part.value >= part.max * 0.75 ? "✓" : "✗") : "•"}</td>
      <td>${escapeHtml(part.label)}</td>
      <td>+${part.value} %${part.max !== undefined ? ` <small>/ ${part.max}</small>` : ""}</td>
    </tr>`).join("");

  openOverlay(`
    <h2>Le Grand Soir</h2>
    <p>${escapeHtml(fillLore(state, "Tout le pays attend le signal : {chef} n'a plus qu'à appeler à l'insurrection."))}</p>
    <table class="help-table insurrection-table">
      <tbody>${rows}</tbody>
      <tfoot><tr><td></td><td><strong>Chances de réussite</strong></td><td><strong>${chances.total} %</strong></td></tr></tfoot>
    </table>
    <p><small>Pour augmenter vos chances : faites baisser la répression (dépensez !), formez des recruteurs et des propagandistes.
      En cas d'échec : −${INSURRECTION.failLoss} % de révolutionnaires, contre-révolution pendant ${INSURRECTION.failCooldown} s, puis on peut retenter.</small></p>
    <div class="choice-options">
      <button class="choice-option" id="insurrection-launch"><strong>🔥 Lancer l'insurrection</strong><small>${chances.total} % de chances de victoire</small></button>
      <button class="choice-option" id="insurrection-wait"><strong>Attendre encore</strong><small>Se préparer pour augmenter ses chances</small></button>
    </div>
  `, false);

  byId("insurrection-launch").addEventListener("click", () => {
    closeOverlay(true);
    onLaunch();
  });
  byId("insurrection-wait").addEventListener("click", () => {
    closeOverlay(true);
    onWait();
  });
}

export function showInsurrectionFailure(result) {
  openOverlay(`
    <h2>L'insurrection a échoué…</h2>
    <p>Malgré ${result.chance} % de chances, la contre-révolution l'a emporté cette fois. Vous perdez ${fr(result.lost)} révolutionnaires.</p>
    <p>Le mouvement n'est pas mort : dans ${INSURRECTION.failCooldown} secondes, vous pourrez retenter. Profitez-en pour faire baisser la répression.</p>
  `);
}

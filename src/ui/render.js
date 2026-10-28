// Draws the game page from the state. Called after every action and every second.
import { MILESTONE_REWARDS, RECRUITER_QUANTITIES } from "../game/config.js";
import {
  calculateProtection, effectFactor, effectiveClick, gameProgress, isBought, movementPercent, movementStrength,
  permanentBonus, propagandistChanges, propagandistCost, recruitCost, recruiterChanges, recruiterEfficiency, upgradeChanges,
} from "../game/economy.js";
import { insurrectionChances } from "../game/grandSoir.js";
import { JOURNAL_ICONS } from "../game/journal.js";
import { describeChanges, describeUpgradeEffect, escapeHtml, formatFactor, fr, plural } from "../game/text.js";
import { byId, reveal } from "./dom.js";

export function createRenderer({ state, onBuyUpgrade, getQuantity }) {
  let journalVersion = -1;

  function renderHeader() {
    byId("title-revolution").textContent = state.party?.parti || "REVOLUTION";
    const chef = byId("chef-img");
    chef.src = state.party?.chef || "img/chef1.png";
    chef.alt = state.party?.chef ? "Chef du parti" : "Chef inconnu";
  }

  function renderUpgrades() {
    const container = byId("special-upgrades");
    state.upgrades.forEach((upgrade) => {
      if (isBought(state, upgrade) || state.counter < upgrade.cost || byId(upgrade.id)) return;

      const button = document.createElement("button");
      button.id = upgrade.id;
      button.title = describeUpgradeEffect(upgrade);
      button.innerHTML = `${escapeHtml(upgrade.label)}<br><small>${describeChanges(upgradeChanges(upgrade))}</small>`;
      button.addEventListener("click", () => onBuyUpgrade(upgrade.id));
      container.appendChild(button);
      reveal("special-upgrades");
    });

    // a bonus button is clickable only when it can be bought right now
    container.querySelectorAll("button").forEach((button) => {
      const upgrade = state.upgrades.find((u) => u.id === button.id);
      if (!upgrade) return;
      const bought = isBought(state, upgrade);
      button.disabled = bought || state.counter < upgrade.cost;
      button.classList.toggle("bought", bought);
      button.classList.toggle("affordable", !button.disabled);
    });
  }

  function renderUnits() {
    const quantity = getQuantity();
    const cost = recruitCost(state, quantity);
    const label = quantity > 1 ? `Recruter ×${quantity}` : "Recruter";

    const recruiterButton = byId("buy-recruiter");
    recruiterButton.innerHTML = `${label} (Coût: ${fr(cost)} révolutionnaires)<br><small>${describeChanges(recruiterChanges(state, quantity))}</small>`;
    recruiterButton.disabled = state.counter < cost;

    document.querySelectorAll(".quantity-option").forEach((option) => {
      const optionQuantity = Number(option.dataset.quantity);
      option.classList.toggle("selected", optionQuantity === quantity);
      option.classList.toggle("affordable", state.counter >= recruitCost(state, optionQuantity));
    });

    const propagandistButton = byId("buy-propagandist");
    propagandistButton.innerHTML = `Former un propagandiste (Coût: ${propagandistCost(state)} recruteurs)<br><small>${describeChanges(propagandistChanges(state))}</small>`;
    propagandistButton.disabled = state.recruiters < propagandistCost(state);

    byId("recruiter-value").textContent = state.recruiters;
    byId("propagandist-value").textContent = state.propagandists;

    if (state.counter >= recruitCost(state) || state.recruiters > 0 || state.propagandists > 0) {
      reveal("unit-container");
      reveal("repression-container");
    }
  }

  function renderRepression() {
    const percent = Math.min(100, Math.max(0, state.repressionLevel));
    if (percent >= 2) reveal("repression-container");

    const bar = byId("repression-bar");
    bar.style.width = `${percent}%`;
    byId("repression-label").textContent = `${Math.floor(percent)}%`;

    bar.classList.remove("repression-low", "repression-med-low", "repression-med-high", "repression-high");
    if (percent < 25) bar.classList.add("repression-low");
    else if (percent < 50) bar.classList.add("repression-med-low");
    else if (percent < 90) bar.classList.add("repression-med-high");
    else bar.classList.add("repression-high");

    byId("malus-message").textContent = percent >= 75 ? "Attention : la répression est sur le point de frapper !" : "";
  }

  function renderMovement() {
    const strength = movementStrength(state);
    const percent = movementPercent(state);
    byId("movement-bar").style.width = `${percent}%`;
    byId("movement-label").textContent = `${Math.floor(percent)}%`;
    byId("movement-detail").textContent =
      `${fr(strength.current)} révolutionnaires + ${fr(strength.invested)} en bonus = ${fr(strength.value)} / ${fr(strength.target)}`;
  }

  function renderEffects() {
    byId("active-effects").replaceChildren(...state.activeEffects.map((effect) => {
      const chip = document.createElement("span");
      chip.className = `effect-chip ${effect.factor >= 1 ? "effect-good" : "effect-bad"}`;
      chip.textContent = `${effect.label} : ${formatFactor(effect)} · ${effect.remaining} s`;
      return chip;
    }));
  }

  function renderInsurrectionButton() {
    const button = byId("insurrection-button");
    button.classList.toggle("hidden", !state.grandSoirUnlocked);
    if (!state.grandSoirUnlocked) return;

    button.disabled = state.insurrectionCooldown > 0 || state.won;
    button.textContent = state.insurrectionCooldown > 0
      ? `Le mouvement se relève… ${state.insurrectionCooldown} s`
      : `🔥 Lancer l'insurrection (${insurrectionChances(state).total} % de réussite)`;
  }

  function renderJournal() {
    if (journalVersion === state.journalVersion) return;
    journalVersion = state.journalVersion;

    byId("journal-list").replaceChildren(...state.journal.map((entry) => {
      const item = document.createElement("li");
      item.className = `journal-entry journal-${entry.type}`;

      const time = document.createElement("time");
      time.textContent = new Date(entry.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

      const text = document.createElement("span");
      text.textContent = `${JOURNAL_ICONS[entry.type] || ""} ${entry.text}`;

      item.append(time, text);
      if (entry.detail) {
        const detail = document.createElement("small");
        detail.textContent = entry.detail;
        item.append(detail);
      }
      return item;
    }));

    if (state.journal.length) reveal("journal-container");
  }

  // STATS: one tile per value, green or red when a temporary effect changes it
  function statTile(icon, label, value, sub = "", trend = 1, wide = false) {
    const trendClass = trend > 1 ? "stat-up" : trend < 1 ? "stat-down" : "";
    return `
      <div class="stat-tile ${trendClass} ${wide ? "stat-wide" : ""}">
        <span class="stat-label">${icon} ${label}</span>
        <span class="stat-value">${value}</span>
        ${sub ? `<span class="stat-sub">${sub}</span>` : ""}
      </div>`;
  }

  function permanentBonuses() {
    const labels = { counter: "production", recruiters: "recruteurs", propagandists: "protection" };
    return Object.keys(MILESTONE_REWARDS)
      .filter((kind) => permanentBonus(state, kind) > 1)
      .map((kind) => `+${Math.round((permanentBonus(state, kind) - 1) * 100)} % ${labels[kind]}`)
      .join(" · ");
  }

  function renderStats() {
    if (state.counter < 3 && !state.recruiters && !state.unlockedItems.length) return;
    reveal("stats");

    const click = effectiveClick(state);
    const productionTrend = effectFactor(state, ["production", "global", "autoclick", "recruiters"]);
    const protection = calculateProtection(state);
    const bonuses = permanentBonuses();
    const progress = gameProgress(state);

    byId("stats-grid").innerHTML = [
      statTile("✊", "Par clic", fr(click), click !== state.clickPower ? `base ${fr(state.clickPower)}` : "", click / state.clickPower),
      statTile("⚙️", "Par minute", fr(state.totalProductionPerMinute),
        productionTrend !== 1 ? (productionTrend > 1 ? "boostée" : "ralentie") : "production auto", productionTrend),
      statTile("🛡️", "Protection", fr(protection), `${fr(state.counter)} / ${fr(protection)} utilisés`),
      statTile("📢", "Recruteurs", `${recruiterEfficiency(state.propagandists)} %`,
        `${plural(state.recruiters, "recruteur")} · ${plural(state.propagandists, "propagandiste")}`),
      bonuses ? statTile("🏆", "Bonus des paliers", bonuses, "", 1, true) : "",
      `<div class="stat-tile stat-wide">
        <span class="stat-label">🚩 Bonus achetés</span>
        <span class="stat-value">${progress.bought} / ${progress.total} bonus</span>
        <div class="progress-container stat-progress">
          <div class="progress-bar" style="width: ${progress.percent}%"></div>
          <span class="progress-label">${Math.floor(progress.percent)}%</span>
        </div>
        <span class="stat-sub">${state.grandSoirUnlocked ? "Grand Soir débloqué ✓" : "Grand Soir : Force du mouvement à 100 %"}</span>
      </div>`,
    ].join("");
  }

  // the buttons to choose how many recruiters to buy at once
  function createQuantitySelector(onSelect) {
    const selector = byId("recruiter-quantity");
    RECRUITER_QUANTITIES.forEach((quantity) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "quantity-option";
      option.textContent = `×${quantity}`;
      option.dataset.quantity = quantity;
      option.addEventListener("click", () => onSelect(quantity));
      selector.appendChild(option);
    });
  }

  function render() {
    byId("counter").textContent = fr(state.counter);
    renderUpgrades();
    renderUnits();
    renderRepression();
    renderMovement();
    renderEffects();
    renderInsurrectionButton();
    renderStats();
    renderJournal();
  }

  function resetView() {
    byId("special-upgrades").querySelectorAll("button").forEach((button) => button.remove());
    journalVersion = -1;
  }

  return { render, renderHeader, resetView, createQuantitySelector };
}

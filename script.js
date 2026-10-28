// the current game comes from the URL: game.html?partie=<id> (see saves.js)
const gameId = new URLSearchParams(window.location.search).get("partie");
const party = getParty(gameId);
if (!party) window.location.replace("index.html");

const store = {
  get: (name) => localStorage.getItem(partyKey(gameId, name)),
  set: (name, value) => localStorage.setItem(partyKey(gameId, name), value),
};

let counter = parseInt(store.get("counter")) || 0;
let clickPower = Number.parseInt(store.get("clickPower")) || 1

let unlockedItems = [];
try {
  unlockedItems = JSON.parse(store.get("unlockedItems")) || [];
} catch (e) {
  unlockedItems = [];
}

let repressionLevel = 1;

let upgrades = []

let recruiters = Number.parseInt(store.get("recruiters")) || 0
let propagandists = Number.parseInt(store.get("propagandists")) || 0
const recruiterCost = 2;
const propagandistCost = 5;
const costMultiplier = 1.125;
let recruiterInterval = null
let propagandistInterval = null


let productionInterval = null;
let accumulatedProduction = 0;

let totalProductionPerMinute = store.get("totalProductionPerMinute")
  ? Number.parseFloat(store.get("totalProductionPerMinute"))
  : 1;

  document.addEventListener("DOMContentLoaded", () => {
    getTitleAndChef();
  });


function getTitleAndChef() {
  const titleElement = document.getElementById("title-revolution");
  const chefElement = document.getElementById("chef-img");

  const storedParti = party && party.parti;
  const storedChef = party && party.chef;

  if (storedParti) {
    titleElement.textContent = storedParti;
  } else {
    titleElement.textContent = "REVOLUTION";
  }

  // update LEADER
  if (storedChef) {
    chefElement.src = storedChef;
    chefElement.alt = "Chef du parti";
  } else {
    chefElement.src = "img/chef1.png"; // une image par défaut au cas où
    chefElement.alt = "Chef inconnu";
  }
}


// share of upgrades bought
function gameProgress() {
  const bought = upgrades.filter((u) => unlockedItems.includes(u.id)).length;
  const percent = upgrades.length ? Math.min(100, (bought / upgrades.length) * 100) : 0;
  return { bought, total: upgrades.length, percent };
}

// strength of the movement = revolutionaries + value of the upgrades already bought,
// so buying an upgrade does not make the bar go back. 100 % = every upgrade bought.
function movementStrength() {
  const invested = upgrades
    .filter((u) => unlockedItems.includes(u.id))
    .reduce((sum, u) => sum + u.cost, 0);
  const target = upgrades.reduce((sum, u) => sum + u.cost, 0);
  return { current: Math.floor(counter), invested, value: Math.floor(counter) + invested, target };
}

// logarithmic scale: 10 → 100 moves the bar as much as 100 000 → 1 000 000,
// which follows the playing time (the end of the game goes much faster)
function updateMovementBar() {
  const bar = document.getElementById("movement-bar");
  if (!bar) return;

  const strength = movementStrength();
  const percent = strength.value >= strength.target
    ? 100
    : Math.log10(1 + strength.value) / Math.log10(1 + strength.target) * 100;

  bar.style.width = `${percent}%`;
  document.getElementById("movement-label").textContent = `${Math.floor(percent)}%`;
  document.getElementById("movement-detail").textContent =
    `${strength.current.toLocaleString('fr-FR')} révolutionnaires + ${strength.invested.toLocaleString('fr-FR')} en bonus = ${strength.value.toLocaleString('fr-FR')} / ${strength.target.toLocaleString('fr-FR')}`;
}



function initGame() {
  document.getElementById("counter").textContent = counter
  document.getElementById("bouton").addEventListener("click", addOne)

  repressionLevel = 0;

  const resetButton = document.getElementById("reset-button");
  if (resetButton) {
  resetButton.addEventListener("click", resetGame);
  }

  document.getElementById("home-button").addEventListener("click", () => {
    saveGame();
    window.location.href = "index.html";
  });
  document.getElementById("chef-button").addEventListener("click", chefSpeaks);
  document.getElementById("help-button").addEventListener("click", showHelp);
  document.getElementById("insurrection-button").addEventListener("click", openInsurrection);
  document.getElementById("overlay-close").addEventListener("click", closeOverlay);
  document.getElementById("overlay").addEventListener("click", (event) => {
    if (event.target.id === "overlay") closeOverlay();
  });

  // show the rules on first visit
  if (!localStorage.getItem("helpSeen")) {
    showHelp();
    localStorage.setItem("helpSeen", "1");
  }

  // recalculate click power from purchased upgrades
  clickPower = 1;
  unlockedItems.forEach((itemId) => {
    const upgrade = upgrades.find((u) => u.id === itemId)
    if (upgrade) {
      if (upgrade.type === "clickPower") {
        clickPower += upgrade.power
    }
  }})

  upgrades.forEach((upgrade) => {
    if (!unlockedItems.includes(upgrade.id) && counter >= upgrade.cost) {
      showUpgradeButton(upgrade)
    }
  })

  createRecruitersUI()
  createPropagandistsUI()

  updateDisplay();
  startProductionInterval();
  hideAllContainersExceptMain();
  showContainer("main-game-container");
  renderJournal();
  getTitleAndChef();
}

// production per minute for a given army, used for display and purchase previews
function calculateProduction(nbRecruiters = recruiters, nbPropagandists = propagandists, items = unlockedItems) {
  const baseProduction = 60;
  const recruiterBonus = nbPropagandists * 2;
  const recruiterEfficiency = 5 + recruiterBonus;

  const productionFromRecruiters = nbRecruiters * baseProduction * (recruiterEfficiency / 100)
    * permanentBonus("recruiters")
    * effectFactor(["recruiters", "production", "global"]);

  let autoClickBonus = 0;
  upgrades.forEach((upgrade) => {
    if (upgrade.type === "autoclick" && items.includes(upgrade.id)) {
      autoClickBonus += upgrade.clicksPerMinute;
    }
  });
  autoClickBonus *= effectFactor(["autoclick", "production", "global"]);

  return Math.floor((productionFromRecruiters + autoClickBonus) * permanentBonus("counter"));
}

// click power after temporary effects
function effectiveClick() {
  return Math.max(1, Math.round(clickPower * effectFactor(["click", "global"])));
}

function updateProductionPerMinute() {
  totalProductionPerMinute = calculateProduction();

  store.set("totalProductionPerMinute", totalProductionPerMinute);
}

// PURCHASE FEEDBACK ___________________________________
function formatSigned(value, unit) {
  const sign = value > 0 ? "+" : "−";
  return `${sign}${Math.abs(value).toLocaleString('fr-FR')} ${unit}`;
}

// describes the difference between two states, e.g. "+3 par minute · +50 protection"
function describeChanges(changes) {
  const parts = [];
  if (changes.production) parts.push(formatSigned(changes.production, "par minute"));
  if (changes.clickPower) parts.push(formatSigned(changes.clickPower, "par clic"));
  if (changes.protection) parts.push(formatSigned(changes.protection, "protection"));
  if (changes.efficiency) parts.push(formatSigned(changes.efficiency, "% efficacité des recruteurs"));
  return parts.join(" · ");
}

function recruiterChanges(quantity = 1) {
  return {
    production: calculateProduction(recruiters + quantity) - calculateProduction(),
    protection: recruiterProtection * quantity,
  };
}

function propagandistChanges() {
  const cost = calculatePropagandistCost();
  // not affordable yet: show the propagandist's own effect
  if (recruiters < cost) {
    return { protection: propagandistProtection, efficiency: 2 };
  }
  return {
    production: calculateProduction(recruiters - cost, propagandists + 1) - calculateProduction(),
    protection: propagandistProtection - cost * recruiterProtection,
    efficiency: 2,
  };
}

function upgradeChanges(upgrade) {
  return {
    production: upgrade.type === "autoclick" ? upgrade.clicksPerMinute : 0,
    clickPower: upgrade.type === "clickPower" ? upgrade.power : 0,
    protection: upgrade.cost,
  };
}

let toastTimeout = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 3000);
}

function hideAllContainersExceptMain() {
  document.querySelectorAll("article").forEach(article => {
    if (article.id !== "main-game-container") {
      article.style.display = "none";
    } else {
      article.style.display = "";
    }
  });
}

function showContainer(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.style.display = "flex";
    container.classList.remove("hidden");
  }
}


function resetGame() {
  clearJournal();
  clearEffects();
  clearGrandSoir();

  // Reset local storage
  store.set("counter", 0);
  store.set("clickPower", 1);
  store.set("unlockedItems", JSON.stringify([]));
  store.set("recruiters", 0);
  store.set("propagandists", 0);
  store.set("repressionLevel",0);

  // Reset variable
  totalProductionPerMinute =1;
  counter =0;
   
  clickPower = 1;
  unlockedItems.length = 0;
  recruiters = 0;
  propagandists = 0;

  repressionLevel = 0;
  accumulatedProduction = 0;
  store.set("totalProductionPerMinute", 0);

  // remove upgrade buttons so they can be bought again
  document.querySelectorAll("#special-upgrades button").forEach((btn) => btn.remove());

  updateDisplay();

  hideAllContainersExceptMain();
  initGameAfterReset();
}


Promise.all([
  fetch("upgrades.json").then((response) => response.json()),
  fetch("malus.json").then((response) => response.json()),
])
  .then(([upgradesData, malusData]) => {
    upgrades = upgradesData
    malusList = malusData
    initGame()
  })
  .catch((error) => console.error("Erreur de chargement du fichier JSON:", error))


function saveUnlocked(item) {
  unlockedItems.push(item)
  store.set("unlockedItems", JSON.stringify(unlockedItems))
}

function saveGame() {
  store.set("counter", counter)
  store.set("clickPower", clickPower)
  store.set("unlockedItems", JSON.stringify(unlockedItems))
  store.set("recruiters", recruiters)
  store.set("propagandists", propagandists)
  store.set("totalProductionPerMinute", totalProductionPerMinute);
}


function initGameAfterReset() {
  document.getElementById("counter").textContent = counter
  repressionLevel=0;
  updateDisplay();

  createRecruitersUI()
  createPropagandistsUI()

  startProductionInterval();

  hideAllContainersExceptMain()
  showContainer("main-game-container");
  addJournal("recit", "Tout recommence. Dans une arrière-salle, {chef} rallume la flamme.");
}

// ADD A REVOLUTIONNAIRE
function addOne() {
  counter += effectiveClick();
  document.getElementById("counter").textContent = counter

  saveGame()

  upgrades.forEach((upgrade) => {
    if (counter >= upgrade.cost && !unlockedItems.includes(upgrade.id)) {
      showUpgradeButton(upgrade)
    }
  })

  updateUpgradeButtons()
  updateMovementBar()
  updateRecruitersButton()
  updatePropagandistsButton()
}
// UPGRADES BUTTON
function showUpgradeButton(upgrade) {
  showContainer("special-upgrades")

  
  if (!document.getElementById(upgrade.id)) {
    const btn = document.createElement("button")
    btn.id = upgrade.id
    btn.innerHTML = `${upgrade.label}<br><small>${describeChanges(upgradeChanges(upgrade))}</small>`
    btn.title = describeEffect(upgrade)
    btn.addEventListener("click", () => buyUpgrade(upgrade.id))
    document.getElementById("special-upgrades").appendChild(btn)
  }
  updateUpgradeButtons()
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

// number of upgrades bought
function progressTile() {
  const progress = gameProgress();
  return `
    <div class="stat-tile stat-wide">
      <span class="stat-label">🚩 Bonus achetés</span>
      <span class="stat-value">${progress.bought} / ${progress.total} bonus</span>
      <div class="progress-container stat-progress">
        <div class="progress-bar" style="width: ${progress.percent}%"></div>
        <span class="progress-label">${Math.floor(progress.percent)}%</span>
      </div>
      <span class="stat-sub">${grandSoirUnlocked ? "Grand Soir débloqué ✓" : "Grand Soir : Force du mouvement à 100 %"}</span>
    </div>`;
}

function renderStats(recruiterEfficiency) {
  const click = effectiveClick();
  const productionTrend = effectFactor(["production", "global", "autoclick", "recruiters"]);
  const protection = calculateProtection();
  const bonuses = describePermanentBonuses();

  document.getElementById("stats-grid").innerHTML = [
    statTile("✊", "Par clic", click.toLocaleString('fr-FR'),
      click !== clickPower ? `base ${clickPower.toLocaleString('fr-FR')}` : "", click / clickPower),
    statTile("⚙️", "Par minute", totalProductionPerMinute.toLocaleString('fr-FR'),
      productionTrend !== 1 ? (productionTrend > 1 ? "boostée" : "ralentie") : "production auto", productionTrend),
    statTile("🛡️", "Protection", protection.toLocaleString('fr-FR'),
      `${Math.floor(counter).toLocaleString('fr-FR')} / ${protection.toLocaleString('fr-FR')} utilisés`),
    statTile("📢", "Recruteurs", `${recruiterEfficiency} %`,
      `${recruiters} recruteur${recruiters > 1 ? "s" : ""} · ${propagandists} propagandiste${propagandists > 1 ? "s" : ""}`),
    bonuses ? statTile("🏆", "Bonus des paliers", bonuses, "", 1, true) : "",
    progressTile(),
  ].join("");
}

// a bonus button is clickable only when it can be bought right now
function updateUpgradeButtons() {
  document.querySelectorAll("#special-upgrades button").forEach((btn) => {
    const upgrade = upgrades.find((u) => u.id === btn.id)
    if (!upgrade) return

    const bought = unlockedItems.includes(upgrade.id)
    btn.disabled = bought || counter < upgrade.cost
    btn.classList.toggle("bought", bought)
    btn.classList.toggle("affordable", !btn.disabled)
  })
}

// BUY UPGRADES
function buyUpgrade(upgradeID) {
  const upgrade = upgrades.find((u) => u.id === upgradeID)

  if (counter >= upgrade.cost) {
    const changes = upgradeChanges(upgrade)
    counter -= upgrade.cost
    document.getElementById("counter").textContent = counter
    saveGame()
    saveUnlocked(upgrade.id)
  

    // autoclick upgrades are counted in updateProductionPerMinute via unlockedItems
    if (upgrade.type === "clickPower") {
      clickPower += upgrade.power;
      saveGame();
    }
    updateDisplay();

    updateUpgradeButtons();

    showToast(`${upgradeName(upgrade)} : ${describeChanges(changes)}`);
    addJournal("achat", `${upgradeName(upgrade)}${upgrade.description ? ` — ${upgrade.description}` : ""}`, describeChanges(changes));
    if (upgrade.victory) showVictory();
  }
}

// RECRUITER
function createRecruitersUI() {
  const recruiterCountDiv = document.getElementById("recruiter-count")
  recruiterCountDiv.innerHTML = `Recruteurs: <span id="recruiter-value">${recruiters}</span>`

  const recruiterButton = document.getElementById("buy-recruiter")
  recruiterButton.onclick = buyRecruiter

  createQuantitySelector()
  updateRecruitersButton()
}

// recruiters can be bought by batch: x1, x2, x5, x10, x50, x100
const RECRUITER_QUANTITIES = [1, 2, 5, 10, 50, 100];

let recruiterQuantity = 1;
try {
  recruiterQuantity = Number(localStorage.getItem("recruiterQuantity")) || 1;
} catch (e) {
  recruiterQuantity = 1;
}

function createQuantitySelector() {
  const selector = document.getElementById("recruiter-quantity");
  if (!selector || selector.children.length) return;

  RECRUITER_QUANTITIES.forEach((quantity) => {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "quantity-option";
    option.textContent = `×${quantity}`;
    option.dataset.quantity = quantity;
    option.addEventListener("click", () => {
      recruiterQuantity = quantity;
      try {
        localStorage.setItem("recruiterQuantity", quantity);
      } catch (e) {
        // the choice is just not remembered
      }
      updateRecruitersButton();
    });
    selector.appendChild(option);
  });
}

// total cost of the next `quantity` recruiters: each one costs 12.5 % more than the previous
function calculateRecruitCost(quantity = 1) {
  let total = 0;
  for (let i = 0; i < quantity; i++) {
    total += Math.floor(recruiterCost * Math.pow(costMultiplier, recruiters + i));
  }
  return total;
}

function updateRecruitersButton() {
  const button = document.getElementById("buy-recruiter")
  if (button) {
    const cost = calculateRecruitCost(recruiterQuantity)
    const label = recruiterQuantity > 1 ? `Recruter ×${recruiterQuantity}` : "Recruter"
    button.innerHTML = `${label} (Coût: ${cost.toLocaleString('fr-FR')} révolutionnaires)<br><small>${describeChanges(recruiterChanges(recruiterQuantity))}</small>`
    button.disabled = counter < cost
    if (counter >= calculateRecruitCost() || recruiters > 0 || propagandists > 0) {showContainer("unit-container");
      showContainer("repression-container");
    }
  }

  document.querySelectorAll(".quantity-option").forEach((option) => {
    const quantity = Number(option.dataset.quantity);
    option.classList.toggle("selected", quantity === recruiterQuantity);
    option.classList.toggle("affordable", counter >= calculateRecruitCost(quantity));
  });
}

function buyRecruiter() {
  const quantity = recruiterQuantity
  const cost = calculateRecruitCost(quantity)
  if (counter >= cost) {
    const changes = describeChanges(recruiterChanges(quantity))
    const first = recruiters + 1
    showToast(`${quantity > 1 ? `${quantity} recruteurs formés` : "Recruteur formé"} : ${changes}`)
    counter -= cost
    recruiters += quantity
    addJournal("achat", quantity > 1 ? `${quantity} recruteurs formés (n°${first} à ${recruiters})` : `Recruteur n°${recruiters} formé`, changes)
    showContainer("stats");
    
    document.getElementById("recruiter-value").textContent = recruiters
    document.getElementById("counter").textContent = counter
    
    updateRecruitersButton()
    updatePropagandistsButton()
    saveGame()
  }
}


function startProductionInterval() {
  if (productionInterval) clearInterval(productionInterval);
  
  productionInterval = setInterval(tick, 1000);
}

// one second of game: production, effects, events
function tick() {
  // the game is paused while a choice is waiting
  if (pendingChoice || insurrectionPending) return;

  updateProductionPerMinute();
  const productionPerSecond = totalProductionPerMinute / 60;

  // accumulate fractions so small bonuses still count
  accumulatedProduction += productionPerSecond;
  const added = Math.floor(accumulatedProduction);
  if (added > 0) {
    counter += added;
    accumulatedProduction -= added;
  }
  
  if (propagandists > 0 && recruiters > 0) {
    const basePropagandistEffect = 0.0001 * propagandists; 
    if (Math.random() < basePropagandistEffect) {
      recruiters += 1;
    }
  }
  tickEffects();
  tickGrandSoir();
  updateDisplay();
  maybeAddNarrative();
  maybeTriggerChoice();
  saveGame();
}


// PROPAGANDIST
function createPropagandistsUI() {
  const propagandistCountDiv = document.getElementById("propagandist-count")
  propagandistCountDiv.innerHTML = `Propagandistes: <span id="propagandist-value">${propagandists}</span>`

  const propagandistButton = document.getElementById("buy-propagandist")
  propagandistButton.textContent = `Former un propagandiste (Coût: ${calculatePropagandistCost()} recruteurs)`
  propagandistButton.onclick = buyPropagandist

  updatePropagandistsButton()
}


function calculatePropagandistCost() {
  return Math.floor(propagandistCost*Math.pow(costMultiplier, propagandists))
}

function updatePropagandistsButton() {
  const button = document.getElementById("buy-propagandist")
  if (button) {
    const cost = calculatePropagandistCost()
    button.innerHTML = `Former un propagandiste (Coût: ${cost} recruteurs)<br><small>${describeChanges(propagandistChanges())}</small>`
    button.disabled = recruiters < cost
  }
}

function buyPropagandist() {
  const cost = calculatePropagandistCost()
  if (recruiters >= cost) {
    const changes = describeChanges(propagandistChanges())
    showToast(`Propagandiste formé : ${changes}`)
    recruiters -= cost
    propagandists++
    addJournal("achat", `Propagandiste n°${propagandists} formé`, changes)
    
    document.getElementById("propagandist-value").textContent = propagandists
    document.getElementById("recruiter-value").textContent = recruiters
    
    updatePropagandistsButton()
    saveGame()
  }
}

function updateDisplay() {
  updateProductionPerMinute();
  checkGrandSoir();
  document.getElementById("counter").textContent = Math.floor(counter).toLocaleString('fr-FR');
  const recruiterValue = document.getElementById("recruiter-value")
  const propagandistValue = document.getElementById("propagandist-value")

  if (recruiterValue) recruiterValue.textContent = recruiters
  if (propagandistValue) propagandistValue.textContent = propagandists


  const recruiterBonus = propagandists * 2
  const recruiterEfficiency = 5 + recruiterBonus

    // update stats
    const statsGrid = document.getElementById("stats-grid");
    if (statsGrid && counter>=3) {
      renderStats(recruiterEfficiency);
      showContainer("stats");
    }

  upgrades.forEach((upgrade) => {
    if (counter >= upgrade.cost && !unlockedItems.includes(upgrade.id)) {
      showUpgradeButton(upgrade)
    }
  });


  updateUpgradeButtons();
  updateMovementBar();
  updateRecruitersButton();
  updatePropagandistsButton();
  updateRepressionBar();
  checkMilestones();
  renderInsurrectionButton();
}

// how many revolutionaries the movement can hold before repression crushes it
const baseProtection = 1000;
const recruiterProtection = 50;
const propagandistProtection = 250;

function calculateProtection() {
  // every purchased upgrade organises the movement: its cost becomes protection
  const upgradesProtection = upgrades
    .filter((u) => unlockedItems.includes(u.id))
    .reduce((sum, u) => sum + u.cost, 0);

  return Math.floor((baseProtection
    + recruiters * recruiterProtection
    + propagandists * propagandistProtection
    + upgradesProtection
    + bonusProtection) * permanentBonus("propagandists"));
}

function updateRepressionBar() {
  repressionLevel = (counter / calculateProtection()) * 100;
  if (repressionLevel >= 100) {
    resetGame();
    showGameOver();
    return
  }

  if (repressionLevel >= 2) {showContainer("repression-container");}

  const malusMessage = document.getElementById("malus-message");
  if (malusMessage) {
    malusMessage.textContent = repressionLevel >= 75 ? "Attention : la répression est sur le point de frapper !" : "";
  }

  const repressionBar = document.getElementById("repression-bar");
  const percent = Math.min(100, Math.max(0, repressionLevel));
  
  // update bar width & color
  repressionBar.style.width = percent + "%";
  document.getElementById("repression-label").textContent = Math.floor(percent) + "%";

  repressionBar.classList.remove("repression-low", "repression-med-low", "repression-med-high", "repression-high");

  if (percent < 25) {
    repressionBar.classList.add("repression-low");
  } else if (percent < 50) {
    repressionBar.classList.add("repression-med-low");
  } else if (percent < 90) {
    repressionBar.classList.add("repression-med-high");
  } else {
    repressionBar.classList.add("repression-high");
  }

  if (percent >= 25) {
    showContainer("malus-container");
  }
}


// JOURNAL _____________________________________________
// purchase history + narrative lines, saved with the game
const JOURNAL_MAX = 60;
const NARRATIVE_CHANCE = 1 / 60; // per second: about one line per minute

const MILESTONES = {
  counter: {
    10: "Une poignée de curieux vient écouter {chef}. Quelque chose commence.",
    100: "Cent personnes dans une salle trop petite : le parti {parti} tient sa première assemblée.",
    500: "Les premiers tracts circulent dans les cages d'escalier du quartier.",
    1000: "Mille révolutionnaires ! La presse locale parle du parti {parti} pour la première fois.",
    5000: "Les cortèges remplissent les avenues. Les commerçants baissent le rideau… ou rejoignent la marche.",
    10000: "Dix mille voix scandent le nom du mouvement. Le gouvernement convoque une réunion de crise.",
    50000: "Des villes voisines envoient des délégations. Le mouvement n'est plus local.",
    100000: "Cent mille ! Les télévisions étrangères braquent leurs caméras sur le parti {parti}.",
    500000: "Le pays entier vibre. Dans chaque usine, chaque école, on parle de la révolution.",
    1000000: "Un million de révolutionnaires. L'ancien monde vacille.",
  },
  recruiters: {
    1: "Premier recruteur formé. Il connaît tout le monde au marché du dimanche.",
    5: "Cinq recruteurs sillonnent le quartier. Les portes s'ouvrent plus facilement.",
    10: "Dix recruteurs : on parle désormais d'un « réseau ».",
    25: "Vingt-cinq recruteurs. La police commence à ficher les visages.",
    50: "Cinquante recruteurs dans tout le pays. Impossible de tous les arrêter.",
  },
  propagandists: {
    1: "Premier propagandiste. Ses affiches sont arrachées le matin, recollées le soir.",
    5: "Cinq propagandistes impriment un journal clandestin chaque semaine.",
    10: "Dix propagandistes : les slogans du parti {parti} sont repris dans tout le pays.",
  },
};

const REPRESSION_LINES = {
  25: "Des voitures banalisées stationnent devant le local du parti {parti}.",
  50: "Perquisition au petit matin. Les archives ont été cachées à temps.",
  75: "Arrestations en série. {chef} change d'adresse chaque nuit.",
  90: "Couvre-feu décrété. La répression va frapper : il faut s'organiser, vite !",
};

// random events by phase: some only tell the story, others have an effect
// gain = N minutes of production or N clicks (the biggest), so it scales with the game
const NARRATIVE_EVENTS = {
  debut: [
    { text: "Une réunion dans une arrière-cuisine se termine tard dans la nuit." },
    { text: "Quelqu'un a peint le logo du parti {parti} sur le pont de la gare.", effect: { type: "buff", id: "graffiti", label: "Graffiti", kind: "click", factor: 1.5, duration: 30 } },
    { text: "Une voisine apporte du café aux militants qui collent des affiches." },
    { text: "Un étudiant demande comment rejoindre le mouvement. Il revient le lendemain avec trois amis.", effect: { type: "gain", minutes: 1, clicks: 15 } },
    { text: "{chef} prend la parole sur une caisse en bois, au milieu du marché.", effect: { type: "buff", id: "discours", label: "{chef} au micro", kind: "click", factor: 2, duration: 20 } },
    { text: "Une averse glaciale disperse le rassemblement du samedi.", effect: { type: "buff", id: "averse", label: "Averse", kind: "production", factor: 0.7, duration: 30 } },
    { text: "La police confisque un stock de tracts.", effect: { type: "loss", percent: 5 } },
  ],
  essor: [
    { text: "Une grève éclate dans l'entrepôt du port. Les grévistes portent les couleurs du parti {parti}.", effect: { type: "buff", id: "greve_port", label: "Grève du port", kind: "production", factor: 2, duration: 30 } },
    { text: "Une chanson militante passe en boucle dans les manifestations.", effect: { type: "buff", id: "chanson", label: "Chanson militante", kind: "click", factor: 1.5, duration: 45 } },
    { text: "Les cantines solidaires nourrissent cent personnes par jour.", effect: { type: "gain", minutes: 2, clicks: 30 } },
    { text: "Un journaliste infiltré finit par rejoindre le mouvement.", effect: { type: "gain", minutes: 1, clicks: 20 } },
    { text: "Les murs de la ville sont couverts de slogans. Plus personne n'essaie de les effacer." },
    { text: "Une rumeur de division fait hésiter les sympathisants.", effect: { type: "buff", id: "rumeur", label: "Rumeur de division", kind: "production", factor: 0.6, duration: 30 } },
    { text: "Garde à vue pour plusieurs militants après un rassemblement.", effect: { type: "loss", percent: 10 } },
  ],
  apogee: [
    { text: "Des comités de quartier organisent eux-mêmes les transports et les écoles.", effect: { type: "buff", id: "comites", label: "Comités de quartier", kind: "production", factor: 1.5, duration: 60 } },
    { text: "Des soldats refusent de tirer sur la foule. Certains rejoignent les cortèges.", effect: { type: "gain", minutes: 3, clicks: 40 } },
    { text: "Un message de soutien arrive de l'autre bout du monde.", effect: { type: "buff", id: "solidarite", label: "Solidarité internationale", kind: "click", factor: 2, duration: 30 } },
    { text: "Les anciens dirigeants préparent discrètement leurs valises." },
    { text: "Dans les rues, on ne demande plus si la révolution aura lieu, mais quand." },
    { text: "Les médias officiels lancent une campagne de dénigrement.", effect: { type: "buff", id: "propagande_etat", label: "Propagande d'État", kind: "production", factor: 0.6, duration: 45 } },
    { text: "Des comptes du mouvement sont gelés par la banque.", effect: { type: "loss", percent: 10 } },
  ],
};

const JOURNAL_ICONS = { achat: "🛒", palier: "🏆", repression: "🚨", recit: "📜", choix: "⚖️" };

let journal = [];
try {
  journal = JSON.parse(store.get("journal")) || [];
} catch (e) {
  journal = [];
}

let reachedMilestones = [];
try {
  reachedMilestones = JSON.parse(store.get("milestones")) || [];
} catch (e) {
  reachedMilestones = [];
}
let lastRepressionTier = null;
let lastNarrative = null;

function fillLore(text) {
  return text
    .replaceAll("{parti}", `« ${(party && party.parti) || "Révolution"} »`)
    .replaceAll("{chef}", CHEFS[party && party.chef] || "le chef");
}

function addJournal(type, text, detail = "") {
  journal.unshift({ type, text: fillLore(text), detail, time: Date.now() });
  journal.length = Math.min(journal.length, JOURNAL_MAX);
  store.set("journal", JSON.stringify(journal));
  renderJournal();
}

function renderJournal() {
  const list = document.getElementById("journal-list");
  if (!list) return;

  list.replaceChildren(...journal.map((entry) => {
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

  if (journal.length) showContainer("journal-container");
}

function clearJournal() {
  journal = [];
  reachedMilestones = [];
  lastRepressionTier = 0;
  store.set("journal", JSON.stringify(journal));
  store.set("milestones", JSON.stringify(reachedMilestones));
  renderJournal();
}

function checkMilestones() {
  const values = { counter, recruiters, propagandists };
  // an old save without milestones: mark what is already reached without flooding the journal
  const silent = store.get("milestones") === null;

  Object.entries(MILESTONES).forEach(([kind, steps]) => {
    Object.entries(steps).forEach(([threshold, text]) => {
      const key = `${kind}-${threshold}`;
      if (values[kind] >= Number(threshold) && !reachedMilestones.includes(key)) {
        reachedMilestones.push(key);
        if (!silent) addJournal("palier", text, `Bonus permanent : ${MILESTONE_REWARDS[kind].label}`);
      }
    });
  });
  store.set("milestones", JSON.stringify(reachedMilestones));

  // repression: a new tier triggers the matching malus from malus.json,
  // then nothing for a while unless the repression escalates to a higher tier
  const tiers = Object.keys(REPRESSION_LINES).map(Number);
  const tier = tiers.filter((t) => repressionLevel >= t).pop() || 0;
  const escalates = tier > repressionStrike.tier;
  if (lastRepressionTier !== null && tier > lastRepressionTier && (!repressionStrike.cooldown || escalates)) {
    const malus = malusList.find((m) => m.triggerThreshold === tier);
    repressionStrike.tier = tier;
    repressionStrike.cooldown = (malus ? malus.duration / 1000 : 0) + REPRESSION_COOLDOWN;
    let detail = "";
    if (malus) {
      addEffect(malusToEffect(malus));
      detail = `${malus.label} pendant ${malus.duration / 1000} s`;
    }
    addJournal("repression", REPRESSION_LINES[tier], detail);
  }
  lastRepressionTier = tier;
}

function boughtCount() {
  return upgrades.filter((u) => unlockedItems.includes(u.id)).length;
}

function maybeAddNarrative() {
  if (Math.random() >= NARRATIVE_CHANCE) return;

  let phase = "debut";
  if (boughtCount() >= 14) phase = "apogee";
  else if (boughtCount() >= 5) phase = "essor";

  const events = NARRATIVE_EVENTS[phase].filter((event) => event !== lastNarrative);
  lastNarrative = events[Math.floor(Math.random() * events.length)];
  const detail = lastNarrative.effect ? applyEventEffect(lastNarrative.effect) : "";
  addJournal("recit", lastNarrative.text, detail);
}


// EFFECTS _____________________________________________
// temporary effects (repression malus, events, choices) counted in seconds of play,
// saved with the game so reloading the page does not clear a malus
const MILESTONE_REWARDS = {
  counter: { rate: 0.03, label: "+3 % de production" },
  recruiters: { rate: 0.10, label: "+10 % de production des recruteurs" },
  propagandists: { rate: 0.05, label: "+5 % de protection" },
};
const EFFECT_KINDS = { click: "par clic", production: "production", autoclick: "autoclick", recruiters: "recruteurs", global: "tout" };
const SAFE_REPRESSION = 0.95; // an event never pushes repression above 95 %
const REPRESSION_COOLDOWN = 180; // seconds after a malus ends before the repression can strike again

// last repression strike: its tier and the seconds left before a new strike at the same level
const repressionStrike = { tier: 0, cooldown: 0 };

let malusList = [];

let activeEffects = [];
try {
  activeEffects = JSON.parse(store.get("effects")) || [];
} catch (e) {
  activeEffects = [];
}
let bonusProtection = Number.parseFloat(store.get("bonusProtection")) || 0;

function effectFactor(kinds) {
  return activeEffects
    .filter((effect) => kinds.includes(effect.kind))
    .reduce((factor, effect) => factor * effect.factor, 1);
}

// permanent bonus earned with milestones: 1 + rate x number of milestones of this kind
function permanentBonus(kind) {
  const count = reachedMilestones.filter((key) => key.startsWith(`${kind}-`)).length;
  return 1 + MILESTONE_REWARDS[kind].rate * count;
}

function describePermanentBonuses() {
  const labels = { counter: "production", recruiters: "recruteurs", propagandists: "protection" };
  return Object.keys(MILESTONE_REWARDS)
    .filter((kind) => permanentBonus(kind) > 1)
    .map((kind) => `+${Math.round((permanentBonus(kind) - 1) * 100)} % ${labels[kind]}`)
    .join(" · ");
}

function formatFactor(effect) {
  const kind = EFFECT_KINDS[effect.kind];
  if (effect.factor >= 1) return `${kind} ×${effect.factor.toLocaleString('fr-FR')}`;
  return `${kind} −${Math.round((1 - effect.factor) * 100)} %`;
}

function malusToEffect(malus) {
  const kinds = { clickPower: "click", autoclick: "autoclick", recruiters: "recruiters", global: "global" };
  return {
    id: malus.id,
    label: malus.label.split(":")[0].trim(),
    kind: kinds[malus.type] || "global",
    factor: 1 - malus.intensity,
    duration: malus.duration / 1000,
  };
}

function saveEffects() {
  store.set("effects", JSON.stringify(activeEffects));
  store.set("bonusProtection", bonusProtection);
}

function addEffect(effect) {
  const existing = activeEffects.find((e) => e.id === effect.id);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, effect.duration);
  } else {
    activeEffects.push({
      id: effect.id,
      label: fillLore(effect.label),
      kind: effect.kind,
      factor: effect.factor,
      remaining: effect.duration,
    });
  }
  saveEffects();
  renderEffects();
  updateProductionPerMinute();
}

function tickEffects() {
  activeEffects.forEach((effect) => effect.remaining--);
  activeEffects = activeEffects.filter((effect) => effect.remaining > 0);
  repressionStrike.cooldown = Math.max(0, repressionStrike.cooldown - 1);
  if (!repressionStrike.cooldown) repressionStrike.tier = 0;
  saveEffects();
  renderEffects();
}

function clearEffects() {
  activeEffects = [];
  bonusProtection = 0;
  pendingChoice = null;
  secondsSinceChoice = 0;
  repressionStrike.tier = 0;
  repressionStrike.cooldown = 0;
  saveEffects();
  renderEffects();
}

function renderEffects() {
  const container = document.getElementById("active-effects");
  if (!container) return;

  container.replaceChildren(...activeEffects.map((effect) => {
    const chip = document.createElement("span");
    chip.className = `effect-chip ${effect.factor >= 1 ? "effect-good" : "effect-bad"}`;
    chip.textContent = `${effect.label} : ${formatFactor(effect)} · ${effect.remaining} s`;
    return chip;
  }));
}

// amount of an event gain right now, capped so it never triggers the repression
function eventGain(effect) {
  const gain = Math.floor(Math.max(effect.clicks * effectiveClick(), effect.minutes * totalProductionPerMinute));
  const room = Math.floor(SAFE_REPRESSION * calculateProtection() - counter);
  return Math.max(0, Math.min(gain, room));
}

// text of an effect with the numbers of the current game, used before applying it
function describeEventEffect(effect) {
  switch (effect.type) {
    case "gain": return `+${eventGain(effect).toLocaleString('fr-FR')} révolutionnaires`;
    case "loss": return `−${Math.floor(counter * effect.percent / 100).toLocaleString('fr-FR')} révolutionnaires (−${effect.percent} %)`;
    case "buff": return `${fillLore(effect.label)} : ${formatFactor(effect)} pendant ${effect.duration} s`;
    case "protection": return `+${Math.floor(calculateProtection() * effect.percent / 100).toLocaleString('fr-FR')} protection (permanent)`;
    case "recruiterLoss": return `−${effect.count} recruteur`;
    case "gamble": return `${Math.round(effect.chance * 100)} % de chances : ${effect.win.map(describeEventEffect).join(", ")} — sinon : ${effect.lose.map(describeEventEffect).join(", ")}`;
    default: return "";
  }
}

// applies an effect and returns what happened, for the journal
function applyEventEffect(effect) {
  const description = effect.type === "gamble" ? "" : describeEventEffect(effect);

  switch (effect.type) {
    case "gain":
      counter += eventGain(effect);
      break;
    case "loss":
      counter -= Math.floor(counter * effect.percent / 100);
      break;
    case "buff":
      addEffect(effect);
      break;
    case "protection":
      bonusProtection += Math.floor(calculateProtection() * effect.percent / 100);
      saveEffects();
      break;
    case "recruiterLoss":
      recruiters = Math.max(0, recruiters - effect.count);
      break;
    case "gamble": {
      const won = Math.random() < effect.chance;
      const results = (won ? effect.win : effect.lose).map(applyEventEffect).join(" · ");
      return `${won ? "Réussite" : "Échec"} : ${results}`;
    }
  }
  updateDisplay();
  saveGame();
  return description;
}


// CHOICES _____________________________________________
// every few minutes the player must take a decision; the game is paused meanwhile
const CHOICE_MIN_GAP = 90;         // seconds between two choices at least
const CHOICE_CHANCE = 1 / 90;      // per second after the gap: about one every 3 minutes

const CHOICES = [
  {
    id: "mecene",
    condition: () => counter >= 100,
    text: "Un riche sympathisant propose de financer le parti {parti}, en échange de discrétion.",
    options: [
      { label: "Accepter l'argent", effects: [{ type: "gain", minutes: 3, clicks: 60 }, { type: "buff", id: "credibilite", label: "Crédibilité en baisse", kind: "click", factor: 0.8, duration: 120 }] },
      { label: "Refuser poliment", effects: [{ type: "protection", percent: 5 }] },
    ],
  },
  {
    id: "negociation",
    condition: () => repressionLevel >= 40 && counter >= 200,
    text: "Le gouvernement propose d'ouvrir des négociations avec {chef}.",
    options: [
      { label: "Négocier", effects: [{ type: "loss", percent: 25 }, { type: "protection", percent: 15 }] },
      { label: "Refuser et mobiliser", effects: [{ type: "buff", id: "mobilisation", label: "Mobilisation", kind: "production", factor: 1.5, duration: 60 }] },
    ],
  },
  {
    id: "manif",
    condition: () => counter >= 300,
    text: "La préfecture interdit la grande marche prévue demain.",
    options: [
      { label: "Marcher quand même", effects: [{ type: "gamble", chance: 0.6, win: [{ type: "gain", minutes: 5, clicks: 100 }], lose: [{ type: "loss", percent: 20 }] }] },
      { label: "Annuler la marche", effects: [{ type: "protection", percent: 3 }] },
    ],
  },
  {
    id: "infiltre",
    condition: () => recruiters >= 3,
    text: "Un recruteur est soupçonné de travailler pour la police.",
    options: [
      { label: "L'exclure", effects: [{ type: "recruiterLoss", count: 1 }, { type: "protection", percent: 8 }] },
      { label: "Le garder à l'œil", effects: [{ type: "gamble", chance: 0.5, win: [{ type: "buff", id: "loyal", label: "Recruteur loyal", kind: "recruiters", factor: 1.5, duration: 90 }], lose: [{ type: "loss", percent: 15 }] }] },
    ],
  },
  {
    id: "media",
    condition: () => boughtCount() >= 3,
    text: "Une grande chaîne de télévision veut interviewer {chef} en direct.",
    options: [
      { label: "Accepter l'interview", effects: [{ type: "gamble", chance: 0.7, win: [{ type: "gain", minutes: 4, clicks: 80 }], lose: [{ type: "buff", id: "interview", label: "Interview ratée", kind: "click", factor: 0.7, duration: 90 }] }] },
      { label: "Privilégier les médias indépendants", effects: [{ type: "buff", id: "independants", label: "Médias indépendants", kind: "production", factor: 1.3, duration: 120 }] },
    ],
  },
  {
    id: "greve",
    condition: () => boughtCount() >= 8,
    text: "Les syndicats appellent à la grève générale. {chef} doit trancher.",
    options: [
      { label: "Soutenir la grève", effects: [{ type: "buff", id: "greve_generale", label: "Grève générale", kind: "production", factor: 2, duration: 60 }, { type: "buff", id: "greve_clic", label: "Militants en grève", kind: "click", factor: 0.5, duration: 60 }] },
      { label: "Rester en retrait", effects: [{ type: "buff", id: "retrait", label: "Porte-à-porte", kind: "click", factor: 1.5, duration: 60 }] },
    ],
  },
];

let pendingChoice = null;
let secondsSinceChoice = 0;
let lastChoiceId = null;

function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function maybeTriggerChoice() {
  secondsSinceChoice++;
  if (secondsSinceChoice < CHOICE_MIN_GAP) return;
  if (!document.getElementById("overlay").classList.contains("hidden") || insurrectionPending) return;
  if (Math.random() >= CHOICE_CHANCE) return;

  const candidates = CHOICES.filter((choice) => choice.id !== lastChoiceId && choice.condition());
  if (!candidates.length) return;
  showChoice(candidates[Math.floor(Math.random() * candidates.length)]);
}

function showChoice(choice) {
  pendingChoice = choice;
  lastChoiceId = choice.id;

  const options = choice.options.map((option, index) => `
    <button class="choice-option" data-index="${index}">
      <strong>${escapeHtml(option.label)}</strong>
      <small>${escapeHtml(option.effects.map(describeEventEffect).join(" · "))}</small>
    </button>`).join("");

  openOverlay(`
    <h2>Décision</h2>
    <p>${escapeHtml(fillLore(choice.text))}</p>
    <p><small>Le jeu est en pause pendant que vous décidez.</small></p>
    <div class="choice-options">${options}</div>
  `, false);

  document.querySelectorAll(".choice-option").forEach((button) => {
    button.addEventListener("click", () => resolveChoice(Number(button.dataset.index)));
  });
}

function resolveChoice(index) {
  const choice = pendingChoice;
  const option = choice.options[index];
  pendingChoice = null;
  secondsSinceChoice = 0;

  const overlay = document.getElementById("overlay");
  overlay.dataset.closable = "true";
  closeOverlay();

  const results = option.effects.map(applyEventEffect).join(" · ");
  addJournal("choix", `${choice.text} Choix : ${option.label}.`, results);
  showToast(`${option.label} : ${results}`);
}


// GRAND SOIR __________________________________________
// victory: when the movement strength reaches 100 %, the insurrection is unlocked for good.
// Its chances depend on the repression (low is better), the recruiters and the propagandists.
const INSURRECTION = {
  base: 15,               // % of success whatever happens
  repressionWeight: 40,   // up to +40 % with no repression, +20 % at 50 % of repression
  recruitersPerPoint: 10, // +1 % every 10 recruiters...
  recruitersMax: 15,      // ...up to +15 %
  propagandistPoints: 2,  // +2 % per propagandist...
  propagandistsMax: 20,   // ...up to +20 %
  cap: 90,                // never a sure thing
  failLoss: 50,           // % of revolutionaries lost when it fails
  failCooldown: 120,      // seconds before trying again
};

let grandSoirUnlocked = store.get("grandSoir") === "1";
let insurrectionCooldown = Number(store.get("insurrectionCooldown")) || 0;
let insurrectionAttempts = Number(store.get("insurrectionAttempts")) || 0;
let insurrectionPending = false;

function saveGrandSoir() {
  store.set("grandSoir", grandSoirUnlocked ? "1" : "0");
  store.set("insurrectionCooldown", insurrectionCooldown);
  store.set("insurrectionAttempts", insurrectionAttempts);
}

function clearGrandSoir() {
  grandSoirUnlocked = false;
  insurrectionCooldown = 0;
  insurrectionAttempts = 0;
  insurrectionPending = false;
  saveGrandSoir();
  renderInsurrectionButton();
}

function insurrectionChances() {
  const repression = Math.min(100, Math.max(0, repressionLevel));
  const parts = [
    { label: "Base", value: INSURRECTION.base },
    { label: `Répression à ${Math.floor(repression)} %`, value: Math.round((1 - repression / 100) * INSURRECTION.repressionWeight), max: INSURRECTION.repressionWeight },
    { label: `${recruiters} recruteur${recruiters > 1 ? "s" : ""}`, value: Math.min(INSURRECTION.recruitersMax, Math.floor(recruiters / INSURRECTION.recruitersPerPoint)), max: INSURRECTION.recruitersMax },
    { label: `${propagandists} propagandiste${propagandists > 1 ? "s" : ""}`, value: Math.min(INSURRECTION.propagandistsMax, Math.round(propagandists * INSURRECTION.propagandistPoints)), max: INSURRECTION.propagandistsMax },
  ];
  const total = Math.min(INSURRECTION.cap, parts.reduce((sum, part) => sum + part.value, 0));
  return { total, parts };
}

function checkGrandSoir() {
  if (grandSoirUnlocked) return;
  const strength = movementStrength();
  if (strength.value < strength.target) return;

  grandSoirUnlocked = true;
  saveGrandSoir();
  addJournal("palier", "Le pays entier est prêt. {chef} peut appeler au Grand Soir.", "Insurrection débloquée");
  showToast("Le Grand Soir est débloqué : lancez l'insurrection quand vous le souhaitez !");
}

function renderInsurrectionButton() {
  const button = document.getElementById("insurrection-button");
  if (!button) return;

  button.classList.toggle("hidden", !grandSoirUnlocked);
  if (!grandSoirUnlocked) return;

  button.disabled = insurrectionCooldown > 0;
  button.textContent = insurrectionCooldown > 0
    ? `Le mouvement se relève… ${insurrectionCooldown} s`
    : `🔥 Lancer l'insurrection (${insurrectionChances().total} % de réussite)`;
}

function tickGrandSoir() {
  if (insurrectionCooldown > 0) {
    insurrectionCooldown--;
    saveGrandSoir();
  }
  renderInsurrectionButton();
}

// the game is paused while the player looks at the chances
function openInsurrection() {
  if (!grandSoirUnlocked || insurrectionCooldown > 0) return;
  insurrectionPending = true;

  const chances = insurrectionChances();
  const rows = chances.parts.map((part) => `
    <tr>
      <td>${part.max !== undefined ? (part.value >= part.max * 0.75 ? "✓" : "✗") : "•"}</td>
      <td>${part.label}</td>
      <td>+${part.value} %${part.max !== undefined ? ` <small>/ ${part.max}</small>` : ""}</td>
    </tr>`).join("");

  openOverlay(`
    <h2>Le Grand Soir</h2>
    <p>${escapeHtml(fillLore("Tout le pays attend le signal : {chef} n'a plus qu'à appeler à l'insurrection."))}</p>
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

  document.getElementById("insurrection-launch").addEventListener("click", launchInsurrection);
  document.getElementById("insurrection-wait").addEventListener("click", () => {
    insurrectionPending = false;
    document.getElementById("overlay").dataset.closable = "true";
    closeOverlay();
  });
}

function launchInsurrection() {
  const chance = insurrectionChances().total;
  insurrectionAttempts++;
  insurrectionPending = false;
  document.getElementById("overlay").dataset.closable = "true";
  closeOverlay();

  if (Math.random() * 100 < chance) {
    addJournal("palier", "Le Grand Soir ! Le peuple prend les places, les ministères tombent un à un.", `Victoire avec ${chance} % de chances`);
    saveGrandSoir();
    showVictory();
    return;
  }

  const lost = Math.floor(counter * INSURRECTION.failLoss / 100);
  counter -= lost;
  insurrectionCooldown = INSURRECTION.failCooldown;
  addEffect({ id: "contre_revolution", label: "Contre-révolution", kind: "global", factor: 0.5, duration: INSURRECTION.failCooldown });
  saveGrandSoir();
  addJournal("repression", "L'insurrection est écrasée. Les survivants se cachent et préparent la suite.",
    `Échec (${chance} % de chances) : −${lost.toLocaleString('fr-FR')} révolutionnaires, contre-révolution pendant ${INSURRECTION.failCooldown} s`);

  openOverlay(`
    <h2>L'insurrection a échoué…</h2>
    <p>Malgré ${chance} % de chances, la contre-révolution l'a emporté cette fois. Vous perdez ${lost.toLocaleString('fr-FR')} révolutionnaires.</p>
    <p>Le mouvement n'est pas mort : dans ${INSURRECTION.failCooldown} secondes, vous pourrez retenter. Profitez-en pour faire baisser la répression.</p>
  `);
  updateDisplay();
  saveGame();
}


// CHEF ________________________________________________
// Karl and Olympe quote their own texts; Rachel's lines are inspired by her story (not quotes)
const CHEF_LINES = {
  "img/chef1.png": [
    "22 mois de grève à l'Ibis Batignolles : la patience, c'est une arme !",
    "Les femmes de chambre font tourner les hôtels. Sans nous, rien ne marche !",
    "On ne lâche rien : le travail invisible mérite le respect.",
    "De gouvernante à députée : personne ne parlera à notre place.",
    "La sous-traitance, c'est l'exploitation en cachette. On la met en lumière !",
  ],
  "img/chef2.png": [
    "« Prolétaires de tous les pays, unissez-vous ! »",
    "« L'histoire de toute société jusqu'à nos jours est l'histoire de la lutte des classes. »",
    "« Les prolétaires n'y ont rien à perdre que leurs chaînes. Ils ont un monde à gagner. »",
    "« Les philosophes n'ont fait qu'interpréter le monde de différentes manières, ce qui importe, c'est de le transformer. »",
  ],
  "img/chef3.png": [
    "« La femme naît libre et demeure égale à l'homme en droits. »",
    "« La femme a le droit de monter sur l'échafaud ; elle doit avoir également celui de monter à la tribune. »",
    "« Femme, réveille-toi ; le tocsin de la raison se fait entendre dans tout l'univers ; reconnais tes droits. »",
    "Une révolution qui oublie la moitié du peuple n'est pas une révolution.",
  ],
};

// advice depending on the current state of the game
function gameTips() {
  const tips = [];
  const next = upgrades.find((u) => !unlockedItems.includes(u.id));

  if (grandSoirUnlocked) tips.push(`Le Grand Soir est prêt : ${insurrectionChances().total} % de chances. Fais baisser la répression pour les augmenter.`);
  if (repressionLevel >= 60) tips.push("La répression monte ! Dépense tes révolutionnaires avant qu'elle ne frappe.");
  if (recruiters === 0 && counter >= calculateRecruitCost()) tips.push("Forme un recruteur : il recrute pour toi même quand tu ne cliques pas.");
  if (next && counter >= next.cost) tips.push(`Tu peux t'offrir : ${upgradeName(next)} (${describeEffect(next)}).`);
  if (next && counter < next.cost) tips.push(`Prochain objectif : ${upgradeName(next)}, il te manque ${(next.cost - Math.floor(counter)).toLocaleString('fr-FR')} révolutionnaires.`);
  if (recruiters >= 20 && propagandists === 0) tips.push("Avec autant de recruteurs, un propagandiste devient rentable.");

  return tips;
}

let lastLine = null;
let bubbleTimeout = null;

function chefSpeaks() {
  const lines = CHEF_LINES[party && party.chef] || CHEF_LINES["img/chef1.png"];
  const tips = gameTips();

  // one time out of two, give advice when there is some
  const pool = tips.length && Math.random() < 0.5 ? tips : lines;
  let line = pool[Math.floor(Math.random() * pool.length)];
  if (line === lastLine && pool.length > 1) line = pool[(pool.indexOf(line) + 1) % pool.length];
  lastLine = line;

  const bubble = document.getElementById("chef-bubble");
  const chefName = document.createElement("strong");
  chefName.textContent = CHEFS[party && party.chef] || "Chef";
  bubble.replaceChildren(chefName, ` : ${line}`);
  bubble.classList.remove("hidden");
  clearTimeout(bubbleTimeout);
  bubbleTimeout = setTimeout(() => bubble.classList.add("hidden"), 6000);
}


// OVERLAY _____________________________________________
function openOverlay(html, closable = true) {
  document.getElementById("overlay-body").innerHTML = html;
  document.getElementById("overlay-close").style.display = closable ? "" : "none";
  document.getElementById("overlay").dataset.closable = closable;
  document.getElementById("overlay").classList.remove("hidden");
}

function closeOverlay() {
  const overlay = document.getElementById("overlay");
  if (overlay.dataset.closable === "false") return;
  overlay.classList.add("hidden");
}

function describeEffect(upgrade) {
  if (upgrade.victory) return "Victoire de la révolution !";
  if (upgrade.type === "clickPower") return `+${upgrade.power.toLocaleString('fr-FR')} par clic`;
  return `+${upgrade.clicksPerMinute.toLocaleString('fr-FR')} par minute`;
}

function upgradeName(upgrade) {
  return upgrade.label.replace(/^Acheter /, "").replace(/\s*\(.*\)\s*$/, "");
}

function showHelp() {
  const rows = upgrades.map((upgrade) => {
    let status = "🔒";
    if (unlockedItems.includes(upgrade.id)) status = "✅";
    else if (counter >= upgrade.cost) status = "🛒";

    return `
      <tr class="${unlockedItems.includes(upgrade.id) ? "owned" : ""}">
        <td>${status}</td>
        <td><strong>${upgradeName(upgrade)}</strong>${upgrade.description ? `<br><small>${upgrade.description}</small>` : ""}</td>
        <td>${upgrade.cost.toLocaleString('fr-FR')}</td>
        <td>${describeEffect(upgrade)}</td>
      </tr>`;
  }).join("");

  openOverlay(`
    <h2>Comment jouer</h2>
    <p><strong>Objectif : le Grand Soir.</strong> Portez la <em>Force du mouvement</em> (vos révolutionnaires + la valeur de vos bonus)
      à 100 % pour débloquer l'insurrection, puis lancez-la. Vos chances (jusqu'à ${INSURRECTION.cap} %) dépendent de la répression
      (plus elle est basse, mieux c'est), de vos recruteurs et de vos propagandistes. En cas d'échec, vous perdez la moitié de vos
      révolutionnaires, mais vous pouvez retenter.</p>
    <p><strong>Cliquer</strong> sur le gros bouton recrute des révolutionnaires (${effectiveClick().toLocaleString('fr-FR')} par clic actuellement).</p>
    <p><strong>Recruteurs</strong> : produisent des révolutionnaires chaque minute et protègent de ${recruiterProtection} contre la répression.</p>
    <p><strong>Propagandistes</strong> : se forment avec des recruteurs, rendent chaque recruteur 2 % plus efficace
      et protègent de ${propagandistProtection} contre la répression.</p>
    <p><strong>Répression</strong> : plus vous accumulez de révolutionnaires sans les organiser, plus elle monte.
      À 100 %, le mouvement est écrasé et tout recommence. Votre protection de base est de ${baseProtection.toLocaleString('fr-FR')},
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

function showGameOver() {
  openOverlay(`
    <h2>La répression a gagné…</h2>
    <p>Votre mouvement a grossi trop vite sans s'organiser : la répression l'a écrasé et tout est à refaire.</p>
    <p>Astuce : dépensez vos révolutionnaires en bonus, recruteurs et propagandistes. Chaque achat augmente votre protection.</p>
  `);
}

function showVictory() {
  clearInterval(productionInterval);
  const parti = ((party && party.parti) || "La révolution")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  openOverlay(`
    <h2>Victoire !</h2>
    <p>Le Grand Soir a réussi : le parti « ${parti} » a mené la révolution à son terme. Le peuple a gagné !</p>
    <p>${insurrectionAttempts > 1 ? `Il aura fallu ${insurrectionAttempts} tentatives d'insurrection.` : "Victoire dès la première insurrection !"}</p>
    <button id="replay-button" class="button">Rejouer</button>
  `, false);

  document.getElementById("replay-button").addEventListener("click", () => {
    document.getElementById("overlay").dataset.closable = "true";
    closeOverlay();
    resetGame();
  });
}


// // MALUS ___________________________________________
// let malusList = [];

// fetch("malus.json")
//   .then((response) => response.json())
//   .then((data) => {
//     malusList = data;
//     startMalusCycle();
//   })
//   .catch((error) => console.error("Erreur lors du chargement du JSON des malus:", error));

// const activeMaluses = {};


// function checkAndActivateMaluses() {
//   const currentRepression = repressionLevel; 
  
//   const malusContainer = document.getElementById("malus-container");
//   if (!malusContainer) return;

  
//   malusList.forEach(malus => {
//     if (currentRepression >= malus.triggerThreshold && !activeMaluses[malus.id]) {
//       const malusDiv = document.createElement("div");
//       malusDiv.id = malus.id;
//       malusDiv.textContent = malus.label;
//       malusDiv.classList.add("malus-item");
      
//       malusContainer.appendChild(malusDiv);
      
//       activeMaluses[malus.id] = setTimeout(() => {
//         malusContainer.removeChild(malusDiv);
//         delete activeMaluses[malus.id];
//       }, malus.duration);
//     }
//   });
// }

// function startMalusCycle() {
//   setInterval(updateDisplay, 1000);
// }

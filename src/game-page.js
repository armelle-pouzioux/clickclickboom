// Entry point of game.html: loads the game of the URL (game.html?partie=<id>) and wires the UI.
import "./styles/game.css";
import malusList from "./data/malus.json";
import upgrades from "./data/upgrades.json";
import { RECRUITER_QUANTITIES } from "./game/config.js";
import { createEngine } from "./game/engine.js";
import { createState, loadState } from "./game/state.js";
import { getParty, partyStore } from "./saves.js";
import { chefSpeaks } from "./ui/chef.js";
import { byId, hideAllExceptMain, showToast } from "./ui/dom.js";
import {
  isOverlayOpen, setupOverlay, showChoice, showGameOver, showHelp, showInsurrection, showInsurrectionFailure, showVictory,
} from "./ui/overlay.js";
import { createRenderer } from "./ui/render.js";

const params = new URLSearchParams(window.location.search);
const party = getParty(params.get("partie"));

if (!party) {
  window.location.replace("index.html");
} else {
  start(party);
}

// how many recruiters to buy at once: a preference of the player, kept between games
function readQuantity() {
  try {
    const quantity = Number(localStorage.getItem("recruiterQuantity"));
    return RECRUITER_QUANTITIES.includes(quantity) ? quantity : 1;
  } catch {
    return 1;
  }
}

function saveQuantity(quantity) {
  try {
    localStorage.setItem("recruiterQuantity", quantity);
  } catch {
    // the choice is just not remembered
  }
}

function start(party) {
  const store = partyStore(party.id);
  const state = loadState(createState({ upgrades, malusList, party }), store);
  const engine = createEngine({ state, store });
  let quantity = readQuantity();

  const renderer = createRenderer({
    state,
    getQuantity: () => quantity,
    onBuyUpgrade: (id) => {
      engine.buyUpgrade(id);
      renderer.render();
    },
  });

  // what the engine tells us
  engine.on("toast", showToast);
  engine.on("reset", () => {
    renderer.resetView();
    hideAllExceptMain();
  });
  engine.on("gameover", () => {
    renderer.render();
    showGameOver();
  });
  engine.on("choice", (choice) => {
    showChoice(state, choice, (index) => {
      engine.resolveChoice(index);
      renderer.render();
    });
  });
  engine.on("victory", () => {
    renderer.render();
    showVictory(state, () => {
      engine.reset();
      renderer.render();
    });
  });
  engine.on("insurrection-failed", (result) => {
    renderer.render();
    showInsurrectionFailure(result);
  });

  // what the player does
  byId("bouton").addEventListener("click", () => {
    engine.click();
    renderer.render();
  });
  byId("buy-recruiter").addEventListener("click", () => {
    engine.buyRecruiters(quantity);
    renderer.render();
  });
  byId("buy-propagandist").addEventListener("click", () => {
    engine.buyPropagandist();
    renderer.render();
  });
  byId("home-button").addEventListener("click", () => {
    engine.save();
    window.location.href = "index.html";
  });
  byId("chef-button").addEventListener("click", () => chefSpeaks(state));
  byId("help-button").addEventListener("click", () => showHelp(state));
  byId("insurrection-button").addEventListener("click", () => {
    const chances = engine.openInsurrection();
    if (!chances) return;
    showInsurrection(state, chances, {
      onLaunch: () => {
        engine.launchInsurrection();
        renderer.render();
      },
      onWait: () => {
        engine.cancelInsurrection();
        renderer.render();
      },
    });
  });

  setupOverlay();
  hideAllExceptMain();
  renderer.renderHeader();
  renderer.createQuantitySelector((selected) => {
    quantity = selected;
    saveQuantity(selected);
    renderer.render();
  });

  engine.refresh();
  renderer.render();

  // show the rules on first visit
  if (!localStorage.getItem("helpSeen")) {
    showHelp(state);
    localStorage.setItem("helpSeen", "1");
  }

  setInterval(() => {
    engine.tick({ canAskChoice: !isOverlayOpen() });
    renderer.render();
  }, 1000);

  // handle for the end-to-end tests: game.html?partie=<id>&debug
  if (params.has("debug")) window.clicker = { state, engine, render: renderer.render };
}

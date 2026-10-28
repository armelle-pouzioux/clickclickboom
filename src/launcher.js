// Entry point of index.html: games in progress and creation of a new game.
import "./styles/launcher.css";
import { CHEFS, createParty, deleteParty, listParties, migrateOldSave, partyKey } from "./saves.js";

const CHEF_DESCRIPTIONS = {
  chef1: "Rachel Keke, militante ouvrière, a mené la grève de l'hôtel Ibis en 2019 pour de meilleures conditions de travail.",
  chef2: "Karl Marx, philosophe et économiste, critique le capitalisme et prône le socialisme dans son Manifeste du Parti Communiste.",
  chef3: "Olympe de Gouges, dramaturge et militante féministe, a écrit la Déclaration des droits de la femme en 1791.",
};

const form = document.getElementById("revolution-form");
const partiInput = document.getElementById("parti");
const description = document.getElementById("description");

let toastTimeout = null;

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 4000);
}

// le chef choisi est le bouton radio coché, qu'on ait cliqué sur l'image ou sur le nom
function getSelectedChef() {
  const checked = document.querySelector('input[name="chef-image"]:checked');
  if (!checked) return null;
  const img = document.querySelector(`label[for="${checked.id}"] .chef-image`);
  return img ? img.getAttribute("data-image") : null;
}

// liste des parties en cours : on peut en reprendre une ou en supprimer
function renderParties() {
  const container = document.getElementById("parties");
  const list = document.getElementById("parties-list");
  const parties = listParties();

  container.style.display = parties.length ? "" : "none";

  list.replaceChildren(...parties.map((party) => {
    const counter = Number.parseInt(localStorage.getItem(partyKey(party.id, "counter"))) || 0;

    const item = document.createElement("li");
    item.className = "party-item";

    const img = document.createElement("img");
    img.src = party.chef;
    img.alt = CHEFS[party.chef] || "";

    const info = document.createElement("div");
    info.className = "party-info";
    const name = document.createElement("strong");
    name.textContent = party.parti || "Révolution";
    const details = document.createElement("span");
    details.textContent = `${CHEFS[party.chef] || ""} · ${counter.toLocaleString("fr-FR")} révolutionnaires`;
    info.append(name, details);

    const play = document.createElement("a");
    play.className = "party-play";
    play.href = `game.html?partie=${party.id}`;
    play.textContent = "Jouer";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "party-delete";
    remove.textContent = "✕";
    remove.title = "Supprimer cette partie";
    remove.addEventListener("click", () => {
      if (confirm(`Supprimer la partie « ${name.textContent} » ?`)) {
        deleteParty(party.id);
        renderParties();
      }
    });

    item.append(img, info, play, remove);
    return item;
  }));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const chef = getSelectedChef();
  if (!chef) {
    showToast("Choisissez un.e chef.fe !");
    return;
  }

  const party = createParty(partiInput.value.trim(), chef);
  showToast("Toutes les bonnes choses ont un début !");
  setTimeout(() => {
    window.location.href = `game.html?partie=${party.id}`;
  }, 2000);
});

// description of the leader under the portraits: the one hovered, otherwise the one chosen
function showDescription(chefId) {
  description.textContent = CHEF_DESCRIPTIONS[chefId] || "";
}

function selectedChefId() {
  return document.querySelector('input[name="chef-image"]:checked')?.id;
}

Object.keys(CHEF_DESCRIPTIONS).forEach((chefId) => {
  const label = document.querySelector(`label[for="${chefId}"]`);
  if (!label) return;
  label.addEventListener("mouseenter", () => showDescription(chefId));
  label.addEventListener("mouseleave", () => showDescription(selectedChefId()));
});

document.querySelectorAll('input[name="chef-image"]').forEach((radio) => {
  radio.addEventListener("change", () => showDescription(radio.id));
});

showDescription(selectedChefId());

migrateOldSave();
renderParties();

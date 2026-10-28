document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("revolution-form");
    const partiInput = document.getElementById("parti");
    const descriptionContainer = document.getElementById("description");

    migrateOldSave();
    renderParties();

    // le chef choisi est le bouton radio coché, qu'on ait cliqué sur l'image ou sur le nom
    function getSelectedChef() {
        const checked = document.querySelector('input[name="chef-image"]:checked');
        if (!checked) return null;
        const img = document.querySelector(`label[for="${checked.id}"] .chef-image`);
        return img ? img.getAttribute("data-image") : null;
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const parti = partiInput.value.trim();
        const selectedChef = getSelectedChef();

        if (!selectedChef) {
            showToast("Choisissez un.e chef.fe !");
            return;
        }

        const party = createParty(parti, selectedChef);

        showToast("Toutes les bonnes choses ont un début !");
        setTimeout(() => {
            window.location.href = `game.html?partie=${party.id}`;
        }, 2000);
    });

    // liste des parties en cours : on peut en reprendre une ou en supprimer
    function renderParties() {
        const container = document.getElementById("parties");
        const list = document.getElementById("parties-list");
        const parties = listParties();

        list.innerHTML = "";
        container.style.display = parties.length ? "" : "none";

        parties.forEach(party => {
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
            list.appendChild(item);
        });
    }

    const descriptions = {
        chef1: "Rachel Keke, militante ouvrière, a mené la grève de l'hôtel Ibis en 2019 pour de meilleures conditions de travail.",
        chef2: "Karl Marx, philosophe et économiste, critique le capitalisme et prône le socialisme dans son Manifeste du Parti Communiste.",
        chef3: "Olympe de Gouges, dramaturge et militante féministe, a écrit la Déclaration des droits de la femme en 1791."
    };

    const formContainer = document.querySelector('.form-container');
    formContainer.parentNode.insertBefore(descriptionContainer, formContainer);

    const updateDescription = (chefId) => {
        descriptionContainer.style.display = "block";
        descriptionContainer.textContent = descriptions[chefId];
    };

    const chef1Label = document.querySelector('label[for="chef1"]');
    const chef2Label = document.querySelector('label[for="chef2"]');
    const chef3Label = document.querySelector('label[for="chef3"]');

    if (chef1Label) {
        chef1Label.addEventListener("mouseover", () => updateDescription("chef1"));
        chef1Label.addEventListener("mouseout", () => descriptionContainer.style.display = "none");
    }
    if (chef2Label) {
        chef2Label.addEventListener("mouseover", () => updateDescription("chef2"));
        chef2Label.addEventListener("mouseout", () => descriptionContainer.style.display = "none");
    }
    if (chef3Label) {
        chef3Label.addEventListener("mouseover", () => updateDescription("chef3"));
        chef3Label.addEventListener("mouseout", () => descriptionContainer.style.display = "none");
    }


    function showToast(message) {
        const toast = document.getElementById("toast");
        toast.textContent = message;
        toast.classList.add("show");
        setTimeout(() => {
            toast.classList.remove("show");
        }, 4000); 
}}); 
# Click Click Boom

Un jeu de clic révolutionnaire, dans le navigateur. Recrutez des révolutionnaires, organisez votre mouvement
pour échapper à la répression, puis lancez le **Grand Soir**.

Choisissez qui mène votre révolution : **Rachel** (Keke), **Karl** (Marx) ou **Olympe** (de Gouges).

## Jouer

- En ligne : https://armelle-pouzioux.github.io/clickclickboom/
- En local : voir [Développement](#développement)

## Règles en bref

| | |
|---|---|
| **Cliquer** | Le gros bouton recrute des révolutionnaires. |
| **Recruteurs** | Produisent des révolutionnaires chaque minute. Achetables par lots (×1 à ×100). |
| **Propagandistes** | Se forment avec des recruteurs et rendent chaque recruteur plus efficace. |
| **Bonus** | 22 améliorations : plus de production, plus de puissance de clic. |
| **Répression** | Monte quand on accumule sans s'organiser. Chaque achat augmente la protection du mouvement. À 100 %, tout recommence. |
| **Événements** | Le journal raconte la révolution ; certains événements boostent ou ralentissent le mouvement. |
| **Décisions** | Toutes les quelques minutes, un choix à faire (le jeu est en pause). |
| **Grand Soir** | Quand la *Force du mouvement* atteint 100 %, on peut lancer l'insurrection. Ses chances (jusqu'à 90 %) dépendent de la répression, des recruteurs et des propagandistes. En cas d'échec, on perd la moitié de ses révolutionnaires mais on peut retenter. |

Les parties sont sauvegardées dans le navigateur (`localStorage`). On peut en mener plusieurs en parallèle.

## Développement

Prérequis : [Node.js](https://nodejs.org/) 20 ou plus.

```bash
npm install
npm run dev        # serveur de développement : http://localhost:5173
```

| Commande | Rôle |
|---|---|
| `npm run dev` | Serveur de développement avec rechargement automatique |
| `npm run build` | Construit le site dans `dist/` |
| `npm run preview` | Sert le contenu de `dist/` pour le vérifier |
| `npm run lint` | Vérifie le code avec ESLint |
| `npm test` | Tests unitaires (Vitest), dont des parties complètes simulées |
| `npm run test:e2e` | Tests de bout en bout dans un navigateur (Playwright, desktop et mobile) |
| `npm run check` | Tout ce qui précède, comme la CI |

Avant le premier `npm run test:e2e`, installez le navigateur de test : `npx playwright install chromium`.

## Docker

```bash
docker build -t click-click-boom .
docker run --rm -p 8080:80 click-click-boom    # http://localhost:8080
```

L'image est construite en deux étapes : Node construit le jeu, puis nginx sert les fichiers générés.

L'image publiée par la CI : `docker run --rm -p 8080:80 ghcr.io/armelle-pouzioux/clickclickboom:latest`

## Architecture

Du JavaScript sans framework, en modules ES, construit avec [Vite](https://vite.dev/).
La **logique du jeu** ne touche jamais au DOM, ce qui permet de la tester sans navigateur ;
l'**interface** lit l'état et l'affiche.

```
index.html, game.html     pages : accueil et jeu
public/img/               portraits des chefs
src/
  data/                   bonus (upgrades.json) et malus (malus.json)
  game/                   logique du jeu, sans DOM
    config.js             tous les réglages d'équilibrage
    state.js              état d'une partie, chargement et sauvegarde
    economy.js            production, coûts, protection, répression
    effects.js            effets temporaires et effets des événements
    journal.js            journal, paliers, malus de répression, récits
    choices.js            décisions
    grandSoir.js          condition de victoire
    content.js            textes : paliers, événements, décisions, répliques
    engine.js             actions du joueur et seconde de jeu
  ui/                     interface : rendu, fenêtres, bulle du chef
  saves.js                parties multiples dans le localStorage
  game-page.js            point d'entrée du jeu
  launcher.js             point d'entrée de l'accueil
  styles/                 CSS
tests/
  unit/                   Vitest
  e2e/                    Playwright
```

Pour rééquilibrer le jeu, modifiez [src/game/config.js](src/game/config.js) ou [src/data/upgrades.json](src/data/upgrades.json),
puis lancez `npm test` : les tests d'équilibrage vérifient qu'une partie reste gagnable en 5 à 20 minutes.

## CI/CD

Le workflow [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) s'exécute à chaque push et pull request :

1. **Tests** : lint, tests unitaires, build, tests de bout en bout.
2. **Docker** : construit l'image ; sur `main`, la publie sur le GitHub Container Registry (`latest` et le sha du commit).
3. **Pages** : sur `main`, déploie le jeu sur GitHub Pages.

Les étapes 2 et 3 n'ont lieu que si les tests passent.

## Publier le jeu

1. Créez un dépôt vide sur GitHub, puis :
   ```bash
   git remote add origin https://github.com/armelle-pouzioux/clickclickboom.git
   git push -u origin main
   ```
2. Dans le dépôt, **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Le premier push sur `main` lance le workflow ; le lien du jeu apparaît dans l'onglet **Actions** (étape *Déploiement GitHub Pages*)
   et dans **Settings → Pages**.

## Crédits

Projet réalisé à [La Plateforme](https://laplateforme.io/).
Les citations de Karl Marx (*Manifeste du Parti communiste*, *Thèses sur Feuerbach*) et d'Olympe de Gouges
(*Déclaration des droits de la femme et de la citoyenne*) sont authentiques ; les répliques de Rachel sont inspirées
de son parcours, ce ne sont pas des citations.

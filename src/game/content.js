// The stories of the game: milestones, events, choices and the leaders' lines.
// {parti} and {chef} are replaced by the name of the party and of its leader.
import { boughtCount } from "./economy.js";

export const MILESTONES = {
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

// one line per repression tier; each tier also triggers the malus of malus.json
export const REPRESSION_LINES = {
  25: "Des voitures banalisées stationnent devant le local du parti {parti}.",
  50: "Perquisition au petit matin. Les archives ont été cachées à temps.",
  75: "Arrestations en série. {chef} change d'adresse chaque nuit.",
  90: "Couvre-feu décrété. La répression va frapper : il faut s'organiser, vite !",
};

// random events by phase: some only tell the story, others have an effect
// gain = N minutes of production or N clicks (the biggest), so it scales with the game
export const NARRATIVE_EVENTS = {
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

// every few minutes the player must take a decision
export const CHOICES = [
  {
    id: "mecene",
    condition: (state) => state.counter >= 100,
    text: "Un riche sympathisant propose de financer le parti {parti}, en échange de discrétion.",
    options: [
      { label: "Accepter l'argent", effects: [{ type: "gain", minutes: 3, clicks: 60 }, { type: "buff", id: "credibilite", label: "Crédibilité en baisse", kind: "click", factor: 0.8, duration: 120 }] },
      { label: "Refuser poliment", effects: [{ type: "protection", percent: 5 }] },
    ],
  },
  {
    id: "negociation",
    condition: (state) => state.repressionLevel >= 40 && state.counter >= 200,
    text: "Le gouvernement propose d'ouvrir des négociations avec {chef}.",
    options: [
      { label: "Négocier", effects: [{ type: "loss", percent: 25 }, { type: "protection", percent: 15 }] },
      { label: "Refuser et mobiliser", effects: [{ type: "buff", id: "mobilisation", label: "Mobilisation", kind: "production", factor: 1.5, duration: 60 }] },
    ],
  },
  {
    id: "manif",
    condition: (state) => state.counter >= 300,
    text: "La préfecture interdit la grande marche prévue demain.",
    options: [
      { label: "Marcher quand même", effects: [{ type: "gamble", chance: 0.6, win: [{ type: "gain", minutes: 5, clicks: 100 }], lose: [{ type: "loss", percent: 20 }] }] },
      { label: "Annuler la marche", effects: [{ type: "protection", percent: 3 }] },
    ],
  },
  {
    id: "infiltre",
    condition: (state) => state.recruiters >= 3,
    text: "Un recruteur est soupçonné de travailler pour la police.",
    options: [
      { label: "L'exclure", effects: [{ type: "recruiterLoss", count: 1 }, { type: "protection", percent: 8 }] },
      { label: "Le garder à l'œil", effects: [{ type: "gamble", chance: 0.5, win: [{ type: "buff", id: "loyal", label: "Recruteur loyal", kind: "recruiters", factor: 1.5, duration: 90 }], lose: [{ type: "loss", percent: 15 }] }] },
    ],
  },
  {
    id: "media",
    condition: (state) => boughtCount(state) >= 3,
    text: "Une grande chaîne de télévision veut interviewer {chef} en direct.",
    options: [
      { label: "Accepter l'interview", effects: [{ type: "gamble", chance: 0.7, win: [{ type: "gain", minutes: 4, clicks: 80 }], lose: [{ type: "buff", id: "interview", label: "Interview ratée", kind: "click", factor: 0.7, duration: 90 }] }] },
      { label: "Privilégier les médias indépendants", effects: [{ type: "buff", id: "independants", label: "Médias indépendants", kind: "production", factor: 1.3, duration: 120 }] },
    ],
  },
  {
    id: "greve",
    condition: (state) => boughtCount(state) >= 8,
    text: "Les syndicats appellent à la grève générale. {chef} doit trancher.",
    options: [
      { label: "Soutenir la grève", effects: [{ type: "buff", id: "greve_generale", label: "Grève générale", kind: "production", factor: 2, duration: 60 }, { type: "buff", id: "greve_clic", label: "Militants en grève", kind: "click", factor: 0.5, duration: 60 }] },
      { label: "Rester en retrait", effects: [{ type: "buff", id: "retrait", label: "Porte-à-porte", kind: "click", factor: 1.5, duration: 60 }] },
    ],
  },
];

// Karl and Olympe quote their own texts; Rachel's lines are inspired by her story (not quotes)
export const CHEF_LINES = {
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

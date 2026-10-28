// Every balance setting of the game, in one place.

// recruiters and propagandists: each one costs 12.5 % more than the previous
export const COSTS = {
  recruiterBase: 2,      // revolutionaries
  propagandistBase: 5,   // recruiters
  multiplier: 1.125,
};

export const RECRUITER_QUANTITIES = [1, 2, 5, 10, 50, 100];

// how many revolutionaries the movement can hold before repression crushes it;
// every purchased upgrade also adds its cost to the protection
export const PROTECTION = {
  base: 1000,
  recruiter: 50,
  propagandist: 250,
};

// permanent bonus earned with each milestone of this kind
export const MILESTONE_REWARDS = {
  counter: { rate: 0.03, label: "+3 % de production" },
  recruiters: { rate: 0.10, label: "+10 % de production des recruteurs" },
  propagandists: { rate: 0.05, label: "+5 % de protection" },
};

// scale of the "Force du mouvement" bar: 0.2 follows the playing time
// (measured on simulated games: 14 % at 10 % of the game, 41 % at half, 76 % at 90 %)
export const MOVEMENT_SCALE = 0.2;

export const SAFE_REPRESSION = 0.95;   // an event never pushes repression above 95 %
export const REPRESSION_COOLDOWN = 180; // seconds after a malus ends before the repression can strike again

export const JOURNAL_MAX = 60;
export const NARRATIVE_CHANCE = 1 / 60; // per second: about one line per minute

export const CHOICE_MIN_GAP = 90;       // seconds between two choices at least
export const CHOICE_CHANCE = 1 / 90;    // per second after the gap: about one every 3 minutes

// victory: when the movement strength reaches 100 %, the insurrection is unlocked for good.
// Its chances depend on the repression (low is better), the recruiters and the propagandists.
export const INSURRECTION = {
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

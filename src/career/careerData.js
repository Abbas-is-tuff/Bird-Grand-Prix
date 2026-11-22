// Career mode rules and numbers. Change these to make the career easier or harder.

export const SEASON_WEEKS = 8; // week 8 is always the championship final
export const START_MONEY = 300;
export const TRAINING_SLOTS = 2; // training sessions per week

// Prize money share and ranking points by finishing place (1st..6th)
export const PRIZE_SPLIT = [1, 0.6, 0.38, 0.22, 0.12, 0.06];
export const RP_TABLE = [10, 7, 5, 3, 2, 1];

// Fatigue added by racing each distance
export const RACE_FATIGUE = { r60: 8, r100: 10, h100: 12, r200: 14, r400: 20, h400: 24, r800: 28, e1200: 32, r3000: 40 };

export const TIERS = [
  {
    id: 'beginner', name: 'Beginner', icon: '🥚', color: '#8fd16a',
    blurb: 'Small local competitions. Learn the ropes.',
    oppSpeed: [0.9, 0.935], entry: 0, prize: 200, rpMult: 1, costMult: 1,
    races: ['r60', 'r100', 'r200'], times: ['day'],
    events: ['Local Club Meet', 'Seedco Sprint Series', 'Sunday Club Races', 'Park Run Open'],
    cup: 'Beginner Cup Final',
  },
  {
    id: 'amateur', name: 'Amateur', icon: '🐣', color: '#5fb8ff',
    blurb: 'Better competitions, tougher rivals, bigger rewards.',
    oppSpeed: [0.93, 0.962], entry: 40, prize: 650, rpMult: 2, costMult: 2,
    races: ['r60', 'r100', 'h100', 'r200', 'r400', 'h400'], times: ['day', 'sunset'],
    events: ['Regional Open', 'Millet Mart Classic', 'Perch Air Invitational', 'County Championships'],
    cup: 'Amateur League Final',
  },
  {
    id: 'pro', name: 'Professional', icon: '🦅', color: '#ffc93c',
    blurb: 'National competitions in professional stadiums. Sponsors are watching.',
    oppSpeed: [0.958, 0.985], entry: 150, prize: 2200, rpMult: 4, costMult: 4,
    races: ['r100', 'h100', 'r200', 'r400', 'h400', 'r800', 'e1200', 'r3000'], times: ['day', 'sunset', 'night'],
    events: ['National Series', 'Feather Fuel Grand Prix', 'Nest Homes Night Gala', 'Chirp Mobile Classic'],
    cup: 'National Championship',
  },
  {
    id: 'champion', name: 'Champion', icon: '👑', color: '#ff7a5f',
    blurb: 'International championships against the elite.',
    oppSpeed: [0.982, 1.02], entry: 400, prize: 7000, rpMult: 8, costMult: 8,
    races: ['r100', 'h100', 'r200', 'r400', 'h400', 'r800', 'e1200', 'r3000'], times: ['day', 'sunset', 'night'],
    events: ['International Grand Prix', 'Wingspan World Series', 'Skyway Diamond League', 'Golden Feather Meeting'],
    cup: 'World Championship',
  },
];

// Training. "gain" is the improvement from one perfect session, "cap" the most training can ever add.
// Gains shrink as you approach the cap and when your bird is tired, so nothing maxes out instantly.
export const TRAINING = {
  sprint: {
    id: 'sprint', name: 'Sprint training', icon: '⚡', stat: 'topSpeed', label: 'Top speed',
    gain: 0.007, cap: 0.06, fatigue: 18, desc: 'Short flat-out dashes on the straight.',
  },
  endurance: {
    id: 'endurance', name: 'Endurance runs', icon: '🔋', stat: 'staminaCap', label: 'Stamina',
    gain: 0.024, cap: 0.22, fatigue: 22, desc: 'Long steady laps that build stamina.',
  },
  accel: {
    id: 'accel', name: 'Acceleration drills', icon: '🚀', stat: 'accel', label: 'Acceleration',
    gain: 0.018, cap: 0.16, fatigue: 16, desc: 'Explosive starts out of the blocks.',
  },
  turning: {
    id: 'turning', name: 'Turning practice', icon: '🌀', stat: 'grip', label: 'Cornering',
    gain: 0.018, cap: 0.16, fatigue: 12, desc: 'Bend drills for better grip and balance.',
  },
  recovery: {
    id: 'recovery', name: 'Recovery', icon: '🛁', stat: null, label: 'Freshness',
    gain: 0, cap: 0, fatigue: -26, desc: 'Gentle walks, a bath and a nap. Lowers fatigue.',
  },
};

// Paid extras (price is multiplied by the tier's costMult)
export const EXTRAS = {
  coach: { name: 'Pro coach', price: 40, desc: '+60% training gains for one session (a little more tiring).' },
  physio: { name: 'Physio', price: 30, desc: 'Massage and stretching: −40 fatigue. Does not use a training slot.' },
  camp: { name: 'Training camp', price: 120, desc: 'One extra training slot this week.' },
};

// Sponsors appear from Amateur level. Names are invented for this game.
export const SPONSOR_NAMES = ['SEEDCO', 'FEATHER FUEL', 'MILLET MART', 'PERCH AIR', 'NEST HOMES', 'CHIRP MOBILE', 'WINGSPAN TV', 'SKYWAY BANK'];

export const MILESTONES = [
  { id: 'first-race', name: 'Debut', icon: '🎽', test: (c) => c.stats.races >= 1 },
  { id: 'first-podium', name: 'First podium', icon: '🥉', test: (c) => c.stats.podiums >= 1 },
  { id: 'first-win', name: 'First win', icon: '🏅', test: (c) => c.stats.wins >= 1 },
  { id: 'wins-10', name: '10 wins', icon: '🔟', test: (c) => c.stats.wins >= 10 },
  { id: 'wins-25', name: '25 wins', icon: '💫', test: (c) => c.stats.wins >= 25 },
  { id: 'money-1k', name: '$1,000 earned', icon: '💵', test: (c) => c.stats.earnings >= 1000 },
  { id: 'money-10k', name: '$10,000 earned', icon: '💰', test: (c) => c.stats.earnings >= 10000 },
  { id: 'money-100k', name: '$100,000 earned', icon: '🏦', test: (c) => c.stats.earnings >= 100000 },
  { id: 'traveller', name: 'World traveller (raced at every venue)', icon: '🧳', test: (c) => Object.values(c.visited || {}).filter((v) => v.races > 0).length >= 6 },
  { id: 'first-flight', name: 'First flight', icon: '✈️', test: (c) => (c.stats.flights || 0) >= 1 },
  { id: 'all-distances', name: 'All-rounder (won every distance)', icon: '🎯', test: (c) => ['r100', 'r200', 'r400', 'r800'].every((r) => c.stats.winsBy?.[r] > 0) },
];

// ---------------------------------------------------------------- travel
// Venues where each level races (see data/venues.js). The final is always at the cup venue.
export const TIER_VENUES = [
  ['featherfield', 'meadowbrook', 'hollowhills'],
  ['featherfield', 'meadowbrook', 'hollowhills', 'dunevalley'],
  ['featherfield', 'hollowhills', 'dunevalley', 'aurora', 'meadowbrook'],
  ['featherfield', 'dunevalley', 'aurora', 'grandaviary', 'meadowbrook', 'hollowhills'],
];
export const CUP_VENUES = ['featherfield', 'dunevalley', 'aurora', 'grandaviary'];
export const KM_PER_UNIT = 30; // map distance -> kilometres shown to the player

// How you can get around. d = map distance. Costs are multiplied by the travel scale of your level.
export const TRAVEL_MODES = {
  bus: { id: 'bus', icon: '🚌', name: 'Bus', maxDist: 24, cost: (d) => 8 + d * 1.1, slots: (d) => (d > 12 ? 2 : 1), fatigue: (d) => 5 + d * 0.45, jetLag: () => false },
  train: { id: 'train', icon: '🚆', name: 'Train', maxDist: 48, cost: (d) => 18 + d * 2.1, slots: () => 1, fatigue: (d) => 3 + d * 0.22, jetLag: () => false },
  plane: { id: 'plane', icon: '✈️', name: 'Plane', maxDist: 999, cost: (d) => 65 + d * 4.2, slots: (d) => (d > 40 ? 1 : 0), fatigue: (d) => 3 + d * 0.06, jetLag: (d) => d > 40 },
};
export const travelScale = (tierIndex) => 1 + tierIndex * 0.8;
export const HOTEL_PER_WEEK = 15; // x travel scale, paid at the end of each week away from home
export const HOME_REST_BONUS = 6; // extra freshness for a week spent at home
export const JET_LAG_PENALTY = 0.03; // -3% speed and acceleration in your next race
export const HOME_CROWD_BONUS = 0.015; // +1.5% top speed racing at home

// Little things that happen on the road (money is multiplied by the travel scale).
export const TRAVEL_EVENTS = [
  { modes: ['plane'], text: 'Flight delayed! A long night at the airport.', fatigue: 7 },
  { modes: ['plane'], text: 'Upgraded to a comfy seat — slept the whole flight.', fatigue: -6 },
  { modes: ['plane'], text: 'Lost luggage… you had to buy new racing bands.', money: -25 },
  { modes: ['train'], text: 'A fan recognised you on the train and shared some millet.', money: 20 },
  { modes: ['train'], text: 'Quiet carriage and a lovely long nap.', fatigue: -5 },
  { modes: ['bus'], text: 'Bumpy roads — your bird barely slept.', fatigue: 6 },
  { modes: ['bus'], text: 'The bus broke down and you walked the last part.', fatigue: 8 },
  { modes: ['bus', 'train', 'plane'], text: 'Local radio interview when you arrived. New fans!', money: 35 },
  { modes: ['bus', 'train', 'plane'], text: 'Your hotel has a bird bath with a view. Bliss.', fatigue: -4 },
];

// ---- Garage gear (Phase 5): permanent upgrades you buy with prize money.
// bonus = how much better that stat gets (0.02 = 2%). minTier = the career level you need (0 = Beginner).
export const GEAR = {
  diet: {
    name: 'Racing diet', icon: '🥣', stat: 'staminaCap', statName: 'stamina',
    levels: [
      { name: 'Plain seed mix', cost: 0, bonus: 0 },
      { name: 'Premium seeds & pellets', cost: 220, bonus: 0.015, minTier: 0 },
      { name: 'Sports nutrition plan', cost: 650, bonus: 0.03, minTier: 1 },
      { name: 'Champion diet', cost: 1600, bonus: 0.045, minTier: 2 },
    ],
  },
  claws: {
    name: 'Claw & foot care', icon: '🦶', stat: 'grip', statName: 'cornering grip',
    levels: [
      { name: 'Natural claws', cost: 0, bonus: 0 },
      { name: 'Trimmed claws', cost: 180, bonus: 0.02, minTier: 0 },
      { name: 'Grip foot balm', cost: 550, bonus: 0.04, minTier: 1 },
      { name: 'Pro podiatrist', cost: 1400, bonus: 0.06, minTier: 2 },
    ],
  },
  feathers: {
    name: 'Feather care', icon: '🪶', stat: 'topSpeed', statName: 'top speed',
    levels: [
      { name: 'Normal preening', cost: 0, bonus: 0 },
      { name: 'Daily misting bath', cost: 260, bonus: 0.01, minTier: 0 },
      { name: 'Sleek feather oil', cost: 800, bonus: 0.02, minTier: 1 },
      { name: 'Aero-groom pro', cost: 2000, bonus: 0.03, minTier: 2 },
    ],
  },
  warmup: {
    name: 'Warm-up kit', icon: '🔥', stat: 'accel', statName: 'acceleration',
    levels: [
      { name: 'Stretch on the perch', cost: 0, bonus: 0 },
      { name: 'Heated perch', cost: 200, bonus: 0.015, minTier: 0 },
      { name: 'Sprint starting blocks', cost: 600, bonus: 0.03, minTier: 1 },
      { name: 'Reaction trainer', cost: 1500, bonus: 0.045, minTier: 2 },
    ],
  },
};

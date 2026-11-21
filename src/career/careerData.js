// Career mode rules and numbers. Change these to make the career easier or harder.

export const SEASON_WEEKS = 8; // week 8 is always the championship final
export const START_MONEY = 300;
export const TRAINING_SLOTS = 2; // training sessions per week

// Prize money share and ranking points by finishing place (1st..6th)
export const PRIZE_SPLIT = [1, 0.6, 0.38, 0.22, 0.12, 0.06];
export const RP_TABLE = [10, 7, 5, 3, 2, 1];

// Fatigue added by racing each distance
export const RACE_FATIGUE = { r100: 10, r200: 14, r400: 20, r800: 28 };

export const TIERS = [
  {
    id: 'beginner', name: 'Beginner', icon: '🥚', color: '#8fd16a',
    blurb: 'Small local competitions. Learn the ropes.',
    oppSpeed: [0.9, 0.935], entry: 0, prize: 200, rpMult: 1, costMult: 1,
    races: ['r100', 'r200'], times: ['day'],
    events: ['Featherfield Local Meet', 'Seedco Sprint Series', 'Sunday Club Races', 'Park Run Open'],
    cup: 'Beginner Cup Final',
  },
  {
    id: 'amateur', name: 'Amateur', icon: '🐣', color: '#5fb8ff',
    blurb: 'Better competitions, tougher rivals, bigger rewards.',
    oppSpeed: [0.93, 0.962], entry: 40, prize: 650, rpMult: 2, costMult: 2,
    races: ['r100', 'r200', 'r400'], times: ['day', 'sunset'],
    events: ['Regional Open', 'Millet Mart Classic', 'Perch Air Invitational', 'County Championships'],
    cup: 'Amateur League Final',
  },
  {
    id: 'pro', name: 'Professional', icon: '🦅', color: '#ffc93c',
    blurb: 'National competitions in professional stadiums. Sponsors are watching.',
    oppSpeed: [0.958, 0.985], entry: 150, prize: 2200, rpMult: 4, costMult: 4,
    races: ['r100', 'r200', 'r400', 'r800'], times: ['day', 'sunset', 'night'],
    events: ['National Series', 'Feather Fuel Grand Prix', 'Nest Homes Night Gala', 'Chirp Mobile Classic'],
    cup: 'National Championship',
  },
  {
    id: 'champion', name: 'Champion', icon: '👑', color: '#ff7a5f',
    blurb: 'International championships against the elite.',
    oppSpeed: [0.982, 1.02], entry: 400, prize: 7000, rpMult: 8, costMult: 8,
    races: ['r100', 'r200', 'r400', 'r800'], times: ['day', 'sunset', 'night'],
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
  { id: 'all-distances', name: 'All-rounder (won every distance)', icon: '🎯', test: (c) => ['r100', 'r200', 'r400', 'r800'].every((r) => c.stats.winsBy?.[r] > 0) },
];

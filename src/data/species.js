// The six playable bird species.
// "stats" drive the physics. "shape" drives the 3D model. "gait" drives the running animation.
//
// Physics stats:
//   topSpeed    - fastest running speed in metres per second
//   accel       - how hard the bird can accelerate (m/s^2 from standing)
//   staminaCap  - seconds of all-out sprinting a fresh bird can manage
//   recovery    - how fast stamina comes back while easing off
//   grip        - sideways grip on bends (in g). Low grip = runs wide on tight bends
//   turnRate    - how quickly the bird can change direction (radians per second)
//   mass        - used when birds bump into each other
//   size        - visual + collision size

export const SPECIES = {
  lovebird: {
    id: 'lovebird',
    name: 'Lovebird',
    blurb: 'Small, stocky and quick off the mark. Nimble on bends.',
    stats: { topSpeed: 8.6, accel: 7.0, staminaCap: 25, recovery: 0.05, grip: 0.3, turnRate: 2.8, mass: 0.6 },
    size: 0.74,
    shape: {
      body: [0.19, 0.2, 0.27],
      pitch: 0.48,
      headR: 0.135,
      head: [0, 0.085, 0.06],
      beak: { len: 0.115, r: 0.065, hook: 0.75, width: 0.85 },
      tail: { len: 0.17, width: 0.16, count: 10, tip: 'rounded', droop: -0.1 },
      wingLen: 0.34,
      crest: 0,
      legs: { tibia: 0.2, tarsus: 0.13, toes: 'zygo', toeLen: 0.075, width: 0.075, thick: 1.15 },
    },
    gait: { waddle: 0.07, bounce: 1.1, headBob: 0, stride: 1.0 },
  },
  cockatiel: {
    id: 'cockatiel',
    name: 'Cockatiel',
    blurb: 'Long-legged and fast in a straight line. Average on bends.',
    stats: { topSpeed: 8.9, accel: 5.3, staminaCap: 26, recovery: 0.04, grip: 0.235, turnRate: 2.4, mass: 0.8 },
    size: 0.95,
    shape: {
      body: [0.165, 0.185, 0.3],
      pitch: 0.58,
      headR: 0.115,
      head: [0, 0.1, 0.03],
      beak: { len: 0.085, r: 0.05, hook: 0.6, width: 0.8 },
      tail: { len: 0.52, width: 0.17, count: 10, tip: 'pointed', droop: -0.22 },
      wingLen: 0.42,
      crest: 7,
      legs: { tibia: 0.23, tarsus: 0.17, toes: 'zygo', toeLen: 0.08, width: 0.07, thick: 0.95 },
    },
    gait: { waddle: 0.05, bounce: 1.0, headBob: 0, stride: 1.05 },
  },
  pigeon: {
    id: 'pigeon',
    name: 'Pigeon',
    blurb: 'The natural ground runner. Highest top speed and great stamina, but slow to get going. Best over 400 m and 800 m.',
    stats: { topSpeed: 9.0, accel: 4.3, staminaCap: 30, recovery: 0.035, grip: 0.215, turnRate: 2.2, mass: 1.0 },
    size: 1.0,
    shape: {
      body: [0.2, 0.21, 0.33],
      pitch: 0.16,
      headR: 0.11,
      head: [0, 0.075, 0.07],
      beak: { len: 0.1, r: 0.028, hook: 0.08, width: 0.85, cere: true },
      tail: { len: 0.34, width: 0.22, count: 12, tip: 'square', droop: 0.12 },
      wingLen: 0.46,
      crest: 0,
      legs: { tibia: 0.23, tarsus: 0.15, toes: 'aniso', toeLen: 0.1, width: 0.075, thick: 1.0 },
    },
    gait: { waddle: 0.06, bounce: 0.9, headBob: 1, stride: 1.05 },
  },
  parrot: {
    id: 'parrot',
    name: 'Parrot',
    blurb: 'Big, strong and tireless. Slow to accelerate and heavy on the bends.',
    stats: { topSpeed: 8.8, accel: 4.1, staminaCap: 33, recovery: 0.035, grip: 0.2, turnRate: 2.0, mass: 1.25 },
    size: 1.1,
    shape: {
      body: [0.21, 0.23, 0.31],
      pitch: 0.52,
      headR: 0.14,
      head: [0, 0.095, 0.05],
      beak: { len: 0.13, r: 0.07, hook: 0.9, width: 0.85 },
      tail: { len: 0.27, width: 0.19, count: 12, tip: 'square', droop: -0.1 },
      wingLen: 0.46,
      crest: 0,
      legs: { tibia: 0.22, tarsus: 0.13, toes: 'zygo', toeLen: 0.09, width: 0.09, thick: 1.35 },
    },
    gait: { waddle: 0.12, bounce: 0.85, headBob: 0, stride: 1.0 },
  },
  budgerigar: {
    id: 'budgerigar',
    name: 'Budgerigar',
    blurb: 'Tiny and twitchy. Explosive acceleration and superb cornering. A sprint specialist.',
    stats: { topSpeed: 8.5, accel: 7.6, staminaCap: 24, recovery: 0.05, grip: 0.32, turnRate: 3.0, mass: 0.5 },
    size: 0.68,
    shape: {
      body: [0.15, 0.17, 0.26],
      pitch: 0.55,
      headR: 0.11,
      head: [0, 0.08, 0.035],
      beak: { len: 0.06, r: 0.04, hook: 0.7, width: 0.8, cere: true },
      tail: { len: 0.4, width: 0.13, count: 10, tip: 'pointed', droop: -0.2 },
      wingLen: 0.36,
      crest: 0,
      legs: { tibia: 0.22, tarsus: 0.15, toes: 'zygo', toeLen: 0.075, width: 0.065, thick: 0.9 },
    },
    gait: { waddle: 0.05, bounce: 1.25, headBob: 0, stride: 1.0 },
  },
  canary: {
    id: 'canary',
    name: 'Canary',
    blurb: 'The lightest bird. Fastest acceleration and best grip, but tires quickly. Made for the 100 m.',
    stats: { topSpeed: 8.4, accel: 8.3, staminaCap: 22, recovery: 0.06, grip: 0.34, turnRate: 3.2, mass: 0.45 },
    size: 0.64,
    shape: {
      body: [0.16, 0.17, 0.25],
      pitch: 0.36,
      headR: 0.115,
      head: [0, 0.07, 0.06],
      beak: { len: 0.07, r: 0.04, hook: 0.0, width: 0.9 },
      tail: { len: 0.27, width: 0.15, count: 10, tip: 'notched', droop: -0.05 },
      wingLen: 0.34,
      crest: 0,
      legs: { tibia: 0.23, tarsus: 0.18, toes: 'aniso', toeLen: 0.085, width: 0.065, thick: 0.85 },
    },
    gait: { waddle: 0.04, bounce: 1.35, headBob: 0, stride: 0.95 },
  },
};

export const SPECIES_LIST = Object.values(SPECIES);

// 0-100 ratings for the menus (derived from the real stats so they never lie).
export function ratings(stats) {
  const r = (v, lo, hi) => Math.round(Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100)));
  return {
    speed: r(stats.topSpeed, 8.0, 9.25),
    accel: r(stats.accel, 3.6, 8.7),
    stamina: r(stats.staminaCap, 19, 35),
    turning: r(stats.grip, 0.17, 0.36),
  };
}

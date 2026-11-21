// The Garage: how your birds look (leg band, accessory) and the birds you design yourself.
// Everything is saved in the browser (localStorage) under 'bgp.garage.v1'.
import { ROSTER, BIRDS } from '../data/roster.js';
import { SPECIES } from '../data/species.js';

const KEY = 'bgp.garage.v1';

// ---------------------------------------------------------------- choices
export const SWATCHES = [
  '#ffffff', '#f4efe2', '#e9dcb8', '#f7e15a', '#f6c431', '#f39a2b', '#ec6a2c', '#e0392b', '#b81f3a', '#f2a7b5',
  '#e070b0', '#9b5fd0', '#5a50b8', '#2f6fd6', '#4fa8e6', '#7fd6e0', '#2bb39a', '#3f9a3a', '#7cc242', '#c4dc5a',
  '#a9adb3', '#7e8794', '#4b5260', '#232428', '#8a5a3a', '#c9a27a',
];

export const BAND_SWATCHES = ['#ffcc00', '#ff4d4d', '#3aa0ff', '#3ddc84', '#ff8a00', '#c86bff', '#ffffff', '#ff5fa8', '#1d1d1f', '#d4af37'];

export const ACCESSORIES = [
  { id: 'none', name: 'Nothing', icon: '—' },
  { id: 'headband', name: 'Sweatband', icon: '🎽', colored: true },
  { id: 'cap', name: 'Racing cap', icon: '🧢', colored: true },
  { id: 'goggles', name: 'Goggles', icon: '🥽', colored: true },
  { id: 'scarf', name: 'Scarf', icon: '🧣', colored: true },
  { id: 'vest', name: 'Race vest', icon: '🔢', colored: true },
  { id: 'crown', name: 'Champion crown', icon: '👑', unlock: 'cup', lockText: 'Win a championship final in Career' },
];
export const GOLD_BAND = { color: '#d4af37', unlock: 'title', lockText: 'Win a season title in Career' };

// unlocks come from trophies in the current career
export function unlocked(what, career) {
  const tr = career?.trophies || [];
  if (what === 'cup') return tr.some((t) => t.id.startsWith('cup-') && t.icon === '🏆');
  if (what === 'title') return tr.some((t) => t.id.startsWith('season-'));
  return true;
}

export const PERSONALITY_TRAITS = {
  aggressive: 'Fierce competitor', consistent: 'Steady as a rock', fastStarter: 'Quick off the mark',
  endurance: 'Never gives up', unpredictable: 'Full of surprises',
};

// Which roster bird each species uses as its starting colours when you design a bird.
const TEMPLATE = { lovebird: 'abbas', cockatiel: 'cookie', pigeon: 'rocket', parrot: 'salman', budgerigar: 'sky', canary: 'pikachu' };

// The colour groups you can change. "keys" are the palette keys each group sets.
export const COLOR_GROUPS = [
  { id: 'body', name: 'Body' },
  { id: 'head', name: 'Head' },
  { id: 'face', name: 'Face' },
  { id: 'cheek', name: 'Cheeks', only: ['cockatiel', 'budgerigar'] },
  { id: 'crest', name: 'Crest', only: ['cockatiel'] },
  { id: 'wings', name: 'Wings' },
  { id: 'tail', name: 'Tail' },
  { id: 'beak', name: 'Beak' },
  { id: 'legs', name: 'Feet' },
  { id: 'eyes', name: 'Eyes' },
];

// ---------------------------------------------------------------- saving
let data = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.v === 1) return { v: 1, looks: d.looks || {}, custom: d.custom || [] };
  } catch (e) { /* ignore */ }
  return { v: 1, looks: {}, custom: [] };
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) { /* storage full or blocked */ }
}

export function getLook(id) {
  return data.looks[id] || {};
}

export function setLook(id, patch) {
  data.looks[id] = { ...getLook(id), ...patch };
  save();
}

// ---------------------------------------------------------------- custom birds
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export function mix(a, b, t) {
  const A = hex2(a), B = hex2(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export function templateColors(species) {
  return { ...BIRDS[TEMPLATE[species]].colors };
}

export function designFromColors(species, c) {
  const d = {
    body: c.body, head: c.head || c.body, face: c.face || c.head || c.body, wings: c.wing || c.body,
    tail: c.tail || c.body, beak: c.beak || '#e8d6b0', legs: c.legs || '#c9a8a0', eyes: c.iris || '#1a1414',
  };
  if (species === 'cockatiel' || species === 'budgerigar') d.cheek = c.cheek || '#f08a3a';
  if (species === 'cockatiel') d.crest = c.crest || d.head;
  return d;
}

// Turn the few colours you pick into the full set the 3D model uses.
export function colorsFromDesign(species, d) {
  const c = templateColors(species);
  const W = '#ffffff', K = '#000000';
  c.body = d.body;
  c.belly = mix(d.body, W, 0.14);
  c.back = mix(d.body, K, 0.08);
  if (c.chest) c.chest = mix(d.body, W, 0.08);
  c.head = d.head;
  c.face = d.face;
  if (c.forehead) c.forehead = mix(d.face, K, 0.12);
  if (c.throat) c.throat = mix(d.face, W, 0.15);
  if (c.bib) c.bib = mix(d.face, d.body, 0.45);
  if (c.neck) c.neck = mix(d.head, d.body, 0.5);
  if (d.cheek) c.cheek = d.cheek;
  if (d.crest) {
    c.crest = d.crest;
    c.crestTip = mix(d.crest, W, 0.4);
  }
  c.wing = d.wings;
  c.wingCovert = mix(d.wings, W, 0.08);
  c.wingTip = mix(d.wings, K, 0.45);
  c.tail = d.tail;
  c.tailTip = mix(d.tail, K, 0.3);
  c.beak = d.beak;
  c.legs = d.legs;
  c.iris = d.eyes;
  return c;
}

function register(b) {
  b.custom = true;
  b.mine = true;
  b.mods = {};
  b.trait = PERSONALITY_TRAITS[b.personality] || 'Custom bird';
  b.colors = colorsFromDesign(b.species, b.design);
  if (BIRDS[b.id]) {
    Object.assign(BIRDS[b.id], b);
  } else {
    ROSTER.push(b);
    BIRDS[b.id] = b;
  }
  return BIRDS[b.id];
}

export const customBirds = () => ROSTER.filter((b) => b.custom);

export function nextNumber() {
  const used = new Set(ROSTER.map((b) => b.number));
  let n = 15;
  while (used.has(n)) n++;
  return n;
}

export function newBirdDraft() {
  const species = 'lovebird';
  return {
    id: 'my-' + Date.now().toString(36), name: 'New Bird', species, number: nextNumber(), personality: 'consistent',
    design: designFromColors(species, templateColors(species)),
  };
}

export function saveCustomBird(b) {
  const plain = { id: b.id, name: b.name, species: b.species, number: b.number, personality: b.personality, design: { ...b.design } };
  const i = data.custom.findIndex((x) => x.id === b.id);
  if (i < 0) data.custom.push(plain);
  else data.custom[i] = plain;
  save();
  return register({ ...plain });
}

export function deleteCustomBird(id) {
  data.custom = data.custom.filter((x) => x.id !== id);
  delete data.looks[id];
  const i = ROSTER.findIndex((x) => x.id === id);
  if (i >= 0) ROSTER.splice(i, 1);
  delete BIRDS[id];
  save();
}

// add saved custom birds to the roster as soon as the game loads
for (const b of data.custom) if (SPECIES[b.species]) register({ ...b, design: { ...b.design } });

// Every bird in the game. "mine: true" marks your own birds.
// Colours are written as hex codes. Any colour left out falls back to a sensible default.
//
// Palette keys the 3D model understands:
//   body, belly, back, head, face, forehead, throat, bib, chest, neck, rump, mask,
//   cheek, crest, crestTip, barring, wing, wingCovert, wingTip, wingBar, wingPatch,
//   tail, tailTip, tailBand, beak, cere, iris, legs
//
// personality: how the bird races when the computer controls it
//   aggressive | consistent | fastStarter | endurance | unpredictable
// mods: small personal stat differences (+0.03 = 3% better)

export const ROSTER = [
  {
    id: 'abbas', name: 'Abbas', species: 'lovebird', number: 7, mine: true,
    personality: 'aggressive', trait: 'Fierce competitor',
    mods: { topSpeed: 0.02, accel: 0.02 },
    colors: {
      body: '#5fae3e', belly: '#7cc25a', back: '#4e9a34', head: '#5fae3e',
      face: '#f28a4b', forehead: '#e02a2a', throat: '#f6a56c', bib: '#f6a56c',
      rump: '#4f86c9', wing: '#3f8a2e', wingCovert: '#4c9a38', wingTip: '#1d2a1c',
      tail: '#4e9a34', tailBand: '#e0502c', tailTip: '#355f2a',
      beak: '#f0d2c0', iris: '#2a1a12', legs: '#b9a3a0',
    },
  },
  {
    id: 'cookie', name: 'Cookie', species: 'cockatiel', number: 3, mine: true,
    personality: 'consistent', trait: 'Fast but lazy',
    mods: { topSpeed: 0.04, accel: -0.06, staminaCap: -0.05 },
    colors: {
      body: '#f6f0de', belly: '#f8f3e6', back: '#efe6cd', head: '#f6ecc8',
      face: '#f7d34a', crest: '#f5d046', crestTip: '#f3e7a6', cheek: '#f08a3a',
      wing: '#efe4c6', wingCovert: '#f3ead2', wingTip: '#e8dcb8', wingPatch: '#ffffff',
      tail: '#efe4c4', tailTip: '#e6d8b0', beak: '#e6cfae', iris: '#3a1414', legs: '#e3b3a5',
    },
  },
  {
    id: 'snowflake', name: 'Snowflake', species: 'cockatiel', number: 11, mine: true,
    personality: 'consistent', trait: 'Smooth and steady',
    mods: { staminaCap: 0.04 },
    colors: {
      body: '#f8f6f1', belly: '#faf8f4', back: '#f2f0ea', head: '#faf8f3',
      face: '#fbf9f4', crest: '#f6f4ee', crestTip: '#fffefb',
      wing: '#f2efe8', wingCovert: '#f6f4ee', wingTip: '#ebe7de',
      tail: '#f1eee6', beak: '#f2b5b0', cere: '#f1a9a4', iris: '#2a1010', legs: '#f0b9b0',
    },
  },
  {
    id: 'silver', name: 'Silver', species: 'pigeon', number: 9, mine: true,
    personality: 'endurance', trait: 'Never gets tired',
    mods: { staminaCap: 0.05 },
    colors: {
      body: '#a9adb3', belly: '#b3b6bb', back: '#9da2a9', head: '#8e939b',
      face: '#8e939b', neck: '#5d8a6c', bib: '#7b6390',
      wing: '#aeb2b8', wingCovert: '#b6b9be', wingTip: '#3c3f45', wingBar: '#34373c',
      rump: '#bfc2c6', tail: '#8f949b', tailTip: '#2f3236',
      beak: '#3b3a3c', cere: '#e9e6e0', iris: '#e0761f', legs: '#c4564f',
    },
  },
  {
    id: 'pikachu', name: 'Pikachu', species: 'canary', number: 1, mine: true,
    personality: 'fastStarter', trait: 'Lightning reactions',
    mods: { accel: 0.04 },
    colors: {
      body: '#f6d21a', belly: '#f9df4a', back: '#eac514', head: '#f7d621', face: '#f8da2e',
      wing: '#e4bf18', wingCovert: '#efcb1c', wingTip: '#c8a512',
      tail: '#e2bd16', tailTip: '#c9a514', beak: '#ead2b0', iris: '#140d08', legs: '#e2b8a8',
    },
  },
  {
    id: 'salman', name: 'Salman', species: 'parrot', number: 5,
    personality: 'endurance', trait: 'The grey giant',
    mods: { staminaCap: 0.04, topSpeed: 0.01 },
    colors: {
      body: '#8a8d91', belly: '#9a9da1', back: '#7c8084', head: '#999ca0', face: '#a3a6aa',
      mask: '#ecebe6', rump: '#b7b9bc',
      wing: '#6f7377', wingCovert: '#80848a', wingTip: '#3f4246',
      tail: '#c8202a', tailTip: '#b01a22', beak: '#1e1e20', iris: '#e8e2b0', legs: '#55585c',
    },
  },
  {
    id: 'lemon', name: 'Lemon', species: 'parrot', number: 14,
    personality: 'unpredictable', trait: 'Wild card',
    mods: { accel: 0.05, staminaCap: -0.04 },
    colors: {
      body: '#3f9e35', belly: '#3049a0', back: '#3a9430', head: '#3c4fb8', face: '#4459c4',
      neck: '#9ad13a', chest: '#f05a26', bib: '#f6a62a',
      wing: '#3a9a30', wingCovert: '#44a63a', wingTip: '#2b5f3a',
      tail: '#3f9e35', tailTip: '#c9d23a', beak: '#e8442c', iris: '#d9431e', legs: '#6a6d70',
    },
  },
  {
    id: 'lightning', name: 'Lightning', species: 'cockatiel', number: 2,
    personality: 'fastStarter', trait: 'Young and explosive',
    mods: { accel: 0.05, staminaCap: -0.03 },
    colors: {
      body: '#8c8c8a', belly: '#9a9a97', back: '#7f7f7d', head: '#a09a7a',
      face: '#f2d34c', crest: '#d9c25a', crestTip: '#8f8f8c', cheek: '#ef8a38',
      wing: '#7e7e7c', wingCovert: '#868684', wingPatch: '#f4f2ea', wingTip: '#5d5d5b',
      tail: '#6f6f6d', tailTip: '#5a5a58', beak: '#7d7570', iris: '#1a0c0c', legs: '#77706d',
    },
  },
  {
    id: 'sky', name: 'Sky', species: 'budgerigar', number: 4,
    personality: 'consistent', trait: 'Metronome pacing',
    mods: {},
    colors: {
      body: '#5fa7e0', belly: '#6db3e8', back: '#5a9ed6', head: '#f2f2ee', face: '#f6f6f2',
      barring: '#1c1c1e', cheek: '#6a5bc4', cere: '#3b68c9',
      wing: '#e8e8e4', wingCovert: '#efefea', wingBar: '#1d1d20', wingTip: '#2a2a2e',
      tail: '#24416e', tailTip: '#1c3359', beak: '#e8d6a0', iris: '#111111', legs: '#a99aa6',
    },
  },
  {
    id: 'kiwi', name: 'Kiwi', species: 'budgerigar', number: 8,
    personality: 'aggressive', trait: 'All gas, no brakes',
    mods: { topSpeed: 0.01, staminaCap: -0.02 },
    colors: {
      body: '#7dc242', belly: '#86cb48', back: '#73b63c', head: '#f2e24a', face: '#f5e655',
      barring: '#1e1e18', cheek: '#5a50b8', cere: '#c79a70',
      wing: '#e9df58', wingCovert: '#efe565', wingBar: '#1c1c16', wingTip: '#2d2d22',
      tail: '#2f5d6b', tailTip: '#264c58', beak: '#e6d29a', iris: '#111111', legs: '#a99aa6',
    },
  },
  {
    id: 'mango', name: 'Mango', species: 'lovebird', number: 12,
    personality: 'unpredictable', trait: 'Feisty',
    mods: { accel: 0.02 },
    colors: {
      body: '#5bb043', belly: '#77c35a', back: '#4ea236', head: '#7fb944',
      face: '#f27d2a', forehead: '#e8571e', throat: '#f6b03c', bib: '#f2c24a',
      rump: '#4a73c4', wing: '#3d8c2c', wingCovert: '#49983a', wingTip: '#1f2b1d',
      tail: '#4a7fbf', tailBand: '#d8582a', beak: '#d8352a', iris: '#2a160e', legs: '#9a8f8c',
      eyeRing: '#f4f2ee',
    },
  },
  {
    id: 'sunny', name: 'Sunny', species: 'canary', number: 6,
    personality: 'consistent', trait: 'Sunny disposition',
    mods: {},
    colors: {
      body: '#f28c28', belly: '#f5a043', back: '#e98222', head: '#f39030', face: '#f59a38',
      wing: '#e07a1e', wingCovert: '#eb8424', wingTip: '#b8611a',
      tail: '#df791e', tailTip: '#b45e18', beak: '#ecd3b4', iris: '#140d08', legs: '#e2b8a8',
    },
  },
  {
    id: 'rocket', name: 'Rocket', species: 'pigeon', number: 10,
    personality: 'fastStarter', trait: 'Bullet start',
    mods: { accel: 0.05, staminaCap: -0.03 },
    colors: {
      body: '#7f8796', belly: '#8a91a0', back: '#757d8c', head: '#5f6676', face: '#5f6676',
      neck: '#4b7a62', bib: '#6d5684',
      wing: '#8b93a2', wingCovert: '#949bab', wingTip: '#2b2e35', wingBar: '#24262c',
      rump: '#a2a9b6', tail: '#6c7382', tailTip: '#25272d',
      beak: '#2e2e30', cere: '#e6e2dc', iris: '#e3651c', legs: '#c24c45',
    },
  },
];

export const BIRDS = Object.fromEntries(ROSTER.map((b) => [b.id, b]));

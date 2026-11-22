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
    id: 'silver', name: 'Silver', species: 'lovebird', number: 9, mine: true,
    personality: 'endurance', trait: 'Never gets tired',
    mods: { staminaCap: 0.05 },
    colors: {
      // grey (pale-headed) lovebird: creamy white head, pale chest, slate-grey wings
      body: '#c9cbcc', belly: '#dcdcd8', back: '#7e8794', head: '#ece9df',
      face: '#f1eee6', forehead: '#f4f1ea', throat: '#e6e4dc', bib: '#e0dfd9',
      rump: '#8a95a6', wing: '#6f7884', wingCovert: '#7d8691', wingTip: '#3e444d',
      tail: '#7a8390', tailBand: '#a9b0ba', tailTip: '#4a515b',
      beak: '#f2b6bd', iris: '#1a1414', legs: '#e9c4c4',
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

// ---- more rivals (version 0.6). Each starts from a bird of the same species and changes its colours.
const base = (id) => ROSTER.find((b) => b.id === id).colors;
const rival = (id, name, species, number, personality, trait, colors, from) => ({
  id, name, species, number, personality, trait, mods: {}, colors: from ? { ...base(from), ...colors } : colors,
});
ROSTER.push(
  rival('dash', 'Dash', 'roadrunner', 21, 'fastStarter', 'Beep beep', {
    body: '#8a6d50', belly: '#e8dcc4', back: '#5f4935', head: '#4e3c2c', face: '#d8c7a7', throat: '#efe6d4',
    crest: '#3b2d21', crestTip: '#7b5f43', wing: '#4f3d2c', wingCovert: '#6b5440', wingTip: '#241b14',
    tail: '#3d3027', tailTip: '#e6dccb', beak: '#2b2622', iris: '#c9601f', legs: '#7c7570',
  }),
  rival('bolt', 'Bolt', 'roadrunner', 22, 'aggressive', 'Never looks back', {
    body: '#6f5a46', belly: '#d8cbb2', back: '#47382b', head: '#3a2e24', face: '#c9b796', throat: '#e2d6bf',
    crest: '#2a2119', crestTip: '#5f4a36', wing: '#3e3125', wingCovert: '#56463a', wingTip: '#1c1510',
    tail: '#2e251e', tailTip: '#d6cab4', beak: '#262220', iris: '#d3a23a', legs: '#6c6662',
  }),
  rival('pip', 'Pip', 'quail', 23, 'consistent', 'Tiny but mighty', {
    body: '#8b7055', belly: '#d8c19c', back: '#6a5541', head: '#56473a', face: '#f1ede4', throat: '#201b18',
    crest: '#1f1a17', crestTip: '#3a302a', wing: '#7b654f', wingCovert: '#8f7860', wingTip: '#4a3c2f',
    tail: '#6a5541', tailTip: '#4a3c2f', beak: '#2a2522', iris: '#3a1d10', legs: '#c9a27a',
  }),
  rival('button', 'Button', 'quail', 24, 'unpredictable', 'Bounces everywhere', {
    body: '#a98d6b', belly: '#ead9b8', back: '#8a7055', head: '#8a7055', face: '#e9dcc4', throat: '#c9b18e',
    crest: '#5a4a3c', crestTip: '#7a6552', wing: '#9a8062', wingCovert: '#ad9374', wingTip: '#5f4c3a',
    tail: '#8a7055', tailTip: '#5f4c3a', beak: '#3a332e', iris: '#3a1d10', legs: '#d8b48c',
  }),
  rival('blaze', 'Blaze', 'canary', 25, 'aggressive', 'Red-hot finish', {
    body: '#e8562a', belly: '#f0733d', back: '#d84a22', head: '#ea5c2e', face: '#f06a36', wing: '#c9431f',
    wingCovert: '#d84d24', wingTip: '#8f2e14', tail: '#c9431f', tailTip: '#8a2c12',
  }, 'sunny'),
  rival('ziggy', 'Ziggy', 'budgerigar', 26, 'unpredictable', 'Zig-zag runner', {
    body: '#8a5fd0', belly: '#9c74dc', back: '#7a52c0', rump: '#8a5fd0',
  }, 'sky'),
  rival('pepper', 'Pepper', 'pigeon', 27, 'endurance', 'Big-city runner', {
    body: '#4a4e57', belly: '#555963', back: '#40444c', head: '#33363d', face: '#33363d', wing: '#555a64',
    wingCovert: '#5f6470', wingTip: '#16171a', wingBar: '#141518', tail: '#3a3d44', tailTip: '#141518',
  }, 'rocket'),
  rival('ruby', 'Ruby', 'parrot', 28, 'endurance', 'Royal stamina', {
    body: '#c4142a', belly: '#b0102a', back: '#a8102a', head: '#d01830', face: '#d82034', wing: '#9a0f26',
    wingCovert: '#2f55c8', wingTip: '#21348a', tail: '#a8102a', tailTip: '#e0a020', beak: '#1f1d1c',
  }, 'salman'),
  rival('coco', 'Coco', 'cockatiel', 29, 'consistent', 'Cool and calm', {
    body: '#a68a72', belly: '#b39a84', back: '#97795f', wing: '#8e715a', wingCovert: '#9d806a', wingTip: '#5f4a3a',
    tail: '#8e715a', tailTip: '#5f4a3a',
  }, 'cookie'),
  rival('peach', 'Peach', 'lovebird', 30, 'fastStarter', 'Sunshine sprinter', {
    head: '#ece35e', face: '#f4a07a', forehead: '#f08a6a', throat: '#f6b48e',
    body: '#e8e25a', belly: '#efe978', back: '#ddd64a', wing: '#d6cf40', wingCovert: '#e0d954', wingTip: '#b8ae2a',
    tail: '#d6cf40', rump: '#e8e25a',
  }, 'abbas'),
);

export const BIRDS = Object.fromEntries(ROSTER.map((b) => [b.id, b]));

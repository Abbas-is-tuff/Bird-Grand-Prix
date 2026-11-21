// Racing venues around the Bird Grand Prix world. All names are invented for this game.
//
// track.kind:  tartan (rubber track), grass, clay (desert), cinder (countryside dirt)
// track.mu:    grip of the running surface (1 = best). Lower grip = lower top speed and more sliding on bends
// map:         position on the career travel map (0-100 across, 0-60 down)
// prestige:    multiplies prize money for career events held here

export const VENUES = {
  featherfield: {
    id: 'featherfield', name: 'Featherfield Stadium', city: 'Featherfield', icon: '🏟️', home: true,
    type: 'Professional stadium',
    blurb: 'Your home stadium. A big covered grandstand, a loud home crowd and a fast red track.',
    map: { x: 30, y: 24 }, prestige: 1.0,
    track: { kind: 'tartan', color: [176, 62, 48], mu: 1.0 },
    infield: 'stripes', ground: 'grass', wall: 'ads', standMat: 'concrete', seats: ['#1d4fa0', '#1d4fa0', '#f2c230', '#1d4fa0', '#e6e6e6'],
    stands: { main: 18, back: 11, bendE: 10, bendW: 10 }, roof: 'main', crowd: 1, lights: 'towers',
    boards: ['west'], scenery: { trees: 170, treeColor: 0.26, city: 46, hills: '#4d6b45' },
    times: ['day', 'sunset', 'night'],
  },
  meadowbrook: {
    id: 'meadowbrook', name: 'Meadowbrook Green', city: 'Meadowbrook', icon: '🌳',
    type: 'Outdoor grass field',
    blurb: 'A village grass track with picnic banks and marquees. Grass is slower and slippery on the bends.',
    map: { x: 39, y: 17 }, prestige: 0.9,
    track: { kind: 'grass', color: [96, 150, 70], mu: 0.86 },
    infield: 'meadow', ground: 'meadow', wall: 'rail', standMat: 'metal', seats: ['#9aa3ad', '#b6bec7'],
    stands: { main: 6, mainLen: 0.55, back: 0, bendE: 0, bendW: 0 }, banks: ['back', 'bendE'], roof: null, crowd: 0.6, lights: null,
    boards: [], scenery: { trees: 240, treeColor: 0.28, treeRadius: [70, 150], tents: true, hedges: true, hills: '#5b7d4c' },
    times: ['day', 'sunset'],
  },
  hollowhills: {
    id: 'hollowhills', name: 'Hollow Hills Course', city: 'Hollow Hills', icon: '🌾',
    type: 'Countryside course',
    blurb: 'A dusty cinder track between farms and rolling hills. Fans stand along the wooden fence.',
    map: { x: 21, y: 33 }, prestige: 0.95,
    track: { kind: 'cinder', color: [118, 88, 64], mu: 0.91 },
    infield: 'meadow', ground: 'meadow', wall: 'fence', standMat: 'wood', seats: [],
    stands: { main: 0, back: 0, bendE: 0, bendW: 0 }, fenceCrowd: true, roof: null, crowd: 0.7, lights: null,
    boards: [], scenery: { trees: 120, treeColor: 0.22, treeRadius: [90, 200], farm: true, hills: '#6d8a4e', hillsNear: true },
    sky: { day: { top: '#6a9bd0', horizon: '#dce7e2', fog: '#cfdbd3', fogNear: 110, fogFar: 650, clouds: 0.75, sunIntensity: 2.8 } },
    times: ['day', 'sunset'],
  },
  dunevalley: {
    id: 'dunevalley', name: 'Dune Valley Speedway', city: 'Dune Valley', icon: '🏜️',
    type: 'Desert track',
    blurb: 'A clay track in the desert under shade sails and palms. Hot, bright and a little slippery.',
    map: { x: 60, y: 42 }, prestige: 1.15,
    track: { kind: 'clay', color: [196, 120, 70], mu: 0.88 },
    infield: 'sand', ground: 'sand', wall: 'stone', standMat: 'sandstone', seats: ['#c45a3a', '#e0a050', '#f2e2c0'],
    stands: { main: 14, back: 0, bendE: 8, bendW: 8 }, roof: 'sails', crowd: 0.85, lights: 'towers',
    boards: ['west'], scenery: { trees: 0, palms: 70, dunes: true, rocks: 40, hills: '#c9925a' },
    sky: {
      day: { top: '#3f86d6', horizon: '#f2dcb0', bottom: '#c8a070', fog: '#e9d4a8', sunColor: '#fff0cc', sunIntensity: 3.7, hemiGround: '#b08a5a', clouds: 0.12, exposure: 1.0 },
      sunset: { horizon: '#f79a4a', fog: '#e0a070', hemiGround: '#8a5a3a' },
      night: { horizon: '#2a2440', fog: '#1c1a2a' },
    },
    times: ['day', 'sunset', 'night'],
  },
  aurora: {
    id: 'aurora', name: 'Aurora Indoor Arena', city: 'Nordhaven', icon: '❄️',
    type: 'Indoor arena',
    blurb: 'A huge indoor arena in the snowy north. Perfect conditions, a bouncy purple track and a roaring crowd.',
    map: { x: 54, y: 9 }, prestige: 1.2, indoor: true,
    track: { kind: 'tartan', color: [112, 62, 160], mu: 1.03 },
    infield: 'turf', ground: 'floor', wall: 'ads', standMat: 'dark', seats: ['#6a3fb0', '#2fb3b3', '#6a3fb0', '#1c1f2a'],
    stands: { main: 11, back: 11, bendE: 9, bendW: 9 }, roof: 'arena', crowd: 1, lights: 'ceiling',
    boards: ['cube'], scenery: {},
    times: ['indoor'],
  },
  grandaviary: {
    id: 'grandaviary', name: 'Grand Aviary Stadium', city: 'Skyhaven', icon: '🌍',
    type: 'International championship stadium',
    blurb: 'The biggest stage of all: a giant bowl for international championships, with a fast blue track.',
    map: { x: 84, y: 28 }, prestige: 1.4,
    track: { kind: 'tartan', color: [46, 92, 178], mu: 1.02 },
    infield: 'stripes', ground: 'grass', wall: 'ads', standMat: 'concrete', seats: ['#d8262a', '#f4f4f0', '#1d4fa0'],
    stands: { main: 26, back: 24, bendE: 20, bendW: 20 }, roof: 'ring', crowd: 1.35, lights: 'roof',
    boards: ['west', 'east'], flags: true, scenery: { trees: 60, treeColor: 0.25, city: 80, cityBig: true, hills: '#4d6b45' },
    times: ['day', 'sunset', 'night'],
  },
};

export const VENUE_LIST = Object.values(VENUES);
export const HOME_VENUE = 'featherfield';

export function venueDistance(a, b) {
  const A = VENUES[a].map, B = VENUES[b].map;
  return Math.hypot(A.x - B.x, A.y - B.y);
}

// Race types available in this version.
//   mode 'straight' - run in lanes down the home straight (100 m)
//   mode 'lane'     - staggered start, stay in your lane for the whole race
//   mode 'break'    - staggered start, stay in lanes until the break line, then cut in (800 m)
//   cruise          - effort used when you hold RUN (SPRINT is always 100%)

export const RACES = {
  r100: { id: 'r100', name: '100 m Sprint', short: '100 m', dist: 100, mode: 'straight', cruise: 0.92, laps: 0,
    tip: 'Pure speed. Hold SPRINT the whole way and react fast to the gun.' },
  r200: { id: 'r200', name: '200 m', short: '200 m', dist: 200, mode: 'lane', cruise: 0.86, laps: 0,
    tip: 'One bend and the home straight. Sprinting all the way makes small birds fade at the end.' },
  r400: { id: 'r400', name: '400 m', short: '400 m', dist: 400, mode: 'lane', cruise: 0.8, laps: 1,
    tip: 'A full lap in lanes. RUN holds a steady pace that saves energy — SPRINT for the last 100 m or so.' },
  r800: { id: 'r800', name: '800 m Endurance', short: '800 m', dist: 800, mode: 'break', cruise: 0.68, laps: 2,
    tip: 'Two laps. Stay in your lane until the green break line, then move to the inside (left).' },
};

export const RACE_LIST = Object.values(RACES);

export const TIMES_OF_DAY = {
  day: { id: 'day', name: 'Day' },
  sunset: { id: 'sunset', name: 'Sunset' },
  night: { id: 'night', name: 'Night' },
};

export const DIFFICULTY = {
  easy: { id: 'easy', name: 'Easy', speed: 0.935, reaction: 0.05, smart: 0.6 },
  normal: { id: 'normal', name: 'Normal', speed: 0.972, reaction: 0.02, smart: 0.85 },
  hard: { id: 'hard', name: 'Hard', speed: 1.0, reaction: 0.0, smart: 1.0 },
  solo: { id: 'solo', name: 'Time trial', speed: 1.0, reaction: 0.0, smart: 1.0 },
};

// Player settings + saved records (personal bests). Saved in the browser (localStorage).

const SETTINGS_KEY = 'bgp.settings.v1';
const RECORDS_KEY = 'bgp.records.v1';

export const isTouch =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0);

function autoQuality() {
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  if (isTouch && small) return 'medium';
  if (isTouch) return 'medium';
  return 'high';
}

const defaults = {
  quality: 'auto',
  sound: true,
  voice: true,
  laneAssist: true,
  nameTags: true,
  showFps: false,
  lastBird: 'abbas',
  lastRace: 'r100',
  lastTime: 'day',
  lastDifficulty: 'normal',
};

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    /* storage may be unavailable (private mode) - the game still works */
  }
}

export const settings = Object.assign({}, defaults, readJSON(SETTINGS_KEY) || {});

export function saveSettings() {
  writeJSON(SETTINGS_KEY, settings);
}

export function resolvedQuality() {
  return settings.quality === 'auto' ? autoQuality() : settings.quality;
}

// ---- Records ---------------------------------------------------------------
// records = { pb: { [birdId]: { [raceId]: seconds } }, best: { [raceId]: { time, birdId, name } } }
const records = Object.assign({ pb: {}, best: {} }, readJSON(RECORDS_KEY) || {});

export function getPB(birdId, raceId) {
  return records.pb[birdId]?.[raceId] ?? null;
}

export function getTrackRecord(raceId) {
  return records.best[raceId] ?? null;
}

// Returns { isPB, prevPB, isRecord, prevRecord }
export function submitTime(birdId, name, raceId, time) {
  const prevPB = getPB(birdId, raceId);
  const prevRecord = getTrackRecord(raceId);
  const isPB = prevPB == null || time < prevPB;
  const isRecord = prevRecord == null || time < prevRecord.time;
  if (isPB) {
    records.pb[birdId] ||= {};
    records.pb[birdId][raceId] = time;
  }
  if (isRecord) records.best[raceId] = { time, birdId, name };
  if (isPB || isRecord) writeJSON(RECORDS_KEY, records);
  return { isPB, prevPB, isRecord, prevRecord };
}

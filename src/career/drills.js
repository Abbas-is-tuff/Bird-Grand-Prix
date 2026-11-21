// Training drills: every training session is played on the track.
// How well you do (your grade) decides how much your bird improves.
import { formatTime } from '../core/utils.js';

export const DRILLS = {
  sprint: {
    id: 'sprint', name: 'Barrier sprints', short: 'Drill', dist: 100, mode: 'straight', laps: 0, cruise: 0.92,
    barriers: [22, 38, 54, 70, 86], effort: 1,
    hint: 'Hold SPRINT and JUMP over every barrier.',
    weights: { time: 0.5, barriers: 0.5 },
  },
  endurance: {
    id: 'endurance', name: 'Endurance lap', short: 'Drill', dist: 400, mode: 'lane', laps: 1, cruise: 0.8,
    barriers: [70, 150, 230, 310], effort: 0.86,
    hint: 'RUN a full lap at a steady pace, JUMP the barriers, and SPRINT the last part.',
    weights: { time: 0.6, barriers: 0.4 },
  },
  accel: {
    id: 'accel', name: 'Start & burst', short: 'Drill', dist: 60, mode: 'straight', laps: 0, cruise: 0.92,
    barriers: [28, 46], effort: 1,
    hint: 'React to the gun as fast as you can, then SPRINT and JUMP.',
    weights: { reaction: 0.35, time: 0.4, barriers: 0.25 },
  },
  turning: {
    id: 'turning', name: 'Bend control', short: 'Drill', dist: 200, mode: 'lane', laps: 0, cruise: 0.86,
    barriers: [35, 75, 115], effort: 0.95, manualSteer: true,
    hint: 'No lane assist! Steer around the bend with ◀ ▶, stay in your lane and JUMP the barriers.',
    weights: { lane: 0.45, barriers: 0.3, time: 0.25 },
  },
  recovery: {
    id: 'recovery', name: 'Cool-down jog', short: 'Jog', dist: 80, mode: 'straight', laps: 0, cruise: 0.5,
    barriers: [], effort: 0.5, maxEffort: 0.5,
    hint: 'Take it easy: hold RUN for a gentle jog. Don’t sprint!',
    weights: {},
  },
};

const GRADES = [
  { g: 'S', min: 92, mult: 1.5, color: '#ffc93c' },
  { g: 'A', min: 80, mult: 1.25, color: '#7dff9a' },
  { g: 'B', min: 65, mult: 1.0, color: '#5fb8ff' },
  { g: 'C', min: 45, mult: 0.75, color: '#d4def0' },
  { g: 'D', min: 0, mult: 0.5, color: '#ff8a7a' },
];

// A realistic good time for this bird (uses its trained stats).
export function targetTime(drill, stats) {
  const v = stats.topSpeed * drill.effort;
  const tau = v / stats.accel;
  return (drill.dist / v + tau * 0.9 + 0.2 + drill.barriers.length * 0.06) * (drill.mode === 'lane' ? 1.03 : 1.0);
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// row = the player's result row from the race. Returns grade, multiplier and explanation lines.
export function scoreDrill(drill, row) {
  const lines = [];
  if (!row || row.time == null || row.dq) {
    return { score: 0, grade: 'D', mult: 0.3, color: GRADES[4].color, lines: ['Drill not finished.'] };
  }
  if (drill.id === 'recovery') {
    const easy = (row.sprintTime || 0) < 0.4;
    const score = easy ? 100 : 60;
    lines.push(easy ? 'Nice and relaxed — perfect recovery.' : 'You sprinted during a cool-down! Less recovery.');
    const G = GRADES.find((x) => score >= x.min);
    return { score, grade: G.g, mult: easy ? 1.3 : 0.7, color: G.color, lines };
  }
  const parts = {};
  const target = targetTime(drill, row.racer.stats);
  const ratio = row.time / target;
  parts.time = clamp01(1 - (ratio - 1) * 5);
  lines.push(`Time ${formatTime(row.time)} s (target ${formatTime(target)} s)`);
  if (drill.barriers.length) {
    const b = row.barriers;
    parts.barriers = clamp01((b.cleared - 0.5 * b.misses) / b.total);
    lines.push(`Barriers cleared ${b.cleared}/${b.total}${b.hits ? ` • knocked over ${b.hits}` : ''}${b.misses ? ` • ran around ${b.misses}` : ''}`);
  }
  if (drill.weights.reaction) {
    const rt = row.reaction ?? 0.5;
    parts.reaction = clamp01((0.42 - rt) / 0.27);
    lines.push(`Reaction ${rt.toFixed(3)} s`);
  }
  if (drill.weights.lane) {
    parts.lane = clamp01((row.laneFrac - 0.5) / 0.48);
    lines.push(`In your lane ${Math.round(row.laneFrac * 100)}% of the time`);
  }
  let score = 0;
  for (const k in drill.weights) score += drill.weights[k] * (parts[k] ?? 0);
  score = Math.round(score * 100);
  const G = GRADES.find((x) => score >= x.min);
  return { score, grade: G.g, mult: G.mult, color: G.color, lines };
}

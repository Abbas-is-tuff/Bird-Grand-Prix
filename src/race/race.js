// The race itself: start procedure, rules, physics loop, positions, finish and results.
import { Emitter, clamp, rand, shuffle } from '../core/utils.js';
import { T, locate, stationOf, pointAt, measureOffset, laneCenter, lapLength, surfaceAt } from '../world/track.js';
import { Racer, BAND_COLORS } from './racer.js';
import { AIController } from '../ai/aiController.js';
import { PlayerController } from '../input/playerController.js';
import { RACES, DIFFICULTY } from '../data/races.js';
import { BIRDS } from '../data/roster.js';

const STEP = 1 / 120;
const tmp = {};

export class Race extends Emitter {
  constructor({ scene, input, raceId, playerBirdId, opponentIds, difficulty = 'normal', oppSpeed = null, playerBonus = null }) {
    super();
    this.scene = scene;
    this.input = input;
    this.def = RACES[raceId];
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
    this.solo = opponentIds.length === 0;
    this.breakDist = Math.PI * (T.R + measureOffset(1));
    const lanes = opponentIds.length === 0 ? [4] : shuffle([2, 3, 4, 5, 6, 7]);
    const ids = [playerBirdId, ...opponentIds];
    this.racers = ids.map((id, i) => {
      const bird = BIRDS[id];
      const isPlayer = i === 0;
      const r = new Racer({
        bird, isPlayer, lane: lanes[i], bandColor: BAND_COLORS[i % BAND_COLORS.length],
        speedMul: isPlayer ? 1 : oppSpeed?.[i - 1] ?? this.diff.speed,
        bonus: isPlayer ? playerBonus : null,
      });
      r.controller = isPlayer ? new PlayerController(r, this, input) : new AIController(r, this, bird.personality, this.diff);
      scene.add(r.model.root);
      scene.add(r.tag);
      return r;
    });
    this.player = this.racers[0];
    this.racers.sort((a, b) => a.lane - b.lane);
    this.byLane = this.racers.slice();
    this.acc = 0;
    this.excitement = 0.25;
    this.setPhase('intro');
    this.resetPositions();
  }

  get lanesUsed() {
    return this.racers.map((r) => r.lane);
  }

  dispose() {
    for (const r of this.racers) r.dispose();
    this.racers = [];
  }

  // ------------------------------------------------------------------ setup
  resetPositions() {
    this.raceTime = 0;
    this.finishOrder = [];
    this.leader = null;
    this.flags = {};
    this.standings = this.racers.slice();
    for (const r of this.racers) this.placeAtStart(r);
  }

  startPoint(lane) {
    const D = this.def.dist;
    if (this.def.mode === 'straight') {
      return { x: T.FINISH_X - D, z: T.R + laneCenter(lane), h: Math.PI / 2, s: 0, m: 0 };
    }
    const m = measureOffset(lane);
    const lap = lapLength(m);
    let s0;
    if (this.def.mode === 'lane') s0 = (((T.L - D) % lap) + lap) % lap;
    else s0 = T.L + Math.PI * (T.R + m) - this.breakDist;
    const p = pointAt(s0, m, laneCenter(lane), {});
    return { x: p.x, z: p.z, h: p.h, s: s0, m };
  }

  placeAtStart(r) {
    const keepDQ = r.dq === 'False start' ? r.dq : null;
    const falseStarts = r.falseStarts || 0;
    r.resetRaceState();
    r.dq = keepDQ;
    r.falseStarts = falseStarts;
    const sp = this.startPoint(r.lane);
    r.pmode = this.def.mode;
    r.startX = sp.x;
    r.measure = sp.m;
    r.lapLen = lapLength(sp.m);
    r.body.reset(sp.x, sp.z, sp.h);
    r.body.stamina = r.startStamina;
    r.anim.reset(sp.x, sp.z, sp.h);
    this.updateLoc(r);
    r.prevS = r.pmode === 'straight' ? 0 : stationOf(r.loc, r.measure);
    r.prevProgress = 0;
    r.coolT = 0;
    r.controller.newRace?.();
  }

  // ------------------------------------------------------------------ helpers used by controllers
  inStraightZone(r) {
    return r.pmode === 'straight' && r.body.x < T.FINISH_X - 0.5;
  }

  updateLoc(r) {
    if (this.inStraightZone(r)) {
      r.loc.seg = 0;
      r.loc.t = r.body.x;
      r.loc.d = r.body.z - T.R;
      r.loc.curv = 0;
    } else {
      locate(r.body.x, r.body.z, r.loc);
    }
  }

  laneLocked(r) {
    if (r.finished) return true;
    if (this.def.mode === 'break') return !r.broke;
    return true;
  }

  headingToward(r, dT) {
    const b = r.body;
    const look = 1.5 + 0.35 * b.speed;
    if (this.inStraightZone(r)) return Math.atan2(look, T.R + dT - b.z);
    const s = stationOf(r.loc, dT);
    pointAt(s + look, dT, dT, tmp);
    return Math.atan2(tmp.x - b.x, tmp.z - b.z);
  }

  // Sustainable race pace for this bird: uses ~70% of its stamina, saving the rest for a sprint finish.
  cruiseFor(r) {
    const D = this.def.dist;
    if (D <= 100) return 0.95;
    const st = r.stats;
    const e = Math.pow((0.7 * st.staminaCap * st.topSpeed) / D, 0.2);
    return Math.min(0.95, Math.max(0.6, e));
  }

  insideBlocked(r) {
    for (const o of this.racers) {
      if (o === r) continue;
      const dp = o.progress - r.progress;
      const dd = o.loc.d - r.loc.d;
      if (Math.abs(dp) < 1.4 && dd < -0.15 && dd > -1.05) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ phases
  setPhase(p) {
    this.phase = p;
    this.phaseTime = 0;
    if (p === 'set') this.setHold = rand(1.4, 2.4);
    this.emit('phase', p);
  }

  skipIntro() {
    if (this.phase === 'intro') this.setPhase('marks');
  }

  falseStart(r) {
    if (this.phase === 'recall') return;
    this.acc = 0;
    r.falseStarts = (r.falseStarts || 0) + 1;
    const disq = r.falseStarts >= 2;
    if (disq) r.dq = 'False start';
    this.emit('falseStart', { racer: r, dq: disq });
    this.setPhase('recall');
  }

  update(dt) {
    this.phaseTime += dt;
    const inp = this.input;
    switch (this.phase) {
      case 'intro':
        if (this.phaseTime > 5.5) this.setPhase('marks');
        break;
      case 'marks':
        if (this.phaseTime > 2.4) this.setPhase('set');
        break;
      case 'set':
        if (!this.player.dq && inp.going && this.phaseTime > 0.35) {
          this.falseStart(this.player);
          break;
        }
        if (this.phaseTime > this.setHold) {
          this.setPhase('running');
          this.emit('gun');
        }
        break;
      case 'recall':
        if (this.phaseTime > 2.6) {
          for (const r of this.racers) this.placeAtStart(r);
          this.setPhase('marks');
        }
        break;
      case 'running':
      case 'done':
        this.simulate(dt);
        break;
      default:
        break;
    }

    // animation modes + visuals
    for (const r of this.racers) {
      let mode = 'idle';
      if (this.phase === 'marks' || this.phase === 'set') mode = r.dq ? 'idle' : 'marks';
      else if (this.phase === 'running' || this.phase === 'done') {
        mode = 'run';
        if (r.finished && r.body.speed < 2.6) {
          const top3 = r.place <= 3 && !r.dq;
          mode = r.place === 1 || (r.isPlayer && top3) ? 'celebrate' : 'tired';
        }
      }
      r.animMode = mode;
      const b = r.body;
      r.anim.update(dt, { x: b.x, z: b.z, h: b.h, vx: b.vx, vz: b.vz, speed: b.speed, accel: b.accel, latAcc: b.latAcc, yawRate: b.yawRate, slip: b.slip }, mode);
      r.tag.position.set(b.x, r.tagHeight, b.z);
    }
    this.updateExcitement(dt);
  }

  // ------------------------------------------------------------------ simulation
  simulate(dt) {
    this.acc += dt;
    let steps = 0;
    while (this.acc >= STEP && steps < 60 && (this.phase === 'running' || this.phase === 'done')) {
      this.acc -= STEP;
      steps++;
      this.raceTime += STEP;
      this.step(STEP);
    }
    if (steps >= 60) this.acc = 0;
    this.updateStandings();
    this.checkEnd(dt);
  }

  step(dt) {
    const D = this.def.dist;
    for (const r of this.racers) {
      if (r.dq === 'False start') {
        r.ctrl.throttle = 0;
        r.ctrl.desiredHeading = r.body.h;
      } else if (!r.finished) r.controller.update(dt);
      else {
        r.coolT += dt;
        r.ctrl.throttle = Math.max(0, 0.55 - r.coolT * 0.11);
        r.ctrl.desiredHeading = this.headingToward(r, r.coolD);
      }
      const surf = surfaceAt(r.body.x, r.body.z, this.inStraightZone(r));
      r.body.step(dt, r.ctrl, surf.mu);
    }
    this.boundaries();
    this.collisions();
    for (const r of this.racers) {
      this.updateLoc(r);
      r.prevProgress = r.progress;
      if (r.pmode === 'straight' && !r.finished) {
        r.progress = r.body.x - r.startX;
      } else if (r.pmode !== 'straight') {
        const s = stationOf(r.loc, r.measure);
        let ds = s - r.prevS;
        if (ds < -r.lapLen / 2) ds += r.lapLen;
        else if (ds > r.lapLen / 2) ds -= r.lapLen;
        r.progress += ds;
        r.prevS = s;
        if (r.pmode === 'break' && !r.broke && r.progress >= this.breakDist) {
          r.broke = true;
          r.measure = measureOffset(1);
          r.lapLen = lapLength(r.measure);
          r.prevS = stationOf(r.loc, r.measure);
          if (r.isPlayer) this.emit('break', r);
        }
      }
      // finish line
      if (!r.finished && r.dq !== 'False start' && r.progress >= D) {
        const frac = clamp((D - r.prevProgress) / Math.max(1e-6, r.progress - r.prevProgress), 0, 1);
        r.finishTime = this.raceTime - dt + dt * frac;
        r.finished = true;
        this.finishOrder.push(r);
        r.place = this.finishOrder.length;
        r.coolD = clamp(r.loc.d, 0.5, T.EDGE - 0.5);
        this.emit('finish', r);
      }
      // lane discipline on bends (stepping inside your lane gains distance = disqualified)
      if (!r.finished && !r.dq && r.pmode !== 'straight' && this.laneLocked(r) && r.lane > 1 && r.loc.curv > 0) {
        const inner = (r.lane - 1) * T.W;
        if (r.loc.d < inner - 0.12) r.laneViolation += dt;
        else r.laneViolation = Math.max(0, r.laneViolation - dt * 0.5);
        if (r.laneViolation > 0.6) {
          r.dq = 'Lane violation';
          this.emit('dq', r);
        }
      }
    }
  }

  boundaries() {
    const hL = T.L / 2;
    for (const r of this.racers) {
      const b = r.body;
      const rad = b.radius;
      if (this.inStraightZone(r)) {
        const d = b.z - T.R;
        if (d < rad) b.pushOut(0, 1, rad - d, 0.002);
        if (d > T.WALL - rad) b.pushOut(0, -1, d - (T.WALL - rad), 0.004);
        continue;
      }
      const loc = locate(b.x, b.z, tmp);
      let nx, nz;
      if (loc.seg === 0) { nx = 0; nz = 1; }
      else if (loc.seg === 2) { nx = 0; nz = -1; }
      else {
        const cx = loc.seg === 1 ? hL : -hL;
        const dx = b.x - cx, dz = b.z;
        const len = Math.hypot(dx, dz) || 1;
        nx = dx / len; nz = dz / len;
      }
      if (loc.d < rad) b.pushOut(nx, nz, rad - loc.d, 0.002);
      else if (loc.d > T.WALL - rad) b.pushOut(-nx, -nz, loc.d - (T.WALL - rad), 0.004);
    }
  }

  collisions() {
    const rs = this.racers;
    for (let i = 0; i < rs.length; i++) {
      for (let j = i + 1; j < rs.length; j++) {
        const a = rs[i].body, b = rs[j].body;
        const dx = b.x - a.x, dz = b.z - a.z;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (!(d2 < rr * rr) || d2 < 1e-8) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, nz = dz / d;
        const overlap = rr - d;
        const wa = b.mass / (a.mass + b.mass), wb = a.mass / (a.mass + b.mass);
        a.x -= nx * overlap * wa; a.z -= nz * overlap * wa;
        b.x += nx * overlap * wb; b.z += nz * overlap * wb;
        const vn = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
        if (vn < 0) {
          const jimp = (-(1 + 0.25) * vn) / (1 / a.mass + 1 / b.mass);
          a.vx -= (jimp / a.mass) * nx; a.vz -= (jimp / a.mass) * nz;
          b.vx += (jimp / b.mass) * nx; b.vz += (jimp / b.mass) * nz;
          a.vx *= 0.985; a.vz *= 0.985; b.vx *= 0.985; b.vz *= 0.985;
          if (-vn > 0.6) {
            const strength = clamp(-vn / 3, 0.3, 1);
            rs[i].anim.triggerStumble(strength);
            rs[j].anim.triggerStumble(strength);
            this.emit('bump', { a: rs[i], b: rs[j], strength });
          }
        }
      }
    }
  }

  updateStandings() {
    const list = this.racers.slice().sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.progress - a.progress;
    });
    this.standings = list;
    list.forEach((r, i) => {
      if (!r.finished) r.place = i + 1;
    });
    const lead = list[0];
    if (this.phase === 'running' && !this.solo && lead !== this.leader && this.raceTime > 2.5 && !lead.finished) {
      this.leader = lead;
      this.emit('leader', lead);
    }
    if (!this.leader) this.leader = lead;
    const D = this.def.dist;
    const lp = lead.progress;
    if (D === 100 && lp > 50 && !this.flags.half) { this.flags.half = true; this.emit('halfway', lead); }
    if (D > 100 && lp > D - T.L && !this.flags.straight) { this.flags.straight = true; this.emit('finalStraight', lead); }
    if (D === 800 && lp > 400 && !this.flags.bell) { this.flags.bell = true; this.emit('bell', lead); }
  }

  checkEnd() {
    if (this.phase !== 'running') {
      if (this.phase === 'done' && this.phaseTime > 4.2 && !this.resultsSent) {
        this.resultsSent = true;
        this.emit('results', this.results());
      }
      return;
    }
    const active = this.racers.filter((r) => r.dq !== 'False start');
    const allDone = active.every((r) => r.finished);
    const p = this.player;
    const playerFinishedAt = p.finished ? p.finishTime : null;
    const aiDone = active.filter((r) => !r.isPlayer).every((r) => r.finished);
    const lastAI = Math.max(0, ...active.filter((r) => !r.isPlayer && r.finished).map((r) => r.finishTime));
    let end = allDone;
    if (playerFinishedAt != null && this.raceTime > playerFinishedAt + 12) end = true;
    const hasAI = active.some((r) => !r.isPlayer);
    if (hasAI && (p.dq === 'False start' || !p.finished) && aiDone && this.raceTime > lastAI + (p.dq === 'False start' ? 3 : 20)) end = true;
    if (!hasAI && (p.dq === 'False start' || this.raceTime > 60 + this.def.dist * 0.6)) end = true;
    if (end) {
      for (const r of active) {
        if (!r.finished && !r.isPlayer) {
          r.finishTime = this.raceTime + (this.def.dist - r.progress) / Math.max(3, r.body.speed);
          r.finished = true;
          r.estimated = true;
          this.finishOrder.push(r);
          r.place = this.finishOrder.length;
          r.coolD = clamp(r.loc.d, 0.5, T.EDGE - 0.5);
        }
      }
      this.setPhase('done');
    }
  }

  results() {
    const rows = this.racers.map((r) => ({
      racer: r, time: r.finished ? r.finishTime : null, dq: r.dq, reaction: r.reaction, estimated: !!r.estimated,
    }));
    rows.sort((a, b) => {
      const ka = a.dq ? 2 : a.time == null ? 1 : 0;
      const kb = b.dq ? 2 : b.time == null ? 1 : 0;
      if (ka !== kb) return ka - kb;
      return (a.time ?? 1e9) - (b.time ?? 1e9);
    });
    const win = rows[0].time;
    rows.forEach((row, i) => {
      row.place = row.dq || row.time == null ? null : i + 1;
      row.gap = row.time != null && win != null && i > 0 ? row.time - win : null;
    });
    return { def: this.def, rows, player: rows.find((r) => r.racer.isPlayer) };
  }

  updateExcitement(dt) {
    let target = 0.25;
    if (this.phase === 'marks') target = 0.12;
    if (this.phase === 'set') target = 0.03;
    if (this.phase === 'running' && this.standings.length) {
      const D = this.def.dist;
      const lead = this.standings[0];
      const second = this.standings[1];
      const frac = clamp(lead.progress / D, 0, 1);
      const close = second ? clamp(1 - Math.abs(lead.progress - second.progress) / 4, 0, 1) : 0;
      target = 0.45 + 0.35 * Math.pow(frac, 2) + 0.25 * close * frac;
      if (this.finishOrder.length) target = 0.9;
    }
    if (this.phase === 'done') target = Math.max(0.35, 0.9 - this.phaseTime * 0.12);
    this.excitement += (target - this.excitement) * Math.min(1, dt * 1.5);
  }
}

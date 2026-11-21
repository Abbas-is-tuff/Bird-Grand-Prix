// Computer-controlled racers. Each has a personality that changes how it starts, paces,
// kicks for the line, takes bends and reacts to other birds.
import { clamp, damp, rand } from '../core/utils.js';
import { T, laneCenter } from '../world/track.js';

const G = 9.81;

export const PERSONALITIES = {
  aggressive: { label: 'Aggressive', cruise: 0.04, kickMargin: 0.82, corner: 1.04, reaction: [0.13, 0.2], wander: 0.06, pass: 0.15 },
  consistent: { label: 'Consistent', cruise: 0.0, kickMargin: 1.08, corner: 0.98, reaction: [0.15, 0.19], wander: 0.02, pass: 0.4 },
  fastStarter: { label: 'Fast starter', cruise: 0.01, kickMargin: 1.12, corner: 1.0, reaction: [0.1, 0.14], wander: 0.04, pass: 0.3, fastStart: 0.2 },
  endurance: { label: 'Endurance', cruise: -0.035, kickMargin: 1.0, corner: 0.97, reaction: [0.16, 0.22], wander: 0.03, pass: 0.35 },
  unpredictable: { label: 'Unpredictable', cruise: 0.0, kickMargin: 0.95, corner: 1.03, reaction: [0.11, 0.3], wander: 0.1, pass: 0.2, surges: true },
};

export class AIController {
  constructor(racer, race, personalityId, difficulty) {
    this.r = racer;
    this.race = race;
    this.p = PERSONALITIES[personalityId] || PERSONALITIES.consistent;
    this.diff = difficulty;
    this.dT = laneCenter(racer.lane);
    this.wander = 0;
    this.wanderT = rand(0, 3);
    this.surge = 0;
    this.surgeT = rand(2, 6);
    this.kicking = false;
    this.kickMargin = this.p.kickMargin * (this.p.surges ? rand(0.85, 1.15) : 1);
    this.newRace();
  }

  newRace() {
    const [a, b] = this.p.reaction;
    this.reaction = rand(a, b) + this.diff.reaction + (Math.random() < 0.08 ? rand(0.03, 0.1) : 0);
    this.kicking = false;
    this.dT = laneCenter(this.r.lane);
  }

  update(dt) {
    const r = this.r;
    const race = this.race;
    const def = race.def;
    const body = r.body;
    const st = r.stats;
    const D = def.dist;
    const p = Math.max(0, r.progress);
    const rem = D - p;

    // ---- waiting for the gun
    if (race.raceTime < this.reaction) {
      r.ctrl.throttle = 0;
      r.ctrl.desiredHeading = race.headingToward(r, this.dT);
      return;
    }
    if (!r.reacted) {
      r.reacted = true;
      r.reaction = this.reaction;
    }

    // ---- pace plan
    let e;
    if (D <= 100) {
      e = 0.985 + this.p.cruise * 0.3;
    } else {
      e = race.cruiseFor(r) * (0.9 + 0.1 * this.diff.smart) + def.cruise * 0.1 * (1 - this.diff.smart) + this.p.cruise;
      if (this.p.fastStart && p < D * this.p.fastStart) e = Math.max(e, 0.96);
      if (p < 25) e = Math.max(e, 0.9); // everyone drives out of the start
    }
    // random surges for unpredictable birds
    if (this.p.surges) {
      this.surgeT -= dt;
      if (this.surgeT < 0) {
        this.surgeT = rand(2, 6);
        this.surge = Math.random() < 0.5 ? rand(-0.06, 0.1) : 0;
      }
      e += this.surge;
    }
    // kick for the line when stamina allows sprinting all the way home
    const needed = rem / (st.topSpeed * 0.95) / st.staminaCap;
    const smart = this.diff.smart;
    if (!this.kicking && D > 100) {
      const margin = this.kickMargin / (0.85 + 0.15 * smart);
      if (body.stamina - 0.03 > needed * margin || rem < 35 + 25 * (1 - smart)) this.kicking = true;
    }
    if (this.kicking) e = 1;

    // ---- bends: don't run faster than grip allows (with a little over-confidence for some)
    const loc = r.loc;
    const radius = T.R + Math.max(0.3, loc.d);
    const onBend = loc.curv > 0 && r.pmode !== 'straight';
    if (onBend) {
      const vSafe = Math.sqrt((st.grip * G + 0.15) * radius) * this.p.corner * (0.97 + 0.03 * smart);
      if (body.speed > vSafe) e = Math.min(e, (vSafe / st.topSpeed) * 0.98);
    }
    // ---- where to run (lateral line)
    this.wanderT -= dt;
    if (this.wanderT < 0) {
      this.wanderT = rand(1.5, 4);
      this.wander = rand(-1, 1) * this.p.wander;
    }
    let target;
    this.follow = null;
    if (race.laneLocked(r)) {
      target = laneCenter(r.lane) + this.wander;
    } else {
      target = this.freeRunningLine(e);
    }
    if (this.follow != null) e = Math.min(e, this.follow / st.topSpeed + 0.01);
    r.ctrl.throttle = clamp(e, 0, 1);
    this.dT = damp(this.dT, target, 2.2, dt);
    r.ctrl.desiredHeading = race.headingToward(r, this.dT);
  }

  // After the break line: get to the inside, overtake on the outside, don't cut across others.
  freeRunningLine(effort) {
    const r = this.r;
    const myD = r.loc.d;
    let target = 0.62 + this.wander * 0.5;
    let blocker = null;
    let alongsideInside = null;
    for (const o of this.race.racers) {
      if (o === r || o.finished || o.dq === 'False start') continue;
      const dp = o.progress - r.progress;
      const dd = o.loc.d - myD;
      if (dp > 0.3 && dp < 3.5 && Math.abs(dd) < 0.75) {
        if (!blocker || dp < blocker.dp) blocker = { o, dp };
      }
      if (Math.abs(dp) < 1.3 && dd < -0.15 && dd > -1.1) alongsideInside = o;
    }
    if (blocker) {
      const wantFaster = effort * r.stats.topSpeed > blocker.o.body.speed + this.p.pass;
      if (wantFaster) target = blocker.o.loc.d + 0.95;
      else {
        target = Math.max(target, myD); // sit behind and match speed
        if (blocker.dp < 1.6) this.follow = blocker.o.body.speed;
      }
    }
    if (alongsideInside) target = Math.max(target, alongsideInside.loc.d + 0.85);
    return clamp(target, 0.45, T.EDGE - 0.5);
  }
}

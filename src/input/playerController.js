// Turns your button presses into commands for your bird.
// RUN = steady race pace (depends on distance), SPRINT = 100% effort.
// With Lane Assist on, your bird steers itself along your lane; left/right nudges it.
import { clamp, damp } from '../core/utils.js';
import { T, laneCenter } from '../world/track.js';
import { settings } from '../core/settings.js';

export class PlayerController {
  constructor(racer, race, input) {
    this.r = racer;
    this.race = race;
    this.input = input;
    this.offset = 0;
    this.dT = laneCenter(racer.lane);
  }

  newRace() {
    this.offset = 0;
    this.dT = laneCenter(this.r.lane);
    this.jumpQueued = 0;
  }

  // A jump press is remembered for a moment so a quick tap is never lost.
  queueJump() {
    this.jumpQueued = 0.15;
  }

  update(dt) {
    const r = this.r;
    const race = this.race;
    const inp = this.input;
    let throttle = inp.sprint ? 1 : inp.run ? race.cruiseFor(r) : 0;
    if (r.dq === 'False start') throttle = 0;
    const drill = race.drill;
    if (drill?.maxEffort != null) {
      if (inp.sprint) r.sprintTime += dt;
      throttle = Math.min(throttle, drill.maxEffort);
    }
    if (this.jumpQueued > 0) {
      this.jumpQueued -= dt;
      if (race.phase === 'running' && r.body.onGround && r.body.jump()) {
        this.jumpQueued = 0;
        race.emit('jump', r);
      }
    }
    r.ctrl.throttle = throttle;
    if (!r.reacted && throttle > 0) {
      r.reacted = true;
      r.reaction = race.raceTime;
      // Official rule: reacting faster than 0.100 s means you guessed the gun = false start.
      if (race.phase === 'running' && race.raceTime < 0.1) {
        race.falseStart(r);
        return;
      }
    }

    const steer = inp.right - inp.left; // +1 = right = outward
    if (settings.laneAssist && !drill?.manualSteer) {
      if (race.laneLocked(r)) {
        this.offset = damp(this.offset, steer * 0.42, 5, dt);
        this.dT = laneCenter(r.lane) + this.offset;
      } else {
        if (steer !== 0) this.dT += steer * 2.0 * dt;
        else if (!race.insideBlocked(r)) this.dT -= 0.5 * dt; // drift to the inside lane
        this.dT = clamp(this.dT, 0.5, T.EDGE - 0.5);
        if (Math.abs(this.dT - r.loc.d) > 1.2) this.dT = r.loc.d + Math.sign(this.dT - r.loc.d) * 1.2;
      }
      r.ctrl.desiredHeading = race.headingToward(r, this.dT);
      r.ctrl.steer = 0;
    } else {
      r.ctrl.desiredHeading = null;
      r.ctrl.steer = steer;
    }
  }
}

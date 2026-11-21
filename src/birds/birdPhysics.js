// Force-based running physics for one bird (world units: metres, seconds).
//
// - The bird pushes along the direction it faces (forward force limited by surface grip).
// - Its feet must also cancel sideways sliding. On bends that needs sideways grip; if the bird
//   is too fast for its grip it drifts wide and loses speed ("scrubbing").
// - Effort uses stamina. Low stamina = fatigue, which limits how hard the bird can run.
import { clamp, wrapAngle } from '../core/utils.js';

const G = 9.81;
export const JUMP_SPEED = 3.3; // m/s upward: about 0.55 m high, 0.65 s in the air

export class BirdBody {
  constructor(stats, radius, mass) {
    this.stats = stats;
    this.radius = radius;
    this.mass = mass;
    this.reset(0, 0, 0);
  }

  reset(x, z, h) {
    this.x = x;
    this.z = z;
    this.h = h;
    this.vx = 0;
    this.vz = 0;
    this.yawRate = 0;
    this.effort = 0;
    this.stamina = 1;
    this.speed = 0;
    this.accel = 0;
    this.latAcc = 0;
    this.slip = 0;
    this.vF = 0;
    this.y = 0; // height above the ground (jumping)
    this.vy = 0;
    this.landed = false;
  }

  get onGround() {
    return this.y <= 0 && this.vy <= 0;
  }

  get airborne() {
    return !this.onGround;
  }

  jump(speed = JUMP_SPEED) {
    if (!this.onGround) return false;
    this.vy = speed;
    this.y = 0.0001;
    return true;
  }

  get fatigueCap() {
    return this.stamina > 0.2 ? 1 : 0.6 + 0.4 * (this.stamina / 0.2);
  }

  // ctrl: { throttle 0..1, desiredHeading (radians) or null, steer -1..1 }
  step(dt, ctrl, mu) {
    const st = this.stats;
    // remember a safe state in case a bad number ever sneaks in
    const sx = this.x, sz = this.z, sh = this.h;
    const eT = Math.min(clamp(ctrl.throttle, 0, 1), this.fatigueCap);
    this.effort += (eT - this.effort) * Math.min(1, dt * (eT > this.effort ? 4 : 6));

    // ---- steering (yaw)
    if (ctrl.desiredHeading != null && !Number.isFinite(ctrl.desiredHeading)) ctrl.desiredHeading = this.h;
    this.landed = false;
    // ---- in the air: no push-off and no grip, just momentum and gravity
    if (this.airborne) {
      this.vy -= G * dt;
      this.y += this.vy * dt;
      this.yawRate *= 1 - Math.min(1, dt * 4);
      this.h = wrapAngle(this.h + this.yawRate * dt);
      const drag = 1 - 0.0025 * Math.hypot(this.vx, this.vz) * dt;
      this.vx *= drag;
      this.vz *= drag;
      this.x += this.vx * dt;
      this.z += this.vz * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.landed = true;
        this.vx *= 0.97; // a little speed is lost on landing
        this.vz *= 0.97;
      }
      this.speed = Math.hypot(this.vx, this.vz);
      this.vF = this.vx * Math.sin(this.h) + this.vz * Math.cos(this.h);
      this.accel = 0;
      this.latAcc = 0;
      this.slip = 0;
      return;
    }
    let fx = Math.sin(this.h), fz = Math.cos(this.h);
    const vF0 = this.vx * fx + this.vz * fz;
    const maxYaw = st.turnRate / (1 + Math.max(0, vF0) * 0.12);
    let yawCmd;
    if (ctrl.desiredHeading != null) {
      const err = wrapAngle(ctrl.desiredHeading - this.h);
      yawCmd = clamp(err * 7, -maxYaw, maxYaw);
    } else {
      yawCmd = -clamp(ctrl.steer || 0, -1, 1) * maxYaw;
    }
    this.yawRate += (yawCmd - this.yawRate) * Math.min(1, dt * 12);
    this.h = wrapAngle(this.h + this.yawRate * dt);

    fx = Math.sin(this.h);
    fz = Math.cos(this.h);
    const rx = -fz, rz = fx; // bird's right
    let vF = this.vx * fx + this.vz * fz;
    const vL = this.vx * rx + this.vz * rz;

    // ---- forward / backward
    const vTop = st.topSpeed * (0.82 + 0.18 * mu);
    const vT = vTop * this.effort;
    let aF;
    if (vF < vT) {
      aF = st.accel * mu * (1 - vF / Math.max(vT, 0.3));
      if (vF < 0.5 && vT > 0.5) aF = Math.max(aF, st.accel * mu * 0.85);
    } else {
      aF = -Math.min(4.5, (vF - vT) * 1.4 + 0.25);
      if (vF < 0.05 && vT < 0.05) aF = -vF / Math.max(dt, 1e-3);
    }
    aF -= 0.0025 * vF * vF; // air drag
    const aFmax = mu * G * 0.95;
    aF = clamp(aF, -aFmax, aFmax);

    // ---- sideways grip
    const latCap = st.grip * G * mu * (1 - 0.35 * Math.min(1, Math.abs(aF) / aFmax)) + 0.15;
    const aLneed = -vL / 0.06;
    const aL = clamp(aLneed, -latCap, latCap);
    this.slip = Math.abs(aLneed) > latCap ? (Math.abs(aLneed) - latCap) / latCap : 0;
    if (this.slip > 0) aF -= Math.min(2.5, this.slip * 0.8);

    this.vx += (fx * aF + rx * aL) * dt;
    this.vz += (fz * aF + rz * aL) * dt;
    // no running backwards
    vF = this.vx * fx + this.vz * fz;
    if (vF < 0) {
      this.vx -= fx * vF;
      this.vz -= fz * vF;
    }
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    const speed = Math.hypot(this.vx, this.vz);
    // ---- stamina
    const drain = (Math.pow(this.effort, 5) * clamp(speed / st.topSpeed, 0, 1.1)) / st.staminaCap;
    const rec = this.effort < 0.5 ? (st.recovery * (0.5 - this.effort)) / 0.5 : 0;
    this.stamina = clamp(this.stamina - drain * dt + rec * dt, 0, 1);

    if (!Number.isFinite(this.x + this.z + this.h + this.vx + this.vz + this.stamina + this.effort)) {
      BirdBody.badSteps = (BirdBody.badSteps || 0) + 1;
      BirdBody.lastBad = { ctrl: { ...ctrl }, mu, sx, sz, sh, effort: this.effort, stamina: this.stamina };
      this.x = sx; this.z = sz; this.h = Number.isFinite(sh) ? sh : 0;
      this.vx = 0; this.vz = 0; this.yawRate = 0; this.effort = 0;
      if (!Number.isFinite(this.stamina)) this.stamina = 0.5;
      this.speed = 0; this.accel = 0; this.latAcc = 0; this.vF = 0;
      return;
    }
    // ---- telemetry for animation / AI / HUD
    this.accel = aF;
    this.latAcc = aL;
    this.speed = speed;
    this.vF = vF;
  }

  // Keep the bird off a boundary. nx,nz = unit normal pointing back onto the track.
  pushOut(nx, nz, depth, penalty = 0.0) {
    this.x += nx * depth;
    this.z += nz * depth;
    const vn = this.vx * nx + this.vz * nz;
    if (vn < 0) {
      this.vx -= nx * vn * 1.2;
      this.vz -= nz * vn * 1.2;
    }
    this.vx *= 1 - penalty;
    this.vz *= 1 - penalty;
  }
}

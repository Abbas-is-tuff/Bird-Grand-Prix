// Camera system: chase, TV side, bird level, trackside, finish line and an automatic
// cinematic director. Switching cameras glides smoothly between views.
import * as THREE from 'three';
import { clamp, damp, dampAngle, pick } from '../core/utils.js';
import { T, pointAt, laneCenter } from '../world/track.js';

export const CAMERA_MODES = [
  { id: 'chase', name: 'Chase' },
  { id: 'side', name: 'TV Side' },
  { id: 'bird', name: 'Bird Level' },
  { id: 'trackside', name: 'Trackside' },
  { id: 'finish', name: 'Finish Line' },
  { id: 'cinematic', name: 'Cinematic' },
];

const _v = new THREE.Vector3();

export class CameraDirector {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.pos = new THREE.Vector3(0, 20, 80);
    this.look = new THREE.Vector3();
    this.fov = 55;
    this.blend = 0;
    this.hS = 0;
    this.time = 0;
    this.cine = { shot: 'side', t: 0, angle: 0 };
    this.tsIndex = -1;
    this.trackCams = [];
    const tmp = {};
    for (let s = 0; s < 400; s += 21) {
      pointAt(s, 0.3, T.WALL + 1.3, tmp);
      this.trackCams.push(new THREE.Vector3(tmp.x, 1.5, tmp.z));
    }
    this.trackCams.push(new THREE.Vector3(-T.L / 2 - 12, 1.5, T.R + T.WALL + 1.3));
    this.special = null;
    this.desiredPos = new THREE.Vector3();
    this.desiredLook = new THREE.Vector3();
    this.shift = 0;
    this.shiftTarget = 0;
  }

  setMode(id) {
    if (id === this.mode) return;
    this.mode = id;
    this.blend = 1;
    this.tsIndex = -1;
  }

  cycle() {
    const i = CAMERA_MODES.findIndex((m) => m.id === this.mode);
    this.setMode(CAMERA_MODES[(i + 1) % CAMERA_MODES.length].id);
    return CAMERA_MODES.find((m) => m.id === this.mode).name;
  }

  get modeName() {
    return CAMERA_MODES.find((m) => m.id === this.mode).name;
  }

  snap() {
    this.camera.position.copy(this.desiredPos);
    this.look.copy(this.desiredLook);
    this.pos.copy(this.desiredPos);
    this.blend = 0;
  }

  // ctx: { focus: {x,z,h,speed,size}, special: null|'menu'|'intro'|'celebrate', group: [{x,z}] }
  update(dt, ctx) {
    this.time += dt;
    const f = ctx.focus;
    const sz = f.size || 1;
    const P = _v.set(f.x, 0, f.z);
    const velH = f.speed > 1 ? Math.atan2(f.vx, f.vz) : f.h;
    this.hS = dampAngle(this.hS, velH, 5, dt);
    const fx = Math.sin(this.hS), fz = Math.cos(this.hS);
    const lx = Math.cos(this.hS), lz = -Math.sin(this.hS); // left
    const aspect = this.camera.aspect;
    const portrait = aspect < 1;
    const dp = this.desiredPos, dl = this.desiredLook;
    let fov = 55;
    let lambda = 8;
    let mode = this.mode;
    if (ctx.special) mode = ctx.special;
    if (mode === 'cinematic') mode = this.cinematicShot(dt, f);
    const far = portrait ? 1.35 : 1;

    switch (mode) {
      case 'menu': {
        const mf = this.menuFront;
        const a = mf ? Math.atan2(mf.z, mf.x) - 0.5 + 0.55 * Math.sin(this.time * 0.35) : this.time * 0.22;
        const zoom = this.menuZoom || 1;
        const r = (3.0 + sz * 0.6) * far * zoom;
        dp.set(P.x + Math.cos(a) * r, (0.75 + 0.55 * sz) * (0.5 + 0.5 * zoom), P.z + Math.sin(a) * r);
        dl.set(P.x, 0.5 * sz, P.z);
        fov = portrait ? 62 : 42;
        lambda = 3;
        break;
      }
      case 'intro': {
        const g = ctx.group || [f];
        let cx = 0, cz = 0;
        for (const p of g) { cx += p.x; cz += p.z; }
        cx /= g.length; cz /= g.length;
        const t = clamp((ctx.phaseTime || 0) / 5.5, 0, 1);
        const a = -1.2 + t * 1.6 + Math.atan2(fx, fz);
        const r = (16 - 9 * t) * far;
        dp.set(cx + Math.sin(a) * r, 7 - 5 * t, cz + Math.cos(a) * r);
        dl.set(cx, 0.6, cz);
        fov = 48;
        lambda = 2.5;
        break;
      }
      case 'celebrate':
      case 'orbit': {
        this.cine.angle += dt * 0.35;
        const a = this.cine.angle;
        const r = 4.2 * far;
        dp.set(P.x + Math.cos(a) * r, 1.4, P.z + Math.sin(a) * r);
        dl.set(P.x, 0.6 * sz, P.z);
        fov = 45;
        lambda = 3;
        break;
      }
      case 'chase': {
        const back = (2.6 * sz + 1.2) * far;
        dp.set(P.x - fx * back, 1.15 * sz + 0.75, P.z - fz * back);
        dl.set(P.x + fx * 2.5, 0.55 * sz, P.z + fz * 2.5);
        fov = 58 + clamp(f.speed - 6, 0, 4) * 1.5;
        lambda = 10;
        break;
      }
      case 'side': {
        const off = 5.5 * far;
        dp.set(P.x + lx * off + fx * 1.2, 1.5, P.z + lz * off + fz * 1.2);
        dl.set(P.x + fx * 0.8, 0.5 * sz, P.z + fz * 0.8);
        fov = 42;
        lambda = 7;
        break;
      }
      case 'bird': {
        const rx = -lx, rz = -lz;
        dp.set(P.x - fx * 1.25 * sz + rx * 0.4 * sz, 0.42 * sz + 0.1, P.z - fz * 1.25 * sz + rz * 0.4 * sz);
        dl.set(P.x + fx * 4, 0.4 * sz, P.z + fz * 4);
        fov = 72;
        lambda = 16;
        break;
      }
      case 'high': {
        dp.set(P.x + lx * 13 - fx * 7, 11, P.z + lz * 13 - fz * 7);
        dl.set(P.x + fx * 3, 0.3, P.z + fz * 3);
        fov = 45;
        lambda = 4;
        break;
      }
      case 'trackside': {
        let cam = this.trackCams[this.tsIndex];
        const lost = !cam || (cam.x - P.x) * fx + (cam.z - P.z) * fz < -5 || cam.distanceTo(P) > 60;
        if (lost) {
          let best = 0, bestD = 1e9;
          this.trackCams.forEach((c, i) => {
            const ahead = (c.x - P.x) * fx + (c.z - P.z) * fz;
            const d = c.distanceTo(P);
            if (ahead > 2 && d < bestD) { bestD = d; best = i; }
          });
          const cut = this.tsIndex >= 0 && this.blend <= 0;
          this.tsIndex = best;
          cam = this.trackCams[best];
          if (cut) {
            // a TV-style cut to the next trackside camera
            this.pos.copy(cam);
            this.look.set(P.x, 0.5 * sz, P.z);
          }
        }
        dp.copy(cam);
        dl.set(P.x, 0.5 * sz, P.z);
        const dist = cam.distanceTo(P);
        fov = clamp((2 * Math.atan(2.6 / Math.max(dist, 0.1)) * 180) / Math.PI, 10, 65);
        lambda = 40;
        break;
      }
      case 'finish': {
        const onHome = f.z > 0 && f.x < T.FINISH_X + 3;
        if (onHome) {
          dp.set(T.FINISH_X + 15, 2.2, T.R + laneCenter(4) + 0.6);
        } else {
          dp.set(T.FINISH_X - 2, 7.5, T.R + T.WALL + 9);
        }
        dl.set(P.x, 0.5 * sz, P.z);
        const dist = dp.distanceTo(P);
        fov = clamp((2 * Math.atan(3.2 / Math.max(dist, 0.1)) * 180) / Math.PI, 8, 60);
        lambda = 40;
        break;
      }
      default:
        break;
    }
    if (portrait) fov = Math.min(80, fov * 1.25);

    if (this.cutNext) {
      // jump straight to the new shot (used when a race starts)
      this.cutNext = false;
      this.blend = 0;
      this.pos.copy(dp);
      this.look.copy(dl);
      this.fov = fov;
    }
    if (this.blend > 0) {
      this.blend = Math.max(0, this.blend - dt / 0.9);
      lambda = Math.min(lambda, 3.5);
    }
    this.pos.x = damp(this.pos.x, dp.x, lambda, dt);
    this.pos.y = damp(this.pos.y, dp.y, lambda, dt);
    this.pos.z = damp(this.pos.z, dp.z, lambda, dt);
    if (this.pos.y < 0.15) this.pos.y = 0.15;
    const ll = Math.max(lambda, 6);
    this.look.x = damp(this.look.x, dl.x, ll * 1.4, dt);
    this.look.y = damp(this.look.y, dl.y, ll * 1.4, dt);
    this.look.z = damp(this.look.z, dl.z, ll * 1.4, dt);
    this.fov = damp(this.fov, fov, this.blend > 0 ? 3 : 8, dt);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    // shift the picture sideways so menus don't cover the bird
    this.shift = damp(this.shift, this.shiftTarget, 4, dt);
    const W = window.innerWidth, H = window.innerHeight;
    if (Math.abs(this.shift) > 0.002) this.camera.setViewOffset(W, H, this.shift * W, 0, W, H);
    else if (this.camera.view && this.camera.view.enabled) this.camera.clearViewOffset();
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.activeShot = mode;
  }

  cinematicShot(dt, f) {
    this.cine.t -= dt;
    if (this.cine.t <= 0) {
      const options = ['side', 'chase', 'trackside', 'high', 'orbit', 'bird', 'finish'].filter((s) => s !== this.cine.shot);
      let shot = pick(options);
      if (shot === 'finish' && !(f.z > 0 && f.x > -10)) shot = 'side';
      this.cine.shot = shot;
      this.cine.t = 3.5 + Math.random() * 2.5;
      this.blend = 0.7;
      this.tsIndex = -1;
    }
    return this.cine.shot;
  }
}

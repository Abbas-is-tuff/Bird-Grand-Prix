// Procedural running animation.
// - Feet are PLANTED in the world while on the ground (they never slide), then swing to a
//   predicted landing spot. The gait speeds up and lengthens with running speed.
// - Legs use two-bone inverse kinematics (knee -> ankle -> toes) to reach the feet.
// - Body bobs and leans into bends; the head is stabilised (pigeons do their real head-bob).
// - Wing, tail and crest feathers move individually with springs and wind flutter.
import * as THREE from 'three';
import { clamp, lerp, smoothstep, damp, Spring, wrapAngle, rand } from '../core/utils.js';

const G = 9.81;
const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

// temporaries
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4();
const _s = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _p = new THREE.Vector3();

// Places a unit cylinder (base at origin, length 1 along +Y) between a and b.
function segmentMatrix(out, a, b, radius) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-4;
  _d.divideScalar(len);
  _q.setFromUnitVectors(UP, _d);
  _s.set(radius, len, radius);
  return out.compose(a, _q, _s);
}

export class BirdAnimator {
  constructor(model) {
    this.m = model;
    this.time = rand(0, 10);
    this.phase = 0;
    this.feet = [0, 1].map(() => ({
      planted: true, plant: new THREE.Vector3(), lift: new THREE.Vector3(), pos: new THREE.Vector3(),
      yaw: 0, liftYaw: 0, curl: 0,
    }));
    this.crouch = 0;
    this.runF = 0;
    this.headPos = new THREE.Vector3();
    this.headInit = false;
    this.lookYaw = 0;
    this.lookTarget = 0;
    this.lookTimer = 1;
    this.blinkTimer = rand(1, 4);
    this.blink = 0;
    this.wingOpen = new Spring(90, 14);
    this.flap = 0;
    this.tailPitch = new Spring(160, 11);
    this.tailSpread = new Spring(80, 12);
    this.crest = new Spring(140, 7);
    this.leanX = 0;
    this.roll = 0;
    this.hop = 0;
    this.stumble = 0;
    this.beakOpen = 0;
    this.prevBob = 0;
    this.onStep = null; // callback(footIndex, strength)
    this.mode = 'idle';
    this.matrices = new Array(model.feathers.length).fill(null).map(() => new THREE.Matrix4());
  }

  // Put both feet in a natural standing pose (used at race start).
  reset(x, z, h) {
    const m = this.m;
    const S = m.S;
    const lx = Math.cos(h), lz = -Math.sin(h);
    this.feet.forEach((f, i) => {
      const side = i === 0 ? 1 : -1;
      const w = m.legs.width * S * side;
      f.plant.set(x + lx * w, 0, z + lz * w);
      f.pos.copy(f.plant);
      f.planted = true;
      f.yaw = h;
    });
    this.phase = 0.05;
    this.headInit = false;
    this.runF = 0;
    this.prevX = x;
    this.prevZ = z;
    this.prevH = h;
  }

  triggerStumble(amount = 1) {
    this.stumble = Math.max(this.stumble, amount);
    this.wingOpen.kick(3 * amount);
  }

  // Advances the gait phase and moves/plants the two feet (world space). Returns step rate.
  stepFeet(dt, st, v, fBase, beta, strideLen, swingH, legW) {
    const m = this.m;
    const S = m.S;
    const lg = m.legs;
    let f = fBase;
    const lx = Math.cos(st.h), lz = -Math.sin(st.h); // bird's left in world
    let needStep = false, anySwing = false;
    for (let i = 0; i < 2; i++) {
      const ft = this.feet[i];
      const w = lg.width * S * (i === 0 ? 1 : -1);
      const dx = ft.plant.x - (st.x + lx * w), dz = ft.plant.z - (st.z + lz * w);
      const d2 = dx * dx + dz * dz;
      if (!ft.planted) anySwing = true;
      else if (d2 > (0.22 * legW) ** 2) needStep = true;
      // safety: a planted foot left far behind is re-placed under the body
      if (ft.planted && d2 > (1.9 * legW) ** 2) {
        ft.plant.set(st.x + lx * w, 0, st.z + lz * w);
        ft.pos.copy(ft.plant);
      }
    }
    if (f < 1.8 && (anySwing || needStep)) f = Math.max(f, 1.8);
    this.phase = (this.phase + f * dt) % 1;
    for (let i = 0; i < 2; i++) {
      const ft = this.feet[i];
      const side = i === 0 ? 1 : -1;
      const p = (this.phase + (i ? 0.5 : 0)) % 1;
      if (p < beta) {
        if (!ft.planted) {
          ft.planted = true;
          ft.plant.set(ft.pos.x, 0, ft.pos.z);
          if (this.onStep) this.onStep(i, clamp(v / 8, 0.15, 1));
        }
        ft.pos.copy(ft.plant);
        ft.curl = damp(ft.curl, 0, 30, dt);
      } else {
        if (ft.planted) {
          ft.planted = false;
          ft.lift.copy(ft.plant);
          ft.liftYaw = ft.yaw;
        }
        const s = (p - beta) / (1 - beta);
        const tLand = f > 0 ? ((1 - s) * (1 - beta)) / f : 0;
        const hP = st.h + st.yawRate * tLand;
        const fx = Math.sin(hP), fz = Math.cos(hP);
        const plx = Math.cos(hP), plz = -Math.sin(hP);
        const fwdOff = beta * strideLen * 0.46 * smoothstep(0.15, 1.2, v);
        const w = lg.width * S * side;
        const landX = st.x + st.vx * tLand + fx * fwdOff + plx * w;
        const landZ = st.z + st.vz * tLand + fz * fwdOff + plz * w;
        const e = s * s * (3 - 2 * s);
        ft.pos.x = lerp(ft.lift.x, landX, e);
        ft.pos.z = lerp(ft.lift.z, landZ, e);
        ft.pos.y = swingH * S * Math.pow(Math.sin(Math.PI * s), 0.8);
        ft.yaw = ft.liftYaw + wrapAngle(hP - ft.liftYaw) * e;
        ft.curl = Math.sin(Math.PI * Math.min(1, s * 1.2));
      }
    }
    return f;
  }

  // st: { x, z, h, vx, vz, speed, accel, latAcc, yawRate, slip }
  update(dt, st, mode = 'run') {
    const m = this.m;
    const S = m.S;
    const lg = m.legs;
    const gait = m.species.gait;
    this.mode = mode;
    this.time += dt;
    const v = st.speed;
    const legLen = lg.l1 + lg.l2;
    const legW = legLen * S;
    this.runF = damp(this.runF, clamp(v / 8.5, 0, 1), 6, dt);
    const runF = this.runF;

    m.root.position.set(st.x, 0, st.z);
    m.root.rotation.y = st.h;

    // ------------------------------------------------------------- gait timing
    const strideLen = Math.min(legW * (1.2 + 0.55 * v), legW * 5.2) * gait.stride;
    const beta = lerp(0.6, 0.25, smoothstep(0.5, 6, v));
    const fBase = v > 0.12 ? v / strideLen : 0;
    let f = fBase;
    // Feet are stepped in small sub-steps so they stay planted correctly even at low frame rates.
    const prevX = this.prevX ?? st.x, prevZ = this.prevZ ?? st.z, prevH = this.prevH ?? st.h;
    const subs = Math.min(12, Math.max(1, Math.ceil((Math.max(f, 1.8) * dt) / 0.04)));
    const swingH = legLen * (0.1 + 0.12 * runF) * (gait.bounce > 1.2 ? 1.25 : 1);
    const sub = { x: 0, z: 0, h: 0, vx: st.vx, vz: st.vz, yawRate: st.yawRate };
    for (let k = 1; k <= subs; k++) {
      const a = k / subs;
      sub.x = lerp(prevX, st.x, a);
      sub.z = lerp(prevZ, st.z, a);
      sub.h = prevH + wrapAngle(st.h - prevH) * a;
      f = this.stepFeet(dt / subs, sub, v, fBase, beta, strideLen, swingH, legW);
    }
    this.prevX = st.x;
    this.prevZ = st.z;
    this.prevH = st.h;

    // ------------------------------------------------------------- body
    const crouchT = mode === 'marks' || mode === 'set' ? 1 : 0;
    this.crouch = damp(this.crouch, crouchT, 5, dt);
    const moving = smoothstep(0.1, 0.6, v);
    const bobAmp = legLen * (0.02 + 0.055 * runF) * gait.bounce * moving;
    const cyc = this.phase - beta / 2;
    const bob = -bobAmp * Math.cos(TAU * 2 * cyc);
    const waddle = gait.waddle * (1 - 0.55 * runF) * moving;
    const sway = Math.cos(TAU * cyc);

    // celebration hops / tired
    if (mode === 'celebrate' && v < 1.2) this.hop = Math.abs(Math.sin(this.time * TAU * 1.5)) * 0.1;
    else this.hop = damp(this.hop, 0, 10, dt);
    this.stumble = Math.max(0, this.stumble - dt * 2.5);

    const leanT = 0.2 * runF + clamp(st.accel, -6, 8) * 0.022 + this.crouch * 0.38 + (mode === 'tired' ? 0.12 : 0);
    this.leanX = damp(this.leanX, leanT, 6, dt);
    const rollT = clamp(st.latAcc / G, -0.6, 0.6) * 0.9 - waddle * sway + Math.sin(this.time * 31) * this.stumble * 0.2;
    this.roll = damp(this.roll, rollT, 10, dt);

    const bp = m.bodyPivot;
    bp.position.set(lg.width * 0.35 * waddle * sway * 4, m.rest.hipY * (1 - 0.1 * runF - 0.17 * this.crouch) + bob + this.hop, 0);
    bp.rotation.set(this.leanX, 0, this.roll);
    bp.updateMatrix();
    // body frame in root space
    _m.multiplyMatrices(bp.matrix, m.bodyFrame.matrix);
    const bodyRoot = _m;

    // ------------------------------------------------------------- legs (IK)
    const lm = m.legMesh;
    const invS = 1 / S;
    const cosH = Math.cos(st.h), sinH = Math.sin(st.h);
    const toLocal = (wx, wy, wz, out) => {
      const dx = wx - st.x, dz = wz - st.z;
      // inverse yaw rotation
      out.set((dx * cosH - dz * sinH) * invS, wy * invS - this.hop, (dx * sinH + dz * cosH) * invS);
      return out;
    };
    for (let i = 0; i < 2; i++) {
      const ft = this.feet[i];
      const o = i * lg.perLeg;
      const K = _a.copy(m.legs.hips[i]).add(lg.kneeOff).applyMatrix4(bp.matrix);
      const Tt = toLocal(ft.pos.x, ft.pos.y, ft.pos.z, _b);
      Tt.y += lg.toeH;
      // two-bone IK
      _c.subVectors(Tt, K);
      let dist = _c.length();
      const maxR = (lg.l1 + lg.l2) * 0.995;
      const minR = Math.abs(lg.l1 - lg.l2) + 0.01;
      if (dist > maxR) {
        Tt.copy(K).addScaledVector(_c.normalize(), maxR);
        dist = maxR;
      } else if (dist < minR) {
        dist = minR;
      }
      const dir = _c.subVectors(Tt, K).normalize();
      const cosA = clamp((lg.l1 * lg.l1 + dist * dist - lg.l2 * lg.l2) / (2 * lg.l1 * dist), -1, 1);
      const sinA = Math.sqrt(1 - cosA * cosA);
      // bend backwards (bird "knee" that looks backwards is really the ankle)
      _e.set(0, 0, -1); // pole: backwards
      _e.addScaledVector(dir, -_e.dot(dir)).normalize();
      const J = _d.copy(K).addScaledVector(dir, lg.l1 * cosA).addScaledVector(_e, lg.l1 * sinA);
      const Jc = _p.copy(J);
      segmentMatrix(_m2, K, Jc, 0.034 * lg.thick);
      lm.setMatrixAt(o, _m2);
      segmentMatrix(_m2, Jc, Tt, 0.016 * lg.thick);
      lm.setMatrixAt(o + 1, _m2);
      // leg band (left leg only shows colour; right gets leg colour)
      _c.copy(Jc).lerp(Tt, 0.55);
      _e.copy(Jc).lerp(Tt, 0.7);
      segmentMatrix(_m2, _c, _e, 0.022 * lg.thick);
      lm.setMatrixAt(o + 2, _m2);
      // toes
      const yawRel = wrapAngle(ft.yaw - st.h);
      const nT = lg.toeAngles.length;
      for (let t = 0; t < nT; t++) {
        const ta = lg.toeAngles[t];
        const ang = yawRel + ta.a * (i === 0 ? 1 : -1);
        const back = Math.abs(ta.a) > Math.PI / 2;
        const tl = lg.toeLen * ta.len;
        const droop = ft.curl * (back ? -0.5 : 0.9) + (back ? 0.15 : 0.02);
        const dx = Math.sin(ang) * Math.cos(droop), dz = Math.cos(ang) * Math.cos(droop);
        const dy = -Math.sin(droop);
        _c.set(Tt.x, Tt.y - lg.toeH * 0.6, Tt.z);
        _e.set(_c.x + dx * tl * 0.8, Math.max(lg.toeH * 0.4, _c.y + dy * tl * 0.8), _c.z + dz * tl * 0.8);
        segmentMatrix(_m2, _c, _e, 0.011 * lg.thick);
        lm.setMatrixAt(o + 3 + t, _m2);
        _c.copy(_e);
        _e.set(_c.x + dx * tl * 0.28, Math.max(0.002, _c.y + dy * tl * 0.28 - 0.006), _c.z + dz * tl * 0.28);
        segmentMatrix(_m2, _c, _e, 0.006 * lg.thick);
        lm.setMatrixAt(o + 3 + nT + t, _m2);
      }
    }
    lm.instanceMatrix.needsUpdate = true;

    // ------------------------------------------------------------- head & neck
    const neckBase = _a.copy(m.neckBaseLocal).applyMatrix4(bodyRoot);
    const target = _b.copy(neckBase).add(m.rest.headOffset);
    target.z += 0.04 * runF + this.crouch * 0.05;
    target.y -= 0.03 * runF + this.crouch * 0.05;
    target.y -= bob * 0.8; // stabilise against body bounce
    if (gait.headBob && v > 0.1) {
      const q = (2 * this.phase) % 1;
      const amp = Math.min(0.06, (v * (0.55 / (2 * Math.max(f, 0.1)))) / 2 / S) * (1 - 0.7 * runF);
      target.z += q < 0.55 ? amp - 2 * amp * (q / 0.55) : -amp + 2 * amp * smoothstep(0.55, 1, q);
    }
    if (!this.headInit) {
      this.headPos.copy(target);
      this.headInit = true;
    } else {
      this.headPos.x = damp(this.headPos.x, target.x, 30, dt);
      this.headPos.y = damp(this.headPos.y, target.y, 22, dt);
      this.headPos.z = gait.headBob ? target.z : damp(this.headPos.z, target.z, 30, dt);
    }
    // look around when idle
    this.lookTimer -= dt;
    if (this.lookTimer <= 0) {
      this.lookTimer = rand(0.8, 2.6);
      this.lookTarget = mode === 'idle' || mode === 'marks' || mode === 'tired' || mode === 'celebrate' ? rand(-0.8, 0.8) : rand(-0.12, 0.12);
    }
    this.lookYaw = damp(this.lookYaw, this.lookTarget + clamp(st.yawRate * 0.25, -0.4, 0.4), 6, dt);
    const head = m.head;
    head.position.copy(this.headPos);
    head.rotation.order = 'YXZ';
    head.rotation.set(-this.leanX * 0.45 + (mode === 'tired' ? 0.25 : 0) + this.crouch * 0.15, this.lookYaw, -this.roll * 0.5);
    head.updateMatrix();
    // neck stretches between body and head
    _c.copy(this.headPos).add(_e.set(0, -m.shape.headR * 0.35, -m.shape.headR * 0.25));
    const neck = m.neck;
    _d.subVectors(_c, neckBase);
    const nlen = _d.length();
    neck.position.copy(neckBase).addScaledVector(_d, 0.5);
    neck.quaternion.setFromUnitVectors(UP, _d.normalize());
    const nr = m.shape.headR * 0.72;
    neck.scale.set(nr, nlen * 0.5 + nr * 0.4, nr * 1.02);

    // blink
    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blink = 0.14;
      this.blinkTimer = rand(1.5, 5);
    }
    this.blink = Math.max(0, this.blink - dt);
    const eyeY = this.blink > 0 ? 0.15 : 1;
    for (const e of m.eyes) e.scale.set(1, eyeY, 1);

    // beak: panting when tired, chirps when celebrating
    let beakT = 0;
    if (mode === 'tired') beakT = 0.18 + 0.12 * Math.sin(this.time * 14);
    else if (mode === 'celebrate') beakT = Math.max(0, Math.sin(this.time * 9)) * 0.35;
    else if (runF > 0.8) beakT = 0.08;
    this.beakOpen = damp(this.beakOpen, beakT, 18, dt);
    m.beakLPivot.rotation.x = this.beakOpen;

    // ------------------------------------------------------------- feathers
    let openT = 0.03 * runF + clamp(Math.abs(st.latAcc) / 5, 0, 0.22) + clamp(st.slip || 0, 0, 1) * 0.3;
    if (st.accel < -2.5) openT += 0.12;
    if (mode === 'celebrate') openT = 1;
    if (mode === 'tired') openT = 0.07;
    openT += this.stumble * 0.5;
    const open = clamp(this.wingOpen.update(openT, dt), 0, 1);
    if (mode === 'celebrate') this.flap += dt * TAU * 4.2;
    const flapAmt = mode === 'celebrate' ? 0.55 + 0.6 * Math.sin(this.flap) : Math.sin(this.time * 24) * this.stumble * 0.5;

    // tail: lags behind body motion and fans when braking
    const bobVel = (bob - this.prevBob) / Math.max(dt, 1e-3);
    this.prevBob = bob;
    const tailT = m.shape.tail.droop + clamp(-bobVel * 0.25, -0.15, 0.15) + (st.accel < -2 ? 0.15 : 0) - this.crouch * 0.2 + (mode === 'celebrate' ? -0.15 : 0);
    const tailPitch = this.tailPitch.update(tailT, dt);
    const spread = this.tailSpread.update((st.accel < -2.5 ? 0.6 : 0) + (mode === 'celebrate' ? 0.8 : 0) + this.stumble * 0.5, dt);

    // crest: flattens with speed, bounces with head motion
    const crestT = runF * 0.55 - this.crouch * 0.1 + (mode === 'celebrate' ? -0.2 : 0);
    if (Math.abs(bobVel) > 0.01) this.crest.v += -bobVel * dt * 18;
    const crestLean = this.crest.update(crestT, dt);

    const fm = m.featherMesh;
    const feathers = m.feathers;
    const headMat = head.matrix;
    for (let i = 0; i < feathers.length; i++) {
      const fe = feathers[i];
      const out = this.matrices[i];
      const fl = Math.sin(this.time * 28 + fe.flutterPhase) * fe.flutter * (0.02 + 0.05 * runF);
      if (fe.group === 'wingL' || fe.group === 'wingR') {
        _p.copy(fe.pf).lerp(fe.po, open);
        _q.copy(fe.qf).slerp(fe.qo, open);
        _q2.setFromAxisAngle(AX, fl);
        _q.multiply(_q2);
        if (flapAmt !== 0) {
          _q3.setFromAxisAngle(AZ, fe.side * flapAmt);
          _p.sub(fe.shoulder).applyQuaternion(_q3).add(fe.shoulder);
          _q.premultiply(_q3);
        }
        _s2.copy(fe.scale).lerp(fe.scaleO, open);
        _m2.compose(_p, _q, _s2);
        out.multiplyMatrices(bodyRoot, _m2);
      } else if (fe.group === 'tail') {
        const phi = fe.u * m.tailFan * (1 + spread);
        _q.setFromAxisAngle(AX, -tailPitch);
        _q2.setFromAxisAngle(AY, phi);
        _q.multiply(_q2);
        _q2.setFromAxisAngle(AX, fl * 0.5);
        _q.multiply(_q2);
        _p.copy(fe.base);
        _m2.compose(_p, _q, fe.scale);
        out.multiplyMatrices(bodyRoot, _m2);
      } else {
        // crest
        _q.setFromAxisAngle(AX, -crestLean * (0.8 + 0.2 * Math.abs(fe.u)) + fl);
        _q.multiply(fe.qBase);
        _m2.compose(fe.pf, _q, fe.scale);
        out.multiplyMatrices(headMat, _m2);
      }
      fm.setMatrixAt(i, out);
    }
    fm.instanceMatrix.needsUpdate = true;

    // contact shadow follows body
    m.blob.position.set(0, 0.004 - this.hop, 0.02);
  }
}

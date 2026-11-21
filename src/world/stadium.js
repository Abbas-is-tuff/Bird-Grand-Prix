// Venue dressing: stands, bird crowd, roofs, lights, scoreboards, finish gantry, walls/fences,
// and the scenery around each venue (trees, city, hills, dunes, palms, farm, tents, arena building…).
// What gets built depends on the venue settings in data/venues.js.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T, pointAt } from './track.js';
import { adTexture, concreteTexture, groundTexture, windowsTexture, SPONSORS } from './textures.js';
import { mulberry32, formatTime } from '../core/utils.js';
import { LOGO_PNG } from '../ui/logoImage.js';

export const crowdUniforms = { uTime: { value: 0 }, uExcite: { value: 0.2 } };

function crowdify(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = crowdUniforms.uTime;
    sh.uniforms.uExcite = crowdUniforms.uExcite;
    sh.vertexShader = 'uniform float uTime;\nuniform float uExcite;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float ph = float(gl_InstanceID) * 1.618;
      float sp = 2.2 + fract(ph) * 3.4;
      float jump = max(0.0, sin(uTime * sp + ph * 6.2831));
      transformed.y += jump * jump * (0.012 + uExcite * 0.2);
      transformed.x += sin(uTime * 1.3 + ph) * 0.015;`,
    );
  };
  mat.customProgramCacheKey = () => 'bgp-crowd';
  return mat;
}

const CROWD_COLORS = ['#5fae3e', '#f6d21a', '#5fa7e0', '#a9adb3', '#f6f0de', '#f28c28', '#8a8d91', '#7dc242', '#3c4fb8', '#e8e8e4', '#c8202a', '#9a9a97'];
const OVAL_LAP = () => 2 * T.L + 2 * Math.PI * T.R;
const UP = new THREE.Vector3(0, 1, 0);

// A strip that follows the oval between offsets d0 (height y0) and d1 (height y1), for stations s0..s1.
function ovalStrip(d0, y0, d1, y1, s0 = 0, s1 = OVAL_LAP(), steps = 160) {
  const pos = [], idx = [], uv = [];
  const a = {}, b = {};
  for (let i = 0; i <= steps; i++) {
    const s = s0 + ((s1 - s0) * i) / steps;
    pointAt(s, 0, d0, a);
    pointAt(s, 0, d1, b);
    pos.push(a.x, y0, a.z, b.x, y1, b.z);
    uv.push(s * 0.1, 0, s * 0.1, 1);
    if (i > 0) {
      const o = i * 2;
      idx.push(o - 2, o - 1, o, o - 1, o + 1, o);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Stadium {
  constructor(scene, quality, venue) {
    this.scene = scene;
    this.venue = venue;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rng = mulberry32(2026 + venue.id.length * 31);
    this.quality = quality;
    this.lampMats = [];
    this.spin = []; // things that turn (windmill)
    this.flags = null;
    this.logo = new Image();
    this.logo.onload = () => {
      if (this.lastBoard) this.drawBoard(this.lastBoard);
      if (this.drawSign) this.drawSign();
    };
    this.logo.src = LOGO_PNG;
    this.tierGeos = [];
    this.seats = []; // {x,y,z,ry,block}
    this.standing = []; // crowd spots without seats
    this.mats = {
      concrete: new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0xb8b8b2, roughness: 0.92 }),
      sandstone: new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0xe2c08e, roughness: 0.95 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.45, metalness: 0.6 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a2d38, roughness: 0.8 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.9 }),
    };
    this.outer = { d: T.WALL + 4.6, top: 3 }; // how far out / high the stands reach
    this.buildGround();
    this.buildWall();
    this.buildStands();
    this.buildBanks();
    this.buildCrowd();
    this.buildRoof();
    this.buildLights();
    this.buildBoards();
    this.buildGantry();
    this.buildFlags();
    this.buildScenery();
  }

  // ------------------------------------------------------------------ ground & walls
  buildGround() {
    const g = new THREE.CircleGeometry(1100, 64);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: groundTexture(this.venue.ground), roughness: 1 }));
    m.position.y = -0.03;
    m.receiveShadow = true;
    this.group.add(m);
  }

  wallSegments(d, height, thick, skipChute = true) {
    const geos = [];
    const steps = 220;
    const lap = OVAL_LAP();
    const a = {}, b = {};
    const hL = T.L / 2;
    for (let i = 0; i < steps; i++) {
      pointAt((lap * i) / steps, 0, d, a);
      pointAt((lap * (i + 1)) / steps, 0, d, b);
      const midx = (a.x + b.x) / 2, midz = (a.z + b.z) / 2;
      if (skipChute && midx < -hL && midz > T.R - 2) continue;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const box = new THREE.BoxGeometry(len + 0.05, height, thick);
      box.rotateY(Math.atan2(-(b.z - a.z), b.x - a.x));
      box.translate(midx, height / 2, midz);
      geos.push(box);
    }
    const ce2 = new THREE.BoxGeometry(T.CHUTE + 0.2, height, thick);
    ce2.translate(-hL - T.CHUTE / 2, height / 2, T.R + d);
    geos.push(ce2);
    return geos;
  }

  buildWall() {
    const v = this.venue;
    const hL = T.L / 2;
    const d = T.WALL + 0.12;
    if (v.wall === 'ads' || v.wall === 'stone') {
      const mat = v.wall === 'stone' ? this.mats.sandstone : new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.7 });
      const wall = new THREE.Mesh(mergeGeometries(this.wallSegments(d, 0.8, 0.15)), mat);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.group.add(wall);
      const boardGeo = new THREE.PlaneGeometry(5.6, 0.62);
      let k = v.id.length;
      for (let x = -hL - 16; x < hL + 2; x += 6) {
        const b = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ map: adTexture(k++), roughness: 0.6 }));
        b.position.set(x + 3, 0.42, T.R + T.WALL + 0.03);
        b.rotation.y = Math.PI;
        this.group.add(b);
      }
      for (let x = -hL + 1; x < hL; x += 6) {
        const b = new THREE.Mesh(boardGeo, new THREE.MeshStandardMaterial({ map: adTexture(k++), roughness: 0.6 }));
        b.position.set(x + 3, 0.42, -(T.R + T.WALL + 0.03));
        this.group.add(b);
      }
    } else {
      // rail (white, grass field) or fence (wooden, countryside)
      const wood = v.wall === 'fence';
      const mat = wood ? this.mats.wood : new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5 });
      const rails = [...this.wallSegments(d, 0.07, 0.07)].map((g) => g.translate(0, wood ? 0.32 : 0.62, 0));
      if (wood) rails.push(...this.wallSegments(d, 0.07, 0.07).map((g) => g.translate(0, 0.72, 0)));
      const railMesh = new THREE.Mesh(mergeGeometries(rails), mat);
      railMesh.castShadow = true;
      this.group.add(railMesh);
      // posts
      const lap = OVAL_LAP();
      const n = Math.floor(lap / 2.5);
      const postGeo = new THREE.BoxGeometry(wood ? 0.12 : 0.06, wood ? 0.95 : 0.7, wood ? 0.12 : 0.06);
      postGeo.translate(0, wood ? 0.47 : 0.35, 0);
      const posts = new THREE.InstancedMesh(postGeo, mat, n);
      const m = new THREE.Matrix4();
      const p = {};
      let c = 0;
      for (let i = 0; i < n; i++) {
        pointAt((lap * i) / n, 0, d, p);
        if (p.x < -hL && p.z > T.R - 2) continue;
        m.makeTranslation(p.x, 0, p.z);
        posts.setMatrixAt(c++, m);
      }
      posts.count = c;
      posts.castShadow = true;
      this.group.add(posts);
    }
  }

  // ------------------------------------------------------------------ stands
  straightStand(x0, x1, z0, dir, rows, rowDepth = 0.9, rise = 0.48, base = 1.1) {
    for (let i = 0; i < rows; i++) {
      const h = base + (i + 1) * rise;
      const z = z0 + dir * (i + 0.5) * rowDepth;
      const g = new THREE.BoxGeometry(x1 - x0, h, rowDepth);
      g.translate((x0 + x1) / 2, h / 2, z);
      this.tierGeos.push(g);
      for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.78) {
        this.seats.push({ x, y: h, z: z + dir * 0.1, ry: dir > 0 ? Math.PI : 0, block: Math.floor((x - x0) / 9) + i * 3 });
      }
    }
    const hb = base + rows * rise + 2.2;
    const g = new THREE.BoxGeometry(x1 - x0, hb, 0.6);
    g.translate((x0 + x1) / 2, hb / 2, z0 + dir * (rows * rowDepth + 0.3));
    this.tierGeos.push(g);
    return { top: base + rows * rise, back: z0 + dir * rows * rowDepth };
  }

  bendStand(cx, sideSign, r0, a0, a1, rows, rowDepth = 0.9, rise = 0.48, base = 1.1) {
    const segs = 30;
    const pos = (r, a) => (sideSign > 0 ? [cx + r * Math.sin(a), r * Math.cos(a)] : [cx - r * Math.sin(a), -r * Math.cos(a)]);
    for (let i = 0; i < rows; i++) {
      const h = base + (i + 1) * rise;
      const r = r0 + (i + 0.5) * rowDepth;
      for (let sgi = 0; sgi < segs; sgi++) {
        const aa = a0 + ((a1 - a0) * (sgi + 0.5)) / segs;
        const [x, z] = pos(r, aa);
        const w = (r * (a1 - a0)) / segs + 0.06;
        const g = new THREE.BoxGeometry(w, h, rowDepth);
        g.rotateY(aa);
        g.translate(x, h / 2, z);
        this.tierGeos.push(g);
      }
      const n = Math.floor((r * (a1 - a0)) / 0.8);
      for (let s = 0; s < n; s++) {
        const aa = a0 + ((a1 - a0) * (s + 0.5)) / n;
        const [x, z] = pos(r - 0.1, aa);
        this.seats.push({ x, y: h, z, ry: Math.atan2(cx - x, -z), block: Math.floor(s / 12) + i * 5 });
      }
    }
  }

  // A full oval bowl of seating rows (indoor arena, international stadium).
  bowlStand(rows, rowDepth = 0.9, rise = 0.5, base = 1.1) {
    const d0 = T.WALL + 4.6;
    const lap = OVAL_LAP();
    const p = {};
    for (let i = 0; i < rows; i++) {
      const h = base + (i + 1) * rise;
      const dA = d0 + i * rowDepth, dB = dA + rowDepth;
      this.tierGeos.push(ovalStrip(dA, h, dB, h, 0, lap, 140));
      this.tierGeos.push(ovalStrip(dA, h - rise - (i === 0 ? base : 0), dA, h, 0, lap, 140));
      const dm = dA + rowDepth * 0.45;
      const lapD = 2 * T.L + 2 * Math.PI * (T.R + dm);
      const n = Math.floor(lapD / 0.8);
      for (let k = 0; k < n; k++) {
        const s = (lap * k) / n;
        pointAt(s, 0, dm, p);
        if (p.x < -T.L / 2 && p.z > 0 && p.z < T.R + T.WALL + 4) continue;
        this.seats.push({ x: p.x, y: h, z: p.z, ry: p.h + Math.PI / 2, block: Math.floor(k / 14) + i * 2 });
      }
    }
    const dOut = d0 + rows * rowDepth;
    const hTop = base + rows * rise;
    this.tierGeos.push(ovalStrip(dOut, 0, dOut, hTop + 2.5, 0, lap, 140)); // back wall
    this.outer = { d: dOut, top: hTop };
  }

  buildStands() {
    const v = this.venue;
    const st = v.stands;
    const hL = T.L / 2;
    const zIn = T.R + T.WALL + 4.6;
    const rB = T.R + T.WALL + 4.6;
    if (v.roof === 'ring' || v.roof === 'arena') {
      this.bowlStand(st.main);
    } else {
      if (st.main > 0) {
        const len = st.mainLen || 1;
        const x0 = len < 1 ? -((hL * 2 + 32) * len) / 2 : -hL - 18;
        const x1 = len < 1 ? -x0 : hL + 14;
        this.mainStand = this.straightStand(x0, x1, zIn, 1, st.main);
        this.outer = { d: T.WALL + 4.6 + st.main * 0.9, top: this.mainStand.top };
      }
      if (st.back > 0) this.straightStand(-hL + 2, hL - 2, -zIn, -1, st.back);
      if (st.bendE > 0) this.bendStand(hL, 1, rB, 0.42, Math.PI - 0.3, st.bendE);
      if (st.bendW > 0) this.bendStand(-hL, -1, rB, 0.3, Math.PI - 0.62, st.bendW);
    }
    if (this.tierGeos.length) {
      const tiers = new THREE.Mesh(mergeGeometries(this.tierGeos.map((g) => (g.index ? g.toNonIndexed() : g))), this.mats[v.standMat] || this.mats.concrete);
      tiers.material.side = THREE.DoubleSide;
      tiers.castShadow = v.roof !== 'arena';
      tiers.receiveShadow = true;
      this.group.add(tiers);
      for (const g of this.tierGeos) g.dispose();
      this.tierGeos = [];
    }
    if (this.seats.length && v.seats.length) {
      const seatGeo = new THREE.BoxGeometry(0.55, 0.2, 0.5);
      seatGeo.translate(0, 0.1, 0);
      const seats = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({ roughness: 0.6 }), this.seats.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const c = new THREE.Color();
      const one = new THREE.Vector3(1, 1, 1);
      const pv = new THREE.Vector3();
      this.seats.forEach((s, i) => {
        q.setFromAxisAngle(UP, s.ry);
        m.compose(pv.set(s.x, s.y, s.z), q, one);
        seats.setMatrixAt(i, m);
        seats.setColorAt(i, c.set(v.seats[s.block % v.seats.length]));
      });
      seats.receiveShadow = true;
      this.group.add(seats);
    }
  }

  // Grass banks where fans sit on the slope (grass field) and fans standing at the fence (countryside).
  buildBanks() {
    const v = this.venue;
    const rng = this.rng;
    const lap = OVAL_LAP();
    const C = Math.PI * T.R;
    const ranges = { back: [T.L + C, 2 * T.L + C], bendE: [T.L, T.L + C], bendW: [2 * T.L + C, lap] };
    const p = {};
    if (v.banks) {
      const mat = new THREE.MeshStandardMaterial({ map: groundTexture(v.ground), roughness: 1 });
      for (const which of v.banks) {
        const [s0, s1] = ranges[which];
        const d0 = T.WALL + 3.5, d1 = T.WALL + 15;
        const bank = new THREE.Mesh(ovalStrip(d0, 0, d1, 4.2, s0, s1, 60), mat);
        bank.receiveShadow = true;
        this.group.add(bank);
        const n = Math.floor((s1 - s0) * 3.2);
        for (let i = 0; i < n; i++) {
          const s = s0 + rng() * (s1 - s0);
          const f = rng();
          pointAt(s, 0, d0 + f * (d1 - d0), p);
          this.standing.push({ x: p.x, y: f * 4.2 - 0.1, z: p.z, ry: p.h + Math.PI / 2 + (rng() - 0.5) * 0.6 });
        }
      }
    }
    if (v.fenceCrowd) {
      for (const [s0, s1] of [[8, T.L - 2], [T.L + 5, T.L + C - 10], [T.L + C + 10, 2 * T.L + C - 10]]) {
        const n = Math.floor((s1 - s0) * 2.4);
        for (let i = 0; i < n; i++) {
          const s = s0 + rng() * (s1 - s0);
          pointAt(s, 0, T.WALL + 0.9 + rng() * 2.6, p);
          if (p.x < -T.L / 2 && p.z > T.R - 2) continue;
          this.standing.push({ x: p.x, y: 0, z: p.z, ry: p.h + Math.PI / 2 + (rng() - 0.5) * 0.7 });
        }
      }
    }
  }

  buildCrowd() {
    const v = this.venue;
    const body = new THREE.SphereGeometry(1, 8, 6);
    body.scale(0.2, 0.25, 0.21);
    body.translate(0, 0.42, 0);
    const head = new THREE.SphereGeometry(0.13, 8, 6);
    head.translate(0, 0.72, 0.05);
    const tail = new THREE.ConeGeometry(0.09, 0.3, 5);
    tail.rotateX(-Math.PI / 2 - 0.6);
    tail.translate(0, 0.28, -0.2);
    const crowdGeo = mergeGeometries([body, head, tail]);
    const beakGeo = new THREE.ConeGeometry(0.045, 0.11, 6);
    beakGeo.rotateX(Math.PI / 2);
    beakGeo.translate(0, 0.7, 0.2);
    const target = ({ low: 700, medium: 1800, high: 4200 }[this.quality] || 1800) * (v.crowd || 1);
    const spots = [...this.seats.map((s) => ({ ...s, y: s.y + 0.08 })), ...this.standing];
    if (!spots.length) return;
    const prob = Math.min(1, target / spots.length);
    const chosen = spots.filter(() => this.rng() < prob);
    const mat = crowdify(new THREE.MeshStandardMaterial({ roughness: 0.85 }));
    const beakMat = crowdify(new THREE.MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.5 }));
    const crowd = new THREE.InstancedMesh(crowdGeo, mat, chosen.length);
    const beaks = new THREE.InstancedMesh(beakGeo, beakMat, chosen.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3();
    chosen.forEach((s, i) => {
      const sc = 0.85 + this.rng() * 0.4;
      q.setFromAxisAngle(UP, s.ry + (this.rng() - 0.5) * 0.5);
      m.compose(pv.set(s.x, s.y, s.z), q, sv.set(sc, sc, sc));
      crowd.setMatrixAt(i, m);
      beaks.setMatrixAt(i, m);
      crowd.setColorAt(i, c.set(CROWD_COLORS[Math.floor(this.rng() * CROWD_COLORS.length)]).multiplyScalar(0.85 + this.rng() * 0.3));
    });
    crowd.frustumCulled = false;
    beaks.frustumCulled = false;
    this.group.add(crowd, beaks);
  }

  // ------------------------------------------------------------------ roofs
  buildRoof() {
    const v = this.venue;
    const hL = T.L / 2;
    const zIn = T.R + T.WALL + 4.6;
    if (v.roof === 'main' && this.mainStand) {
      const ms = this.mainStand;
      const depth = ms.back - zIn + 3;
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
      const roof = new THREE.Mesh(new THREE.BoxGeometry(hL * 2 + 36, 0.35, depth), roofMat);
      roof.position.set(-2, ms.top + 6.5, zIn + depth / 2 - 1.5);
      roof.rotation.x = -0.09;
      roof.castShadow = true;
      roof.receiveShadow = true;
      this.group.add(roof);
      const colGeo = new THREE.CylinderGeometry(0.3, 0.35, ms.top + 7, 10);
      const colMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.6, roughness: 0.4 });
      for (let x = -hL - 16; x <= hL + 12; x += 13) {
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(x, (ms.top + 7) / 2, ms.back + 0.8);
        col.castShadow = true;
        this.group.add(col);
      }
      this.buildSign(ms.top + 5.6, zIn - 1.0, 42);
    } else if (v.roof === 'sails' && this.mainStand) {
      // white shade sails over the desert grandstand
      const ms = this.mainStand;
      const sailMat = new THREE.MeshStandardMaterial({ color: 0xf6f0e4, roughness: 0.8, side: THREE.DoubleSide });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x7a6a58, roughness: 0.6, metalness: 0.3 });
      const back = ms.back + 0.5;
      for (let x = -hL - 14; x < hL + 10; x += 18) {
        const a = [x, ms.top + 9, back], b = [x + 18, ms.top + 6, back], c = [x + 9, ms.top + 4.5, zIn + 1];
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
        g.computeVertexNormals();
        const sail = new THREE.Mesh(g, sailMat);
        sail.castShadow = true;
        this.group.add(sail);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, ms.top + 9, 8), poleMat);
        pole.position.set(x, (ms.top + 9) / 2, back);
        this.group.add(pole);
      }
      this.buildSign(ms.top + 2.6, zIn - 1.0, 34);
    } else if (v.roof === 'ring') {
      // canopy ring all the way round the bowl
      const o = this.outer;
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ovalStrip(o.d - 13, o.top + 10, o.d + 1.5, o.top + 12), roofMat);
      ring.castShadow = true;
      ring.receiveShadow = true;
      this.group.add(ring);
      // support masts on the outside
      const mastMat = new THREE.MeshStandardMaterial({ color: 0xb8bec8, metalness: 0.7, roughness: 0.35 });
      const lap = OVAL_LAP();
      const p = {};
      for (let i = 0; i < 24; i++) {
        pointAt((lap * i) / 24, 0, o.d + 1.5, p);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, o.top + 13, 8), mastMat);
        mast.position.set(p.x, (o.top + 13) / 2, p.z);
        this.group.add(mast);
      }
      // a strip of lights along the inner edge of the roof
      const lampMat = new THREE.MeshStandardMaterial({ color: 0x20242a, emissive: 0xfff6e0, emissiveIntensity: 0.2 });
      this.lampMats.push(lampMat);
      const strip = new THREE.Mesh(ovalStrip(o.d - 13, o.top + 9.85, o.d - 11.5, o.top + 10.05), lampMat);
      this.group.add(strip);
    } else if (v.roof === 'arena') {
      this.buildArena();
    }
  }

  buildSign(y, z, width) {
    const sign = document.createElement('canvas');
    sign.width = 1024;
    sign.height = 96;
    const ctx = sign.getContext('2d');
    const tex = new THREE.CanvasTexture(sign);
    tex.colorSpace = THREE.SRGBColorSpace;
    const name = this.venue.name.toUpperCase();
    this.drawSign = () => {
      ctx.fillStyle = '#0d1a33';
      ctx.fillRect(0, 0, 1024, 96);
      let x = 512;
      ctx.textAlign = 'center';
      if (this.logo.complete && this.logo.naturalWidth) {
        ctx.drawImage(this.logo, 30, 4, 264, 88);
        x = 650;
      }
      ctx.fillStyle = '#ffc93c';
      ctx.font = `italic 900 ${name.length > 18 ? 50 : 58}px Arial, sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x, 52);
      tex.needsUpdate = true;
    };
    this.drawSign();
    const s = new THREE.Mesh(new THREE.PlaneGeometry(width, (width * 96) / 1024), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    s.position.set(0, y, z);
    s.rotation.y = Math.PI;
    this.group.add(s);
  }

  // The indoor arena building: walls, roof trusses and ceiling lights.
  buildArena() {
    const o = this.outer;
    const W = T.L / 2 + T.R + o.d + 6;
    const D = T.R + o.d + 6;
    const H = o.top + 20;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x232634, roughness: 0.85, side: THREE.DoubleSide });
    const add = (geo, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, wallMat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    add(new THREE.PlaneGeometry(W * 2, H), 0, H / 2, D);
    add(new THREE.PlaneGeometry(W * 2, H), 0, H / 2, -D);
    add(new THREE.PlaneGeometry(D * 2, H), W, H / 2, 0, Math.PI / 2);
    add(new THREE.PlaneGeometry(D * 2, H), -W, H / 2, 0, Math.PI / 2);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, D * 2), new THREE.MeshStandardMaterial({ color: 0x15171f, roughness: 0.9, side: THREE.DoubleSide }));
    roof.rotation.x = Math.PI / 2;
    roof.position.y = H;
    this.group.add(roof);
    // trusses
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x5a6070, metalness: 0.7, roughness: 0.4 });
    for (let x = -W + 10; x < W; x += 16) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.6, D * 2), trussMat);
      t.position.set(x, H - 1.2, 0);
      this.group.add(t);
    }
    // ceiling light panels
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x30343e, emissive: 0xfff8ec, emissiveIntensity: 2.6 });
    this.lampMats.push(lampMat);
    this.alwaysLit = true;
    const panel = new THREE.BoxGeometry(6, 0.3, 3);
    const lamps = new THREE.InstancedMesh(panel, lampMat, 60);
    const m = new THREE.Matrix4();
    let i = 0;
    for (let x = -W + 18; x < W - 10 && i < 60; x += 16) {
      for (let z = -D + 14; z < D - 8 && i < 60; z += 14) {
        m.makeTranslation(x, H - 2.4, z);
        lamps.setMatrixAt(i++, m);
      }
    }
    lamps.count = i;
    this.group.add(lamps);
    // banner ring of sponsors on the walls
    const bannerGeo = new THREE.PlaneGeometry(16, 1.8);
    let k = 3;
    for (let x = -W + 12; x < W - 8; x += 20) {
      for (const z of [D - 0.05, -D + 0.05]) {
        const b = new THREE.Mesh(bannerGeo, new THREE.MeshBasicMaterial({ map: adTexture(k++), toneMapped: false }));
        b.position.set(x, o.top + 5, z);
        b.rotation.y = z > 0 ? Math.PI : 0;
        this.group.add(b);
      }
    }
    this.arenaSize = { W, D, H };
  }

  // ------------------------------------------------------------------ lights
  buildLights() {
    const v = this.venue;
    if (v.lights !== 'towers') return;
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d949c, metalness: 0.7, roughness: 0.35 });
    const lampCanvas = document.createElement('canvas');
    lampCanvas.width = 128;
    lampCanvas.height = 64;
    const ctx = lampCanvas.getContext('2d');
    ctx.fillStyle = '#20242a';
    ctx.fillRect(0, 0, 128, 64);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = '#fffbea';
      ctx.beginPath();
      ctx.arc(8 + x * 16, 8 + y * 16, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    const lampTex = new THREE.CanvasTexture(lampCanvas);
    lampTex.colorSpace = THREE.SRGBColorSpace;
    for (const [x, z] of [[82, 66], [-82, 66], [82, -66], [-82, -66]]) {
      const h = 40;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, h, 10), poleMat);
      pole.position.set(x, h / 2, z);
      pole.castShadow = true;
      this.group.add(pole);
      const lampMat = new THREE.MeshStandardMaterial({ map: lampTex, emissiveMap: lampTex, emissive: 0xffffff, emissiveIntensity: 0.2, roughness: 0.4 });
      this.lampMats.push(lampMat);
      const head = new THREE.Mesh(new THREE.BoxGeometry(9, 4.5, 0.8), [poleMat, poleMat, poleMat, poleMat, lampMat, poleMat]);
      head.position.set(x, h + 1.5, z);
      head.lookAt(0, 0, 0);
      this.group.add(head);
    }
  }

  setNight(on) {
    for (const m of this.lampMats) m.emissiveIntensity = on || this.alwaysLit ? (this.alwaysLit ? 2.6 : 3.2) : 0.15;
  }

  // ------------------------------------------------------------------ scoreboards & gantry
  buildBoards() {
    const v = this.venue;
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    this.boardCtx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.boardTex = tex;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.6, metalness: 0.3 });
    const screenMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const big = v.roof === 'ring';
    for (const where of v.boards || []) {
      if (where === 'cube') {
        // four-sided screen hanging over the infield
        const g = new THREE.Group();
        const box = new THREE.Mesh(new THREE.BoxGeometry(13, 7.5, 13), frameMat);
        g.add(box);
        for (let i = 0; i < 4; i++) {
          const s = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.5), screenMat);
          s.rotation.y = (i * Math.PI) / 2;
          s.position.set(Math.sin((i * Math.PI) / 2) * 6.55, 0, Math.cos((i * Math.PI) / 2) * 6.55);
          g.add(s);
        }
        g.position.set(0, (this.arenaSize?.H || 26) - 9, 0);
        this.group.add(g);
        continue;
      }
      const sign = where === 'west' ? -1 : 1;
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 15, 28), frameMat);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), screenMat);
      screen.rotation.y = sign < 0 ? Math.PI / 2 : -Math.PI / 2;
      screen.position.x = -sign * 0.62;
      g.add(frame, screen);
      const x = big ? sign * (T.L / 2 + T.R + this.outer.d + 4) : sign * (T.L / 2 + T.R + T.WALL + 24);
      const y = big ? this.outer.top + 12 : 19;
      const legLen = y - 7.5;
      for (const z of [8, -8]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1, legLen, 1), frameMat);
        leg.position.set(0, -7.5 - legLen / 2, z);
        g.add(leg);
      }
      g.position.set(x, y, 0);
      this.group.add(g);
    }
    this.drawBoard({ title: 'WELCOME', time: null, rows: [] });
  }

  drawBoard({ title, time, rows }) {
    this.lastBoard = { title, time, rows };
    const ctx = this.boardCtx;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = '#ffc93c';
    ctx.font = 'italic 900 54px Arial, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('BIRD GRAND PRIX', 32, 52);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 46px Arial, sans-serif';
    ctx.fillText(title, 992, 52);
    ctx.fillStyle = '#e6392f';
    ctx.fillRect(32, 92, 960, 6);
    if (time != null) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#7dff9a';
      ctx.font = 'bold 72px "Courier New", monospace';
      ctx.fillText(formatTime(time), 992, 150);
    }
    ctx.textAlign = 'left';
    ctx.font = 'bold 40px Arial, sans-serif';
    rows.slice(0, 6).forEach((r, i) => {
      const y = 214 + i * 50;
      ctx.fillStyle = i === 0 ? '#ffc93c' : '#ffffff';
      ctx.fillText(`${i + 1}`, 40, y);
      ctx.fillStyle = r.color || '#fff';
      ctx.fillRect(90, y - 16, 12, 32);
      ctx.fillStyle = r.isPlayer ? '#ffc93c' : '#ffffff';
      ctx.fillText(`${r.number}  ${r.name.toUpperCase()}`, 120, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#9fb3c8';
      ctx.fillText(r.info || '', 992, y);
      ctx.textAlign = 'left';
    });
    if (!rows.length) {
      ctx.textAlign = 'center';
      if (this.logo.complete && this.logo.naturalWidth) ctx.drawImage(this.logo, 512 - 300, 118, 600, 200);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'italic 900 44px Arial, sans-serif';
      ctx.fillText(this.venue.name.toUpperCase(), 512, 360);
      ctx.fillStyle = '#9fb3c8';
      ctx.font = 'bold 34px Arial, sans-serif';
      ctx.fillText(SPONSORS[0].name + '  •  ' + SPONSORS[3].name + '  •  ' + SPONSORS[6].name, 512, 430);
    }
    this.boardTex.needsUpdate = true;
  }

  buildGantry() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x20252e, metalness: 0.5, roughness: 0.45 });
    const x = T.FINISH_X;
    const z0 = T.R - 1.4, z1 = T.R + T.WALL + 0.7;
    const h = 5.2;
    for (const z of [z0, z1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), mat);
      p.position.set(x, h / 2, z);
      p.castShadow = true;
      this.group.add(p);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, z1 - z0 + 0.4), mat);
    beam.position.set(x, h, (z0 + z1) / 2);
    beam.castShadow = true;
    this.group.add(beam);
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    this.gantryCtx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.gantryTex = tex;
    const smat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    for (const ry of [-Math.PI / 2, Math.PI / 2]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.75), smat);
      s.rotation.y = ry;
      s.position.set(x + (ry < 0 ? -0.27 : 0.27), h + 1.3, (z0 + z1) / 2);
      this.group.add(s);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.0, 5.9), mat);
    back.position.set(x, h + 1.3, (z0 + z1) / 2);
    this.group.add(back);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 8), mat);
    post.position.set(x, 1.5, T.R - 2.4);
    this.group.add(post);
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.35), mat);
    cam.position.set(x, 3.1, T.R - 2.4);
    this.group.add(cam);
    this.drawGantry(null);
  }

  drawGantry(time) {
    const ctx = this.gantryCtx;
    ctx.fillStyle = '#05070c';
    ctx.fillRect(0, 0, 512, 160);
    ctx.fillStyle = time == null ? '#3a4452' : '#ff4d3a';
    ctx.font = 'bold 118px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(time == null ? '0.00' : formatTime(time), 256, 84);
    this.gantryTex.needsUpdate = true;
  }

  // Flags of many colours around the top of the international bowl.
  buildFlags() {
    if (!this.venue.flags) return;
    const o = this.outer;
    const lap = OVAL_LAP();
    const n = 36;
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 6, 6);
    poleGeo.translate(0, 3, 0);
    const flagGeo = new THREE.PlaneGeometry(2.4, 1.5, 6, 1);
    flagGeo.translate(1.2, 5.1, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0xd0d4da, metalness: 0.6 }), n);
    const flags = new THREE.InstancedMesh(flagGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.8 }), n);
    const cols = ['#d8262a', '#1d4fa0', '#f2c230', '#2fae5a', '#ffffff', '#f28c28', '#6a3fb0', '#111111'];
    const p = {};
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    this.flagData = [];
    for (let i = 0; i < n; i++) {
      pointAt((lap * i) / n, 0, o.d + 0.5, p);
      this.flagData.push({ x: p.x, y: o.top + 2.5, z: p.z, ph: i * 0.7 });
      m.makeTranslation(p.x, o.top + 2.5, p.z);
      poles.setMatrixAt(i, m);
      flags.setColorAt(i, c.set(cols[i % cols.length]));
    }
    this.group.add(poles, flags);
    this.flags = flags;
  }

  // ------------------------------------------------------------------ scenery
  buildScenery() {
    const sc = this.venue.scenery || {};
    if (sc.trees) this.buildTrees(sc.trees, sc.treeColor ?? 0.26, sc.treeRadius || [128, 200]);
    if (sc.city) this.buildCity(sc.city, sc.cityBig);
    if (sc.hills) this.buildHills(sc.hills, 640, 900, 1);
    if (sc.hillsNear) this.buildHills('#7a9a58', 240, 420, 0.45);
    if (sc.dunes) this.buildDunes();
    if (sc.palms) this.buildPalms(sc.palms);
    if (sc.rocks) this.buildRocks(sc.rocks);
    if (sc.farm) this.buildFarm();
    if (sc.tents) this.buildTents();
    if (sc.hedges) this.buildHedges();
  }

  buildTrees(nTrees, hue, [r0, r1]) {
    const rng = this.rng;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 5, 6);
    trunkGeo.translate(0, 2.5, 0);
    const leafGeo = new THREE.IcosahedronGeometry(3.4, 1);
    const lp = leafGeo.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const n = 0.85 + rng() * 0.3;
      lp.setXYZ(i, lp.getX(i) * n, lp.getY(i) * n * 1.15, lp.getZ(i) * n);
    }
    leafGeo.computeVertexNormals();
    leafGeo.translate(0, 7.2, 0);
    if (this.quality === 'low') nTrees = Math.floor(nTrees * 0.45);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), nTrees);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), nTrees);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const pv = new THREE.Vector3(), sv = new THREE.Vector3();
    for (let i = 0; i < nTrees; i++) {
      const a = rng() * Math.PI * 2;
      const r = r0 + rng() * (r1 - r0);
      const s = 0.8 + rng() * 0.9;
      q.setFromAxisAngle(UP, rng() * 6);
      m.compose(pv.set(Math.cos(a) * r * 1.25, 0, Math.sin(a) * r), q, sv.set(s, s, s));
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, c.setHSL(hue - 0.02 + rng() * 0.08, 0.45 + rng() * 0.2, 0.22 + rng() * 0.12));
    }
    leaves.castShadow = true;
    this.group.add(trunks, leaves);
  }

  buildCity(count, big) {
    const rng = this.rng;
    const bGeos = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rng() * 0.08;
      const r = (big ? 260 : 300) + rng() * 140;
      const w = 14 + rng() * 22, d = 14 + rng() * 18, h = (big ? 30 : 18) + rng() * (big ? 120 : 70);
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * (w / 12), uv.getY(j) * (h / 18));
      g.rotateY(-a);
      g.translate(Math.cos(a) * r * 1.2, h / 2, Math.sin(a) * r);
      bGeos.push(g);
    }
    const city = new THREE.Mesh(mergeGeometries(bGeos), new THREE.MeshStandardMaterial({ map: windowsTexture(), roughness: 0.7, metalness: 0.15 }));
    this.cityMat = city.material;
    this.group.add(city);
  }

  buildHills(color, rIn, rOut, scale) {
    const segs = 96;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const h = (40 + 35 * Math.sin(a * 3 + 1 + rIn) + 25 * Math.sin(a * 7 + 2) + 14 * Math.sin(a * 13)) * scale;
      pos.push(Math.cos(a) * rIn, -1, Math.sin(a) * rIn, Math.cos(a) * rOut, Math.max(6, h), Math.sin(a) * rOut);
      if (i > 0) {
        const o = i * 2;
        idx.push(o - 2, o, o - 1, o - 1, o, o + 1);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setIndex(idx);
    hg.computeVertexNormals();
    this.group.add(new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, side: THREE.DoubleSide })));
  }

  // Smooth sand dunes rolling away from the track.
  buildDunes() {
    const g = new THREE.RingGeometry(150, 900, 160, 24);
    g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      const ramp = Math.min(1, (r - 150) / 120);
      const h = (Math.sin(x * 0.018) * Math.cos(z * 0.021) * 9 + Math.sin(x * 0.007 + z * 0.011) * 16 + 14) * ramp;
      p.setY(i, Math.max(0, h) - 0.5);
    }
    g.computeVertexNormals();
    const dunes = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: groundTexture('sand'), color: 0xf0d8b0, roughness: 1 }));
    dunes.material.map = dunes.material.map.clone();
    dunes.material.map.repeat.set(40, 40);
    dunes.material.map.needsUpdate = true;
    dunes.receiveShadow = true;
    this.group.add(dunes);
  }

  buildPalms(n) {
    const rng = this.rng;
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.38, 9, 7, 4);
    trunkGeo.translate(0, 4.5, 0);
    const tp = trunkGeo.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      tp.setX(i, tp.getX(i) + (y / 9) ** 2 * 1.2); // gentle curve
    }
    trunkGeo.computeVertexNormals();
    const fronds = [];
    for (let k = 0; k < 8; k++) {
      const f = new THREE.ConeGeometry(0.55, 4.6, 4, 1);
      f.scale(1, 1, 0.2);
      f.translate(0, 2.3, 0);
      f.rotateZ(-1.15);
      f.rotateY((k / 8) * Math.PI * 2);
      f.translate(1.2, 9, 0);
      fronds.push(f);
    }
    const crownGeo = mergeGeometries(fronds);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 }), n);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ color: 0x4f8a33, roughness: 0.9, side: THREE.DoubleSide }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = i < 14 ? 72 + rng() * 10 : 105 + rng() * 110;
      const s = 0.8 + rng() * 0.6;
      q.setFromAxisAngle(UP, rng() * 6.3);
      m.compose(pv.set(Math.cos(a) * r * 1.3, 0, Math.sin(a) * r), q, sv.set(s, s, s));
      trunks.setMatrixAt(i, m);
      crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, c.setHSL(0.25 + rng() * 0.06, 0.5, 0.3 + rng() * 0.1));
    }
    trunks.castShadow = true;
    crowns.castShadow = true;
    this.group.add(trunks, crowns);
  }

  buildRocks(n) {
    const rng = this.rng;
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const rocks = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xa8643c, roughness: 1, flatShading: true }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = 120 + rng() * 160;
      const s = 2 + rng() * 9;
      q.setFromEuler(new THREE.Euler(rng(), rng() * 6, rng()));
      m.compose(pv.set(Math.cos(a) * r * 1.3, s * 0.3, Math.sin(a) * r), q, sv.set(s * (1 + rng()), s * (0.5 + rng() * 0.6), s));
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true;
    this.group.add(rocks);
  }

  // Barn, silo, windmill and hay bales for the countryside course.
  buildFarm() {
    const red = new THREE.MeshStandardMaterial({ color: 0x9e2f25, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.8 });
    const white = new THREE.MeshStandardMaterial({ color: 0xeeeae0, roughness: 0.8 });
    const barn = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 12), red);
    body.position.y = 4.5;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 9, 6, 4, 1), roofMat);
    roof.scale.set(1.45, 1, 0.95);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 12;
    const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), white);
    door.position.set(0, 3, 6.01);
    barn.add(body, roof, door);
    barn.position.set(-120, 0, -95);
    barn.rotation.y = 0.4;
    barn.traverse((o) => { o.castShadow = true; });
    this.group.add(barn);
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 16), white);
    silo.position.set(-102, 8, -104);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), roofMat);
    dome.position.set(-102, 16, -104);
    this.group.add(silo, dome);
    // windmill
    const mill = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 3.4, 18, 8), white);
    tower.position.y = 9;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3, 8), roofMat);
    cap.position.y = 19.5;
    const hub = new THREE.Group();
    hub.position.set(0, 17.5, 2.6);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(1.6, 9, 0.15), new THREE.MeshStandardMaterial({ color: 0xdcd2bc, roughness: 0.9 }));
      blade.position.y = 4.6;
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      arm.add(blade);
      hub.add(arm);
    }
    mill.add(tower, cap, hub);
    mill.position.set(130, 0, -80);
    mill.rotation.y = -0.9;
    this.group.add(mill);
    this.spin.push({ obj: hub, axis: 'z', speed: 0.6 });
    // hay bales
    const rng = this.rng;
    const bale = new THREE.CylinderGeometry(0.9, 0.9, 1.4, 14);
    bale.rotateZ(Math.PI / 2);
    const bales = new THREE.InstancedMesh(bale, new THREE.MeshStandardMaterial({ color: 0xd8b85a, roughness: 1 }), 40);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2;
      const r = 70 + rng() * 60;
      q.setFromAxisAngle(UP, rng() * 6);
      m.compose(pv.set(Math.cos(a) * r * 1.35, 0.9, Math.sin(a) * r), q, one);
      bales.setMatrixAt(i, m);
    }
    bales.castShadow = true;
    this.group.add(bales);
  }

  // Striped marquee tents behind the grass-field bleachers.
  buildTents() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 16;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#ffffff' : '#d8262a';
      ctx.fillRect(i * 16, 0, 16, 16);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const wallMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf4f2ec, roughness: 0.8 });
    const z = T.R + T.WALL + 18;
    for (let x = -50; x <= 50; x += 20) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 7), wallMat);
      base.position.set(x, 1.5, z);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 3.4, 4), roofMat);
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(1, 1, 0.78);
      roof.position.set(x, 4.7, z);
      base.castShadow = roof.castShadow = true;
      this.group.add(base, roof);
    }
  }

  buildHedges() {
    const lap = OVAL_LAP();
    const n = 120;
    const geo = new THREE.BoxGeometry(3.6, 1.6, 1.4);
    geo.translate(0, 0.8, 0);
    const hedges = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0x3f6e2f, roughness: 1 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const p = {};
    let c = 0;
    for (let i = 0; i < n; i++) {
      pointAt((lap * i) / n, 0, T.WALL + 30, p);
      q.setFromAxisAngle(UP, p.h - Math.PI / 2);
      m.compose(pv.set(p.x, 0, p.z), q, one);
      hedges.setMatrixAt(c++, m);
    }
    hedges.castShadow = true;
    this.group.add(hedges);
  }

  // ------------------------------------------------------------------
  update(dt, time) {
    crowdUniforms.uTime.value = time;
    for (const s of this.spin) s.obj.rotation[s.axis] += s.speed * dt;
    if (this.flags) {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
      this.flagData.forEach((f, i) => {
        q.setFromAxisAngle(UP, 0.4 + Math.sin(time * 1.7 + f.ph) * 0.35);
        m.compose(pv.set(f.x, f.y, f.z), q, one);
        this.flags.setMatrixAt(i, m);
      });
      this.flags.instanceMatrix.needsUpdate = true;
    }
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
      }
    });
    this.boardTex?.dispose();
    this.gantryTex?.dispose();
    this.group.removeFromParent();
  }
}

// Draws the running track: tartan surface, lane lines, kerb, infield, start/finish markings.
import * as THREE from 'three';
import { T, pointAt, measureOffset, laneCenter } from './track.js';
import { tartanTextures, grassTextures, concreteTexture, textTexture, trackTextures, infieldTexture } from './textures.js';


// Stations (distances along the kerb line) used to sample the oval smoothly.
function ovalStations(curveSteps = 96) {
  const C = Math.PI * T.R;
  const st = [];
  st.push(0);
  for (let i = 1; i <= 6; i++) st.push((T.L * i) / 6);
  for (let i = 1; i <= curveSteps; i++) st.push(T.L + (C * i) / curveSteps);
  for (let i = 1; i <= 6; i++) st.push(T.L + C + (T.L * i) / 6);
  for (let i = 1; i <= curveSteps; i++) st.push(2 * T.L + C + (C * i) / curveSteps);
  return st;
}

// A flat band around the oval between offsets d0 and d1.
function ribbon(d0, d1, y, uvScale = 0.25, curveSteps = 96) {
  const st = ovalStations(curveSteps);
  const pos = [], uv = [], idx = [];
  st.forEach((s, i) => {
    const a = pointAt(s, 0, d0, {});
    const b = pointAt(s, 0, d1, {});
    pos.push(a.x, y, a.z, b.x, y, b.z);
    uv.push(s * uvScale, d0 * uvScale, s * uvScale, d1 * uvScale);
    if (i > 0) {
      const o = i * 2;
      idx.push(o - 2, o - 1, o, o - 1, o + 1, o);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// A vertical strip around the oval at offset d (walls, kerb faces).
function wallRibbon(d, y0, y1, curveSteps = 96, uvScale = 0.1) {
  const st = ovalStations(curveSteps);
  const pos = [], uv = [], idx = [];
  st.forEach((s, i) => {
    const a = pointAt(s, 0, d, {});
    pos.push(a.x, y0, a.z, a.x, y1, a.z);
    uv.push(s * uvScale, 0, s * uvScale, 1);
    if (i > 0) {
      const o = i * 2;
      idx.push(o - 2, o, o - 1, o - 1, o, o + 1);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function quad(x0, z0, x1, z1, y) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([x0 * 0.25, z0 * 0.25, x1 * 0.25, z0 * 0.25, x1 * 0.25, z1 * 0.25, x0 * 0.25, z1 * 0.25], 2));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

// Line across a lane, between offsets d0 and d1 at station s on measurement line m.
function crossLine(s, m, d0, d1, width, y) {
  const a = pointAt(s, m, d0, {});
  const b = pointAt(s, m, d1, {});
  const fx = Math.sin(a.h) * width * 0.5, fz = Math.cos(a.h) * width * 0.5;
  const fx2 = Math.sin(b.h) * width * 0.5, fz2 = Math.cos(b.h) * width * 0.5;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    a.x - fx, y, a.z - fz, a.x + fx, y, a.z + fz, b.x + fx2, y, b.z + fz2, b.x - fx2, y, b.z - fz2,
  ], 3));
  g.setIndex([0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}

const lineMat = () => new THREE.MeshStandardMaterial({
  color: 0xf4f4f0, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
});

export class TrackMesh {
  constructor(scene) {
    this.group = new THREE.Group();
    this.raceGroup = new THREE.Group();
    scene.add(this.group, this.raceGroup);
    const tt = tartanTextures();
    const tartan = new THREE.MeshStandardMaterial({ map: tt.map, bumpMap: tt.bump, bumpScale: 0.6, roughness: 0.92, metalness: 0 });
    this.tartanMat = tartan;

    // tartan surface (lanes + apron)
    const surf = new THREE.Mesh(ribbon(-0.08, T.WALL, 0, 0.25), tartan);
    surf.receiveShadow = true;
    this.group.add(surf);
    this.surf = surf;
    // 100 m chute (straight extension behind the home straight)
    const chute = new THREE.Mesh(quad(-T.L / 2 - T.CHUTE, T.R - 0.08, -T.L / 2, T.R + T.WALL, 0.001), tartan.clone());
    chute.material.polygonOffset = true;
    chute.material.polygonOffsetFactor = -1;
    chute.receiveShadow = true;
    this.group.add(chute);
    this.chute = chute;

    // lane lines
    const lm = lineMat();
    this.lineMat = lm;
    for (let k = 1; k <= T.LANES; k++) {
      const d = k * T.W;
      const line = new THREE.Mesh(ribbon(d - 0.025, d + 0.025, 0.004, 0.25, 128), lm);
      line.receiveShadow = true;
      this.group.add(line);
      const cl = new THREE.Mesh(quad(-T.L / 2 - T.CHUTE, T.R + d - 0.025, -T.L / 2, T.R + d + 0.025, 0.005), lm);
      cl.receiveShadow = true;
      this.group.add(cl);
    }
    // finish line + 100 m start line (permanent markings)
    const fin = new THREE.Mesh(quad(T.FINISH_X - 0.05, T.R, T.FINISH_X + 0.05, T.R + T.EDGE, 0.006), lm);
    fin.receiveShadow = true;
    this.group.add(fin);
    const s100 = T.FINISH_X - 100;
    const st100 = new THREE.Mesh(quad(s100 - 0.05, T.R, s100 + 0.05, T.R + T.EDGE, 0.006), lm);
    st100.receiveShadow = true;
    this.group.add(st100);
    // lane numbers just past the finish
    for (let k = 1; k <= T.LANES; k++) {
      const tex = textTexture(String(k), { font: 'bold 110px Arial', color: '#f5f5f0' });
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
      pl.rotation.x = -Math.PI / 2;
      pl.rotation.z = -Math.PI / 2;
      pl.position.set(T.FINISH_X + 1.6, 0.007, T.R + laneCenter(k));
      pl.receiveShadow = true;
      this.group.add(pl);
    }

    // inner kerb (raised aluminium edge)
    const kerbMat = new THREE.MeshStandardMaterial({ color: 0xd8dcdf, roughness: 0.35, metalness: 0.55, side: THREE.DoubleSide });
    const kerbTop = new THREE.Mesh(ribbon(-0.07, 0, 0.055, 0.25, 128), kerbMat);
    const kerbIn = new THREE.Mesh(wallRibbon(-0.07, 0, 0.055, 128), kerbMat);
    const kerbOut = new THREE.Mesh(wallRibbon(0, 0.055, 0, 128), kerbMat);
    for (const k of [kerbTop, kerbIn, kerbOut]) {
      k.castShadow = true;
      k.receiveShadow = true;
      this.group.add(k);
    }

    // infield grass with mowing stripes
    const gt = grassTextures();
    const shapePts = [];
    const st = ovalStations(64);
    for (const s of st) {
      const p = pointAt(s, 0, -0.07, {});
      shapePts.push(new THREE.Vector2(p.x, -p.z));
    }
    const shape = new THREE.Shape(shapePts);
    const ig = new THREE.ShapeGeometry(shape, 1);
    ig.rotateX(-Math.PI / 2);
    // planar UVs: stripe texture across the infield, detail texture repeats
    const pos = ig.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    const w = T.L + 2 * T.R, hgt = 2 * T.R;
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = (pos.getX(i) + w / 2) / w;
      uv[i * 2 + 1] = (pos.getZ(i) + hgt / 2) / hgt;
    }
    ig.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const infieldMat = new THREE.MeshStandardMaterial({ map: gt.infield, roughness: 0.95, bumpMap: gt.detailBump, bumpScale: 0.8 });
    const infield = new THREE.Mesh(ig, infieldMat);
    infield.position.y = -0.003;
    infield.receiveShadow = true;
    this.group.add(infield);
    this.infield = infield;
    this.kerb = [kerbTop, kerbIn, kerbOut];

    // concourse walkway outside the barrier
    const conc = new THREE.Mesh(ribbon(T.WALL, T.WALL + 4.5, -0.002, 0.25, 64), new THREE.MeshStandardMaterial({ map: concreteTexture(), roughness: 0.95 }));
    conc.receiveShadow = true;
    this.group.add(conc);
    this.conc = conc;
    const chuteConc = new THREE.Mesh(
      quad(-T.L / 2 - T.CHUTE - 4, T.R - 1, -T.L / 2 - T.CHUTE, T.R + T.WALL + 4.5, -0.001),
      conc.material,
    );
    chuteConc.receiveShadow = true;
    this.group.add(chuteConc);
  }

  // Change the look of the track for a venue (surface colour, infield, walkway).
  setVenue(v) {
    const tt = trackTextures(v.track);
    for (const m of [this.surf.material, this.chute.material]) {
      m.map = tt.map;
      m.bumpMap = tt.bump;
      m.bumpScale = v.track.kind === 'tartan' ? 0.6 : 1.2;
      m.roughness = v.track.kind === 'tartan' ? 0.92 : 1;
      m.needsUpdate = true;
    }
    this.infield.material.map = infieldTexture(v.infield);
    this.infield.material.needsUpdate = true;
    // grass and countryside tracks have no metal kerb, just paint
    for (const k of this.kerb) k.visible = v.track.kind === 'tartan' || v.track.kind === 'clay';
    const walkway = { grass: 0x6f9a52, meadow: 0x6f9a52, sand: 0xd8b886, floor: 0x3b3e48 }[v.ground] || 0xffffff;
    this.conc.material.color.setHex(v.ground === 'grass' && v.wall === 'ads' ? 0xffffff : walkway);
    this.conc.material.map = v.ground === 'grass' && v.wall === 'ads' ? concreteTexture() : null;
    this.conc.material.needsUpdate = true;
  }

  // Start lines + break line for the selected race.
  setRaceMarkings(raceDef, lanes, startPointFn) {
    for (const c of this.raceGroup.children.slice()) {
      c.geometry.dispose();
      this.raceGroup.remove(c);
    }
    const lm = this.lineMat;
    if (raceDef.mode !== 'straight') {
      for (const k of lanes) {
        const sp = startPointFn(k);
        const g = crossLine(sp.s, sp.m, (k - 1) * T.W + 0.03, k * T.W - 0.03, 0.08, 0.007);
        const mesh = new THREE.Mesh(g, lm);
        mesh.receiveShadow = true;
        this.raceGroup.add(mesh);
      }
    }
    if (raceDef.mode === 'break') {
      if (!this.greenMat) {
        this.greenMat = new THREE.MeshStandardMaterial({ color: 0x2fd15a, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      }
      const sb = T.L + Math.PI * (T.R + measureOffset(1));
      const g = crossLine(sb, measureOffset(1), 0.05, T.EDGE, 0.08, 0.008);
      const mesh = new THREE.Mesh(g, this.greenMat);
      mesh.receiveShadow = true;
      this.raceGroup.add(mesh);
    }
  }
}

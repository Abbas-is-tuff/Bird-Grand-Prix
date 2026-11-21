// Builds a realistic-proportioned 3D bird entirely in code.
// Body/head are smooth feathered shapes; wing, tail and crest feathers are INDIVIDUAL feathers
// (drawn with one InstancedMesh so they are cheap) that the animator can move one by one.
import * as THREE from 'three';
import { featherTextures, vaneTexture, scaleTexture, blobTexture } from '../world/textures.js';
import { SPECIES } from '../data/species.js';
import { smoothstep, mulberry32 } from '../core/utils.js';

export const WORLD_SCALE = 1.1; // model units -> metres

// ---------------------------------------------------------------------------
// Shared materials / geometries (created once, used by every bird)
let shared = null;
function sharedAssets() {
  if (shared) return shared;
  const ft = featherTextures();
  const bodyMat = new THREE.MeshStandardMaterial({
    vertexColors: true, map: ft.map, bumpMap: ft.bump, bumpScale: 1.2, roughness: 0.82, metalness: 0,
  });
  const featherMat = new THREE.MeshStandardMaterial({
    map: vaneTexture(), side: THREE.DoubleSide, roughness: 0.72, metalness: 0,
  });
  featherMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 instanceTip;\nattribute float instanceTipStart;\nvarying vec3 vTipColor;\nvarying float vTipMix;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTipColor = instanceTip;\nvTipMix = smoothstep(instanceTipStart, 1.0, uv.y);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTipColor;\nvarying float vTipMix;')
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= mix(vColor.rgb, vTipColor, vTipMix);');
  };
  featherMat.customProgramCacheKey = () => 'bgp-feather';
  const legMat = new THREE.MeshStandardMaterial({ map: scaleTexture(), roughness: 0.55, metalness: 0 });
  const beakMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.02 });
  const eyeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.06, metalness: 0.0 });
  const blobMat = new THREE.MeshBasicMaterial({
    map: blobTexture(), transparent: true, depthWrite: false, opacity: 0.55,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  });

  const cyl = new THREE.CylinderGeometry(0.78, 1, 1, 8, 1);
  cyl.translate(0, 0.5, 0);
  const blobGeo = new THREE.PlaneGeometry(1, 1);
  blobGeo.rotateX(-Math.PI / 2);
  shared = { bodyMat, featherMat, legMat, beakMat, eyeMat, blobMat, featherGeo: featherGeometry(), cyl, blobGeo };
  return shared;
}

// One feather: length 1 along -Z, width 1 along X, curving slightly toward -Y, with a raised shaft.
function featherGeometry() {
  const seg = 8;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    let w;
    if (t < 0.12) w = 0.3 + (t / 0.12) * 0.7;
    else w = Math.pow(Math.max(0, 1 - Math.pow((t - 0.12) / 0.88, 2.6)), 0.55);
    w *= 0.5;
    const bend = -0.09 * t * t;
    pos.push(-w * 0.78, bend - 0.004, -t, 0, bend + 0.014 * (1 - t), -t, w, bend - 0.004, -t);
    uv.push(0, t, 0.5, t, 1, t);
  }
  for (let i = 0; i < seg; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
function makePalette(colors) {
  const c = Object.assign({}, colors);
  c.belly ||= c.body;
  c.back ||= c.body;
  c.head ||= c.body;
  c.face ||= c.head;
  c.wing ||= c.back;
  c.wingCovert ||= c.wing;
  c.wingTip ||= c.wing;
  c.tail ||= c.back;
  c.tailTip ||= c.tail;
  c.beak ||= '#d8c8a8';
  c.iris ||= '#111111';
  c.legs ||= '#b0a0a0';
  c.crest ||= c.head;
  c.crestTip ||= c.crest;
  const out = {};
  for (const k in c) out[k] = new THREE.Color(c[k]);
  return out;
}

function paint(geo, fn) {
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  const v = new THREE.Vector3();
  const rng = mulberry32(p.count * 7 + 3);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    fn(c, v, i);
    const n = 0.95 + rng() * 0.08;
    col[i * 3] = c.r * n;
    col[i * 3 + 1] = c.g * n;
    col[i * 3 + 2] = c.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function solid(geo, color) {
  paint(geo, (c) => c.copy(color));
  return geo;
}

// Ellipsoid sphere with poles on the Z axis (front/back) so feather texture flows head -> tail.
function zSphere(wSeg, hSeg) {
  const g = new THREE.SphereGeometry(1, wSeg, hSeg);
  g.rotateX(Math.PI / 2);
  return g;
}

function bodyGeometry(shape, pal) {
  const [rx, ry, rz] = shape.body;
  const g = zSphere(34, 24);
  const p = g.attributes.position;
  const unit = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    unit.push([x, y, z]);
    let k = z < 0 ? 1 - 0.42 * Math.pow(-z, 1.6) : 1 - 0.1 * z * z;
    let yy = y * ry * k;
    if (y < 0 && z > -0.3) yy *= 1.07;
    if (y > 0) yy *= 0.96;
    p.setXYZ(i, x * rx * k, yy, z * rz);
  }
  g.computeVertexNormals();
  paint(g, (c, v, i) => {
    const [x, y, z] = unit[i];
    c.copy(pal.belly).lerp(pal.back, smoothstep(-0.35, 0.5, y));
    if (pal.chest) c.lerp(pal.chest, smoothstep(0.1, 0.55, z) * (1 - smoothstep(0.0, 0.45, y)));
    if (pal.bib) c.lerp(pal.bib, smoothstep(0.5, 0.85, z) * smoothstep(-0.45, 0.0, y) * (1 - smoothstep(0.35, 0.7, y)));
    if (pal.neck) c.lerp(pal.neck, smoothstep(0.55, 0.9, z) * smoothstep(-0.1, 0.4, y));
    else c.lerp(pal.head, smoothstep(0.75, 1.0, z) * smoothstep(0.0, 0.6, y) * 0.7);
    if (pal.rump) c.lerp(pal.rump, smoothstep(0.5, 0.85, -z) * smoothstep(-0.1, 0.4, y));
  });
  return g;
}

function headGeometry(hr, pal, shape) {
  const g = zSphere(28, 20);
  const p = g.attributes.position;
  const unit = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    unit.push([x, y, z]);
    // slightly egg shaped, with a fuller cheek area
    const zz = z * (z > 0 ? 1.08 : 0.98);
    p.setXYZ(i, x * hr * 0.88, y * hr * (y > 0 ? 0.98 : 0.92), zz * hr);
  }
  g.computeVertexNormals();
  const eye = new THREE.Vector3(0.62, 0.22, 0.45).normalize();
  paint(g, (c, v, i) => {
    const [x, y, z] = unit[i];
    c.copy(pal.head);
    c.lerp(pal.face, smoothstep(-0.05, 0.5, z));
    if (pal.forehead) c.lerp(pal.forehead, smoothstep(0.2, 0.65, z) * smoothstep(0.1, 0.55, y));
    if (pal.throat) c.lerp(pal.throat, smoothstep(0.05, -0.55, y) * smoothstep(-0.2, 0.3, z));
    if (pal.barring && y > 0.0 && z < 0.62) {
      const s = Math.sin((y * 1.0 + z * 0.55) * 36);
      if (s > 0.3) c.lerp(pal.barring, 0.85 * smoothstep(0.0, 0.25, y) * (1 - smoothstep(0.4, 0.62, z)));
    }
    if (pal.mask) {
      const d = Math.min(
        Math.hypot(x - eye.x, y - eye.y, z - eye.z),
        Math.hypot(x + eye.x, y - eye.y, z - eye.z),
      );
      c.lerp(pal.mask, 1 - smoothstep(0.22, 0.42, d));
    }
  });
  return g;
}

// Upper/lower beak built as a tapered tube along a curved centre line.
function beakGeometry(len, r, hook, widthRatio, lower) {
  const rings = 10, radial = 12;
  const pos = [];
  const idx = [];
  const center = (t) => {
    if (lower) return new THREE.Vector3(0, -len * 0.06 * t + len * 0.04 * t * t, len * 0.6 * t);
    return new THREE.Vector3(0, -hook * len * 0.95 * Math.pow(t, 2.3), len * (t - 0.28 * hook * t * t * t));
  };
  const side = new THREE.Vector3(1, 0, 0);
  for (let i = 0; i <= rings; i++) {
    const t = (i / rings) * 0.985;
    const c = center(t);
    const tan = center(Math.min(1, t + 0.01)).sub(center(Math.max(0, t - 0.01))).normalize();
    const nrm = new THREE.Vector3().crossVectors(tan, side).normalize();
    const rr = r * Math.pow(1 - t, hook > 0.3 ? 0.6 : 0.8) * (lower ? 0.68 : 1) + 0.0015;
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * Math.PI * 2;
      let sy = Math.sin(th);
      if (!lower && sy < 0) sy *= 0.45;
      if (!lower && sy > 0) sy *= 1.15;
      if (lower && sy > 0) sy *= 0.4;
      const o = side.clone().multiplyScalar(Math.cos(th) * rr * widthRatio).addScaledVector(nrm, sy * rr);
      pos.push(c.x + o.x, c.y + o.y, c.z + o.z);
    }
  }
  const tip = center(1);
  const tipIndex = pos.length / 3;
  pos.push(tip.x, tip.y, tip.z);
  const baseIndex = tipIndex + 1;
  const b0 = center(0);
  pos.push(b0.x, b0.y, b0.z);
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * radial + j, b = i * radial + ((j + 1) % radial);
      const c2 = (i + 1) * radial + j, d = (i + 1) * radial + ((j + 1) % radial);
      idx.push(a, c2, b, b, c2, d);
    }
  }
  for (let j = 0; j < radial; j++) {
    idx.push(rings * radial + j, tipIndex, rings * radial + ((j + 1) % radial));
    idx.push(baseIndex, j, (j + 1) % radial);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Approximate x (half width) of the deformed body surface at height y, depth z (body frame).
function bodySurfaceX(shape, y, z) {
  const [rx, ry, rz] = shape.body;
  const zu = Math.max(-1, Math.min(1, z / rz));
  const k = zu < 0 ? 1 - 0.42 * Math.pow(-zu, 1.6) : 1 - 0.1 * zu * zu;
  const ys = ry * k * (y < 0 ? 1.07 : 0.96);
  const q = 1 - zu * zu - (y / ys) * (y / ys);
  return q > 0 ? rx * k * Math.sqrt(q) : 0;
}

// Builds a feather orientation: feather extends along `dir`, its top surface faces `normal`.
const _m = new THREE.Matrix4();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
function featherQuat(dir, normal) {
  _z.copy(dir).normalize().negate();
  _y.copy(normal).addScaledVector(_z, -normal.dot(_z)).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m.makeBasis(_x, _y, _z);
  return new THREE.Quaternion().setFromRotationMatrix(_m);
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------------------
export function createBirdModel(bird, bandColor = '#ffcc00') {
  const A = sharedAssets();
  const sp = SPECIES[bird.species];
  const shape = sp.shape;
  const pal = makePalette(bird.colors);
  const S = sp.size * WORLD_SCALE;
  const [rx, ry, rz] = shape.body;
  const hr = shape.headR;
  const L = shape.legs;
  const geos = [];
  const track = (g) => (geos.push(g), g);

  const root = new THREE.Group();
  root.name = bird.name;
  root.scale.setScalar(S);

  // ---- legs: rest pose numbers
  const l1 = L.tibia, l2 = L.tarsus;
  const toeH = 0.012;
  const kneeOff = V(0, -0.03, 0.035);
  const hipY = toeH + 0.78 * (l1 + l2) - kneeOff.y;
  const hips = [V(L.width, 0, -0.02), V(-L.width, 0, -0.02)];

  const bodyPivot = new THREE.Group();
  bodyPivot.position.set(0, hipY, 0);
  bodyPivot.rotation.order = 'YXZ';
  root.add(bodyPivot);

  const bodyFrame = new THREE.Group();
  bodyFrame.position.set(0, ry * 0.3, 0.03);
  bodyFrame.rotation.x = -shape.pitch;
  bodyPivot.add(bodyFrame);

  const bodyMesh = new THREE.Mesh(track(bodyGeometry(shape, pal)), A.bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyFrame.add(bodyMesh);

  // ---- head (child of root so it can be stabilised independently of the body)
  const head = new THREE.Group();
  root.add(head);
  const headMesh = new THREE.Mesh(track(headGeometry(hr, pal, shape)), A.bodyMat);
  headMesh.castShadow = true;
  head.add(headMesh);

  // eyes
  const eyes = [];
  for (const s of [1, -1]) {
    const dir = V(0.62 * s, 0.22, 0.45).normalize();
    const er = hr * (sp.size < 0.8 ? 0.19 : 0.16);
    const eye = new THREE.Group();
    eye.position.copy(dir).multiplyScalar(hr * 0.9);
    eye.position.x *= 0.88;
    eye.quaternion.setFromUnitVectors(V(0, 0, 1), dir);
    const iris = new THREE.Mesh(track(solid(new THREE.SphereGeometry(er, 12, 10), pal.iris)), A.eyeMat);
    const pupil = new THREE.Mesh(track(solid(new THREE.SphereGeometry(er * 0.62, 10, 8), new THREE.Color('#050505'))), A.eyeMat);
    pupil.position.z = er * 0.5;
    eye.add(iris, pupil);
    if (pal.eyeRing) {
      const ring = new THREE.Mesh(track(solid(new THREE.SphereGeometry(er * 1.45, 14, 8), pal.eyeRing)), A.bodyMat);
      ring.scale.z = 0.25;
      ring.position.z = -er * 0.35;
      eye.add(ring);
    }
    head.add(eye);
    eyes.push(eye);
    if (pal.cheek) {
      const cheek = new THREE.Mesh(track(solid(new THREE.SphereGeometry(1, 14, 10), pal.cheek)), A.bodyMat);
      const cd = V(0.74 * s, -0.12, 0.4).normalize();
      cheek.position.copy(cd).multiplyScalar(hr * 0.86);
      cheek.position.x *= 0.88;
      cheek.quaternion.setFromUnitVectors(V(0, 0, 1), cd);
      cheek.scale.set(hr * 0.3, hr * 0.26, hr * 0.08);
      head.add(cheek);
    }
  }

  // beak
  const bk = shape.beak;
  const beakColor = pal.beak;
  const beakU = new THREE.Mesh(
    track(solid(beakGeometry(bk.len, bk.r, bk.hook, bk.width, false), beakColor)), A.beakMat,
  );
  const beakBase = V(0, -0.08 * hr, 0.82 * hr);
  beakU.position.copy(beakBase);
  head.add(beakU);
  const beakLPivot = new THREE.Group();
  beakLPivot.position.set(0, beakBase.y - bk.r * 0.35, beakBase.z - bk.r * 0.1);
  head.add(beakLPivot);
  const beakL = new THREE.Mesh(
    track(solid(beakGeometry(bk.len * (bk.hook > 0.3 ? 0.6 : 0.9), bk.r * 0.95, 0, bk.width * 0.95, true), beakColor.clone().multiplyScalar(0.92))),
    A.beakMat,
  );
  beakLPivot.add(beakL);
  if (bk.cere || pal.cere) {
    const cere = new THREE.Mesh(track(solid(new THREE.SphereGeometry(1, 12, 8), pal.cere || beakColor)), A.beakMat);
    cere.position.set(0, beakBase.y + bk.r * 0.75, beakBase.z - 0.005);
    cere.scale.set(bk.r * 0.95, bk.r * 0.55, bk.r * 0.6);
    head.add(cere);
  }

  // neck (stretches between body and head every frame)
  const neckGeo = track(new THREE.SphereGeometry(1, 16, 12));
  const neckTop = pal.neck || pal.head;
  const neckBottom = pal.bib || pal.neck || pal.back;
  paint(neckGeo, (c, v) => c.copy(neckBottom).lerp(neckTop, smoothstep(-0.6, 0.5, v.y)));
  const neck = new THREE.Mesh(neckGeo, A.bodyMat);
  neck.castShadow = true;
  root.add(neck);
  const neckBaseLocal = V(0, ry * 0.6, rz * 0.62); // in bodyFrame space

  // ---- feathers (instanced)
  const feathers = [];
  const addFeather = (f) => feathers.push(f);
  const tipStart = 0.55;

  // Wings: folded feathers are laid ON the body surface (root and tip both on the surface)
  const wl = shape.wingLen;
  const onSurf = (s, y, z, lift) => V(s * (bodySurfaceX(shape, y, z) + lift), y, z);
  const folded = (s, ry0, rz0, ry1, rz1, lift) => {
    const root = onSurf(s, ry0, rz0, lift);
    const tip = onSurf(s, ry1, rz1, lift + 0.006);
    const dir = tip.clone().sub(root);
    const len = dir.length();
    const mid = root.clone().lerp(tip, 0.5);
    const nrm = V(mid.x / (rx * rx), mid.y / (ry * ry) * 0.6 + 0.4 / ry, 0).normalize();
    if (Math.abs(nrm.x) < 0.3) nrm.x = s * 0.3;
    return { root, q: featherQuat(dir, nrm), len };
  };
  for (const s of [1, -1]) {
    const shoulder = V(s * rx * 0.8, ry * 0.45, rz * 0.4);
    const arm = V(s * 0.95, 0.28, 0.12).normalize();
    const armLen = wl * 0.55;
    const group = s > 0 ? 'wingL' : 'wingR';
    // primaries (long flight feathers, underneath)
    for (let j = 0; j < 8; j++) {
      const tipZ = -rz * 0.95 - wl * (0.42 - 0.035 * j);
      const f = folded(s, ry * (0.42 - 0.03 * j), -rz * (0.1 + 0.035 * j), ry * (0.3 - 0.05 * j), tipZ, 0.004 + 0.0012 * (8 - j));
      const th = 0.22 + j * 0.13;
      addFeather({
        group, side: s, shoulder,
        pf: f.root, qf: f.q,
        po: shoulder.clone().addScaledVector(arm, armLen * (0.86 + 0.02 * j)),
        qo: featherQuat(V(s * Math.cos(th), -0.03, -Math.sin(th)), V(0, 1, 0)),
        len: f.len, lenOpen: wl * (0.66 - 0.022 * j), width: ry * 0.42,
        color: pal.wing, tip: pal.wingTip, tipStart: 0.45, flutter: 1,
      });
    }
    // secondaries
    for (let k = 0; k < 6; k++) {
      const f = folded(s, ry * (0.5 - 0.06 * k), rz * (0.28 - 0.11 * k), ry * (0.12 - 0.04 * k), -rz * (0.62 + 0.04 * k), 0.012);
      addFeather({
        group, side: s, shoulder,
        pf: f.root, qf: f.q,
        po: shoulder.clone().addScaledVector(arm, armLen * (0.1 + 0.13 * k)),
        qo: featherQuat(V(s * 0.22, -0.06, -1), V(0, 1, 0.05)),
        len: f.len, lenOpen: wl * 0.5, width: ry * 0.62,
        color: pal.wing, tip: pal.wingBar || pal.wing, tipStart: 0.6, flutter: 0.5,
      });
    }
    // coverts (small feathers on top, at the shoulder)
    for (let k = 0; k < 7; k++) {
      const f = folded(s, ry * (0.62 - 0.07 * k), rz * (0.5 - 0.12 * k), ry * (0.32 - 0.07 * k), rz * (0.02 - 0.12 * k), 0.018);
      const patch = pal.wingPatch && k < 4;
      addFeather({
        group, side: s, shoulder,
        pf: f.root, qf: f.q,
        po: shoulder.clone().addScaledVector(arm, armLen * (0.04 + 0.11 * k)).add(V(0, 0.012, 0)),
        qo: featherQuat(V(s * 0.15, -0.04, -1), V(0, 1, 0.1)),
        len: f.len, lenOpen: wl * 0.3, width: ry * 0.62,
        color: patch ? pal.wingPatch : pal.wingCovert,
        tip: pal.wingBar || (patch ? pal.wingPatch : pal.wingCovert), tipStart: 0.62,
        flutter: 0.2,
      });
    }
  }

  // Tail
  const tl = shape.tail;
  const tailBase = V(0, -ry * 0.12, -rz * 0.9);
  for (let i = 0; i < tl.count; i++) {
    const u = (i / (tl.count - 1)) * 2 - 1;
    const au = Math.abs(u);
    let len = tl.len;
    if (tl.tip === 'pointed') len *= 1 - 0.5 * Math.pow(au, 1.2);
    else if (tl.tip === 'rounded') len *= 1 - 0.18 * u * u;
    else if (tl.tip === 'notched') len *= 0.9 + 0.12 * au;
    addFeather({
      group: 'tail', side: 0, u,
      base: tailBase.clone().add(V(u * tl.width * 0.22, (1 - au) * 0.008, 0)),
      len, width: Math.max(0.045, tl.width * 0.42),
      color: pal.tail,
      tip: pal.tailBand && au > 0.35 ? pal.tailBand : pal.tailTip,
      tipStart: pal.tailBand ? 0.5 : tipStart, flutter: 0.4,
    });
  }
  const tailFan = Math.atan2(tl.width, tl.len) * 0.7;

  // Crest (cockatiels)
  for (let i = 0; i < shape.crest; i++) {
    const u = shape.crest > 1 ? (i / (shape.crest - 1)) * 2 - 1 : 0;
    const a = 0.25 + (1 - Math.abs(u)) * 0.1 + i * 0.03;
    addFeather({
      group: 'crest', side: 0, u,
      pf: V(u * hr * 0.12, hr * 0.78, hr * (0.42 - i * 0.03)),
      dir: V(u * 0.12, Math.cos(a), -Math.sin(a)),
      normal: V(0, -Math.sin(a), -Math.cos(a)),
      len: hr * (1.7 + 0.35 * (1 - Math.abs(u))), width: 0.035,
      color: pal.crest, tip: pal.crestTip, tipStart: 0.5, flutter: 0.6,
    });
  }
  for (const f of feathers) {
    if (f.group === 'crest') {
      f.qBase = featherQuat(f.dir, f.normal);
      f.lean = 0;
    }
  }

  const fg = track(A.featherGeo.clone());
  const featherMesh = new THREE.InstancedMesh(fg, A.featherMat, feathers.length);
  featherMesh.frustumCulled = false;
  featherMesh.castShadow = true;
  featherMesh.receiveShadow = true;
  const tipAttr = new Float32Array(feathers.length * 3);
  const tipStartAttr = new Float32Array(feathers.length);
  feathers.forEach((f, i) => {
    featherMesh.setColorAt(i, f.color);
    tipAttr.set([f.tip.r, f.tip.g, f.tip.b], i * 3);
    tipStartAttr[i] = f.tipStart;
    f.scale = V(f.width, f.len, f.len);
    f.scaleO = f.lenOpen ? V(f.width, f.lenOpen, f.lenOpen) : f.scale;
    f.flutterPhase = i * 1.37;
  });
  featherMesh.instanceColor.needsUpdate = true;
  // Per-bird tip colours live on this bird's own copy of the feather geometry.
  fg.setAttribute('instanceTip', new THREE.InstancedBufferAttribute(tipAttr, 3));
  fg.setAttribute('instanceTipStart', new THREE.InstancedBufferAttribute(tipStartAttr, 1));
  root.add(featherMesh);

  // ---- leg instances: per leg [tibia, tarsus, band, toes..., claws...]
  const toeAngles = L.toes === 'zygo'
    ? [{ a: -0.28, len: 1.0 }, { a: 0.22, len: 0.9 }, { a: Math.PI - 0.35, len: 0.85 }, { a: Math.PI + 0.3, len: 0.7 }]
    : [{ a: -0.42, len: 0.85 }, { a: 0.0, len: 1.0 }, { a: 0.42, len: 0.85 }, { a: Math.PI, len: 0.65 }];
  const perLeg = 3 + toeAngles.length * 2;
  const legMesh = new THREE.InstancedMesh(A.cyl, A.legMat, perLeg * 2);
  legMesh.frustumCulled = false;
  legMesh.castShadow = true;
  const legColor = pal.legs;
  const clawColor = pal.legs.clone().multiplyScalar(0.45);
  const bandC = new THREE.Color(bandColor);
  for (let leg = 0; leg < 2; leg++) {
    const o = leg * perLeg;
    legMesh.setColorAt(o, pal.belly.clone().multiplyScalar(0.95));
    legMesh.setColorAt(o + 1, legColor);
    legMesh.setColorAt(o + 2, leg === 0 ? bandC : legColor);
    for (let t = 0; t < toeAngles.length; t++) {
      legMesh.setColorAt(o + 3 + t, legColor);
      legMesh.setColorAt(o + 3 + toeAngles.length + t, clawColor);
    }
  }
  legMesh.instanceColor.needsUpdate = true;
  root.add(legMesh);

  // ---- contact shadow
  const blob = new THREE.Mesh(A.blobGeo, A.blobMat);
  blob.scale.set(rx * 4.2, 1, rz * 3.6);
  blob.position.y = 0.004;
  blob.renderOrder = -1;
  root.add(blob);

  // ---- rest numbers the animator needs
  root.updateMatrixWorld(true);
  const neckBaseRest = neckBaseLocal.clone().applyMatrix4(bodyFrame.matrix).applyMatrix4(bodyPivot.matrix);
  const headRest = neckBaseRest.clone().add(V(...shape.head));

  const model = {
    bird, species: sp, shape, pal, S, root, bodyPivot, bodyFrame, bodyMesh, head, headMesh,
    neck, neckBaseLocal, beakLPivot, eyes, featherMesh, feathers, legMesh, blob,
    tailBase, tailFan,
    legs: { l1, l2, toeH, kneeOff, hipY, hips, toeAngles, perLeg, toeLen: L.toeLen, thick: L.thick, width: L.width },
    rest: { hipY, headRest, headOffset: V(...shape.head), neckBaseRest },
    dispose() {
      root.removeFromParent();
      for (const g of geos) g.dispose();
      featherMesh.dispose();
      legMesh.dispose();
    },
  };
  return model;
}

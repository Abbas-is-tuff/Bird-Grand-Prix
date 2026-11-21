// Stadium dressing: stands, bird crowd, roof, floodlights, scoreboard, finish gantry,
// sponsor boards, trees, distant city and hills.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { T } from './track.js';
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
const SEAT_COLORS = ['#1d4fa0', '#1d4fa0', '#f2c230', '#1d4fa0', '#e6e6e6'];

export class Stadium {
  constructor(scene, quality) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.rng = mulberry32(2026);
    this.quality = quality;
    // the logo picture is drawn onto the scoreboard and grandstand sign once it has loaded
    this.logo = new Image();
    this.logo.onload = () => {
      if (this.lastBoard) this.drawBoard(this.lastBoard);
      if (this.drawSign) this.drawSign();
    };
    this.logo.src = LOGO_PNG;
    this.tierGeos = [];
    this.seats = []; // {x,y,z,ry}
    this.buildGround();
    this.buildBarrier();
    this.buildStands();
    this.buildCrowd();
    this.buildRoof();
    this.buildFloodlights();
    this.buildScoreboard();
    this.buildGantry();
    this.buildScenery();
  }

  buildGround() {
    const gt = groundTexture();
    const g = new THREE.CircleGeometry(1100, 64);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
    m.position.y = -0.03;
    m.receiveShadow = true;
    this.group.add(m);
  }

  buildBarrier() {
    // low wall around the outside of the track
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a3550, roughness: 0.7 });
    const pts = [];
    const steps = 220;
    const C = Math.PI * T.R;
    const lap = 2 * T.L + 2 * C;
    for (let i = 0; i <= steps; i++) pts.push((lap * i) / steps);
    const geos = [];
    const d = T.WALL + 0.12;
    const hL = T.L / 2;
    const ptAt = (s) => {
      if (s < T.L) return [-hL + s, T.R + d];
      if (s < T.L + C) { const a = (s - T.L) / T.R; return [hL + (T.R + d) * Math.sin(a), (T.R + d) * Math.cos(a)]; }
      if (s < 2 * T.L + C) { const t = s - T.L - C; return [hL - t, -(T.R + d)]; }
      const a = (s - 2 * T.L - C) / T.R; return [-hL - (T.R + d) * Math.sin(a), -(T.R + d) * Math.cos(a)];
    };
    for (let i = 0; i < steps; i++) {
      const [x0, z0] = ptAt(pts[i]);
      const [x1, z1] = ptAt(pts[i + 1]);
      // leave a gap where the 100 m chute runs through
      const midx = (x0 + x1) / 2, midz = (z0 + z1) / 2;
      if (midx < -hL && midz > T.R - 2) continue;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const b = new THREE.BoxGeometry(len + 0.05, 0.8, 0.15);
      b.rotateY(Math.atan2(-(z1 - z0), x1 - x0));
      b.translate(midx, 0.4, midz);
      geos.push(b);
    }
    // chute end wall
    const ce = new THREE.BoxGeometry(0.15, 0.8, T.WALL + 0.3);
    ce.translate(-hL - T.CHUTE - 0.2, 0.4, T.R + T.WALL / 2);
    geos.push(ce);
    const ce2 = new THREE.BoxGeometry(T.CHUTE + 0.2, 0.8, 0.15);
    ce2.translate(-hL - T.CHUTE / 2, 0.4, T.R + T.WALL + 0.12);
    geos.push(ce2);
    const wall = new THREE.Mesh(mergeGeometries(geos), wallMat);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.group.add(wall);

    // sponsor boards on both straights (facing the track)
    const boardGeo = new THREE.PlaneGeometry(5.6, 0.62);
    let k = 0;
    for (let x = -hL - 16; x < hL + 2; x += 6) {
      const mat = new THREE.MeshStandardMaterial({ map: adTexture(k++), roughness: 0.6 });
      const b = new THREE.Mesh(boardGeo, mat);
      b.position.set(x + 3, 0.42, T.R + T.WALL + 0.03);
      b.rotation.y = Math.PI;
      this.group.add(b);
    }
    for (let x = -hL + 1; x < hL; x += 6) {
      const mat = new THREE.MeshStandardMaterial({ map: adTexture(k++), roughness: 0.6 });
      const b = new THREE.Mesh(boardGeo, mat);
      b.position.set(x + 3, 0.42, -(T.R + T.WALL + 0.03));
      this.group.add(b);
    }
  }

  // Stepped concrete tiers + seat positions
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
    // back wall
    const hb = base + rows * rise + 2.2;
    const g = new THREE.BoxGeometry(x1 - x0, hb, 0.6);
    g.translate((x0 + x1) / 2, hb / 2, z0 + dir * (rows * rowDepth + 0.3));
    this.tierGeos.push(g);
    return { top: base + rows * rise, back: z0 + dir * rows * rowDepth };
  }

  bendStand(cx, sideSign, r0, a0, a1, rows, rowDepth = 0.9, rise = 0.48, base = 1.1) {
    const segs = 30;
    const pos = (r, a) => sideSign > 0 ? [cx + r * Math.sin(a), r * Math.cos(a)] : [cx - r * Math.sin(a), -r * Math.cos(a)];
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

  buildStands() {
    const hL = T.L / 2;
    const zIn = T.R + T.WALL + 4.6;
    this.mainStand = this.straightStand(-hL - 18, hL + 14, zIn, 1, 18);
    this.backStand = this.straightStand(-hL + 2, hL - 2, -zIn, -1, 11);
    const rB = T.R + T.WALL + 4.6;
    this.bendStand(hL, 1, rB, 0.42, Math.PI - 0.3, 10);
    this.bendStand(-hL, -1, rB, 0.3, Math.PI - 0.62, 10);
    const mat = new THREE.MeshStandardMaterial({ map: concreteTexture(), color: 0xb8b8b2, roughness: 0.92 });
    const tiers = new THREE.Mesh(mergeGeometries(this.tierGeos), mat);
    tiers.castShadow = true;
    tiers.receiveShadow = true;
    this.group.add(tiers);
    for (const g of this.tierGeos) g.dispose();
    this.tierGeos = [];

    // seats (instanced)
    const seatGeo = new THREE.BoxGeometry(0.55, 0.2, 0.5);
    seatGeo.translate(0, 0.1, 0);
    const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const seats = new THREE.InstancedMesh(seatGeo, seatMat, this.seats.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    this.seats.forEach((s, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.ry);
      m.compose(new THREE.Vector3(s.x, s.y, s.z), q, new THREE.Vector3(1, 1, 1));
      seats.setMatrixAt(i, m);
      seats.setColorAt(i, c.set(SEAT_COLORS[s.block % SEAT_COLORS.length]));
    });
    seats.receiveShadow = true;
    this.group.add(seats);
  }

  buildCrowd() {
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
    const target = { low: 700, medium: 1800, high: 4200 }[this.quality] || 1800;
    const prob = Math.min(1, target / this.seats.length);
    const chosen = this.seats.filter(() => this.rng() < prob);
    const mat = crowdify(new THREE.MeshStandardMaterial({ roughness: 0.85 }));
    const beakMat = crowdify(new THREE.MeshStandardMaterial({ color: 0xe8b04a, roughness: 0.5 }));
    const crowd = new THREE.InstancedMesh(crowdGeo, mat, chosen.length);
    const beaks = new THREE.InstancedMesh(beakGeo, beakMat, chosen.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    const up = new THREE.Vector3(0, 1, 0);
    chosen.forEach((s, i) => {
      const sc = 0.85 + this.rng() * 0.4;
      q.setFromAxisAngle(up, s.ry + (this.rng() - 0.5) * 0.5);
      m.compose(new THREE.Vector3(s.x, s.y + 0.08, s.z), q, new THREE.Vector3(sc, sc, sc));
      crowd.setMatrixAt(i, m);
      beaks.setMatrixAt(i, m);
      crowd.setColorAt(i, c.set(CROWD_COLORS[Math.floor(this.rng() * CROWD_COLORS.length)]).multiplyScalar(0.85 + this.rng() * 0.3));
    });
    crowd.frustumCulled = false;
    beaks.frustumCulled = false;
    this.group.add(crowd, beaks);
    this.crowd = crowd;
  }

  buildRoof() {
    const hL = T.L / 2;
    const ms = this.mainStand;
    const zIn = T.R + T.WALL + 4.6;
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
    // grandstand name sign (logo + stadium name)
    const sign = document.createElement('canvas');
    sign.width = 1024;
    sign.height = 96;
    const ctx = sign.getContext('2d');
    const tex = new THREE.CanvasTexture(sign);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.drawSign = () => {
      ctx.fillStyle = '#0d1a33';
      ctx.fillRect(0, 0, 1024, 96);
      let x = 512;
      ctx.textAlign = 'center';
      if (this.logo.complete && this.logo.naturalWidth) {
        ctx.drawImage(this.logo, 30, 4, 264, 88);
        x = 640;
      }
      ctx.fillStyle = '#ffc93c';
      ctx.font = 'italic 900 58px Arial, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(x === 512 ? 'BIRD GRAND PRIX  •  FEATHERFIELD STADIUM' : 'FEATHERFIELD STADIUM', x, 52);
      tex.needsUpdate = true;
    };
    this.drawSign();
    const s = new THREE.Mesh(new THREE.PlaneGeometry(42, 3.9), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    s.position.set(0, ms.top + 5.6, zIn - 1.0);
    s.rotation.y = Math.PI;
    this.group.add(s);
  }

  buildFloodlights() {
    this.lampMats = [];
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
    for (const m of this.lampMats) m.emissiveIntensity = on ? 3.2 : 0.15;
  }

  buildScoreboard() {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 512;
    this.boardCanvas = c;
    this.boardCtx = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.boardTex = tex;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.6, metalness: 0.3 });
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 15, 28), frameMat);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(26, 13), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    screen.rotation.y = Math.PI / 2;
    screen.position.x = 0.62;
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), frameMat);
    leg1.position.set(0, -13, 8);
    const leg2 = leg1.clone();
    leg2.position.z = -8;
    g.add(frame, screen, leg1, leg2);
    g.position.set(-T.L / 2 - T.R - T.WALL - 24, 19, 0);
    this.group.add(g);
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
      if (this.logo.complete && this.logo.naturalWidth) {
        ctx.drawImage(this.logo, 512 - 330, 118, 660, 220);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'italic 900 80px Arial, sans-serif';
        ctx.fillText('FEATHERFIELD', 512, 280);
      }
      ctx.fillStyle = '#9fb3c8';
      ctx.font = 'bold 40px Arial, sans-serif';
      ctx.fillText(SPONSORS[0].name + '  •  ' + SPONSORS[3].name + '  •  ' + SPONSORS[6].name, 512, 380);
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
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.0, 5.9), mat);
      back.position.set(x, h + 1.3, (z0 + z1) / 2);
      this.group.add(back);
    }
    // photo-finish camera post in the infield
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

  buildScenery() {
    const rng = this.rng;
    // trees
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
    const nTrees = this.quality === 'low' ? 70 : 170;
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), nTrees);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), nTrees);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let i = 0; i < nTrees; i++) {
      const a = rng() * Math.PI * 2;
      const r = 128 + rng() * 70;
      const x = Math.cos(a) * r * 1.25, z = Math.sin(a) * r;
      const s = 0.8 + rng() * 0.9;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * 6);
      m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, c.setHSL(0.24 + rng() * 0.08, 0.45 + rng() * 0.2, 0.22 + rng() * 0.12));
    }
    leaves.castShadow = true;
    this.group.add(trunks, leaves);

    // distant city
    const winTex = windowsTexture();
    const bGeos = [];
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * Math.PI * 2 + rng() * 0.08;
      const r = 300 + rng() * 140;
      const w = 14 + rng() * 22, d = 14 + rng() * 18, h = 18 + rng() * 70;
      const g = new THREE.BoxGeometry(w, h, d);
      const uv = g.attributes.uv;
      for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * (w / 12), uv.getY(j) * (h / 18));
      g.rotateY(-a);
      g.translate(Math.cos(a) * r * 1.2, h / 2, Math.sin(a) * r);
      bGeos.push(g);
    }
    const city = new THREE.Mesh(mergeGeometries(bGeos), new THREE.MeshStandardMaterial({ map: winTex, roughness: 0.7, metalness: 0.15 }));
    this.cityMat = city.material;
    this.group.add(city);

    // hills on the horizon
    const segs = 96;
    const pos = [];
    const idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const h = 40 + 35 * Math.sin(a * 3 + 1) + 25 * Math.sin(a * 7 + 2) + 14 * Math.sin(a * 13);
      pos.push(Math.cos(a) * 640, -1, Math.sin(a) * 640, Math.cos(a) * 900, Math.max(10, h), Math.sin(a) * 900);
      if (i > 0) {
        const o = i * 2;
        idx.push(o - 2, o, o - 1, o - 1, o, o + 1);
      }
    }
    const hg = new THREE.BufferGeometry();
    hg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hg.setIndex(idx);
    hg.computeVertexNormals();
    const hills = new THREE.Mesh(hg, new THREE.MeshStandardMaterial({ color: 0x4d6b45, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
    this.group.add(hills);
  }

  update(dt, time) {
    crowdUniforms.uTime.value = time;
  }
}


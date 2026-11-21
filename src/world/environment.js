// Sky, sun/floodlight lighting, fog, shadows and time-of-day presets.
import * as THREE from 'three';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;

const skyFrag = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunSize;
uniform float uClouds; uniform vec3 uCloudColor; uniform float uTime; uniform float uStars;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(0.0, 0.65, h), 0.6));
  col = mix(col, uBottom, smoothstep(0.0, -0.25, h));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 1600.0) * 40.0 * uSunSize + (pow(sd, 18.0) * 0.35 + pow(sd, 4.0) * 0.12) * (0.2 + 0.8 * min(uSunSize, 1.0)));
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.12) * 0.9 + vec2(uTime * 0.004, uTime * 0.001);
    float n = fbm(uv * 1.7);
    float c = smoothstep(0.5, 0.82, n) * uClouds * smoothstep(0.0, 0.18, h);
    vec3 cc = uCloudColor * (0.85 + 0.3 * fbm(uv * 3.1 + 4.0)) + uSunColor * pow(sd, 6.0) * 0.4;
    col = mix(col, cc, c);
    if (uStars > 0.0) {
      vec2 g = floor(d.xz / (h + 0.3) * 260.0);
      float s = step(0.9965, hash(g)) * uStars * smoothstep(0.05, 0.4, h) * (1.0 - c);
      col += vec3(s);
    }
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const TIME_PRESETS = {
  day: {
    sun: [0.42, 0.8, 0.43], sunColor: '#fff3e0', sunIntensity: 3.1,
    hemiSky: '#bcd6ff', hemiGround: '#6d7a50', hemiIntensity: 1.05,
    top: '#3a78cc', horizon: '#cfe2f3', bottom: '#8aa0a8', fog: '#c2d6e6', fogNear: 180, fogFar: 950,
    clouds: 0.55, cloudColor: '#ffffff', sunSize: 1, stars: 0, exposure: 1.0, night: false,
  },
  sunset: {
    sun: [-0.85, 0.24, 0.45], sunColor: '#ffb478', sunIntensity: 2.8,
    hemiSky: '#b4b8e6', hemiGround: '#6a5442', hemiIntensity: 1.05,
    top: '#283f78', horizon: '#f6a15c', bottom: '#6a5a58', fog: '#d6a07a', fogNear: 150, fogFar: 850,
    clouds: 0.5, cloudColor: '#f3b8a0', sunSize: 1.4, stars: 0, exposure: 1.12, night: false,
  },
  indoor: {
    sun: [0.12, 1, 0.08], sunColor: '#fff6ea', sunIntensity: 2.8,
    hemiSky: '#fff1e0', hemiGround: '#5a4a60', hemiIntensity: 1.5,
    top: '#0c0e14', horizon: '#141822', bottom: '#0c0e14', fog: '#11141c', fogNear: 170, fogFar: 700,
    clouds: 0, cloudColor: '#000000', sunSize: 0, stars: 0, exposure: 1.05, night: true, indoor: true,
  },
  night: {
    sun: [0.22, 0.93, 0.28], sunColor: '#eef2ff', sunIntensity: 2.5,
    hemiSky: '#3a4a70', hemiGround: '#22221c', hemiIntensity: 0.7,
    top: '#03060f', horizon: '#142039', bottom: '#0a0d14', fog: '#0e1528', fogNear: 120, fogFar: 700,
    clouds: 0.15, cloudColor: '#26324c', sunSize: 0, stars: 1, exposure: 1.08, night: true,
  },
};

export class Environment {
  constructor(scene, renderer, quality) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;

    const skyGeo = new THREE.SphereGeometry(1500, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunColor: { value: new THREE.Color() }, uSunSize: { value: 1 },
        uClouds: { value: 0.5 }, uCloudColor: { value: new THREE.Color() }, uTime: { value: 0 }, uStars: { value: 0 },
      },
    });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    scene.add(this.sky);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = quality !== 'low';
    const size = quality === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    const sc = this.sun.shadow.camera;
    sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 320;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    scene.fog = new THREE.Fog(0xffffff, 150, 900);
  }

  apply(presetId, stadium, venue = null) {
    if (venue?.indoor) presetId = 'indoor';
    if (!venue?.indoor && presetId === 'indoor') presetId = 'day';
    const p = Object.assign({}, TIME_PRESETS[presetId] || TIME_PRESETS.day, venue?.sky?.[presetId] || {});
    this.sky.visible = !p.indoor;
    this.scene.background = p.indoor ? new THREE.Color(p.fog) : null;
    this.preset = p;
    const u = this.skyMat.uniforms;
    u.uTop.value.set(p.top);
    u.uHorizon.value.set(p.horizon);
    u.uBottom.value.set(p.bottom);
    u.uSunColor.value.set(p.sunColor);
    u.uSunSize.value = p.sunSize;
    u.uClouds.value = p.clouds;
    u.uCloudColor.value.set(p.cloudColor);
    u.uStars.value = p.stars;
    this.sunDir.set(...p.sun).normalize();
    u.uSunDir.value.copy(this.sunDir);
    this.sun.color.set(p.sunColor);
    this.sun.intensity = p.sunIntensity;
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.scene.fog.color.set(p.fog);
    this.scene.fog.near = p.fogNear;
    this.scene.fog.far = p.fogFar;
    this.renderer.toneMappingExposure = p.exposure;
    if (stadium) {
      stadium.setNight(p.night);
      if (stadium.cityMat) stadium.cityMat.emissive?.set(p.night ? 0x332a10 : 0x000000);
    }
  }

  // Shadows follow the action so they stay sharp near the camera focus.
  update(dt, time, focus) {
    this.skyMat.uniforms.uTime.value = time;
    if (focus) {
      this.sun.target.position.set(focus.x, 0, focus.z);
      this.sun.position.set(focus.x + this.sunDir.x * 140, this.sunDir.y * 140, focus.z + this.sunDir.z * 140);
    }
  }

  followCamera(camera) {
    this.sky.position.copy(camera.position);
  }
}

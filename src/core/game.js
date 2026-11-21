// The Game: owns the renderer, world, menus and the current race, and runs the main loop.
import * as THREE from 'three';
import { settings, resolvedQuality, submitTime, isTouch } from './settings.js';
import { clamp, shuffle, formatTime, ordinal } from './utils.js';
import { Environment } from '../world/environment.js';
import { TrackMesh } from '../world/trackMesh.js';
import { Stadium, crowdUniforms } from '../world/stadium.js';
import { setMaxAnisotropy } from '../world/textures.js';
import { T, laneCenter, surfaceAt } from '../world/track.js';
import { CameraDirector } from '../camera/cameraDirector.js';
import { Input } from '../input/input.js';
import { AudioEngine } from '../audio/audio.js';
import { HUD } from '../ui/hud.js';
import { Menus } from '../ui/menus.js';
import { renderPortraits } from '../ui/portraits.js';
import { CareerUI } from '../ui/careerUI.js';
import { Career } from '../career/career.js';
import { Race } from '../race/race.js';
import { BirdBody } from '../birds/birdPhysics.js';
import { Commentary } from '../race/commentary.js';
import { ROSTER, BIRDS } from '../data/roster.js';
import { createBirdModel } from '../birds/birdModel.js';
import { BirdAnimator } from '../birds/birdAnimator.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

export class Game {
  constructor(container) {
    this.container = container;
    this.quality = resolvedQuality();
    this.state = 'loading';
    this.time = 0;
    this.paused = false;
    this.fpsSmooth = 60;
    this.timeScale = 1; // debug/testing: speeds up game time
    this.BirdBody = BirdBody; // debug access
  }

  setLoad(frac, text) {
    document.getElementById('loadfill').style.width = Math.round(frac * 100) + '%';
    if (text) document.getElementById('loadtext').textContent = text;
  }

  async init() {
    const q = this.quality;
    const renderer = new THREE.WebGLRenderer({ antialias: q !== 'low', powerPreference: 'high-performance' });
    const dpr = window.devicePixelRatio || 1;
    renderer.setPixelRatio(Math.min(dpr, q === 'high' ? 2 : q === 'medium' ? 1.5 : 1));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(renderer.domElement);
    this.renderer = renderer;
    setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

    const scene = new THREE.Scene();
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.12, 2600);
    this.director = new CameraDirector(this.camera);

    this.setLoad(0.1, 'Painting the track…');
    await nextFrame();
    this.env = new Environment(scene, renderer, q);
    this.track = new TrackMesh(scene);
    this.setLoad(0.35, 'Building the grandstands…');
    await nextFrame();
    this.stadium = new Stadium(scene, q);
    this.env.apply(settings.lastTime || 'day', this.stadium);
    this.setLoad(0.6, 'Waking up the birds…');
    await nextFrame();

    this.input = new Input();
    this.input.bindTouchButtons(document.getElementById('touch'));
    this.audio = new AudioEngine(settings);
    this.hud = new HUD();
    this.menus = new Menus(this);
    this.career = Career.load();
    this.careerUI = new CareerUI(this);
    try {
      this.menus.portraits = renderPortraits(renderer, ROSTER);
    } catch (e) {
      console.warn('Portraits failed', e);
    }
    this.setLoad(0.9, 'Warming up…');
    await nextFrame();

    document.getElementById('cam-btn').addEventListener('click', () => this.cycleCamera());
    document.getElementById('pause-btn').addEventListener('click', () => this.pause());
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'race' && !this.paused) this.pause();
    });
    // skip intro with a tap
    renderer.domElement.addEventListener('pointerdown', () => {
      this.audio.unlock();
      if (this.race && this.race.phase === 'intro') this.race.skipIntro();
    });

    this.previewBird(this.menus.sel.bird);
    this.toMenu();
    this.director.pos.set(T.FINISH_X - 2, 1.4, T.R + 8);
    this.director.look.set(T.FINISH_X - 6, 0.5, T.R + 4.3);
    this.setLoad(1, 'Ready!');
    this.lastT = performance.now();
    renderer.setAnimationLoop(() => this.loop());
    this.menus.show('menu');
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- menu preview bird
  previewBird(id) {
    if (this.preview?.id === id) return;
    if (this.preview) {
      this.preview.model.dispose();
      this.preview = null;
    }
    const model = createBirdModel(BIRDS[id]);
    const anim = new BirdAnimator(model);
    const x = T.FINISH_X - 6, z = T.R + laneCenter(4);
    anim.reset(x, z, Math.PI / 2 + 0.3);
    this.scene.add(model.root);
    this.preview = { id, model, anim, x, z, h: Math.PI / 2 + 0.3, size: model.species.size };
  }

  previewTime(id) {
    this.env.apply(id, this.stadium);
  }

  toMenu() {
    this.state = 'menu';
    this.hud.show(false);
    if (!this.preview) this.previewBird(this.menus.sel.bird);
    this.preview.model.root.visible = true;
    this.stadium.drawBoard({ title: 'WELCOME', time: null, rows: [] });
    this.stadium.drawGantry(null);
  }

  // ---------------------------------------------------------------- race lifecycle
  startCareerRace(ev) {
    const c = this.career;
    this.menus.hideAll();
    this.startRace({
      bird: c.birdId, race: ev.raceId, time: ev.time,
      difficulty: ['easy', 'normal', 'hard', 'hard'][c.tierIndex],
      opponents: ev.field.slice(), oppSpeed: ev.oppSpeed.slice(),
      playerBonus: c.raceModifiers(), careerEventId: ev.id,
    });
  }

  continueCareer() {
    this.disposeRace();
    this.audio.stopSpeech();
    this.toMenu();
    this.careerUI.open('home');
    if (this.lastCareerSum) this.careerUI.afterWeek(this.lastCareerSum);
    this.lastCareerSum = null;
  }

  startRace(opts) {
    this.lastOpts = opts;
    this.careerRecorded = false;
    if (opts.difficulty === 'solo') opts.opponents = [];
    if (!opts.opponents) {
      opts.opponents = shuffle(ROSTER.filter((b) => b.id !== opts.bird).map((b) => b.id)).slice(0, 5);
    }
    this.disposeRace();
    if (this.preview) this.preview.model.root.visible = false;
    this.env.apply(opts.time, this.stadium);
    const race = new Race({
      scene: this.scene, input: this.input, raceId: opts.race, playerBirdId: opts.bird,
      opponentIds: opts.opponents, difficulty: opts.difficulty, oppSpeed: opts.oppSpeed || null, playerBonus: opts.playerBonus || null,
    });
    this.race = race;
    this.track.setRaceMarkings(race.def, race.lanesUsed, (k) => race.startPoint(k));
    this.hud.reset(race);
    this.hud.show(true);
    this.commentary = new Commentary(race, this.audio, this.hud);
    this.director.setMode(this.director.mode || 'chase');
    this.director.cutNext = true;
    this.hud.setCameraName(this.director.modeName);
    this.state = 'race';
    this.paused = false;
    this.boardTimer = 0;
    this.crowdTimer = 0;
    this.resultsShown = false;

    // footsteps
    for (const r of race.racers) {
      r.anim.onStep = (i, strength) => {
        const d = this.camera.position.distanceTo(r.model.root.position);
        const vol = clamp(1 - d / 26, 0, 1) * strength * (r.isPlayer ? 1 : 0.8);
        if (vol > 0.03) this.audio.footstep(vol, 1.25 / Math.sqrt(r.species.size), surfaceAt(r.body.x, r.body.z, race.inStraightZone(r)).kind);
      };
    }
    race.on('phase', (p) => this.onPhase(p));
    race.on('gun', () => {
      this.hud.big('GO!', 'gold', 0.9);
      this.hud.hideHint();
    });
    race.on('falseStart', ({ racer, dq }) => {
      this.hud.big('FALSE START', 'red', 2.2);
      if (racer.isPlayer) this.hud.hint(dq ? 'Disqualified! Two false starts.' : 'Wait for the gun before pressing RUN or SPRINT.', 3);
    });
    race.on('finish', (r) => {
      if (r.isPlayer) {
        this.hud.big(r.place === 1 ? 'WINNER!' : ordinal(r.place), r.place === 1 ? 'gold' : '', 2.5);
        if (r.place === 1) setTimeout(() => this.audio.flap(0.3), 900);
      }
    });
    race.on('dq', (r) => {
      if (r.isPlayer) {
        this.hud.big('DISQUALIFIED', 'red', 2.5);
        this.hud.hint('You stepped inside your lane on the bend.', 3);
      }
    });
    race.on('results', (res) => this.showResults(res));
    this.onPhase('intro');
  }

  onPhase(p) {
    const touch = isTouch;
    if (p === 'intro') {
      this.hud.hint(touch ? 'Tap the screen to skip the introduction' : 'Click or press Enter to skip the introduction', 4);
    } else if (p === 'marks') {
      this.hud.big('ON YOUR MARKS', '', 1.6);
      this.hud.hint(touch ? 'Wait for the gun… then hold RUN (or SPRINT)' : 'Wait for the gun… then hold W (run) or SHIFT (sprint)', 4.5);
      this.audio.beep(false);
    } else if (p === 'set') {
      this.hud.big('SET', '', 1.0);
      this.audio.beep(false);
    }
  }

  restartRace() {
    if (!this.lastOpts || this.lastOpts.careerEventId) return;
    this.menus.hideAll();
    this.startRace(Object.assign({}, this.lastOpts));
  }

  quitRace(keepPreview = false) {
    const careerRace = this.lastOpts?.careerEventId && this.race;
    if (careerRace && !this.careerRecorded && this.career) {
      // leaving a career race early counts as "did not finish"
      this.careerRecorded = true;
      this.lastCareerSum = this.career.recordRace(this.lastOpts.careerEventId, null);
    }
    if (careerRace) {
      this.continueCareer();
      return;
    }
    this.disposeRace();
    this.audio.stopSpeech();
    this.menus.show(keepPreview ? 'setup' : 'menu');
    this.toMenu();
  }

  disposeRace() {
    if (this.race) {
      this.race.dispose();
      this.race = null;
    }
    this.paused = false;
  }

  pause() {
    if (this.state !== 'race' || this.paused) return;
    this.paused = true;
    this.audio.stopSpeech();
    this.menus.show('pause');
  }

  resume() {
    this.paused = false;
    this.menus.hideAll();
    if (this.resultsShown) this.menus.show('results');
  }

  cycleCamera() {
    const name = this.director.cycle();
    this.hud.setCameraName(name);
    this.hud.ticker(`Camera: ${name}`);
  }

  showResults(res) {
    this.resultsShown = true;
    let pbInfo = null;
    const p = res.player;
    if (p && p.time != null && !p.dq) pbInfo = submitTime(p.racer.bird.id, p.racer.name, res.def.id, p.time);
    let careerSum = null;
    if (this.lastOpts?.careerEventId && this.career && !this.careerRecorded) {
      this.careerRecorded = true;
      careerSum = this.career.recordRace(this.lastOpts.careerEventId, res);
      this.lastCareerSum = careerSum;
    }
    this.menus.showResults(res, pbInfo, careerSum);
  }

  // ---------------------------------------------------------------- main loop
  loop() {
    const now = performance.now();
    const dtRaw = Math.max(0, (now - this.lastT) / 1000);
    this.lastT = now;
    const dt = Math.min(dtRaw, 1 / 20) * this.timeScale;
    this.time += dt;
    if (dtRaw > 0) this.fpsSmooth += (1 / dtRaw - this.fpsSmooth) * 0.05;
    const inp = this.input;
    if (inp.consume('pause')) {
      if (this.state === 'race') this.paused ? this.resume() : this.pause();
    }
    if (inp.consume('camera') && this.state === 'race') this.cycleCamera();
    if (inp.consume('skip') && this.race?.phase === 'intro') this.race.skipIntro();
    if (inp.anyPress) this.audio.unlock();

    let focus;
    let special = null;
    let ctxExtra = {};
    if (this.state === 'race' && this.race) {
      const race = this.race;
      if (!this.paused) race.update(dt);
      let fr = race.player;
      if (fr.dq === 'False start' && race.standings.length) fr = race.standings[0];
      if (race.phase === 'done') {
        const winner = race.finishOrder[0];
        if (winner && race.phaseTime > 0.4) {
          fr = winner;
          special = 'celebrate';
        }
      }
      if (race.phase === 'intro') {
        special = 'intro';
        ctxExtra = { group: race.racers.map((r) => r.body), phaseTime: race.phaseTime };
      }
      const b = fr.body;
      focus = { x: b.x, z: b.z, h: b.h, vx: b.vx, vz: b.vz, speed: b.speed, size: fr.species.size };
      this.hud.update(dt, race, settings.showFps ? this.fpsSmooth : null);
      this.updateTags(race);
      crowdUniforms.uExcite.value = race.excitement;
      this.crowdTimer -= dt;
      if (this.crowdTimer <= 0) {
        this.crowdTimer = 0.2;
        this.audio.setCrowd(this.paused ? 0.05 : race.excitement);
      }
      this.boardTimer -= dt;
      if (this.boardTimer <= 0) {
        this.boardTimer = 0.5;
        this.updateBoards(race);
      }
    } else if (this.preview) {
      const pv = this.preview;
      pv.anim.update(dt, { x: pv.x, z: pv.z, h: pv.h, vx: 0, vz: 0, speed: 0, accel: 0, latAcc: 0, yawRate: 0, slip: 0 }, 'idle');
      focus = { x: pv.x, z: pv.z, h: pv.h, vx: 0, vz: 0, speed: 0, size: pv.size };
      special = 'menu';
      crowdUniforms.uExcite.value = 0.15;
      this.crowdTimer = (this.crowdTimer || 0) - dt;
      if (this.crowdTimer <= 0) {
        this.crowdTimer = 0.3;
        this.audio.setCrowd(0.12);
      }
    }
    if (this.debugView) {
      const v = this.debugView;
      this.camera.position.set(...v.pos);
      this.camera.lookAt(...v.look);
      this.camera.fov = v.fov || 40;
      this.camera.updateProjectionMatrix();
      this.env.update(dt, this.time, focus);
    } else if (focus) {
      const cur = this.menus.current;
      const wide = window.innerWidth > 700;
      this.director.shiftTarget = this.state === 'race' || !wide ? 0 : cur === 'setup' || cur === 'career' ? 0.24 : cur === 'menu' ? -0.16 : 0;
      this.director.update(dt, Object.assign({ focus, special }, ctxExtra));
      this.env.update(dt, this.time, focus);
    }
    this.env.followCamera(this.camera);
    this.stadium.update(dt, this.time);
    this.audio.ready && this.audio.frame(dt);
    this.renderer.render(this.scene, this.camera);
    inp.endFrame();
  }

  updateTags(race) {
    const cam = this.camera.position;
    const mode = this.director.activeShot;
    for (const r of race.racers) {
      let show = settings.nameTags && race.phase !== 'done';
      if (r.isPlayer && (mode === 'chase' || mode === 'bird')) show = false;
      const d = cam.distanceTo(r.tag.position);
      if (d < 2.2 || d > 60) show = false;
      r.tag.visible = show;
      if (show) {
        const s = clamp(d / 22, 0.45, 1.25);
        r.tag.scale.set(1.2 * s, 0.3 * s, 1);
      }
    }
  }

  updateBoards(race) {
    const rows = race.standings.map((r) => ({
      name: r.name, number: r.bird.number, color: r.bandColor, isPlayer: r.isPlayer,
      info: r.dq ? 'DQ' : r.finished ? formatTime(r.finishTime) : '',
    }));
    const t = race.phase === 'running' || race.phase === 'done'
      ? (race.finishOrder[0] ? race.finishOrder[0].finishTime : race.raceTime)
      : null;
    this.stadium.drawBoard({ title: race.def.name.toUpperCase(), time: t, rows });
    this.stadium.drawGantry(race.phase === 'running' && !race.finishOrder.length ? race.raceTime : t);
  }
}

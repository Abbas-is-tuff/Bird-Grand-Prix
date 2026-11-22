// The Game: owns the renderer, world, menus and the current race, and runs the main loop.
import * as THREE from 'three';
import { settings, resolvedQuality, submitTime, isTouch } from './settings.js';
import { clamp, shuffle, formatTime, ordinal } from './utils.js';
import { Environment } from '../world/environment.js';
import { TrackMesh } from '../world/trackMesh.js';
import { Stadium, crowdUniforms } from '../world/stadium.js';
import { setMaxAnisotropy } from '../world/textures.js';
import { T, laneCenter, surfaceAt, setSurface } from '../world/track.js';
import { VENUES, HOME_VENUE } from '../data/venues.js';
import { CameraDirector } from '../camera/cameraDirector.js';
import { Input } from '../input/input.js';
import { AudioEngine } from '../audio/audio.js';
import { HUD } from '../ui/hud.js';
import { Menus } from '../ui/menus.js';
import { renderPortraits } from '../ui/portraits.js';
import { CareerUI } from '../ui/careerUI.js';
import { GarageUI } from '../ui/garageUI.js';
import { MultiplayerUI } from '../ui/multiplayerUI.js';
import { OnlineSession, NetController } from '../net/online.js';
import { Career } from '../career/career.js';
import { DRILLS, scoreDrill } from '../career/drills.js';
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
    this.timeId = settings.lastTime || 'day';
    this.buildVenue(VENUES[settings.lastVenue] ? settings.lastVenue : HOME_VENUE);
    this.setLoad(0.6, 'Waking up the birds…');
    await nextFrame();

    this.input = new Input();
    this.input.bindTouchButtons(document.getElementById('touch'));
    this.input.bindTouchButtons(document.getElementById('touch2'));
    this.audio = new AudioEngine(settings);
    this.hud = new HUD();
    this.menus = new Menus(this);
    this.career = Career.load();
    this.careerUI = new CareerUI(this);
    this.garageUI = new GarageUI(this);
    this.online = new OnlineSession(this);
    this.multiUI = new MultiplayerUI(this);
    this.online.on('go', (g) => this.startOnlineRace(g));
    try {
      this.menus.portraits = renderPortraits(renderer, ROSTER);
    } catch (e) {
      console.warn('Portraits failed', e);
    }
    this.setLoad(0.9, 'Warming up…');
    await nextFrame();

    document.getElementById('cam-btn').addEventListener('click', () => this.cycleCamera());
    document.getElementById('pause-btn').addEventListener('click', () => this.pause());
    // fast-forward for long races (800 m and up): 1x -> 2x -> 4x
    document.getElementById('ff-btn').addEventListener('click', () => {
      if (!this.race || this.race.online) return;
      this.timeScale = this.timeScale >= 4 ? 1 : this.timeScale * 2;
      document.getElementById('ff-x').textContent = `${this.timeScale}×`;
    });
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
  previewBird(id, force = false) {
    if (this.preview?.id === id && !force) return;
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

  // Build the scenery, track surface and lighting for a venue (replaces the old one).
  buildVenue(id) {
    const v = VENUES[id] || VENUES[HOME_VENUE];
    if (this.stadium) this.stadium.dispose();
    this.stadium = new Stadium(this.scene, this.quality, v);
    this.track.setVenue(v);
    setSurface(v.track, v.ground);
    this.venueId = v.id;
    this.venue = v;
    this.env.apply(this.timeId, this.stadium, v);
  }

  // Switch venue with a short "travelling" card while the new place is built.
  async setVenue(id, text) {
    if (this.venueId === id && this.stadium) return;
    const v = VENUES[id];
    this.menus.travelCard(text || `${v.icon} ${v.name}`, true);
    await nextFrame();
    await nextFrame();
    this.buildVenue(id);
    await nextFrame();
    this.menus.travelCard(null, false);
  }

  previewTime(id) {
    this.timeId = id;
    this.env.apply(id, this.stadium, this.venue);
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
  async startCareerRace(ev) {
    const c = this.career;
    this.menus.hideAll();
    await this.startRace({
      bird: c.birdId, race: ev.raceId, time: ev.time, venue: ev.venue,
      difficulty: ['easy', 'normal', 'hard', 'hard'][c.tierIndex],
      opponents: ev.field.slice(), oppSpeed: ev.oppSpeed.slice(),
      playerBonus: c.raceModifiers(), careerEventId: ev.id,
    });
  }

  // Training: play the drill for this session on the track.
  async startDrill(type, coach) {
    const c = this.career;
    this.menus.hideAll();
    await this.startRace({
      bird: c.birdId, race: DRILLS[type].id, raceDef: DRILLS[type], time: 'day', difficulty: 'solo', venue: c.location,
      opponents: [], playerBonus: c.raceModifiers(), drill: type, coach,
    });
    this.race.skipIntro();
  }

  continueCareer() {
    const tab = this.lastOpts?.drill ? 'train' : 'home';
    this.disposeRace();
    this.audio.stopSpeech();
    this.toMenu();
    this.careerUI.open(tab);
    if (this.lastCareerSum) this.careerUI.afterWeek(this.lastCareerSum);
    this.lastCareerSum = null;
  }

  async startRace(opts) {
    this.lastOpts = opts;
    if (opts.venue && opts.venue !== this.venueId) {
      this.disposeRace();
      this.hud.show(false);
      await this.setVenue(opts.venue, `${VENUES[opts.venue].icon} Travelling to ${VENUES[opts.venue].name}…`);
    }
    this.careerRecorded = false;
    if (opts.difficulty === 'solo') opts.opponents = [];
    if (opts.online) opts.opponents = [];
    if (!opts.opponents) {
      opts.opponents = shuffle(ROSTER.filter((b) => b.id !== opts.bird).map((b) => b.id)).slice(0, 5);
    }
    this.disposeRace();
    if (this.preview) this.preview.model.root.visible = false;
    this.timeId = opts.time || this.timeId;
    this.env.apply(this.timeId, this.stadium, this.venue);
    const race = new Race({
      scene: this.scene, input: this.input, raceId: opts.raceDef || opts.race, playerBirdId: opts.bird,
      opponentIds: opts.opponents, difficulty: opts.difficulty, oppSpeed: opts.oppSpeed || null, playerBonus: opts.playerBonus || null,
      drill: opts.drill ? DRILLS[opts.drill] : null,
      ...(opts.player2 ? { player2BirdId: opts.player2, input: this.input.pad(1), input2: this.input.pad(2) } : {}),
      ...(opts.online ? {
        remotes: opts.online.remotes, lanes: { me: opts.online.lane },
        makeNetController: (r, rc) => new NetController(r, rc, this.online),
      } : {}),
    });
    if (opts.online) race.fixedSetHold = opts.online.hold;
    this.race = race;
    race.venue = this.venue;
    this.track.setRaceMarkings(race.def, race.lanesUsed, (k) => race.startPoint(k));
    this.hud.reset(race);
    this.hud.show(true);
    this.timeScale = 1;
    this.hud.root.classList.toggle('two', !!race.player2);
    document.getElementById('ff-x').textContent = '1×';
    document.getElementById('ff-btn').style.display = race.def.dist >= 800 && !race.online ? '' : 'none';
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
    race.on('eliminated', (r) => {
      this.audio.clatter?.(0.15);
      if (r.isPlayer) {
        this.hud.big('ELIMINATED', 'red', 2.5);
        this.hud.hint('You were last at the end of the lap.', 3);
      } else this.hud.hint(`${r.name} is OUT — last at the end of lap ${r.elimLap}.`, 3);
    });
    race.on('results', (res) => this.showResults(res));
    race.on('barrierHit', ({ racer }) => {
      this.audio.clatter(racer.isPlayer ? 0.5 : 0.25);
      if (racer.isPlayer) this.hud.big('OUCH!', 'red', 0.7);
    });
    race.on('barrierClear', ({ racer }) => {
      if (racer.isPlayer) this.hud.flashBarrier();
    });
    race.on('jump', (r) => this.audio.flap(0.18));
    race.emit('phase', 'intro');
  }

  onPhase(p) {
    const touch = isTouch;
    if (p === 'intro') {
      this.hud.hint(touch ? 'Tap the screen to skip the introduction' : 'Click or press Enter to skip the introduction', 4);
    } else if (p === 'marks') {
      this.hud.big(this.race?.drill ? 'TRAINING' : 'ON YOUR MARKS', '', 1.6);
      if (this.race?.drill) this.hud.hint(this.race.drill.hint + (touch ? '' : ' (Keys: W run, Shift sprint, Space jump)'), 6);
      else if (this.race?.barrierDists.length) this.hud.hint(touch ? 'Wait for the gun… RUN/SPRINT, and tap JUMP before each barrier' : 'Wait for the gun… W/Shift to run, SPACE to jump the barriers', 5);
      else this.hud.hint(touch ? 'Wait for the gun… then hold RUN (or SPRINT)' : 'Wait for the gun… then hold W (run) or SHIFT (sprint)', 4.5);
      this.audio.beep(false);
    } else if (p === 'set') {
      this.hud.big('SET', '', 1.0);
      this.audio.beep(false);
    }
  }

  // the host pressed START in an online room
  startOnlineRace({ go, remotes, lane }) {
    if (this.state === 'race' && this.race && !this.resultsShown && this.lastOpts?.online) return;
    this.menus.hideAll();
    this.online.sentFinish = false;
    this.startRace({
      bird: this.menus.sel.bird, race: go.race, venue: VENUES[go.venue] ? go.venue : 'featherfield',
      time: VENUES[go.venue]?.indoor ? 'indoor' : 'day', difficulty: 'normal', opponents: [],
      online: { remotes, lane, hold: Math.min(3, Math.max(1, +go.hold || 1.8)) },
    });
  }

  restartRace() {
    if (this.lastOpts?.online) {
      // online: go back to the room and wait for the host
      this.quitRace();
      this.multiUI.open('online');
      return;
    }
    if (!this.lastOpts || this.lastOpts.careerEventId || this.lastOpts.drill) return;
    this.menus.hideAll();
    this.startRace(Object.assign({}, this.lastOpts, { venue: this.venueId }));
  }

  quitRace(keepPreview = false) {
    const careerRace = (this.lastOpts?.careerEventId || this.lastOpts?.drill) && this.race;
    if (careerRace && this.lastOpts.drill && !this.careerRecorded && this.career) {
      // stopping a drill early: the session is used up with no improvement
      this.careerRecorded = true;
      this.career.finishTraining(0);
      this.lastCareerSum = null;
    } else if (careerRace && !this.careerRecorded && this.career) {
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

  // extra lines on the results screen for 2-player and online races
  extraResults(res) {
    const el = document.getElementById('res-banner');
    if (!el) return;
    const p2 = res.rows.find((r) => r.racer.isP2);
    const p1 = res.player;
    if (p2) {
      const t = (r) => (r.place ? `${ordinal(r.place)}${r.time != null ? ' — ' + formatTime(r.time) : ''}` : r.dq || 'DNF');
      const win = p1.place && (!p2.place || p1.place < p2.place) ? 'PLAYER 1 WINS!' : p2.place && (!p1.place || p2.place < p1.place) ? 'PLAYER 2 WINS!' : 'DRAW!';
      el.insertAdjacentHTML('beforeend', `<div class="sub" style="margin-top:6px">🎮 ${win}<br>P1 ${p1.racer.name}: ${t(p1)} • P2 ${p2.racer.name}: ${t(p2)}</div>`);
    }
    if (this.lastOpts?.online) {
      el.insertAdjacentHTML('beforeend', `<div class="sub" style="margin-top:6px">🌐 Online race. Each bird is timed by its own player's game. Tap RACE AGAIN to go back to the room.</div>`);
    }
  }

  updateP2Hud(race) {
    this.p2t = (this.p2t || 0) - 1;
    if (this.p2t > 0) return;
    this.p2t = 6;
    const p = race.player2;
    const place = race.standings.indexOf(p) + 1;
    const el = document.getElementById('hud-p2');
    const st = p.dq ? p.dq.toUpperCase() : p.finished ? `FINISHED ${formatTime(p.finishTime)}` : `${ordinal(place || 1)} • ${Math.round(p.body.speed * 3.6)} km/h`;
    el.innerHTML = `P2 ${p.name}: ${st}<div class="bar2"><i style="width:${Math.round(p.body.stamina * 100)}%"></i></div>`;
  }

  pause() {
    if (this.state !== 'race' || this.paused) return;
    if (this.race?.online) {
      this.hud.hint("Online races can't be paused. Tap ❚❚ again to leave the race.", 2.5);
      if (this.pausePressedAt && performance.now() - this.pausePressedAt < 2500) {
        this.pausePressedAt = 0;
        this.quitRace();
        this.multiUI.open('online');
      } else this.pausePressedAt = performance.now();
      return;
    }
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
    this.timeScale = 1;
    setTimeout(() => this.extraResults(res), 0);
    this.resultsShown = true;
    if (this.lastOpts?.drill && this.career) {
      if (this.careerRecorded) return;
      this.careerRecorded = true;
      const drill = DRILLS[this.lastOpts.drill];
      const sum = scoreDrill(drill, res.player);
      const tr = this.career.finishTraining(sum.mult, sum.grade);
      this.lastCareerSum = null;
      this.menus.showDrillResults(drill, sum, tr, this.career);
      return;
    }
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
    if (inp.consume('jump') && this.state === 'race' && this.race && !this.paused) this.race.player.controller.queueJump?.();
    if (inp.consume('jump2') && this.state === 'race' && this.race?.player2 && !this.paused) this.race.player2.controller.queueJump?.();
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
      const p2 = race.player2;
      if (p2 && !special && fr === race.player) {
        // two players: aim between them and pull back as they spread apart
        const c = p2.body;
        const sep = Math.hypot(c.x - b.x, c.z - b.z);
        focus = { x: (b.x + c.x) / 2, z: (b.z + c.z) / 2, h: b.h, vx: (b.vx + c.vx) / 2, vz: (b.vz + c.vz) / 2,
          speed: (b.speed + c.speed) / 2, size: Math.max(fr.species.size, p2.species.size) * (1 + Math.min(sep, 30) / 6) };
        this.updateP2Hud(race);
      }
      if (race.online) this.online.sendRaceState(race, dt);
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
      this.director.shiftTarget = this.state === 'race' || !wide ? 0 : cur === 'garage' || cur === 'multi' ? 0.3 : cur === 'setup' || cur === 'career' ? 0.24 : cur === 'menu' ? -0.16 : 0;
      this.director.menuZoom = cur === 'garage' ? 0.72 : 1;
      if (cur === 'garage' && this.preview) {
        const m = this.preview.model;
        const f = m.head.getWorldPosition(this._front || (this._front = new THREE.Vector3())).sub(m.root.position);
        f.y = 0;
        this.director.menuFront = f.normalize();
      } else this.director.menuFront = null;
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

// All sounds are synthesised live with the Web Audio API (no sound files needed):
// footsteps, starter's gun, countdown beeps, lap bell, crowd, bird chirps, wing flaps,
// victory fanfare, and spoken race announcements (using the device's built-in voice).

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.stepBudget = 0;
    this.lastSpeak = 0;
  }

  // Must be called from a tap/click (browsers only allow sound after a user gesture).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.speechPrimed && 'speechSynthesis' in window) {
      this.speechPrimed = true;
      try {
        const u = new SpeechSynthesisUtterance(' ');
        u.volume = 0;
        speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    }
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.settings.sound ? 0.9 : 0;
    this.master.connect(ctx.destination);
    // stadium echo
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.21;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const echoOut = ctx.createGain();
    echoOut.gain.value = 0.35;
    this.echo.connect(fb).connect(this.echo);
    this.echo.connect(echoOut).connect(this.master);

    // noise buffers
    const sr = ctx.sampleRate;
    const mk = (secs, type) => {
      const b = ctx.createBuffer(1, Math.floor(sr * secs), sr);
      const d = b.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'brown') {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        } else d[i] = w;
      }
      return b;
    };
    this.white = mk(2, 'white');
    this.brown = mk(4, 'brown');

    // crowd bed + cheer layer
    const bed = ctx.createBufferSource();
    bed.buffer = this.brown;
    bed.loop = true;
    const bedF = ctx.createBiquadFilter();
    bedF.type = 'bandpass';
    bedF.frequency.value = 520;
    bedF.Q.value = 0.6;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.0;
    bed.connect(bedF).connect(this.crowdGain).connect(this.master);
    bed.start();
    const cheer = ctx.createBufferSource();
    cheer.buffer = this.white;
    cheer.loop = true;
    this.cheerF = ctx.createBiquadFilter();
    this.cheerF.type = 'bandpass';
    this.cheerF.frequency.value = 1500;
    this.cheerF.Q.value = 0.9;
    this.cheerGain = ctx.createGain();
    this.cheerGain.gain.value = 0;
    cheer.connect(this.cheerF).connect(this.cheerGain).connect(this.master);
    cheer.start();
    this.ready = true;
  }

  setEnabled(on) {
    this.settings.sound = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
    if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
  }

  get t() {
    return this.ctx.currentTime;
  }

  setCrowd(excite) {
    if (!this.ready) return;
    const t = this.t;
    const wob = 0.85 + Math.random() * 0.3;
    this.crowdGain.gain.setTargetAtTime(0.05 + excite * 0.16 * wob, t, 0.3);
    this.cheerGain.gain.setTargetAtTime(Math.pow(excite, 2.2) * 0.12 * wob, t, 0.25);
    this.cheerF.frequency.setTargetAtTime(1100 + excite * 900, t, 0.3);
  }

  frame(dt) {
    this.stepBudget = Math.min(6, this.stepBudget + dt * 45);
  }

  noiseHit({ dur = 0.05, freq = 1800, q = 1.2, type = 'bandpass', vol = 0.3, attack = 0.002, when = 0, echo = 0 }) {
    const ctx = this.ctx;
    const t = this.t + when;
    const src = ctx.createBufferSource();
    src.buffer = this.white;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    if (echo) g.connect(this.echo);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
    return f;
  }

  tone({ freq = 880, dur = 0.15, type = 'sine', vol = 0.2, when = 0, slideTo = null, attack = 0.005 }) {
    const ctx = this.ctx;
    const t = this.t + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  footstep(vol, pitch = 1, surface = 'tartan') {
    if (!this.ready || vol < 0.02 || this.stepBudget < 1) return;
    this.stepBudget -= 1;
    if (surface === 'grass') this.noiseHit({ dur: 0.07, freq: 700 * pitch, q: 0.7, type: 'lowpass', vol: vol * 0.25 });
    else this.noiseHit({ dur: 0.045, freq: 2300 * pitch, q: 1.6, vol: vol * 0.32 });
    this.tone({ freq: 150 * pitch, dur: 0.04, vol: vol * 0.12, slideTo: 70 * pitch, attack: 0.002 });
  }

  gun() {
    if (!this.ready) return;
    const f = this.noiseHit({ dur: 0.45, freq: 5000, q: 0.3, type: 'lowpass', vol: 0.9, attack: 0.001, echo: 1 });
    f.frequency.exponentialRampToValueAtTime(600, this.t + 0.35);
    this.tone({ freq: 90, dur: 0.25, vol: 0.5, slideTo: 40, attack: 0.001 });
  }

  doubleGun() {
    this.gun();
    setTimeout(() => this.gun(), 260);
  }

  beep(high = false) {
    if (!this.ready) return;
    this.tone({ freq: high ? 1320 : 880, dur: high ? 0.35 : 0.15, vol: 0.18 });
  }

  bell() {
    if (!this.ready) return;
    for (let k = 0; k < 4; k++) {
      const w = k * 0.32;
      for (const [m, v] of [[1, 0.18], [2.01, 0.08], [2.76, 0.06], [5.4, 0.03]]) {
        this.tone({ freq: 840 * m, dur: 0.9, vol: v, when: w, attack: 0.002 });
      }
    }
  }

  chirp(size = 1, vol = 0.2) {
    if (!this.ready) return;
    const base = 3200 / Math.sqrt(size);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const w = i * (0.07 + Math.random() * 0.05);
      const f0 = base * (0.85 + Math.random() * 0.3);
      this.tone({ freq: f0, slideTo: f0 * (1.2 + Math.random() * 0.4), dur: 0.06, vol, when: w, type: 'sine', attack: 0.004 });
    }
  }

  flap(vol = 0.25) {
    if (!this.ready) return;
    for (let i = 0; i < 4; i++) this.noiseHit({ dur: 0.07, freq: 500, q: 0.8, vol: vol * (1 - i * 0.15), when: i * 0.12 });
  }

  bump(vol = 0.3) {
    if (!this.ready) return;
    this.noiseHit({ dur: 0.12, freq: 380, q: 0.7, type: 'lowpass', vol });
    this.tone({ freq: 110, dur: 0.1, vol: vol * 0.5, slideTo: 60 });
  }

  // Original little victory tune.
  fanfare() {
    if (!this.ready) return;
    const notes = [[523.25, 0, 0.16], [659.25, 0.16, 0.16], [783.99, 0.32, 0.16], [1046.5, 0.48, 0.42], [880, 0.95, 0.16], [1046.5, 1.12, 0.16], [1174.66, 1.28, 0.7]];
    for (const [f, w, d] of notes) {
      this.tone({ freq: f, dur: d + 0.1, vol: 0.09, when: w, type: 'triangle' });
      this.tone({ freq: f / 2, dur: d + 0.1, vol: 0.05, when: w, type: 'square' });
    }
  }

  say(text, { priority = false } = {}) {
    if (!this.settings.sound || !this.settings.voice || !('speechSynthesis' in window)) return;
    try {
      const now = performance.now();
      if (speechSynthesis.speaking) {
        if (!priority) return;
        speechSynthesis.cancel();
      }
      this.lastSpeak = now;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.08;
      u.pitch = 1.0;
      u.volume = 0.95;
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => /en-GB/i.test(x.lang)) || voices.find((x) => /^en/i.test(x.lang));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch (e) { /* speech not available */ }
  }

  stopSpeech() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}

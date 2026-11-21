// Keyboard + touch input in one place.
//   Keyboard: W / Up = run, Shift or Space = sprint, A/D or Left/Right = steer,
//             C = change camera, P / Esc = pause
//   Touch:    on-screen buttons with data-input="run|sprint|left|right"

export class Input {
  constructor() {
    this.keys = new Set();
    this.touch = { run: 0, sprint: 0, left: 0, right: 0 };
    this.pressed = new Set(); // one-shot presses this frame (camera, pause, skip)
    this.anyPress = false;

    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = e.code;
      if (!this.keys.has(k)) {
        if (k === 'KeyC') this.pressed.add('camera');
        if (k === 'KeyP' || k === 'Escape') this.pressed.add('pause');
        if (k === 'Enter') this.pressed.add('skip');
        this.anyPress = true;
      }
      this.keys.add(k);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear();
      for (const k in this.touch) this.touch[k] = 0;
    });
  }

  // Wire up on-screen buttons. Multi-touch friendly (each finger tracked separately).
  bindTouchButtons(root) {
    const buttons = root.querySelectorAll('[data-input]');
    buttons.forEach((btn) => {
      const name = btn.dataset.input;
      const pointers = new Set();
      const update = () => {
        this.touch[name] = pointers.size > 0 ? 1 : 0;
        btn.classList.toggle('down', pointers.size > 0);
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        pointers.add(e.pointerId);
        try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        this.anyPress = true;
        update();
      });
      const up = (e) => {
        pointers.delete(e.pointerId);
        update();
      };
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('lostpointercapture', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  get run() {
    return this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.touch.run > 0;
  }
  get sprint() {
    return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('Space') || this.touch.sprint > 0;
  }
  get left() {
    return this.keys.has('KeyA') || this.keys.has('ArrowLeft') || this.touch.left > 0 ? 1 : 0;
  }
  get right() {
    return this.keys.has('KeyD') || this.keys.has('ArrowRight') || this.touch.right > 0 ? 1 : 0;
  }
  get going() {
    return this.run || this.sprint;
  }

  consume(name) {
    if (this.pressed.has(name)) {
      this.pressed.delete(name);
      return true;
    }
    return false;
  }

  endFrame() {
    this.pressed.clear();
    this.anyPress = false;
  }
}

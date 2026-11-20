// Keyboard + mouse → the same input object the headless contract uses.
// Camera looks along +Z at yaw 0, where screen-right is world −X, so "right"
// (D by default) is move x = −1 and "left" (A) is x = +1 (contract: x maps to +X).
// Every key comes from the remappable keymap (settings.keys, Ticket-04).
import { DEFAULT_KEYS, normalizeCode } from './settings.js';

const typing = (e) => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '') && e.target.type !== 'range' && e.target.type !== 'checkbox';

export class Controls {
  constructor(canvas) {
    this.keys = new Set();
    this.tapped = new Set(); // keys pressed since the last tick: a quick tap is never lost
    this.mouse = { pulse: false, dragging: false, lastX: 0 };
    this.yawDeg = 0;
    this.dist = 10;
    this.sensitivity = 1;
    this.onKey = null; // (code) => void, for menu keys
    this.capture = null; // (code) => void while the settings screen waits for a new key
    this.keymap = { ...DEFAULT_KEYS };

    addEventListener('keydown', (e) => {
      const code = normalizeCode(e.code);
      if (this.capture) {
        e.preventDefault();
        if (!e.repeat) this.capture(code);
        return;
      }
      if (typing(e)) return; // typing a leaderboard name is not playing
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) || Object.values(this.keymap).includes(code)) e.preventDefault();
      if (!e.repeat && this.onKey) this.onKey(code, e);
      if (!e.repeat) this.tapped.add(code);
      this.keys.add(code);
    });
    addEventListener('keyup', (e) => this.keys.delete(normalizeCode(e.code)));
    addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) this.mouse.pulse = true;
      if (e.button === 0) {
        this.mouse.dragging = true;
        this.mouse.lastX = e.clientX;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.mouse.dragging) return;
      this.yawDeg -= (e.clientX - this.mouse.lastX) * 0.35 * this.sensitivity;
      this.mouse.lastX = e.clientX;
    });
    const up = (e) => {
      if (e.button === 2) this.mouse.pulse = false;
      if (e.button === 0) this.mouse.dragging = false;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.min(18, Math.max(5, this.dist + Math.sign(e.deltaY) * 0.8));
    }, { passive: false });
  }

  /** Called once per simulation tick. */
  sample() {
    const K = this.keymap;
    const held = (a) => this.keys.has(K[a]);
    const k = (a) => this.keys.has(K[a]) || this.tapped.has(K[a]);
    if (held('camLeft')) this.yawDeg += 2.2 * this.sensitivity;
    if (held('camRight')) this.yawDeg -= 2.2 * this.sensitivity;
    this.yawDeg = ((this.yawDeg % 360) + 540) % 360 - 180;
    const z = (k('up') ? 1 : 0) - (k('down') ? 1 : 0);
    const x = (k('left') ? 1 : 0) - (k('right') ? 1 : 0);
    const buttons = {
      jump: k('jump'),
      interact: k('interact'),
      pulse: k('pulse') || this.mouse.pulse,
      dash: k('dash'),
    };
    // a tap seen this tick must also be seen released before it can fire again
    this.tapped.clear();
    return {
      move: [x, z],
      cam_yaw_deg: Math.round(this.yawDeg * 1000) / 1000,
      ...buttons,
      pause: false,
    };
  }
}

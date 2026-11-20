// Keyboard + mouse → the same input object the headless contract uses.
// Camera looks along +Z at yaw 0, where screen-right is world −X, so "D"
// (right) is move x = −1 and "A" is x = +1 (contract: x maps to +X).

export class Controls {
  constructor(canvas) {
    this.keys = new Set();
    this.tapped = new Set(); // keys pressed since the last tick: a quick tap is never lost
    this.mouse = { pulse: false, dragging: false, lastX: 0 };
    this.yawDeg = 0;
    this.dist = 10;
    this.sensitivity = 1;
    this.onKey = null; // (code) => void, for menu keys

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat && this.onKey) this.onKey(e.code, e);
      if (!e.repeat) this.tapped.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
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
    const held = (c) => this.keys.has(c);
    const k = (c) => this.keys.has(c) || this.tapped.has(c);
    if (held('ArrowLeft') || held('KeyQ')) this.yawDeg += 2.2 * this.sensitivity;
    if (held('ArrowRight')) this.yawDeg -= 2.2 * this.sensitivity;
    this.yawDeg = ((this.yawDeg % 360) + 540) % 360 - 180;
    const z = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
    const buttons = {
      jump: k('Space'),
      interact: k('KeyE'),
      pulse: k('KeyF') || this.mouse.pulse,
      dash: k('ShiftLeft') || k('ShiftRight'),
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

// Keyboard + mouse → the same input object the headless contract uses.
// Camera looks along +Z at yaw 0, where screen-right is world −X, so "D"
// (right) is move x = −1 and "A" is x = +1 (contract: x maps to +X).

export class Controls {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { pulse: false, dragging: false, lastX: 0 };
    this.yawDeg = 0;
    this.dist = 10;
    this.onKey = null; // (code) => void, for menu keys

    addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat && this.onKey) this.onKey(e.code);
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
      this.yawDeg -= (e.clientX - this.mouse.lastX) * 0.35;
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
    const k = (c) => this.keys.has(c);
    if (k('ArrowLeft') || k('KeyQ')) this.yawDeg += 2.2;
    if (k('ArrowRight')) this.yawDeg -= 2.2;
    this.yawDeg = ((this.yawDeg % 360) + 540) % 360 - 180;
    const z = (k('KeyW') || k('ArrowUp') ? 1 : 0) - (k('KeyS') || k('ArrowDown') ? 1 : 0);
    const x = (k('KeyA') ? 1 : 0) - (k('KeyD') ? 1 : 0);
    return {
      move: [x, z],
      cam_yaw_deg: Math.round(this.yawDeg * 1000) / 1000,
      jump: k('Space'),
      interact: k('KeyE'),
      pulse: k('KeyF') || k('ShiftLeft') || k('ShiftRight') || this.mouse.pulse,
      dash: false,
    };
  }
}

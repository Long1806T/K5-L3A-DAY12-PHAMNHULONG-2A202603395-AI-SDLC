// Draws one frame of the world. Reads core state only (never mutates it).

import { m4, compose, mix3, transformPoint } from './mathx.js';
import { islandModel, lanternModel, moteModel, shadeModel, playerModel } from './meshes.js';
import { createRng } from '../core/rng.js';

const NIGHT = {
  sky: [0.1, 0.1, 0.24], ground: [0.04, 0.03, 0.07], moonCol: [0.2, 0.22, 0.36],
  fogCol: [0.05, 0.035, 0.1], fogDensity: 0.02,
};
const LIT = {
  sky: [0.32, 0.26, 0.34], ground: [0.13, 0.09, 0.07], moonCol: [0.3, 0.27, 0.32],
  fogCol: [0.17, 0.11, 0.14], fogDensity: 0.011,
};
const WARM = [1.0, 0.6, 0.28];

function hash01(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

export class Scene {
  constructor(renderer, level, tuning) {
    this.r = renderer;
    this.level = level;
    this.T = tuning;
    this.island = renderer.upload(islandModel(level));
    this.lantern = renderer.upload(lanternModel());
    this.mote = renderer.upload(moteModel());
    this.shade = renderer.upload(shadeModel());
    const pm = playerModel();
    this.player = renderer.upload(pm.mesh);
    this.playerLanternLocal = pm.lanternLocal;
    this.glowLevel = 0; // smoothed "how lit is the island"
    const rng = createRng('stars');
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      const a = rng() * Math.PI * 2;
      const e = 0.12 + rng() * 1.2;
      const d = 380;
      this.stars.push({ center: [Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d], size: 0.9 + rng() * 1.6, tw: rng() * 6 });
    }
  }

  /** view = { yawDeg, dist, target }, fx = active effects, time = seconds (visual only) */
  draw(world, view, fx, time, aspect) {
    const T = this.T;
    const p = world.player;
    const litCount = world.lanterns.filter((l) => l.lit).length;
    this.glowLevel += (litCount / world.lanterns.length - this.glowLevel) * 0.03;
    const k = this.glowLevel;
    const env = {
      sky: mix3(NIGHT.sky, LIT.sky, k),
      ground: mix3(NIGHT.ground, LIT.ground, k),
      moonDir: [-0.35, -0.85, -0.4],
      moonCol: mix3(NIGHT.moonCol, LIT.moonCol, k),
      fogCol: mix3(NIGHT.fogCol, LIT.fogCol, k),
      fogDensity: NIGHT.fogDensity + (LIT.fogDensity - NIGHT.fogDensity) * k,
    };

    // camera: behind the player along the camera yaw (forward = (sin, cos))
    const yaw = (view.yawDeg * Math.PI) / 180;
    const fwd = [Math.sin(yaw), 0, Math.cos(yaw)];
    const target = [view.target[0], view.target[1] + 1.3, view.target[2]];
    const eye = [target[0] - fwd[0] * view.dist, target[1] + 2.2 + view.dist * 0.33, target[2] - fwd[2] * view.dist];
    const viewM = m4.lookAt(eye, target, [0, 1, 0]);
    const proj = m4.perspective((55 * Math.PI) / 180, aspect, 0.1, 700);
    const viewProj = m4.mul(proj, viewM);
    const camRight = [viewM[0], viewM[4], viewM[8]];
    const camUp = [viewM[1], viewM[5], viewM[9]];

    // lights: lit lanterns, partially filled lanterns, Mây's lantern, pulse flash
    const lights = [];
    for (const L of world.lanterns) {
      const fill = L.lit ? 1 : Math.min(1, L.deposited / T.lantern_cost) * 0.35;
      if (fill <= 0) continue;
      const flick = 1 + Math.sin(time * 7 + hash01(L.id) * 9) * 0.04;
      lights.push({ pos: [L.pos[0], 4.2, L.pos[2]], col: WARM.map((c) => c * 2.1 * fill * flick), range: L.lit ? 19 : 7 });
    }
    const playerM = compose(m4.translate(p.pos[0], p.pos[1], p.pos[2]), m4.rotY(p.facing), m4.scale(0.9));
    const lamp = transformPoint(playerM, this.playerLanternLocal);
    lights.push({ pos: lamp, col: WARM.map((c) => c * (0.95 + p.carried * 0.07)), range: 6.5 + p.carried * 0.45 });
    for (const e of fx) if (e.kind === 'pulse') lights.push({ pos: [e.pos[0], 1.5, e.pos[2]], col: [1.6 * e.left, 1.2 * e.left, 0.55 * e.left], range: T.pulse_radius * 1.8 });

    this.r.begin({ viewProj, camPos: eye, camRight, camUp, env, lights });
    this.r.drawMesh(this.island, m4.ident());

    const glows = [];
    for (const s of this.stars) glows.push({ center: s.center, size: s.size * (0.8 + 0.2 * Math.sin(time * 1.3 + s.tw)), color: [0.5, 0.5, 0.65], noFog: true });
    glows.push({ center: [-160, 230, -240], size: 34, color: [0.42, 0.44, 0.62], noFog: true });

    for (const L of world.lanterns) {
      const fill = L.lit ? 1 : Math.min(1, L.deposited / T.lantern_cost);
      this.r.drawMesh(this.lantern, m4.translate(L.pos[0], 0, L.pos[2]), { emit: L.lit ? 1 : fill * 0.3 });
      if (L.lit) glows.push({ center: [L.pos[0], 4.2, L.pos[2]], size: 5.5, color: [0.75, 0.38, 0.12] });
      else if (fill > 0) glows.push({ center: [L.pos[0], 4.2, L.pos[2]], size: 2.5 * fill, color: [0.5, 0.25, 0.08] });
      glows.push({
        center: [L.pos[0], 0.05, L.pos[2]], size: T.safe_radius, ground: true, ring: true, ringWidth: 0.06,
        color: L.lit ? [0.5, 0.3, 0.1] : [0.22, 0.17, 0.26],
      });
      const near = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= T.interact_radius + 2;
      if (!L.lit && near) glows.push({ center: [L.pos[0], 0.06, L.pos[2]], size: T.interact_radius, ground: true, ring: true, ringWidth: 0.1, color: [0.45, 0.4, 0.3] });
    }

    for (const m of world.motes) {
      const ph = hash01(m.id) * 6.28;
      const y = 0.75 + Math.sin(time * 2.2 + ph) * 0.18;
      const pos = [m.pos[0] + Math.sin(time * 1.3 + ph) * 0.12, y, m.pos[2] + Math.cos(time * 1.1 + ph) * 0.12];
      this.r.drawMesh(this.mote, m4.translate(pos[0], pos[1], pos[2]));
      glows.push({ center: pos, size: 0.85, color: [0.55, 0.48, 0.15] });
    }

    for (const sh of world.shades) {
      const ph = hash01(sh.id) * 6.28;
      let y = Math.max(sh.pos[1], 0) + 0.95 + Math.sin(time * 3 + ph) * 0.12;
      let scale = 1;
      let tint = [1, 1, 1];
      let wobble = 0;
      if (sh.state === 'emerge') {
        const left = Math.max(0, sh.emergeUntil - world.tick) / 60;
        y -= left * 2.2;
        scale = 1 - left * 0.5;
      } else if (sh.state === 'stunned') {
        tint = [4.2, 3.8, 4.8]; // washed-out lilac: harmless for now
        scale = 0.8;
        wobble = Math.sin(time * 18 + ph) * 0.25;
        for (let i = 0; i < 3; i++) {
          const a = time * 4 + (i * Math.PI * 2) / 3;
          glows.push({ center: [sh.pos[0] + Math.cos(a) * 0.55, y + 1.0, sh.pos[2] + Math.sin(a) * 0.55], size: 0.32, color: [0.9, 0.8, 0.4] });
        }
      }
      const face = Math.atan2(p.pos[0] - sh.pos[0], p.pos[2] - sh.pos[2]);
      const M = compose(m4.translate(sh.pos[0], y, sh.pos[2]), m4.rotY(face), m4.rotZ(wobble), m4.scale(scale));
      this.r.drawMesh(this.shade, M, { tint, emit: sh.state === 'stunned' ? 0.3 : 1 });
      glows.push({ center: [sh.pos[0], y, sh.pos[2]], size: 2.6 * scale, color: sh.state === 'stunned' ? [0.12, 0.1, 0.16] : [0.24, 0.06, 0.32] });
    }

    const blink = world.state === 'playing' && world.tick < p.invulnUntil && Math.floor(world.tick / 5) % 2 === 0;
    if (!blink) this.r.drawMesh(this.player, playerM);
    glows.push({ center: lamp, size: 1.1 + p.carried * 0.12, color: [0.85, 0.5, 0.18] });
    for (let i = 0; i < p.carried; i++) {
      const a = time * 2.4 + (i / Math.max(1, p.carried)) * Math.PI * 2;
      glows.push({ center: [p.pos[0] + Math.cos(a) * 0.75, p.pos[1] + 1.0 + Math.sin(time * 3 + i) * 0.15, p.pos[2] + Math.sin(a) * 0.75], size: 0.35, color: [0.75, 0.62, 0.2] });
    }

    for (const e of fx) {
      if (e.kind === 'pulse') {
        const r = T.pulse_radius * (1 - e.left * e.left);
        glows.push({ center: [e.pos[0], 0.08, e.pos[2]], size: Math.max(0.1, r), ground: true, ring: true, ringWidth: 0.12, color: [1.2 * e.left, 0.8 * e.left, 0.3 * e.left] });
        glows.push({ center: [e.pos[0], 1.2, e.pos[2]], size: 3 * e.left + 0.5, color: [0.9 * e.left, 0.65 * e.left, 0.3 * e.left] });
      } else if (e.kind === 'spark') {
        glows.push({ center: e.pos, size: 1.4 * e.left + 0.2, color: e.color.map((c) => c * e.left) });
      }
    }
    this.r.drawGlows(glows);
    return { eye, viewProj };
  }
}

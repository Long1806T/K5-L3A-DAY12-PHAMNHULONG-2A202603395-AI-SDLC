// Draws one frame of the world. Reads core state only (never mutates it).

import { m4, compose, transformPoint } from './mathx.js';
import { MeshBuilder, sceneryModel, lanternModel, lanternPaperModel, moteModel, shadeModel, playerModel, ribbonModel, charmModel } from './meshes.js';
import { RGB, ambientIntensity } from './palette.js';
import { windAt, isWeak, FUEL_UNITS } from '../core/sim.js';
import { createRng } from '../core/rng.js';

const WARM = RGB.lanternLit;

function hash01(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return ((h >>> 0) % 1000) / 1000;
}

export class Scene {
  constructor(renderer) {
    this.r = renderer;
    this.lantern = renderer.upload(lanternModel());
    this.paper = renderer.upload(lanternPaperModel());
    this.mote = renderer.upload(moteModel());
    this.shade = renderer.upload(shadeModel());
    this.shadeStunned = renderer.upload(shadeModel(RGB.shadeRim, RGB.shadeStunned));
    this.shadeCB = renderer.upload(shadeModel([0, 0.702, 1])); // colour-blind rim/eyes #00B3FF
    this.tear = renderer.upload(new MeshBuilder().add('box', m4.scale(1), [0.95, 0.88, 0.7], 1).build()); // pale torn-paper streak
    this.ribbon = renderer.upload(ribbonModel());
    this.charm = renderer.upload(charmModel());
    const pm = playerModel();
    this.player = renderer.upload(pm.mesh);
    this.playerLanternLocal = pm.lanternLocal;
    this.scenery = new Map();
    this.trails = new Map();
    this.options = { colorBlind: false };
    const rng = createRng('stars');
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      const a = rng() * Math.PI * 2;
      const e = 0.12 + rng() * 1.2;
      const d = 380;
      this.stars.push({ center: [Math.cos(a) * Math.cos(e) * d, Math.sin(e) * d, Math.sin(a) * Math.cos(e) * d], size: 0.9 + rng() * 1.6, tw: rng() * 6 });
    }
  }

  sceneryFor(level) {
    if (!this.scenery.has(level.id)) this.scenery.set(level.id, this.r.upload(sceneryModel(level)));
    return this.scenery.get(level.id);
  }

  /** view = { yawDeg, dist, target, eye? }, fx = active effects, time = seconds (visual only) */
  draw(world, view, fx, time, aspect) {
    const T = world.T;
    const p = world.player;
    const lv = world.level;
    const litCount = world.lanterns.filter((l) => l.lit).length;
    const amb = ambientIntensity(litCount, world.lanterns.length);
    const env = {
      clearCol: RGB.sky,
      sky: [0.62 * amb * 1.6, 0.66 * amb * 1.6, 0.95 * amb * 1.6],
      ground: [0.3 * amb, 0.24 * amb, 0.22 * amb],
      moonDir: [-0.35, -0.85, -0.4],
      moonCol: [0.16, 0.18, 0.3],
      fogCol: RGB.fog,
      fogDensity: 0.02 - 0.008 * (litCount / world.lanterns.length),
    };

    let eye;
    let target;
    if (view.eye) {
      eye = view.eye;
      target = view.target;
    } else {
      const yaw = (view.yawDeg * Math.PI) / 180;
      target = [view.target[0], view.target[1] + 1.3, view.target[2]];
      eye = [target[0] - Math.sin(yaw) * view.dist, target[1] + 2.2 + view.dist * 0.33, target[2] - Math.cos(yaw) * view.dist];
    }
    const viewM = m4.lookAt(eye, target, [0, 1, 0]);
    const proj = m4.perspective((55 * Math.PI) / 180, aspect, 0.1, 700);
    const viewProj = m4.mul(proj, viewM);
    const camRight = [viewM[0], viewM[4], viewM[8]];
    const camUp = [viewM[1], viewM[5], viewM[9]];

    const playerM = compose(m4.translate(p.pos[0], p.pos[1], p.pos[2]), m4.rotY(p.facing), m4.scale(0.9));
    const lamp = transformPoint(playerM, this.playerLanternLocal);
    const lights = [{ pos: lamp, col: WARM.map((c) => c * (0.95 + p.carried * 0.05)), range: 6.5 + p.carried * 0.35 }];
    for (const e of fx) if (e.kind === 'pulse') lights.push({ pos: [e.pos[0], e.pos[1] + 1.5, e.pos[2]], col: [1.6 * e.left, 1.2 * e.left, 0.55 * e.left], range: T.pulse_radius * 2 });
    const lanternLights = world.lanterns
      .filter((L) => L.lit)
      .map((L) => ({ L, d: Math.hypot(L.pos[0] - eye[0], L.pos[2] - eye[2]) }))
      .sort((a, b) => a.d - b.d);
    for (const { L } of lanternLights) {
      const flick = 1 + Math.sin(time * 7 + hash01(L.id) * 9) * 0.04;
      const blinkL = isWeak(world, L) && Math.floor(time * 2) % 2 === 1 ? 0.3 : 1;
      lights.push({ pos: [L.pos[0], L.pos[1] + 4.2, L.pos[2]], col: WARM.map((c) => c * 2.1 * flick * blinkL), range: 19 });
    }

    this.r.begin({ viewProj, camPos: eye, camRight, camUp, env, lights });
    this.r.drawMesh(this.sceneryFor(lv), m4.ident());

    const sprites = [];
    for (const s of this.stars) sprites.push({ center: s.center, size: s.size * (0.8 + 0.2 * Math.sin(time * 1.3 + s.tw)), color: [0.5, 0.5, 0.65], noFog: true });
    sprites.push({ center: [-160, 230, -240], size: 34, color: [0.42, 0.44, 0.62], noFog: true });
    for (const pad of lv.pads) sprites.push({ center: [pad.pos[0], pad.pos[1] + 0.1, pad.pos[2]], size: pad.r * (1.1 + 0.15 * Math.sin(time * 4)), ground: true, ring: true, ringWidth: 0.2, color: [0.2, 0.6, 0.55] });

    for (const L of world.lanterns) {
      const fill = L.lit ? 1 : Math.min(1, L.deposited / T.lantern_cost);
      const base = m4.translate(L.pos[0], L.pos[1], L.pos[2]);
      this.r.drawMesh(this.lantern, base);
      const weak = isWeak(world, L);
      const blink = weak && Math.floor(time * 2) % 2 === 1 ? 0.3 : 1; // fuel < 30: slow 1 Hz blink
      const tint = L.lit ? RGB.lanternLit.map((c) => c * (0.6 + 0.4 * blink)) : RGB.lanternOff.map((c, i) => c + (RGB.lanternLit[i] - c) * fill * 0.35);
      const squash = !L.lit && this.options.colorBlind ? 0.8 : 1; // colour-blind: off lanterns are squashed 20 %
      const paperM = compose(base, m4.translate(0, 4.2 - (1 - squash) * 0.6, 0), m4.scale(1, squash, 1));
      this.r.drawMesh(this.paper, paperM, { tint, emit: L.lit ? blink : fill * 0.3 });
      if (!L.lit && this.options.colorBlind) {
        // torn paper: two jagged pale streaks on every side, so the state reads without colour
        for (let k = 0; k < 4; k++) {
          for (const [x, y, rz] of [[0.16, 0.12, 0.55], [-0.2, -0.16, -0.45]]) {
            this.r.drawMesh(this.tear, compose(paperM, m4.rotY((k * Math.PI) / 2), m4.translate(x, y, 0.6), m4.rotZ(rz), m4.scale(0.05, 0.42, 0.05)), { emit: 0.55 });
          }
        }
      }
      const top = [L.pos[0], L.pos[1] + 4.2, L.pos[2]];
      if (L.lit) {
        sprites.push({ center: top, size: 5.5 * (0.7 + 0.3 * blink), color: WARM.map((c) => c * 0.7 * blink) });
        sprites.push({ center: top, size: 1.6, color: RGB.lanternCore.map((c) => c * 0.6 * blink) });
        if (!weak) sprites.push({ center: [L.pos[0], L.pos[1] + 0.05, L.pos[2]], size: T.safe_radius, ground: true, ring: true, ringWidth: 0.05, color: [0.5, 0.32, 0.1] });
      } else if (fill > 0) {
        sprites.push({ center: top, size: 2.5 * fill, color: [0.5, 0.25, 0.08] });
      }
      const near = Math.hypot(L.pos[0] - p.pos[0], L.pos[2] - p.pos[2]) <= T.interact_radius + 2;
      if (near && !(L.lit && L.fuel >= T.fuel_max * FUEL_UNITS)) sprites.push({ center: [L.pos[0], L.pos[1] + 0.06, L.pos[2]], size: T.interact_radius, ground: true, ring: true, ringWidth: 0.12, color: [0.45, 0.4, 0.3] });
    }

    for (const m of world.motes) {
      const ph = hash01(m.id) * 6.28;
      const fading = m.kind === 'dropped' && m.ttl < 120 && Math.floor(time * 8) % 2 === 0;
      if (fading) continue;
      const y = m.pos[1] + 0.75 + Math.sin(time * 2.2 + ph) * 0.18;
      const pos = [m.pos[0] + Math.sin(time * 1.3 + ph) * 0.12, y, m.pos[2] + Math.cos(time * 1.1 + ph) * 0.12];
      this.r.drawMesh(this.mote, m4.translate(pos[0], pos[1], pos[2]));
      sprites.push({ center: pos, size: 0.85, color: RGB.moteHalo.map((c) => c * 0.55) });
    }

    for (const c of world.charms) {
      if (!c.available) continue;
      const pos = [c.pos[0], c.pos[1] + 1.1 + Math.sin(time * 2) * 0.15, c.pos[2]];
      this.r.drawMesh(this.charm, compose(m4.translate(pos[0], pos[1], pos[2]), m4.rotY(time * 1.5)));
      sprites.push({ center: pos, size: 1.8, color: [0.55, 0.12, 0.08] });
    }

    for (const sh of world.shades) {
      const ph = hash01(sh.id) * 6.28;
      let y = sh.pos[1] + Math.sin(time * 3 + ph) * 0.12;
      let scale = 1;
      let wobble = 0;
      const stunned = sh.state === 'stunned';
      if (sh.state === 'spawning') {
        const left = sh.spawnLeft / 60;
        y -= left * 2.2;
        scale = 1 - left * 0.5;
      } else if (stunned) {
        scale = 0.82;
        wobble = Math.sin(time * 18 + ph) * 0.25;
        for (let i = 0; i < 3; i++) {
          const a = time * 4 + (i * Math.PI * 2) / 3;
          sprites.push({ center: [sh.pos[0] + Math.cos(a) * 0.55, y + 1.0, sh.pos[2] + Math.sin(a) * 0.55], size: 0.32, color: RGB.gold.map((c) => c * 0.8) });
        }
      } else if (sh.state === 'drain') {
        wobble = Math.sin(time * 6 + ph) * 0.1;
      }
      const face = Math.atan2(p.pos[0] - sh.pos[0], p.pos[2] - sh.pos[2]);
      const M = compose(m4.translate(sh.pos[0], y, sh.pos[2]), m4.rotY(face), m4.rotZ(wobble), m4.scale(scale));
      const model = stunned ? this.shadeStunned : this.options.colorBlind && this.shadeCB ? this.shadeCB : this.shade;
      this.r.drawMesh(model, M, { emit: stunned ? 0.3 : 1 });
      const rim = this.options.colorBlind ? [0, 0.7, 1] : RGB.shadeRim;
      sprites.push({ center: [sh.pos[0], y, sh.pos[2]], size: 2.6 * scale, color: stunned ? [0.1, 0.09, 0.14] : rim.map((c) => c * 0.32) });
    }

    for (const d of world.drifters) {
      const prev = this.trails.get(d.id) || { pos: [...d.pos], dir: [1, 0] };
      const mx = d.pos[0] - prev.pos[0];
      const mz = d.pos[2] - prev.pos[2];
      const ml = Math.hypot(mx, mz);
      if (ml > 1e-4) prev.dir = [mx / ml, mz / ml];
      prev.pos = [...d.pos];
      this.trails.set(d.id, prev);
      const yaw = Math.atan2(prev.dir[0], prev.dir[1]);
      for (let i = 0; i < 7; i++) {
        const back = i * 0.42;
        const side = Math.sin(time * 6 - i * 0.9) * 0.28 * (i / 6);
        const pos = [d.pos[0] - prev.dir[0] * back + prev.dir[1] * side, d.pos[1] + Math.sin(time * 5 + i * 0.8) * 0.15, d.pos[2] - prev.dir[1] * back - prev.dir[0] * side];
        this.r.drawMesh(this.ribbon, compose(m4.translate(pos[0], pos[1], pos[2]), m4.rotY(yaw + Math.PI / 2 + side), m4.rotX(Math.sin(time * 7 + i) * 0.5), m4.scale(1 - i * 0.08)));
      }
      sprites.push({ center: d.pos, size: 1.4, color: RGB.drifter.map((c) => c * (d.stolen ? 0.5 : 0.25)) });
    }

    const blink = p.invuln > 0 && Math.floor(world.tick / 5) % 2 === 0;
    if (!blink && p.dead === 0) this.r.drawMesh(this.player, playerM);
    sprites.push({ center: lamp, size: 1.1 + p.carried * 0.1, color: [0.85, 0.5, 0.18] });
    for (let i = 0; i < p.carried; i++) {
      const a = time * 2.4 + (i / Math.max(1, p.carried)) * Math.PI * 2;
      sprites.push({ center: [p.pos[0] + Math.cos(a) * 0.75, p.pos[1] + 1.0 + Math.sin(time * 3 + i) * 0.15, p.pos[2] + Math.sin(a) * 0.75], size: 0.35, color: RGB.moteHalo.map((c) => c * 0.65) });
    }
    if (p.charm > 0) sprites.push({ center: [p.pos[0], p.pos[1] + 0.2, p.pos[2]], size: 1.3, ground: true, ring: true, ringWidth: 0.15, color: [0.6, 0.12, 0.1] });

    const wind = windAt(world);
    if (wind.active || wind.warn) {
      const a = (wind.dir * Math.PI) / 180;
      const dir = [Math.cos(a), Math.sin(a)];
      const n = wind.active ? 50 : 18;
      for (let i = 0; i < n; i++) {
        const h1 = hash01(`leaf${i * 7919}`);
        const h2 = hash01(`leaf-b${i * 104729}`);
        const h3 = hash01(`leaf-c${i * 15485863}`);
        const along = ((time * (wind.active ? 7 : 4) + h1 * 20) % 20) - 10;
        const across = (h2 - 0.5) * 18;
        sprites.push({
          center: [p.pos[0] + dir[0] * along - dir[1] * across, p.pos[1] + 0.4 + h3 * 3 + Math.sin(time * 5 + i) * 0.3, p.pos[2] + dir[1] * along + dir[0] * across],
          size: 0.18,
          color: [0.55, 0.62, 0.25],
        });
      }
    }

    for (const e of fx) {
      if (e.kind === 'pulse') {
        const r = T.pulse_radius * (1 - e.left * e.left);
        sprites.push({ center: [e.pos[0], e.pos[1] + 0.08, e.pos[2]], size: Math.max(0.1, r), ground: true, ring: true, ringWidth: 0.12, color: [1.2 * e.left, 0.8 * e.left, 0.3 * e.left] });
        sprites.push({ center: [e.pos[0], e.pos[1] + 1.2, e.pos[2]], size: 3 * e.left + 0.5, color: [0.9 * e.left, 0.65 * e.left, 0.3 * e.left] });
      } else if (e.kind === 'spark') {
        sprites.push({ center: e.pos, size: 1.4 * e.left + 0.2, color: e.color.map((c) => c * e.left) });
      }
    }
    this.r.drawSprites(sprites);
    return { eye, viewProj };
  }
}

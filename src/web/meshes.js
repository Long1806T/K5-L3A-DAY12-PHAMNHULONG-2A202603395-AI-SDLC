// Low-poly, flat-shaded geometry built in code (no external assets).
// Vertex layout (10 floats): position xyz, normal xyz, colour rgb, emissive.

import { m4, compose, transformPoint } from './mathx.js';
import { createRng } from '../core/rng.js';

export const FLOATS_PER_VERTEX = 10;

// ---------- primitives (local space) ----------

function box() {
  const v = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) v.push([x, y, z]);
  const faces = [
    [0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3],
  ];
  const tris = [];
  for (const [a, b, c, d] of faces) tris.push([v[a], v[b], v[c]], [v[a], v[c], v[d]]);
  return { tris, center: [0, 0, 0], orient: 'center' };
}

/** Cylinder/cone from y=0 (radius rBot) to y=1 (radius rTop). */
function cylinder(seg, rTop = 1, rBot = 1) {
  const tris = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    const b0 = [Math.cos(a0) * rBot, 0, Math.sin(a0) * rBot];
    const b1 = [Math.cos(a1) * rBot, 0, Math.sin(a1) * rBot];
    const t0 = [Math.cos(a0) * rTop, 1, Math.sin(a0) * rTop];
    const t1 = [Math.cos(a1) * rTop, 1, Math.sin(a1) * rTop];
    if (rBot > 0) tris.push([b0, b1, t1]);
    if (rTop > 0) tris.push([b0, t1, t0]);
    if (rTop > 0) tris.push([[0, 1, 0], t0, t1]);
    if (rBot > 0) tris.push([[0, 0, 0], b1, b0]);
  }
  return { tris, center: [0, 0.5, 0], orient: 'center' };
}

function sphere(seg = 10, rings = 6) {
  const pt = (i, j) => {
    const th = (j / rings) * Math.PI;
    const ph = (i / seg) * Math.PI * 2;
    return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  };
  const tris = [];
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < seg; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j);
      const c = pt(i + 1, j + 1);
      const d = pt(i, j + 1);
      if (j > 0) tris.push([a, b, c]);
      if (j < rings - 1) tris.push([a, c, d]);
    }
  }
  return { tris, center: [0, 0, 0], orient: 'center' };
}

const PRIM = {
  box: box(),
  cyl6: cylinder(6),
  cyl8: cylinder(8),
  cyl12: cylinder(12),
  cyl48: cylinder(48),
  taper12: cylinder(12, 0.6, 1),
  cone4: cylinder(4, 0, 1),
  cone8: cylinder(8, 0, 1),
  cone16: cylinder(16, 0, 1),
  sphere: sphere(10, 6),
  sphereLo: sphere(7, 4),
};

export class MeshBuilder {
  constructor() {
    this.data = [];
  }

  tri(a, b, c, color, emit, ref) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-12) return;
    nx /= len;
    ny /= len;
    nz /= len;
    const cx = (a[0] + b[0] + c[0]) / 3 - ref[0];
    const cy = (a[1] + b[1] + c[1]) / 3 - ref[1];
    const cz = (a[2] + b[2] + c[2]) / 3 - ref[2];
    if (nx * cx + ny * cy + nz * cz < 0) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    for (const p of [a, b, c]) this.data.push(p[0], p[1], p[2], nx, ny, nz, color[0], color[1], color[2], emit);
  }

  /** Adds a primitive by name under `matrix` (normals point away from the primitive centre). */
  add(name, matrix, color, emit = 0) {
    const prim = PRIM[name];
    const ref = transformPoint(matrix, prim.center);
    for (const [a, b, c] of prim.tris) {
      this.tri(transformPoint(matrix, a), transformPoint(matrix, b), transformPoint(matrix, c), color, emit, ref);
    }
    return this;
  }

  build() {
    return new Float32Array(this.data);
  }
}

const T = m4.translate;
const S = m4.scale;
const RY = m4.rotY;

// ---------- palette ----------
export const COLORS = {
  grass: [0.17, 0.3, 0.24],
  grass2: [0.2, 0.34, 0.25],
  rock: [0.27, 0.23, 0.27],
  rockDark: [0.19, 0.16, 0.2],
  stone: [0.45, 0.43, 0.48],
  wood: [0.36, 0.24, 0.16],
  woodDark: [0.24, 0.16, 0.11],
  leaf: [0.12, 0.3, 0.27],
  leaf2: [0.16, 0.36, 0.28],
  roof: [0.45, 0.17, 0.12],
  wall: [0.62, 0.5, 0.36],
  cloud: [0.35, 0.33, 0.5],
  lanternPaper: [1.0, 0.42, 0.16],
  straw: [0.9, 0.77, 0.47],
  robe: [0.33, 0.56, 0.73],
  sash: [0.98, 0.56, 0.2],
  skin: [0.96, 0.8, 0.66],
  hair: [0.12, 0.08, 0.08],
  ink: [0.1, 0.05, 0.16],
  inkEye: [0.92, 0.78, 1.0],
  mote: [1.0, 0.92, 0.45],
  flame: [1.0, 0.55, 0.2],
};

// ---------- models ----------

export function lanternModel() {
  const b = new MeshBuilder();
  b.add('cyl8', compose(S(0.75, 0.35, 0.75)), COLORS.stone);
  b.add('cyl6', compose(T(0, 0.35, 0), S(0.13, 3.1, 0.13)), COLORS.woodDark);
  b.add('cyl8', compose(T(0, 3.45, 0), S(0.44, 0.14, 0.44)), COLORS.woodDark);
  b.add('sphere', compose(T(0, 4.2, 0), S(0.62, 0.78, 0.62)), COLORS.lanternPaper, 1);
  b.add('cyl8', compose(T(0, 4.88, 0), S(0.4, 0.14, 0.4)), COLORS.woodDark);
  b.add('cone8', compose(T(0, 5.02, 0), S(0.16, 0.32, 0.16)), COLORS.woodDark);
  return b.build();
}

export function moteModel() {
  return new MeshBuilder().add('sphereLo', S(0.13), COLORS.mote, 1).build();
}

/** Shade body centred at the origin, facing +Z. */
export function shadeModel() {
  const b = new MeshBuilder();
  b.add('sphere', S(0.75, 0.85, 0.75), COLORS.ink);
  // wispy skirt: a cone flipped so its tip points down
  b.add('cone8', compose(T(0, -0.15, 0), m4.rotX(Math.PI), S(0.7, 1.05, 0.7)), COLORS.ink);
  b.add('cone4', compose(T(-0.36, 0.55, 0), S(0.16, 0.45, 0.16)), COLORS.ink);
  b.add('cone4', compose(T(0.36, 0.55, 0), S(0.16, 0.45, 0.16)), COLORS.ink);
  b.add('sphereLo', compose(T(-0.22, 0.16, 0.64), S(0.11, 0.13, 0.08)), COLORS.inkEye, 1);
  b.add('sphereLo', compose(T(0.22, 0.16, 0.64), S(0.11, 0.13, 0.08)), COLORS.inkEye, 1);
  return b.build();
}

/** Mây: feet at the origin, facing +Z; returns the mesh and the small lantern's local position. */
export function playerModel() {
  const b = new MeshBuilder();
  b.add('box', compose(T(-0.11, 0.17, 0), S(0.14, 0.34, 0.16)), COLORS.woodDark);
  b.add('box', compose(T(0.11, 0.17, 0), S(0.14, 0.34, 0.16)), COLORS.woodDark);
  b.add('taper12', compose(T(0, 0.3, 0), S(0.38, 0.75, 0.32)), COLORS.robe);
  b.add('cyl12', compose(T(0, 0.62, 0), S(0.33, 0.09, 0.28)), COLORS.sash);
  b.add('cyl6', compose(T(-0.3, 0.55, 0), S(0.07, 0.45, 0.07)), COLORS.robe);
  b.add('cyl6', compose(T(0.3, 0.55, 0), S(0.07, 0.45, 0.07)), COLORS.robe);
  b.add('sphere', compose(T(0, 1.27, 0), S(0.24)), COLORS.skin);
  b.add('sphere', compose(T(0, 1.31, -0.04), S(0.245)), COLORS.hair);
  b.add('sphereLo', compose(T(-0.085, 1.29, 0.215), S(0.035)), COLORS.hair);
  b.add('sphereLo', compose(T(0.085, 1.29, 0.215), S(0.035)), COLORS.hair);
  // nón lá with a small lantern hanging from the front of the brim
  b.add('cone16', compose(T(0, 1.4, 0), S(0.68, 0.36, 0.68)), COLORS.straw);
  b.add('cyl6', compose(T(0, 1.18, 0.58), S(0.012, 0.24, 0.012)), COLORS.woodDark);
  b.add('sphereLo', compose(T(0, 1.1, 0.58), S(0.11, 0.14, 0.11)), COLORS.flame, 1);
  b.add('cyl6', compose(T(0, 1.22, 0.58), S(0.06, 0.04, 0.06)), COLORS.woodDark);
  return { mesh: b.build(), lanternLocal: [0, 1.1, 0.58] };
}

// ---------- static island ----------

function segDist(p, a, b) {
  const abx = b[0] - a[0];
  const abz = b[2] - a[2];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * abx + (p[2] - a[2]) * abz) / (abx * abx + abz * abz)));
  return Math.hypot(p[0] - (a[0] + abx * t), p[2] - (a[2] + abz * t));
}

/** Island, paths, trees, rocks, dock and clouds: one static mesh. */
export function islandModel(level) {
  const b = new MeshBuilder();
  const R = level.islandRadius;
  const rng = createRng('island-decor');
  const lanterns = level.lanterns.map((l) => l.pos);
  const start = level.playerStart;

  b.add('cyl48', compose(T(0, -1, 0), S(R + 1.5, 1, R + 1.5)), COLORS.grass);
  // underside: tapered rock cone
  b.add('cone16', compose(T(0, -1, 0), m4.rotX(Math.PI), S(R + 1.5, 26, R + 1.5)), COLORS.rock);
  b.add('cone8', compose(T(6, -8, -4), m4.rotX(Math.PI), S(R * 0.6, 26, R * 0.6)), COLORS.rockDark);

  // stepping-stone paths from the start to every lantern
  for (const L of lanterns) {
    const d = Math.hypot(L[0] - start[0], L[2] - start[2]);
    for (let s = 2.2; s < d - 3; s += 1.9) {
      const k = s / d;
      const jx = (rng() - 0.5) * 0.5;
      const jz = (rng() - 0.5) * 0.5;
      b.add('cyl8', compose(T(start[0] + (L[0] - start[0]) * k + jx, -0.02, start[2] + (L[2] - start[2]) * k + jz), RY(rng() * 3), S(0.55, 0.08, 0.45)), COLORS.stone);
    }
  }

  const freeSpot = (minR, maxR, gapLantern, gapPath) => {
    for (let i = 0; i < 40; i++) {
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(minR * minR + rng() * (maxR * maxR - minR * minR));
      const p = [Math.cos(a) * r, 0, Math.sin(a) * r];
      if (lanterns.some((L) => Math.hypot(p[0] - L[0], p[2] - L[2]) < gapLantern)) continue;
      if (lanterns.some((L) => segDist(p, start, L) < gapPath)) continue;
      return p;
    }
    return null;
  };

  for (let i = 0; i < 46; i++) {
    const p = freeSpot(7, R - 2.5, 6.5, 2.4);
    if (!p) continue;
    const s = 0.75 + rng() * 0.7;
    const m = compose(T(p[0], 0, p[2]), S(s));
    b.add('cyl6', compose(m, S(0.18, 1.3, 0.18)), COLORS.wood);
    b.add('cone8', compose(m, T(0, 1.0, 0), S(1.25, 1.9, 1.25)), i % 3 ? COLORS.leaf : COLORS.leaf2);
    b.add('cone8', compose(m, T(0, 2.1, 0), S(0.9, 1.5, 0.9)), COLORS.leaf2);
  }
  for (let i = 0; i < 26; i++) {
    const p = freeSpot(5, R - 1, 5, 1.6);
    if (!p) continue;
    b.add('sphereLo', compose(T(p[0], 0.1, p[2]), RY(rng() * 6), S(0.5 + rng() * 0.9, 0.35 + rng() * 0.45, 0.5 + rng() * 0.7)), COLORS.rock);
  }
  for (let i = 0; i < 70; i++) {
    const p = freeSpot(3, R - 1, 3, 1.2);
    if (!p) continue;
    b.add('cone4', compose(T(p[0], 0, p[2]), RY(rng() * 6), S(0.25, 0.35 + rng() * 0.3, 0.25)), COLORS.grass2);
  }

  // the dock ("bến") and two huts on the south-west shore
  const dockA = (215 * Math.PI) / 180;
  const dir = [Math.cos(dockA), 0, Math.sin(dockA)];
  const yaw = Math.atan2(dir[0], dir[2]);
  for (let s = R - 4; s < R + 9; s += 1.1) {
    b.add('box', compose(T(dir[0] * s, 0.05, dir[2] * s), RY(yaw), S(2.4, 0.12, 0.95)), COLORS.wood);
  }
  for (const side of [-1, 1]) {
    for (const s of [R + 1, R + 4.5, R + 8]) {
      const px = dir[0] * s + Math.cos(yaw) * side * 1.15;
      const pz = dir[2] * s - Math.sin(yaw) * side * 1.15;
      b.add('cyl6', compose(T(px, -2.5, pz), S(0.12, 3.2, 0.12)), COLORS.woodDark);
    }
  }
  for (const [off, side] of [[R - 9, -1], [R - 10, 1]]) {
    const px = dir[0] * off + Math.cos(yaw) * side * 5;
    const pz = dir[2] * off - Math.sin(yaw) * side * 5;
    b.add('box', compose(T(px, 1, pz), RY(yaw), S(3, 2, 3)), COLORS.wall);
    b.add('cone4', compose(T(px, 2, pz), RY(yaw + Math.PI / 4), S(2.7, 1.6, 2.7)), COLORS.roof);
  }

  // sea of clouds below and around the island
  b.add('cyl12', compose(T(0, -24, 0), S(320, 0.5, 320)), [0.17, 0.15, 0.28]);
  for (let i = 0; i < 40; i++) {
    const a = rng() * Math.PI * 2;
    const r = R + 12 + rng() * 120;
    const s = 4 + rng() * 9;
    b.add('sphereLo', compose(T(Math.cos(a) * r, -16 + rng() * 9, Math.sin(a) * r), S(s * 1.6, s * 0.6, s)), COLORS.cloud);
  }
  return b.build();
}

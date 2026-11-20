// Low-poly, flat-shaded geometry built in code (no external assets).
// Vertex layout (10 floats): position xyz, normal xyz, colour rgb, emissive.

import { m4, compose, transformPoint } from './mathx.js';
import { createRng } from '../core/rng.js';
import { groundHeight } from '../core/level.js';
import { RGB } from './palette.js';

export const FLOATS_PER_VERTEX = 10;

// ---------- primitives (local space) ----------

function box() {
  const v = [];
  for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) v.push([x, y, z]);
  const faces = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  const tris = [];
  for (const [a, b, c, d] of faces) tris.push([v[a], v[b], v[c]], [v[a], v[c], v[d]]);
  return { tris, center: [0, 0, 0] };
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
    if (rTop > 0) tris.push([b0, t1, t0], [[0, 1, 0], t0, t1]);
    if (rBot > 0) tris.push([[0, 0, 0], b1, b0]);
  }
  return { tris, center: [0, 0.5, 0] };
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
  return { tris, center: [0, 0, 0] };
}

const PRIM = {
  box: box(),
  cyl6: cylinder(6),
  cyl8: cylinder(8),
  cyl12: cylinder(12),
  cyl24: cylinder(24),
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

  /** Adds a named primitive under `matrix` (normals point away from its centre). */
  add(name, matrix, color, emit = 0) {
    const prim = PRIM[name];
    const ref = transformPoint(matrix, prim.center);
    for (const [a, b, c] of prim.tris) this.tri(transformPoint(matrix, a), transformPoint(matrix, b), transformPoint(matrix, c), color, emit, ref);
    return this;
  }

  /** Adds a convex solid given by world-space triangles. */
  addConvex(tris, color, emit = 0) {
    const all = tris.flat();
    const ref = [0, 1, 2].map((k) => all.reduce((s, p) => s + p[k], 0) / all.length);
    for (const [a, b, c] of tris) this.tri(a, b, c, color, emit, ref);
    return this;
  }

  build() {
    return new Float32Array(this.data);
  }
}

const T = m4.translate;
const S = m4.scale;
const RY = m4.rotY;
const quad = (a, b, c, d) => [[a, b, c], [a, c, d]];

const C = {
  leaf: [0.12, 0.3, 0.27],
  leaf2: [0.16, 0.36, 0.28],
  rock: [0.27, 0.24, 0.3],
  rockDark: [0.19, 0.16, 0.22],
  stone: [0.46, 0.45, 0.52],
  woodDark: [0.3, 0.2, 0.13],
  roof: [0.45, 0.17, 0.12],
  wall: [0.62, 0.5, 0.36],
  cloud: [0.2, 0.32, 0.42],
  straw: [0.9, 0.77, 0.47],
  skin: [0.96, 0.8, 0.66],
  hair: [0.12, 0.08, 0.08],
  bell: [0.85, 0.66, 0.28],
  pad: [0.35, 0.85, 0.8],
};

// ---------- small models (local space) ----------

/** Lantern on a pole; the paper is drawn with a per-state tint (lit / off). */
export function lanternModel() {
  const b = new MeshBuilder();
  b.add('cyl8', S(0.75, 0.35, 0.75), C.stone);
  b.add('cyl6', compose(T(0, 0.35, 0), S(0.13, 3.1, 0.13)), RGB.wood);
  b.add('cyl8', compose(T(0, 3.45, 0), S(0.44, 0.14, 0.44)), RGB.wood);
  b.add('cyl8', compose(T(0, 4.88, 0), S(0.4, 0.14, 0.4)), RGB.wood);
  b.add('cone8', compose(T(0, 5.02, 0), S(0.16, 0.32, 0.16)), RGB.gold);
  return b.build();
}

/** Lantern paper (separate so lit/off/blinking can be tinted and squashed). */
export function lanternPaperModel() {
  return new MeshBuilder().add('sphere', S(0.62, 0.78, 0.62), [1, 1, 1], 1).build();
}

export function moteModel() {
  return new MeshBuilder().add('sphereLo', S(0.13), RGB.moteCore, 1).build();
}

/** Shade body centred at the origin, facing +Z; rim/eyes in the outline colour. */
export function shadeModel(rim = RGB.shadeRim, body = RGB.shadeBody) {
  const b = new MeshBuilder();
  b.add('sphere', S(0.75, 0.85, 0.75), body);
  b.add('cone8', compose(T(0, -0.15, 0), m4.rotX(Math.PI), S(0.7, 1.05, 0.7)), body);
  b.add('cone4', compose(T(-0.36, 0.55, 0), S(0.16, 0.45, 0.16)), rim, 0.6);
  b.add('cone4', compose(T(0.36, 0.55, 0), S(0.16, 0.45, 0.16)), rim, 0.6);
  b.add('sphereLo', compose(T(-0.22, 0.16, 0.64), S(0.11, 0.13, 0.08)), rim, 1);
  b.add('sphereLo', compose(T(0.22, 0.16, 0.64), S(0.11, 0.13, 0.08)), rim, 1);
  return b.build();
}

/** Mây: feet at the origin, facing +Z; cream shirt, red scarf, nón lá with a small lantern. */
export function playerModel() {
  const b = new MeshBuilder();
  b.add('box', compose(T(-0.11, 0.17, 0), S(0.14, 0.34, 0.16)), C.woodDark);
  b.add('box', compose(T(0.11, 0.17, 0), S(0.14, 0.34, 0.16)), C.woodDark);
  b.add('taper12', compose(T(0, 0.3, 0), S(0.38, 0.75, 0.32)), RGB.shirt);
  b.add('cyl12', compose(T(0, 0.98, 0), S(0.25, 0.1, 0.22)), RGB.scarf);
  b.add('box', compose(T(0.12, 0.85, 0.2), m4.rotX(0.3), S(0.1, 0.32, 0.04)), RGB.scarf);
  b.add('cyl6', compose(T(-0.3, 0.55, 0), S(0.07, 0.45, 0.07)), RGB.shirt);
  b.add('cyl6', compose(T(0.3, 0.55, 0), S(0.07, 0.45, 0.07)), RGB.shirt);
  b.add('sphere', compose(T(0, 1.27, 0), S(0.24)), C.skin);
  b.add('sphere', compose(T(0, 1.31, -0.04), S(0.245)), C.hair);
  b.add('sphereLo', compose(T(-0.085, 1.29, 0.215), S(0.035)), C.hair);
  b.add('sphereLo', compose(T(0.085, 1.29, 0.215), S(0.035)), C.hair);
  b.add('cone16', compose(T(0, 1.4, 0), S(0.68, 0.36, 0.68)), C.straw);
  b.add('cyl6', compose(T(0, 1.18, 0.58), S(0.012, 0.24, 0.012)), C.woodDark);
  b.add('sphereLo', compose(T(0, 1.1, 0.58), S(0.11, 0.14, 0.11)), RGB.lanternLit, 1);
  b.add('cyl6', compose(T(0, 1.22, 0.58), S(0.06, 0.04, 0.06)), C.woodDark);
  return { mesh: b.build(), lanternLocal: [0, 1.1, 0.58] };
}

/** One silk segment of a Gió Lạc ribbon. */
export function ribbonModel() {
  return new MeshBuilder().add('box', S(0.55, 0.05, 0.28), RGB.drifter, 0.35).build();
}

/** Wind Charm: red talisman with a gold border. */
export function charmModel() {
  const b = new MeshBuilder();
  b.add('box', S(0.46, 0.62, 0.05), RGB.gold, 0.4);
  b.add('box', compose(T(0, 0, 0.02), S(0.36, 0.52, 0.05)), RGB.scarf, 0.5);
  b.add('box', compose(T(0, 0, 0.05), S(0.08, 0.3, 0.02)), RGB.gold, 0.6);
  return b.build();
}

export function leafModel() {
  return new MeshBuilder().add('box', S(0.22, 0.02, 0.12), [0.62, 0.66, 0.3], 0.2).build();
}

// ---------- static scenery for a night ----------

function addTiers(b, lv) {
  for (const t of lv.tiers) {
    if (t.kind === 'disc') {
      b.add('cyl48', S(t.r1, t.y, t.r1), RGB.grass);
      continue;
    }
    const seg = 24;
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI;
      const a1 = ((i + 1) / seg) * Math.PI;
      const p = (r, a, y) => [r * Math.cos(a), y, r * Math.sin(a)];
      const i0 = p(t.r0, a0, 0), i1 = p(t.r0, a1, 0), o0 = p(t.r1, a0, 0), o1 = p(t.r1, a1, 0);
      const I0 = p(t.r0, a0, t.y), I1 = p(t.r0, a1, t.y), O0 = p(t.r1, a0, t.y), O1 = p(t.r1, a1, t.y);
      b.addConvex([...quad(I0, O0, O1, I1), ...quad(i0, o0, o1, i1)], RGB.grass);
      b.addConvex([...quad(i0, i1, I1, I0), ...quad(o0, o1, O1, O0)], C.rock);
      if (i === 0) b.addConvex(quad(i0, o0, O0, I0), C.rock);
      if (i === seg - 1) b.addConvex(quad(i1, o1, O1, I1), C.rock);
    }
  }
  for (const rp of lv.ramps) {
    const a = (rp.angleDeg * Math.PI) / 180;
    const u = [Math.cos(a), Math.sin(a)];
    const v = [-Math.sin(a), Math.cos(a)];
    const P = (along, across, y) => [u[0] * along + v[0] * across, y, u[1] * along + v[1] * across];
    const h = rp.width / 2;
    const A0 = P(rp.rTop - 0.3, -h, 0), A1 = P(rp.rTop - 0.3, h, 0), B0 = P(rp.rFoot, -h, 0), B1 = P(rp.rFoot, h, 0);
    const At0 = P(rp.rTop - 0.3, -h, rp.yTop), At1 = P(rp.rTop - 0.3, h, rp.yTop);
    b.addConvex([...quad(At0, At1, B1, B0), ...quad(A0, A1, At1, At0), [A0, B0, At0], [A1, B1, At1], ...quad(A0, A1, B1, B0)], RGB.sand);
  }
  if (lv.tower) {
    const tw = lv.tower;
    b.add('cyl24', compose(T(tw.x, tw.base, tw.z), S(tw.r, tw.height, tw.r)), C.stone);
    b.add('cone8', compose(T(tw.x, tw.base + tw.height, tw.z), S(tw.r + 0.6, 2.4, tw.r + 0.6)), C.roof);
    b.add('sphereLo', compose(T(tw.x, tw.base + tw.height - 1.6, tw.z + tw.r - 0.1), S(0.7, 0.9, 0.5)), C.bell, 0.5);
  }
}

/** Islands, bridge, tiers, pads, paths, trees, rocks and clouds: one static mesh. */
export function sceneryModel(lv) {
  const b = new MeshBuilder();
  const rng = createRng(`scenery-${lv.id}`);
  const lanterns = lv.lanterns.map((l) => l.pos);

  for (const is of lv.islands) {
    b.add('cyl48', compose(T(is.x, -1.02, is.z), S(is.r + 0.4, 1, is.r + 0.4)), RGB.sand);
    b.add('cyl48', compose(T(is.x, -1, is.z), S(is.r - 1.4, 1, is.r - 1.4)), RGB.grass);
    b.add('cone16', compose(T(is.x, -1.02, is.z), m4.rotX(Math.PI), S(is.r + 0.4, is.r * 0.6, is.r + 0.4)), C.rock);
    b.add('cone8', compose(T(is.x + 5, -6, is.z - 3), m4.rotX(Math.PI), S(is.r * 0.55, is.r * 0.55, is.r * 0.55)), C.rockDark);
  }
  for (const br of lv.bridges) {
    for (let x = br.x0; x < br.x1; x += 0.9) b.add('box', compose(T(x + 0.4, -0.08, (br.z0 + br.z1) / 2), S(0.8, 0.16, br.z1 - br.z0)), RGB.wood);
    for (const x of [br.x0 + 1.5, br.x1 - 1.5]) for (const z of [br.z0, br.z1]) b.add('cyl6', compose(T(x, -3, z), S(0.15, 4.2, 0.15)), C.woodDark);
  }
  addTiers(b, lv);
  for (const pad of lv.pads) b.add('cyl24', compose(T(pad.pos[0], pad.pos[1] - 0.05, pad.pos[2]), S(pad.r, 0.12, pad.r)), C.pad, 0.6);

  const onLevel = (x, z, y) => {
    const g = groundHeight(lv, x, z);
    return g !== null && Math.abs(g - y) < 1e-6;
  };
  // stepping-stone paths from an anchor on the same ground to every lantern
  for (const L of lanterns) {
    const anchor = lv.id === 2 && L[0] > 35 ? [46, 0, 0] : lv.start;
    if (Math.abs(anchor[1] - L[1]) > 1e-6) continue;
    const d = Math.hypot(L[0] - anchor[0], L[2] - anchor[2]);
    let okPath = true;
    for (let s = 0; s <= d; s += 1) if (!onLevel(anchor[0] + ((L[0] - anchor[0]) * s) / d, anchor[2] + ((L[2] - anchor[2]) * s) / d, L[1])) okPath = false;
    if (!okPath) continue;
    for (let s = 2.2; s < d - 3; s += 1.9) {
      const k = s / d;
      b.add('cyl8', compose(T(anchor[0] + (L[0] - anchor[0]) * k + (rng() - 0.5) * 0.5, L[1] - 0.02, anchor[2] + (L[2] - anchor[2]) * k + (rng() - 0.5) * 0.5), RY(rng() * 3), S(0.55, 0.08, 0.45)), C.stone);
    }
  }

  const blocked = (p) =>
    lanterns.some((L) => Math.hypot(p[0] - L[0], p[2] - L[2]) < 6) ||
    lv.pads.some((pd) => Math.hypot(p[0] - pd.pos[0], p[2] - pd.pos[2]) < 3) ||
    Math.hypot(p[0] - lv.start[0], p[2] - lv.start[2]) < 5 ||
    lv.charms.some((c) => Math.hypot(p[0] - c.pos[0], p[2] - c.pos[2]) < 2.5) ||
    lv.moteSpawns.some((m) => Math.hypot(p[0] - m[0], p[2] - m[2]) < 1.6);
  const spot = (minEdge) => {
    for (let i = 0; i < 40; i++) {
      const is = lv.islands[Math.floor(rng() * lv.islands.length)];
      const a = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * (is.r - minEdge);
      const p = [is.x + Math.cos(a) * r, 0, is.z + Math.sin(a) * r];
      const g = groundHeight(lv, p[0], p[2]);
      if (g === null || blocked(p)) continue;
      if ([0, 1, 2, 3].some((k) => groundHeight(lv, p[0] + Math.cos(k * 1.57) * 1.5, p[2] + Math.sin(k * 1.57) * 1.5) !== g)) continue;
      p[1] = g;
      return p;
    }
    return null;
  };
  const area = lv.islands.reduce((s, is) => s + is.r * is.r, 0);
  const trees = Math.round(area / 45);
  for (let i = 0; i < trees; i++) {
    const p = spot(3);
    if (!p) continue;
    const s = 0.75 + rng() * 0.7;
    const m = compose(T(p[0], p[1], p[2]), S(s));
    b.add('cyl6', compose(m, S(0.18, 1.3, 0.18)), RGB.wood);
    b.add('cone8', compose(m, T(0, 1.0, 0), S(1.25, 1.9, 1.25)), i % 3 ? C.leaf : C.leaf2);
    b.add('cone8', compose(m, T(0, 2.1, 0), S(0.9, 1.5, 0.9)), C.leaf2);
  }
  for (let i = 0; i < trees * 0.6; i++) {
    const p = spot(1.5);
    if (p) b.add('sphereLo', compose(T(p[0], p[1] + 0.1, p[2]), RY(rng() * 6), S(0.5 + rng() * 0.9, 0.35 + rng() * 0.45, 0.5 + rng() * 0.7)), C.rock);
  }
  for (let i = 0; i < trees * 1.5; i++) {
    const p = spot(1.5);
    if (p) b.add('cone4', compose(T(p[0], p[1], p[2]), RY(rng() * 6), S(0.25, 0.35 + rng() * 0.3, 0.25)), C.leaf2);
  }
  if (lv.id === 1) {
    // the dock ("bến") and two huts on the south-west shore
    const a = (215 * Math.PI) / 180;
    const dir = [Math.cos(a), Math.sin(a)];
    const yaw = Math.atan2(dir[0], dir[1]);
    const R = lv.islands[0].r;
    for (let s = R - 3; s < R + 9; s += 1.1) b.add('box', compose(T(dir[0] * s, 0.05, dir[1] * s), RY(yaw), S(2.4, 0.12, 0.95)), RGB.wood);
    for (const [off, side] of [[R - 8, -1], [R - 9, 1]]) {
      const px = dir[0] * off + Math.cos(yaw) * side * 5;
      const pz = dir[1] * off - Math.sin(yaw) * side * 5;
      b.add('box', compose(T(px, 1, pz), RY(yaw), S(3, 2, 3)), C.wall);
      b.add('cone4', compose(T(px, 2, pz), RY(yaw + Math.PI / 4), S(2.7, 1.6, 2.7)), C.roof);
    }
  }
  const cx = lv.islands.reduce((s, is) => s + is.x, 0) / lv.islands.length;
  b.add('cyl12', compose(T(cx, -24, 0), S(360, 0.5, 360)), RGB.cloudSea);
  for (let i = 0; i < 46; i++) {
    const a = rng() * Math.PI * 2;
    const r = 55 + rng() * 120;
    const s = 4 + rng() * 9;
    b.add('sphereLo', compose(T(cx + Math.cos(a) * r, -16 + rng() * 9, Math.sin(a) * r), S(s * 1.6, s * 0.6, s)), C.cloud);
  }
  return b.build();
}

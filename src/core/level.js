// Standard maps (Ticket-02, Part 2). Angle θ on the map is the point
// (r·cos θ, r·sin θ) on (X, Z): the ramps at 30°/150° and the tier-1 motes at
// 20°–160° must land on the z > 0 half, which only this reading satisfies.

const deg = (a) => (a * Math.PI) / 180;
const round3 = (x) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v;
};
const ring = (r, startDeg, stepDeg, count, y = 0, cx = 0, cz = 0) =>
  Array.from({ length: count }, (_, i) => {
    const a = deg(startDeg + stepDeg * i);
    return [round3(cx + r * Math.cos(a)), y, round3(cz + r * Math.sin(a))];
  });
const ids = (list) => list.map((pos, i) => ({ id: `L${i + 1}`, pos }));

const NIGHTS = {
  1: {
    id: 1,
    name: 'Đảo Bến',
    start: [0, 0, 0],
    islands: [{ x: 0, z: 0, r: 40 }],
    bridges: [],
    tiers: [],
    ramps: [],
    tower: null,
    pads: [],
    lanterns: ids([[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]),
    moteSpawns: [...ring(12, 0, 45, 8), ...ring(33, 0, 22.5, 16)],
    shadeSpawns: ring(37, 15, 30, 12),
    shadeEveryS: 8,
    shadeMax: 6,
    charms: [],
    drifters: false,
    wind: false,
  },
  2: {
    id: 2,
    name: 'Đảo Cau',
    start: [0, 0, 0],
    islands: [{ x: 0, z: 0, r: 28 }, { x: 70, z: 0, r: 28 }],
    bridges: [{ x0: 26, x1: 44, z0: -2, z1: 2 }],
    tiers: [],
    ramps: [],
    tower: null,
    pads: [
      { pos: [20, 0, 18], r: 1, vy: 14, speed: 24, toward: [70, 0, 0] },
      { pos: [50, 0, -18], r: 1, vy: 14, speed: 24, toward: [0, 0, 0] },
    ],
    lanterns: ids([[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]]),
    moteSpawns: [...ring(10, 0, 90, 4), ...ring(22, 0, 45, 8), ...ring(10, 0, 90, 4, 0, 70), ...ring(22, 0, 45, 8, 0, 70)],
    shadeSpawns: [...ring(26, 22.5, 45, 8), ...ring(26, 22.5, 45, 8, 0, 70)],
    shadeEveryS: 7,
    shadeMax: 8,
    charms: [{ id: 'C1', pos: [35, 0, 0] }],
    drifters: true,
    wind: false,
  },
  3: {
    id: 3,
    name: 'Đảo Chuông',
    start: [0, 0, -30],
    islands: [{ x: 0, z: 0, r: 45 }],
    bridges: [],
    tiers: [
      { y: 3, kind: 'annulus', r0: 12, r1: 24, zPositive: true },
      { y: 6, kind: 'disc', r1: 8 },
    ],
    ramps: [
      { angleDeg: 30, rTop: 24, rFoot: 30, width: 3, yTop: 3 },
      { angleDeg: 150, rTop: 24, rFoot: 30, width: 3, yTop: 3 },
    ],
    tower: { x: 0, z: 0, r: 2, base: 6, height: 8 },
    pads: [{ pos: [0, 3, 13], r: 1, vy: 12, speed: 8, dir: [0, 0, -1] }],
    lanterns: ids([[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]]),
    moteSpawns: [...ring(34, 0, 20, 18, 0), ...ring(18, 20, 20, 8, 3), ...ring(5, 45, 90, 4, 6)],
    shadeSpawns: ring(43, 0, 22.5, 16),
    shadeEveryS: 6,
    shadeMax: 10,
    charms: [{ id: 'C1', pos: [30, 0, 25] }, { id: 'C2', pos: [-30, 0, 25] }],
    drifters: true,
    wind: true,
  },
};

export function getNight(night) {
  const lv = NIGHTS[night];
  if (!lv) {
    const err = new Error(`night ${night} is not available (only: ${Object.keys(NIGHTS).join(', ')})`);
    err.code = 'BAD_NIGHT';
    throw err;
  }
  return lv;
}

export function availableNights() {
  return Object.keys(NIGHTS).map(Number);
}

function inTier(t, x, z) {
  const r = Math.hypot(x, z);
  if (t.kind === 'disc') return r <= t.r1;
  return r >= t.r0 && r <= t.r1 && (!t.zPositive || z > 0);
}

function rampHeight(rp, x, z) {
  const a = deg(rp.angleDeg);
  const along = x * Math.cos(a) + z * Math.sin(a);
  const across = Math.abs(-x * Math.sin(a) + z * Math.cos(a));
  if (across > rp.width / 2 || along < rp.rTop || along > rp.rFoot) return null;
  return (rp.yTop * (rp.rFoot - along)) / (rp.rFoot - rp.rTop);
}

/** Ground height at (x, z), or null over the sea of clouds. */
export function groundHeight(lv, x, z) {
  const onLand =
    lv.islands.some((i) => Math.hypot(x - i.x, z - i.z) <= i.r) ||
    lv.bridges.some((b) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1);
  if (!onLand) return null;
  let h = 0;
  for (const t of lv.tiers) if (inTier(t, x, z)) h = Math.max(h, t.y);
  for (const rp of lv.ramps) {
    const hr = rampHeight(rp, x, z);
    if (hr !== null) h = Math.max(h, hr);
  }
  return h;
}

/** True when (x, z) at height y is inside a solid obstacle (the bell tower). */
export function insideObstacle(lv, x, z, y = 0) {
  const t = lv.tower;
  return Boolean(t && Math.hypot(x - t.x, z - t.z) < t.r && y < t.base + t.height);
}

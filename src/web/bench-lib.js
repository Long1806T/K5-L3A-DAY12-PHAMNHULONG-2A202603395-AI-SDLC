// The standard benchmark scene and its maths (Ticket-04 §1), shared by the
// browser bench page (src/web/bench.js) and the runner (tools/bench.js).
// Pure: only the seeded core RNG, no DOM.
import { createRng } from '../core/rng.js';

export const BENCH = Object.freeze({ shades: 200, motes: 100, litLanterns: ['L1', 'L2', 'L3'], warmupS: 3, width: 1280, height: 720, orbitR: 30, orbitY: 15, orbitPeriodS: 15 });

/** Night 1 with 200 wandering shades and 100 motes spread evenly (area-uniform) over the island, L1–L3 lit at fuel 100, Mây at (0,0,0). */
export function benchScenario(seed, level) {
  const isl = level.islands[0];
  const R = isl.r - 3; // keep clear of the shore
  const spread = (rng) => {
    const a = rng() * Math.PI * 2;
    const r = R * Math.sqrt(rng());
    return [Math.round((isl.x + Math.cos(a) * r) * 1000) / 1000, Math.round((isl.z + Math.sin(a) * r) * 1000) / 1000];
  };
  const rs = createRng(`bench|${seed}|shades`);
  const rm = createRng(`bench|${seed}|motes`);
  return {
    player: { pos: [0, 0, 0], carried: 0 },
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    lanterns: BENCH.litLanterns.map((id) => ({ id, lit: true, fuel: 100 })),
    shades: Array.from({ length: BENCH.shades }, (_, i) => {
      const [x, z] = spread(rs);
      return { id: `S${i + 1}`, pos: [x, 1, z], state: 'wander' };
    }),
    motes: Array.from({ length: BENCH.motes }, (_, i) => {
      const [x, z] = spread(rm);
      return { id: `M${i + 1}`, pos: [x, 0, z] };
    }),
  };
}

/**
 * Tuning for the bench: the systems Ticket-04 switches off are off, everything
 * else (wander movement, lights, effects) is the real game. No new entities
 * (scenario random_* = false), no damage, no pickup, no fuel burn, no end of night.
 */
export function benchTuning(T) {
  return { ...T, shade_hit_radius: -1, pickup_radius: -1, fuel_decay_per_s: 0, drain_per_s: 0, night1_duration_s: 1e7 };
}

/** Camera at time t (s): circle r = 30 m at y = 15 around (0,0,0), starting at (30,15,0), counter-clockwise seen from above (+Y), 15 s per turn. */
export function benchCamera(t) {
  const a = (2 * Math.PI * t) / BENCH.orbitPeriodS;
  return { eye: [BENCH.orbitR * Math.cos(a), BENCH.orbitY, -BENCH.orbitR * Math.sin(a)], target: [0, 0, 0] };
}

/** Ticket-04 frame statistics from per-frame times dt (ms). */
export function benchStats(dts) {
  const N = dts.length;
  if (!N) return { frames: 0, avg_fps: 0, p1_low_fps: 0, frame_ms_p95: 0 };
  const sum = dts.reduce((a, b) => a + b, 0);
  const sorted = [...dts].sort((a, b) => a - b);
  const k = Math.max(1, Math.ceil(0.01 * N));
  const worst = sorted.slice(N - k);
  const worstMean = worst.reduce((a, b) => a + b, 0) / k;
  const p95 = sorted[Math.max(0, Math.ceil(0.95 * N) - 1)]; // nearest-rank percentile
  const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
  return { frames: N, avg_fps: r((1000 * N) / sum, 1), p1_low_fps: r(1000 / worstMean, 1), frame_ms_p95: r(p95, 2) };
}

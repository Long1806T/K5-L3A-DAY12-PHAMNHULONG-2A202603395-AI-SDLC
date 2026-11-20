#!/usr/bin/env node
// Soak test (Ticket-04 §2): N nights back to back in ONE process, cycling
// Night 1 → 2 → 3, night i (0-based) on seed + i, random seeded inputs.
//   node tools/soak.js --seed 7 --nights 10 --out soak.json [--jit]
// Each night runs until it ends or its standard length is over. Every tick also
// builds the snapshot/event JSON the headless runner writes (then drops it), so
// the whole output path is exercised. Memory = process RSS after a forced GC.
//
// V8's optimising compilers (TurboFan, Maglev) keep their compile-time memory in
// malloc arenas that are not handed back to the OS: that alone grows RSS by
// 50–75 MB over the first nights and then plateaus, while the game's own JS heap
// stays flat (~5 MB). To measure the game rather than the JIT, the soak turns the
// optimising tiers off (same results, only slower). `--jit` keeps them on, and
// both heap and RSS are reported either way (see docs/notes/phase-4.md).
import v8 from 'node:v8';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JIT = process.argv.includes('--jit');
const V8_FLAGS = JIT ? [] : ['--no-opt', '--no-maglev'];
for (const f of [...V8_FLAGS, '--expose-gc']) v8.setFlagsFromString(f); // before any game code is compiled
const gc = vm.runInNewContext('gc');

const { createWorld, step, snapshot, TICK_RATE } = await import('../src/core/sim.js');
const { createRng } = await import('../src/core/rng.js');
const { loadTuning } = await import('../src/headless.js');

const toMb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;
function settled() {
  gc();
  gc();
  const m = process.memoryUsage();
  return { rss: toMb(m.rss), heap: toMb(m.heapUsed) };
}

/** Ticket-04 input model: new direction every 30 ticks; per tick 5 % jump, 3 % dash, 2 % pulse, 10 % interact. */
export function soakInputs(seed) {
  const rng = createRng(`soak-input|${seed}`);
  let move = [0, 0];
  return (tick) => {
    if (tick % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    const jump = rng() < 0.05;
    const dash = rng() < 0.03;
    const pulse = rng() < 0.02;
    const interact = rng() < 0.1;
    return { move, jump, dash, pulse, interact, cam_yaw_deg: 0, pause: false };
  };
}

/** Plays a loaded night to its end (or its standard length); returns a summary. */
export function playSoakNight(world, tuning) {
  const limit = tuning[`night${world.night}_duration_s`] * TICK_RATE;
  const input = soakInputs(world.seed);
  let events = 0;
  let bytes = JSON.stringify(snapshot(world)).length;
  while (world.state === 'playing' && world.tick < limit) {
    for (const e of step(world, input(world.tick))) {
      bytes += JSON.stringify({ type: 'event', tick: e.tick, name: e.name, data: e.data }).length;
      events += 1;
    }
    if (world.tick % 10 === 0) bytes += JSON.stringify(snapshot(world)).length;
  }
  const result = world.state === 'playing' ? 'timeout' : world.state;
  return { night: world.night, seed: world.seed, result, reason: world.result?.reason ?? null, ticks: world.tick, score: world.score, events, json_bytes: bytes };
}

export function runSoak({ seed = '7', nights = 10, tuning = loadTuning(), log = () => {} } = {}) {
  const t0 = process.hrtime.bigint();
  const base = BigInt(seed);
  const results = [];
  const detail = [];
  let crashes = 0;
  let start = null;
  for (let i = 0; i < nights; i++) {
    const night = (i % 3) + 1;
    const s = String(base + BigInt(i));
    try {
      let world = createWorld({ tuning, night, seed: s });
      if (i === 0) start = settled(); // "RSS after the first night has loaded"
      const summary = playSoakNight(world, tuning);
      world = null; // reset: nothing of this night is kept
      results.push(summary.result);
      detail.push(summary);
      log(`night ${i + 1}/${nights}: Đêm ${night} seed ${s} → ${summary.result} (${summary.reason}) tick ${summary.ticks}, score ${summary.score}`);
    } catch (e) {
      crashes += 1;
      results.push('crash');
      detail.push({ night, seed: s, result: 'crash', error: String(e && e.message ? e.message : e) });
      log(`night ${i + 1}/${nights}: CRASH ${e && e.message}`);
    }
  }
  const end = settled(); // after the last night has been reset
  return {
    nights,
    crashes,
    results,
    mem_start_mb: start ? start.rss : null,
    mem_end_mb: end.rss,
    duration_s: Math.round(Number(process.hrtime.bigint() - t0) / 1e8) / 10,
    // extra fields (not required by the ticket)
    seed: Number(seed),
    heap_start_mb: start ? start.heap : null,
    heap_end_mb: end.heap,
    v8_flags: V8_FLAGS.join(' ') || '(mặc định, có JIT tối ưu)',
    mem_note: 'RSS và heap JS đọc sau 2 lần GC toàn phần: mem_start sau khi tải xong Đêm đầu, mem_end sau khi Đêm cuối kết thúc và đã được giải phóng',
    node: process.version,
    detail,
  };
}

function main(argv) {
  const get = (k, d) => {
    const i = argv.indexOf(k);
    if (i !== -1) return argv[i + 1];
    const eq = argv.find((a) => a.startsWith(`${k}=`));
    return eq ? eq.slice(k.length + 1) : d;
  };
  const seed = String(get('--seed', '7')).trim();
  const nights = Number(get('--nights', '10'));
  const out = get('--out', 'soak.json');
  if (!/^[+-]?\d+$/.test(seed) || !Number.isInteger(nights) || nights < 1) {
    process.stderr.write('usage: node tools/soak.js --seed <int> --nights <int ≥ 1> --out <file.json> [--jit]\n');
    return 1;
  }
  const report = runSoak({ seed: BigInt(seed).toString(), nights, log: (m) => process.stdout.write(`${m}\n`) });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  const ok = report.crashes === 0 && report.mem_end_mb <= 1.2 * report.mem_start_mb;
  process.stdout.write(
    `crashes ${report.crashes} · RSS ${report.mem_start_mb} → ${report.mem_end_mb} MB · heap ${report.heap_start_mb} → ${report.heap_end_mb} MB · ` +
      `ngưỡng (crashes = 0, RSS ≤ ×1,2): ${ok ? 'đạt' : 'KHÔNG đạt'} · ${report.duration_s} s → ${out}\n`,
  );
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

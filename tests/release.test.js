// Phase 4 (Ticket-04 "Bình minh: phát hành v1.0.0"): soak, bench scene and maths,
// local leaderboard (rules, disk API, export command), accessibility basics.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { CONTRACT, ROOT, T, tmp } from './helpers.js';
import { createWorld, step, FUEL_UNITS } from '../src/core/sim.js';
import { getNight, groundHeight } from '../src/core/level.js';
import { validateScenario } from '../src/core/validate.js';
import { BENCH, benchScenario, benchTuning, benchCamera, benchStats } from '../src/web/bench-lib.js';
import { validateName, insertEntry, makeEntry, sortEntries, normalizeBoard, isoLocal } from '../src/web/leaderboard.js';
import { DEFAULT_KEYS, ACTIONS, keyConflict, normalizeCode } from '../src/web/settings.js';
import { createAppServer, exportLeaderboard } from '../tools/serve.js';

const node = (args, opts = {}) => spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', ...opts });
const cmd = (k) => CONTRACT[k].split(/\s+/).slice(1); // "node tools/x.js" → ["tools/x.js"]

// ---- soak (§2) ---------------------------------------------------------------
test('P4-2 soak_cmd --seed 7 --nights 10: 10 nights 1→2→3, seed 7+i, no crash, RSS end ≤ 1.2 × start', () => {
  const out = tmp('soak.json');
  const r = node([...cmd('soak_cmd'), '--seed', '7', '--nights', '10', '--out', out]);
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.equal(j.nights, 10);
  assert.equal(j.crashes, 0);
  assert.equal(j.results.length, 10);
  for (const x of j.results) assert.ok(['won', 'lost'].includes(x), x);
  assert.deepEqual(j.detail.map((d) => d.night), [1, 2, 3, 1, 2, 3, 1, 2, 3, 1]);
  assert.deepEqual(j.detail.map((d) => d.seed), ['7', '8', '9', '10', '11', '12', '13', '14', '15', '16']);
  for (const d of j.detail) assert.ok(d.ticks <= T[`night${d.night}_duration_s`] * 60, 'never past the standard length');
  assert.ok(j.mem_start_mb > 0 && j.mem_end_mb > 0 && j.duration_s > 0);
  assert.ok(j.mem_end_mb <= 1.2 * j.mem_start_mb, `RSS ${j.mem_start_mb} → ${j.mem_end_mb} MB`);
});

test('P4-2 soak is deterministic: same seed → same nights, results, ticks and scores', async () => {
  const { runSoak } = await import('../tools/soak.js');
  const strip = (r) => r.detail.map(({ night, seed, result, reason, ticks, score, events }) => ({ night, seed, result, reason, ticks, score, events }));
  const a = runSoak({ seed: '7', nights: 4 });
  const b = runSoak({ seed: '7', nights: 4 });
  assert.deepEqual(strip(a), strip(b));
  assert.notDeepEqual(strip(a), strip(runSoak({ seed: '8', nights: 4 })));
});

test('P4-2 soak inputs: new direction every 30 ticks; 5 % jump, 3 % dash, 2 % pulse, 10 % interact per tick', async () => {
  const { soakInputs } = await import('../tools/soak.js');
  const input = soakInputs('7');
  const n = 120000;
  const count = { jump: 0, dash: 0, pulse: 0, interact: 0 };
  let prev = null;
  for (let t = 0; t < n; t++) {
    const i = input(t);
    for (const k of Object.keys(count)) count[k] += i[k] ? 1 : 0;
    assert.ok(Math.abs(Math.hypot(...i.move) - 1) < 1e-9, 'unit direction');
    if (prev && t % 30 !== 0) assert.deepEqual(i.move, prev, 'direction only changes every 30 ticks');
    prev = i.move;
  }
  for (const [k, p] of Object.entries({ jump: 0.05, dash: 0.03, pulse: 0.02, interact: 0.1 })) {
    assert.ok(Math.abs(count[k] / n - p) < 0.004, `${k}: ${(count[k] / n).toFixed(4)} vs ${p}`);
  }
});

// ---- benchmark scene (§1) ----------------------------------------------------
function benchWorld(seed = '42') {
  const lv = getNight(1);
  const scenario = validateScenario(benchScenario(seed, lv), lv.lanterns.map((l) => l.id));
  return createWorld({ tuning: benchTuning(T), night: 1, seed, scenario });
}

test('P4-3 bench scene: Night 1, 200 wander shades and 100 motes spread over the island, L1–L3 lit at fuel 100, Mây at (0,0,0)', () => {
  const w = benchWorld();
  assert.equal(w.shades.length, 200);
  assert.ok(w.shades.every((s) => s.state === 'wander'));
  assert.equal(w.motes.length, 100);
  assert.deepEqual(w.player.pos, [0, 0, 0]);
  assert.deepEqual(w.lanterns.map((l) => [l.id, l.lit, l.fuel]), [['L1', true, 6000], ['L2', true, 6000], ['L3', true, 6000], ['L4', false, 0], ['L5', false, 0]]);
  for (const e of [...w.shades, ...w.motes]) assert.notEqual(groundHeight(w.level, e.pos[0], e.pos[2]), null, 'on the island');
  // spread evenly: every quarter of the island holds roughly a quarter of the shades
  const q = [0, 0, 0, 0];
  for (const s of w.shades) q[(s.pos[0] >= 0 ? 1 : 0) + (s.pos[2] >= 0 ? 2 : 0)] += 1;
  for (const n of q) assert.ok(n > 30 && n < 70, `quadrants ${q}`);
  assert.deepEqual(benchWorld().shades.map((s) => s.pos), w.shades.map((s) => s.pos), 'seed 42 always gives the same scene');
  assert.notDeepEqual(benchWorld('43').shades.map((s) => s.pos), w.shades.map((s) => s.pos));
});

test('P4-3 bench scene: no spawning, damage, pickup, fuel burn or end of night; shades still wander', () => {
  const w = benchWorld();
  const start = w.shades.map((s) => [...s.pos]);
  const ticks = T.night1_duration_s * 60 + 60; // past the normal dawn
  let events = 0;
  for (let i = 0; i < ticks; i++) events += step(w, { move: [0, 0], cam_yaw_deg: 0 }).length;
  assert.equal(w.state, 'playing');
  assert.equal(events, 0, 'no spawn, hit, pickup, fuel or game_over events');
  assert.equal(w.shades.length, 200);
  assert.equal(w.motes.length, 100);
  assert.equal(w.player.flames, T.flames);
  assert.ok(w.lanterns.slice(0, 3).every((l) => l.lit && l.fuel === T.fuel_max * FUEL_UNITS));
  const moved = w.shades.filter((s, i) => Math.hypot(s.pos[0] - start[i][0], s.pos[2] - start[i][2]) > 1).length;
  assert.ok(moved > 180, `${moved} shades moved`);
});

test('P4-3 bench camera: r 30 m, y 15 m, looks at (0,0,0), starts at (30,15,0), counter-clockwise from above, 15 s a turn', () => {
  const near = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
  assert.ok(near(benchCamera(0).eye, [30, 15, 0]));
  // right-handed, Y up: a counter-clockwise turn seen from +Y takes +X towards −Z
  assert.ok(near(benchCamera(3.75).eye, [0, 15, -30]));
  assert.ok(near(benchCamera(7.5).eye, [-30, 15, 0]));
  assert.ok(near(benchCamera(15).eye, [30, 15, 0]));
  assert.deepEqual(benchCamera(5).target, [0, 0, 0]);
  for (let t = 0; t < 15; t += 0.7) assert.ok(Math.abs(Math.hypot(benchCamera(t).eye[0], benchCamera(t).eye[2]) - 30) < 1e-9);
});

test('P4-3 bench maths: avg_fps = 1000N/Σdt, p1_low = 1000/mean(k worst), k = max(1, ceil(0.01N)), p95 of dt', () => {
  const dts = [...Array(198).fill(10), 40, 60]; // N = 200 → k = 2
  const s = benchStats(dts);
  assert.equal(s.frames, 200);
  assert.equal(s.avg_fps, Math.round(((1000 * 200) / (198 * 10 + 100)) * 10) / 10);
  assert.equal(s.p1_low_fps, 20); // mean(40, 60) = 50 ms
  assert.equal(s.frame_ms_p95, 10);
  assert.equal(benchStats([16, 16, 16]).p1_low_fps, 62.5); // k = 1
  const ramp = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(benchStats(ramp).frame_ms_p95, 95);
  assert.equal(BENCH.warmupS, 3);
  assert.deepEqual([BENCH.width, BENCH.height], [1280, 720]);
});

// ---- leaderboard (§3) --------------------------------------------------------
const entry = (name, score, at, extra = {}) => ({ name, score, nights_won: 1, achieved_at: at, seed: 7, ...extra });

test('P4-4 names: 3–12 characters of [A-Za-z0-9_]; Vietnamese letters with diacritics are accepted too', () => {
  for (const ok of ['abc', 'Long_1806', 'A'.repeat(12), 'Đăng', 'Mây_Nhỏ', 'Nguyễn_Lâm']) assert.ok(validateName(ok).ok, ok);
  for (const bad of ['', 'ab', 'A'.repeat(13), 'Long 1806', 'x-y-z', 'a.b.c', '<b>hi</b>']) assert.equal(validateName(bad).ok, false, bad);
  assert.equal(validateName('  Long_1806 ').name, 'Long_1806', 'trimmed');
  assert.equal(validateName('Mây').name, 'Mây', 'combining marks are normalised (NFC)');
});

test('P4-4 entries: name, score, nights_won 0–3, achieved_at ISO 8601 with a time zone, seed', () => {
  assert.deepEqual(makeEntry(entry('Long', 120, '2026-11-20T21:00:00+07:00')), { name: 'Long', score: 120, nights_won: 1, achieved_at: '2026-11-20T21:00:00+07:00', seed: 7 });
  assert.match(isoLocal(new Date(Date.UTC(2026, 10, 20, 14, 0, 0))), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
  for (const bad of [{ score: -1 }, { score: 1.5 }, { nights_won: 4 }, { achieved_at: '2026-11-20T21:00:00' }, { achieved_at: 'yesterday' }, { seed: 'abc' }]) {
    assert.throws(() => makeEntry({ ...entry('Long', 1, '2026-11-20T21:00:00Z'), ...bad }), undefined, JSON.stringify(bad));
  }
});

test('P4-4 order: score high → low; equal score → whoever reached it first stays above; only the top 10 are kept', () => {
  let board = [];
  board = insertEntry(board, entry('Late', 300, '2026-11-20T22:00:00+07:00')).entries;
  board = insertEntry(board, entry('Early', 300, '2026-11-20T21:00:00+07:00')).entries;
  board = insertEntry(board, entry('Best', 900, '2026-11-20T23:00:00+07:00')).entries;
  assert.deepEqual(board.map((e) => e.name), ['Best', 'Early', 'Late']);
  // same score, same moment: the one saved first stays above
  board = insertEntry(board, entry('First', 100, '2026-11-20T20:00:00Z')).entries;
  board = insertEntry(board, entry('Second', 100, '2026-11-20T20:00:00Z')).entries;
  assert.deepEqual(board.slice(-2).map((e) => e.name), ['First', 'Second']);
  // time zones are compared as instants: 21:00+07:00 is earlier than 15:00Z
  assert.deepEqual(sortEntries([entry('Utc', 5, '2026-11-20T15:00:00Z'), entry('Hanoi', 5, '2026-11-20T21:00:00+07:00')]).map((e) => e.name), ['Hanoi', 'Utc']);
  for (let i = 0; i < 12; i++) board = insertEntry(board, entry(`P${String(i).padStart(2, '0')}`, 200 + i, `2026-11-21T0${i % 10}:00:00Z`)).entries;
  assert.equal(board.length, 10);
  const low = insertEntry(board, entry('Lowest', 0, '2026-11-22T00:00:00Z'));
  assert.equal(low.rank, null, 'missed the top 10');
  assert.equal(low.entries.length, 10);
  assert.equal(insertEntry(board, entry('Champion', 5000, '2026-11-22T00:00:00Z')).rank, 1);
  assert.deepEqual(normalizeBoard([{ name: 'x' }, ...board]).length, 10, 'invalid stored rows are dropped');
});

test('P4-4 disk API keeps the board between runs; run_cmd --export-leaderboard writes {"entries": [...]} in order', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-lb-'));
  const file = path.join(dir, 'leaderboard.json');
  const post = async (srv, body) => {
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/api/leaderboard`, { method: 'POST', body: JSON.stringify(body) });
    return { status: r.status, json: await r.json() };
  };
  let srv = createAppServer({ file });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  assert.equal((await post(srv, entry('Mây', 150, '2026-11-20T21:00:00+07:00'))).json.rank, 1);
  assert.equal((await post(srv, entry('Đăng_01', 420, '2026-11-20T21:30:00+07:00', { nights_won: 3 }))).json.rank, 1);
  const bad = await post(srv, entry('no', 1, '2026-11-20T21:00:00+07:00'));
  assert.equal(bad.status, 400);
  await new Promise((r) => srv.close(r));
  // a new server process would read the same file: the board survives a restart
  srv = createAppServer({ file });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const got = await (await fetch(`http://127.0.0.1:${srv.address().port}/api/leaderboard`)).json();
  await new Promise((r) => srv.close(r));
  assert.deepEqual(got.entries.map((e) => e.name), ['Đăng_01', 'Mây']);
  // the real run_cmd with --export-leaderboard: no server, no browser, just the file
  const out = path.join(dir, 'out.json');
  const r = node([...cmd('run_cmd'), '--export-leaderboard', out], { env: { ...process.env, DDL_DATA_DIR: dir }, timeout: 15000 });
  assert.equal(r.status, 0, r.stderr);
  const exported = JSON.parse(fs.readFileSync(out, 'utf8'));
  assert.deepEqual(Object.keys(exported), ['entries']);
  assert.deepEqual(exported.entries, got.entries);
  assert.deepEqual(Object.keys(exported.entries[0]), ['name', 'score', 'nights_won', 'achieved_at', 'seed']);
  assert.equal(exportLeaderboard(path.join(dir, 'empty.json'), path.join(dir, 'none.json')), 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'empty.json'), 'utf8')), { entries: [] });
});

// ---- accessibility (§4) ------------------------------------------------------
test('P4-5 every action can be remapped; defaults are distinct; a duplicate key is detected', () => {
  const required = ['up', 'down', 'left', 'right', 'jump', 'dash', 'interact', 'pulse', 'pause'];
  for (const a of required) assert.ok(ACTIONS.some(([x]) => x === a) && DEFAULT_KEYS[a], a);
  const codes = Object.values(DEFAULT_KEYS);
  assert.equal(new Set(codes).size, codes.length);
  assert.equal(keyConflict(DEFAULT_KEYS, 'jump', 'KeyE'), 'interact');
  assert.equal(keyConflict(DEFAULT_KEYS, 'jump', 'KeyJ'), null);
  assert.equal(keyConflict(DEFAULT_KEYS, 'jump', 'Space'), null, 'its own key is not a conflict');
  assert.equal(normalizeCode('ShiftRight'), 'Shift');
});

test('P4-5 UI text is at least 18 px at 1280×720 and scales with the large-text option', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sizes = [...html.matchAll(/font(?:-size)?:\s*([^;]+);/g)].map((m) => m[1]);
  assert.ok(sizes.length > 10);
  for (const v of sizes) {
    const px = v.match(/(\d+(?:\.\d+)?)px/);
    if (!px) continue;
    assert.ok(Number(px[1]) >= 18, `font ${v}`);
    assert.match(v, /var\(--ui-scale\)/, `font ${v} follows the large-text option`);
  }
});

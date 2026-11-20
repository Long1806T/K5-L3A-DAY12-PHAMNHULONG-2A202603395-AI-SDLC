// Core rules with the Ticket-02 standard numbers (regression of Phase 1 AC4–AC13).
// Tests whose expectation changed in Phase 2 say why in a "P2:" comment;
// docs/notes/phase-2.md §1 lists every replaced Phase 1 rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { T, bare, sim, dist } from './helpers.js';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const L1 = [0, 0, 25];
const tap = (k, key) => [{ tick: k, [key]: true }, { tick: k + 1, [key]: false }];

// ---------- movement & input ----------

test('move [0,1] at yaw 0 walks +Z at player_speed (velocity changes instantly, ≤ 0.1 s)', () => {
  const { snaps } = sim({ scenario: bare(), frames: [{ tick: 0, move: [0, 1] }], ticks: 60 });
  close(snaps[60].player.pos[2], T.player_speed);
  assert.deepEqual(snaps[1].player.vel, [0, 0, T.player_speed]);
});

test("cam_yaw_deg rotates move with x' = x cos + z sin, z' = -x sin + z cos", () => {
  const run = (yaw, move) => sim({ scenario: bare(), frames: [{ tick: 0, move, cam_yaw_deg: yaw }], ticks: 60 }).snaps[60].player.pos;
  let p = run(90, [0, 1]);
  close(p[0], T.player_speed);
  close(p[2], 0);
  p = run(30, [1, 0]);
  close(p[0], T.player_speed * Math.cos(Math.PI / 6));
  close(p[2], -T.player_speed * Math.sin(Math.PI / 6));
});

test('move longer than 1 is normalised, shorter is kept', () => {
  let p = sim({ scenario: bare(), frames: [{ tick: 0, move: [1, 1] }], ticks: 60 }).snaps[60].player.pos;
  close(Math.hypot(p[0], p[2]), T.player_speed);
  p = sim({ scenario: bare(), frames: [{ tick: 0, move: [0.5, 0] }], ticks: 60 }).snaps[60].player.pos;
  close(p[0], T.player_speed * 0.5);
});

test('frames only change the fields they contain; no inputs = standing still', () => {
  const { snaps } = sim({ scenario: bare(), frames: [{ tick: 0, move: [0, 1] }, { tick: 30, cam_yaw_deg: 90 }], ticks: 60 });
  close(snaps[30].player.pos[2], 3);
  close(snaps[60].player.pos[0], 3);
  assert.deepEqual(sim({ scenario: bare(), ticks: 120 }).snaps[120].player.pos, [0, 0, 0]);
});

test('jump: 7 m/s up, gravity 20, lands after ~0.7 s; only from the ground (P2: standard numbers)', () => {
  const { snaps } = sim({ scenario: bare(), frames: [{ tick: 0, jump: true }, { tick: 5, jump: false }, { tick: 6, jump: true }], ticks: 60 });
  assert.equal(snaps[1].player.grounded, false);
  const peak = Math.max(...snaps.slice(1, 50).map((s) => s.player.pos[1]));
  assert.ok(peak > 1.1 && peak < 1.25, `peak ${peak}`); // v²/2g = 1.225
  assert.equal(snaps[40].player.grounded, false);
  assert.equal(snaps[41].player.grounded, true);
  assert.equal(snaps[60].player.pos[1], 0);
});

// ---------- pickup ----------

test('a mote within pickup_radius (1.0 m XZ) is picked at once; one just outside is not', () => {
  const a = sim({ scenario: bare({ motes: [[0, 0, T.pickup_radius]] }), ticks: 1 });
  assert.deepEqual(a.named('mote_picked'), [{ tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(a.snaps[1].score, 0, 'P2: points come from depositing, not picking');
  const b = sim({ scenario: bare({ motes: [[0, 0, T.pickup_radius + 0.05]] }), ticks: 30 });
  assert.equal(b.named('mote_picked').length, 0);
});

test('pickup also needs the height difference ≤ 1.5 m (P2)', () => {
  assert.equal(sim({ scenario: bare({ motes: [[0, 2, 0.5]] }), ticks: 5 }).named('mote_picked').length, 0);
  assert.equal(sim({ scenario: bare({ motes: [[0, 1.4, 0.5]] }), ticks: 5 }).named('mote_picked').length, 1);
});

test('walking into a mote picks it on the first tick within pickup_radius', () => {
  const { named } = sim({ scenario: bare({ motes: [[0, 0, 5]] }), frames: [{ tick: 0, move: [0, 1] }], ticks: 60 });
  assert.equal(named('mote_picked')[0].tick, Math.ceil(((5 - T.pickup_radius) / T.player_speed) * 60 - 1e-9));
});

test('carry_capacity (10) is a hard limit', () => {
  const { named, snaps } = sim({ scenario: bare({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] }), ticks: 10 });
  assert.equal(named('mote_picked').length, 0);
  assert.equal(snaps[10].player.carried, 10);
});

// ---------- deposit & lanterns ----------

test('interact within 2.0 m deposits min(carried, missing); at 10 the lantern lights (+5/mote, +100)', () => {
  const sc = bare({ player: { pos: [0, 0, 25 - T.interact_radius], carried: 10 } });
  const { events, snaps } = sim({ scenario: sc, frames: tap(0, 'interact'), ticks: 10 });
  assert.deepEqual(events, [
    { tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 10, deposited: 10 } },
    { tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1', relight: false } }, // P3: relight flag
  ]);
  assert.equal(snaps[10].score, 10 * T.score.per_mote + T.score.per_lantern); // P3: per_mote is 5 now
});

test('lanterns remember partial progress; extra light stays with the player', () => {
  const partial = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 3 } }), frames: tap(0, 'interact'), ticks: 5 });
  assert.equal(partial.snaps[5].lanterns[0].deposited, 3);
  assert.equal(partial.snaps[5].score, 3 * T.score.per_mote); // P3: +5 per mote
  const extra = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', deposited: 4 }] }), frames: tap(0, 'interact'), ticks: 5 });
  assert.equal(extra.named('deposit')[0].data.amount, 6);
  assert.equal(extra.snaps[5].player.carried, 4);
});

test('interact outside interact_radius does nothing', () => {
  const sc = bare({ player: { pos: [0, 0, 25 - T.interact_radius - 0.1], carried: 5 } });
  assert.deepEqual(sim({ scenario: sc, frames: tap(0, 'interact'), ticks: 10 }).events, []);
});

test('buttons trigger on false→true only; equal distance → smaller id', () => {
  const sc = bare({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', deposited: 3 }, { id: 'L2', pos: [1, 0, 24] }] });
  const held = sim({ scenario: sc, frames: [{ tick: 0, interact: true }], ticks: 30 });
  assert.equal(held.named('deposit').length, 1);
  // P3: a lit lantern below full fuel can be refuelled, so the second tap picks L1 again
  // (tie at 1 m with L2, smaller id wins) and tops up the fuel it burnt since tick 1.
  const tapTwice = sim({ scenario: sc, frames: [...tap(0, 'interact'), ...tap(6, 'interact')], ticks: 30 });
  assert.deepEqual(tapTwice.named('deposit').map((e) => [e.tick, e.data.lantern_id, e.data.amount]), [[1, 'L1', 7]]);
  assert.deepEqual(tapTwice.named('refuel').map((e) => [e.tick, e.data]), [[7, { lantern_id: 'L1', amount: 1, fuel: 100 }]]);
});

// P3: the two Phase 2 tests "lighting the last lantern wins" and "all lanterns lit on the
// tick time runs out still wins" were DELETED: Ticket-03 removed the early win (all_lit).
// The dawn rule that replaces them is covered in tests/fuel.test.js.

// ---------- shades, hits, losing ----------

test('shades within 12 m chase at shade_speed 4.0 (P2: standard speed and detection)', () => {
  const { snaps } = sim({ scenario: bare({ shades: [{ pos: [10, 1, 0] }] }), ticks: 60 });
  assert.equal(snaps[0].shades[0].state, 'chase');
  close(snaps[60].shades[0].pos[0], 10 - T.shade_speed);
});

test('shades beyond 12 m wander; a chase is given up beyond 18 m', () => {
  const far = sim({ scenario: bare({ shades: [{ pos: [13, 1, 0] }] }), ticks: 2 });
  assert.equal(far.snaps[0].shades[0].state, 'wander');
  const run = sim({ scenario: bare({ shades: [{ pos: [11, 1, 0] }] }), frames: [{ tick: 0, move: [-1, 0] }], ticks: 600 });
  const firstWander = run.snaps.findIndex((s, i) => i > 0 && s && s.shades[0].state === 'wander');
  const d = dist(run.snaps[firstWander].player.pos, run.snaps[firstWander].shades[0].pos);
  assert.ok(d > 18 && d < 18.2, `gave up at ${d}`);
});

test('a hit (XZ ≤ 1 m, |dy| ≤ 1.5) costs a flame, drops floor(carried/2) onto a 1.5–2.5 m ring', () => {
  const { named, snaps } = sim({ scenario: bare({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [2, 1, 0] }] }), ticks: 20 });
  const hit = named('player_hit');
  assert.equal(hit[0].tick, Math.ceil(((2 - T.shade_hit_radius) / T.shade_speed) * 60 - 1e-9));
  assert.deepEqual(hit[0].data, { by: 'shade', flames: 2, dropped: 2 });
  const s = snaps[hit[0].tick];
  assert.equal(s.player.carried, 3);
  const drops = s.motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 2);
  for (const m of drops) {
    const d = dist(m.pos, s.player.pos);
    assert.ok(d >= 1.499 && d <= 2.501, `ring ${d}`);
    assert.equal(m.ttl_s, 8);
  }
  assert.equal(s.shades[0].state, 'recoil');
  assert.equal(s.player.invuln, true);
});

test('recoil moves the shade 2 m away over 60 ticks; invulnerability lasts 90 ticks; no flames → lost', () => {
  const { named, snaps, events, world } = sim({ scenario: bare({ shades: [{ pos: [0.5, 1, 0] }] }), ticks: 2000 });
  const ticks = named('player_hit').map((e) => e.tick);
  assert.equal(ticks[0], 1);
  close(snaps[61].shades[0].pos[0] - snaps[1].shades[0].pos[0], 2, 1e-6);
  assert.equal(snaps[90].player.invuln, true);
  // the shade is back on Mây long before tick 91 but does nothing while she is invulnerable,
  // then hits on the first vulnerable tick: exactly 90 ticks after the previous hit
  assert.deepEqual(ticks, [1, 91, 181]);
  assert.deepEqual(events.at(-1), { tick: ticks[2], name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
  assert.equal(world.state, 'lost');
});

test('at most one flame is lost per tick', () => {
  const { named } = sim({ scenario: bare({ shades: [{ pos: [0.5, 1, 0] }, { pos: [-0.5, 1, 0] }] }), ticks: 1 });
  assert.equal(named('player_hit').length, 1);
});

test('dawn: when time runs out the night is lost', () => {
  const { events, snaps } = sim({ scenario: bare({ time_left_s: 1 }), ticks: 600 });
  assert.deepEqual(events, [{ tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }]);
  assert.equal(snaps[60].time_left_s, 0);
});

// ---------- pulse ----------

test('pulse: costs 3, 3D radius 5 from feet+0.8, stun 120 ticks, push 4 m over 15 ticks, +5 each (P2)', () => {
  const sc = bare({ player: { carried: 3 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [5.5, 1, 0] }] });
  const { named, snaps } = sim({ scenario: sc, frames: tap(0, 'pulse'), ticks: 130 });
  assert.deepEqual(named('pulse'), [{ tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }]);
  assert.equal(snaps[1].player.carried, 0);
  assert.equal(snaps[1].score, T.score.per_stun);
  close(snaps[1].shades[0].pos[0], 3 + 4 / 15);
  close(snaps[15].shades[0].pos[0], 3 + T.pulse_push_m);
  assert.deepEqual(snaps[120].shades[0].pos, snaps[15].shades[0].pos);
  assert.equal(snaps[120].shades[0].state, 'stunned');
  assert.notEqual(snaps[121].shades[0].state, 'stunned');
  assert.equal(snaps[1].shades[1].state, 'chase');
});

test('a second pulse refreshes stun and push; pulse respects the 3 s cooldown and needs 3 motes', () => {
  const C = Math.round(T.pulse_cooldown_s * 60);
  const { named } = sim({ scenario: bare({ player: { carried: 9 } }), frames: [...tap(0, 'pulse'), ...tap(C - 10, 'pulse'), ...tap(C + 5, 'pulse')], ticks: C + 20 });
  assert.deepEqual(named('pulse').map((e) => e.tick), [1, C + 6]);
  assert.equal(sim({ scenario: bare({ player: { carried: 2 } }), frames: tap(0, 'pulse'), ticks: 5 }).named('pulse').length, 0);
  const re = sim({ scenario: bare({ player: { carried: 6 }, shades: [{ id: 'S1', pos: [2, 1, 0] }] }), frames: [...tap(0, 'pulse'), ...tap(C + 5, 'pulse')], ticks: C + 10 });
  assert.deepEqual(re.named('pulse').map((e) => e.data.stunned_ids), [['S1'], ['S1']]);
  assert.equal(re.snaps[C + 6].score, 10);
});

// ---------- safe zone (P2: only lit lanterns, radius 6) ----------

test('shades are blocked at 6 m from a lit lantern; a player deep inside is never hit', () => {
  const sc = bare({ player: { pos: [0, 0, 24] }, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [0, 1, 12] }, { pos: [8, 1, 25] }] });
  const { snaps, named } = sim({ scenario: sc, ticks: 900 });
  for (const s of snaps.filter(Boolean).slice(1)) for (const sh of s.shades) assert.ok(dist(sh.pos, L1) >= T.safe_radius, `tick ${s.tick}`);
  assert.equal(named('player_hit').length, 0);
});

test('an unlit lantern has no safe zone (P2: replaces the Phase 1 assumption)', () => {
  const { named } = sim({ scenario: bare({ player: { pos: [0, 0, 24] }, shades: [{ pos: [0, 1, 20] }] }), ticks: 120 });
  assert.ok(named('player_hit').length >= 1);
});

// ---------- spawning ----------

test('motes: 20 at distinct spawn points, +1 every 240 ticks at an empty point, never above the points/cap', () => {
  const { snaps } = sim({ scenario: { random_shades: false }, ticks: 1300, seed: 3 });
  assert.equal(snaps[0].motes_active, 20);
  assert.equal(new Set(snaps[0].motes.map((m) => m.pos.join())).size, 20);
  assert.equal(snaps[239].motes_active, 20);
  assert.equal(snaps[240].motes_active, 21);
  assert.equal(snaps[960].motes_active, 24, 'Night 1 has 24 spawn points');
  assert.equal(snaps[1200].motes_active, 24, 'no empty point: the turn is skipped');
});

test('shades: 2 at tick 300, then 1 every 8 s on Night 1, max 6, ids in spawn order', () => {
  const { named, snaps } = sim({ scenario: { random_motes: false }, ticks: 2800, seed: 4 });
  assert.deepEqual(named('shade_spawned').map((e) => [e.tick, e.data.id]), [[300, 'S1'], [300, 'S2'], [780, 'S3'], [1260, 'S4'], [1740, 'S5'], [2220, 'S6']]);
  assert.equal(snaps[300].shades[0].state, 'spawning');
  assert.equal(snaps[361].shades[0].state, 'wander');
  for (const sh of snaps[300].shades) assert.ok(Math.abs(Math.hypot(sh.pos[0], sh.pos[2]) - 37) < 1e-3);
});

test('snapshot coordinates are rounded to 3 decimals', () => {
  const { snaps } = sim({ ticks: 77, seed: 3, frames: [{ tick: 0, move: [0.3, 0.7], cam_yaw_deg: 17 }] });
  const s = snaps[70];
  for (const n of [...s.player.pos, ...s.player.vel, ...s.motes.flatMap((x) => x.pos), s.time_left_s]) assert.equal(Math.round(n * 1000) / 1000, n);
});

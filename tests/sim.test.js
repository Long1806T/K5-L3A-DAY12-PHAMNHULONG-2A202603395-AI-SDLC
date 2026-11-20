// Core rules (AC4, AC5, AC7–AC13). Each test builds its situation with a
// contract scenario and checks the outcome against the declared tuning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { T, bare, sim, dist } from './helpers.js';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const L1 = [0, 0, 25];

// ---------- movement & input (AC5) ----------

test('move [0,1] at yaw 0 walks +Z at player_speed', () => {
  const { snaps } = sim({ scenario: bare(), frames: [{ tick: 0, move: [0, 1] }], ticks: 60 });
  close(snaps[60].player.pos[2], T.player_speed * 1.0);
  close(snaps[60].player.pos[0], 0);
});

test('cam_yaw_deg rotates move with x\' = x cos + z sin, z\' = -x sin + z cos', () => {
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

test('frames only change the fields they contain; input of tick k is used by step k', () => {
  const frames = [{ tick: 0, move: [0, 1] }, { tick: 30, cam_yaw_deg: 90 }];
  const { snaps } = sim({ scenario: bare(), frames, ticks: 60 });
  const v = T.player_speed / 60;
  close(snaps[30].player.pos[2], 30 * v); // steps 0..29 at yaw 0
  close(snaps[60].player.pos[0], 30 * v); // steps 30..59 at yaw 90, move kept
  close(snaps[60].player.pos[2], 30 * v);
});

test('no inputs means the player stands still', () => {
  const { snaps } = sim({ scenario: bare(), ticks: 120 });
  assert.deepEqual(snaps[120].player.pos, [0, 0, 0]);
});

test('jump goes up and lands, without changing XZ', () => {
  const { snaps } = sim({ scenario: bare(), frames: [{ tick: 0, jump: true }], ticks: 60 });
  assert.ok(snaps[20].player.pos[1] > 0.5, 'in the air');
  assert.equal(snaps[60].player.pos[1], 0, 'landed');
  assert.deepEqual([snaps[60].player.pos[0], snaps[60].player.pos[2]], [0, 0]);
});

test('fall_enabled=false: the island edge stops the player', () => {
  assert.equal(T.fall_enabled, false);
  const { snaps, named } = sim({ scenario: bare(), frames: [{ tick: 0, move: [0, 1] }], ticks: 900 });
  close(Math.hypot(snaps[900].player.pos[0], snaps[900].player.pos[2]), 45);
  assert.equal(named('player_hit').length, 0);
});

// ---------- pickup (AC7) ----------

test('a mote exactly at pickup_radius is picked at once; one just outside is not', () => {
  const r = T.pickup_radius;
  const a = sim({ scenario: bare({ motes: [[0, 0, r]] }), ticks: 1 });
  assert.deepEqual(a.named('mote_picked'), [{ tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(a.snaps[1].score, T.score.per_mote);
  const b = sim({ scenario: bare({ motes: [[0, 0, r + 0.05]] }), ticks: 30 });
  assert.equal(b.named('mote_picked').length, 0);
  assert.equal(b.snaps[30].motes_active, 1);
});

test('walking into a mote picks it on the first tick within pickup_radius', () => {
  const { named, snaps } = sim({ scenario: bare({ motes: [[0, 0, 5]] }), frames: [{ tick: 0, move: [0, 1] }], ticks: 60 });
  const expectTick = Math.ceil(((5 - T.pickup_radius) / T.player_speed) * 60 - 1e-9);
  assert.equal(named('mote_picked')[0].tick, expectTick);
  assert.equal(snaps[60].player.carried, 1);
  assert.equal(snaps[60].motes_active, 0);
});

test('carry_capacity is a hard limit', () => {
  const { named, snaps } = sim({ scenario: bare({ player: { carried: T.carry_capacity }, motes: [[0, 0, 0.5]] }), ticks: 10 });
  assert.equal(named('mote_picked').length, 0);
  assert.equal(snaps[10].player.carried, T.carry_capacity);
});

// ---------- deposit & lanterns (AC8, AC9) ----------

test('interact near an unlit lantern deposits and lights it at lantern_cost', () => {
  const sc = bare({ player: { pos: [0, 0, 25 - T.interact_radius], carried: T.lantern_cost } });
  const { events, snaps } = sim({ scenario: sc, frames: [{ tick: 0, interact: true }], ticks: 10 });
  assert.deepEqual(events, [
    { tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: T.lantern_cost, deposited: T.lantern_cost } },
    { tick: 1, name: 'lantern_lit', data: { lantern_id: 'L1' } },
  ]);
  assert.equal(snaps[10].lanterns[0].lit, true);
  assert.equal(snaps[10].player.carried, 0);
  assert.equal(snaps[10].score, T.score.per_lantern);
});

test('partial deposit keeps the lantern unlit; extra light stays with the player', () => {
  const partial = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 3 } }), frames: [{ tick: 0, interact: true }], ticks: 5 });
  assert.equal(partial.named('deposit')[0].data.amount, 3);
  assert.equal(partial.named('lantern_lit').length, 0);
  assert.equal(partial.snaps[5].lanterns[0].deposited, 3);

  const extra = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 7 } }), frames: [{ tick: 0, interact: true }], ticks: 5 });
  assert.equal(extra.named('deposit')[0].data.amount, T.lantern_cost);
  assert.equal(extra.snaps[5].player.carried, 7 - T.lantern_cost);
});

test('interact outside interact_radius does nothing', () => {
  const sc = bare({ player: { pos: [0, 0, 25 - T.interact_radius - 0.1], carried: 5 } });
  const { events } = sim({ scenario: sc, frames: [{ tick: 0, interact: true }], ticks: 10 });
  assert.deepEqual(events, []);
});

test('buttons trigger on false→true only (holding interact deposits once)', () => {
  const sc = bare({
    player: { pos: [0, 0, 24], carried: 8 },
    lanterns: [{ id: 'L1', deposited: 3 }, { id: 'L2', pos: [1, 0, 24] }],
  });
  const held = sim({ scenario: sc, frames: [{ tick: 0, interact: true }], ticks: 30 });
  assert.equal(held.named('deposit').length, 1);
  const tapTwice = sim({ scenario: sc, frames: [{ tick: 0, interact: true }, { tick: 5, interact: false }, { tick: 6, interact: true }], ticks: 30 });
  assert.deepEqual(tapTwice.named('deposit').map((e) => [e.tick, e.data.lantern_id, e.data.amount]), [[1, 'L1', 2], [7, 'L2', 5]]);
});

test('lighting the last lantern wins with time and flame bonus, and the run stops', () => {
  const sc = bare({
    player: { pos: [0, 0, 24], carried: 5 },
    lanterns: ['L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })),
  });
  const { world, events, snaps } = sim({ scenario: sc, frames: [{ tick: 0, interact: true }], ticks: 600 });
  assert.equal(snaps[0].score, 0, 'pre-lit lanterns from the scenario are not scored');
  assert.deepEqual(events.at(-1), { tick: 1, name: 'game_over', data: { result: 'won', reason: 'all_lit' } });
  assert.equal(world.state, 'won');
  assert.equal(world.tick, 1);
  const secondsLeft = Math.floor(T.night1_duration_s - 1 / 60);
  assert.equal(world.score, T.score.per_lantern + secondsLeft * T.score.per_second_left + T.flames * T.score.per_flame_left);
});

// ---------- shades, hits, losing (AC10, AC11) ----------

test('shades chase at shade_speed', () => {
  const { snaps } = sim({ scenario: bare({ shades: [{ pos: [10, 1, 0] }] }), ticks: 60 });
  assert.equal(snaps[60].shades[0].state, 'chase');
  close(snaps[60].shades[0].pos[0], 10 - T.shade_speed);
});

test('a shade within shade_hit_radius costs a flame and drops floor(carried*ratio) motes', () => {
  const start = 2;
  const sc = bare({ player: { carried: 5 }, shades: [{ id: 'S1', pos: [start, 1, 0] }] });
  const { named, snaps } = sim({ scenario: sc, ticks: 40 });
  const hitTick = Math.ceil(((start - T.shade_hit_radius) / T.shade_speed) * 60 - 1e-9);
  const hit = named('player_hit');
  assert.equal(hit.length, 1);
  assert.equal(hit[0].tick, hitTick);
  const dropped = Math.floor(5 * T.hit_drop_ratio);
  assert.deepEqual(hit[0].data, { by: 'shade', flames: T.flames - 1, dropped });
  assert.equal(snaps[40].player.carried, 5 - dropped);
});

test('invuln_s blocks repeat hits; losing every flame ends the night (no_flames)', () => {
  const sc = bare({ shades: [{ pos: [0.5, 1, 0] }] });
  const { named, world, events } = sim({ scenario: sc, ticks: 2000 });
  const D = Math.round(T.invuln_s * 60);
  const ticks = named('player_hit').map((e) => e.tick);
  assert.deepEqual(ticks, [1, 1 + D, 1 + 2 * D]);
  assert.deepEqual(named('player_hit').map((e) => e.data.flames), [2, 1, 0]);
  assert.deepEqual(events.at(-1), { tick: 1 + 2 * D, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
  assert.equal(world.state, 'lost');
});

test('dawn: when time runs out the night is lost', () => {
  const { world, events, snaps } = sim({ scenario: bare({ time_left_s: 1 }), ticks: 600 });
  assert.deepEqual(events, [{ tick: 60, name: 'game_over', data: { result: 'lost', reason: 'dawn' } }]);
  assert.equal(world.tick, 60);
  assert.equal(snaps[60].time_left_s, 0);
  assert.equal(snaps[30].time_left_s, 0.5);
});

// ---------- pulse (AC12) ----------

test('pulse costs pulse_cost, stuns shades in pulse_radius and pushes them pulse_push_m', () => {
  const sc = bare({ player: { carried: 2 }, shades: [{ id: 'S1', pos: [3, 1, 0] }, { id: 'S2', pos: [T.pulse_radius + 1, 1, 0] }] });
  const { named, snaps } = sim({ scenario: sc, frames: [{ tick: 0, pulse: true }], ticks: 1 });
  assert.deepEqual(named('pulse'), [{ tick: 1, name: 'pulse', data: { stunned_ids: ['S1'] } }]);
  assert.equal(snaps[1].player.carried, 2 - T.pulse_cost);
  assert.equal(snaps[1].score, T.score.per_stun);
  assert.equal(snaps[1].shades[0].state, 'stunned');
  close(snaps[1].shades[0].pos[0], 3 + T.pulse_push_m);
  assert.equal(snaps[1].shades[1].state, 'chase');
});

test('stun lasts pulse_stun_s, then the shade chases again', () => {
  const sc = bare({ player: { carried: 1 }, shades: [{ id: 'S1', pos: [3, 1, 0] }] });
  const D = Math.round(T.pulse_stun_s * 60);
  const { snaps } = sim({ scenario: sc, frames: [{ tick: 0, pulse: true }], ticks: D + 5 });
  assert.equal(snaps[D].shades[0].state, 'stunned');
  assert.deepEqual(snaps[D].shades[0].pos, snaps[2].shades[0].pos, 'stunned shades do not move');
  assert.equal(snaps[D + 1].shades[0].state, 'chase');
});

test('pulse respects pulse_cooldown_s and needs enough carried light', () => {
  const C = Math.round(T.pulse_cooldown_s * 60);
  const tap = (k) => [{ tick: k, pulse: true }, { tick: k + 1, pulse: false }];
  const frames = [...tap(0), ...tap(C - 10), ...tap(C + 5)];
  const { named } = sim({ scenario: bare({ player: { carried: 5 } }), frames, ticks: C + 20 });
  assert.deepEqual(named('pulse').map((e) => e.tick), [1, C + 6]);
  const broke = sim({ scenario: bare({ player: { carried: 0 } }), frames: tap(0), ticks: 5 });
  assert.equal(broke.named('pulse').length, 0);
});

// ---------- safe zone (AC13) ----------

test('shades never enter safe_radius of a lantern; a player inside is never hit', () => {
  const sc = bare({ player: { pos: [0, 0, 24] }, shades: [{ pos: [0, 1, 12] }, { pos: [6, 1, 25] }] });
  const { snaps, named } = sim({ scenario: sc, ticks: 900 });
  for (const s of snaps.filter(Boolean)) {
    for (const sh of s.shades) {
      if (s.tick === 0) continue;
      assert.ok(dist(sh.pos, L1) >= T.safe_radius, `tick ${s.tick} ${sh.id} at ${dist(sh.pos, L1)}`);
    }
  }
  assert.equal(named('player_hit').length, 0);
});

test('a shade placed inside a safe zone is pushed out on the first step', () => {
  const { snaps } = sim({ scenario: bare({ shades: [{ pos: [0, 1, 23] }], player: { pos: [0, 0, 10] } }), ticks: 1 });
  assert.ok(dist(snaps[1].shades[0].pos, L1) >= T.safe_radius);
});

// ---------- scenario & spawning ----------

test('random_motes/shades false: only listed entities exist, ids are kept', () => {
  // Player waits in L1's safe zone so the shades cannot end the night early.
  const sc = bare({
    player: { pos: [0, 0, 24] },
    motes: [[5, 0, 5], { id: 'MX', pos: [9, 0, 9] }],
    shades: [{ id: 'A', pos: [30, 1, 0] }, { pos: [-30, 1, 0] }],
  });
  const { snaps, named } = sim({ scenario: sc, ticks: 3000 });
  assert.deepEqual(snaps[0].motes.map((m) => m.id), ['M1', 'MX']);
  assert.deepEqual(snaps[0].shades.map((s) => s.id), ['A', 'S1']);
  assert.equal(snaps[3000].motes_active, 2);
  assert.equal(named('shade_spawned').length, 0);
});

test('default night: 5 lanterns, motes and shades spawn, ids are unique', () => {
  // The player waits beside L1 (safe zone) so the night lasts long enough to see spawns.
  const { snaps, named } = sim({ scenario: { player: { pos: [0, 0, 24] } }, ticks: 3200, seed: 7 });
  assert.equal(snaps[0].lanterns.length, 5);
  assert.ok(snaps[0].motes_active > 0 && snaps[0].shades.length > 0);
  const spawned = named('shade_spawned').map((e) => e.data.id);
  assert.ok(spawned.length >= 1);
  assert.deepEqual(spawned, ['S4', 'S5']);
  const ids = snaps[3200].shades.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(snaps[3200].state, 'playing');
});

test('snapshot coordinates are rounded to 3 decimals', () => {
  const { snaps } = sim({ ticks: 77, seed: 3, frames: [{ tick: 0, move: [0.3, 0.7], cam_yaw_deg: 17 }] });
  const s = snaps[70];
  const nums = [...s.player.pos, ...s.shades.flatMap((x) => x.pos), ...s.motes.flatMap((x) => x.pos), s.time_left_s];
  for (const n of nums) assert.equal(Math.round(n * 1000) / 1000, n);
});

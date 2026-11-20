// Phase 3 (Ticket-03 "Đèn cạn dầu", Contract v1.2). IDs refer to docs/notes/phase-3.md.
// Fuel is counted in 1/60 units: 1/s decay = 1 unit per tick, drain 5/s = 5 units per tick.
import test from 'node:test';
import assert from 'node:assert/strict';
import { T, bare, sim, cli, tmp, dist } from './helpers.js';

const SC = 'scenarios/phase3';
const L1 = [0, 0, 25];
const tap = (k, key) => [{ tick: k, [key]: true }, { tick: k + 1, [key]: false }];
function run(scenario, inputs, ticks) {
  const args = ['--seed', 1, '--night', 1, '--scenario', `${SC}/${scenario}.scenario.json`];
  if (inputs) args.push('--inputs', `${SC}/${inputs}.inputs.json`);
  const r = cli([...args, '--ticks', ticks, '--snapshot-every', 1, '--out', tmp(`${scenario}.jsonl`)]);
  assert.equal(r.code, 0, r.stderr);
  const snaps = [];
  for (const l of r.lines) if (l.type === 'snapshot') snaps[l.tick] = l;
  const events = r.lines.filter((l) => l.type === 'event' && l.name !== 'night_start');
  return { snaps, events, end: r.lines.at(-1), named: (n) => events.filter((e) => e.name === n) };
}

test('P3-2/P3-3 fuel burns 1/s in exact 1/60 steps; at 0 the lantern goes out right after step 2', () => {
  const { named, snaps } = run('fuel-out', null, 100);
  assert.equal(snaps[0].lanterns[0].fuel, 1.5);
  assert.equal(snaps[30].lanterns[0].fuel, 1);
  assert.equal(snaps[89].lanterns[0].lit, true);
  assert.deepEqual(named('lantern_out').map((e) => [e.tick, e.data]), [[90, { lantern_id: 'L1' }]]);
  assert.deepEqual(snaps[90].lanterns[0], { id: 'L1', pos: L1, lit: false, deposited: 0, fuel: 0, ever_lit: true, relit_count: 0 });
});

test('P3-4 refuel: used = min(carried, ceil((100 − fuel)/10)) after this tick\'s burn; +5 per mote', () => {
  const { named, snaps } = run('refuel', 'interact-now', 5);
  // fuel 50 → 49.983 after the step-2 burn of tick 1 → 6 motes needed, 7 carried
  assert.deepEqual(named('refuel'), [{ type: 'event', tick: 1, name: 'refuel', data: { lantern_id: 'L1', amount: 6, fuel: 100 } }]);
  assert.equal(snaps[1].player.carried, 1);
  assert.equal(snaps[1].score, 6 * T.score.per_mote);
});

test('P3-4 a full lantern cannot be chosen: no event, no score (checked with burn turned off)', () => {
  const tuning = { ...T, fuel_decay_per_s: 0 };
  const sc = bare({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true }, { id: 'L2', pos: [0, 0, 22.5] }] });
  const a = sim({ scenario: sc, frames: tap(0, 'interact'), ticks: 3, tuning });
  assert.deepEqual(a.events.map((e) => [e.name, e.data.lantern_id]), [['deposit', 'L2'], ['lantern_lit', 'L2']], 'full L1 skipped, farther L2 chosen');
  const b = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 10 }, lanterns: [{ id: 'L1', lit: true }] }), frames: tap(0, 'interact'), ticks: 3, tuning });
  assert.deepEqual(b.events, []);
  assert.equal(b.world.score, 0);
});

test('P3-5 relight: an ever-lit lantern needs 5 (never-lit still 10); +40, relight: true, relit_count', () => {
  const { named, snaps } = run('relight', 'interact-now', 3);
  assert.deepEqual(named('deposit')[0].data, { lantern_id: 'L1', amount: 5, deposited: 5 });
  assert.deepEqual(named('lantern_lit')[0].data, { lantern_id: 'L1', relight: true });
  assert.deepEqual(snaps[1].lanterns[0], { id: 'L1', pos: L1, lit: true, deposited: 5, fuel: 100, ever_lit: true, relit_count: 1 });
  assert.equal(snaps[1].score, 5 * T.score.per_mote + T.score.per_relight);
  const fresh = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 5 } }), frames: tap(0, 'interact'), ticks: 2 });
  assert.equal(fresh.named('lantern_lit').length, 0, 'never-lit lantern still needs 10');
});

test('P3-7 a wandering shade drains a weak lantern within 2 m: 5/s + 1/s burn, fuel_drain every 60 ticks', () => {
  const { named, snaps } = run('drain', null, 300);
  assert.equal(snaps[1].shades[0].state, 'drain');
  assert.deepEqual(named('fuel_drain').slice(0, 2).map((e) => [e.tick, e.data]), [
    [61, { lantern_id: 'L1', shade_id: 'S1', fuel: 19 }], // 1500 − 61 − 5×60 = 1139 units = 18.98
    [121, { lantern_id: 'L1', shade_id: 'S1', fuel: 13 }],
  ]);
  const out = named('lantern_out')[0];
  assert.equal(out.tick, 251); // 1500 − t − 5(t − 1) ≤ 0
  assert.equal(snaps[251].shades[0].state, 'wander', 'lantern out → back to wander');
});

test('P3-7 several draining shades add up', () => {
  const sc = bare({ lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [0, 1, 23.5] }, { id: 'S2', pos: [1, 1, 24] }] });
  const { snaps } = sim({ scenario: sc, ticks: 61 });
  assert.deepEqual(snaps[1].shades.map((s) => s.state), ['drain', 'drain']);
  assert.equal(snaps[61].lanterns[0].fuel, Math.round(((1500 - 61 - 2 * 5 * 60) / 60) * 10) / 10);
});

test('P3-8 refuelling a drained lantern to ≥ 30 sends its shades to wander and expels them harmlessly', () => {
  const { named, snaps } = run('drain-refuel', 'interact-now', 120);
  assert.deepEqual(named('refuel')[0].data, { lantern_id: 'L1', amount: 8, fuel: 100 });
  assert.equal(snaps[1].shades[0].state, 'wander');
  assert.equal(named('player_hit').length, 0);
  assert.ok(dist(snaps[30].shades[0].pos, L1) >= T.safe_radius);
});

test('P3-8 drain → chase when Mây comes within 6 m; pulse on a draining shade scores 15', () => {
  const sc = bare({ player: { pos: [0, 0, 18], carried: 3 }, lanterns: [{ id: 'L1', lit: true, fuel: 25 }], shades: [{ id: 'S1', pos: [0, 1, 23.5], state: 'drain', target_lantern_id: 'L1' }] });
  const chase = sim({ scenario: sc, frames: [{ tick: 0, move: [0, 1] }], ticks: 10 });
  assert.equal(chase.snaps[1].shades[0].state, 'chase', 'Mây at 5.5 m');
  const pulsed = sim({ scenario: bare({ ...sc, player: { pos: [0, 0, 20], carried: 3 } }), frames: tap(0, 'pulse'), ticks: 2 });
  assert.equal(pulsed.snaps[1].shades[0].state, 'stunned');
  assert.equal(pulsed.snaps[1].score, T.score.per_stun_drain);
});

test('P3-6 a lantern below 30 fuel loses its safe zone; exactly 30 still has it', () => {
  // fuel 30 + 1 unit → exactly 1800 units (30.0) after tick 1, 1799 after tick 2
  const sc = bare({ player: { pos: [0, 0, 24] }, lanterns: [{ id: 'L1', lit: true, fuel: 30 + 1 / 60 }], shades: [{ id: 'S1', pos: [0, 1, 18.95] }] });
  const { snaps } = sim({ scenario: sc, ticks: 3 });
  assert.ok(dist(snaps[1].shades[0].pos, L1) >= 6, `fuel 30: blocked (${dist(snaps[1].shades[0].pos, L1)})`);
  assert.ok(dist(snaps[2].shades[0].pos, L1) < 6, `fuel 29.98: enters (${dist(snaps[2].shades[0].pos, L1)})`);
});

test('P3-9 dawn: ≥ ceil(0.6 × lanterns) lit → won (dawn_survived) with the dawn bonus; fewer → lost (dawn)', () => {
  const win = run('dawn-win', null, 100);
  assert.deepEqual(win.named('game_over'), [{ type: 'event', tick: 60, name: 'game_over', data: { result: 'won', reason: 'dawn_survived' } }]);
  // each lit lantern: 50 + floor(fuel) with fuel 99.0 at tick 60; each flame: 50; no time bonus
  assert.equal(win.end.score, 3 * (50 + 99) + 3 * 50);
  const lose = run('dawn-lose', null, 100);
  assert.deepEqual(lose.end, { type: 'end', ticks: 60, state: 'lost', score: 0 });
  assert.equal(lose.named('game_over')[0].data.reason, 'dawn');
});

test('P3-9 no early win, and losing the last flame on the dawn tick is still no_flames', () => {
  const all = sim({ scenario: bare({ lanterns: ['L1', 'L2', 'L3', 'L4', 'L5'].map((id) => ({ id, lit: true })) }), ticks: 120 });
  assert.equal(all.world.state, 'playing');
  const sc = bare({ player: { flames: 1 }, time_left_s: 1 / 60, lanterns: ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true })), shades: [{ pos: [0.5, 1, 0] }] });
  const last = sim({ scenario: sc, ticks: 5 });
  assert.deepEqual(last.world.result, { result: 'lost', reason: 'no_flames', tick: 1 });
  assert.equal(sim({ scenario: bare(), night: 3, ticks: 0 }).snaps[0].lanterns.length, 7);
  assert.equal(Math.ceil(T.win_ratio * 6 - 1e-9), 4, 'Night 2 needs 4/6');
  assert.equal(Math.ceil(T.win_ratio * 7 - 1e-9), 5, 'Night 3 needs 5/7');
});

test('P3-10 capacity = 10 + 2 × successful lights (relights count, preset lanterns do not), max 20', () => {
  const motes = Array.from({ length: 22 }, (_, i) => [0.04 * i - 0.44, 0, 0.3]); // all within 1 m
  assert.equal(sim({ scenario: bare({ player: { successful_lights: 2 }, motes }), ticks: 1 }).snaps[1].player.carried, 14);
  assert.equal(sim({ scenario: bare({ player: { successful_lights: 9 }, motes }), ticks: 1 }).snaps[1].player.carried, 20);
  assert.equal(sim({ scenario: bare({ lanterns: [{ id: 'L1', lit: true }] }), ticks: 0 }).snaps[0].player.capacity, 10);
  const lightIt = sim({ scenario: bare({ player: { pos: [0, 0, 24], carried: 10 } }), frames: tap(0, 'interact'), ticks: 2 });
  assert.equal(lightIt.snaps[1].player.capacity, 12);
});

test('P3-12 scenario v1.2 fields are validated (bad fuel → exit 2)', () => {
  const r = cli(['--seed', 1, '--night', 1, '--scenario', `${SC}/bad/negative-fuel.scenario.json`, '--ticks', 5, '--out', tmp('bad.jsonl')]);
  assert.equal(r.code, 2);
});

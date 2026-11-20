// Phase 2 features, one contract scenario each (scenarios/phase2), run through
// the real headless_cmd exactly as a grader would. IDs refer to docs/notes/phase-2.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cli, tmp, T, dist } from './helpers.js';

const SC = 'scenarios/phase2';
function run(night, scenario, inputs, ticks, every = 1) {
  const args = ['--seed', 1, '--night', night, '--scenario', `${SC}/${scenario}.scenario.json`];
  if (inputs) args.push('--inputs', `${SC}/${inputs}.inputs.json`);
  const r = cli([...args, '--ticks', ticks, '--snapshot-every', every, '--out', tmp(`${scenario}-${night}.jsonl`)]);
  assert.equal(r.code, 0, r.stderr);
  const snaps = [];
  for (const l of r.lines) if (l.type === 'snapshot') snaps[l.tick] = l;
  const events = r.lines.filter((l) => l.type === 'event' && l.name !== 'night_start');
  return { snaps, events, end: r.lines.at(-1), named: (n) => events.filter((e) => e.name === n) };
}
const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

test('P2-2 dash: 12 ticks at 14 m/s along the move direction, 90-tick cooldown from the start', () => {
  const { named, snaps } = run(1, 'dash', 'dash', 120);
  assert.deepEqual(named('dash').map((e) => [e.tick, e.data]), [[11, {}], [101, {}]]);
  assert.deepEqual(snaps[11].player.vel, [0, 0, T.dash_speed]);
  close(snaps[60].player.pos[2], 1.0 + 2.8 + 3.8);
  assert.equal(snaps[20].player.dash_cd_s, 1.35);
});

test('P2-3 fall: once, ignores invulnerability, loses all motes, respawns at the start after 60 ticks', () => {
  const { named, snaps } = run(1, 'fall', 'fall', 260);
  const falls = named('player_hit');
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].data, { by: 'fall', flames: T.flames - 1, dropped: 0, lost: 4 });
  const F = falls[0].tick;
  assert.ok(snaps[F].player.pos[1] < -10);
  assert.ok(snaps[F + 59].player.pos[1] < -10, 'still waiting');
  assert.deepEqual(snaps[F + 60].player.pos, [0, 0, 0]);
  assert.equal(snaps[F + 60].player.invuln, true);
  assert.equal(snaps[F + 60].player.carried, 0);
});

test('P2-5 launch pad, Night 2: from (20,0,18) across the sea to island B', () => {
  const { snaps, named } = run(2, 'pad-night2', 'pad-night2', 160);
  assert.equal(snaps[5].player.grounded, false);
  assert.ok(snaps[5].player.vel[1] > 13);
  assert.equal(named('player_hit').length, 0, 'no fall');
  const s = snaps[160];
  assert.equal(s.player.grounded, true);
  assert.ok(Math.hypot(s.player.pos[0] - 70, s.player.pos[2]) <= 28, `landed at ${s.player.pos}`);
  const landing = snaps.findIndex((x, i) => i > 5 && x && x.player.grounded);
  assert.ok(landing >= 85 && landing <= 92, `flight ${landing - 5} ticks (~1.4 s)`);
});

test('P2-5 launch pad, Night 3: from (0,3,13) onto tier 2 (Y = 6)', () => {
  const { snaps } = run(3, 'pad-night3', 'pad-night3', 120);
  assert.equal(snaps[10].player.grounded, false);
  const p = snaps[120].player;
  assert.equal(p.pos[1], 6);
  assert.equal(p.grounded, true);
  const r = Math.hypot(p.pos[0], p.pos[2]);
  assert.ok(r < 8 && r > 2, `r=${r}`);
});

test('P2-7 drifter steals min(3, carried) on contact, flees 240 ticks, then disappears', () => {
  const { named, snaps } = run(2, 'drifter-steal', null, 330);
  assert.equal(snaps[1].drifters[0].state, 'chase');
  assert.deepEqual(named('drifter_steal'), [{ type: 'event', tick: 76, name: 'drifter_steal', data: { drifter_id: 'D1', amount: 3, carried: 3 } }]);
  assert.deepEqual(snaps[76].drifters, [{ id: 'D1', pos: snaps[76].drifters[0].pos, state: 'flee', stolen: 3 }]);
  assert.equal(snaps[315].drifters.length, 1);
  assert.equal(snaps[316].drifters.length, 0);
  assert.equal(snaps[316].player.flames, T.flames, 'drifters never cost flames');
});

test('P2-7 pulse on a chasing drifter: it flees without stealing', () => {
  const { named, snaps } = run(2, 'drifter-pulse-chase', 'pulse-now', 400);
  assert.deepEqual(named('pulse')[0].data, { stunned_ids: [] });
  assert.equal(snaps[1].drifters[0].state, 'flee');
  assert.equal(snaps[1].drifters[0].stolen, 0);
  assert.equal(named('drifter_steal').length, 0);
});

test('P2-7 pulse on a fleeing drifter with loot: drops it as dropped motes, vanishes after 120 ticks', () => {
  const { named, snaps } = run(2, 'drifter-pulse-loot', 'pulse-now', 200);
  assert.deepEqual(named('drifter_drop').map((e) => [e.tick, e.data]), [[1, { drifter_id: 'D1', amount: 3 }]]);
  const drops = snaps[1].motes.filter((m) => m.kind === 'dropped');
  assert.equal(drops.length, 3);
  for (const m of drops) assert.ok(dist(m.pos, [3, 0, 0]) <= 0.61);
  assert.equal(snaps[120].drifters.length, 1);
  assert.equal(snaps[121].drifters.length, 0);
});

test('P2-8 wind charm: 600 ticks, 7.2 m/s, dash without cooldown, back after 2700 ticks', () => {
  const { named, snaps } = run(2, 'charm', 'charm', 2720, 10);
  assert.deepEqual(named('charm_picked').map((e) => [e.tick, e.data]), [[10, { charm_id: 'C1', charm_ticks: 600 }]]);
  assert.deepEqual(named('dash').map((e) => e.tick), [21, 41]);
  assert.equal(snaps[20].player.vel[0], 7.2);
  assert.equal(snaps[20].player.charm_s, 9.833);
  assert.deepEqual(snaps[20].charms, [{ id: 'C1', available: false, respawn_s: 44.833 }]);
  assert.equal(snaps[2700].charms[0].available, false);
  assert.equal(snaps[2710].charms[0].available, true);
  assert.equal(named('player_hit').length, 0, 'stayed on the bridge');
});

test('P2-9 wind (Night 3): every 1800 sim ticks, 300 ticks at 2 m/s; wind_enabled:false turns it off', () => {
  const { snaps } = run(3, 'wind', null, 2110, 1);
  assert.equal(snaps[1799].wind.active, false);
  const w = snaps[1800].wind;
  assert.equal(w.active, true);
  assert.equal(snaps[2099].wind.active, true);
  assert.equal(snaps[2100].wind.active, false);
  const a = snaps[1799].player.pos;
  const b = snaps[1859].player.pos;
  const th = (w.dir_deg * Math.PI) / 180;
  close(b[0] - a[0], 2 * Math.cos(th), 0.01);
  close(b[2] - a[2], 2 * Math.sin(th), 0.01);
  const off = run(3, 'wind-off', null, 2110, 10);
  assert.deepEqual(off.snaps[2110].player.pos, [0, 0, -30]);
  assert.equal(off.snaps[1800].wind.active, false);
});

test('P2-10 pause: tick advances, sim_tick/time/position freeze, state "paused"', () => {
  const { named, snaps, end } = run(1, 'pause', 'pause', 120, 10);
  assert.deepEqual(named('paused').map((e) => e.tick), [31]);
  assert.deepEqual(named('resumed').map((e) => e.tick), [91]);
  assert.equal(snaps[40].state, 'paused');
  assert.equal(snaps[40].sim_tick, 30);
  assert.equal(snaps[90].sim_tick, 30);
  assert.equal(snaps[90].time_left_s, snaps[30].time_left_s);
  assert.deepEqual(snaps[90].player.pos, snaps[30].player.pos);
  assert.equal(snaps[100].state, 'playing');
  assert.equal(snaps[100].sim_tick, 40);
  close(snaps[100].player.pos[2], 4.0);
  assert.deepEqual(end, { type: 'end', ticks: 120, state: 'playing', score: 0 });
});

test('P2-12 a lantern that just lit expels shades inside 6 m within 30 ticks, harmlessly', () => {
  const { named, snaps } = run(1, 'safe-zone-expel', 'interact-now', 300);
  assert.equal(named('lantern_lit').length, 1);
  assert.equal(named('player_hit').length, 0);
  const d = (t) => dist(snaps[t].shades[0].pos, [0, 0, 25]);
  assert.ok(d(15) > 1.6 && d(15) < 6, `mid-way ${d(15)}`);
  assert.ok(d(30) >= T.safe_radius, `edge ${d(30)}`);
  for (let t = 31; t <= 300; t++) assert.ok(d(t) >= T.safe_radius, `tick ${t}`);
});

test('P2-11 dropped motes live 480 ticks and can be picked up again', () => {
  const { named, snaps } = run(1, 'hit-drop', null, 500, 1);
  const first = named('player_hit')[0];
  assert.equal(first.tick, 15);
  const ids = snaps[15].motes.filter((m) => m.kind === 'dropped').map((m) => m.id);
  assert.equal(ids.length, 2);
  const has = (t) => ids.every((id) => snaps[t].motes.some((m) => m.id === id));
  assert.ok(has(494));
  assert.ok(!snaps[495].motes.some((m) => ids.includes(m.id)));
});

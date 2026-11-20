// AC2, AC3, AC4, AC6: the contract's headless_cmd, run exactly like a grader would.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cli, tmp, T } from './helpers.js';

const SC = 'scenarios/phase1';

test('runs N ticks, snapshot every 10 from tick 0, end line last, exit 0', () => {
  const out = tmp('basic.jsonl');
  const { code, lines } = cli(['--seed', 42, '--night', 1, '--ticks', 95, '--out', out]);
  assert.equal(code, 0);
  const snaps = lines.filter((l) => l.type === 'snapshot');
  assert.deepEqual(snaps.map((s) => s.tick), [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 95, state: 'playing', score: snaps.at(-1).score });
  assert.equal(lines.filter((l) => l.type === 'end').length, 1);
  for (const s of snaps) {
    assert.equal(s.sim_tick, s.tick);
    assert.equal(s.time_left_s, Math.round((T.night1_duration_s - s.tick / 60) * 1000) / 1000);
    for (const k of ['state', 'score', 'player', 'lanterns', 'shades', 'motes_active']) assert.ok(k in s, k);
    assert.deepEqual(Object.keys(s.player), ['pos', 'flames', 'carried']);
    for (const sh of s.shades) assert.deepEqual(Object.keys(sh), ['id', 'pos', 'state']);
    for (const l of s.lanterns) assert.deepEqual(Object.keys(l), ['id', 'pos', 'lit', 'deposited']);
  }
});

test('--snapshot-every changes the period; --ticks 0 gives tick-0 snapshot + end', () => {
  const out = tmp('every.jsonl');
  let r = cli(['--seed', 1, '--night', 1, '--ticks', 30, '--snapshot-every', 7, '--out', out]);
  assert.deepEqual(r.lines.filter((l) => l.type === 'snapshot').map((s) => s.tick), [0, 7, 14, 21, 28]);
  r = cli(['--seed', 1, '--night', 1, '--ticks', 0, '--out', out]);
  assert.deepEqual(r.lines.map((l) => l.type), ['snapshot', 'end']);
  assert.equal(r.lines[1].ticks, 0);
});

test('the contract example scenario + inputs run and produce the expected story', () => {
  const out = tmp('example.jsonl');
  const { code, lines } = cli(['--seed', 1, '--night', 1, '--scenario', `${SC}/contract-example.scenario.json`,
    '--inputs', `${SC}/contract-example.inputs.json`, '--ticks', 300, '--out', out]);
  assert.equal(code, 0);
  const events = lines.filter((l) => l.type === 'event');
  // events are written before the snapshot of the same tick, ticks never go backwards
  let lastTick = -1;
  for (const l of lines.slice(0, -1)) {
    assert.ok(l.tick >= lastTick);
    lastTick = l.tick;
  }
  assert.deepEqual(events[0], { type: 'event', tick: 38, name: 'mote_picked', data: { carried: 1 } });
  assert.equal(lines[0].motes_active, 1);
  assert.deepEqual(lines[0].shades, [{ id: 'S1', pos: [10, 0, 0], state: 'chase' }]);
});

test('game over stops the run early (dawn)', () => {
  const out = tmp('dawn.jsonl');
  const { lines } = cli(['--seed', 1, '--night', 1, '--scenario', `${SC}/dawn.scenario.json`, '--ticks', 1000, '--out', out]);
  assert.deepEqual(lines.at(-2), { type: 'snapshot', ...lines.at(-2), tick: 120, state: 'lost' });
  assert.deepEqual(lines.at(-1), { type: 'end', ticks: 120, state: 'lost', score: 0 });
  assert.ok(lines.some((l) => l.name === 'game_over' && l.tick === 120 && l.data.reason === 'dawn'));
});

test('winning via walk + interact ends with state won', () => {
  const out = tmp('win.jsonl');
  const { lines } = cli(['--seed', 1, '--night', 1, '--scenario', `${SC}/win-last-lantern.scenario.json`,
    '--inputs', `${SC}/walk-and-interact.inputs.json`, '--ticks', 600, '--out', out]);
  const names = lines.filter((l) => l.type === 'event').map((l) => `${l.tick}:${l.name}`);
  assert.deepEqual(names, ['21:deposit', '21:lantern_lit', '21:game_over']);
  assert.equal(lines.at(-1).state, 'won');
  assert.equal(lines.at(-1).ticks, 21);
});

for (const [file, flag] of [
  ['bad/truncated.inputs.json', '--inputs'],
  ['bad/ticks-not-increasing.inputs.json', '--inputs'],
  ['bad/move-out-of-range.inputs.json', '--inputs'],
  ['bad/unknown-lantern.scenario.json', '--scenario'],
  ['bad/bad-player.scenario.json', '--scenario'],
  ['does-not-exist.json', '--inputs'],
]) {
  test(`malformed ${flag} file (${file}) → exit 2 with a message on stderr`, () => {
    const r = cli(['--seed', 1, '--night', 1, flag, `${SC}/${file}`, '--ticks', 10, '--out', tmp('bad.jsonl')]);
    assert.equal(r.code, 2);
    assert.match(r.stderr, /error:/);
  });
}

test('other errors exit non-zero with a message (missing --out, unknown night, bad number)', () => {
  for (const args of [
    ['--seed', 1, '--night', 1, '--ticks', 10],
    ['--seed', 1, '--night', 9, '--ticks', 10, '--out', tmp('x.jsonl')],
    ['--seed', 'abc', '--night', 1, '--ticks', 10, '--out', tmp('x.jsonl')],
    ['--seed', 1, '--night', 1, '--ticks', -5, '--out', tmp('x.jsonl')],
  ]) {
    const r = cli(args);
    assert.notEqual(r.code, 0, args.join(' '));
    assert.match(r.stderr, /error:/);
  }
});

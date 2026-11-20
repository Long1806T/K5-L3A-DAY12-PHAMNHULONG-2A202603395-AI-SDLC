// AC14: same seed + scenario + inputs → byte-identical output (including generated ids).
// Also: a full night played by the autopilot replays identically through the CLI.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { cli, tmp, T } from './helpers.js';
import { playNight } from '../tools/bot.js';

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

test('two runs with the same seed and inputs are byte-identical (all 3 nights)', () => {
  const inputs = tmp('wander.inputs.json', {
    frames: [
      { tick: 0, move: [0.3, 1], cam_yaw_deg: 12 },
      { tick: 200, move: [-1, 0.2], pulse: true },
      { tick: 201, pulse: false, jump: true },
      { tick: 240, jump: false, cam_yaw_deg: -70 },
    ],
  });
  for (const night of [1, 2, 3]) {
    const a = tmp(`det-a${night}.jsonl`);
    const b = tmp(`det-b${night}.jsonl`);
    for (const out of [a, b]) {
      assert.equal(cli(['--seed', 12345, '--night', night, '--inputs', inputs, '--ticks', 3600, '--out', out]).code, 0);
    }
    assert.equal(sha(a), sha(b), `night ${night}`);
  }
});

test('a different seed gives a different island (motes and shades)', () => {
  const a = tmp('seed1.jsonl');
  const b = tmp('seed2.jsonl');
  cli(['--seed', 1, '--night', 1, '--ticks', 0, '--out', a]);
  cli(['--seed', 2, '--night', 1, '--ticks', 0, '--out', b]);
  const pa = JSON.parse(fs.readFileSync(a, 'utf8').split('\n')[0]);
  const pb = JSON.parse(fs.readFileSync(b, 'utf8').split('\n')[0]);
  assert.notDeepEqual(pa.motes, pb.motes);
  assert.deepEqual(pa.lanterns, pb.lanterns, 'lanterns are part of the level, not random');
});

test('autopilot wins a full night and the CLI replays it to the same end line', () => {
  const { frames, world } = playNight({ tuning: T, seed: 1 });
  assert.equal(world.state, 'won');
  const inputs = tmp('bot.inputs.json', { frames });
  const out = tmp('bot.jsonl');
  const r = cli(['--seed', 1, '--night', 1, '--inputs', inputs, '--ticks', 18000, '--out', out]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.lines.at(-1), { type: 'end', ticks: world.tick, state: 'won', score: world.score });
  const lit = r.lines.filter((l) => l.name === 'lantern_lit').map((l) => l.data.lantern_id).sort();
  assert.deepEqual(lit, ['L1', 'L2', 'L3', 'L4', 'L5']);
});

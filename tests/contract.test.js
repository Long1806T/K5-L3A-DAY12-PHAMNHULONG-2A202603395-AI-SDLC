// AC1: game.contract.json exists, is complete, and is the tuning the game uses.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONTRACT, ROOT, T } from './helpers.js';
import { getNight } from '../src/core/level.js';
import { loadTuning } from '../src/headless.js';

const NUMERIC = [
  'player_speed', 'carry_capacity', 'lantern_cost', 'lantern_count_night1', 'pickup_radius', 'interact_radius',
  'pulse_cost', 'pulse_radius', 'night1_duration_s', 'flames', 'invuln_s', 'hit_drop_ratio', 'pulse_stun_s',
  'pulse_push_m', 'pulse_cooldown_s', 'safe_radius', 'shade_speed', 'shade_hit_radius',
];

test('contract has the required top-level fields', () => {
  assert.equal(CONTRACT.contract_version, '1.0');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) {
    assert.equal(typeof CONTRACT[k], 'string', k);
    assert.ok(CONTRACT[k].length > 0, k);
  }
  assert.ok(fs.existsSync(path.join(ROOT, CONTRACT.headless_cmd.split(/\s+/)[1])), 'headless entry file exists');
});

test('every tuning key is declared with a usable value', () => {
  for (const k of NUMERIC) assert.ok(Number.isFinite(T[k]) && T[k] >= 0, `${k} = ${T[k]}`);
  assert.equal(typeof T.fall_enabled, 'boolean');
  for (const k of ['per_mote', 'per_lantern', 'per_stun', 'per_second_left', 'per_flame_left']) {
    assert.ok(Number.isFinite(T.score[k]), `score.${k}`);
  }
  assert.ok(Number.isInteger(T.carry_capacity) && Number.isInteger(T.lantern_cost) && Number.isInteger(T.flames));
});

test('night 1 has exactly lantern_count_night1 lanterns', () => {
  assert.equal(T.lantern_count_night1, 5);
  assert.equal(getNight(1).lanterns.length, T.lantern_count_night1);
});

test('the headless runner reads its tuning from game.contract.json (single source of truth)', () => {
  assert.deepEqual(loadTuning(), T);
});

test('design invariants we rely on', () => {
  assert.ok(T.safe_radius > T.interact_radius, 'depositing happens inside the safe zone');
  assert.ok(T.player_speed > T.shade_speed, 'the player can outrun shades');
  assert.ok(T.carry_capacity >= T.lantern_cost, 'one trip can light one lantern');
});

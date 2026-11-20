// P2-1 (was AC1): game.contract.json v1.1 carries the standard numbers of Ticket-02.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONTRACT, ROOT, T } from './helpers.js';
import { getNight } from '../src/core/level.js';
import { loadTuning } from '../src/headless.js';

const STANDARD = {
  player_speed: 6.0, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1.0,
  interact_radius: 2.0, pulse_cost: 3, pulse_radius: 5.0, night1_duration_s: 300, night2_duration_s: 330,
  night3_duration_s: 360, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2.0, pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0, safe_radius: 6.0, shade_speed: 4.0, shade_hit_radius: 1.0, fall_enabled: true,
  dash_speed: 14.0, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
};

test('contract v1.1 has the required top-level fields', () => {
  assert.equal(CONTRACT.contract_version, '1.1');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd']) assert.ok(typeof CONTRACT[k] === 'string' && CONTRACT[k].length > 0, k);
  assert.ok(fs.existsSync(path.join(ROOT, CONTRACT.headless_cmd.split(/\s+/)[1])), 'headless entry file exists');
});

test('tuning equals the Ticket-02 standard numbers', () => {
  for (const [k, v] of Object.entries(STANDARD)) assert.equal(T[k], v, k);
  assert.deepEqual(T.score, { per_mote: 10, per_lantern: 100, per_stun: 5, per_second_left: 2, per_flame_left: 50 });
  assert.equal(T.shade_speed_night3, 4.5, 'Night 3 shade speed (extra key)');
});

test('night 1 has exactly lantern_count_night1 lanterns', () => {
  assert.equal(getNight(1).lanterns.length, T.lantern_count_night1);
});

test('the headless runner reads its tuning from game.contract.json (single source of truth)', () => {
  assert.deepEqual(loadTuning(), T);
});

test('src/core stays deterministic: no Math.random / Date / performance (AGENTS.md rule 1)', () => {
  const dir = path.join(ROOT, 'src/core');
  for (const f of fs.readdirSync(dir)) {
    const code = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, /Math\.random|Date\.now|new Date|performance\./, f);
  }
});

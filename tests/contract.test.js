// P4-1, P3-1, P2-1 (was AC1): game.contract.json v1.3 = Ticket-02 standard numbers + Ticket-03 fuel/win keys + Ticket-04 bench/soak commands.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { CONTRACT, ROOT, T } from './helpers.js';
import { getNight } from '../src/core/level.js';
import { loadTuning } from '../src/headless.js';

const STANDARD = {
  player_speed: 6.0, carry_capacity: 10, lantern_cost: 10, lantern_count_night1: 5, pickup_radius: 1.0,
  interact_radius: 2.0, pulse_cost: 3, pulse_radius: 5.0, flames: 3, invuln_s: 1.5, hit_drop_ratio: 0.5, pulse_stun_s: 2.0, pulse_push_m: 4.0,
  pulse_cooldown_s: 3.0, safe_radius: 6.0, shade_speed: 4.0, shade_hit_radius: 1.0, fall_enabled: true,
  dash_speed: 14.0, dash_duration_s: 0.2, dash_cooldown_s: 1.5,
  // P3: Ticket-03 replaces the night lengths and adds the fuel/win keys
  night1_duration_s: 240, night2_duration_s: 270, night3_duration_s: 300,
  fuel_max: 100, fuel_decay_per_s: 1.0, fuel_per_mote: 10, relight_cost: 5, win_ratio: 0.6, drain_per_s: 5,
  low_fuel_threshold: 30, capacity_max: 20,
};

// P4: Ticket-04 bumps the contract to v1.3 and adds bench_cmd + soak_cmd (all v1.0–v1.2 fields stay)
test('contract v1.3 has the required top-level fields', () => {
  assert.equal(CONTRACT.contract_version, '1.3');
  for (const k of ['team', 'build_cmd', 'run_cmd', 'headless_cmd', 'bench_cmd', 'soak_cmd']) assert.ok(typeof CONTRACT[k] === 'string' && CONTRACT[k].length > 0, k);
  for (const k of ['headless_cmd', 'bench_cmd', 'soak_cmd']) assert.ok(fs.existsSync(path.join(ROOT, CONTRACT[k].split(/\s+/)[1])), `${k} entry file exists`);
});

test('tuning equals the standard numbers (Ticket-02 + Ticket-03)', () => {
  for (const [k, v] of Object.entries(STANDARD)) assert.equal(T[k], v, k);
  // P3: Ticket-03 replaces the whole score formula (time bonus removed → per_second_left 0)
  assert.deepEqual(T.score, { per_mote: 5, per_lantern: 100, per_relight: 40, per_stun: 5, per_stun_drain: 15, per_lit_at_dawn: 50, per_second_left: 0, per_flame_left: 50 });
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

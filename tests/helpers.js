import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorld, step, snapshot } from '../src/core/sim.js';
import { createInputTimeline } from '../src/core/inputs.js';
import { getNight } from '../src/core/level.js';
import { validateInputs, validateScenario } from '../src/core/validate.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
export const T = CONTRACT.tuning;

/** Scenario with nothing random: only what the test lists exists. */
export function bare(extra = {}) {
  return { random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false, motes: [], shades: [], ...extra };
}

/**
 * Runs the core directly (same code path as the CLI, minus file IO).
 * Returns { world, events, snaps } where snaps[tick] is the snapshot after that tick.
 */
export function sim({ scenario = null, frames = [], ticks = 60, seed = 1, night = 1, tuning = T } = {}) {
  const lanternIds = getNight(night).lanterns.map((l) => l.id);
  const sc = scenario ? validateScenario(structuredClone(scenario), lanternIds) : null;
  const inputAt = createInputTimeline(validateInputs({ frames }));
  const world = createWorld({ tuning, night, seed, scenario: sc });
  const events = [];
  const snaps = [snapshot(world)];
  for (let k = 0; k < ticks && world.state === 'playing'; k++) {
    events.push(...step(world, inputAt(k)));
    snaps[world.tick] = snapshot(world);
  }
  return { world, events, snaps, named: (n) => events.filter((e) => e.name === n) };
}

let tmpDir;
export function tmp(name, content) {
  tmpDir ??= fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-test-'));
  const file = path.join(tmpDir, name);
  if (content !== undefined) fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
  return file;
}

/** Runs the contract's headless_cmd exactly as a grader would (args appended). */
export function cli(args) {
  const [cmd, ...base] = CONTRACT.headless_cmd.split(/\s+/);
  const res = spawnSync(cmd, [...base, ...args.map(String)], { cwd: ROOT, encoding: 'utf8' });
  const outIdx = args.indexOf('--out');
  let lines = [];
  if (res.status === 0 && outIdx !== -1) {
    lines = fs.readFileSync(path.resolve(ROOT, args[outIdx + 1]), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  }
  return { code: res.status, stderr: res.stderr, lines };
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

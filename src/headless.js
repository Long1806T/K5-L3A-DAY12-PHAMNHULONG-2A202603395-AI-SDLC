#!/usr/bin/env node
// Headless runner (Test Contract v1.0).
//   node src/headless.js --seed <int> --night 1 [--scenario f.json] [--inputs f.json]
//                        --ticks <int> --out <file.jsonl> [--snapshot-every <int>]
// Exit codes: 0 ok · 2 malformed scenario/inputs file · 1 any other error.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorld, step, snapshot } from './core/sim.js';
import { createInputTimeline } from './core/inputs.js';
import { getNight } from './core/level.js';
import { ContractInputError, parseJsonText, validateInputs, validateScenario } from './core/validate.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

class UsageError extends Error {}

const USAGE =
  'usage: node src/headless.js --seed <int> --night <int> [--scenario <file.json>] [--inputs <file.json>] ' +
  '--ticks <int> --out <file.jsonl> [--snapshot-every <int>]';

function parseIntArg(name, value, min) {
  if (value === undefined || !/^[+-]?\d+$/.test(String(value).trim())) throw new UsageError(`${name} expects an integer, got "${value}"`);
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min) throw new UsageError(`${name} must be an integer >= ${min}`);
  return n;
}

function parseSeed(value) {
  const text = String(value).trim();
  if (!/^[+-]?\d+$/.test(text)) throw new UsageError(`--seed expects an integer, got "${value}"`);
  return BigInt(text).toString(); // canonical text: "+007" and "7" are the same seed
}

export function parseArgs(argv) {
  const raw = {};
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let v;
    if (!a.startsWith('--')) throw new UsageError(`unexpected argument "${a}"`);
    const eq = a.indexOf('=');
    if (eq !== -1) {
      v = a.slice(eq + 1);
      a = a.slice(0, eq);
    } else {
      if (i + 1 >= argv.length) throw new UsageError(`missing value for ${a}`);
      v = argv[++i];
    }
    raw[a] = v;
  }
  const known = ['--seed', '--night', '--scenario', '--inputs', '--ticks', '--out', '--snapshot-every'];
  for (const k of Object.keys(raw)) if (!known.includes(k)) throw new UsageError(`unknown option ${k}`);
  if (raw['--ticks'] === undefined) throw new UsageError('--ticks is required');
  if (raw['--out'] === undefined) throw new UsageError('--out is required');
  return {
    // Seed is only ever used as text for hashing, so any integer size works.
    seed: raw['--seed'] === undefined ? '0' : parseSeed(raw['--seed']),
    night: raw['--night'] === undefined ? 1 : parseIntArg('--night', raw['--night'], 1),
    scenario: raw['--scenario'],
    inputs: raw['--inputs'],
    ticks: parseIntArg('--ticks', raw['--ticks'], 0),
    out: raw['--out'],
    snapshotEvery: raw['--snapshot-every'] === undefined ? 10 : parseIntArg('--snapshot-every', raw['--snapshot-every'], 1),
  };
}

function readJsonFile(file, label) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    throw new ContractInputError(`${label}: cannot read "${file}" (${e.code || e.message})`);
  }
  return parseJsonText(text, label);
}

export function loadTuning() {
  const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
  return contract.tuning;
}

/** Runs a headless game and returns the JSONL lines (without writing). */
export function runHeadless(opts, tuning = loadTuning()) {
  const level = getNight(opts.night);
  const scenario = opts.scenario ? validateScenario(readJsonFile(opts.scenario, 'scenario'), level.lanterns.map((l) => l.id)) : null;
  const frames = opts.inputs ? validateInputs(readJsonFile(opts.inputs, 'inputs')) : [];
  const inputAt = createInputTimeline(frames);
  const world = createWorld({ tuning, night: opts.night, seed: opts.seed, scenario });

  const lines = [JSON.stringify(snapshot(world))];
  for (let k = 0; k < opts.ticks && world.state === 'playing'; k++) {
    const events = step(world, inputAt(k));
    for (const e of events) lines.push(JSON.stringify({ type: 'event', tick: e.tick, name: e.name, data: e.data }));
    if (world.tick % opts.snapshotEvery === 0) lines.push(JSON.stringify(snapshot(world)));
  }
  lines.push(JSON.stringify({ type: 'end', ticks: world.tick, state: world.state, score: world.score }));
  return lines;
}

function main(argv) {
  try {
    const opts = parseArgs(argv);
    const lines = runHeadless(opts);
    const outDir = path.dirname(path.resolve(opts.out));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(opts.out, lines.join('\n') + '\n');
    return 0;
  } catch (e) {
    if (e instanceof ContractInputError) {
      process.stderr.write(`error: ${e.message}\n`);
      return 2;
    }
    if (e instanceof UsageError) {
      process.stderr.write(`error: ${e.message}\n${USAGE}\n`);
      return 1;
    }
    process.stderr.write(`error: ${e && e.message ? e.message : e}\n`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}

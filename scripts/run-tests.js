#!/usr/bin/env node
// Cross-platform `npm test`: cmd.exe does not expand tests/*.test.js and Node 18/20
// do not expand globs themselves, so the test files are listed here.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join('tests', f));
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { cwd: ROOT, stdio: 'inherit' });
process.exit(r.status ?? 1);

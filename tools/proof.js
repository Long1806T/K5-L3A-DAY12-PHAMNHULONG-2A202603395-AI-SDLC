#!/usr/bin/env node
// Regenerates the machine-made evidence for a phase. Nothing here is edited by hand.
//   node tools/proof.js [--phase 1]
// Writes docs/proof/phase-N/{proof.md, test-report.txt, runs/*}
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { playNight } from './bot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const phaseArg = process.argv.indexOf('--phase');
const PHASE = phaseArg !== -1 ? process.argv[phaseArg + 1] : '1';
const OUT = path.join(ROOT, 'docs/proof', `phase-${PHASE}`);
const RUNS = path.join(OUT, 'runs');
fs.mkdirSync(RUNS, { recursive: true });
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8'));
const [cmd, ...base] = contract.headless_cmd.split(/\s+/);
const rel = (f) => path.relative(ROOT, f);
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const readJsonl = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));

function headless(args) {
  const t0 = process.hrtime.bigint();
  const r = spawnSync(cmd, [...base, ...args.map(String)], { cwd: ROOT, encoding: 'utf8' });
  return { code: r.status, stderr: r.stderr.trim(), ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

const md = [];
const line = (s = '') => md.push(s);
line(`# Phase ${PHASE} · bằng chứng tự sinh`);
line();
line(`> File này do \`node tools/proof.js --phase ${PHASE}\` tạo ra, không sửa tay. Chạy lại lệnh đó ở tag \`phase-${PHASE}\` để tái lập.`);
line();
line(`- Thời điểm: ${new Date().toISOString()}`);
line(`- Máy: ${os.type()} ${os.release()} · ${os.cpus()[0]?.model ?? 'cpu?'} × ${os.cpus().length} · Node ${process.version}`);
const git = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout.trim();
line(`- Commit khi chạy: \`${git || 'n/a'}\` (bằng chứng được commit ngay sau commit này)`);
line();

// 1. Unit + CLI test suite
const testFiles = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => `tests/${f}`);
const t = spawnSync(process.execPath, ['--test', '--test-reporter=spec', ...testFiles], { cwd: ROOT, encoding: 'utf8' });
const testOut = (t.stdout + t.stderr).replace(/\x1b\[[0-9;]*m/g, '');
fs.writeFileSync(path.join(OUT, 'test-report.txt'), testOut);
const pick = (k) => (testOut.match(new RegExp(`ℹ ${k} (\\d+)`)) || [])[1];
line('## 1. Bộ test (`npm test`)');
line();
line(`Kết quả: **${pick('pass')}/${pick('tests')} đạt**, ${pick('fail')} lỗi. Báo cáo đầy đủ: [test-report.txt](test-report.txt).`);
line();

// 2. Contract scenarios through the real headless_cmd
const SC = 'scenarios/phase1';
const scenarios = [
  ['contract-example', `${SC}/contract-example.scenario.json`, `${SC}/contract-example.inputs.json`, 300, 'Ví dụ scenario + inputs trong Test Contract'],
  ['win-last-lantern', `${SC}/win-last-lantern.scenario.json`, `${SC}/walk-and-interact.inputs.json`, 600, 'Đi tới L1, nạp → thắp đèn cuối → thắng'],
  ['pulse', `${SC}/pulse.scenario.json`, `${SC}/pulse.inputs.json`, 400, 'Tỏa sáng: choáng, đẩy lùi, hồi chiêu'],
  ['shade-hits', `${SC}/shade-hits.scenario.json`, null, 600, 'Bóng Mực chạm người chơi đứng yên → hết lửa'],
  ['dawn', `${SC}/dawn.scenario.json`, null, 600, 'Hết giờ → thua (dawn)'],
  ['safe-zone', `${SC}/safe-zone.scenario.json`, null, 900, 'Đứng cạnh L1: không bị chạm, Bóng Mực ở ngoài safe_radius'],
];
line('## 2. Scenario chạy qua đúng `headless_cmd`');
line();
line('| Scenario | Mục đích | Lệnh rút gọn | Sự kiện (tick:tên) | Dòng end | Mã thoát |');
line('|---|---|---|---|---|---|');
for (const [name, scen, inp, ticks, what] of scenarios) {
  const out = path.join(RUNS, `${name}.jsonl`);
  const args = ['--seed', 1, '--night', 1, '--scenario', scen, ...(inp ? ['--inputs', inp] : []), '--ticks', ticks, '--out', rel(out)];
  const r = headless(args);
  const lines = readJsonl(out);
  const ev = lines.filter((l) => l.type === 'event').map((l) => `${l.tick}:${l.name}`);
  const evText = ev.length > 8 ? `${ev.slice(0, 8).join(', ')} … (+${ev.length - 8})` : ev.join(', ');
  line(`| [${name}](runs/${name}.jsonl) | ${what} | \`--scenario ${path.basename(scen)}${inp ? ` --inputs ${path.basename(inp)}` : ''} --ticks ${ticks}\` | ${evText || '—'} | \`${JSON.stringify(lines.at(-1))}\` | ${r.code} |`);
}
line();
let maxShadeIntrusion = Infinity;
for (const l of readJsonl(path.join(RUNS, 'safe-zone.jsonl'))) {
  if (l.type !== 'snapshot' || l.tick === 0) continue;
  for (const s of l.shades) for (const L of l.lanterns) maxShadeIntrusion = Math.min(maxShadeIntrusion, Math.hypot(s.pos[0] - L.pos[0], s.pos[2] - L.pos[2]));
}
line(`Khoảng cách nhỏ nhất từ Bóng Mực tới đèn trong run safe-zone: **${maxShadeIntrusion.toFixed(3)} m** (safe_radius = ${contract.tuning.safe_radius}).`);
line();

// 3. Malformed files → exit code 2
line('## 3. File sai định dạng → mã thoát 2');
line();
line('| File | Mã thoát | stderr |');
line('|---|---|---|');
for (const f of fs.readdirSync(path.join(ROOT, SC, 'bad')).sort()) {
  const flag = f.includes('scenario') ? '--scenario' : '--inputs';
  const r = headless(['--seed', 1, '--night', 1, flag, `${SC}/bad/${f}`, '--ticks', 10, '--out', rel(path.join(os.tmpdir(), 'ddl-bad.jsonl'))]);
  line(`| \`${f}\` | ${r.code} | \`${r.stderr.split('\n')[0].replace(/\|/g, '\\|')}\` |`);
}
line();

// 4. Determinism
const detA = path.join(os.tmpdir(), 'ddl-det-a.jsonl');
const detB = path.join(os.tmpdir(), 'ddl-det-b.jsonl');
const detInputs = path.join(RUNS, 'determinism.inputs.json');
fs.writeFileSync(detInputs, JSON.stringify({ frames: [{ tick: 0, move: [0.4, 1], cam_yaw_deg: 25 }, { tick: 300, move: [-1, 0], pulse: true }, { tick: 301, pulse: false }] }, null, 1) + '\n');
for (const f of [detA, detB]) headless(['--seed', 99, '--night', 1, '--inputs', rel(detInputs), '--ticks', 3600, '--out', f]);
line('## 4. Tính tất định');
line();
line(`Chạy 2 lần \`--seed 99 --inputs runs/determinism.inputs.json --ticks 3600\`:`);
line();
line(`- lần 1 SHA-256: \`${sha(detA)}\``);
line(`- lần 2 SHA-256: \`${sha(detB)}\``);
line(`- Kết quả: **${sha(detA) === sha(detB) ? 'giống hệt' : 'KHÁC NHAU'}**`);
line();

// 5. Autopilot full nights
const tuning = contract.tuning;
line('## 5. Chơi trọn Đêm 1 bằng autopilot (`tools/bot.js`)');
line();
line('Bot chỉ điều khiển qua input như người chơi. Seed 2026 được lưu inputs để giảng viên chạy lại bằng CLI.');
line();
line('| Seed | Kết quả | Tick kết thúc | Điểm | Lửa còn | Đom đóm nhặt | Lần tỏa sáng | Bị chạm |');
line('|---|---|---|---|---|---|---|---|');
let wins = 0;
let replay = '';
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2026];
for (const seed of seeds) {
  const { frames, world } = playNight({ tuning, seed });
  if (world.state === 'won') wins++;
  const s = world.stats;
  line(`| ${seed} | ${world.state} (${world.result?.reason}) | ${world.tick} | ${world.score} | ${world.player.flames} | ${s.motesPicked} | ${s.pulses} | ${s.hits} |`);
  if (seed === 2026) {
    const inp = path.join(RUNS, 'bot-seed-2026.inputs.json');
    fs.writeFileSync(inp, JSON.stringify({ frames }) + '\n');
    const out = path.join(os.tmpdir(), 'ddl-bot.jsonl');
    headless(['--seed', 2026, '--night', 1, '--inputs', rel(inp), '--ticks', 18000, '--out', out]);
    const end = readJsonl(out).at(-1);
    replay = `Replay qua CLI: \`${contract.headless_cmd} --seed 2026 --night 1 --inputs docs/proof/phase-${PHASE}/runs/bot-seed-2026.inputs.json --ticks 18000 --out out.jsonl\` → \`${JSON.stringify(end)}\` (trong bộ nhớ: ticks ${world.tick}, score ${world.score}) → **${end.ticks === world.tick && end.score === world.score ? 'khớp' : 'KHÔNG KHỚP'}**`;
  }
}
line();
line(`Thắng ${wins}/${seeds.length} seed.`);
line();
line(replay);
line();

// 6. Performance
const perfOut = path.join(os.tmpdir(), 'ddl-perf.jsonl');
const perf = headless(['--seed', 5, '--night', 1, '--scenario', `${SC}/safe-zone.scenario.json`, '--ticks', 18000, '--out', perfOut]);
const perfFull = headless(['--seed', 5, '--night', 1, '--ticks', 18000, '--snapshot-every', 60, '--out', perfOut]);
line('## 6. Tốc độ headless');
line();
line(`- 18000 tick (cả đêm 5 phút) với scenario safe-zone, snapshot mỗi 10 tick: **${perf.ms.toFixed(0)} ms** (gồm khởi động Node).`);
line(`- Đêm mặc định, người chơi đứng yên tới khi thua: **${perfFull.ms.toFixed(0)} ms**, kết thúc \`${JSON.stringify(readJsonl(perfOut).at(-1))}\`.`);
line();

fs.writeFileSync(path.join(OUT, 'proof.md'), md.join('\n') + '\n');
console.log(`wrote ${rel(path.join(OUT, 'proof.md'))}`);
if (t.status !== 0) process.exitCode = 1;

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

// 2. Contract scenarios through the real headless_cmd (this phase + regression of earlier ones)
const S1 = 'scenarios/phase1';
const S2 = 'scenarios/phase2';
const SC = S1;
const PHASE_RUNS = {
  1: [
    ['contract-example', 1, `${S1}/contract-example.scenario.json`, `${S1}/contract-example.inputs.json`, 300, 'Ví dụ scenario + inputs trong Test Contract'],
    ['win-last-lantern', 1, `${S1}/win-last-lantern.scenario.json`, `${S1}/walk-and-interact.inputs.json`, 600, 'Đi tới L1, nạp → thắp đèn cuối → thắng'],
    ['pulse', 1, `${S1}/pulse.scenario.json`, `${S1}/pulse.inputs.json`, 400, 'Tỏa sáng: choáng, đẩy lùi, hồi chiêu'],
    ['shade-hits', 1, `${S1}/shade-hits.scenario.json`, null, 600, 'Bóng Mực chạm người chơi đứng yên → hết lửa'],
    ['dawn', 1, `${S1}/dawn.scenario.json`, null, 600, 'Hết giờ → thua (dawn)'],
    ['safe-zone', 1, `${S1}/safe-zone.scenario.json`, null, 900, 'Đứng cạnh L1 đã sáng: không bị chạm, Bóng Mực ở ngoài safe_radius'],
  ],
  2: [
    ['dash', 1, `${S2}/dash.scenario.json`, `${S2}/dash.inputs.json`, 120, 'Lướt 14 m/s × 12 tick, hồi 90 tick'],
    ['fall', 1, `${S2}/fall.scenario.json`, `${S2}/fall.inputs.json`, 260, 'Rơi khỏi đảo → mất lửa + đom đóm, hồi sinh sau 60 tick'],
    ['pad-night2', 2, `${S2}/pad-night2.scenario.json`, `${S2}/pad-night2.inputs.json`, 160, 'Bục nhảy Đêm 2 → đáp đảo B'],
    ['pad-night3', 3, `${S2}/pad-night3.scenario.json`, `${S2}/pad-night3.inputs.json`, 120, 'Bục nhảy Đêm 3 → đáp tầng 2'],
    ['drifter-steal', 2, `${S2}/drifter-steal.scenario.json`, null, 330, 'Gió Lạc cướp 3 đom đóm, bỏ chạy 240 tick, biến mất'],
    ['drifter-pulse-chase', 2, `${S2}/drifter-pulse-chase.scenario.json`, `${S2}/pulse-now.inputs.json`, 300, 'Tỏa Sáng trúng Gió Lạc đang đuổi → bỏ chạy không cướp'],
    ['drifter-pulse-loot', 2, `${S2}/drifter-pulse-loot.scenario.json`, `${S2}/pulse-now.inputs.json`, 200, 'Tỏa Sáng trúng Gió Lạc mang đồ → thả lại 3 đom đóm'],
    ['charm', 2, `${S2}/charm.scenario.json`, `${S2}/charm.inputs.json`, 2720, 'Bùa Gió: 7,2 m/s, lướt không hồi chiêu, xuất hiện lại sau 2700 tick'],
    ['wind', 3, `${S2}/wind.scenario.json`, null, 2110, 'Gió mạnh Đêm 3 tại sim tick 1800–2099'],
    ['pause', 1, `${S2}/pause.scenario.json`, `${S2}/pause.inputs.json`, 120, 'Tạm dừng: tick tăng, sim_tick đứng yên'],
    ['safe-zone-expel', 1, `${S2}/safe-zone-expel.scenario.json`, `${S2}/interact-now.inputs.json`, 300, 'Đèn vừa sáng đẩy Bóng Mực ra mép 6 m trong 30 tick'],
    ['hit-drop', 1, `${S2}/hit-drop.scenario.json`, null, 500, 'Bị chạm: đom đóm rơi ra vành, tồn tại 480 tick'],
  ],
};
const scenarios = [];
for (let ph = Number(PHASE); ph >= 1; ph--) for (const r of PHASE_RUNS[ph] || []) scenarios.push(r);
line('## 2. Scenario chạy qua đúng `headless_cmd`');
line();
line('| Scenario | Đêm | Mục đích | Lệnh rút gọn | Sự kiện (tick:tên) | Dòng end | Mã thoát |');
line('|---|---|---|---|---|---|---|');
for (const [name, night, scen, inp, ticks, what] of scenarios) {
  const out = path.join(RUNS, `${name}.jsonl`);
  const args = ['--seed', 1, '--night', night, '--scenario', scen, ...(inp ? ['--inputs', inp] : []), '--ticks', ticks, '--out', rel(out)];
  const r = headless(args);
  const lines = readJsonl(out);
  const ev = lines.filter((l) => l.type === 'event' && l.name !== 'night_start').map((l) => `${l.tick}:${l.name}`);
  const evText = ev.length > 8 ? `${ev.slice(0, 8).join(', ')} … (+${ev.length - 8})` : ev.join(', ');
  line(`| [${name}](runs/${name}.jsonl) | ${night} | ${what} | \`--scenario ${path.basename(scen)}${inp ? ` --inputs ${path.basename(inp)}` : ''} --ticks ${ticks}\` | ${evText || '—'} | \`${JSON.stringify(lines.at(-1))}\` | ${r.code} |`);
}
line();
let maxShadeIntrusion = Infinity;
for (const l of readJsonl(path.join(RUNS, 'safe-zone.jsonl'))) {
  if (l.type !== 'snapshot' || l.tick === 0) continue;
  for (const s of l.shades) for (const L of l.lanterns.filter((x) => x.lit)) maxShadeIntrusion = Math.min(maxShadeIntrusion, Math.hypot(s.pos[0] - L.pos[0], s.pos[2] - L.pos[2]));
}
line(`Khoảng cách nhỏ nhất từ Bóng Mực tới đèn đã sáng trong run safe-zone: **${maxShadeIntrusion.toFixed(3)} m** (safe_radius = ${contract.tuning.safe_radius}).`);
line();

// 3. Malformed files → exit code 2
line('## 3. File sai định dạng → mã thoát 2');
line();
line('| File | Mã thoát | stderr |');
line('|---|---|---|');
const badFiles = [S1, S2].flatMap((dir) => (fs.existsSync(path.join(ROOT, dir, 'bad')) ? fs.readdirSync(path.join(ROOT, dir, 'bad')).sort().map((f) => `${dir}/bad/${f}`) : []));
for (const file of badFiles) {
  const f = path.basename(file);
  const flag = f.includes('scenario') ? '--scenario' : '--inputs';
  const r = headless(['--seed', 1, '--night', 1, flag, file, '--ticks', 10, '--out', rel(path.join(os.tmpdir(), 'ddl-bad.jsonl'))]);
  line(`| \`${f}\` | ${r.code} | \`${r.stderr.split('\n')[0].replace(/\|/g, '\\|')}\` |`);
}
line();

// 4. Determinism
const detA = path.join(os.tmpdir(), 'ddl-det-a.jsonl');
const detB = path.join(os.tmpdir(), 'ddl-det-b.jsonl');
const detInputs = path.join(RUNS, 'determinism.inputs.json');
fs.writeFileSync(detInputs, JSON.stringify({ frames: [{ tick: 0, move: [0.4, 1], cam_yaw_deg: 25 }, { tick: 300, move: [-1, 0], pulse: true }, { tick: 301, pulse: false }] }, null, 1) + '\n');
line('## 4. Tính tất định');
line();
line('Chạy 2 lần `--seed 99 --inputs runs/determinism.inputs.json --ticks 3600` cho từng Đêm:');
line();
line('| Đêm | SHA-256 lần 1 | SHA-256 lần 2 | Kết quả |');
line('|---|---|---|---|');
for (const night of Number(PHASE) >= 2 ? [1, 2, 3] : [1]) {
  for (const f of [detA, detB]) headless(['--seed', 99, '--night', night, '--inputs', rel(detInputs), '--ticks', 3600, '--out', f]);
  line(`| ${night} | \`${sha(detA).slice(0, 16)}…\` | \`${sha(detB).slice(0, 16)}…\` | **${sha(detA) === sha(detB) ? 'giống hệt' : 'KHÁC NHAU'}** |`);
}
line();

// 5. Autopilot full nights
const tuning = contract.tuning;
line(`## 5. Chơi trọn Đêm bằng autopilot (\`tools/bot.js\`, Đêm ${Number(PHASE) >= 2 ? '1–2' : '1'})`);
line();
line('Bot chỉ điều khiển qua input như người chơi. Lượt thắng đầu tiên của Đêm 1 được lưu inputs để giảng viên chạy lại bằng CLI.');
line();
line('| Đêm/Seed | Kết quả | Tick kết thúc | Điểm | Lửa còn | Đom đóm nhặt | Lần tỏa sáng | Bị chạm |');
line('|---|---|---|---|---|---|---|---|');
let wins = 0;
let replay = '';
const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const botNights = Number(PHASE) >= 2 ? [1, 2] : [1];
let botRuns = 0;
for (const night of botNights) for (const seed of seeds) {
  botRuns++;
  const { frames, world } = playNight({ tuning, seed, night });
  if (world.state === 'won') wins++;
  const s = world.stats;
  line(`| ${night}/${seed} | ${world.state} (${world.result?.reason}) | ${world.tick} | ${world.score} | ${world.player.flames} | ${s.motesPicked} | ${s.pulses} | ${s.hits} |`);
  if (night === 1 && world.state === 'won' && !replay) {
    const inp = path.join(RUNS, `bot-night1-seed${seed}.inputs.json`);
    fs.writeFileSync(inp, JSON.stringify({ frames }) + '\n');
    const out = path.join(os.tmpdir(), 'ddl-bot.jsonl');
    headless(['--seed', seed, '--night', 1, '--inputs', rel(inp), '--ticks', 21600, '--out', out]);
    const end = readJsonl(out).at(-1);
    replay = `Replay qua CLI: \`${contract.headless_cmd} --seed ${seed} --night 1 --inputs docs/proof/phase-${PHASE}/runs/${path.basename(inp)} --ticks 21600 --out out.jsonl\` → \`${JSON.stringify(end)}\` (trong bộ nhớ: ticks ${world.tick}, score ${world.score}) → **${end.ticks === world.tick && end.score === world.score ? 'khớp' : 'KHÔNG KHỚP'}**`;
  }
}
line();
line(`Thắng ${wins}/${botRuns} lượt. Bot điều hướng đơn giản (không leo tầng Đêm 3), nên tỉ lệ thắng của bot không phải độ khó thật của game.`);
line();
line(replay);
line();

// 6. Performance
const perfOut = path.join(os.tmpdir(), 'ddl-perf.jsonl');
line('## 6. Tốc độ headless (yêu cầu: một Đêm đầy đủ ≤ 30 s)');
line();
line('| Đêm | Lệnh | Thời gian (gồm khởi động Node) | Dòng end |');
line('|---|---|---|---|');
for (const night of Number(PHASE) >= 2 ? [1, 2, 3] : [1]) {
  const ticks = contract.tuning[`night${night}_duration_s`] * 60;
  const perf = headless(['--seed', 5, '--night', night, '--scenario', `${S2}/survive-night${night}.scenario.json`, '--ticks', ticks, '--out', perfOut]);
  line(`| ${night} | \`--scenario survive-night${night} --ticks ${ticks}\` (Mây đứng trong vùng an toàn của L1, mọi thứ khác tự sinh) | **${perf.ms.toFixed(0)} ms** | \`${JSON.stringify(readJsonl(perfOut).at(-1))}\` |`);
}
line();

fs.writeFileSync(path.join(OUT, 'proof.md'), md.join('\n') + '\n');
console.log(`wrote ${rel(path.join(OUT, 'proof.md'))}`);
if (t.status !== 0) process.exitCode = 1;

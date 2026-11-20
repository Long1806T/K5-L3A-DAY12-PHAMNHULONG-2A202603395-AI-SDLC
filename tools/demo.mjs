#!/usr/bin/env node
// Makes docs/demo/demo.mp4 (< 5 min) from the real game.
//   node tools/demo.mjs [--out docs/demo/demo.mp4] [--fps 20]
// Gameplay: the autopilot (tools/bot.js) plays; its recorded inputs are replayed
// by the browser build (?demo=1&replay=…), and every frame is drawn on a virtual
// clock and captured, so the video is smooth even on a machine without a GPU.
// Evidence: the real output of npm test / headless / soak / bench, run while
// the video is made. Dev-only: needs Playwright, Chrome and ffmpeg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { playNight } from './bot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const OUT = path.resolve(ROOT, arg('--out', 'docs/demo/demo.mp4'));
const FPS = Number(arg('--fps', '20'));
const WORK = path.join(ROOT, 'out', 'demo');
const PORT = 5277;
const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'game.contract.json'), 'utf8')).tuning;
fs.rmSync(WORK, { recursive: true, force: true });
fs.mkdirSync(WORK, { recursive: true });

// ---- autopilot runs to replay ----------------------------------------------
const runs = {};
for (const [night, seed] of [[1, '1'], [2, '3'], [3, '4']]) {
  const { frames } = playNight({ tuning: T, seed, night, maxTicks: 21600 });
  const f = path.join(WORK, `n${night}.inputs.json`);
  fs.writeFileSync(f, JSON.stringify({ frames }));
  runs[night] = { seed, file: path.relative(ROOT, f).split(path.sep).join('/') };
}

const require = createRequire(import.meta.url);
const pw = ['playwright', '/opt/npm-tools/node_modules/playwright', path.join(os.homedir(), '.npm-global/lib/node_modules/playwright')];
const { chromium } = pw.reduce((found, p) => found || (() => { try { return require(p); } catch { return null; } })(), null) || {};
if (!chromium) throw new Error('playwright not found');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-demo-data-'));
const server = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, DDL_DATA_DIR: dataDir } });
await new Promise((r) => server.stdout.once('data', r));
const browser = await chromium.launch({
  executablePath: ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p)),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const segments = []; // { kind: 'frames', dir, count } | { kind: 'still', file, seconds }
let stillNo = 0;
let coverFrame = null; // a gameplay frame for the README image

const CAP_CSS = 'position:fixed;left:16px;top:58px;max-width:430px;padding:9px 15px;border-radius:12px;background:#000d;color:#F5F1E6;font:600 19px/1.35 system-ui,sans-serif;border-left:5px solid #FFB347;z-index:99';
async function caption(text) {
  await page.evaluate(([t, css]) => {
    let el = document.getElementById('democap');
    if (!el) {
      el = document.createElement('div');
      el.id = 'democap';
      el.style.cssText = css;
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.display = t ? '' : 'none';
  }, [text, CAP_CSS]);
}

async function still(seconds, html) {
  if (html) await page.setContent(html, { waitUntil: 'load' });
  const file = path.join(WORK, `still-${String(++stillNo).padStart(2, '0')}.png`);
  await page.screenshot({ path: file });
  segments.push({ kind: 'still', file, seconds });
}

/** Replays a night from its start, skips to `from` (no drawing), then films `seconds`. */
async function film({ night, from = 0, seconds, text, after = null }) {
  const r = runs[night];
  await page.goto(`http://localhost:${PORT}/?night=${night}&autostart=1&seed=${r.seed}&demo=1&replay=${r.file}`);
  await page.waitForFunction(() => window.__DDL && window.__DDL.world && window.__DDL.mode === 'playing');
  if (from) await page.evaluate((n) => window.__DDL.advance(n), from);
  await caption(text);
  const t0 = await page.evaluate(() => performance.now());
  await page.evaluate((t) => window.__DDL.frame(t), t0); // sync the frame clock
  const dir = path.join(WORK, `seg-${segments.length}`);
  fs.mkdirSync(dir);
  const n = Math.round(seconds * FPS);
  for (let i = 1; i <= n; i++) {
    await page.evaluate((t) => window.__DDL.frame(t), t0 + (i * 1000) / FPS);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
  }
  segments.push({ kind: 'frames', dir, count: n });
  coverFrame ??= path.join(dir, `${String(Math.min(n, Math.round(13 * FPS))).padStart(5, '0')}.jpg`);
  console.log(`filmed Đêm ${night} from tick ${from}: ${n} frames`);
  if (after) await after();
}

const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
const card = (title, sub, extra = '') => `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:720px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 38%,#2a1d52,#0E1430 70%);color:#F5F1E6;font-family:system-ui,sans-serif;text-align:center">
  <div style="font-size:72px;font-weight:800;color:#FFB347;text-shadow:0 0 30px #ffb34788">${title}</div>
  <div style="font-size:28px;margin-top:14px;opacity:.9">${sub}</div><div style="font-size:21px;margin-top:26px;opacity:.75;line-height:1.6">${extra}</div></body>`;
const term = (title, body) => `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:720px;background:#0b0f1a;color:#d6e2ff;overflow:hidden">
  <div style="padding:26px 40px"><div style="font:700 27px system-ui,sans-serif;color:#FFB347;margin-bottom:14px">${title}</div>
  <pre style="margin:0;font:19px/1.42 ui-monospace,Menlo,Consolas,monospace;white-space:pre-wrap">${body}</pre></div></body>`;
const shotCard = (img, text) => `<!doctype html><meta charset="utf-8"><body style="margin:0;width:1280px;height:720px;background:#000;overflow:hidden;position:relative">
  <img src="http://localhost:${PORT}/${img}" style="width:1280px;height:720px;display:block">
  <div style="${CAP_CSS};position:absolute">${esc(text)}</div></body>`;
const sh = (cmd, args, env = {}) => {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env }, timeout: 300000 });
  return (r.stdout + r.stderr).trim();
};
const cut = (s, n = 118) => s.split('\n').map((l) => (l.length > n ? `${l.slice(0, n - 1)}…` : l)).join('\n');

// ---- 1. title + menu -------------------------------------------------------
await still(4, card('Đảo Đèn Lồng', 'v1.0.0 · video demo', 'Game 3D WebGL tự viết · chế độ headless theo Test Contract v1.3<br>Phần chơi: autopilot <code>tools/bot.js</code> điều khiển, input được phát lại qua chính lõi game<br>Video không có tiếng (âm thanh của game được tổng hợp lúc chạy)'));
await page.goto(`http://localhost:${PORT}/?seed=1&demo=1`);
await page.waitForFunction(() => window.__DDL && window.__DDL.world);
{
  const t0 = await page.evaluate(() => performance.now());
  const dir = path.join(WORK, 'seg-menu');
  fs.mkdirSync(dir);
  for (let i = 1; i <= 3 * FPS; i++) {
    await page.evaluate((t) => window.__DDL.frame(t), t0 + (i * 1000) / FPS);
    await page.screenshot({ path: path.join(dir, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 90 });
  }
  segments.push({ kind: 'frames', dir, count: 3 * FPS });
  await page.evaluate(() => window.__DDL.act('play'));
  await page.evaluate((t) => window.__DDL.frame(t), t0 + 3100);
  await still(3.5);
}

// ---- 2. gameplay ------------------------------------------------------------
await film({ night: 1, from: 560, seconds: 21, text: 'Đêm 1 · Đảo Bến — gom đom đóm, thắp đèn L4, Tỏa Sáng xua Bóng Mực' });
await film({ night: 1, from: 7080, seconds: 6, text: 'Đèn L4 cạn dầu và tắt — thắp lại chỉ cần 5 đom đóm' });
await film({ night: 1, from: 11100, seconds: 9, text: 'Châm dầu cho đèn L5 (thanh dầu trên đèn), giữ ≥ 3/5 đèn sáng' });
await film({
  night: 1, from: 14160, seconds: 5, text: 'Sát giờ bình minh: thắp lại L2 → 3/5 đèn sáng → thắng Đêm 1 (dawn_survived)',
  after: async () => {
    await caption('');
    await still(4);
  },
});
await film({ night: 2, from: 4660, seconds: 8, text: 'Đêm 2 · Đảo Cau — Gió Lạc cướp đom đóm khi Mây mang ≥ 5 con' });
await film({ night: 3, from: 1600, seconds: 7, text: 'Đêm 3 · Đảo Chuông — "Gió sắp thổi": phụ đề + lá bay báo trước cơn gió' });
await film({ night: 3, from: 2680, seconds: 4, text: 'Đêm 3 — thắp đèn L4 trên tầng dưới tháp chuông' });

// ---- 3. features (screenshots made by tools/capture.mjs) -------------------
for (const [img, text] of [
  ['docs/proof/phase-4/screens/02-settings.png', 'Cài đặt: phụ đề, giảm chuyển động, chữ lớn ×1,25, đổi phím — đều được lưu'],
  ['docs/proof/phase-4/screens/03-remap-conflict.png', 'Đổi phím: trùng phím được phát hiện, có đổi chỗ và "Khôi phục mặc định"'],
  ['docs/proof/phase-4/screens/06-sub-shade.png', 'Phụ đề + mũi tên ở mép màn hình khi Bóng Mực xuất hiện'],
  ['docs/proof/phase-3/screens/05-colorblind.png', 'Bảng màu dễ phân biệt: viền #00B3FF, cảnh báo trắng + ⚠, đèn tắt xẹp và rách'],
  ['docs/proof/phase-4/screens/10-large-text.png', 'Chữ lớn ×1,25 (mọi chữ ≥ 18 px ở 1280×720)'],
  ['docs/proof/phase-4/screens/13-dawn-name.png', 'Màn Bình Minh: nhập tên (có dấu tiếng Việt) để lưu điểm'],
  ['docs/proof/phase-4/screens/14-board-after-dawn.png', 'Bảng xếp hạng top 10, lưu trên đĩa (data/leaderboard.json)'],
  ['docs/proof/phase-4/screens/16-bench-scene.png', 'Cảnh benchmark chuẩn: 200 Bóng Mực, 100 đom đóm, camera bay vòng r = 30 m'],
]) await still(3.6, shotCard(img, text));

// ---- 4. evidence: real command output ---------------------------------------
const tests = sh(process.execPath, ['scripts/run-tests.js']);
const okLines = tests.split('\n').filter((l) => /^ok \d+ - /.test(l));
const summary = tests.split('\n').filter((l) => /^# (tests|pass|fail|duration_ms)/.test(l));
await still(8, term('Bằng chứng 1/4 · Bộ test', esc(`$ npm test\n${okLines.slice(0, 6).join('\n')}\n…\n${okLines.filter((l) => /P4-/.test(l)).slice(0, 8).join('\n')}\n…\n${summary.join('\n')}`)));

const h1 = path.join(WORK, 'run1.jsonl');
const h2 = path.join(WORK, 'run2.jsonl');
for (const f of [h1, h2]) sh(process.execPath, ['src/headless.js', '--seed', '1', '--night', '1', '--ticks', '600', '--out', f]);
const lines = fs.readFileSync(h1, 'utf8').trim().split('\n');
const hash = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 16);
await still(8, term('Bằng chứng 2/4 · Headless (Test Contract v1.3)', esc(cut(`$ node src/headless.js --seed 1 --night 1 --ticks 600 --out run.jsonl
$ head -n 2 run.jsonl
${lines[0]}
${lines[1]}
$ tail -n 1 run.jsonl
${lines.at(-1)}
$ (chạy lại lần 2, so SHA-256)
run1 ${hash(h1)}…  run2 ${hash(h2)}…  → ${hash(h1) === hash(h2) ? 'giống hệt (tất định)' : 'KHÁC'}`))));

const soak = sh(process.execPath, ['tools/soak.js', '--seed', '7', '--nights', '10', '--out', 'out/demo/soak.json']);
await still(8, term('Bằng chứng 3/4 · Soak test (soak_cmd)', esc(cut(`$ node tools/soak.js --seed 7 --nights 10 --out soak.json\n${soak}`))));

const bench = sh(process.execPath, ['tools/bench.js', '--seed', '42', '--duration', '30', '--out', 'out/demo/bench.json']);
const bj = fs.existsSync(path.join(WORK, 'bench.json')) ? JSON.parse(fs.readFileSync(path.join(WORK, 'bench.json'), 'utf8')) : {};
const pick = ['contract_version', 'avg_fps', 'p1_low_fps', 'frame_ms_p95', 'frames', 'load_ms', 'peak_mem_mb', 'vsync_off', 'resolution', 'cpu_ms_avg'].map((k) => `  "${k}": ${JSON.stringify(bj[k])}`).join(',\n');
await still(9, term('Bằng chứng 4/4 · Benchmark (bench_cmd)', esc(cut(`$ node tools/bench.js --seed 42 --duration 30 --out bench.json\n${bench}\n$ cat bench.json (rút gọn)\n{\n${pick}\n}\n# Máy quay video không có GPU (WebGL bằng phần mềm SwiftShader) nên FPS rất thấp;\n# ngưỡng avg ≥ 60 / 1% low ≥ 30 được đo trên máy chấm có GPU.`))));

await still(4, card('Cảm ơn!', 'github.com/Long1806T/K5-L3A-DAY12-PHAMNHULONG-2A202603395-AI-SDLC', 'README: cài đặt 3 lệnh · bằng chứng từng phase ở docs/proof/ · retro ở docs/notes/retro.md'));

await browser.close();
server.kill();

// ---- 5. ffmpeg ----------------------------------------------------------------
const parts = [];
for (const [i, s] of segments.entries()) {
  const part = path.join(WORK, `part-${String(i).padStart(2, '0')}.mp4`);
  const common = ['-vf', 'scale=1280:720,format=yuv420p', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-an'];
  const args = s.kind === 'frames' ? ['-y', '-framerate', String(FPS), '-i', path.join(s.dir, '%05d.jpg'), ...common, part] : ['-y', '-loop', '1', '-t', String(s.seconds), '-i', s.file, ...common, part];
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed on segment ${i}: ${r.stderr.slice(-400)}`);
  parts.push(part);
}
const list = path.join(WORK, 'parts.txt');
fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
fs.mkdirSync(path.dirname(OUT), { recursive: true });
const fin = spawnSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', OUT], { encoding: 'utf8' });
if (fin.status !== 0) throw new Error(`ffmpeg concat failed: ${fin.stderr.slice(-400)}`);
const dur = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', OUT], { encoding: 'utf8' }).stdout.trim();
console.log(`wrote ${path.relative(ROOT, OUT)}: ${Number(dur).toFixed(1)} s, ${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB`);
// a cover image for the README: one gameplay frame
if (coverFrame) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', coverFrame, path.join(path.dirname(OUT), 'cover.png')]);

#!/usr/bin/env node
// Benchmark runner (Ticket-04 §1).
//   node tools/bench.js --seed 42 --duration 30 --out bench.json
//        [--browser <chrome|edge|chromium path>] [--headless] [--browser-flag <flag>]...
// Opens the game's standard bench scene (index.html?bench=1, see src/web/bench.js)
// in a Chrome/Edge/Chromium app window 1280×720 with vsync and the frame-rate
// limit off, waits 3 s of warm-up, measures --duration s, writes bench.json and
// exits 0. Memory: peak RSS of the browser's own process tree (all its
// processes), sampled every 0.5 s during the measured window.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createAppServer, readBody, ROOT } from './serve.js';
import { benchStats, BENCH } from '../src/web/bench-lib.js';

const PROCESS_START = performance.timeOrigin; // epoch ms when this process started
const argv = process.argv.slice(2);
const val = (k, d) => {
  const i = argv.indexOf(k);
  if (i !== -1) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`${k}=`));
  return eq ? eq.slice(k.length + 1) : d;
};
const all = (k) => argv.flatMap((a, i) => (a === k ? [argv[i + 1]] : a.startsWith(`${k}=`) ? [a.slice(k.length + 1)] : []));

const seed = String(val('--seed', '42')).trim();
const duration = Number(val('--duration', '30'));
const out = val('--out', 'bench.json');
if (!/^[+-]?\d+$/.test(seed) || !(duration > 0)) {
  console.error('usage: node tools/bench.js --seed <int> --duration <s> --out <bench.json> [--browser <path>] [--headless] [--browser-flag <flag>]');
  process.exit(1);
}
const VSYNC_FLAGS = ['--disable-gpu-vsync', '--disable-frame-rate-limit'];
const extraFlags = [...all('--browser-flag'), ...(process.env.BENCH_BROWSER_FLAGS || '').split(/\s+/).filter(Boolean)];

function onPath(names) {
  const dirs = (process.env.PATH || '').split(path.delimiter);
  for (const n of names) for (const d of dirs) {
    const f = path.join(d, n);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

function findBrowser() {
  const given = val('--browser') || process.env.BENCH_BROWSER || process.env.CHROME_PATH;
  if (given) return given;
  if (process.platform === 'win32') {
    const bases = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    const rels = ['Google\\Chrome\\Application\\chrome.exe', 'Microsoft\\Edge\\Application\\msedge.exe', 'Chromium\\Application\\chrome.exe', 'BraveSoftware\\Brave-Browser\\Application\\brave.exe'];
    for (const r of rels) for (const b of bases) if (fs.existsSync(path.join(b, r))) return path.join(b, r);
    return null;
  }
  if (process.platform === 'darwin') {
    const apps = ['Google Chrome', 'Chromium', 'Microsoft Edge', 'Brave Browser'].map((n) => `/Applications/${n}.app/Contents/MacOS/${n}`);
    return apps.find((a) => fs.existsSync(a)) || null;
  }
  return onPath(['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge', 'microsoft-edge-stable', 'brave-browser']);
}

function browserVersion(exe) {
  if (process.platform === 'win32') return path.basename(exe);
  try {
    return execFileSync(exe, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
  } catch {
    return path.basename(exe);
  }
}

// --- memory: sum of RSS over the browser's process tree -------------------
function processTable() {
  if (process.platform === 'win32') {
    const csv = execFileSync('powershell', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,WorkingSetSize,Name | ConvertTo-Csv -NoTypeInformation'], { encoding: 'utf8', timeout: 8000 });
    return csv.trim().split(/\r?\n/).slice(1).map((l) => {
      const [pid, ppid, ws, name] = l.split(',').map((c) => c.replace(/^"|"$/g, ''));
      return { pid: Number(pid), ppid: Number(ppid), rssKb: Number(ws) / 1024, name };
    });
  }
  const txt = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8', timeout: 5000 });
  return txt.trim().split('\n').map((l) => {
    const m = l.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    return m ? { pid: Number(m[1]), ppid: Number(m[2]), rssKb: Number(m[3]), name: m[4] } : null;
  }).filter(Boolean);
}

function browserTreeMb(rootPid) {
  const rows = processTable();
  const kids = new Map();
  for (const r of rows) kids.set(r.ppid, [...(kids.get(r.ppid) || []), r]);
  let kb = 0;
  const stack = [rootPid];
  const seen = new Set();
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    const me = rows.find((r) => r.pid === pid);
    if (me && /chrom|msedge|edge|brave/i.test(me.name)) kb += me.rssKb; // skip xvfb-run / Xvfb / shells
    for (const k of kids.get(pid) || []) stack.push(k.pid);
  }
  return kb / 1024;
}

// --------------------------------------------------------------------------
const exe = findBrowser();
if (!exe) {
  console.error('Không tìm thấy Chrome / Edge / Chromium. Cài một trình duyệt nhân Chromium hoặc chỉ đường dẫn: --browser "<đường dẫn>" (hoặc biến môi trường CHROME_PATH).');
  process.exit(1);
}

let firstFrameEpoch = null;
let measuring = false;
let peakMb = null;
let memError = null;
let finished = null;
const done = new Promise((resolve) => {
  finished = resolve;
});

const server = createAppServer({
  extra: async (req, res, url) => {
    if (url.pathname !== '/__bench' || req.method !== 'POST') return false;
    const msg = JSON.parse(await readBody(req, 64 * 1024 * 1024));
    if (msg.type === 'first_frame') firstFrameEpoch = msg.epoch_ms;
    if (msg.type === 'measure_start') measuring = true;
    if (msg.type === 'result') finished(msg);
    res.writeHead(204).end();
    return true;
  },
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html?bench=1&report=1&seed=${encodeURIComponent(seed)}&duration=${duration}`;

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-bench-'));
const headless = argv.includes('--headless') || (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY && !onPath(['xvfb-run']));
const flags = [
  `--app=${url}`,
  `--window-size=${BENCH.width},${BENCH.height}`,
  '--window-position=40,40',
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  ...VSYNC_FLAGS,
  ...(headless ? ['--headless=new'] : []),
  ...extraFlags,
];
const useXvfb = process.platform === 'linux' && !headless && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY;
const [cmd, args] = useXvfb ? ['xvfb-run', ['-a', '-s', '-screen 0 1920x1080x24', exe, ...flags]] : [exe, flags];
const child = spawn(cmd, args, { stdio: 'ignore', detached: process.platform !== 'win32' });
child.on('error', (e) => {
  console.error(`không mở được trình duyệt: ${e.message}`);
  process.exit(1);
});
console.log(`bench: ${path.basename(exe)}${useXvfb ? ' (Xvfb)' : ''}${headless ? ' (headless)' : ''} · seed ${seed} · khởi động ${BENCH.warmupS} s + đo ${duration} s …`);

const sampler = setInterval(() => {
  if (!measuring) return;
  try {
    const mb = browserTreeMb(child.pid);
    if (mb > 0) peakMb = Math.max(peakMb ?? 0, mb);
  } catch (e) {
    memError = e.message;
  }
}, process.platform === 'win32' ? 2000 : 500);

const timeout = setTimeout(() => finished(null), (BENCH.warmupS + duration + 90) * 1000);
const result = await done;
clearTimeout(timeout);
clearInterval(sampler);

function stopBrowser() {
  try {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch {
    /* already gone */
  }
}
stopBrowser();
server.close();
setTimeout(() => fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 }), 1500).unref?.();

if (!result) {
  console.error('bench: trang benchmark không gửi kết quả (hết giờ chờ). Thử chạy với --headless hoặc --browser <đường dẫn>.');
  process.exit(1);
}
const stats = benchStats(result.dts); // recomputed here from the raw frame times
const ver = browserVersion(exe);
const cpus = os.cpus();
const report = {
  contract_version: '1.3',
  avg_fps: stats.avg_fps,
  p1_low_fps: stats.p1_low_fps,
  frame_ms_p95: stats.frame_ms_p95,
  frames: stats.frames,
  load_ms: firstFrameEpoch === null ? null : Math.round(firstFrameEpoch - PROCESS_START),
  peak_mem_mb: peakMb === null ? null : Math.round(peakMb),
  vsync_off: true,
  renderer: `WebGL 1 tự viết (src/web/renderer.js, không thư viện) · ${result.info.gpu} · ${ver}`,
  os: `${os.type()} ${os.release()} ${os.arch()} · ${cpus[0]?.model?.trim() ?? 'CPU'} × ${cpus.length} · RAM ${Math.round(os.totalmem() / 2 ** 30)} GB`,
  // extra fields (not required by the ticket)
  seed: Number(seed),
  duration_s: duration,
  warmup_s: BENCH.warmupS,
  resolution: result.info.canvas,
  window: `${result.info.inner} CSS px, devicePixelRatio ${result.info.dpr}${useXvfb ? ', Xvfb' : ''}${headless ? ', headless' : ''}`,
  frame_ms_median: [...result.dts].sort((x, y) => x - y)[Math.floor(result.dts.length / 2)] ?? null,
  frame_ms_max: Math.max(...result.dts),
  cpu_ms_avg: result.info.cpu_ms_avg,
  cpu_ms_p95: result.info.cpu_ms_p95,
  scene: { night: 1, shades: result.info.shades, motes: result.info.motes, lanterns_lit: result.info.lit, state_at_end: result.info.state },
  browser_flags: [...VSYNC_FLAGS, ...(headless ? ['--headless=new'] : []), ...extraFlags].join(' '),
  vsync_note: 'vsync và giới hạn khung hình của Chrome tắt bằng --disable-gpu-vsync --disable-frame-rate-limit; một số driver/hệ điều hành vẫn có thể ép vsync',
  peak_mem_note: peakMb === null ? `không đo được RSS của trình duyệt (${memError ?? 'không có mẫu'})` : 'tổng RSS của mọi tiến trình trình duyệt (browser, GPU, renderer) lấy mẫu mỗi 0,5 s (Windows: 2 s) trong lúc đo; các tiến trình dùng chung trang nhớ nên đây là cận trên',
};
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
const pass = report.avg_fps >= 60 && report.p1_low_fps >= 30 && report.load_ms !== null && report.load_ms <= 10000;
console.log(`avg ${report.avg_fps} FPS · 1% low ${report.p1_low_fps} · p95 ${report.frame_ms_p95} ms · ${report.frames} khung · load ${report.load_ms} ms · RAM ${report.peak_mem_mb} MB → ${out}`);
console.log(`ngưỡng Ticket-04 (avg ≥ 60, 1% low ≥ 30, load ≤ 10 s) trên máy này: ${pass ? 'đạt' : 'chưa đạt'} · GPU: ${result.info.gpu}`);
process.exit(0);

#!/usr/bin/env node
// Plays the browser build in headless Chrome and saves screenshots plus a JSON
// report of what the page's own game state said at each step.
// Dev-only: needs Playwright (npm i -g playwright) and Chrome/Chromium.
//   node tools/capture.mjs [--out docs/proof/phase-2/screens]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const OUT = path.resolve(ROOT, arg('--out', 'docs/proof/phase-2/screens'));
const PORT = 5199;

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const roots = [process.env.NODE_PATH, '/opt/npm-tools/node_modules', path.join(process.env.HOME || '', '.npm-global/lib/node_modules')].filter(Boolean);
  for (const r of ['playwright', ...roots.map((x) => path.join(x, 'playwright'))]) {
    try {
      return require(r);
    } catch {
      /* try next */
    }
  }
  throw new Error('playwright not found (npm i -g playwright)');
}

const startServer = () =>
  new Promise((resolve, reject) => {
    const srv = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'] });
    srv.stdout.on('data', (d) => String(d).includes('http://') && resolve(srv));
    srv.on('error', reject);
    setTimeout(() => reject(new Error('server did not start')), 8000);
  });

const { chromium } = loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  executablePath: ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p)),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && problems.push(`console: ${m.text()}`));

const report = { when: new Date().toISOString(), viewport: '1280x720', renderer: 'Chrome headless + SwiftShader (software WebGL, no GPU)', shots: [], checks: {} };
const state = () => page.evaluate(() => ({ mode: window.__DDL.mode, snap: window.__DDL.snapshot(), result: window.__DDL.world.result, campaign: window.__DDL.campaign }));
const shot = async (name, what) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  const s = await state();
  report.shots.push({ file: path.relative(ROOT, file), what, mode: s.mode, night: s.snap.night, tick: s.snap.tick, state: s.snap.state, score: s.snap.score, result: s.result });
  console.log(`saved ${path.relative(ROOT, file)} (${s.mode}, night ${s.snap.night}, tick ${s.snap.tick}, ${s.snap.state})`);
  return s;
};
const open = async (query) => {
  await page.goto(`http://localhost:${PORT}/${query}`);
  await page.waitForFunction(() => window.__DDL && window.__DDL.world);
  await page.waitForTimeout(700);
};
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};
const act = (a) => page.evaluate((x) => window.__DDL.act(x), a);

try {
  await open('?seed=7');
  await shot('01-menu', 'Menu chính: Chơi, chọn Đêm, Cài đặt, Điều khiển');
  await act('play');
  await page.waitForTimeout(300);
  await shot('02-intro', 'Giới thiệu Đêm 1: tên đảo + lời Ông Đăng');
  await act('start');
  await hold('KeyW', 1200);
  await shot('03-night1-hud', 'HUD đúng vị trí: Ngọn Lửa trên trái, đồng hồ giữa, đèn + điểm phải, thanh 10 ô dưới giữa, hồi chiêu dưới phải');
  await hold('ArrowLeft', 1500);
  report.checks.arrowVisible = await page.evaluate(() => document.getElementById('arrow').classList.contains('show'));
  await shot('04-arrow', 'Xoay camera ra xa: mũi tên ở mép màn hình chỉ tới đèn chưa sáng gần nhất');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const ps = await shot('05-pause', 'Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; logic dừng (state "paused")');
  report.checks.pausedState = ps.snap.state;
  const t0 = ps.snap.sim_tick;
  await page.waitForTimeout(1000);
  report.checks.simTickFrozenWhilePaused = (await state()).snap.sim_tick === t0;
  await act('settings');
  await page.evaluate(() => {
    const v = document.getElementById('vol');
    v.value = '35';
    v.dispatchEvent(new Event('input'));
    const s = document.getElementById('sens');
    s.value = '150';
    s.dispatchEvent(new Event('input'));
  });
  await shot('06-settings', 'Cài đặt: âm lượng 35, độ nhạy 1.5 (lưu localStorage)');
  await open('?seed=7');
  report.checks.settingsAfterReload = await page.evaluate(() => window.__DDL.settings);

  await open('?night=2&autostart=1&seed=3&yaw=90&scenario=scenarios/phase2/visual-night2.scenario.json');
  await page.waitForTimeout(900);
  await shot('07-night2-bridge', 'Đêm 2: cầu tre, Bùa Gió đỏ viền vàng trên cầu, Gió Lạc (dải lụa xám xanh) đuổi vì Mây mang 6 đom đóm');
  await open('?night=2&autostart=1&seed=3&scenario=scenarios/phase2/pad-night2.scenario.json');
  await hold('KeyW', 120);
  await page.waitForTimeout(500);
  await shot('08-night2-pad', 'Đêm 2: chạm bục nhảy (20,0,18), bay qua biển mây sang đảo B');

  await open('?night=3&autostart=1&seed=5&debug=1&scenario=scenarios/phase2/visual-night3.scenario.json');
  await page.evaluate(() => window.__DDL.advance(1700));
  await page.waitForTimeout(250);
  await shot('09-night3-warn', 'Đêm 3: lá bay báo gió sắp thổi (2 s trước cơn gió), tháp chuông và tầng ở xa');
  await page.evaluate(() => window.__DDL.advance(110));
  await page.waitForTimeout(250);
  const ws = await shot('10-night3-wind', 'Đêm 3: cơn gió đang thổi (wind.active)');
  report.checks.windActive = ws.snap.wind;
  await open('?night=3&autostart=1&seed=5&scenario=scenarios/phase2/pad-night3.scenario.json');
  await hold('KeyS', 250);
  await page.waitForTimeout(350);
  await shot('11-night3-pad', 'Đêm 3: bục nhảy (0,3,13) bắn lên tầng 2');

  await open('?night=1&autostart=1&seed=1&scenario=scenarios/phase1/shade-hits.scenario.json');
  await page.waitForFunction(() => window.__DDL.mode === 'result', null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await shot('12-result-lost', 'Thua Đêm (hết Ngọn Lửa): chơi lại Đêm đó hoặc về menu');
  const sounds = {};
  const addSounds = async () => {
    for (const [k, v] of Object.entries(await page.evaluate(() => window.__DDL.audioPlayed))) sounds[k] = (sounds[k] || 0) + v;
  };
  await addSounds();
  await open('?night=3&autostart=1&seed=1&scenario=scenarios/phase2/win-night3.scenario.json');
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__DDL.mode === 'result', null, { timeout: 10000 });
  await shot('13-result-won', 'Thắng Đêm 3: nút Đón Bình Minh');
  await act('dawn');
  await page.waitForTimeout(300);
  await shot('14-dawn', 'Màn hình Bình Minh với tổng điểm các Đêm đã thắng');
  await addSounds();

  await open('?night=1&autostart=1&seed=1&scenario=scenarios/phase2/audio-check.scenario.json');
  for (const k of ['Space', 'ShiftLeft', 'KeyF', 'KeyE']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(3500);
  await addSounds();
  await open('?night=1&autostart=1&seed=2&debug=1');
  await page.evaluate(() => window.__DDL.advance(305));
  await page.waitForTimeout(200);
  await addSounds();
  report.checks.soundsPlayed = sounds;
  const needed = ['pickup', 'lit', 'pulse', 'hit', 'jump', 'dash', 'win', 'lose', 'shade', 'countdown'];
  report.checks.soundsMissing = needed.filter((n) => !sounds[n]);

  await open('?night=1&autostart=1&seed=7&fps=1');
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(10000);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ArrowLeft');
  const ft = await page.evaluate(() => window.__DDL.frameTimes());
  const tail = ft.slice(-Math.min(ft.length, 400)).filter((x) => x > 0);
  const cpu = (await page.evaluate(() => window.__DDL.cpuTimes())).slice(-tail.length).sort((a, b) => a - b);
  report.checks.fps = {
    frames: tail.length,
    avg_fps: Math.round((1000 * tail.length * 10) / tail.reduce((a, b) => a + b, 0)) / 10,
    cpu_ms_avg: Math.round((cpu.reduce((a, b) => a + b, 0) / cpu.length) * 100) / 100,
    cpu_ms_p95: Math.round(cpu[Math.floor(cpu.length * 0.95)] * 100) / 100,
    note: 'SwiftShader software WebGL in a 2-vCPU container without GPU: avg_fps measures CPU rasterisation, cpu_ms is the game\'s own JS work per frame',
  };
  await shot('15-fps', 'Đo FPS 1280×720 (góc phải trên)');
} finally {
  report.problems = problems;
  fs.writeFileSync(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.kill();
}
console.log(JSON.stringify(report.checks, null, 1));
if (problems.length) {
  console.error('page problems:\n' + problems.join('\n'));
  process.exitCode = 1;
}

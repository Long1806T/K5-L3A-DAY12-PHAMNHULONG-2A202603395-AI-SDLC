#!/usr/bin/env node
// Plays the browser build in headless Chrome and saves screenshots plus a JSON
// report of what the page's own game state said at each step.
// Dev-only: needs Playwright (npm i -g playwright) and Chrome/Chromium.
//   node tools/capture.mjs [--out docs/proof/phase-2/screens]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const PHASE = arg('--phase', '2');
const OUT = path.resolve(ROOT, arg('--out', `docs/proof/phase-${PHASE}/screens`));
const PORT = 5199;
// the capture server keeps its leaderboard in a throw-away folder (exported into the report at the end)
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ddl-capture-data-'));

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
    const srv = spawn(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--port', String(PORT)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, DDL_DATA_DIR: DATA_DIR } });
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

async function phase3() {
  const S3 = 'scenarios/phase3';
  await open(`?night=1&autostart=1&seed=1&scenario=${S3}/visual-fuel.scenario.json`);
  await page.waitForTimeout(1300);
  report.checks.fuelBars = await page.evaluate(() => [...document.querySelectorAll('.fuel')].filter((e) => e.style.display !== 'none').map((e) => ({ l: e.dataset.l, text: e.lastChild.textContent, low: e.classList.contains('low') })));
  await shot('01-fuel-bars', 'Thanh dầu trên đèn sáng: L1 80 (bình thường), L2 25 (dưới 30: đỏ, ⚠, nhấp nháy 1 Hz), Bóng Mực đang hút L2 (drain)');
  await page.waitForTimeout(500);
  await shot('02-fuel-blink', 'Nửa giây sau: đèn L2 và thanh dầu ở pha tắt của nhịp nhấp nháy 1 Hz');
  await open(`?night=1&autostart=1&seed=1&dist=16&scenario=${S3}/visual-refuel.scenario.json`);
  await page.waitForTimeout(500);
  report.checks.refuelPrompt = await page.evaluate(() => document.getElementById('prompt').textContent);
  await shot('03-refuel-prompt', 'Đứng cạnh đèn đang sáng: nhắc "E — Châm dầu (fuel/100)"');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  report.checks.afterRefuel = await page.evaluate(() => window.__DDL.snapshot().lanterns[0]);
  await open(`?night=1&autostart=1&seed=1&dist=16&scenario=${S3}/visual-out.scenario.json`);
  await page.waitForFunction(() => window.__DDL.world.lanterns[0].lit === false, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot('04-lantern-out', 'Đèn cạn dầu → tắt (lantern_out), nhắc thắp lại chỉ cần 5 đom đóm');
  await page.evaluate(() => localStorage.setItem('ddl.settings.v1', JSON.stringify({ volume: 0.7, sensitivity: 1, colorBlind: true })));
  await open(`?night=1&autostart=1&seed=1&dist=16&scenario=${S3}/visual-colorblind.scenario.json`);
  await page.waitForTimeout(1200);
  report.checks.colorBlind = await page.evaluate(() => ({ setting: window.__DDL.settings.colorBlind, bodyClass: document.body.className, danger: getComputedStyle(document.body).getPropertyValue('--danger').trim() }));
  await shot('05-colorblind', 'Bảng màu dễ phân biệt: viền/mắt Bóng Mực #00B3FF đang hút L2 (bên trái, nhấp nháy), L1 đã tắt xẹp 20% có vết rách (bên phải), cảnh báo trắng + ⚠');
  await page.evaluate(() => localStorage.setItem('ddl.settings.v1', JSON.stringify({ volume: 0.7, sensitivity: 1, colorBlind: false })));
  await open(`?night=1&autostart=1&seed=1&dist=16&scenario=${S3}/visual-colorblind.scenario.json`);
  await page.waitForTimeout(1200);
  await shot('06-normal-colors', 'Cùng cảnh với bảng màu thường để so sánh (viền tím #7A3CFF, đèn tắt không xẹp)');
  await open(`?night=1&autostart=1&seed=1&scenario=${S3}/dawn-win.scenario.json`);
  await page.waitForFunction(() => window.__DDL.mode === 'result', null, { timeout: 15000 });
  await shot('07-dawn-survived', 'Bình minh với 3/5 đèn sáng → thắng (dawn_survived), điểm bình minh');
  await open(`?night=1&autostart=1&seed=1&scenario=${S3}/dawn-lose.scenario.json`);
  await page.waitForFunction(() => window.__DDL.mode === 'result', null, { timeout: 15000 });
  await shot('08-dawn-lost', 'Bình minh với 2/5 đèn sáng → thua (dawn)');
}

/** Smallest computed font size of any visible text on the page right now (px). */
const minFont = () =>
  page.evaluate(() => {
    let min = Infinity;
    let where = '';
    for (const el of document.querySelectorAll('body *')) {
      if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) continue;
      const fs = parseFloat(st.fontSize);
      if (fs < min) [min, where] = [fs, `${el.tagName.toLowerCase()}#${el.id}.${el.className} "${el.textContent.trim().slice(0, 30)}"`];
    }
    return { min, where };
  });

async function phase4() {
  const S4 = 'scenarios/phase4';
  const fonts = [];
  const font = async (screen) => fonts.push({ screen, ...(await minFont()) });
  await open('?seed=7');
  await page.evaluate(() => localStorage.clear());
  await open('?seed=7');
  await shot('01-menu', 'Menu chính có thêm "Bảng xếp hạng"');
  await font('menu');
  await act('settings');
  await shot('02-settings', 'Cài đặt: phụ đề và chỉ báo, giảm chuyển động, chữ lớn ×1,25, đổi phím (đều được lưu)');
  await font('settings');
  await act('keys');
  await page.click('[data-key="jump"]');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  report.checks.remapConflictMessage = await page.evaluate(() => document.getElementById('keymsg').textContent);
  await shot('03-remap-conflict', 'Đổi phím Nhảy sang E: phát hiện trùng với Tương tác, báo và đề nghị đổi chỗ');
  await font('keys');
  await act('swap-keys');
  report.checks.afterSwap = await page.evaluate(() => ({ jump: window.__DDL.settings.keys.jump, interact: window.__DDL.settings.keys.interact }));
  await page.click('[data-key="pulse"]');
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(150);
  await shot('04-remap-saved', 'Sau khi đổi chỗ (Nhảy = E, Tương tác = Space) và đổi Tỏa sáng sang J');
  await open('?seed=7');
  report.checks.keysAfterReload = await page.evaluate(() => window.__DDL.settings.keys);
  // the remapped keys drive the game: E now jumps, Space no longer does
  await open(`?night=1&autostart=1&seed=1&scenario=${S4}/quiet.scenario.json`);
  await page.waitForTimeout(400);
  const j0 = await page.evaluate(() => window.__DDL.world.stats.jumps);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  const j1 = await page.evaluate(() => window.__DDL.world.stats.jumps);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(700);
  const j2 = await page.evaluate(() => window.__DDL.world.stats.jumps);
  report.checks.remappedJump = { before: j0, afterSpace: j1, afterE: j2 };
  await open('?seed=7');
  await act('settings');
  await act('keys');
  await act('reset-keys');
  report.checks.keysAfterReset = await page.evaluate(() => window.__DDL.settings.keys);
  await shot('05-remap-reset', '"Khôi phục mặc định" đưa mọi phím về như cũ');

  // captions and indicators (debug=1 lets the page step the core to the right moment)
  await open(`?night=1&autostart=1&seed=3&debug=1&scenario=${S4}/shade-spawn.scenario.json`);
  await page.evaluate(() => window.__DDL.advance(300));
  await page.waitForTimeout(250);
  report.checks.shadeSpawn = await page.evaluate(() => ({ subs: document.getElementById('subs').textContent, arrows: document.querySelectorAll('#shadearrows .shade-arrow').length, marks: document.querySelectorAll('#shadearrows .shade-mark').length }));
  await shot('06-sub-shade', 'Bóng Mực xuất hiện: phụ đề + mũi tên tím ở mép màn hình chỉ hướng từng con');
  await font('hud');
  await open(`?night=3&autostart=1&seed=2&debug=1&scenario=${S4}/quiet.scenario.json`);
  await page.evaluate(() => window.__DDL.advance(1680));
  await page.waitForTimeout(250);
  report.checks.windSubtitle = await page.evaluate(() => document.getElementById('subs').textContent);
  await shot('07-sub-wind', 'Gió sắp thổi: phụ đề (kèm âm thanh gió)');
  await open(`?night=1&autostart=1&seed=1&debug=1&scenario=${S4}/last-10s.scenario.json`);
  await page.evaluate(() => window.__DDL.advance(70));
  await page.waitForTimeout(250);
  report.checks.last10Subtitle = await page.evaluate(() => document.getElementById('subs').textContent);
  await shot('08-sub-last10', '10 giây cuối: phụ đề + đồng hồ đỏ nhấp nháy');
  await open(`?night=1&autostart=1&seed=1&debug=1&scenario=${S4}/fuel-low.scenario.json`);
  await page.evaluate(() => window.__DDL.advance(30));
  await page.waitForTimeout(250);
  report.checks.fuelSubtitle = await page.evaluate(() => document.getElementById('subs').textContent);
  await shot('09-sub-fuel', 'Đèn xuống dưới 30 dầu: phụ đề + thanh dầu đỏ nhấp nháy');

  // reduced motion: a hit gives no camera shake and no screen flash
  await page.evaluate(() => localStorage.setItem('ddl.settings.v1', JSON.stringify({ reducedMotion: true })));
  await open(`?night=1&autostart=1&seed=1&debug=1&scenario=${S4}/hit-now.scenario.json`);
  // read the effect state in the same task as the hit, before any frame can decay it
  report.checks.reducedMotion = await page.evaluate(() => (window.__DDL.advance(3), { hits: window.__DDL.world.stats.hits ?? null, flames: window.__DDL.world.player.flames, ...window.__DDL.fxState }));
  await page.evaluate(() => localStorage.setItem('ddl.settings.v1', JSON.stringify({ reducedMotion: false })));
  await open(`?night=1&autostart=1&seed=1&debug=1&scenario=${S4}/hit-now.scenario.json`);
  report.checks.normalMotion = await page.evaluate(() => (window.__DDL.advance(3), { hits: window.__DDL.world.stats.hits ?? null, flames: window.__DDL.world.player.flames, ...window.__DDL.fxState }));

  // large text ×1.25
  await page.evaluate(() => localStorage.setItem('ddl.settings.v1', JSON.stringify({ largeText: true })));
  await open(`?night=1&autostart=1&seed=1&scenario=${S4}/fuel-low.scenario.json`);
  await page.waitForTimeout(600);
  report.checks.largeTextMinFont = await minFont();
  await shot('10-large-text', 'Chữ lớn ×1,25: mọi chữ trên HUD ≥ 22,5 px');
  await page.evaluate(() => localStorage.setItem('ddl.settings.v1', JSON.stringify({})));

  // leaderboard: lose a night → name entry → board (stored on disk by tools/serve.js)
  await open(`?night=1&autostart=1&seed=11&scenario=${S4}/lose-at-dawn.scenario.json`);
  await page.waitForFunction(() => window.__DDL.mode === 'result', null, { timeout: 20000 });
  await page.fill('#pname', 'ab');
  await page.waitForTimeout(150);
  report.checks.badName = await page.evaluate(() => ({ error: document.getElementById('pname-err').textContent, saveDisabled: document.getElementById('save-score').disabled }));
  await shot('11-name-invalid', 'Thua Đêm → nhập tên; "ab" quá ngắn: báo lỗi, nút Lưu bị khóa');
  await font('result');
  await page.fill('#pname', 'Mây_Nhỏ');
  await page.click('#save-score');
  await page.waitForFunction(() => window.__DDL.mode === 'board', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await shot('12-board-after-loss', 'Đã lưu tên tiếng Việt có dấu, bảng xếp hạng tô sáng dòng vừa lưu');
  await font('board');
  // win Night 3 at dawn → Bình Minh → name entry
  await open(`?night=3&autostart=1&seed=21&scenario=${S4}/dawn-night3.scenario.json`);
  await page.waitForFunction(() => window.__DDL.mode === 'result', null, { timeout: 20000 });
  await act('dawn');
  await page.waitForTimeout(200);
  await shot('13-dawn-name', 'Thắng Đêm 3 → màn Bình Minh có ô nhập tên để lưu điểm');
  await page.fill('#pname', 'Long_1806');
  await page.click('#save-score');
  await page.waitForFunction(() => window.__DDL.mode === 'board', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  await shot('14-board-after-dawn', 'Bảng xếp hạng sau khi lưu ở màn Bình Minh (điểm cao hơn đứng trên)');
  // the board is still there after closing and reopening the game
  await page.evaluate(() => localStorage.clear());
  await open('?seed=7');
  await act('board');
  await page.waitForFunction(() => window.__DDL.mode === 'board', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  report.checks.boardAfterReload = await page.evaluate(() => [...document.querySelectorAll('table.board tr')].slice(1).map((tr) => tr.textContent));
  await shot('15-board-from-menu', 'Mở lại game (đã xóa dữ liệu trình duyệt) → menu → Bảng xếp hạng: dữ liệu vẫn còn (lưu trên đĩa)');
  report.checks.minFontPerScreen = fonts;

  // the benchmark scene itself (tools/bench.js measures it; here only a picture)
  await page.goto(`http://localhost:${PORT}/index.html?bench=1&seed=42&duration=60`);
  await page.waitForFunction(() => window.__BENCH && window.__BENCH.first !== null, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  report.checks.benchScene = await page.evaluate(() => ({ shades: window.__BENCH.world.shades.length, motes: window.__BENCH.world.motes.length, lit: window.__BENCH.world.lanterns.filter((l) => l.lit).length }));
  await shot4bench('16-bench-scene', 'Cảnh benchmark chuẩn: Đêm 1, 200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng, camera bay vòng r = 30 m, y = 15 m');
}

async function shot4bench(name, what) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  report.shots.push({ file: path.relative(ROOT, file), what, mode: 'bench' });
  console.log(`saved ${path.relative(ROOT, file)} (bench)`);
}

try {
  if (PHASE === '4') {
    await phase4();
    throw Object.assign(new Error('done'), { done: true });
  }
  if (PHASE === '3') {
    await phase3();
    throw Object.assign(new Error('done'), { done: true });
  }
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
} catch (e) {
  if (!e.done) throw e;
} finally {
  if (PHASE === '4') {
    // run_cmd --export-leaderboard on the same data the page just wrote
    const exp = path.join(OUT, 'leaderboard-export.json');
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/serve.js'), '--open', '--export-leaderboard', exp], { env: { ...process.env, DDL_DATA_DIR: DATA_DIR }, encoding: 'utf8' });
    report.checks.exportCommand = { cmd: `node tools/serve.js --open --export-leaderboard ${path.relative(ROOT, exp)}`, exit: r.status, stdout: r.stdout.trim().split(DATA_DIR).join('$DATA_DIR').split(ROOT).join('.') };
  }
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

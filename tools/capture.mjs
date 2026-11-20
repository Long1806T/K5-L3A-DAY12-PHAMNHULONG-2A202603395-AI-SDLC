#!/usr/bin/env node
// Plays the browser build in headless Chrome and saves screenshots + a JSON
// report of what the page's own game state said at each step.
// Dev-only: needs Playwright (npm i -g playwright) and Chrome/Chromium.
//   node tools/capture.mjs [--out docs/proof/phase-1/screens]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outArg = process.argv.indexOf('--out');
const OUT = path.resolve(ROOT, outArg !== -1 ? process.argv[outArg + 1] : 'docs/proof/phase-1/screens');
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
    srv.stdout.on('data', (d) => {
      if (String(d).includes('http://')) resolve(srv);
    });
    srv.on('error', reject);
    setTimeout(() => reject(new Error('server did not start')), 8000);
  });

const { chromium } = loadPlaywright();
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({
  executablePath: ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p)),
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});

const report = { when: new Date().toISOString(), viewport: '1280x720', shots: [] };
const state = () => page.evaluate(() => ({ mode: window.__DDL.mode, ...window.__DDL.snapshot(), result: window.__DDL.world.result }));
const shot = async (name, what) => {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  const s = await state();
  report.shots.push({ file: path.relative(ROOT, file), what, mode: s.mode, tick: s.tick, state: s.state, score: s.score, flames: s.player.flames, carried: s.player.carried, lit: s.lanterns.filter((l) => l.lit).map((l) => l.id), result: s.result });
  console.log(`saved ${path.relative(ROOT, file)} (tick ${s.tick}, ${s.state})`);
  return s;
};
const open = async (query) => {
  await page.goto(`http://localhost:${PORT}/${query}`);
  await page.waitForFunction(() => window.__DDL && window.__DDL.world);
  await page.waitForTimeout(600);
};
const hold = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
};

try {
  // 1. Title screen
  await open('?seed=7');
  await shot('01-title', 'Màn hình mở đầu: tên game, Đêm 1, điều khiển');

  // 2. Start and walk toward L1 (camera behind Mây)
  await page.keyboard.press('Enter');
  await hold('KeyW', 1800);
  await page.waitForTimeout(300);
  await shot('02-playing', 'Đang chơi: Mây đội nón lá có đèn, đom đóm, Bóng Mực, HUD');

  // 3. Lighting the last lantern → win screen (scenario: L2..L5 already lit)
  await open('?seed=1&scenario=scenarios/phase1/win-last-lantern.scenario.json');
  await page.keyboard.press('Enter');
  await hold('KeyW', 450);
  await page.waitForTimeout(250);
  await shot('03-before-last-lantern', 'Đứng cạnh L1 với 5 đom đóm, các đèn khác đã sáng (đảo sáng lên)');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(1200);
  await shot('04-won', 'Nạp ánh sáng vào L1 → thắng, màn hình kết quả + điểm');

  // 4. Replay after winning
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500);
  await shot('05-replay', 'Chơi lại sau khi thắng (Enter)');

  // 5. Pulse stuns nearby shades
  await open('?seed=1&scenario=scenarios/phase1/pulse.scenario.json');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(150);
  await shot('06-pulse', 'Tỏa sáng: vòng sáng, Bóng Mực trong bán kính bị choáng và đẩy lùi');

  // 6. Shade keeps hitting an idle player → lose screen
  await open('?seed=1&scenario=scenarios/phase1/shade-hits.scenario.json');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__DDL.world.state !== 'playing', null, { timeout: 20000 });
  await page.waitForTimeout(400);
  await shot('07-lost', 'Bị Bóng Mực chạm 3 lần → thua (no_flames)');

  // 7. Safe zone: shades wait at the edge of a lantern's ring
  await open('?seed=1&scenario=scenarios/phase1/safe-zone.scenario.json');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(5000);
  await shot('08-safe-zone', 'Đứng trong vùng an toàn của L1: Bóng Mực dừng ở mép vòng');
} finally {
  report.problems = problems;
  fs.writeFileSync(path.join(OUT, 'capture-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  server.kill();
}
if (problems.length) {
  console.error('page problems:\n' + problems.join('\n'));
  process.exitCode = 1;
}

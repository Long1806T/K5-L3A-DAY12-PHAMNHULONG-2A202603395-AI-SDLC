// Benchmark page (Ticket-04 §1): index.html?bench=1&seed=42&duration=30.
// Same renderer, scene, lights, effects and HUD as the game; only the world
// (src/web/bench-lib.js) and the camera path differ. Reports to tools/bench.js
// through POST /__bench when that runner serves the page; otherwise it just
// shows the numbers on screen.
import { createWorld, step, TICK_RATE } from '../core/sim.js';
import { getNight } from '../core/level.js';
import { validateScenario } from '../core/validate.js';
import { Renderer } from './renderer.js';
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { BENCH, benchScenario, benchTuning, benchCamera, benchStats } from './bench-lib.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const seed = params.get('seed') ?? '42';
const duration = Number(params.get('duration') ?? 30);
// only tools/bench.js (which adds report=1) listens for results
const post = (body) => params.has('report') && fetch('/__bench', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});

const contract = await (await fetch('game.contract.json', { cache: 'no-store' })).json();
const level = getNight(1);
const scenario = validateScenario(benchScenario(seed, level), level.lanterns.map((l) => l.id));
const world = createWorld({ tuning: benchTuning(contract.tuning), night: 1, seed, scenario });

const canvas = $('view');
const renderer = new Renderer(canvas);
// fixed 1280×720 drawing buffer whatever the window decorations or device pixel ratio
renderer.resize = function resize() {
  if (canvas.width !== BENCH.width || canvas.height !== BENCH.height) {
    canvas.width = BENCH.width;
    canvas.height = BENCH.height;
  }
  this.gl.viewport(0, 0, BENCH.width, BENCH.height);
  return BENCH.width / BENCH.height;
};
const scene = new Scene(renderer);
const hud = new Hud(contract.tuning);
$('seed').textContent = `Benchmark · seed ${seed} · ${BENCH.shades} Bóng Mực · ${BENCH.motes} đom đóm`;

const gl = renderer.gl;
const dbg = gl.getExtension('WEBGL_debug_renderer_info');
const gpu = dbg ? `${gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)} / ${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}` : gl.getParameter(gl.RENDERER);
const idle = { move: [0, 0], cam_yaw_deg: 0 };

let first = null;
let prev = null;
let windowStart = null;
let acc = 0;
const dts = [];
const cpu = []; // JS time spent per frame on simulation + drawing (ms)

function frame(ts) {
  if (first === null) {
    first = ts;
    post({ type: 'first_frame', epoch_ms: performance.timeOrigin + ts });
  }
  const dtS = prev === null ? 0 : Math.min(0.25, (ts - prev) / 1000);
  acc += dtS;
  while (acc >= 1 / TICK_RATE) {
    acc -= 1 / TICK_RATE;
    step(world, idle);
  }
  const t = (ts - first) / 1000;
  const c0 = performance.now();
  const view = scene.draw(world, benchCamera(t), [], ts / 1000, renderer.resize());
  hud.update(world, ts / 1000, view);
  // the night never ends here, so the clock shows the bench phase instead of "time to dawn"
  hud.set('clock', t < BENCH.warmupS ? `KHỞI ĐỘNG ${Math.ceil(BENCH.warmupS - t)} s` : `ĐO ${Math.min(duration, Math.floor(t - BENCH.warmupS))}/${duration} s`);
  const cpuMs = performance.now() - c0;

  if (windowStart === null && t >= BENCH.warmupS) {
    windowStart = ts;
    post({ type: 'measure_start' });
  } else if (windowStart !== null) {
    dts.push(ts - prev);
    cpu.push(cpuMs);
    if (ts - windowStart >= duration * 1000) {
      prev = ts;
      finish();
      return;
    }
  }
  prev = ts;
  requestAnimationFrame(frame);
}

function finish() {
  const stats = benchStats(dts);
  const sorted = [...cpu].sort((a, b) => a - b);
  const cpuStats = { cpu_ms_avg: Math.round((cpu.reduce((a, b) => a + b, 0) / Math.max(1, cpu.length)) * 100) / 100, cpu_ms_p95: Math.round((sorted[Math.max(0, Math.ceil(0.95 * sorted.length) - 1)] ?? 0) * 100) / 100 };
  const info = { ...cpuStats, gpu, user_agent: navigator.userAgent, inner: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio, canvas: `${canvas.width}x${canvas.height}`, shades: world.shades.length, motes: world.motes.length, lit: world.lanterns.filter((l) => l.lit).length, state: world.state };
  post({ type: 'result', seed, duration, dts, stats, info });
  $('overlay').innerHTML = `<div class="panel"><h1>Benchmark xong</h1><p class="big">${stats.avg_fps} FPS</p>
    <p class="small">1 % thấp ${stats.p1_low_fps} FPS · p95 ${stats.frame_ms_p95} ms · ${stats.frames} khung · ${gpu}</p></div>`;
  $('overlay').classList.add('show');
}

requestAnimationFrame(frame);
window.__BENCH = { world, dts, get first() { return first; } };

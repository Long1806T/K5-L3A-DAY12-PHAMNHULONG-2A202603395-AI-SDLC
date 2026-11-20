// Browser entry: same core as headless, fixed 60 ticks/s, render as fast as the display.

import { createWorld, step, snapshot, TICK_RATE } from '../core/sim.js';
import { getNight } from '../core/level.js';
import { validateScenario } from '../core/validate.js';
import { Renderer } from './renderer.js';
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { Controls } from './controls.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const contract = await (await fetch('game.contract.json', { cache: 'no-store' })).json();
const tuning = contract.tuning;
const level = getNight(1);
let scenario = null;
if (params.get('scenario')) {
  const doc = await (await fetch(params.get('scenario'), { cache: 'no-store' })).json();
  scenario = validateScenario(doc, level.lanterns.map((l) => l.id));
}
const fixedSeed = params.get('seed');
// Picking a seed is the only browser-side randomness; the game itself is seeded.
const newSeed = () => fixedSeed ?? String(Math.floor(Math.random() * 1e9));

const canvas = $('view');
let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  $('overlay').innerHTML = `<div class="panel"><h1>Không mở được WebGL</h1><p>${e.message}</p></div>`;
  throw e;
}
const scene = new Scene(renderer, level, tuning);
const hud = new Hud(tuning);
const controls = new Controls(canvas);

let world;
let mode = 'title'; // title | playing | paused | ended
let acc = 0;
let last = performance.now();
let fx = [];
let camTarget = [0, 0, 0];
let shake = 0;

function reset() {
  world = createWorld({ tuning, night: 1, seed: newSeed(), scenario });
  fx = [];
  acc = 0;
  camTarget = [...world.player.pos];
  controls.yawDeg = 0;
  $('seed').textContent = `seed ${world.seed}`;
}

function showOverlay(html) {
  $('overlay').innerHTML = html ? `<div class="panel">${html}</div>` : '';
  $('overlay').classList.toggle('show', Boolean(html));
}

const CONTROLS_HTML = `
  <table class="keys">
    <tr><td><kbd>W A S D</kbd></td><td>đi lại (theo hướng camera)</td></tr>
    <tr><td><kbd>Space</kbd></td><td>nhảy</td></tr>
    <tr><td><kbd>E</kbd></td><td>nạp ánh sáng vào Đèn Lồng Lớn</td></tr>
    <tr><td><kbd>F</kbd> / chuột phải</td><td>tỏa sáng xua Bóng Mực (tốn ${tuning.pulse_cost} đom đóm)</td></tr>
    <tr><td>kéo chuột / <kbd>←</kbd> <kbd>→</kbd></td><td>xoay camera · lăn chuột: zoom</td></tr>
    <tr><td><kbd>P</kbd></td><td>tạm dừng · <kbd>R</kbd> chơi lại</td></tr>
  </table>`;

function title() {
  mode = 'title';
  showOverlay(`
    <h1>Đảo Đèn Lồng</h1>
    <p class="sub">${level.name}</p>
    <p>Sương đen đã nuốt ánh sáng của đảo. Hãy giúp <b>Mây</b> gom đom đóm và thắp lại
    <b>${level.lanterns.length} Đèn Lồng Lớn</b> trước bình minh. Tránh <span class="ink">Bóng Mực</span>:
    chúng sợ ánh đèn.</p>
    ${CONTROLS_HTML}
    <button id="go">Bắt đầu (Enter)</button>`);
  $('go').onclick = start;
}

function start() {
  if (mode === 'ended' || mode === 'title') reset();
  mode = 'playing';
  showOverlay('');
  last = performance.now();
}

function end() {
  mode = 'ended';
  const r = world.result;
  const won = r.result === 'won';
  const reason = { all_lit: 'Cả 5 Đèn Lồng Lớn đã sáng. Đảo Bến ấm áp trở lại!', dawn: 'Bình minh đến mà đảo vẫn chưa đủ đèn sáng.', no_flames: 'Mây đã hết lửa trong sương đen.' }[r.reason];
  const s = world.stats;
  showOverlay(`
    <h1 class="${won ? 'won' : 'lost'}">${won ? 'Thắng rồi!' : 'Thua rồi'}</h1>
    <p>${reason}</p>
    <p class="big">${world.score} điểm</p>
    <p class="small">Đom đóm nhặt ${s.motesPicked} · Đèn thắp ${s.lanternsLit} · Bóng Mực bị choáng ${s.stuns} · Lửa còn ${world.player.flames}</p>
    <button id="again">Chơi lại (R / Enter)</button>`);
  $('again').onclick = start;
}

controls.onKey = (code) => {
  if (code === 'Enter' && mode !== 'playing') start();
  else if (code === 'KeyR' && mode !== 'title') {
    mode = 'ended';
    start();
  } else if ((code === 'KeyP' || code === 'Escape') && (mode === 'playing' || mode === 'paused')) {
    mode = mode === 'playing' ? 'paused' : 'playing';
    showOverlay(mode === 'paused' ? `<h1>Tạm dừng</h1>${CONTROLS_HTML}<p class="small">Nhấn P để chơi tiếp</p>` : '');
    last = performance.now();
  }
};

function handle(events, now) {
  const p = world.player;
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked':
        fx.push({ kind: 'spark', pos: [p.pos[0], 1.0, p.pos[2]], color: [0.9, 0.8, 0.3], left: 1, dur: 0.4 });
        break;
      case 'deposit': {
        const L = world.lanterns.find((l) => l.id === e.data.lantern_id);
        fx.push({ kind: 'spark', pos: [L.pos[0], 4.2, L.pos[2]], color: [1, 0.6, 0.2], left: 1, dur: 0.7 });
        break;
      }
      case 'lantern_lit':
        hud.toast(`Đèn ${e.data.lantern_id} đã sáng!`, now);
        hud.flash('rgba(255,170,80,0.35)');
        break;
      case 'pulse':
        fx.push({ kind: 'pulse', pos: [...p.pos], left: 1, dur: 0.8 });
        if (e.data.stunned_ids.length) hud.toast(`Xua được ${e.data.stunned_ids.length} Bóng Mực`, now, 1.2);
        break;
      case 'player_hit':
        hud.flash('rgba(90,20,120,0.55)');
        shake = 0.35;
        hud.toast(e.data.dropped ? `Bị chạm! Rơi mất ${e.data.dropped} đom đóm` : 'Bị chạm!', now, 1.4);
        break;
      case 'shade_spawned':
        hud.toast('Một Bóng Mực trồi lên từ sương đen…', now, 1.8);
        break;
      default:
        break;
    }
  }
}

function frame(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.min(0.25, (nowMs - last) / 1000);
  last = nowMs;
  if (mode === 'playing') {
    acc += dt;
    while (acc >= 1 / TICK_RATE && mode === 'playing') {
      acc -= 1 / TICK_RATE;
      handle(step(world, controls.sample()), now);
      if (world.state !== 'playing') end();
    }
  }
  for (const e of fx) e.left -= dt / e.dur;
  fx = fx.filter((e) => e.left > 0);
  const k = 1 - Math.exp(-dt * 10);
  for (let i = 0; i < 3; i++) camTarget[i] += (world.player.pos[i] - camTarget[i]) * k;
  shake = Math.max(0, shake - dt);
  const sx = shake ? (Math.random() - 0.5) * shake * 0.6 : 0;
  const aspect = renderer.resize();
  scene.draw(world, { yawDeg: controls.yawDeg, dist: controls.dist, target: [camTarget[0] + sx, camTarget[1], camTarget[2]] }, fx, now, aspect);
  hud.update(world, now);
  requestAnimationFrame(frame);
}

reset();
title();
requestAnimationFrame(frame);

// Hooks for automated checks (tools/capture.mjs). Read-only views of the game.
window.__DDL = {
  get mode() { return mode; },
  get world() { return world; },
  snapshot: () => snapshot(world),
  start,
};

// Browser entry: menus and the 3-night chain around the same core the
// headless runner uses (fixed 60 ticks/s, render as fast as the display).

import { createWorld, step, snapshot, TICK_RATE, windAt, timeLeftExact } from '../core/sim.js';
import { getNight } from '../core/level.js';
import { validateScenario } from '../core/validate.js';
import { Renderer } from './renderer.js';
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { Controls } from './controls.js';
import { GameAudio } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const contract = await (await fetch('game.contract.json', { cache: 'no-store' })).json();
const tuning = contract.tuning;
const fixedSeed = params.get('seed');
const newSeed = () => fixedSeed ?? String(Math.floor(Math.random() * 1e9)); // seed choice only; the game itself is seeded

const STORY = {
  1: ['Đảo Bến', 'Mây ơi, sương đen nuốt mất bến thuyền rồi. Con gom đom đóm, thắp lại năm Đèn Lồng Lớn nhé. Bóng Mực sợ ánh đèn đã sáng.'],
  2: ['Đảo Cau', 'Hai đảo cau nối nhau bằng cây cầu tre, không có lan can đâu con. Bục nhảy sẽ đưa con qua biển mây. Coi chừng Gió Lạc, chúng mê đom đóm lắm.'],
  3: ['Đảo Chuông', 'Đảo Chuông có ba tầng, tháp chuông ở giữa. Gió mạnh thổi từng cơn: thấy lá bay là gió sắp tới. Thắp đủ bảy ngọn đèn là bình minh về.'],
};

const canvas = $('view');
let renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  $('overlay').innerHTML = `<div class="panel"><h1>Không mở được WebGL</h1><p>${e.message}</p></div>`;
  $('overlay').classList.add('show');
  throw e;
}
const scene = new Scene(renderer);
const hud = new Hud(tuning);
const controls = new Controls(canvas);
const audio = new GameAudio();
const settings = loadSettings();
const applySettings = () => {
  audio.setVolume(settings.volume);
  controls.sensitivity = settings.sensitivity;
};
applySettings();

let pendingScenario = null;
const scenarioNight = Number(params.get('night') || 1);
if (params.get('scenario')) {
  const doc = await (await fetch(params.get('scenario'), { cache: 'no-store' })).json();
  pendingScenario = validateScenario(doc, getNight(scenarioNight).lanterns.map((l) => l.id));
}

const campaign = { night: 1, total: 0, won: [] };
let world = null;
let mode = 'menu'; // menu | intro | playing | paused | result | dawn
let back = null; // screen to return to from settings
let acc = 0;
let last = performance.now();
let fx = [];
let camTarget = [0, 0, 0];
let shake = 0;
let lastView = null;
let lastCountdown = -1;
let windWarned = false;
let jumps = 0;
const frameTimes = [];
const cpuTimes = [];

function newWorld(night) {
  const scenario = pendingScenario && night === scenarioNight ? pendingScenario : null;
  world = createWorld({ tuning, night, seed: newSeed(), scenario });
  fx = [];
  acc = 0;
  camTarget = [...world.player.pos];
  controls.yawDeg = Number(params.get('yaw') || 0);
  lastCountdown = -1;
  windWarned = false;
  jumps = 0;
  $('seed').textContent = `Đêm ${night} · seed ${world.seed}`;
}

function overlay(html) {
  $('overlay').innerHTML = html ? `<div class="panel">${html}</div>` : '';
  $('overlay').classList.toggle('show', Boolean(html));
  for (const b of $('overlay').querySelectorAll('[data-act]')) b.onclick = () => act(b.dataset.act);
}

const CONTROLS_HTML = `
  <table class="keys">
    <tr><td><kbd>W A S D</kbd></td><td>đi lại theo hướng camera</td></tr>
    <tr><td><kbd>Space</kbd> · <kbd>Shift</kbd></td><td>nhảy · lướt</td></tr>
    <tr><td><kbd>E</kbd></td><td>nạp ánh sáng vào Đèn Lồng Lớn</td></tr>
    <tr><td><kbd>F</kbd> / chuột phải</td><td>tỏa sáng xua Bóng Mực (tốn ${tuning.pulse_cost} đom đóm)</td></tr>
    <tr><td>kéo chuột · <kbd>←</kbd><kbd>→</kbd></td><td>xoay camera · lăn chuột: zoom</td></tr>
    <tr><td><kbd>Esc</kbd> / <kbd>P</kbd></td><td>tạm dừng</td></tr>
  </table>`;

function showMenu() {
  mode = 'menu';
  audio.stopMusic();
  newWorld(1);
  overlay(`
    <h1>Đảo Đèn Lồng</h1>
    <p class="sub">Ba đêm, ba hòn đảo, một người giữ đèn nhỏ tuổi.</p>
    <div class="menu">
      <button data-act="play">Chơi từ Đêm 1</button>
      <div class="row"><button class="ghost" data-act="pick1">Đêm 1</button><button class="ghost" data-act="pick2">Đêm 2</button><button class="ghost" data-act="pick3">Đêm 3</button></div>
      <button class="ghost" data-act="settings">Cài đặt</button>
      <button class="ghost" data-act="help">Điều khiển</button>
    </div>`);
}

function showIntro(night) {
  mode = 'intro';
  campaign.night = night;
  newWorld(night);
  const [name, words] = STORY[night];
  overlay(`
    <p class="sub">Đêm ${night}</p>
    <h1>${name}</h1>
    <div class="story"><b>Ông Đăng:</b> “${words}”</div>
    <p class="small">${world.lanterns.length} Đèn Lồng Lớn · ${Math.round(timeLeftExact(world) / 6) / 10} phút tới bình minh</p>
    <button data-act="start">Bắt đầu (Enter)</button>`);
}

function startNight() {
  audio.unlock();
  audio.startMusic();
  mode = 'playing';
  overlay('');
  last = performance.now();
}

function pauseGame() {
  if (mode !== 'playing') return;
  handle(step(world, { move: [0, 0], cam_yaw_deg: controls.yawDeg, pause: true }), performance.now() / 1000);
  mode = 'paused';
  showPause();
}

function showPause() {
  overlay(`
    <h1>Tạm dừng</h1>
    <div class="menu">
      <button data-act="resume">Tiếp tục</button>
      <button class="ghost" data-act="restart">Chơi lại Đêm</button>
      <button class="ghost" data-act="settings">Cài đặt</button>
      <button class="ghost" data-act="menu">Về menu</button>
    </div>${CONTROLS_HTML}`);
}

function resumeGame() {
  step(world, { move: [0, 0], cam_yaw_deg: controls.yawDeg, pause: false });
  handle(step(world, { move: [0, 0], cam_yaw_deg: controls.yawDeg, pause: true }), performance.now() / 1000);
  mode = 'playing';
  overlay('');
  last = performance.now();
}

function showSettings() {
  back = mode === 'paused' ? showPause : showMenu;
  overlay(`
    <h1>Cài đặt</h1>
    <label class="field">Âm lượng <input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"><output id="volv">${Math.round(settings.volume * 100)}</output></label>
    <label class="field">Độ nhạy chuột <input id="sens" type="range" min="20" max="300" value="${Math.round(settings.sensitivity * 100)}"><output id="sensv">${settings.sensitivity.toFixed(2)}</output></label>
    <p class="small">Cài đặt được lưu tự động và giữ cho lần mở sau.</p>
    <button data-act="back">Xong</button>`);
  $('vol').oninput = (e) => {
    settings.volume = Number(e.target.value) / 100;
    $('volv').textContent = e.target.value;
    applySettings();
    saveSettings(settings);
    audio.unlock();
    audio.play('click');
  };
  $('sens').oninput = (e) => {
    settings.sensitivity = Number(e.target.value) / 100;
    $('sensv').textContent = settings.sensitivity.toFixed(2);
    applySettings();
    saveSettings(settings);
  };
}

function endNight() {
  mode = 'result';
  const r = world.result;
  const won = r.result === 'won';
  audio.play(won ? 'win' : 'lose');
  if (won) {
    campaign.total += world.score;
    campaign.won.push(world.night);
  }
  const reason = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng!', dawn_survived: 'Mây trụ được tới bình minh, đảo vẫn sáng.', dawn: 'Bình minh tới mà đảo chưa đủ đèn sáng.', no_flames: 'Mây đã hết Ngọn Lửa.' }[r.reason] || r.reason;
  const s = world.stats;
  const lastNight = world.night === 3;
  overlay(`
    <p class="sub">Đêm ${world.night} · ${STORY[world.night][0]}</p>
    <h1 class="${won ? 'won' : 'lost'}">${won ? 'Thắng Đêm!' : 'Thua Đêm'}</h1>
    <p>${reason}</p>
    <p class="big">${world.score} điểm</p>
    <p class="small">Đom đóm nạp ${s.motesDeposited} · Đèn thắp ${s.lanternsLit} · Trúng Tỏa Sáng ${s.stuns} · Lửa còn ${world.player.flames}</p>
    <p class="small">Tổng điểm các Đêm đã thắng: <b class="gold">${campaign.total}</b></p>
    <div class="menu">
      ${won ? `<button data-act="${lastNight ? 'dawn' : 'next'}">${lastNight ? 'Đón Bình Minh' : `Sang Đêm ${world.night + 1}`}</button>` : '<button data-act="restart">Chơi lại Đêm</button>'}
      <button class="ghost" data-act="menu">Về menu</button>
    </div>`);
}

function showDawn() {
  mode = 'dawn';
  audio.stopMusic();
  overlay(`
    <h1 class="dawn">Bình Minh</h1>
    <p>Ba hòn đảo đã sáng đèn trở lại. Ông Đăng mỉm cười: “Giỏi lắm, người giữ đèn.”</p>
    <p class="big">${campaign.total} điểm</p>
    <p class="small">Đêm đã thắng: ${campaign.won.join(', ')}</p>
    <button data-act="menu">Về menu</button>`);
}

function act(a) {
  audio.unlock();
  audio.play('click');
  if (a === 'play' || a.startsWith('pick')) {
    campaign.total = 0;
    campaign.won = [];
    showIntro(a === 'play' ? 1 : Number(a.slice(4)));
  } else if (a === 'start') startNight();
  else if (a === 'resume') resumeGame();
  else if (a === 'restart') showIntro(campaign.night);
  else if (a === 'next') showIntro(campaign.night + 1);
  else if (a === 'dawn') showDawn();
  else if (a === 'menu') showMenu();
  else if (a === 'settings') showSettings();
  else if (a === 'back') (back || showMenu)();
  else if (a === 'help') overlay(`<h1>Điều khiển</h1>${CONTROLS_HTML}<button data-act="menu">Quay lại</button>`);
}

controls.onKey = (code) => {
  if (code === 'Enter') {
    const btn = $('overlay').querySelector('button');
    if (mode !== 'playing' && btn && document.activeElement?.tagName !== 'BUTTON') btn.click();
  } else if (code === 'Escape' || code === 'KeyP') {
    if (mode === 'playing') pauseGame();
    else if (mode === 'paused') resumeGame();
  }
};

function handle(events, now) {
  const p = world.player;
  for (const e of events) {
    switch (e.name) {
      case 'mote_picked':
        audio.play('pickup');
        fx.push({ kind: 'spark', pos: [p.pos[0], p.pos[1] + 1, p.pos[2]], color: [0.9, 0.8, 0.3], left: 1, dur: 0.4 });
        break;
      case 'deposit': {
        audio.play('deposit');
        const L = world.lanterns.find((l) => l.id === e.data.lantern_id);
        fx.push({ kind: 'spark', pos: [L.pos[0], L.pos[1] + 4.2, L.pos[2]], color: [1, 0.6, 0.2], left: 1, dur: 0.7 });
        break;
      }
      case 'lantern_lit':
        audio.play('lit');
        hud.toast(`Đèn ${e.data.lantern_id} đã sáng!`, now);
        hud.flash('rgba(255,179,71,0.3)');
        break;
      case 'pulse':
        audio.play('pulse');
        fx.push({ kind: 'pulse', pos: [...p.pos], left: 1, dur: 0.8 });
        break;
      case 'player_hit':
        audio.play('hit');
        hud.flash('rgba(90,20,140,0.5)');
        shake = 0.35;
        hud.toast(e.data.by === 'fall' ? 'Rơi khỏi đảo! Mất hết đom đóm.' : e.data.dropped ? `Bị chạm! Rơi ${e.data.dropped} đom đóm` : 'Bị chạm!', now, 1.6);
        break;
      case 'shade_spawned':
        audio.play('shade');
        hud.toast('Bóng Mực xuất hiện!', now, 1.6);
        break;
      case 'dash':
        audio.play('dash');
        break;
      case 'charm_picked':
        audio.play('charm');
        hud.toast('Bùa Gió: chạy nhanh hơn, lướt không cần hồi chiêu (10 s)', now, 2.4);
        break;
      case 'drifter_steal':
        audio.play('steal');
        hud.toast(`Gió Lạc cướp ${e.data.amount} đom đóm!`, now, 1.8);
        break;
      case 'drifter_drop':
        hud.toast(`Gió Lạc đánh rơi ${e.data.amount} đom đóm`, now, 1.8);
        break;
      default:
        break;
    }
  }
  if (world.stats.jumps !== jumps) {
    jumps = world.stats.jumps;
    audio.play('jump');
  }
  const tl = timeLeftExact(world);
  if (tl <= 10 && tl > 0 && Math.ceil(tl) !== lastCountdown) {
    lastCountdown = Math.ceil(tl);
    audio.play('countdown');
  }
  const wind = windAt(world);
  if (wind.warn && !windWarned) {
    windWarned = true;
    audio.play('wind');
    hud.toast('Gió sắp thổi!', now, 2);
  }
  if (!wind.warn) windWarned = false;
}

function fps() {
  const n = Math.min(frameTimes.length, 120);
  const s = frameTimes.slice(-n).reduce((a, b) => a + b, 0);
  return n && s ? (1000 * n) / s : 0;
}

function frame(nowMs) {
  const now = nowMs / 1000;
  const dt = Math.min(0.25, (nowMs - last) / 1000);
  frameTimes.push(nowMs - last);
  if (frameTimes.length > 600) frameTimes.shift();
  last = nowMs;
  if (mode === 'playing') {
    acc += dt;
    while (acc >= 1 / TICK_RATE && mode === 'playing') {
      acc -= 1 / TICK_RATE;
      handle(step(world, controls.sample()), now);
      if (world.state !== 'playing') endNight();
    }
  }
  for (const e of fx) e.left -= dt / e.dur;
  fx = fx.filter((e) => e.left > 0);
  const k = 1 - Math.exp(-dt * 10);
  for (let i = 0; i < 3; i++) camTarget[i] += (world.player.pos[i] - camTarget[i]) * k;
  shake = Math.max(0, shake - dt);
  const sx = shake && !hud.reducedMotion ? (Math.random() - 0.5) * shake * 0.6 : 0;
  const cpu0 = performance.now();
  const aspect = renderer.resize();
  const orbit = mode === 'menu' ? { eye: [Math.cos(now * 0.1) * 55, 26, Math.sin(now * 0.1) * 55], target: [0, 0, 0] } : null;
  lastView = scene.draw(world, orbit || { yawDeg: controls.yawDeg, dist: controls.dist, target: [camTarget[0] + sx, camTarget[1], camTarget[2]] }, fx, now, aspect);
  hud.update(world, now, lastView);
  audio.update();
  cpuTimes.push(performance.now() - cpu0);
  if (cpuTimes.length > 600) cpuTimes.shift();
  if (params.get('fps')) $('fps').textContent = `${fps().toFixed(0)} FPS`;
  requestAnimationFrame(frame);
}

if (params.get('autostart')) {
  showIntro(scenarioNight);
  startNight();
} else {
  showMenu();
}
requestAnimationFrame(frame);

// Hooks for automated checks (tools/capture.mjs). Read-only views of the game.
window.__DDL = {
  get mode() { return mode; },
  get world() { return world; },
  get campaign() { return campaign; },
  get audioPlayed() { return { ...audio.played }; },
  get settings() { return { ...settings }; },
  frameTimes: () => [...frameTimes],
  cpuTimes: () => [...cpuTimes],
  snapshot: () => snapshot(world),
  act,
  // ?debug=1 only: run n ticks with no input (used to reach the wind gust in screenshots)
  advance: (n) => {
    if (!params.get('debug')) return false;
    for (let i = 0; i < n && world.state === 'playing'; i++) handle(step(world, { move: [0, 0], cam_yaw_deg: controls.yawDeg }), performance.now() / 1000);
    return true;
  },
};

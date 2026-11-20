// Browser entry: menus and the 3-night chain around the same core the
// headless runner uses (fixed 60 ticks/s, render as fast as the display).

import { createWorld, step, snapshot, TICK_RATE, windAt, timeLeftExact, isWeak, fuelValue } from '../core/sim.js';
import { getNight } from '../core/level.js';
import { validateScenario, validateInputs } from '../core/validate.js';
import { createInputTimeline } from '../core/inputs.js';
import { Renderer } from './renderer.js';
import { Scene } from './scene.js';
import { Hud } from './hud.js';
import { Controls } from './controls.js';
import { GameAudio } from './audio.js';
import { loadSettings, saveSettings, DEFAULT_KEYS, ACTIONS, RESERVED_KEYS, keyLabel, keyConflict } from './settings.js';
import { validateName, insertEntry, normalizeBoard, isoLocal, seedValue } from './leaderboard.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const contract = await (await fetch('game.contract.json', { cache: 'no-store' })).json();
const tuning = contract.tuning;
const fixedSeed = params.get('seed');
const newSeed = () => fixedSeed ?? String(Math.floor(Math.random() * 1e9)); // seed choice only; the game itself is seeded

const STORY = {
  1: ['Đảo Bến', 'Mây ơi, sương đen nuốt mất bến thuyền rồi. Con gom đom đóm thắp đèn, và nhớ châm dầu: đèn cạn là tắt. Giữ cho đảo sáng tới bình minh nhé.'],
  2: ['Đảo Cau', 'Hai đảo cau nối nhau bằng cây cầu tre, không có lan can đâu con. Bục nhảy sẽ đưa con qua biển mây. Coi chừng Gió Lạc, chúng mê đom đóm lắm.'],
  3: ['Đảo Chuông', 'Đảo Chuông có ba tầng, tháp chuông ở giữa. Gió mạnh thổi từng cơn: thấy lá bay là gió sắp tới. Giữ ít nhất năm ngọn đèn sáng tới bình minh nhé.'],
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
  controls.keymap = settings.keys;
  scene.options.colorBlind = settings.colorBlind;
  document.body.classList.toggle('cb', settings.colorBlind);
  hud.keys = settings.keys;
  hud.reducedMotion = settings.reducedMotion;
  hud.subtitlesOn = settings.subtitles;
  document.documentElement.style.setProperty('--ui-scale', settings.largeText ? '1.25' : '1');
};
const persist = () => {
  applySettings();
  saveSettings(settings);
};
applySettings();

let pendingScenario = null;
const scenarioNight = Number(params.get('night') || 1);
if (params.get('scenario')) {
  const doc = await (await fetch(params.get('scenario'), { cache: 'no-store' })).json();
  pendingScenario = validateScenario(doc, getNight(scenarioNight).lanterns.map((l) => l.id));
}

// ?demo=1 (tools/demo.mjs): no animation loop; the video tool calls __DDL.frame(ms) with a virtual clock.
// ?replay=<inputs.json>: inputs come from a recorded file (e.g. the autopilot) instead of the keyboard.
const DEMO = params.has('demo');
let replayAt = null;
if (params.get('replay')) {
  const doc = await (await fetch(params.get('replay'), { cache: 'no-store' })).json();
  replayAt = createInputTimeline(validateInputs(doc));
}
let demoYaw = Number(params.get('yaw') || 0);

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
let last10 = false;
let weakSeen = new Set();
let scoreSaved = false;
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
  if (params.get('dist')) controls.dist = Math.min(18, Math.max(5, Number(params.get('dist')))); // dev: camera distance
  lastCountdown = -1;
  windWarned = false;
  last10 = false;
  weakSeen = new Set();
  jumps = 0;
  $('seed').textContent = `Đêm ${night} · seed ${world.seed}`;
}

function overlay(html) {
  controls.capture = null; // leaving the key-remap screen never leaves a key grab behind
  $('overlay').innerHTML = html ? `<div class="panel">${html}</div>` : '';
  $('overlay').classList.toggle('show', Boolean(html));
  for (const b of $('overlay').querySelectorAll('[data-act]')) b.onclick = () => act(b.dataset.act);
}

const K = (a) => `<kbd>${keyLabel(settings.keys[a])}</kbd>`;
const controlsHtml = () => `
  <table class="keys">
    <tr><td>${K('up')} ${K('left')} ${K('down')} ${K('right')}</td><td>đi lại theo hướng camera</td></tr>
    <tr><td>${K('jump')} · ${K('dash')}</td><td>nhảy · lướt</td></tr>
    <tr><td>${K('interact')}</td><td>thắp đèn, châm dầu, thắp lại đèn đã tắt</td></tr>
    <tr><td>${K('pulse')} / chuột phải</td><td>tỏa sáng xua Bóng Mực (tốn ${tuning.pulse_cost} đom đóm)</td></tr>
    <tr><td>kéo chuột · ${K('camLeft')}${K('camRight')}</td><td>xoay camera · lăn chuột: zoom</td></tr>
    <tr><td><kbd>Esc</kbd> / ${K('pause')}</td><td>tạm dừng</td></tr>
  </table>
  <p class="small">Đổi phím trong Cài đặt → Đổi phím.</p>`;

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
      <button class="ghost" data-act="board">Bảng xếp hạng</button>
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
    <p class="small">${world.lanterns.length} Đèn Lồng Lớn · giữ ít nhất ${Math.ceil(tuning.win_ratio * world.lanterns.length - 1e-9)} đèn sáng tới bình minh (${Math.round(timeLeftExact(world) / 6) / 10} phút). Đèn cạn dầu sẽ tắt; Bóng Mực hút dầu đèn yếu.</p>
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
    </div>${controlsHtml()}`);
}

function resumeGame() {
  step(world, { move: [0, 0], cam_yaw_deg: controls.yawDeg, pause: false });
  handle(step(world, { move: [0, 0], cam_yaw_deg: controls.yawDeg, pause: true }), performance.now() / 1000);
  mode = 'playing';
  overlay('');
  last = performance.now();
}

function showSettings() {
  if (mode !== 'settings') back = mode === 'paused' ? showPause : showMenu;
  const resumeMode = mode === 'paused' ? 'paused' : 'menu';
  overlay(`
    <h1>Cài đặt</h1>
    <label class="field">Âm lượng <input id="vol" type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}"><output id="volv">${Math.round(settings.volume * 100)}</output></label>
    <label class="field">Độ nhạy chuột <input id="sens" type="range" min="20" max="300" value="${Math.round(settings.sensitivity * 100)}"><output id="sensv">${settings.sensitivity.toFixed(2)}</output></label>
    <label class="field">Bảng màu dễ phân biệt <input id="cb" type="checkbox" ${settings.colorBlind ? 'checked' : ''}></label>
    <label class="field">Phụ đề và chỉ báo hình ảnh <input id="subs-on" type="checkbox" ${settings.subtitles ? 'checked' : ''}></label>
    <label class="field">Giảm chuyển động (tắt rung camera, chớp màn hình) <input id="rm" type="checkbox" ${settings.reducedMotion ? 'checked' : ''}></label>
    <label class="field">Chữ lớn (×1,25) <input id="lt" type="checkbox" ${settings.largeText ? 'checked' : ''}></label>
    <div class="menu"><button class="ghost" data-act="keys">Đổi phím…</button></div>
    <p class="small">Cài đặt được lưu tự động và giữ cho lần mở sau.</p>
    <button data-act="back">Xong</button>`);
  mode = resumeMode;
  for (const [id, key] of [['subs-on', 'subtitles'], ['rm', 'reducedMotion'], ['lt', 'largeText']]) {
    $(id).onchange = (e) => {
      settings[key] = e.target.checked;
      persist();
    };
  }
  $('vol').oninput = (e) => {
    settings.volume = Number(e.target.value) / 100;
    $('volv').textContent = e.target.value;
    applySettings();
    saveSettings(settings);
    audio.unlock();
    audio.play('click');
  };
  $('cb').onchange = (e) => {
    settings.colorBlind = e.target.checked;
    applySettings();
    saveSettings(settings);
  };
  $('sens').oninput = (e) => {
    settings.sensitivity = Number(e.target.value) / 100;
    $('sensv').textContent = settings.sensitivity.toFixed(2);
    applySettings();
    saveSettings(settings);
  };
}

// ---- key remapping (Ticket-04 §4) -------------------------------------------
let waiting = null; // action waiting for a key
let pendingSwap = null; // { action, code, other }
function showKeys(message = '') {
  const rows = ACTIONS.map(([a, label]) => {
    const cls = [waiting === a ? 'waiting' : '', pendingSwap && (pendingSwap.action === a || pendingSwap.other === a) ? 'conflict' : ''].join(' ');
    return `<div class="krow ${cls}"><span>${label}</span><button class="ghost" data-key="${a}">${waiting === a ? 'Nhấn phím…' : keyLabel(settings.keys[a])}</button></div>`;
  }).join('');
  overlay(`
    <h1>Đổi phím</h1>
    <p class="small">Bấm vào ô phím rồi nhấn phím mới. <kbd>Esc</kbd> để hủy (Esc luôn là tạm dừng / quay lại).</p>
    <div class="keys-remap">${rows}</div>
    <p id="keymsg" class="err" role="status">${message}</p>
    ${pendingSwap ? '<div class="menu"><div class="row"><button data-act="swap-keys">Đổi chỗ hai phím</button><button class="ghost" data-act="cancel-swap">Giữ như cũ</button></div></div>' : ''}
    <div class="menu"><div class="row"><button class="ghost" data-act="reset-keys">Khôi phục mặc định</button><button data-act="settings">Xong</button></div></div>`);
  $('overlay').querySelector('.panel').classList.add('wide');
  for (const b of $('overlay').querySelectorAll('[data-key]')) {
    b.onclick = () => {
      waiting = b.dataset.key;
      pendingSwap = null;
      showKeys();
      controls.capture = onCapture;
    };
  }
}
function onCapture(code) {
  const action = waiting;
  waiting = null;
  controls.capture = null;
  if (code === 'Escape') return showKeys();
  if (RESERVED_KEYS.includes(code)) return showKeys(`⚠ ${keyLabel(code)} dành cho tạm dừng / quay lại.`);
  const other = keyConflict(settings.keys, action, code);
  if (other) {
    pendingSwap = { action, code, other };
    const label = (a) => ACTIONS.find(([x]) => x === a)[1];
    return showKeys(`⚠ Trùng phím: ${keyLabel(code)} đang dùng cho “${label(other)}”. Đổi chỗ phím của “${label(action)}” và “${label(other)}”?`);
  }
  settings.keys = { ...settings.keys, [action]: code };
  persist();
  showKeys(`<span class="ok">Đã lưu: ${keyLabel(code)}</span>`);
}

// ---- local leaderboard (Ticket-04 §3): server file, browser storage as fallback ----
const LB_LOCAL = 'ddl.leaderboard.v1';
const localBoard = () => {
  try {
    return normalizeBoard(JSON.parse(localStorage.getItem(LB_LOCAL) || '{"entries":[]}').entries);
  } catch {
    return [];
  }
};
async function boardApi(method, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch('api/leaderboard', { method, cache: 'no-store', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error(j.error || `HTTP ${r.status}`), { rejected: r.status === 400 });
    return j;
  } finally {
    clearTimeout(t);
  }
}
async function loadBoard() {
  try {
    return { ...(await boardApi('GET')), storage: 'disk' };
  } catch {
    return { entries: localBoard(), storage: 'browser' };
  }
}
async function saveBoardEntry(entry) {
  try {
    return { ...(await boardApi('POST', entry)), storage: 'disk' };
  } catch (e) {
    if (e.rejected) throw e;
    const res = insertEntry(localBoard(), entry);
    try {
      localStorage.setItem(LB_LOCAL, JSON.stringify({ entries: res.entries }));
    } catch {
      /* storage disabled */
    }
    return { ...res, storage: 'browser' };
  }
}
const STORAGE_NOTE = { disk: 'Lưu trên đĩa máy này: data/leaderboard.json (qua tools/serve.js).', browser: 'Không có server: đang lưu tạm trong trình duyệt này.' };
function boardTable(entries, me = null) {
  if (!entries.length) return '<p class="small">Chưa có ai trên bảng. Chơi một ván và lưu tên nhé!</p>';
  const date = (iso) => iso.slice(0, 16).replace('T', ' ');
  return `<table class="board"><tr><th class="num">#</th><th>Tên</th><th class="num">Điểm</th><th class="num">Đêm thắng</th><th>Thời điểm</th></tr>${entries
    .map((e, i) => `<tr class="${me && e.name === me.name && e.achieved_at === me.achieved_at && e.score === me.score ? 'me' : ''}"><td class="num">${i + 1}</td><td>${escapeHtml(e.name)}</td><td class="num">${e.score}</td><td class="num">${e.nights_won}/3</td><td>${date(e.achieved_at)}</td></tr>`)
    .join('')}</table>`;
}
const escapeHtml = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
async function showBoard(me = null, rank = null) {
  mode = 'board';
  const { entries, storage } = await loadBoard();
  if (mode !== 'board') return;
  overlay(`
    <h1>Bảng xếp hạng</h1>
    ${me ? `<p class="${rank ? 'ok' : 'small'}">${rank ? `Đã lưu: ${escapeHtml(me.name)} đứng hạng ${rank}!` : 'Đã lưu, nhưng điểm này chưa vào top 10.'}</p>` : ''}
    ${boardTable(entries, me)}
    <p class="small">Top 10 theo tổng điểm các Đêm đã thắng; bằng điểm thì ai đạt trước đứng trên. ${STORAGE_NOTE[storage]}</p>
    <button data-act="menu">Về menu</button>`);
  $('overlay').querySelector('.panel').classList.add('wide');
}
/** Name entry shown on the dawn screen and after any lost night. */
function scoreForm() {
  if (scoreSaved) return '<p class="ok">Điểm của ván này đã được lưu.</p>';
  return `
    <div class="field"><label for="pname">Tên của bạn</label><input id="pname" type="text" maxlength="24" autocomplete="nickname" value="${escapeHtml(settings.playerName)}" aria-describedby="pname-err"></div>
    <p id="pname-err" class="err" role="status"></p>
    <div class="menu"><button id="save-score" data-act="save-score">Lưu điểm (${campaign.total} · ${campaign.won.length}/3 đêm)</button></div>`;
}
function wireScoreForm() {
  const input = $('pname');
  if (!input) return;
  const check = () => {
    const v = validateName(input.value);
    $('pname-err').textContent = input.value.trim() === '' ? 'Tên: 3–12 ký tự, chữ (có dấu cũng được), số hoặc _' : v.ok ? '' : v.error;
    $('save-score').disabled = !v.ok;
    return v;
  };
  input.oninput = check;
  input.onkeydown = (e) => {
    if (e.key === 'Enter' && check().ok) saveScore();
    if (e.key === 'Escape') input.blur();
  };
  check();
}
async function saveScore() {
  const v = validateName($('pname')?.value);
  if (!v.ok || scoreSaved) return;
  settings.playerName = v.name;
  saveSettings(settings);
  const entry = { name: v.name, score: campaign.total, nights_won: campaign.won.length, achieved_at: isoLocal(), seed: seedValue(world.seed) };
  try {
    const res = await saveBoardEntry(entry);
    scoreSaved = true;
    showBoard(res.entry || entry, res.rank);
  } catch (e) {
    $('pname-err').textContent = e.message;
  }
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
  if (won) scoreSaved = false; // a new total can be saved again
  const reason = { all_lit: 'Mọi Đèn Lồng Lớn đã sáng!', dawn_survived: 'Mây trụ được tới bình minh, đảo vẫn sáng.', dawn: 'Bình minh tới mà đảo chưa đủ đèn sáng.', no_flames: 'Mây đã hết Ngọn Lửa.' }[r.reason] || r.reason;
  const s = world.stats;
  const lastNight = world.night === 3;
  overlay(`
    <p class="sub">Đêm ${world.night} · ${STORY[world.night][0]}</p>
    <h1 class="${won ? 'won' : 'lost'}">${won ? 'Thắng Đêm!' : 'Thua Đêm'}</h1>
    <p>${reason}</p>
    <p class="big">${world.score} điểm</p>
    <p class="small">Đèn sáng lúc kết thúc ${world.lanterns.filter((l) => l.lit).length}/${world.lanterns.length} · Đom đóm nạp ${s.motesDeposited} · Lần thắp ${s.lanternsLit} · Trúng Tỏa Sáng ${s.stuns} · Lửa còn ${world.player.flames}</p>
    <p class="small">Tổng điểm các Đêm đã thắng: <b class="gold">${campaign.total}</b></p>
    ${won ? '' : scoreForm()}
    <div class="menu">
      ${won ? `<button data-act="${lastNight ? 'dawn' : 'next'}">${lastNight ? 'Đón Bình Minh' : `Sang Đêm ${world.night + 1}`}</button>` : '<button class="ghost" data-act="restart">Chơi lại Đêm</button>'}
      <button class="ghost" data-act="menu">Về menu</button>
    </div>`);
  wireScoreForm();
}

function showDawn() {
  mode = 'dawn';
  audio.stopMusic();
  overlay(`
    <h1 class="dawn">Bình Minh</h1>
    <p>Ba hòn đảo đã sáng đèn trở lại. Ông Đăng mỉm cười: “Giỏi lắm, người giữ đèn.”</p>
    <p class="big">${campaign.total} điểm</p>
    <p class="small">Đêm đã thắng: ${campaign.won.join(', ')}</p>
    ${scoreForm()}
    <button class="ghost" data-act="menu">Về menu</button>`);
  wireScoreForm();
}

function act(a) {
  audio.unlock();
  audio.play('click');
  if (a === 'play' || a.startsWith('pick')) {
    campaign.total = 0;
    campaign.won = [];
    scoreSaved = false;
    showIntro(a === 'play' ? 1 : Number(a.slice(4)));
  } else if (a === 'start') startNight();
  else if (a === 'resume') resumeGame();
  else if (a === 'restart') showIntro(campaign.night);
  else if (a === 'next') showIntro(campaign.night + 1);
  else if (a === 'dawn') showDawn();
  else if (a === 'menu') showMenu();
  else if (a === 'settings') showSettings();
  else if (a === 'back') (back || showMenu)();
  else if (a === 'help') overlay(`<h1>Điều khiển</h1>${controlsHtml()}<button data-act="menu">Quay lại</button>`);
  else if (a === 'board') showBoard();
  else if (a === 'save-score') saveScore();
  else if (a === 'keys') {
    waiting = null;
    pendingSwap = null;
    showKeys();
  } else if (a === 'reset-keys') {
    settings.keys = { ...DEFAULT_KEYS };
    pendingSwap = null;
    persist();
    showKeys('<span class="ok">Đã khôi phục phím mặc định.</span>');
  } else if (a === 'swap-keys' && pendingSwap) {
    const { action, code, other } = pendingSwap;
    settings.keys = { ...settings.keys, [other]: settings.keys[action], [action]: code };
    pendingSwap = null;
    persist();
    showKeys(`<span class="ok">Đã đổi chỗ: ${keyLabel(code)} ↔ ${keyLabel(settings.keys[other])}</span>`);
  } else if (a === 'cancel-swap') {
    pendingSwap = null;
    showKeys();
  }
}

controls.onKey = (code) => {
  if (code === 'Enter') {
    const btn = $('overlay').querySelector('button:not(:disabled)');
    if (mode !== 'playing' && btn && document.activeElement?.tagName !== 'BUTTON' && !$('pname')) btn.click();
  } else if (code === 'Escape' || code === settings.keys.pause) {
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
        hud.toast(e.data.relight ? `Đèn ${e.data.lantern_id} sáng lại!` : `Đèn ${e.data.lantern_id} đã sáng!`, now);
        hud.flash('rgba(255,179,71,0.3)');
        break;
      case 'pulse':
        audio.play('pulse');
        fx.push({ kind: 'pulse', pos: [...p.pos], left: 1, dur: 0.8 });
        break;
      case 'player_hit':
        audio.play('hit');
        hud.flash('rgba(90,20,140,0.5)');
        if (!settings.reducedMotion) shake = 0.35;
        hud.toast(`⚠ ${e.data.by === 'fall' ? 'Rơi khỏi đảo! Mất hết đom đóm.' : e.data.dropped ? `Bị chạm! Rơi ${e.data.dropped} đom đóm` : 'Bị chạm!'}`, now, 1.6);
        break;
      case 'shade_spawned':
        audio.play('shade');
        hud.subtitle('⚠ [tiếng rít] Bóng Mực xuất hiện — xem mũi tên ở mép màn hình', now, 3);
        hud.markShade(e.data.id, now, 3.5);
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
      case 'lantern_out':
        audio.play('out');
        hud.toast(`⚠ Đèn ${e.data.lantern_id} đã tắt: thắp lại chỉ cần ${tuning.relight_cost} đom đóm`, now, 2.4);
        break;
      case 'refuel':
        audio.play('refuel');
        break;
      case 'fuel_drain':
        if (e.data.fuel < 20) hud.toast(`⚠ Bóng Mực đang hút dầu đèn ${e.data.lantern_id} (${Math.floor(e.data.fuel)})`, now, 1.8);
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
  if (tl <= 10 && tl > 0 && !last10) {
    last10 = true;
    hud.subtitle('⏳ [tiếng tích tắc] 10 giây cuối tới bình minh', now, 10);
  }
  for (const L of world.lanterns) {
    const weak = L.lit && isWeak(world, L);
    if (weak && !weakSeen.has(L.id)) hud.subtitle(`⚠ Đèn ${L.id} sắp cạn dầu (${Math.floor(fuelValue(L))}) — châm dầu bằng ${keyLabel(settings.keys.interact)}`, now, 4);
    if (weak) weakSeen.add(L.id);
    else weakSeen.delete(L.id);
  }
  const wind = windAt(world);
  if (wind.warn && !windWarned) {
    windWarned = true;
    audio.play('wind');
    hud.toast('Gió sắp thổi!', now, 2);
    hud.subtitle('🌬 [tiếng gió] Gió sắp thổi — đứng vững hoặc tránh mép đảo', now, 3);
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
      handle(step(world, replayAt ? replayAt(world.tick) : controls.sample()), now);
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
  if (replayAt) {
    // a replay has no mouse: the view turns smoothly towards where Mây is running
    const v = world.player.vel;
    if (Math.hypot(v[0], v[2]) > 1.5) {
      const want = (Math.atan2(v[0], v[2]) * 180) / Math.PI;
      demoYaw += ((((want - demoYaw) % 360) + 540) % 360 - 180) * (1 - Math.exp(-dt * 1.3));
    }
  }
  const viewYaw = replayAt ? demoYaw : controls.yawDeg;
  lastView = scene.draw(world, orbit || { yawDeg: viewYaw, dist: controls.dist, target: [camTarget[0] + sx, camTarget[1], camTarget[2]] }, fx, now, aspect);
  hud.update(world, now, lastView);
  audio.update();
  cpuTimes.push(performance.now() - cpu0);
  if (cpuTimes.length > 600) cpuTimes.shift();
  if (params.get('fps')) $('fps').textContent = `${fps().toFixed(0)} FPS`;
  if (!DEMO) requestAnimationFrame(frame);
}

if (params.get('autostart')) {
  showIntro(scenarioNight);
  startNight();
} else {
  showMenu();
}
if (!DEMO) requestAnimationFrame(frame);

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
  get fxState() { return { shake, flashOn: $('flash').classList.contains('on'), reducedMotion: hud.reducedMotion }; },
  act,
  // ?debug=1 or ?demo=1 only: run n ticks at once (no input, or the replay's input)
  advance: (n) => {
    if (!params.get('debug') && !DEMO) return false;
    for (let i = 0; i < n && world.state === 'playing'; i++) {
      handle(step(world, replayAt ? replayAt(world.tick) : { move: [0, 0], cam_yaw_deg: controls.yawDeg }), performance.now() / 1000);
      if (world.state !== 'playing') endNight();
    }
    camTarget = [...world.player.pos];
    return true;
  },
  // ?demo=1 only: draw one frame at virtual time ms (tools/demo.mjs)
  frame: (ms) => DEMO && (frame(ms), true),
};

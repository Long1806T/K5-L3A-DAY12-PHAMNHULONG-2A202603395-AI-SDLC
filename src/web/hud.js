// HTML overlay: flames, carried light, lanterns, time, score, hints, end screen.

import { distXZ, timeLeftExact, inSafeZone } from '../core/sim.js';

const FLAME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-1 4-6 7-6 12a6 6 0 0 0 12 0c0-3-1.6-5-3-6.5.2 2-1 3.5-2.4 3.5C14 8 13.5 5 12 2z"/></svg>';
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(tuning) {
    this.T = tuning;
    this.toastUntil = 0;
    this.cache = {};
  }

  set(id, html) {
    if (this.cache[id] === html) return;
    this.cache[id] = html;
    $(id).innerHTML = html;
  }

  toast(text, now, seconds = 2.2) {
    $('toast').textContent = text;
    $('toast').classList.add('show');
    this.toastUntil = now + seconds;
  }

  flash(color) {
    const el = $('flash');
    el.style.background = color;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  update(world, now) {
    const T = this.T;
    const p = world.player;
    let flames = '';
    for (let i = 0; i < Math.max(T.flames, p.flames); i++) flames += `<span class="flame ${i < p.flames ? '' : 'off'}">${FLAME_SVG}</span>`;
    this.set('flames', flames);
    let motes = '';
    for (let i = 0; i < T.carry_capacity; i++) motes += `<span class="dot ${i < p.carried ? 'on' : ''}"></span>`;
    this.set('carried', `${motes}<b>${p.carried}/${T.carry_capacity}</b>`);
    const lit = world.lanterns.filter((l) => l.lit).length;
    this.set('lanterns', world.lanterns.map((l) => `<span class="lan ${l.lit ? 'lit' : ''}" title="${l.id}"><i style="--fill:${l.lit ? 1 : l.deposited / T.lantern_cost}"></i>${l.id}</span>`).join('') + `<b>${lit}/${world.lanterns.length}</b>`);
    const tl = Math.max(0, timeLeftExact(world));
    const mm = Math.floor(Math.ceil(tl) / 60);
    const ss = String(Math.ceil(tl) % 60).padStart(2, '0');
    this.set('time', `<span class="${tl < 30 ? 'warn' : ''}">${mm}:${ss}</span>`);
    this.set('score', `${world.score} điểm`);
    const cd = Math.max(0, p.pulseReadyAt - world.tick) / 60;
    const pulseReady = cd === 0 && p.carried >= T.pulse_cost;
    this.set('pulse', `<span class="${pulseReady ? 'ready' : ''}">F · Tỏa sáng ${cd > 0 ? cd.toFixed(1) + 's' : p.carried < T.pulse_cost ? '(cần đom đóm)' : 'sẵn sàng'}</span>`);

    let hint = '';
    if (world.state === 'playing') {
      let near = null;
      for (const L of world.lanterns) if (!L.lit && distXZ(L.pos, p.pos) <= T.interact_radius && (!near || distXZ(L.pos, p.pos) < distXZ(near.pos, p.pos))) near = L;
      if (near) hint = p.carried > 0 ? `Nhấn <kbd>E</kbd> để nạp ánh sáng vào ${near.id} (${near.deposited}/${T.lantern_cost})` : `${near.id} cần ${T.lantern_cost - near.deposited} đom đóm nữa`;
      else if (p.carried >= T.carry_capacity) hint = 'Túi đầy ánh sáng: mang về một Đèn Lồng Lớn';
      else if (inSafeZone(world, p.pos)) hint = 'Vùng sáng của đèn: Bóng Mực không vào được';
    }
    this.set('hint', hint);
    if (now > this.toastUntil) $('toast').classList.remove('show');
  }
}

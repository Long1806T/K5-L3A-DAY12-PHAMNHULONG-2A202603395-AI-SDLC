// HUD overlay laid out as Ticket-02 asks: flames top-left, clock top-centre,
// lanterns + score top-right, 10-slot mote bar bottom-centre, dash/pulse
// cooldowns bottom-right, a lantern prompt and an off-screen lantern arrow.

import { distXZ, timeLeftExact } from '../core/sim.js';

const FLAME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c-1 4-6 7-6 12a6 6 0 0 0 12 0c0-3-1.6-5-3-6.5.2 2-1 3.5-2.4 3.5C14 8 13.5 5 12 2z"/></svg>';
const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(tuning) {
    this.T = tuning;
    this.toastUntil = 0;
    this.cache = {};
    this.reducedMotion = false;
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
    if (this.reducedMotion) return;
    const el = $('flash');
    el.style.background = color;
    el.classList.remove('on');
    void el.offsetWidth;
    el.classList.add('on');
  }

  /** Nearest lantern the player can still put light into (unlit, or not full when fuel exists). */
  static targetLantern(world) {
    let best = null;
    for (const L of world.lanterns) {
      if (L.lit) continue;
      if (!best || distXZ(L.pos, world.player.pos) < distXZ(best.pos, world.player.pos)) best = L;
    }
    return best;
  }

  update(world, now, view) {
    const T = this.T;
    const p = world.player;
    let flames = '';
    for (let i = 0; i < Math.max(T.flames, p.flames); i++) flames += `<span class="flame ${i < p.flames ? '' : 'off'}">${FLAME_SVG}</span>`;
    this.set('flames', flames);

    const tl = Math.max(0, timeLeftExact(world));
    const secs = Math.ceil(tl - 1e-9);
    const clock = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
    this.set('clock', `<span class="${tl <= 30 ? 'danger blink' : ''}">${tl <= 30 ? '⚠ ' : ''}${clock}</span>`);

    const lit = world.lanterns.filter((l) => l.lit).length;
    this.set('lanterns', `<span class="lan-count">🏮 ${lit}/${world.lanterns.length}</span><span class="score">${world.score}</span>`);

    const cap = world.player.capacity ?? T.carry_capacity;
    let bar = '';
    for (let i = 0; i < cap; i++) bar += `<span class="slot ${i < p.carried ? 'on' : ''}"></span>`;
    this.set('motebar', `${bar}<b>${p.carried}/${cap}</b>`);

    const dashReady = p.charm > 0 ? 1 : 1 - p.dashCd / Math.round(T.dash_cooldown_s * 60);
    const pulseReady = 1 - p.pulseCd / Math.round(T.pulse_cooldown_s * 60);
    const pulseOk = p.pulseCd === 0 && p.carried >= T.pulse_cost;
    this.set('cds', `
      <div class="cd ${dashReady >= 1 ? 'ready' : ''}" style="--p:${dashReady.toFixed(3)}"><i>⇧</i><small>Lướt</small></div>
      <div class="cd ${pulseOk ? 'ready' : ''}" style="--p:${pulseReady.toFixed(3)}"><i>✦</i><small>Tỏa sáng ${T.pulse_cost}</small></div>`);

    let prompt = '';
    if (world.state === 'playing' && !world.paused && p.dead === 0) {
      let near = null;
      for (const L of world.lanterns) {
        if (L.lit || distXZ(L.pos, p.pos) > T.interact_radius) continue;
        if (!near || distXZ(L.pos, p.pos) < distXZ(near.pos, p.pos)) near = L;
      }
      if (near) prompt = `<kbd>E</kbd> — Nạp ánh sáng (${near.deposited}/${T.lantern_cost})`;
    }
    this.set('prompt', prompt);

    // arrow to the nearest unlit lantern when it is off screen
    const arrow = $('arrow');
    const target = Hud.targetLantern(world);
    let show = false;
    if (target && view && world.state === 'playing') {
      const m = view.viewProj;
      const P = [target.pos[0], target.pos[1] + 4.2, target.pos[2]];
      const cx = m[0] * P[0] + m[4] * P[1] + m[8] * P[2] + m[12];
      const cy = m[1] * P[0] + m[5] * P[1] + m[9] * P[2] + m[13];
      const cw = m[3] * P[0] + m[7] * P[1] + m[11] * P[2] + m[15];
      let nx = cx / cw;
      let ny = cy / cw;
      const onScreen = cw > 0 && Math.abs(nx) <= 0.95 && Math.abs(ny) <= 0.95;
      if (!onScreen) {
        if (cw < 0) {
          nx = -nx;
          ny = -ny;
        }
        const k = 0.88 / Math.max(Math.abs(nx), Math.abs(ny), 1e-6);
        const ex = nx * k;
        const ey = ny * k;
        const W = window.innerWidth;
        const H = window.innerHeight;
        arrow.style.left = `${((ex + 1) / 2) * W}px`;
        arrow.style.top = `${((1 - ey) / 2) * H}px`;
        arrow.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(-ey, ex)}rad)`;
        arrow.title = target.id;
        show = true;
      }
    }
    arrow.classList.toggle('show', show);
    if (now > this.toastUntil) $('toast').classList.remove('show');
  }
}

// Deterministic game logic for Đảo Đèn Lồng. Pure: no DOM, no Math.random, no
// clocks. The browser and the headless CLI both drive the game only through
// createWorld() + step(), so what is tested headless is what is played.

import { createRng } from './rng.js';
import { getNight } from './level.js';
import { defaultInput } from './inputs.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const EPS = 1e-6; // "within r" means distance <= r; EPS absorbs float drift
const SAFE_MARGIN = 0.01; // shades are parked this far outside safe_radius
const GRAVITY = 24; // m/s^2, jump only (distances are measured on XZ)
const JUMP_SPEED = 7.2; // m/s, about 1.1 m high

export const r3 = (x) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v; // no "-0"
};
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const secondsToTicks = (s) => Math.round(s * TICK_RATE);

/**
 * Builds the world for a night. `scenario` must already be validated
 * (see validateScenario); scenario setup emits no events and adds no score.
 */
export function createWorld({ tuning, night = 1, seed = 0, scenario = null }) {
  const level = getNight(night);
  const T = tuning;
  const duration = T[`night${night}_duration_s`];
  const w = {
    T,
    level,
    night,
    seed: String(seed),
    tick: 0,
    simTick: 0,
    state: 'playing',
    result: null,
    score: 0,
    timeLeftAtStart: duration,
    player: {
      pos: [...level.playerStart],
      vy: 0,
      onGround: true,
      facing: 0,
      carried: 0,
      flames: T.flames,
      invulnUntil: 0,
      pulseReadyAt: 0,
    },
    lanterns: level.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0 })),
    motes: [],
    shades: [],
    randomMotes: true,
    randomShades: true,
    moteSerial: 0,
    shadeSerial: 0,
    rngMotes: createRng(`${seed}|night${night}|motes`),
    rngShades: createRng(`${seed}|night${night}|shades`),
    prevButtons: { jump: false, interact: false, pulse: false, dash: false },
    nextMoteSpawnTick: secondsToTicks(level.motes.respawnEveryS),
    nextShadeSpawnTick: secondsToTicks(level.shades.spawnEveryS),
    stats: { motesPicked: 0, motesDeposited: 0, lanternsLit: 0, stuns: 0, pulses: 0, hits: 0, dropped: 0 },
  };

  const sc = scenario || {};
  if (sc.player) {
    if (sc.player.pos) w.player.pos = [...sc.player.pos];
    if (sc.player.carried !== undefined) w.player.carried = sc.player.carried;
    if (sc.player.flames !== undefined) w.player.flames = sc.player.flames;
  }
  w.player.onGround = w.player.pos[1] <= 0;
  if (sc.random_motes !== undefined) w.randomMotes = sc.random_motes;
  if (sc.random_shades !== undefined) w.randomShades = sc.random_shades;
  for (const l of sc.lanterns || []) {
    const L = w.lanterns.find((x) => x.id === l.id);
    if (l.pos) L.pos = [...l.pos];
    if (l.deposited !== undefined) L.deposited = l.deposited;
    if (l.lit !== undefined) {
      L.lit = l.lit;
      if (L.lit && l.deposited === undefined) L.deposited = Math.max(L.deposited, T.lantern_cost);
    } else if (L.deposited >= T.lantern_cost) {
      L.lit = true;
    }
  }
  if (sc.time_left_s !== undefined) w.timeLeftAtStart = sc.time_left_s;

  if (sc.motes) {
    w.motes = sc.motes.map((m) => ({ id: m.id ?? nextMoteId(w), pos: [...m.pos] }));
  } else if (w.randomMotes) {
    for (let i = 0; i < level.motes.initial; i++) spawnMote(w, true);
  }
  if (sc.shades) {
    w.shades = sc.shades.map((s) => ({ id: s.id ?? null, pos: [...s.pos], state: 'chase', stunUntil: 0, emergeUntil: 0 }));
    for (const s of w.shades) if (s.id === null) s.id = nextShadeId(w);
  } else if (w.randomShades) {
    for (let i = 0; i < level.shades.initial; i++) spawnShade(w, 0);
  }
  return w;
}

function nextMoteId(w) {
  let id;
  do id = `M${++w.moteSerial}`;
  while (w.motes.some((m) => m.id === id));
  return id;
}

function nextShadeId(w) {
  let id;
  do id = `S${++w.shadeSerial}`;
  while (w.shades.some((s) => s.id === id));
  return id;
}

function randomInAnnulus(rng, rMin, rMax) {
  const u = rng();
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rMin * rMin + u * (rMax * rMax - rMin * rMin));
  return [r3(r * Math.cos(a)), 0, r3(r * Math.sin(a))];
}

function spawnMote(w, initial) {
  const cfg = w.level.motes;
  let pos;
  for (let attempt = 0; attempt < 30; attempt++) {
    pos = randomInAnnulus(w.rngMotes, cfg.minR, cfg.maxR);
    const awayFromPlayer = distXZ(pos, w.player.pos) >= (initial ? cfg.minDistFromStart : cfg.minDistFromPlayer);
    const awayFromLanterns = w.lanterns.every((l) => distXZ(pos, l.pos) >= cfg.minDistFromLantern);
    if (awayFromPlayer && awayFromLanterns) break;
  }
  const mote = { id: nextMoteId(w), pos };
  w.motes.push(mote);
  return mote;
}

function spawnShade(w, tick) {
  const cfg = w.level.shades;
  const T = w.T;
  let pos;
  for (let attempt = 0; attempt < 30; attempt++) {
    pos = randomInAnnulus(w.rngShades, cfg.minR, cfg.maxR);
    const awayFromPlayer = distXZ(pos, w.player.pos) >= cfg.minDistFromPlayer;
    const awayFromLanterns = w.lanterns.every((l) => distXZ(pos, l.pos) >= T.safe_radius + cfg.extraLanternGap);
    if (awayFromPlayer && awayFromLanterns) break;
  }
  pos[1] = cfg.hoverY;
  const shade = {
    id: nextShadeId(w),
    pos,
    state: 'emerge',
    stunUntil: 0,
    emergeUntil: tick + secondsToTicks(cfg.emergeS),
  };
  keepShadeOutOfSafeZones(w, shade);
  w.shades.push(shade);
  return shade;
}

function clampToIsland(pos, radius) {
  const d = Math.hypot(pos[0], pos[2]);
  if (d > radius) {
    pos[0] *= radius / d;
    pos[2] *= radius / d;
  }
}

function keepShadeOutOfSafeZones(w, shade) {
  const R = w.T.safe_radius;
  for (let pass = 0; pass < 3; pass++) {
    let moved = false;
    for (const L of w.lanterns) {
      let dx = shade.pos[0] - L.pos[0];
      let dz = shade.pos[2] - L.pos[2];
      let d = Math.hypot(dx, dz);
      if (d < R + SAFE_MARGIN - EPS) {
        if (d < 1e-9) {
          dx = 1;
          dz = 0;
          d = 1;
        }
        shade.pos[0] = L.pos[0] + (dx / d) * (R + SAFE_MARGIN);
        shade.pos[2] = L.pos[2] + (dz / d) * (R + SAFE_MARGIN);
        moved = true;
      }
    }
    clampToIsland(shade.pos, w.level.islandRadius);
    if (!moved) break;
  }
}

export function inSafeZone(w, pos) {
  return w.lanterns.some((L) => distXZ(pos, L.pos) <= w.T.safe_radius + EPS);
}

export function timeLeftExact(w) {
  return w.timeLeftAtStart - w.tick / TICK_RATE;
}

function endGame(w, t, result, reason, emit) {
  w.state = result;
  w.result = { result, reason, tick: t };
  if (result === 'won') {
    const secondsLeft = Math.max(0, Math.floor(w.timeLeftAtStart - t / TICK_RATE + EPS));
    w.score += secondsLeft * w.T.score.per_second_left + w.player.flames * w.T.score.per_flame_left;
  }
  emit('game_over', { result, reason });
}

/**
 * Advances one tick (1/60 s). Step k reads the input held during tick k and
 * produces state k+1; returned events carry tick = k+1.
 */
export function step(w, rawInput) {
  if (w.state !== 'playing') return [];
  const T = w.T;
  const p = w.player;
  const t = w.tick + 1;
  const events = [];
  const emit = (name, data) => events.push({ tick: t, name, data });
  const playing = () => w.state === 'playing';

  const inp = { ...defaultInput(), ...rawInput };
  const pressed = {};
  for (const b of ['jump', 'interact', 'pulse', 'dash']) pressed[b] = inp[b] && !w.prevButtons[b];
  w.prevButtons = { jump: inp.jump, interact: inp.interact, pulse: inp.pulse, dash: inp.dash };

  // 1. Movement on XZ: move rotated by camera yaw, normalised if longer than 1.
  let [mx, mz] = inp.move;
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const th = (inp.cam_yaw_deg * Math.PI) / 180;
  const c = Math.cos(th);
  const s = Math.sin(th);
  const wx = mx * c + mz * s;
  const wz = -mx * s + mz * c;
  p.pos[0] += wx * T.player_speed * DT;
  p.pos[2] += wz * T.player_speed * DT;
  if (wx !== 0 || wz !== 0) p.facing = Math.atan2(wx, wz);
  clampToIsland(p.pos, w.level.islandRadius);

  // Jump (vertical only).
  if (pressed.jump && p.onGround) {
    p.vy = JUMP_SPEED;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= GRAVITY * DT;
    p.pos[1] += p.vy * DT;
    if (p.pos[1] <= 0) {
      p.pos[1] = 0;
      p.vy = 0;
      p.onGround = true;
    }
  }

  // 2. Pick up motes automatically.
  if (w.motes.length) {
    const keep = [];
    for (const m of w.motes) {
      if (p.carried < T.carry_capacity && distXZ(p.pos, m.pos) <= T.pickup_radius + EPS) {
        p.carried += 1;
        w.score += T.score.per_mote;
        w.stats.motesPicked++;
        emit('mote_picked', { carried: p.carried });
      } else {
        keep.push(m);
      }
    }
    w.motes = keep;
  }

  // 3. Interact: deposit light into the nearest unlit lantern in range.
  if (pressed.interact) {
    let best = null;
    let bestD = Infinity;
    for (const L of w.lanterns) {
      if (L.lit) continue;
      const d = distXZ(p.pos, L.pos);
      if (d <= T.interact_radius + EPS && d < bestD) {
        best = L;
        bestD = d;
      }
    }
    if (best) {
      const need = Math.max(0, T.lantern_cost - best.deposited);
      const amount = Math.min(p.carried, need);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        w.stats.motesDeposited += amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
      }
      if ((amount > 0 || need === 0) && best.deposited >= T.lantern_cost) {
        best.lit = true;
        w.score += T.score.per_lantern;
        w.stats.lanternsLit++;
        emit('lantern_lit', { lantern_id: best.id });
      }
    }
  }
  if (playing() && w.lanterns.every((L) => L.lit)) endGame(w, t, 'won', 'all_lit', emit);

  // 4. Pulse: costs carried light, stuns and pushes shades in range.
  if (playing() && pressed.pulse && t >= p.pulseReadyAt && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseReadyAt = t + secondsToTicks(T.pulse_cooldown_s);
    const stunned = [];
    for (const sh of w.shades) {
      if (distXZ(p.pos, sh.pos) > T.pulse_radius + EPS) continue;
      sh.state = 'stunned';
      sh.stunUntil = t + secondsToTicks(T.pulse_stun_s);
      let dx = sh.pos[0] - p.pos[0];
      let dz = sh.pos[2] - p.pos[2];
      let d = Math.hypot(dx, dz);
      if (d < 1e-9) {
        dx = Math.sin(p.facing);
        dz = Math.cos(p.facing);
        d = 1;
      }
      sh.pos[0] += (dx / d) * T.pulse_push_m;
      sh.pos[2] += (dz / d) * T.pulse_push_m;
      keepShadeOutOfSafeZones(w, sh);
      stunned.push(sh.id);
    }
    w.score += stunned.length * T.score.per_stun;
    w.stats.stuns += stunned.length;
    w.stats.pulses++;
    emit('pulse', { stunned_ids: stunned });
  }

  // 5. Shades: wake up, then chase the player (never entering safe zones).
  if (playing()) {
    const stepLen = T.shade_speed * DT;
    for (const sh of w.shades) {
      if (sh.state === 'stunned' && t >= sh.stunUntil) sh.state = 'chase';
      if (sh.state === 'emerge' && t >= sh.emergeUntil) sh.state = 'chase';
      if (sh.state !== 'chase') continue;
      const dx = p.pos[0] - sh.pos[0];
      const dz = p.pos[2] - sh.pos[2];
      const d = Math.hypot(dx, dz);
      if (d > 1e-9) {
        const k = Math.min(stepLen, d) / d;
        sh.pos[0] += dx * k;
        sh.pos[2] += dz * k;
      }
      keepShadeOutOfSafeZones(w, sh);
    }
  }

  // 6. Hits: first chasing shade in range hits once; then invulnerability.
  if (playing() && t >= p.invulnUntil && !inSafeZone(w, p.pos)) {
    for (const sh of w.shades) {
      if (sh.state !== 'chase') continue;
      if (distXZ(p.pos, sh.pos) > T.shade_hit_radius + EPS) continue;
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
      p.carried -= dropped;
      p.invulnUntil = t + secondsToTicks(T.invuln_s);
      w.stats.hits++;
      w.stats.dropped += dropped;
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break;
    }
  }
  if (playing() && p.flames <= 0) endGame(w, t, 'lost', 'no_flames', emit);

  // 7. Spawning (only when the scenario allows random spawns).
  if (playing()) {
    if (w.randomMotes && t >= w.nextMoteSpawnTick) {
      if (w.motes.length < w.level.motes.target) spawnMote(w, false);
      w.nextMoteSpawnTick = t + secondsToTicks(w.level.motes.respawnEveryS);
    }
    if (w.randomShades && t >= w.nextShadeSpawnTick) {
      if (w.shades.length < w.level.shades.max) {
        const sh = spawnShade(w, t);
        emit('shade_spawned', { id: sh.id });
      }
      w.nextShadeSpawnTick = t + secondsToTicks(w.level.shades.spawnEveryS);
    }
  }

  // 8. Clock.
  w.tick = t;
  w.simTick = t;
  if (playing() && timeLeftExact(w) <= EPS) endGame(w, t, 'lost', 'dawn', emit);
  return events;
}

/** Snapshot object in Test Contract v1.0 shape. */
export function snapshot(w) {
  const p = w.player;
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.simTick,
    state: w.state,
    time_left_s: r3(Math.max(0, timeLeftExact(w))),
    score: w.score,
    player: { pos: p.pos.map(r3), flames: p.flames, carried: p.carried },
    lanterns: w.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3) })),
  };
}

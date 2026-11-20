// Deterministic game logic for Đảo Đèn Lồng (Test Contract v1.1).
// Pure: no DOM, no Math.random, no clocks. Browser and headless both drive the
// game only through createWorld() + step() + snapshot().
//
// Tick order (Ticket-02, mandatory):
//  1 input/pause · 2 counters · 3 move Mây + fall · 4 pick up · 5 lanterns ·
//  6 safe zones · 7 pulse · 8 shades & drifters move · 9 contacts ·
//  10 spawns · 11 win/lose · (12 snapshot, written by the caller)

import { createRng } from './rng.js';
import { getNight, groundHeight, insideObstacle } from './level.js';
import { defaultInput } from './inputs.js';
import { RULES as R } from './rules.js';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const EPS = 1e-6;
const SAFE_MARGIN = 0.01; // shades are parked this far outside safe_radius
const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];

export const r3 = (x) => {
  const v = Math.round(x * 1000) / 1000;
  return v === 0 ? 0 : v;
};
export const distXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const secondsToTicks = (s) => Math.round(s * TICK_RATE);
const idNum = (id) => {
  const m = /(\d+)$/.exec(id);
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};
export const byId = (a, b) => (b ? idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : -1);

// ---------------------------------------------------------------- creation

export function createWorld({ tuning, night = 1, seed = 0, scenario = null }) {
  const L = getNight(night);
  const T = tuning;
  const sd = String(seed);
  const w = {
    T,
    level: L,
    night,
    seed: sd,
    tick: 0,
    simTick: 0,
    paused: false,
    state: 'playing',
    result: null,
    score: 0,
    timeLeftAtStart: T[`night${night}_duration_s`],
    shadeSpeed: night === 3 && T.shade_speed_night3 != null ? T.shade_speed_night3 : T.shade_speed,
    player: {
      pos: [...L.start],
      vel: [0, 0, 0],
      grounded: true,
      facing: 0, // forward = (sin, cos): 0 faces +Z
      carried: 0,
      flames: T.flames,
      invuln: 0,
      dashCd: 0,
      dashLeft: 0,
      dashDir: [0, 1],
      pulseCd: 0,
      charm: 0,
      launch: null,
      dead: 0,
      respawnNow: false,
    },
    lanterns: L.lanterns.map((l) => ({ id: l.id, pos: [...l.pos], lit: false, deposited: 0 })),
    motes: [],
    shades: [],
    drifters: [],
    charms: L.charms.map((c) => ({ id: c.id, pos: [...c.pos], available: true, respawn: 0 })),
    randomMotes: true,
    randomShades: true,
    randomDrifters: L.drifters,
    windEnabled: L.wind,
    serial: { M: 0, S: 0, D: 0 },
    rng: {
      motes: createRng(`${sd}|n${night}|motes`),
      shades: createRng(`${sd}|n${night}|shades`),
      drops: createRng(`${sd}|n${night}|drops`),
      drifters: createRng(`${sd}|n${night}|drifters`),
      wander: createRng(`${sd}|n${night}|wander`),
    },
    prev: { jump: false, interact: false, pulse: false, dash: false, pause: false },
    stats: { motesPicked: 0, motesDeposited: 0, lanternsLit: 0, stuns: 0, pulses: 0, hits: 0, falls: 0, dashes: 0, steals: 0, charms: 0, jumps: 0 },
  };
  applyScenario(w, scenario || {});
  return w;
}

function nextId(w, prefix, list) {
  let id;
  do id = `${prefix}${++w.serial[prefix]}`;
  while (list.some((e) => e.id === id));
  return id;
}

function hoverY(w, x, z, offset) {
  const g = groundHeight(w.level, x, z);
  return (g === null ? 0 : g) + offset;
}

function addMote(w, pos, kind, ttl, id, point = -1) {
  const m = { id: id ?? nextId(w, 'M', w.motes), pos: [...pos], kind, ttl: kind === 'dropped' ? ttl ?? R.dropTtl : null, point };
  w.motes.push(m);
  return m;
}

function newShade(w, pos, id, hoverOff, state) {
  return {
    id: id ?? nextId(w, 'S', w.shades),
    pos: [...pos],
    hoverOff,
    state,
    spawnLeft: 0,
    stun: 0,
    push: null,
    recoilLeft: 0,
    recoilDir: [1, 0],
    expel: null,
    home: [pos[0], pos[2]],
  };
}

function applyScenario(w, sc) {
  const T = w.T;
  const L = w.level;
  const p = w.player;
  if (sc.player) {
    const sp = sc.player;
    if (sp.pos) p.pos = [...sp.pos];
    if (sp.carried !== undefined) p.carried = sp.carried;
    if (sp.flames !== undefined) p.flames = sp.flames;
    if (sp.invuln_ticks !== undefined) p.invuln = sp.invuln_ticks;
    if (sp.dash_cd_ticks !== undefined) p.dashCd = sp.dash_cd_ticks;
    if (sp.pulse_cd_ticks !== undefined) p.pulseCd = sp.pulse_cd_ticks;
    if (sp.charm_ticks !== undefined) p.charm = sp.charm_ticks;
  }
  const g0 = groundHeight(L, p.pos[0], p.pos[2]);
  if (g0 !== null && p.pos[1] <= g0 + 1e-6) {
    p.pos[1] = g0;
    p.grounded = true;
  } else {
    p.grounded = false;
  }
  if (sc.random_motes !== undefined) w.randomMotes = sc.random_motes;
  if (sc.random_shades !== undefined) w.randomShades = sc.random_shades;
  if (sc.random_drifters !== undefined) w.randomDrifters = sc.random_drifters;
  if (sc.wind_enabled !== undefined) w.windEnabled = sc.wind_enabled;
  for (const l of sc.lanterns || []) {
    const Ln = w.lanterns.find((x) => x.id === l.id);
    if (l.pos) Ln.pos = [...l.pos];
    if (l.deposited !== undefined) Ln.deposited = l.deposited;
    if (l.lit !== undefined) {
      Ln.lit = l.lit;
      if (Ln.lit && l.deposited === undefined) Ln.deposited = Math.max(Ln.deposited, T.lantern_cost);
    } else if (Ln.deposited >= T.lantern_cost) {
      Ln.lit = true;
    }
  }
  if (sc.time_left_s !== undefined) w.timeLeftAtStart = sc.time_left_s;

  if (sc.motes) {
    for (const m of sc.motes) {
      const kind = m.kind || 'random';
      const point = kind === 'random' ? L.moteSpawns.findIndex((pt) => distXZ(pt, m.pos) < 0.5) : -1;
      addMote(w, m.pos, kind, m.ttl_ticks, m.id, point);
    }
  } else if (w.randomMotes) {
    const idx = L.moteSpawns.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(w.rng.motes() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (const i of idx.slice(0, R.moteInitial)) addMote(w, L.moteSpawns[i], 'random', null, undefined, i);
  }

  for (const s of sc.shades || []) {
    const g = groundHeight(L, s.pos[0], s.pos[2]);
    const d = distXZ(s.pos, p.pos);
    const sh = newShade(w, s.pos, s.id ?? null, s.pos[1] - (g === null ? 0 : g), s.state ?? (d <= R.shadeDetect ? 'chase' : 'wander'));
    if (sh.state === 'spawning') sh.spawnLeft = s.state_ticks_left ?? R.shadeSpawningTicks;
    if (sh.state === 'stunned') sh.stun = s.state_ticks_left ?? secondsToTicks(T.pulse_stun_s);
    if (sh.state === 'recoil') {
      sh.recoilLeft = s.state_ticks_left ?? R.recoilTicks;
      sh.recoilDir = awayDir(p.pos, sh.pos);
    }
    w.shades.push(sh);
  }
  for (const sh of w.shades) if (sh.id === null) sh.id = nextId(w, 'S', w.shades);
  w.shades.sort(byId);

  for (const d of sc.drifters || []) {
    const g = groundHeight(L, d.pos[0], d.pos[2]);
    w.drifters.push({
      id: d.id ?? null,
      pos: [...d.pos],
      hoverOff: d.pos[1] - (g === null ? 0 : g),
      state: d.state ?? 'idle',
      stolen: d.stolen ?? 0,
      hasStolen: (d.stolen ?? 0) > 0,
      fleeLeft: d.state === 'flee' ? d.state_ticks_left ?? R.drifterFleeTicks : 0,
      fleeDir: [1, 0],
      home: [d.pos[0], d.pos[2]],
      target: null,
    });
  }
  for (const d of w.drifters) if (d.id === null) d.id = nextId(w, 'D', w.drifters);
  w.drifters.sort(byId);

  if (sc.charms) {
    w.charms = sc.charms.map((c) => {
      const def = L.charms.find((x) => x.id === c.id);
      const available = c.available ?? true;
      return { id: c.id, pos: [...(c.pos ?? def?.pos ?? [0, 0, 0])], available, respawn: available ? 0 : c.respawn_ticks ?? R.charmRespawn };
    });
  }
}

// ---------------------------------------------------------------- helpers

function awayDir(from, to) {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const d = Math.hypot(dx, dz);
  return d < 1e-9 ? [1, 0] : [dx / d, dz / d]; // same position: push along +X
}

export function timeLeftExact(w) {
  return w.timeLeftAtStart - w.simTick / TICK_RATE;
}

/** Safe zone = lit lantern, radius safe_radius (Ticket-02). */
export function inSafeZone(w, pos) {
  return w.lanterns.some((L) => L.lit && distXZ(pos, L.pos) < w.T.safe_radius - EPS);
}

export function windAt(w, s = w.simTick) {
  if (!w.windEnabled) return { active: false, warn: false, dir: 0 };
  const k = Math.floor(s / R.windEvery);
  const active = k >= 1 && s - k * R.windEvery < R.windTicks;
  const gust = active ? k : k + 1;
  const warn = !active && gust * R.windEvery - s <= R.windWarn;
  const dir = Math.round(createRng(`${w.seed}|n${w.night}|wind|${gust}`)() * 360000) / 1000;
  return { active, warn, dir };
}

function moveXZ(w, ent, dx, dz, solid) {
  const ok = (x, z) => {
    if (insideObstacle(w.level, x, z, ent.pos[1])) return false;
    if (!solid) return true;
    const g = groundHeight(w.level, x, z);
    return g === null || g <= ent.pos[1] + R.stepUp;
  };
  const x0 = ent.pos[0];
  const z0 = ent.pos[2];
  if (ok(x0 + dx, z0 + dz)) {
    ent.pos[0] = x0 + dx;
    ent.pos[2] = z0 + dz;
    return true;
  }
  if (ok(x0 + dx, z0)) {
    ent.pos[0] = x0 + dx;
    return false;
  }
  if (ok(x0, z0 + dz)) ent.pos[2] = z0 + dz;
  return false;
}

/** Keeps a shade outside every lit lantern's safe zone; returns true if it was blocked. */
function blockAtSafeEdge(w, sh) {
  let blocked = false;
  const R6 = w.T.safe_radius;
  for (const L of w.lanterns) {
    if (!L.lit) continue;
    const d = distXZ(sh.pos, L.pos);
    if (d < R6 + SAFE_MARGIN - EPS) {
      const [ux, uz] = awayDir(L.pos, sh.pos);
      sh.pos[0] = L.pos[0] + ux * (R6 + SAFE_MARGIN);
      sh.pos[2] = L.pos[2] + uz * (R6 + SAFE_MARGIN);
      blocked = true;
    }
  }
  return blocked;
}

function moveFlyer(w, ent, tx, tz, speed, { stopAt = 0, shade = false } = {}) {
  const dx = tx - ent.pos[0];
  const dz = tz - ent.pos[2];
  const d = Math.hypot(dx, dz);
  if (d <= stopAt + 1e-9) return;
  const stepLen = Math.min(speed * DT, d - stopAt);
  moveXZ(w, ent, (dx / d) * stepLen, (dz / d) * stepLen, false);
  if (shade) blockAtSafeEdge(w, ent);
}

function dropMotes(w, center, n, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    let pos = null;
    for (let a = 0; a < 12 && !pos; a++) {
      const ang = w.rng.drops() * Math.PI * 2;
      const r = rMin + w.rng.drops() * (rMax - rMin);
      const x = center[0] + Math.cos(ang) * r;
      const z = center[2] + Math.sin(ang) * r;
      const g = groundHeight(w.level, x, z);
      if (g !== null && !insideObstacle(w.level, x, z, g)) pos = [r3(x), g, r3(z)];
    }
    if (!pos) {
      const g = groundHeight(w.level, center[0], center[2]);
      pos = [r3(center[0]), g === null ? r3(center[1]) : g, r3(center[2])];
    }
    addMote(w, pos, 'dropped', R.dropTtl);
  }
}

function endGame(w, result, reason, emit) {
  w.state = result;
  w.result = { result, reason, tick: w.tick };
  if (result === 'won') {
    const secondsLeft = Math.max(0, Math.floor(timeLeftExact(w) + EPS));
    w.score += secondsLeft * w.T.score.per_second_left + w.player.flames * w.T.score.per_flame_left;
  }
  emit('game_over', { result, reason });
}

// ---------------------------------------------------------------- step

/**
 * Advances one tick. Step k reads the input of tick k and produces tick k+1;
 * events carry tick = k+1. While paused the tick advances, the sim does not.
 */
export function step(w, rawInput) {
  if (w.state !== 'playing') return [];
  const T = w.T;
  const L = w.level;
  const p = w.player;
  const t = ++w.tick;
  const events = [];
  const emit = (name, data) => events.push({ tick: t, name, data });

  // 1. input; pause is handled first
  const inp = { ...defaultInput(), ...rawInput };
  const pressed = {};
  for (const b of BUTTONS) pressed[b] = Boolean(inp[b]) && !w.prev[b];
  for (const b of BUTTONS) w.prev[b] = Boolean(inp[b]);
  if (pressed.pause) {
    w.paused = !w.paused;
    emit(w.paused ? 'paused' : 'resumed', {});
    if (w.paused) return events;
  } else if (w.paused) {
    return events;
  }
  const s = ++w.simTick;
  const playing = () => w.state === 'playing';

  // 2. counters
  const dec = (v) => (v > 0 ? v - 1 : 0);
  p.invuln = dec(p.invuln);
  p.dashCd = dec(p.dashCd);
  p.dashLeft = dec(p.dashLeft);
  p.pulseCd = dec(p.pulseCd);
  p.charm = dec(p.charm);
  if (p.dead > 0 && --p.dead === 0) p.respawnNow = true;
  for (const sh of w.shades) {
    sh.stun = dec(sh.stun);
    sh.spawnLeft = dec(sh.spawnLeft);
  }
  w.drifters = w.drifters.filter((d) => d.state !== 'flee' || --d.fleeLeft > 0);
  w.motes = w.motes.filter((m) => m.kind !== 'dropped' || --m.ttl > 0);
  for (const c of w.charms) if (!c.available) c.respawn = dec(c.respawn);

  // 3. move Mây (jump, dash, pads, wind), then the fall check
  const wind = windAt(w, s);
  if (p.respawnNow) {
    p.respawnNow = false;
    p.pos = [...L.start];
    p.vel = [0, 0, 0];
    p.grounded = true;
    p.facing = 0;
    p.launch = null;
    p.dashLeft = 0;
    p.invuln = R.respawnInvuln;
  } else if (p.dead === 0) {
    let [mx, mz] = inp.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = (inp.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const moving = Math.hypot(wx, wz) > 1e-9;
    if (pressed.dash && p.dashLeft === 0 && (p.dashCd === 0 || p.charm > 0)) {
      let dir;
      if (p.launch) dir = awayDir([0, 0, 0], [p.launch.vx, 0, p.launch.vz]);
      else if (moving) dir = awayDir([0, 0, 0], [wx, 0, wz]);
      else dir = [Math.sin(p.facing), Math.cos(p.facing)];
      p.dashLeft = secondsToTicks(T.dash_duration_s);
      p.dashDir = dir;
      if (p.charm === 0) p.dashCd = secondsToTicks(T.dash_cooldown_s);
      w.stats.dashes++;
      emit('dash', {});
    }
    if (moving) p.facing = Math.atan2(wx, wz);
    const dashing = p.dashLeft > 0;
    if (pressed.jump && p.grounded && !dashing) {
      p.vel[1] = R.jumpSpeed;
      p.grounded = false;
      w.stats.jumps++;
    }
    let hx;
    let hz;
    if (dashing) {
      hx = p.dashDir[0] * T.dash_speed;
      hz = p.dashDir[1] * T.dash_speed;
    } else if (p.launch) {
      hx = p.launch.vx;
      hz = p.launch.vz;
    } else {
      const speed = p.charm > 0 ? R.charmSpeed : T.player_speed;
      hx = wx * speed;
      hz = wz * speed;
    }
    if (wind.active) {
      hx += R.windSpeed * Math.cos((wind.dir * Math.PI) / 180);
      hz += R.windSpeed * Math.sin((wind.dir * Math.PI) / 180);
    }
    if (!dashing && !p.grounded) p.vel[1] -= R.gravity * DT;
    moveXZ(w, p, hx * DT, hz * DT, true);
    if (!dashing && !p.grounded) p.pos[1] += p.vel[1] * DT;
    const g = groundHeight(L, p.pos[0], p.pos[2]);
    if (p.grounded) {
      if (g === null || g < p.pos[1] - R.snapDown) p.grounded = false;
      else p.pos[1] = g;
    } else if (!dashing && g !== null && p.pos[1] <= g + EPS && p.vel[1] <= 0) {
      p.pos[1] = g;
      p.grounded = true;
      p.launch = null;
    }
    p.vel = [hx, p.grounded ? 0 : p.vel[1], hz];
    if (p.grounded && !dashing) {
      for (const pad of L.pads) {
        if (distXZ(p.pos, pad.pos) <= pad.r + EPS && Math.abs(p.pos[1] - pad.pos[1]) < 0.05) {
          const dir = pad.dir ? [pad.dir[0], pad.dir[2]] : awayDir(pad.pos, pad.toward);
          p.launch = { vx: dir[0] * pad.speed, vz: dir[1] * pad.speed };
          p.vel = [p.launch.vx, pad.vy, p.launch.vz];
          p.grounded = false;
          break;
        }
      }
    }
    if (p.pos[1] < R.fallY) {
      p.flames = Math.max(0, p.flames - 1);
      const lost = p.carried;
      p.carried = 0;
      p.dead = R.fallWait;
      p.vel = [0, 0, 0];
      p.launch = null;
      p.dashLeft = 0;
      w.stats.falls++;
      emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
    }
  }
  const present = p.dead === 0;

  // 4. pick up motes and charms (XZ ≤ pickup_radius, height ≤ 1.5 m)
  const near = (pos) => distXZ(p.pos, pos) <= T.pickup_radius + EPS && Math.abs(p.pos[1] - pos[1]) <= R.pickupHeight + EPS;
  if (present) {
    const keep = [];
    for (const m of w.motes) {
      if (p.carried < T.carry_capacity && near(m.pos)) {
        p.carried += 1;
        w.stats.motesPicked++;
        emit('mote_picked', { carried: p.carried });
      } else {
        keep.push(m);
      }
    }
    w.motes = keep;
    for (const c of w.charms) {
      if (c.available && near(c.pos)) {
        c.available = false;
        c.respawn = R.charmRespawn;
        p.charm = R.charmTicks;
        w.stats.charms++;
        emit('charm_picked', { charm_id: c.id, charm_ticks: p.charm });
      }
    }
  }

  // 5. lanterns: nearest unlit in interact_radius, ties → smaller id
  const litNow = [];
  if (present && pressed.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const Ln of w.lanterns) {
      if (Ln.lit) continue;
      const d = distXZ(p.pos, Ln.pos);
      if (d > T.interact_radius + EPS) continue;
      if (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && byId(Ln, best) < 0)) {
        best = Ln;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, Math.max(0, T.lantern_cost - best.deposited));
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        w.score += amount * T.score.per_mote;
        w.stats.motesDeposited += amount;
        emit('deposit', { lantern_id: best.id, amount, deposited: best.deposited });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          w.score += T.score.per_lantern;
          w.stats.lanternsLit++;
          litNow.push(best);
          emit('lantern_lit', { lantern_id: best.id });
        }
      }
    }
  }

  // 6. safe zones: shades caught inside a lantern that just lit are expelled
  for (const Ln of litNow) {
    for (const sh of w.shades) {
      const d = distXZ(sh.pos, Ln.pos);
      if (d >= T.safe_radius) continue;
      sh.expel = { from: [Ln.pos[0], Ln.pos[2]], dir: awayDir(Ln.pos, sh.pos), left: R.safeExpelTicks };
    }
  }

  // 7. pulse (targets fixed now: 3D distance from feet + 0.8 m)
  if (present && pressed.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
    p.carried -= T.pulse_cost;
    p.pulseCd = secondsToTicks(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + R.pulseCenterY, p.pos[2]];
    const stunned = [];
    for (const sh of w.shades) {
      if (dist3(c, sh.pos) > T.pulse_radius + EPS) continue;
      sh.state = 'stunned';
      sh.stun = secondsToTicks(T.pulse_stun_s);
      sh.push = { dir: awayDir(p.pos, sh.pos), left: R.pulsePushTicks };
      sh.spawnLeft = 0;
      sh.recoilLeft = 0;
      stunned.push(sh.id);
    }
    w.score += stunned.length * T.score.per_stun;
    w.stats.stuns += stunned.length;
    w.stats.pulses++;
    emit('pulse', { stunned_ids: stunned });
    for (const d of w.drifters) {
      if (dist3(c, d.pos) > T.pulse_radius + EPS) continue;
      if (d.state === 'chase') {
        d.state = 'flee';
        d.fleeLeft = R.drifterFleeTicks;
        d.fleeDir = awayDir(p.pos, d.pos);
        d.hasStolen = true; // scared off before stealing: it leaves for good
      } else if (d.state === 'flee' && d.stolen > 0) {
        const amount = d.stolen;
        d.stolen = 0;
        d.fleeLeft = R.drifterDropVanish;
        dropMotes(w, d.pos, amount, 0, 0.6);
        emit('drifter_drop', { drifter_id: d.id, amount });
      }
    }
  }

  // 8. shades and drifters move
  if (playing()) {
    for (const sh of w.shades) {
      if (sh.expel) {
        const e = sh.expel;
        const target = T.safe_radius + SAFE_MARGIN;
        const d = Math.hypot(sh.pos[0] - e.from[0], sh.pos[2] - e.from[1]);
        const nd = d + (target - d) / e.left;
        sh.pos[0] = e.from[0] + e.dir[0] * nd;
        sh.pos[2] = e.from[1] + e.dir[1] * nd;
        if (--e.left <= 0) sh.expel = null;
      } else if (sh.state === 'spawning') {
        if (sh.spawnLeft === 0) sh.state = 'wander';
      } else if (sh.state === 'stunned' && sh.stun > 0) {
        if (sh.push && sh.push.left > 0) {
          const k = T.pulse_push_m / R.pulsePushTicks;
          const before = [sh.pos[0], sh.pos[2]];
          const free = moveXZ(w, sh, sh.push.dir[0] * k, sh.push.dir[1] * k, false);
          if (!free || blockAtSafeEdge(w, sh)) {
            sh.pos[0] = before[0];
            sh.pos[2] = before[1];
            sh.push.left = 0;
          } else {
            sh.push.left--;
          }
        }
      } else if (sh.state === 'recoil' && sh.recoilLeft > 0) {
        const k = R.recoilDist / R.recoilTicks;
        moveXZ(w, sh, sh.recoilDir[0] * k, sh.recoilDir[1] * k, false);
        blockAtSafeEdge(w, sh);
        sh.recoilLeft--;
      } else {
        if (sh.state === 'stunned') sh.state = 'wander';
        if (sh.state === 'recoil') sh.state = 'chase';
        const d = distXZ(sh.pos, p.pos);
        if (sh.state === 'wander' && present && d <= R.shadeDetect + EPS) sh.state = 'chase';
        else if (sh.state === 'chase' && (!present || d > R.shadeGiveUp + EPS)) sh.state = 'wander';
        if (sh.state === 'chase') {
          moveFlyer(w, sh, p.pos[0], p.pos[2], w.shadeSpeed, { shade: true });
        } else {
          let target = null;
          let best = Infinity;
          for (const Ln of w.lanterns) {
            if (Ln.lit) continue;
            const dl = distXZ(sh.pos, Ln.pos);
            if (dl < best - 1e-9 || (Math.abs(dl - best) <= 1e-9 && byId(Ln, target) < 0)) {
              best = dl;
              target = Ln;
            }
          }
          if (target) moveFlyer(w, sh, target.pos[0], target.pos[2], R.shadeWanderSpeed, { stopAt: 2.5, shade: true });
          else moveFlyer(w, sh, sh.home[0], sh.home[1], R.shadeWanderSpeed, { stopAt: 1, shade: true });
        }
      }
      sh.pos[1] = hoverY(w, sh.pos[0], sh.pos[2], sh.hoverOff);
    }
    for (const d of w.drifters) {
      if (d.state === 'flee') {
        if (present) d.fleeDir = awayDir(p.pos, d.pos);
        moveXZ(w, d, d.fleeDir[0] * R.drifterSpeed * DT, d.fleeDir[1] * R.drifterSpeed * DT, false);
      } else {
        const want = present && !d.hasStolen && p.carried >= R.drifterChaseCarry && distXZ(d.pos, p.pos) <= R.drifterChaseRange + EPS;
        d.state = want ? 'chase' : 'idle';
        if (want) {
          moveFlyer(w, d, p.pos[0], p.pos[2], R.drifterSpeed);
        } else {
          if (!d.target || Math.hypot(d.target[0] - d.pos[0], d.target[1] - d.pos[2]) < 0.5) {
            const a = w.rng.wander() * Math.PI * 2;
            const r = w.rng.wander() * 10;
            d.target = [d.home[0] + Math.cos(a) * r, d.home[1] + Math.sin(a) * r];
          }
          moveFlyer(w, d, d.target[0], d.target[1], R.drifterIdleSpeed);
        }
      }
      d.pos[1] = hoverY(w, d.pos[0], d.pos[2], d.hoverOff);
    }
  }

  // 9. contacts: drifters steal first, then shades hit (by id)
  if (playing() && present) {
    for (const d of w.drifters) {
      if (d.state !== 'chase' || d.hasStolen || p.carried === 0) continue;
      if (distXZ(d.pos, p.pos) > R.drifterHitRadius + EPS) continue;
      const amount = Math.min(R.drifterStealMax, p.carried);
      p.carried -= amount;
      d.stolen = amount;
      d.hasStolen = true;
      d.state = 'flee';
      d.fleeLeft = R.drifterFleeTicks;
      d.fleeDir = awayDir(p.pos, d.pos);
      w.stats.steals++;
      emit('drifter_steal', { drifter_id: d.id, amount, carried: p.carried });
    }
    for (const sh of w.shades) {
      if (sh.expel || (sh.state !== 'chase' && sh.state !== 'wander')) continue;
      if (distXZ(sh.pos, p.pos) > T.shade_hit_radius + EPS || Math.abs(sh.pos[1] - p.pos[1]) > R.hitHeight + EPS) continue;
      if (p.invuln > 0) continue; // touching while invulnerable does nothing
      p.flames = Math.max(0, p.flames - 1);
      const dropped = Math.floor(p.carried * T.hit_drop_ratio + EPS);
      p.carried -= dropped;
      p.invuln = secondsToTicks(T.invuln_s);
      if (dropped) dropMotes(w, p.pos, dropped, R.dropRingMin, R.dropRingMax);
      sh.state = 'recoil';
      sh.recoilLeft = R.recoilTicks;
      sh.recoilDir = awayDir(p.pos, sh.pos);
      w.stats.hits++;
      emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      break; // at most one flame per tick
    }
  }

  // 10. spawns (new entities act from the next tick)
  if (playing()) {
    if (w.randomMotes && s % R.moteSpawnEvery === 0 && w.motes.length < R.moteCap) {
      const taken = new Set(w.motes.map((m) => m.point));
      const empty = L.moteSpawns.map((_, i) => i).filter((i) => !taken.has(i));
      if (empty.length) {
        const i = empty[Math.floor(w.rng.motes() * empty.length)];
        addMote(w, L.moteSpawns[i], 'random', null, undefined, i);
      }
    }
    if (w.randomShades) {
      const every = L.shadeEveryS * TICK_RATE;
      const first = R.shadeFirstSpawnTick;
      const due = s === first ? R.shadeFirstBatch : s > first && (s - first) % every === 0 ? 1 : 0;
      const used = new Set();
      for (let n = 0; n < due && w.shades.length < L.shadeMax; n++) {
        const valid = L.shadeSpawns
          .map((_, i) => i)
          .filter((i) => !used.has(i) && distXZ(L.shadeSpawns[i], p.pos) >= R.shadeMinDist - EPS && !inSafeZone(w, L.shadeSpawns[i]));
        if (!valid.length) break;
        const i = valid[Math.floor(w.rng.shades() * valid.length)];
        used.add(i);
        const pt = L.shadeSpawns[i];
        const sh = newShade(w, [pt[0], hoverY(w, pt[0], pt[2], R.shadeHover), pt[2]], null, R.shadeHover, 'spawning');
        sh.spawnLeft = R.shadeSpawningTicks;
        w.shades.push(sh);
        emit('shade_spawned', { id: sh.id });
      }
    }
    if (w.randomDrifters && s % R.drifterSpawnEvery === 0 && w.drifters.length < R.drifterMax) {
      const valid = L.shadeSpawns.map((_, i) => i).filter((i) => distXZ(L.shadeSpawns[i], p.pos) >= R.shadeMinDist - EPS);
      if (valid.length) {
        const pt = L.shadeSpawns[valid[Math.floor(w.rng.drifters() * valid.length)]];
        w.drifters.push({
          id: nextId(w, 'D', w.drifters),
          pos: [pt[0], hoverY(w, pt[0], pt[2], R.drifterHover), pt[2]],
          hoverOff: R.drifterHover,
          state: 'idle',
          stolen: 0,
          hasStolen: false,
          fleeLeft: 0,
          fleeDir: [1, 0],
          home: [pt[0], pt[2]],
          target: null,
        });
      }
    }
    for (const c of w.charms) if (!c.available && c.respawn === 0) c.available = true;
  }

  // 11. win / lose (after every update of the tick)
  if (playing()) {
    if (p.flames <= 0) endGame(w, 'lost', 'no_flames', emit);
    else if (w.lanterns.every((Ln) => Ln.lit)) endGame(w, 'won', 'all_lit', emit);
    else if (timeLeftExact(w) <= EPS) endGame(w, 'lost', 'dawn', emit);
  }
  return events;
}

// ---------------------------------------------------------------- output

/** Snapshot object in Test Contract v1.1 shape. */
export function snapshot(w) {
  const p = w.player;
  const wind = windAt(w);
  return {
    type: 'snapshot',
    tick: w.tick,
    sim_tick: w.simTick,
    night: w.night,
    state: w.paused && w.state === 'playing' ? 'paused' : w.state,
    time_left_s: r3(Math.max(0, timeLeftExact(w))),
    score: w.score,
    wind: { active: wind.active, dir_deg: wind.dir },
    player: {
      pos: p.pos.map(r3),
      vel: p.vel.map(r3),
      grounded: p.grounded,
      flames: p.flames,
      carried: p.carried,
      invuln: p.invuln > 0,
      dash_cd_s: r3(p.dashCd / TICK_RATE),
      pulse_cd_s: r3(p.pulseCd / TICK_RATE),
      charm_s: r3(p.charm / TICK_RATE),
    },
    lanterns: w.lanterns.map((L) => ({ id: L.id, pos: L.pos.map(r3), lit: L.lit, deposited: L.deposited })),
    shades: w.shades.map((s) => ({ id: s.id, pos: s.pos.map(r3), state: s.state })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: m.pos.map(r3), kind: m.kind, ttl_s: m.kind === 'dropped' ? r3(m.ttl / TICK_RATE) : null })),
    drifters: w.drifters.map((d) => ({ id: d.id, pos: d.pos.map(r3), state: d.state, stolen: d.stolen })),
    charms: w.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TICK_RATE) })),
  };
}

// A simple autopilot used as evidence that a night can be played end-to-end.
// It plays through the real core (createWorld + step) and records the exact
// contract "frames" it pressed, so the run can be replayed by the headless CLI.
// Navigation is naive: good enough for Night 1 and Night 2 (bridge waypoints).

import { createWorld, step, distXZ, capacity, lightCost, FUEL_UNITS } from '../src/core/sim.js';

const round2 = (x) => Math.round(x * 100) / 100 || 0;

function islandSide(w, x) {
  if (w.night !== 2) return 0;
  return x < 35 ? 0 : 1;
}

/** Next point to walk to so that we never step off the islands. */
function waypoint(w, from, to) {
  if (w.night !== 2) return to;
  const a = islandSide(w, from[0]);
  const b = islandSide(w, to[0]);
  const onBridge = from[0] > 26 && from[0] < 44;
  if (a === b && !onBridge) return to;
  if (onBridge) {
    if (Math.abs(from[2]) > 0.6) return [from[0], 0, 0];
    return b === 1 ? [46, 0, 0] : [24, 0, 0];
  }
  const entry = a === 0 ? [25, 0, 0] : [45, 0, 0];
  return distXZ(from, entry) < 0.8 ? [a === 0 ? 30 : 40, 0, 0] : entry;
}

function decide(w) {
  const T = w.T;
  const p = w.player;
  const threats = w.shades
    .filter((s) => ['chase', 'wander', 'drain'].includes(s.state))
    .map((s) => ({ s, d: distXZ(s.pos, p.pos) }))
    .filter((x) => x.d < 6)
    .sort((a, b) => a.d - b.d);

  const canPulse = !w.prev.pulse && p.pulseCd === 0 && p.carried >= T.pulse_cost;
  const pulse = Boolean(canPulse && threats[0] && threats[0].d < 2.4 && ['chase', 'drain'].includes(threats[0].s.state));

  // Phase 3 strategy: relighting (5 motes → 100 fuel) is cheaper than refuelling (10 motes → 100 fuel),
  // so keep threshold + 1 lanterns lit by lighting/relighting and only top up when dawn is close.
  const fuel = (l) => l.fuel / FUEL_UNITS;
  const byDist = (a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos);
  const cap = capacity(w);
  const timeLeft = w.timeLeftAtStart - w.simTick / 60;
  const want = Math.ceil(T.win_ratio * w.lanterns.length) + 1;
  const litCount = w.lanterns.filter((l) => l.lit).length;
  const unlit = w.lanterns.filter((l) => !l.lit).sort(byDist);
  const dying = w.lanterns.filter((l) => l.lit && fuel(l) < Math.min(timeLeft + 2, 40)).sort(byDist);
  let goal = null;
  if (litCount < want && unlit.length && p.carried >= Math.min(cap, lightCost(T, unlit[0]) - unlit[0].deposited)) goal = unlit[0];
  else if (timeLeft < 60 && dying.length && p.carried >= 1) goal = dying[0];
  else if (p.carried >= cap && unlit.length) goal = unlit[0];

  let target = null;
  let interact = false;
  let pulseDrain = false;
  if (goal) {
    target = goal.pos;
    if (distXZ(goal.pos, p.pos) <= T.interact_radius - 0.3) interact = !w.prev.interact;
    pulseDrain = w.shades.some((s) => s.state === 'drain' && distXZ(s.pos, p.pos) < 4.5);
  } else if (w.motes.length) {
    let best = null;
    let bestCost = Infinity;
    for (const m of w.motes) {
      if (Math.abs(m.pos[1] - p.pos[1]) > 1.4) continue;
      let cost = distXZ(m.pos, p.pos) + (islandSide(w, m.pos[0]) !== islandSide(w, p.pos[0]) ? 30 : 0);
      for (const { s } of threats) cost += Math.max(0, 8 - distXZ(m.pos, s.pos)) * 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = m;
      }
    }
    target = best ? best.pos : null;
  }
  const pulseNow = pulse || Boolean(canPulse && pulseDrain);

  let dx = 0;
  let dz = 0;
  if (target) {
    const wp = waypoint(w, p.pos, target);
    dx = wp[0] - p.pos[0];
    dz = wp[2] - p.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 1e-6) {
      dx /= d;
      dz /= d;
    }
    if (d < 0.4) dx = dz = 0;
  }
  for (const { s, d } of threats) {
    if (s.state !== 'chase' || d < 1e-6 || d >= 4) continue;
    const k = ((4 - d) / 4) * 1.2;
    dx += ((p.pos[0] - s.pos[0]) / d) * k;
    dz += ((p.pos[2] - s.pos[2]) / d) * k;
  }
  const len = Math.hypot(dx, dz);
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  return { move: [round2(dx), round2(dz)], cam_yaw_deg: 0, jump: false, interact, pulse: pulseNow, dash: false, pause: false };
}

/** Plays a night; returns the recorded contract frames and the final world. */
export function playNight({ tuning, seed, night = 1, maxTicks = 60 * 60 * 10 }) {
  const world = createWorld({ tuning, night, seed });
  const frames = [];
  let last = '';
  for (let k = 0; k < maxTicks && world.state === 'playing'; k++) {
    const input = decide(world);
    const key = JSON.stringify(input);
    if (key !== last) {
      frames.push({ tick: k, ...input });
      last = key;
    }
    step(world, input);
  }
  return { frames, world };
}

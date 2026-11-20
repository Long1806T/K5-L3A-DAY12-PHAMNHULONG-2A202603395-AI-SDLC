// A simple autopilot used as evidence that Night 1 is winnable end-to-end.
// It plays through the real core (createWorld + step) and records the exact
// contract "frames" it pressed, so the run can be replayed by the headless CLI.

import { createWorld, step, distXZ } from '../src/core/sim.js';

const round2 = (x) => Math.round(x * 100) / 100 || 0;

function decide(w) {
  const T = w.T;
  const p = w.player;
  const nextTick = w.tick + 1;
  const threats = w.shades
    .filter((s) => s.state === 'chase')
    .map((s) => ({ s, d: distXZ(s.pos, p.pos) }))
    .sort((a, b) => a.d - b.d);

  // Pulse when a shade is about to touch us (release between presses).
  const canPulse = !w.prevButtons.pulse && nextTick >= p.pulseReadyAt && p.carried >= T.pulse_cost;
  const pulse = Boolean(canPulse && threats[0] && threats[0].d < T.shade_hit_radius + 1.6);

  const unlit = w.lanterns.filter((l) => !l.lit);
  let lantern = null;
  for (const l of unlit) if (!lantern || distXZ(l.pos, p.pos) < distXZ(lantern.pos, p.pos)) lantern = l;
  const need = lantern ? T.lantern_cost - lantern.deposited : Infinity;
  const wantDeposit =
    lantern && (p.carried >= Math.min(need + T.pulse_cost, T.carry_capacity) || (p.carried >= need && w.motes.length === 0));

  let target = null;
  let interact = false;
  if (wantDeposit) {
    target = lantern.pos;
    if (distXZ(lantern.pos, p.pos) <= T.interact_radius - 0.3) interact = !w.prevButtons.interact;
  } else if (w.motes.length) {
    let best = null;
    let bestCost = Infinity;
    for (const m of w.motes) {
      let cost = distXZ(m.pos, p.pos);
      for (const { s } of threats) cost += Math.max(0, 8 - distXZ(m.pos, s.pos)) * 2;
      if (cost < bestCost) {
        bestCost = cost;
        best = m;
      }
    }
    target = best.pos;
  } else if (lantern) {
    target = lantern.pos; // nothing to collect: wait in a safe zone
  }

  let dx = 0;
  let dz = 0;
  if (target) {
    dx = target[0] - p.pos[0];
    dz = target[2] - p.pos[2];
    const d = Math.hypot(dx, dz);
    if (d > 1e-6) {
      dx /= d;
      dz /= d;
    }
    if (d < 0.6) dx = dz = 0;
  }
  for (const { s, d } of threats) {
    if (d >= 5 || d < 1e-6) continue;
    const k = ((5 - d) / 5) * 1.6;
    dx += ((p.pos[0] - s.pos[0]) / d) * k;
    dz += ((p.pos[2] - s.pos[2]) / d) * k;
  }
  const len = Math.hypot(dx, dz);
  if (len > 1) {
    dx /= len;
    dz /= len;
  }
  // cam_yaw_deg 0: move x -> +X, z -> +Z.
  return { move: [round2(dx), round2(dz)], cam_yaw_deg: 0, jump: false, interact, pulse, dash: false };
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

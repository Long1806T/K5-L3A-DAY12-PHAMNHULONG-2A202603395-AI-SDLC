// P2-4, P2-6: standard maps of Ticket-02 Part 2 and Night 3 terrain behaviour.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getNight, groundHeight, insideObstacle } from '../src/core/level.js';
import { T, bare, sim } from './helpers.js';

const close = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const radii = (pts, cx = 0) => pts.map((p) => Math.round(Math.hypot(p[0] - cx, p[2]) * 100) / 100);

test('Night 1: island r=40, 5 lanterns, 8+16 mote points, 12 shade points at 37 m from 15°', () => {
  const n = getNight(1);
  assert.deepEqual(n.lanterns.map((l) => l.pos), [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]]);
  assert.deepEqual(radii(n.moteSpawns).sort((a, b) => a - b), [...Array(8).fill(12), ...Array(16).fill(33)]);
  assert.equal(n.shadeSpawns.length, 12);
  close(Math.atan2(n.shadeSpawns[0][2], n.shadeSpawns[0][0]) * (180 / Math.PI), 15);
  assert.equal(groundHeight(n, 39.9, 0), 0);
  assert.equal(groundHeight(n, 40.1, 0), null);
});

test('Night 2: two islands + bamboo bridge, 6 lanterns, pads, charm on the bridge', () => {
  const n = getNight(2);
  assert.equal(n.lanterns.length, 6);
  assert.deepEqual(n.lanterns.map((l) => l.id), ['L1', 'L2', 'L3', 'L4', 'L5', 'L6']);
  assert.equal(groundHeight(n, 35, 0), 0, 'bridge');
  assert.equal(groundHeight(n, 35, 2.5), null, 'no railing: off the bridge is sea');
  assert.equal(groundHeight(n, 70 + 27.9, 0), 0);
  assert.equal(n.moteSpawns.length, 24);
  assert.equal(n.shadeSpawns.length, 16);
  assert.deepEqual(n.charms, [{ id: 'C1', pos: [35, 0, 0] }]);
  assert.equal(T.night2_duration_s, 330);
});

test('Night 3: tiers, ramps at 30°/150°, tower; 30 mote points sit on the ground', () => {
  const n = getNight(3);
  assert.equal(n.lanterns.length, 7);
  assert.equal(groundHeight(n, 0, -30), 0);
  assert.equal(groundHeight(n, 0, 18), 3, 'tier 1 is on the z > 0 half');
  assert.equal(groundHeight(n, 0, -18), 0);
  assert.equal(groundHeight(n, 5, 0), 6, 'tier 2 disc');
  const a = Math.PI / 6;
  close(groundHeight(n, 27 * Math.cos(a), 27 * Math.sin(a)), 1.5);
  assert.equal(insideObstacle(n, 0.5, 0.5, 6), true, 'bell tower');
  assert.equal(n.moteSpawns.length, 30);
  for (const p of n.moteSpawns) assert.equal(groundHeight(n, p[0], p[2]), p[1], `mote point ${p}`);
  for (const l of n.lanterns) assert.equal(groundHeight(n, l.pos[0], l.pos[2]), l.pos[1], `lantern ${l.id}`);
  assert.equal(n.shadeSpawns.length, 16);
});

const n3 = (scenario, frames, ticks) => sim({ night: 3, scenario: bare(scenario), frames, ticks }).snaps[ticks].player;

test('Night 3 walls: cannot walk up onto tier 1, can walk off it, ramps lead up, the tower blocks', () => {
  let p = n3({ player: { pos: [0, 0, 26] } }, [{ tick: 0, move: [0, -1] }], 60);
  assert.ok(p.pos[2] >= 23.9 && p.pos[1] === 0, `blocked by the wall at ${p.pos}`);
  p = n3({ player: { pos: [0, 3, 20] } }, [{ tick: 0, move: [0, 1] }, { tick: 70, move: [0, 0] }], 120);
  assert.equal(p.pos[1], 0);
  assert.equal(p.grounded, true);
  const a = Math.PI / 6;
  p = n3({ player: { pos: [31 * Math.cos(a), 0, 31 * Math.sin(a)] } }, [{ tick: 0, move: [-Math.cos(a), -Math.sin(a)] }, { tick: 150, move: [0, 0] }], 160);
  assert.equal(p.pos[1], 3, 'walked up the ramp onto tier 1');
  p = n3({ player: { pos: [0, 6, 5] } }, [{ tick: 0, move: [0, -1] }], 60);
  assert.ok(p.pos[2] >= 2 - 1e-6, `tower stops at r=2, z=${p.pos[2]}`);
});

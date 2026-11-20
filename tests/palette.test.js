// P2-21: the standard palette of Ticket-02 and the ambient-light formula.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEX, RGB, ambientIntensity } from '../src/web/palette.js';

const TICKET = {
  sky: '#0E1430', fog: '#1B2350', grass: '#2F5D50', sand: '#C9B48A', wood: '#6B4A2F', cloudSea: '#12384A',
  lanternLit: '#FFB347', lanternCore: '#FFE9B0', lanternOff: '#5B5F6E', moteCore: '#FFF6C2', moteHalo: '#FFE58A',
  shadeBody: '#120A1A', shadeRim: '#7A3CFF', shadeStunned: '#3A3450', shirt: '#E8E2D0', scarf: '#C8102E',
  gold: '#F2C14E', drifter: '#8FA3B8', uiDanger: '#FF5A5F', uiText: '#F5F1E6',
};

test('palette colours match the ticket exactly (0% deviation, limit is 10% per channel)', () => {
  assert.deepEqual(HEX, TICKET);
  for (const [k, hex] of Object.entries(TICKET)) {
    const want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    RGB[k].forEach((c, i) => assert.ok(Math.abs(c - want[i]) <= 0.1, `${k}[${i}]`));
  }
});

test('ambient light = 0.15 + 0.55 × lit / total', () => {
  assert.equal(ambientIntensity(0, 5), 0.15);
  assert.ok(Math.abs(ambientIntensity(5, 5) - 0.7) < 1e-12);
  assert.ok(Math.abs(ambientIntensity(3, 6) - 0.425) < 1e-12);
});

test('index.html HUD uses the palette UI colours', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const hex of [TICKET.uiText, TICKET.uiDanger, TICKET.gold]) assert.ok(html.includes(hex), hex);
});

// Standard palette (Ticket-02, Part 3). Base material/UI colours; lighting is
// applied on top. Each entry keeps the ticket's hex so tests can compare.

export const HEX = Object.freeze({
  sky: '#0E1430',
  fog: '#1B2350',
  grass: '#2F5D50',
  sand: '#C9B48A',
  wood: '#6B4A2F',
  cloudSea: '#12384A',
  lanternLit: '#FFB347',
  lanternCore: '#FFE9B0',
  lanternOff: '#5B5F6E',
  moteCore: '#FFF6C2',
  moteHalo: '#FFE58A',
  shadeBody: '#120A1A',
  shadeRim: '#7A3CFF',
  shadeStunned: '#3A3450',
  shirt: '#E8E2D0',
  scarf: '#C8102E', // Mây's scarf and the Wind Charm
  gold: '#F2C14E', // gold trim, score
  drifter: '#8FA3B8',
  uiDanger: '#FF5A5F',
  uiText: '#F5F1E6',
});

export const hexToRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Same keys as HEX, as [r, g, b] in 0..1 for WebGL. */
export const RGB = Object.freeze(Object.fromEntries(Object.entries(HEX).map(([k, v]) => [k, hexToRgb(v)])));

/** Ambient light intensity from progress (Ticket-02): 0.15 + 0.55 × lit / total. */
export const ambientIntensity = (lit, total) => 0.15 + 0.55 * (total ? lit / total : 0);

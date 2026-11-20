// Level data. Numbers that the Test Contract asks for live in game.contract.json
// (tuning); this file only holds layout/spawn details that are not part of it.

const NIGHTS = {
  1: {
    id: 1,
    name: 'Đêm 1 – Đảo Bến',
    islandRadius: 45, // fall_enabled=false: the player is kept inside this radius
    playerStart: [0, 0, 0],
    // Pentagon of radius 25 m, L1 straight ahead (+Z) of the start point.
    lanterns: [
      { id: 'L1', pos: [0, 0, 25] },
      { id: 'L2', pos: [23.776, 0, 7.725] },
      { id: 'L3', pos: [14.695, 0, -20.225] },
      { id: 'L4', pos: [-14.695, 0, -20.225] },
      { id: 'L5', pos: [-23.776, 0, 7.725] },
    ],
    motes: {
      initial: 30,
      target: 30, // refill up to this many
      respawnEveryS: 2,
      minR: 4,
      maxR: 42,
      minDistFromPlayer: 6,
      minDistFromStart: 3,
      minDistFromLantern: 1.5,
    },
    shades: {
      initial: 3,
      max: 6,
      spawnEveryS: 25,
      minR: 28,
      maxR: 42,
      minDistFromPlayer: 18,
      extraLanternGap: 2, // keep spawns this far outside safe_radius
      emergeS: 1,
      hoverY: 1,
    },
  },
};

export function getNight(night) {
  const lv = NIGHTS[night];
  if (!lv) {
    const err = new Error(`night ${night} is not available (only: ${Object.keys(NIGHTS).join(', ')})`);
    err.code = 'BAD_NIGHT';
    throw err;
  }
  return lv;
}

export function availableNights() {
  return Object.keys(NIGHTS).map(Number);
}

// Standard numbers from Ticket-02 that are NOT keys of the contract's tuning.
// Contract keys (speeds, radii, costs, durations, score) are read from
// game.contract.json; never duplicate them here.

export const RULES = Object.freeze({
  // movement
  jumpSpeed: 7.0,
  gravity: 20,
  stepUp: 0.35, // highest ledge walked onto without jumping (tier walls are 3 m)
  snapDown: 0.35, // stay grounded when walking down slopes
  charmSpeed: 7.2,
  // motes
  pickupHeight: 1.5,
  moteInitial: 20,
  moteCap: 30,
  moteSpawnEvery: 240,
  dropRingMin: 1.5,
  dropRingMax: 2.5,
  dropTtl: 480,
  // hits & falls
  hitHeight: 1.5,
  recoilTicks: 60,
  recoilDist: 2,
  fallY: -10,
  fallWait: 60,
  respawnInvuln: 90,
  // pulse
  pulseCenterY: 0.8,
  pulsePushTicks: 15,
  // shades
  shadeDetect: 12,
  shadeGiveUp: 18,
  shadeFirstSpawnTick: 300,
  shadeFirstBatch: 2,
  shadeMinDist: 15,
  shadeSpawningTicks: 60,
  shadeHover: 1.0,
  shadeWanderSpeed: 2.0,
  safeExpelTicks: 30,
  // drifters (Gió Lạc)
  drifterSpeed: 7,
  drifterIdleSpeed: 2,
  drifterMax: 2,
  drifterSpawnEvery: 1200,
  drifterChaseCarry: 5,
  drifterChaseRange: 15,
  drifterHitRadius: 1.2,
  drifterStealMax: 3,
  drifterFleeTicks: 240,
  drifterDropVanish: 120,
  drifterHover: 1.2,
  // charms (Bùa Gió)
  charmTicks: 600,
  charmRespawn: 2700,
  // wind (Đêm 3)
  windEvery: 1800,
  windTicks: 300,
  windWarn: 120,
  windSpeed: 2,
});

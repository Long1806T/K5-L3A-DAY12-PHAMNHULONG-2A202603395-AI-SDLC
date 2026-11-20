// Turns the contract's sparse "frames" list into the held input for every tick.
// Defaults before the first frame: move [0,0], cam_yaw_deg 0, all buttons false.
// A frame only changes the fields it contains.

export function defaultInput() {
  return { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
}

export function createInputTimeline(frames = []) {
  const cur = defaultInput();
  let idx = 0;
  let lastTick = -1;
  /** Input held during tick `tick` (step k reads tick k). Ticks must be queried in order. */
  return function inputAt(tick) {
    if (tick < lastTick) throw new Error('input timeline must be read in tick order');
    lastTick = tick;
    while (idx < frames.length && frames[idx].tick <= tick) {
      const f = frames[idx++];
      if (f.move) cur.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      for (const b of ['jump', 'interact', 'pulse', 'dash', 'pause']) if (f[b] !== undefined) cur[b] = f[b];
    }
    return { ...cur, move: [cur.move[0], cur.move[1]] };
  };
}

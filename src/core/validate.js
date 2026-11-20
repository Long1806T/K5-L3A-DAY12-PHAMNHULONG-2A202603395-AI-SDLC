// Validation of the two Test Contract input files. Any problem throws
// ContractInputError, which the headless CLI maps to exit code 2.

export class ContractInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractInputError';
    this.exitCode = 2;
  }
}

const BUTTONS = ['jump', 'interact', 'pulse', 'dash', 'pause'];
const SHADE_STATES = ['spawning', 'wander', 'chase', 'recoil', 'stunned', 'drain'];
const DRIFTER_STATES = ['idle', 'chase', 'flee'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v) => Number.isInteger(v);

function fail(where, msg) {
  throw new ContractInputError(`${where}: ${msg}`);
}

function vec3(v, where) {
  if (!Array.isArray(v) || v.length !== 3 || !v.every(isNum)) fail(where, 'must be [x, y, z] with 3 finite numbers');
  return [v[0], v[1], v[2]];
}

function nonNegInt(v, where) {
  if (!isInt(v) || v < 0) fail(where, 'must be an integer >= 0');
  return v;
}

function bool(v, where) {
  if (typeof v !== 'boolean') fail(where, 'must be true or false');
  return v;
}

/** Validates an inputs file object; returns normalised frames. */
export function validateInputs(doc, name = 'inputs') {
  if (!isObj(doc)) fail(name, 'top level must be a JSON object');
  if (!Array.isArray(doc.frames)) fail(name, '"frames" must be an array');
  let lastTick = -1;
  return doc.frames.map((f, i) => {
    const where = `${name}.frames[${i}]`;
    if (!isObj(f)) fail(where, 'must be an object');
    if (!isInt(f.tick) || f.tick < 0) fail(`${where}.tick`, 'must be an integer >= 0');
    if (f.tick <= lastTick) fail(`${where}.tick`, `ticks must be strictly increasing (${f.tick} after ${lastTick})`);
    lastTick = f.tick;
    const out = { tick: f.tick };
    if ('move' in f) {
      const m = f.move;
      if (!Array.isArray(m) || m.length !== 2 || !m.every(isNum)) fail(`${where}.move`, 'must be [x, z] with 2 finite numbers');
      if (m.some((c) => c < -1 || c > 1)) fail(`${where}.move`, 'each component must be within [-1, 1]');
      out.move = [m[0], m[1]];
    }
    if ('cam_yaw_deg' in f) {
      if (!isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg`, 'must be a finite number');
      out.cam_yaw_deg = f.cam_yaw_deg;
    }
    for (const b of BUTTONS) if (b in f) out[b] = bool(f[b], `${where}.${b}`);
    return out;
  });
}

/** Validates a scenario file object against the level's lantern ids. */
export function validateScenario(doc, lanternIds, name = 'scenario') {
  if (!isObj(doc)) fail(name, 'top level must be a JSON object');
  const out = {};
  if ('player' in doc) {
    const p = doc.player;
    if (!isObj(p)) fail(`${name}.player`, 'must be an object');
    out.player = {};
    if ('pos' in p) out.player.pos = vec3(p.pos, `${name}.player.pos`);
    if ('carried' in p) out.player.carried = nonNegInt(p.carried, `${name}.player.carried`);
    if ('flames' in p) out.player.flames = nonNegInt(p.flames, `${name}.player.flames`);
    for (const k of ['invuln_ticks', 'dash_cd_ticks', 'pulse_cd_ticks', 'charm_ticks', 'successful_lights']) {
      if (k in p) out.player[k] = nonNegInt(p[k], `${name}.player.${k}`);
    }
  }
  if ('random_motes' in doc) out.random_motes = bool(doc.random_motes, `${name}.random_motes`);
  if ('random_shades' in doc) out.random_shades = bool(doc.random_shades, `${name}.random_shades`);
  if ('random_drifters' in doc) out.random_drifters = bool(doc.random_drifters, `${name}.random_drifters`);
  if ('wind_enabled' in doc) out.wind_enabled = bool(doc.wind_enabled, `${name}.wind_enabled`);
  if ('motes' in doc) {
    if (!Array.isArray(doc.motes)) fail(`${name}.motes`, 'must be an array');
    out.motes = doc.motes.map((m, i) => {
      const where = `${name}.motes[${i}]`;
      if (Array.isArray(m)) return { pos: vec3(m, where) };
      if (!isObj(m)) fail(where, 'must be [x, y, z] or {"id", "pos"}');
      if ('id' in m && typeof m.id !== 'string') fail(`${where}.id`, 'must be a string');
      const o = { id: m.id, pos: vec3(m.pos, `${where}.pos`) };
      if ('kind' in m) {
        if (!['random', 'dropped'].includes(m.kind)) fail(`${where}.kind`, 'must be "random" or "dropped"');
        o.kind = m.kind;
      }
      if ('ttl_ticks' in m) o.ttl_ticks = nonNegInt(m.ttl_ticks, `${where}.ttl_ticks`);
      if ('ttl_s' in m && m.ttl_s !== null) {
        if (!isNum(m.ttl_s) || m.ttl_s < 0) fail(`${where}.ttl_s`, 'must be a number >= 0');
        o.ttl_ticks = Math.round(m.ttl_s * 60);
      }
      return o;
    });
  }
  if ('shades' in doc) {
    if (!Array.isArray(doc.shades)) fail(`${name}.shades`, 'must be an array');
    out.shades = doc.shades.map((s, i) => {
      const where = `${name}.shades[${i}]`;
      if (!isObj(s)) fail(where, 'must be an object with "pos"');
      if ('id' in s && typeof s.id !== 'string') fail(`${where}.id`, 'must be a string');
      const o = { id: s.id, pos: vec3(s.pos, `${where}.pos`) };
      if ('state' in s) {
        if (!SHADE_STATES.includes(s.state)) fail(`${where}.state`, `must be one of ${SHADE_STATES.join(', ')}`);
        o.state = s.state;
      }
      if ('state_ticks_left' in s) o.state_ticks_left = nonNegInt(s.state_ticks_left, `${where}.state_ticks_left`);
      if ('target_lantern_id' in s) {
        if (typeof s.target_lantern_id !== 'string' || !lanternIds.includes(s.target_lantern_id)) fail(`${where}.target_lantern_id`, `must be one of ${lanternIds.join(', ')}`);
        o.target_lantern_id = s.target_lantern_id;
      }
      return o;
    });
    const ids = out.shades.map((s) => s.id).filter((id) => id !== undefined);
    if (new Set(ids).size !== ids.length) fail(`${name}.shades`, 'ids must be unique');
  }
  if ('drifters' in doc) {
    if (!Array.isArray(doc.drifters)) fail(`${name}.drifters`, 'must be an array');
    out.drifters = doc.drifters.map((d, i) => {
      const where = `${name}.drifters[${i}]`;
      if (!isObj(d)) fail(where, 'must be an object with "pos"');
      if ('id' in d && typeof d.id !== 'string') fail(`${where}.id`, 'must be a string');
      const o = { id: d.id, pos: vec3(d.pos, `${where}.pos`) };
      if ('state' in d) {
        if (!DRIFTER_STATES.includes(d.state)) fail(`${where}.state`, `must be one of ${DRIFTER_STATES.join(', ')}`);
        o.state = d.state;
      }
      if ('stolen' in d) o.stolen = nonNegInt(d.stolen, `${where}.stolen`);
      if ('state_ticks_left' in d) o.state_ticks_left = nonNegInt(d.state_ticks_left, `${where}.state_ticks_left`);
      return o;
    });
  }
  if ('charms' in doc) {
    if (!Array.isArray(doc.charms)) fail(`${name}.charms`, 'must be an array');
    out.charms = doc.charms.map((c, i) => {
      const where = `${name}.charms[${i}]`;
      if (!isObj(c) || typeof c.id !== 'string') fail(where, 'must be an object with a string "id"');
      const o = { id: c.id };
      if ('pos' in c) o.pos = vec3(c.pos, `${where}.pos`);
      if ('available' in c) o.available = bool(c.available, `${where}.available`);
      if ('respawn_ticks' in c) o.respawn_ticks = nonNegInt(c.respawn_ticks, `${where}.respawn_ticks`);
      if ('respawn_s' in c) {
        if (!isNum(c.respawn_s) || c.respawn_s < 0) fail(`${where}.respawn_s`, 'must be a number >= 0');
        o.respawn_ticks = Math.round(c.respawn_s * 60);
      }
      return o;
    });
  }
  if ('lanterns' in doc) {
    if (!Array.isArray(doc.lanterns)) fail(`${name}.lanterns`, 'must be an array');
    out.lanterns = doc.lanterns.map((l, i) => {
      const where = `${name}.lanterns[${i}]`;
      if (!isObj(l)) fail(where, 'must be an object');
      if (typeof l.id !== 'string' || !lanternIds.includes(l.id)) fail(`${where}.id`, `must be one of ${lanternIds.join(', ')}`);
      const o = { id: l.id };
      if ('pos' in l) o.pos = vec3(l.pos, `${where}.pos`);
      if ('deposited' in l) o.deposited = nonNegInt(l.deposited, `${where}.deposited`);
      if ('lit' in l) o.lit = bool(l.lit, `${where}.lit`);
      if ('ever_lit' in l) o.ever_lit = bool(l.ever_lit, `${where}.ever_lit`);
      if ('fuel' in l) {
        if (!isNum(l.fuel) || l.fuel < 0) fail(`${where}.fuel`, 'must be a number >= 0');
        o.fuel = l.fuel;
      }
      return o;
    });
  }
  if ('time_left_s' in doc) {
    if (!isNum(doc.time_left_s) || doc.time_left_s < 0) fail(`${name}.time_left_s`, 'must be a number >= 0');
    out.time_left_s = doc.time_left_s;
  }
  return out;
}

/** Parses JSON text, mapping syntax errors to ContractInputError. */
export function parseJsonText(text, name) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new ContractInputError(`${name}: invalid JSON (${e.message})`);
  }
}

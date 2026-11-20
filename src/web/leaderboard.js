// Local leaderboard rules (Ticket-04 §3), shared by the browser and tools/serve.js.
// Pure functions only: no DOM, no file system.

export const MAX_ENTRIES = 10;
const ISO_TZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;
// letters of any script (so Vietnamese with diacritics works), decimal digits, underscore
const NAME_CHARS = /^[\p{L}\p{M}\p{Nd}_]+$/u;

/** NFC-normalised, trimmed name. "Đăng" typed with combining marks equals the precomposed form. */
export const normalizeName = (raw) => String(raw ?? '').normalize('NFC').trim();

/** { ok, name, error } — 3–12 characters of [A-Za-z0-9_], Vietnamese letters also allowed. */
export function validateName(raw) {
  const name = normalizeName(raw);
  const len = [...name].length;
  if (len < 3 || len > 12) return { ok: false, name, error: 'Tên cần 3–12 ký tự' };
  if (!NAME_CHARS.test(name)) return { ok: false, name, error: 'Chỉ dùng chữ cái (có thể có dấu), chữ số và dấu _' };
  return { ok: true, name, error: null };
}

/** ISO 8601 with the local UTC offset, e.g. 2026-11-20T21:05:33+07:00. */
export function isoLocal(date = new Date()) {
  const pad = (n) => String(Math.trunc(Math.abs(n))).padStart(2, '0');
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`
  );
}

/** Seed as stored: a JSON number when it is a safe integer, else its canonical decimal text. */
export function seedValue(seed) {
  const n = Number(seed);
  return Number.isSafeInteger(n) && String(n) === String(seed).trim() ? n : String(seed);
}

/** Returns a clean entry { name, score, nights_won, achieved_at, seed } or throws Error(message). */
export function makeEntry(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('entry must be an object');
  const v = validateName(raw.name);
  if (!v.ok) throw new Error(v.error);
  if (!Number.isSafeInteger(raw.score) || raw.score < 0) throw new Error('score must be an integer ≥ 0');
  if (!Number.isInteger(raw.nights_won) || raw.nights_won < 0 || raw.nights_won > 3) throw new Error('nights_won must be 0–3');
  if (typeof raw.achieved_at !== 'string' || !ISO_TZ.test(raw.achieved_at) || Number.isNaN(Date.parse(raw.achieved_at))) {
    throw new Error('achieved_at must be ISO 8601 with a time zone');
  }
  const seedOk = (typeof raw.seed === 'number' && Number.isSafeInteger(raw.seed)) || (typeof raw.seed === 'string' && /^[+-]?\d+$/.test(raw.seed));
  if (!seedOk) throw new Error('seed must be an integer');
  return { name: v.name, score: raw.score, nights_won: raw.nights_won, achieved_at: raw.achieved_at, seed: seedValue(raw.seed) };
}

/** Score high → low; equal score: whoever got it first stays above. Stable for equal times. */
export function sortEntries(entries) {
  return entries
    .map((e, i) => [e, i])
    .sort(([a, ia], [b, ib]) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at) || ia - ib)
    .map(([e]) => e);
}

/** Cleans a stored list (drops invalid rows), sorts it and keeps the top 10. */
export function normalizeBoard(entries) {
  const clean = [];
  for (const e of Array.isArray(entries) ? entries : []) {
    try {
      clean.push(makeEntry(e));
    } catch {
      /* a hand-edited or corrupt row is skipped rather than breaking the board */
    }
  }
  return sortEntries(clean).slice(0, MAX_ENTRIES);
}

/** Adds an entry: returns { entries, rank } where rank is 1-based, or null when it missed the top 10. */
export function insertEntry(entries, raw) {
  const entry = makeEntry(raw);
  const all = sortEntries([...normalizeBoard(entries), entry]);
  const kept = all.slice(0, MAX_ENTRIES);
  const idx = kept.indexOf(entry);
  return { entries: kept, rank: idx === -1 ? null : idx + 1, entry };
}

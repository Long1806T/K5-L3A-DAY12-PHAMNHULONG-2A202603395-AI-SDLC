// Player settings, persisted in localStorage (kept between sessions).

const KEY = 'ddl.settings.v1';

/** Remappable actions (Ticket-04 §4) and their default keys (KeyboardEvent.code; Shift/Ctrl/Alt without side). */
export const DEFAULT_KEYS = Object.freeze({
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  jump: 'Space',
  dash: 'Shift',
  interact: 'KeyE',
  pulse: 'KeyF',
  pause: 'KeyP',
  camLeft: 'ArrowLeft',
  camRight: 'ArrowRight',
});

export const ACTIONS = [
  ['up', 'Đi tới'],
  ['down', 'Đi lùi'],
  ['left', 'Sang trái'],
  ['right', 'Sang phải'],
  ['jump', 'Nhảy'],
  ['dash', 'Lướt'],
  ['interact', 'Tương tác (thắp / châm dầu)'],
  ['pulse', 'Tỏa sáng'],
  ['pause', 'Tạm dừng'],
  ['camLeft', 'Xoay camera trái'],
  ['camRight', 'Xoay camera phải'],
];

/** Esc always pauses / goes back, so it cannot be given to an action. */
export const RESERVED_KEYS = ['Escape'];

export const DEFAULT_SETTINGS = Object.freeze({
  volume: 0.7, // 0..1
  sensitivity: 1.0, // mouse look multiplier
  colorBlind: false, // "Bảng màu dễ phân biệt" (Ticket-03)
  keys: DEFAULT_KEYS, // Ticket-04 key remapping
  subtitles: true, // captions + on-screen indicators for sound cues
  reducedMotion: false, // no camera shake, no screen flash
  largeText: false, // UI text × 1.25
  playerName: '', // last name typed for the leaderboard
});

/** Left/right modifier keys count as one key. */
export const normalizeCode = (code) => String(code).replace(/^(Shift|Control|Alt|Meta)(Left|Right)$/, '$1');

const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
export function keyLabel(code) {
  if (!code) return '—';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (ARROWS[code]) return ARROWS[code];
  return { Space: 'Space', Escape: 'Esc', Control: 'Ctrl', Meta: 'Win/⌘', Backquote: '`', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\' }[code] ?? code;
}

/** The other action already using `code`, or null. */
export function keyConflict(keys, action, code) {
  for (const [a] of ACTIONS) if (a !== action && keys[a] === code) return a;
  return null;
}

export function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved, keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage disabled: settings last for this session only */
  }
}

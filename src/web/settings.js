// Player settings, persisted in localStorage (kept between sessions).

const KEY = 'ddl.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  volume: 0.7, // 0..1
  sensitivity: 1.0, // mouse look multiplier
});

export function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode / storage disabled: settings last for this session only */
  }
}

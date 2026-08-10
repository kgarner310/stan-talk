/**
 * localStorage with a memory fallback. Private-mode Safari throws on write,
 * and losing a recent phrase must never take the whole board down with it.
 */

const mem = new Map();

export const KEYS = {
  recents: 'stan.recents.v1',
  people: 'stan.people.v1',
  settings: 'stan.settings.v1',
  // { [categoryId]: [{ icon, label }] } — his own words, added on the device.
  // Anything personal lives here and only here: drug names, clinicians,
  // appointments. It is never in the deployed app and never leaves the device.
  custom: 'stan.custom.v1',
};

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw);
  } catch {
    if (mem.has(key)) return mem.get(key);
  }
  return mem.has(key) ? mem.get(key) : fallback;
}

export function save(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* memory copy above keeps the current session working */
  }
}

export const DEFAULT_SETTINGS = {
  rate: 1,
  pitch: 1,
  voiceURI: null,
  speakEachTap: false,
  autoSpeakOnFinish: true,
  showWords: true,
  soundItOut: true,
};

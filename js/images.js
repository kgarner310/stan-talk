/**
 * Decides what picture a tile shows, in a strict cascade:
 *
 *   1. A photo taken on the device        — clearest of all, and personal
 *   2. A bundled ARASAAC pictogram        — purpose-built AAC symbol
 *   3. The emoji in vocabulary.js         — always present, zero setup
 *
 * The cascade is why the board is usable the moment it loads and gets better
 * as pictures are added, rather than needing all its artwork up front. Step 2
 * is empty until `tools/fetch-symbols.mjs` has been run — see the README.
 */

let symbolIndex = {};
let photos = new Map();

/** Load the manifest written by tools/fetch-symbols.mjs. Absent is fine. */
export async function loadSymbolIndex() {
  try {
    const res = await fetch('symbols/index.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    symbolIndex = data && typeof data.files === 'object' ? data.files : {};
  } catch {
    symbolIndex = {};
  }
}

export function setPhotos(map) {
  photos = map || new Map();
}

export function hasPhoto(id) {
  return photos.has(id);
}

export function setPhoto(id, dataUrl) {
  photos.set(id, dataUrl);
}

export function clearPhoto(id) {
  photos.delete(id);
}

export function symbolCount() {
  return Object.keys(symbolIndex).length;
}

/**
 * Returns { kind: 'photo'|'symbol'|'emoji', src?, glyph? } for a tile.
 * `id` identifies the tile for photo overrides; `emoji` is the fallback.
 */
export function mediaFor(id, emoji) {
  if (id && photos.has(id)) return { kind: 'photo', src: photos.get(id) };
  if (id && symbolIndex[id]) return { kind: 'symbol', src: `symbols/${symbolIndex[id]}` };
  return { kind: 'emoji', glyph: emoji || '▫️' };
}

/** Build the <img> or emoji <span> for a tile's picture area. */
export function mediaElement(id, emoji) {
  const media = mediaFor(id, emoji);
  if (media.kind === 'emoji') {
    const span = document.createElement('span');
    span.className = 'tile-emoji';
    span.textContent = media.glyph;
    return span;
  }
  const img = document.createElement('img');
  img.className = `tile-img tile-img-${media.kind}`;
  img.src = media.src;
  img.alt = '';
  img.decoding = 'async';
  // A broken symbol file must not leave a blank tile — fall back to emoji.
  img.addEventListener('error', () => {
    const span = document.createElement('span');
    span.className = 'tile-emoji';
    span.textContent = emoji || '▫️';
    img.replaceWith(span);
  });
  return img;
}

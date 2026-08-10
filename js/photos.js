/**
 * Per-tile photographs, stored on the device.
 *
 * A real photo of his wife beats any symbol for someone who reads poorly, so
 * any tile can be overridden with a picture taken on the phone. Photos are
 * downscaled hard before storage: an 8MP camera JPEG is ~4MB, a tile is never
 * shown larger than ~200px, and localStorage would blow its quota after two
 * of them. IndexedDB plus a 480px cap keeps a full board well under 2MB.
 */

const DB_NAME = 'stan-photos';
const STORE = 'photos';
const MAX_EDGE = 480;
const QUALITY = 0.82;

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('no indexeddb'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const req = fn(store);
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

/** Read every stored photo at once so tile rendering can stay synchronous. */
export async function loadAllPhotos() {
  const map = new Map();
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const t = db.transaction(STORE, 'readonly');
      const cursorReq = t.objectStore(STORE).openCursor();
      cursorReq.onsuccess = () => {
        const cur = cursorReq.result;
        if (!cur) {
          resolve();
          return;
        }
        map.set(cur.key, cur.value);
        cur.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    // No IndexedDB (private mode, ancient browser): the board still works,
    // it just falls back to symbols and emoji.
  }
  return map;
}

export async function putPhoto(id, dataUrl) {
  await tx('readwrite', (s) => s.put(dataUrl, id));
}

export async function deletePhoto(id) {
  await tx('readwrite', (s) => s.delete(id));
}

/**
 * Shrink a camera file to something a tile can use. Returns a JPEG data URL.
 * Uses createImageBitmap where available (it decodes off the main thread and
 * respects EXIF orientation) and falls back to an <img> decode elsewhere.
 */
export async function fileToTileImage(file) {
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  return canvas.toDataURL('image/jpeg', QUALITY);
}

function decode(file) {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => viaImg(file));
  }
  return viaImg(file);
}

function viaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('could not read that image'));
    };
    img.src = url;
  });
}

/**
 * Offline support. This is not a nicety: a communication board that stops
 * working in a hospital basement, a car park, or on a dead cell signal is a
 * board that cannot be trusted, and a device that can't be trusted gets left
 * at home.
 *
 * Strategy: precache the shell on install, then serve cache-first for
 * everything. Bump CACHE_VERSION whenever any app file changes, or devices
 * will keep serving the old board forever.
 */

const CACHE_VERSION = 'stan-v1';

const SHELL = [
  './',
  'index.html',
  'styles.css',
  'manifest.webmanifest',
  'js/app.js',
  'js/vocabulary.js',
  'js/speech.js',
  'js/storage.js',
  'js/images.js',
  'js/photos.js',
  'js/bodymap.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // addAll fails the whole install if any single file 404s; add them
      // individually so one missing optional asset can't block the update.
      await Promise.all(
        SHELL.map((url) => cache.add(url).catch(() => undefined))
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) {
        // Refresh in the background so the next launch is current, without
        // ever making the user wait on the network.
        event.waitUntil(update(request));
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response && response.ok && new URL(request.url).origin === self.location.origin) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        // Offline and uncached: for a navigation, fall back to the board.
        if (request.mode === 'navigate') {
          const shell = await caches.match('index.html');
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })()
  );
});

async function update(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION);
      await cache.put(request, response);
    }
  } catch {
    /* still offline; the cached copy stands */
  }
}

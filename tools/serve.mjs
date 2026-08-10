/**
 * Static file server for local testing: `npm start`.
 *
 * Exists so the app can be opened over http:// rather than file://. ES
 * modules, service workers, and the manifest are all blocked on file://, so
 * opening index.html directly shows a blank screen and misleads you into
 * thinking something is broken.
 *
 * Listens on all interfaces so a phone on the same wifi can reach it at
 * http://<your-computer-ip>:8080 — the fastest way to try it on the real
 * device before it's hosted anywhere.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { networkInterfaces } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path.endsWith('/')) path += 'index.html';

    const file = join(ROOT, path);
    if (!file.startsWith(ROOT)) {
      res.writeHead(403).end('forbidden');
      return;
    }

    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');

    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] || 'application/octet-stream',
      // Never cache during development, or the service worker and the browser
      // will conspire to show you yesterday's build.
      'cache-control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Stan is running.\n`);
  console.log(`    On this computer:  http://localhost:${PORT}`);
  for (const [name, addrs] of Object.entries(networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family === 'IPv4' && !a.internal) {
        console.log(`    On the phone/iPad: http://${a.address}:${PORT}   (${name}, same wifi)`);
      }
    }
  }
  console.log('');
});

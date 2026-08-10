/**
 * Generates the PWA icons: a blue rounded square with a white speech bubble.
 *
 * Written as a tiny PNG encoder rather than pulling in a graphics dependency —
 * the whole app is dependency-free and installable from a static host, and
 * three icon files are not worth breaking that for.
 *
 *   node tools/make-icons.mjs
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');

const BG = [29, 111, 224]; // --speak
const FG = [255, 255, 255];
const SS = 4; // supersampling factor, for smooth edges without a rasteriser

/** Rounded-rectangle coverage test in unit (0..1) space. */
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/** Point-in-triangle, for the speech bubble's tail. */
function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
  const s = ((bx - ax) * (py - ay) - (px - ax) * (by - ay)) / d;
  const t = ((px - ax) * (cy - ay) - (cx - ax) * (py - ay)) / d;
  return s >= 0 && t >= 0 && s + t <= 1;
}

function bubbleAt(u, v) {
  // Bubble body plus a tail dropping from the lower-left, in unit space.
  if (inRoundRect(u, v, 0.16, 0.2, 0.84, 0.66, 0.12)) return true;
  return inTriangle(u, v, 0.3, 0.62, 0.46, 0.62, 0.32, 0.82);
}

function renderIcon(size, { maskable = false } = {}) {
  // Maskable icons get cropped to a circle by the launcher, so keep the art
  // inside the safe zone by shrinking it toward the centre.
  const inset = maskable ? 0.14 : 0;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0;
      let fgHits = 0;

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          if (inRoundRect(u, v, 0, 0, 1, 1, maskable ? 0.5 : 0.22)) bgHits++;

          const bu = 0.5 + (u - 0.5) / (1 - inset * 2);
          const bv = 0.5 + (v - 0.5) / (1 - inset * 2);
          if (bubbleAt(bu, bv)) fgHits++;
        }
      }

      const total = SS * SS;
      const bgA = bgHits / total;
      const fgA = fgHits / total;
      const i = (y * size + x) * 4;

      // Composite: bubble over background over transparency.
      const a = Math.max(bgA, 0);
      const mix = (c) => Math.round(BG[c] * (1 - fgA) + FG[c] * fgA);
      pixels[i] = mix(0);
      pixels[i + 1] = mix(1);
      pixels[i + 2] = mix(2);
      pixels[i + 3] = Math.round(a * 255);
    }
  }

  return encodePng(size, size, pixels);
}

// --- Minimal PNG encoder ---------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Filter byte 0 (None) in front of every scanline.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Go --------------------------------------------------------------------

mkdirSync(OUT, { recursive: true });

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // iOS composites the home-screen icon onto its own rounded mask and does not
  // like transparency, so this one is drawn square and opaque.
  ['apple-touch-icon.png', 180, {}],
];

for (const [name, size, opts] of targets) {
  const png = renderIcon(size, opts);
  writeFileSync(join(OUT, name), png);
  console.log(`wrote icons/${name} (${size}x${size}, ${png.length} bytes)`);
}

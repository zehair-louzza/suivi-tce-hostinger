// Génère les icônes PNG de l'application installable (PWA) sans dépendance externe.
// Usage : node scripts/generate-pwa-icons.mjs
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.resolve('client/public/icons');
mkdirSync(OUT_DIR, { recursive: true });

// Logo ANELEC (repère 100x100) : « A » blanc + éclair jaune
const LETTER_A = [[50, 10], [14, 88], [33, 88], [42, 67], [58, 67], [50, 47], [67, 88], [86, 88]];
const BOLT = [[47, 54], [57, 54], [51, 69], [61, 69], [44, 92], [49, 73], [41, 73]];

function inPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedSquare(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius);
  const cy = Math.min(Math.max(y, radius), size - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

const lerp = (a, b, t) => a + (b - a) * t;
const C1 = [79, 70, 229]; // indigo
const C2 = [59, 130, 246]; // bleu
const C3 = [6, 182, 212]; // cyan

function gradient(t) {
  return t < 0.5
    ? C1.map((c, i) => lerp(c, C2[i], t * 2))
    : C2.map((c, i) => lerp(c, C3[i], (t - 0.5) * 2));
}

/**
 * @param size taille en pixels
 * @param opts.rounded coins arrondis transparents (icône « any »)
 * @param opts.logoScale part de l'icône occupée par le logo (zone sûre maskable ≈ 0.6)
 */
function renderIcon(size, { rounded, logoScale }) {
  const SS = 4; // sur-échantillonnage anti-crénelage
  const rgba = Buffer.alloc(size * size * 4);
  const radius = size * 0.22;
  const logoSize = size * logoScale;
  const offset = (size - logoSize) / 2;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          if (rounded && !inRoundedSquare(x, y, size, radius)) continue;

          let col = gradient((x + y) / (2 * size));
          // reflet « verre » en haut à gauche
          const d = Math.hypot(x - size * 0.25, y - size * 0.2) / size;
          const shine = Math.max(0, 0.32 - d) * 0.9;
          col = col.map((c) => lerp(c, 255, shine));

          const lx = ((x - offset) / logoSize) * 100;
          const ly = ((y - offset) / logoSize) * 100;
          if (inPolygon(lx, ly, BOLT)) col = [253, 224, 71];
          else if (inPolygon(lx, ly, LETTER_A)) col = [255, 255, 255];

          r += col[0]; g += col[1]; b += col[2]; a += 255;
        }
      }
      const n = SS * SS;
      const idx = (py * size + px) * 4;
      const cov = a / n;
      const div = a > 0 ? a / 255 : 1;
      rgba[idx] = Math.round(r / div);
      rgba[idx + 1] = Math.round(g / div);
      rgba[idx + 2] = Math.round(b / div);
      rgba[idx + 3] = Math.round(cov);
    }
  }
  return encodePNG(size, size, rgba);
}

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function encodePNG(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  { file: 'icon-192.png', size: 192, rounded: true, logoScale: 0.74 },
  { file: 'icon-512.png', size: 512, rounded: true, logoScale: 0.74 },
  { file: 'maskable-192.png', size: 192, rounded: false, logoScale: 0.56 },
  { file: 'maskable-512.png', size: 512, rounded: false, logoScale: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, rounded: false, logoScale: 0.68 },
  { file: 'favicon-32.png', size: 32, rounded: true, logoScale: 0.8 },
];

for (const t of targets) {
  writeFileSync(path.join(OUT_DIR, t.file), renderIcon(t.size, t));
  console.log(`✓ ${t.file}`);
}

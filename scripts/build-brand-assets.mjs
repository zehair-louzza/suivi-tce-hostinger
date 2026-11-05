// Génère toutes les déclinaisons du logo ANELEC GROUPE (site + application installable)
// à partir de scripts/anelec-logo-source.png, sans dépendance externe.
// Usage : node scripts/build-brand-assets.mjs
import { inflateSync, deflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('scripts/anelec-logo-source.png');
const BRAND_DIR = path.resolve('client/public/brand');
const ICON_DIR = path.resolve('client/public/icons');
mkdirSync(BRAND_DIR, { recursive: true });
mkdirSync(ICON_DIR, { recursive: true });

/* ----------------------------- Décodage PNG ----------------------------- */
function decodePNG(buf) {
  let pos = 8;
  let width = 0, height = 0, colorType = 0, depth = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      depth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8 || (colorType !== 6 && colorType !== 2)) {
    throw new Error(`Format PNG non supporté (depth=${depth}, colorType=${colorType})`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * bpp;
  const out = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = line[x * bpp];
      out[o + 1] = line[x * bpp + 1];
      out[o + 2] = line[x * bpp + 2];
      out[o + 3] = bpp === 4 ? line[x * bpp + 3] : 255;
    }
    prev = line;
  }
  return { width, height, data: out };
}

/* ----------------------------- Encodage PNG ----------------------------- */
const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function encodePNG({ width: w, height: h, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------ Outils image ----------------------------- */
const px = (img, x, y) => {
  const o = (y * img.width + x) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]];
};

// Composite sur blanc puis « dé-mélange » du blanc → fond transparent propre
function whiteToAlpha(img) {
  const out = Buffer.alloc(img.data.length);
  for (let i = 0; i < img.data.length; i += 4) {
    const a0 = img.data[i + 3] / 255;
    const r = img.data[i] * a0 + 255 * (1 - a0);
    const g = img.data[i + 1] * a0 + 255 * (1 - a0);
    const b = img.data[i + 2] * a0 + 255 * (1 - a0);
    const alpha = 1 - Math.min(r, g, b) / 255;
    if (alpha < 0.02) continue;
    const un = (c) => Math.max(0, Math.min(255, Math.round((c - 255 * (1 - alpha)) / alpha)));
    out[i] = un(r);
    out[i + 1] = un(g);
    out[i + 2] = un(b);
    out[i + 3] = Math.round(alpha * 255);
  }
  return { width: img.width, height: img.height, data: out };
}

function bbox(img, test) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (test(px(img, x, y))) {
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

function crop(img, { x0, y0, x1, y1 }, pad = 0) {
  const w = x1 - x0 + 1 + pad * 2;
  const h = y1 - y0 + 1 + pad * 2;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = x0 - pad + x, sy = y0 - pad + y;
      if (sx < 0 || sy < 0 || sx >= img.width || sy >= img.height) continue;
      const si = (sy * img.width + sx) * 4, di = (y * w + x) * 4;
      img.data.copy(out, di, si, si + 4);
    }
  }
  return { width: w, height: h, data: out };
}

// Redimensionnement par moyenne de zone (prémultiplié) : net et sans crénelage
function resize(img, w, h) {
  const out = Buffer.alloc(w * h * 4);
  const sx = img.width / w, sy = img.height / h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const xs = Math.floor(x * sx), xe = Math.max(xs + 1, Math.floor((x + 1) * sx));
      const ys = Math.floor(y * sy), ye = Math.max(ys + 1, Math.floor((y + 1) * sy));
      for (let yy = ys; yy < ye && yy < img.height; yy++) {
        for (let xx = xs; xx < xe && xx < img.width; xx++) {
          const [pr, pg, pb, pa] = px(img, xx, yy);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa; n++;
        }
      }
      const o = (y * w + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(a / n);
    }
  }
  return { width: w, height: h, data: out };
}

// Pose `mark` centré sur un carré (fond blanc, coins éventuellement arrondis)
function squareIcon(mark, size, { scale, rounded, background = [255, 255, 255] }) {
  const radius = size * 0.22;
  const out = Buffer.alloc(size * size * 4);
  const ratio = Math.min((size * scale) / mark.width, (size * scale) / mark.height);
  const mw = Math.max(1, Math.round(mark.width * ratio));
  const mh = Math.max(1, Math.round(mark.height * ratio));
  const m = resize(mark, mw, mh);
  const ox = Math.round((size - mw) / 2), oy = Math.round((size - mh) / 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let cov = 1;
      if (rounded) {
        // anti-crénelage des coins arrondis par sur-échantillonnage 4x4
        let hits = 0;
        for (let s = 0; s < 16; s++) {
          const fx = x + ((s % 4) + 0.5) / 4, fy = y + (Math.floor(s / 4) + 0.5) / 4;
          const cx = Math.min(Math.max(fx, radius), size - radius);
          const cy = Math.min(Math.max(fy, radius), size - radius);
          if ((fx - cx) ** 2 + (fy - cy) ** 2 <= radius ** 2) hits++;
        }
        cov = hits / 16;
      }
      if (cov === 0) continue;
      let [r, g, b] = background;
      const mx = x - ox, my = y - oy;
      if (mx >= 0 && my >= 0 && mx < mw && my < mh) {
        const [pr, pg, pb, pa] = px(m, mx, my);
        const t = pa / 255;
        r = pr * t + r * (1 - t);
        g = pg * t + g * (1 - t);
        b = pb * t + b * (1 - t);
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r);
      out[o + 1] = Math.round(g);
      out[o + 2] = Math.round(b);
      out[o + 3] = Math.round(cov * 255);
    }
  }
  return { width: size, height: size, data: out };
}

/* ------------------------------ Génération ------------------------------- */
const source = whiteToAlpha(decodePNG(readFileSync(SRC)));

// Logo complet (maison + ANELEC GROUPE + filet)
const fullBox = bbox(source, (p) => p[3] > 20);
const fullLogo = crop(source, fullBox, 12);
writeFileSync(path.join(BRAND_DIR, 'anelec-logo.png'), encodePNG(fullLogo));

// Version blanche pour fonds sombres (texte noir -> blanc, maison colorée conservée)
const whiteLogoData = Buffer.from(fullLogo.data);
for (let i = 0; i < whiteLogoData.length; i += 4) {
  const r = whiteLogoData[i], g = whiteLogoData[i + 1], b = whiteLogoData[i + 2], a = whiteLogoData[i + 3];
  if (a < 10) continue;
  const isCol = Math.max(r, g, b) - Math.min(r, g, b) > 35;
  if (!isCol) {
    whiteLogoData[i] = 255;
    whiteLogoData[i + 1] = 255;
    whiteLogoData[i + 2] = 255;
  }
}
const whiteLogo = { width: fullLogo.width, height: fullLogo.height, data: whiteLogoData };
writeFileSync(path.join(BRAND_DIR, 'anelec-logo-white.png'), encodePNG(whiteLogo));

// Pictogramme maison seul : pixels colorés (saturés) uniquement
const isColored = (p) => p[3] > 60 && Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) > 60;
const markBox = bbox(source, isColored);
const markRaw = crop(source, markBox, 6);
// on ne garde que les traits colorés (on retire un éventuel bout de texte noir)
for (let i = 0; i < markRaw.data.length; i += 4) {
  const [r, g, b] = [markRaw.data[i], markRaw.data[i + 1], markRaw.data[i + 2]];
  if (Math.max(r, g, b) - Math.min(r, g, b) < 40 && Math.max(r, g, b) < 120) markRaw.data[i + 3] = 0;
}
writeFileSync(path.join(BRAND_DIR, 'anelec-mark.png'), encodePNG(markRaw));
writeFileSync(path.join(BRAND_DIR, 'anelec-mark-256.png'), encodePNG(squareIcon(markRaw, 256, { scale: 0.92, rounded: false, background: [255, 255, 255] })));

const icons = [
  { file: 'icon-192.png', size: 192, scale: 0.7, rounded: true },
  { file: 'icon-512.png', size: 512, scale: 0.7, rounded: true },
  { file: 'maskable-192.png', size: 192, scale: 0.56, rounded: false },
  { file: 'maskable-512.png', size: 512, scale: 0.56, rounded: false },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.66, rounded: false },
  { file: 'favicon-32.png', size: 32, scale: 0.86, rounded: true },
];
for (const ic of icons) {
  writeFileSync(path.join(ICON_DIR, ic.file), encodePNG(squareIcon(markRaw, ic.size, ic)));
  console.log(`✓ icons/${ic.file}`);
}
console.log(`✓ brand/anelec-logo.png (${fullLogo.width}x${fullLogo.height})`);
console.log(`✓ brand/anelec-mark.png (${markRaw.width}x${markRaw.height})`);

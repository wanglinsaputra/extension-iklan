const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const S = 128;
const px = Buffer.alloc(S * S * 4);
const set = (x, y, r, g, b) => {
  if (x < 0 || y < 0 || x >= S || y >= S) return;
  const i = (y * S + x) * 4;
  px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
};

function inRoundRect(x, y) {
  const cx = Math.max(R, Math.min(S - R, x));
  const cy = Math.max(R, Math.min(S - R, y));
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= R * R;
}

function inTri(px, py) {
  const a = [46, 38], b = [96, 64], c = [46, 90];
  const s = (p1, p2, p) => (p2[0] - p1[0]) * (p[1] - p1[1]) - (p2[1] - p1[1]) * (p[0] - p1[0]);
  const d1 = s(a, b, [px, py]), d2 = s(b, c, [px, py]), d3 = s(c, a, [px, py]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

const SX1 = 24, SY1 = 104, SX2 = 104, SY2 = 24, SLASH_W = 7.5;
function inSlash(px, py) {
  const dx = SX2 - SX1, dy = SY2 - SY1;
  const dist = Math.abs(dx * (SY1 - py) - (SX1 - px) * dy) / Math.hypot(dx, dy);
  return dist < SLASH_W;
}

const R = 30;
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    if (!inRoundRect(x, y)) continue;
    if (inSlash(x, y)) set(x, y, 239, 68, 68);
    else if (inTri(x, y)) set(x, y, 248, 250, 252);
    else set(x, y, 15, 23, 42);
  }
}

function scale(src, sw, sh, tw, th) {
  const out = Buffer.alloc(tw * th * 4);
  for (let ty = 0; ty < th; ty++) {
    const y0 = Math.floor((ty * sh) / th), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * sh) / th));
    for (let tx = 0; tx < tw; tx++) {
      const x0 = Math.floor((tx * sw) / tw), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * sw) / tw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * sw + x) * 4;
          r += src[i]; g += src[i + 1]; b += src[i + 2]; a += src[i + 3]; n++;
        }
      const o = (ty * tw + tx) * 4;
      out[o] = Math.round(r / n); out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n); out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

const outDir = path.join(__dirname, '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const png = encodePNG(size, size, scale(px, S, S, size, size));
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`icons/icon${size}.png ${png.length}b`);
}
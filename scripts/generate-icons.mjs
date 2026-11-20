/**
 * Gera os ícones PNG do PWA sem dependências externas.
 *
 * Uso: node scripts/generate-icons.mjs
 * Saída: public/icons/icon-192.png, icon-512.png, maskable-512.png
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // profundidade
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0; // filtro none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (value) => Math.max(0, Math.min(1, value));
const smooth = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

function drawIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.78 : 1;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x - cx) / size;
      const ny = (y - cy) / size;

      // Fundo radial escuro
      const background = 1 - clamp(Math.hypot(nx, ny) * 1.6);
      let r = mix(5, 18, background);
      let g = mix(8, 32, background);
      let b = mix(20, 58, background);

      // Bolha principal
      const bubbleRadius = 0.31 * scale;
      const dist = Math.hypot(nx, ny);
      const bubble = 1 - smooth(bubbleRadius - 0.012, bubbleRadius + 0.004, dist);
      if (bubble > 0) {
        const t = clamp((nx + bubbleRadius) / (2 * bubbleRadius));
        const light = 1 - clamp(Math.hypot(nx + 0.1, ny + 0.12) * 2.4);
        const br = mix(mix(34, 26, t) + light * 90, 191, light * 0.8);
        const bg = mix(mix(211, 35, t) + light * 40, 244, light * 0.8);
        const bb = mix(mix(238, 126, t) + light * 20, 255, light * 0.8);
        r = mix(r, br, bubble);
        g = mix(g, bg, bubble);
        b = mix(b, bb, bubble);
      }

      // Anel externo suave
      const ring = 1 - smooth(0.0, 0.012, Math.abs(dist - 0.38 * scale));
      if (ring > 0) {
        r = mix(r, 34, ring * 0.55);
        g = mix(g, 211, ring * 0.55);
        b = mix(b, 238, ring * 0.55);
      }

      // Brilho superior esquerdo
      const highlight = 1 - smooth(0.0, 0.07, Math.hypot(nx + 0.11 * scale, ny + 0.13 * scale));
      if (highlight > 0) {
        r = mix(r, 235, highlight * 0.85);
        g = mix(g, 252, highlight * 0.85);
        b = mix(b, 255, highlight * 0.85);
      }

      const index = (y * size + x) * 4;
      pixels[index] = Math.round(r);
      pixels[index + 1] = Math.round(g);
      pixels[index + 2] = Math.round(b);
      pixels[index + 3] = 255;
    }
  }
  return encodePng(size, size, pixels);
}

const outputDir = join(root, 'public', 'icons');
mkdirSync(outputDir, { recursive: true });

writeFileSync(join(outputDir, 'icon-192.png'), drawIcon(192));
writeFileSync(join(outputDir, 'icon-512.png'), drawIcon(512));
writeFileSync(join(outputDir, 'maskable-512.png'), drawIcon(512, { maskable: true }));

console.log('Ícones gerados em public/icons');

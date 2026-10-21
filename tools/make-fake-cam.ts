// Writes Y4M videos of synthetic handwriting for Chrome's fake camera (end-to-end tests).
// Usage: node tools/make-fake-cam.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RGBAImage } from '../src/vision/types.ts';
import { loadBank } from '../test/helpers/load.ts';
import { makePage, type GlyphSpec } from '../test/helpers/synth.ts';

const OUT = fileURLToPath(new URL('../tools/train/out/', import.meta.url));
mkdirSync(OUT, { recursive: true });

function y4m(frames: RGBAImage[], fps = 15): Buffer {
  const { width: w, height: h } = frames[0];
  const head = Buffer.from(`YUV4MPEG2 W${w} H${h} F${fps}:1 Ip A1:1 C420jpeg\n`);
  const parts: Buffer[] = [head];
  for (const f of frames) {
    const Y = Buffer.alloc(w * h);
    const U = Buffer.alloc((w / 2) * (h / 2));
    const V = Buffer.alloc((w / 2) * (h / 2));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const r = f.data[o];
        const g = f.data[o + 1];
        const b = f.data[o + 2];
        Y[y * w + x] = Math.max(0, Math.min(255, 0.299 * r + 0.587 * g + 0.114 * b));
        if (!(x & 1) && !(y & 1)) {
          const i = (y / 2) * (w / 2) + x / 2;
          U[i] = Math.max(0, Math.min(255, 128 - 0.168736 * r - 0.331264 * g + 0.5 * b));
          V[i] = Math.max(0, Math.min(255, 128 + 0.5 * r - 0.418688 * g - 0.081312 * b));
        }
      }
    }
    parts.push(Buffer.from('FRAME\n'), Y, U, V);
  }
  return Buffer.concat(parts);
}

const bank = loadBank();
const blue: [number, number, number] = [35, 55, 150];
const row = (chars: string, y: number, extra: Partial<GlyphSpec>[] = []): GlyphSpec[] =>
  [...chars].map((char, i) => ({ char, x: 150 + i * 125, y, size: 85, pen: 7, color: blue, ...(extra[i % Math.max(1, extra.length)] ?? {}) }));

// single player sheet: neat, wobbly and very wobbly letters
const sheet = makePage(bank, {
  width: 1280,
  height: 720,
  shadow: 0.3,
  noise: 4,
  seed: 4,
  glyphs: [
    ...row('Haus12', 220, [{}, { jitter: 2, rotate: 0.1 }, {}, { jitter: 4.5, rotate: 0.3, shear: 0.3 }, {}, { jitter: 1.5 }]),
    ...row('Baum', 470, [{ jitter: 3, rotate: -0.15 }, {}, { jitter: 5, rotate: 0.25 }, {}]),
  ],
});
writeFileSync(OUT + 'fakecam-sheet.y4m', y4m(Array.from({ length: 8 }, () => sheet)));

// duel: slips on a dark table, red and blue pens
const red: [number, number, number] = [205, 35, 45];
const slips = [];
const glyphs: GlyphSpec[] = [];
const letters = ['A', 'b', 'K', '7', 'm', 'E', 'R', '3'];
for (let i = 0; i < 8; i++) {
  const x = 60 + (i % 4) * 300;
  const y = 70 + Math.floor(i / 4) * 320;
  slips.push({ x, y, w: 220, h: 220 });
  glyphs.push({ char: letters[i], x: x + 110, y: y + 110, size: 120, pen: 9, color: i % 2 ? blue : red, jitter: i % 3 === 2 ? 4 : 0.5, rotate: i % 3 === 2 ? 0.3 : 0 });
}
const duel = makePage(bank, { width: 1280, height: 720, noise: 4, seed: 9, slips, glyphs });
writeFileSync(OUT + 'fakecam-duel.y4m', y4m(Array.from({ length: 8 }, () => duel)));
console.log('wrote fake camera videos to', OUT);

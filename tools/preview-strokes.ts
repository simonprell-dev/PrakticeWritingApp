// Renders every animated template (stroke order, start numbers, arrows) to one PNG sheet.
// Usage: node tools/preview-strokes.ts [outDir] [kana for the animation sheet]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawGuideLines, drawSchoolLines, drawWriting, writeDuration, writtenGlyph, type WrittenGlyph } from '../src/game/strokes.ts';
import { KANA_STROKES } from '../src/game/kanaStrokes.ts';

const out = process.argv[2] ?? fileURLToPath(new URL('../tools/train/out/', import.meta.url));
mkdirSync(out, { recursive: true });
GlobalFonts.registerFromPath(fileURLToPath(new URL('../tools/train/fonts/Fredoka.ttf', import.meta.url)), 'Fredoka');
const sets = ['ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ', 'abcdefghijklmnopqrstuvwxyzäöüß', '0123456789'];
for (const grund of [false, true]) {
  const u = 46;
  const cols = 10;
  const cellW = 2.3 * u;
  const cellH = 4.4 * u;
  const chars = sets.join('');
  const rows = Math.ceil(chars.length / cols);
  const cv = createCanvas(cols * cellW, rows * cellH);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  [...chars].forEach((ch, i) => {
    const g = writtenGlyph(ch, grund)!;
    const cx = (i % cols) * cellW;
    const cy = Math.floor(i / cols) * cellH + 0.7 * u;
    drawSchoolLines(ctx, cx + 4, cx + cellW - 4, cy, u, 4);
    // half written: shows numbers, arrows and the direction of the current stroke
    drawWriting(ctx, g, cx + (cellW - g.w * u) / 2, cy, writeDuration(g) * 0.999, { unit: u, ink: '#5b3bd6', guides: true, ghost: true });
  });
  writeFileSync(`${out}/strokes-${grund ? 'grund' : 'druck'}.png`, cv.toBuffer('image/png'));
  console.log('wrote strokes', grund ? 'grund' : 'druck');
}

// kana (KanjiVG): every character finished, in its square box
{
  const u = 60;
  const cols = 10;
  const cell = 2.6 * u;
  const chars = Object.keys(KANA_STROKES);
  const rows = Math.ceil(chars.length / cols);
  const cv = createCanvas(cols * cell, rows * cell);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  chars.forEach((ch, i) => {
    const g = writtenGlyph(ch, false)!;
    const cx = (i % cols) * cell + (cell - g.w * u) / 2;
    const cy = Math.floor(i / cols) * cell + 0.3 * u;
    drawGuideLines(ctx, g, cx, cx + g.w * u, cy, u, 4);
    drawWriting(ctx, g, cx, cy, writeDuration(g) * 0.999, { unit: u, ink: '#5b3bd6', guides: true, ghost: true });
  });
  writeFileSync(`${out}/strokes-kana.png`, cv.toBuffer('image/png'));
  console.log('wrote strokes kana');
}

// a few kana while they are written: one row per character, columns at 15 %, 35 %, 55 %, 75 % and 100 %
{
  const u = 80;
  const cell = 2.5 * u;
  const chars = [...(process.argv[3] ?? 'あふをシツンぬね')];
  const steps = [0.15, 0.35, 0.55, 0.75, 0.999];
  const cv = createCanvas(steps.length * cell, chars.length * cell);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  chars.forEach((ch, r) => {
    const g = writtenGlyph(ch, false) as WrittenGlyph;
    steps.forEach((f, c) => {
      const cx = c * cell + (cell - g.w * u) / 2;
      const cy = r * cell + 0.25 * u;
      drawGuideLines(ctx, g, cx, cx + g.w * u, cy, u, 4);
      drawWriting(ctx, g, cx, cy, writeDuration(g) * f, { unit: u, ink: '#5b3bd6', guides: true, ghost: true });
    });
  });
  writeFileSync(`${out}/strokes-kana-anim.png`, cv.toBuffer('image/png'));
  console.log('wrote strokes kana animation');
}

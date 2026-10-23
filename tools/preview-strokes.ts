// Renders every animated template (stroke order, start numbers, arrows) to one PNG sheet.
// Usage: node tools/preview-strokes.ts [outDir]
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { drawSchoolLines, drawWriting, writeDuration, writtenGlyph } from '../src/game/strokes.ts';

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

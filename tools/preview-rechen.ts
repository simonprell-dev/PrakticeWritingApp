// Preview sheet for the Rechenmeer: every sea animal per tier, the plants and the visitors.
//   npx vite-node tools/preview-rechen.ts <outDir>   (vite-node: the Mal-Aquarium animals pull in i18n)
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { makeGenome } from '../src/game/creatures/genome.ts';
import { drawDolphin, drawShark, SEA_ANIMALS, seaSprite } from '../src/game/creatures/seaLife.ts';
import { drawBadgeSticker } from '../src/game/creatures/sprite.ts';
import { drawPlant, PLANT_KINDS } from '../src/game/math/seaPlants.ts';
import type { ScannedGlyph, Tier } from '../src/vision/types.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
GlobalFonts.registerFromPath(fileURLToPath(new URL('../public/fonts/PlaywriteDEGrund.woff2', import.meta.url)), 'Grundschrift');

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const TIERS: [Tier, number][] = [['zerknittert', 15], ['schief', 40], ['nett', 60], ['schoen', 80], ['prachtvoll', 96]];

function sticker(text: string): AnyCanvas {
  const c = createCanvas(60 * text.length, 104);
  const x = c.getContext('2d');
  x.fillStyle = '#2b2b7a';
  x.font = '81px Grundschrift, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, c.width / 2, 64);
  return c as unknown as AnyCanvas;
}

const CELL = 210;
const c = createCanvas(CELL * TIERS.length, CELL * SEA_ANIMALS.length + 700);
const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
ctx.fillStyle = '#38b2dd';
ctx.fillRect(0, 0, c.width, c.height);
SEA_ANIMALS.forEach((kind, row) =>
  TIERS.forEach(([tier, score], col) => {
    const sp = seaSprite(kind, makeGenome(score, tier, 5 + row, 'fish'), sticker(String(7 + row * 3)));
    ctx.save();
    ctx.translate(col * CELL + CELL / 2, row * CELL + CELL / 2);
    ctx.drawImage(sp.canvas as never, -sp.ax, -sp.ay);
    drawBadgeSticker(ctx, sp, 1);
    ctx.restore();
  }),
);
const y0 = CELL * SEA_ANIMALS.length;
ctx.fillStyle = '#f6dfac';
ctx.fillRect(0, y0 + 300, c.width, 40);
PLANT_KINDS.forEach((kind, i) =>
  [0.4, 1].forEach((grow, j) =>
    drawPlant(ctx, { kind, x: 90 + (i * 2 + j) * 170, tier: j ? 'prachtvoll' : 'nett', seed: 3 + i, born: 0, glyph: {} as ScannedGlyph, sticker: sticker('12') }, y0 + 310, 1.2, grow),
  ),
);
drawShark(ctx, 300, y0 + 500, 1, 0.4);
drawDolphin(ctx, 800, y0 + 480, 1, -0.4, 0.4);
writeFileSync(`${out}/rechen-sprites.png`, c.toBuffer('image/png'));
console.log('ok');

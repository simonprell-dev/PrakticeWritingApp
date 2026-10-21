// Renders a preview sheet of all creature types and tiers with @napi-rs/canvas (dev only).
// Usage: node tools/preview-creatures.ts [out.png]
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { alienSprite } from '../src/game/creatures/alien.ts';
import { bubbleSprite } from '../src/game/creatures/bubble.ts';
import { fighterSprite } from '../src/game/creatures/duelFigure.ts';
import { fishSprite } from '../src/game/creatures/fish.ts';
import { makeGenome, type Archetype } from '../src/game/creatures/genome.ts';
import { animalSprite } from '../src/game/creatures/savanna.ts';
import { drawBadgeSticker, type Sprite } from '../src/game/creatures/sprite.ts';
import { tierOf } from '../src/recog/score.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
GlobalFonts.registerFromPath(fileURLToPath(new URL('../tools/train/fonts/PatrickHand-Regular.ttf', import.meta.url)), 'Hand');

function sticker(ch: string, color: string): AnyCanvas {
  const c = createCanvas(60, 70);
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.font = '64px Hand';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(ch, 30, 38);
  return c as unknown as AnyCanvas;
}

const scores = [8, 38, 60, 80, 95];
const rows: { arche: Archetype; variant?: number; make: (g: ReturnType<typeof makeGenome>, s: AnyCanvas) => Sprite }[] = [
  { arche: 'fish', make: fishSprite },
  { arche: 'fish', make: fishSprite },
  { arche: 'alien', make: alienSprite },
  { arche: 'alien', make: alienSprite },
  ...[0, 1, 2, 3, 4].map((v) => ({ arche: 'animal' as Archetype, variant: v, make: animalSprite })),
  { arche: 'fighter', make: (g, s) => fighterSprite(g, s, 30 + 30 * g.q) },
];
const cell = 300;
const out = createCanvas(cell * scores.length, cell * rows.length);
const ctx = out.getContext('2d');
ctx.fillStyle = '#bfe6f5';
ctx.fillRect(0, 0, out.width, out.height);
rows.forEach((row, ri) => {
  scores.forEach((score, ci) => {
    let seed = ri * 1000 + ci * 17 + 3;
    let g = makeGenome(score, tierOf(score), seed, row.arche, ri % 2 ? 0 : 215);
    if (row.variant !== undefined) {
      while (g.variant !== row.variant) g = makeGenome(score, tierOf(score), ++seed, row.arche);
    }
    const sp = row.make(g, sticker('aBc3'[ci % 4], '#2a2a7a'));
    const ox = ci * cell + cell / 2;
    const oy = ri * cell + cell / 2;
    if (sp.tail) {
      ctx.drawImage(sp.tail.canvas as never, ox - sp.ax + sp.tail.px - sp.tail.pivotX, oy - sp.ay + sp.tail.py - sp.tail.pivotY);
    }
    ctx.drawImage(sp.canvas as never, ox - sp.ax, oy - sp.ay);
    ctx.save();
    ctx.translate(ox, oy);
    drawBadgeSticker(ctx as never, sp, 1);
    ctx.restore();
    ctx.fillStyle = '#123';
    ctx.font = '16px sans-serif';
    ctx.fillText(`${score} ${g.tier}`, ci * cell + 8, ri * cell + 20);
  });
});
ctx.drawImage(bubbleSprite(40, 0) as never, 10, 10);
const file = process.argv[2] ?? fileURLToPath(new URL('../tools/train/out/creatures.png', import.meta.url));
writeFileSync(file, out.toBuffer('image/png'));
console.log('wrote', file);

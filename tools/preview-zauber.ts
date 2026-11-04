// Preview sheets for the Zauberland figures and castle, to look at them without running the app.
//   node tools/preview-zauber.ts <outDir>            figures: every fable kind and the princess per tier
//   node tools/preview-zauber.ts <outDir> --castle   the castle with 2, 9 and 18 parts at 1280 and 1920
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { fableSprite } from '../src/game/creatures/fable.ts';
import { makeGenome, type Genome } from '../src/game/creatures/genome.ts';
import { princessBust, princessSprite } from '../src/game/creatures/princess.ts';
import { drawBadgeSticker, type Sprite } from '../src/game/creatures/sprite.ts';
import type { Tier } from '../src/vision/types.ts';
import { Castle } from '../src/game/castle/castle.ts';
import { CastleCache } from '../src/game/castle/castleDraw.ts';
import { paintZauberland } from '../src/game/castle/meadow.ts';
import { WORLD_H } from '../src/game/stage.ts';

// recog/score.ts pulls in i18n (import.meta.glob), which plain node cannot load
const tierOf = (s: number): Tier => (s < 30 ? 'zerknittert' : s < 50 ? 'schief' : s < 70 ? 'nett' : s < 88 ? 'schoen' : 'prachtvoll');

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
GlobalFonts.registerFromPath(fileURLToPath(new URL('../public/fonts/PlaywriteDEGrund.woff2', import.meta.url)), 'Grundschrift');

const out = process.argv[2] ?? '.';
mkdirSync(out, { recursive: true });
const SCORES = [10, 40, 60, 80, 97];

export function sticker(ch: string): AnyCanvas {
  const c = createCanvas(90, 104);
  const x = c.getContext('2d');
  x.fillStyle = '#2b2b7a';
  x.font = '81px Grundschrift, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(ch, 45, 64);
  return c as unknown as AnyCanvas;
}

export function genomeWith(score: number, variant: number, from = 1): Genome {
  for (let seed = from; ; seed++) {
    const g = makeGenome(score, tierOf(score), seed, 'fable');
    if (g.variant === variant) return g;
  }
}

function draw(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (sp.tail) ctx.drawImage(sp.tail.canvas as CanvasImageSource, sp.tail.px - sp.ax - sp.tail.pivotX, sp.tail.py - sp.ay - sp.tail.pivotY);
  ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
  drawBadgeSticker(ctx, sp, 1);
  ctx.restore();
}

if (!process.argv.includes('--castle')) {
  const cw = 300;
  const ch = 300;
  const cv = createCanvas(cw * 5, ch * 5);
  const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = '#f3ecff';
  ctx.fillRect(0, 0, cv.width, cv.height);
  SCORES.forEach((s, col) => {
    [0, 1, 2].forEach((v, row) => draw(ctx, fableSprite(genomeWith(s, v, 3 + col), sticker('ABCDE'[col])), col * cw + cw / 2, row * ch + ch * 0.62, 0.95));
    const g = genomeWith(s, 0, 11 + col * 7);
    draw(ctx, princessSprite(g, sticker('abcde'[col])), col * cw + cw * 0.3, 3 * ch + ch * 0.9, 0.95);
    draw(ctx, princessSprite(g, sticker('abcde'[col]), 'sit'), col * cw + cw * 0.72, 3 * ch + ch * 0.75, 0.95);
    // a princess riding a unicorn
    const uni = fableSprite(genomeWith(s, 0, 40 + col), null);
    const p = princessSprite(genomeWith(s, 0, 60 + col * 5), sticker('m'), 'sit');
    draw(ctx, uni, col * cw + cw * 0.5, 4 * ch + ch * 0.68, 0.9);
    draw(ctx, p, col * cw + cw * 0.5 + (uni.top.x - uni.ax) * 0.9, 4 * ch + ch * 0.68 + (uni.top.y - uni.ay) * 0.9, 0.9 * 0.75);
    const b = princessBust(g);
    ctx.drawImage(b as unknown as CanvasImageSource, col * cw + 6, 3 * ch + 6);
  });
  writeFileSync(`${out}/zauber-figures.png`, cv.toBuffer('image/png'));
  console.log(`${out}/zauber-figures.png`);
}

if (process.argv.includes('--castle')) {
  const tiers: Tier[] = ['zerknittert', 'schief', 'nett', 'schoen', 'prachtvoll'];
  for (const W of [1280, 1920]) {
    for (const n of [2, 9, 18]) {
      const c = new Castle();
      const stickers = new Map<number, AnyCanvas>();
      let k = 0;
      while (c.parts.length < n) {
        const id = 100 + k;
        stickers.set(id, sticker('ABCDEFGHIJKLMNOP'[k % 16]));
        c.add(c.nextSlot()!, { q: 0.5, tier: tiers[k % 5], glyphId: id });
        k++;
      }
      const cv = createCanvas(W, WORLD_H);
      const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
      paintZauberland(ctx, W, WORLD_H);
      ctx.drawImage(new CastleCache().get(c, W, stickers) as unknown as CanvasImageSource, 0, 0);
      const f = `${out}/zauber-castle-${W}-${n}.png`;
      writeFileSync(f, cv.toBuffer('image/png'));
      console.log(f);
    }
  }
}

// Mal-Aquarium previews (dev only, @napi-rs/canvas): the colouring sheet, a photographed and coloured card
// as the detection sees it, and the fish sprite made from it.
// Usage: node tools/preview-paint.ts [outDir]
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { drawCard } from '../src/game/paint/cardArt.ts';
import { CARD, SHEET, sheetLayout } from '../src/game/paint/fishCard.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
GlobalFonts.registerFromPath(fileURLToPath(new URL('../tools/train/fonts/Fredoka.ttf', import.meta.url)), 'Fredoka');

const out = process.argv[2] ?? fileURLToPath(new URL('../tools/train/out/', import.meta.url));
mkdirSync(out, { recursive: true });
const save = (name: string, c: { toBuffer(t: 'image/png'): Buffer }) => {
  writeFileSync(out + name, c.toBuffer('image/png'));
  console.log(out + name);
};

// the A4 sheet
{
  const k = 4;
  const c = createCanvas(SHEET.w * k, SHEET.h * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  const L = sheetLayout();
  for (const cell of L.cells) {
    ctx.save();
    ctx.translate(cell.x * k, cell.y * k);
    drawCard(ctx as unknown as CanvasRenderingContext2D, k);
    ctx.restore();
  }
  save('paint-sheet.png', c);
}

// one card, coloured
{
  const k = 8;
  const c = createCanvas((CARD.w + 10) * k, (CARD.h + 10) * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(5 * k, 5 * k);
  drawCard(ctx as unknown as CanvasRenderingContext2D, k, {
    fills: { body: '#ff9a3c', tail: '#ffd23c', dorsal: '#3cb4ff', anal: '#3cb4ff', pelvic: '#3cb4ff', pectoral: '#ff5a8a', water: '#d8f0ff' },
  });
  save('paint-card.png', c);
}

// a photographed card -> detection -> fish sprite, on water
{
  const { paperPicture, photo, pose } = await import('../test/helpers/cardScene.ts');
  const { findCards } = await import('../src/vision/cards.ts');
  const { paintedFishSprite, fishPicture } = await import('../src/game/creatures/paintedFish.ts');
  const look = { fills: { body: '#ff8a2a', tail: '#ffd23c', dorsal: '#2f9bff', anal: '#2f9bff', pelvic: '#2f9bff', pectoral: '#ff4f8a', water: '#bfe6ff' } };
  const img = photo(paperPicture('card', [look]), { width: 1280, height: 960, table: [60, 50, 44], corners: pose(100, 94, 7, 640, 480, 23, 0.05), noise: 8, texture: 0.35, cast: [1.05, 1, 0.88] });
  const res = findCards(img);
  console.log('cards', res.cards.length, res.cards.map((c) => [c.match, c.colored.toFixed(2)]), res.ms + ' ms');
  const sp = paintedFishSprite(res.cards[0].image, 3);
  const c = createCanvas(900, 420);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 420);
  g.addColorStop(0, '#8fe3f3');
  g.addColorStop(1, '#155f98');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 900, 420);
  ctx.drawImage(fishPicture(sp, 380) as unknown as Parameters<typeof ctx.drawImage>[0], 20, 60);
  ctx.save();
  ctx.translate(680, 210);
  ctx.scale(-0.7, 0.7);
  ctx.translate(-sp.ax, -sp.ay);
  ctx.drawImage(sp.tail!.canvas as unknown as Parameters<typeof ctx.drawImage>[0], 0, 0);
  ctx.drawImage(sp.canvas as unknown as Parameters<typeof ctx.drawImage>[0], 0, 0);
  ctx.restore();
  save('paint-fish.png', c);
}

// the Mal-Aquarium with a whole class of painted fish
{
  const { DEFAULTS } = await import('../src/app/settings.ts');
  const { PaintScene } = await import('../src/scenes/paintScene.ts');
  const { cardImage } = await import('../src/game/paint/cardArt.ts');
  const { thumbOf } = await import('../src/vision/cards.ts');
  const scene = new PaintScene({ settings: structuredClone(DEFAULTS), toast: () => undefined, showCard: () => undefined, progress: () => undefined }, 1920);
  const hues = ['#ff8a2a', '#3fc45a', '#8f6bff', '#ff5f8f', '#2f9bff', '#ffd23c', '#20c4b8', '#ff4040'];
  for (let i = 0; i < 24; i++) {
    const c = (k: number) => hues[(i * 3 + k) % hues.length];
    const img = cardImage({ fills: { body: c(0), tail: c(1), dorsal: c(2), anal: c(2), pelvic: c(2), pectoral: c(4) } });
    const { skin, sprite } = scene.makeSkin(img, thumbOf(img));
    const B = scene.bounds;
    scene.addPainted(skin, sprite, B.x0 + Math.random() * (B.x1 - B.x0), B.y0 + Math.random() * (B.y1 - B.y0), i === 23);
  }
  for (let t = 0; t < 3; t += 1 / 30) scene.update(1 / 30);
  const c = createCanvas(1920, 1080);
  scene.render(c.getContext('2d') as unknown as CanvasRenderingContext2D);
  save('paint-scene.png', c);
}

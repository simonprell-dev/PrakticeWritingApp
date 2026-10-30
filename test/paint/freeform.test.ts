import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { paintedSprite } from '../../src/game/creatures/paintedAnimal.ts';
import { cardImage } from '../../src/game/paint/cardArt.ts';
import { CARD, CARD_PX } from '../../src/game/paint/fishCard.ts';
import { freeformMask } from '../../src/game/paint/freeform.ts';
import { labelsFor } from '../../src/game/paint/sheets.ts';
import { colouredShare, findCards } from '../../src/vision/cards.ts';
import type { RGBAImage } from '../../src/vision/types.ts';
import { colourful, paperPicture, photo, pose } from '../helpers/cardScene.ts';

/** a card is blank below this share (paintScene.ts) */
const BLANK = 0.04;
const TW = Math.round(CARD.w * CARD_PX);
const TH = Math.round(CARD.h * CARD_PX);

type Draw = (ctx: CanvasRenderingContext2D) => void;
interface Blob { x: number; y: number; rx: number; ry: number; colour: string }

const ellipse = (b: Blob): Draw => (ctx) => {
  ctx.fillStyle = b.colour;
  ctx.beginPath();
  ctx.ellipse(b.x * CARD_PX, b.y * CARD_PX, b.rx * CARD_PX, b.ry * CARD_PX, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** a free-form card as the detection cuts it out, with something drawn on it */
function freeCard(...draws: Draw[]): RGBAImage {
  const img = cardImage({ species: 'freiform' });
  const c = createCanvas(TW, TH);
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
  const id = ctx.createImageData(TW, TH);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
  for (const d of draws) d(ctx);
  const out = ctx.getImageData(0, 0, TW, TH);
  return { width: TW, height: TH, data: new Uint8ClampedArray(out.data) };
}

/** which pixels the drawings cover (1 = covered) */
function truth(...draws: Draw[]): Uint8Array {
  const c = createCanvas(TW, TH);
  const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
  for (const d of draws) d(ctx);
  const a = ctx.getImageData(0, 0, TW, TH).data;
  const out = new Uint8Array(TW * TH);
  for (let i = 0; i < out.length; i++) out[i] = a[i * 4 + 3] > 128 ? 1 : 0;
  return out;
}

const share = (mask: Uint8Array, where: Uint8Array) => {
  let n = 0;
  let m = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!where[i]) continue;
    n++;
    m += mask[i];
  }
  return m / Math.max(1, n);
};

const RED: Blob = { x: 55, y: 28, rx: 14, ry: 9, colour: '#e8322a' };
const PALE: Blob = { x: 30, y: 60, rx: 12, ry: 7, colour: '#fff3a0' };

describe('free-form cut-out', () => {
  it('cuts out a red and a pale yellow blob, not the paper', () => {
    const mask = freeformMask(freeCard(ellipse(RED), ellipse(PALE)));
    expect(mask.length).toBe(TW * TH);
    const red = truth(ellipse(RED));
    const pale = truth(ellipse(PALE));
    expect(share(mask, red)).toBeGreaterThanOrEqual(0.9);
    expect(share(mask, pale)).toBeGreaterThanOrEqual(0.9);
    const paper = red.map((v, i) => (v || pale[i] ? 0 : 1));
    expect(share(mask, paper)).toBeLessThan(0.01);
  });

  it('leaves out the frame a drawing touches, the written name, the hint and the arrow', () => {
    const touching: Blob = { x: 8, y: 40, rx: 11, ry: 8, colour: '#2f6bff' };
    const nb = labelsFor('freiform').nameBox;
    const name: Draw = (ctx) => {
      // a name in pencil, on the line
      ctx.strokeStyle = '#2a2a33';
      ctx.lineWidth = 0.6 * CARD_PX;
      ctx.beginPath();
      for (let x = nb.x + 2, up = true; x < nb.x + nb.w - 4; x += 2.5, up = !up) ctx.lineTo(x * CARD_PX, (up ? nb.y + 3 : nb.y + 7.5) * CARD_PX);
      ctx.stroke();
    };
    const mask = freeformMask(freeCard(ellipse(touching), name));
    let frame = 0;
    let inName = 0;
    const f = CARD.frame * CARD_PX;
    for (let y = 0; y < TH; y++) {
      for (let x = 0; x < TW; x++) {
        const i = y * TW + x;
        if (x < f || y < f || x >= TW - f || y >= TH - f) frame += mask[i];
        if (y >= nb.y * CARD_PX) inName += mask[i];
      }
    }
    expect(frame).toBe(0);
    expect(inName).toBe(0);
    // the part of the blob inside the frame is there
    const blob = truth(ellipse(touching));
    const inside = blob.map((v, i) => (v && i % TW >= (CARD.frame + 1.2) * CARD_PX ? 1 : 0));
    expect(share(mask, inside)).toBeGreaterThanOrEqual(0.9);
    // everything else (hint box, its words, the arrow, the name line) is not
    const rest = blob.map((v) => (v ? 0 : 1));
    expect(share(mask, rest)).toBeLessThan(0.002);
  });

  it('fills a pencil outline drawn over the arrow, but leaves the rest of the arrow out', () => {
    // the head reaches into the arrow: the outline crosses the printed shaft
    const outline: Draw = (ctx) => {
      ctx.strokeStyle = '#333333';
      ctx.lineWidth = 0.7 * CARD_PX;
      ctx.beginPath();
      ctx.ellipse(50 * CARD_PX, 43 * CARD_PX, 24 * CARD_PX, 14 * CARD_PX, 0, 0, Math.PI * 2);
      ctx.stroke();
    };
    const mask = freeformMask(freeCard(outline));
    const inside = truth((ctx) => {
      ctx.beginPath();
      ctx.ellipse(50 * CARD_PX, 43 * CARD_PX, 23 * CARD_PX, 13 * CARD_PX, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    expect(share(mask, inside)).toBeGreaterThanOrEqual(0.95);
    // the arrow head (x 85 .. 88 mm) lies outside the drawing
    const head = new Uint8Array(TW * TH);
    for (let y = 45 * CARD_PX; y <= 51 * CARD_PX; y++) for (let x = 80 * CARD_PX; x <= 89 * CARD_PX; x++) head[y * TW + x] = 1;
    expect(share(mask, head)).toBe(0);
  });

  it('finds nothing on a blank free-form card', () => {
    const img = freeCard();
    expect(freeformMask(img).reduce((a, b) => a + b, 0)).toBe(0);
    expect(colouredShare(img, 'freiform')).toBeLessThan(BLANK);
  });

  it('in a photo: a blank card is not painted, pale crayon is', () => {
    const shot = (look: ReturnType<typeof colourful>) => {
      const pic = paperPicture('card', [look]);
      const m = CARD.margin;
      const res = findCards(photo(pic, { width: 1280, height: 960, table: [40, 34, 30], corners: pose(CARD.w + 2 * m, CARD.h + 2 * m, 6, 640, 480, 8), noise: 8, shadow: 0.2 }));
      expect(res.cards.map((c) => c.species)).toEqual(['freiform']);
      return res.cards[0];
    };
    const blank = shot({ species: 'freiform' });
    expect(blank.colored).toBeLessThan(BLANK);
    // not even a bit of the printed hint, arrow or name line
    expect(freeformMask(blank.image).reduce((a, b) => a + b, 0)).toBe(0);
    const pale = colourful('freiform');
    expect(shot({ ...pale, blob: { ...pale.blob!, colour: '#fff3a0' } }).colored).toBeGreaterThan(BLANK);
  });
});

describe('sprites of all animals', () => {
  it('the crab carries its claws as the moving part and walks', () => {
    const sp = paintedSprite('krebs', cardImage(colourful('krebs')));
    expect(sp.tail).toBeDefined();
    expect(sp.motion).toBe('walk');
    expect(sp.eyes).toHaveLength(2);
  });

  it('the fish swims with its tail', () => {
    const sp = paintedSprite('fisch', cardImage(colourful('fisch')));
    expect(sp.tail).toBeDefined();
    expect(sp.motion).toBe('swim');
    expect(sp.eyes).toHaveLength(1);
  });

  it('the free-form animal sways, has no tail and no eyes, and the paper is cut away', () => {
    const img = freeCard(ellipse(RED));
    const sp = paintedSprite('freiform', img);
    expect(sp.tail).toBeUndefined();
    expect(sp.eyes).toEqual([]);
    expect(sp.motion).toBe('sway');
    const { canvas } = sp;
    const d = (canvas as unknown as ReturnType<typeof createCanvas>).getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const at = (x: number, y: number) => d.slice((Math.round(y) * canvas.width + Math.round(x)) * 4, (Math.round(y) * canvas.width + Math.round(x)) * 4 + 4);
    // the corners are transparent, the middle is red
    expect(at(1, 1)[3]).toBe(0);
    expect(at(canvas.width - 2, canvas.height - 2)[3]).toBe(0);
    const mid = at(sp.ax, sp.ay);
    expect(mid[3]).toBe(255);
    expect(mid[0]).toBeGreaterThan(180);
    expect(mid[1]).toBeLessThan(90);
    // the sprite is about as wide as the blob (k px per fish unit, the fish unit is 0.82 mm), with its white edge
    const k = 2.6;
    const blobW = (2 * RED.rx * k) / 0.82;
    expect(canvas.width).toBeGreaterThan(blobW);
    expect(canvas.width).toBeLessThan(blobW + 60);
  });
});

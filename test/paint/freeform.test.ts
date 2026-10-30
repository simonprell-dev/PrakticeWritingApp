import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { paintedSprite } from '../../src/game/creatures/paintedAnimal.ts';
import { cardImage, type CardLook } from '../../src/game/paint/cardArt.ts';
import { CARD, CARD_PX } from '../../src/game/paint/fishCard.ts';
import { freeformMask } from '../../src/game/paint/freeform.ts';
import { labelsFor } from '../../src/game/paint/sheets.ts';
import { colouredShare, findCards } from '../../src/vision/cards.ts';
import type { RGBAImage } from '../../src/vision/types.ts';
import { colourful, paperPicture, photo, pose } from '../helpers/cardScene.ts';

/** a card is blank below this share: the same value as `BLANK` in src/scenes/paintScene.ts (not exported there) */
const BLANK = 0.04;
const TW = Math.round(CARD.w * CARD_PX);
const TH = Math.round(CARD.h * CARD_PX);

/** draws in card mm × k */
type Draw = (ctx: CanvasRenderingContext2D, k?: number) => void;
interface Blob { x: number; y: number; rx: number; ry: number; colour: string }

const ellipse = (b: Blob): Draw => (ctx, k = CARD_PX) => {
  ctx.fillStyle = b.colour;
  ctx.beginPath();
  ctx.ellipse(b.x * k, b.y * k, b.rx * k, b.ry * k, 0, 0, Math.PI * 2);
  ctx.fill();
};

/** crayon over the print: the printed lines show through */
const crayon = (b: Blob): Draw => (ctx, k) => {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ellipse(b)(ctx, k);
  ctx.restore();
};

/** a free-form card as the detection cuts it out, with something drawn on it */
function freeCard(...draws: Draw[]): RGBAImage {
  return onCard({ species: 'freiform' }, ...draws);
}

function onCard(look: CardLook, ...draws: Draw[]): RGBAImage {
  const img = cardImage(look);
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

/** the share of `where` that is in the mask, and the share of everything else (with a margin of `m` mm around `where`) */
function split(mask: Uint8Array, where: Uint8Array, m = 0): { on: number; off: number } {
  const grown = new Uint8Array(where);
  const r = Math.round(m * CARD_PX);
  if (r) {
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      if (!where[y * TW + x]) continue;
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const yy = y + dy;
        const xx = x + dx;
        if (yy >= 0 && xx >= 0 && yy < TH && xx < TW) grown[yy * TW + xx] = 1;
      }
    }
  }
  return { on: share(mask, where), off: share(mask, grown.map((v) => 1 - v)) };
}

/** a free-form card photographed (lit from one side when `shadow` is set) and cut out by the detection */
function shot(look: CardLook, spec: { shadow?: number; texture?: number }, ...draws: Draw[]): RGBAImage {
  const pic = paperPicture('card', [look]);
  const ctx = pic.canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
  const k = 6;
  const m = CARD.margin;
  ctx.save();
  // (paperPicture leaves its context moved to the card)
  ctx.setTransform(1, 0, 0, 1, m * k, m * k);
  for (const d of draws) d(ctx, k);
  ctx.restore();
  const res = findCards(photo(pic, { width: 1280, height: 960, table: [40, 34, 30], corners: pose(CARD.w + 2 * m, CARD.h + 2 * m, 6, 640, 480, 0), noise: 8, ...spec }));
  expect(res.cards.map((c) => c.species)).toEqual(['freiform']);
  return res.cards[0].image;
}

describe('free-form cut-out over the print, in the shade and on painted water', () => {
  const head = (() => {
    // the printed arrow head, right of every blob below
    const out = new Uint8Array(TW * TH);
    for (let y = 45 * CARD_PX; y <= 51 * CARD_PX; y++) for (let x = 82 * CARD_PX; x <= 89 * CARD_PX; x++) out[y * TW + x] = 1;
    return out;
  })();

  // dark crayon, pale yellow, and a very pale apricot (max - min = 55)
  for (const colour of ['#3a3030', '#fff3a0', '#ffe8c8']) {
    it(`a ${colour} fill ending in the arrow band keeps its part over the print`, () => {
      // the head of the animal reaches into the words and the shaft of the arrow
      const blob: Blob = { x: 58, y: 45, rx: 18, ry: 9, colour };
      const mask = freeformMask(freeCard(crayon(blob)));
      const { on, off } = split(mask, truth(ellipse(blob)), 0.5);
      expect(on).toBeGreaterThanOrEqual(0.9);
      expect(off).toBeLessThan(0.002);
      expect(share(mask, head)).toBe(0);
    });

    it(`a ${colour} fill crossing the hint box keeps its part over the print`, () => {
      const blob: Blob = { x: 52, y: 13, rx: 13, ry: 6.5, colour };
      const mask = freeformMask(freeCard(crayon(blob)));
      const { on, off } = split(mask, truth(ellipse(blob)), 0.5);
      expect(on).toBeGreaterThanOrEqual(0.9);
      expect(off).toBeLessThan(0.002);
    });
  }

  it('a card in strong shade from one side: the paper stays paper', () => {
    for (const shadow of [0.6, 0.8]) {
      const img = shot({ species: 'freiform' }, { shadow }, ellipse(RED), ellipse(PALE));
      const mask = freeformMask(img);
      expect(share(mask, truth(ellipse(RED)))).toBeGreaterThanOrEqual(0.9);
      expect(share(mask, truth(ellipse(PALE)))).toBeGreaterThanOrEqual(0.9);
      const { off } = split(mask, truth(ellipse(RED), ellipse(PALE)), 1);
      expect(off, `shadow ${shadow}`).toBeLessThan(0.01);
    }
  });

  const WATER = '#bfe6ff';
  const animals: Blob[] = [
    { x: 45, y: 40, rx: 20, ry: 12, colour: '#e8322a' },
    { x: 45, y: 40, rx: 20, ry: 12, colour: '#ffd23c' },
  ];
  /** the free area painted as water, leaving a white strip of 2 mm along the frame */
  const water: Draw = (ctx, k = CARD_PX) => {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = WATER;
    const e = CARD.frame + 2;
    ctx.fillRect(e * k, e * k, (CARD.w - 2 * e) * k, (labelsFor('freiform').nameBox.y - e) * k);
    ctx.restore();
  };
  const waterArea = () => truth((ctx) => water(ctx));

  for (const a of animals) {
    it(`a ${a.colour} animal on painted water: the water is background`, () => {
      const animal = truth(ellipse(a));
      const wet = waterArea().map((v, i) => (v && !animal[i] ? 1 : 0));
      const mask = freeformMask(freeCard(water, ellipse(a)));
      expect(share(mask, animal)).toBeGreaterThanOrEqual(0.9);
      expect(share(mask, wet)).toBeLessThan(0.05);
    });

    it(`a ${a.colour} animal on water up to the frame: the water is background`, () => {
      const animal = truth(ellipse(a));
      const mask = freeformMask(onCard({ species: 'freiform', fills: { water: WATER } }, ellipse(a)));
      const band = (CARD.frame + 1) * CARD_PX;
      const wet = animal.map((v, i) => (!v && i % TW > band && i % TW < TW - band && i / TW > band && i / TW < labelsFor('freiform').nameBox.y * CARD_PX ? 1 : 0));
      expect(share(mask, animal)).toBeGreaterThanOrEqual(0.9);
      expect(share(mask, wet)).toBeLessThan(0.05);
    });
  }

  it('a photo of an animal on water, with crayon texture', () => {
    const a = animals[0];
    const img = shot({ species: 'freiform' }, { texture: 0.35, shadow: 0.3 }, water, ellipse(a));
    const mask = freeformMask(img);
    const animal = truth(ellipse(a));
    expect(share(mask, animal)).toBeGreaterThanOrEqual(0.9);
    const { off } = split(mask, animal, 1);
    expect(off).toBeLessThan(0.05);
  });
});

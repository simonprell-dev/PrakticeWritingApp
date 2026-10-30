import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { nameCrop } from '../../src/game/creatures/paintedFish.ts';
import { cardImage, type CardLook } from '../../src/game/paint/cardArt.ts';
import { CARD, CARD_PX, LABELS, SHEET } from '../../src/game/paint/fishCard.ts';
import { MIX_A, MIX_B } from '../../src/game/paint/sheets.ts';
import { ANIMALS, type SpeciesId } from '../../src/game/paint/species.ts';
import { findCards, thumbDistance } from '../../src/vision/cards.ts';
import type { RGBAImage } from '../../src/vision/types.ts';
import { colourful, drawLook, paperPicture, photo, pose, type SceneLook } from '../helpers/cardScene.ts';

const ORANGE: CardLook = { fills: { body: '#ff8a2a', tail: '#ffd23c', dorsal: '#2f9bff', anal: '#2f9bff', pelvic: '#2f9bff', pectoral: '#ff4f8a' } };
const GREEN: CardLook = { fills: { body: '#3fc45a', tail: '#9b5cff', dorsal: '#ffd23c', anal: '#ffd23c', pelvic: '#ffd23c', pectoral: '#ff9a3c', water: '#bfe6ff' } };
const NIGHT: CardLook = { fills: { body: '#ffd23c', tail: '#ff6a3c', dorsal: '#ff6a3c', anal: '#ff6a3c', pelvic: '#ff6a3c', pectoral: '#ff6a3c', water: '#1d2f7a' } };

/** how far a cut out card is from the flat card art (mean luminance difference 0..1, upright) */
function diffToArt(img: RGBAImage, look: SceneLook): number {
  const ref = createCanvas(img.width, img.height);
  const ctx = ref.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, img.width, img.height);
  drawLook(ctx as unknown as CanvasRenderingContext2D, CARD_PX, look);
  const r = ctx.getImageData(0, 0, img.width, img.height).data;
  let s = 0;
  let n = 0;
  for (let i = 0; i < r.length; i += 16) {
    const a = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 765;
    const b = (r[i] + r[i + 1] + r[i + 2]) / 765;
    s += Math.abs(a - b);
    n++;
  }
  return s / n;
}

describe('colouring cards', () => {
  it('finds all six cards of a sheet, upright, and tells coloured from blank ones', () => {
    const looks = [ORANGE, {}, GREEN, {}, NIGHT, {}];
    const pic = paperPicture('sheet', looks);
    const img = photo(pic, {
      width: 1600,
      height: 1200,
      table: [92, 74, 60],
      corners: pose(SHEET.w, SHEET.h, 3.7, 800, 600, 94, 0.06),
      shadow: 0.25,
      noise: 10,
      texture: 0.35,
      cast: [1.02, 0.98, 0.9],
    });
    const res = findCards(img);
    expect(res.cards.length).toBe(6);
    // the sheet lies on its side, so the order in the photo is not the order on the sheet: match by look
    const coloured = res.cards.filter((c) => c.colored > 0.15);
    const blank = res.cards.filter((c) => c.colored < 0.05);
    expect(coloured.length).toBe(3);
    expect(blank.length).toBe(3);
    for (const look of [ORANGE, GREEN, NIGHT]) {
      const best = Math.min(...res.cards.map((c) => diffToArt(c.image, look)));
      expect(best).toBeLessThan(0.12);
    }
  });

  it('finds a cut out card on a dark table, any way round', () => {
    for (const deg of [0, 37, 160, 251]) {
      const pic = paperPicture('card', [ORANGE]);
      const img = photo(pic, {
        width: 1280,
        height: 960,
        table: [40, 34, 30],
        corners: pose(CARD.w + 2 * CARD.margin, CARD.h + 2 * CARD.margin, 6, 640, 480, deg, 0.04),
        noise: 8,
        texture: 0.3,
      });
      const res = findCards(img);
      expect(res.cards.length, `${deg}°`).toBe(1);
      const c = res.cards[0];
      expect(diffToArt(c.image, ORANGE), `${deg}°`).toBeLessThan(0.1);
      expect(c.colored).toBeGreaterThan(0.5);
    }
  });

  it('copes with a dark coloured background around the fish', () => {
    const pic = paperPicture('card', [NIGHT]);
    const img = photo(pic, { width: 1280, height: 960, table: [235, 235, 232], corners: pose(CARD.w + 6, CARD.h + 6, 7, 600, 500, -12), noise: 6, texture: 0.2 });
    const res = findCards(img);
    expect(res.cards.length).toBe(1);
    expect(diffToArt(res.cards[0].image, NIGHT)).toBeLessThan(0.12);
  });

  it('recognises the same card again by its thumbnail', () => {
    const a = findCards(photo(paperPicture('card', [ORANGE]), { width: 1280, height: 960, table: [40, 34, 30], corners: pose(100, 94, 6, 640, 480, 8), noise: 6, seed: 1 })).cards[0];
    const b = findCards(photo(paperPicture('card', [ORANGE]), { width: 1280, height: 960, table: [40, 34, 30], corners: pose(100, 94, 5, 500, 520, -20), noise: 6, seed: 2 })).cards[0];
    const c = findCards(photo(paperPicture('card', [GREEN]), { width: 1280, height: 960, table: [40, 34, 30], corners: pose(100, 94, 6, 640, 480, 8), noise: 6, seed: 3 })).cards[0];
    expect(thumbDistance(a.thumb, b.thumb)).toBeLessThan(0.05);
    expect(thumbDistance(a.thumb, c.thumb)).toBeGreaterThan(0.12);
  });

  it('cuts out the handwritten name of the fish, and nothing when there is none', () => {
    expect(nameCrop(cardImage(ORANGE))).toBeNull();
    const img = cardImage(ORANGE);
    const c = createCanvas(img.width, img.height);
    const ctx = c.getContext('2d');
    const id = ctx.createImageData(img.width, img.height);
    id.data.set(img.data);
    ctx.putImageData(id, 0, 0);
    ctx.fillStyle = '#20206a';
    ctx.font = `${7 * CARD_PX}px sans-serif`;
    ctx.fillText('Blubbi', (LABELS.line.x0 + 3) * CARD_PX, (LABELS.line.y - 0.8) * CARD_PX);
    const named = ctx.getImageData(0, 0, img.width, img.height);
    const crop = nameCrop({ width: img.width, height: img.height, data: new Uint8ClampedArray(named.data) });
    expect(crop).not.toBeNull();
    expect(crop!.width).toBeGreaterThan(15 * CARD_PX);
  });

  it('tells every animal apart, in any pose', () => {
    const species: SpeciesId[] = [...ANIMALS, 'freiform'];
    species.forEach((sp, n) => {
      const look = colourful(sp, n);
      const pic = paperPicture('card', [look]);
      for (const [deg, tilt] of [[0, 0], [90, 0.06], [200, 0]]) {
        const img = photo(pic, {
          width: 1280,
          height: 960,
          table: [40, 34, 30],
          corners: pose(CARD.w + 2 * CARD.margin, CARD.h + 2 * CARD.margin, 6, 640, 480, deg, tilt),
          noise: 8,
          texture: 0.3,
          seed: n * 10 + deg,
        });
        const res = findCards(img);
        const at = `${sp} ${deg}°`;
        expect(res.cards.length, at).toBe(1);
        expect(res.unsure, at).toBe(0);
        expect(res.cards[0].species, at).toBe(sp);
        expect(diffToArt(res.cards[0].image, look), at).toBeLessThan(0.1);
      }
    });
  });

  /** a sheet of six coloured cards, lying nearly straight in the photo */
  const sheetPhoto = (list: SpeciesId[], looks?: SceneLook[]) =>
    photo(paperPicture('sheet', looks ?? list.map((sp, i) => colourful(sp, i))), {
      width: 1600,
      height: 1200,
      table: [92, 74, 60],
      corners: pose(SHEET.w, SHEET.h, 3.7, 800, 600, 3, 0.05),
      shadow: 0.2,
      noise: 8,
      texture: 0.3,
    });

  it('reads both mixed sheets', () => {
    for (const list of [MIX_A, MIX_B]) {
      const res = findCards(sheetPhoto(list));
      expect(res.cards.map((c) => c.species)).toEqual(list);
      expect(res.unsure).toBe(0);
    }
  });

  it('an old fish sheet stays a fish', () => {
    const res = findCards(sheetPhoto(Array(6).fill('fisch'), [ORANGE, {}, GREEN, {}, NIGHT, {}]));
    expect(res.cards.map((c) => c.species)).toEqual(Array(6).fill('fisch'));
  });

  it('a card half covered by a hand is unsure, not a wrong animal', () => {
    const look = colourful('karpfen', 2);
    const pic = paperPicture('card', [look]);
    // the hand lies over the right half of the picture, the black frame still shows around it
    const ctx = pic.canvas.getContext('2d');
    const k = 6;
    const m = CARD.margin;
    ctx.fillStyle = '#e0ac8c';
    ctx.beginPath();
    for (const [x, y] of [[CARD.w / 2, 5], [CARD.w - 4, 4], [CARD.w - 4, CARD.h - 4], [CARD.w / 2 + 6, CARD.h - 5], [CARD.w / 2 - 3, CARD.h / 2]]) ctx.lineTo((x + m) * k, (y + m) * k);
    ctx.fill();
    for (const deg of [0, 120]) {
      const res = findCards(photo(pic, { width: 1280, height: 960, table: [40, 34, 30], corners: pose(CARD.w + 2 * m, CARD.h + 2 * m, 6, 640, 480, deg), noise: 8 }));
      expect(res.cards.filter((c) => c.species !== 'karpfen'), `${deg}°`).toEqual([]);
      expect(res.unsure + res.cards.length, `${deg}°`).toBe(1);
    }
    // nearly all of it covered: the frame is a card, but which animal it is cannot be seen
    ctx.fillRect((m + 6) * k, (m + 4) * k, (CARD.w - 10) * k, (CARD.h - 8) * k);
    const res = findCards(photo(pic, { width: 1280, height: 960, table: [40, 34, 30], corners: pose(CARD.w + 2 * m, CARD.h + 2 * m, 6, 640, 480, 30), noise: 8 }));
    expect(res.cards).toEqual([]);
    expect(res.unsure).toBe(1);
  });

  it('takes at most about twice as long on a mixed sheet as on an old fish sheet', () => {
    const old = sheetPhoto(Array(6).fill('fisch'), [ORANGE, {}, GREEN, {}, NIGHT, {}]);
    const mixed = sheetPhoto(MIX_B);
    const median = (img: RGBAImage) => {
      const t: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        findCards(img);
        t.push(performance.now() - t0);
      }
      return t.sort((a, b) => a - b)[1];
    };
    findCards(old);
    const a = median(old);
    const b = median(mixed);
    expect(b, `${b.toFixed(0)} ms vs ${a.toFixed(0)} ms`).toBeLessThanOrEqual(2.2 * a);
  });

  it('finds nothing on a page with handwriting and no card', () => {
    const W = 800;
    const H = 600;
    const data = new Uint8ClampedArray(W * H * 4).fill(240);
    for (let y = 200; y < 400; y++) for (let x = 100; x < 700; x++) if ((x + y) % 40 < 4) data.set([30, 30, 60], (y * W + x) * 4);
    expect(findCards({ width: W, height: H, data }).cards.length).toBe(0);
  });
});

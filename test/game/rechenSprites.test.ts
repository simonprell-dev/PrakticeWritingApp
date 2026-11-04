import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { makeGenome } from '../../src/game/creatures/genome.ts';
import { drawDolphin, drawShark, SEA_ANIMALS, seaSprite } from '../../src/game/creatures/seaLife.ts';
import { drawPlant, PLANT_KINDS, type Plant } from '../../src/game/math/seaPlants.ts';
import type { Tier } from '../../src/vision/types.ts';
import type { ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

const TIERS: [Tier, number][] = [
  ['zerknittert', 20],
  ['schief', 40],
  ['nett', 60],
  ['schoen', 80],
  ['prachtvoll', 95],
];
const sticker = () => createCanvas(30, 24) as unknown as AnyCanvas;

function covered(c: { width: number; height: number; getContext(k: '2d'): unknown }): { n: number; sat: number } {
  const ctx = c.getContext('2d') as CanvasRenderingContext2D;
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  let sat = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 20) continue;
    n++;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    sat += mx - mn;
  }
  return { n, sat };
}

describe('Rechenmeer sprites', () => {
  it('every sea animal draws for every tier', () => {
    for (const kind of SEA_ANIMALS)
      for (const [tier, score] of TIERS) {
        const sp = seaSprite(kind, makeGenome(score, tier, 11, 'fish'), sticker());
        expect(covered(sp.canvas as never).n, `${kind} ${tier}`).toBeGreaterThan(500);
        expect(sp.radius, `${kind} ${tier}`).toBeGreaterThan(25);
        expect(sp.radius, `${kind} ${tier}`).toBeLessThan(90);
        expect(sp.badge).toBeTruthy();
        expect(sp.motion).toBeTruthy();
      }
  });

  it('prachtvoll looks richer', () => {
    for (const kind of ['clownfisch', 'qualle', 'seestern'] as const) {
      const lo = covered(seaSprite(kind, makeGenome(20, 'zerknittert', 3, 'fish'), null).canvas as never);
      const hi = covered(seaSprite(kind, makeGenome(95, 'prachtvoll', 3, 'fish'), null).canvas as never);
      expect(hi.sat / hi.n, kind).toBeGreaterThan(lo.sat / lo.n);
    }
  });

  it('plants grow', () => {
    for (const kind of PLANT_KINDS) {
      const plant: Plant = { kind, x: 150, tier: 'schoen', seed: 4, born: 0, glyph: {} as ScannedGlyph, sticker: sticker() };
      const draw = (grow: number) => {
        const c = createCanvas(300, 400);
        drawPlant(c.getContext('2d') as unknown as CanvasRenderingContext2D, plant, 380, 1, grow);
        return covered(c as never).n;
      };
      expect(draw(0.2), kind).toBeLessThan(draw(1));
      expect(draw(1), kind).toBeGreaterThan(800);
    }
  });

  it('visitors draw', () => {
    const c1 = createCanvas(600, 400);
    drawShark(c1.getContext('2d') as unknown as CanvasRenderingContext2D, 300, 200, 1, 0.5);
    expect(covered(c1 as never).n).toBeGreaterThan(5000);
    const c2 = createCanvas(400, 300);
    drawDolphin(c2.getContext('2d') as unknown as CanvasRenderingContext2D, 200, 150, 1, -0.3, 0.5);
    expect(covered(c2 as never).n).toBeGreaterThan(3000);
  });
});

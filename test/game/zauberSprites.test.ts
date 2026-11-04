import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { fableSprite } from '../../src/game/creatures/fable.ts';
import { makeGenome } from '../../src/game/creatures/genome.ts';
import { princessBust, princessSprite } from '../../src/game/creatures/princess.ts';
import type { Sprite } from '../../src/game/creatures/sprite.ts';
import { tierOf } from '../../src/recog/score.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

const SCORES = [10, 40, 60, 80, 97];
const sticker = () => createCanvas(40, 46) as unknown as AnyCanvas;

function genomeWith(score: number, variant: number) {
  for (let seed = 1; ; seed++) {
    const g = makeGenome(score, tierOf(score), seed, 'fable');
    if (g.variant === variant) return g;
  }
}

function inside(sp: Sprite, p: { x: number; y: number }) {
  return p.x >= 0 && p.y >= 0 && p.x <= sp.canvas.width && p.y <= sp.canvas.height;
}

/** distinct strong hues (30° buckets) among saturated pixels */
function hueBuckets(c: AnyCanvas): number {
  const ctx = (c as unknown as ReturnType<typeof createCanvas>).getContext('2d');
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const seen = new Set<number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn < 0.35) continue;
    let h = mx === r ? (g - b) / (mx - mn) : mx === g ? 2 + (b - r) / (mx - mn) : 4 + (r - g) / (mx - mn);
    h = ((h * 60) + 360) % 360;
    seen.add(Math.floor(h / 30));
  }
  return seen.size;
}

describe('Zauberland sprites', () => {
  it('fable genomes: mostly unicorns, some pegasus and dragons', () => {
    const n = [0, 0, 0];
    for (let seed = 1; seed <= 3000; seed++) n[makeGenome(70, 'schoen', seed, 'fable').variant]++;
    expect(n[0] / 3000).toBeGreaterThan(0.64);
    expect(n[0] / 3000).toBeLessThan(0.76);
    expect(n[1] / 3000).toBeGreaterThan(0.1);
    expect(n[2] / 3000).toBeGreaterThan(0.1);
  });

  it('every fable creature and princess has its badge and saddle point inside', () => {
    for (const s of SCORES) {
      for (const v of [0, 1, 2]) {
        const sp = fableSprite(genomeWith(s, v), sticker());
        expect(sp.canvas.width).toBeGreaterThan(0);
        expect(sp.badge && inside(sp, sp.badge)).toBe(true);
        expect(inside(sp, sp.top)).toBe(true);
      }
      for (const pose of ['stand', 'sit'] as const) {
        const p = princessSprite(genomeWith(s, 0), sticker(), pose);
        expect(p.badge && inside(p, p.badge)).toBe(true);
        expect(inside(p, p.top)).toBe(true);
      }
      expect(princessBust(genomeWith(s, 0)).width).toBeGreaterThan(0);
    }
  });

  it('a splendid unicorn has a rainbow mane', () => {
    const fine = fableSprite(genomeWith(97, 0), null);
    const plain = fableSprite(genomeWith(60, 0), null);
    expect(hueBuckets(fine.canvas)).toBeGreaterThan(hueBuckets(plain.canvas) + 2);
  });

  it('a pegasus flaps its wings as its moving part', () => {
    expect(fableSprite(genomeWith(70, 1), null).tail).toBeDefined();
  });
});

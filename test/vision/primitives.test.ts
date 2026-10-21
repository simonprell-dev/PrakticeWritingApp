import { describe, expect, it } from 'vitest';
import { label } from '../../src/vision/components.ts';
import { chamfer } from '../../src/vision/distance.ts';
import { boxBlur, maxFilter, minFilter } from '../../src/vision/filters.ts';
import { countHoles, dilate, erode, fillHoles } from '../../src/vision/morphology.ts';
import { skeletonGraph, zhangSuen } from '../../src/vision/thinning.ts';
import type { Mask } from '../../src/vision/types.ts';
import { rng } from '../helpers/synth.ts';

function randomPlane(w: number, h: number, seed: number) {
  const r = rng(seed);
  return Float32Array.from({ length: w * h }, () => r());
}

describe('filters', () => {
  it('boxBlur matches a naive implementation', () => {
    const w = 23;
    const h = 17;
    const src = randomPlane(w, h, 1);
    const r = 3;
    const out = boxBlur(src, w, h, r);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        let n = 0;
        for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
          for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
            s += src[yy * w + xx];
            n++;
          }
        }
        expect(out[y * w + x]).toBeCloseTo(s / n, 4);
      }
    }
  });

  it('max/min filter match naive implementations', () => {
    const w = 31;
    const h = 12;
    const src = randomPlane(w, h, 2);
    for (const r of [1, 2, 5]) {
      const mx = maxFilter(src, w, h, r);
      const mn = minFilter(src, w, h, r);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let a = -Infinity;
          let b = Infinity;
          for (let yy = Math.max(0, y - r); yy <= Math.min(h - 1, y + r); yy++) {
            for (let xx = Math.max(0, x - r); xx <= Math.min(w - 1, x + r); xx++) {
              a = Math.max(a, src[yy * w + xx]);
              b = Math.min(b, src[yy * w + xx]);
            }
          }
          expect(mx[y * w + x]).toBe(a);
          expect(mn[y * w + x]).toBe(b);
        }
      }
    }
  });
});

function maskFrom(rows: string[]): Mask {
  const h = rows.length;
  const w = rows[0].length;
  const data = new Uint8Array(w * h);
  rows.forEach((r, y) => [...r].forEach((c, x) => (data[y * w + x] = c === '#' ? 1 : 0)));
  return { width: w, height: h, data };
}

describe('components and morphology', () => {
  it('labels 8-connected components with stats', () => {
    const m = maskFrom(['#..#', '.#.#', '...#', '##..']);
    const { comps } = label(m, true);
    expect(comps.length).toBe(3);
    const areas = comps.map((c) => c.area).sort();
    expect(areas).toEqual([2, 2, 3]);
  });

  it('dilate/erode are inverse-ish on a block, fillHoles fills rings', () => {
    const m = maskFrom(['.......', '.#####.', '.#...#.', '.#...#.', '.#####.', '.......']);
    expect(countHoles(m)).toBe(1);
    const filled = fillHoles(m);
    expect(filled.data.reduce((a, b) => a + b, 0)).toBe(20);
    const d = dilate(m, 1);
    expect(d.data[0]).toBe(1);
    const e = erode(filled, 1);
    expect(e.data.reduce((a, b) => a + b, 0)).toBe(6);
  });

  it('chamfer distance grows away from features', () => {
    const m = maskFrom(['.....', '.....', '..#..', '.....', '.....']);
    const d = chamfer(m);
    expect(d[2 * 5 + 2]).toBe(0);
    expect(d[2 * 5 + 3]).toBeCloseTo(1, 5);
    expect(d[0]).toBeGreaterThan(2.5);
  });
});

describe('thinning', () => {
  it('thins a thick bar to a 1px line with two endpoints', () => {
    const w = 40;
    const h = 15;
    const data = new Uint8Array(w * h);
    for (let y = 5; y < 10; y++) for (let x = 5; x < 35; x++) data[y * w + x] = 1;
    const sk = zhangSuen({ width: w, height: h, data });
    const g = skeletonGraph(sk);
    expect(g.endpoints).toBe(2);
    expect(g.junctions).toBe(0);
    let rows = new Set<number>();
    for (let i = 0; i < sk.data.length; i++) if (sk.data[i] && i % w > 8 && i % w < 30) rows.add(Math.floor(i / w));
    expect(rows.size).toBe(1);
    rows = new Set();
  });

  it('finds the junction of a T shape', () => {
    const w = 40;
    const h = 40;
    const data = new Uint8Array(w * h);
    for (let y = 5; y < 9; y++) for (let x = 5; x < 35; x++) data[y * w + x] = 1;
    for (let y = 5; y < 35; y++) for (let x = 18; x < 22; x++) data[y * w + x] = 1;
    const g = skeletonGraph(zhangSuen({ width: w, height: h, data }));
    expect(g.endpoints).toBe(3);
    expect(g.junctions).toBe(1);
  });
});

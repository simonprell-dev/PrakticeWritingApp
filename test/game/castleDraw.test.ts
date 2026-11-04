import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { Castle, castleLayout, SLOTS, slotRect } from '../../src/game/castle/castle.ts';
import { CastleCache } from '../../src/game/castle/castleDraw.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

function opaqueIn(c: AnyCanvas, r: { x: number; y: number; w: number; h: number }): number {
  const ctx = (c as unknown as ReturnType<typeof createCanvas>).getContext('2d');
  const d = ctx.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 200) n++;
  return n / (d.length / 4);
}

describe('castle drawing', () => {
  it('redraws only when the castle grows or the world changes', () => {
    const cache = new CastleCache();
    const c = new Castle();
    const a = cache.get(c, 1920, new Map());
    expect(cache.get(c, 1920, new Map())).toBe(a);
    c.add(c.nextSlot()!, { q: 0.9, tier: 'prachtvoll', glyphId: 3 });
    const b = cache.get(c, 1920, new Map());
    expect(b).not.toBe(a);
    expect(cache.get(c, 1600, new Map())).not.toBe(b);
  });

  it('a full castle covers every place', () => {
    const c = new Castle();
    while (!c.full()) c.add(c.nextSlot()!, { q: 0.5, tier: 'nett', glyphId: null });
    const img = new CastleCache().get(c, 1920, new Map());
    const L = castleLayout(1920);
    for (const s of SLOTS) expect(opaqueIn(img, slotRect(L, s)), `slot ${s.i}`).toBeGreaterThan(0.3);
  });

  it('an empty place stays empty', () => {
    const c = new Castle();
    const img = new CastleCache().get(c, 1920, new Map());
    const L = castleLayout(1920);
    expect(opaqueIn(img, slotRect(L, SLOTS[11]))).toBeLessThan(0.05);
  });
});

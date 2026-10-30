import { describe, expect, it } from 'vitest';
import { GlyphMemory, THUMB, turnThumb, type MemGlyph } from '../../src/vision/dedup.ts';
import { rng } from '../helpers/synth.ts';

/** three random thin strokes, like a letter: different for every glyph and for every way round */
function thumbOf(r: () => number): Uint8Array {
  const t = new Uint8Array(THUMB * THUMB);
  for (let k = 0; k < 3; k++) {
    const x0 = r() * 15;
    const y0 = r() * 15;
    const x1 = r() * 15;
    const y1 = r() * 15;
    for (let i = 0; i <= 30; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / 30);
      const y = Math.round(y0 + ((y1 - y0) * i) / 30);
      t[y * THUMB + x] = 1;
    }
  }
  return t;
}

describe('glyph memory', () => {
  it('finds a turned full sheet quickly', () => {
    const r = rng(3);
    // a sheet full of letters: 20 rows of 15, 50 px apart
    const old: MemGlyph[] = [];
    for (let row = 0; row < 20; row++) for (let col = 0; col < 15; col++) old.push({ box: { x: 100 + col * 50, y: 80 + row * 50, w: 30, h: 36 }, thumb: thumbOf(r) });
    const memory = new GlyphMemory();
    memory.commit(old, memory.match(old));
    // the paper turned by 20° around (500, 600) and moved
    const a = 0.35;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const now: MemGlyph[] = old.slice(0, 60).map((o) => {
      const x = o.box.x + o.box.w / 2 - 500;
      const y = o.box.y + o.box.h / 2 - 600;
      return { box: { x: 500 + c * x - s * y - 18 + 40, y: 600 + s * x + c * y - 18 - 30, w: 36, h: 36 }, thumb: turnThumb(o.thumb, a) };
    });
    // the same sheet only shifted, for comparison
    const shifted = old.slice(0, 60).map((o) => ({ box: { ...o.box, x: o.box.x + 13 }, thumb: o.thumb }));
    memory.match(shifted);
    let t0 = performance.now();
    memory.match(shifted);
    const plain = performance.now() - t0;
    t0 = performance.now();
    const res = memory.match(now);
    const ms = performance.now() - t0;
    expect(res.isNew.filter(Boolean).length).toBeLessThanOrEqual(3);
    expect(res.turn?.a).toBeCloseTo(a, 1);
    expect(ms).toBeLessThan(2.5 * plain + 20);
  });

  it('turning a thumbnail four quarter turns gives it back', () => {
    const t = thumbOf(rng(5));
    let u = t;
    for (let k = 0; k < 4; k++) u = turnThumb(u, Math.PI / 2);
    let same = 0;
    let ink = 0;
    for (let i = 0; i < t.length; i++) {
      ink += t[i];
      same += t[i] & u[i];
    }
    expect(same / ink).toBeGreaterThan(0.8);
  });
});

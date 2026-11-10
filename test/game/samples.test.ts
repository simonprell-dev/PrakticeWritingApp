import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { encodeSample, labelOf, SampleCollector } from '../../src/app/samples.ts';
import { pngSize, validateSampleBatch } from '../../server/samples.js';
import type { ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

let gid = 1;
function glyph(char: string, o: { isNew?: boolean; mirrored?: boolean; rejected?: boolean; size?: number } = {}): ScannedGlyph {
  const s = o.size ?? 20;
  return {
    id: gid++,
    box: { x: gid * 10, y: 5, w: s, h: s },
    regionId: 0,
    dots: 0,
    crop: { width: s, height: s, data: new Uint8ClampedArray(s * s * 4).fill(200) },
    score: { score: 64, tier: 'schoen', parts: { L: 1, T: 1, S: 1, P: 1 }, char, scoredAs: char, tip: 'super', mirrored: o.mirrored, rejected: o.rejected },
    isNew: o.isNew ?? true,
  } as unknown as ScannedGlyph;
}

describe('the label of a written letter', () => {
  it('practising a letter and the recognition agrees: the practice letter, fairly sure', () => {
    expect(labelOf(glyph('A'), 'A')).toEqual({ label: 'A', source: 'uebung' });
  });

  it('something else than the practice letter, or no practice: only the guess of the recognition', () => {
    expect(labelOf(glyph('R'), 'A')).toEqual({ label: 'R', source: 'erkannt' });
    expect(labelOf(glyph('R'), null)).toEqual({ label: 'R', source: 'erkannt' });
  });

  it('mirror writing is never sure', () => {
    expect(labelOf(glyph('S', { mirrored: true }), 'S')).toEqual({ label: 'S', source: 'erkannt' });
  });
});

describe('collecting the letters of a lesson', () => {
  it('only new letters, in the order they were written, with the photo they came in', () => {
    const c = new SampleCollector();
    const a = glyph('A');
    c.addScan([a, glyph('b')], 'A');
    c.addScan([{ ...a, isNew: false }, glyph('c')], null);
    expect(c.entries().map((e) => [e.label, e.source, e.scan, e.target])).toEqual([
      ['A', 'uebung', 0, 'A'],
      ['b', 'erkannt', 0, 'A'],
      ['c', 'erkannt', 1, null],
    ]);
  });

  it('a word written right in the Wörter-Zoo makes its letters sure', () => {
    const c = new SampleCollector();
    const [h, u, n, d] = [glyph('H'), glyph('v'), glyph('n'), glyph('d')];
    c.addScan([h, u, n, d], null);
    c.confirm([h.id, u.id, n.id, d.id], [...'Hund']);
    expect(c.entries().map((e) => `${e.label}:${e.source}`)).toEqual(['H:wort', 'u:wort', 'n:wort', 'd:wort']);
    expect(c.entries()[1].recognized).toBe('v');
  });

  it('a lesson keeps at most 400 letters, a new game starts empty', () => {
    const c = new SampleCollector();
    for (let i = 0; i < 9; i++) c.addScan(Array.from({ length: 50 }, () => glyph('x')), null);
    expect(c.size).toBe(400);
    c.reset();
    expect(c.size).toBe(0);
  });

  it('the upload is what the server takes', async () => {
    const c = new SampleCollector();
    c.addScan([glyph('A', { size: 300 }), glyph('ß')], 'A');
    const body = await c.payload({ game: 'meer', ticket: 'a.b', script: 'druck', style: 'beide', lang: 'de' });
    const v = validateSampleBatch(body);
    expect(v.ok).toBe(true);
    expect(v.value!.samples.map((s: { seq: number; label: string }) => [s.seq, s.label])).toEqual([
      [0, 'A'],
      [1, 'ß'],
    ]);
  });
});

describe('a letter as a picture for the upload', () => {
  it('a small PNG, the long side at most 128 px', async () => {
    const b64 = await encodeSample({ width: 300, height: 150, data: new Uint8ClampedArray(300 * 150 * 4).fill(90) });
    expect(pngSize(Buffer.from(b64, 'base64'))).toEqual({ w: 128, h: 64 });
    const small = await encodeSample({ width: 20, height: 30, data: new Uint8ClampedArray(20 * 30 * 4).fill(90) });
    expect(pngSize(Buffer.from(small, 'base64'))).toEqual({ w: 20, h: 30 });
  });
});

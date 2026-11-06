import { describe, expect, it } from 'vitest';
import { pxPerMm, summarize, type Shot } from '../../src/lab/markSeries.ts';
import { TEST_FIELDS } from '../../src/lab/markTestSheet.ts';

const shot = (readable: boolean, over: Partial<Shot> = {}): Shot => ({
  field: 'weiss-blass-016',
  source: 'druck',
  view: 'nah',
  probe: { pitchPx: 54, hitRate: 1, falseRate: 0, contrast: 0.1, readable },
  glyphs: 0,
  pxPerMm: 18,
  ...over,
});
const series = (passed: number, total = 10) => Array.from({ length: total }, (_, i) => shot(i < passed));

describe('summarize', () => {
  it('9 of 10 is enough', () => {
    expect(summarize(series(9))).toEqual([{ field: 'weiss-blass-016', source: 'druck', view: 'nah', shots: 10, passed: 9, ok: true }]);
  });

  it('8 of 10 is not', () => {
    expect(summarize(series(8))[0].ok).toBe(false);
  });

  it('fewer than 10 shots never pass', () => {
    expect(summarize(series(9, 9))[0].ok).toBe(false);
  });

  it('a dot read as writing does not count', () => {
    expect(summarize([shot(true, { glyphs: 1 })])[0].passed).toBe(0);
  });

  it('print and copy, near and far count apart', () => {
    const r = summarize([shot(true), shot(true, { source: 'kopie' }), shot(true, { view: 'ganz' })]);
    expect(r.length).toBe(3);
    expect(r.every((x) => x.shots === 1)).toBe(true);
  });
});

describe('pxPerMm', () => {
  it('uses the spacing of the field', () => {
    const dots = TEST_FIELDS.find((f) => f.id === 'weiss-blass-016')!;
    const boxes = TEST_FIELDS.find((f) => f.id === 'kaestchen-hell')!;
    expect(pxPerMm(dots, 54)).toBe(18);
    expect(pxPerMm(boxes, 20)).toBe(5);
  });
});

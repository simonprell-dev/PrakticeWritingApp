import { describe, expect, it } from 'vitest';
import { combineGlyphs, groupDigits, readAnswer, UNSURE_L } from '../../src/game/math/readNumber.ts';
import { tierOf } from '../../src/recog/score.ts';
import type { ScannedGlyph } from '../../src/vision/types.ts';

let gid = 1;
function digit(ch: string, x: number, y = 100, opts: { L?: number; score?: number; w?: number; mirrored?: boolean; tip?: string } = {}): ScannedGlyph {
  const w = opts.w ?? 30;
  const score = opts.score ?? 70;
  return {
    id: gid++,
    box: { x, y, w, h: 40 },
    regionId: 0,
    dots: 0,
    crop: { width: w, height: 40, data: new Uint8ClampedArray(w * 40 * 4).fill(200) },
    score: {
      score,
      tier: tierOf(score),
      parts: { L: opts.L ?? 0.9, T: 1, S: 1, P: 1 },
      char: ch,
      scoredAs: ch,
      tip: (opts.tip ?? 'super') as ScannedGlyph['score']['tip'],
      mirrored: opts.mirrored,
    },
    isNew: true,
  };
}

describe('readAnswer', () => {
  it('"1","2" side by side → number 12, in any order', () => {
    const one = digit('1', 100);
    const two = digit('2', 140);
    expect(readAnswer([one, two], 12, null)).toMatchObject({ kind: 'number', value: 12 });
    const r = readAnswer([two, one], 12, null);
    expect(r).toMatchObject({ kind: 'number', value: 12 });
    if (r.kind === 'number') expect(r.glyphs.map((g) => g.score.char).join('')).toBe('12');
  });

  it('two groups on different lines → several; four digits → several', () => {
    expect(readAnswer([digit('1', 100, 100), digit('2', 100, 300)], 1, null).kind).toBe('several');
    expect(readAnswer([digit('1', 100), digit('2', 140), digit('3', 180), digit('4', 220)], 1234, null).kind).toBe('several');
  });

  it('no fresh digits → none', () => {
    expect(readAnswer([], 5, null).kind).toBe('none');
  });

  it('parts.L below UNSURE_L → unsure', () => {
    expect(readAnswer([digit('7', 100, 100, { L: UNSURE_L - 0.05 })], 7, null).kind).toBe('unsure');
  });

  it('expected 23: "3" first is partial, then "2" left of it gives 23', () => {
    const three = digit('3', 140);
    const first = readAnswer([three], 23, null);
    expect(first.kind).toBe('partial');
    const pending = first.kind === 'partial' ? first.glyphs : null;
    expect(readAnswer([digit('2', 100)], 23, pending)).toMatchObject({ kind: 'number', value: 23 });
  });

  it('expected 23: "3", then a "2" far away on another line → number 2', () => {
    const first = readAnswer([digit('3', 140)], 23, null);
    const pending = first.kind === 'partial' ? first.glyphs : null;
    expect(readAnswer([digit('2', 600, 400)], 23, pending)).toMatchObject({ kind: 'number', value: 2 });
  });

  it('expected 23: "4" → number 4; expected 5: "5" → number 5', () => {
    expect(readAnswer([digit('4', 100)], 23, null)).toMatchObject({ kind: 'number', value: 4 });
    expect(readAnswer([digit('5', 100)], 5, null)).toMatchObject({ kind: 'number', value: 5 });
  });

  it('waits only once: partial with pending is judged', () => {
    const first = readAnswer([digit('1', 100)], 100, null);
    expect(first.kind).toBe('partial');
    const pending = first.kind === 'partial' ? first.glyphs : null;
    expect(readAnswer([digit('0', 140)], 100, pending)).toMatchObject({ kind: 'number', value: 10 });
  });
});

describe('groupDigits', () => {
  it('groups by line and gap', () => {
    const gs = [digit('1', 100), digit('2', 140), digit('3', 400), digit('4', 100, 300)];
    expect(groupDigits(gs).map((g) => g.map((d) => d.score.char).join('')).sort()).toEqual(['12', '3', '4']);
  });
});

describe('combineGlyphs', () => {
  it('puts the digits side by side and averages the score', () => {
    const a = digit('2', 100, 100, { w: 30, score: 60, tip: 'ruhig' });
    const b = digit('3', 140, 100, { w: 20, score: 90, mirrored: true, tip: 'spiegel' });
    const c = combineGlyphs([a, b], 999);
    expect(c.id).toBe(999);
    expect(c.crop.width).toBe(30 + 4 + 20);
    expect(c.crop.data.length).toBe(c.crop.width * c.crop.height * 4);
    expect(c.score.char).toBe('23');
    expect(c.score.scoredAs).toBe('23');
    expect(c.score.score).toBe(75);
    expect(c.score.tier).toBe(tierOf(75));
    expect(c.score.mirrored).toBe(true);
    expect(c.score.tip).toBe('ruhig');
    expect(c.box).toEqual({ x: 100, y: 100, w: 60, h: 40 });
  });
});

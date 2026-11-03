import { describe, expect, it } from 'vitest';
import { KANA_BOX, KANA_STROKES } from '../../src/game/kanaStrokes.ts';
import { writeDuration, writtenGlyph } from '../../src/game/strokes.ts';
import { scriptOf } from '../../src/recog/scripts.ts';

const KANA = [...scriptOf('hiragana').chars, ...scriptOf('katakana').chars];

describe('kana writing animations (KanjiVG)', () => {
  it('cover exactly the hiragana and katakana of the game', () => {
    expect(KANA).toHaveLength(92);
    expect(Object.keys(KANA_STROKES).sort()).toEqual([...KANA].sort());
  });

  it('every kana has strokes with finite points inside its square box', () => {
    for (const ch of KANA) {
      const g = writtenGlyph(ch, false);
      expect(g, ch).not.toBeNull();
      expect(g!.box).toBe(true);
      expect(g!.w).toBe(KANA_BOX);
      expect(g!.strokes.length, ch).toBeGreaterThan(0);
      for (const s of g!.strokes) {
        expect(s.dot).toBe(false);
        expect(s.pts.length).toBeGreaterThan(1);
        expect(s.total).toBeGreaterThan(0);
        for (const p of s.pts) {
          expect(Number.isFinite(p.x) && Number.isFinite(p.y), ch).toBe(true);
          expect(p.x, ch).toBeGreaterThanOrEqual(0);
          expect(p.x, ch).toBeLessThanOrEqual(KANA_BOX);
          expect(p.y, ch).toBeGreaterThanOrEqual(0);
          expect(p.y, ch).toBeLessThanOrEqual(KANA_BOX);
        }
      }
      expect(writeDuration(g!)).toBeGreaterThan(0);
      // the Grundschrift flag changes nothing for kana
      expect(writtenGlyph(ch, true)!.strokes.map((s) => s.pts)).toEqual(g!.strokes.map((s) => s.pts));
    }
  });

  it('have the standard stroke counts', () => {
    const counts: Record<string, number> = { あ: 3, い: 2, う: 2, え: 2, お: 3, ふ: 4, を: 3, シ: 3, ツ: 3, ン: 2, ア: 2, ヲ: 3 };
    for (const [ch, n] of Object.entries(counts)) expect(writtenGlyph(ch, false)!.strokes.length, ch).toBe(n);
  });

  it('write the dots of シ top to bottom and its long stroke upwards, the dots of ツ left to right and its long stroke downwards', () => {
    const shi = writtenGlyph('シ', false)!.strokes;
    expect(shi[0].pts[0].y).toBeLessThan(shi[1].pts[0].y);
    expect(shi[2].pts.at(-1)!.y).toBeLessThan(shi[2].pts[0].y);
    const tsu = writtenGlyph('ツ', false)!.strokes;
    expect(tsu[0].pts[0].x).toBeLessThan(tsu[1].pts[0].x);
    expect(tsu[1].pts[0].x).toBeLessThan(tsu[2].pts[0].x);
    expect(tsu[2].pts.at(-1)!.y).toBeGreaterThan(tsu[2].pts[0].y);
  });

  it('Latin letters stay on the school lines', () => {
    expect(writtenGlyph('A', false)!.box).toBeUndefined();
    expect(writtenGlyph('の', false)!.box).toBe(true);
  });
});

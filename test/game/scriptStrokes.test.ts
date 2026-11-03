import { describe, expect, it } from 'vitest';
import { SCRIPT_STROKES } from '../../src/game/scriptStrokes/index.ts';
import { writeDuration, writtenGlyph } from '../../src/game/strokes.ts';
import { scriptOf, type ScriptId } from '../../src/recog/scripts.ts';

describe('writing animations of the other scripts (src/game/scriptStrokes)', () => {
  for (const id of Object.keys(SCRIPT_STROKES) as ScriptId[]) {
    const chars = [...scriptOf(id).chars];

    it(`${id}: every character of the script has strokes, and only those`, () => {
      expect(scriptOf(id).strokes).toBe(id);
      expect(Object.keys(SCRIPT_STROKES[id]).filter((c) => !chars.includes(c))).toEqual([]);
      expect(chars.filter((c) => !writtenGlyph(c, id))).toEqual([]);
    });

    it(`${id}: the strokes are finite and stay near the lines or the box`, () => {
      for (const ch of chars) {
        const g = writtenGlyph(ch, id);
        if (!g) continue;
        expect(g.strokes.length, ch).toBeGreaterThan(0);
        expect(writeDuration(g), ch).toBeGreaterThan(0);
        for (const s of g.strokes)
          for (const p of s.pts) {
            expect(Number.isFinite(p.x) && Number.isFinite(p.y), ch).toBe(true);
            expect(p.x, ch).toBeGreaterThanOrEqual(-0.35);
            expect(p.x, ch).toBeLessThanOrEqual(g.w + 0.35);
            expect(p.y, ch).toBeGreaterThanOrEqual(g.box ? -0.1 : -0.7);
            expect(p.y, ch).toBeLessThanOrEqual(g.box ? 2.1 : 3.3);
          }
      }
    });
  }

  it('a script table never changes the Latin templates', () => {
    expect(writtenGlyph('A', 'kyrillisch')).toBeNull();
    expect(writtenGlyph('A', false)!.strokes.length).toBe(3);
    expect(writtenGlyph('A', 'druck')!.strokes.length).toBe(3);
  });
});

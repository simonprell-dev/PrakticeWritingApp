import { describe, expect, it } from 'vitest';
import { detectLocale } from '../../src/i18n/detect.ts';
import { baseOf } from '../../src/recog/classes.ts';
import { groupMapOf, SCRIPT_IDS, scriptOf, strokeStyle, surprisePool } from '../../src/recog/scripts.ts';
import { findGlyphs } from '../../src/vision/segment.ts';
import type { Mask } from '../../src/vision/types.ts';

describe('the scripts of the world map', () => {
  it('every script has distinct single characters, and practice sets made of them', () => {
    for (const id of SCRIPT_IDS) {
      const def = scriptOf(id);
      const chars = [...def.chars];
      expect(new Set(chars).size, id).toBe(chars.length);
      for (const c of chars) expect([...c].length, `${id} ${c}`).toBe(1);
      // Latin umlauts are the base letter plus dots for the model
      for (const set of def.practice) for (const c of set.chars) expect(def.chars.includes(def.seg === 'latin' ? baseOf(c) : c), `${id} ${c}`).toBe(true);
      for (const g of def.groups) for (const c of g) expect(def.chars.includes(c), `${id} group ${g}`).toBe(true);
    }
  });

  it('the kana tables have all 46 characters in their rows', () => {
    for (const id of ['hiragana', 'katakana'] as const) {
      const rows = scriptOf(id).practice;
      expect(rows.map((r) => r.chars).join('')).toBe(scriptOf(id).chars);
      expect(scriptOf(id).chars.length).toBe(46);
    }
  });

  it('every script has writing animations', () => {
    expect(strokeStyle('druck', 'druck')).toBe('druck');
    expect(strokeStyle('druck', 'beide')).toBe('grund');
    expect(strokeStyle('grund', 'druck')).toBe('grund');
    expect(strokeStyle('schreib', 'beide')).toBe('schreib');
    expect(strokeStyle('hiragana', 'beide')).toBe('kana');
    expect(strokeStyle('katakana', 'druck')).toBe('kana');
    expect(strokeStyle('kyrillisch', 'beide')).toBe('kyrillisch');
    for (const id of SCRIPT_IDS) expect(strokeStyle(id, 'beide'), id).not.toBeNull();
  });

  it('surprise characters come from the same script and are never confusable with the practised one', () => {
    const pool = surprisePool('kyrillisch', 'О');
    const groupOf = groupMapOf(scriptOf('kyrillisch'));
    expect(pool.length).toBeGreaterThan(10);
    expect(pool.some((c) => groupOf(c) === groupOf('О'))).toBe(false);
    for (const c of pool) expect(scriptOf('kyrillisch').chars.includes(c)).toBe(true);
    expect(surprisePool('hiragana', 'あ').every((c) => 'いうえお'.includes(c))).toBe(true);
  });
});

describe('language and script on the first visit', () => {
  it('a language with a script of its own decides', () => {
    expect(detectLocale(['ja-JP'], 'Asia/Tokyo')).toEqual({ lang: 'ja', script: 'hiragana' });
    expect(detectLocale(['ru'], 'Europe/Berlin')).toEqual({ lang: 'ru', script: 'kyrillisch' });
    expect(detectLocale(['ar-EG'], 'Africa/Cairo')).toEqual({ lang: 'ar', script: 'arabisch' });
    expect(detectLocale(['he-IL'], 'Asia/Jerusalem')).toEqual({ lang: 'he', script: 'hebraeisch' });
  });

  it('German, French … practise the Druckschrift; English leaves it to the time zone', () => {
    expect(detectLocale(['de-DE', 'en'], 'Europe/Berlin')).toEqual({ lang: 'de', script: 'druck' });
    expect(detectLocale(['fr-FR'], 'Asia/Tokyo')).toEqual({ lang: 'fr', script: 'druck' });
    expect(detectLocale(['en-US'], 'Asia/Seoul')).toEqual({ lang: 'en', script: 'hangul' });
    expect(detectLocale(['en-GB'], 'Europe/London')).toEqual({ lang: 'en', script: 'druck' });
  });

  it('an unknown language falls back to English, or the language of the time zone', () => {
    expect(detectLocale(['sw'], 'Africa/Nairobi')).toEqual({ lang: 'de', script: 'druck' });
    expect(detectLocale(['sw'], 'Asia/Bangkok')).toEqual({ lang: 'th', script: 'thai' });
  });
});

/** a mask with filled rectangles [x0, y0, x1, y1] */
function mask(w: number, h: number, rects: [number, number, number, number][]): Mask {
  const m: Mask = { width: w, height: h, data: new Uint8Array(w * h) };
  for (const [x0, y0, x1, y1] of rects) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m.data[y * w + x] = 1;
  return m;
}

describe('characters made of several parts', () => {
  // two characters like い (two strokes side by side) and one like ニ (two strokes above each other), 40 px tall
  const parts: [number, number, number, number][] = [
    [20, 20, 25, 60], [38, 26, 43, 56], // い: two strokes 12 px apart
    [90, 24, 128, 29], [86, 52, 132, 57], // ニ: two bars 22 px apart
    [170, 20, 175, 60], [188, 22, 193, 58], [176, 38, 187, 41], // a third character, H-like
  ];
  const m = mask(240, 90, parts);

  it('block scripts join the parts of one character and keep the characters apart', () => {
    const seg = findGlyphs(m, null, 60, { mode: 'block', dir: 'ltr' });
    expect(seg.glyphs.length).toBe(3);
    expect(seg.glyphs.map((g) => g.baseLabels.length)).toEqual([2, 2, 1]);
  });

  it('right-to-left scripts are read from the right', () => {
    const seg = findGlyphs(m, null, 60, { mode: 'block', dir: 'rtl' });
    expect(seg.glyphs.map((g) => g.box.x)).toEqual([...seg.glyphs.map((g) => g.box.x)].sort((a, b) => b - a));
  });

  it('a dot below a character belongs to it (ب)', () => {
    const b = mask(120, 90, [[20, 40, 70, 46], [20, 30, 25, 46], [65, 30, 70, 46], [42, 56, 47, 61]]);
    const seg = findGlyphs(b, null, 60, { mode: 'block', dir: 'rtl' });
    expect(seg.glyphs.length).toBe(1);
  });
});

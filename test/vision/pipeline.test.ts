import { describe, expect, it } from 'vitest';
import { PEN_PRESETS } from '../../src/vision/color.ts';
import { GlyphMemory } from '../../src/vision/dedup.ts';
import { runScan } from '../../src/vision/pipeline.ts';
import type { TeamCalib, VisionOptions } from '../../src/vision/types.ts';
import { loadBank, loadRecognizer } from '../helpers/load.ts';
import { makePage, schoolWord, type GlyphSpec, type PageSpec, type SchoolLines } from '../helpers/synth.ts';

const bank = loadBank();
const rec = loadRecognizer();
const base: VisionOptions = { pen: 'auto', ruled: 'auto', strictness: 'mittel', style: 'beide', dedup: 'sheet', debug: false };

function row(chars: string, y: number, extra: Partial<GlyphSpec> = {}, x0 = 140, step = 130): GlyphSpec[] {
  return [...chars].map((char, i) => ({ char, x: x0 + i * step, y, size: 90, pen: 7, ...extra }));
}

function scan(page: PageSpec, opts: Partial<VisionOptions> = {}, memory = new GlyphMemory()) {
  return runScan(makePage(bank, page), { ...base, ...opts }, { recognizer: rec, memory });
}

describe('pipeline on synthetic pages', () => {
  it('finds every glyph in reading order', () => {
    const res = scan({ width: 1280, height: 720, glyphs: [...row('ABCDEFGH', 250), ...row('12345678', 500)] });
    expect(res.glyphs.length).toBe(16);
    const xs = res.glyphs.slice(0, 8).map((g) => g.box.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(res.glyphs[0].box.y).toBeLessThan(res.glyphs[8].box.y);
    const chars = res.glyphs.map((g) => g.score.char).join('');
    const correct = [...chars].filter((c, i) => c.toUpperCase() === 'ABCDEFGH12345678'[i].toUpperCase()).length;
    expect(correct).toBeGreaterThanOrEqual(13);
  });

  it('merges i dots and umlaut dots', () => {
    const glyphs: GlyphSpec[] = [
      { char: 'i', x: 200, y: 360, size: 100, pen: 7 },
      { char: 'a', x: 420, y: 380, size: 70, pen: 7 },
      { char: 'u', x: 640, y: 380, size: 70, pen: 7 },
    ];
    // umlaut dots drawn as small disks above a and u
    const page: PageSpec = {
      width: 1000,
      height: 700,
      glyphs: [
        ...glyphs,
        { char: '.', x: 0, y: 0, size: 0 } as GlyphSpec,
      ].filter((g) => g.char !== '.'),
    };
    const img = makePage(bank, page);
    for (const [cx, cy] of [
      [405, 325],
      [435, 325],
      [625, 325],
      [655, 325],
    ]) {
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > 16) continue;
          const o = (y * img.width + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = 35;
        }
      }
    }
    const res = runScan(img, base, { recognizer: rec, memory: new GlyphMemory() });
    expect(res.glyphs.length).toBe(3);
    expect(res.glyphs.map((g) => g.dots)).toEqual([1, 2, 2]);
    expect(res.glyphs[0].score.char).toBe('i');
    expect(['ä', 'ö']).toContain(res.glyphs[1].score.char);
    // case cannot be told from isolated letters of equal size
    expect(res.glyphs[2].score.char.toLowerCase()).toBe('ü');
  });

  it('dots added after a scan ("Punkte nicht vergessen!") make the letter new again', () => {
    const page: PageSpec = {
      width: 1000,
      height: 700,
      glyphs: [
        { char: 'n', x: 200, y: 380, size: 70, pen: 7 },
        { char: 'u', x: 420, y: 380, size: 70, pen: 7 },
        { char: 'u', x: 640, y: 380, size: 70, pen: 7 },
      ],
    };
    const memory = new GlyphMemory();
    const first = runScan(makePage(bank, page), base, { recognizer: rec, memory });
    const withoutDots = first.glyphs.length;
    expect(first.glyphs.every((g) => g.dots === 0)).toBe(true);
    const img = makePage(bank, page);
    // the second u gets its umlaut dots
    for (const [cx, cy] of [
      [625, 325],
      [655, 325],
    ]) {
      for (let y = cy - 4; y <= cy + 4; y++) {
        for (let x = cx - 4; x <= cx + 4; x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 > 16) continue;
          const o = (y * img.width + x) * 4;
          img.data[o] = img.data[o + 1] = img.data[o + 2] = 35;
        }
      }
    }
    const second = runScan(img, base, { recognizer: rec, memory });
    expect(second.glyphs.length).toBe(withoutDots);
    const fresh = second.glyphs.filter((g) => g.isNew);
    expect(fresh.length).toBe(1);
    expect(fresh[0].dots).toBe(2);
    expect(fresh[0].score.char.toLowerCase()).toBe('ü');
  });

  it('tells lower and upper case apart by letter height', () => {
    const glyphs: GlyphSpec[] = [
      { char: 'n', x: 160, y: 380, size: 60, pen: 6 },
      { char: 'a', x: 300, y: 380, size: 60, pen: 6 },
      { char: 'u', x: 440, y: 380, size: 60, pen: 6 },
      { char: 'U', x: 600, y: 362, size: 95, pen: 6 },
      { char: 's', x: 760, y: 380, size: 60, pen: 6 },
      { char: 'S', x: 900, y: 362, size: 95, pen: 6 },
    ];
    const res = scan({ width: 1100, height: 700, glyphs });
    expect(res.glyphs.map((g) => g.score.char).join('')).toBe('nauUsS');
  });

  it('removes ruled lines but keeps letters standing on them', () => {
    const glyphs = row('LEZ2HT', 300);
    const plain = scan({ width: 1280, height: 640, glyphs });
    const lined = scan({
      width: 1280,
      height: 640,
      glyphs,
      lines: { spacing: 90, offset: 300 + 45, color: [120, 150, 200], width: 2 },
    });
    expect(plain.glyphs.length).toBe(6);
    expect(lined.glyphs.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      expect(Math.abs(lined.glyphs[i].box.h - plain.glyphs[i].box.h)).toBeLessThan(10);
      expect(Math.abs(lined.glyphs[i].box.w - plain.glyphs[i].box.w)).toBeLessThan(10);
    }
  });

  it('ranks clean > wobbly > very wobbly > wrong letter in practice mode', () => {
    const variants: Partial<GlyphSpec>[] = [
      {},
      { jitter: 2.5, rotate: 0.1 },
      { jitter: 5, rotate: 0.3, shear: 0.35 },
    ];
    const scores = variants.map((v, k) => {
      const res = scan({ width: 900, height: 500, glyphs: row('B', 250, v, 450), seed: 10 + k }, { target: 'B' });
      return res.glyphs[0].score.score;
    });
    const wrong = scan({ width: 900, height: 500, glyphs: row('X', 250, {}, 450) }, { target: 'B' }).glyphs[0].score.score;
    expect(scores[0]).toBeGreaterThan(scores[1]);
    expect(scores[1]).toBeGreaterThan(scores[2]);
    expect(scores[2]).toBeGreaterThan(wrong);
    expect(scores[0]).toBeGreaterThanOrEqual(80);
    expect(wrong).toBeLessThan(35);
  });

  it('only reports new glyphs on rescans, also when the paper moved', () => {
    const memory = new GlyphMemory();
    const glyphs = row('abcde', 300);
    const first = scan({ width: 1280, height: 640, glyphs }, {}, memory);
    expect(first.glyphs.filter((g) => g.isNew).length).toBe(5);
    const same = scan({ width: 1280, height: 640, glyphs, seed: 5 }, {}, memory);
    expect(same.glyphs.filter((g) => g.isNew).length).toBe(0);
    const moved = glyphs.map((g) => ({ ...g, x: g.x + 35, y: g.y + 20 }));
    const shifted = scan({ width: 1280, height: 640, glyphs: [...moved, { char: 'f', x: 140 + 35 + 5 * 130, y: 320, size: 90, pen: 7 }] }, {}, memory);
    expect(shifted.glyphs.length).toBe(6);
    expect(shifted.glyphs.filter((g) => g.isNew).map((g) => g.score.char)).toEqual(['f']);
  });

  it('practice mode: a surprise letter is scored as itself, the practice letter stays the practice letter', () => {
    const page = (ch: string) => ({ width: 900, height: 500, glyphs: row(ch, 250, {}, 450) });
    // without the surprise letter an m is just a poor B
    const plain = scan(page('m'), { target: 'B' }).glyphs[0].score;
    expect(plain.scoredAs).toBe('B');
    expect(plain.score).toBeLessThan(35);
    const surprise = scan(page('m'), { target: 'B', bonus: ['m'] }).glyphs[0].score;
    expect(surprise.scoredAs).toBe('m');
    expect(surprise.score).toBeGreaterThanOrEqual(60);
    const b = scan(page('B'), { target: 'B', bonus: ['m'] }).glyphs[0].score;
    expect(b.scoredAs).toBe('B');
    expect(b.score).toBeGreaterThanOrEqual(60);
  });

  it('finds mirror writing; with "mirror writing does not count" it is rejected, correct letters never', () => {
    const chars = 'SZNRFK247';
    const page = (mirror: boolean, text = chars) => ({ width: 160 + text.length * 120, height: 400, glyphs: row(text, 200, { mirror }, 140, 120) });
    const mirrored = scan(page(true), { noMirror: true }).glyphs;
    expect(mirrored.length).toBe(chars.length);
    expect(mirrored.filter((g) => g.score.rejected).length).toBeGreaterThanOrEqual(7);
    // the intended letter is named, so the tip makes sense
    expect(mirrored.filter((g) => g.score.rejected && g.score.char.toUpperCase() === chars[mirrored.indexOf(g)]).length).toBeGreaterThanOrEqual(6);
    // correct letters – also b/d and p/q, whose mirror images are real letters – are never rejected
    const normal = scan(page(false, chars + 'bdpqAa'), { noMirror: true }).glyphs;
    expect(normal.filter((g) => g.score.rejected || g.score.mirrored)).toEqual([]);
    // switch off: mirror writing counts, with fewer stars and the "turn me round" tip
    const counted = scan(page(true)).glyphs;
    expect(counted.filter((g) => g.score.rejected)).toEqual([]);
    expect(counted.filter((g) => g.score.tip === 'spiegel').length).toBeGreaterThanOrEqual(7);
  });

  it('keeps writing on the same sheet: only the new glyphs go through the recognition', () => {
    const memory = new GlyphMemory();
    const glyphs = row('abcd', 300);
    const first = scan({ width: 1280, height: 640, glyphs }, {}, memory);
    expect(first.analyzed).toBe(4);
    // the child writes two more letters, the paper moved a little
    const moved = glyphs.map((g) => ({ ...g, x: g.x + 25, y: g.y + 15 }));
    const more = [...moved, ...row('ef', 315, {}, 140 + 25 + 4 * 130)];
    const second = scan({ width: 1280, height: 640, glyphs: more, seed: 3 }, {}, memory);
    expect(second.glyphs.length).toBe(6);
    expect(second.analyzed).toBe(2);
    expect(second.glyphs.filter((g) => g.isNew).map((g) => g.score.char)).toEqual(['e', 'f']);
    // known glyphs keep exactly the result of their first scan
    expect(second.glyphs.filter((g) => !g.isNew).map((g) => g.score)).toEqual(first.glyphs.map((g) => g.score));
    // a rescan without new handwriting needs no recognition at all
    const third = scan({ width: 1280, height: 640, glyphs: more, seed: 4 }, {}, memory);
    expect(third.analyzed).toBe(0);
    expect(third.glyphs.filter((g) => g.isNew)).toHaveLength(0);
  });

  it('new letters are measured against the known letters of the sheet (upper/lower case)', () => {
    const memory = new GlyphMemory();
    const old: GlyphSpec[] = [
      { char: 'n', x: 160, y: 380, size: 60, pen: 6 },
      { char: 'a', x: 300, y: 380, size: 60, pen: 6 },
    ];
    scan({ width: 1100, height: 700, glyphs: old }, {}, memory);
    const res = scan(
      {
        width: 1100,
        height: 700,
        glyphs: [...old, { char: 'u', x: 440, y: 380, size: 60, pen: 6 }, { char: 'U', x: 600, y: 362, size: 95, pen: 6 }],
      },
      {},
      memory,
    );
    expect(res.analyzed).toBe(2);
    expect(res.glyphs.map((g) => g.score.char).join('')).toBe('nauU');
  });

  describe('German school lines', () => {
    const L1: SchoolLines = { kind: 1, mm: 6, top: 90, pitch: 21, color: [120, 140, 190], width: 2, band: [214, 238, 206] };
    const L2: SchoolLines = { kind: 2, mm: 6, top: 80, pitch: 17, color: [120, 140, 190], width: 2, band: [250, 236, 200] };
    const L3: SchoolLines = { kind: 3, mm: 6, top: 80, pitch: 12, color: [130, 150, 200], width: 2 };
    const page = (L: SchoolLines, glyphs: GlyphSpec[]): PageSpec => ({ width: 1280, height: 720, glyphs, lineatur: L, seed: 3 });

    it('reads the letters on every Lineatur, also with a coloured middle band', () => {
      for (const [L, words] of [
        [L1, ['Haus', 'Baum']],
        [L2, ['Hund', 'Katze', 'Ofen']],
        [L3, ['Hand', 'Zelt', 'Igel', 'Mond']],
      ] as const) {
        const res = scan(page(L, words.flatMap((w, i) => schoolWord(bank, L, i, w, 120))));
        const want = words.join('');
        expect(res.glyphs.length, `Lineatur ${L.kind}`).toBe(want.length);
        const got = res.glyphs.map((g) => g.score.char.toLowerCase());
        const correct = [...want.toLowerCase()].filter((c) => got.includes(c) || (c === 'o' && got.includes('0'))).length;
        expect(correct, `Lineatur ${L.kind}: ${got.join('')}`).toBeGreaterThanOrEqual(want.length - 1);
      }
    });

    it('letters that do not fit the bands score lower and get the line tip', () => {
      const fit = scan(page(L1, schoolWord(bank, L1, 0, 'a', 400)), { target: 'a' }).glyphs[0].score;
      const big = scan(page(L1, schoolWord(bank, L1, 0, 'a', 400, 2)), { target: 'a' }).glyphs[0].score;
      expect(fit.score).toBeGreaterThan(big.score);
      expect(big.tip).toBe('zone');
    });

    it('a single c or C is told apart by the bands it reaches', () => {
      expect(scan(page(L2, schoolWord(bank, L2, 1, 'c', 500))).glyphs[0].score.char).toBe('c');
      expect(scan(page(L2, schoolWord(bank, L2, 1, 'C', 500))).glyphs[0].score.char).toBe('C');
      expect(scan(page(L3, schoolWord(bank, L3, 1, 's', 500))).glyphs[0].score.char).toBe('s');
      expect(scan(page(L3, schoolWord(bank, L3, 1, 'S', 500))).glyphs[0].score.char).toBe('S');
    });
  });

  it('sorts glyphs into teams by pen colour', () => {
    const red = PEN_PRESETS.rot;
    const blue = PEN_PRESETS.blau;
    const calibs: TeamCalib[] = [
      { team: 'A', absorb: red.absorb, slip: [0.33, 0.33, 0.9] },
      { team: 'B', absorb: blue.absorb, slip: [0.33, 0.33, 0.9] },
    ];
    const glyphs = [
      ...row('AB', 250, { color: [215, 40, 50] }),
      ...row('CD', 250, { color: [40, 70, 200] }, 500),
      ...row('E', 500, { color: [30, 30, 30] }, 300),
    ];
    const res = scan({ width: 1280, height: 720, glyphs }, { team: { by: 'pen', calibs } });
    expect(res.glyphs.map((g) => g.team ?? '-').join('')).toBe('AABB-');
    expect(res.neutral).toBe(1);
  });

  it('gives red and blue writing the same score', () => {
    const r = scan({ width: 900, height: 500, glyphs: row('S', 250, { color: [215, 40, 50] }, 450) }, { target: 'S' });
    const b = scan({ width: 900, height: 500, glyphs: row('S', 250, { color: [40, 70, 200] }, 450) }, { target: 'S' });
    expect(Math.abs(r.glyphs[0].score.score - b.glyphs[0].score.score)).toBeLessThanOrEqual(3);
  });

  it('copes with strong shadows and ignores the table around the paper', () => {
    const glyphs = row('xyz789', 330, {}, 220, 150);
    const res = scan({ width: 1280, height: 720, glyphs, shadow: 1, noise: 6, table: 60 });
    expect(res.glyphs.length).toBe(6);
  });
});

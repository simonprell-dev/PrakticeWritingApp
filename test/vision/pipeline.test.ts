import { describe, expect, it } from 'vitest';
import { PEN_PRESETS } from '../../src/vision/color.ts';
import { GlyphMemory } from '../../src/vision/dedup.ts';
import { runScan } from '../../src/vision/pipeline.ts';
import type { TeamCalib, VisionOptions } from '../../src/vision/types.ts';
import { loadBank, loadRecognizer } from '../helpers/load.ts';
import { makePage, type GlyphSpec, type PageSpec } from '../helpers/synth.ts';

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

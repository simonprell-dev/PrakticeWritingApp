import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { baseOf, expectedDots, groupOf, surprisePool, withArticle } from '../../src/recog/classes.ts';
import { combine, type ScoreInput } from '../../src/recog/score.ts';
import { matchSkel } from '../../src/recog/templates.ts';
import { hasModel, loadBank, loadNet } from '../helpers/load.ts';

const VECTORS = fileURLToPath(new URL('../fixtures/cnn_vectors.json', import.meta.url));

describe('GlyphNet inference', () => {
  it.skipIf(!hasModel() || !existsSync(VECTORS))('matches the PyTorch reference logits', () => {
    const net = loadNet()!;
    const vectors = JSON.parse(readFileSync(VECTORS, 'utf8')) as { label: string; input: number[]; logits: number[] }[];
    for (const v of vectors) {
      const out = net.logits(Float32Array.from(v.input, (x) => x / 255));
      let maxDiff = 0;
      for (let i = 0; i < out.length; i++) maxDiff = Math.max(maxDiff, Math.abs(out[i] - v.logits[i]));
      expect(maxDiff).toBeLessThan(1e-3);
    }
  });
});

describe('templates', () => {
  it('every template is closest to its own character group', () => {
    const bank = loadBank();
    let wrong = 0;
    for (const t of bank.templates) {
      let best = { D: Infinity, ch: '' };
      for (const o of bank.templates) {
        if (o.style !== t.style) continue;
        const r = matchSkel(t.skel, o, true);
        if (r.D < best.D) best = { D: r.D, ch: o.char };
      }
      if (groupOf(best.ch) !== groupOf(t.char)) wrong++;
    }
    expect(wrong).toBeLessThanOrEqual(4);
  });
});

describe('German helpers', () => {
  it('articles, umlauts and dots', () => {
    expect(withArticle('B')).toBe('das B');
    expect(withArticle('3')).toBe('die 3');
    expect(baseOf('ä')).toBe('a');
    expect(expectedDots('Ü')).toBe(2);
    expect(expectedDots('i')).toBe(1);
  });

  it('surprise letters: same kind as the practice letter, never confusable with it', () => {
    const upper = surprisePool('B');
    expect(upper).toContain('M');
    expect(upper).not.toContain('B');
    expect(upper.every((c) => c >= 'A' && c <= 'Z')).toBe(true);
    // no umlauts or ß: they differ from other letters only by their dots
    expect(surprisePool('a').some((c) => 'äöüß'.includes(c))).toBe(false);
    // o, O and 0 look the same: never a surprise "0" while practising the O
    expect(surprisePool('O')).not.toContain('0');
    expect(surprisePool('3').every((c) => c >= '0' && c <= '9' && c !== '3')).toBe(true);
    // the umlaut target excludes its base letter
    expect(surprisePool('Ä')).not.toContain('A');
  });
});

describe('score combination', () => {
  const good: ScoreInput = {
    L: 0.95,
    margin: 0,
    T: 0.95,
    shear: 0,
    jitter: 0.3,
    widthCV: 0.15,
    holesG: 1,
    holesT: 1,
    endG: 2,
    endT: 2,
    juncG: 1,
    juncT: 1,
    aspectG: 0.8,
    aspectT: 0.8,
    dots: 0,
    expectedDots: 0,
    mirrored: false,
  };
  it('perfect letters are top tier, strictness orders the scores', () => {
    expect(combine(good, 'mittel').tier).toBe('prachtvoll');
    const mid = { ...good, L: 0.5, T: 0.6, jitter: 0.9 };
    const l = combine(mid, 'leicht').score;
    const m = combine(mid, 'mittel').score;
    const s = combine(mid, 'streng').score;
    expect(l).toBeGreaterThan(m);
    expect(m).toBeGreaterThan(s);
  });
  it('gives friendly tips for the weakest part', () => {
    expect(combine({ ...good, holesG: 0, T: 0.6, L: 0.5 }, 'mittel').tip).toBe('bauch');
    expect(combine({ ...good, mirrored: true }, 'mittel').tip).toBe('spiegel');
    expect(combine({ ...good, dots: 0, expectedDots: 2, T: 0.6, L: 0.5 }, 'mittel').tip).toBe('punkt');
  });
});

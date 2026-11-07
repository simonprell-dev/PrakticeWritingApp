import { describe, expect, it } from 'vitest';
import { judge, nextWord, readWord, usable, WORDS } from '../../src/game/words/words.ts';

const g = (char: string, x: number, y = 100, w = 40, h = 50) => ({ score: { char }, box: { x, y, w, h } }) as never;

describe('word list', () => {
  it('has about 80 words in three levels, each with syllables and a line', () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(70);
    for (const w of WORDS) {
      expect(w.syllables.join('').toLowerCase()).toBe(w.word.toLowerCase());
      expect([1, 2, 3]).toContain(w.level);
      expect(w.say.length).toBeGreaterThan(3);
      expect(w.word[0]).toBe(w.word[0].toUpperCase());
    }
    expect(new Set(WORDS.map((w) => w.word)).size).toBe(WORDS.length);
    for (const l of [1, 2, 3]) expect(WORDS.filter((w) => w.level === l).length).toBeGreaterThanOrEqual(15);
  });

  it('only words made of the known letters', () => {
    const known = new Set('omai'.split(''));
    const ok = WORDS.filter((w) => usable(w, known)).map((w) => w.word);
    expect(ok).toContain('Oma');
    expect(ok).not.toContain('Hund');
  });
});

describe('reading the written word', () => {
  it('puts the letters of a line together from left to right', () => {
    expect(readWord([g('d', 220), g('H', 40), g('u', 100), g('n', 160)])).toBe('Hund');
  });

  it('a letter far away is another word; the longest group counts', () => {
    expect(readWord([g('O', 40), g('m', 95), g('a', 150), g('X', 600)])).toBe('Oma');
  });

  it('two lines: the longest word wins', () => {
    expect(readWord([g('E', 40, 100), g('i', 95, 100), g('s', 150, 100), g('H', 40, 300), g('u', 95, 300), g('n', 150, 300), g('d', 205, 300)])).toBe('Hund');
  });

  it('nothing written is no word', () => {
    expect(readWord([])).toBe('');
  });
});

describe('judging the word', () => {
  it('right', () => {
    expect(judge('Hund', 'Hund')).toMatchObject({ result: 'richtig' });
  });

  it('a small letter where a big one belongs is close, with the reason', () => {
    expect(judge('Hund', 'hund')).toMatchObject({ result: 'fast', reason: 'gross', at: 0 });
  });

  it('letters that look the same big and small do not count against the child', () => {
    expect(judge('Sonne', 'sonne')).toMatchObject({ result: 'richtig' });
    expect(judge('Hund', 'HUND')).toMatchObject({ result: 'richtig' });
  });

  it('one letter wrong, missing or too many is close, with its place', () => {
    expect(judge('Hund', 'Hunt')).toMatchObject({ result: 'fast', reason: 'buchstabe', at: 3 });
    expect(judge('Hund', 'Hnd')).toMatchObject({ result: 'fast', reason: 'buchstabe', at: 1 });
    expect(judge('Hund', 'Hunnd')).toMatchObject({ result: 'fast', reason: 'buchstabe' });
  });

  it('more than one mistake is off', () => {
    expect(judge('Hund', 'Hxnt')).toMatchObject({ result: 'daneben' });
    expect(judge('Hund', '')).toMatchObject({ result: 'daneben' });
  });
});

describe('the next word', () => {
  it('starts with the easy ones and does not repeat before all were there', () => {
    const known = new Set('abcdefghijklmnopqrstuvwxyzäöüß'.split(''));
    const seen: string[] = [];
    let r = 0.3;
    for (let i = 0; i < WORDS.length; i++) {
      const w = nextWord(known, seen, () => (r = (r * 9301 + 0.49297) % 1));
      expect(seen).not.toContain(w!.word);
      if (i === 0) expect(w!.level).toBe(1);
      seen.push(w!.word);
    }
    expect(nextWord(known, seen, () => 0.5)).not.toBeNull();
  });

  it('no usable word is null', () => {
    expect(nextWord(new Set(['q']), [], Math.random)).toBeNull();
  });
});

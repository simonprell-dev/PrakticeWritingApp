import { describe, expect, it } from 'vitest';
import { KNOWN_SPELLINGS, soundKey, soundsRight } from '../../src/game/words/lautgetreu.ts';
import { judge, WORDS } from '../../src/game/words/words.ts';

describe('the sound form of a word', () => {
  it('writes the same sounds the same way', () => {
    for (const [a, b] of [
      ['Vogel', 'Fogel'],
      ['Hund', 'Hunt'],
      ['Biene', 'Bine'],
      ['Schuh', 'Schu'],
      ['Ball', 'Bal'],
      ['Schnecke', 'Schneke'],
      ['Katze', 'Kaze'],
      ['Katze', 'Katse'],
      ['Eule', 'Oile'],
      ['Eis', 'Ais'],
      ['Bär', 'Ber'],
      ['Tiger', 'Tiga'],
      ['Stern', 'Schtern'],
      ['Spinne', 'Schpine'],
      ['Fuchs', 'Fuks'],
      ['Apfel', 'Afel'],
      ['Nudel', 'Nudl'],
      ['Pinguin', 'Pingwin'],
      ['Elefant', 'Elephant'],
      ['Burg', 'Burk'],
    ])
      expect([a, soundKey(a)]).toEqual([a, soundKey(b)]);
  });

  it('a missing or wrong sound is another form', () => {
    for (const [a, b] of [
      ['Ente', 'Ent'],
      ['Hund', 'Hnd'],
      ['Rose', 'Hose'],
      ['Fisch', 'Tisch'],
      ['Pilz', 'Pils'],
      ['Oma', 'Mama'],
    ])
      expect([a, soundKey(a)]).not.toEqual([a, soundKey(b)]);
  });
});

describe('the known sound-true spellings of every word (the check list)', () => {
  it('every word of the zoo has its list', () => {
    expect(Object.keys(KNOWN_SPELLINGS).sort()).toEqual(WORDS.map((w) => w.word).sort());
  });

  for (const w of WORDS)
    it(`${w.word}: every known spelling counts as sound-true, the word itself too`, () => {
      expect(soundsRight(w.word, w.word)).toBe(true);
      for (const s of KNOWN_SPELLINGS[w.word]) expect([s, soundsRight(w.word, s)]).toEqual([s, true]);
    });

  it('no two words of the zoo sound the same, so a sound-true spelling never stands for another word', () => {
    const seen = new Map<string, string>();
    for (const w of WORDS) {
      const k = soundKey(w.word);
      expect([w.word, seen.get(k)]).toEqual([w.word, undefined]);
      seen.set(k, w.word);
    }
  });

  it('no known spelling of a word counts for another word', () => {
    for (const w of WORDS)
      for (const s of KNOWN_SPELLINGS[w.word])
        for (const o of WORDS) if (o.word !== w.word) expect([s, o.word, soundsRight(o.word, s)]).toEqual([s, o.word, false]);
  });
});

describe('judging with the sound-true setting', () => {
  it('sound-true counts as right when it is allowed, with the hint how it is written', () => {
    expect(judge('Hund', 'Hunt', 'lautgetreu')).toEqual({ result: 'richtig', lautgetreu: true });
    expect(judge('Giraffe', 'Schiraffe', 'lautgetreu')).toEqual({ result: 'richtig', lautgetreu: true });
    expect(judge('Hund', 'hunt', 'lautgetreu')).toEqual({ result: 'richtig', lautgetreu: true });
  });

  it('only the right spelling: sound-true is close, the child writes it again', () => {
    expect(judge('Hund', 'Hunt', 'streng')).toMatchObject({ result: 'fast', reason: 'laut' });
    expect(judge('Schnecke', 'Schneke', 'streng')).toMatchObject({ result: 'fast', reason: 'laut' });
  });

  it('the right spelling stays right, a wrong one stays wrong in both settings', () => {
    expect(judge('Hund', 'Hund', 'lautgetreu')).toEqual({ result: 'richtig' });
    expect(judge('Hund', 'Hxnt', 'lautgetreu')).toEqual({ result: 'daneben' });
    expect(judge('Ente', 'Ent', 'lautgetreu')).toMatchObject({ result: 'fast', reason: 'buchstabe' });
  });
});

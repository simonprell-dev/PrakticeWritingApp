import { describe, expect, it } from 'vitest';
import { pieceFile, piecesOf, sentenceFile } from '../../src/game/voice/pieces.ts';

const texts = (p: { text: string; gap: boolean }[]) => p.map((x) => (x.gap ? `[${x.text}]` : x.text));

describe('a text with a gap in pieces', () => {
  it('fixed parts and the value one after the other', () => {
    expect(texts(piecesOf('Mauer {n} geschafft!', ['3']))).toEqual(['Mauer', '[3]', 'geschafft!']);
  });

  it('a name in front with a colon is a heading and not said', () => {
    expect(texts(piecesOf('{name}: Schreibt schöne Buchstaben – jeder Stern ist ein Schlag!', ['Unsere Klasse']))).toEqual([
      'Schreibt schöne Buchstaben – jeder Stern ist ein Schlag!',
    ]);
  });

  it('"5×" stays one piece, punctuation alone is no piece', () => {
    expect(texts(piecesOf('Super, {n}× {c} geschafft! Jetzt kommt {next}.', ['5', 'das A', 'das B']))).toEqual([
      'Super',
      '[5×]',
      '[das A]',
      'geschafft! Jetzt kommt',
      '[das B]',
    ]);
  });

  it('brackets and commas at the edges of a piece go', () => {
    expect(texts(piecesOf('1 neues Zeichen! ({m} spiegelverkehrt, {k} kenne ich schon)', ['2', '1']))).toEqual([
      '1 neues Zeichen!',
      '[2]',
      'spiegelverkehrt',
      '[1]',
      'kenne ich schon',
    ]);
  });

  it('file names: a whole sentence, and a piece per speaker', () => {
    expect(sentenceFile('Mauer 3 geschafft!')).toMatch(/^s\/mauer-3-geschafft-\w+$/);
    expect(pieceFile('riese', 'Mauer')).not.toBe(pieceFile('erzaehler', 'Mauer'));
  });
});

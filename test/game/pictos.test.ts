// Every word of the Wörter-Zoo has a picture that draws while still and while alive, inside its square.
import { describe, expect, it } from 'vitest';
import { PICTOS } from '../../src/game/words/pictos/index.ts';
import { WORDS } from '../../src/game/words/words.ts';
import { checkPictos } from '../helpers/pictoCheck.ts';

describe('pictures of the Wörter-Zoo', () => {
  it('every word has its picture', () => {
    expect(WORDS.filter((w) => !PICTOS[w.word]).map((w) => w.word)).toEqual([]);
  });
  checkPictos(PICTOS);
});

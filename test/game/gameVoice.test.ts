import { describe, expect, it } from 'vitest';
import { arrange, lineOf, normalizeVoiceText, pickLine, type Spoken } from '../../src/game/voice/gameVoice.ts';

describe('which line a shown text is', () => {
  it('knows a line of Riese Rumpel', () => {
    expect(lineOf('Hohoho! An meiner Riesenburg kommt keiner vorbei!')).toMatchObject({ voice: 'riese', gap: false });
  });

  it('finds a line with an emoji in front', () => {
    const plain = lineOf('Hohoho! An meiner Riesenburg kommt keiner vorbei!');
    expect(lineOf('🏰 Hohoho! An meiner Riesenburg kommt keiner vorbei!')).toEqual(plain);
  });

  it('knows a line with a gap, filled', () => {
    expect(lineOf('Sieg für Team Blau!')).toMatchObject({ voice: 'erzaehler', gap: true });
  });

  it('an error message is not read to the children', () => {
    expect(lineOf('Das hat nicht geklappt: TypeError: x is undefined')).toBeNull();
  });

  it('a text that is not spoken is nothing', () => {
    expect(lineOf('Einstellungen')).toBeNull();
    expect(lineOf('')).toBeNull();
  });

  it('normalizes emoji and spaces like the voice script', () => {
    expect(normalizeVoiceText('  🐠  Hallo   Welt! ')).toBe('Hallo Welt!');
  });
});

describe('what is said when several lines come at once', () => {
  const now = (voice: Spoken['voice'], key = 'x') => ({ voice, key, gap: false, text: key });

  it('a creature does not talk over the narrator or the giant', () => {
    expect(pickLine(now('erzaehler'), now('wesen', 'y'))).toBe(false);
    expect(pickLine(now('riese'), now('ausruf', 'y'))).toBe(false);
  });

  it('the narrator, the giant and Zork interrupt the little ones', () => {
    expect(pickLine(now('wesen'), now('erzaehler', 'y'))).toBe(true);
    expect(pickLine(now('ausruf'), now('riese', 'y'))).toBe(true);
    expect(pickLine(now('wesen'), now('zork', 'y'))).toBe(true);
  });

  it('nothing playing: anything is said', () => {
    expect(pickLine(null, now('wesen'))).toBe(true);
  });

  it('the same line again right away is not said twice', () => {
    expect(pickLine(now('erzaehler', 'a'), now('erzaehler', 'a'))).toBe(false);
  });

  it('a speaker of the same rank waits for the sentence to end instead of cutting it off', () => {
    expect(arrange(now('riese'), now('erzaehler', 'y'))).toBe('wait');
    expect(arrange(now('wesen'), now('ausruf', 'y'))).toBe('wait');
  });

  it('a more important speaker cuts in, a less important one is dropped, nothing playing: said now', () => {
    expect(arrange(now('wesen'), now('zork', 'y'))).toBe('say');
    expect(arrange(now('erzaehler'), now('wesen', 'y'))).toBe('drop');
    expect(arrange(now('zork', 'a'), now('zork', 'a'))).toBe('drop');
    expect(arrange(null, now('wesen'))).toBe('say');
  });
});

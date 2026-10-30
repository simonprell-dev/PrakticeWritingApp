import { describe, expect, it } from 'vitest';
import { lineSamples } from '../../src/game/paint/fishCard.ts';
import { ANIMALS, SPECIES } from '../../src/game/paint/species.ts';

describe('species register', () => {
  it('keeps the fish exactly as printed before', () => {
    expect(SPECIES.fisch.place).toEqual({ s: 0.82, x: 6, y: 12 });
    expect(SPECIES.fisch.parts.map((p) => p.id)).toEqual(['tail', 'dorsal', 'anal', 'pelvic', 'body', 'pectoral']);
    expect(lineSamples('fisch', 1).length).toBe(516);
  });

  it('lists all animals but the free-form card', () => {
    expect(ANIMALS).toContain('fisch');
    expect(ANIMALS).not.toContain('freiform');
    expect(SPECIES.freiform.parts).toEqual([]);
  });
});

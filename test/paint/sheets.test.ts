import { createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { CARD } from '../../src/game/paint/fishCard.ts';
import { labelsFor, sheetSpecies, sheetTitle } from '../../src/game/paint/sheets.ts';
import { SPECIES, type SpeciesId } from '../../src/game/paint/species.ts';
import { sheetSvg } from '../../src/ui/printSheet.ts';

const ALL = Object.keys(SPECIES) as SpeciesId[];

describe('sheets', () => {
  it('fills a sheet with six cards', () => {
    expect(sheetSpecies('mix-a')).toEqual(['clownfisch', 'doktorfisch', 'kugelfisch', 'karpfen', 'hecht', 'hai']);
    expect(sheetSpecies('mix-b')).toEqual(['fisch', 'seepferdchen', 'qualle', 'krake', 'schildkroete', 'krebs']);
    expect(sheetSpecies('hai')).toEqual(Array(6).fill('hai'));
    expect(sheetSpecies('freiform')).toHaveLength(6);
  });

  it('titles the sheets', () => {
    expect(sheetTitle('hai')).toBe('Hai');
    expect(sheetTitle('schildkroete')).toBe('Schildkröte');
    expect(sheetTitle('mix-a')).toBe('Gemischt: Fische');
    expect(sheetTitle('mix-b')).toBe('Gemischt: Meerestiere');
    expect(sheetTitle('freiform')).toBe('Eigenes Tier');
  });

  it('writes the texts of the cards', () => {
    expect(labelsFor('seepferdchen').name.text).toBe('Mein Seepferdchen heißt:');
    expect(labelsFor('fisch').name.text).toBe('Mein Fisch heißt:');
    const f = labelsFor('freiform');
    expect(f.name.text).toBe('Mein Tier heißt:');
    expect(f.hint.text).toBe('Mal dein eigenes Meerestier!');
    expect(f.arrow?.text).toBe('Kopf nach hier →');
    expect(labelsFor('hai').arrow).toBeUndefined();
  });

  it('keeps the fish card as printed before', () => {
    const l = labelsFor('fisch');
    expect(l.line).toEqual({ x0: 38, x1: CARD.w - 6, y: 81.5 });
    expect(l.name).toMatchObject({ x: 6, y: 80.5, size: 3.6 });
  });

  it.each(ALL)('fits the name and the line of %s into the frame', (sp) => {
    const { name, line } = labelsFor(sp);
    expect(name.size).toBeGreaterThanOrEqual(3.0);
    const ctx = createCanvas(10, 10).getContext('2d');
    ctx.font = `600 ${name.size}px Fredoka`;
    const w = ctx.measureText(name.text).width;
    ctx.font = `600 ${name.size}px sans-serif`;
    const wide = Math.max(w, ctx.measureText(name.text).width * 1.1);
    expect(name.x + wide).toBeLessThanOrEqual(line.x0 - 2);
    expect(line.x1 - line.x0).toBeGreaterThanOrEqual(30);
    expect(line.x1).toBeLessThanOrEqual(CARD.w - CARD.frame - 2);
  });

  it('prints six cards on a sheet, even of the free-form card', () => {
    const count = (s: string) => s.split('<g transform="translate(').length - 1;
    expect(count(sheetSvg('mix-b'))).toBe(6);
    expect(count(sheetSvg('freiform'))).toBe(6);
    expect(sheetSvg('freiform')).toContain('Kopf nach hier');
  });
});

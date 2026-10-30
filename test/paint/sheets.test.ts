import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { drawCard } from '../../src/game/paint/cardArt.ts';
import { CARD, sheetLayout, SHEET } from '../../src/game/paint/fishCard.ts';
import { labelsFor, sheetSpecies, sheetTitle, textWidth } from '../../src/game/paint/sheets.ts';
import { SPECIES, type SpeciesId } from '../../src/game/paint/species.ts';
import { FOOTER_Y, sheetSvg } from '../../src/ui/printSheet.ts';

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
    expect(labelsFor('qualle').name.text).toBe('Meine Qualle heißt:');
    expect(labelsFor('schildkroete').name.text).toBe('Meine Schildkröte heißt:');
    expect(labelsFor('krake').name.text).toBe('Mein Krake heißt:');
    expect(labelsFor('fisch').name.text).toBe('Mein Fisch heißt:');
    const f = labelsFor('freiform');
    expect(f.name.text).toBe('Mein Tier heißt:');
    expect(f.hint.text).toBe('Mal dein eigenes Meerestier!');
    expect(f.arrow?.text).toBe('Kopf nach hier →');
    expect(labelsFor('hai').arrow).toBeUndefined();
  });

  it('keeps the fish card as printed before', () => {
    const l = labelsFor('fisch');
    expect(l.hint).toEqual({ text: 'Mal mich bunt an!', x: CARD.w - 6, y: 8.6, size: 3.4 });
    expect(l.name).toEqual({ text: 'Mein Fisch heißt:', x: 6, y: 80.5, size: 3.6 });
    expect(l.line).toEqual({ x0: 38, x1: CARD.w - 6, y: 81.5 });
    expect(l.nameBox).toEqual({ x: 39, y: 73.5, w: CARD.w - 43.5, h: 11 });
    expect(l.arrow).toBeUndefined();
  });

  // the real font if the canvas can load it, else the sans-serif of the machine with a safety factor
  const fredoka = GlobalFonts.registerFromPath('public/fonts/Fredoka.woff2', 'FredokaTest') !== null && GlobalFonts.has('FredokaTest');
  const measure = (text: string, size: number) => {
    const ctx = createCanvas(10, 10).getContext('2d');
    ctx.font = `600 ${size}px ${fredoka ? 'FredokaTest' : 'sans-serif'}`;
    return ctx.measureText(text).width * (fredoka ? 1 : 1.1);
  };

  it.each(ALL)('fits the name and the line of %s into the frame', (sp) => {
    const { name, line, nameBox } = labelsFor(sp);
    const w = measure(name.text, name.size);
    expect(w).toBeGreaterThan(10);
    expect(name.size).toBeGreaterThanOrEqual(3.0);
    expect(name.x + w + 2).toBeLessThanOrEqual(line.x0);
    expect(textWidth(name.text, name.size)).toBeGreaterThanOrEqual(w);
    expect(line.x1 - line.x0).toBeGreaterThanOrEqual(30);
    expect(line.x1).toBeLessThanOrEqual(CARD.w - CARD.frame - 2);
    expect(nameBox.x).toBeGreaterThanOrEqual(line.x0);
    expect(nameBox.x + nameBox.w).toBeLessThanOrEqual(CARD.w - CARD.frame);
    expect(nameBox.y + nameBox.h).toBeLessThanOrEqual(CARD.h - CARD.frame);
  });

  it('measures the longest names', () => {
    for (const sp of ['schildkroete', 'seepferdchen', 'doktorfisch', 'kugelfisch'] as const) {
      const { name, line } = labelsFor(sp);
      expect(name.x + measure(name.text, name.size) + 2).toBeLessThanOrEqual(line.x0);
    }
  });

  it('draws the free-form card', () => {
    const ctx = createCanvas(94 * 5, 88 * 5).getContext('2d');
    expect(() => drawCard(ctx as unknown as CanvasRenderingContext2D, 5, { species: 'freiform' })).not.toThrow();
    expect(() => sheetSvg('freiform')).not.toThrow();
  });

  it('prints six cards on a sheet, even of the free-form card', () => {
    const count = (s: string) => s.split('<g transform="translate(').length - 1;
    expect(count(sheetSvg('mix-b'))).toBe(6);
    expect(count(sheetSvg('freiform'))).toBe(6);
    expect(sheetSvg('freiform')).toContain('Kopf nach hier');
  });

  it('prints a discreet footer below the cards', () => {
    const L = sheetLayout();
    const bottom = L.y0 + SHEET.rows * L.cellH;
    expect(FOOTER_Y).toBeGreaterThanOrEqual(bottom + 1.5);
    expect(FOOTER_Y).toBeLessThanOrEqual(SHEET.h - 4);
    const withHost = sheetSvg('mix-a', { host: 'example.org' });
    expect(withHost).toContain('example.org');
    expect(withHost).toContain('Ein Projekt von PrellDynamics');
    expect(withHost).toContain(`y="${FOOTER_Y}"`);
    const plain = sheetSvg('mix-a');
    expect(plain).toContain('Ein Projekt von PrellDynamics');
    expect(plain).not.toContain('example.org');
  });
});

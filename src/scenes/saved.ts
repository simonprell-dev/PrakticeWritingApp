// What scenes keep in a saved game: the children's letters with their cut-out picture (PNG data URL).
import { dataURLToRGBA, encodeOnce, rememberEncoded, rgbaToDataURL } from '../app/imageCodec.ts';
import { canvasFromRGBA, type AnyCanvas } from '../game/canvas.ts';
import type { ScannedGlyph } from '../vision/types.ts';

export interface SceneSave {
  state: unknown;
  /** short description for the list of saved games, e.g. "12 Fische" */
  summary: string;
}

export type SavedGlyph = Omit<ScannedGlyph, 'crop'> & { crop: string };

export async function saveGlyph(g: ScannedGlyph): Promise<SavedGlyph> {
  return { ...g, crop: await encodeOnce(g.crop, () => rgbaToDataURL(g.crop)) };
}

/**
 * Glyph ids of an earlier session must not collide with the ids the recognition hands out now
 * (it counts from 1 again after a reload). Negative ids (no glyph) stay.
 */
export const restoredId = (id: number): number => (id < 0 ? id : id + 1_000_000_000);

export async function loadGlyph(s: SavedGlyph): Promise<{ glyph: ScannedGlyph; sticker: AnyCanvas }> {
  const crop = await dataURLToRGBA(s.crop);
  rememberEncoded(crop, s.crop);
  const glyph: ScannedGlyph = { ...s, id: restoredId(s.id), crop };
  return { glyph, sticker: canvasFromRGBA(crop) };
}

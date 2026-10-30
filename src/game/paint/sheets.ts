// The print sheets of the "Mal-Aquarium" (six cards each) and the texts on a card. Pure data and geometry.

import { CARD, LABELS } from './fishCard.ts';
import { SPECIES, type SpeciesId } from './species.ts';

export type SheetId = SpeciesId | 'mix-a' | 'mix-b';

export const MIX_A: SpeciesId[] = ['clownfisch', 'doktorfisch', 'kugelfisch', 'karpfen', 'hecht', 'hai'];
export const MIX_B: SpeciesId[] = ['fisch', 'seepferdchen', 'qualle', 'krake', 'schildkroete', 'krebs'];

/** the animals on the six cards of a sheet, in reading order */
export function sheetSpecies(id: SheetId): SpeciesId[] {
  if (id === 'mix-a') return [...MIX_A];
  if (id === 'mix-b') return [...MIX_B];
  return Array<SpeciesId>(6).fill(id);
}

export function sheetTitle(id: SheetId): string {
  if (id === 'mix-a') return 'Gemischt: Fische';
  if (id === 'mix-b') return 'Gemischt: Meerestiere';
  return id === 'freiform' ? 'Eigenes Tier' : SPECIES[id].name;
}

export interface Label { text: string; x: number; y: number; size: number }
export interface Box { x: number; y: number; w: number; h: number }

export interface CardLabels {
  hint: Label;
  name: Label;
  line: { x0: number; x1: number; y: number };
  /** area cut out to show the name in the game */
  nameBox: Box;
  /** the free-form card: where the head goes */
  arrow?: { x: number; y: number; text: string };
}

/** generous width of a text in mm (Fredoka is narrower, so there is always air before the line) */
const textWidth = (text: string, size: number) => text.length * size * 0.6;

/** space between the name and the line, mm */
const GAP = 3;

/**
 * The texts and the line for the name on a card. The fish keeps its printed layout; a long name first gets a
 * smaller font (down to 3 mm) and only then pushes the line to the right.
 */
export function labelsFor(sp: SpeciesId): CardLabels {
  const free = sp === 'freiform';
  const text = `Mein ${free ? 'Tier' : SPECIES[sp].name} heißt:`;
  const { x, y } = LABELS.name;
  let size: number = LABELS.name.size;
  // the fish is already printed on many sheets: its layout stays exactly as it was
  const keep = sp === 'fisch';
  while (!keep && size > 3.0 && x + textWidth(text, size) + GAP > LABELS.line.x0) size = Math.round((size - 0.1) * 10) / 10;
  const x0 = keep ? LABELS.line.x0 : Math.max(LABELS.line.x0, Math.ceil(x + textWidth(text, size) + GAP));
  const nb = LABELS.nameBox;
  return {
    hint: { ...LABELS.hint, text: free ? 'Mal dein eigenes Meerestier!' : LABELS.hint.text },
    name: { text, x, y, size },
    line: { x0, x1: LABELS.line.x1, y: LABELS.line.y },
    nameBox: { x: x0 + 1, y: nb.y, w: nb.x + nb.w - (x0 + 1), h: nb.h },
    ...(free ? { arrow: { x: CARD.w - 6, y: 44, text: 'Kopf nach hier →' } } : {}),
  };
}

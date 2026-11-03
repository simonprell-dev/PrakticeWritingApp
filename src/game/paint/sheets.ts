// The print sheets of the "Mal-Aquarium" (six cards each) and the texts on a card. Pure data and geometry.

import { t, tk } from '../../i18n/i18n.ts';
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

/** the German title of a sheet (translated where it is shown) */
export function sheetTitle(id: SheetId): string {
  if (id === 'mix-a') return tk('Gemischt: Fische');
  if (id === 'mix-b') return tk('Gemischt: Meerestiere');
  return id === 'freiform' ? tk('Eigenes Tier') : SPECIES[id].name;
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

/** wide characters (Chinese/Japanese, Hangul, full-width forms) and marks that sit on the letter before (Thai, Devanagari, Arabic, Hebrew) */
const WIDE = /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\uff00-\uff60]/u;
const MARK = /\p{M}/u;

/** generous width of a text in mm (Fredoka is narrower, so there is always air before the line) */
export const textWidth = (text: string, size: number) => {
  let n = 0;
  for (const c of text) n += WIDE.test(c) ? 1 : MARK.test(c) ? 0 : 0.6;
  return n * size;
};

/** space between the name and the line, mm */
const GAP = 3;
/** a long (translated) name text leaves at least this much of the line, mm */
const MIN_LINE = 20;

const smaller = (size: number) => Math.round((size - 0.1) * 10) / 10;

/** the font size (mm, down to `min`) at which a translation takes no more room than the German text at `size` */
function fitted(source: string, size: number, min: number): number {
  const text = t(source);
  let s = size;
  while (s > min && textWidth(text, s) > textWidth(source, size)) s = smaller(s);
  return s;
}

/**
 * The texts (translated) and the line for the name on a card. The German fish keeps its printed layout; a long
 * name first gets a smaller font (down to 3 mm) and only then pushes the line to the right (a very long translation
 * gets smaller still, so some line is left). The hint and the arrow words never take more room than the German
 * ones (the free-form hint has a printed box around it, and the card detection keeps their German places free).
 */
export function labelsFor(sp: SpeciesId): CardLabels {
  const free = sp === 'freiform';
  // „Meine Qualle heißt:“, „Mein Hai heißt:“: a whole sentence per animal
  const source = SPECIES[sp].myName;
  const text = t(source);
  const { x, y } = LABELS.name;
  let size: number = LABELS.name.size;
  // the fish is already printed on many sheets: its German layout stays exactly as it was
  const keep = sp === 'fisch' && text === source;
  const room = (s: number) => x + textWidth(text, s) + GAP;
  while (!keep && size > 3.0 && room(size) > LABELS.line.x0) size = smaller(size);
  while (!keep && size > 2.2 && room(size) > LABELS.line.x1 - MIN_LINE) size = smaller(size);
  const x0 = keep ? LABELS.line.x0 : Math.min(LABELS.line.x1 - MIN_LINE, Math.max(LABELS.line.x0, Math.ceil(room(size))));
  const nb = LABELS.nameBox;
  const hint = free ? tk('Mal dein eigenes Meerestier!') : LABELS.hint.text;
  const arrow = tk('Kopf nach hier →');
  // the arrow words are printed in the size of the hint
  const hintSize = free ? Math.min(fitted(hint, LABELS.hint.size, 2.2), fitted(arrow, LABELS.hint.size, 2.2)) : fitted(hint, LABELS.hint.size, 2.2);
  return {
    hint: { ...LABELS.hint, text: t(hint), size: hintSize },
    name: { text, x, y, size },
    line: { x0, x1: LABELS.line.x1, y: LABELS.line.y },
    nameBox: { x: x0 + 1, y: nb.y, w: nb.x + nb.w - (x0 + 1), h: nb.h },
    ...(free ? { arrow: { x: CARD.w - 6, y: 44, text: t(arrow) } } : {}),
  };
}

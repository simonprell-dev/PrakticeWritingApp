// The register of the "Mal-Aquarium" animals: outlines, colouring lines, eye and placement on the card of each
// species, in the animal's own units. Pure data, shared by the print sheet, the card detection and the sprites.

export type SpeciesId = 'fisch' | 'clownfisch' | 'doktorfisch' | 'kugelfisch' | 'karpfen' | 'hecht' | 'hai'
  | 'seepferdchen' | 'qualle' | 'krake' | 'schildkroete' | 'krebs' | 'freiform';
export type Motion = 'swim' | 'dart' | 'puff' | 'bob' | 'pulse' | 'arms' | 'glide' | 'walk' | 'sway';

export interface Eye { x: number; y: number; r: number; pupil: { x: number; y: number; r: number } }

export interface SpeciesDef {
  id: SpeciesId;
  name: string;
  article: 'der' | 'die' | 'das';
  /** closed outline parts, back to front, in the animal's own units */
  parts: { id: string; d: string }[];
  /** ids of the parts drawn as the separately animated limb (tail, fins, claws, arms); may be empty */
  moving: string[];
  /** pivot of the moving part (animal units) */
  pivot: { x: number; y: number };
  /** inner lines (colouring areas) */
  lines: string[];
  /** mouth and other open details */
  strokes: string[];
  eyes: Eye[];
  box: { x0: number; y0: number; x1: number; y1: number };
  /** animal units -> card mm */
  place: { s: number; x: number; y: number };
  motion: Motion;
  /** size in the aquarium relative to the fish (1) */
  size: number;
}

/** The fish (100 × 76 units, facing right). The tail and the fins tuck under the body. */
const FISCH: SpeciesDef = {
  id: 'fisch',
  name: 'Fisch',
  article: 'der',
  parts: [
    { id: 'tail', d: 'M 34 33 C 26 27 16 17 4 11 C 8 23 12 31 13 38 C 12 45 8 53 4 65 C 16 59 26 49 34 43 Z' },
    { id: 'dorsal', d: 'M 72 18 C 66 7 54 1 41 3 C 46 9 47 15 46 23 Z' },
    { id: 'anal', d: 'M 43 58 C 39 64 34 68 28 68 C 31 64 33 59 34 53 Z' },
    { id: 'pelvic', d: 'M 65 61 C 61 68 55 72 47 73 C 50 69 52 65 53 62 Z' },
    { id: 'body', d: 'M 30 30 C 40 15 62 10 78 16 C 90 21 97 31 97 39 C 97 49 88 58 74 62 C 58 66 40 61 30 46 C 28 42 28 34 30 30 Z' },
    { id: 'pectoral', d: 'M 66 45 C 60 46 53 51 52 57 C 58 57 65 53 68 48 Z' },
  ],
  moving: ['tail'],
  pivot: { x: 31, y: 38 },
  lines: [
    // gill and two stripes
    'M 79 22 C 73 30 73 47 79 56',
    'M 61 14 C 56 26 56 49 61 63',
    'M 45 20 C 41 31 41 48 45 58',
    // fin rays
    'M 25 33 L 13 22',
    'M 25 38 L 15 38',
    'M 25 43 L 13 54',
  ],
  strokes: ['M 89.5 46 Q 92.5 48.5 95.5 45.5'],
  eyes: [{ x: 85, y: 32, r: 5.4, pupil: { x: 86.3, y: 32.6, r: 2.5 } }],
  box: { x0: 3, y0: 1.5, x1: 98.5, y1: 74.5 },
  place: { s: 0.82, x: 6, y: 12 },
  motion: 'swim',
  size: 1,
};

// the other animals follow with their own artwork; until then they share the fish
const like = (id: SpeciesId): SpeciesDef => ({ ...FISCH, id });

export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  fisch: FISCH,
  clownfisch: like('clownfisch'),
  doktorfisch: like('doktorfisch'),
  kugelfisch: like('kugelfisch'),
  karpfen: like('karpfen'),
  hecht: like('hecht'),
  hai: like('hai'),
  seepferdchen: like('seepferdchen'),
  qualle: like('qualle'),
  krake: like('krake'),
  schildkroete: like('schildkroete'),
  krebs: like('krebs'),
  freiform: { ...FISCH, id: 'freiform', name: 'Freiform', parts: [], moving: [], lines: [], strokes: [], eyes: [] },
};

export const ANIMALS: SpeciesId[] = (Object.keys(SPECIES) as SpeciesId[]).filter((id) => id !== 'freiform');

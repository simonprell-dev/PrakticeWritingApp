// The stroke tables of all scripts besides Druckschrift, Grundschrift (strokes.ts) and kana (kanaStrokes.ts).
import type { StrokeTable } from './path.ts';
import { STROKES as arabisch } from './arabisch.ts';
import { STROKES as devanagari } from './devanagari.ts';
import { STROKES as griechisch } from './griechisch.ts';
import { STROKES as hangul } from './hangul.ts';
import { STROKES as hebraeisch } from './hebraeisch.ts';
import { STROKES as kyrillisch } from './kyrillisch.ts';
import { STROKES as schreib } from './schreib.ts';
import { STROKES as thai } from './thai.ts';

export const SCRIPT_STROKES: Record<string, StrokeTable> = { schreib, kyrillisch, griechisch, hebraeisch, arabisch, devanagari, hangul, thai };

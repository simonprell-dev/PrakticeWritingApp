// Stroke order and direction for kyrillisch – see path.ts for the format.
//
// Russian printed letters (печатные буквы) as in Russian primary-school print-letter copybooks (прописи).
// Letters with the same shape as a Latin letter (А В Е К М Н О Р С Т Х, а е о р с у х) reuse the order
// and direction of the Latin Druckschrift in strokes.ts. The others follow the usual rules of those
// copybooks: top to bottom, left to right, verticals first, then bars and bowls; the descending
// "feet" of Д Ц Щ come last. Ё/ё get the two dots as one stroke, Й/й the breve, like the umlauts.
// No stroke-by-stroke chart for the print letters was found; the copybooks below are the reference for
// the general rules, not checked letter by letter. Open questions: Ж (halves or vertical first), Ф (oval
// or vertical first), Я.
// Sources:
//   https://codex.spbiiran.ru/wp-content/uploads/2025/01/pishu-krasivo.-propis.pdf (Пишу красиво, пропись)
//   https://18-tim.gosuslugi.ru/netcat_files/162/2733/rp_ot_risunka_k_bukve.pdf (От рисунка к букве)
//   https://ru.wikipedia.org/wiki/Русский_алфавит (letter shapes)
import { RING, type StrokeTable } from './path.ts';

/** small letter bowl, counter-clockwise from the top right (as Latin a) */
const BOWL = RING(0.45, 1.5, 0.4, 0.5, -55, -415);
const BREVE_CAP = (w: number) => `M${w * 0.3} -0.5 C${w * 0.35} -0.18 ${w * 0.65} -0.18 ${w * 0.7} -0.5`;
const BREVE_SMALL = (w: number) => `M${w * 0.28} 0.42 C${w * 0.33} 0.72 ${w * 0.67} 0.72 ${w * 0.72} 0.42`;

const A = ['M0.05 2 L0.7 0', 'M0.7 0 L1.35 2', 'M0.32 1.25 L1.08 1.25'];
const E = ['M0.1 0 L0.1 2', 'M0.1 0 L0.95 0', 'M0.1 1 L0.8 1', 'M0.1 2 L0.95 2'];
const I = ['M0.1 0 L0.1 2', 'M0.1 2 L1.1 0', 'M1.1 0 L1.1 2'];
const e = ['M0.08 1.52 L0.85 1.52', 'M0.85 1.52 C0.88 1.2 0.7 1 0.45 1 C0.2 1 0.05 1.25 0.05 1.5 C0.05 1.8 0.25 2 0.47 2 C0.65 2 0.78 1.92 0.85 1.8'];
const i = ['M0.1 1 L0.1 2', 'M0.1 2 L0.85 1', 'M0.85 1 L0.85 2'];

export const STROKES: StrokeTable = {
  А: { w: 1.4, strokes: A },
  Б: { w: 1.1, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.95 0', 'M0.1 0.95 L0.55 0.95 C1.1 0.95 1.1 2 0.55 2 L0.1 2'] },
  В: { w: 1.15, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C0.98 0 0.98 0.95 0.5 0.95 L0.1 0.95 L0.58 0.95 C1.12 0.95 1.12 2 0.58 2 L0.1 2'] },
  Г: { w: 0.95, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.9 0'] },
  Д: { w: 1.4, strokes: ['M0.45 0 C0.45 1.1 0.38 1.7 0.18 2', 'M0.45 0 L1.15 0 L1.15 2', 'M0.05 2.45 L0.05 2 L1.3 2 L1.3 2.45'] },
  Е: { w: 1.0, strokes: E },
  Ё: { w: 1.0, strokes: [...E, 'D0.32 -0.35 0.68 -0.35'] },
  Ж: { w: 1.7, strokes: ['M0.85 0 L0.85 2', 'M0.1 0 L0.78 1 L0.05 2', 'M1.6 0 L0.92 1 L1.65 2'] },
  З: {
    w: 1.05,
    strokes: ['M0.12 0.25 C0.3 0 0.5 0 0.55 0 C0.9 0 0.95 0.3 0.9 0.5 C0.85 0.75 0.6 0.92 0.4 0.95 C0.75 0.97 1.0 1.15 1.0 1.45 C1.0 1.85 0.7 2 0.5 2 C0.3 2 0.12 1.9 0.05 1.75'],
  },
  И: { w: 1.2, strokes: I },
  Й: { w: 1.2, strokes: [...I, BREVE_CAP(1.2)] },
  К: { w: 1.1, strokes: ['M0.1 0 L0.1 2', 'M0.12 1.1 L1.0 0', 'M0.38 0.78 L1.05 2'] },
  Л: { w: 1.25, strokes: ['M0.45 0 C0.45 1.2 0.35 1.85 0.05 2', 'M0.45 0 L1.15 0 L1.15 2'] },
  М: { w: 1.5, strokes: ['M0.1 2 L0.1 0', 'M0.1 0 L0.75 1.35', 'M0.75 1.35 L1.4 0', 'M1.4 0 L1.4 2'] },
  Н: { w: 1.2, strokes: ['M0.1 0 L0.1 2', 'M1.1 0 L1.1 2', 'M0.1 1 L1.1 1'] },
  О: { w: 1.4, strokes: [RING(0.7, 1, 0.62, 1, -90, -450)] },
  П: { w: 1.2, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L1.1 0 L1.1 2'] },
  Р: { w: 1.05, strokes: ['M0.1 0 L0.1 2', 'M0.1 0 L0.5 0 C1.02 0 1.02 1.05 0.5 1.05 L0.1 1.05'] },
  С: { w: 1.3, strokes: [RING(0.68, 1, 0.62, 1, -40, -320)] },
  Т: { w: 1.2, strokes: ['M0.6 0 L0.6 2', 'M0.05 0 L1.15 0'] },
  У: { w: 1.25, strokes: ['M0.05 0 L0.62 1.35', 'M1.2 0 L0.55 1.7 C0.42 2.0 0.25 2.05 0.1 2'] },
  Ф: { w: 1.6, strokes: ['M0.8 0 L0.8 2', RING(0.8, 0.95, 0.7, 0.6, -90, -450)] },
  Х: { w: 1.2, strokes: ['M0.1 0 L1.1 2', 'M1.1 0 L0.1 2'] },
  Ц: { w: 1.35, strokes: ['M0.1 0 L0.1 2', 'M1.05 0 L1.05 2', 'M0.1 2 L1.25 2 L1.25 2.45'] },
  Ч: { w: 1.1, strokes: ['M0.1 0 L0.1 0.65 C0.1 1.1 0.5 1.15 1.0 1.05', 'M1.0 0 L1.0 2'] },
  Ш: { w: 1.6, strokes: ['M0.1 0 L0.1 2', 'M0.8 0 L0.8 2', 'M1.5 0 L1.5 2', 'M0.1 2 L1.5 2'] },
  Щ: { w: 1.75, strokes: ['M0.1 0 L0.1 2', 'M0.8 0 L0.8 2', 'M1.5 0 L1.5 2', 'M0.1 2 L1.65 2 L1.65 2.45'] },
  Ъ: { w: 1.3, strokes: ['M0.05 0 L0.4 0', 'M0.4 0 L0.4 2', 'M0.4 0.95 L0.8 0.95 C1.3 0.95 1.3 2 0.8 2 L0.4 2'] },
  Ы: { w: 1.5, strokes: ['M0.1 0 L0.1 2', 'M0.1 0.95 L0.5 0.95 C1.0 0.95 1.0 2 0.5 2 L0.1 2', 'M1.4 0 L1.4 2'] },
  Ь: { w: 1.05, strokes: ['M0.1 0 L0.1 2', 'M0.1 0.95 L0.5 0.95 C1.0 0.95 1.0 2 0.5 2 L0.1 2'] },
  Э: { w: 1.3, strokes: [RING(0.62, 1, 0.62, 1, -140, 140), 'M0.4 1 L1.22 1'] },
  Ю: { w: 1.85, strokes: ['M0.1 0 L0.1 2', 'M0.1 1 L0.55 1', RING(1.17, 1, 0.6, 1, -90, -450)] },
  Я: { w: 1.1, strokes: ['M1.0 0 L0.6 0 C0.08 0 0.08 1.05 0.6 1.05 L1.0 1.05', 'M1.0 0 L1.0 2', 'M0.6 1.05 L0.05 2'] },

  а: { w: 0.95, strokes: [BOWL, 'M0.85 1 L0.85 2'] },
  б: { w: 0.95, strokes: ['M0.82 0.1 C0.5 0.15 0.1 0.3 0.08 1.5 C0.05 1.85 0.25 2 0.45 2 C0.7 2 0.85 1.8 0.85 1.5 C0.85 1.2 0.65 1.0 0.45 1.0 C0.25 1.0 0.1 1.15 0.08 1.35'] },
  в: { w: 0.85, strokes: ['M0.1 1 L0.1 2', 'M0.1 1 L0.45 1 C0.75 1 0.75 1.47 0.45 1.47 L0.1 1.47 L0.5 1.47 C0.85 1.47 0.85 2 0.5 2 L0.1 2'] },
  г: { w: 0.75, strokes: ['M0.1 1 L0.1 2', 'M0.1 1 L0.7 1'] },
  д: { w: 1.05, strokes: ['M0.35 1 C0.35 1.55 0.3 1.85 0.15 2', 'M0.35 1 L0.85 1 L0.85 2', 'M0.05 2.4 L0.05 2 L1.0 2 L1.0 2.4'] },
  е: { w: 0.9, strokes: e },
  ё: { w: 0.9, strokes: [...e, 'D0.29 0.55 0.61 0.55'] },
  ж: { w: 1.45, strokes: ['M0.72 1 L0.72 2', 'M0.1 1 L0.66 1.5 L0.05 2', 'M1.35 1 L0.78 1.5 L1.4 2'] },
  з: {
    w: 0.85,
    strokes: ['M0.1 1.15 C0.25 1 0.4 1 0.45 1 C0.7 1 0.75 1.15 0.72 1.25 C0.7 1.4 0.55 1.47 0.4 1.48 C0.65 1.5 0.8 1.6 0.8 1.75 C0.8 1.95 0.6 2 0.42 2 C0.25 2 0.12 1.95 0.05 1.85'],
  },
  и: { w: 0.95, strokes: i },
  й: { w: 0.95, strokes: [...i, BREVE_SMALL(0.95)] },
  к: { w: 0.95, strokes: ['M0.1 1 L0.1 2', 'M0.12 1.55 L0.85 1', 'M0.35 1.4 L0.9 2'] },
  л: { w: 0.95, strokes: ['M0.35 1 C0.35 1.6 0.3 1.9 0.05 2', 'M0.35 1 L0.85 1 L0.85 2'] },
  м: { w: 1.25, strokes: ['M0.1 2 L0.1 1', 'M0.1 1 L0.62 1.7', 'M0.62 1.7 L1.15 1', 'M1.15 1 L1.15 2'] },
  н: { w: 1.0, strokes: ['M0.1 1 L0.1 2', 'M0.9 1 L0.9 2', 'M0.1 1.5 L0.9 1.5'] },
  о: { w: 0.9, strokes: [RING(0.45, 1.5, 0.4, 0.5, -90, -450)] },
  п: { w: 1.0, strokes: ['M0.1 1 L0.1 2', 'M0.1 1 L0.9 1 L0.9 2'] },
  р: { w: 0.95, strokes: ['M0.1 1 L0.1 3', 'M0.1 1.4 C0.2 1.02 0.85 0.98 0.85 1.5 C0.85 2.05 0.25 2.05 0.1 1.85'] },
  с: { w: 0.85, strokes: [RING(0.45, 1.5, 0.4, 0.5, -40, -320)] },
  т: { w: 0.9, strokes: ['M0.45 1 L0.45 2', 'M0.05 1 L0.85 1'] },
  у: { w: 0.9, strokes: ['M0.05 1 L0.45 2', 'M0.85 1 L0.2 3'] },
  ф: { w: 1.2, strokes: ['M0.6 0.2 L0.6 2.8', RING(0.6, 1.5, 0.5, 0.5, -90, -450)] },
  х: { w: 0.9, strokes: ['M0.1 1 L0.85 2', 'M0.85 1 L0.1 2'] },
  ц: { w: 1.1, strokes: ['M0.1 1 L0.1 2', 'M0.9 1 L0.9 2', 'M0.1 2 L1.05 2 L1.05 2.4'] },
  ч: { w: 0.95, strokes: ['M0.1 1 L0.1 1.3 C0.1 1.6 0.45 1.6 0.85 1.55', 'M0.85 1 L0.85 2'] },
  ш: { w: 1.4, strokes: ['M0.1 1 L0.1 2', 'M0.7 1 L0.7 2', 'M1.3 1 L1.3 2', 'M0.1 2 L1.3 2'] },
  щ: { w: 1.55, strokes: ['M0.1 1 L0.1 2', 'M0.7 1 L0.7 2', 'M1.3 1 L1.3 2', 'M0.1 2 L1.45 2 L1.45 2.4'] },
  ъ: { w: 1.1, strokes: ['M0.05 1 L0.3 1', 'M0.3 1 L0.3 2', 'M0.3 1.45 L0.65 1.45 C1.05 1.45 1.05 2 0.65 2 L0.3 2'] },
  ы: { w: 1.3, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.45 L0.45 1.45 C0.85 1.45 0.85 2 0.45 2 L0.1 2', 'M1.2 1 L1.2 2'] },
  ь: { w: 0.9, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.45 L0.45 1.45 C0.85 1.45 0.85 2 0.45 2 L0.1 2'] },
  э: { w: 0.9, strokes: [RING(0.45, 1.5, 0.4, 0.5, -140, 140), 'M0.25 1.5 L0.85 1.5'] },
  ю: { w: 1.45, strokes: ['M0.1 1 L0.1 2', 'M0.1 1.5 L0.5 1.5', RING(0.95, 1.5, 0.45, 0.5, -90, -450)] },
  я: { w: 0.85, strokes: ['M0.75 1 L0.45 1 C0.08 1 0.08 1.55 0.45 1.55 L0.75 1.55', 'M0.75 1 L0.75 2', 'M0.45 1.55 L0.08 2'] },
};

// Stroke order and direction for arabisch – see path.ts for the format.
//
// The 28 letters in their isolated Naskh form (as in Noto Naskh Arabic), as taught to children:
// the main body is written first, right to left and in one stroke where possible (teeth of س ش and
// the tooth of ص ض are written down and back up, without lifting the pen); the loops of ص ض ط ظ ف ق
// و م start at their lower left and run over the top clockwise. Only then come the extras as separate
// strokes: the upright of ط ظ (top to bottom), the small mark of ك, and last the dots (two or three
// dots as one stroke, right before left).
// Sources:
//   https://en.wikibooks.org/wiki/Arabic_alphabet_(by_group) – isolated forms and the dot groups
//   https://en.wikipedia.org/wiki/Arabic_alphabet – letter forms, dots added after the skeleton
// The rule "body right to left first, dots last" is well documented; the start points of the single
// letters (especially ج ح خ ه م) are derived from the Naskh shapes, not taken from a checked chart.
// The head of ج ح خ starts at its left end and runs right before turning back down into the bowl:
// the only way to write the Naskh head and bowl in one stroke.
import type { StrokeTable } from './path.ts';

/** the boat of ب ت ث: down the right tip, along the base line to the left, up the left tip */
const BOAT = 'M1.85 0.95 C1.9 1.4 1.95 1.78 1.5 1.83 L0.6 1.86 C0.3 1.88 0.2 1.6 0.2 1.25';
/** ج ح خ: the head from left to right, back down to the left and round the big bowl */
const HAA = 'M0.45 1.05 C0.6 0.95 0.9 1.1 1.65 1.15 L0.7 1.5 C0.45 1.7 0.35 1.9 0.35 2.15 C0.35 2.55 0.6 2.68 1.0 2.65 L1.7 2.58';
const DAL = 'M0.65 0.98 C0.75 1.3 0.98 1.55 0.95 1.75 C0.9 1.9 0.4 1.88 0.15 1.78';
const RAA = 'M0.75 1.12 C0.85 1.4 1.05 1.75 1.0 2.0 C0.95 2.3 0.6 2.45 0.15 2.38';
/** the round bowl below the base line that ends س ش ص ض ن ل */
const BOWL = (x: number) => `C${x + 0.04} 2.2 ${x - 0.05} 2.6 ${x - 0.6} 2.62 C${x - 1.0} 2.62 ${x - 1.15} 2.3 ${x - 1.12} 1.88`;
const SEEN = `M2.45 1.1 L2.5 1.7 C2.5 1.9 2.15 1.9 2.08 1.7 L2.05 1.38 L2.08 1.7 C2.05 1.9 1.4 1.9 1.35 1.7 L1.32 1.47 L1.34 1.85 ${BOWL(1.34)}`;
const SAAD = `M1.65 1.7 C1.8 1.3 2.1 1.08 2.35 1.08 C2.65 1.08 2.8 1.3 2.75 1.5 C2.7 1.8 2.3 1.85 1.9 1.85 L1.42 1.85 C1.32 1.8 1.3 1.6 1.3 1.45 L1.34 1.85 ${BOWL(1.34)}`;
const TAA = 'M0.8 1.4 C1.0 1.15 1.3 1.05 1.55 1.08 C1.85 1.1 2.0 1.3 1.98 1.5 C1.95 1.8 1.6 1.88 1.2 1.88 L0.2 1.78';
const AIN = 'M1.15 0.95 C1.0 0.75 0.6 0.75 0.5 0.95 C0.38 1.2 0.5 1.45 0.85 1.48 C1.1 1.48 1.3 1.4 1.45 1.28 L0.85 1.62 C0.6 1.8 0.5 2.0 0.52 2.25 C0.55 2.6 0.85 2.7 1.2 2.68 L1.95 2.58';

export const STROKES: StrokeTable = {
  ا: { w: 0.5, strokes: ['M0.25 0.15 L0.25 1.95'] },
  ب: { w: 2.0, strokes: [BOAT, 'D1.0 2.4'] },
  ت: { w: 2.0, strokes: [BOAT, 'D1.15 0.95 0.75 0.95'] },
  ث: { w: 2.0, strokes: [BOAT, 'D1.15 0.97 0.75 0.97 0.95 0.7'] },
  ج: { w: 1.8, strokes: [HAA, 'D1.05 2.05'] },
  ح: { w: 1.8, strokes: [HAA] },
  خ: { w: 1.8, strokes: [HAA, 'D0.95 0.55'] },
  د: { w: 1.1, strokes: [DAL] },
  ذ: { w: 1.1, strokes: [DAL, 'D0.55 0.5'] },
  ر: { w: 1.3, strokes: [RAA] },
  ز: { w: 1.3, strokes: [RAA, 'D0.7 0.7'] },
  س: { w: 2.7, strokes: [SEEN] },
  ش: { w: 2.7, strokes: [SEEN, 'D2.2 0.97 1.8 0.97 2.0 0.7'] },
  ص: { w: 2.9, strokes: [SAAD] },
  ض: { w: 2.9, strokes: [SAAD, 'D2.0 0.55'] },
  ط: { w: 2.1, strokes: [TAA, 'M0.65 0.15 L0.8 1.75'] },
  ظ: { w: 2.1, strokes: [TAA, 'M0.65 0.15 L0.8 1.75', 'D1.5 0.55'] },
  ع: { w: 2.0, strokes: [AIN] },
  غ: { w: 2.0, strokes: [AIN, 'D0.85 0.3'] },
  ف: { w: 2.2, strokes: ['M1.45 1.4 C1.4 1.0 1.55 0.75 1.75 0.75 C2.0 0.75 2.1 1.0 2.1 1.4 L2.1 1.6 C2.1 1.8 1.9 1.85 1.6 1.85 L0.6 1.86 C0.3 1.88 0.15 1.6 0.18 1.25', 'D1.75 0.35'] },
  ق: { w: 1.7, strokes: ['M0.85 1.75 C0.8 1.4 1.0 1.12 1.2 1.12 C1.5 1.12 1.62 1.4 1.62 1.8 L1.6 2.1 C1.55 2.5 1.2 2.65 0.85 2.62 C0.45 2.6 0.25 2.3 0.28 1.88', 'D1.32 0.75 0.95 0.75'] },
  ك: { w: 1.6, strokes: ['M1.3 0.2 L1.4 1.72 C1.42 1.9 1.3 1.9 1.1 1.9 L0.18 1.86 L0.15 1.75', 'M0.78 0.98 C0.55 1.02 0.55 1.2 0.78 1.25 C0.75 1.35 0.65 1.42 0.55 1.45'] },
  ل: { w: 1.5, strokes: [`M1.2 0.15 L1.35 1.88 ${BOWL(1.35)}`] },
  م: { w: 1.3, strokes: ['M0.38 1.42 C0.4 1.2 0.55 1.05 0.7 1.08 C0.95 1.15 1.25 1.45 1.2 1.65 C1.0 1.8 0.5 1.8 0.3 1.9 L0.3 2.85'] },
  ن: { w: 1.5, strokes: [`M1.25 1.45 L1.35 1.88 ${BOWL(1.35)}`, 'D0.75 1.15'] },
  ه: { w: 1.8, strokes: ['M0.9 0.88 C0.65 1.0 0.5 1.3 0.62 1.6 C0.75 1.75 1.05 1.7 1.12 1.5 C1.2 1.25 1.0 1.1 0.9 0.95 C1.2 1.1 1.62 1.4 1.62 1.75 C1.62 1.95 1.2 1.92 0.15 1.8'] },
  و: { w: 1.3, strokes: ['M0.5 1.85 C0.4 1.5 0.5 1.12 0.75 1.12 C1.0 1.12 1.12 1.4 1.12 1.8 C1.12 2.2 0.7 2.45 0.15 2.38'] },
  ي: { w: 1.7, strokes: ['M1.62 1.12 C1.3 1.15 1.0 1.4 0.98 1.7 C0.98 1.9 1.2 1.98 1.45 2.05 C1.65 2.12 1.65 2.35 1.45 2.45 C1.2 2.6 0.9 2.65 0.7 2.62 C0.35 2.6 0.2 2.3 0.25 1.9', 'D1.0 2.92 0.6 2.92'] },
};

// Stroke order and direction for hebraeisch – see path.ts for the format.
//
// Hebrew block / print letters ("ktav dfus"), as taught to beginners: every letter is written from the
// top down and, where its parts stand side by side, from right to left. Free-standing horizontal bars
// (ד, ז, ב's base) go from right to left; a roof that turns into the right-hand down stroke (ב ה ח כ ק ר ת ך,
// the arch of מ ם) is one stroke from its left end over the corner and down, as in Israeli print
// handwriting. Letter parts that are separate pen lifts follow the beginner charts (1–3 strokes).
// Shapes follow the app's rounded font (Rubik-like): ט and פ ף are written in one stroke with their curl.
// No chart with numbered strokes for every letter was found, so the order of ע מ ם ש צ ץ ט פ ף and the
// direction of the roofs follow the general rule and should be checked by someone who writes Hebrew.
// Sources: https://www.hebrewversity.com/how-to-write-hebrew-letters/ (1–3 strokes, top to bottom,
// right to left), https://prohebrew.com/post/how-to-write-the-hebrew-alphabet (א: diagonal first),
// https://www.hebrewversity.com/hebrew-letters-practice-alphabet/ (letter charts incl. final forms).
//
// Layout like Latin lowercase: body between the middle line (1) and the base line (2); ל rises above,
// ק and the final forms ך ן ף ץ reach below the base line; י is only the upper half.
import type { StrokeTable } from './path.ts';

export const STROKES: StrokeTable = {
  // diagonal from top left to bottom right, then the upper right arm, then the lower left leg
  א: { w: 1.0, strokes: ['M0.12 1 L0.91 1.95', 'M0.91 1 L0.54 1.5', 'M0.34 1.27 L0.1 1.95'] },
  ב: {
    w: 1.1,
    strokes: ['M0.11 1.02 C0.3 0.99 0.55 0.99 0.68 1 C0.8 1.01 0.86 1.1 0.86 1.22 L0.86 1.95', 'M1.05 1.95 L0.11 1.95'],
  },
  ג: { w: 0.65, strokes: ['M0.14 1.03 C0.25 0.99 0.45 0.98 0.45 1.15 L0.45 1.95', 'M0.45 1.6 C0.4 1.85 0.25 1.93 0.07 1.93'] },
  ד: { w: 0.95, strokes: ['M0.88 1 L0.03 1', 'M0.62 1 L0.62 1.95'] },
  ה: {
    w: 1.1,
    strokes: ['M0.11 1.03 C0.35 0.99 0.6 0.99 0.7 1 C0.84 1.02 0.91 1.1 0.91 1.25 L0.91 1.95', 'M0.22 1.45 L0.22 1.95'],
  },
  ו: { w: 0.45, strokes: ['M0.22 1 L0.22 1.95'] },
  ז: { w: 0.7, strokes: ['M0.62 1 L0.08 1', 'M0.36 1 L0.36 1.95'] },
  ח: { w: 1.05, strokes: ['M0.08 1 L0.68 1 C0.82 1 0.88 1.08 0.88 1.25 L0.88 1.95', 'M0.19 1 L0.19 1.95'] },
  // down the left side, round the bottom, up the right side and curling in
  ט: {
    w: 1.1,
    strokes: ['M0.18 1 L0.18 1.55 C0.18 1.85 0.35 1.95 0.57 1.95 C0.8 1.95 0.96 1.85 0.96 1.5 L0.96 1.3 C0.96 1.1 0.85 1 0.72 1 C0.58 1 0.5 1.1 0.5 1.25'],
  },
  י: { w: 0.4, strokes: ['M0.2 1 L0.2 1.45'] },
  כ: { w: 1.0, strokes: ['M0.12 1 L0.5 1 C0.8 1 0.85 1.2 0.85 1.47 C0.85 1.75 0.8 1.95 0.5 1.95 L0.12 1.95'] },
  ל: { w: 0.9, strokes: ['M0.12 0.6 L0.12 1 L0.76 1 L0.34 1.95'] },
  // the short left side first, then the arch over to the right, down and back along the base
  מ: {
    w: 1.1,
    strokes: ['M0.18 1 L0.18 1.95', 'M0.18 1.35 C0.3 1.05 0.5 1 0.62 1 C0.85 1 0.96 1.12 0.96 1.35 L0.96 1.95 L0.52 1.95'],
  },
  נ: { w: 0.6, strokes: ['M0.12 1 L0.38 1 C0.42 1 0.43 1.05 0.43 1.1 L0.43 1.75 C0.43 1.9 0.35 1.95 0.25 1.95 L0.05 1.95'] },
  ס: { w: 1.1, strokes: ['M0.08 1 L0.6 1 C0.9 1 1.02 1.15 1.02 1.45 C1.02 1.8 0.85 1.95 0.58 1.95 C0.3 1.95 0.17 1.8 0.16 1.45 L0.16 1'] },
  // the long right arm with the tail first, then the short left arm down to it
  ע: { w: 0.95, strokes: ['M0.77 1 L0.77 1.5 C0.77 1.8 0.6 1.88 0.44 1.92 L0.07 2.03', 'M0.16 1 L0.44 1.9'] },
  פ: {
    w: 1.0,
    strokes: ['M0.5 1.55 C0.3 1.6 0.06 1.55 0.06 1.3 C0.06 1.1 0.25 1 0.5 1 C0.8 1 0.94 1.2 0.94 1.47 C0.94 1.78 0.75 1.95 0.5 1.95 L0.16 1.93'],
  },
  // the small right arm first, then the long diagonal turning into the base
  צ: { w: 1.0, strokes: ['M0.84 1 L0.57 1.55', 'M0.1 1 L0.9 1.95 L0.1 1.95'] },
  ק: {
    w: 1.0,
    strokes: ['M0.07 1 L0.75 1 C0.85 1 0.88 1.05 0.88 1.15 L0.88 1.7 C0.88 1.9 0.8 1.95 0.6 1.95 L0.45 1.95', 'M0.16 1.4 L0.16 2.5'],
  },
  ר: { w: 0.85, strokes: ['M0.05 1.02 C0.3 0.99 0.5 0.99 0.55 1 C0.65 1.02 0.7 1.1 0.7 1.22 L0.7 1.95'] },
  // right arm down, round the bottom and up the left arm, then the middle
  ש: { w: 1.15, strokes: ['M1.04 1 L1.04 1.5 C1.04 1.85 0.85 1.95 0.57 1.95 C0.29 1.95 0.1 1.85 0.1 1.5 L0.1 1', 'M0.57 1 L0.57 1.65'] },
  ת: {
    w: 1.05,
    strokes: ['M0.05 1 L0.68 1 C0.82 1 0.9 1.08 0.9 1.25 L0.9 1.95', 'M0.27 1.02 C0.25 1.1 0.25 1.15 0.25 1.25 L0.25 1.95 L0.03 1.95'],
  },
  ך: { w: 0.8, strokes: ['M0.06 1 L0.48 1 C0.6 1 0.65 1.08 0.65 1.2 L0.65 2.5'] },
  ם: { w: 1.05, strokes: ['M0.16 1 L0.16 1.95', 'M0.05 1 L0.72 1 C0.85 1 0.92 1.08 0.92 1.2 L0.92 1.95 L0.16 1.95'] },
  ן: { w: 0.45, strokes: ['M0.22 1 L0.22 2.5'] },
  ף: { w: 0.9, strokes: ['M0.4 1.55 C0.2 1.6 0.03 1.5 0.03 1.3 C0.03 1.1 0.2 1 0.4 1 C0.65 1 0.79 1.12 0.79 1.35 L0.79 2.5'] },
  ץ: { w: 0.85, strokes: ['M0.75 1 L0.38 1.65', 'M0.08 1 L0.73 2.5'] },
};

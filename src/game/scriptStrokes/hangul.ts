// Stroke order and direction for hangul – see path.ts for the format.
//
// Convention: the Korean school stroke order (획순) as taught in Korean primary schools: top to bottom,
// left to right; a horizontal that meets a vertical at the top comes first and turns into it in one stroke
// (ㄱ, the top of ㄹ ㅁ ㅋ), ㄴ is one stroke down then right, ㅇ is one stroke counter-clockwise from the
// top, the short top stroke of ㅊ and ㅎ is written first. Stroke counts: ㄱ1 ㄴ1 ㄷ2 ㄹ3 ㅁ3 ㅂ4 ㅅ2 ㅇ1 ㅈ2
// ㅊ3 ㅋ2 ㅌ3 ㅍ4 ㅎ3; ㅏ2 ㅑ3 ㅓ2 ㅕ3 ㅗ2 ㅛ3 ㅜ2 ㅠ3 ㅡ1 ㅣ1.
// Sources:
//   - Wikimedia Commons Stroke Order Project, Hangul: https://commons.wikimedia.org/wiki/Commons:Stroke_Order_Project/Hangul
//     (animations such as https://commons.wikimedia.org/wiki/File:%E3%84%B9-order.gif)
//   - National Institute of Korean Language (국립국어원), 한글 자모 쓰는 순서: https://www.korean.go.kr
//   - Wikipedia, "Hangul" – Stroke order: https://en.wikipedia.org/wiki/Hangul#Stroke_order
//     and 한글 획순: https://ko.wikipedia.org/wiki/한글
// Written from these rules (not checked character by character against each source). Fonts and some handwriting guides draw ㅊ's and ㅎ's top stroke
// as a short horizontal or a slanted dot; here it is a short vertical tick, written downward.
//
// Every jamo is first drawn in a unit square (0..1) and then fitted into the 2×2 box: single jamo large and
// centred, syllables with the consonant on the left and ㅏ on the right.
import type { StrokeTable } from './path.ts';
import { RING } from './path.ts';

type Jamo = string[];

const J: Record<string, Jamo> = {
  'ㄱ': ['M0.1 0.12 L0.88 0.12 L0.88 0.92'],
  'ㄴ': ['M0.14 0.08 L0.14 0.88 L0.92 0.88'],
  'ㄷ': ['M0.14 0.12 L0.88 0.12', 'M0.14 0.12 L0.14 0.88 L0.92 0.88'],
  'ㄹ': ['M0.12 0.1 L0.86 0.1 L0.86 0.48', 'M0.14 0.48 L0.86 0.48', 'M0.14 0.48 L0.14 0.9 L0.92 0.9'],
  'ㅁ': ['M0.14 0.12 L0.14 0.88', 'M0.14 0.12 L0.86 0.12 L0.86 0.88', 'M0.14 0.88 L0.86 0.88'],
  'ㅂ': ['M0.16 0.08 L0.16 0.9', 'M0.84 0.08 L0.84 0.9', 'M0.16 0.48 L0.84 0.48', 'M0.16 0.9 L0.84 0.9'],
  'ㅅ': ['M0.5 0.08 C0.47 0.45 0.32 0.72 0.06 0.92', 'M0.5 0.42 C0.58 0.66 0.74 0.82 0.94 0.92'],
  'ㅇ': [RING(0.5, 0.5, 0.42, 0.42, -90, -450)],
  'ㅈ': ['M0.12 0.12 L0.86 0.12 C0.68 0.5 0.4 0.76 0.06 0.92', 'M0.52 0.5 C0.62 0.68 0.76 0.82 0.94 0.92'],
  'ㅊ': ['M0.5 0 L0.5 0.16', 'M0.12 0.28 L0.86 0.28 C0.68 0.6 0.4 0.8 0.06 0.94', 'M0.52 0.6 C0.62 0.74 0.76 0.86 0.94 0.94'],
  'ㅋ': ['M0.1 0.12 L0.88 0.12 L0.88 0.92', 'M0.1 0.5 L0.88 0.5'],
  'ㅌ': ['M0.14 0.1 L0.88 0.1', 'M0.14 0.48 L0.86 0.48', 'M0.14 0.1 L0.14 0.9 L0.92 0.9'],
  'ㅍ': ['M0.08 0.12 L0.92 0.12', 'M0.32 0.12 L0.32 0.88', 'M0.68 0.12 L0.68 0.88', 'M0.06 0.88 L0.94 0.88'],
  'ㅎ': ['M0.5 0 L0.5 0.14', 'M0.12 0.26 L0.88 0.26', RING(0.5, 0.66, 0.3, 0.27, -90, -450)],
  'ㅏ': ['M0.4 0.04 L0.4 0.96', 'M0.4 0.5 L0.78 0.5'],
  'ㅑ': ['M0.4 0.04 L0.4 0.96', 'M0.4 0.38 L0.78 0.38', 'M0.4 0.62 L0.78 0.62'],
  'ㅓ': ['M0.22 0.5 L0.6 0.5', 'M0.6 0.04 L0.6 0.96'],
  'ㅕ': ['M0.22 0.38 L0.6 0.38', 'M0.22 0.62 L0.6 0.62', 'M0.6 0.04 L0.6 0.96'],
  'ㅗ': ['M0.5 0.4 L0.5 0.72', 'M0.04 0.72 L0.96 0.72'],
  'ㅛ': ['M0.36 0.4 L0.36 0.72', 'M0.64 0.4 L0.64 0.72', 'M0.04 0.72 L0.96 0.72'],
  'ㅜ': ['M0.04 0.32 L0.96 0.32', 'M0.5 0.32 L0.5 0.68'],
  'ㅠ': ['M0.04 0.32 L0.96 0.32', 'M0.36 0.32 L0.36 0.68', 'M0.64 0.32 L0.64 0.68'],
  'ㅡ': ['M0.04 0.5 L0.96 0.5'],
  'ㅣ': ['M0.5 0.04 L0.5 0.96'],
};

const n = (v: number) => String(Math.round(v * 1000) / 1000);

/** maps the unit-square strokes of a jamo into the rectangle (x0, y0)–(x1, y1) */
function fit(strokes: Jamo, x0: number, y0: number, x1: number, y1: number): string[] {
  const sx = x1 - x0, sy = y1 - y0;
  return strokes.map((s) =>
    [...s.matchAll(/([MLCOD])([^MLCOD]*)/g)].map(([, cmd, args]) => {
      const v = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      const out =
        cmd === 'O'
          ? [x0 + v[0] * sx, y0 + v[1] * sy, v[2] * sx, v[3] * sy, v[4], v[5]]
          : v.map((a, i) => (i % 2 === 0 ? x0 + a * sx : y0 + a * sy));
      return cmd + out.map((a, i) => (cmd === 'O' && i >= 4 ? String(a) : n(a))).join(' ');
    }).join(' '),
  );
}

const STROKE_TABLE: StrokeTable = {};
for (const [ch, strokes] of Object.entries(J)) STROKE_TABLE[ch] = { w: 2, box: true, strokes: fit(strokes, 0.25, 0.25, 1.75, 1.75) };

// syllables consonant + ㅏ: the consonant on the left, the vowel on the right
const SYLLABLES: [string, string][] = [
  ['가', 'ㄱ'], ['나', 'ㄴ'], ['다', 'ㄷ'], ['라', 'ㄹ'], ['마', 'ㅁ'], ['바', 'ㅂ'], ['사', 'ㅅ'],
  ['아', 'ㅇ'], ['자', 'ㅈ'], ['차', 'ㅊ'], ['카', 'ㅋ'], ['타', 'ㅌ'], ['파', 'ㅍ'], ['하', 'ㅎ'],
];
// before a vertical vowel the down stroke of ㄱ and ㅋ sweeps to the lower left
const LEFT: Record<string, Jamo> = {
  'ㄱ': ['M0.08 0.14 L0.86 0.14 C0.84 0.52 0.62 0.8 0.16 0.96'],
  'ㅋ': ['M0.08 0.14 L0.86 0.14 C0.84 0.52 0.62 0.8 0.16 0.96', 'M0.1 0.5 L0.8 0.5'],
};
for (const [syl, c] of SYLLABLES) {
  STROKE_TABLE[syl] = { w: 2, box: true, strokes: [...fit(LEFT[c] ?? J[c], 0.18, 0.45, 1.2, 1.55), ...fit(J['ㅏ'], 1.12, 0.2, 1.92, 1.8)] };
}

export const STROKES: StrokeTable = STROKE_TABLE;

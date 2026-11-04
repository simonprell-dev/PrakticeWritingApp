// Rechenmeer: reads the child's answer – the new digits of a scan, side by side on one line, left to right.
import { tierOf } from '../../recog/score.ts';
import type { Box, ScannedGlyph } from '../../vision/types.ts';

export type Reading =
  | { kind: 'none' }
  | { kind: 'several' }
  | { kind: 'unsure'; glyphs: ScannedGlyph[] }
  | { kind: 'partial'; glyphs: ScannedGlyph[] }
  | { kind: 'number'; value: number; glyphs: ScannedGlyph[] };

/** a digit read with less legibility than this is asked again instead of judged */
export const UNSURE_L = 0.35;
/** an answer has at most this many digits (0–100) */
const MAX_DIGITS = 3;
/** gap between two digits of one number, in digit heights */
const GAP = 1.2;
/** px between two digits in the combined cut-out */
const SPACING = 4;

/** two digits belong to one number: on one line and close together */
function together(a: Box, b: Box, meanH: number): boolean {
  const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (overlap < 0.5 * Math.min(a.h, b.h)) return false;
  const gap = Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
  return gap <= GAP * meanH;
}

/** the digits in groups of one number each, each group left to right */
export function groupDigits(gs: ScannedGlyph[]): ScannedGlyph[][] {
  if (!gs.length) return [];
  const meanH = gs.reduce((s, g) => s + g.box.h, 0) / gs.length;
  const parent = gs.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < gs.length; i++)
    for (let j = i + 1; j < gs.length; j++) if (together(gs[i].box, gs[j].box, meanH)) parent[root(i)] = root(j);
  const groups = new Map<number, ScannedGlyph[]>();
  gs.forEach((g, i) => {
    const r = root(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(g);
  });
  return [...groups.values()].map((g) => g.sort((a, b) => a.box.x - b.box.x));
}

/**
 * The answer in the new digits of a scan. pending: the digits of a scan that held only part of the result
 * (a "3" for 23, the "2" still to come): new digits on their line are read together with them.
 */
export function readAnswer(fresh: ScannedGlyph[], expected: number, pending: ScannedGlyph[] | null): Reading {
  if (!fresh.length) return { kind: 'none' };
  let groups = groupDigits(fresh);
  if (pending?.length) {
    const joined = groupDigits([...pending, ...fresh]);
    const withPending = joined.find((g) => g.some((d) => pending.includes(d)) && g.some((d) => !pending.includes(d)));
    if (withPending) groups = joined.filter((g) => g.some((d) => !pending.includes(d)));
  }
  if (groups.length !== 1 || groups[0].length > MAX_DIGITS) return { kind: 'several' };
  const glyphs = groups[0];
  if (glyphs.some((g) => g.score.parts.L < UNSURE_L)) return { kind: 'unsure', glyphs };
  const text = glyphs.map((g) => g.score.char).join('');
  const want = String(expected);
  if (!pending?.length && text.length < want.length && (want.startsWith(text) || want.endsWith(text))) return { kind: 'partial', glyphs };
  return { kind: 'number', value: Number(text), glyphs };
}

/** one glyph for a whole number: its digits side by side, the mean score, the tip of the weakest digit */
export function combineGlyphs(gs: ScannedGlyph[], id: number): ScannedGlyph {
  const sorted = [...gs].sort((a, b) => a.box.x - b.box.x);
  const width = sorted.reduce((s, g) => s + g.crop.width, 0) + SPACING * (sorted.length - 1);
  const height = Math.max(...sorted.map((g) => g.crop.height));
  const data = new Uint8ClampedArray(width * height * 4);
  let x0 = 0;
  for (const g of sorted) {
    const { width: w, height: h, data: src } = g.crop;
    const dy = Math.floor((height - h) / 2);
    for (let y = 0; y < h; y++) data.set(src.subarray(y * w * 4, (y + 1) * w * 4), ((y + dy) * width + x0) * 4);
    x0 += w + SPACING;
  }
  const x = Math.min(...sorted.map((g) => g.box.x));
  const y = Math.min(...sorted.map((g) => g.box.y));
  const box = {
    x,
    y,
    w: Math.max(...sorted.map((g) => g.box.x + g.box.w)) - x,
    h: Math.max(...sorted.map((g) => g.box.y + g.box.h)) - y,
  };
  const score = Math.round(sorted.reduce((s, g) => s + g.score.score, 0) / sorted.length);
  const weakest = sorted.reduce((w, g) => (g.score.score < w.score.score ? g : w));
  const text = sorted.map((g) => g.score.char).join('');
  const mirrored = sorted.some((g) => g.score.mirrored) || undefined;
  return {
    id,
    box,
    regionId: sorted[0].regionId,
    dots: 0,
    crop: { width, height, data },
    score: {
      ...weakest.score,
      score,
      tier: tierOf(score),
      char: text,
      scoredAs: text,
      tip: weakest.score.tip,
      mirrored,
      looksLike: undefined,
      rejected: undefined,
    },
    isNew: true,
  };
}

// Combines legibility, template similarity, stroke quality and proportions into a 0..100 beauty score.
import type { GlyphScore, Strictness, Tier, TipId } from '../vision/types.ts';

export interface ScoreInput {
  /** CNN group probability of the scored character (null without model) */
  L: number | null;
  /** chamfer margin to the best other character (template-only legibility) */
  margin: number;
  /** template similarity 0..1 */
  T: number;
  shear: number;
  jitter: number;
  widthCV: number;
  holesG: number;
  holesT: number;
  endG: number;
  endT: number;
  juncG: number;
  juncT: number;
  aspectG: number;
  aspectT: number;
  dots: number;
  expectedDots: number;
  /** body height relative to the scan median, corrected for ascenders (1 = consistent) */
  sizeRel?: number;
  /** distance of the base line to a ruled line in line-spacing units */
  baselineDev?: number;
  mirrored: boolean;
  looksLike?: string;
  /** free writing: the best matching character was chosen, so legibility is judged more strictly */
  free?: boolean;
}

/**
 * Strictness curves: raw score -> 0..100, piecewise linear through anchors calibrated with
 * tools/calibrate.ts (synthetic quality levels: clean ≈ 0.97, slightly shaky ≈ 0.89, shaky ≈ 0.55,
 * very shaky ≈ 0.38 raw in practice mode).
 */
export const CURVES: Record<Strictness, [number, number][]> = {
  leicht: [
    [0.2, 8],
    [0.375, 30],
    [0.55, 58],
    [0.85, 88],
    [0.95, 100],
  ],
  mittel: [
    [0.25, 4],
    [0.375, 16],
    [0.55, 40],
    [0.89, 80],
    [0.97, 100],
  ],
  streng: [
    [0.35, 3],
    [0.45, 10],
    [0.6, 30],
    [0.92, 72],
    [0.985, 100],
  ],
};

export function applyCurve(raw: number, s: Strictness): number {
  const a = CURVES[s];
  if (raw <= a[0][0]) return a[0][1] * Math.max(0, raw / a[0][0]);
  for (let i = 1; i < a.length; i++) {
    if (raw <= a[i][0]) {
      const [x0, y0] = a[i - 1];
      const [x1, y1] = a[i];
      return y0 + ((raw - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  return 100;
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function tierOf(score: number): Tier {
  if (score < 30) return 'zerknittert';
  if (score < 50) return 'schief';
  if (score < 70) return 'nett';
  if (score < 88) return 'schoen';
  return 'prachtvoll';
}

export const TIER_LABEL: Record<Tier, string> = {
  zerknittert: 'Knautschi',
  schief: 'Wackelchen',
  nett: 'Freundlich',
  schoen: 'Schick',
  prachtvoll: 'Prachtstück',
};

/** 1..5 stars for the HUD */
export function starsOf(score: number): number {
  return score < 30 ? 1 : score < 50 ? 2 : score < 70 ? 3 : score < 88 ? 4 : 5;
}

export interface Combined {
  score: number;
  tier: Tier;
  parts: GlyphScore['parts'];
  tip: TipId;
  raw: number;
}

export function combine(si: ScoreInput, strictness: Strictness): Combined {
  const hasCnn = si.L !== null;
  const Lp = hasCnn ? (si.free ? smoothstep(0.3, 0.95, si.L as number) : smoothstep(0.1, 0.8, si.L as number)) : smoothstep(0, 0.5, si.margin);
  const T = clamp01(si.T);

  const sJit = Math.exp(-Math.max(0, si.jitter - 0.45) / 0.6);
  const dHoles = Math.abs(si.holesG - si.holesT);
  const sTopo =
    1 / (1 + 0.6 * dHoles + 0.15 * Math.max(0, Math.abs(si.endG - si.endT) - 1) + 0.15 * Math.max(0, Math.abs(si.juncG - si.juncT) - 1));
  const sWidth = Math.exp(-Math.max(0, si.widthCV - 0.3) / 0.3);
  const S = 0.45 * sJit + 0.4 * sTopo + 0.15 * sWidth;

  const pSlant = 1 - clamp01((Math.abs(si.shear) - 0.15) / 0.3);
  const pAspect = Math.exp(-Math.abs(Math.log(Math.max(0.05, si.aspectG) / Math.max(0.05, si.aspectT))) / 0.5);
  const dotsOk = si.dots === si.expectedDots;
  const pDots = si.expectedDots || si.dots ? (dotsOk ? 1 : 0.45) : undefined;
  const pSize = si.sizeRel !== undefined ? Math.exp(-Math.abs(Math.log(Math.max(0.05, si.sizeRel))) / 0.45) : undefined;
  const pBase = si.baselineDev !== undefined ? Math.exp(-si.baselineDev / 0.25) : undefined;
  const pTerms = [pSlant, pAspect, pDots, pSize, pBase].filter((v): v is number => v !== undefined);
  const P = pTerms.reduce((a, b) => a + b, 0) / pTerms.length;

  let raw = hasCnn ? 0.35 * Lp + 0.35 * T + 0.15 * S + 0.15 * P : 0.25 * Lp + 0.45 * T + 0.15 * S + 0.15 * P;
  if (si.mirrored || si.looksLike) raw *= 0.6;

  const score = Math.round(Math.max(3, Math.min(100, applyCurve(raw, strictness))));

  let tip: TipId;
  if (si.mirrored) tip = 'spiegel';
  else if (si.looksLike) tip = 'anderes';
  else if (score >= 88) tip = 'super';
  else {
    const deficits: [TipId, number][] = [
      ['form', 1 - T],
      ['ruhig', (1 - sJit) * 0.9],
      ['bauch', dHoles ? 0.75 : 0],
      ['punkt', pDots !== undefined && !dotsOk ? 0.7 : 0],
      ['gerade', (1 - pSlant) * 0.9],
      ['groesse', pSize !== undefined ? (1 - pSize) * 0.8 : 0],
      ['linie', pBase !== undefined ? (1 - pBase) * 0.7 : 0],
    ];
    deficits.sort((a, b) => b[1] - a[1]);
    tip = deficits[0][0];
  }
  return { score, tier: tierOf(score), parts: { L: Lp, T, S, P }, tip, raw };
}

export const TIP_TEXT: Record<TipId, string> = {
  form: 'Schau dir das Vorbild genau an!',
  ruhig: 'Ganz langsam und ruhig schreiben.',
  gerade: 'Schön gerade halten!',
  bauch: 'Bäuche schön zumachen!',
  punkt: 'Punkte nicht vergessen!',
  groesse: 'Alle gleich groß schreiben.',
  linie: 'Auf der Linie sitzen!',
  anderes: 'Das sieht aus wie ein anderes Zeichen.',
  spiegel: 'Dreh mich um – ich bin gespiegelt!',
  super: 'Wunderschön!',
};

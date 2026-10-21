import { boxBlur, maxFilter } from './filters.ts';
import type { GrayF, PenPreset } from './types.ts';
import { otsu } from './threshold.ts';

/**
 * Illumination-normalised colour planes: N_c = I_c / background_c (paper ≈ 1, ink < 1).
 * The background is the local maximum (removes strokes up to ~2r wide) smoothed by a box blur.
 */
export interface NormPlanes {
  width: number;
  height: number;
  n: [Float32Array, Float32Array, Float32Array];
  /** inkness = 1 - min_c N_c, clamped to 0..1 */
  ink: Float32Array;
  radius: number;
}

/**
 * Smooth paper background of one plane: local max (removes strokes) + box blur, computed on a
 * max-pooled low resolution copy (the background is smooth) and bilinearly upsampled.
 */
export function background(p: Float32Array, w: number, h: number, r: number): Float32Array {
  const f = Math.max(1, Math.min(4, Math.floor(r / 2)));
  const lw = Math.ceil(w / f);
  const lh = Math.ceil(h / f);
  const pooled = new Float32Array(lw * lh);
  const colLow = new Int32Array(w);
  for (let x = 0; x < w; x++) colLow[x] = (x / f) | 0;
  for (let y = 0; y < h; y++) {
    const row = ((y / f) | 0) * lw;
    const src = y * w;
    for (let x = 0; x < w; x++) {
      const li = row + colLow[x];
      const v = p[src + x];
      if (v > pooled[li]) pooled[li] = v;
    }
  }
  const lr = Math.max(1, Math.round(r / f));
  const bgLow = boxBlur(maxFilter(pooled, lw, lh, lr), lw, lh, 2 * lr);
  if (f === 1) return bgLow;
  const out = new Float32Array(w * h);
  const cx0 = new Int32Array(w);
  const cx1 = new Int32Array(w);
  const ctx = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const fx = Math.max(0, (x + 0.5) / f - 0.5);
    cx0[x] = Math.min(lw - 1, fx | 0);
    cx1[x] = Math.min(lw - 1, cx0[x] + 1);
    ctx[x] = fx - cx0[x];
  }
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, (y + 0.5) / f - 0.5);
    const y0 = Math.min(lh - 1, fy | 0);
    const r0 = y0 * lw;
    const r1 = Math.min(lh - 1, y0 + 1) * lw;
    const ty = fy - y0;
    const o = y * w;
    for (let x = 0; x < w; x++) {
      const tx = ctx[x];
      const a0 = bgLow[r0 + cx0[x]];
      const a1 = bgLow[r0 + cx1[x]];
      const b0 = bgLow[r1 + cx0[x]];
      const b1 = bgLow[r1 + cx1[x]];
      const top = a0 + (a1 - a0) * tx;
      const bot = b0 + (b1 - b0) * tx;
      out[o + x] = top + (bot - top) * ty;
    }
  }
  return out;
}

export function normalisePlanes(
  planes: [Float32Array, Float32Array, Float32Array],
  w: number,
  h: number,
  r: number,
): NormPlanes {
  const n: Float32Array[] = [];
  for (const p of planes) {
    const bg = background(p, w, h, r);
    const out = new Float32Array(w * h);
    for (let i = 0; i < out.length; i++) {
      const b = bg[i] > 8 ? bg[i] : 8;
      const v = p[i] / b;
      out[i] = v > 1.2 ? 1.2 : v;
    }
    n.push(out);
  }
  const ink = new Float32Array(w * h);
  const [nr, ng, nb] = n;
  for (let i = 0; i < ink.length; i++) {
    let m = nr[i] < ng[i] ? nr[i] : ng[i];
    if (nb[i] < m) m = nb[i];
    const v = 1 - m;
    ink[i] = v < 0 ? 0 : v > 1 ? 1 : v;
  }
  return { width: w, height: h, n: n as NormPlanes['n'], ink, radius: r };
}

export function inkGray(p: NormPlanes): GrayF {
  return { width: p.width, height: p.height, data: p.ink };
}

export interface InkThresholds {
  weak: number;
  strong: number;
}

/** Hysteresis thresholds per pen preset; 'auto' uses Otsu on the ink histogram (ignoring paper noise). */
export function inkThresholds(ink: Float32Array, pen: PenPreset, validMask?: Uint8Array): InkThresholds {
  if (pen === 'felt') return { weak: 0.15, strong: 0.3 };
  if (pen === 'pencil') return { weak: 0.09, strong: 0.18 };
  let vals = ink;
  if (validMask) {
    let n = 0;
    for (let i = 0; i < ink.length; i++) if (validMask[i] && ink[i] >= 0.06) n++;
    vals = new Float32Array(n);
    n = 0;
    for (let i = 0; i < ink.length; i++) if (validMask[i] && ink[i] >= 0.06) vals[n++] = ink[i];
  }
  let t = vals.length > 50 ? otsu(vals, 0, 1, 128, 0.06) : 0.25;
  t = Math.min(0.4, Math.max(0.12, t));
  return { weak: Math.max(0.07, t * 0.5), strong: t };
}

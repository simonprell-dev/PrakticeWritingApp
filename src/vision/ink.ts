import { boxBlur, maxFilter, rowMaxFilter } from './filters.ts';
import { estimateSkew } from './lines.ts';
import { otsu } from './threshold.ts';
import type { GrayF, Mask, PenPreset } from './types.ts';

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
  /** lines printed across the page (only when asked for) */
  rows?: RowStructure;
}

/**
 * School lines and coloured middle bands, seen through the row background: `profile` is, per sheared
 * row (index y + pad), how much darker the row background is than the paper (0 = plain paper).
 */
export interface RowStructure {
  skew: number;
  profile: Float32Array;
  pad: number;
}

/** vertical shift of column x that makes lines with slope t horizontal (sheared row = y - shift) */
export function shearShift(x: number, w: number, t: number): number {
  return Math.round((x - w / 2) * t);
}

/**
 * Vertical shear of a plane that is `lw` columns wide, every column standing for `f` full-resolution
 * columns of a frame `w` wide; dir 1: lines with slope t become horizontal, -1: back. Row by row, so
 * the memory is read almost in order.
 */
function shear(src: Float32Array, lw: number, h: number, f: number, w: number, t: number, dir: 1 | -1): Float32Array {
  const out = new Float32Array(lw * h);
  const d = new Int32Array(lw);
  for (let x = 0; x < lw; x++) d[x] = dir * shearShift(x * f + f / 2, w, t);
  for (let y = 0; y < h; y++) {
    const o = y * lw;
    for (let x = 0; x < lw; x++) {
      let ys = y + d[x];
      if (ys < 0) ys = 0;
      else if (ys >= h) ys = h - 1;
      out[o + x] = src[ys * lw + x];
    }
  }
  return out;
}

/** horizontal max-pooling by f: printed lines stay lines, the background stays the background */
function poolRows(src: Float32Array, w: number, h: number, f: number): Float32Array {
  const lw = Math.ceil(w / f);
  const out = new Float32Array(lw * h);
  for (let y = 0; y < h; y++) {
    const o = y * lw;
    const i0 = y * w;
    for (let x = 0; x < w; x++) {
      const j = o + ((x / f) | 0);
      const v = src[i0 + x];
      if (v > out[j]) out[j] = v;
    }
  }
  return out;
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

/**
 * Background along the (possibly skewed) rows: the brightest value within a wide window in x. Lines
 * and coloured bands printed across the whole page are background here, letters (much narrower than
 * the window) are not. Taking the darker of this and the local background keeps a narrow coloured
 * middle band (Kontrastlineatur) from being read as ink, and makes the printed lines disappear.
 */
function rowBackgrounds(planes: Float32Array[], bgs: Float32Array[], w: number, h: number, r: number): RowStructure {
  // all of it at a quarter of the width: the row background is smooth along the rows anyway
  const f = 4;
  const lw = Math.ceil(w / f);
  const P = planes.map((q) => poolRows(q, w, h, f));
  const B = bgs.map((q) => poolRows(q, w, h, f));
  // skew of the printed lines, from an evenly scaled darkness mask (every f-th row)
  const lh = Math.ceil(h / f);
  const m: Mask = { width: lw, height: lh, data: new Uint8Array(lw * lh) };
  for (let y = 0; y < lh; y++) {
    for (let x = 0; x < lw; x++) {
      const i = y * f * lw + x;
      let v = 1;
      for (let k = 0; k < 3; k++) {
        const q = P[k][i] / (B[k][i] > 8 ? B[k][i] : 8);
        if (q < v) v = q;
      }
      m.data[y * lw + x] = v < 0.95 ? 1 : 0;
    }
  }
  const skew = estimateSkew(m);
  const t = Math.tan(skew);
  const R = Math.max(r * 4, Math.round(Math.max(w, h) / 12));
  const sheared = P.map((q) => rowMaxFilter(shear(q, lw, h, f, w, t, 1), lw, h, Math.max(1, Math.round(R / f))));
  // only paper counts: a dark table between paper slips must not look like printed lines
  const lum = new Float32Array(lw * h);
  for (let i = 0; i < lum.length; i++) lum[i] = Math.min(P[0][i], P[1][i], P[2][i]);
  const sample: number[] = [];
  for (let i = 0; i < lum.length; i += 23) sample.push(lum[i]);
  sample.sort((x, y) => x - y);
  const paperMin = 0.55 * sample[Math.floor(sample.length * 0.95)];
  const lumS = shear(lum, lw, h, f, w, t, 1);
  // a pixel belongs to the paper if it is bright, or if it lies on a line or band: paper close above
  // AND below it (a slip edge has the dark table on one side)
  const D = Math.max(8, Math.round(h * 0.06));
  const onPaper = new Uint8Array(lw * h);
  const since = new Int32Array(lw).fill(1 << 20);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < lw; x++) {
      const i = y * lw + x;
      since[x] = lumS[i] >= paperMin ? 0 : since[x] + 1;
      if (since[x] <= D) onPaper[i] = 1;
    }
  }
  since.fill(1 << 20);
  for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < lw; x++) {
      const i = y * lw + x;
      since[x] = lumS[i] >= paperMin ? 0 : since[x] + 1;
      if (since[x] > D) onPaper[i] = 0;
    }
  }
  // row profile: the row background compared with the paper above and below it (not with the local
  // background, which adapts to wide bands); rows with little paper are left out
  const paperRow = new Uint8Array(h);
  const level = [new Float32Array(h), new Float32Array(h), new Float32Array(h)];
  for (let y = 0; y < h; y++) {
    let a0 = 0;
    let a1 = 0;
    let a2 = 0;
    let n = 0;
    for (let x = 0; x < lw; x++) {
      const i = y * lw + x;
      if (!onPaper[i]) continue;
      a0 += sheared[0][i];
      a1 += sheared[1][i];
      a2 += sheared[2][i];
      n++;
    }
    paperRow[y] = n >= lw * 0.25 ? 1 : 0;
    if (n) {
      level[0][y] = a0 / n;
      level[1][y] = a1 / n;
      level[2][y] = a2 / n;
    }
  }
  const W = Math.max(8, Math.round(R / 2));
  // the paper is the brightest row nearby (all channels of the same row: a yellow band can be
  // brighter than the paper in red)
  const bright = new Float32Array(h);
  for (let y = 0; y < h; y++) bright[y] = paperRow[y] ? Math.min(level[0][y], level[1][y], level[2][y]) : 0;
  const profile = new Float32Array(h);
  for (let y = 0; y < h; y++) {
    if (!paperRow[y]) continue;
    let best = y;
    for (let k = Math.max(0, y - W); k <= Math.min(h - 1, y + W); k++) if (bright[k] > bright[best]) best = k;
    let q = 1;
    for (let k = 0; k < 3; k++) {
      const v = level[k][y] / Math.max(8, level[k][best]);
      if (v < q) q = v;
    }
    profile[y] = Math.max(0, 1 - q);
  }
  // the darker of the local and the row background (back at full resolution)
  for (let k = 0; k < 3; k++) {
    const rowBg = shear(sheared[k], lw, h, f, w, t, -1);
    const bg = bgs[k];
    for (let y = 0; y < h; y++) {
      const o = y * w;
      const lo = y * lw;
      for (let x = 0; x < w; x++) {
        const v = rowBg[lo + ((x / f) | 0)];
        if (v < bg[o + x]) bg[o + x] = v;
      }
    }
  }
  return { skew, profile, pad: 0 };
}

export function normalisePlanes(
  planes: [Float32Array, Float32Array, Float32Array],
  w: number,
  h: number,
  r: number,
  rows = false,
): NormPlanes {
  const bgs = planes.map((p) => background(p, w, h, r));
  const rowInfo = rows ? rowBackgrounds(planes, bgs, w, h, r) : undefined;
  const n: Float32Array[] = [];
  for (let c = 0; c < 3; c++) {
    const p = planes[c];
    const bg = bgs[c];
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
  return { width: w, height: h, n: n as NormPlanes['n'], ink, radius: r, rows: rowInfo };
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

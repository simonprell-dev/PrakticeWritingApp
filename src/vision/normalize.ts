// Glyph normalisation: CNN input (EMNIST style), template mask and a higher resolution quality mask.
import { gaussianBlur, maxFilter, minFilter } from './filters.ts';
import { resizeArea, sampleBilinear } from './image.ts';
import type { Box, Mask } from './types.ts';

export const CNN_SIZE = 28;
export const CNN_FIT = 24;
export const TPL_SIZE = 64;
export const TPL_FIT = 56;
export const Q_SIZE = 112;
export const Q_FIT = 96;
/** median EMNIST stroke width at 28x28 measured with the same 2A/P estimator (tools/train/inspect_data.py) */
export const EMNIST_STROKE = 2.3;

export interface GlyphCrop {
  /** soft ink restricted to the glyph (0..1) */
  soft: Float32Array;
  /** binary membership */
  bin: Uint8Array;
  w: number;
  h: number;
}

/** Cuts the glyph out of the patch: only pixels of the given component labels (soft edges kept). */
export function cutGlyph(ink: Float32Array, labels: Int32Array, pw: number, box: Box, which: Set<number>): GlyphCrop {
  const pad = 2;
  const x0 = Math.max(0, box.x - pad);
  const y0 = Math.max(0, box.y - pad);
  const x1 = Math.min(pw - 1, box.x + box.w - 1 + pad);
  const ph = labels.length / pw;
  const y1 = Math.min(ph - 1, box.y + box.h - 1 + pad);
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const bin = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (which.has(labels[(y0 + y) * pw + x0 + x])) bin[y * w + x] = 1;
    }
  }
  // 1px dilated membership for soft edges
  const soft = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let near = 0;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx >= 0 && xx < w && bin[yy * w + xx]) {
            near = 1;
            break;
          }
        }
      }
      if (near) soft[y * w + x] = ink[(y0 + y) * pw + x0 + x];
    }
  }
  return { soft, bin, w, h };
}

function inkBox(bin: Uint8Array, w: number, h: number): Box {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!bin[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function subImage(src: Float32Array, w: number, b: Box): Float32Array {
  const out = new Float32Array(b.w * b.h);
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) out[y * b.w + x] = src[(b.y + y) * w + b.x + x];
  }
  return out;
}

/** Resamples (area when shrinking, bilinear when enlarging). */
export function resample(src: Float32Array, w: number, h: number, nw: number, nh: number): Float32Array {
  if (nw <= w && nh <= h) return resizeArea(src, w, h, nw, nh);
  const out = new Float32Array(nw * nh);
  const sx = w / nw;
  const sy = h / nh;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) out[y * nw + x] = sampleBilinear(src, w, h, (x + 0.5) * sx - 0.5, (y + 0.5) * sy - 0.5);
  }
  return out;
}

/** Fits the ink box (longest side = fit) centred into a size x size frame. */
export function fitInto(src: Float32Array, w: number, _h: number, box: Box, size: number, fit: number): Float32Array {
  const sub = subImage(src, w, box);
  const scale = fit / Math.max(box.w, box.h);
  const nw = Math.max(1, Math.round(box.w * scale));
  const nh = Math.max(1, Math.round(box.h * scale));
  const r = resample(sub, box.w, box.h, nw, nh);
  const out = new Float32Array(size * size);
  const ox = (size - nw) >> 1;
  const oy = (size - nh) >> 1;
  for (let y = 0; y < nh; y++) out.set(r.subarray(y * nw, y * nw + nw), (oy + y) * size + ox);
  return out;
}

function normMax(a: Float32Array): Float32Array {
  let m = 0;
  for (let i = 0; i < a.length; i++) if (a[i] > m) m = a[i];
  if (m > 0) for (let i = 0; i < a.length; i++) a[i] /= m;
  return a;
}

/** 2A/P stroke width of a float image thresholded at 0.5. */
export function softStrokeWidth(a: Float32Array, w: number, h: number): number {
  let area = 0;
  let edges = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (a[i] < 0.5) continue;
      area++;
      if (x === 0 || a[i - 1] < 0.5) edges++;
      if (x === w - 1 || a[i + 1] < 0.5) edges++;
      if (y === 0 || a[i - w] < 0.5) edges++;
      if (y === h - 1 || a[i + w] < 0.5) edges++;
    }
  }
  return edges ? (2 * area) / edges : 0;
}

/** EMNIST-style 28x28 CNN input (ink = 1). */
export function toCnnInput(crop: GlyphCrop): Float32Array {
  const box = inkBox(crop.bin, crop.w, crop.h);
  let a = normMax(fitInto(crop.soft, crop.w, crop.h, box, CNN_SIZE, CNN_FIT));
  // bring the stroke width close to EMNIST (soft morphology, same as the training augmentation)
  for (let k = 0; k < 3; k++) {
    const sw = softStrokeWidth(a, CNN_SIZE, CNN_SIZE);
    if (sw >= 1.7) break;
    const d = maxFilter(a, CNN_SIZE, CNN_SIZE, 1);
    for (let i = 0; i < a.length; i++) a[i] = 0.5 * a[i] + 0.5 * d[i];
    a = normMax(a);
  }
  for (let k = 0; k < 2; k++) {
    const sw = softStrokeWidth(a, CNN_SIZE, CNN_SIZE);
    if (sw <= 3.3) break;
    const e = minFilter(a, CNN_SIZE, CNN_SIZE, 1);
    for (let i = 0; i < a.length; i++) a[i] = 0.5 * a[i] + 0.5 * e[i];
    a = normMax(a);
  }
  return normMax(gaussianBlur(a, CNN_SIZE, CNN_SIZE, 0.6));
}

function binarize(a: Float32Array, size: number, thr: number): Mask {
  const out: Mask = { width: size, height: size, data: new Uint8Array(size * size) };
  for (let i = 0; i < a.length; i++) out.data[i] = a[i] >= thr ? 1 : 0;
  return out;
}

/** Binary 64x64 mask with the longest side fitted to 56 px (template space). */
export function toTemplateMask(crop: GlyphCrop): Mask {
  const box = inkBox(crop.bin, crop.w, crop.h);
  const bin = Float32Array.from(crop.bin);
  return binarize(fitInto(bin, crop.w, crop.h, box, TPL_SIZE, TPL_FIT), TPL_SIZE, 0.5);
}

/** Smooth 112x112 mask (fit 96) for stroke quality features. */
export function toQualityMask(crop: GlyphCrop): Mask {
  const box = inkBox(crop.bin, crop.w, crop.h);
  const bin = Float32Array.from(crop.bin);
  let a = fitInto(bin, crop.w, crop.h, box, Q_SIZE, Q_FIT);
  a = gaussianBlur(a, Q_SIZE, Q_SIZE, 1.2);
  return binarize(a, Q_SIZE, 0.5);
}

/** Aspect ratio w/h of the ink box. */
export function aspect(crop: GlyphCrop): number {
  const b = inkBox(crop.bin, crop.w, crop.h);
  return b.w / b.h;
}

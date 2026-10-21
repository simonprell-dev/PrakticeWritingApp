import type { Mask } from './types.ts';
import { label } from './components.ts';
import { mask as newMask } from './image.ts';

/** Otsu threshold for values in [lo, hi]. Optionally only considers values >= minValue. */
export function otsu(values: Float32Array, lo = 0, hi = 1, bins = 256, minValue = -Infinity): number {
  const hist = new Float64Array(bins);
  let n = 0;
  const scale = (bins - 1) / (hi - lo);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < minValue) continue;
    let b = Math.round((v - lo) * scale);
    if (b < 0) b = 0;
    else if (b >= bins) b = bins - 1;
    hist[b]++;
    n++;
  }
  if (n === 0) return (lo + hi) / 2;
  let sumAll = 0;
  for (let b = 0; b < bins; b++) sumAll += b * hist[b];
  let wB = 0;
  let sumB = 0;
  let best = 0;
  let bestB = 0;
  for (let b = 0; b < bins; b++) {
    wB += hist[b];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += b * hist[b];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestB = b;
    }
  }
  return lo + (bestB + 0.5) / scale;
}

/**
 * Hysteresis threshold: pixels >= weak form components, a component survives when it contains
 * at least minStrong pixels >= strong.
 */
export function hysteresis(
  values: Float32Array,
  w: number,
  h: number,
  weak: number,
  strong: number,
  minStrong = 3,
): Mask {
  const weakMask = newMask(w, h);
  for (let i = 0; i < values.length; i++) weakMask.data[i] = values[i] >= weak ? 1 : 0;
  const { labels, comps } = label(weakMask, true);
  const strongCount = new Int32Array(comps.length + 1);
  for (let i = 0; i < values.length; i++) {
    if (labels[i] && values[i] >= strong) strongCount[labels[i]]++;
  }
  const out = newMask(w, h);
  for (let i = 0; i < values.length; i++) {
    const l = labels[i];
    if (l && strongCount[l] >= minStrong) out.data[i] = 1;
  }
  return out;
}

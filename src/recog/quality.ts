// Stroke quality features on the 112x112 quality mask: trajectory jitter and stroke width variation.
import { chamfer } from '../vision/distance.ts';
import { strokeWidth } from '../vision/morphology.ts';
import { pruneSpurs, skeletonGraph, zhangSuen } from '../vision/thinning.ts';
import type { Mask } from '../vision/types.ts';

export interface QualityFeatures {
  /** mean deviation of skeleton paths from their smoothed course (px at fit 96) */
  jitter: number;
  /** coefficient of variation of the stroke width along the skeleton */
  widthCV: number;
  strokeWidth: number;
}

export function qualityFeatures(q: Mask): QualityFeatures {
  const sw = strokeWidth(q);
  const sk = pruneSpurs(zhangSuen(q), Math.max(4, Math.round(sw)));
  const g = skeletonGraph(sk);
  let dev = 0;
  let cnt = 0;
  const win = 4; // half window of the moving average
  for (const p of g.paths) {
    const n = p.length / 2;
    if (n < 14) continue;
    for (let i = win; i < n - win; i++) {
      let sx = 0;
      let sy = 0;
      for (let k = -win; k <= win; k++) {
        sx += p[2 * (i + k)];
        sy += p[2 * (i + k) + 1];
      }
      sx /= 2 * win + 1;
      sy /= 2 * win + 1;
      dev += Math.hypot(p[2 * i] - sx, p[2 * i + 1] - sy);
      cnt++;
    }
  }
  const jitter = cnt ? dev / cnt : 0;
  // width along the skeleton, away from junctions and ends
  const inside = chamfer(q, true);
  const vals: number[] = [];
  const w = q.width;
  for (let i = 0; i < sk.data.length; i++) {
    if (!sk.data[i]) continue;
    let nb = 0;
    for (const o of [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]) nb += sk.data[i + o] ?? 0;
    if (nb !== 2) continue;
    vals.push(inside[i]);
  }
  let widthCV = 0;
  if (vals.length > 10) {
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    const v = vals.reduce((a, b) => a + (b - m) * (b - m), 0) / vals.length;
    widthCV = m > 0 ? Math.sqrt(v) / m : 0;
  }
  return { jitter, widthCV, strokeWidth: sw };
}

import type { Mask } from './types.ts';

/**
 * Chamfer 3-4 distance transform: distance (in pixels) of every pixel to the nearest pixel where
 * `features` is 1. With `inside` = true it instead returns the distance of foreground pixels to the
 * nearest background pixel (used for stroke width).
 */
export function chamfer(m: Mask, inside = false): Float32Array {
  const { width: w, height: h, data } = m;
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) {
    const isSeed = inside ? data[i] === 0 : data[i] === 1;
    d[i] = isSeed ? 0 : INF;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x > 0) v = Math.min(v, d[i - 1] + 3);
      if (y > 0) {
        v = Math.min(v, d[i - w] + 3);
        if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i];
      if (v === 0) continue;
      if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + 3);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
        if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
      }
      d[i] = v;
    }
  }
  for (let i = 0; i < d.length; i++) d[i] = d[i] >= INF ? 1e6 : d[i] / 3;
  return d;
}

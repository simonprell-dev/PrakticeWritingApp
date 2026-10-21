// Ruled line (Lineatur, Karo) detection and removal, staff-line style:
// pixels on a detected line are removed only where the vertical ink run is not longer than the line.
import type { Mask, RuledLine } from './types.ts';

export interface LineResult {
  lines: RuledLine[];
  /** skew of horizontal lines (radians) */
  skew: number;
  /** cleaned mask */
  mask: Mask;
}

function projectionPeaks(hist: Float64Array, minCount: number): { pos: number; thickness: number }[] {
  const out: { pos: number; thickness: number }[] = [];
  let i = 0;
  while (i < hist.length) {
    if (hist[i] < minCount) {
      i++;
      continue;
    }
    let j = i;
    let acc = 0;
    let wsum = 0;
    while (j < hist.length && hist[j] >= minCount * 0.5) {
      acc += j * hist[j];
      wsum += hist[j];
      j++;
    }
    out.push({ pos: acc / wsum, thickness: j - i });
    i = j;
  }
  return out;
}

function estimateSkew(m: Mask, maxDeg = 6, stepDeg = 0.5): number {
  const { width: w, height: h, data } = m;
  const xs: number[] = [];
  const ys: number[] = [];
  let count = 0;
  for (let i = 0; i < data.length; i++) if (data[i]) count++;
  const stride = Math.max(1, Math.floor(count / 20000));
  let k = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[y * w + x]) continue;
      if (k++ % stride) continue;
      xs.push(x);
      ys.push(y);
    }
  }
  let best = 0;
  let bestScore = -1;
  const pad = Math.ceil(w * Math.tan((maxDeg * Math.PI) / 180)) + 2;
  const hist = new Float64Array(h + 2 * pad);
  for (let d = -maxDeg; d <= maxDeg + 1e-9; d += stepDeg) {
    const t = Math.tan((d * Math.PI) / 180);
    hist.fill(0);
    for (let i = 0; i < xs.length; i++) {
      const yy = Math.round(ys[i] - xs[i] * t) + pad;
      if (yy >= 0 && yy < hist.length) hist[yy]++;
    }
    let score = 0;
    for (let i = 0; i < hist.length; i++) score += hist[i] * hist[i];
    if (score > bestScore) {
      bestScore = score;
      best = (d * Math.PI) / 180;
    }
  }
  return best;
}

/**
 * Detects long horizontal and vertical lines in `detect` (a permissive ink mask) and removes them
 * from `target`. `mode` 'auto' requires at least two parallel lines.
 */
export function removeRuledLines(detect: Mask, target: Mask, mode: 'auto' | 'on' | 'off'): LineResult {
  const out: Mask = { width: target.width, height: target.height, data: new Uint8Array(target.data) };
  if (mode === 'off') return { lines: [], skew: 0, mask: out };
  const { width: w, height: h } = detect;
  const skew = estimateSkew(detect);
  const t = Math.tan(skew);
  const pad = Math.ceil(Math.abs(t) * w) + 2;
  const histH = new Float64Array(h + 2 * pad);
  const histV = new Float64Array(w + 2 * pad);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!detect.data[y * w + x]) continue;
      histH[Math.round(y - x * t) + pad]++;
      histV[Math.round(x + y * t) + pad]++;
    }
  }
  const minRun = mode === 'on' ? 0.3 : 0.45;
  const hPeaks = projectionPeaks(histH, w * minRun).filter((p) => p.thickness <= Math.max(4, h * 0.012));
  const vPeaks = projectionPeaks(histV, h * minRun).filter((p) => p.thickness <= Math.max(4, w * 0.012));
  const need = mode === 'on' ? 1 : 2;
  const lines: RuledLine[] = [];
  if (hPeaks.length >= need) {
    for (const p of hPeaks) lines.push({ pos: p.pos - pad, thickness: p.thickness, orientation: 'h' });
  }
  if (vPeaks.length >= need) {
    for (const p of vPeaks) lines.push({ pos: p.pos - pad, thickness: p.thickness, orientation: 'v' });
  }
  const d = out.data;
  for (const line of lines) {
    const half = line.thickness / 2 + 1.5;
    // a pen stroke lying on the line is thicker than the printed line, so it survives
    const maxRun = line.thickness + 1;
    if (line.orientation === 'h') {
      for (let x = 0; x < w; x++) {
        const yc = line.pos + x * t;
        const y0 = Math.max(0, Math.floor(yc - half));
        const y1 = Math.min(h - 1, Math.ceil(yc + half));
        let y = y0;
        while (y <= y1) {
          if (!d[y * w + x]) {
            y++;
            continue;
          }
          let a = y;
          while (a > 0 && d[(a - 1) * w + x]) a--;
          let b = y;
          while (b < h - 1 && d[(b + 1) * w + x]) b++;
          if (b - a + 1 <= maxRun) for (let k = a; k <= b; k++) d[k * w + x] = 0;
          y = b + 1;
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        const xc = line.pos - y * t;
        const x0 = Math.max(0, Math.floor(xc - half));
        const x1 = Math.min(w - 1, Math.ceil(xc + half));
        let x = x0;
        while (x <= x1) {
          if (!d[y * w + x]) {
            x++;
            continue;
          }
          let a = x;
          while (a > 0 && d[y * w + a - 1]) a--;
          let b = x;
          while (b < w - 1 && d[y * w + b + 1]) b++;
          if (b - a + 1 <= maxRun) for (let k = a; k <= b; k++) d[y * w + k] = 0;
          x = b + 1;
        }
      }
    }
  }
  return { lines, skew, mask: out };
}

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

/** Skew of the strongest horizontal structure (lines, text rows) in a mask, by projection profiles. */
export function estimateSkew(m: Mask, maxDeg = 6, stepDeg = 0.5): number {
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

/** which line system the paper has; 'auto' tells it from the lines themselves */
export type LineatureMode = 'auto' | 'school4' | 'school2' | 'plain' | 'none';

/**
 * German school lines (DIN 16552-1): Lineatur 1 and 2 have four lines per row (three equal bands of
 * 5 or 4 mm, the middle band often coloured), Lineatur 3 only the two lines of the middle band.
 * Plain ruled paper has single lines.
 */
export interface LineModel {
  kind: 'none' | 'plain' | 'school';
  /** school: height of one band (px); plain: line spacing (px) */
  unit: number;
  /** all line positions (sheared detection rows: y - shearShift(x)) */
  lines: number[];
  /** base lines (Grundlinien) when they are known */
  bases: number[];
  skew: number;
}

const percentile = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0;
};

/**
 * Lines and bands from the row profile of the background (see ink.ts), then the line system:
 * coloured bands give the middle band directly; otherwise four-line groups (Lineatur 1/2), pairs
 * (Lineatur 3) or evenly spaced lines. Evenly spaced lines are school lines when the letters span
 * more than one gap (\`bodyHeights\` of the glyphs), else plain ruled paper.
 */
export function lineModel(profile: Float32Array, pad: number, skew: number, mode: LineatureMode, bodyHeights: number[]): LineModel {
  const none: LineModel = { kind: 'none', unit: 0, lines: [], bases: [], skew };
  if (mode === 'none') return none;
  const thr = Math.max(0.035, percentile([...profile], 0.5) * 3);
  const runs: { a: number; b: number }[] = [];
  for (let i = 0; i < profile.length; ) {
    if (profile[i] < thr) {
      i++;
      continue;
    }
    let j = i;
    while (j < profile.length && profile[j] >= thr) j++;
    runs.push({ a: i - pad, b: j - pad });
    i = j;
  }
  const bandMin = 7;
  const bands = runs.filter((r) => r.b - r.a >= bandMin);
  const lines = runs.map((r) => (r.b - r.a >= bandMin ? [r.a, r.b] : [(r.a + r.b - 1) / 2])).flat();
  lines.sort((x, y) => x - y);
  if (bands.length && mode !== 'plain') {
    const unit = percentile(
      bands.map((b) => b.b - b.a),
      0.5,
    );
    return { kind: 'school', unit, lines, bases: bands.map((b) => b.b), skew };
  }
  if (lines.length < 2) return none;
  const diffs = lines.slice(1).map((v, i) => v - lines[i]);
  const s = percentile(diffs, 0.25);
  if (s < 4) return none;
  if (mode === 'plain') return { kind: 'plain', unit: percentile(diffs, 0.5), lines, bases: [], skew };
  // groups of lines that belong to one writing row
  const groups: number[][] = [[lines[0]]];
  diffs.forEach((d, i) => {
    // Lineatur 2: 4 mm bands, 5 mm to the next row
    if (d > 1.15 * s) groups.push([]);
    groups[groups.length - 1].push(lines[i + 1]);
  });
  const grouped = groups.length > 1 && groups.some((g) => g.length > 1);
  const school = mode === 'school4' || mode === 'school2' || grouped || percentile(bodyHeights, 0.5) > 1.3 * s;
  if (!school) return { kind: 'plain', unit: s, lines, bases: [], skew };
  const per = mode === 'school2' ? 2 : mode === 'school4' ? 4 : 0;
  const bases: number[] = [];
  if (grouped || per) {
    for (const g of groups) {
      if ((per === 4 || !per) && g.length === 4) bases.push(g[2]);
      else if ((per === 2 || !per) && g.length === 2) bases.push(g[1]);
    }
  }
  return { kind: 'school', unit: s, lines, bases, skew };
}

// Tells how well a printed dot lattice can be read in a camera picture: finds round dark dots, grows a square
// lattice from dot to dot (so a slightly slanted sheet does not matter) and counts how many places hold a dot.
import { boxBlur } from './filters.ts';
import type { RGBAImage } from './types.ts';

export interface DotProbe {
  /** spacing of the lattice in px, 0 when none was found */
  pitchPx: number;
  /** share of the lattice places where a dot was found */
  hitRate: number;
  /** share of the dots found that are not on the lattice */
  falseRate: number;
  /** mean depth of the dots against the paper, 0..1 */
  contrast: number;
  readable: boolean;
}

export const MIN_HIT = 0.9;
export const MAX_FALSE = 0.1;
/** fainter dots do not count, however clean the picture is */
export const MIN_CONTRAST = 0.03;
/** fewer dots are no lattice */
const MIN_DOTS = 12;
/** radius of the paper background, px */
const BG_R = 12;
/** a dot is this many noise units deep */
const DEPTH = 4;
/** the lowest noise unit, so a perfectly clean picture finds no specks */
const MIN_NOISE = 0.5;
/** a dot is at most this much longer than wide; lines are much longer */
const ROUND = 2.5;
/** a place of the lattice holds a dot this close to it, in spacings */
const TOLERANCE = 0.3;
/** lattices tried from different starting dots */
const SEEDS = 24;

interface Dot {
  x: number;
  y: number;
  /** pixel index of its darkest place */
  deepest: number;
}

const NONE: DotProbe = { pitchPx: 0, hitRate: 0, falseRate: 0, contrast: 0, readable: false };

function median(a: number[]): number {
  const s = [...a].sort((p, q) => p - q);
  return s[s.length >> 1] ?? 0;
}

/** the round dark spots of the picture */
function findDots(img: RGBAImage): { dots: Dot[]; paper: Float32Array; grey: Float32Array } {
  const { width: w, height: h, data } = img;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  const paper = boxBlur(grey, w, h, BG_R);
  const soft = boxBlur(grey, w, h, 1);
  // depth below the paper
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = paper[i] - soft[i];
  const sample: number[] = [];
  for (let i = 0; i < d.length; i += 97) sample.push(Math.abs(d[i]));
  const noise = Math.max(MIN_NOISE, 1.4826 * median(sample));
  // connected spots deep enough; a big dot stays one spot, a line stays a long thin one
  const seen = new Uint8Array(w * h);
  const floor = DEPTH * noise;
  const dots: Dot[] = [];
  const stack: number[] = [];
  for (let start = 0; start < w * h; start++) {
    if (seen[start] || d[start] < floor) continue;
    seen[start] = 1;
    stack.push(start);
    let area = 0;
    let sx = 0;
    let sy = 0;
    let x0 = w;
    let x1 = 0;
    let y0 = h;
    let y1 = 0;
    let deepest = start;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      area++;
      sx += x;
      sy += y;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      if (d[i] > d[deepest]) deepest = i;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (n >= 0 && !seen[n] && d[n] >= floor) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    const long = Math.hypot(x1 - x0 + 1, y1 - y0 + 1);
    if (long <= ROUND * (area / long) + 2) dots.push({ x: sx / area, y: sy / area, deepest });
  }
  return { dots, paper, grey };
}

/** spacing and direction of a square lattice: the most common direction between neighbours, folded to 90° */
function latticeOf(dots: Dot[]): { pitch: number; angle: number } | null {
  const nearest: number[] = [];
  for (const a of dots) {
    let best = Infinity;
    for (const b of dots) if (a !== b) best = Math.min(best, Math.hypot(a.x - b.x, a.y - b.y));
    nearest.push(best);
  }
  const pitch = median(nearest);
  if (!Number.isFinite(pitch) || pitch <= 0) return null;
  // mean direction on the circle, four times the angle so that the four lattice directions fall together
  let sx = 0;
  let sy = 0;
  const lengths: number[] = [];
  for (const a of dots)
    for (const b of dots) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy);
      if (a === b || l < 0.75 * pitch || l > 1.25 * pitch) continue;
      const t = 4 * Math.atan2(dy, dx);
      sx += Math.cos(t);
      sy += Math.sin(t);
      lengths.push(l);
    }
  if (!lengths.length) return null;
  return { pitch: median(lengths), angle: Math.atan2(sy, sx) / 4 };
}

/** the dots reached from `seed` step by step; each carries its place (i, j) in the lattice */
function grow(dots: Dot[], seed: number, pitch: number, angle: number): Map<Dot, [number, number]> {
  const grid = new Map<string, Dot[]>();
  const key = (x: number, y: number) => `${Math.floor(x / pitch)},${Math.floor(y / pitch)}`;
  for (const d of dots) {
    const k = key(d.x, d.y);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(d);
  }
  const near = (x: number, y: number): Dot | null => {
    let best: Dot | null = null;
    let bestD = TOLERANCE * pitch;
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++)
        for (const d of grid.get(key(x + i * pitch, y + j * pitch)) ?? []) {
          const l = Math.hypot(d.x - x, d.y - y);
          if (l < bestD) {
            bestD = l;
            best = d;
          }
        }
    return best;
  };
  const ux = Math.cos(angle) * pitch;
  const uy = Math.sin(angle) * pitch;
  const placed = new Map<Dot, [number, number]>([[dots[seed], [0, 0]]]);
  const taken = new Set(['0,0']);
  const queue = [dots[seed]];
  while (queue.length) {
    const a = queue.pop()!;
    const [i, j] = placed.get(a)!;
    for (const [di, dj, dx, dy] of [[1, 0, ux, uy], [-1, 0, -ux, -uy], [0, 1, -uy, ux], [0, -1, uy, -ux]]) {
      const b = near(a.x + dx, a.y + dy);
      const place = `${i + di},${j + dj}`;
      if (!b || placed.has(b) || taken.has(place)) continue;
      placed.set(b, [i + di, j + dj]);
      taken.add(place);
      queue.push(b);
    }
  }
  return placed;
}

/** v = a + b·i + c·j, fitted to the dots (least squares); null when the dots lie on one line */
function fit(pts: [number, number, number][]): [number, number, number] | null {
  const n = pts.length;
  const mi = pts.reduce((s, p) => s + p[0], 0) / n;
  const mj = pts.reduce((s, p) => s + p[1], 0) / n;
  const mv = pts.reduce((s, p) => s + p[2], 0) / n;
  let ii = 0;
  let jj = 0;
  let ij = 0;
  let iv = 0;
  let jv = 0;
  for (const [i, j, v] of pts) {
    ii += (i - mi) ** 2;
    jj += (j - mj) ** 2;
    ij += (i - mi) * (j - mj);
    iv += (i - mi) * (v - mv);
    jv += (j - mj) * (v - mv);
  }
  const det = ii * jj - ij * ij;
  if (Math.abs(det) < 1e-6) return null;
  const b = (iv * jj - jv * ij) / det;
  const c = (jv * ii - iv * ij) / det;
  return [mv - b * mi - c * mj, b, c];
}

export function probeDots(img: RGBAImage): DotProbe {
  const { width: w, height: h } = img;
  if (w < 8 || h < 8) return NONE;
  const { dots, paper, grey } = findDots(img);
  if (dots.length < MIN_DOTS) return NONE;
  const lat = latticeOf(dots);
  if (!lat) return NONE;
  let placed = new Map<Dot, [number, number]>();
  // start near the middle, where a slanted sheet has moved the lattice least
  const order = dots.map((d, i) => [Math.hypot(d.x - w / 2, d.y - h / 2), i]).sort((a, b) => a[0] - b[0]);
  for (const [, i] of order.slice(0, SEEDS)) {
    const p = grow(dots, i, lat.pitch, lat.angle);
    if (p.size > placed.size) placed = p;
  }
  if (placed.size < MIN_DOTS) return NONE;
  const found = [...placed.entries()];
  const fx = fit(found.map(([d, [i, j]]) => [i, j, d.x]));
  const fy = fit(found.map(([d, [i, j]]) => [i, j, d.y]));
  if (!fx || !fy) return NONE;
  const is = found.map(([, p]) => p[0]);
  const js = found.map(([, p]) => p[1]);
  // the places of the lattice inside the picture (dots at the very edge cannot be found)
  const pad = 3;
  const within = (x: number, y: number) => x >= pad && y >= pad && x < w - pad && y < h - pad;
  let places = 0;
  for (let i = Math.min(...is); i <= Math.max(...is); i++)
    for (let j = Math.min(...js); j <= Math.max(...js); j++) if (within(fx[0] + fx[1] * i + fx[2] * j, fy[0] + fy[1] * i + fy[2] * j)) places++;
  const inside = found.filter(([d]) => within(d.x, d.y)).length;
  const hitRate = places ? Math.min(1, inside / places) : 0;
  const falseRate = (dots.length - placed.size) / dots.length;
  const contrast = found.reduce((s, [d]) => s + (paper[d.deepest] - grey[d.deepest]) / Math.max(1, paper[d.deepest]), 0) / found.length;
  const pitchPx = (Math.hypot(fx[1], fy[1]) + Math.hypot(fx[2], fy[2])) / 2;
  return { pitchPx, hitRate, falseRate, contrast, readable: hitRate >= MIN_HIT && falseRate <= MAX_FALSE && contrast >= MIN_CONTRAST };
}

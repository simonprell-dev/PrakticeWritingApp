// Tells how well a printed dot lattice can be read in a camera picture. The caller knows the spacing the print
// should have at this distance. Printed lines are taken out first, then the round dark spots are looked for, a
// square lattice is grown from dot to dot (so a slightly slanted sheet does not matter), and the dots found are
// counted against all the places the picture must hold, so a patch of dots or a lost half does not pass.
import { boxBlur } from './filters.ts';
import type { RGBAImage } from './types.ts';

export interface DotProbe {
  /** spacing of the lattice in px, 0 when none was found */
  pitchPx: number;
  /** share of the lattice places in the picture where a dot was found */
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
/** the spacing found may be off the expected one by this share (the sheet is held by hand) */
const PITCH_SLACK = 0.25;
/** fewer dots are no lattice */
const MIN_DOTS = 12;
/** a dot is this many noise units deep */
const DEPTH = 4;
/** the lowest noise unit, so a perfectly clean picture finds no specks */
const MIN_NOISE = 0.5;
/** a dot is at most this much longer than wide */
const MAX_STRETCH = 3;
/** a place of the lattice holds a dot this close to it, in spacings */
const TOLERANCE = 0.3;
/** lattices tried from different starting dots */
const SEEDS = 24;
/** more spots than this many times the places: this is no lattice of dots */
const TOO_MANY = 3;
/** dots at the very edge of the picture cannot be found, px */
const EDGE = 3;

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

/** noise of the picture from the fine grain alone, so printed marks and lines do not count as noise */
function noiseOf(grey: Float32Array, soft: Float32Array): number {
  const sample: number[] = [];
  for (let i = 0; i < grey.length; i += 97) sample.push(Math.abs(grey[i] - soft[i]));
  // the softened picture holds about half the noise of a single pixel, a camera's grain being a little coarse
  return Math.max(MIN_NOISE, 0.5 * 1.4826 * median(sample));
}

/** marks the runs of at least `len` set pixels along rows and columns: a line slanted a little still has them */
function linesOf(ink: Uint8Array, w: number, h: number, len: number): Uint8Array {
  const line = new Uint8Array(w * h);
  const mark = (start: number, step: number, n: number) => {
    let run = 0;
    for (let k = 0; k <= n; k++) {
      if (k < n && ink[start + k * step]) {
        run++;
        continue;
      }
      if (run >= len) for (let r = k - run; r < k; r++) line[start + r * step] = 1;
      run = 0;
    }
  };
  for (let y = 0; y < h; y++) mark(y * w, 1, w);
  for (let x = 0; x < w; x++) mark(x, w, h);
  // the soft edge of a line beside it
  const wide = line.slice();
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (line[i]) wide[i - 1] = wide[i + 1] = wide[i - w] = wide[i + w] = 1;
    }
  return wide;
}

/** the round dark spots of the picture */
function findDots(img: RGBAImage, pitch: number): { dots: Dot[]; paper: Float32Array; grey: Float32Array } {
  const { width: w, height: h, data } = img;
  const grey = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  // wider than a printed mark, or the paper would follow the mark
  const paper = boxBlur(grey, w, h, Math.max(12, Math.ceil(pitch)));
  const soft = boxBlur(grey, w, h, 1);
  const d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = paper[i] - soft[i];
  const floor = DEPTH * noiseOf(grey, soft);
  const ink = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) ink[i] = d[i] >= floor / 2 ? 1 : 0;
  const line = linesOf(ink, w, h, Math.max(8, Math.ceil(pitch)));
  // connected spots deep enough; a big dot stays one spot
  const seen = new Uint8Array(w * h);
  const dots: Dot[] = [];
  const stack: number[] = [];
  const open = (i: number) => !seen[i] && !line[i] && d[i] >= floor;
  for (let start = 0; start < w * h; start++) {
    if (!open(start)) continue;
    seen[start] = 1;
    stack.push(start);
    let area = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let syy = 0;
    let sxy = 0;
    let deepest = start;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w;
      const y = (i - x) / w;
      area++;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      sxy += x * y;
      if (d[i] > d[deepest]) deepest = i;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1])
        if (n >= 0 && open(n)) {
          seen[n] = 1;
          stack.push(n);
        }
    }
    // how stretched the spot is, from its second moments; a pixel has a width of its own
    const mx = sx / area;
    const my = sy / area;
    const vx = sxx / area - mx * mx + 1 / 12;
    const vy = syy / area - my * my + 1 / 12;
    const vxy = sxy / area - mx * my;
    const root = Math.sqrt(((vx - vy) / 2) ** 2 + vxy ** 2);
    const stretch = Math.sqrt(((vx + vy) / 2 + root) / Math.max(1e-6, (vx + vy) / 2 - root));
    if (stretch <= MAX_STRETCH) dots.push({ x: mx, y: my, deepest });
  }
  return { dots, paper, grey };
}

/** spacing and direction of the square lattice, from dots about the expected spacing apart */
function latticeOf(dots: Dot[], expected: number): { pitch: number; angle: number } | null {
  // four times the angle, so that the four directions of the lattice fall together
  let sx = 0;
  let sy = 0;
  const lengths: number[] = [];
  for (const a of dots)
    for (const b of dots) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy);
      if (a === b || l < (1 - PITCH_SLACK) * expected || l > (1 + PITCH_SLACK) * expected) continue;
      const t = 4 * Math.atan2(dy, dx);
      sx += Math.cos(t);
      sy += Math.sin(t);
      lengths.push(l);
    }
  if (!lengths.length) return null;
  return { pitch: median(lengths), angle: Math.atan2(sy, sx) / 4 };
}

/** the dots reached from `seed` step by step, over one missing place at most; each carries its place (i, j) */
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
    for (const [di, dj, dx, dy] of [[1, 0, ux, uy], [-1, 0, -ux, -uy], [0, 1, -uy, ux], [0, -1, uy, -ux]])
      for (const k of [1, 2]) {
        const b = near(a.x + k * dx, a.y + k * dy);
        if (!b) continue;
        const place = `${i + k * di},${j + k * dj}`;
        if (!placed.has(b) && !taken.has(place)) {
          placed.set(b, [i + k * di, j + k * dj]);
          taken.add(place);
          queue.push(b);
        }
        break;
      }
  }
  return placed;
}

export function probeDots(img: RGBAImage, expect: { pitchPx: number }): DotProbe {
  const { width: w, height: h } = img;
  const expected = expect.pitchPx;
  if (w < 8 || h < 8 || expected <= 0) return NONE;
  const { dots, paper, grey } = findDots(img, expected);
  if (dots.length < MIN_DOTS || dots.length > (TOO_MANY * w * h) / (expected * expected)) return NONE;
  const lat = latticeOf(dots, expected);
  if (!lat) return NONE;
  let placed = new Map<Dot, [number, number]>();
  // start near the middle, where a slanted sheet has moved the lattice least
  const order = dots.map((d, i) => [Math.hypot(d.x - w / 2, d.y - h / 2), i]).sort((a, b) => a[0] - b[0]);
  for (const [, i] of order.slice(0, SEEDS)) {
    const p = grow(dots, i, lat.pitch, lat.angle);
    if (p.size > placed.size) placed = p;
  }
  if (placed.size < MIN_DOTS) return NONE;
  const found = [...placed.keys()];
  // all the places the picture holds, whatever was found
  const places = Math.floor((w - 2 * EDGE) / lat.pitch) * Math.floor((h - 2 * EDGE) / lat.pitch);
  const inside = found.filter((d) => d.x >= EDGE && d.y >= EDGE && d.x < w - EDGE && d.y < h - EDGE).length;
  const hitRate = places > 0 ? Math.min(1, inside / places) : 0;
  const falseRate = (dots.length - placed.size) / dots.length;
  const contrast = found.reduce((s, d) => s + (paper[d.deepest] - grey[d.deepest]) / Math.max(1, paper[d.deepest]), 0) / found.length;
  return { pitchPx: lat.pitch, hitRate, falseRate, contrast, readable: hitRate >= MIN_HIT && falseRate <= MAX_FALSE && contrast >= MIN_CONTRAST };
}

// Synthetic "handwriting" pages: template skeletons drawn with a round pen, distorted and noisy.
import type { TemplateBank } from '../../src/recog/templates.ts';
import type { RGBAImage } from '../../src/vision/types.ts';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GlyphSpec {
  char: string;
  x: number;
  y: number;
  /** glyph height in px (longest side of the 56 px template box is mapped to this) */
  size: number;
  /** pen width px */
  pen?: number;
  /** wobble amplitude in template px */
  jitter?: number;
  rotate?: number;
  shear?: number;
  style?: 'druck' | 'grund';
  /** pen colour RGB */
  color?: [number, number, number];
  /** draw only every n-th skeleton point region (gaps) */
  mirror?: boolean;
}

export interface PageSpec {
  width: number;
  height: number;
  paper?: [number, number, number];
  /** brightness gradient strength 0..1 (shadow from one side) */
  shadow?: number;
  noise?: number;
  /** ruled lines every n px */
  lines?: { spacing: number; offset: number; color: [number, number, number]; width: number };
  glyphs: GlyphSpec[];
  seed?: number;
  /** dark table border around the paper (px) */
  table?: number;
  /** paper slips on a dark table (everything else is table) */
  slips?: { x: number; y: number; w: number; h: number; color?: [number, number, number] }[];
  /** German school lines (DIN 16552-1): 1 and 2 = four lines per row, 3 = two lines (middle band only) */
  lineatur?: SchoolLines;
}

export interface SchoolLines {
  kind: 1 | 2 | 3;
  /** px per mm */
  mm: number;
  /** y of the first row's top line (for kind 3: its middle line) */
  top: number;
  /** distance from one row to the next (mm) */
  pitch: number;
  color: [number, number, number];
  width: number;
  /** coloured middle band (Kontrastlineatur) */
  band?: [number, number, number];
}

/** band height (mm) of a school line system */
export function bandMm(kind: 1 | 2 | 3): number {
  return kind === 1 ? 5 : kind === 2 ? 4 : 3.5;
}

/** y (px) of the lines of row r: [top, middle, base, bottom]; kind 3 has only middle and base */
export function rowLines(L: SchoolLines, r: number): { top: number; mid: number; base: number; bottom: number } {
  const b = bandMm(L.kind) * L.mm;
  const y0 = L.top + r * L.pitch * L.mm;
  return L.kind === 3 ? { top: y0 - b, mid: y0, base: y0 + b, bottom: y0 + 2 * b } : { top: y0, mid: y0 + b, base: y0 + 2 * b, bottom: y0 + 3 * b };
}

/** Ink coverage plane in 0..1 */
function stampDisk(cov: Float32Array, w: number, h: number, cx: number, cy: number, r: number) {
  const x0 = Math.max(0, Math.floor(cx - r - 1));
  const x1 = Math.min(w - 1, Math.ceil(cx + r + 1));
  const y0 = Math.max(0, Math.floor(cy - r - 1));
  const y1 = Math.min(h - 1, Math.ceil(cy + r + 1));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const v = Math.min(1, Math.max(0, r + 0.5 - d));
      const i = y * w + x;
      if (v > cov[i]) cov[i] = v;
    }
  }
}

export function drawGlyph(bank: TemplateBank, cov: Float32Array, w: number, h: number, g: GlyphSpec, rand: () => number) {
  const t = bank.forChar(g.char, g.style ?? 'druck')[0];
  if (!t) throw new Error('no template for ' + g.char);
  const pts = t.skel.pts;
  const s = g.size / 56;
  const rot = g.rotate ?? 0;
  const sh = g.shear ?? 0;
  const pen = (g.pen ?? 5) / 2;
  const jit = g.jitter ?? 0;
  // smooth random wobble: sum of a few sines in template space
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const fr = [0.15 + rand() * 0.2, 0.3 + rand() * 0.3];
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  for (let i = 0; i < pts.length; i += 2) {
    let u = pts[i] - 32;
    const v = pts[i + 1] - 32;
    if (g.mirror) u = -u;
    const wx = jit * (Math.sin(v * fr[0] + ph[0]) + 0.5 * Math.sin(u * fr[1] + ph[1]));
    const wy = jit * (Math.sin(u * fr[0] + ph[2]) + 0.5 * Math.sin(v * fr[1] + ph[3]));
    const uu = u + wx + sh * v;
    const vv = v + wy;
    const X = g.x + s * (uu * cos - vv * sin);
    const Y = g.y + s * (uu * sin + vv * cos);
    stampDisk(cov, w, h, X, Y, pen);
  }
}

export function makePage(bank: TemplateBank, spec: PageSpec): RGBAImage {
  const { width: w, height: h } = spec;
  const rand = rng(spec.seed ?? 1);
  const paper = spec.paper ?? [238, 236, 230];
  const data = new Uint8ClampedArray(w * h * 4);
  const lineCov = new Float32Array(w * h);
  const bandMask = new Uint8Array(w * h);
  if (spec.lineatur) {
    const L = spec.lineatur;
    for (let r = 0; ; r++) {
      const rl = rowLines(L, r);
      if (rl.top > h) break;
      const ys = L.kind === 3 ? [rl.mid, rl.base] : [rl.top, rl.mid, rl.base, rl.bottom];
      for (const y0 of ys) for (let x = 0; x < w; x++) stampDisk(lineCov, w, h, x + 0.5, y0, L.width / 2);
      if (L.band) for (let y = Math.max(0, Math.ceil(rl.mid)); y < Math.min(h, rl.base); y++) bandMask.fill(1, y * w, y * w + w);
    }
  }
  if (spec.lines) {
    const L = spec.lines;
    for (let y0 = L.offset; y0 < h; y0 += L.spacing) {
      for (let x = 0; x < w; x++) stampDisk(lineCov, w, h, x + 0.5, y0, L.width / 2);
    }
  }
  const glyphCovs = spec.glyphs.map((g) => {
    const cov = new Float32Array(w * h);
    drawGlyph(bank, cov, w, h, g, rand);
    return { cov, color: g.color ?? [30, 30, 40] };
  });
  const table = spec.table ?? 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const light = 1 - (spec.shadow ?? 0) * (x / w) * 0.6 - 0.08 * Math.hypot(x / w - 0.5, y / h - 0.5);
      let c = paper.map((p) => p * light) as [number, number, number];
      let onTable = table > 0 && (x < table || y < table || x >= w - table || y >= h - table);
      if (spec.slips) {
        const slip = spec.slips.find((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
        onTable = !slip;
        if (slip?.color) c = slip.color.map((v) => v * light) as typeof c;
      }
      if (onTable) c = [70 * light, 55 * light, 45 * light];
      else {
        if (spec.lineatur?.band && bandMask[i]) c = spec.lineatur.band.map((v) => v * light) as typeof c;
        if (spec.lineatur && lineCov[i] > 0) {
          const a = lineCov[i];
          c = c.map((v, k) => v * (1 - a) + spec.lineatur!.color[k] * light * a) as typeof c;
        }
        if (spec.lines && lineCov[i] > 0) {
          const a = lineCov[i];
          c = c.map((v, k) => v * (1 - a) + spec.lines!.color[k] * light * a) as typeof c;
        }
        for (const gc of glyphCovs) {
          const a = gc.cov[i] * 0.95;
          if (a > 0) c = c.map((v, k) => v * (1 - a) + gc.color[k] * light * a) as typeof c;
        }
      }
      const n = spec.noise ?? 3;
      const o = i * 4;
      data[o] = c[0] + (rand() - 0.5) * 2 * n;
      data[o + 1] = c[1] + (rand() - 0.5) * 2 * n;
      data[o + 2] = c[2] + (rand() - 0.5) * 2 * n;
      data[o + 3] = 255;
    }
  }
  return { width: w, height: h, data };
}

const ASCENDERS = 'bdfhklt';
const DESCENDERS = 'gjpqy';

/**
 * A word written on row \`row\` of the school lines, every letter sized to its bands (capitals and
 * ascenders up to the top line, descenders down to the bottom line). \`grow\` > 1 writes them too big.
 */
export function schoolWord(bank: TemplateBank, L: SchoolLines, row: number, text: string, x0: number, grow = 1): GlyphSpec[] {
  const rl = rowLines(L, row);
  const b = bandMm(L.kind) * L.mm;
  let x = x0;
  return [...text].map((char) => {
    const t = bank.forChar(char, 'druck')[0];
    const upper = char !== char.toLowerCase() || /[0-9]/.test(char);
    let top = rl.mid;
    let bottom = rl.base;
    if (upper || ASCENDERS.includes(char)) top = char === 't' ? rl.mid - b * 0.6 : rl.base - 2 * b;
    if (DESCENDERS.includes(char)) bottom = rl.base + b;
    const hgt = (bottom - top) * grow;
    top = bottom - hgt;
    const g: GlyphSpec = { char, x: x + (hgt * t.aspect) / 2, y: (top + bottom) / 2, size: hgt * Math.max(1, t.aspect), pen: Math.max(3, b * 0.16) };
    x += hgt * t.aspect + b * 0.55;
    return g;
  });
}

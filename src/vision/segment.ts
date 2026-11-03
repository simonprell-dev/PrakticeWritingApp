// Glyph segmentation: connected components -> filtered, stroke-merged, dot-assigned glyph candidates.
import { label, type CompStats } from './components.ts';
import { dilate, strokeWidth } from './morphology.ts';
import type { Box, Mask } from './types.ts';

export interface GlyphCandidate {
  /** box including dots (patch coordinates) */
  box: Box;
  /** box of the letter body without dots */
  baseBox: Box;
  /** component labels of the body */
  baseLabels: number[];
  /** component labels of merged dots / dashes above the body */
  dotLabels: number[];
  /** dots on top: 1 = i/j dot, 2 = umlaut (two dots or one dash) */
  dots: number;
  /** reading order row */
  row: number;
}

export interface Segmentation {
  labels: Int32Array;
  comps: CompStats[];
  glyphs: GlyphCandidate[];
  /** typical body height (median), px */
  H: number;
  strokeWidth: number;
}

interface Group {
  labels: number[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  area: number;
  dots: number[];
}

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
};

/** how the strokes of one character are found (see ScriptDef.seg) */
export interface SegStyle {
  /** latin: strokes above each other + dots on top; block: all parts close together are one character */
  mode: 'latin' | 'block';
  /** reading order in a row */
  dir: 'ltr' | 'rtl';
}

/**
 * @param m ink mask of one region patch
 * @param valid paper membership of the patch (components touching its edge are dropped), optional
 */
export function findGlyphs(m: Mask, valid: Mask | null, maxGlyphs = 60, style: SegStyle = { mode: 'latin', dir: 'ltr' }): Segmentation {
  const { width: w, height: h } = m;
  const { labels, comps } = label(m, true);
  const sw = Math.max(1, strokeWidth(m));
  const noiseArea = Math.max(8, 0.35 * sw * sw);

  // edge zone: outside the paper, dilated by 2px
  let edge: Uint8Array | null = null;
  if (valid && valid.data.includes(0)) {
    const inv: Mask = { width: w, height: h, data: new Uint8Array(w * h) };
    for (let i = 0; i < inv.data.length; i++) inv.data[i] = valid.data[i] ? 0 : 1;
    edge = dilate(inv, 2).data;
  }
  const touchesEdge = new Uint8Array(comps.length + 1);
  if (edge) {
    for (let i = 0; i < labels.length; i++) if (labels[i] && edge[i]) touchesEdge[labels[i]] = 1;
  }

  const live: CompStats[] = [];
  for (const c of comps) {
    if (c.area < noiseArea) continue;
    if (c.x0 <= 1 || c.y0 <= 1 || c.x1 >= w - 2 || c.y1 >= h - 2) continue;
    if (touchesEdge[c.label]) continue;
    live.push(c);
  }
  const heights = live
    .filter((c) => c.y1 - c.y0 + 1 >= 3 * sw && c.area >= 4 * sw * sw)
    .map((c) => c.y1 - c.y0 + 1);
  let H = median(heights);
  if (!H) H = Math.max(0, ...live.map((c) => c.y1 - c.y0 + 1));
  if (!H) return { labels, comps, glyphs: [], H: 0, strokeWidth: sw };

  const bodies: Group[] = [];
  const dots: CompStats[] = [];
  for (const c of live) {
    const cw = c.x1 - c.x0 + 1;
    const ch = c.y1 - c.y0 + 1;
    const long = Math.max(cw, ch);
    if (ch > 3.5 * H || cw > 5 * H) continue; // drawings, shadows
    if (long > 2.5 * H && Math.min(cw, ch) < 0.25 * long) continue; // underline, streak
    if (long < 0.35 * H && c.area < 0.1 * H * H) {
      dots.push(c);
      continue;
    }
    bodies.push({ labels: [c.label], x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, area: c.area, dots: [] });
  }

  if (style.mode === 'block') return blockGlyphs(labels, comps, bodies, dots, H, sw, maxGlyphs, style.dir);

  // merge strokes of one letter (pen lifted: t, E, A, H, 4 ...)
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const xOverlap = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1;
        const minW = Math.min(a.x1 - a.x0 + 1, b.x1 - b.x0 + 1);
        const yGap = Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) - 1;
        const small = Math.min(a.area, b.area) < 0.35 * Math.max(a.area, b.area);
        const overlapOk = xOverlap >= 0.3 * minW || (small && xOverlap >= -sw);
        if (!overlapOk || yGap > 0.25 * H) continue;
        const mw = Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0) + 1;
        const mh = Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0) + 1;
        if (mw > 1.5 * H || mh > 1.9 * H) continue;
        a.labels.push(...b.labels);
        a.x0 = Math.min(a.x0, b.x0);
        a.y0 = Math.min(a.y0, b.y0);
        a.x1 = Math.max(a.x1, b.x1);
        a.y1 = Math.max(a.y1, b.y1);
        a.area += b.area;
        bodies.splice(j, 1);
        merged = true;
        break outer;
      }
    }
  }

  // assign dots / dashes to the body below them
  for (const d of dots) {
    const dcx = (d.x0 + d.x1) / 2;
    let best: Group | null = null;
    let bestCost = Infinity;
    for (const g of bodies) {
      const gh = g.y1 - g.y0 + 1;
      if (dcx < g.x0 - 0.3 * H || dcx > g.x1 + 0.3 * H) continue;
      if (d.y1 > g.y0 + 0.35 * gh) continue;
      const gap = g.y0 - d.y1;
      if (gap > 0.8 * H) continue;
      const cost = Math.max(0, gap) + 0.5 * Math.abs(dcx - (g.x0 + g.x1) / 2);
      if (cost < bestCost) {
        bestCost = cost;
        best = g;
      }
    }
    if (best) best.dots.push(d.label);
  }

  const glyphs: GlyphCandidate[] = [];
  for (const g of bodies) {
    const gw = g.x1 - g.x0 + 1;
    const gh = g.y1 - g.y0 + 1;
    if (gh < 0.3 * H && gw < 0.3 * H) continue;
    if (Math.max(gw, gh) < Math.max(6, 2 * sw)) continue;
    let x0 = g.x0;
    let y0 = g.y0;
    let x1 = g.x1;
    let y1 = g.y1;
    let dotCount = 0;
    for (const l of g.dots) {
      const d = comps[l - 1];
      x0 = Math.min(x0, d.x0);
      y0 = Math.min(y0, d.y0);
      x1 = Math.max(x1, d.x1);
      y1 = Math.max(y1, d.y1);
      const dw = d.x1 - d.x0 + 1;
      const dh = d.y1 - d.y0 + 1;
      dotCount += dw > 2.2 * dh && dw > 0.3 * gw ? 2 : 1; // a dash over a/o/u counts as umlaut
    }
    glyphs.push({
      box: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
      baseBox: { x: g.x0, y: g.y0, w: gw, h: gh },
      baseLabels: g.labels,
      dotLabels: g.dots,
      dots: Math.min(2, dotCount),
      row: 0,
    });
  }

  readingOrder(glyphs, H, style.dir);
  return { labels, comps, glyphs: glyphs.slice(0, maxGlyphs), H, strokeWidth: sw };
}

/** reading order: rows by vertical centre, then left to right (right to left for Arabic and Hebrew) */
function readingOrder(glyphs: GlyphCandidate[], H: number, dir: 'ltr' | 'rtl'): void {
  glyphs.sort((a, b) => a.baseBox.y + a.baseBox.h / 2 - (b.baseBox.y + b.baseBox.h / 2));
  let row = -1;
  let rowY = -Infinity;
  for (const g of glyphs) {
    const cy = g.baseBox.y + g.baseBox.h / 2;
    if (cy - rowY > 0.6 * H) {
      row++;
      rowY = cy;
    }
    g.row = row;
  }
  const sign = dir === 'rtl' ? -1 : 1;
  glyphs.sort((a, b) => a.row - b.row || sign * (a.box.x + a.box.w / 2 - (b.box.x + b.box.w / 2)));
}

/**
 * Characters made of several parts that lie side by side or above and below each other (い, け, ふ, ب, ё, 가 …):
 * the parts closest together are joined first, as long as the result is not bigger than one character.
 * Characters have to be written with a little space between them.
 */
function blockGlyphs(labels: Int32Array, comps: CompStats[], bodies: Group[], dots: CompStats[], H: number, sw: number, maxGlyphs: number, dir: 'ltr' | 'rtl'): Segmentation {
  const parts: Group[] = [...bodies, ...dots.map((c) => ({ labels: [c.label], x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, area: c.area, dots: [] }))];
  // size of one character: most characters have at least one stroke across nearly all of it
  const ext = parts.filter((p) => p.area >= 4 * sw * sw).map((p) => Math.max(p.x1 - p.x0 + 1, p.y1 - p.y0 + 1)).sort((a, b) => a - b);
  const S = Math.max(H, ext.length ? ext[Math.min(ext.length - 1, Math.floor(ext.length * 0.8))] : H);
  const gapOf = (a: Group, b: Group) => Math.max(Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1) - 1, Math.max(a.y0, b.y0) - Math.min(a.y1, b.y1) - 1, 0);
  for (;;) {
    let best: [number, number] | null = null;
    let bestGap = Infinity;
    for (let i = 0; i < parts.length; i++) {
      for (let j = i + 1; j < parts.length; j++) {
        const a = parts[i];
        const b = parts[j];
        const gap = gapOf(a, b);
        // the size limit keeps neighbours apart; the gap may be wide (the two bars of ニ, the dots of ふ)
        if (gap > 0.6 * S || gap >= bestGap) continue;
        const mw = Math.max(a.x1, b.x1) - Math.min(a.x0, b.x0) + 1;
        const mh = Math.max(a.y1, b.y1) - Math.min(a.y0, b.y0) + 1;
        if (mw > 1.15 * S || mh > 1.25 * S) continue;
        best = [i, j];
        bestGap = gap;
      }
    }
    if (!best) break;
    const [a, b] = [parts[best[0]], parts[best[1]]];
    a.labels.push(...b.labels);
    a.x0 = Math.min(a.x0, b.x0);
    a.y0 = Math.min(a.y0, b.y0);
    a.x1 = Math.max(a.x1, b.x1);
    a.y1 = Math.max(a.y1, b.y1);
    a.area += b.area;
    parts.splice(best[1], 1);
  }
  const glyphs: GlyphCandidate[] = [];
  for (const g of parts) {
    const gw = g.x1 - g.x0 + 1;
    const gh = g.y1 - g.y0 + 1;
    // a lone dot or speck is no character
    if (Math.max(gw, gh) < Math.max(6, 2 * sw, 0.3 * S)) continue;
    const box = { x: g.x0, y: g.y0, w: gw, h: gh };
    glyphs.push({ box, baseBox: { ...box }, baseLabels: g.labels, dotLabels: [], dots: 0, row: 0 });
  }
  readingOrder(glyphs, S, dir);
  return { labels, comps, glyphs: glyphs.slice(0, maxGlyphs), H: S, strokeWidth: sw };
}

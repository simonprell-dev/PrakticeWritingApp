// The colouring card of the "Mal-Aquarium": an animal to colour in, inside a thick black frame; six cards fit
// on an A4 sheet. Pure geometry in millimetres, shared by the print sheet, the card detection in the worker
// and the sprite of the painted fish.

import { SPECIES, type SpeciesId } from './species.ts';

export type Pt = [number, number];

/** one card: outer edge of the black frame = (0, 0) .. (w, h); white margin up to the cut line */
export const CARD = { w: 94, h: 88, frame: 2.6, margin: 3 } as const;

/** A4 portrait, 2 × 3 cards, cut lines between them */
export const SHEET = { w: 210, h: 297, cols: 2, rows: 3 } as const;

/** texture resolution of a scanned card (px per mm) */
export const CARD_PX = 5;

/** line widths in mm */
export const LINE = { outline: 1.1, inner: 0.6, frameDash: 0.35 } as const;

/** texts and the line for the fish's name (card mm) */
export const LABELS = {
  hint: { text: 'Mal mich bunt an!', x: CARD.w - 6, y: 8.6, size: 3.4 },
  name: { text: 'Mein Fisch heißt:', x: 6, y: 80.5, size: 3.6 },
  line: { x0: 38, x1: CARD.w - 6, y: 81.5 },
  /** area cut out to show the name in the game */
  nameBox: { x: 39, y: 73.5, w: CARD.w - 43.5, h: 11 },
} as const;

/**
 * The printed marks of the free-form card (card mm): a box around the hint at the top and an arrow under
 * „Kopf nach hier →“. The card has no animal outline, so these marks (and the name line) tell which way up it lies.
 */
export const FREEFORM = {
  hintBox: { x: 40.5, y: 5, w: 49, h: 5.8 },
  /** shaft from x0 to x1, the head at x1 */
  arrow: { x0: 64, x1: 88, y: 48, head: 3 },
  width: 0.6,
} as const;

/** a point of the animal (its own units) on the card, in mm */
export function toCard(sp: SpeciesId, x: number, y: number): Pt {
  const { place } = SPECIES[sp];
  return [place.x + x * place.s, place.y + y * place.s];
}

/** top-left corners (mm) of the six cards on the sheet; the cut lines run around each cell */
export function sheetLayout(): { cells: { x: number; y: number }[]; cellW: number; cellH: number; x0: number; y0: number } {
  const cellW = CARD.w + 2 * CARD.margin;
  const cellH = CARD.h + 2 * CARD.margin;
  const x0 = (SHEET.w - SHEET.cols * cellW) / 2;
  const y0 = (SHEET.h - SHEET.rows * cellH) / 2;
  const cells: { x: number; y: number }[] = [];
  for (let r = 0; r < SHEET.rows; r++) for (let c = 0; c < SHEET.cols; c++) cells.push({ x: x0 + c * cellW + CARD.margin, y: y0 + r * cellH + CARD.margin });
  return { cells, cellW, cellH, x0, y0 };
}

// ---------------------------------------------------------------- path helpers (no DOM)

/** Flattens an absolute SVG path (M, L, C, Q, Z) into polylines. */
export function flatten(d: string, steps = 12): Pt[][] {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/g) ?? [];
  const out: Pt[][] = [];
  let cur: Pt[] = [];
  let p: Pt = [0, 0];
  let start: Pt = [0, 0];
  let i = 0;
  const num = () => Number(tok[i++]);
  while (i < tok.length) {
    const cmd = tok[i++];
    if (cmd === 'M') {
      if (cur.length > 1) out.push(cur);
      p = [num(), num()];
      start = p;
      cur = [p];
    } else if (cmd === 'L') {
      p = [num(), num()];
      cur.push(p);
    } else if (cmd === 'C') {
      const a: Pt = [num(), num()];
      const b: Pt = [num(), num()];
      const e: Pt = [num(), num()];
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        cur.push([
          u * u * u * p[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0],
          u * u * u * p[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1],
        ]);
      }
      p = e;
    } else if (cmd === 'Q') {
      const a: Pt = [num(), num()];
      const e: Pt = [num(), num()];
      for (let k = 1; k <= steps; k++) {
        const t = k / steps;
        const u = 1 - t;
        cur.push([u * u * p[0] + 2 * u * t * a[0] + t * t * e[0], u * u * p[1] + 2 * u * t * a[1] + t * t * e[1]]);
      }
      p = e;
    } else if (cmd === 'Z') {
      cur.push(start);
      p = start;
    } else break;
  }
  if (cur.length > 1) out.push(cur);
  return out;
}

export function insidePolygon(poly: Pt[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const partPolys = new Map<SpeciesId, Record<string, Pt[]>>();

/** the outline parts as polygons in the animal's units */
export function partPolygons(sp: SpeciesId): Record<string, Pt[]> {
  let out = partPolys.get(sp);
  if (!out) {
    out = {};
    for (const p of SPECIES[sp].parts) out[p.id] = flatten(p.d)[0];
    partPolys.set(sp, out);
  }
  return out;
}

/** true when the point (animal units) is on the animal */
export function onAnimal(sp: SpeciesId, x: number, y: number): boolean {
  return Object.values(partPolygons(sp)).some((poly) => insidePolygon(poly, x, y));
}

export interface LineSample {
  /** card mm */
  x: number;
  y: number;
  /** unit normal */
  nx: number;
  ny: number;
}

/**
 * Points every `step` mm along the visible printed lines of the animal (silhouette and inner lines), with
 * their normals, in card mm. The detection looks for them to find out which way up a card lies.
 */
export function lineSamples(sp: SpeciesId, step = 1): LineSample[] {
  if (sp === 'freiform') return freeformSamples(step);
  const { place, parts, lines, eyes } = SPECIES[sp];
  const out: LineSample[] = [];
  const add = (poly: Pt[], visible: (x: number, y: number) => boolean) => {
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = toCard(sp, poly[i - 1][0], poly[i - 1][1]);
      const [bx, by] = toCard(sp, poly[i][0], poly[i][1]);
      const len = Math.hypot(bx - ax, by - ay);
      if (len < 1e-6) continue;
      const nx = -(by - ay) / len;
      const ny = (bx - ax) / len;
      const n = Math.max(1, Math.round(len / step));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const x = ax + (bx - ax) * t;
        const y = ay + (by - ay) * t;
        const fx = (x - place.x) / place.s;
        const fy = (y - place.y) / place.s;
        // the eyes are drawn over everything
        if (visible(fx, fy) && !eyes.some((e) => Math.hypot(fx - e.x, fy - e.y) < e.r)) out.push({ x, y, nx, ny });
      }
    }
  };
  const polys = partPolygons(sp);
  const ids = parts.map((p) => p.id);
  // the parts are drawn back to front: an outline is only visible where no later part covers it
  ids.forEach((k, i) => {
    const front = ids.slice(i + 1);
    add(polys[k], (x, y) => !front.some((f) => insidePolygon(polys[f], x, y)));
  });
  for (const d of lines) for (const poly of flatten(d)) add(poly, () => true);
  return out;
}

/** samples along a polyline in card mm */
function along(poly: Pt[], step: number, out: LineSample[]): void {
  for (let i = 1; i < poly.length; i++) {
    const [ax, ay] = poly[i - 1];
    const [bx, by] = poly[i];
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      out.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, nx: -(by - ay) / len, ny: (bx - ax) / len });
    }
  }
}

/** the free-form card: its hint box, its arrow and the right part of the name line (the same on every card) */
function freeformSamples(step: number): LineSample[] {
  const { hintBox: b, arrow: a } = FREEFORM;
  const out: LineSample[] = [];
  along([[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h], [b.x, b.y]], step, out);
  along([[a.x0, a.y], [a.x1, a.y]], step, out);
  along([[a.x1 - a.head, a.y - a.head * 0.75], [a.x1, a.y], [a.x1 - a.head, a.y + a.head * 0.75]], step, out);
  along([[LABELS.line.x1 - 28, LABELS.line.y], [LABELS.line.x1, LABELS.line.y]], step, out);
  return out;
}

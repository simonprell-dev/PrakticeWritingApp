// Template bank (Druckschrift + Grundschrift) and skeleton chamfer matching.
import { chamfer } from '../vision/distance.ts';
import { countHoles } from '../vision/morphology.ts';
import { TPL_SIZE } from '../vision/normalize.ts';
import { pruneSpurs, skeletonGraph, zhangSuen } from '../vision/thinning.ts';
import type { Mask, TemplateStyle } from '../vision/types.ts';

export interface TemplateMetaEntry {
  char: string;
  style: TemplateStyle;
  /** height above baseline in x-heights */
  top: number;
  /** depth below baseline in x-heights */
  bottom: number;
  /** box aspect w/h */
  aspect: number;
}

export interface TemplateMeta {
  version: string;
  size: number;
  fit: number;
  bytesPerTemplate: number;
  templates: TemplateMetaEntry[];
}

/** Skeleton representation shared by templates and glyphs. */
export interface Skel {
  mask: Mask;
  skeleton: Mask;
  /** skeleton pixel coordinates [x0,y0,x1,y1,...] */
  pts: Float32Array;
  /** distance of every pixel to the skeleton */
  dt: Float32Array;
  box: { x0: number; y0: number; x1: number; y1: number };
  holes: number;
  endpoints: number;
  junctions: number;
}

export interface Template extends TemplateMetaEntry {
  skel: Skel;
}

export function buildSkel(m: Mask): Skel {
  const sk0 = zhangSuen(m);
  const skeleton = pruneSpurs(sk0, 5);
  const g = skeletonGraph(skeleton);
  const pts: number[] = [];
  let x0 = m.width;
  let y0 = m.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (skeleton.data[y * m.width + x]) pts.push(x, y);
      if (m.data[y * m.width + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) {
    x0 = y0 = 0;
    x1 = y1 = 1;
  }
  return {
    mask: m,
    skeleton,
    pts: Float32Array.from(pts),
    dt: chamfer(skeleton),
    box: { x0, y0, x1, y1 },
    holes: countHoles(m, 4),
    endpoints: g.endpoints,
    junctions: g.junctions,
  };
}

export class TemplateBank {
  readonly templates: Template[] = [];
  private byChar = new Map<string, Template[]>();

  constructor(meta: TemplateMeta, bin: ArrayBuffer) {
    const bytes = new Uint8Array(bin);
    const n = meta.size * meta.size;
    meta.templates.forEach((e, k) => {
      const m: Mask = { width: meta.size, height: meta.size, data: new Uint8Array(n) };
      const off = k * meta.bytesPerTemplate;
      for (let i = 0; i < n; i++) m.data[i] = (bytes[off + (i >> 3)] >> (7 - (i & 7))) & 1;
      const t: Template = { ...e, skel: buildSkel(m) };
      this.templates.push(t);
      const list = this.byChar.get(e.char) ?? [];
      list.push(t);
      this.byChar.set(e.char, list);
    });
  }

  forChar(ch: string, style: 'beide' | TemplateStyle = 'beide'): Template[] {
    const list = this.byChar.get(ch) ?? [];
    if (style === 'beide') return list;
    const pref = list.filter((t) => t.style === style);
    return pref.length ? pref : list;
  }

  chars(): string[] {
    return [...this.byChar.keys()];
  }
}

export interface MatchResult {
  /** symmetric truncated chamfer distance (px in 64 space) */
  D: number;
  /** best shear (x += k * (y - cy)), positive corrects a right lean */
  shear: number;
  template: Template;
  mirrored: boolean;
}

const CAP = 8;
const SHEARS_FULL = [-0.3, -0.15, 0, 0.15, 0.3];
const SX_FULL = [0.9, 1, 1.1];
const D_FULL = [-2, 0, 2];

function lookup(dt: Float32Array, x: number, y: number): number {
  const xi = (x + 0.5) | 0;
  const yi = (y + 0.5) | 0;
  if (x < -0.5 || y < -0.5 || xi >= TPL_SIZE || yi >= TPL_SIZE) return CAP;
  const v = dt[yi * TPL_SIZE + xi];
  return v < CAP ? v : CAP;
}

/**
 * Chamfer match of glyph against template. The glyph box is first mapped onto the template box
 * (aspect differences are judged separately), then shear / x-scale / shift are searched.
 */
export function matchSkel(g: Skel, t: Template, coarse = false, mirror = false): MatchResult {
  const ts = t.skel;
  const gpts = g.pts;
  const tpts = ts.pts;
  if (!gpts.length || !tpts.length) return { D: CAP, shear: 0, template: t, mirrored: mirror };
  const gb = g.box;
  const tb = ts.box;
  const gw = gb.x1 - gb.x0 + 1;
  const gh = gb.y1 - gb.y0 + 1;
  const tw = tb.x1 - tb.x0 + 1;
  const th = tb.y1 - tb.y0 + 1;
  const bsx = Math.min(1.6, Math.max(0.6, tw / gw));
  const bsy = Math.min(1.6, Math.max(0.6, th / gh));
  const gcx = (gb.x0 + gb.x1) / 2;
  const gcy = (gb.y0 + gb.y1) / 2;
  const tcx = (tb.x0 + tb.x1) / 2;
  const tcy = (tb.y0 + tb.y1) / 2;
  const mx = mirror ? -1 : 1;
  // template points sampled at most ~160 for speed
  const tStep = Math.max(1, Math.floor(tpts.length / 2 / 160)) * 2;
  const gStep = Math.max(1, Math.floor(gpts.length / 2 / 160)) * 2;
  const evalD = (k: number, sx: number, dx: number, dy: number) => {
    // forward: glyph -> template space
    let d1 = 0;
    let n1 = 0;
    for (let i = 0; i < gpts.length; i += gStep) {
      const u = mx * (gpts[i] - gcx);
      const v = gpts[i + 1] - gcy;
      d1 += lookup(ts.dt, sx * (u + k * v) + tcx + dx, bsy * v + tcy + dy);
      n1++;
    }
    // backward: template -> glyph space (inverse transform)
    let d2 = 0;
    let n2 = 0;
    for (let i = 0; i < tpts.length; i += tStep) {
      const v = (tpts[i + 1] - tcy - dy) / bsy;
      const u = (tpts[i] - tcx - dx) / sx - k * v;
      d2 += lookup(g.dt, mx * u + gcx, v + gcy);
      n2++;
    }
    return 0.5 * (d1 / n1 + d2 / n2);
  };
  if (coarse) return { D: evalD(0, bsx, 0, 0), shear: 0, template: t, mirrored: mirror };
  // stage 1: shear x scale, stage 2: shift around the best
  let best = { D: Infinity, k: 0, sx: bsx };
  for (const k of SHEARS_FULL) {
    for (const sm of SX_FULL) {
      const D = evalD(k, bsx * sm, 0, 0);
      if (D < best.D) best = { D, k, sx: bsx * sm };
    }
  }
  for (const dx of D_FULL) {
    for (const dy of D_FULL) {
      if (!dx && !dy) continue;
      const D = evalD(best.k, best.sx, dx, dy);
      if (D < best.D) best = { ...best, D };
    }
  }
  return { D: best.D, shear: best.k, template: t, mirrored: mirror };
}

/** Similarity 0..1 from a chamfer distance. */
export function similarity(D: number): number {
  return Math.min(1, Math.max(0, 1 - (D - 1) / 4));
}

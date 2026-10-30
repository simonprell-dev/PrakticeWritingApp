// Remembers glyphs of previous scans so only new handwriting spawns creatures – and only new
// handwriting is recognised: a known glyph keeps the result of the scan it first appeared in.
// The paper may move between scans: the shift is found by voting over matched glyph pairs. When the paper
// was also turned, the turn is found from pairs of neighbouring glyphs that lie the same distance apart.
import type { Analysis } from '../recog/recognizer.ts';
import type { Box, GlyphScore } from './types.ts';

/** recognition result of a glyph, stored when it was new */
export interface KnownResult {
  analysis: Analysis;
  score: GlyphScore;
}

export interface MemGlyph {
  box: Box;
  /** 16x16 binary thumbnail */
  thumb: Uint8Array;
  /** dots on top when it was scanned (missing in games saved before) */
  dots?: number;
  known?: KnownResult;
}

export interface MatchResult {
  isNew: boolean[];
  /** the remembered glyph each current glyph matched (null for new glyphs) */
  matched: (MemGlyph | null)[];
  shift: { dx: number; dy: number };
  /** the paper was turned: an old centre p lies at R(a)·p + (dx, dy) now */
  turn?: Turn;
  newSheet: boolean;
}

export interface Turn {
  a: number;
  dx: number;
  dy: number;
}

export const THUMB = 16;

export function dice(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    inter += a[i] & b[i];
    sa += a[i];
    sb += b[i];
  }
  return sa + sb ? (2 * inter) / (sa + sb) : 0;
}

/** Dice with a 1px tolerance (dilated b), symmetric. */
export function softDice(a: Uint8Array, b: Uint8Array, size = THUMB): number {
  const dil = (m: Uint8Array) => {
    const o = new Uint8Array(m.length);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let v = 0;
        for (let dy = -1; dy <= 1 && !v; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < size && yy < size && m[yy * size + xx]) {
              v = 1;
              break;
            }
          }
        }
        o[y * size + x] = v;
      }
    }
    return o;
  };
  const da = dil(a);
  const db = dil(b);
  let ia = 0;
  let ib = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < a.length; i++) {
    ia += a[i] & db[i];
    ib += b[i] & da[i];
    sa += a[i];
    sb += b[i];
  }
  return sa + sb ? (ia + ib) / (sa + sb) : 0;
}

function iou(a: Box, b: Box): number {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}

export class GlyphMemory {
  items: MemGlyph[] = [];
  /** 'sheet': children keep writing on the same paper; 'slips': physical slips, stricter matching */
  mode: 'sheet' | 'slips';

  constructor(mode: 'sheet' | 'slips' = 'sheet') {
    this.mode = mode;
  }

  reset(): void {
    this.items = [];
  }

  match(glyphs: MemGlyph[]): MatchResult {
    const n = glyphs.length;
    const allNew = (newSheet: boolean): MatchResult => ({ isNew: glyphs.map(() => true), matched: glyphs.map(() => null), shift: { dx: 0, dy: 0 }, newSheet });
    if (!this.items.length || !n) return allNew(false);
    const minDice = this.mode === 'slips' ? 0.8 : 0.62;
    const minIou = this.mode === 'slips' ? 0.55 : 0.35;
    const H = median(glyphs.map((g) => g.box.h)) || 20;
    // vote for the paper shift
    const bin = Math.max(2, H * 0.25);
    const votes = new Map<string, { n: number; dx: number; dy: number }>();
    for (const o of this.items) {
      for (const g of glyphs) {
        const r = g.box.h / o.box.h;
        if (r < 0.7 || r > 1.4) continue;
        if (softDice(o.thumb, g.thumb) < minDice) continue;
        const dx = g.box.x + g.box.w / 2 - (o.box.x + o.box.w / 2);
        const dy = g.box.y + g.box.h / 2 - (o.box.y + o.box.h / 2);
        const key = `${Math.round(dx / bin)},${Math.round(dy / bin)}`;
        const v = votes.get(key) ?? { n: 0, dx: 0, dy: 0 };
        v.n++;
        v.dx += dx;
        v.dy += dy;
        votes.set(key, v);
      }
    }
    let best = { n: 0, dx: 0, dy: 0 };
    for (const v of votes.values()) if (v.n > best.n) best = v;
    const zero = votes.get('0,0');
    const minVotes = Math.max(2, Math.round(0.3 * Math.min(this.items.length, n)));
    let shift = { dx: 0, dy: 0 };
    if (best.n >= minVotes && !(zero && zero.n >= best.n * 0.8)) {
      shift = { dx: best.dx / best.n, dy: best.dy / best.n };
    }
    const usedOld = new Set<number>();
    let matched = glyphs.map((g) => {
      for (let i = 0; i < this.items.length; i++) {
        if (usedOld.has(i)) continue;
        const o = this.items[i];
        const ob = { x: o.box.x + shift.dx, y: o.box.y + shift.dy, w: o.box.w, h: o.box.h };
        if (iou(ob, g.box) < minIou) continue;
        if (softDice(o.thumb, g.thumb) < minDice) continue;
        // dots added later ("Punkte nicht vergessen!"): u becomes ü, a new letter
        if (gainedDots(o, g)) continue;
        usedOld.add(i);
        return o;
      }
      return null;
    });
    let matchedOld = usedOld.size;
    let turn: Turn | undefined;
    // few glyphs found again: maybe the paper was turned
    if (matchedOld < 0.6 * Math.min(this.items.length, n) && this.items.length >= 2 && n >= 2) {
      // the turn whose glyphs look most alike wins (on an even grid a quarter turn also fits the positions)
      let bestScore = matchedOld;
      for (const t of this.turns(glyphs, H)) {
        const { matched: m, score } = this.pairTurned(glyphs, t, H, minDice);
        if (score > bestScore) {
          matched = m;
          matchedOld = m.filter(Boolean).length;
          bestScore = score;
          turn = t;
        }
      }
    }
    const newSheet = this.mode === 'sheet' && this.items.length >= 3 && n >= 3 && matchedOld / this.items.length < 0.3 && matchedOld / n < 0.3;
    if (newSheet) return allNew(true);
    return { isNew: matched.map((m) => !m), matched, shift: turn ? { dx: 0, dy: 0 } : shift, turn, newSheet };
  }

  /**
   * Candidate turns of the paper: a pair of neighbouring old glyphs and a pair of current glyphs the same
   * distance apart give an angle and a shift; the ones that bring most old glyphs onto current glyphs win.
   */
  private turns(glyphs: MemGlyph[], H: number): Turn[] {
    const old = this.items.map((o) => centre(o.box));
    const now = glyphs.map((g) => centre(g.box));
    const pairs = (pts: [number, number][]) => {
      const out: { i: number; j: number; d: number; ang: number }[] = [];
      pts.forEach((p, i) => {
        const near = pts
          .map((q, j) => ({ j, d: Math.hypot(q[0] - p[0], q[1] - p[1]) }))
          .filter((x) => x.j !== i && x.d > 0.8 * H)
          .sort((a, b) => a.d - b.d)
          .slice(0, 4);
        for (const { j, d } of near) out.push({ i, j, d, ang: Math.atan2(pts[j][1] - p[1], pts[j][0] - p[0]) });
      });
      return out;
    };
    const op = pairs(old);
    const np = pairs(now);
    const tol = 0.4 * H;
    // old centres on a grid of cells `tol` wide: "was there a glyph here?" in constant time
    const cell = (gx: number, gy: number) => (gy + 4096) * 8192 + gx + 4096;
    const grid = new Set(old.map(([u, v]) => cell(Math.floor(u / tol), Math.floor(v / tol))));
    const near = (x: number, y: number) => {
      const gx = Math.floor(x / tol);
      const gy = Math.floor(y / tol);
      for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) if (grid.has(cell(xx, yy))) return true;
      return false;
    };
    // a guess is checked on at most 60 of the current glyphs, turned back onto the old paper (only part of
    // the old paper may be in the picture, so counting the old glyphs would favour wrong turns)
    const probe = now.filter((_, i) => i % Math.ceil(now.length / 60) === 0);
    const seen = new Map<string, { t: Turn; inliers: number }>();
    const turned = new Map<string, Uint8Array>();
    // a full sheet has many pairs: a bounded number of guesses keeps the scan fast
    let budget = 3000;
    for (const b of np) {
      if (budget <= 0) break;
      for (const a of op) {
        if (Math.abs(a.d - b.d) > 0.12 * b.d + 0.15 * H) continue;
        const ang = wrap(b.ang - a.ang);
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        const [ox, oy] = old[a.i];
        const t: Turn = { a: ang, dx: now[b.i][0] - (c * ox - s * oy), dy: now[b.i][1] - (s * ox + c * oy) };
        const key = `${Math.round(ang / 0.05)},${Math.round(t.dx / tol)},${Math.round(t.dy / tol)}`;
        if (seen.has(key)) continue;
        // the first glyph of the pair must look like itself turned by this angle
        const tk = `${a.i},${Math.round(ang / 0.05)}`;
        let th = turned.get(tk);
        if (!th) turned.set(tk, (th = turnThumb(this.items[a.i].thumb, ang)));
        if (softDice(th, glyphs[b.i].thumb) < 0.5) continue;
        if (--budget <= 0) break;
        let inliers = 0;
        for (const [x, y] of probe) {
          const u = x - t.dx;
          const v = y - t.dy;
          if (near(c * u + s * v, -s * u + c * v)) inliers++;
        }
        seen.set(key, { t, inliers });
      }
    }
    const need = Math.max(2, Math.round((0.3 * Math.min(old.length, now.length) * probe.length) / now.length));
    return [...seen.values()]
      .filter((x) => x.inliers >= need)
      .sort((a, b) => b.inliers - a.inliers)
      .slice(0, 8)
      .map((x) => x.t);
  }

  /** current glyphs matched to the old ones moved by the turn (the old picture turned along) */
  private pairTurned(glyphs: MemGlyph[], t: Turn, H: number, minDice: number): { matched: (MemGlyph | null)[]; score: number } {
    const c = Math.cos(t.a);
    const s = Math.sin(t.a);
    const used = new Set<number>();
    const thumbs = new Map<number, Uint8Array>();
    let score = 0;
    const matched = glyphs.map((g) => {
      const [gx, gy] = centre(g.box);
      for (let i = 0; i < this.items.length; i++) {
        if (used.has(i)) continue;
        const o = this.items[i];
        const [x, y] = centre(o.box);
        if (Math.hypot(c * x - s * y + t.dx - gx, s * x + c * y + t.dy - gy) > 0.45 * Math.max(H, g.box.h)) continue;
        const r = Math.max(g.box.w, g.box.h) / Math.max(o.box.w, o.box.h);
        if (r < 0.6 || r > 1.6) continue;
        let th = thumbs.get(i);
        if (!th) thumbs.set(i, (th = turnThumb(o.thumb, t.a)));
        // turning a 16 × 16 picture blurs it a little
        const d = softDice(th, g.thumb);
        if (d < minDice - 0.08) continue;
        if (gainedDots(o, g)) continue;
        used.add(i);
        score += d;
        return o;
      }
      return null;
    });
    return { matched, score };
  }

  /** Stores the current scan: old glyphs follow the paper shift, new ones are added (with their result). */
  commit(glyphs: MemGlyph[], res: MatchResult): void {
    if (res.newSheet) this.items = [];
    else if (res.turn) {
      // everything turns with the paper, the pictures too (later scans see the paper this way round)
      const { a, dx, dy } = res.turn;
      const c = Math.cos(a);
      const s = Math.sin(a);
      for (const o of this.items) {
        const [x, y] = centre(o.box);
        const quarter = Math.abs(Math.sin(a)) > Math.SQRT1_2;
        const w = quarter ? o.box.h : o.box.w;
        const h = quarter ? o.box.w : o.box.h;
        o.box = { x: c * x - s * y + dx - w / 2, y: s * x + c * y + dy - h / 2, w, h };
        o.thumb = turnThumb(o.thumb, a);
      }
    } else {
      for (const o of this.items) {
        o.box = { ...o.box, x: o.box.x + res.shift.dx, y: o.box.y + res.shift.dy };
      }
    }
    glyphs.forEach((g, i) => {
      const old = res.matched[i];
      // a known glyph follows the paper exactly; it keeps its first thumbnail and result
      if (old) old.box = g.box;
      else {
        // the same letter with its dots added replaces the one without
        this.items = this.items.filter((o) => !(gainedDots(o, g) && iou(o.box, g.box) >= 0.35));
        this.items.push(g);
      }
    });
    if (this.items.length > 400) this.items.splice(0, this.items.length - 400);
  }
}

function centre(b: Box): [number, number] {
  return [b.x + b.w / 2, b.y + b.h / 2];
}

function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** a thumbnail turned by `a` (radians), fitted again into its box like thumbnail() does */
export function turnThumb(t: Uint8Array, a: number): Uint8Array {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const m = (THUMB - 1) / 2;
  const pts: [number, number][] = [];
  for (let y = 0; y < THUMB; y++) {
    for (let x = 0; x < THUMB; x++) {
      if (!t[y * THUMB + x]) continue;
      // a few points per cell, so the turned picture has no holes
      for (const oy of [-0.33, 0, 0.33]) {
        for (const ox of [-0.33, 0, 0.33]) {
          const px = x + ox - m;
          const py = y + oy - m;
          pts.push([c * px - s * py, s * px + c * py]);
        }
      }
    }
  }
  const out = new Uint8Array(THUMB * THUMB);
  if (!pts.length) return out;
  const x0 = Math.min(...pts.map((p) => p[0])) - 0.5;
  const y0 = Math.min(...pts.map((p) => p[1])) - 0.5;
  const w = Math.max(...pts.map((p) => p[0])) + 0.5 - x0;
  const h = Math.max(...pts.map((p) => p[1])) + 0.5 - y0;
  const L = Math.max(w, h);
  const ox = (L - w) / 2;
  const oy = (L - h) / 2;
  for (const [x, y] of pts) {
    const tx = Math.min(THUMB - 1, Math.floor(((x - x0 + ox) / L) * THUMB));
    const ty = Math.min(THUMB - 1, Math.floor(((y - y0 + oy) / L) * THUMB));
    out[ty * THUMB + tx] = 1;
  }
  return out;
}

function gainedDots(old: MemGlyph, now: MemGlyph): boolean {
  return old.dots !== undefined && now.dots !== undefined && now.dots > old.dots;
}

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  return s[s.length >> 1];
}

/** 16x16 binary thumbnail of a glyph mask (box-fitted, aspect preserved). */
export function thumbnail(bin: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(THUMB * THUMB);
  const L = Math.max(w, h);
  const ox = (L - w) / 2;
  const oy = (L - h) / 2;
  const acc = new Float32Array(THUMB * THUMB);
  const cnt = new Float32Array(THUMB * THUMB);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = Math.min(THUMB - 1, Math.floor(((x + ox) / L) * THUMB));
      const ty = Math.min(THUMB - 1, Math.floor(((y + oy) / L) * THUMB));
      acc[ty * THUMB + tx] += bin[y * w + x];
      cnt[ty * THUMB + tx]++;
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = cnt[i] && acc[i] / cnt[i] >= 0.2 ? 1 : 0;
  return out;
}

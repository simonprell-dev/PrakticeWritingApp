// Remembers glyphs of previous scans so only new handwriting spawns creatures.
// The paper may move between scans: the shift is found by voting over matched glyph pairs.
import type { Box } from './types.ts';

export interface MemGlyph {
  box: Box;
  /** 16x16 binary thumbnail */
  thumb: Uint8Array;
}

export interface MatchResult {
  isNew: boolean[];
  shift: { dx: number; dy: number };
  newSheet: boolean;
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
    if (!this.items.length || !n) {
      return { isNew: glyphs.map(() => true), shift: { dx: 0, dy: 0 }, newSheet: false };
    }
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
    const isNew = glyphs.map((g) => {
      for (let i = 0; i < this.items.length; i++) {
        if (usedOld.has(i)) continue;
        const o = this.items[i];
        const ob = { x: o.box.x + shift.dx, y: o.box.y + shift.dy, w: o.box.w, h: o.box.h };
        if (iou(ob, g.box) < minIou) continue;
        if (softDice(o.thumb, g.thumb) < minDice) continue;
        usedOld.add(i);
        return false;
      }
      return true;
    });
    const matchedOld = usedOld.size;
    const newSheet = this.mode === 'sheet' && this.items.length >= 3 && n >= 3 && matchedOld / this.items.length < 0.3 && matchedOld / n < 0.3;
    if (newSheet) return { isNew: glyphs.map(() => true), shift: { dx: 0, dy: 0 }, newSheet };
    return { isNew, shift, newSheet };
  }

  /** Stores the current scan: old glyphs follow the paper shift, new ones are added. */
  commit(glyphs: MemGlyph[], res: MatchResult): void {
    if (res.newSheet) this.items = [];
    else {
      for (const o of this.items) {
        o.box = { ...o.box, x: o.box.x + res.shift.dx, y: o.box.y + res.shift.dy };
      }
    }
    glyphs.forEach((g, i) => {
      if (res.isNew[i] || res.newSheet) this.items.push(g);
    });
    if (this.items.length > 400) this.items.splice(0, this.items.length - 400);
  }
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

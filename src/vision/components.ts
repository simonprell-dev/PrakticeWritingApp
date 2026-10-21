import type { Mask } from './types.ts';

export interface CompStats {
  label: number;
  area: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  sumX: number;
  sumY: number;
}

export interface Labeling {
  labels: Int32Array;
  comps: CompStats[];
}

function find(parent: Int32Array, a: number): number {
  while (parent[a] !== a) {
    parent[a] = parent[parent[a]];
    a = parent[a];
  }
  return a;
}

function union(parent: Int32Array, a: number, b: number): number {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra === rb) return ra;
  if (ra < rb) {
    parent[rb] = ra;
    return ra;
  }
  parent[ra] = rb;
  return rb;
}

/**
 * Two-pass connected component labelling with union-find.
 * Labels are 1..n in the returned array (0 = background), comps[i] describes label i+1.
 */
export function label(m: Mask, conn8 = true): Labeling {
  const { width: w, height: h, data } = m;
  const labels = new Int32Array(w * h);
  const parent = new Int32Array(Math.floor((w * h) / 2) + 2);
  let next = 1;
  parent[0] = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!data[i]) continue;
      let l = 0;
      let lj = x > 0 ? labels[i - 1] : 0;
      if (lj) l = lj;
      if (y > 0) {
        lj = labels[i - w];
        if (lj) l = l ? (l === lj ? l : union(parent, l, lj)) : lj;
        if (conn8) {
          lj = x > 0 ? labels[i - w - 1] : 0;
          if (lj) l = l ? (l === lj ? l : union(parent, l, lj)) : lj;
          lj = x < w - 1 ? labels[i - w + 1] : 0;
          if (lj) l = l ? (l === lj ? l : union(parent, l, lj)) : lj;
        }
      }
      if (l === 0) {
        if (next >= parent.length) throw new Error('label: too many provisional labels');
        parent[next] = next;
        l = next++;
      }
      labels[i] = l;
    }
  }
  // flatten and compact
  const remap = new Int32Array(next);
  let count = 0;
  for (let l = 1; l < next; l++) {
    const r = find(parent, l);
    if (r === l) remap[l] = ++count;
  }
  for (let l = 1; l < next; l++) remap[l] = remap[find(parent, l)];
  const comps: CompStats[] = [];
  for (let i = 0; i < count; i++) {
    comps.push({ label: i + 1, area: 0, x0: w, y0: h, x1: -1, y1: -1, sumX: 0, sumY: 0 });
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!labels[i]) continue;
      const l = remap[labels[i]];
      labels[i] = l;
      const c = comps[l - 1];
      c.area++;
      c.sumX += x;
      c.sumY += y;
      if (x < c.x0) c.x0 = x;
      if (x > c.x1) c.x1 = x;
      if (y < c.y0) c.y0 = y;
      if (y > c.y1) c.y1 = y;
    }
  }
  return { labels, comps };
}

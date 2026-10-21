import type { Mask } from './types.ts';

/** Zhang-Suen thinning. Returns a new 1px wide skeleton mask. */
export function zhangSuen(m: Mask): Mask {
  const { width: w, height: h } = m;
  const img = new Uint8Array(m.data);
  // clear border so neighbourhood lookups stay in range
  for (let x = 0; x < w; x++) {
    img[x] = 0;
    img[(h - 1) * w + x] = 0;
  }
  for (let y = 0; y < h; y++) {
    img[y * w] = 0;
    img[y * w + w - 1] = 0;
  }
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!img[i]) continue;
          const p2 = img[i - w];
          const p3 = img[i - w + 1];
          const p4 = img[i + 1];
          const p5 = img[i + w + 1];
          const p6 = img[i + w];
          const p7 = img[i + w - 1];
          const p8 = img[i - 1];
          const p9 = img[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const a =
            (+(!p2 && p3) as number) +
            (+(!p3 && p4) as number) +
            (+(!p4 && p5) as number) +
            (+(!p5 && p6) as number) +
            (+(!p6 && p7) as number) +
            (+(!p7 && p8) as number) +
            (+(!p8 && p9) as number) +
            (+(!p9 && p2) as number);
          if (a !== 1) continue;
          if (pass === 0) {
            if (p2 * p4 * p6 !== 0 || p4 * p6 * p8 !== 0) continue;
          } else if (p2 * p4 * p8 !== 0 || p2 * p6 * p8 !== 0) continue;
          del.push(i);
        }
      }
      if (del.length) {
        changed = true;
        for (const i of del) img[i] = 0;
      }
    }
  }
  return { width: w, height: h, data: img };
}

/** Neighbour offsets in cyclic order p2..p9 (N, NE, E, SE, S, SW, W, NW). */
export const ring = (w: number) => [-w, -w + 1, 1, w + 1, w, w - 1, -1, -w - 1];

/** Number of set 8-neighbours. */
export function neighbourCount(sk: Mask, i: number): number {
  const d = sk.data;
  let n = 0;
  for (const o of ring(sk.width)) n += d[i + o];
  return n;
}

/** Crossing number: 0->1 transitions around the 8-neighbourhood (1 = endpoint, 2 = line, >=3 = junction). */
export function crossingNumber(sk: Mask, i: number): number {
  const d = sk.data;
  const r = ring(sk.width);
  let c = 0;
  for (let k = 0; k < 8; k++) {
    if (!d[i + r[k]] && d[i + r[(k + 1) & 7]]) c++;
  }
  return c;
}

export type NodeKind = 0 | 1 | 2; // 0 = path pixel, 1 = endpoint, 2 = junction

export function classify(sk: Mask, i: number): NodeKind {
  if (neighbourCount(sk, i) === 0) return 1;
  const cn = crossingNumber(sk, i);
  if (cn <= 1) return 1;
  if (cn >= 3) return 2;
  return 0;
}

export interface SkeletonGraph {
  endpoints: number;
  junctions: number;
  /** pixel paths between nodes or closed loops, flat [x0,y0,x1,y1,...] */
  paths: number[][];
  length: number;
}

/** Topology and stroke paths of a skeleton (assumes the 1px image border is empty). */
export function skeletonGraph(sk: Mask): SkeletonGraph {
  const { width: w, data } = sk;
  const r = ring(w);
  const n = data.length;
  const kind = new Uint8Array(n);
  let endpoints = 0;
  let length = 0;
  for (let i = 0; i < n; i++) {
    if (!data[i]) continue;
    length++;
    const k = classify(sk, i);
    kind[i] = k + 1; // 1 = path, 2 = endpoint, 3 = junction
    if (k === 1) endpoints += neighbourCount(sk, i) === 0 ? 2 : 1;
  }
  // junction clusters
  const seen = new Uint8Array(n);
  let junctions = 0;
  for (let i = 0; i < n; i++) {
    if (kind[i] !== 3 || seen[i]) continue;
    junctions++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!;
      for (const o of r) {
        const q = j + o;
        if (kind[q] === 3 && !seen[q]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
  }
  const visited = new Uint8Array(n);
  const paths: number[][] = [];
  const trace = (start: number, first: number) => {
    const path = [start % w, (start / w) | 0];
    let prev = start;
    let cur = first;
    for (let guard = 0; guard < n; guard++) {
      path.push(cur % w, (cur / w) | 0);
      if (kind[cur] >= 2 || cur === start) break;
      visited[cur] = 1;
      let nxt = -1;
      // prefer orthogonal steps (even ring indices) so staircases are walked pixel by pixel
      for (let pass = 0; pass < 2 && nxt < 0; pass++) {
        for (let k = pass; k < 8; k += 2) {
          const q = cur + r[k];
          if (q === prev || !data[q]) continue;
          if (kind[q] >= 2 || q === start || !visited[q]) {
            if (q === start && path.length <= 6) continue;
            nxt = q;
            break;
          }
        }
      }
      if (nxt < 0) break;
      prev = cur;
      cur = nxt;
    }
    paths.push(path);
  };
  for (let i = 0; i < n; i++) {
    if (kind[i] < 2) continue;
    for (const o of r) {
      const q = i + o;
      if (kind[q] === 1 && !visited[q]) trace(i, q);
    }
  }
  for (let i = 0; i < n; i++) {
    if (kind[i] !== 1 || visited[i]) continue;
    // closed loop without nodes (e.g. "o"): walk from here back to here
    let first = -1;
    for (const o of r) {
      if (kind[i + o] === 1 && !visited[i + o]) {
        first = i + o;
        break;
      }
    }
    visited[i] = 1;
    if (first >= 0) trace(i, first);
  }
  return { endpoints, junctions, paths, length };
}

/** Removes short spurs: endpoint branches shorter than minLen pixels that end in a junction. */
export function pruneSpurs(sk: Mask, minLen: number, rounds = 2): Mask {
  const out: Mask = { width: sk.width, height: sk.height, data: new Uint8Array(sk.data) };
  const r = ring(sk.width);
  for (let round = 0; round < rounds; round++) {
    let removed = false;
    for (let i = 0; i < out.data.length; i++) {
      if (!out.data[i] || classify(out, i) !== 1 || neighbourCount(out, i) === 0) continue;
      const branch = [i];
      let prev = -1;
      let cur = i;
      let hitJunction = false;
      while (branch.length <= minLen) {
        let nxt = -1;
        for (const o of r) {
          const q = cur + o;
          if (q !== prev && out.data[q] && !branch.includes(q)) {
            nxt = q;
            break;
          }
        }
        if (nxt < 0) break;
        if (classify(out, nxt) === 2) {
          hitJunction = true;
          break;
        }
        branch.push(nxt);
        prev = cur;
        cur = nxt;
      }
      if (hitJunction && branch.length < minLen) {
        for (const q of branch) out.data[q] = 0;
        removed = true;
      }
    }
    if (!removed) break;
  }
  return out;
}

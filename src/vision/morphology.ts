import type { Mask } from './types.ts';
import { label } from './components.ts';
import { mask as newMask } from './image.ts';

/** Binary dilation with a (2r+1)^2 square, separable via running counts. */
export function dilate(m: Mask, r: number): Mask {
  return rankBinary(m, r, true);
}

/** Binary erosion with a (2r+1)^2 square. Pixels outside the image count as background. */
export function erode(m: Mask, r: number): Mask {
  return rankBinary(m, r, false);
}

export function open(m: Mask, r: number): Mask {
  return dilate(erode(m, r), r);
}

export function close(m: Mask, r: number): Mask {
  return erode(dilate(m, r), r);
}

function rankBinary(m: Mask, r: number, isDilate: boolean): Mask {
  const { width: w, height: h, data } = m;
  if (r <= 0) return { width: w, height: h, data: data.slice() };
  const tmp = new Uint8Array(w * h);
  const out = newMask(w, h);
  const k = 2 * r + 1;
  const need = isDilate ? 1 : k;
  // running window sums over a line (pixels outside count as 0)
  const line = (src: Uint8Array, dst: Uint8Array, off: number, stride: number, n: number) => {
    let cnt = 0;
    for (let j = 0; j < r && j < n; j++) cnt += src[off + j * stride];
    for (let j = 0; j < n; j++) {
      const add = j + r;
      if (add < n) cnt += src[off + add * stride];
      const rem = j - r - 1;
      if (rem >= 0) cnt -= src[off + rem * stride];
      dst[off + j * stride] = cnt >= need ? 1 : 0;
    }
  };
  for (let y = 0; y < h; y++) line(data, tmp, y * w, 1, w);
  for (let x = 0; x < w; x++) line(tmp, out.data, x, w, h);
  return out;
}

/** Fills background regions that do not touch the image border. */
export function fillHoles(m: Mask): Mask {
  const { width: w, height: h, data } = m;
  const out = newMask(w, h);
  out.data.fill(1);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!data[i] && out.data[i]) {
      out.data[i] = 0;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return out;
}

/** Number of enclosed background regions (4-connected) with at least minArea pixels. */
export function countHoles(m: Mask, minArea = 1): number {
  const inv = newMask(m.width, m.height);
  for (let i = 0; i < inv.data.length; i++) inv.data[i] = m.data[i] ? 0 : 1;
  const { comps } = label(inv, false);
  let holes = 0;
  for (const c of comps) {
    const touches = c.x0 === 0 || c.y0 === 0 || c.x1 === m.width - 1 || c.y1 === m.height - 1;
    if (!touches && c.area >= minArea) holes++;
  }
  return holes;
}

/** Mean stroke width estimate 2*area/perimeter (perimeter = 4-neighbour boundary edges). */
export function strokeWidth(m: Mask): number {
  const { width: w, height: h, data } = m;
  let area = 0;
  let edges = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!data[i]) continue;
      area++;
      if (x === 0 || !data[i - 1]) edges++;
      if (x === w - 1 || !data[i + 1]) edges++;
      if (y === 0 || !data[i - w]) edges++;
      if (y === h - 1 || !data[i + w]) edges++;
    }
  }
  return edges ? (2 * area) / edges : 0;
}

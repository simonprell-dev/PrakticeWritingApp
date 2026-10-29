// A sheet seen at a slant (tablet with a mirror on its front camera): the four corners the teacher set are
// cut out and straightened, so the recognition gets the paper as if the camera looked straight down.
import { homography, project } from '../vision/cards.ts';
import type { Pt } from '../game/paint/fishCard.ts';
import type { RGBAImage } from '../vision/types.ts';

/** corners in the order top left, top right, bottom right, bottom left */
export type Quad = [Pt, Pt, Pt, Pt];

/** a little inside the picture, so all four handles can be grabbed */
export const DEFAULT_QUAD: Quad = [
  [0.15, 0.15],
  [0.85, 0.15],
  [0.85, 0.85],
  [0.15, 0.85],
];

/** focal length of a usual tablet front camera, in units of the longer side of the picture */
const TYPICAL_FOCAL = 0.8;

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * Width : height of the real rectangle behind a quad in a photo of size w × h (Zhang & He, "Whiteboard
 * scanning and image enhancement", 2007; the optical axis is the centre of the photo). The focal length
 * is estimated from the quad; when that is impossible (sheet square to the camera, as with the mirror:
 * one pair of sides stays parallel) a typical front camera is assumed.
 */
export function quadAspect(q: Quad, w: number, h: number): number {
  const affine = (dist(q[0], q[1]) + dist(q[3], q[2])) / Math.max(1e-6, dist(q[0], q[3]) + dist(q[1], q[2]));
  const u0 = w / 2;
  const v0 = h / 2;
  const m1 = [q[0][0], q[0][1], 1];
  const m2 = [q[1][0], q[1][1], 1];
  const m3 = [q[3][0], q[3][1], 1];
  const m4 = [q[2][0], q[2][1], 1];
  const k2 = dot(cross(m1, m4), m3) / dot(cross(m2, m4), m3);
  const k3 = dot(cross(m1, m4), m2) / dot(cross(m3, m4), m2);
  const n2 = m2.map((v, i) => k2 * v - m1[i]);
  const n3 = m3.map((v, i) => k3 * v - m1[i]);
  if (![...n2, ...n3].every(Number.isFinite)) return affine;
  const typical = (TYPICAL_FOCAL * Math.max(w, h)) ** 2;
  let f2 = typical;
  if (Math.abs(n2[2] * n3[2]) > 1e-9) {
    const est =
      -(
        n2[0] * n3[0] -
        (n2[0] * n3[2] + n2[2] * n3[0]) * u0 +
        n2[2] * n3[2] * u0 * u0 +
        (n2[1] * n3[1] - (n2[1] * n3[2] + n2[2] * n3[1]) * v0 + n2[2] * n3[2] * v0 * v0)
      ) /
      (n2[2] * n3[2]);
    // a focal length far from any real camera means the corners were set loosely
    if (est > typical / 9 && est < typical * 9) f2 = est;
  }
  // n^T (A A^T)^-1 n with A = [f 0 u0; 0 f v0; 0 0 1]
  const norm = (n: number[]) => {
    const x = n[0] - u0 * n[2];
    const y = n[1] - v0 * n[2];
    return (x * x + y * y) / f2 + n[2] * n[2];
  };
  const r = Math.sqrt(norm(n2) / norm(n3));
  return Number.isFinite(r) && r > 0 ? r : affine;
}

/** size of the straightened sheet: its real proportions, at most `maxSide` and not finer than the photo */
export function quadSize(q: Quad, w: number, h: number, maxSide: number): { w: number; h: number } {
  const aspect = quadAspect(q, w, h);
  const longest = Math.max(dist(q[0], q[1]), dist(q[3], q[2]), dist(q[0], q[3]), dist(q[1], q[2]));
  const side = Math.max(32, Math.min(maxSide, Math.round(longest)));
  return aspect >= 1 ? { w: side, h: Math.max(16, Math.round(side / aspect)) } : { w: Math.max(16, Math.round(side * aspect)), h: side };
}

/** Cuts the quad (pixels of `src`) out of the picture and straightens it into ow × oh pixels. */
export function warpQuad(src: RGBAImage, q: Quad, ow: number, oh: number): RGBAImage {
  const H = homography(
    [
      [0, 0],
      [ow, 0],
      [ow, oh],
      [0, oh],
    ],
    q,
  );
  const { width: W, height: Hh, data: d } = src;
  const out = new Uint8ClampedArray(ow * oh * 4);
  for (let ty = 0; ty < oh; ty++) {
    for (let tx = 0; tx < ow; tx++) {
      const [x, y] = project(H, tx + 0.5, ty + 0.5);
      const xf = Math.min(Math.max(x - 0.5, 0), W - 1);
      const yf = Math.min(Math.max(y - 0.5, 0), Hh - 1);
      const x0 = Math.floor(xf);
      const y0 = Math.floor(yf);
      const x1 = Math.min(x0 + 1, W - 1);
      const y1 = Math.min(y0 + 1, Hh - 1);
      const fx = xf - x0;
      const fy = yf - y0;
      const o = (ty * ow + tx) * 4;
      for (let c = 0; c < 3; c++) {
        const a = d[(y0 * W + x0) * 4 + c] * (1 - fx) + d[(y0 * W + x1) * 4 + c] * fx;
        const b = d[(y1 * W + x0) * 4 + c] * (1 - fx) + d[(y1 * W + x1) * 4 + c] * fx;
        out[o + c] = a * (1 - fy) + b * fy;
      }
      out[o + 3] = 255;
    }
  }
  return { width: ow, height: oh, data: out };
}

/** a point of the straightened sheet (0..1) in the picture (0..1): to draw the test scan onto the photo */
export function quadPoint(q: Quad, u: number, v: number): Pt {
  const H = homography(
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    q,
  );
  return project(H, u, v);
}

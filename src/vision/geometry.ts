// Small geometry helpers: convex hull and minimum-area rectangle (rotating calipers over hull edges).

export type Pt = [number, number];

export function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function polygonArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

export interface RotRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  /** radians, normalised to (-pi/4, pi/4] */
  angle: number;
  area: number;
}

export function minAreaRect(hull: Pt[]): RotRect {
  let best: RotRect = { cx: 0, cy: 0, w: 0, h: 0, angle: 0, area: Infinity };
  if (hull.length === 0) return { ...best, area: 0 };
  for (let i = 0; i < hull.length; i++) {
    const [x0, y0] = hull[i];
    const [x1, y1] = hull[(i + 1) % hull.length];
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const c = Math.cos(-ang);
    const s = Math.sin(-ang);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const [x, y] of hull) {
      const u = x * c - y * s;
      const v = x * s + y * c;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    const area = (maxU - minU) * (maxV - minV);
    if (area < best.area) {
      const cu = (minU + maxU) / 2;
      const cv = (minV + maxV) / 2;
      // rotate centre back
      const cx = cu * Math.cos(ang) - cv * Math.sin(ang);
      const cy = cu * Math.sin(ang) + cv * Math.cos(ang);
      best = { cx, cy, w: maxU - minU, h: maxV - minV, angle: ang, area };
    }
  }
  // normalise angle to (-45°, 45°], swapping w/h accordingly
  let a = best.angle;
  let { w, h } = best;
  while (a > Math.PI / 4) {
    a -= Math.PI / 2;
    [w, h] = [h, w];
  }
  while (a <= -Math.PI / 4) {
    a += Math.PI / 2;
    [w, h] = [h, w];
  }
  return { ...best, angle: a, w, h };
}

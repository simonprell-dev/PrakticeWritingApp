// Paper / slip detection on a low resolution copy of the frame.
import { chroma } from './color.ts';
import { label } from './components.ts';
import { convexHull, minAreaRect, polygonArea, type Pt } from './geometry.ts';
import { mask as newMask, resizeArea } from './image.ts';
import { close, erode, fillHoles, open } from './morphology.ts';
import { maxFilter } from './filters.ts';
import { otsu } from './threshold.ts';
import type { Box, Mask, PlayerId, TeamCalib } from './types.ts';

export interface PaperRegion {
  id: number;
  /** detection coordinates */
  box: Box;
  /** rotation of the slip (radians, -45°..45°), 0 for pages */
  angle: number;
  /** centre of the rotated rectangle (detection coordinates) */
  cx: number;
  cy: number;
  /** upright size of the region (detection px) */
  rw: number;
  rh: number;
  team?: PlayerId;
  /** region membership at low resolution */
  lowMask: Mask;
  lowScale: number;
  isSlip: boolean;
}

export interface RegionOptions {
  mode: 'page' | 'slip-color';
  calibs?: TeamCalib[];
}

const LOW = 320;

/** Detects paper regions. Planes are raw RGB (0..255) at detection resolution. */
export function detectRegions(
  planes: [Float32Array, Float32Array, Float32Array],
  w: number,
  h: number,
  opts: RegionOptions,
): PaperRegion[] {
  const s = LOW / Math.max(w, h);
  const lw = Math.max(8, Math.round(w * s));
  const lh = Math.max(8, Math.round(h * s));
  const [r, g, b] = planes.map((p) => resizeArea(p, w, h, lw, lh));
  const scale = w / lw; // low -> detection

  if (opts.mode === 'slip-color' && opts.calibs?.length) {
    const out: PaperRegion[] = [];
    for (const calib of opts.calibs) {
      const m = newMask(lw, lh);
      const [cr, cg, cv] = calib.slip;
      for (let i = 0; i < m.data.length; i++) {
        const c = chroma(r[i], g[i], b[i]);
        const d = Math.hypot(c[0] - cr, c[1] - cg);
        m.data[i] = d < 0.03 && c[2] > cv * 0.45 ? 1 : 0;
      }
      out.push(...regionsFromMask(cleanup(m), scale, calib.team, out.length));
    }
    return out;
  }

  // white paper: bright and unsaturated
  const v = new Float32Array(lw * lh);
  for (let i = 0; i < v.length; i++) v[i] = Math.max(r[i], g[i], b[i]) / 255;
  const t = otsu(v, 0, 1, 128);
  let bright = 0;
  let dark = 0;
  let sumB = 0;
  let sumD = 0;
  for (let i = 0; i < v.length; i++) {
    if (v[i] >= t) {
      bright++;
      sumB += v[i];
    } else {
      dark++;
      sumD += v[i];
    }
  }
  const meanB = bright ? sumB / bright : 1;
  const meanD = dark ? sumD / dark : 0;
  const whole = (): PaperRegion => {
    const m = newMask(lw, lh);
    m.data.fill(1);
    return {
      id: 0,
      box: { x: 0, y: 0, w, h },
      angle: 0,
      cx: w / 2,
      cy: h / 2,
      rw: w,
      rh: h,
      lowMask: m,
      lowScale: scale,
      isSlip: false,
    };
  };
  // paper fills (almost) everything or there is no real contrast to a background
  if (bright / v.length > 0.9 || meanB - meanD < 0.18) return [whole()];
  // locally adaptive: shadowed paper is still much brighter than the table right next to it
  const localMax = maxFilter(v, lw, lh, Math.max(4, Math.round(Math.max(lw, lh) / 10)));
  const m = newMask(lw, lh);
  for (let i = 0; i < v.length; i++) {
    const mx = Math.max(r[i], g[i], b[i]);
    const mn = Math.min(r[i], g[i], b[i]);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    m.data[i] = v[i] >= Math.max(0.6 * t, 0.7 * localMax[i]) && sat < 0.35 ? 1 : 0;
  }
  const regions = regionsFromMask(cleanup(m), scale, undefined, 0);
  return regions.length ? regions : [whole()];
}

function cleanup(m: Mask): Mask {
  return fillHoles(open(close(m, 2), 1));
}

function regionsFromMask(m: Mask, scale: number, team: PlayerId | undefined, idStart: number): PaperRegion[] {
  const { labels, comps } = label(m, true);
  const total = m.width * m.height;
  const out: PaperRegion[] = [];
  for (const c of comps) {
    if (c.area < total * 0.004) continue;
    const cm = newMask(m.width, m.height);
    const pts: Pt[] = [];
    for (let y = c.y0; y <= c.y1; y++) {
      for (let x = c.x0; x <= c.x1; x++) {
        const i = y * m.width + x;
        if (labels[i] !== c.label) continue;
        cm.data[i] = 1;
        const edge =
          x === 0 || y === 0 || x === m.width - 1 || y === m.height - 1 ||
          labels[i - 1] !== c.label || labels[i + 1] !== c.label ||
          labels[i - m.width] !== c.label || labels[i + m.width] !== c.label;
        if (edge) pts.push([x + 0.5, y + 0.5]);
      }
    }
    const hull = convexHull(pts);
    const hullArea = polygonArea(hull);
    const rect = minAreaRect(hull);
    const fill = hullArea > 0 ? c.area / rect.area : 0;
    const touches = c.x0 === 0 || c.y0 === 0 || c.x1 === m.width - 1 || c.y1 === m.height - 1;
    // slips: rectangular, fully visible, smaller than a quarter of the frame
    const isSlip = !touches && fill > 0.8 && c.area < total * 0.25;
    // shrink the membership a little so paper edges and their shadows never count as ink
    const shrink = Math.max(1, Math.round(Math.min(c.x1 - c.x0, c.y1 - c.y0) * 0.03));
    const lowMask = erode(cm, shrink);
    out.push({
      id: idStart + out.length,
      box: { x: c.x0 * scale, y: c.y0 * scale, w: (c.x1 - c.x0 + 1) * scale, h: (c.y1 - c.y0 + 1) * scale },
      angle: isSlip ? rect.angle : 0,
      cx: isSlip ? rect.cx * scale : ((c.x0 + c.x1 + 1) / 2) * scale,
      cy: isSlip ? rect.cy * scale : ((c.y0 + c.y1 + 1) / 2) * scale,
      rw: isSlip ? rect.w * scale : (c.x1 - c.x0 + 1) * scale,
      rh: isSlip ? rect.h * scale : (c.y1 - c.y0 + 1) * scale,
      team,
      lowMask,
      lowScale: scale,
      isSlip,
    });
  }
  return out;
}

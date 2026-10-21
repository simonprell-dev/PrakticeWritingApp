// Full scan: frame -> regions -> ink -> lines -> glyphs -> recognition/score -> team -> dedup.
import type { GlyphFeatures, Recognizer } from '../recog/recognizer.ts';
import { qualityFeatures } from '../recog/quality.ts';
import { buildSkel } from '../recog/templates.ts';
import type { Vec3 } from './color.ts';
import { GlyphMemory, thumbnail, type MemGlyph } from './dedup.ts';
import { clampBox, resizeRGBAToPlanes, sampleBilinear } from './image.ts';
import { inkThresholds, normalisePlanes, type NormPlanes } from './ink.ts';
import { removeRuledLines } from './lines.ts';
import { close, strokeWidth } from './morphology.ts';
import { aspect, CNN_SIZE, cutGlyph, toCnnInput, toQualityMask, toTemplateMask } from './normalize.ts';
import { detectRegions, type PaperRegion } from './paper.ts';
import { findGlyphs } from './segment.ts';
import { absorptionOf, classifyPen } from './team.ts';
import { hysteresis } from './threshold.ts';
import type {
  Box,
  DebugLayers,
  Mask,
  RGBAImage,
  RuledLine,
  ScanResult,
  ScannedGlyph,
  TeamId,
  VisionOptions,
} from './types.ts';

export const DETECT_SIZE = 1280;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

interface Patch {
  w: number;
  h: number;
  ink: Float32Array;
  n: [Float32Array, Float32Array, Float32Array];
  valid: Mask;
  region: PaperRegion;
  toDet: (x: number, y: number) => [number, number];
}

function extractPatch(np: NormPlanes, region: PaperRegion): Patch {
  const W = np.width;
  const H = np.height;
  const low = region.lowMask;
  const lowAt = (x: number, y: number) => {
    const lx = Math.min(low.width - 1, Math.max(0, Math.floor(x / region.lowScale)));
    const ly = Math.min(low.height - 1, Math.max(0, Math.floor(y / region.lowScale)));
    return low.data[ly * low.width + lx];
  };
  if (!region.isSlip || Math.abs(region.angle) < 0.035) {
    const b = clampBox(region.box, W, H);
    const n = b.w * b.h;
    const ink = new Float32Array(n);
    const planes = [new Float32Array(n), new Float32Array(n), new Float32Array(n)] as Patch['n'];
    const valid: Mask = { width: b.w, height: b.h, data: new Uint8Array(n) };
    for (let y = 0; y < b.h; y++) {
      const src = (b.y + y) * W + b.x;
      ink.set(np.ink.subarray(src, src + b.w), y * b.w);
      for (let c = 0; c < 3; c++) planes[c].set(np.n[c].subarray(src, src + b.w), y * b.w);
      for (let x = 0; x < b.w; x++) valid.data[y * b.w + x] = lowAt(b.x + x, b.y + y);
    }
    return { w: b.w, h: b.h, ink, n: planes, valid, region, toDet: (x, y) => [x + b.x, y + b.y] };
  }
  const pw = Math.max(8, Math.round(region.rw));
  const ph = Math.max(8, Math.round(region.rh));
  const cos = Math.cos(region.angle);
  const sin = Math.sin(region.angle);
  const toDet = (x: number, y: number): [number, number] => {
    const u = x - pw / 2;
    const v = y - ph / 2;
    return [region.cx + u * cos - v * sin, region.cy + u * sin + v * cos];
  };
  const n = pw * ph;
  const ink = new Float32Array(n);
  const planes = [new Float32Array(n), new Float32Array(n), new Float32Array(n)] as Patch['n'];
  const valid: Mask = { width: pw, height: ph, data: new Uint8Array(n) };
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      const [dx, dy] = toDet(x + 0.5, y + 0.5);
      const i = y * pw + x;
      if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
      ink[i] = sampleBilinear(np.ink, W, H, dx - 0.5, dy - 0.5);
      for (let c = 0; c < 3; c++) planes[c][i] = sampleBilinear(np.n[c], W, H, dx - 0.5, dy - 0.5);
      valid.data[i] = lowAt(dx, dy);
    }
  }
  return { w: pw, h: ph, ink, n: planes, valid, region, toDet };
}

function detBox(p: Patch, b: Box): Box {
  const pts = [p.toDet(b.x, b.y), p.toDet(b.x + b.w, b.y), p.toDet(b.x, b.y + b.h), p.toDet(b.x + b.w, b.y + b.h)];
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
}

interface PatchGlyph {
  feat: GlyphFeatures;
  crop: RGBAImage;
  thumb: Uint8Array;
  box: Box;
  regionId: number;
  team?: TeamId;
  neutral: boolean;
  dots: number;
  cnn: Float32Array;
}

function flipH(a: Float32Array, size: number): Float32Array {
  const o = new Float32Array(a.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) o[y * size + x] = a[y * size + size - 1 - x];
  return o;
}

function smooth(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function processPatch(
  p: Patch,
  opts: VisionOptions,
  lineSink: RuledLine[],
): { glyphs: PatchGlyph[]; mask: Mask; sw: number } {
  const { w, h } = p;
  const ink = p.ink;
  for (let i = 0; i < ink.length; i++) if (!p.valid.data[i]) ink[i] = 0;
  const th = inkThresholds(ink, opts.pen, p.valid.data);
  let mask = hysteresis(ink, w, h, th.weak, th.strong, 3);
  mask = close(mask, 1);
  const weak: Mask = { width: w, height: h, data: new Uint8Array(w * h) };
  for (let i = 0; i < ink.length; i++) weak.data[i] = ink[i] >= th.weak * 0.8 ? 1 : 0;
  const lr = removeRuledLines(weak, mask, opts.ruled);
  const hLines = lr.lines.filter((l) => l.orientation === 'h').map((l) => l.pos).sort((a, b) => a - b);
  let spacing = 0;
  if (hLines.length >= 2) {
    const diffs = hLines.slice(1).map((v, i) => v - hLines[i]).sort((a, b) => a - b);
    spacing = diffs[diffs.length >> 1];
  }
  lineSink.push(...lr.lines);
  const seg = findGlyphs(lr.mask, p.valid);
  const tanSkew = Math.tan(lr.skew);
  const out: PatchGlyph[] = [];
  for (const g of seg.glyphs) {
    const cnnLabels = new Set(g.dots === 1 ? [...g.baseLabels, ...g.dotLabels] : g.baseLabels);
    const cnnBox = g.dots === 1 ? g.box : g.baseBox;
    const crop = cutGlyph(ink, seg.labels, w, cnnBox, cnnLabels);
    const cnn = toCnnInput(crop);
    const skel = buildSkel(toTemplateMask(crop));
    const quality = qualityFeatures(toQualityMask(crop));
    let baselineDev: number | undefined;
    if (spacing > 0) {
      const cx = g.baseBox.x + g.baseBox.w / 2;
      const bottom = g.baseBox.y + g.baseBox.h;
      let best = Infinity;
      for (const ly of hLines) best = Math.min(best, Math.abs(bottom - (ly + cx * tanSkew)));
      baselineDev = best / spacing;
    }
    const feat: GlyphFeatures = {
      cnn,
      cnnMirror: opts.target ? flipH(cnn, CNN_SIZE) : undefined,
      skel,
      quality,
      aspect: aspect(crop),
      dots: g.dots,
      bodyH: g.baseBox.h,
      baselineDev,
    };

    // all pixels of the glyph (body + dots) for team colour, sticker and thumbnail
    const all = new Set([...g.baseLabels, ...g.dotLabels]);
    const pad = 3;
    const bx = Math.max(0, g.box.x - pad);
    const by = Math.max(0, g.box.y - pad);
    const bw = Math.min(w, g.box.x + g.box.w + pad) - bx;
    const bh = Math.min(h, g.box.y + g.box.h + pad) - by;
    const idx: number[] = [];
    const member = new Uint8Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const i = (by + y) * w + bx + x;
        if (all.has(seg.labels[i])) {
          member[y * bw + x] = 1;
          idx.push(i);
        }
      }
    }
    const sticker: RGBAImage = { width: bw, height: bh, data: new Uint8ClampedArray(bw * bh * 4) };
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let near = 0;
        for (let dy = -1; dy <= 1 && !near; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && member[yy * bw + xx]) {
              near = 1;
              break;
            }
          }
        }
        if (!near) continue;
        const i = (by + y) * w + bx + x;
        const o = (y * bw + x) * 4;
        sticker.data[o] = Math.min(255, p.n[0][i] * 235);
        sticker.data[o + 1] = Math.min(255, p.n[1][i] * 235);
        sticker.data[o + 2] = Math.min(255, p.n[2][i] * 235);
        sticker.data[o + 3] = Math.round(255 * smooth(th.weak * 0.6, th.strong * 1.4, ink[i]));
      }
    }
    let team: TeamId | undefined;
    let neutral = false;
    if (opts.team) {
      if (opts.team.by === 'slip') team = p.region.team;
      else {
        const dec = classifyPen(absorptionOf(p.n, ink, idx), opts.team.calibs);
        team = dec.team;
        neutral = dec.neutral;
      }
      if (!team) neutral = true;
    }
    out.push({
      feat,
      crop: sticker,
      thumb: thumbnail(member, bw, bh),
      box: detBox(p, g.box),
      regionId: p.region.id,
      team,
      neutral,
      dots: g.dots,
      cnn,
    });
  }
  return { glyphs: out, mask: lr.mask, sw: seg.strokeWidth || strokeWidth(lr.mask) };
}

export interface ScanDeps {
  recognizer: Recognizer;
  memory: GlyphMemory;
}

let glyphCounter = 1;

export function runScan(frame: RGBAImage, opts: VisionOptions, deps: ScanDeps): ScanResult {
  const timings: Record<string, number> = {};
  let t = now();
  const lap = (name: string) => {
    const n = now();
    timings[name] = Math.round(n - t);
    t = n;
  };
  const scale = Math.min(1, DETECT_SIZE / Math.max(frame.width, frame.height));
  const dw = Math.max(1, Math.round(frame.width * scale));
  const dh = Math.max(1, Math.round(frame.height * scale));
  const planes = resizeRGBAToPlanes(frame, dw, dh);
  lap('resize');
  let r = Math.max(4, Math.round(Math.max(dw, dh) / 160));
  let np = normalisePlanes(planes, dw, dh, r);
  lap('ink');
  const regions = detectRegions(planes, dw, dh, {
    mode: opts.team?.by === 'slip' ? 'slip-color' : 'page',
    calibs: opts.team?.calibs,
  });
  lap('regions');

  let glyphs: PatchGlyph[] = [];
  let lines: RuledLine[] = [];
  const masks: { p: Patch; mask: Mask }[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    glyphs = [];
    lines = [];
    masks.length = 0;
    let maxSw = 0;
    for (const reg of regions) {
      const p = extractPatch(np, reg);
      const res = processPatch(p, opts, lines);
      glyphs.push(...res.glyphs);
      masks.push({ p, mask: res.mask });
      if (res.glyphs.length) maxSw = Math.max(maxSw, res.sw);
    }
    // very thick strokes (marker, zoomed camera): background radius must exceed the stroke
    if (attempt === 0 && maxSw > 1.2 * r) {
      r = Math.ceil(maxSw * 1.3);
      np = normalisePlanes(planes, dw, dh, r);
      continue;
    }
    break;
  }
  lap('segment');

  const scores = deps.recognizer.scoreScan(
    glyphs.map((g) => g.feat),
    { target: opts.target, strictness: opts.strictness, style: opts.style },
  );
  lap('recognize');

  const mem: MemGlyph[] = glyphs.map((g) => ({ box: g.box, thumb: g.thumb }));
  const match = deps.memory.match(mem);
  deps.memory.commit(mem, match);
  lap('dedup');

  const out: ScannedGlyph[] = glyphs.map((g, i) => ({
    id: glyphCounter++,
    box: g.box,
    regionId: g.regionId,
    team: g.neutral ? undefined : g.team,
    dots: g.dots,
    crop: g.crop,
    score: scores[i],
    isNew: match.isNew[i],
  }));

  let debug: DebugLayers | undefined;
  if (opts.debug) {
    const full: Mask = { width: dw, height: dh, data: new Uint8Array(dw * dh) };
    for (const { p, mask } of masks) {
      for (let y = 0; y < p.h; y++) {
        for (let x = 0; x < p.w; x++) {
          if (!mask.data[y * p.w + x]) continue;
          const [X, Y] = p.toDet(x + 0.5, y + 0.5);
          const xi = Math.floor(X);
          const yi = Math.floor(Y);
          if (xi >= 0 && yi >= 0 && xi < dw && yi < dh) full.data[yi * dw + xi] = 1;
        }
      }
    }
    debug = {
      ink: { width: dw, height: dh, data: np.ink },
      mask: full,
      lines,
      cnnInputs: glyphs.map((g) => g.cnn),
    };
  }
  timings.total = Object.values(timings).reduce((a, b) => a + b, 0);
  return {
    frameW: frame.width,
    frameH: frame.height,
    scale: 1 / scale,
    regions: regions.map((reg) => ({ id: reg.id, box: reg.box, team: reg.team })),
    glyphs: out,
    shift: match.shift,
    newSheet: match.newSheet,
    duplicates: out.filter((g) => !g.isNew).length,
    neutral: glyphs.filter((g) => g.neutral).length,
    timings,
    debug,
  };
}

/** Pen calibration: mean absorption direction of the ink in the centre of the frame. */
export function calibratePen(frame: RGBAImage): { absorb: Vec3; pixels: number } {
  const scale = Math.min(1, 640 / Math.max(frame.width, frame.height));
  const dw = Math.round(frame.width * scale);
  const dh = Math.round(frame.height * scale);
  const planes = resizeRGBAToPlanes(frame, dw, dh);
  const np = normalisePlanes(planes, dw, dh, Math.max(4, Math.round(Math.max(dw, dh) / 160)));
  const idx: number[] = [];
  for (let y = Math.round(dh * 0.2); y < dh * 0.8; y++) {
    for (let x = Math.round(dw * 0.2); x < dw * 0.8; x++) {
      const i = y * dw + x;
      if (np.ink[i] > 0.2) idx.push(i);
    }
  }
  return { absorb: absorptionOf(np.n, np.ink, idx), pixels: idx.length };
}

/** Slip calibration: median colour of the paper (non-ink pixels) in the centre of the frame. */
export function calibrateSlip(frame: RGBAImage): { rgb: Vec3 } {
  const { width: w, height: h, data } = frame;
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  const step = Math.max(1, Math.round(Math.min(w, h) / 200));
  for (let y = Math.round(h * 0.35); y < h * 0.65; y += step) {
    for (let x = Math.round(w * 0.35); x < w * 0.65; x += step) {
      const o = (y * w + x) * 4;
      rs.push(data[o]);
      gs.push(data[o + 1]);
      bs.push(data[o + 2]);
    }
  }
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1] ?? 0;
  return { rgb: [med(rs), med(gs), med(bs)] };
}

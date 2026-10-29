// Full scan: frame -> regions -> ink -> lines -> glyphs -> known glyphs -> recognition/score of the new ones.
// Children keep writing on the same sheet: glyphs from earlier scans are recognised again only by their
// position and thumbnail and keep their first result; only new handwriting goes through the recognition.
import type { Analysis, GlyphFeatures, Recognizer } from '../recog/recognizer.ts';
import { qualityFeatures } from '../recog/quality.ts';
import { buildSkel } from '../recog/templates.ts';
import type { Vec3 } from './color.ts';
import { GlyphMemory, thumbnail, type MatchResult, type MemGlyph } from './dedup.ts';
import { clampBox, resizeRGBAToPlanes, sampleBilinear } from './image.ts';
import type { Zone } from '../recog/classes.ts';
import { inkThresholds, normalisePlanes, shearShift, type NormPlanes } from './ink.ts';
import { lineModel, removeRuledLines, type LineModel } from './lines.ts';
import { close, strokeWidth } from './morphology.ts';
import { aspect, CNN_SIZE, cutGlyph, toCnnInput, toQualityMask, toTemplateMask, type GlyphCrop } from './normalize.ts';
import { detectRegions, type PaperRegion } from './paper.ts';
import { findGlyphs } from './segment.ts';
import { absorptionOf, classifyPen } from './team.ts';
import { hysteresis } from './threshold.ts';
import type {
  Box,
  DebugLayers,
  Mask,
  PlayerId,
  RGBAImage,
  RuledLine,
  ScanResult,
  ScannedGlyph,
  VisionOptions,
} from './types.ts';

import { DETECT_SIZE } from './constants.ts';

export { DETECT_SIZE };

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

/** Everything the recognition of one glyph needs (serialisable, can go to another worker). */
export interface GlyphJob {
  crop: GlyphCrop;
  dots: number;
  bodyH: number;
  baselineDev?: number;
  /** position in the school lines (bands above/below the base line) */
  zone?: Zone;
  /** also evaluate the mirrored glyph (mirror writing check) */
  mirror: boolean;
}

/** Heavy per-glyph feature extraction (CNN input, skeleton, stroke quality). */
export function featuresOf(job: GlyphJob): GlyphFeatures {
  const cnn = toCnnInput(job.crop);
  return {
    cnn,
    cnnMirror: job.mirror ? flipH(cnn, CNN_SIZE) : undefined,
    skel: buildSkel(toTemplateMask(job.crop)),
    quality: qualityFeatures(toQualityMask(job.crop)),
    aspect: aspect(job.crop),
    dots: job.dots,
    bodyH: job.bodyH,
    baselineDev: job.baselineDev,
    zone: job.zone,
  };
}

interface PatchGlyph {
  job: GlyphJob;
  crop: RGBAImage;
  thumb: Uint8Array;
  box: Box;
  /** the letter body without dots (detection coordinates) */
  body: Box;
  regionId: number;
  team?: PlayerId;
  neutral: boolean;
  dots: number;
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

/**
 * The child's letter as a transparent cut-out for the creatures. Pencil and light pens come out pale on
 * camera, so the ink is strengthened: its colour (absorption per channel) is scaled until the strongest
 * strokes are deep, faint edge pixels take the letter's own colour, the opacity is measured against the
 * letter's own strongest ink, and lines that are thin for the letter's size get a little bolder.
 */
function inkSticker(p: Patch, member: Uint8Array, idx: number[], bx: number, by: number, bw: number, bh: number): RGBAImage {
  const { w } = p;
  const ink = p.ink;
  const absorb = (i: number, c: number) => Math.max(0, 1 - p.n[c][i]);
  // strongest ink of this letter (90th percentile, robust against single dark specks)
  const strength = idx.map((i) => ink[i]).sort((a, b) => a - b);
  const top = strength[Math.floor(strength.length * 0.9)] ?? 0;
  // the letter's colour: mean absorption of its strong pixels
  const col = [0, 0, 0];
  let cnt = 0;
  for (const i of idx) {
    if (ink[i] < top * 0.6) continue;
    for (let c = 0; c < 3; c++) col[c] += absorb(i, c);
    cnt++;
  }
  if (cnt) for (let c = 0; c < 3; c++) col[c] /= cnt;
  const aMax = Math.max(col[0], col[1], col[2]);
  // the strongest channel of the mean ink colour becomes 90 % absorption
  const gain = aMax > 0.02 ? Math.min(4, Math.max(1, 0.9 / aMax)) : 1;

  // stroke width ≈ 2 · area / outline length; aim for about a tenth of the letter size
  let edge = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const k = y * bw + x;
      if (member[k] && (x === 0 || y === 0 || x === bw - 1 || y === bh - 1 || !member[k - 1] || !member[k + 1] || !member[k - bw] || !member[k + bw])) edge++;
    }
  }
  const stroke = edge ? (2 * idx.length) / edge : 0;
  const bold = Math.max(0, Math.min(2, Math.round((0.09 * Math.max(bw, bh) - stroke) / 2)));

  // opacity next to the letter (one pixel of soft edge), then widened for thin lines
  const alpha = new Float32Array(bw * bh);
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < bw && yy < bh && member[yy * bw + xx]) {
            near = true;
            break;
          }
        }
      }
      if (near) alpha[y * bw + x] = smooth(top * 0.08, top * 0.4, ink[(by + y) * w + bx + x]);
    }
  }
  const wide = bold ? new Float32Array(bw * bh) : alpha;
  if (bold) {
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        let m = 0;
        for (let dy = -bold; dy <= bold; dy++) {
          for (let dx = -bold; dx <= bold; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            // round pen: leave out the corners of the bigger square
            if (xx < 0 || yy < 0 || xx >= bw || yy >= bh || dx * dx + dy * dy > bold * bold + 1) continue;
            m = Math.max(m, alpha[yy * bw + xx]);
          }
        }
        wide[y * bw + x] = m;
      }
    }
  }

  const sticker: RGBAImage = { width: bw, height: bh, data: new Uint8ClampedArray(bw * bh * 4) };
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const k = y * bw + x;
      if (!wide[k]) continue;
      const i = (by + y) * w + bx + x;
      const o = k * 4;
      // core pixels keep their own (strengthened) colour, faint edges take the letter's colour
      const own = smooth(top * 0.3, top * 0.75, ink[i]);
      for (let c = 0; c < 3; c++) {
        const a = Math.min(0.95, gain * ((1 - own) * col[c] + own * absorb(i, c)));
        sticker.data[o + c] = Math.round(255 * (1 - a));
      }
      sticker.data[o + 3] = Math.round(255 * wide[k]);
    }
  }
  return sticker;
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
    let baselineDev: number | undefined;
    if (spacing > 0) {
      const cx = g.baseBox.x + g.baseBox.w / 2;
      const bottom = g.baseBox.y + g.baseBox.h;
      let best = Infinity;
      for (const ly of hLines) best = Math.min(best, Math.abs(bottom - (ly + cx * tanSkew)));
      baselineDev = best / spacing;
    }
    const job: GlyphJob = { crop, dots: g.dots, bodyH: g.baseBox.h, baselineDev, mirror: true };

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
    const sticker = inkSticker(p, member, idx, bx, by, bw, bh);
    let team: PlayerId | undefined;
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
      job,
      crop: sticker,
      thumb: thumbnail(member, bw, bh),
      box: detBox(p, g.box),
      body: detBox(p, g.baseBox),
      regionId: p.region.id,
      team,
      neutral,
      dots: g.dots,
    });
  }
  return { glyphs: out, mask: lr.mask, sw: seg.strokeWidth || strokeWidth(lr.mask) };
}

/**
 * Where every letter sits in the line system (school lines: bands; plain ruled paper: base line).
 * Returns the glyphs in reading order along the writing rows (a g or p belongs to its row, too).
 */
function applyLines(glyphs: PatchGlyph[], m: LineModel, w: number): PatchGlyph[] {
  const t = Math.tan(m.skew);
  const row = new Map<PatchGlyph, number>();
  for (const g of glyphs) {
    const sh = shearShift(g.body.x + g.body.w / 2, w, t);
    const top = g.body.y - sh;
    const bottom = g.body.y + g.body.h - sh;
    const nearest = (list: number[]) => list.reduce((best, l) => (Math.abs(bottom - l) < Math.abs(bottom - best) ? l : best), list[0]);
    if (m.kind === 'plain') {
      g.job.baselineDev = Math.abs(bottom - nearest(m.lines)) / m.unit;
      continue;
    }
    // the base line of this letter's row lies below its top
    const known = m.bases.filter((b) => b > top + 0.3 * m.unit);
    const base = nearest(known.length ? known : m.lines);
    g.job.zone = { top: (base - top) / m.unit, bottom: (bottom - base) / m.unit, ambiguous: !known.length };
    g.job.baselineDev = undefined;
    if (known.length) row.set(g, base);
  }
  if (row.size !== glyphs.length) return glyphs;
  return [...glyphs].sort((a, b) => row.get(a)! - row.get(b)! || a.body.x - b.body.x);
}

export interface ScanDeps {
  recognizer: Recognizer;
  memory: GlyphMemory;
}

let glyphCounter = 1;

/** Result of phase 1 (image analysis) – kept in the worker until the glyphs are recognised. */
export interface FrameSegmentation {
  frame: { width: number; height: number };
  scale: number;
  dw: number;
  dh: number;
  regions: PaperRegion[];
  glyphs: PatchGlyph[];
  lines: RuledLine[];
  masks: { p: Patch; mask: Mask }[];
  ink: Float32Array;
  timings: Record<string, number>;
  /** set by matchKnown(): which glyphs are known from earlier scans */
  match?: MatchResult;
}

function timer() {
  const timings: Record<string, number> = {};
  let t = now();
  return {
    timings,
    lap(name: string) {
      const n = now();
      timings[name] = (timings[name] ?? 0) + Math.round(n - t);
      t = n;
    },
  };
}

/** Phase 1: paper, ink, lines, segmentation – produces one job per glyph. */
export function segmentFrame(frame: RGBAImage, opts: VisionOptions): FrameSegmentation {
  const tm = timer();
  const scale = Math.min(1, DETECT_SIZE / Math.max(frame.width, frame.height));
  const dw = Math.max(1, Math.round(frame.width * scale));
  const dh = Math.max(1, Math.round(frame.height * scale));
  const planes = resizeRGBAToPlanes(frame, dw, dh);
  tm.lap('resize');
  let r = Math.max(4, Math.round(Math.max(dw, dh) / 107));
  // a written page may have school lines or a coloured middle band: look along the rows as well
  const rows = opts.team?.by !== 'slip' && opts.ruled !== 'off';
  let np = normalisePlanes(planes, dw, dh, r, rows);
  tm.lap('ink');
  const regions = detectRegions(planes, dw, dh, {
    mode: opts.team?.by === 'slip' ? 'slip-color' : 'page',
    calibs: opts.team?.calibs,
  });
  tm.lap('regions');
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
      np = normalisePlanes(planes, dw, dh, r, rows);
      continue;
    }
    break;
  }
  tm.lap('segment');
  if (np.rows) {
    const model = lineModel(np.rows.profile, np.rows.pad, np.rows.skew, opts.lineatur ?? 'auto', glyphs.map((g) => g.body.h));
    if (model.kind !== 'none') glyphs = applyLines(glyphs, model, dw);
    tm.lap('lines');
  }
  return { frame: { width: frame.width, height: frame.height }, scale, dw, dh, regions, glyphs, lines, masks, ink: np.ink, timings: tm.timings };
}

/** a glyph needs the recognition unless an earlier scan already recognised it */
function needsAnalysis(m: MatchResult, i: number): boolean {
  return m.isNew[i] || !m.matched[i]?.known;
}

/**
 * Phase 1b: finds the glyphs that are known from earlier scans (cheap: position + 16x16 thumbnail,
 * the paper may have moved). Returns the jobs of the glyphs that still need the recognition.
 */
export function matchKnown(seg: FrameSegmentation, memory: GlyphMemory): GlyphJob[] {
  seg.match = memory.match(seg.glyphs.map((g) => ({ box: g.box, thumb: g.thumb, dots: g.dots })));
  const m = seg.match;
  return seg.glyphs.filter((_, i) => needsAnalysis(m, i)).map((g) => g.job);
}

/** Phase 2 for a list of glyph jobs (any worker). */
export function analyzeJobs(jobs: GlyphJob[], opts: VisionOptions, recognizer: Recognizer): Analysis[] {
  return jobs.map((job) => {
    const f = featuresOf(job);
    const a = recognizer.analyze(f, { target: opts.target, bonus: opts.bonus, strictness: opts.strictness, style: opts.style });
    if (opts.debug) a.cnn = f.cnn;
    return a;
  });
}

/**
 * Phase 3: scan-wide scoring (size consistency, case), duplicates, result. `analyses` belong to the jobs
 * returned by matchKnown(); known glyphs keep their stored result and are the context for the new ones.
 */
export function finishScan(
  seg: FrameSegmentation,
  analyses: Analysis[],
  opts: VisionOptions,
  deps: ScanDeps,
  extraTimings: Record<string, number> = {},
): ScanResult {
  const tm = timer();
  const glyphs = seg.glyphs;
  // without matchKnown() the caller has analysed every glyph
  const matchedBefore = !!seg.match;
  const match = seg.match ?? deps.memory.match(glyphs.map((g) => ({ box: g.box, thumb: g.thumb, dots: g.dots })));
  const fresh = glyphs.map((_, i) => !matchedBefore || needsAnalysis(match, i));
  let k = 0;
  // stored analyses are copied: the scan-wide scoring adjusts them
  const all = glyphs.map((_, i) => (fresh[i] ? analyses[k++] : structuredClone(match.matched[i]!.known!.analysis)));
  const scores = deps.recognizer.finalize(all, { target: opts.target, strictness: opts.strictness, style: opts.style, noMirror: opts.noMirror });
  // the setting may have changed since a known glyph was scored
  const final = glyphs.map((_, i) => {
    const s = fresh[i] ? scores[i] : match.matched[i]!.known!.score;
    return { ...s, rejected: (opts.noMirror && s.mirrored) || undefined };
  });
  const mem: MemGlyph[] = glyphs.map((g, i) => {
    if (!fresh[i]) return { box: g.box, thumb: g.thumb, dots: g.dots };
    const { cnn: _debugOnly, ...analysis } = all[i];
    return { box: g.box, thumb: g.thumb, dots: g.dots, known: { analysis: structuredClone(analysis), score: final[i] } };
  });
  // a known glyph without a stored result (cannot happen in the app) gets it now
  match.matched.forEach((m, i) => {
    if (m && !m.known) m.known = mem[i].known;
  });
  deps.memory.commit(mem, match);
  tm.lap('dedup');
  const out: ScannedGlyph[] = glyphs.map((g, i) => ({
    id: glyphCounter++,
    box: g.box,
    regionId: g.regionId,
    team: g.neutral ? undefined : g.team,
    dots: g.dots,
    crop: g.crop,
    score: final[i],
    isNew: match.isNew[i],
  }));
  let debug: DebugLayers | undefined;
  if (opts.debug) {
    const { dw, dh } = seg;
    const full: Mask = { width: dw, height: dh, data: new Uint8Array(dw * dh) };
    for (const { p, mask } of seg.masks) {
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
      ink: { width: dw, height: dh, data: seg.ink },
      mask: full,
      lines: seg.lines,
      cnnInputs: all.map((x) => x.cnn ?? new Float32Array(784)),
    };
  }
  const timings: Record<string, number> = { ...seg.timings, ...extraTimings, ...tm.timings };
  timings.total = Object.entries(timings)
    .filter(([k]) => k !== 'total')
    .reduce((acc, [, v]) => acc + v, 0);
  return {
    frameW: seg.frame.width,
    frameH: seg.frame.height,
    scale: 1 / seg.scale,
    regions: seg.regions.map((reg) => ({ id: reg.id, box: reg.box, team: reg.team })),
    glyphs: out,
    shift: match.shift,
    newSheet: match.newSheet,
    duplicates: out.filter((g) => !g.isNew).length,
    analyzed: analyses.length,
    neutral: glyphs.filter((g) => g.neutral).length,
    timings,
    debug,
  };
}

/** All phases in one thread (tests, lab, single worker). */
export function runScan(frame: RGBAImage, opts: VisionOptions, deps: ScanDeps): ScanResult {
  const seg = segmentFrame(frame, opts);
  const jobs = matchKnown(seg, deps.memory);
  const t0 = now();
  const analyses = analyzeJobs(jobs, opts, deps.recognizer);
  return finishScan(seg, analyses, opts, deps, { recognize: Math.round(now() - t0) });
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

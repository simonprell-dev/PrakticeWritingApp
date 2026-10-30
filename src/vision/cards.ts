// Finds the colouring cards of the Mal-Aquarium in a camera frame. The thick black frame gives the four
// corners (its outer edge, or its inner edge when the card lies on a dark table), the printed lines tell
// which animal is on the card and which way up it lies. The card is then cut out straight (homography) at a
// fixed resolution and its colours are evened out against the white paper.
import { CARD, CARD_PX, FREEFORM, insidePolygon, LABELS, lineSamples, onAnimal, toCard, type LineSample } from '../game/paint/fishCard.ts';
import { freeformMask, freeformShare } from '../game/paint/freeform.ts';
import { labelsFor } from '../game/paint/sheets.ts';
import { ANIMALS, SPECIES, type SpeciesId } from '../game/paint/species.ts';
import { label } from './components.ts';
import { boxBlur, maxFilter } from './filters.ts';
import { convexHull, polygonArea, type Pt } from './geometry.ts';
import { sampleBilinear } from './image.ts';
import type { Mask, RGBAImage } from './types.ts';

export interface CardHit {
  /** the animal on the card */
  species: SpeciesId;
  /** corners of the card's outer frame edge in frame px: top-left, top-right, bottom-right, bottom-left */
  quad: Pt[];
  /** the card cut out straight: CARD_PX px per mm, colours evened out */
  image: RGBAImage;
  /** how clearly the printed lines of the animal were found (contrast, about 0.1 .. 0.8) */
  match: number;
  /** share of the animal that is coloured in (0..1) */
  colored: number;
  /** 12 × 8 RGB means (0..1) over the animal, to recognise a card again */
  thumb: number[];
  /** the free-form card: its drawing (1 per texture px), made once here so the sprite does not make it again */
  mask?: Uint8Array;
}

export interface CardScan {
  frameW: number;
  frameH: number;
  cards: CardHit[];
  /** frames found whose animal was not clear (covered, bent, blurred); they are not in `cards` */
  unsure: number;
  ms: number;
}

/** 3 × 3 homography, row-major */
type Homography = number[];

const DETECT = 1280;
/** a black frame pixel is this much darker than the paper around it */
const DARK = 0.42;
const MIN_MATCH = 0.1;
/** below this not even one animal shows a little: plain paper (the dark table makes its frame), no card */
const NOT_A_CARD = 0.04;
/** the best animal must beat the second best (another animal) by this much */
const MARGIN = 0.04;
/** every animal is first scored on every n-th sample; only the best few are scored in full */
const COARSE = 4;
const FULL = 3;
/** poses whose animal score is this close to the best one are told apart by the printed texts (symmetric animals) */
const TIE = 0.1;
export const THUMB_W = 12;
export const THUMB_H = 8;

/** Homography that maps the four src points onto the four dst points. */
export function homography(src: Pt[], dst: Pt[]): Homography {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i];
    const [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gauss-Jordan with partial pivoting
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c] || 1e-12;
    for (let k = c; k < 9; k++) A[c][k] /= d;
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c];
      if (!f) continue;
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [A[0][8], A[1][8], A[2][8], A[3][8], A[4][8], A[5][8], A[6][8], A[7][8], 1];
}

export function project(H: Homography, x: number, y: number): Pt {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/** the four corners of a hull that span the largest quadrilateral (a rectangle seen in perspective) */
export function quadOf(hull: Pt[]): Pt[] | null {
  const n = hull.length;
  if (n < 4) return null;
  let ia = 0;
  let ib = 0;
  let best = -1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = (hull[i][0] - hull[j][0]) ** 2 + (hull[i][1] - hull[j][1]) ** 2;
      if (d > best) {
        best = d;
        ia = i;
        ib = j;
      }
    }
  }
  const [ax, ay] = hull[ia];
  const [bx, by] = hull[ib];
  let pos = -1;
  let neg = -1;
  let dPos = 0;
  let dNeg = 0;
  for (let i = 0; i < n; i++) {
    const s = (bx - ax) * (hull[i][1] - ay) - (by - ay) * (hull[i][0] - ax);
    if (s > dPos) {
      dPos = s;
      pos = i;
    } else if (-s > dNeg) {
      dNeg = -s;
      neg = i;
    }
  }
  if (pos < 0 || neg < 0) return null;
  const quad = [hull[ia], hull[pos], hull[ib], hull[neg]];
  // clockwise on screen (y down), starting anywhere
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4;
  const cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  return quad.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}

function cornerAnglesOk(q: Pt[]): boolean {
  for (let i = 0; i < 4; i++) {
    const p = q[(i + 3) % 4];
    const c = q[i];
    const n = q[(i + 1) % 4];
    const a = Math.atan2(p[1] - c[1], p[0] - c[0]) - Math.atan2(n[1] - c[1], n[0] - c[0]);
    const deg = Math.abs(((((a * 180) / Math.PI) % 360) + 540) % 360 - 180);
    if (deg < 50 || deg > 130) return false;
  }
  return true;
}

/** outer corners of every boundary row of a component, for its hull */
function boundary(labels: Int32Array, w: number, l: number, c: { x0: number; x1: number; y0: number; y1: number }): Pt[] {
  const pts: Pt[] = [];
  for (let y = c.y0; y <= c.y1; y++) {
    const row = y * w;
    let x0 = -1;
    for (let x = c.x0; x <= c.x1; x++) {
      if (labels[row + x] === l) {
        x0 = x;
        break;
      }
    }
    if (x0 < 0) continue;
    let x1 = x0;
    for (let x = c.x1; x > x0; x--) {
      if (labels[row + x] === l) {
        x1 = x;
        break;
      }
    }
    // pixel corners, so the hull is the true outline
    pts.push([x0, y], [x0, y + 1], [x1 + 1, y], [x1 + 1, y + 1]);
  }
  return pts;
}

interface Candidate {
  quad: Pt[];
  /** the quad is the inner edge of the frame (found from the white area inside) */
  inner: boolean;
}

function candidates(m: Mask, inner: boolean, minSide: number): Candidate[] {
  const { width: w, height: h } = m;
  let lab;
  try {
    lab = label(m, !inner);
  } catch {
    return [];
  }
  const out: Candidate[] = [];
  for (const c of lab.comps) {
    const bw = c.x1 - c.x0 + 1;
    const bh = c.y1 - c.y0 + 1;
    if (bw < minSide || bh < minSide) continue;
    if (c.x0 === 0 || c.y0 === 0 || c.x1 === w - 1 || c.y1 === h - 1) continue;
    // a frame is thin, the white area inside is large; both are at least a bit of their box
    if (c.area < (inner ? 0.15 : 0.04) * bw * bh) continue;
    const hull = convexHull(boundary(lab.labels, w, c.label, c));
    const quad = quadOf(hull);
    if (!quad) continue;
    const qa = polygonArea(quad);
    if (qa < 0.92 * polygonArea(hull) || !cornerAnglesOk(quad)) continue;
    const sides = quad.map((p, i) => Math.hypot(p[0] - quad[(i + 1) % 4][0], p[1] - quad[(i + 1) % 4][1]));
    if (Math.min(...sides) < minSide) continue;
    // opposite sides of a card seen from above are about the same length; its aspect is close to 1
    if (Math.max(sides[0], sides[2]) > 1.6 * Math.min(sides[0], sides[2]) || Math.max(sides[1], sides[3]) > 1.6 * Math.min(sides[1], sides[3])) continue;
    const asp = (sides[0] + sides[2]) / (sides[1] + sides[3]);
    if (asp < 0.6 || asp > 1.65) continue;
    out.push({ quad, inner });
  }
  return out;
}

const SPECIES_IDS: SpeciesId[] = [...ANIMALS, 'freiform'];
const samples = new Map<SpeciesId, { full: LineSample[]; coarse: LineSample[] }>();

/** the printed line samples of an animal, all of them and every COARSE-th one (made once) */
function samplesOf(sp: SpeciesId): { full: LineSample[]; coarse: LineSample[] } {
  let out = samples.get(sp);
  if (!out) {
    const full = lineSamples(sp, 1);
    out = { full, coarse: full.filter((_, i) => i % COARSE === 0) };
    samples.set(sp, out);
  }
  return out;
}

let labelLines: LineSample[] | null = null;

/**
 * What every card prints on one side only: the right end of the name line, and the middle of the hint (top
 * right) and of the name text (bottom left) as lines darker than the paper above and below them. A crab is the
 * same mirrored; these are not.
 */
function labelSamples(): LineSample[] {
  if (labelLines) return labelLines;
  const out: LineSample[] = [];
  const row = (x0: number, x1: number, y: number) => {
    for (let x = x0 + 0.5; x < x1; x += 1) out.push({ x, y, nx: 0, ny: 1 });
  };
  const { hint, name, line } = LABELS;
  row(line.x1 - 28, line.x1, line.y);
  row(hint.x - 30, hint.x - 1, hint.y - hint.size * 0.35);
  row(name.x + 1, name.x + 24, name.y - 3.0 * 0.35);
  labelLines = out;
  return out;
}

/** the area (card mm) that is coloured in: around the animal, or the free space of the free-form card (above its name) */
function paintBox(sp: SpeciesId): { x0: number; y0: number; x1: number; y1: number } {
  if (sp === 'freiform') return { x0: CARD.frame + 3, y0: FREEFORM.hintBox.y + FREEFORM.hintBox.h + 2, x1: CARD.w - CARD.frame - 3, y1: labelsFor('freiform').nameBox.y - 3.5 };
  const { box } = SPECIES[sp];
  const [x0, y0] = toCard(sp, box.x0, box.y0);
  const [x1, y1] = toCard(sp, box.x1, box.y1);
  return { x0, y0, x1, y1 };
}

const colourPts = new Map<SpeciesId, Pt[]>();

/** points (card mm) on the colourable animal, away from the printed lines and the eyes (not the free-form card) */
function colourPoints(sp: SpeciesId): Pt[] {
  let pts = colourPts.get(sp);
  if (pts) return pts;
  const def = SPECIES[sp];
  const lines = samplesOf(sp).full;
  const b = paintBox(sp);
  const step = 1.5;
  pts = [];
  for (let cy = b.y0; cy <= b.y1; cy += step) {
    for (let cx = b.x0; cx <= b.x1; cx += step) {
      const x = (cx - def.place.x) / def.place.s;
      const y = (cy - def.place.y) / def.place.s;
      if (!onAnimal(sp, x, y) || def.eyes.some((e) => Math.hypot(x - e.x, y - e.y) < e.r + 1.5)) continue;
      if (lines.some((s) => Math.abs(s.x - cx) < 1.3 && Math.abs(s.y - cy) < 1.3)) continue;
      pts.push([cx, cy]);
    }
  }
  colourPts.set(sp, pts);
  return pts;
}

/** grey image at detection size: mean of the 2 × 2 frame pixels around each sample point (fast enough, sharp enough) */
function greyDown(frame: RGBAImage, w: number, h: number): Float32Array {
  const { width: W, height: H, data: d } = frame;
  const out = new Float32Array(w * h);
  const sx = W / w;
  const sy = H / h;
  for (let y = 0; y < h; y++) {
    const y0 = Math.min(H - 2, Math.max(0, Math.floor((y + 0.5) * sy - 0.5)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.min(W - 2, Math.max(0, Math.floor((x + 0.5) * sx - 0.5)));
      const a = (y0 * W + x0) * 4;
      const b = a + W * 4;
      out[y * w + x] = (d[a] + d[a + 1] + d[a + 2] + d[a + 4] + d[a + 5] + d[a + 6] + d[b] + d[b + 1] + d[b + 2] + d[b + 4] + d[b + 5] + d[b + 6]) / 12;
    }
  }
  return out;
}

export interface FindOptions {
  /** the animals to look for (default: all); the tests time the search against the fish alone */
  species?: SpeciesId[];
}

/** Finds all colouring cards in the frame. */
export function findCards(frame: RGBAImage, opts: FindOptions = {}): CardScan {
  const species0 = opts.species ?? SPECIES_IDS;
  const t0 = performance.now();
  const { width: W, height: H } = frame;
  const f = Math.min(1, DETECT / Math.max(W, H));
  const w = Math.max(1, Math.round(W * f));
  const h = Math.max(1, Math.round(H * f));
  const L = greyDown(frame, w, h);
  // the paper around each pixel (frames and lines are thin, so a max filter removes them), on a 4× coarser grid
  const q = 4;
  const qw = Math.ceil(w / q);
  const qh = Math.ceil(h / q);
  const coarse = new Float32Array(qw * qh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((y / q) | 0) * qw + ((x / q) | 0);
    if (L[y * w + x] > coarse[i]) coarse[i] = L[y * w + x];
  }
  const R = Math.max(2, Math.round(Math.max(qw, qh) / 80));
  const bgq = boxBlur(maxFilter(coarse, qw, qh, R), qw, qh, R);
  const bg = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bg[y * w + x] = sampleBilinear(bgq, qw, qh, (x + 0.5) / q - 0.5, (y + 0.5) / q - 0.5);
  const dark: Mask = { width: w, height: h, data: new Uint8Array(w * h) };
  const light: Mask = { width: w, height: h, data: new Uint8Array(w * h) };
  for (let i = 0; i < L.length; i++) {
    const d = bg[i] > 40 && L[i] < bg[i] * (1 - DARK) ? 1 : 0;
    dark.data[i] = d;
    light.data[i] = 1 - d;
  }
  const minSide = Math.max(36, 0.06 * Math.min(w, h));
  const cands = [...candidates(dark, false, minSide), ...candidates(light, true, minSide)];
  const darkness = (x: number, y: number) => {
    if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
    // pixel i covers [i, i + 1]: its centre is at i + 0.5
    const b = sampleBilinear(bg, w, h, x - 0.5, y - 0.5);
    return b > 1 ? Math.max(0, 1 - sampleBilinear(L, w, h, x - 0.5, y - 0.5) / b) : 0;
  };
  const { w: cw, h: ch, frame: fr } = CARD;
  const outer: Pt[] = [
    [0, 0],
    [cw, 0],
    [cw, ch],
    [0, ch],
  ];
  const innerC: Pt[] = [
    [fr, fr],
    [cw - fr, fr],
    [cw - fr, ch - fr],
    [fr, ch - fr],
  ];
  // points on the middle of the frame, every 2 mm
  const ring: Pt[] = [];
  for (let x = 2; x < cw - 1; x += 2) ring.push([x, fr / 2], [x, ch - fr / 2]);
  for (let y = 2; y < ch - 1; y += 2) ring.push([fr / 2, y], [cw - fr / 2, y]);
  // the printed lines are darker than the paper (or the colours) next to them
  const score = (Hc: Homography, lines: LineSample[]) => {
    let sum = 0;
    for (const s of lines) {
      const [u, v] = project(Hc, s.x, s.y);
      const [u1, v1] = project(Hc, s.x + 2 * s.nx, s.y + 2 * s.ny);
      const [u2, v2] = project(Hc, s.x - 2 * s.nx, s.y - 2 * s.ny);
      sum += darkness(u, v) - 0.5 * (darkness(u1, v1) + darkness(u2, v2));
    }
    return sum / lines.length;
  };
  const found: { H: Homography; species: SpeciesId | null; match: number; corners: Pt[]; cx: number; cy: number; size: number }[] = [];
  for (const c of cands) {
    const card = c.inner ? innerC : outer;
    const poses: Homography[] = [];
    for (let mirror = 0; mirror < 2; mirror++) {
      for (let k = 0; k < 4; k++) {
        const img = [0, 1, 2, 3].map((j) => c.quad[mirror ? (k - j + 4) % 4 : (k + j) % 4]);
        const Hc = homography(card, img);
        // the black frame must be there all around
        let onFrame = 0;
        for (const [x, y] of ring) {
          const [u, v] = project(Hc, x, y);
          const ix = Math.floor(u);
          const iy = Math.floor(v);
          if (ix >= 0 && iy >= 0 && ix < w && iy < h && dark.data[iy * w + ix]) onFrame++;
        }
        if (onFrame >= 0.8 * ring.length) poses.push(Hc);
      }
    }
    if (!poses.length) continue;
    // every animal in every pose on a few of its samples, then the best few animals in full
    const rough = species0.map((sp) => ({ sp, m: Math.max(...poses.map((Hc) => score(Hc, samplesOf(sp).coarse))) }));
    rough.sort((a, b) => b.m - a.m);
    const ranked = rough.slice(0, FULL).map(({ sp }) => {
      const v = poses.map((Hc) => score(Hc, samplesOf(sp).full));
      const m = Math.max(...v);
      let H = poses[v.indexOf(m)];
      // a (nearly) symmetric animal scores its mirrored pose about as well: the printed texts decide
      const close = poses.filter((_, i) => v[i] >= m - TIE * Math.abs(m));
      if (close.length > 1) {
        const text = close.map((Hc) => score(Hc, labelSamples()));
        H = close[text.indexOf(Math.max(...text))];
      }
      return { sp, m, H };
    });
    ranked.sort((a, b) => b.m - a.m);
    const [first, second] = ranked;
    if (first.m < NOT_A_CARD) continue;
    // a frame without a clear winner is still a card: it is counted as unsure, but not taken as an animal
    const species = first.m >= MIN_MATCH && first.m - (second?.m ?? 0) >= MARGIN ? first.sp : null;
    const best = first.m;
    const bestH = first.H;
    const corners = outer.map(([x, y]) => project(bestH, x, y));
    const cx = corners.reduce((s, p) => s + p[0], 0) / 4;
    const cy = corners.reduce((s, p) => s + p[1], 0) / 4;
    const size = Math.hypot(corners[0][0] - corners[2][0], corners[0][1] - corners[2][1]);
    // the same card found from the outside and the inside of its frame: keep the sure one, else the clearer one
    const twin = found.find((o) => Math.hypot(o.cx - cx, o.cy - cy) < 0.25 * Math.min(size, o.size));
    if (twin) {
      const keep = !!twin.species === !!species ? twin.match >= best : !!twin.species;
      if (keep) continue;
      found.splice(found.indexOf(twin), 1);
    }
    found.push({ H: bestH, species, match: best, corners, cx, cy, size });
  }
  // the frames of a whole sheet of cards also make a big frame around a sure card: that is not a card. A dark
  // rectangle painted on a card is no sure card, so it neither hides the card nor counts as a card of its own
  const inside = (big: (typeof found)[number], small: (typeof found)[number]) => small.size < 0.7 * big.size && insidePolygon(big.corners, small.cx, small.cy);
  const frames = found.filter((o) => !found.some((p) => (p.species && inside(o, p)) || (!o.species && p.species && inside(p, o))));
  // reading order: top to bottom, left to right
  frames.sort((a, b) => (Math.abs(a.cy - b.cy) > 0.4 * Math.min(a.size, b.size) ? a.cy - b.cy : a.cx - b.cx));
  const cards = frames.flatMap((o) => {
    if (!o.species) return [];
    // detection px -> frame px
    const Hf = o.H.slice();
    for (let i = 0; i < 6; i++) Hf[i] /= f;
    return [cutOut(frame, Hf, o.match, o.species)];
  });
  return { frameW: W, frameH: H, cards, unsure: frames.length - cards.length, ms: Math.round(performance.now() - t0) };
}

/** Cuts the card out of the frame (straight, CARD_PX per mm) and evens out its colours. */
export function cutOut(frame: RGBAImage, Hf: Homography, match: number, species: SpeciesId): CardHit {
  const tw = Math.round(CARD.w * CARD_PX);
  const th = Math.round(CARD.h * CARD_PX);
  const quad = ([[0, 0], [CARD.w, 0], [CARD.w, CARD.h], [0, CARD.h]] as Pt[]).map(([x, y]) => project(Hf, x, y));
  // frame px per texture px: several samples per pixel when the card is big in the photo
  const per = (Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]) + Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1])) / 2 / tw;
  const ss = per > 1.6 ? 2 : 1;
  const { width: W, height: H, data: d } = frame;
  const out = new Uint8ClampedArray(tw * th * 4);
  const px = (x: number, y: number, acc: number[]) => {
    const xf = Math.min(Math.max(x - 0.5, 0), W - 1);
    const yf = Math.min(Math.max(y - 0.5, 0), H - 1);
    const x0 = Math.floor(xf);
    const y0 = Math.floor(yf);
    const x1 = Math.min(x0 + 1, W - 1);
    const y1 = Math.min(y0 + 1, H - 1);
    const fx = xf - x0;
    const fy = yf - y0;
    for (let c = 0; c < 3; c++) {
      const a = d[(y0 * W + x0) * 4 + c] * (1 - fx) + d[(y0 * W + x1) * 4 + c] * fx;
      const b = d[(y1 * W + x0) * 4 + c] * (1 - fx) + d[(y1 * W + x1) * 4 + c] * fx;
      acc[c] += a * (1 - fy) + b * fy;
    }
  };
  const acc = [0, 0, 0];
  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      acc[0] = acc[1] = acc[2] = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [x, y] = project(Hf, (tx + (sx + 0.5) / ss) / CARD_PX, (ty + (sy + 0.5) / ss) / CARD_PX);
          px(x, y, acc);
        }
      }
      const o = (ty * tw + tx) * 4;
      const n = ss * ss;
      out[o] = acc[0] / n;
      out[o + 1] = acc[1] / n;
      out[o + 2] = acc[2] / n;
      out[o + 3] = 255;
    }
  }
  // the paper: the white margin around the frame, or the white of the printed eye, or the brightest part
  const ring: number[][] = [];
  for (let t = 0; t < 1; t += 0.01) {
    const o = 1.6;
    for (const [x, y] of [
      [-o + (CARD.w + 2 * o) * t, -o],
      [-o + (CARD.w + 2 * o) * t, CARD.h + o],
      [-o, -o + (CARD.h + 2 * o) * t],
      [CARD.w + o, -o + (CARD.h + 2 * o) * t],
    ]) {
      const [u, v] = project(Hf, x, y);
      if (u < 0 || v < 0 || u >= W || v >= H) continue;
      const a = [0, 0, 0];
      px(u, v, a);
      ring.push(a);
    }
  }
  evenOut(out, tw, th, ring, species);
  const image: RGBAImage = { width: tw, height: th, data: out };
  const hit: CardHit = { species, quad, image, match: Math.round(match * 1000) / 1000, colored: 0, thumb: thumbOf(image, species) };
  if (species === 'freiform') {
    hit.mask = freeformMask(image);
    hit.colored = freeformShare(image, hit.mask);
  } else hit.colored = colouredShare(image, species);
  return hit;
}

/** median colour of a list of RGB samples (by brightness) */
function median(list: number[][]): number[] | null {
  if (list.length < 8) return null;
  const s = list.slice().sort((a, b) => a[0] + a[1] + a[2] - (b[0] + b[1] + b[2]));
  return s[s.length >> 1];
}

const lumOf = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

/**
 * White balance against the paper, then a little more colour: crayon on paper looks pale in a camera picture.
 * The paper is the white margin around the frame (missing when the card is cut at the frame and lies on a
 * table), else the white of the printed eye, else the brightest part of the card (children colour everything).
 */
function evenOut(px: Uint8ClampedArray, w: number, h: number, outside: number[][], sp: SpeciesId): void {
  const at = (x: number, y: number) => {
    const o = (Math.round(y * CARD_PX) * w + Math.round(x * CARD_PX)) * 4;
    return [px[o], px[o + 1], px[o + 2]];
  };
  const m = Math.ceil((CARD.frame + 1) * CARD_PX);
  const hist = new Uint32Array(256);
  let count = 0;
  for (let y = m; y < h - m; y += 2) {
    for (let x = m; x < w - m; x += 2) {
      const o = (y * w + x) * 4;
      hist[Math.round(0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2])]++;
      count++;
    }
  }
  let cut = 255;
  for (let k = 0; cut > 0 && k + hist[cut] < count * 0.1; cut--) k += hist[cut];
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = m; y < h - m; y += 2) {
    for (let x = m; x < w - m; x += 2) {
      const o = (y * w + x) * 4;
      if (0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2] < cut - 0.5) continue;
      sum[0] += px[o];
      sum[1] += px[o + 1];
      sum[2] += px[o + 2];
      n++;
    }
  }
  const bright = n ? sum.map((v) => v / n) : null;
  // the eye: inside the white circle, outside the pupil and its highlight
  const eye: number[][] = [];
  // (the free-form card has no eye)
  const E = SPECIES[sp].eyes[0];
  for (let a = 0; E && a < Math.PI * 2; a += 0.15) {
    for (const r of [E.r - 1.1, E.r - 1.8]) {
      const x = E.x + Math.cos(a) * r;
      const y = E.y + Math.sin(a) * r;
      if (Math.hypot(x - E.pupil.x, y - E.pupil.y) < E.pupil.r + 0.8) continue;
      eye.push(at(...toCard(sp, x, y)));
    }
  }
  const ref = bright ? lumOf(bright) : 0;
  const paper = [median(outside), median(eye)].filter((c): c is number[] => !!c && lumOf(c) >= 0.75 * ref).sort((a, b) => lumOf(b) - lumOf(a))[0] ?? bright;
  if (!paper) return;
  const wb = paper.map((v) => Math.max(40, v));
  for (let i = 0; i < px.length; i += 4) {
    const r = Math.min(255, (px[i] * 255) / wb[0]);
    const g = Math.min(255, (px[i + 1] * 255) / wb[1]);
    const b = Math.min(255, (px[i + 2] * 255) / wb[2]);
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const k = 1.35;
    px[i] = 255 * Math.pow(Math.min(1, Math.max(0, (y + (r - y) * k) / 255)), 1.12);
    px[i + 1] = 255 * Math.pow(Math.min(1, Math.max(0, (y + (g - y) * k) / 255)), 1.12);
    px[i + 2] = 255 * Math.pow(Math.min(1, Math.max(0, (y + (b - y) * k) / 255)), 1.12);
  }
}

function texel(img: RGBAImage, x: number, y: number): [number, number, number] {
  const tx = Math.min(img.width - 1, Math.max(0, Math.round(x * CARD_PX)));
  const ty = Math.min(img.height - 1, Math.max(0, Math.round(y * CARD_PX)));
  const o = (ty * img.width + tx) * 4;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
}

/** share of the animal that is coloured in (blank cards on a full sheet do not become animals) */
export function colouredShare(img: RGBAImage, sp: SpeciesId): number {
  // the free-form card: what the cut-out keeps, so pale crayon counts and the printed words do not
  if (sp === 'freiform') return freeformShare(img);
  const pts = colourPoints(sp);
  let n = 0;
  for (const [x, y] of pts) {
    const [r, g, b] = texel(img, x, y);
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const sat = mx > 0 ? (mx - mn) / mx : 0;
    if (sat > 0.2 || mx < 190) n++;
  }
  return pts.length ? n / pts.length : 0;
}

export function thumbOf(img: RGBAImage, sp: SpeciesId): number[] {
  const { x0, y0, x1, y1 } = paintBox(sp);
  const out: number[] = [];
  const cw = (x1 - x0) / THUMB_W;
  const chh = (y1 - y0) / THUMB_H;
  for (let j = 0; j < THUMB_H; j++) {
    for (let i = 0; i < THUMB_W; i++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) {
        const c = texel(img, x0 + (i + (sx + 0.5) / 3) * cw, y0 + (j + (sy + 0.5) / 3) * chh);
        acc[0] += c[0];
        acc[1] += c[1];
        acc[2] += c[2];
      }
      out.push(...acc.map((v) => Math.round((v / 9 / 255) * 1000) / 1000));
    }
  }
  return out;
}

/** mean absolute difference of two thumbnails (0 = the same picture) */
export function thumbDistance(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 1;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

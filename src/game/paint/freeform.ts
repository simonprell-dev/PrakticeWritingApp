// The free-form card of the "Mal-Aquarium": the child draws an animal of its own on the empty card. This cuts
// the drawing out of the white paper (pure pixels, no DOM: it runs in the vision worker too).
import type { RGBAImage } from '../../vision/types.ts';
import { CARD, CARD_PX, FREEFORM } from './fishCard.ts';
import { labelsFor, textWidth } from './sheets.ts';

/** a pixel is painted when it is this much darker than the paper (luminance 0..255, paper lifted to 255) … */
const DARKER = 45;
/** … or this much more colourful (max - min channel); camera noise on paper stays below 30 */
const COLOURFUL = 45;
/** on the printed elements only what is wider than the printed strokes counts (opening radius, mm) */
const PRINT_STROKE = 0.6;
/** painted water: one colour covers this share of the free area … */
const WATER_SHARE = 0.55;
/** … and lies along this share of the edge of the free area (within WATER_ZONE mm of it) */
const WATER_ALONG = 0.6;
const WATER_ZONE = 6;
/** a hole lying this much on the printed elements is a printed box or letter, not the inside of the animal */
const PRINTED_HOLE = 0.8;
/** closing radius (mm): bridges small gaps in a drawn outline */
const CLOSE = 0.6;
/** slits (printed lines inside the drawing) narrower than twice this are closed (mm) */
const SLIT = 1;
/** smaller pieces are crumbs (mm²) */
const CRUMB = 20;

type Box = { x0: number; y0: number; x1: number; y1: number };

/** the printed elements of the free-form card (card mm): hint with its box, the arrow with its words, the name text */
function printed(): { soft: Box[]; hard: Box[] } {
  const L = labelsFor('freiform');
  const b = FREEFORM.hintBox;
  const a = FREEFORM.arrow;
  const p = 1;
  const soft: Box[] = [
    { x0: b.x - p, y0: b.y - p, x1: b.x + b.w + p, y1: b.y + b.h + p },
    { x0: L.hint.x - textWidth(L.hint.text, L.hint.size) - p, y0: L.hint.y - L.hint.size - p, x1: L.hint.x + p, y1: L.hint.y + p },
    { x0: Math.min(a.x0, L.arrow!.x - textWidth(L.arrow!.text, L.hint.size)) - p, y0: L.arrow!.y - L.hint.size - p, x1: a.x1 + p, y1: a.y + a.head + p },
    { x0: L.name.x - p, y0: L.name.y - L.name.size - p, x1: L.line.x1 + p, y1: L.line.y + p },
  ];
  const nb = L.nameBox;
  return { soft, hard: [{ x0: nb.x, y0: nb.y, x1: nb.x + nb.w, y1: CARD.h }] };
}

const lum = (d: Uint8ClampedArray, o: number) => 0.299 * d[o] + 0.587 * d[o + 1] + 0.114 * d[o + 2];
const chroma = (d: Uint8ClampedArray, o: number) => Math.max(d[o], d[o + 1], d[o + 2]) - Math.min(d[o], d[o + 1], d[o + 2]);

/** max (grow) or min (shrink) over a square of radius r, separable; a running count over each window */
function square(m: Uint8Array, w: number, h: number, r: number, grow: boolean): Uint8Array {
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  const hit = grow ? 1 : 0;
  // `n` = pixels equal to `hit` in the window [x - r, x + r]
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let n = 0;
    for (let k = 0; k < Math.min(w, r); k++) if (m[row + k] === hit) n++;
    for (let x = 0; x < w; x++) {
      if (x + r < w && m[row + x + r] === hit) n++;
      if (x - r - 1 >= 0 && m[row + x - r - 1] === hit) n--;
      tmp[row + x] = n > 0 ? hit : 1 - hit;
    }
  }
  // the columns: one count per column, row by row
  const col = new Int32Array(w);
  for (let k = 0; k < Math.min(h, r); k++) for (let x = 0; x < w; x++) if (tmp[k * w + x] === hit) col[x]++;
  for (let y = 0; y < h; y++) {
    const add = y + r < h ? (y + r) * w : -1;
    const sub = y - r - 1 >= 0 ? (y - r - 1) * w : -1;
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (add >= 0 && tmp[add + x] === hit) col[x]++;
      if (sub >= 0 && tmp[sub + x] === hit) col[x]--;
      out[row + x] = col[x] > 0 ? hit : 1 - hit;
    }
  }
  return out;
}

/**
 * 4-connected components of the pixels equal to `v`; calls `each` with the pixels of every component (a view
 * that is only valid during the call)
 */
function components(m: Uint8Array, w: number, h: number, v: number, each: (px: Int32Array, border: boolean) => void): void {
  const seen = new Uint8Array(m.length);
  // the queue of a breadth-first search is the list of the component's pixels
  const queue = new Int32Array(m.length);
  for (let s = 0; s < m.length; s++) {
    if (seen[s] || m[s] !== v) continue;
    let end = 0;
    let border = false;
    seen[s] = 1;
    queue[end++] = s;
    for (let head = 0; head < end; head++) {
      const i = queue[head];
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      if (x > 0 && !seen[i - 1] && m[i - 1] === v) {
        seen[i - 1] = 1;
        queue[end++] = i - 1;
      }
      if (x < w - 1 && !seen[i + 1] && m[i + 1] === v) {
        seen[i + 1] = 1;
        queue[end++] = i + 1;
      }
      if (y > 0 && !seen[i - w] && m[i - w] === v) {
        seen[i - w] = 1;
        queue[end++] = i - w;
      }
      if (y < h - 1 && !seen[i + w] && m[i + w] === v) {
        seen[i + w] = 1;
        queue[end++] = i + w;
      }
    }
    each(queue.subarray(0, end), border);
  }
}

/** solves the n × n system a·x = b (Gauss with pivoting); null when it is singular */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-9) return null;
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  return m.map((row, i) => row[n] / row[i]);
}

/**
 * The paper's brightness over the card: a smooth surface (quadratic in x and y) through the grey paper samples
 * along the frame, so light falling off towards one side is not taken for paint. Samples clearly below the
 * surface (pencil touching the frame) are dropped and the surface is fitted again.
 */
function paperSurface(pts: { x: number; y: number; l: number }[], w: number, h: number): (x: number, y: number) => number {
  const basis = (x: number, y: number) => {
    const u = x / w - 0.5;
    const v = y / h - 0.5;
    return [1, u, v, u * u, u * v, v * v];
  };
  let use = pts;
  let coef: number[] | null = null;
  for (let it = 0; it < 4 && use.length >= 24; it++) {
    const a = Array.from({ length: 6 }, () => Array<number>(6).fill(0));
    const b = Array<number>(6).fill(0);
    for (const p of use) {
      const f = basis(p.x, p.y);
      for (let i = 0; i < 6; i++) {
        b[i] += f[i] * p.l;
        for (let j = 0; j < 6; j++) a[i][j] += f[i] * f[j];
      }
    }
    const c = solve(a, b);
    if (!c) break;
    coef = c;
    const at = (p: { x: number; y: number }) => basis(p.x, p.y).reduce((s, f, i) => s + f * c[i], 0);
    use = pts.filter((p) => p.l > at(p) - 10);
  }
  // no grey paper along the frame (painted up to it): the colours were already evened out against white
  if (!coef) return () => 250;
  const c = coef;
  return (x, y) => Math.max(60, basis(x, y).reduce((s, f, i) => s + f * c[i], 0));
}

/** 1 = painted pixel of the free-form animal (card image at CARD_PX), holes filled, crumbs and printed elements removed */
export function freeformMask(img: RGBAImage): Uint8Array {
  const { width: w, height: h, data: d } = img;
  const band = Math.ceil((CARD.frame + 1) * CARD_PX);
  const { soft, hard } = printed();
  /** the pixels inside the boxes */
  const raster = (bs: Box[]) => {
    const m = new Uint8Array(w * h);
    for (const b of bs) {
      for (let y = 0; y < h; y++) {
        if (y / CARD_PX < b.y0 || y / CARD_PX > b.y1) continue;
        for (let x = 0; x < w; x++) if (x / CARD_PX >= b.x0 && x / CARD_PX <= b.x1) m[y * w + x] = 1;
      }
    }
    return m;
  };
  const inHard = raster(hard);
  const inSoft = raster(soft);

  // the paper: grey (unsaturated) samples in a strip just inside the frame, off the printed elements
  const strip = Math.ceil((CARD.frame + 2.5) * CARD_PX);
  const paperPts: { x: number; y: number; l: number; c: number }[] = [];
  for (let y = band; y < h - band; y += 2) {
    for (let x = band; x < w - band; x += 2) {
      if (x >= strip && y >= strip && x < w - strip && y < h - strip) continue;
      if (inHard[y * w + x] || inSoft[y * w + x]) continue;
      const o = (y * w + x) * 4;
      const c = chroma(d, o);
      if (c < 30) paperPts.push({ x, y, l: lum(d, o), c });
    }
  }
  const paper = paperSurface(paperPts, w, h);
  // the paper's own colourfulness (noise, a slight cast): the median of its grey samples, lifted like the pixels
  const pcs = paperPts.map((p) => (p.c * 255) / paper(p.x, p.y)).sort((a, b) => a - b);
  const paperChroma = pcs.length ? pcs[pcs.length >> 1] : 0;

  // every pixel is lifted so that the paper under it is 255 (the surface is smooth: 8 points per row, interpolated)
  const lift = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = Array.from({ length: 8 }, (_, k) => 255 / paper(((k + 0.5) * w) / 8, y));
    for (let x = 0; x < w; x++) {
      const t = Math.min(7, Math.max(0, (x * 8) / w - 0.5));
      const k = Math.min(6, Math.floor(t));
      lift[y * w + x] = row[k] + (row[k + 1] - row[k]) * (t - k);
    }
  }

  // candidates: darker or more colourful than the paper; `off` = frame band and the name
  const onPrint = new Uint8Array(w * h);
  const off = new Uint8Array(w * h);
  const cand = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x < band || y < band || x >= w - band || y >= h - band || inHard[i]) {
        off[i] = 1;
        continue;
      }
      onPrint[i] = inSoft[i];
      const o = i * 4;
      const f = lift[i];
      cand[i] = 255 - lum(d, o) * f > DARKER || chroma(d, o) * f - paperChroma > COLOURFUL ? 1 : 0;
    }
  }
  paintedWater(d, w, band, cand, off, onPrint, lift);

  // on the printed elements only what is wider than the printed strokes: a fill over the arrow stays, the arrow goes
  const ro = Math.max(1, Math.round(PRINT_STROKE * CARD_PX));
  const opened = square(square(cand, w, h, ro, false), w, h, ro, true);
  const strict = new Uint8Array(w * h);
  for (let i = 0; i < strict.length; i++) strict[i] = onPrint[i] ? opened[i] & cand[i] : cand[i];

  const r = Math.max(1, Math.round(CLOSE * CARD_PX));
  /** close small gaps, then only what is inside the frame band and off the name */
  const close = (m: Uint8Array) => {
    const c = square(square(m, w, h, r, true), w, h, r, false);
    for (let i = 0; i < c.length; i++) if (off[i]) c[i] = 0;
    return c;
  };
  /** paper not connected to the edge of the card is inside the animal */
  const fillHoles = (m: Uint8Array, keep: (px: Int32Array) => boolean = () => true, into = m) =>
    components(m, w, h, 0, (px, border) => {
      if (!border && keep(px)) for (const i of px) into[i] = 1;
    });

  const mask = close(strict);
  fillHoles(mask);
  // a pencil outline crossing the arrow or the hint is cut there in `strict`: its inside comes from all
  // candidates, unless that inside is just a printed box or a letter
  fillHoles(close(cand), (px) => px.reduce((n, i) => n + onPrint[i], 0) < PRINTED_HOLE * px.length, mask);
  // the printed lines and words inside the animal leave thin slits there: close them, only on the printed elements
  const r2 = Math.round(SLIT * CARD_PX);
  const wide = square(square(mask, w, h, r2, true), w, h, r2, false);
  for (let i = 0; i < mask.length; i++) if (wide[i] && onPrint[i]) mask[i] = 1;
  fillHoles(mask);
  // crumbs away
  const crumb = CRUMB * CARD_PX * CARD_PX;
  components(mask, w, h, 1, (px) => {
    if (px.length < crumb) for (const i of px) mask[i] = 0;
  });
  return mask;
}

/**
 * Painted water: when one colour covers most of the free area and lies all along the frame, it is the background
 * like the paper, and its pixels are no candidates any more. The animal is what differs from both.
 */
function paintedWater(d: Uint8ClampedArray, w: number, band: number, cand: Uint8Array, off: Uint8Array, onPrint: Uint8Array, lift: Float32Array): void {
  // the free area: inside the band, above the name
  const bottom = Math.round(labelsFor('freiform').nameBox.y * CARD_PX);
  const zw = Math.round(WATER_ZONE * CARD_PX);
  const zonePx: number[] = [];
  const freePx: number[] = [];
  for (let y = band; y < bottom; y += 2) {
    for (let x = band; x < w - band; x += 2) {
      const i = y * w + x;
      if (off[i] || onPrint[i]) continue;
      freePx.push(i);
      if (x < band + zw || y < band + zw || x >= w - band - zw || y >= bottom - zw) zonePx.push(i);
    }
  }
  const wet = zonePx.filter((i) => cand[i]);
  if (wet.length < 0.25 * zonePx.length) return;
  const ch = (i: number, c: number) => d[i * 4 + c] * lift[i];
  const water = [0, 1, 2].map((c) => wet.map((i) => ch(i, c)).sort((a, b) => a - b)[wet.length >> 1]);
  const dist = (i: number) => Math.hypot(ch(i, 0) - water[0], ch(i, 1) - water[1], ch(i, 2) - water[2]);
  // how far crayon water strays from its median colour (streaks, light); the animal is clearly further away.
  // At most 55: white paper is about 70 away from light blue water and must not count as water.
  const spread = wet.map(dist).sort((a, b) => a - b)[Math.floor(wet.length * 0.8)];
  const near = Math.min(55, Math.max(35, 2.5 * spread));
  const isWater = (i: number) => dist(i) < near;
  // along the frame: pieces of 6 mm of the zone, each with some water in it
  const pieces = new Map<string, [number, number]>();
  for (const i of zonePx) {
    const x = i % w;
    const y = (i - x) / w;
    const side = y < band + zw ? 't' : y >= bottom - zw ? 'b' : x < band + zw ? 'l' : 'r';
    const key = side + Math.floor((side === 't' || side === 'b' ? x : y) / zw);
    const p = pieces.get(key) ?? [0, 0];
    p[0]++;
    if (isWater(i)) p[1]++;
    pieces.set(key, p);
  }
  const along = [...pieces.values()].filter(([n, k]) => k >= 0.3 * n).length / Math.max(1, pieces.size);
  const covers = freePx.filter(isWater).length / Math.max(1, freePx.length);
  if (covers < WATER_SHARE || along < WATER_ALONG) return;
  for (let i = 0; i < cand.length; i++) if (cand[i] && isWater(i)) cand[i] = 0;
}

/** share of the free space of the card that is painted (a blank card is near 0) */
export function freeformShare(img: RGBAImage, mask = freeformMask(img)): number {
  const band = (CARD.frame + 1) * CARD_PX;
  const nb = labelsFor('freiform').nameBox;
  const area = (img.width - 2 * band) * (nb.y * CARD_PX - band);
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return Math.min(1, n / Math.max(1, area));
}

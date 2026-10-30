// The free-form card of the "Mal-Aquarium": the child draws an animal of its own on the empty card. This cuts
// the drawing out of the white paper (pure pixels, no DOM: it runs in the vision worker too).
import type { RGBAImage } from '../../vision/types.ts';
import { CARD, CARD_PX, FREEFORM } from './fishCard.ts';
import { labelsFor, textWidth } from './sheets.ts';

/** a pixel is painted when it is this much darker than the paper (luminance 0..255) … */
const DARKER = 45;
/** … or this much more colourful (max - min channel); camera noise on paper stays below 30 */
const COLOURFUL = 45;
/** on the printed elements colour has to be clearer: their grey ink reaches about 50 in a photo */
const COLOURFUL_ON_PRINT = 70;
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

/** max (grow) or min (shrink) over a square of radius r, separable */
function square(m: Uint8Array, w: number, h: number, r: number, grow: boolean): Uint8Array {
  const tmp = new Uint8Array(m.length);
  const out = new Uint8Array(m.length);
  const hit = grow ? 1 : 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - hit;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) if (m[y * w + k] === hit) { v = hit; break; }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 1 - hit;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) if (tmp[k * w + x] === hit) { v = hit; break; }
      out[y * w + x] = v;
    }
  }
  return out;
}

/** 4-connected components of the pixels equal to `v`; calls `each` with the pixel list of every component */
function components(m: Uint8Array, w: number, h: number, v: number, each: (px: number[], border: boolean) => void): void {
  const seen = new Uint8Array(m.length);
  const stack: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (seen[s] || m[s] !== v) continue;
    const px: number[] = [];
    let border = false;
    seen[s] = 1;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      px.push(i);
      const x = i % w;
      const y = (i - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j < 0 || seen[j] || m[j] !== v) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    each(px, border);
  }
}

/** 1 = painted pixel of the free-form animal (card image at CARD_PX), holes filled, crumbs and printed elements removed */
export function freeformMask(img: RGBAImage): Uint8Array {
  const { width: w, height: h, data: d } = img;
  const band = Math.ceil((CARD.frame + 1) * CARD_PX);
  // the paper: the bright part of a strip just inside the frame (a drawing may touch the frame here and there)
  const ls: number[] = [];
  const cs: number[] = [];
  const strip = Math.ceil((CARD.frame + 2.5) * CARD_PX);
  for (let y = band; y < h - band; y += 2) {
    for (let x = band; x < w - band; x += 2) {
      if (x >= strip && y >= strip && x < w - strip && y < h - strip) continue;
      const o = (y * w + x) * 4;
      ls.push(lum(d, o));
      cs.push(chroma(d, o));
    }
  }
  ls.sort((a, b) => a - b);
  cs.sort((a, b) => a - b);
  const paperLum = ls.length ? ls[Math.floor(ls.length * 0.75)] : 255;
  const paperChroma = cs.length ? cs[Math.floor(cs.length * 0.25)] : 0;

  const { soft, hard } = printed();
  const inBox = (bs: Box[], x: number, y: number) => bs.some((b) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
  const onPrint = new Uint8Array(w * h);
  const off = new Uint8Array(w * h);
  // dark or colourful pixels; `strict` leaves out what is only dark on the printed elements
  const all = new Uint8Array(w * h);
  const strict = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x < band || y < band || x >= w - band || y >= h - band || inBox(hard, x / CARD_PX, y / CARD_PX)) {
        off[i] = 1;
        continue;
      }
      const print = inBox(soft, x / CARD_PX, y / CARD_PX);
      onPrint[i] = print ? 1 : 0;
      const o = i * 4;
      const colour = chroma(d, o) - paperChroma > (print ? COLOURFUL_ON_PRINT : COLOURFUL);
      const dark = paperLum - lum(d, o) > DARKER;
      all[i] = colour || dark ? 1 : 0;
      strict[i] = colour || (dark && !print) ? 1 : 0;
    }
  }
  const r = Math.max(1, Math.round(CLOSE * CARD_PX));
  /** close small gaps, then only what is inside the frame band and off the name */
  const close = (m: Uint8Array) => {
    const c = square(square(m, w, h, r, true), w, h, r, false);
    for (let i = 0; i < c.length; i++) if (off[i]) c[i] = 0;
    return c;
  };
  /** paper not connected to the edge of the card is inside the animal */
  const fillHoles = (m: Uint8Array, keep: (px: number[]) => boolean = () => true, into = m) =>
    components(m, w, h, 0, (px, border) => {
      if (!border && keep(px)) for (const i of px) into[i] = 1;
    });

  const mask = close(strict);
  fillHoles(mask);
  // a pencil outline crossing the arrow or the hint is cut there in `strict`: its inside comes from `all`,
  // unless that inside is just a printed box or a letter
  fillHoles(close(all), (px) => px.reduce((n, i) => n + onPrint[i], 0) < PRINTED_HOLE * px.length, mask);
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

/** share of the free space of the card that is painted (a blank card is near 0) */
export function freeformShare(img: RGBAImage, mask = freeformMask(img)): number {
  const band = (CARD.frame + 1) * CARD_PX;
  const nb = labelsFor('freiform').nameBox;
  const area = (img.width - 2 * band) * (nb.y * CARD_PX - band);
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return Math.min(1, n / Math.max(1, area));
}

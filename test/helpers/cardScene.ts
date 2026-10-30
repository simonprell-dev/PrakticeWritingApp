// Synthetic photos of colouring cards: cards drawn with the real card art, put into a camera frame with
// rotation, perspective, uneven light, crayon texture and noise.
import { createCanvas, Path2D, type Canvas } from '@napi-rs/canvas';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { drawCard, type CardLook } from '../../src/game/paint/cardArt.ts';
import { CARD, SHEET, sheetLayout } from '../../src/game/paint/fishCard.ts';
import { SPECIES, type SpeciesId } from '../../src/game/paint/species.ts';
import { homography, project } from '../../src/vision/cards.ts';
import type { Pt } from '../../src/vision/geometry.ts';
import type { RGBAImage } from '../../src/vision/types.ts';
import { rng } from './synth.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);

/** a card as a child coloured it: the card look, and on the free-form card a painted blob (card mm) */
export interface SceneLook extends CardLook {
  blob?: { x: number; y: number; rx: number; ry: number; colour: string };
}

const PALETTE = ['#ff8a2a', '#2f9bff', '#ffd23c', '#3fc45a', '#ff4f8a', '#9b5cff', '#ff6a3c', '#26c6b0'];

/** a coloured card of any animal: every part gets a crayon colour; the free-form card gets a blob off centre */
export function colourful(sp: SpeciesId, seed = 0): SceneLook {
  if (sp === 'freiform') return { species: sp, blob: { x: 34, y: 38, rx: 20, ry: 13, colour: PALETTE[seed % PALETTE.length] } };
  const fills: Record<string, string> = {};
  SPECIES[sp].parts.forEach((p, i) => (fills[p.id] = PALETTE[(i + seed) % PALETTE.length]));
  return { species: sp, fills };
}

/** the card art plus what the child painted beyond the colouring areas */
export function drawLook(ctx: CanvasRenderingContext2D, k: number, look: SceneLook): void {
  drawCard(ctx, k, look);
  const b = look.blob;
  if (!b) return;
  ctx.fillStyle = b.colour;
  ctx.beginPath();
  ctx.ellipse(b.x * k, b.y * k, b.rx * k, b.ry * k, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

export interface Placed {
  /** corners of the paper (sheet or cut card) in the photo: top-left, top-right, bottom-right, bottom-left */
  corners: Pt[];
}

/** a flat picture (k px per mm) of a sheet with six cards, or of one cut out card with its white margin */
export function paperPicture(kind: 'sheet' | 'card', looks: SceneLook[], k = 6): { canvas: Canvas; wMm: number; hMm: number } {
  if (kind === 'card') {
    const m = CARD.margin;
    const c = createCanvas(Math.round((CARD.w + 2 * m) * k), Math.round((CARD.h + 2 * m) * k));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(m * k, m * k);
    drawLook(ctx as unknown as CanvasRenderingContext2D, k, looks[0] ?? {});
    return { canvas: c, wMm: CARD.w + 2 * m, hMm: CARD.h + 2 * m };
  }
  const c = createCanvas(Math.round(SHEET.w * k), Math.round(SHEET.h * k));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  sheetLayout().cells.forEach((cell, i) => {
    ctx.save();
    ctx.translate(cell.x * k, cell.y * k);
    drawLook(ctx as unknown as CanvasRenderingContext2D, k, looks[i] ?? {});
    ctx.restore();
  });
  return { canvas: c, wMm: SHEET.w, hMm: SHEET.h };
}

export interface PhotoSpec {
  width: number;
  height: number;
  /** table colour */
  table: [number, number, number];
  /** a photo that is already there (more cards on one table): it shows where the paper is not */
  background?: RGBAImage;
  /** where the paper lies (frame px, clockwise from its top-left corner) */
  corners: Pt[];
  /** light falls off towards one side (0..1) */
  shadow?: number;
  noise?: number;
  /** crayon strokes: fine stripes of paper showing through the colour */
  texture?: number;
  /** colour cast of the camera (multiplies the channels) */
  cast?: [number, number, number];
  seed?: number;
}

/** Puts the flat picture into a camera frame. */
export function photo(pic: ReturnType<typeof paperPicture>, spec: PhotoSpec): RGBAImage {
  const { width: W, height: H } = spec;
  const src = pic.canvas.getContext('2d').getImageData(0, 0, pic.canvas.width, pic.canvas.height);
  const sw = src.width;
  const sh = src.height;
  // frame px -> picture px
  const Hinv = homography(spec.corners, [
    [0, 0],
    [sw, 0],
    [sw, sh],
    [0, sh],
  ]);
  const r = rng(spec.seed ?? 1);
  const out = new Uint8ClampedArray(W * H * 4);
  const cast = spec.cast ?? [1, 1, 1];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [u, v] = project(Hinv, x + 0.5, y + 0.5);
      let c: number[];
      if (u >= 0 && v >= 0 && u < sw && v < sh) {
        const o = (Math.floor(v) * sw + Math.floor(u)) * 4;
        c = [src.data[o], src.data[o + 1], src.data[o + 2]];
        // crayon: the white paper shows through in thin stripes
        if (spec.texture && (c[0] < 250 || c[1] < 250 || c[2] < 250) && c[0] + c[1] + c[2] > 150) {
          const stripe = 0.5 + 0.5 * Math.sin((u + v * 0.6) * 1.9 + Math.sin(v * 0.21) * 2);
          const a = spec.texture * stripe;
          c = c.map((v0) => v0 + (250 - v0) * a);
        }
      } else if (spec.background) {
        const o = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) out[o + k] = spec.background.data[o + k];
        out[o + 3] = 255;
        continue;
      } else c = spec.table.slice();
      const light = 1 - (spec.shadow ?? 0) * (x / W) * 0.8;
      for (let k = 0; k < 3; k++) {
        const n = (r() - 0.5) * 2 * (spec.noise ?? 0);
        out[(y * W + x) * 4 + k] = c[k] * light * cast[k] + n;
      }
      out[(y * W + x) * 4 + 3] = 255;
    }
  }
  return { width: W, height: H, data: out };
}

/** corners of a w × h mm paper, scaled by s px/mm, rotated by `deg` around the frame point (cx, cy), with a bit of perspective */
export function pose(wMm: number, hMm: number, s: number, cx: number, cy: number, deg: number, tilt = 0): Pt[] {
  const a = (deg * Math.PI) / 180;
  const pts: Pt[] = [
    [-wMm / 2, -hMm / 2],
    [wMm / 2, -hMm / 2],
    [wMm / 2, hMm / 2],
    [-wMm / 2, hMm / 2],
  ];
  return pts.map(([x, y]) => {
    // perspective: the far edge (top) is a bit narrower
    const p = 1 - tilt * (0.5 - (y + hMm / 2) / hMm);
    const xx = x * p * s;
    const yy = y * s;
    return [cx + xx * Math.cos(a) - yy * Math.sin(a), cy + xx * Math.sin(a) + yy * Math.cos(a)] as Pt;
  });
}

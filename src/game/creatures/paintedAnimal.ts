// An animal coloured in by a child: the scanned card is the skin of the sprite. The printed outline is drawn
// again on top (so a photo that is a little off shows no white seams), with a white sticker edge around it.
// The moving part (tail, fins, claws, arms) is a sprite of its own, so it can move. The free-form animal is
// cut out of the paper as it was drawn, with a white sticker edge around its outline.
import type { RGBAImage } from '../../vision/types.ts';
import { canvasFromRGBA, makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { INK } from '../paint/cardArt.ts';
import { CARD_PX, LINE, onAnimal, toCard } from '../paint/fishCard.ts';
import { freeformMask } from '../paint/freeform.ts';
import { labelsFor } from '../paint/sheets.ts';
import { SPECIES, type SpeciesId } from '../paint/species.ts';
import type { Sprite } from './sprite.ts';

const PAD = 8;
/** the white sticker edge around the outline, mm (half of it lies under the outline) */
const EDGE = 3.2;

function texelMean(sp: SpeciesId, img: RGBAImage, pts: [number, number][]): [number, number, number] {
  const { place } = SPECIES[sp];
  const acc = [0, 0, 0];
  for (const [fx, fy] of pts) {
    const x = Math.round((place.x + fx * place.s) * CARD_PX);
    const y = Math.round((place.y + fy * place.s) * CARD_PX);
    const o = (Math.min(img.height - 1, Math.max(0, y)) * img.width + Math.min(img.width - 1, Math.max(0, x))) * 4;
    acc[0] += img.data[o];
    acc[1] += img.data[o + 1];
    acc[2] += img.data[o + 2];
  }
  return acc.map((v) => Math.round(v / Math.max(1, pts.length))) as [number, number, number];
}

/** bounding box (animal units) of the outline parts that do not move: the body the sprite turns around */
function bodyBox(sp: SpeciesId): { x0: number; y0: number; x1: number; y1: number } {
  const def = SPECIES[sp];
  const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const p of def.parts) {
    if (def.moving.includes(p.id)) continue;
    const n = p.d.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) {
      b.x0 = Math.min(b.x0, n[i]);
      b.x1 = Math.max(b.x1, n[i]);
      b.y0 = Math.min(b.y0, n[i + 1]);
      b.y1 = Math.max(b.y1, n[i + 1]);
    }
  }
  return Number.isFinite(b.x0) ? b : def.box;
}

/**
 * k = sprite px per animal unit (every animal is about 100 units long; the free-form card counts in fish units).
 * `mask`: the free-form drawing as the detection found it (made here when missing, e.g. for a saved animal).
 */
export function paintedSprite(sp: SpeciesId, img: RGBAImage, k = 2.6, tex?: AnyCanvas, mask?: Uint8Array): Sprite {
  if (sp === 'freiform') return freeformSprite(img, k, mask ?? freeformMask(img));
  tex ??= canvasFromRGBA(img);
  const def = SPECIES[sp];
  /** mm on the card -> animal units */
  const U = 1 / def.place.s;
  const { box, pivot: joint } = def;
  const W = Math.ceil((box.x1 - box.x0) * k + 2 * PAD);
  const H = Math.ceil((box.y1 - box.y0) * k + 2 * PAD);
  const sx = (x: number) => PAD + (x - box.x0) * k;
  const sy = (y: number) => PAD + (y - box.y0) * k;
  const toAnimal = (ctx: Ctx) => {
    ctx.translate(PAD - box.x0 * k, PAD - box.y0 * k);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  };
  const skin = (ctx: Ctx) => {
    ctx.save();
    ctx.scale(U, U);
    ctx.translate(-def.place.x, -def.place.y);
    ctx.scale(1 / CARD_PX, 1 / CARD_PX);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex as CanvasImageSource, 0, 0);
    ctx.restore();
  };
  const paint = (ctx: Ctx, parts: readonly string[]) => {
    // white sticker edge around everything, then each part with its skin and outline, back to front
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = EDGE * U;
    for (const d of parts) ctx.stroke(makePath(d));
    ctx.strokeStyle = INK;
    for (const d of parts) {
      const p = makePath(d);
      ctx.save();
      ctx.clip(p);
      skin(ctx);
      ctx.restore();
      ctx.lineWidth = LINE.outline * U * 1.2;
      ctx.stroke(p);
    }
  };
  const layer = (moving: boolean) => {
    const c = makeCanvas(W, H);
    c.ctx.save();
    toAnimal(c.ctx);
    paint(
      c.ctx,
      def.parts.filter((p) => def.moving.includes(p.id) === moving).map((p) => p.d),
    );
    c.ctx.restore();
    return c.canvas;
  };
  const body = layer(false);
  const tail = def.moving.length ? layer(true) : null;

  // the eyelid takes the colour around the (first) eye
  const eye = def.eyes[0];
  const ring: [number, number][] = [];
  for (let a = 0; eye && a < Math.PI * 2; a += 0.3) ring.push([eye.x + Math.cos(a) * (eye.r + 2.2), eye.y + Math.sin(a) * (eye.r + 2.2)]);
  const [r, g, b] = texelMean(sp, img, ring);
  // the fish keeps the centre it always had; the others turn around the middle of their body
  const bb = bodyBox(sp);
  const fish = sp === 'fisch';
  const cx = fish ? 62 : (bb.x0 + bb.x1) / 2;
  const cy = fish ? 38 : (bb.y0 + bb.y1) / 2;
  const radius = fish ? 46 : 0.48 * Math.max(box.x1 - box.x0, box.y1 - box.y0);
  return {
    canvas: body,
    ax: sx(cx),
    ay: sy(cy),
    radius: radius * k,
    eyes: def.eyes.map((e) => ({ x: sx(e.x), y: sy(e.y), r: e.r * k * 0.95 })),
    lid: `rgb(${r},${g},${b})`,
    ...(tail ? { tail: { canvas: tail, pivotX: sx(joint.x), pivotY: sy(joint.y), px: sx(joint.x), py: sy(joint.y) } } : {}),
    top: { x: sx(fish ? 60 : cx), y: sy(box.y0) },
    motion: def.motion,
  };
}

/** the free-form animal: what the child drew, cut out of the paper, with a white edge around its outline */
function freeformSprite(img: RGBAImage, k: number, mask: Uint8Array): Sprite {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  const acc = [0, 0, 0];
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      acc[0] += d[i * 4];
      acc[1] += d[i * 4 + 1];
      acc[2] += d[i * 4 + 2];
      n++;
    }
  }
  if (x1 < 0) {
    // nothing drawn (a blank card is not hatched; this only keeps the sprite valid)
    x0 = Math.round(w * 0.4);
    x1 = Math.round(w * 0.6);
    y0 = Math.round(h * 0.4);
    y1 = Math.round(h * 0.6);
  }
  // the cut-out at card resolution: the drawing, and a white edge (EDGE / 2 mm) around it
  const e = Math.ceil((EDGE / 2) * CARD_PX);
  const cw = x1 - x0 + 1 + 2 * e;
  const ch = y1 - y0 + 1 + 2 * e;
  const cut = makeCanvas(cw, ch);
  const id = cut.ctx.createImageData(cw, ch);
  // distance (px) of every pixel of the cut-out to the drawing: two chamfer passes instead of a disc around each pixel
  const dist = new Float32Array(cw * ch).fill(1e6);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const ix = x0 - e + x;
      const iy = y0 - e + y;
      if (ix >= 0 && iy >= 0 && ix < w && iy < h && mask[iy * w + ix]) dist[y * cw + x] = 0;
    }
  }
  const D = Math.SQRT2;
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      let v = dist[i];
      if (x > 0) v = Math.min(v, dist[i - 1] + 1);
      if (y > 0) {
        v = Math.min(v, dist[i - cw] + 1);
        if (x > 0) v = Math.min(v, dist[i - cw - 1] + D);
        if (x < cw - 1) v = Math.min(v, dist[i - cw + 1] + D);
      }
      dist[i] = v;
    }
  }
  for (let y = ch - 1; y >= 0; y--) {
    for (let x = cw - 1; x >= 0; x--) {
      const i = y * cw + x;
      let v = dist[i];
      if (x < cw - 1) v = Math.min(v, dist[i + 1] + 1);
      if (y < ch - 1) {
        v = Math.min(v, dist[i + cw] + 1);
        if (x < cw - 1) v = Math.min(v, dist[i + cw + 1] + D);
        if (x > 0) v = Math.min(v, dist[i + cw - 1] + D);
      }
      dist[i] = v;
    }
  }
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = y * cw + x;
      const p = i * 4;
      if (dist[i] === 0) {
        const o = ((y0 - e + y) * w + x0 - e + x) * 4;
        id.data[p] = d[o];
        id.data[p + 1] = d[o + 1];
        id.data[p + 2] = d[o + 2];
        id.data[p + 3] = 255;
      } else if (dist[i] <= e) {
        // the white sticker edge
        id.data[p] = id.data[p + 1] = id.data[p + 2] = 255;
        id.data[p + 3] = 255;
      }
    }
  }
  cut.ctx.putImageData(id, 0, 0);
  // fish units: k px per 0.82 mm, like the fish printed on its card
  const s = k / SPECIES.fisch.place.s / CARD_PX;
  const W = Math.ceil(cw * s + 2 * PAD);
  const H = Math.ceil(ch * s + 2 * PAD);
  const out = makeCanvas(W, H);
  out.ctx.imageSmoothingEnabled = true;
  out.ctx.drawImage(cut.canvas as CanvasImageSource, PAD, PAD, cw * s, ch * s);
  const mean = acc.map((v) => Math.round(v / Math.max(1, n)));
  return {
    canvas: out.canvas,
    ax: W / 2,
    ay: H / 2,
    radius: 0.48 * Math.max(cw, ch) * s,
    eyes: [],
    lid: `rgb(${mean[0]},${mean[1]},${mean[2]})`,
    top: { x: W / 2, y: PAD + e * s },
    motion: SPECIES.freiform.motion,
  };
}

/** the whole animal in one picture (moving part behind the body), e.g. for the flight into the aquarium */
export function animalPicture(sp: Sprite, size: number): AnyCanvas {
  const s = size / Math.max(sp.canvas.width, sp.canvas.height);
  const { canvas, ctx } = makeCanvas(sp.canvas.width * s, sp.canvas.height * s);
  ctx.scale(s, s);
  if (sp.tail) ctx.drawImage(sp.tail.canvas as CanvasImageSource, 0, 0);
  ctx.drawImage(sp.canvas as CanvasImageSource, 0, 0);
  return canvas;
}

/** how close (mm) to the printed animal a pixel of the name box must not be: tips of arms are no name */
const NEAR_ANIMAL = 1.5;
const nearAnimal = new Map<SpeciesId, Uint8Array>();

/** the pixels of the name box (row by row) that lie on or next to the printed animal (made once per animal) */
function nearAnimalMask(sp: SpeciesId, x0: number, y0: number, w: number, h: number): Uint8Array {
  let m = nearAnimal.get(sp);
  if (m && m.length === w * h) return m;
  m = new Uint8Array(w * h);
  const def = SPECIES[sp];
  const [bx0, by0] = toCard(sp, def.box.x0, def.box.y0);
  const [bx1, by1] = toCard(sp, def.box.x1, def.box.y1);
  const r = NEAR_ANIMAL;
  for (let y = 0; y < h; y++) {
    const cy = (y0 + y + 0.5) / CARD_PX;
    if (!def.parts.length || cy < by0 - r || cy > by1 + r) continue;
    for (let x = 0; x < w; x++) {
      const cx = (x0 + x + 0.5) / CARD_PX;
      if (cx < bx0 - r || cx > bx1 + r) continue;
      for (let a = -1; a < 8; a++) {
        const px = a < 0 ? cx : cx + Math.cos((a * Math.PI) / 4) * r;
        const py = a < 0 ? cy : cy + Math.sin((a * Math.PI) / 4) * r;
        if (onAnimal(sp, (px - def.place.x) / def.place.s, (py - def.place.y) / def.place.s)) {
          m[y * w + x] = 1;
          break;
        }
      }
    }
  }
  nearAnimal.set(sp, m);
  return m;
}

/** the handwritten name of the animal, or null when nothing was written on the line */
export function nameCrop(img: RGBAImage, sp: SpeciesId = 'fisch'): AnyCanvas | null {
  const labels = labelsFor(sp);
  const nb = labels.nameBox;
  const x0 = Math.round(nb.x * CARD_PX);
  const y0 = Math.round(nb.y * CARD_PX);
  const w = Math.min(img.width - x0, Math.round(nb.w * CARD_PX));
  const h = Math.min(img.height - y0, Math.round(nb.h * CARD_PX));
  const lineY = Math.round(labels.line.y * CARD_PX);
  // the printed animal does not count either (every animal ends above the box; this keeps it so)
  const animal = nearAnimalMask(sp, x0, y0, w, h);
  let ink = 0;
  let minX = w;
  let maxX = -1;
  for (let y = 0; y < h; y++) {
    // the printed line does not count
    if (Math.abs(y0 + y - lineY) <= 4) continue;
    for (let x = 0; x < w; x++) {
      if (animal[y * w + x]) continue;
      const o = ((y0 + y) * img.width + x0 + x) * 4;
      if (img.data[o] + img.data[o + 1] + img.data[o + 2] < 3 * 150) {
        ink++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (ink < w * h * 0.004 || maxX - minX < 6 * CARD_PX) return null;
  // only the written part, with a little room
  const a = Math.max(0, minX - 12);
  const bw = Math.min(w, maxX + 12) - a;
  const { canvas, ctx } = makeCanvas(bw, h);
  const id = ctx.createImageData(bw, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < bw; x++) {
      const o = ((y0 + y) * img.width + x0 + a + x) * 4;
      const p = (y * bw + x) * 4;
      // paper becomes transparent, the writing stays
      const dark = 1 - (img.data[o] + img.data[o + 1] + img.data[o + 2]) / 765;
      const line = Math.abs(y0 + y - lineY) <= 3 || animal[y * w + a + x] === 1;
      id.data[p] = img.data[o];
      id.data[p + 1] = img.data[o + 1];
      id.data[p + 2] = img.data[o + 2];
      id.data[p + 3] = line ? 0 : Math.min(255, Math.max(0, (dark - 0.12) * 600));
    }
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
}

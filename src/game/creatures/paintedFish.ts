// A fish coloured in by a child: the scanned card is the skin of the sprite. The printed outline is drawn
// again on top (so a photo that is a little off shows no white seams), with a white sticker edge around it.
// The tail is a sprite of its own, so it can wag.
import type { RGBAImage } from '../../vision/types.ts';
import { canvasFromRGBA, makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { INK } from '../paint/cardArt.ts';
import { BODY_PARTS, CARD_PX, FISH, FISH_TO_CARD, LABELS, LINE } from '../paint/fishCard.ts';
import type { Sprite } from './sprite.ts';

/** mm on the card -> fish units */
const U = 1 / FISH_TO_CARD.s;
const PAD = 8;

function texelMean(img: RGBAImage, pts: [number, number][]): [number, number, number] {
  const acc = [0, 0, 0];
  for (const [fx, fy] of pts) {
    const x = Math.round((FISH_TO_CARD.x + fx * FISH_TO_CARD.s) * CARD_PX);
    const y = Math.round((FISH_TO_CARD.y + fy * FISH_TO_CARD.s) * CARD_PX);
    const o = (Math.min(img.height - 1, Math.max(0, y)) * img.width + Math.min(img.width - 1, Math.max(0, x))) * 4;
    acc[0] += img.data[o];
    acc[1] += img.data[o + 1];
    acc[2] += img.data[o + 2];
  }
  return acc.map((v) => Math.round(v / Math.max(1, pts.length))) as [number, number, number];
}

/** k = sprite px per fish unit (the fish is 100 units long) */
export function paintedFishSprite(img: RGBAImage, k = 2.6, tex: AnyCanvas = canvasFromRGBA(img)): Sprite {
  const { box, joint, eye } = FISH;
  const W = Math.ceil((box.x1 - box.x0) * k + 2 * PAD);
  const H = Math.ceil((box.y1 - box.y0) * k + 2 * PAD);
  const sx = (x: number) => PAD + (x - box.x0) * k;
  const sy = (y: number) => PAD + (y - box.y0) * k;
  const toFish = (ctx: Ctx) => {
    ctx.translate(PAD - box.x0 * k, PAD - box.y0 * k);
    ctx.scale(k, k);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
  };
  const skin = (ctx: Ctx) => {
    ctx.save();
    ctx.scale(U, U);
    ctx.translate(-FISH_TO_CARD.x, -FISH_TO_CARD.y);
    ctx.scale(1 / CARD_PX, 1 / CARD_PX);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex as CanvasImageSource, 0, 0);
    ctx.restore();
  };
  const paint = (ctx: Ctx, parts: readonly string[]) => {
    // white sticker edge around everything, then each part with its skin and outline, back to front
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.2 * U;
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
  const body = makeCanvas(W, H);
  body.ctx.save();
  toFish(body.ctx);
  paint(
    body.ctx,
    BODY_PARTS.map((p) => FISH[p]),
  );
  body.ctx.restore();
  const tail = makeCanvas(W, H);
  tail.ctx.save();
  toFish(tail.ctx);
  paint(tail.ctx, [FISH.tail]);
  tail.ctx.restore();

  // the eyelid takes the colour around the eye
  const ring: [number, number][] = [];
  for (let a = 0; a < Math.PI * 2; a += 0.3) ring.push([eye.x + Math.cos(a) * (eye.r + 2.2), eye.y + Math.sin(a) * (eye.r + 2.2)]);
  const [r, g, b] = texelMean(img, ring);
  const cx = 62;
  const cy = 38;
  return {
    canvas: body.canvas,
    ax: sx(cx),
    ay: sy(cy),
    radius: 46 * k,
    eyes: [{ x: sx(eye.x), y: sy(eye.y), r: eye.r * k * 0.95 }],
    lid: `rgb(${r},${g},${b})`,
    tail: { canvas: tail.canvas, pivotX: sx(joint.x), pivotY: sy(joint.y), px: sx(joint.x), py: sy(joint.y) },
    top: { x: sx(60), y: sy(box.y0) },
  };
}

/** the whole fish in one picture (tail behind the body), e.g. for the flight into the aquarium */
export function fishPicture(sp: Sprite, size: number): AnyCanvas {
  const s = size / Math.max(sp.canvas.width, sp.canvas.height);
  const { canvas, ctx } = makeCanvas(sp.canvas.width * s, sp.canvas.height * s);
  ctx.scale(s, s);
  if (sp.tail) ctx.drawImage(sp.tail.canvas as CanvasImageSource, 0, 0);
  ctx.drawImage(sp.canvas as CanvasImageSource, 0, 0);
  return canvas;
}

/** the handwritten name of the fish, or null when nothing was written on the line */
export function nameCrop(img: RGBAImage): AnyCanvas | null {
  const nb = LABELS.nameBox;
  const x0 = Math.round(nb.x * CARD_PX);
  const y0 = Math.round(nb.y * CARD_PX);
  const w = Math.min(img.width - x0, Math.round(nb.w * CARD_PX));
  const h = Math.min(img.height - y0, Math.round(nb.h * CARD_PX));
  const lineY = Math.round(LABELS.line.y * CARD_PX);
  let ink = 0;
  let minX = w;
  let maxX = -1;
  for (let y = 0; y < h; y++) {
    // the printed line does not count
    if (Math.abs(y0 + y - lineY) <= 4) continue;
    for (let x = 0; x < w; x++) {
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
      const line = Math.abs(y0 + y - lineY) <= 3;
      id.data[p] = img.data[o];
      id.data[p + 1] = img.data[o + 1];
      id.data[p + 2] = img.data[o + 2];
      id.data[p + 3] = line ? 0 : Math.min(255, Math.max(0, (dark - 0.12) * 600));
    }
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
}

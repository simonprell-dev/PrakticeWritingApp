import type { Motion } from '../paint/species.ts';
import type { AnyCanvas, Ctx } from '../canvas.ts';
import type { EyeInfo } from './parts.ts';

export interface Sprite {
  canvas: AnyCanvas;
  /** body centre in sprite pixels */
  ax: number;
  ay: number;
  /** approximate body radius (logical px) */
  radius: number;
  eyes: EyeInfo[];
  /** colour of the eyelid when blinking */
  lid: string;
  /** separately animated part (the fish's tail, an animal's fins, claws or arms), pivot at (pivotX, pivotY) in its sprite, attached at (px, py) */
  tail?: { canvas: AnyCanvas; pivotX: number; pivotY: number; px: number; py: number };
  /** where an accessory like a crown or sparkles sits (sprite px) */
  top: { x: number; y: number };
  /** white badge circle (sprite px); the child's letter is drawn live so it is never mirrored */
  badge?: { x: number; y: number; r: number };
  sticker?: AnyCanvas | null;
  /** how a painted animal moves (Mal-Aquarium); other creatures swim the habitat's way */
  motion?: Motion;
}

/**
 * Draws the child's letter onto the badge. Call inside the creature transform (origin = body centre);
 * flip < 0 means the creature is drawn mirrored, so the letter is mirrored back to stay readable.
 */
export function drawBadgeSticker(ctx: Ctx, sp: Sprite, flip: number): void {
  if (!sp.badge || !sp.sticker) return;
  const st = sp.sticker;
  const { x, y, r } = sp.badge;
  const s = (r * 1.45) / Math.max(st.width, st.height);
  ctx.save();
  ctx.translate(x - sp.ax, y - sp.ay);
  if (flip < 0) ctx.scale(-1, 1);
  ctx.drawImage(st as CanvasImageSource, (-st.width * s) / 2, (-st.height * s) / 2, st.width * s, st.height * s);
  ctx.restore();
}

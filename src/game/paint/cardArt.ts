// Draws the colouring card with the canvas API (tile preview, lobby preview, tests and tools).
// The print sheet uses the same geometry as SVG (ui/printSheet.ts).
import type { RGBAImage } from '../../vision/types.ts';
import { makeCanvas, makePath, type Ctx } from '../canvas.ts';
import { CARD, CARD_PX, LINE } from './fishCard.ts';
import { labelsFor } from './sheets.ts';
import { SPECIES, type SpeciesId } from './species.ts';

export const INK = '#1d1a24';

export interface CardLook {
  /** the animal on the card (default: the fish) */
  species?: SpeciesId;
  /** colours of the parts (white when missing), 'water' = the area around the fish */
  fills?: Partial<Record<string, string>>;
  font?: string;
  /** draw the white margin up to the cut line */
  margin?: boolean;
}

/** a card as the detection would cut it out (previews: a coloured fish without a camera) */
export function cardImage(look: CardLook): RGBAImage {
  const { canvas, ctx } = makeCanvas(Math.round(CARD.w * CARD_PX), Math.round(CARD.h * CARD_PX));
  drawCard(ctx, CARD_PX, look);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { width: id.width, height: id.height, data: new Uint8ClampedArray(id.data) };
}

/** Draws one card with its top-left frame corner at the current origin, `k` px per mm. */
export function drawCard(ctx: Ctx, k: number, look: CardLook = {}): void {
  const { w, h, frame, margin } = CARD;
  ctx.save();
  ctx.scale(k, k);
  if (look.margin) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-margin, -margin, w + 2 * margin, h + 2 * margin);
  }
  ctx.fillStyle = look.fills?.water ?? '#ffffff';
  ctx.fillRect(0, 0, w, h);
  // the thick frame
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, w, frame);
  ctx.fillRect(0, h - frame, w, frame);
  ctx.fillRect(0, 0, frame, h);
  ctx.fillRect(w - frame, 0, frame, h);

  ctx.save();
  const sp = SPECIES[look.species ?? 'fisch'];
  const labels = labelsFor(sp.id);
  ctx.translate(sp.place.x, sp.place.y);
  ctx.scale(sp.place.s, sp.place.s);
  const u = 1 / sp.place.s;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  for (const part of sp.parts) {
    const p = makePath(part.d);
    ctx.fillStyle = look.fills?.[part.id] ?? '#ffffff';
    ctx.fill(p);
    ctx.lineWidth = LINE.outline * u;
    ctx.stroke(p);
  }
  ctx.lineWidth = LINE.inner * u;
  for (const d of sp.lines) ctx.stroke(makePath(d));
  ctx.lineWidth = LINE.outline * u * 0.8;
  for (const d of sp.strokes) ctx.stroke(makePath(d));
  for (const { pupil, ...eye } of sp.eyes) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(eye.x, eye.y, eye.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = LINE.inner * u * 1.3;
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(pupil.x, pupil.y, pupil.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(pupil.x - 0.9, pupil.y - 1, 0.85, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const font = look.font ?? 'Fredoka, system-ui, sans-serif';
  ctx.fillStyle = '#4a4458';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `600 ${labels.hint.size}px ${font}`;
  ctx.textAlign = 'right';
  ctx.fillText(labels.hint.text, labels.hint.x, labels.hint.y);
  if (labels.arrow) ctx.fillText(labels.arrow.text, labels.arrow.x, labels.arrow.y);
  ctx.font = `600 ${labels.name.size}px ${font}`;
  ctx.textAlign = 'left';
  ctx.fillText(labels.name.text, labels.name.x, labels.name.y);
  ctx.strokeStyle = '#6d6680';
  ctx.lineWidth = 0.35;
  ctx.beginPath();
  ctx.moveTo(labels.line.x0, labels.line.y);
  ctx.lineTo(labels.line.x1, labels.line.y);
  ctx.stroke();
  ctx.restore();
}

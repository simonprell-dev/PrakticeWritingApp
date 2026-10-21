// Iridescent soap bubble sprites (castles, pop effects, aquarium bubbles).
import { makeCanvas, type AnyCanvas } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';

const cache = new Map<string, AnyCanvas>();

export function bubbleSprite(r: number, hueShift = 0, tint?: number, strong = false): AnyCanvas {
  // quantised so the cache stays small
  r = Math.max(2, Math.round(r));
  hueShift = (((Math.round(hueShift / 15) * 15) % 360) + 360) % 360;
  if (tint !== undefined) tint = (((Math.round(tint / 15) * 15) % 360) + 360) % 360;
  const key = `${r}:${hueShift}:${tint ?? ''}:${strong}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = Math.ceil(r * 2 + 6);
  const { canvas, ctx } = makeCanvas(s, s);
  const c = s / 2;
  // body: almost transparent with a tint
  const body = ctx.createRadialGradient(c - r * 0.3, c - r * 0.3, r * 0.1, c, c, r);
  body.addColorStop(0, `rgba(255,255,255,0.05)`);
  body.addColorStop(0.75, tint !== undefined ? hsl(tint, 0.8, 0.75, strong ? 0.45 : 0.16) : 'rgba(200,230,255,0.08)');
  body.addColorStop(1, tint !== undefined ? hsl(tint, 0.85, 0.65, strong ? 0.75 : 0.35) : 'rgba(210,235,255,0.3)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.fill();
  // iridescent rim
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  for (let i = 0; i < 24; i++) {
    const a0 = (i / 24) * TAU;
    ctx.strokeStyle = hsl(hueShift + i * 15, 0.9, 0.7, 0.55);
    ctx.beginPath();
    ctx.arc(c, c, r - ctx.lineWidth / 2, a0, a0 + TAU / 24 + 0.02);
    ctx.stroke();
  }
  // highlights
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(c - r * 0.42, c - r * 0.42, r * 0.22, r * 0.12, -0.75, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(c + r * 0.45, c + r * 0.4, r * 0.07, 0, TAU);
  ctx.fill();
  cache.set(key, canvas);
  return canvas;
}

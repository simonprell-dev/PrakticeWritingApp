// Team-Duell fighters: round bubbly blobs in team colour with the letter on the belly.
import { makeCanvas, makePath, type AnyCanvas } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Genome } from './genome.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

/** radius in logical px, facing right (team B is drawn mirrored) */
export function fighterSprite(g: Genome, sticker: AnyCanvas | null, radius: number): Sprite {
  const r = radius;
  const W = Math.ceil(r * 2.9);
  const H = Math.ceil(r * 3.0);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = H / 2 + r * 0.2;
  const lw = Math.max(2, r * 0.07);
  if (g.sparkle) P.aura(ctx, cx, cy, r * 1.15, g.hue);

  // feet
  for (const sx of [-1, 1]) {
    const f = makePath();
    f.ellipse(cx + sx * r * 0.42, cy + r * 0.95, r * 0.3, r * 0.17, 0, 0, TAU);
    ctx.fillStyle = P.bodyColor(g, -0.12);
    ctx.fill(f);
    P.strokeBody(ctx, f, g, lw * 0.8);
  }
  const body = P.blobPath({ cx, cy, rx: r, ry: r * 0.95, g, mirrorX: g.asym < 0.3 });
  P.shadeBody(ctx, body, g, cx, cy, r, r);
  P.crumpleFacets(ctx, body, g, cx, cy, r, r);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = hsl(g.hue, g.sat * 0.5, Math.min(0.93, g.light + 0.28), 0.7);
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.45, r * 0.68, r * 0.55, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (g.glossy) P.gloss(ctx, cx, cy, r, r);
  P.strokeBody(ctx, body, g, lw);

  // fists
  for (const sx of [-1, 1]) {
    const f = makePath();
    f.arc(cx + sx * r * 1.0, cy + r * 0.15 - (sx > 0 ? r * 0.15 : 0), r * 0.2, 0, TAU);
    ctx.fillStyle = P.bodyColor(g, 0.04);
    ctx.fill(f);
    P.strokeBody(ctx, f, g, lw * 0.8);
  }
  const badgeAt = { x: cx, y: cy + r * 0.42, r: r * 0.44 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  const eyes: P.EyeInfo[] = [];
  const er = r * 0.22;
  eyes.push(P.eye(ctx, cx - r * 0.12, cy - r * 0.3, er, g.eyeStyle, g.r, [0.6, 0]));
  eyes.push(P.eye(ctx, cx + r * 0.4, cy - r * 0.3, er * (g.eyeStyle === 'googly' ? 0.75 : 1), g.eyeStyle, g.r, [0.6, 0]));
  // determined little brows
  ctx.save();
  ctx.strokeStyle = P.outlineColor(g);
  ctx.lineWidth = lw * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy - r * 0.6);
  ctx.lineTo(cx - r * 0.0, cy - r * 0.52);
  ctx.moveTo(cx + r * 0.25, cy - r * 0.52);
  ctx.lineTo(cx + r * 0.55, cy - r * 0.6);
  ctx.stroke();
  ctx.restore();
  P.blush(ctx, cx + r * 0.55, cy - r * 0.05, er * 0.6);
  P.mouth(ctx, cx + r * 0.15, cy - r * 0.02, r * 0.22, g.wobble > 0.4 ? 'wavy' : 'smile');
  if (g.bandaid) P.bandaid(ctx, cx - r * 0.5, cy - r * 0.55, r * 0.5, -0.5);
  if (g.crown) P.crown(ctx, cx + r * 0.1, cy - r * 0.88, r * 0.62, 0.1);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: r,
    eyes,
    lid: P.bodyColor(g, 0.05),
    top: { x: cx, y: cy - r * 1.2 },
  };
}

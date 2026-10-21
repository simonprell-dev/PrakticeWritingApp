// Little aliens: pear-shaped blobs with antennae, one to three eyes, tiny arms and feet.
import { makeCanvas, makePath, type AnyCanvas } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Genome } from './genome.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

export function alienSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 170 * g.size;
  const rx = L * (g.variant === 2 ? 0.3 : 0.34);
  const ry = L * (g.variant === 1 ? 0.3 : 0.36);
  const W = Math.ceil(rx * 2 + L * 0.5);
  const H = Math.ceil(ry * 2 + L * 0.75);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = H / 2 + L * 0.12;
  const lw = Math.max(2.5, L * 0.02);
  if (g.sparkle) P.aura(ctx, cx, cy, Math.max(rx, ry) * 1.2, g.hue2);

  // antennae
  const n = g.variant === 1 ? 1 : g.variant === 2 ? 3 : 2;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5;
    const bx = cx + t * rx * 1.0;
    const by = cy - ry * 0.85;
    const bentAmt = g.wobble > 0.4 && i === 0 ? 0.6 : 0;
    const ex = bx + t * L * 0.35 + bentAmt * L * 0.2;
    const ey = by - L * (0.28 - bentAmt * 0.1);
    ctx.save();
    ctx.strokeStyle = P.outlineColor(g);
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx + t * L * 0.05 + bentAmt * L * 0.25, by - L * 0.2, ex, ey);
    ctx.stroke();
    const glow = ctx.createRadialGradient(ex, ey, 1, ex, ey, L * 0.06);
    glow.addColorStop(0, '#fff');
    glow.addColorStop(1, hsl(g.hue2, 0.9, 0.62));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(ex, ey, L * 0.05, 0, TAU);
    ctx.fill();
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
    ctx.restore();
  }

  // feet
  for (const sx of [-1, 1]) {
    const fp = makePath();
    fp.ellipse(cx + sx * rx * 0.45, cy + ry * 0.95, L * 0.09, L * 0.055, 0, 0, TAU);
    ctx.fillStyle = P.bodyColor(g, -0.08);
    ctx.fill(fp);
    P.strokeBody(ctx, fp, g, lw * 0.8);
  }

  // body (pear shape: wider at the bottom)
  const body = P.blobPath({
    cx,
    cy,
    rx,
    ry,
    g,
    mirrorX: g.asym < 0.3,
    shape: (th) => 1 + 0.12 * Math.sin(th),
  });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry);
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  // lighter belly
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = hsl(g.hue, g.sat * 0.5, Math.min(0.92, g.light + 0.25), 0.6);
  ctx.beginPath();
  ctx.ellipse(cx, cy + ry * 0.45, rx * 0.62, ry * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry);
  P.strokeBody(ctx, body, g, lw);

  // arms
  for (const sx of [-1, 1]) {
    const ap = makePath();
    const ax0 = cx + sx * rx * 0.92;
    const ay0 = cy + ry * 0.15;
    const up = sx > 0 && g.q > 0.6 ? -1 : 1; // waving arm for nice ones
    ap.ellipse(ax0 + sx * L * 0.06, ay0 + up * L * 0.04, L * 0.08, L * 0.045, sx * up * 0.7, 0, TAU);
    ctx.fillStyle = P.bodyColor(g, 0.02);
    ctx.fill(ap);
    P.strokeBody(ctx, ap, g, lw * 0.8);
  }

  const badgeAt = { x: cx, y: cy + ry * 0.38, r: Math.min(rx, ry) * 0.42 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // eyes
  const eyes: P.EyeInfo[] = [];
  const ey = cy - ry * 0.28;
  const er = L * (0.085 + 0.02 * g.q);
  if (g.eyeCount === 1) eyes.push(P.eye(ctx, cx, ey, er * 1.45, g.eyeStyle, g.r, [0, 0.15]));
  else if (g.eyeCount === 2) {
    const mis = g.eyeStyle === 'googly' ? 0.75 : 1;
    eyes.push(P.eye(ctx, cx - rx * 0.36, ey, er, g.eyeStyle, g.r, [0.1, 0.15]));
    eyes.push(P.eye(ctx, cx + rx * 0.36, ey + (mis < 1 ? er * 0.3 : 0), er * mis, g.eyeStyle, g.r, [0.1, 0.15]));
  } else {
    eyes.push(P.eye(ctx, cx - rx * 0.42, ey + er * 0.25, er * 0.8, g.eyeStyle, g.r));
    eyes.push(P.eye(ctx, cx, ey - er * 0.35, er * 1.0, g.eyeStyle, g.r));
    eyes.push(P.eye(ctx, cx + rx * 0.42, ey + er * 0.25, er * 0.8, g.eyeStyle, g.r));
  }
  P.blush(ctx, cx - rx * 0.55, cy + ry * 0.02, er * 0.6);
  P.blush(ctx, cx + rx * 0.55, cy + ry * 0.02, er * 0.6);
  P.mouth(ctx, cx, cy + ry * 0.04, L * 0.08, g.wobble > 0.4 ? 'wavy' : g.q > 0.85 ? 'open' : 'cat');
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.5, cy - ry * 0.65, L * 0.17, -0.5);
  if (g.crown) P.crown(ctx, cx, cy - ry * 0.98, L * 0.24, -0.08);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: Math.max(rx, ry),
    eyes,
    lid: P.bodyColor(g, 0.05),
    top: { x: cx, y: cy - ry - L * 0.2 },
  };
}

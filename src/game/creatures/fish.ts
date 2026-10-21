// Fish: side view facing right, tail is a separate sprite so it can wag.
import { makeCanvas, makePath, type AnyCanvas } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Genome } from './genome.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

export function fishSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 190 * g.size;
  const shapes = [
    { rx: 0.4, ry: 0.27 },
    { rx: 0.36, ry: 0.33 },
    { rx: 0.45, ry: 0.21 },
  ];
  const s = shapes[g.variant] ?? shapes[0];
  const rx = s.rx * L;
  const ry = s.ry * L;
  const W = Math.ceil(rx * 2 + L * 0.3);
  const H = Math.ceil(ry * 2 + L * 0.55);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 + L * 0.08;
  const cy = H / 2 + L * 0.05;
  const lw = Math.max(2.5, L * 0.018);

  if (g.sparkle) P.aura(ctx, cx, cy, Math.max(rx, ry) * 1.15, g.hue + 30);

  const finFill = () => {
    if (g.rainbow) {
      const gr = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, hsl(i * 55, 0.85, 0.7, 0.95));
      return gr;
    }
    return hsl(g.hue2, g.sat, Math.min(0.8, g.light + 0.08), 0.95);
  };

  // dorsal fin
  const dorsal = makePath();
  const bend = g.wobble * 0.5;
  dorsal.moveTo(cx - rx * 0.35, cy - ry * 0.82);
  dorsal.quadraticCurveTo(cx - rx * (0.05 + bend), cy - ry - L * 0.22, cx + rx * 0.3, cy - ry * 0.88);
  dorsal.closePath();
  ctx.fillStyle = finFill();
  ctx.fill(dorsal);
  P.strokeBody(ctx, dorsal, g, lw * 0.8);
  // belly fin
  const belly = makePath();
  belly.moveTo(cx - rx * 0.1, cy + ry * 0.85);
  belly.quadraticCurveTo(cx - rx * 0.05, cy + ry + L * 0.1, cx + rx * 0.22, cy + ry * 0.8);
  belly.closePath();
  ctx.fillStyle = finFill();
  ctx.fill(belly);
  P.strokeBody(ctx, belly, g, lw * 0.7);

  // body: rounder head on the right, narrower towards the tail
  const body = P.blobPath({
    cx,
    cy,
    rx,
    ry,
    g,
    shape: (th) => {
      const c = Math.cos(th);
      const sy = Math.abs(Math.sin(th));
      return 1 - (c < 0 ? 0.18 * sy * -c : 0);
    },
  });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry);
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  // belly highlight band
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = hsl(g.hue, g.sat * 0.6, Math.min(0.92, g.light + 0.25), 0.55);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.05, cy + ry * 0.7, rx * 0.8, ry * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (g.glossy) P.gloss(ctx, cx + rx * 0.25, cy, rx * 0.8, ry);
  P.strokeBody(ctx, body, g, lw);

  // gill line
  ctx.save();
  ctx.strokeStyle = P.outlineColor(g);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = lw * 0.7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx + rx * 0.28, cy, ry * 0.62, -0.9, 0.9);
  ctx.stroke();
  ctx.restore();

  // badge with the child's letter
  const br = Math.min(ry * 0.56, rx * 0.36);
  const badgeAt = { x: cx - rx * 0.22, y: cy + ry * 0.08, r: br };
  P.badge(ctx, badgeAt.x, badgeAt.y, br, null);

  // pectoral fin over the body
  const pec = makePath();
  pec.moveTo(cx + rx * 0.12, cy + ry * 0.3);
  pec.quadraticCurveTo(cx - rx * 0.05, cy + ry * 0.75, cx + rx * 0.0, cy + ry * 0.4);
  pec.closePath();
  ctx.fillStyle = finFill();
  ctx.fill(pec);
  P.strokeBody(ctx, pec, g, lw * 0.6);

  // face
  const eyes: P.EyeInfo[] = [];
  const er = L * (0.075 + 0.02 * g.q);
  if (g.eyeStyle === 'googly' && g.r() < 0.6) {
    eyes.push(P.eye(ctx, cx + rx * 0.5, cy - ry * 0.32, er * 1.05, 'googly', g.r));
    eyes.push(P.eye(ctx, cx + rx * 0.74, cy - ry * 0.12, er * 0.7, 'googly', g.r));
  } else eyes.push(P.eye(ctx, cx + rx * 0.55, cy - ry * 0.22, er, g.eyeStyle, g.r, [0.4, 0.1]));
  P.blush(ctx, cx + rx * 0.62, cy + ry * 0.22, er * 0.55);
  P.mouth(ctx, cx + rx * 0.86, cy + ry * 0.18, L * 0.06, g.wobble > 0.4 ? 'wavy' : g.q > 0.85 ? 'open' : 'smile');
  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.55, cy - ry * 0.35, L * 0.16, 0.6);
  if (g.crown) P.crown(ctx, cx + rx * 0.35, cy - ry * 0.98, L * 0.2, 0.2);

  // tail (separate canvas, pivot on the left edge of the body)
  const tw = Math.ceil(L * 0.42);
  const th = Math.ceil(L * 0.6);
  const t = makeCanvas(tw, th);
  const tc = t.ctx;
  const px = tw - L * 0.04;
  const py = th / 2;
  const tail = makePath();
  const lobe = L * 0.24;
  const uneven = g.wobble > 0.4 ? 0.55 : 1;
  tail.moveTo(px, py - L * 0.05);
  tail.quadraticCurveTo(px - L * 0.18, py - lobe * 0.6, px - L * 0.34, py - lobe);
  tail.quadraticCurveTo(px - L * 0.24, py, px - L * 0.34 * (g.wobble > 0.4 ? 0.8 : 1), py + lobe * uneven);
  tail.quadraticCurveTo(px - L * 0.18, py + lobe * 0.6, px, py + L * 0.05);
  tail.closePath();
  tc.fillStyle = (() => {
    if (g.rainbow) {
      const gr = tc.createLinearGradient(0, 0, 0, th);
      for (let i = 0; i <= 6; i++) gr.addColorStop(i / 6, hsl(i * 55, 0.85, 0.7, 0.95));
      return gr;
    }
    return hsl(g.hue2, g.sat, Math.min(0.8, g.light + 0.05));
  })();
  tc.fill(tail);
  if (g.crumple > 0.5) P.crumpleFacets(tc, tail, g, px - L * 0.2, py, L * 0.2, lobe);
  P.strokeBody(tc, tail, g, lw * 0.85);
  // fin rays
  tc.save();
  tc.globalAlpha = 0.35;
  tc.strokeStyle = P.outlineColor(g);
  tc.lineWidth = lw * 0.5;
  for (const k of [-0.6, -0.2, 0.2, 0.6]) {
    tc.beginPath();
    tc.moveTo(px - L * 0.04, py);
    tc.lineTo(px - L * 0.27, py + lobe * k);
    tc.stroke();
  }
  tc.restore();

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: Math.max(rx, ry),
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail: { canvas: t.canvas, pivotX: px, pivotY: py, px: cx - rx * 0.92, py: cy },
    top: { x: cx + rx * 0.2, y: cy - ry - L * 0.1 },
  };
}

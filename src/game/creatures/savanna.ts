// Chubby savanna animals (side view, facing right): lion, elephant, giraffe, zebra, hippo.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Genome } from './genome.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

export const SPECIES = ['Löwe', 'Elefant', 'Giraffe', 'Zebra', 'Nilpferd'];

export function animalSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g.size;
  const sp = g.variant;
  const giraffe = sp === 2;
  const rx = L * (sp === 1 || sp === 4 ? 0.34 : 0.3);
  const ry = L * (sp === 1 || sp === 4 ? 0.22 : 0.19);
  const legLen = L * (giraffe ? 0.22 : 0.13);
  const W = Math.ceil(rx * 2 + L * 0.65);
  const H = Math.ceil(ry * 2 + legLen + L * (giraffe ? 0.75 : 0.45));
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.08;
  const cy = H - legLen - ry - L * 0.04;
  const lw = Math.max(2.5, L * 0.017);
  const zebra = sp === 3;
  const bodyCol = (dl = 0) => (zebra ? hsl(0, 0, 0.95 + dl * 0.4) : P.bodyColor(g, dl));
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.08, rx * 1.35, g.hue + 20);

  // short leg on crumpled animals -> they wobble
  const legs: [number, number, number][] = [
    [cx - rx * 0.55, 0.92, -0.06],
    [cx + rx * 0.45, 0.92, -0.06],
    [cx - rx * 0.4, 1, 0],
    [cx + rx * 0.6, g.wobble > 0.4 ? 0.7 : 1, 0],
  ];
  legs.forEach(([lx, f, dl], i) => {
    const lp = makePath();
    const lwid = L * (sp === 1 || sp === 4 ? 0.085 : 0.065);
    lp.roundRect(lx - lwid / 2, cy + ry * 0.4, lwid, ry * 0.6 + legLen * f, lwid / 2);
    ctx.fillStyle = bodyCol(dl - (i < 2 ? 0.06 : 0));
    ctx.fill(lp);
    P.strokeBody(ctx, lp, g, lw * 0.8);
    // hoof / foot
    ctx.fillStyle = zebra || giraffe ? '#4a3a32' : hsl(g.hue, g.sat, Math.max(0.2, g.light - 0.25));
    ctx.beginPath();
    ctx.ellipse(lx, cy + ry + legLen * f - 2, lwid * 0.55, lwid * 0.28, 0, 0, TAU);
    ctx.fill();
  });

  // tail
  ctx.save();
  ctx.strokeStyle = P.outlineColor(g);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.95, cy - ry * 0.2);
  ctx.quadraticCurveTo(cx - rx * 1.25, cy - ry * 0.1, cx - rx * 1.2, cy + ry * 0.45);
  ctx.stroke();
  ctx.fillStyle = sp === 0 ? hsl(25, 0.7, 0.35) : '#3b302b';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 1.2, cy + ry * 0.55, L * 0.03, L * 0.05, 0.2, 0, TAU);
  ctx.fill();
  ctx.restore();

  // body
  const body = P.blobPath({ cx, cy, rx, ry, g });
  if (zebra) {
    ctx.fillStyle = bodyCol();
    ctx.fill(body);
  } else P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  if (zebra) stripes(ctx, body, cx, cy, rx, ry, g);
  if (giraffe) patches(ctx, body, cx, cy, rx, ry, g);
  if (!zebra && !giraffe) P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, g.sat, g.light + 0.12, 0.5));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.05, r: ry * 0.62 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // neck + head
  const hr = L * (sp === 4 ? 0.15 : sp === 1 ? 0.15 : 0.13);
  let hx = cx + rx * 0.95;
  let hy = cy - ry * 0.75;
  if (giraffe) {
    hx = cx + rx * 0.9;
    hy = cy - ry - L * 0.38;
    const neck = makePath();
    neck.moveTo(cx + rx * 0.45, cy - ry * 0.6);
    neck.lineTo(hx - hr * 0.6, hy + hr * 0.2);
    neck.lineTo(hx + hr * 0.2, hy + hr * 0.6);
    neck.lineTo(cx + rx * 0.9, cy - ry * 0.2);
    neck.closePath();
    ctx.fillStyle = bodyCol();
    ctx.fill(neck);
    patches(ctx, neck, cx + rx * 0.7, cy - ry - L * 0.15, L * 0.12, L * 0.25, g);
    P.strokeBody(ctx, neck, g, lw);
  }
  if (sp === 0) {
    // lion mane: scalloped ring
    const mane = makePath();
    const mr = hr * 1.55;
    const k = 12;
    for (let i = 0; i <= k; i++) {
      const a = (i / k) * TAU;
      const rr = mr * (1 + (g.wobble > 0.4 ? 0.18 * Math.sin(i * 2.3 + g.seed) : 0));
      const x = hx + Math.cos(a) * rr;
      const y = hy + Math.sin(a) * rr;
      if (i === 0) mane.moveTo(x, y);
      else mane.quadraticCurveTo(hx + Math.cos(a - Math.PI / k) * rr * 1.25, hy + Math.sin(a - Math.PI / k) * rr * 1.25, x, y);
    }
    ctx.fillStyle = hsl(24, Math.min(1, g.sat + 0.1), 0.42);
    ctx.fill(mane);
    P.strokeBody(ctx, mane, g, lw);
  }
  if (sp === 1) {
    // elephant ear behind the head
    const ear = makePath();
    ear.ellipse(hx - hr * 0.55, hy + hr * 0.1, hr * 0.95, hr * 1.15, -0.2, 0, TAU);
    ctx.fillStyle = bodyCol(-0.04);
    ctx.fill(ear);
    ctx.save();
    ctx.clip(ear);
    ctx.fillStyle = 'rgba(255,170,190,0.45)';
    ctx.beginPath();
    ctx.ellipse(hx - hr * 0.55, hy + hr * 0.15, hr * 0.6, hr * 0.8, -0.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    P.strokeBody(ctx, ear, g, lw);
  }
  const head = makePath();
  if (sp === 4) head.ellipse(hx + hr * 0.15, hy + hr * 0.1, hr * 1.25, hr, 0.1, 0, TAU);
  else head.ellipse(hx, hy, hr * (zebra || giraffe ? 1.05 : 1), hr * (zebra || giraffe ? 0.92 : 1), 0, 0, TAU);
  ctx.fillStyle = bodyCol(0.03);
  ctx.fill(head);
  if (zebra) stripes(ctx, head, hx, hy, hr, hr, g);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);

  // ears
  for (const ex of sp === 1 ? [] : [-0.55, 0.15]) {
    const e = makePath();
    const er = hr * (zebra || giraffe ? 0.32 : 0.3);
    e.ellipse(hx + ex * hr, hy - hr * 0.9, er * (zebra ? 0.7 : 1), er * (zebra ? 1.3 : 1), zebra ? -0.3 : 0, 0, TAU);
    ctx.fillStyle = bodyCol(-0.05);
    ctx.fill(e);
    P.strokeBody(ctx, e, g, lw * 0.8);
  }
  if (giraffe) {
    for (const ox of [-0.25, 0.2]) {
      ctx.save();
      ctx.strokeStyle = P.outlineColor(g);
      ctx.lineWidth = lw * 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx + ox * hr, hy - hr * 0.8);
      ctx.lineTo(hx + ox * hr, hy - hr * 1.35);
      ctx.stroke();
      ctx.fillStyle = '#6b4a2b';
      ctx.beginPath();
      ctx.arc(hx + ox * hr, hy - hr * 1.4, lw * 1.4, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }
  if (zebra) {
    // mohawk mane
    ctx.save();
    ctx.fillStyle = '#2b2b2b';
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(hx - hr * 0.8 - i * hr * 0.35, hy - hr * 0.6 + i * hr * 0.25, hr * 0.12, hr * 0.28, -0.6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // face
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.36 + 0.06 * g.q);
  const fx = hx + hr * 0.25;
  const fy = hy - hr * 0.15;
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.6, fy - er * 0.2, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.3, fy + er * 1.25, er * 0.55);
  if (sp === 1) {
    // trunk
    ctx.save();
    ctx.strokeStyle = P.outlineColor(g);
    ctx.lineWidth = hr * 0.42 + lw;
    ctx.lineCap = 'round';
    const trunk = () => {
      ctx.beginPath();
      ctx.moveTo(hx + hr * 0.7, hy + hr * 0.15);
      ctx.quadraticCurveTo(hx + hr * 1.5, hy + hr * 0.4, hx + hr * 1.35, hy + hr * 1.3);
      ctx.stroke();
    };
    trunk();
    ctx.strokeStyle = bodyCol(0.03);
    ctx.lineWidth = hr * 0.42 - lw;
    trunk();
    ctx.restore();
  } else if (sp === 4) {
    ctx.fillStyle = 'rgba(60,30,60,0.7)';
    for (const ox of [0.75, 1.05]) {
      ctx.beginPath();
      ctx.ellipse(hx + hr * ox, hy + hr * 0.05, hr * 0.08, hr * 0.12, 0, 0, TAU);
      ctx.fill();
    }
    P.mouth(ctx, hx + hr * 0.85, hy + hr * 0.55, hr * 0.5, 'smile');
  } else {
    // muzzle
    ctx.fillStyle = zebra ? '#4a4a4a' : sp === 0 ? hsl(40, 0.6, 0.85) : hsl(40, 0.5, 0.8);
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.72, hy + hr * 0.38, hr * 0.38, hr * 0.3, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#3b2238';
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.9, hy + hr * 0.25, hr * 0.1, hr * 0.07, 0, 0, TAU);
    ctx.fill();
    P.mouth(ctx, hx + hr * 0.75, hy + hr * 0.52, hr * 0.32, g.wobble > 0.4 ? 'wavy' : 'cat', zebra ? '#ddd' : '#3b2238');
  }
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.35, cy - ry * 0.45, L * 0.15, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.1, hy - hr * (giraffe ? 1.45 : 1.0), L * 0.17, 0.15);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: zebra ? '#f2f2f2' : P.bodyColor(g, 0.05),
    top: { x: hx, y: hy - hr * 1.6 },
  };
}

function stripes(ctx: Ctx, clip: Path2D, cx: number, cy: number, rx: number, ry: number, g: Genome) {
  ctx.save();
  ctx.clip(clip);
  ctx.fillStyle = '#262626';
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = cx - rx + (i + 0.5) * ((2 * rx) / n);
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.06, cy - ry * 1.1);
    ctx.quadraticCurveTo(x + rx * 0.08 * (g.wobble > 0.4 ? 2 : 1), cy, x - rx * 0.02, cy + ry * 1.1);
    ctx.lineTo(x + rx * 0.06, cy + ry * 1.1);
    ctx.quadraticCurveTo(x + rx * 0.15, cy, x + rx * 0.05, cy - ry * 1.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function patches(ctx: Ctx, clip: Path2D, cx: number, cy: number, rx: number, ry: number, g: Genome) {
  ctx.save();
  ctx.clip(clip);
  ctx.fillStyle = hsl(28, 0.65, 0.42, 0.9);
  const r = g.r;
  for (let i = 0; i < 9; i++) {
    const x = cx + (r() * 2 - 1) * rx;
    const y = cy + (r() * 2 - 1) * ry;
    const s = Math.min(rx, ry) * (0.22 + r() * 0.15);
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + r() * 0.4;
      ctx.lineTo(x + Math.cos(a) * s * (0.8 + r() * 0.3), y + Math.sin(a) * s * (0.8 + r() * 0.3));
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

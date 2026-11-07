// Cosy winter creatures (side view, facing right): snowman, penguin, polar bear, snow hare.
// Every one wears a knitted scarf in g.hue; the snowman also a bobble hat.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { clamp, hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

export const WINTER_KINDS = ['Schneemann', 'Pinguin', 'Eisbär', 'Schneehase'];

const RAINBOW = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];

/** the genome with the colours of the kind; paler on low tiers like the other worlds */
function tinted(g: Genome, hue: number, sat: number, light: number): Genome {
  const f = clamp(g.sat / 0.75, 0.35, 1.15);
  return { ...g, hue, sat: sat * f, light };
}

/** outline in a darker shade (white bodies would get a too faint one otherwise) */
function outliner(kg: Genome, dl: number): Genome {
  return { ...kg, light: kg.light - dl };
}

/** knitted scarf: a band from (x0, y0) to (x1, y1) sagging by `sag`, with an end hanging at hx */
function scarf(ctx: Ctx, g: Genome, x0: number, y0: number, x1: number, y1: number, sag: number, th: number, lw: number, hx: number, len: number): void {
  const sg: Genome = { ...g, light: 0.55 };
  const col = hsl(g.hue, Math.max(0.3, g.sat), 0.56);
  const stripe = (i: number) => (g.rainbow ? RAINBOW[i % RAINBOW.length] : hsl(g.hue2, Math.max(0.3, g.sat), 0.8));
  const striped = g.rainbow || g.q > 0.5;
  // hanging end behind the band
  const end = makePath();
  const ew = th * 0.85;
  const top = (y0 + y1) / 2 + sag * 0.6;
  end.moveTo(hx - ew / 2, top);
  end.lineTo(hx + ew / 2, top);
  end.lineTo(hx + ew / 2 - len * 0.12, top + len);
  end.lineTo(hx - ew / 2 - len * 0.12, top + len);
  end.closePath();
  ctx.fillStyle = col;
  ctx.fill(end);
  if (striped) {
    ctx.save();
    ctx.clip(end);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = stripe(i * 2 + 1);
      ctx.fillRect(hx - ew * 2, top + len * (0.25 + i * 0.25), ew * 4, len * 0.1);
    }
    ctx.restore();
  }
  P.strokeBody(ctx, end, sg, lw * 0.8);
  // fringe
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = Math.max(1.5, lw * 0.6);
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const fx = hx - ew / 2 - len * 0.12 + ((k + 0.5) / 4) * ew;
    ctx.beginPath();
    ctx.moveTo(fx, top + len);
    ctx.lineTo(fx - th * 0.05, top + len + th * 0.35);
    ctx.stroke();
  }
  ctx.restore();
  // band around the neck
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2 + sag;
  const band = makePath();
  band.moveTo(x0, y0 - th / 2);
  band.quadraticCurveTo(mx, my - th / 2, x1, y1 - th / 2);
  band.quadraticCurveTo(x1 + th * 0.35, y1, x1, y1 + th / 2);
  band.quadraticCurveTo(mx, my + th / 2, x0, y0 + th / 2);
  band.quadraticCurveTo(x0 - th * 0.35, y0, x0, y0 - th / 2);
  band.closePath();
  ctx.fillStyle = col;
  ctx.fill(band);
  ctx.save();
  ctx.clip(band);
  if (striped) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      if (!g.rainbow && i % 2 === 0) continue;
      ctx.fillStyle = stripe(i);
      const x = x0 + ((x1 - x0) * i) / n;
      ctx.fillRect(x, Math.min(y0, y1, my) - th * 2, ((x1 - x0) / n) * (g.rainbow ? 1.02 : 0.5), th * 5);
    }
  }
  // knit texture
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = Math.max(1, lw * 0.4);
  for (let x = x0; x < x1; x += th * 0.35) {
    ctx.beginPath();
    ctx.moveTo(x, my - th);
    ctx.lineTo(x + th * 0.15, my + th);
    ctx.stroke();
  }
  ctx.restore();
  P.strokeBody(ctx, band, sg, lw * 0.8);
}

function face(ctx: Ctx, g: Genome, fx: number, fy: number, er: number): P.EyeInfo[] {
  const eyes: P.EyeInfo[] = [];
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.6, fy - er * 0.2, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.35, fy + er * 1.3, er * 0.55);
  return eyes;
}

function sparkles(ctx: Ctx, g: Genome, cx: number, cy: number, r: number): void {
  if (!g.sparkle) return;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.9 + i * 0.6 + g.r() * 0.3;
    P.sparkleStar(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * (0.09 + g.r() * 0.05));
  }
}

export function winterSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const kind = g.variant % 4;
  if (kind === 0) return snowman(g, sticker);
  if (kind === 1) return penguin(g, sticker);
  if (kind === 2) return bear(g, sticker);
  return hare(g, sticker);
}

function snowman(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g.size;
  const r1 = L * 0.27;
  const r2 = L * 0.19;
  const W = Math.ceil(r1 * 2 + L * 0.62);
  const H = Math.ceil(r1 * 2 + r2 * 1.7 + L * 0.42);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.04;
  const cy = H - r1 - L * 0.03;
  const hx = cx + r1 * 0.1;
  const hy = cy - r1 - r2 * 0.68;
  const kg = tinted(g, 205, 0.45, 0.94);
  const og = outliner(kg, 0.28);
  if (g.sparkle) P.aura(ctx, cx, cy - r1 * 0.6, r1 * 1.55, g.hue + 20);

  // stick arms
  ctx.save();
  ctx.strokeStyle = '#7a5232';
  ctx.lineWidth = lw * 1.3;
  ctx.lineCap = 'round';
  const droop = g.wobble > 0.4 ? 0.35 : 0;
  for (const [sx, dir] of [
    [cx - r1 * 0.75, -1],
    [cx + r1 * 0.75, 1],
  ] as const) {
    const ex = sx + dir * L * 0.26;
    const ey = cy - r1 * (0.75 - (dir > 0 ? droop : -droop * 0.5));
    ctx.beginPath();
    ctx.moveTo(sx, cy - r1 * 0.35);
    ctx.lineTo(ex, ey);
    ctx.moveTo(sx + dir * L * 0.16, (cy - r1 * 0.35 + ey) / 2 + L * 0.005);
    ctx.lineTo(sx + dir * L * 0.21, ey - L * 0.07);
    ctx.stroke();
  }
  ctx.restore();

  // bottom ball
  const body = P.blobPath({ cx, cy, rx: r1, ry: r1 * 0.95, g });
  P.shadeBody(ctx, body, kg, cx, cy, r1, r1);
  P.pattern(ctx, body, g, cx, cy, r1, r1, 'rgba(150,200,240,0.45)');
  P.crumpleFacets(ctx, body, g, cx, cy, r1, r1);
  if (g.glossy) P.gloss(ctx, cx, cy, r1, r1, 0.5);
  P.strokeBody(ctx, body, og, lw);
  const badgeAt = { x: cx, y: cy + r1 * 0.08, r: r1 * 0.58 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head
  const head = P.blobPath({ cx: hx, cy: hy, rx: r2, ry: r2 * 0.95, g });
  P.shadeBody(ctx, head, kg, hx, hy, r2, r2);
  P.crumpleFacets(ctx, head, g, hx, hy, r2, r2);
  if (g.glossy) P.gloss(ctx, hx, hy, r2, r2, 0.45);
  P.strokeBody(ctx, head, og, lw);

  // scarf between the balls
  scarf(ctx, g, hx - r2 * 0.95, hy + r2 * 0.78, hx + r2 * 0.95, hy + r2 * 0.78, r2 * 0.12, r2 * 0.36, lw, hx - r2 * 0.55, r1 * 0.75);

  // face: eye, carrot nose, coal smile
  const er = r2 * (0.34 + 0.06 * g.q);
  const eyes = face(ctx, g, hx + r2 * 0.28, hy - r2 * 0.12, er);
  const nose = makePath();
  const nb = hx + r2 * 0.72;
  const ny = hy + r2 * 0.12;
  nose.moveTo(nb, ny - r2 * 0.14);
  nose.quadraticCurveTo(nb + r2 * 0.6, ny - r2 * 0.02, nb + r2 * (g.wobble > 0.4 ? 0.75 : 0.9), ny + r2 * 0.04);
  nose.quadraticCurveTo(nb + r2 * 0.5, ny + r2 * 0.12, nb, ny + r2 * 0.14);
  nose.closePath();
  ctx.fillStyle = hsl(26, 0.9 * clamp(g.sat / 0.6, 0.6, 1), 0.55);
  ctx.fill(nose);
  ctx.save();
  ctx.strokeStyle = 'rgba(150,60,10,0.6)';
  ctx.lineWidth = Math.max(1, lw * 0.5);
  ctx.stroke(nose);
  ctx.restore();
  ctx.fillStyle = '#3a3440';
  for (let i = 0; i < 4; i++) {
    const a = 0.35 * Math.PI + i * 0.13 * Math.PI;
    ctx.beginPath();
    ctx.arc(hx + r2 * 0.35 + Math.cos(a) * r2 * 0.42, hy + r2 * 0.05 + Math.sin(a) * r2 * 0.42, lw * 0.75, 0, TAU);
    ctx.fill();
  }

  // bobble hat in g.hue
  const hatCol = hsl(g.hue, Math.max(0.3, g.sat), 0.55);
  const hatG: Genome = { ...g, light: 0.55 };
  const hb = hy - r2 * 0.58;
  const hat = makePath();
  hat.moveTo(hx - r2 * 0.9, hb);
  hat.quadraticCurveTo(hx - r2 * 0.85, hb - r2 * 1.05, hx + r2 * 0.05, hb - r2 * 1.0);
  hat.quadraticCurveTo(hx + r2 * 0.85, hb - r2 * 0.95, hx + r2 * 0.88, hb);
  hat.closePath();
  ctx.fillStyle = hatCol;
  ctx.fill(hat);
  P.pattern(ctx, hat, g, hx, hb - r2 * 0.5, r2 * 0.9, r2 * 0.5);
  P.strokeBody(ctx, hat, hatG, lw);
  const brim = makePath();
  brim.roundRect(hx - r2 * 0.98, hb - r2 * 0.22, r2 * 1.96, r2 * 0.34, r2 * 0.17);
  ctx.fillStyle = g.rainbow ? RAINBOW[4] : hsl(g.hue2, Math.max(0.3, g.sat), 0.82);
  ctx.fill(brim);
  P.strokeBody(ctx, brim, hatG, lw * 0.8);
  const px = hx - r2 * 0.05;
  const py = hb - r2 * 1.08;
  const pom = makePath();
  pom.arc(px, py, r2 * 0.24, 0, TAU);
  ctx.fillStyle = g.rainbow ? RAINBOW[2] : '#fbfbff';
  ctx.fill(pom);
  P.strokeBody(ctx, pom, og, lw * 0.8);

  if (g.bandaid) P.bandaid(ctx, cx + r1 * 0.55, cy - r1 * 0.5, L * 0.14, 0.5);
  if (g.crown) P.crown(ctx, px, py - r2 * 0.1, L * 0.17, 0.12);
  sparkles(ctx, g, cx, cy - r1 * 0.7, r1 * 1.3);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: r1,
    eyes,
    lid: P.bodyColor(kg, 0.02),
    top: { x: px, y: py - r2 * 0.3 },
  };
}

function penguin(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g.size;
  const rx = L * 0.24;
  const ry = L * 0.33;
  const W = Math.ceil(rx * 2 + L * 0.5);
  const H = Math.ceil(ry * 2 + L * 0.35);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.04;
  const cy = H - ry - L * 0.08;
  const kg = tinted(g, 214 + ((g.hue % 40) - 20), 0.42, 0.3);
  if (g.sparkle) P.aura(ctx, cx, cy, ry * 1.25, g.hue + 20);

  // feet
  const orange = hsl(30, 0.95 * clamp(g.sat / 0.6, 0.55, 1), 0.56);
  for (const [fx, f] of [
    [cx - rx * 0.3, 1],
    [cx + rx * 0.35, g.wobble > 0.4 ? 0.75 : 1],
  ] as const) {
    const foot = makePath();
    foot.ellipse(fx + rx * 0.15, cy + ry * 0.95, rx * 0.36 * f, rx * 0.15, 0, 0, TAU);
    ctx.fillStyle = orange;
    ctx.fill(foot);
    P.strokeBody(ctx, foot, { ...g, hue: 25, light: 0.6, sat: 0.8 }, lw * 0.8);
  }

  // egg body, a bit narrower on top
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 - 0.08 * Math.max(0, -Math.sin(th)) });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(kg.hue, 0.4, 0.45, 0.6));
  // white belly and face
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = '#fbfcff';
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.2, cy + ry * 0.22, rx * 0.72, ry * 0.68, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.42, cy - ry * 0.48, rx * 0.5, ry * 0.3, 0.1, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.35);
  P.strokeBody(ctx, body, kg, lw);
  const badgeAt = { x: cx + rx * 0.2, y: cy + ry * 0.28, r: rx * 0.52 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // flipper on the side
  const fl = makePath();
  fl.ellipse(cx - rx * 0.55, cy + ry * 0.05, rx * 0.2, ry * 0.42, g.wobble > 0.4 ? 0.55 : 0.3, 0, TAU);
  ctx.fillStyle = P.bodyColor(kg, -0.05);
  ctx.fill(fl);
  P.strokeBody(ctx, fl, kg, lw * 0.8);

  // scarf
  scarf(ctx, g, cx - rx * 0.9, cy - ry * 0.18, cx + rx * 0.92, cy - ry * 0.2, ry * 0.08, rx * 0.36, lw, cx - rx * 0.45, ry * 0.5);

  // face and beak
  const er = rx * (0.3 + 0.05 * g.q);
  const eyes = face(ctx, g, cx + rx * 0.42, cy - ry * 0.52, er);
  const beak = makePath();
  const bx = cx + rx * 0.82;
  const by = cy - ry * 0.4;
  beak.moveTo(bx, by - rx * 0.14);
  beak.quadraticCurveTo(bx + rx * 0.35, by - rx * 0.05, bx + rx * 0.5, by + rx * 0.03);
  beak.quadraticCurveTo(bx + rx * 0.3, by + rx * 0.15, bx, by + rx * 0.14);
  beak.closePath();
  ctx.fillStyle = orange;
  ctx.fill(beak);
  P.strokeBody(ctx, beak, { ...g, hue: 25, light: 0.6, sat: 0.8 }, lw * 0.7);

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.2, cy - ry * 0.7, L * 0.13, -0.4);
  if (g.crown) P.crown(ctx, cx + rx * 0.05, cy - ry * 0.92, L * 0.17, 0.12);
  sparkles(ctx, g, cx, cy, ry * 1.1);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.15,
    eyes,
    lid: '#fbfcff',
    top: { x: cx + rx * 0.05, y: cy - ry * 1.15 },
  };
}

function bear(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 210 * g.size;
  const rx = L * 0.33;
  const ry = L * 0.21;
  const legLen = L * 0.12;
  const W = Math.ceil(rx * 2 + L * 0.55);
  const H = Math.ceil(ry * 2 + legLen + L * 0.42);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.1;
  const cy = H - legLen - ry - L * 0.04;
  const kg = tinted(g, 44, 0.45, 0.92);
  const og = outliner(kg, 0.3);
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - L * 0.08, rx * 1.4, g.hue + 20);

  const legs: [number, number, number][] = [
    [cx - rx * 0.6, 0.92, -0.07],
    [cx + rx * 0.4, 0.92, -0.07],
    [cx - rx * 0.4, 1, 0],
    [cx + rx * 0.62, g.wobble > 0.4 ? 0.72 : 1, 0],
  ];
  for (const [lx, f, dl] of legs) {
    const lp = makePath();
    const w = L * 0.095;
    lp.roundRect(lx - w / 2, cy + ry * 0.3, w, ry * 0.7 + legLen * f, w / 2);
    ctx.fillStyle = P.bodyColor(kg, dl);
    ctx.fill(lp);
    P.strokeBody(ctx, lp, og, lw * 0.8);
  }
  // stubby tail
  const tail = makePath();
  tail.arc(cx - rx * 0.98, cy - ry * 0.25, L * 0.04, 0, TAU);
  ctx.fillStyle = P.bodyColor(kg, -0.03);
  ctx.fill(tail);
  P.strokeBody(ctx, tail, og, lw * 0.8);

  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, 'rgba(160,205,240,0.45)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, og, lw);
  const badgeAt = { x: cx - rx * 0.15, y: cy + ry * 0.05, r: ry * 0.64 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  const hr = L * 0.14;
  const hx = cx + rx * 0.98;
  const hy = cy - ry * 0.65;
  // ears
  for (const ex of [-0.6, 0.15]) {
    const e = makePath();
    e.arc(hx + ex * hr, hy - hr * 0.82, hr * 0.3, 0, TAU);
    ctx.fillStyle = P.bodyColor(kg, -0.03);
    ctx.fill(e);
    P.strokeBody(ctx, e, og, lw * 0.8);
    ctx.fillStyle = 'rgba(255,170,190,0.5)';
    ctx.beginPath();
    ctx.arc(hx + ex * hr, hy - hr * 0.8, hr * 0.15, 0, TAU);
    ctx.fill();
  }
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.05, ry: hr * 0.95, g });
  P.shadeBody(ctx, head, kg, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, og, lw);
  // scarf around the neck, under the chin
  scarf(ctx, g, hx - hr * 1.0, hy + hr * 0.5, hx + hr * 0.4, hy + hr * 0.95, hr * 0.15, hr * 0.42, lw, hx - hr * 0.55, ry * 0.8);
  // muzzle
  const muz = makePath();
  muz.ellipse(hx + hr * 0.72, hy + hr * 0.3, hr * 0.48, hr * 0.36, 0, 0, TAU);
  ctx.fillStyle = P.bodyColor(kg, 0.05);
  ctx.fill(muz);
  P.strokeBody(ctx, muz, og, lw * 0.7);
  ctx.fillStyle = '#2f2733';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 1.05, hy + hr * 0.17, hr * 0.16, hr * 0.12, 0, 0, TAU);
  ctx.fill();
  P.mouth(ctx, hx + hr * 0.82, hy + hr * 0.45, hr * 0.32, g.wobble > 0.4 ? 'wavy' : 'cat');
  const er = hr * (0.34 + 0.06 * g.q);
  const eyes = face(ctx, g, hx + hr * 0.2, hy - hr * 0.22, er);

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.2, cy - ry * 0.5, L * 0.15, 0.35);
  if (g.crown) P.crown(ctx, hx - hr * 0.2, hy - hr * 1.0, L * 0.17, 0.15);
  sparkles(ctx, g, cx + rx * 0.2, cy - ry * 0.3, rx * 1.15);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(kg, 0.04),
    top: { x: hx - hr * 0.2, y: hy - hr * 1.6 },
  };
}

function hare(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 190 * g.size;
  const rx = L * 0.26;
  const ry = L * 0.23;
  const W = Math.ceil(rx * 2 + L * 0.45);
  const H = Math.ceil(ry * 2 + L * 0.68);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.08;
  const cy = H - ry - L * 0.05;
  const brown = g.hue > 220;
  const kg = brown ? tinted(g, 30, 0.35, 0.8) : tinted(g, 215, 0.35, 0.95);
  const og = outliner(kg, brown ? 0.36 : 0.3);
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - ry * 0.4, rx * 1.55, g.hue + 20);

  // pompom tail
  const tail = makePath();
  tail.arc(cx - rx * 0.95, cy - ry * 0.05, L * 0.065, 0, TAU);
  ctx.fillStyle = '#ffffff';
  ctx.fill(tail);
  P.strokeBody(ctx, tail, og, lw * 0.8);

  // sitting body
  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, brown ? 'rgba(255,240,220,0.5)' : 'rgba(160,205,240,0.45)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, og, lw);
  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.02, r: ry * 0.6 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  // big back foot and a front paw
  const foot = makePath();
  foot.ellipse(cx + rx * 0.05, cy + ry * 0.88, rx * 0.5, ry * 0.18, 0, 0, TAU);
  ctx.fillStyle = P.bodyColor(kg, 0.03);
  ctx.fill(foot);
  P.strokeBody(ctx, foot, og, lw * 0.8);
  const paw = makePath();
  paw.ellipse(cx + rx * 0.78, cy + ry * 0.8, rx * 0.2, ry * 0.2, 0, 0, TAU);
  ctx.fill(paw);
  P.strokeBody(ctx, paw, og, lw * 0.8);

  const hr = L * 0.14;
  const hx = cx + rx * 0.72;
  const hy = cy - ry * 0.95;
  // long ears
  const tilt = g.wobble > 0.4 ? 0.5 : 0.18;
  for (const [ex, a] of [
    [-0.35, -0.3 - tilt * 0.3],
    [0.15, tilt * 0.4],
  ] as const) {
    ctx.save();
    ctx.translate(hx + ex * hr, hy - hr * 0.6);
    ctx.rotate(a);
    const e = makePath();
    e.ellipse(0, -hr * 0.85, hr * 0.28, hr * 0.95, 0, 0, TAU);
    ctx.fillStyle = P.bodyColor(kg, -0.02);
    ctx.fill(e);
    ctx.fillStyle = 'rgba(255,160,185,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, -hr * 0.8, hr * 0.13, hr * 0.68, 0, 0, TAU);
    ctx.fill();
    P.strokeBody(ctx, e, og, lw * 0.8);
    ctx.restore();
  }
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.05, ry: hr, g });
  P.shadeBody(ctx, head, kg, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, og, lw);
  scarf(ctx, g, hx - hr * 0.85, hy + hr * 0.82, hx + hr * 0.75, hy + hr * 0.95, hr * 0.12, hr * 0.38, lw, hx - hr * 0.55, ry * 0.7);
  // nose, mouth, whiskers
  ctx.fillStyle = '#ff8fa8';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.98, hy + hr * 0.1, hr * 0.12, hr * 0.09, 0, 0, TAU);
  ctx.fill();
  P.mouth(ctx, hx + hr * 0.82, hy + hr * 0.38, hr * 0.3, g.wobble > 0.4 ? 'wavy' : 'cat');
  ctx.save();
  ctx.strokeStyle = 'rgba(80,70,90,0.45)';
  ctx.lineWidth = Math.max(1, lw * 0.4);
  for (const dy of [-0.06, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.95, hy + hr * (0.18 + dy));
    ctx.lineTo(hx + hr * 1.35, hy + hr * (0.12 + dy * 2));
    ctx.stroke();
  }
  ctx.restore();
  const er = hr * (0.34 + 0.06 * g.q);
  const eyes = face(ctx, g, hx + hr * 0.25, hy - hr * 0.2, er);

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.3, cy - ry * 0.45, L * 0.14, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.1, hy - hr * 0.9, L * 0.16, 0.12);
  sparkles(ctx, g, cx + rx * 0.2, cy - ry * 0.5, rx * 1.3);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(kg, 0.03),
    top: { x: hx - hr * 0.1, y: hy - hr * 2.4 },
  };
}

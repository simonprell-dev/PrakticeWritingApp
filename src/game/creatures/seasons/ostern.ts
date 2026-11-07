// Easter creatures (side view, facing right): Easter bunny, chick (sometimes still half in its shell),
// painted egg with a face, lamb. Bows, shells and egg paint come in g.hue.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { clamp, hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

export const OSTERN_KINDS = ['Osterhase', 'Küken', 'Osterei', 'Lämmchen'];

const RAINBOW = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];

/** the genome with the colours of the kind; paler on low tiers like the other worlds */
function tinted(g: Genome, hue: number, sat: number, light: number): Genome {
  const f = clamp(g.sat / 0.75, 0.35, 1.15);
  return { ...g, hue, sat: sat * f, light };
}

/** outline in a darker shade (light bodies would get a too faint one otherwise) */
function outliner(kg: Genome, dl: number): Genome {
  return { ...kg, light: kg.light - dl };
}

/** soft scalloped outline for fluffy chicks and woolly lambs */
const fluffy = (n: number, a: number) => (th: number) => 1 + a * Math.abs(Math.sin(th * (n / 2)));

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

/** a ribbon bow in g.hue (rainbow on the very best), knot at (x, y) */
function bow(ctx: Ctx, g: Genome, x: number, y: number, s: number, lw: number): void {
  const col = g.rainbow ? RAINBOW[0] : hsl(g.hue, Math.max(0.35, g.sat), 0.6);
  const col2 = g.rainbow ? RAINBOW[4] : hsl(g.hue, Math.max(0.35, g.sat), 0.5);
  const og: Genome = { ...g, sat: Math.max(0.35, g.sat), light: 0.6 };
  const droop = g.wobble > 0.4 ? 0.35 : 0;
  // tails
  for (const [dx, a] of [
    [-0.25, 0.35],
    [0.25, -0.3 - droop],
  ] as const) {
    const t = makePath();
    t.moveTo(x, y);
    t.lineTo(x + dx * s - Math.sin(a) * s * 0.9, y + s * 0.9);
    t.lineTo(x + dx * s - Math.sin(a) * s * 0.9 + s * 0.3, y + s * 0.8);
    t.closePath();
    ctx.fillStyle = col2;
    ctx.fill(t);
    P.strokeBody(ctx, t, og, lw * 0.7);
  }
  // loops
  for (const side of [-1, 1]) {
    const l = makePath();
    l.moveTo(x, y);
    l.quadraticCurveTo(x + side * s * 0.9, y - s * (0.75 - (side > 0 ? droop : 0)), x + side * s * 0.95, y + s * 0.05);
    l.quadraticCurveTo(x + side * s * 0.8, y + s * 0.55, x, y);
    l.closePath();
    ctx.fillStyle = side < 0 && g.rainbow ? RAINBOW[2] : col;
    ctx.fill(l);
    P.strokeBody(ctx, l, og, lw * 0.7);
  }
  const k = makePath();
  k.ellipse(x, y, s * 0.24, s * 0.28, 0, 0, TAU);
  ctx.fillStyle = col2;
  ctx.fill(k);
  P.strokeBody(ctx, k, og, lw * 0.7);
}

export function osternSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const kind = g.variant % 4;
  if (kind === 0) return bunny(g, sticker);
  if (kind === 1) return chick(g, sticker);
  if (kind === 2) return egg(g, sticker);
  return lamb(g, sticker);
}

// ------------------------------------------------------------------ Osterhase

function bunny(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g.size;
  const rx = L * 0.27;
  const ry = L * 0.25;
  const hr = L * 0.15;
  const earLen = hr * 2.1;
  const W = Math.ceil(rx * 2 + L * 0.55);
  const H = Math.ceil(ry * 2 + hr * 1.3 + earLen + L * 0.12);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.1;
  const cy = H - ry - L * 0.05;
  // caramel, light grey or cream white
  const fur = g.hue < 150 ? 1 : g.hue < 260 ? 2 : 0;
  const kg = fur === 1 ? tinted(g, 30, 0.5, 0.64) : fur === 2 ? tinted(g, 30, 0.1, 0.78) : tinted(g, 40, 0.35, 0.93);
  const og = outliner(kg, fur === 0 ? 0.36 : 0.4);
  const hx = cx + rx * 0.68;
  const hy = cy - ry * 0.9 - hr * 0.35;
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - ry * 0.6, rx * 1.6, g.hue + 20);

  // pompom tail
  const tail = P.blobPath({ cx: cx - rx * 0.95, cy: cy + ry * 0.05, rx: L * 0.075, ry: L * 0.075, g, shape: fluffy(8, 0.12) });
  ctx.fillStyle = '#ffffff';
  ctx.fill(tail);
  P.strokeBody(ctx, tail, og, lw * 0.8);

  // long ears behind the head; a crumpled bunny has one floppy ear
  const flop = g.wobble > 0.4;
  for (const [ex, a] of [
    [-0.4, -0.38],
    [0.15, flop ? 1.25 : 0.12],
  ] as const) {
    ctx.save();
    ctx.translate(hx + ex * hr, hy - hr * 0.6);
    ctx.rotate(a);
    const e = makePath();
    e.ellipse(0, -earLen * 0.45, hr * 0.32, earLen * 0.55, 0, 0, TAU);
    ctx.fillStyle = P.bodyColor(kg, -0.03);
    ctx.fill(e);
    ctx.fillStyle = 'rgba(255,150,180,0.6)';
    ctx.beginPath();
    ctx.ellipse(0, -earLen * 0.42, hr * 0.15, earLen * 0.4, 0, 0, TAU);
    ctx.fill();
    P.strokeBody(ctx, e, og, lw * 0.8);
    ctx.restore();
  }

  // sitting body, wider at the bottom
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 + 0.08 * Math.sin(th) });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  // light belly
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = fur === 0 ? 'rgba(255,255,255,0.6)' : hsl(35, 0.45, 0.92, 0.75);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.35, cy + ry * 0.2, rx * 0.6, ry * 0.75, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, fur === 1 ? 'rgba(255,240,220,0.45)' : hsl(g.hue, 0.6, 0.8, 0.4));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, og, lw);
  const badgeAt = { x: cx - rx * 0.05, y: cy + ry * 0.1, r: ry * 0.6 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // big back foot and a front paw
  const foot = makePath();
  foot.ellipse(cx - rx * 0.05, cy + ry * 0.9, rx * 0.55, ry * 0.18, 0, 0, TAU);
  ctx.fillStyle = P.bodyColor(kg, 0.04);
  ctx.fill(foot);
  P.strokeBody(ctx, foot, og, lw * 0.8);
  const paw = makePath();
  paw.ellipse(cx + rx * 0.8, cy + ry * 0.82, rx * 0.2, ry * 0.18, 0, 0, TAU);
  ctx.fill(paw);
  P.strokeBody(ctx, paw, og, lw * 0.8);

  // head
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.08, ry: hr, g });
  P.shadeBody(ctx, head, kg, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  if (g.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.35);
  P.strokeBody(ctx, head, og, lw);
  // muzzle, nose, teeth, whiskers
  ctx.fillStyle = fur === 0 ? '#ffffff' : hsl(35, 0.45, 0.92);
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.72, hy + hr * 0.3, hr * 0.36, hr * 0.28, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ff7f9f';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 1.0, hy + hr * 0.12, hr * 0.13, hr * 0.1, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(80,60,70,0.6)';
  ctx.lineWidth = Math.max(1, lw * 0.4);
  ctx.beginPath();
  ctx.roundRect(hx + hr * 0.74, hy + hr * 0.42, hr * 0.2, hr * 0.22, hr * 0.05);
  ctx.fill();
  ctx.stroke();
  P.mouth(ctx, hx + hr * 0.84, hy + hr * 0.38, hr * 0.32, flop ? 'wavy' : 'cat');
  ctx.save();
  ctx.strokeStyle = 'rgba(80,70,90,0.45)';
  ctx.lineWidth = Math.max(1, lw * 0.4);
  for (const dy of [-0.06, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.95, hy + hr * (0.25 + dy));
    ctx.lineTo(hx + hr * 1.4, hy + hr * (0.18 + dy * 2));
    ctx.stroke();
  }
  ctx.restore();
  const er = hr * (0.34 + 0.06 * g.q);
  const eyes = face(ctx, g, hx + hr * 0.22, hy - hr * 0.2, er);
  // bow at the neck
  bow(ctx, g, hx - hr * 0.5, hy + hr * 0.95, hr * 0.55, lw);

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.35, cy - ry * 0.35, L * 0.14, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.05, hy - hr * 0.82, L * 0.16, 0.12);
  sparkles(ctx, g, cx + rx * 0.2, cy - ry * 0.6, rx * 1.35);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(kg, 0.03),
    top: { x: hx - hr * 0.05, y: hy - hr * 1.5 },
  };
}

// ------------------------------------------------------------------ Küken

/** the lower half of an egg shell with a zigzag rim */
function shellPath(cx: number, top: number, rx: number, depth: number, teeth: number, wob: number, seed: number): Path2D {
  const p = makePath();
  p.moveTo(cx - rx, top);
  for (let i = 1; i <= teeth * 2; i++) {
    const x = cx - rx + (i / (teeth * 2)) * rx * 2;
    const j = wob * Math.sin(i * 2.7 + seed) * rx * 0.08;
    p.lineTo(x, top + (i % 2 ? -rx * 0.2 : 0) + j);
  }
  p.bezierCurveTo(cx + rx * 1.02, top + depth * 0.75, cx + rx * 0.55, top + depth, cx, top + depth);
  p.bezierCurveTo(cx - rx * 0.55, top + depth, cx - rx * 1.02, top + depth * 0.75, cx - rx, top);
  p.closePath();
  return p;
}

function chick(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 205 * g.size;
  const r = L * 0.29;
  const hr = L * 0.19;
  const inShell = g.hue < 140;
  const W = Math.ceil(r * 2 + L * 0.55);
  const H = Math.ceil(r * 2.1 + hr * 1.7 + L * 0.3);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.06;
  const cy = H - r * 1.12 - L * 0.04;
  const kg = tinted(g, 50 + ((g.hue % 14) - 7), 0.95, 0.64);
  const og = outliner(kg, 0.3);
  const orange = hsl(28, 0.95 * clamp(g.sat / 0.6, 0.55, 1), 0.56);
  const og2: Genome = { ...g, hue: 22, light: 0.62, sat: 0.8 };
  const hx = cx + r * 0.42;
  const hy = cy - r * 0.78;
  if (g.sparkle) P.aura(ctx, cx, cy - r * 0.4, r * 1.75, g.hue + 20);

  // feet (hidden in the shell)
  if (!inShell) {
    ctx.save();
    ctx.strokeStyle = orange;
    ctx.lineWidth = lw * 1.4;
    ctx.lineCap = 'round';
    for (const [fx, f] of [
      [cx - r * 0.3, 1],
      [cx + r * 0.25, g.wobble > 0.4 ? 0.7 : 1],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(fx, cy + r * 0.8);
      ctx.lineTo(fx, cy + r * (0.8 + 0.25 * f));
      for (const a of [-0.5, 0, 0.5]) {
        ctx.moveTo(fx, cy + r * (0.8 + 0.25 * f));
        ctx.lineTo(fx + r * 0.2 * Math.cos(a) + r * 0.05, cy + r * (0.8 + 0.25 * f) + r * 0.08 * Math.sin(a) + r * 0.04);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // round fluffy body
  const body = P.blobPath({ cx, cy, rx: r, ry: r * 0.92, g, shape: fluffy(14, 0.05) });
  P.shadeBody(ctx, body, kg, cx, cy, r, r);
  if (!inShell) P.pattern(ctx, body, g, cx, cy, r, r, 'rgba(255,255,255,0.4)');
  P.crumpleFacets(ctx, body, g, cx, cy, r, r);
  if (g.glossy) P.gloss(ctx, cx, cy, r, r, 0.4);
  P.strokeBody(ctx, body, og, lw);

  // head with a feather tuft
  const tuft = makePath();
  for (const [dx, a, l] of [
    [-0.15, -0.5, 0.55],
    [0.05, -0.1, 0.7],
    [0.25, 0.35, 0.5],
  ] as const) {
    const bx = hx + dx * hr;
    const by = hy - hr * 0.8;
    tuft.moveTo(bx - hr * 0.1, by + hr * 0.1);
    tuft.quadraticCurveTo(bx + Math.sin(a) * hr * l * 0.3 - hr * 0.15, by - hr * l * 0.8, bx + Math.sin(a) * hr * l, by - hr * l);
    tuft.quadraticCurveTo(bx + Math.sin(a) * hr * l * 0.3 + hr * 0.15, by - hr * l * 0.3, bx + hr * 0.1, by + hr * 0.1);
    tuft.closePath();
  }
  ctx.fillStyle = P.bodyColor(kg, 0.04);
  ctx.fill(tuft);
  P.strokeBody(ctx, tuft, og, lw * 0.7);
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr, ry: hr * 0.95, g, shape: fluffy(12, 0.04) });
  P.shadeBody(ctx, head, kg, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  if (g.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.4);
  P.strokeBody(ctx, head, og, lw);

  // beak
  const beak = makePath();
  const bx = hx + hr * 0.82;
  const by = hy + hr * 0.12;
  beak.moveTo(bx, by - hr * 0.2);
  beak.quadraticCurveTo(bx + hr * 0.3, by - hr * 0.1, bx + hr * (g.wobble > 0.4 ? 0.35 : 0.45), by + hr * 0.02);
  beak.quadraticCurveTo(bx + hr * 0.25, by + hr * 0.18, bx, by + hr * 0.2);
  beak.closePath();
  ctx.fillStyle = orange;
  ctx.fill(beak);
  P.strokeBody(ctx, beak, og2, lw * 0.7);
  const er = hr * (0.3 + 0.05 * g.q);
  const eyes = face(ctx, g, hx + hr * 0.3, hy - hr * 0.2, er);

  let badgeAt: { x: number; y: number; r: number };
  if (inShell) {
    // half an egg shell, painted in g.hue
    const sg = tinted(g, g.hue2, 0.55, 0.88);
    const sog = outliner(sg, 0.42);
    const shell = shellPath(cx, cy - r * 0.05, r * 1.12, r * 1.17, 5, g.wobble, g.seed);
    P.shadeBody(ctx, shell, sg, cx, cy + r * 0.5, r * 1.1, r * 0.7);
    ctx.save();
    ctx.clip(shell);
    const dc = g.rainbow ? null : hsl(g.hue, Math.max(0.35, g.sat), 0.62, 0.85);
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * (0.05 + (i / 6) * 0.9);
      ctx.fillStyle = dc ?? RAINBOW[i % RAINBOW.length];
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.95, cy + r * 0.05 + Math.sin(a) * r * 0.85, r * 0.09, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    P.crumpleFacets(ctx, shell, g, cx, cy + r * 0.5, r * 1.1, r * 0.6);
    if (g.glossy) P.gloss(ctx, cx, cy + r * 0.6, r * 1.1, r * 0.6, 0.35);
    P.strokeBody(ctx, shell, sog, lw);
    badgeAt = { x: cx, y: cy + r * 0.52, r: r * 0.46 };
  } else {
    // little wing
    const wing = P.blobPath({ cx: cx - r * 0.35, cy: cy + r * 0.05, rx: r * 0.32, ry: r * 0.42, g, shape: fluffy(6, 0.08) });
    ctx.save();
    ctx.translate(cx - r * 0.35, cy + r * 0.05);
    ctx.rotate(g.wobble > 0.4 ? 0.6 : 0.35);
    ctx.translate(-(cx - r * 0.35), -(cy + r * 0.05));
    ctx.fillStyle = P.bodyColor(kg, -0.04);
    ctx.fill(wing);
    P.strokeBody(ctx, wing, og, lw * 0.8);
    ctx.restore();
    badgeAt = { x: cx + r * 0.12, y: cy + r * 0.25, r: r * 0.5 };
  }
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  if (g.bandaid) P.bandaid(ctx, hx - hr * 0.4, hy - hr * 0.1, L * 0.13, -0.5);
  if (g.crown) P.crown(ctx, hx - hr * 0.05, hy - hr * 0.78, L * 0.16, 0.12);
  sparkles(ctx, g, cx, cy - r * 0.4, r * 1.45);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: r,
    eyes,
    lid: P.bodyColor(kg, 0.03),
    top: { x: hx - hr * 0.05, y: hy - hr * 1.5 },
  };
}

// ------------------------------------------------------------------ Osterei

type Deco = 'zigzag' | 'dots' | 'stripes' | 'waves';

/** one painted band around the egg at height y */
function decoBand(ctx: Ctx, kind: Deco, cx: number, y: number, rx: number, h: number, col: (i: number) => string, lw: number, wob: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const x0 = cx - rx * 1.2;
  const x1 = cx + rx * 1.2;
  if (kind === 'stripes') {
    ctx.fillStyle = col(0);
    ctx.fillRect(x0, y - h * 0.5, x1 - x0, h * 0.32);
    ctx.fillStyle = col(1);
    ctx.fillRect(x0, y + h * 0.18, x1 - x0, h * 0.32);
  } else if (kind === 'dots') {
    const n = 7;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = col(i);
      ctx.beginPath();
      ctx.arc(x0 + ((i + 0.5) / n) * (x1 - x0), y + wob * Math.sin(i * 3.1) * h * 0.25, h * 0.26, 0, TAU);
      ctx.fill();
    }
  } else {
    const n = kind === 'zigzag' ? 9 : 5;
    ctx.strokeStyle = col(0);
    ctx.lineWidth = Math.max(lw * 1.4, h * 0.3);
    ctx.beginPath();
    for (let i = 0; i <= n * 2; i++) {
      const x = x0 + (i / (n * 2)) * (x1 - x0);
      const yy = y + (i % 2 ? -h * 0.35 : h * 0.35) + wob * Math.sin(i * 2.3) * h * 0.2;
      if (i === 0) ctx.moveTo(x, yy);
      else if (kind === 'zigzag') ctx.lineTo(x, yy);
      else ctx.quadraticCurveTo(x - (x1 - x0) / (n * 4), yy + (i % 2 ? -h * 0.5 : h * 0.5), x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function egg(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 190 * g.size;
  const rx = L * 0.27;
  const ry = L * 0.35;
  const W = Math.ceil(rx * 2 + L * 0.42);
  const H = Math.ceil(ry * 2 + L * 0.34);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2;
  const cy = H - ry * 1.1 - L * 0.03;
  const kg = tinted(g, g.hue, 0.65, 0.74);
  const og = outliner(kg, 0.36);
  if (g.sparkle) P.aura(ctx, cx, cy, ry * 1.3, g.hue + 20);

  // little feet so it can stand
  for (const fx of [-0.35, 0.3]) {
    const f = makePath();
    f.ellipse(cx + rx * fx + rx * 0.1, cy + ry * 0.97, rx * 0.26, rx * 0.12, 0, 0, TAU);
    ctx.fillStyle = P.bodyColor(kg, -0.1);
    ctx.fill(f);
    P.strokeBody(ctx, f, og, lw * 0.8);
  }

  // egg shape: rounder at the bottom, a bit pointier on top
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 + 0.06 * Math.sin(th) - 0.07 * Math.max(0, -Math.sin(th)) * Math.abs(Math.cos(th)) });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  // painted bands: more and brighter the nicer the letter
  const r = g.r;
  const kinds: Deco[] = ['zigzag', 'dots', 'stripes', 'waves'];
  const k0 = kinds[Math.floor(r() * 4)];
  const k1 = kinds[(kinds.indexOf(k0) + 1 + Math.floor(r() * 3)) % 4];
  const c1 = (i: number) => (g.rainbow ? RAINBOW[i % RAINBOW.length] : hsl(g.hue2, Math.max(0.3, g.sat + 0.05), 0.5 + (i % 2) * 0.12));
  const c2 = (i: number) => (g.rainbow ? RAINBOW[(i + 3) % RAINBOW.length] : i % 2 ? '#ffffff' : hsl(g.hue + 50, Math.max(0.3, g.sat), 0.6));
  const gold = (i: number) => (i % 2 ? '#fff3a0' : '#f2b705');
  ctx.save();
  ctx.clip(body);
  const wob = g.wobble;
  decoBand(ctx, k0, cx, cy - ry * 0.68, rx, ry * 0.2, c1, lw, wob);
  if (g.wobble < 0.6) decoBand(ctx, k1, cx, cy + ry * 0.76, rx, ry * 0.2, c2, lw, wob);
  if (g.sparkle) {
    decoBand(ctx, 'stripes', cx, cy - ry * 0.47, rx, ry * 0.09, g.crown ? gold : c2, lw, 0);
    decoBand(ctx, 'dots', cx, cy + ry * 0.58, rx, ry * 0.12, g.crown ? gold : c1, lw, 0);
  }
  ctx.restore();
  if (!g.sparkle) P.pattern(ctx, body, g, cx, cy, rx, ry * 0.4, hsl(g.hue2, 0.5, 0.85, 0.5));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.5);
  P.strokeBody(ctx, body, og, lw);
  const badgeAt = { x: cx - rx * 0.18, y: cy + ry * 0.2, r: rx * 0.5 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // face on the upper right
  const er = rx * (0.26 + 0.04 * g.q);
  const fx = cx + rx * 0.42;
  const fy = cy - ry * 0.2;
  const eyes = face(ctx, g, fx, fy, er);
  P.mouth(ctx, fx + er * 0.5, fy + er * 1.55, er * 0.9, g.wobble > 0.4 ? 'wavy' : 'smile');

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.35, cy - ry * 0.35, L * 0.13, -0.6);
  if (g.crown) P.crown(ctx, cx + rx * 0.05, cy - ry * 0.92, L * 0.16, 0.12);
  sparkles(ctx, g, cx, cy - ry * 0.1, ry * 1.1);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.1,
    eyes,
    lid: P.bodyColor(kg, 0.04),
    top: { x: cx + rx * 0.05, y: cy - ry * 1.15 },
  };
}

// ------------------------------------------------------------------ Lämmchen

function lamb(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g.size;
  const rx = L * 0.31;
  const ry = L * 0.22;
  const legLen = L * 0.12;
  const W = Math.ceil(rx * 2 + L * 0.55);
  const H = Math.ceil(ry * 2 + legLen + L * 0.42);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W / 2 - L * 0.1;
  const cy = H - legLen - ry - L * 0.04;
  const kg = tinted(g, 45, 0.3, 0.93);
  const og = outliner(kg, 0.34);
  // dark face or soft pink one
  const dark = g.hue < 180;
  const fg = dark ? tinted(g, 20, 0.15, 0.32) : tinted(g, 10, 0.45, 0.84);
  const fog = outliner(fg, dark ? 0.12 : 0.4);
  const hr = L * 0.13;
  const hx = cx + rx * 1.0;
  const hy = cy - ry * 0.55;
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - L * 0.06, rx * 1.4, g.hue + 20);

  const legs: [number, number, number][] = [
    [cx - rx * 0.55, 0.92, -0.06],
    [cx + rx * 0.4, 0.92, -0.06],
    [cx - rx * 0.35, 1, 0],
    [cx + rx * 0.6, g.wobble > 0.4 ? 0.72 : 1, 0],
  ];
  for (const [lx, f, dl] of legs) {
    const lp = makePath();
    const w = L * 0.06;
    lp.roundRect(lx - w / 2, cy + ry * 0.3, w, ry * 0.7 + legLen * f, w / 2);
    ctx.fillStyle = P.bodyColor(fg, dl);
    ctx.fill(lp);
    P.strokeBody(ctx, lp, fog, lw * 0.8);
  }

  // woolly body
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: fluffy(16, 0.07) });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  // little curls
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = 'rgba(190,170,140,0.35)';
  ctx.lineWidth = Math.max(1.2, lw * 0.6);
  const rr = g.r;
  for (let i = 0; i < 14; i++) {
    const x = cx + (rr() * 2 - 1) * rx * 0.9;
    const y = cy + (rr() * 2 - 1) * ry * 0.85;
    ctx.beginPath();
    ctx.arc(x, y, L * 0.022, Math.PI * 0.2, Math.PI * 1.6);
    ctx.stroke();
  }
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, 0.6, 0.85, 0.45));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, body, og, lw);
  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.05, r: ry * 0.64 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // floppy ear behind the head
  const ear = makePath();
  ear.ellipse(hx - hr * 0.75, hy - hr * 0.1, hr * 0.5, hr * 0.22, g.wobble > 0.4 ? 0.9 : 0.45, 0, TAU);
  ctx.fillStyle = P.bodyColor(fg, -0.03);
  ctx.fill(ear);
  P.strokeBody(ctx, ear, fog, lw * 0.8);
  // head
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.1, ry: hr * 0.9, g, shape: (th) => 1 + 0.08 * Math.cos(th) });
  P.shadeBody(ctx, head, fg, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, fog, lw);
  // wool tuft on the head
  const tuft = P.blobPath({ cx: hx - hr * 0.25, cy: hy - hr * 0.75, rx: hr * 0.7, ry: hr * 0.42, g, shape: fluffy(10, 0.12) });
  P.shadeBody(ctx, tuft, kg, hx - hr * 0.25, hy - hr * 0.75, hr * 0.7, hr * 0.4);
  P.strokeBody(ctx, tuft, og, lw * 0.8);
  // nose and mouth
  ctx.fillStyle = dark ? 'rgba(20,10,10,0.8)' : '#e0708e';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 1.0, hy + hr * 0.12, hr * 0.12, hr * 0.08, 0, 0, TAU);
  ctx.fill();
  P.mouth(ctx, hx + hr * 0.78, hy + hr * 0.4, hr * 0.32, g.wobble > 0.4 ? 'wavy' : 'cat', dark ? '#f2e6e6' : '#3b2238');
  const er = hr * (0.36 + 0.06 * g.q);
  const eyes = face(ctx, g, hx + hr * 0.25, hy - hr * 0.12, er);
  // bow with a little golden bell
  const bx = hx - hr * 0.75;
  const by = hy + hr * 0.75;
  const bell = makePath();
  bell.arc(bx + hr * 0.05, by + hr * 0.45, hr * 0.24, 0, TAU);
  ctx.fillStyle = '#f5c518';
  ctx.fill(bell);
  P.strokeBody(ctx, bell, { ...g, hue: 40, sat: 0.9, light: 0.6 }, lw * 0.7);
  bow(ctx, g, bx, by, hr * 0.5, lw);

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.2, cy - ry * 0.5, L * 0.15, 0.35);
  if (g.crown) P.crown(ctx, hx - hr * 0.25, hy - hr * 1.05, L * 0.16, 0.15);
  sparkles(ctx, g, cx + rx * 0.2, cy - ry * 0.3, rx * 1.15);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(fg, 0.03),
    top: { x: hx - hr * 0.25, y: hy - hr * 1.6 },
  };
}

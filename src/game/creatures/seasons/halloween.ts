// Friendly Halloween folk (side view, facing right): a little ghost, a pumpkin head, a small witch on her
// broom and a black cat. Nothing really scary: round shapes, rosy cheeks, big smiles.
// The ghost waves its little arm, the pumpkin wiggles its leaf, the witch's cape flutters and the cat
// swishes its tail (the separate part).
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { clamp, hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

/** 0 Gespenst, 1 Kürbis, 2 Hexe, 3 Katze (the kind is variant % HALLOWEEN_KINDS) */
export const HALLOWEEN_KINDS = 4;
export const HALLOWEEN_KIND_NAMES = ['Gespenst', 'Kürbis', 'Hexe', 'Katze'];

const RAINBOW = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];

export function halloweenSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = g.variant % HALLOWEEN_KINDS;
  if (k === 0) return ghost(g, sticker);
  if (k === 1) return pumpkin(g, sticker);
  if (k === 2) return witch(g, sticker);
  return cat(g, sticker);
}

/** the genome in the colours of the kind; paler on low tiers like the other worlds */
function tinted(g: Genome, hue: number, sat: number, light: number): Genome {
  const f = clamp(g.sat / 0.75, 0.35, 1.15);
  return { ...g, hue, sat: Math.min(1, sat * f), light };
}

const h360 = (h: number) => ((h % 360) + 360) % 360;

function face(ctx: Ctx, g: Genome, x: number, y: number, er: number, eyes: P.EyeInfo[], second = true): void {
  if (second || g.eyeStyle === 'googly') eyes.push(P.eye(ctx, x - er * 1.75, y - er * 0.1, er * (g.eyeStyle === 'googly' ? 0.7 : 0.85), g.eyeStyle, g.r, [0.45, 0]));
  eyes.push(P.eye(ctx, x, y, er, g.eyeStyle, g.r, [0.45, 0]));
}

function sparkles(ctx: Ctx, g: Genome, cx: number, cy: number, r: number): void {
  if (!g.sparkle) return;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.9 + i * 0.6 + g.r() * 0.3;
    P.sparkleStar(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * (0.09 + g.r() * 0.05));
  }
}

function fillStroke(ctx: Ctx, p: Path2D, fill: string, og: Genome, lw: number): void {
  ctx.fillStyle = fill;
  ctx.fill(p);
  P.strokeBody(ctx, p, og, lw);
}

/** rainbow bands clipped to a path (top tier) */
function rainbowFill(ctx: Ctx, p: Path2D, x: number, y: number, w: number, h: number, alpha = 0.55): void {
  ctx.save();
  ctx.clip(p);
  ctx.globalAlpha = alpha;
  RAINBOW.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y + (i / RAINBOW.length) * h, w, h / RAINBOW.length + 1);
  });
  ctx.restore();
}

// ------------------------------------------------------------------------------------------ Gespenst

function ghost(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 195 * g.size;
  const rx = L * 0.32;
  const ry = L * 0.36;
  const W = Math.ceil(rx * 2 + L * 0.62);
  const H = Math.ceil(ry * 2 + L * 0.42);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.52;
  const cy = L * 0.2 + ry;
  // white with a soft tint (lavender, mint, peach ...), never grey
  const kg = tinted(g, g.hue, 0.3, 0.94);
  const og = tinted(g, g.hue, 0.35, 0.78);
  if (g.sparkle) P.aura(ctx, cx, cy, rx * 1.45, g.hue);

  // the body: a dome with a wavy hem that trails off to the back like a little tail
  const tailUp = g.wobble > 0.4 ? 0.1 : 0.32;
  const body = P.blobPath({
    cx,
    cy,
    rx,
    ry,
    g,
    points: 144,
    shape: (th) => {
      const s = Math.sin(th);
      if (s <= 0) return 1 - 0.08 * Math.pow(-s, 2) * Math.max(0, Math.cos(th));
      const hem = 1 + 0.07 * s * Math.sin(th * 9 + 0.6);
      const tail = 0.55 * Math.pow(Math.max(0, Math.cos(th - 2.45)), 10) * (1 - tailUp * Math.cos(th));
      return hem + tail;
    },
  });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  if (g.rainbow) rainbowFill(ctx, body, cx - rx * 2, cy - ry, rx * 3.2, ry * 2.4, 0.35);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue + 30, 0.7, 0.85, 0.6));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.7);
  P.strokeBody(ctx, body, og, lw);

  // the near little arm, resting on the belly
  const arm = makePath();
  arm.ellipse(cx - rx * 0.62, cy + ry * 0.12, rx * 0.2, rx * 0.13, 0.7, 0, TAU);
  P.shadeBody(ctx, arm, kg, cx - rx * 0.62, cy + ry * 0.12, rx * 0.2, rx * 0.13);
  P.strokeBody(ctx, arm, og, lw * 0.8);

  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.3, r: rx * 0.48 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null, hsl(g.hue, 0.4, 0.6, 0.5));

  // face up in the dome, looking forward
  const eyes: P.EyeInfo[] = [];
  const er = rx * (0.19 + 0.03 * g.q);
  face(ctx, g, cx + rx * 0.5, cy - ry * 0.38, er, eyes);
  P.blush(ctx, cx + rx * 0.68, cy - ry * 0.08, er * 0.65, 0.55);
  P.blush(ctx, cx - rx * 0.05, cy - ry * 0.1, er * 0.55, 0.45);
  // a round "Buh!" mouth, or a wavy one when shaky
  if (g.wobble > 0.4) P.mouth(ctx, cx + rx * 0.32, cy - ry * 0.04, rx * 0.3, 'wavy');
  else P.mouth(ctx, cx + rx * 0.34, cy - ry * 0.02, rx * 0.34, 'open');

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.45, cy - ry * 0.62, L * 0.14, -0.5);
  if (g.crown) P.crown(ctx, cx + rx * 0.05, cy - ry * 0.9, L * 0.17, 0.12);
  sparkles(ctx, g, cx, cy, rx * 1.35);

  // the far arm: waves (the moving part), pivot at the shoulder
  const as = rx * 0.6;
  const { canvas: ac, ctx: a } = makeCanvas(Math.ceil(as * 1.3), Math.ceil(as * 0.9));
  const px = as * 0.2;
  const py = as * 0.6;
  const far = makePath();
  far.moveTo(px - as * 0.1, py - as * 0.25);
  far.quadraticCurveTo(px + as * 0.6, py - as * 0.55, px + as * 1.0, py - as * 0.35);
  far.quadraticCurveTo(px + as * 1.15, py - as * 0.1, px + as * 0.95, py + as * 0.05);
  far.quadraticCurveTo(px + as * 0.5, py + as * 0.1, px - as * 0.1, py + as * 0.22);
  far.closePath();
  P.shadeBody(a, far, kg, px + as * 0.5, py - as * 0.1, as * 0.5, as * 0.3);
  P.strokeBody(a, far, og, lw * 0.8);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: ry * 1.05,
    eyes,
    lid: P.bodyColor(kg, 0.03),
    top: { x: cx + rx * 0.05, y: cy - ry * 1.05 },
    tail: { canvas: ac, pivotX: px, pivotY: py, px: cx + rx * 0.72, py: cy + ry * 0.12 },
  };
}

// -------------------------------------------------------------------------------------------- Kürbis

function pumpkin(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 190 * g.size;
  const rx = L * 0.4;
  const ry = L * 0.3;
  const W = Math.ceil(rx * 2 + L * 0.9);
  const H = Math.ceil(ry * 2 + L * 0.95);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.5;
  const cy = H - ry - L * 0.33;
  // orange, from red-orange to golden
  const kg = tinted(g, 16 + (h360(g.hue) % 26), 0.92, 0.56);
  const leafG = tinted(g, 110, 0.5, 0.42);
  const stemG = tinted(g, 70, 0.4, 0.38);
  if (g.sparkle) P.aura(ctx, cx, cy - ry * 0.2, rx * 1.15, 35);

  // the stem
  const sx = cx - rx * 0.05;
  const sy = cy - ry * 0.85;
  const stem = makePath();
  stem.moveTo(sx - L * 0.05, sy + L * 0.03);
  stem.quadraticCurveTo(sx - L * 0.04, sy - L * 0.1, sx + L * (g.wobble > 0.4 ? 0.07 : 0.03), sy - L * 0.16);
  stem.lineTo(sx + L * (g.wobble > 0.4 ? 0.12 : 0.08), sy - L * 0.13);
  stem.quadraticCurveTo(sx + L * 0.04, sy - L * 0.06, sx + L * 0.05, sy + L * 0.03);
  stem.closePath();
  P.shadeBody(ctx, stem, stemG, sx, sy - L * 0.06, L * 0.05, L * 0.08);
  P.strokeBody(ctx, stem, stemG, lw * 0.8);
  // a curly tendril
  ctx.save();
  ctx.strokeStyle = P.bodyColor(leafG, 0.08);
  ctx.lineWidth = lw * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const a = t * TAU * 1.4;
    const rr = L * (0.075 - t * 0.05);
    const x = sx + L * 0.06 + t * L * 0.1 + Math.cos(a) * rr;
    const y = sy - L * 0.06 - Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  // the round ribbed body with a dip at the top
  const body = P.blobPath({
    cx,
    cy,
    rx,
    ry,
    g,
    shape: (th) => {
      const s = Math.sin(th);
      const dip = 1 - 0.13 * Math.pow(Math.max(0, -s), 10);
      const lobes = 1 + 0.035 * Math.abs(Math.cos(th * 3));
      return dip * lobes * (s > 0 ? 1 - 0.05 * s : 1);
    },
  });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  if (g.rainbow) rainbowFill(ctx, body, cx - rx, cy - ry, rx * 2, ry * 2, 0.3);
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = hsl(kg.hue - 6, kg.sat, kg.light - 0.18, 0.55);
  ctx.lineWidth = Math.max(2, lw * 0.9);
  for (const o of [-0.62, -0.3, 0.02, 0.34, 0.66]) {
    ctx.beginPath();
    ctx.moveTo(cx + rx * o * 0.7, cy - ry * 0.88);
    ctx.quadraticCurveTo(cx + rx * o * 1.35, cy, cx + rx * o * 0.75, cy + ry * 0.95);
    ctx.stroke();
  }
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, 'rgba(255,230,160,0.4)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.5);
  P.strokeBody(ctx, body, kg, lw);

  const badgeAt = { x: cx - rx * 0.45, y: cy + ry * 0.12, r: ry * 0.5 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // a happy face on the front side
  const eyes: P.EyeInfo[] = [];
  const er = rx * (0.16 + 0.025 * g.q);
  face(ctx, g, cx + rx * 0.5, cy - ry * 0.25, er, eyes);
  P.blush(ctx, cx + rx * 0.72, cy + ry * 0.12, er * 0.65, 0.5);
  P.blush(ctx, cx + rx * 0.08, cy + ry * 0.12, er * 0.55, 0.4);
  // a big carved grin glowing from inside (no teeth)
  const mx = cx + rx * 0.4;
  const my = cy + ry * 0.3;
  const mw = rx * (g.wobble > 0.4 ? 0.3 : 0.38);
  const grin = makePath();
  grin.moveTo(mx - mw, my - mw * 0.15);
  grin.quadraticCurveTo(mx, my + mw * (g.wobble > 0.4 ? 0.4 : 0.95), mx + mw, my - mw * 0.25);
  grin.quadraticCurveTo(mx, my + mw * 0.2, mx - mw, my - mw * 0.15);
  grin.closePath();
  ctx.save();
  ctx.fillStyle = '#ffe27a';
  ctx.fill(grin);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = P.outlineColor(kg);
  ctx.lineWidth = lw * 0.8;
  ctx.lineJoin = 'round';
  ctx.stroke(grin);
  ctx.restore();

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.55, cy - ry * 0.55, L * 0.14, -0.4);
  if (g.crown) P.crown(ctx, cx + rx * 0.32, cy - ry * 0.82, L * 0.15, 0.18);
  sparkles(ctx, g, cx, cy - ry * 0.2, rx * 1.2);

  // the leaf: wiggles (the moving part), stalk at the stem
  const ls = L * 0.3;
  const { canvas: lc, ctx: l } = makeCanvas(Math.ceil(ls * 1.15), Math.ceil(ls * 0.85));
  const px = ls * 1.05;
  const py = ls * 0.7;
  const leaf = makePath();
  leaf.moveTo(px, py);
  leaf.quadraticCurveTo(px - ls * 0.2, py - ls * 0.62, px - ls * 0.62, py - ls * 0.58);
  leaf.quadraticCurveTo(px - ls * 0.72, py - ls * 0.42, px - ls * 0.95, py - ls * 0.36);
  leaf.quadraticCurveTo(px - ls * 0.8, py - ls * 0.18, px - ls * 0.88, py - ls * 0.02);
  leaf.quadraticCurveTo(px - ls * 0.45, py + ls * 0.05, px, py);
  leaf.closePath();
  P.shadeBody(l, leaf, leafG, px - ls * 0.5, py - ls * 0.3, ls * 0.45, ls * 0.3);
  l.save();
  l.clip(leaf);
  l.strokeStyle = 'rgba(30,80,30,0.4)';
  l.lineWidth = Math.max(1.5, lw * 0.6);
  l.beginPath();
  l.moveTo(px, py);
  l.quadraticCurveTo(px - ls * 0.4, py - ls * 0.2, px - ls * 0.85, py - ls * 0.3);
  l.stroke();
  l.restore();
  P.strokeBody(l, leaf, leafG, lw * 0.8);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(kg, 0.05),
    top: { x: cx + rx * 0.32, y: cy - ry * 0.95 },
    tail: { canvas: lc, pivotX: px, pivotY: py, px: sx - L * 0.02, py: sy - L * 0.02 },
  };
}

// ---------------------------------------------------------------------------------------------- Hexe

const SKIN: [number, number, number][] = [
  [28, 0.7, 0.84],
  [26, 0.55, 0.72],
  [24, 0.45, 0.55],
  [22, 0.4, 0.4],
];
const HAIR: [number, number, number][] = [
  [22, 0.75, 0.45],
  [30, 0.5, 0.28],
  [45, 0.8, 0.62],
  [260, 0.2, 0.18],
  [8, 0.7, 0.42],
];

function witch(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 195 * g.size;
  const W = Math.ceil(L * 1.3);
  const H = Math.ceil(L * 1.36);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.016);
  const cx = L * 0.62;
  const cy = L * 0.86;
  const rx = L * 0.2;
  const ry = L * 0.21;
  const shaky = g.wobble > 0.4;
  const dressG = tinted(g, g.hue, 0.6, 0.55);
  const hatG = tinted(g, g.hue, 0.55, 0.4);
  const capeG = tinted(g, g.hue + 180, 0.45, 0.45);
  const stripeHue = g.hue2;
  const [sh, ss, sl] = SKIN[Math.floor(h360(g.hue2) / 90) % SKIN.length];
  const skinG = tinted(g, sh, ss, sl);
  const skin = hsl(sh, ss, sl);
  const [hh, hs, hl] = HAIR[Math.floor(h360(g.hue2 * 3.7) / 72) % HAIR.length];
  const hairG = tinted(g, hh, hs, hl);
  const woodG = tinted(g, 28, 0.45, 0.42);
  const strawG = tinted(g, 44, 0.75, 0.62);
  if (g.sparkle) P.aura(ctx, cx, cy - ry * 0.8, L * 0.5, g.hue);

  // the broom: stick from the bristles at the back to the tip in front
  const by = cy + ry * 0.62;
  const tilt = shaky ? 0.07 : 0.02;
  const bx0 = cx - L * 0.38;
  const bx1 = cx + L * 0.58;
  const stick = makePath();
  stick.moveTo(bx0, by + L * 0.025 + (bx0 - cx) * -tilt);
  stick.lineTo(bx1, by + L * 0.02 + (bx1 - cx) * -tilt);
  stick.quadraticCurveTo(bx1 + L * 0.03, by + (bx1 - cx) * -tilt, bx1, by - L * 0.02 + (bx1 - cx) * -tilt);
  stick.lineTo(bx0, by - L * 0.02 + (bx0 - cx) * -tilt);
  stick.closePath();
  P.shadeBody(ctx, stick, woodG, cx, by, L * 0.5, L * 0.03);
  P.strokeBody(ctx, stick, woodG, lw * 0.8);
  // straw bristles
  const byb = by + (bx0 - cx) * -tilt;
  const straw = makePath();
  straw.moveTo(bx0 + L * 0.03, byb - L * 0.045);
  straw.quadraticCurveTo(bx0 - L * 0.12, byb - L * 0.1, bx0 - L * 0.26, byb - L * (shaky ? 0.05 : 0.12));
  straw.quadraticCurveTo(bx0 - L * 0.23, byb, bx0 - L * 0.28, byb + L * 0.1);
  straw.quadraticCurveTo(bx0 - L * 0.12, byb + L * 0.1, bx0 + L * 0.03, byb + L * 0.05);
  straw.closePath();
  P.shadeBody(ctx, straw, strawG, bx0 - L * 0.1, byb, L * 0.14, L * 0.09);
  ctx.save();
  ctx.clip(straw);
  ctx.strokeStyle = hsl(36, 0.6, 0.42, 0.55);
  ctx.lineWidth = Math.max(1.2, lw * 0.5);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(bx0 + L * 0.02, byb + i * L * 0.008);
    ctx.lineTo(bx0 - L * 0.3, byb + i * L * 0.03);
    ctx.stroke();
  }
  ctx.restore();
  P.strokeBody(ctx, straw, strawG, lw * 0.8);
  // the band round the bristles
  const band = makePath();
  band.roundRect(bx0 - L * 0.01, byb - L * 0.055, L * 0.045, L * 0.11, L * 0.015);
  fillStroke(ctx, band, hsl(stripeHue, 0.7, 0.55), tinted(g, stripeHue, 0.7, 0.55), lw * 0.6);

  // the dress (sits on the broom)
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => (Math.sin(th) < 0 ? 1 - 0.18 * -Math.sin(th) : 1 + 0.06 * Math.sin(th)) });
  P.shadeBody(ctx, body, dressG, cx, cy, rx, ry);
  if (g.rainbow) rainbowFill(ctx, body, cx - rx, cy - ry, rx * 2, ry * 2, 0.45);
  P.pattern(ctx, body, g, cx, cy, rx, ry, 'rgba(255,240,170,0.6)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, body, dressG, lw);

  // the near leg in a striped stocking, with a little boot
  const kx = cx + rx * 0.45;
  const ky = cy + ry * 0.55;
  const fx = cx + rx * 1.05;
  const fy = cy + ry * 1.45;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.outlineColor(dressG);
  ctx.lineWidth = L * 0.07 + lw * 2;
  ctx.beginPath();
  ctx.moveTo(kx, ky);
  ctx.lineTo(fx, fy);
  ctx.stroke();
  ctx.strokeStyle = '#fff6ee';
  ctx.lineWidth = L * 0.07;
  ctx.stroke();
  ctx.strokeStyle = hsl(stripeHue, 0.75 * clamp(g.sat / 0.75, 0.4, 1), 0.55);
  ctx.lineWidth = L * 0.07;
  ctx.setLineDash([L * 0.03, L * 0.03]);
  ctx.stroke();
  ctx.restore();
  const boot = makePath();
  boot.ellipse(fx + L * 0.03, fy + L * 0.01, L * 0.065, L * 0.04, -0.15, 0, TAU);
  const bootG = tinted(g, 270, 0.3, 0.3);
  P.shadeBody(ctx, boot, bootG, fx + L * 0.03, fy, L * 0.065, L * 0.04);
  P.strokeBody(ctx, boot, bootG, lw * 0.8);

  // the arm holding on to the broom
  const shx = cx + rx * 0.35;
  const shy = cy - ry * 0.6;
  const hx2 = cx + rx * 1.35;
  const hy2 = by - L * 0.01 - (rx * 1.35) * tilt;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.outlineColor(dressG);
  ctx.lineWidth = L * 0.06 + lw * 2;
  ctx.beginPath();
  ctx.moveTo(shx, shy);
  ctx.quadraticCurveTo(cx + rx * 1.1, cy - ry * 0.3, hx2, hy2);
  ctx.stroke();
  ctx.strokeStyle = P.bodyColor(dressG, -0.04);
  ctx.lineWidth = L * 0.06;
  ctx.stroke();
  ctx.restore();
  const hand = makePath();
  hand.arc(hx2, hy2, L * 0.04, 0, TAU);
  fillStroke(ctx, hand, skin, skinG, lw * 0.7);

  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.05, r: rx * 0.62 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head with hair
  const hr = L * 0.16;
  const hx = cx + rx * 0.2;
  const hy = cy - ry - hr * 0.62;
  const hairBack = P.blobPath({ cx: hx - hr * 0.35, cy: hy + hr * 0.15, rx: hr * 0.95, ry: hr * 1.05, g });
  P.shadeBody(ctx, hairBack, hairG, hx - hr * 0.35, hy, hr, hr);
  P.strokeBody(ctx, hairBack, hairG, lw * 0.8);
  // a little braid flying behind
  const braid = makePath();
  braid.ellipse(hx - hr * 1.25, hy + hr * 0.55, hr * 0.32, hr * 0.22, 0.4, 0, TAU);
  braid.ellipse(hx - hr * 1.6, hy + hr * 0.75, hr * 0.24, hr * 0.17, 0.4, 0, TAU);
  P.shadeBody(ctx, braid, hairG, hx - hr * 1.4, hy + hr * 0.6, hr * 0.4, hr * 0.3);
  P.strokeBody(ctx, braid, hairG, lw * 0.7);
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr, ry: hr * 0.98, g });
  P.shadeBody(ctx, head, skinG, hx, hy, hr, hr, skin);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, { ...skinG, light: skinG.light - 0.05 }, lw);
  // fringe
  const fringe = makePath();
  fringe.moveTo(hx - hr * 0.95, hy - hr * 0.1);
  fringe.quadraticCurveTo(hx - hr * 0.6, hy - hr * 1.15, hx + hr * 0.75, hy - hr * 0.62);
  fringe.quadraticCurveTo(hx + hr * 0.3, hy - hr * 0.42, hx + hr * 0.05, hy - hr * 0.52);
  fringe.quadraticCurveTo(hx - hr * 0.3, hy - hr * 0.3, hx - hr * 0.95, hy - hr * 0.1);
  fringe.closePath();
  P.shadeBody(ctx, fringe, hairG, hx, hy - hr * 0.6, hr, hr * 0.4);
  P.strokeBody(ctx, fringe, hairG, lw * 0.7);
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.27 + 0.04 * g.q);
  face(ctx, g, hx + hr * 0.5, hy + hr * 0.02, er, eyes);
  P.blush(ctx, hx + hr * 0.62, hy + hr * 0.45, er * 0.6, 0.55);
  P.mouth(ctx, hx + hr * 0.45, hy + hr * 0.55, hr * 0.35, shaky ? 'wavy' : 'smile');

  // the pointy hat with a bent tip, a band and a star
  const brimY = hy - hr * 0.62;
  const brim = makePath();
  brim.ellipse(hx - hr * 0.05, brimY, hr * 1.45, hr * 0.26, -0.08, 0, TAU);
  const cone = makePath();
  const tipX = hx - hr * (shaky ? 1.3 : 1.0);
  const tipY = brimY - hr * 2.0;
  cone.moveTo(hx - hr * 0.85, brimY);
  cone.quadraticCurveTo(hx - hr * 0.55, brimY - hr * 1.1, hx - hr * 0.1, brimY - hr * 1.6);
  cone.quadraticCurveTo(hx - hr * 0.45, tipY - hr * 0.05, tipX, tipY + hr * 0.25);
  cone.quadraticCurveTo(hx - hr * 0.25, tipY + hr * 0.2, hx + hr * 0.15, brimY - hr * 1.35);
  cone.quadraticCurveTo(hx + hr * 0.55, brimY - hr * 0.7, hx + hr * 0.8, brimY);
  cone.closePath();
  P.shadeBody(ctx, cone, hatG, hx, brimY - hr, hr, hr);
  P.pattern(ctx, cone, g, hx, brimY - hr, hr, hr, 'rgba(255,240,170,0.5)');
  ctx.save();
  ctx.clip(cone);
  ctx.fillStyle = hsl(stripeHue, 0.7 * clamp(g.sat / 0.75, 0.4, 1), 0.6);
  ctx.fillRect(hx - hr * 1.2, brimY - hr * 0.38, hr * 2.4, hr * 0.26);
  ctx.restore();
  if (g.glossy) P.gloss(ctx, hx, brimY - hr * 0.9, hr * 0.8, hr, 0.35);
  P.strokeBody(ctx, cone, hatG, lw);
  P.shadeBody(ctx, brim, hatG, hx, brimY, hr * 1.45, hr * 0.26);
  P.strokeBody(ctx, brim, hatG, lw);
  // a little star (or a crown) on the hat
  if (g.crown) P.crown(ctx, hx + hr * 0.2, brimY - hr * 0.32, L * 0.12, 0.12);
  else if (g.q > 0.45) P.sparkleStar(ctx, hx + hr * 0.25, brimY - hr * 0.25, hr * 0.3, '#ffe066');

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.4, cy - ry * 0.55, L * 0.12, -0.5);
  sparkles(ctx, g, cx, cy - ry * 1.2, L * 0.48);

  // the cape: flutters behind (the moving part), pivot at the shoulders
  const cs = L * 0.4;
  const { canvas: cc, ctx: c } = makeCanvas(Math.ceil(cs * 1.1), Math.ceil(cs * 1.0));
  const px = cs * 0.95;
  const py = cs * 0.12;
  const cape = makePath();
  cape.moveTo(px, py);
  cape.quadraticCurveTo(px - cs * 0.4, py + cs * 0.05, px - cs * 0.9, py + cs * 0.45);
  cape.quadraticCurveTo(px - cs * 0.78, py + cs * 0.55, px - cs * 0.86, py + cs * 0.68);
  cape.quadraticCurveTo(px - cs * 0.6, py + cs * 0.62, px - cs * 0.55, py + cs * 0.8);
  cape.quadraticCurveTo(px - cs * 0.25, py + cs * 0.6, px - cs * 0.05, py + cs * 0.55);
  cape.closePath();
  P.shadeBody(c, cape, capeG, px - cs * 0.4, py + cs * 0.4, cs * 0.5, cs * 0.4);
  if (g.rainbow) rainbowFill(c, cape, 0, 0, cs * 1.1, cs, 0.4);
  P.strokeBody(c, cape, capeG, lw * 0.8);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: L * 0.42,
    eyes,
    lid: skin,
    top: { x: hx - hr * 0.2, y: tipY - hr * 0.1 },
    tail: { canvas: cc, pivotX: px, pivotY: py, px: cx - rx * 0.25, py: cy - ry * 0.75 },
  };
}

// --------------------------------------------------------------------------------------------- Katze

function cat(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 185 * g.size;
  const rx = L * 0.32;
  const ry = L * 0.22;
  const W = Math.ceil(rx * 2 + L * 0.62);
  const H = Math.ceil(ry * 2 + L * 0.78);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.45;
  const cy = H - ry - L * 0.12;
  // a black cat with a violet sheen, the collar in g.hue
  const furG = tinted(g, 265, 0.22, 0.27);
  const og: P.BlobOpts['g'] = { ...furG, light: 0.34 };
  const pink = '#ff9fbf';
  const collarHue = g.hue;
  if (g.sparkle) P.aura(ctx, cx + rx * 0.3, cy - ry * 0.6, rx * 1.4, collarHue);

  // the far legs, a little darker
  const leg = (x: number, dark: number) => {
    const p = makePath();
    p.roundRect(x - L * 0.045, cy + ry * 0.2, L * 0.09, ry * 1.1, L * 0.045);
    P.shadeBody(ctx, p, furG, x, cy + ry, L * 0.05, ry * 0.5, hsl(265, furG.sat, furG.light + dark));
    P.strokeBody(ctx, p, og, lw * 0.8);
  };
  leg(cx - rx * 0.45, -0.05);
  leg(cx + rx * 0.62, -0.05);

  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 + 0.06 * Math.cos(th) });
  P.shadeBody(ctx, body, furG, cx, cy, rx, ry);
  if (g.rainbow) rainbowFill(ctx, body, cx - rx, cy - ry, rx * 2, ry * 2, 0.3);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(275, 0.4, 0.5, 0.5));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.35);
  P.strokeBody(ctx, body, og, lw);
  leg(cx - rx * 0.62, 0.02);
  leg(cx + rx * 0.42, 0.02);
  // little white paws
  for (const x of [cx - rx * 0.62, cx + rx * 0.42]) {
    ctx.fillStyle = 'rgba(245,240,255,0.95)';
    ctx.beginPath();
    ctx.ellipse(x, cy + ry * 1.2, L * 0.043, L * 0.025, 0, 0, TAU);
    ctx.fill();
  }
  const badgeAt = { x: cx - rx * 0.2, y: cy - ry * 0.02, r: ry * 0.72 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head with pointy ears
  const hr = L * 0.19;
  const hx = cx + rx * 0.88;
  const hy = cy - ry * 1.05;
  for (const [ox, lean] of [
    [-0.55, -0.25],
    [0.35, g.wobble > 0.4 ? 0.55 : 0.2],
  ]) {
    const ear = makePath();
    const ex = hx + hr * ox;
    ear.moveTo(ex - hr * 0.32, hy - hr * 0.55);
    ear.quadraticCurveTo(ex + hr * lean * 0.6, hy - hr * 1.55, ex + hr * lean + hr * 0.05, hy - hr * 1.45);
    ear.quadraticCurveTo(ex + hr * 0.35, hy - hr * 1.0, ex + hr * 0.42, hy - hr * 0.5);
    ear.closePath();
    P.shadeBody(ctx, ear, furG, ex, hy - hr, hr * 0.4, hr * 0.5);
    P.strokeBody(ctx, ear, og, lw * 0.9);
    ctx.fillStyle = 'rgba(255,160,195,0.85)';
    ctx.beginPath();
    ctx.moveTo(ex - hr * 0.12, hy - hr * 0.62);
    ctx.quadraticCurveTo(ex + hr * lean * 0.5, hy - hr * 1.3, ex + hr * lean + hr * 0.03, hy - hr * 1.25);
    ctx.quadraticCurveTo(ex + hr * 0.25, hy - hr * 0.9, ex + hr * 0.25, hy - hr * 0.6);
    ctx.closePath();
    ctx.fill();
  }
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.05, ry: hr * 0.92, g });
  P.shadeBody(ctx, head, furG, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  if (g.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.3);
  P.strokeBody(ctx, head, og, lw);
  // light muzzle
  ctx.fillStyle = 'rgba(235,225,250,0.9)';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.55, hy + hr * 0.38, hr * 0.38, hr * 0.28, 0, 0, TAU);
  ctx.fill();
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.28 + 0.04 * g.q);
  face(ctx, g, hx + hr * 0.42, hy - hr * 0.18, er, eyes);
  P.blush(ctx, hx + hr * 0.15, hy + hr * 0.42, er * 0.6, 0.6);
  // nose, mouth, whiskers
  ctx.fillStyle = pink;
  ctx.beginPath();
  ctx.moveTo(hx + hr * 0.62, hy + hr * 0.2);
  ctx.lineTo(hx + hr * 0.82, hy + hr * 0.2);
  ctx.lineTo(hx + hr * 0.72, hy + hr * 0.32);
  ctx.closePath();
  ctx.fill();
  P.mouth(ctx, hx + hr * 0.62, hy + hr * 0.4, hr * 0.42, g.wobble > 0.4 ? 'wavy' : 'cat', '#4a3550');
  ctx.save();
  ctx.strokeStyle = 'rgba(240,235,255,0.8)';
  ctx.lineWidth = Math.max(1.2, lw * 0.5);
  ctx.lineCap = 'round';
  for (const d of [-0.1, 0.08]) {
    ctx.beginPath();
    ctx.moveTo(hx + hr * 0.85, hy + hr * (0.32 + d));
    ctx.lineTo(hx + hr * 1.45, hy + hr * (0.25 + d * 2.2));
    ctx.stroke();
  }
  ctx.restore();

  // collar with a little bell
  ctx.save();
  ctx.strokeStyle = hsl(collarHue, 0.8 * clamp(g.sat / 0.75, 0.4, 1), 0.55);
  ctx.lineWidth = L * 0.035;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - hr * 0.6, hy + hr * 0.62);
  ctx.quadraticCurveTo(hx, hy + hr * 1.02, hx + hr * 0.5, hy + hr * 0.78);
  ctx.stroke();
  ctx.restore();
  const bell = makePath();
  bell.arc(hx + hr * 0.05, hy + hr * 1.0, L * 0.03, 0, TAU);
  fillStroke(ctx, bell, '#ffd84a', tinted(g, 45, 0.9, 0.55), lw * 0.6);

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.1, cy - ry * 0.75, L * 0.14, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.05, hy - hr * 0.95, L * 0.15, 0.12);
  sparkles(ctx, g, cx + rx * 0.3, cy - ry * 0.6, rx * 1.45);

  // the tail: curls up behind (the moving part), pivot at the rump
  const ts = L * 0.5;
  const { canvas: tc, ctx: t } = makeCanvas(Math.ceil(ts * 0.8), Math.ceil(ts * 1.05));
  const px = ts * 0.62;
  const py = ts * 0.95;
  t.lineCap = 'round';
  const tailLine = () => {
    t.beginPath();
    t.moveTo(px, py);
    t.bezierCurveTo(px - ts * 0.55, py - ts * 0.1, px - ts * 0.45, py - ts * 0.8, px - ts * 0.08, py - ts * 0.78);
    t.quadraticCurveTo(px + ts * 0.08, py - ts * 0.75, px + ts * 0.02, py - ts * (g.wobble > 0.4 ? 0.6 : 0.64));
  };
  tailLine();
  t.strokeStyle = P.outlineColor(og);
  t.lineWidth = L * 0.07 + lw * 2;
  t.stroke();
  tailLine();
  t.strokeStyle = P.bodyColor(furG, 0.04);
  t.lineWidth = L * 0.07;
  t.stroke();
  if (g.rainbow || g.pattern !== 'none') {
    t.setLineDash([L * 0.04, L * 0.05]);
    tailLine();
    t.strokeStyle = g.rainbow ? 'rgba(255,170,230,0.7)' : hsl(275, 0.4, 0.5, 0.6);
    t.stroke();
  }

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.1,
    eyes,
    lid: P.bodyColor(furG, 0.05),
    top: { x: hx - hr * 0.05, y: hy - hr * 1.15 },
    tail: { canvas: tc, pivotX: px, pivotY: py, px: cx - rx * 0.85, py: cy - ry * 0.25 },
  };
}

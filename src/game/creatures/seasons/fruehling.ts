// Spring meadow folk (side view, facing right): a flower with a face, a bee, a ladybird and a songbird
// (robin or blue tit). The flower stands on its root: its anchor is the ground, so it grows out of the
// soil when it hatches and sways around its root. Bee and bird flap their wings (the separate part).
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { clamp, hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

/** 0 Blume, 1 Biene, 2 Marienkäfer, 3 Vogel (the kind is variant % FRUEHLING_KINDS) */
export const FRUEHLING_KINDS = 4;
export const FRUEHLING_KIND_NAMES = ['Blume', 'Biene', 'Marienkäfer', 'Vogel'];

const RAINBOW = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];

export function fruehlingSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = g.variant % FRUEHLING_KINDS;
  if (k === 0) return flower(g, sticker);
  if (k === 1) return bee(g, sticker);
  if (k === 2) return ladybird(g, sticker);
  return bird(g, sticker);
}

/** the genome in the colours of the kind; paler on low tiers like the other worlds */
function tinted(g: Genome, hue: number, sat: number, light: number): Genome {
  const f = clamp(g.sat / 0.75, 0.35, 1.15);
  return { ...g, hue, sat: Math.min(1, sat * f), light };
}

/** same look, other colour (for parts: outline and shading follow the colour) */
const part = (g: Genome, hue: number, sat: number, light: number): Genome => tinted(g, hue, sat, light);

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

/** a plain filled + outlined path */
function fillStroke(ctx: Ctx, p: Path2D, fill: string, og: Genome, lw: number): void {
  ctx.fillStyle = fill;
  ctx.fill(p);
  P.strokeBody(ctx, p, og, lw);
}

// ------------------------------------------------------------------------------------------- Blume

function flower(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 205 * g.size;
  const W = Math.ceil(L * 1.02);
  const H = Math.ceil(L * 1.42);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.016);
  const droop = g.wobble > 0.4;
  const gx = W * 0.47;
  const gy = H - L * 0.04;
  const hx = gx + L * (droop ? 0.13 : 0.05);
  const hy = gy - L * (droop ? 0.8 : 0.87);
  const pr = L * 0.27;
  // petals in any colour but green
  const h0 = ((g.hue % 360) + 360) % 360;
  const ph = h0 >= 70 && h0 <= 170 ? h0 + 130 : h0;
  const kg = tinted(g, ph, 0.82, 0.68);
  const yellowish = ph >= 30 && ph < 70;
  const leafG = part(g, 112, 0.55, 0.45);
  if (g.sparkle) P.aura(ctx, hx, hy, pr * 1.45, ph + 20);

  // a little mound of soil at the root
  const mound = makePath();
  mound.ellipse(gx, gy, L * 0.15, L * 0.04, 0, Math.PI, TAU);
  mound.closePath();
  fillStroke(ctx, mound, '#8f6b4a', part(g, 28, 0.4, 0.5), lw * 0.8);

  // stem
  const stem = () => {
    ctx.beginPath();
    ctx.moveTo(gx, gy - L * 0.02);
    ctx.quadraticCurveTo(gx - L * 0.06, hy + (gy - hy) * 0.5, hx, hy + pr * 0.4);
  };
  ctx.save();
  ctx.lineCap = 'round';
  stem();
  ctx.strokeStyle = P.outlineColor(leafG);
  ctx.lineWidth = L * 0.055 + lw * 2;
  ctx.stroke();
  stem();
  ctx.strokeStyle = P.bodyColor(leafG, 0.04);
  ctx.lineWidth = L * 0.055;
  ctx.stroke();
  ctx.restore();

  // small leaf on the right
  const lx2 = gx - L * 0.02;
  const ly2 = gy - L * 0.5;
  const sl = makePath();
  sl.moveTo(lx2, ly2);
  sl.quadraticCurveTo(lx2 + L * 0.12, ly2 - L * 0.16, lx2 + L * 0.26, ly2 - L * 0.12);
  sl.quadraticCurveTo(lx2 + L * 0.14, ly2 + L * 0.02, lx2, ly2);
  sl.closePath();
  P.shadeBody(ctx, sl, leafG, lx2 + L * 0.13, ly2 - L * 0.07, L * 0.13, L * 0.07);
  P.strokeBody(ctx, sl, leafG, lw * 0.8);

  // big round leaf on the left: carries the badge
  const bx = gx - L * 0.22;
  const by = gy - L * 0.27;
  const brx = L * 0.2;
  const bry = L * 0.165;
  const leaf = P.blobPath({ cx: bx, cy: by, rx: brx, ry: bry, g, shape: (th) => 1 + 0.22 * Math.pow(Math.max(0, -Math.cos(th + 0.5)), 6) });
  // its little stalk to the stem
  ctx.save();
  ctx.strokeStyle = P.outlineColor(leafG);
  ctx.lineWidth = L * 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(bx + brx * 0.6, by + bry * 0.3);
  ctx.lineTo(gx - L * 0.02, gy - L * 0.18);
  ctx.stroke();
  ctx.restore();
  P.shadeBody(ctx, leaf, leafG, bx, by, brx, bry);
  P.crumpleFacets(ctx, leaf, g, bx, by, brx, bry);
  if (g.glossy) P.gloss(ctx, bx, by, brx, bry, 0.4);
  // leaf veins
  ctx.save();
  ctx.clip(leaf);
  ctx.strokeStyle = 'rgba(40,90,30,0.35)';
  ctx.lineWidth = Math.max(1.5, lw * 0.6);
  ctx.beginPath();
  ctx.moveTo(bx + brx, by + bry * 0.4);
  ctx.quadraticCurveTo(bx, by, bx - brx * 1.1, by - bry * 0.5);
  ctx.stroke();
  ctx.restore();
  P.strokeBody(ctx, leaf, leafG, lw);
  const badgeAt = { x: bx - brx * 0.02, y: by + bry * 0.02, r: bry * 0.8 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // petals: one lobed blob (so it gets wobbly and crumpled like every body)
  const n = g.hue2 % 2 < 1 ? 6 : 9;
  const tilt = droop ? 0.35 : 0.1;
  const lob = n === 6 ? 0.34 : 0.26;
  const petals = P.blobPath({ cx: hx, cy: hy, rx: pr, ry: pr * 0.96, g, points: 144, shape: (th) => 1 - lob + lob * Math.pow(Math.abs(Math.cos(((th + tilt) * n) / 2)), 0.7) });
  if (g.rainbow) {
    ctx.save();
    ctx.clip(petals);
    for (let i = 0; i < n; i++) {
      const a0 = ((i - 0.5) / n) * TAU - tilt;
      const a1 = ((i + 0.5) / n) * TAU - tilt;
      ctx.fillStyle = RAINBOW[i % RAINBOW.length];
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.arc(hx, hy, pr * 1.3, a0, a1 + 0.02);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else P.shadeBody(ctx, petals, kg, hx, hy, pr, pr);
  // petal veins towards the middle
  ctx.save();
  ctx.clip(petals);
  ctx.strokeStyle = hsl(ph, 0.6, 0.45, 0.25);
  ctx.lineWidth = Math.max(1.5, lw * 0.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - tilt;
    ctx.beginPath();
    ctx.moveTo(hx + Math.cos(a) * pr * 0.5, hy + Math.sin(a) * pr * 0.5);
    ctx.lineTo(hx + Math.cos(a) * pr * 0.82, hy + Math.sin(a) * pr * 0.82);
    ctx.stroke();
  }
  ctx.restore();
  P.pattern(ctx, petals, g, hx, hy, pr, pr, 'rgba(255,255,255,0.45)');
  P.crumpleFacets(ctx, petals, g, hx, hy, pr, pr);
  if (g.glossy) P.gloss(ctx, hx, hy, pr, pr, 0.45);
  P.strokeBody(ctx, petals, kg, lw);

  // the face in the middle
  const cr = pr * 0.58;
  const discG = yellowish ? part(g, 26, 0.6, 0.48) : part(g, 44, 0.95, 0.6);
  const disc = P.blobPath({ cx: hx + cr * 0.06, cy: hy, rx: cr, ry: cr * 0.96, g });
  P.shadeBody(ctx, disc, discG, hx, hy, cr, cr);
  if (g.q > 0.45) {
    // seed dots round the edge
    ctx.save();
    ctx.clip(disc);
    ctx.fillStyle = hsl(discG.hue, 0.6, 0.38, 0.4);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      ctx.beginPath();
      ctx.arc(hx + cr * 0.06 + Math.cos(a) * cr * 0.8, hy + Math.sin(a) * cr * 0.8, cr * 0.07, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  P.crumpleFacets(ctx, disc, g, hx, hy, cr, cr);
  P.strokeBody(ctx, disc, discG, lw * 0.9);
  const eyes: P.EyeInfo[] = [];
  const er = cr * (0.27 + 0.04 * g.q);
  face(ctx, g, hx + cr * 0.42, hy - cr * 0.18, er, eyes);
  P.blush(ctx, hx + cr * 0.6, hy + cr * 0.3, er * 0.6);
  P.blush(ctx, hx - cr * 0.45, hy + cr * 0.3, er * 0.5, 0.35);
  P.mouth(ctx, hx + cr * 0.12, hy + cr * 0.42, cr * 0.42, droop ? 'wavy' : 'smile');

  if (g.bandaid) P.bandaid(ctx, hx - pr * 0.62, hy - pr * 0.5, L * 0.14, -0.6);
  if (g.crown) P.crown(ctx, hx, hy - pr * 0.82, L * 0.17, 0.1);
  sparkles(ctx, g, hx, hy, pr * 1.25);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: gx,
    ay: gy,
    // the flower stands on its anchor; the radius reaches up to the blossom (speech bubble, sparkles)
    radius: (gy - hy) * 1.05,
    eyes,
    lid: P.bodyColor(discG, 0.05),
    top: { x: hx, y: hy - pr - L * 0.05 },
  };
}

// ------------------------------------------------------------------------------------------- Biene

function bee(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 180 * g.size;
  const rx = L * 0.31;
  const ry = L * 0.25;
  const W = Math.ceil(rx * 2 + L * 0.62);
  const H = Math.ceil(ry * 2 + L * 0.72);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.4;
  const cy = H - ry - L * 0.1;
  const kg = tinted(g, 40 + (((g.hue % 16) + 16) % 16), 0.95, 0.6);
  const dark = '#3d2c25';
  if (g.sparkle) P.aura(ctx, cx + rx * 0.3, cy - ry * 0.2, rx * 1.55, 50);

  // little legs under the body
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 1.1;
  ctx.lineCap = 'round';
  for (const [lx, a] of [
    [-0.35, 0.3],
    [0.05, 0.15],
    [0.42, g.wobble > 0.4 ? -0.4 : 0],
  ]) {
    ctx.beginPath();
    ctx.moveTo(cx + rx * lx, cy + ry * 0.8);
    ctx.quadraticCurveTo(cx + rx * (lx + 0.05), cy + ry * 1.15, cx + rx * (lx + 0.1 + a * 0.3), cy + ry * 1.25);
    ctx.stroke();
  }
  ctx.restore();

  // a small round stinger tip at the back
  const sting = makePath();
  sting.moveTo(cx - rx * 0.92, cy - ry * 0.12);
  sting.quadraticCurveTo(cx - rx * 1.25, cy + ry * 0.05, cx - rx * 0.92, cy + ry * 0.22);
  sting.closePath();
  fillStroke(ctx, sting, dark, part(g, 20, 0.3, 0.4), lw * 0.7);

  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 + 0.06 * Math.cos(th) });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  // stripes
  ctx.save();
  ctx.clip(body);
  const nStripes = 3;
  for (let i = 0; i < nStripes; i++) {
    const x = cx - rx * 0.62 + i * rx * 0.52;
    ctx.fillStyle = g.rainbow ? RAINBOW[(i * 2 + 4) % RAINBOW.length] : dark;
    ctx.beginPath();
    ctx.ellipse(x, cy, rx * 0.13, ry * 1.3, 0.18 + (g.wobble > 0.4 ? (g.r() - 0.5) * 0.4 : 0), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, 'rgba(255,250,210,0.5)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.5);
  P.strokeBody(ctx, body, kg, lw);
  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.08, r: ry * 0.62 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head
  const hr = L * 0.18;
  const hx = cx + rx * 1.02;
  const hy = cy - ry * 0.3;
  // antennae
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.fillStyle = dark;
  for (const [ox, bend] of [
    [-0.25, -0.4],
    [0.2, g.wobble > 0.4 ? 0.7 : 0.25],
  ]) {
    const ex = hx + hr * (ox + bend * 0.9);
    const ey = hy - hr * 1.75;
    ctx.beginPath();
    ctx.moveTo(hx + hr * ox, hy - hr * 0.8);
    ctx.quadraticCurveTo(hx + hr * (ox + bend * 0.2), hy - hr * 1.5, ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, hr * 0.16, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr, ry: hr * 0.95, g });
  P.shadeBody(ctx, head, kg, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  if (g.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.4);
  P.strokeBody(ctx, head, kg, lw);
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.36 + 0.06 * g.q);
  face(ctx, g, hx + hr * 0.3, hy - hr * 0.18, er, eyes, false);
  P.blush(ctx, hx + hr * 0.45, hy + hr * 0.42, er * 0.55);
  P.mouth(ctx, hx + hr * 0.62, hy + hr * 0.45, hr * 0.38, g.wobble > 0.4 ? 'wavy' : 'smile');

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.4, cy - ry * 0.55, L * 0.14, 0.5);
  if (g.crown) P.crown(ctx, hx - hr * 0.05, hy - hr * 0.85, L * 0.15, 0.12);
  sparkles(ctx, g, cx + rx * 0.3, cy - ry * 0.2, rx * 1.35);

  // wings: the moving part, pivot on the back
  const ws = L * 0.44;
  const { canvas: wc, ctx: w } = makeCanvas(Math.ceil(ws * 1.05), Math.ceil(ws * 0.95));
  const px = ws * 0.62;
  const py = ws * 0.88;
  const wingG = part(g, 205, 0.5, 0.82);
  const big = makePath();
  big.ellipse(px - ws * 0.18, py - ws * 0.42, ws * 0.22, ws * 0.4, -0.45, 0, TAU);
  const small = makePath();
  small.ellipse(px + ws * 0.14, py - ws * 0.32, ws * 0.15, ws * (g.wobble > 0.4 ? 0.22 : 0.3), 0.35, 0, TAU);
  for (const p of [small, big]) {
    w.fillStyle = 'rgba(225,244,255,0.8)';
    w.fill(p);
    if (g.pattern !== 'none' || g.rainbow) {
      w.save();
      w.clip(p);
      w.fillStyle = g.rainbow ? 'rgba(255,170,230,0.45)' : 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 4; i++) {
        w.beginPath();
        w.arc(px - ws * (0.3 - i * 0.12), py - ws * (0.55 - i * 0.08), ws * 0.045, 0, TAU);
        w.fill();
      }
      w.restore();
    }
    P.strokeBody(w, p, wingG, lw * 0.75);
  }
  w.save();
  w.strokeStyle = 'rgba(120,160,200,0.5)';
  w.lineWidth = Math.max(1, lw * 0.4);
  w.beginPath();
  w.moveTo(px, py);
  w.lineTo(px - ws * 0.3, py - ws * 0.65);
  w.stroke();
  w.restore();

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.1,
    eyes,
    lid: P.bodyColor(kg, 0.05),
    top: { x: hx - hr * 0.05, y: hy - hr * 1.1 },
    tail: { canvas: wc, pivotX: px, pivotY: py, px: cx - rx * 0.05, py: cy - ry * 0.72 },
  };
}

// ------------------------------------------------------------------------------------- Marienkäfer

function ladybird(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 185 * g.size;
  const rx = L * 0.34;
  const ry = L * 0.27;
  const W = Math.ceil(rx * 2 + L * 0.5);
  const H = Math.ceil(ry * 2 + L * 0.42);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.42;
  const cy = H - ry - L * 0.06;
  const h0 = ((g.hue % 360) + 360) % 360;
  // mostly red, sometimes orange or yellow
  const shellHue = h0 < 250 ? 2 + (h0 % 10) : h0 < 305 ? 24 : 46;
  const kg = tinted(g, shellHue, 0.88, shellHue > 40 ? 0.64 : 0.55);
  const dark = '#2d2836';
  const darkG = part(g, 260, 0.15, 0.28);
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - ry * 0.2, rx * 1.5, shellHue + 30);

  // legs
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 1.2;
  ctx.lineCap = 'round';
  for (const lx of [-0.5, -0.05, 0.42]) {
    ctx.beginPath();
    ctx.moveTo(cx + rx * lx, cy + ry * 0.45);
    ctx.lineTo(cx + rx * (lx - 0.08), cy + ry * 0.95);
    ctx.lineTo(cx + rx * (lx + 0.04), cy + ry * 1.05);
    ctx.stroke();
  }
  ctx.restore();

  // head in front
  const hr = L * 0.17;
  const hx = cx + rx * 0.9;
  const hy = cy + ry * 0.12;
  ctx.save();
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.fillStyle = dark;
  for (const [ox, bend] of [
    [-0.1, -0.2],
    [0.35, g.wobble > 0.4 ? 0.8 : 0.35],
  ]) {
    const ex = hx + hr * (ox + 0.35 + bend * 0.5);
    const ey = hy - hr * 1.7;
    ctx.beginPath();
    ctx.moveTo(hx + hr * ox, hy - hr * 0.8);
    ctx.quadraticCurveTo(hx + hr * (ox + 0.1), hy - hr * 1.4, ex, ey);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ex, ey, hr * 0.15, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.05, ry: hr, g });
  P.shadeBody(ctx, head, darkG, hx, hy, hr, hr, hsl(260, 0.15, 0.3));
  P.strokeBody(ctx, head, darkG, lw);

  // shell: a dome with a flatter belly
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => (Math.sin(th) > 0 ? 1 - 0.38 * Math.sin(th) : 1) });
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  ctx.save();
  ctx.clip(body);
  // spots: fewer on low tiers
  const spots: [number, number, number][] = [
    [-0.6, -0.3, 0.17],
    [-0.15, -0.68, 0.15],
    [0.38, -0.55, 0.16],
    [0.68, -0.05, 0.14],
    [-0.75, 0.15, 0.12],
    [0.15, 0.32, 0.1],
    [-0.4, 0.32, 0.1],
  ];
  const nSpots = g.crumple > 0 ? 4 : g.q < 0.55 ? 5 : 7;
  spots.slice(0, nSpots).forEach(([sx, sy, sr], i) => {
    ctx.fillStyle = g.rainbow ? RAINBOW[(i + 4) % RAINBOW.length] : dark;
    const j = g.wobble > 0.4 ? 0.12 : 0;
    ctx.beginPath();
    ctx.ellipse(cx + rx * (sx + (g.r() - 0.5) * j), cy + ry * (sy + (g.r() - 0.5) * j), rx * sr, rx * sr * 0.9, 0, 0, TAU);
    ctx.fill();
  });
  // the split between the wing cases
  ctx.strokeStyle = dark;
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath();
  ctx.moveTo(cx + rx * 0.55, cy - ry * 0.95);
  ctx.quadraticCurveTo(cx + rx * 0.1, cy - ry * 0.2, cx - rx * 0.25, cy + ry * 0.7);
  ctx.stroke();
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, 'rgba(255,235,220,0.4)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.6);
  P.strokeBody(ctx, body, kg, lw);
  const badgeAt = { x: cx - rx * 0.08, y: cy - ry * 0.12, r: ry * 0.55 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // face on the dark head: white cheeks so it stays friendly
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.38 + 0.06 * g.q);
  face(ctx, g, hx + hr * 0.42, hy - hr * 0.15, er, eyes, false);
  P.blush(ctx, hx + hr * 0.5, hy + hr * 0.5, er * 0.55, 0.6);
  P.mouth(ctx, hx + hr * 0.68, hy + hr * 0.48, hr * 0.36, g.wobble > 0.4 ? 'wavy' : 'smile', '#ffd6e0');

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.5, cy - ry * 0.6, L * 0.14, -0.4);
  if (g.crown) P.crown(ctx, cx + rx * 0.15, cy - ry * 0.92, L * 0.16, 0.12);
  sparkles(ctx, g, cx + rx * 0.2, cy - ry * 0.3, rx * 1.3);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: hsl(260, 0.15, 0.32),
    top: { x: cx + rx * 0.15, y: cy - ry * 1.15 },
  };
}

// ------------------------------------------------------------------------------------------- Vogel

function bird(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 185 * g.size;
  const rx = L * 0.3;
  const ry = L * 0.27;
  const W = Math.ceil(rx * 2 + L * 0.72);
  const H = Math.ceil(ry * 2 + L * 0.62);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.46;
  const cy = H - ry - L * 0.13;
  const robin = ((g.hue % 360) + 360) % 360 < 180;
  const backG = robin ? tinted(g, 30, 0.38, 0.5) : tinted(g, 100, 0.42, 0.52);
  const breastG = robin ? tinted(g, 16, 0.88, 0.6) : tinted(g, 50, 0.92, 0.62);
  const headG = robin ? backG : tinted(g, 205, 0.75, 0.56);
  const og = { ...backG, light: backG.light + 0.05 };
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - ry * 0.3, rx * 1.65, robin ? 20 : 200);

  // legs
  ctx.save();
  ctx.strokeStyle = '#b07a4a';
  ctx.lineWidth = lw * 1.1;
  ctx.lineCap = 'round';
  for (const lx of [-0.12, 0.25]) {
    const fx = cx + rx * lx;
    const fy = cy + ry * 1.32;
    ctx.beginPath();
    ctx.moveTo(fx, cy + ry * 0.8);
    ctx.lineTo(fx, fy);
    ctx.moveTo(fx - L * 0.04, fy);
    ctx.lineTo(fx + L * 0.06, fy);
    ctx.stroke();
  }
  ctx.restore();

  // tail feathers at the back, slightly up
  const tail = makePath();
  tail.moveTo(cx - rx * 0.7, cy - ry * 0.05);
  tail.quadraticCurveTo(cx - rx * 1.3, cy - ry * 0.35, cx - rx * 1.62, cy - ry * (g.wobble > 0.4 ? 0.2 : 0.75));
  tail.quadraticCurveTo(cx - rx * 1.5, cy - ry * 0.15, cx - rx * 1.55, cy + ry * 0.05);
  tail.quadraticCurveTo(cx - rx * 1.15, cy + ry * 0.2, cx - rx * 0.7, cy + ry * 0.35);
  tail.closePath();
  P.shadeBody(ctx, tail, backG, cx - rx * 1.2, cy - ry * 0.2, rx * 0.5, ry * 0.4);
  P.strokeBody(ctx, tail, og, lw * 0.9);

  // round body
  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, backG, cx, cy, rx, ry);
  ctx.save();
  ctx.clip(body);
  // breast in front, pale belly below
  ctx.fillStyle = P.bodyColor(breastG, 0.04);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.38, cy + ry * 0.12, rx * 0.78, ry * 0.85, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = robin ? '#fbf1e2' : hsl(55, 0.7 * clamp(g.sat / 0.75, 0.4, 1), 0.82);
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.1, cy + ry * 1.05, rx * 0.75, ry * 0.42, 0, 0, TAU);
  ctx.fill();
  if (!robin) {
    // the tit's dark stripe down the belly
    ctx.fillStyle = 'rgba(40,60,90,0.5)';
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.52, cy + ry * 0.35, rx * 0.07, ry * 0.6, 0.15, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, 'rgba(255,255,255,0.35)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, og, lw);

  // the near wing, folded at the back
  const wing = makePath();
  const wx = cx - rx * 0.42;
  const wy = cy - ry * 0.05;
  wing.moveTo(wx + rx * 0.3, wy - ry * 0.45);
  wing.quadraticCurveTo(wx - rx * 0.35, wy - ry * 0.5, wx - rx * 0.62, wy + ry * 0.15);
  wing.quadraticCurveTo(wx - rx * 0.2, wy + ry * 0.55, wx + rx * 0.2, wy + ry * 0.25);
  wing.quadraticCurveTo(wx + rx * 0.4, wy - ry * 0.1, wx + rx * 0.3, wy - ry * 0.45);
  wing.closePath();
  P.shadeBody(ctx, wing, robin ? backG : tinted(g, 205, 0.6, 0.55), wx, wy, rx * 0.5, ry * 0.5);
  ctx.save();
  ctx.clip(wing);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(1.5, lw * 0.6);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(wx - rx * (0.5 - i * 0.08), wy + ry * (0.05 + i * 0.12));
    ctx.quadraticCurveTo(wx - rx * 0.1, wy + ry * (0.1 + i * 0.12), wx + rx * 0.3, wy - ry * (0.1 - i * 0.1));
    ctx.stroke();
  }
  ctx.restore();
  P.strokeBody(ctx, wing, og, lw * 0.85);
  const badgeAt = { x: cx + rx * 0.3, y: cy + ry * 0.22, r: ry * 0.56 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head
  const hr = L * 0.19;
  const hx = cx + rx * 0.72;
  const hy = cy - ry * 0.78;
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr * 1.05, ry: hr, g });
  P.shadeBody(ctx, head, headG, hx, hy, hr, hr);
  ctx.save();
  ctx.clip(head);
  if (robin) {
    // orange face
    ctx.fillStyle = P.bodyColor(breastG, 0.04);
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.45, hy + hr * 0.45, hr * 0.85, hr * 0.75, 0, 0, TAU);
    ctx.fill();
  } else {
    // white cheek under the blue cap, dark eye stripe
    ctx.fillStyle = '#fbfcff';
    ctx.beginPath();
    ctx.ellipse(hx + hr * 0.2, hy + hr * 0.3, hr * 0.9, hr * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(40,50,90,0.7)';
    ctx.lineWidth = hr * 0.14;
    ctx.beginPath();
    ctx.moveTo(hx - hr * 1.0, hy + hr * 0.05);
    ctx.lineTo(hx + hr * 1.1, hy - hr * 0.05);
    ctx.stroke();
  }
  ctx.restore();
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  if (g.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.4);
  P.strokeBody(ctx, head, og, lw);
  // beak
  const beak = makePath();
  const bkx = hx + hr * 0.95;
  const bky = hy + hr * 0.1;
  beak.moveTo(bkx, bky - hr * 0.18);
  beak.quadraticCurveTo(bkx + hr * 0.3, bky - hr * 0.06, bkx + hr * (g.wobble > 0.4 ? 0.4 : 0.5), bky + hr * 0.06);
  beak.quadraticCurveTo(bkx + hr * 0.25, bky + hr * 0.18, bkx, bky + hr * 0.18);
  beak.closePath();
  fillStroke(ctx, beak, '#ffb347', part(g, 30, 0.8, 0.6), lw * 0.7);
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.36 + 0.06 * g.q);
  face(ctx, g, hx + hr * 0.38, hy - hr * 0.12, er, eyes, false);
  P.blush(ctx, hx + hr * 0.4, hy + hr * 0.55, er * 0.55);

  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.1, cy - ry * 0.6, L * 0.14, -0.45);
  if (g.crown) P.crown(ctx, hx - hr * 0.1, hy - hr * 0.85, L * 0.15, 0.12);
  sparkles(ctx, g, cx + rx * 0.2, cy - ry * 0.4, rx * 1.4);

  // the far wing: the moving part, raised behind the back
  const ws = L * 0.42;
  const { canvas: wc, ctx: w } = makeCanvas(Math.ceil(ws * 1.1), Math.ceil(ws * 0.9));
  const px = ws * 0.95;
  const py = ws * 0.8;
  const far = makePath();
  far.moveTo(px, py);
  far.bezierCurveTo(px - ws * 0.1, py - ws * 0.5, px - ws * 0.5, py - ws * 0.78, px - ws * 0.92, py - ws * 0.7);
  for (let i = 0; i < 3; i++) {
    const k = (i + 1) / 3;
    far.quadraticCurveTo(px - ws * (0.95 - k * 0.15), py - ws * (0.5 - k * 0.25), px - ws * (0.88 - k * 0.6), py - ws * (0.48 - k * 0.42));
  }
  far.closePath();
  const farG = robin ? backG : tinted(g, 205, 0.6, 0.55);
  w.fillStyle = P.bodyColor(farG, -0.06);
  w.fill(far);
  if (g.rainbow) {
    w.save();
    w.clip(far);
    RAINBOW.forEach((c, i) => {
      w.fillStyle = c;
      w.fillRect(0, py - ws * (0.8 - i * 0.1), ws * 1.1, ws * 0.1);
    });
    w.restore();
  }
  P.strokeBody(w, far, og, lw * 0.85);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.1,
    eyes,
    lid: P.bodyColor(headG, 0.05),
    top: { x: hx - hr * 0.1, y: hy - hr * 1.2 },
    tail: { canvas: wc, pivotX: px, pivotY: py, px: cx - rx * 0.05, py: cy - ry * 0.6 },
  };
}

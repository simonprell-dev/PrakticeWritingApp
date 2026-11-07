// Autumn creatures (side view, facing right): a hedgehog with an apple or a leaf on its spines, a squirrel with
// a bushy tail and an acorn, a fox, and a paper kite with a face and a tail of bows that dances in the sky.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

export const HERBST_KINDS = ['Igel', 'Eichhörnchen', 'Fuchs', 'Drachen'];

/** which kind a genome hatches as (0 hedgehog, 1 squirrel, 2 fox, 3 kite) */
export const herbstKind = (g: Genome): number => g.variant % HERBST_KINDS.length;
/** kites fly in the sky, the others walk on the meadow */
export const isKite = (g: Genome): boolean => herbstKind(g) === 3;

const RAINBOW = [0, 35, 55, 120, 200, 275];

function rainbowFill(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gr = ctx.createLinearGradient(x0, y0, x1, y1);
  RAINBOW.forEach((h, i) => gr.addColorStop(i / (RAINBOW.length - 1), hsl(h, 0.85, 0.66)));
  return gr;
}

/** a copy of the genome with the colour of a kind (keeps the tier look: paler when crumpled) */
function tinted(g: Genome, hue: number, light: number, satBoost = 0): Genome {
  return { ...g, hue, light, sat: Math.min(1, g.sat + satBoost) };
}

/** a pointed autumn leaf with a midrib and a little stem, centred at (x, y), pointing along angle a */
export function autumnLeaf(ctx: Ctx, x: number, y: number, s: number, a: number, color: string | CanvasGradient, vein = 'rgba(90,40,10,0.45)', outline?: string, lw = 0): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  const p = makePath();
  p.moveTo(-s, 0);
  p.quadraticCurveTo(-s * 0.2, -s * 0.75, s, 0);
  p.quadraticCurveTo(-s * 0.2, s * 0.75, -s, 0);
  p.closePath();
  ctx.fillStyle = color;
  ctx.fill(p);
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke(p);
  }
  ctx.strokeStyle = vein;
  ctx.lineWidth = Math.max(1, s * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 1.3, 0);
  ctx.lineTo(s * 0.75, 0);
  for (const k of [-0.35, 0.15]) {
    ctx.moveTo(s * k, 0);
    ctx.lineTo(s * (k + 0.3), -s * 0.28);
    ctx.moveTo(s * k, 0);
    ctx.lineTo(s * (k + 0.3), s * 0.28);
  }
  ctx.stroke();
  ctx.restore();
}

/** a red apple with a stem and a leaf */
function apple(ctx: Ctx, x: number, y: number, r: number, g: Genome, lw: number): void {
  const red = hsl(4, Math.max(0.45, g.sat), 0.5);
  const p = makePath();
  p.moveTo(x, y - r * 0.7);
  p.bezierCurveTo(x + r * 0.6, y - r * 1.15, x + r * 1.25, y - r * 0.4, x + r * 0.9, y + r * 0.45);
  p.bezierCurveTo(x + r * 0.65, y + r * 1.05, x + r * 0.2, y + r * 1.0, x, y + r * 0.85);
  p.bezierCurveTo(x - r * 0.2, y + r * 1.0, x - r * 0.65, y + r * 1.05, x - r * 0.9, y + r * 0.45);
  p.bezierCurveTo(x - r * 1.25, y - r * 0.4, x - r * 0.6, y - r * 1.15, x, y - r * 0.7);
  p.closePath();
  ctx.fillStyle = g.rainbow ? rainbowFill(ctx, x - r, y - r, x + r, y + r) : red;
  ctx.fill(p);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.45, y - r * 0.2, r * 0.18, r * 0.3, 0.3, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = '#5a2a1a';
  ctx.lineWidth = lw * 0.8;
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = '#6b4a2b';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.65);
  ctx.quadraticCurveTo(x + r * 0.05, y - r * 1.0, x + r * 0.25, y - r * 1.2);
  ctx.stroke();
  ctx.restore();
  autumnLeaf(ctx, x + r * 0.55, y - r * 1.05, r * 0.42, -0.5, '#6fae3a', 'rgba(30,70,20,0.5)', '#3d6a22', lw * 0.6);
}

/** an acorn (for the squirrel's paws) */
function acorn(ctx: Ctx, x: number, y: number, r: number, lw: number, gold: boolean): void {
  ctx.save();
  const nut = makePath();
  nut.ellipse(x, y + r * 0.25, r * 0.72, r * 0.9, 0, 0, TAU);
  ctx.fillStyle = gold ? '#f2c14a' : '#c9893f';
  ctx.fill(nut);
  ctx.strokeStyle = '#5a3418';
  ctx.lineWidth = lw * 0.8;
  ctx.stroke(nut);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.25, y + r * 0.3, r * 0.14, r * 0.3, 0.2, 0, TAU);
  ctx.fill();
  const cap = makePath();
  cap.moveTo(x - r * 0.85, y - r * 0.15);
  cap.quadraticCurveTo(x, y - r * 1.0, x + r * 0.85, y - r * 0.15);
  cap.quadraticCurveTo(x, y + r * 0.1, x - r * 0.85, y - r * 0.15);
  cap.closePath();
  ctx.fillStyle = '#7a4f2a';
  ctx.fill(cap);
  ctx.stroke(cap);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.6);
  ctx.lineTo(x + r * 0.15, y - r * 0.95);
  ctx.stroke();
  ctx.restore();
}

/** a side face: one big eye (two googly ones when crumpled), blush and a mouth */
function sideFace(ctx: Ctx, g: Genome, fx: number, fy: number, er: number, mx: number, my: number, mw: number, eyes: P.EyeInfo[]): void {
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.6, fy - er * 0.2, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.2, fy + er * 1.35, er * 0.55);
  P.mouth(ctx, mx, my, mw, g.wobble > 0.4 ? 'wavy' : 'cat');
}

/** union of circles along a quadratic curve (bushy tails); radius follows rad(t) */
function fluffPath(p0: [number, number], c: [number, number], p1: [number, number], rad: (t: number) => number, n: number, g: Genome): Path2D {
  const p = makePath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0];
    const y = u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1];
    const jag = g.crumple > 0.5 ? 0.85 + 0.3 * (((Math.sin(i * 7.3 + g.seed) * 4375.5) % 1 + 1) % 1) : 1;
    const r = rad(t) * jag;
    p.moveTo(x + r, y);
    p.arc(x, y, r, 0, TAU);
  }
  return p;
}

/** fills a union of circles with an outline only around the whole shape */
function fluffy(ctx: Ctx, path: Path2D, g: Genome, lw: number, fill: string | CanvasGradient): void {
  P.strokeBody(ctx, path, g, lw * 2);
  ctx.fillStyle = fill;
  ctx.fill(path);
}

export function herbstSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = herbstKind(g);
  if (k === 0) return hedgehog(g, sticker);
  if (k === 1) return squirrel(g, sticker);
  if (k === 2) return fox(g, sticker);
  return kite(g, sticker);
}

// ---------------------------------------------------------------- hedgehog

function hedgehog(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 24 + ((gIn.hue % 16) - 8), 0.42);
  const skin = tinted(gIn, 32, 0.8, -0.1);
  const L = 200 * g.size;
  const rx = L * 0.33;
  const ry = L * 0.24;
  const spike = L * 0.075;
  const legLen = L * 0.05;
  const W = Math.ceil(rx * 2 + L * 0.6);
  const H = Math.ceil(ry * 2 + spike + legLen + L * 0.36);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.1;
  const cy = H - legLen - ry - L * 0.03;
  const lw = Math.max(2.5, L * 0.017);
  if (g.sparkle) P.aura(ctx, cx + L * 0.05, cy - L * 0.04, rx * 1.4, 35);

  // little feet
  const feet: [number, number][] = [
    [cx - rx * 0.5, 1],
    [cx - rx * 0.15, 1],
    [cx + rx * 0.35, 1],
    [cx + rx * 0.62, g.wobble > 0.4 ? 0.55 : 1],
  ];
  for (const [fx, f] of feet) {
    const lp = makePath();
    const w = L * 0.07;
    lp.roundRect(fx - w / 2, cy + ry * 0.55, w, ry * 0.45 + legLen * f, w / 2);
    ctx.fillStyle = P.bodyColor(skin, -0.18);
    ctx.fill(lp);
    P.strokeBody(ctx, lp, g, lw * 0.8);
  }

  // the spiny body: a zigzag fringe from the forehead over the back to the tail, smooth underneath
  const body = makePath();
  const a0 = -0.22 * Math.PI;
  const a1 = -1.2 * Math.PI;
  const n = 26;
  const crumpled = g.crumple > 0.5;
  for (let i = 0; i <= n * 2; i++) {
    const t = i / (n * 2);
    const a = a0 + (a1 - a0) * t;
    const jit = crumpled ? 0.7 + 0.6 * (((Math.sin(i * 9.1 + g.seed) * 4375.5) % 1 + 1) % 1) : 1;
    const out = i % 2 ? 1 + (spike / Math.max(rx, ry)) * jit * (0.7 + 0.3 * Math.sin(t * Math.PI)) : 1;
    const x = cx + Math.cos(a) * rx * out;
    const y = cy + Math.sin(a) * ry * out;
    if (i === 0) body.moveTo(x, y);
    else body.lineTo(x, y);
  }
  // round belly back to the start
  for (let i = 1; i <= 16; i++) {
    const a = a1 + ((a0 + TAU - a1) * i) / 16;
    body.lineTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry * 0.92);
  }
  body.closePath();
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  // lighter spine tips
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = P.bodyColor(g, 0.2, 0, 0.55);
  ctx.lineWidth = L * 0.012;
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const a = a0 + (a1 - a0) * ((i + 0.5) / 26);
    const x = cx + Math.cos(a) * rx * 0.72;
    const y = cy + Math.sin(a) * ry * 0.72;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * rx * 0.22, y + Math.sin(a) * ry * 0.22);
    ctx.stroke();
  }
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, g.sat, Math.min(0.8, g.light + 0.2), 0.45));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.35);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.22, y: cy + ry * 0.12, r: ry * 0.6 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head with a pointy snout
  const hr = L * 0.13;
  const hx = cx + rx * 0.72;
  const hy = cy + ry * 0.12;
  const ear = makePath();
  ear.arc(hx - hr * 0.15, hy - hr * 0.85, hr * 0.28, 0, TAU);
  ctx.fillStyle = P.bodyColor(skin, -0.08);
  ctx.fill(ear);
  P.strokeBody(ctx, ear, g, lw * 0.8);
  const head = makePath();
  head.moveTo(hx - hr * 0.7, hy - hr * 0.85);
  head.quadraticCurveTo(hx + hr * 0.8, hy - hr * 1.05, hx + hr * 1.75, hy + hr * 0.25);
  head.quadraticCurveTo(hx + hr * 0.9, hy + hr * 1.05, hx - hr * 0.55, hy + hr * 0.9);
  head.quadraticCurveTo(hx - hr * 1.05, hy, hx - hr * 0.7, hy - hr * 0.85);
  head.closePath();
  P.shadeBody(ctx, head, skin, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);
  ctx.fillStyle = '#2a1d24';
  ctx.beginPath();
  ctx.arc(hx + hr * 1.72, hy + hr * 0.22, hr * 0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(hx + hr * 1.66, hy + hr * 0.14, hr * 0.06, 0, TAU);
  ctx.fill();
  const eyes: P.EyeInfo[] = [];
  sideFace(ctx, g, hx + hr * 0.4, hy - hr * 0.25, hr * (0.33 + 0.05 * g.q), hx + hr * 1.0, hy + hr * 0.6, hr * 0.35, eyes);

  // what it carries on its spines: an apple, or a big coloured leaf
  const carryX = cx - rx * 0.12;
  const carryY = cy - ry - spike * 0.35;
  if (gIn.hue < 180) apple(ctx, carryX, carryY - L * 0.04, L * 0.085, g, lw);
  else {
    const lh = [8, 24, 40, 48][Math.floor(gIn.hue / 45) % 4];
    const col = g.rainbow ? rainbowFill(ctx, -L * 0.13, 0, L * 0.13, 0) : hsl(lh, Math.max(0.5, g.sat), 0.52);
    autumnLeaf(ctx, carryX, carryY - L * 0.03, L * 0.13, -0.35, col, 'rgba(90,40,10,0.5)', hsl(lh, 0.6, 0.28), lw * 0.7);
  }
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.25, cy - ry * 0.35, L * 0.14, 0.5);
  if (g.crown) P.crown(ctx, hx + hr * 0.3, hy - hr * 0.95, L * 0.15, 0.2);
  if (g.sparkle) P.sparkleStar(ctx, cx - rx * 0.9, cy - ry * 1.05, L * 0.045);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(skin, 0.02),
    top: { x: hx + hr * 0.3, y: hy - hr * 1.6 },
  };
}

// ---------------------------------------------------------------- squirrel

function squirrel(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 12 + ((gIn.hue % 10) - 5), 0.42 + (gIn.hue % 7) * 0.012, 0.02);
  const cream = hsl(38, Math.max(0.3, g.sat * 0.7), 0.86);
  const L = 200 * g.size;
  const rx = L * 0.22;
  const ry = L * 0.2;
  const legLen = L * 0.05;
  const W = Math.ceil(rx * 2 + L * 0.48);
  const H = Math.ceil(ry * 2 + legLen + L * 0.46);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.06;
  const cy = H - legLen - ry - L * 0.03;
  const lw = Math.max(2.5, L * 0.017);
  const col = (dl = 0) => P.bodyColor(g, dl);
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.1, rx * 1.7, 30);

  // the bushy tail: its own canvas so it can swish (pivot at its root)
  const TW = Math.ceil(L * 0.5);
  const TH = Math.ceil(L * 0.72);
  const { canvas: tailC, ctx: tc } = makeCanvas(TW, TH);
  const root: [number, number] = [TW * 0.86, TH * 0.86];
  const tailPath = fluffPath(root, [TW * 0.05, TH * 0.75], [TW * 0.38, TH * 0.16], (t) => L * (0.05 + 0.085 * Math.sin(Math.min(1, t * 1.1) * Math.PI * 0.85)), 14, g);
  const tg = tc.createLinearGradient(0, TH, TW, 0);
  tg.addColorStop(0, col(0.08));
  tg.addColorStop(1, col(-0.06));
  fluffy(tc, tailPath, g, lw, g.rainbow ? rainbowFill(tc, 0, TH, TW, 0) : tg);
  if (g.rainbow) {
    tc.fillStyle = P.bodyColor(g, 0, 0, 0.35);
    tc.fill(tailPath);
  }
  // fluffy lighter strands
  tc.save();
  tc.clip(tailPath);
  tc.strokeStyle = hsl(g.hue + 10, g.sat, Math.min(0.85, g.light + 0.2), 0.55);
  tc.lineWidth = L * 0.018;
  tc.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + i * 0.11;
    const u = 1 - t;
    const x = u * u * root[0] + 2 * u * t * TW * 0.05 + t * t * TW * 0.38;
    const y = u * u * root[1] + 2 * u * t * TH * 0.75 + t * t * TH * 0.16;
    tc.beginPath();
    tc.moveTo(x - L * 0.05, y + L * 0.03);
    tc.quadraticCurveTo(x, y - L * 0.02, x + L * 0.05, y + L * 0.02);
    tc.stroke();
  }
  tc.restore();
  P.crumpleFacets(tc, tailPath, g, TW * 0.4, TH * 0.5, TW * 0.4, TH * 0.45);
  const tailAt = { px: cx - rx * 0.7, py: cy + ry * 0.45 };

  // hind leg (a big round haunch) and feet
  const feet: [number, number][] = [
    [cx - rx * 0.25, 1],
    [cx + rx * 0.55, g.wobble > 0.4 ? 0.6 : 1],
  ];
  for (const [fx, f] of feet) {
    const fp = makePath();
    fp.ellipse(fx + L * 0.03, cy + ry + legLen * f - L * 0.02, L * 0.065, L * 0.03, 0, 0, TAU);
    ctx.fillStyle = col(-0.1);
    ctx.fill(fp);
    P.strokeBody(ctx, fp, g, lw * 0.8);
  }

  // body
  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, g.sat, Math.min(0.85, g.light + 0.15), 0.5));
  // cream belly
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.75, cy + ry * 0.35, rx * 0.45, ry * 0.75, -0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, body, g, lw);
  const haunch = makePath();
  haunch.ellipse(cx - rx * 0.35, cy + ry * 0.45, rx * 0.45, ry * 0.45, 0, Math.PI * 0.95, Math.PI * 2.05);
  ctx.save();
  ctx.strokeStyle = P.outlineColor(g);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = lw * 0.8;
  ctx.lineCap = 'round';
  ctx.stroke(haunch);
  ctx.restore();
  const badgeAt = { x: cx - rx * 0.12, y: cy - ry * 0.05, r: ry * 0.6 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head
  const hr = L * 0.13;
  const hx = cx + rx * 0.85;
  const hy = cy - ry * 0.95;
  // tufted ears
  for (const [ox, rot] of [
    [-0.45, -0.25],
    [0.15, 0.15],
  ]) {
    const e = makePath();
    const ex = hx + ox * hr;
    const ey = hy - hr * 0.7;
    e.moveTo(ex - hr * 0.28, ey + hr * 0.2);
    e.quadraticCurveTo(ex - hr * 0.2 + rot * hr, ey - hr * 0.6, ex + rot * hr * 1.5, ey - hr * 0.85);
    e.quadraticCurveTo(ex + hr * 0.3, ey - hr * 0.3, ex + hr * 0.28, ey + hr * 0.2);
    e.closePath();
    ctx.fillStyle = col(-0.04);
    ctx.fill(e);
    P.strokeBody(ctx, e, g, lw * 0.8);
  }
  const head = makePath();
  head.ellipse(hx, hy, hr * 1.08, hr * 0.95, 0.1, 0, TAU);
  P.shadeBody(ctx, head, g, hx, hy, hr, hr);
  ctx.save();
  ctx.clip(head);
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.75, hy + hr * 0.45, hr * 0.55, hr * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);
  ctx.fillStyle = '#3b2238';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 1.02, hy + hr * 0.12, hr * 0.12, hr * 0.09, 0, 0, TAU);
  ctx.fill();
  const eyes: P.EyeInfo[] = [];
  sideFace(ctx, g, hx + hr * 0.25, hy - hr * 0.2, hr * (0.36 + 0.05 * g.q), hx + hr * 0.82, hy + hr * 0.45, hr * 0.3, eyes);

  // front paws holding an acorn in front of the chest
  const nx = cx + rx * 1.05;
  const ny = cy - ry * 0.05;
  acorn(ctx, nx, ny, L * 0.055, lw, g.rainbow);
  for (const oy of [-0.02, 0.04]) {
    const paw = makePath();
    paw.ellipse(nx - L * 0.03, ny + L * oy + L * 0.02, L * 0.035, L * 0.025, -0.4, 0, TAU);
    ctx.fillStyle = col(0.02);
    ctx.fill(paw);
    P.strokeBody(ctx, paw, g, lw * 0.7);
  }
  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.45, cy - ry * 0.45, L * 0.13, -0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.1, hy - hr * 0.95, L * 0.15, 0.15);
  if (g.sparkle) P.sparkleStar(ctx, hx + hr * 1.5, hy - hr * 1.2, L * 0.045);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.25,
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail: { canvas: tailC, pivotX: root[0], pivotY: root[1], ...tailAt },
    top: { x: hx, y: hy - hr * 1.7 },
  };
}

// ---------------------------------------------------------------- fox

function fox(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 27 + ((gIn.hue % 10) - 5), 0.56, 0.12);
  const white = hsl(35, 0.25, 0.95);
  const sock = hsl(15, 0.3, 0.22);
  const L = 200 * g.size;
  const rx = L * 0.29;
  const ry = L * 0.18;
  const legLen = L * 0.13;
  const W = Math.ceil(rx * 2 + L * 0.62);
  const H = Math.ceil(ry * 2 + legLen + L * 0.46);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.12;
  const cy = H - legLen - ry - L * 0.03;
  const lw = Math.max(2.5, L * 0.017);
  const col = (dl = 0) => P.bodyColor(g, dl);
  if (g.sparkle) P.aura(ctx, cx + L * 0.08, cy - L * 0.08, rx * 1.4, 30);

  // the tail with a white tip (own canvas, pivot at the root)
  const TW = Math.ceil(L * 0.62);
  const TH = Math.ceil(L * 0.42);
  const { canvas: tailC, ctx: tc } = makeCanvas(TW, TH);
  const root: [number, number] = [TW * 0.92, TH * 0.3];
  const tailPath = fluffPath(root, [TW * 0.5, TH * 0.15], [TW * 0.12, TH * 0.62], (t) => L * (0.04 + 0.085 * Math.sin(Math.min(1, t * 1.05) * Math.PI * 0.8)), 12, g);
  fluffy(tc, tailPath, g, lw, g.rainbow ? rainbowFill(tc, 0, 0, TW, TH) : col(0));
  tc.save();
  tc.clip(tailPath);
  tc.fillStyle = white;
  tc.beginPath();
  tc.arc(TW * 0.1, TH * 0.66, L * 0.1, 0, TAU);
  tc.fill();
  tc.fillStyle = 'rgba(0,0,0,0.1)';
  tc.beginPath();
  tc.ellipse(TW * 0.5, TH * 0.6, TW * 0.4, TH * 0.15, -0.3, 0, TAU);
  tc.fill();
  tc.restore();
  P.crumpleFacets(tc, tailPath, g, TW * 0.5, TH * 0.45, TW * 0.45, TH * 0.4);
  const tailAt = { px: cx - rx * 0.88, py: cy - ry * 0.35 };

  // legs with dark socks; a crumpled fox has one short leg
  const legs: [number, number, number][] = [
    [cx - rx * 0.55, 0.92, -0.08],
    [cx + rx * 0.45, 0.92, -0.08],
    [cx - rx * 0.35, 1, 0],
    [cx + rx * 0.65, g.wobble > 0.4 ? 0.65 : 1, 0],
  ];
  for (const [lx, f, dl] of legs) {
    const lp = makePath();
    const w = L * 0.06;
    lp.roundRect(lx - w / 2, cy + ry * 0.3, w, ry * 0.7 + legLen * f, w / 2);
    ctx.fillStyle = col(dl);
    ctx.fill(lp);
    ctx.save();
    ctx.clip(lp);
    ctx.fillStyle = sock;
    ctx.fillRect(lx - w, cy + ry + legLen * f * 0.35, w * 2, legLen);
    ctx.restore();
    P.strokeBody(ctx, lp, g, lw * 0.8);
  }

  // body with a white chest
  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, g.sat, Math.min(0.85, g.light + 0.15), 0.5));
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.85, cy + ry * 0.2, rx * 0.35, ry * 0.85, -0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.15, y: cy + ry * 0.05, r: ry * 0.68 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head: round with pointed ears and a long snout
  const hr = L * 0.13;
  const hx = cx + rx * 0.98;
  const hy = cy - ry * 1.05;
  for (const ox of [-0.5, 0.25]) {
    const e = makePath();
    const ex = hx + ox * hr;
    e.moveTo(ex - hr * 0.38, hy - hr * 0.55);
    e.quadraticCurveTo(ex - hr * 0.2, hy - hr * 1.3, ex + hr * 0.05, hy - hr * 1.55);
    e.quadraticCurveTo(ex + hr * 0.3, hy - hr * 1.1, ex + hr * 0.4, hy - hr * 0.5);
    e.closePath();
    ctx.fillStyle = col(-0.03);
    ctx.fill(e);
    ctx.save();
    ctx.clip(e);
    ctx.fillStyle = sock;
    ctx.beginPath();
    ctx.ellipse(ex + hr * 0.03, hy - hr * 1.35, hr * 0.25, hr * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    P.strokeBody(ctx, e, g, lw * 0.8);
  }
  const head = makePath();
  head.moveTo(hx - hr * 0.95, hy + hr * 0.1);
  head.quadraticCurveTo(hx - hr * 0.95, hy - hr * 0.95, hx, hy - hr * 0.9);
  head.quadraticCurveTo(hx + hr * 0.75, hy - hr * 0.8, hx + hr * 1.1, hy - hr * 0.05);
  head.quadraticCurveTo(hx + hr * 1.5, hy + hr * 0.15, hx + hr * 1.7, hy + hr * 0.3);
  head.quadraticCurveTo(hx + hr * 1.6, hy + hr * 0.62, hx + hr * 1.0, hy + hr * 0.7);
  head.quadraticCurveTo(hx - hr * 0.2, hy + hr * 1.05, hx - hr * 0.95, hy + hr * 0.1);
  head.closePath();
  P.shadeBody(ctx, head, g, hx, hy, hr, hr);
  ctx.save();
  ctx.clip(head);
  ctx.fillStyle = white;
  ctx.beginPath();
  ctx.moveTo(hx - hr * 0.3, hy + hr * 1.1);
  ctx.quadraticCurveTo(hx + hr * 0.2, hy + hr * 0.1, hx + hr * 1.8, hy + hr * 0.42);
  ctx.lineTo(hx + hr * 1.8, hy + hr * 1.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);
  ctx.fillStyle = '#2a1d24';
  ctx.beginPath();
  ctx.ellipse(hx + hr * 1.68, hy + hr * 0.3, hr * 0.15, hr * 0.12, 0, 0, TAU);
  ctx.fill();
  const eyes: P.EyeInfo[] = [];
  sideFace(ctx, g, hx + hr * 0.3, hy - hr * 0.2, hr * (0.34 + 0.05 * g.q), hx + hr * 1.15, hy + hr * 0.62, hr * 0.32, eyes);
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.2, cy - ry * 0.4, L * 0.14, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.1, hy - hr * 1.0, L * 0.15, 0.12);
  if (g.sparkle) P.sparkleStar(ctx, hx + hr * 1.6, hy - hr * 1.3, L * 0.045);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail: { canvas: tailC, pivotX: root[0], pivotY: root[1], ...tailAt },
    top: { x: hx, y: hy - hr * 1.8 },
  };
}

// ---------------------------------------------------------------- kite

function kite(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, gIn.hue, 0.6, 0.12);
  const L = 200 * g.size;
  const w = L * 0.64;
  const h = L * 0.84;
  const W = Math.ceil(w + L * 0.42);
  const H = Math.ceil(h + L * 0.36);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = H - h / 2 - L * 0.1;
  const lw = Math.max(2.5, L * 0.017);
  const lean = g.wobble > 0.4 ? w * 0.08 : 0;
  const T: [number, number] = [cx + lean, cy - h * 0.5];
  const R: [number, number] = [cx + w / 2, cy - h * 0.12];
  const B: [number, number] = [cx, cy + h * 0.5];
  const Lf: [number, number] = [cx - w / 2, cy - h * 0.12 + lean * 0.6];
  const C: [number, number] = [cx, cy - h * 0.12];
  if (g.sparkle) P.aura(ctx, cx, cy - h * 0.05, w * 0.72, g.hue + 30);

  // the sail, edges bulging a little so it looks soft and friendly
  const bulge = (a: [number, number], b: [number, number], k: number): [number, number] => {
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    return [mx + (mx - C[0]) * k, my + (my - C[1]) * k];
  };
  const kb = g.crumple > 0.5 ? 0.02 : 0.12;
  const sail = makePath();
  const corners = [T, R, B, Lf];
  sail.moveTo(...T);
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    sail.quadraticCurveTo(...bulge(a, b, kb), ...b);
  }
  sail.closePath();
  const tone = (i: number) =>
    g.rainbow ? hsl(RAINBOW[(i * 2 + Math.floor(gIn.hue / 60)) % RAINBOW.length], 0.85, 0.64) : i % 2 ? hsl(g.hue2, Math.min(1, g.sat + 0.05), 0.7) : P.bodyColor(g);
  ctx.save();
  ctx.clip(sail);
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const fa = bulge(a, b, 0.6);
    ctx.fillStyle = tone(i);
    ctx.beginPath();
    ctx.moveTo(...C);
    ctx.lineTo(a[0] + (a[0] - C[0]) * 0.2, a[1] + (a[1] - C[1]) * 0.2);
    ctx.lineTo(...fa);
    ctx.lineTo(b[0] + (b[0] - C[0]) * 0.2, b[1] + (b[1] - C[1]) * 0.2);
    ctx.closePath();
    ctx.fill();
  }
  // soft light from the top left
  const sh = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  sh.addColorStop(0, 'rgba(255,255,255,0.22)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  P.pattern(ctx, sail, g, cx, cy, w / 2, h / 2, 'rgba(255,255,255,0.4)');
  // the wooden cross spars
  ctx.save();
  ctx.clip(sail);
  ctx.strokeStyle = 'rgba(120,80,40,0.55)';
  ctx.lineWidth = lw * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(...T);
  ctx.lineTo(...B);
  ctx.moveTo(...Lf);
  ctx.lineTo(...R);
  ctx.stroke();
  ctx.restore();
  P.crumpleFacets(ctx, sail, g, cx, cy, w / 2, h / 2);
  if (g.glossy) P.gloss(ctx, cx, cy - h * 0.12, w * 0.45, h * 0.4, 0.4);
  P.strokeBody(ctx, sail, g, lw);

  // a friendly face and the badge
  const badgeAt = { x: cx, y: cy + h * 0.13, r: w * 0.175 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const eyes: P.EyeInfo[] = [];
  const er = w * (0.075 + 0.012 * g.q);
  const ey = cy - h * 0.27;
  eyes.push(P.eye(ctx, cx - w * 0.1, ey, er, g.eyeStyle, g.r, [0.35, 0.1]));
  eyes.push(P.eye(ctx, cx + w * 0.11, ey + (g.wobble > 0.4 ? er * 0.3 : 0), er, g.eyeStyle, g.r, [0.35, 0.1]));
  P.blush(ctx, cx - w * 0.2, ey + er * 1.5, er * 0.6);
  P.blush(ctx, cx + w * 0.22, ey + er * 1.5, er * 0.6);
  P.mouth(ctx, cx + w * 0.01, ey + er * 1.7, w * 0.11, g.wobble > 0.4 ? 'wavy' : 'smile');

  // tail: a wavy string with bows (own canvas so it swings)
  const TW = Math.ceil(L * 0.5);
  const TH = Math.ceil(L * 0.95);
  const { canvas: tailC, ctx: tc } = makeCanvas(TW, TH);
  const tx0 = TW / 2;
  const amp = L * 0.06;
  const wave = (y: number) => tx0 + Math.sin((y / TH) * TAU * 1.2) * amp * (y / TH);
  tc.save();
  tc.strokeStyle = P.outlineColor(g);
  tc.lineWidth = Math.max(2, lw * 0.75);
  tc.lineCap = 'round';
  tc.beginPath();
  tc.moveTo(tx0, 2);
  for (let y = 4; y <= TH - L * 0.06; y += 4) tc.lineTo(wave(y), y);
  tc.stroke();
  tc.restore();
  const bows = 2 + Math.round(g.q * 2);
  for (let i = 0; i < bows; i++) {
    const y = (TH - L * 0.1) * ((i + 0.8) / (bows + 0.2));
    const x = wave(y);
    const bw = L * (0.065 + 0.01 * g.q);
    const bh = bw * 0.6;
    const bc = g.rainbow ? hsl(RAINBOW[(i * 2 + 1) % RAINBOW.length], 0.85, 0.62) : i % 2 ? P.bodyColor(g) : hsl(g.hue2, Math.min(1, g.sat + 0.05), 0.62);
    const droop = g.wobble > 0.4 && i === 1 ? 0.6 : 0;
    tc.save();
    tc.translate(x, y);
    tc.rotate(Math.cos((y / TH) * TAU * 1.2) * 0.4 + droop);
    for (const s of [-1, 1]) {
      const p = makePath();
      p.moveTo(0, 0);
      p.quadraticCurveTo(s * bw * 0.6, -bh * 1.1, s * bw, -bh * 0.6);
      p.quadraticCurveTo(s * bw * 1.1, 0, s * bw, bh * 0.6);
      p.quadraticCurveTo(s * bw * 0.6, bh * 1.1, 0, 0);
      p.closePath();
      tc.fillStyle = bc;
      tc.fill(p);
      P.strokeBody(tc, p, g, lw * 0.7);
    }
    tc.fillStyle = P.outlineColor(g);
    tc.beginPath();
    tc.arc(0, 0, bh * 0.3, 0, TAU);
    tc.fill();
    tc.restore();
  }

  if (g.bandaid) P.bandaid(ctx, cx - w * 0.28, cy - h * 0.08, L * 0.13, -0.7);
  if (g.crown) P.crown(ctx, T[0], T[1] + L * 0.035, L * 0.16, 0.05);
  if (g.sparkle) {
    P.sparkleStar(ctx, cx + w * 0.55, cy - h * 0.4, L * 0.045);
    P.sparkleStar(ctx, cx - w * 0.58, cy + h * 0.15, L * 0.035);
  }

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: w * 0.5,
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail: { canvas: tailC, pivotX: tx0, pivotY: 2, px: B[0], py: B[1] - 2 },
    top: { x: T[0], y: T[1] - L * 0.06 },
  };
}

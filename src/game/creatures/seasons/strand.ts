// Beach creatures (side view, facing right): a crab that walks sideways, a seagull, a sandcastle with a face
// and a little flag, and a turtle. The gull flies, the others live on the sand.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

export const STRAND_KINDS = ['Krebs', 'Möwe', 'Sandburg', 'Schildkröte'];

/** which kind a genome hatches as (0 crab, 1 gull, 2 sandcastle, 3 turtle) */
export const strandKind = (g: Genome): number => g.variant % STRAND_KINDS.length;
export const isGull = (g: Genome): boolean => strandKind(g) === 1;
export const isCastle = (g: Genome): boolean => strandKind(g) === 2;

/** distance from the body centre down to where the creature stands on the sand (sprite px) */
const FOOT = new WeakMap<Sprite, number>();
export const footOf = (sp: Sprite): number => FOOT.get(sp) ?? sp.radius;

const RAINBOW = [0, 35, 55, 120, 200, 275];

function rainbowFill(ctx: Ctx, x0: number, y0: number, x1: number, y1: number): CanvasGradient {
  const gr = ctx.createLinearGradient(x0, y0, x1, y1);
  RAINBOW.forEach((h, i) => gr.addColorStop(i / (RAINBOW.length - 1), hsl(h, 0.85, 0.66)));
  return gr;
}

/** a copy of the genome with the colour of a kind (keeps the tier look: paler when crumpled) */
function tinted(g: Genome, hue: number, light: number, sat = g.sat): Genome {
  return { ...g, hue, light, sat: Math.max(0, Math.min(1, sat)) };
}

function face(ctx: Ctx, g: Genome, fx: number, fy: number, er: number, mouthW: number, eyes: P.EyeInfo[]): void {
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.55, fy - er * 0.15, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.5, fy + er * 1.35, er * 0.5);
  P.mouth(ctx, fx + er * 0.55, fy + er * 1.55, mouthW, g.wobble > 0.4 ? 'wavy' : 'smile');
}

export function strandSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = strandKind(g);
  if (k === 0) return crab(g, sticker);
  if (k === 1) return gull(g, sticker);
  if (k === 2) return sandcastle(g, sticker);
  return turtle(g, sticker);
}

// ---------------------------------------------------------------- crab

/** one pincer at the end of an arm: two round lobes that nearly close */
function pincerPath(x: number, y: number, s: number, a: number): Path2D {
  const p = makePath();
  const c = Math.cos(a);
  const sn = Math.sin(a);
  const pt = (u: number, v: number): [number, number] => [x + c * u - sn * v, y + sn * u + c * v];
  p.moveTo(...pt(0, 0));
  p.bezierCurveTo(...pt(-s * 0.2, -s * 0.9), ...pt(s * 0.75, -s * 1.25), ...pt(s * 1.05, -s * 0.35));
  p.quadraticCurveTo(...pt(s * 0.55, -s * 0.45), ...pt(s * 0.35, -s * 0.12));
  p.quadraticCurveTo(...pt(s * 0.75, -s * 0.05), ...pt(s * 0.95, s * 0.25));
  p.bezierCurveTo(...pt(s * 0.6, s * 0.75), ...pt(-s * 0.05, s * 0.6), ...pt(0, 0));
  p.closePath();
  return p;
}

function crab(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 4 + (gIn.hue % 24), Math.min(0.62, gIn.light), gIn.sat + 0.1);
  const L = 200 * g.size;
  const rx = L * 0.34;
  const ry = L * 0.22;
  const W = Math.ceil(L * 1.35);
  const H = Math.ceil(L * 1.02);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = H - L * 0.34;
  const lw = Math.max(2.5, L * 0.017);
  const col = (dl = 0) => P.bodyColor(g, dl);
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.08, rx * 1.35, 30);

  // three jointed legs on each side (a crumpled crab has one leg sticking out funny)
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const odd = g.wobble > 0.4 && side === 1 && i === 1;
      const x0 = cx + side * rx * (0.55 + i * 0.12);
      const y0 = cy + ry * (0.15 + i * 0.18);
      const kx = cx + side * (rx * 0.92 + L * (0.09 + i * 0.035));
      const ky = cy - ry * 0.25 + i * ry * 0.22 + (odd ? -L * 0.06 : 0);
      const fx = cx + side * (rx * 0.85 + L * (0.1 + i * 0.09));
      const fy = cy + ry + L * 0.1 - i * L * 0.035 + (odd ? -L * 0.05 : 0);
      for (const [w, c] of [
        [L * 0.052, P.outlineColor(g)],
        [L * 0.052 - lw * 1.4, col(-0.06)],
      ] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(kx, ky);
        ctx.lineTo(fx, fy);
        ctx.stroke();
      }
    }
  ctx.restore();

  // the back claw (the front one waves, it is the animated part)
  const arm = (ax: number, ay: number, ex: number, ey: number) => {
    ctx.save();
    ctx.lineCap = 'round';
    for (const [w, c] of [
      [L * 0.075, P.outlineColor(g)],
      [L * 0.075 - lw * 1.4, col(-0.03)],
    ] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax - (ex - ax) * 0.1, ey + (ay - ey) * 0.2, ex, ey);
      ctx.stroke();
    }
    ctx.restore();
  };
  const backX = cx - rx * 1.12;
  const backY = cy - ry * 1.15;
  arm(cx - rx * 0.7, cy - ry * 0.2, backX, backY);
  const backClaw = pincerPath(backX - L * 0.04, backY + L * 0.02, L * (0.13 + 0.03 * g.q), -Math.PI * 0.62);
  P.shadeBody(ctx, backClaw, g, backX, backY - L * 0.08, L * 0.12, L * 0.12);
  P.strokeBody(ctx, backClaw, g, lw);

  // eye stalks
  const eyes: P.EyeInfo[] = [];
  const er = L * (0.068 + 0.012 * g.q);
  const stalks: [number, number][] = [
    [cx - rx * 0.22, cy - ry * 1.45 - L * 0.04],
    [cx + rx * 0.38, cy - ry * 1.5 - L * 0.04],
  ];
  ctx.save();
  ctx.lineCap = 'round';
  for (const [sx, sy] of stalks)
    for (const [w, c] of [
      [L * 0.045, P.outlineColor(g)],
      [L * 0.045 - lw * 1.2, col(0)],
    ] as const) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(sx + (cx - sx) * 0.15, cy - ry * 0.6);
      ctx.lineTo(sx, sy + er * 0.6);
      ctx.stroke();
    }
  ctx.restore();

  // body: a wide round shell
  const body = P.blobPath({ cx, cy, rx, ry, g, mirrorX: true, shape: (th) => (Math.sin(th) < 0 ? 1.08 : 0.92) });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue + 25, Math.min(1, g.sat + 0.05), Math.min(0.85, g.light + 0.16), 0.7));
  if (g.rainbow) {
    ctx.save();
    ctx.clip(body);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = rainbowFill(ctx, cx - rx, cy, cx + rx, cy);
    ctx.fillRect(cx - rx * 1.2, cy - ry * 1.3, rx * 2.4, ry * 0.75);
    ctx.restore();
  }
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, g, lw);

  // eyes on top of the stalks, a smile and cheeks on the shell
  for (const [sx, sy] of stalks) eyes.push(P.eye(ctx, sx, sy, er, g.eyeStyle, g.r, [0.45, 0]));
  P.blush(ctx, cx + rx * 0.62, cy - ry * 0.3, L * 0.035);
  P.blush(ctx, cx - rx * 0.6, cy - ry * 0.3, L * 0.03, 0.3);
  P.mouth(ctx, cx + rx * 0.12, cy - ry * 0.58, L * 0.075, g.wobble > 0.4 ? 'wavy' : 'smile');

  const badgeAt = { x: cx - rx * 0.05, y: cy + ry * 0.3, r: ry * 0.6 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.72, cy + ry * 0.05, L * 0.13, -0.5);
  if (g.crown) P.crown(ctx, cx + rx * 0.1, cy - ry * 1.62 - L * 0.04, L * 0.15, 0.08);
  if (g.sparkle) P.sparkleStar(ctx, cx + rx * 1.25, cy - ry * 1.7, L * 0.045);

  // the front claw on its own canvas, so it can wave
  const cs = L * (0.16 + 0.03 * g.q);
  const TW = Math.ceil(L * 0.5);
  const TH = Math.ceil(L * 0.55);
  const t = makeCanvas(TW, TH);
  const tc = t.ctx;
  const pvx = L * 0.06;
  const pvy = TH - L * 0.06;
  const ex = pvx + L * 0.2;
  const ey = pvy - L * 0.24;
  tc.save();
  tc.lineCap = 'round';
  for (const [w, c] of [
    [L * 0.08, P.outlineColor(g)],
    [L * 0.08 - lw * 1.4, col(0)],
  ] as const) {
    tc.strokeStyle = c;
    tc.lineWidth = w;
    tc.beginPath();
    tc.moveTo(pvx, pvy);
    tc.quadraticCurveTo(pvx + L * 0.2, pvy - L * 0.02, ex, ey);
    tc.stroke();
  }
  tc.restore();
  const claw = pincerPath(ex - L * 0.02, ey + L * 0.02, cs, -Math.PI * 0.42);
  P.shadeBody(tc, claw, g, ex + cs * 0.3, ey - cs * 0.5, cs * 0.8, cs * 0.8);
  P.crumpleFacets(tc, claw, g, ex + cs * 0.3, ey - cs * 0.5, cs * 0.8, cs * 0.8);
  if (g.glossy) {
    tc.fillStyle = 'rgba(255,255,255,0.45)';
    tc.beginPath();
    tc.ellipse(ex + cs * 0.05, ey - cs * 0.65, cs * 0.18, cs * 0.09, -0.6, 0, TAU);
    tc.fill();
  }
  P.strokeBody(tc, claw, g, lw);

  const sp: Sprite = {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.2,
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail: { canvas: t.canvas, pivotX: pvx, pivotY: pvy, px: cx + rx * 0.72, py: cy - ry * 0.15 },
    top: { x: cx, y: cy - ry * 1.6 - L * 0.1 },
  };
  FOOT.set(sp, ry + L * 0.1);
  return sp;
}

// ---------------------------------------------------------------- gull

function gull(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  // white with a soft grey-blue outline; the scarf carries the colour
  const g = tinted(gIn, 210, 0.87, 0.22);
  const scarfHue = gIn.hue;
  const scarfSat = Math.min(1, gIn.sat + 0.1);
  const L = 200 * g.size;
  const rx = L * 0.3;
  const ry = L * 0.2;
  const hr = L * 0.13;
  const W = Math.ceil(L * 1.3);
  const H = Math.ceil(L * 0.95);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.05;
  const cy = H / 2 + L * 0.08;
  const lw = Math.max(2.5, L * 0.017);
  if (g.sparkle) P.aura(ctx, cx + L * 0.08, cy - L * 0.04, rx * 1.45, 50);

  // little orange feet
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [fx, f] of [
    [-0.15, 1],
    [0.18, g.wobble > 0.4 ? 0.7 : 1],
  ]) {
    const x = cx + fx * rx;
    const y0 = cy + ry * 0.7;
    const y1 = cy + ry + L * 0.1 * f;
    ctx.strokeStyle = '#c86a18';
    ctx.lineWidth = L * 0.03;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y1);
    ctx.stroke();
    ctx.fillStyle = '#ff9f2e';
    ctx.beginPath();
    ctx.moveTo(x - L * 0.02, y1 - L * 0.012);
    ctx.lineTo(x + L * 0.07, y1 + L * 0.005);
    ctx.lineTo(x - L * 0.02, y1 + L * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#c86a18';
    ctx.lineWidth = lw * 0.6;
    ctx.stroke();
  }
  ctx.restore();

  // tail feathers with dark tips
  const tail = makePath();
  tail.moveTo(cx - rx * 0.7, cy - ry * 0.45);
  tail.lineTo(cx - rx * 1.45, cy - ry * 0.75);
  tail.lineTo(cx - rx * 1.38, cy - ry * 0.25);
  tail.lineTo(cx - rx * 1.5, cy + ry * 0.05);
  tail.lineTo(cx - rx * 0.7, cy + ry * 0.3);
  tail.closePath();
  ctx.fillStyle = '#d7e0ea';
  ctx.fill(tail);
  ctx.save();
  ctx.clip(tail);
  ctx.fillStyle = '#4a5363';
  ctx.fillRect(cx - rx * 1.6, cy - ry, rx * 0.32, ry * 1.4);
  ctx.restore();
  P.strokeBody(ctx, tail, g, lw * 0.9);

  // body
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => (Math.cos(th) < 0 ? 1 - 0.12 * Math.abs(Math.cos(th)) : 1) });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(scarfHue, scarfSat * 0.5, 0.85, 0.6));
  if (g.rainbow) {
    ctx.save();
    ctx.clip(body);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = rainbowFill(ctx, cx - rx, cy - ry, cx + rx, cy + ry);
    ctx.fillRect(cx - rx * 1.2, cy - ry * 1.2, rx * 2.4, ry * 2.4);
    ctx.restore();
  }
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.5);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.12, y: cy + ry * 0.12, r: ry * 0.66 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head
  const hx = cx + rx * 0.92;
  const hy = cy - ry * 0.85;
  const head = makePath();
  head.ellipse(hx, hy, hr * 1.05, hr, 0, 0, TAU);
  P.shadeBody(ctx, head, g, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);
  // beak with the red dot
  const bk = makePath();
  const droop = g.wobble > 0.4 ? hr * 0.18 : 0;
  bk.moveTo(hx + hr * 0.8, hy - hr * 0.05);
  bk.quadraticCurveTo(hx + hr * 1.5, hy - hr * 0.08, hx + hr * 1.95, hy + hr * 0.22 + droop);
  bk.quadraticCurveTo(hx + hr * 1.4, hy + hr * 0.42, hx + hr * 0.82, hy + hr * 0.38);
  bk.closePath();
  ctx.fillStyle = g.tier === 'zerknittert' ? '#e8d48a' : '#ffcd38';
  ctx.fill(bk);
  ctx.fillStyle = '#ff5a4a';
  ctx.beginPath();
  ctx.arc(hx + hr * 1.5, hy + hr * 0.26, hr * 0.09, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = '#b07a10';
  ctx.lineWidth = lw * 0.8;
  ctx.lineJoin = 'round';
  ctx.stroke(bk);
  ctx.restore();
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.36 + 0.05 * g.q);
  const fx = hx + hr * 0.12;
  const fy = hy - hr * 0.2;
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.5, fy - er * 0.2, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.2, fy + er * 1.45, er * 0.5, 0.5);

  // a little sailor scarf round the neck in the creature's colour
  const sc = makePath();
  sc.moveTo(hx - hr * 0.9, hy + hr * 0.55);
  sc.quadraticCurveTo(hx - hr * 0.1, hy + hr * 1.25, hx + hr * 0.6, hy + hr * 0.75);
  sc.lineTo(hx + hr * 0.55, hy + hr * 1.15);
  sc.quadraticCurveTo(hx - hr * 0.2, hy + hr * 1.6, hx - hr * 1.0, hy + hr * 0.95);
  sc.closePath();
  ctx.fillStyle = g.rainbow ? rainbowFill(ctx, hx - hr, hy, hx + hr, hy + hr) : hsl(scarfHue, scarfSat, 0.56);
  ctx.fill(sc);
  ctx.save();
  ctx.strokeStyle = hsl(scarfHue, scarfSat, 0.3);
  ctx.lineWidth = lw * 0.7;
  ctx.lineJoin = 'round';
  ctx.stroke(sc);
  ctx.restore();

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.35, cy + ry * 0.55, L * 0.13, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.1, hy - hr * 0.88, L * 0.15, 0.12);
  if (g.sparkle) P.sparkleStar(ctx, cx - rx * 1.2, cy - ry * 1.5, L * 0.045);

  // the wing, on its own canvas so it can flap; it rests along the back and points backwards
  const WW = Math.ceil(L * 0.85);
  const WH = Math.ceil(L * 0.5);
  const w = makeCanvas(WW, WH);
  const wc = w.ctx;
  const pvx = WW - L * 0.1;
  const pvy = WH * 0.62;
  const wing = makePath();
  wing.moveTo(pvx + L * 0.06, pvy + L * 0.02);
  wing.bezierCurveTo(pvx - L * 0.05, pvy - L * 0.2, pvx - L * 0.4, pvy - L * 0.22, pvx - L * 0.68, pvy - L * 0.08);
  wing.bezierCurveTo(pvx - L * 0.45, pvy + L * 0.02, pvx - L * 0.2, pvy + L * 0.12, pvx + L * 0.06, pvy + L * 0.02);
  wing.closePath();
  const wg = wc.createLinearGradient(pvx, 0, pvx - L * 0.7, 0);
  wg.addColorStop(0, g.tier === 'zerknittert' ? '#cfd6de' : '#b9c7d8');
  wg.addColorStop(0.7, g.tier === 'zerknittert' ? '#b7c0ca' : '#9fb0c6');
  wc.fillStyle = wg;
  wc.fill(wing);
  wc.save();
  wc.clip(wing);
  wc.fillStyle = '#3f4756';
  wc.fillRect(pvx - L * 0.72, 0, L * 0.17, WH);
  wc.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 3; i++) {
    wc.beginPath();
    wc.arc(pvx - L * (0.6 + i * 0.03), pvy - L * (0.1 - i * 0.04), L * 0.012, 0, TAU);
    wc.fill();
  }
  wc.restore();
  P.crumpleFacets(wc, wing, g, pvx - L * 0.3, pvy - L * 0.06, L * 0.35, L * 0.12);
  if (g.glossy) {
    wc.fillStyle = 'rgba(255,255,255,0.45)';
    wc.beginPath();
    wc.ellipse(pvx - L * 0.2, pvy - L * 0.1, L * 0.12, L * 0.025, -0.15, 0, TAU);
    wc.fill();
  }
  P.strokeBody(wc, wing, g, lw);

  const sp: Sprite = {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.15,
    eyes,
    lid: '#eef3f8',
    tail: { canvas: w.canvas, pivotX: pvx, pivotY: pvy, px: cx + rx * 0.25, py: cy - ry * 0.55 },
    top: { x: hx, y: hy - hr * 1.5 },
  };
  FOOT.set(sp, ry + L * 0.1);
  return sp;
}

// ---------------------------------------------------------------- sandcastle

function sandcastle(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 38 + (gIn.hue % 10), 0.72, Math.min(0.75, gIn.sat * 0.8 + 0.08));
  const L = 200 * g.size;
  const W = Math.ceil(L * 1.1);
  const H = Math.ceil(L * 1.28);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const bottom = H - L * 0.05;
  const cy = bottom - L * 0.3;
  const lw = Math.max(2.5, L * 0.017);
  const r = g.r;
  /** wobbly tiers build crooked walls */
  const j = () => (r() - 0.5) * L * 0.05 * g.wobble;
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.12, L * 0.5, 45);

  /** a block with battlements on top, a little narrower at the top like a bucket shape */
  const block = (x0: number, x1: number, yTop: number, yBot: number, merlons: number, taper: number): Path2D => {
    const p = makePath();
    const t = (x1 - x0) * taper;
    p.moveTo(x0 + j(), yBot);
    p.lineTo(x0 + t + j(), yTop + j());
    const w = x1 - x0 - 2 * t;
    const n = merlons * 2 - 1;
    const mh = L * 0.045;
    for (let i = 0; i < n; i++) {
      const a = x0 + t + (i / n) * w;
      const b = x0 + t + ((i + 1) / n) * w;
      const y = i % 2 ? yTop : yTop - mh;
      p.lineTo(a, y + j() * 0.5);
      p.lineTo(b, y + j() * 0.5);
    }
    p.lineTo(x1 - t + j(), yTop + j());
    p.lineTo(x1 + j(), yBot);
    p.closePath();
    return p;
  };
  const fillBlock = (p: Path2D, bx: number, by: number, rx: number, ry: number) => {
    P.shadeBody(ctx, p, g, bx, by, rx, ry);
    // sand grains
    ctx.save();
    ctx.clip(p);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(140,100,40,0.18)' : 'rgba(255,250,220,0.35)';
      ctx.beginPath();
      ctx.arc(bx + (r() * 2 - 1) * rx, by + (r() * 2 - 1) * ry, L * 0.006 + r() * L * 0.006, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    P.pattern(ctx, p, g, bx, by, rx, ry, hsl(g.hue + 10, g.sat, Math.min(0.9, g.light + 0.1), 0.55));
    P.crumpleFacets(ctx, p, g, bx, by, rx, ry);
  };

  // two little side towers (bucket shapes)
  const sideTop = cy - L * 0.24;
  const towers: Path2D[] = [];
  for (const side of [-1, 1]) {
    const tx = cx + side * L * 0.32;
    const sag = g.wobble > 0.4 && side === 1 ? L * 0.06 : 0;
    const p = block(tx - L * 0.1, tx + L * 0.1, sideTop + sag, cy + L * 0.05, 2, 0.12);
    fillBlock(p, tx, cy - L * 0.1, L * 0.1, L * 0.15);
    P.strokeBody(ctx, p, g, lw);
    towers.push(p);
    // a tiny arched window
    ctx.fillStyle = 'rgba(110,70,30,0.55)';
    ctx.beginPath();
    ctx.ellipse(tx, sideTop + sag + L * 0.1, L * 0.022, L * 0.032, 0, 0, TAU);
    ctx.fill();
  }

  // the wide base with a gate
  const base = block(cx - L * 0.44, cx + L * 0.44, cy - L * 0.02, bottom, 5, 0.03);
  fillBlock(base, cx, cy + L * 0.13, L * 0.44, L * 0.16);
  if (g.glossy) P.gloss(ctx, cx - L * 0.15, cy + L * 0.13, L * 0.3, L * 0.16, 0.3);
  P.strokeBody(ctx, base, g, lw);

  // the middle tower with the face
  const midTop = cy - L * 0.44;
  const mid = block(cx - L * 0.2, cx + L * 0.2, midTop, cy + L * 0.0, 3, 0.06);
  fillBlock(mid, cx, cy - L * 0.22, L * 0.2, L * 0.22);
  if (g.glossy) P.gloss(ctx, cx, cy - L * 0.22, L * 0.2, L * 0.22, 0.35);
  P.strokeBody(ctx, mid, g, lw);
  // a seam where the tower sits on the base
  ctx.save();
  ctx.strokeStyle = P.bodyColor(g, -0.2, 0, 0.5);
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - L * 0.19, cy - L * 0.01);
  ctx.lineTo(cx + L * 0.19, cy - L * 0.01);
  ctx.stroke();
  ctx.restore();

  // shells pressed into the wall; the best castles have colourful ones
  const shells: [number, number, number][] = [
    [cx - L * 0.35, cy + L * 0.06, 0],
    [cx + L * 0.33, cy + L * 0.17, 1],
    [cx + L * 0.3, cy - L * 0.08, 2],
  ];
  shells.slice(0, g.q > 0.5 ? 3 : 1).forEach(([sx, sy, i]) => {
    const sr = L * 0.035;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate((i - 1) * 0.4);
    ctx.fillStyle = g.rainbow ? hsl(RAINBOW[(i * 2) % RAINBOW.length], 0.8, 0.75) : i === 1 ? '#ffd2dc' : '#fff1de';
    ctx.beginPath();
    ctx.moveTo(0, sr * 0.7);
    ctx.arc(0, 0, sr, Math.PI * 1.05, Math.PI * 1.95);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,60,0.7)';
    ctx.lineWidth = Math.max(1, lw * 0.4);
    ctx.stroke();
    for (const a of [-0.5, 0, 0.5]) {
      ctx.beginPath();
      ctx.moveTo(0, sr * 0.6);
      ctx.lineTo(Math.sin(a) * sr * 0.9, -Math.cos(a) * sr * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  });

  const eyes: P.EyeInfo[] = [];
  face(ctx, g, cx + L * 0.06, cy - L * 0.3, L * (0.055 + 0.01 * g.q), L * 0.07, eyes);
  const badgeAt = { x: cx - L * 0.05, y: cy + L * 0.15, r: L * 0.115 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  if (g.bandaid) P.bandaid(ctx, cx - L * 0.12, cy - L * 0.33, L * 0.12, -0.5);
  // the flag pole on the middle tower (the flag itself waves)
  const poleX = cx - L * 0.02;
  const poleTop = midTop - L * 0.3;
  ctx.save();
  ctx.strokeStyle = '#7b5530';
  ctx.lineWidth = L * 0.018;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(poleX, midTop - L * 0.03);
  ctx.lineTo(poleX, poleTop);
  ctx.stroke();
  ctx.fillStyle = '#ffd84a';
  ctx.beginPath();
  ctx.arc(poleX, poleTop, L * 0.016, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (g.crown) P.crown(ctx, cx + L * 0.12, midTop - L * 0.05, L * 0.14, 0.15);
  if (g.sparkle) P.sparkleStar(ctx, cx - L * 0.38, cy - L * 0.42, L * 0.045);

  // the flag on its own canvas (pivot at the pole)
  const FW = Math.ceil(L * 0.3);
  const FH = Math.ceil(L * 0.2);
  const f = makeCanvas(FW, FH);
  const fc = f.ctx;
  const fpx = L * 0.02;
  const fpy = L * 0.02;
  const flag = makePath();
  const fl = L * (0.2 + 0.04 * g.q);
  const fh = L * 0.12;
  flag.moveTo(fpx, fpy);
  flag.quadraticCurveTo(fpx + fl * 0.5, fpy - fh * 0.15, fpx + fl, fpy + fh * 0.35);
  if (g.q > 0.5) flag.lineTo(fpx + fl * 0.75, fpy + fh * 0.5);
  flag.lineTo(fpx + fl, fpy + fh * 0.7);
  flag.quadraticCurveTo(fpx + fl * 0.5, fpy + fh * 0.75, fpx, fpy + fh);
  flag.closePath();
  fc.fillStyle = g.rainbow ? rainbowFill(fc, fpx, 0, fpx + fl, 0) : hsl(gIn.hue, Math.min(1, gIn.sat + 0.1), 0.55);
  fc.fill(flag);
  if (g.pattern !== 'none' && !g.rainbow) {
    fc.save();
    fc.clip(flag);
    fc.fillStyle = 'rgba(255,255,255,0.7)';
    fc.beginPath();
    fc.arc(fpx + fl * 0.4, fpy + fh * 0.45, fh * 0.2, 0, TAU);
    fc.fill();
    fc.restore();
  }
  fc.save();
  fc.strokeStyle = hsl(gIn.hue, Math.min(1, gIn.sat + 0.1), 0.3);
  fc.lineWidth = lw * 0.7;
  fc.lineJoin = 'round';
  fc.stroke(flag);
  fc.restore();

  const sp: Sprite = {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: L * 0.42,
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail: { canvas: f.canvas, pivotX: fpx, pivotY: fpy, px: poleX, py: poleTop + L * 0.01 },
    top: { x: cx, y: poleTop - L * 0.05 },
  };
  FOOT.set(sp, bottom - cy);
  return sp;
}

// ---------------------------------------------------------------- turtle

function turtle(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const shellHue = 85 + (gIn.hue % 75);
  const g = tinted(gIn, shellHue, Math.min(0.56, gIn.light - 0.04), gIn.sat);
  const skin = tinted(gIn, 75 + (gIn.hue % 30), 0.68, gIn.sat * 0.85);
  const L = 225 * g.size;
  const rx = L * 0.34;
  const ry = L * 0.3;
  const hr = L * 0.12;
  const W = Math.ceil(L * 1.4);
  const H = Math.ceil(L * 0.9);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.08;
  const cy = H - L * 0.3;
  const lw = Math.max(2.5, L * 0.017);
  if (g.sparkle) P.aura(ctx, cx + L * 0.05, cy - L * 0.1, rx * 1.4, 80);

  // back leg and little tail
  const leg = (c: Ctx, x: number, y: number, len: number, a: number) => {
    const p = makePath();
    p.ellipse(x, y + len * 0.5, L * 0.065, len * 0.6, a, 0, TAU);
    c.fillStyle = P.bodyColor(skin, -0.04);
    c.fill(p);
    P.crumpleFacets(c, p, skin, x, y + len * 0.5, L * 0.065, len * 0.6);
    P.strokeBody(c, p, skin, lw * 0.85);
  };
  const tl = makePath();
  tl.moveTo(cx - rx * 0.85, cy - ry * 0.05);
  tl.quadraticCurveTo(cx - rx * 1.25, cy + ry * 0.05, cx - rx * 1.3, cy + ry * 0.3);
  tl.quadraticCurveTo(cx - rx * 1.05, cy + ry * 0.3, cx - rx * 0.8, cy + ry * 0.25);
  tl.closePath();
  ctx.fillStyle = P.bodyColor(skin, -0.02);
  ctx.fill(tl);
  P.strokeBody(ctx, tl, skin, lw * 0.85);
  leg(ctx, cx - rx * 0.55, cy + ry * 0.05, L * 0.16, 0.25);
  leg(ctx, cx + rx * 0.2, cy + ry * 0.05, L * (g.wobble > 0.4 ? 0.12 : 0.15), -0.05);

  // the head on a short neck
  const hx = cx + rx * 1.12;
  const hy = cy - ry * 0.55;
  const neck = makePath();
  neck.moveTo(cx + rx * 0.6, cy - ry * 0.3);
  neck.quadraticCurveTo(hx - hr * 0.6, hy - hr * 0.5, hx - hr * 0.2, hy - hr * 0.6);
  neck.lineTo(hx, hy + hr * 0.6);
  neck.quadraticCurveTo(hx - hr * 1.0, hy + hr * 1.2, cx + rx * 0.6, cy + ry * 0.2);
  neck.closePath();
  ctx.fillStyle = P.bodyColor(skin, 0);
  ctx.fill(neck);
  P.strokeBody(ctx, neck, skin, lw);
  const head = makePath();
  head.ellipse(hx, hy, hr * 1.15, hr * 0.95, -0.1, 0, TAU);
  P.shadeBody(ctx, head, skin, hx, hy, hr * 1.1, hr);
  P.crumpleFacets(ctx, head, skin, hx, hy, hr, hr);
  if (skin.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.35);
  P.strokeBody(ctx, head, skin, lw);
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.38 + 0.05 * g.q);
  const fx = hx + hr * 0.2;
  const fy = hy - hr * 0.22;
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.5, fy - er * 0.15, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.3, fy + er * 1.4, er * 0.5, 0.5);
  P.mouth(ctx, hx + hr * 0.6, hy + hr * 0.45, hr * 0.42, g.wobble > 0.4 ? 'wavy' : 'smile');

  // the shell: a dome with a pale rim
  const shell = P.blobPath({
    cx,
    cy,
    rx,
    ry,
    g,
    shape: (th) => (Math.sin(th) > 0 ? Math.min(1, 0.1 / Math.max(0.01, Math.sin(th))) : 1),
  });
  P.shadeBody(ctx, shell, g, cx, cy - ry * 0.3, rx, ry);
  ctx.save();
  ctx.clip(shell);
  // the plates
  ctx.strokeStyle = P.bodyColor(g, -0.2, 0, 0.75);
  ctx.lineWidth = lw * 0.8;
  ctx.lineJoin = 'round';
  const plate = (px: number, py: number, s: number, i: number) => {
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + Math.PI / 6;
      ctx.lineTo(px + Math.cos(a) * s * 1.15, py + Math.sin(a) * s * 0.85);
    }
    ctx.closePath();
    if (g.rainbow) {
      ctx.fillStyle = hsl(RAINBOW[i % RAINBOW.length], 0.8, 0.68, 0.55);
      ctx.fill();
    } else if (g.q > 0.5) {
      ctx.fillStyle = P.bodyColor(g, 0.1, 0, 0.5);
      ctx.fill();
    }
    ctx.stroke();
  };
  const ps = L * 0.085;
  let pi = 0;
  for (const [ox, oy] of [
    [-0.62, -0.25],
    [0.62, -0.25],
    [0, -0.62],
    [-0.42, -0.85],
    [0.42, -0.85],
  ])
    plate(cx + ox * rx, cy + oy * ry, ps, pi++);
  ctx.restore();
  P.pattern(ctx, shell, g, cx, cy - ry * 0.4, rx, ry * 0.6);
  P.crumpleFacets(ctx, shell, g, cx, cy - ry * 0.4, rx, ry * 0.6);
  if (g.glossy) P.gloss(ctx, cx, cy - ry * 0.25, rx, ry * 0.9, 0.45);
  P.strokeBody(ctx, shell, g, lw);
  // the rim along the bottom of the shell
  const rim = makePath();
  rim.roundRect(cx - rx * 1.02, cy - ry * 0.02, rx * 2.04, ry * 0.26, ry * 0.13);
  ctx.fillStyle = hsl(shellHue - 30, g.sat * 0.7, 0.75);
  ctx.fill(rim);
  P.strokeBody(ctx, rim, g, lw * 0.85);

  const badgeAt = { x: cx - rx * 0.02, y: cy - ry * 0.5, r: ry * 0.52 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.6, cy - ry * 0.6, L * 0.13, -0.6);
  if (g.crown) P.crown(ctx, hx - hr * 0.05, hy - hr * 0.85, L * 0.14, 0.12);
  if (g.sparkle) P.sparkleStar(ctx, cx - rx * 1.05, cy - ry * 1.3, L * 0.045);

  // the front leg paddles (animated part, drawn behind the shell rim)
  const LW = Math.ceil(L * 0.3);
  const LH = Math.ceil(L * 0.36);
  const lc = makeCanvas(LW, LH);
  const lpx = LW / 2;
  const lpy = L * 0.05;
  leg(lc.ctx, lpx, lpy, L * 0.2, -0.15);

  const sp: Sprite = {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.15,
    eyes,
    lid: P.bodyColor(skin, 0.05),
    tail: { canvas: lc.canvas, pivotX: lpx, pivotY: lpy, px: cx + rx * 0.6, py: cy + ry * 0.05 },
    top: { x: hx, y: hy - hr * 1.4 },
  };
  FOOT.set(sp, ry * 0.05 + L * 0.2);
  return sp;
}

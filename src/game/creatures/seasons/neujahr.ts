// New Year creatures (side view, facing right): a slim firework rocket, a lucky pig, a round stick rocket
// and a four-leaf clover. The rockets fly up and bloom in the sky, the lucky charms walk on the ground.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

export const NEUJAHR_KINDS = ['Rakete', 'Glücksschwein', 'Kugelrakete', 'Kleeblatt'];

/** which kind a genome hatches as (0 rocket, 1 lucky pig, 2 round rocket, 3 clover) */
export const neujahrKind = (g: Genome): number => g.variant % NEUJAHR_KINDS.length;
/** rockets fly in the sky, the others walk */
export const isRocket = (g: Genome): boolean => neujahrKind(g) === 0 || neujahrKind(g) === 2;

/** distance from the body centre down to where a rocket's flame comes out (sprite px) */
const NOZZLE = new WeakMap<Sprite, number>();
export const nozzleOf = (sp: Sprite): number => NOZZLE.get(sp) ?? sp.radius;

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

function face(ctx: Ctx, g: Genome, fx: number, fy: number, er: number, mouthW: number, eyes: P.EyeInfo[]): void {
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.55, fy - er * 0.15, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.5, fy + er * 1.35, er * 0.5);
  P.mouth(ctx, fx + er * 0.55, fy + er * 1.55, mouthW, g.wobble > 0.4 ? 'wavy' : 'smile');
}

export function neujahrSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = neujahrKind(g);
  if (k === 0) return slimRocket(g, sticker);
  if (k === 1) return luckyPig(g, sticker);
  if (k === 2) return roundRocket(g, sticker);
  return clover(g, sticker);
}

/** rounded-rectangle body for rockets (superellipse) */
const tube = (n: number) => (th: number) => 1 / Math.pow(Math.pow(Math.abs(Math.cos(th)), n) + Math.pow(Math.abs(Math.sin(th)), n), 1 / n);

function slimRocket(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, gIn.hue, Math.min(0.66, gIn.light + 0.02), 0.08);
  const L = 200 * g.size;
  const rx = L * 0.22;
  const ry = L * 0.36;
  const coneH = L * 0.24;
  const finW = L * 0.13;
  const nozH = L * 0.07;
  const W = Math.ceil(L * 1.0);
  const top = coneH + L * 0.24;
  const H = Math.ceil(top + ry * 2 + nozH + L * 0.12);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = top + ry;
  const lw = Math.max(2.5, L * 0.017);
  const capCol = (dl = 0) => hsl(g.hue2, Math.min(1, g.sat + 0.1), Math.min(0.75, 0.55 + dl));
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.06, ry * 1.12, g.hue + 30);

  // nozzle
  const noz = makePath();
  noz.moveTo(cx - rx * 0.42, cy + ry * 0.8);
  noz.lineTo(cx + rx * 0.42, cy + ry * 0.8);
  noz.lineTo(cx + rx * 0.62, cy + ry + nozH);
  noz.lineTo(cx - rx * 0.62, cy + ry + nozH);
  noz.closePath();
  ctx.fillStyle = '#9aa0bf';
  ctx.fill(noz);
  P.strokeBody(ctx, noz, g, lw * 0.8);

  // fins (a crumpled rocket has one bent fin)
  for (const side of [-1, 1]) {
    const bent = g.wobble > 0.4 && side === 1 ? 0.7 : 1;
    const fin = makePath();
    fin.moveTo(cx + side * rx * 0.8, cy + ry * 0.15);
    fin.quadraticCurveTo(cx + side * (rx + finW * 1.05), cy + ry * 0.45, cx + side * (rx + finW * 0.95 * bent), cy + ry + nozH * 0.7 * bent);
    fin.quadraticCurveTo(cx + side * (rx + finW * 0.3), cy + ry * 0.8, cx + side * rx * 0.5, cy + ry * 0.85);
    fin.closePath();
    ctx.fillStyle = g.rainbow ? rainbowFill(ctx, cx - rx - finW, cy, cx + rx + finW, cy + ry) : capCol(-0.04);
    ctx.fill(fin);
    P.strokeBody(ctx, fin, g, lw * 0.9);
  }

  // body
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: tube(2.6), mirrorX: true });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry);
  // a band round the bottom
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = g.rainbow ? rainbowFill(ctx, cx - rx, 0, cx + rx, 0) : capCol(0.05);
  ctx.fillRect(cx - rx * 1.2, cy + ry * 0.62, rx * 2.4, ry * 0.2);
  ctx.restore();
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, g, lw);

  // nose cone
  const tipY = cy - ry - coneH;
  const cone = makePath();
  const lean = g.wobble > 0.4 ? rx * 0.25 : 0;
  cone.moveTo(cx - rx * 0.95, cy - ry * 0.62);
  cone.quadraticCurveTo(cx - rx * 0.85, cy - ry - coneH * 0.45, cx + lean, tipY);
  cone.quadraticCurveTo(cx + rx * 0.85, cy - ry - coneH * 0.45, cx + rx * 0.95, cy - ry * 0.62);
  cone.quadraticCurveTo(cx, cy - ry * 0.42, cx - rx * 0.95, cy - ry * 0.62);
  cone.closePath();
  const cg = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  cg.addColorStop(0, capCol(0.12));
  cg.addColorStop(1, capCol(-0.08));
  ctx.fillStyle = cg;
  ctx.fill(cone);
  P.crumpleFacets(ctx, cone, g, cx, tipY + coneH * 0.6, rx, coneH * 0.6);
  if (g.glossy) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.35, cy - ry - coneH * 0.2, rx * 0.12, coneH * 0.22, 0.35, 0, TAU);
    ctx.fill();
  }
  P.strokeBody(ctx, cone, g, lw);

  // badge (the porthole) and face
  const badgeAt = { x: cx - rx * 0.08, y: cy + ry * 0.27, r: rx * 0.64 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const eyes: P.EyeInfo[] = [];
  face(ctx, g, cx + rx * 0.4, cy - ry * 0.47, rx * (0.27 + 0.05 * g.q), rx * 0.32, eyes);
  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.45, cy - ry * 0.25, L * 0.12, -0.5);
  if (g.crown) P.crown(ctx, cx + lean, tipY + L * 0.03, L * 0.15, 0.1);
  if (g.sparkle) P.sparkleStar(ctx, cx + rx * 1.35, cy - ry * 0.9, L * 0.045);

  const sp: Sprite = {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx * 1.4,
    eyes,
    lid: P.bodyColor(g, 0.05),
    top: { x: cx + lean, y: tipY - L * 0.06 },
  };
  NOZZLE.set(sp, ry + nozH);
  return sp;
}

function roundRocket(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, gIn.hue, Math.min(0.66, gIn.light + 0.02), 0.08);
  const L = 200 * g.size;
  const rx = L * 0.27;
  const ry = L * 0.255;
  const capH = L * 0.13;
  const stick = L * 0.42;
  const W = Math.ceil(L * 0.95);
  const top = capH + L * 0.26;
  const H = Math.ceil(top + ry * 2 + stick + L * 0.06);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = top + ry;
  const lw = Math.max(2.5, L * 0.017);
  if (g.sparkle) P.aura(ctx, cx, cy, Math.max(rx, ry) * 1.2, g.hue + 30);

  // the wooden stick
  const st = makePath();
  const sw = L * 0.04;
  const bend = g.wobble > 0.4 ? L * 0.06 : 0;
  st.moveTo(cx - sw / 2, cy + ry * 0.5);
  st.lineTo(cx + sw / 2, cy + ry * 0.5);
  st.lineTo(cx + sw / 2 + bend, cy + ry + stick);
  st.lineTo(cx - sw / 2 + bend, cy + ry + stick);
  st.closePath();
  ctx.fillStyle = '#d9a35f';
  ctx.fill(st);
  P.strokeBody(ctx, st, g, lw * 0.75);

  // body
  const body = P.blobPath({ cx, cy, rx, ry, g, mirrorX: true });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  // a spiral wrap of the paper
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = g.rainbow ? rainbowFill(ctx, cx - rx, cy - ry, cx + rx, cy + ry) : hsl(g.hue2, Math.min(1, g.sat + 0.1), 0.7, 0.85);
  ctx.lineWidth = L * 0.035;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - rx * 1.1, cy + i * ry * 0.45 + ry * 0.35);
    ctx.quadraticCurveTo(cx, cy + i * ry * 0.45 + ry * 0.1, cx + rx * 1.1, cy + i * ry * 0.45 - ry * 0.35);
    ctx.stroke();
  }
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry);
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.45);
  P.strokeBody(ctx, body, g, lw);

  // small cap with a star on the tip
  const tipY = cy - ry - capH;
  const cap = makePath();
  cap.moveTo(cx - rx * 0.62, cy - ry * 0.78);
  cap.quadraticCurveTo(cx - rx * 0.3, tipY + capH * 0.1, cx, tipY);
  cap.quadraticCurveTo(cx + rx * 0.3, tipY + capH * 0.1, cx + rx * 0.62, cy - ry * 0.78);
  cap.quadraticCurveTo(cx, cy - ry * 0.6, cx - rx * 0.62, cy - ry * 0.78);
  cap.closePath();
  ctx.fillStyle = hsl(g.hue2, Math.min(1, g.sat + 0.1), 0.58);
  ctx.fill(cap);
  P.crumpleFacets(ctx, cap, g, cx, tipY + capH * 0.6, rx * 0.6, capH * 0.6);
  P.strokeBody(ctx, cap, g, lw);
  if (g.crown) P.crown(ctx, cx, tipY + L * 0.04, L * 0.16, 0.1);
  else {
    ctx.save();
    ctx.strokeStyle = '#a86b00';
    ctx.lineWidth = lw * 0.7;
    ctx.lineJoin = 'round';
    const sr = L * (0.05 + 0.025 * g.q);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2;
      const rr = i % 2 ? sr * 0.45 : sr;
      ctx.lineTo(cx + Math.cos(a) * rr, tipY - sr * 0.6 + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = g.tier === 'zerknittert' ? '#e8dca0' : '#ffd84a';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const badgeAt = { x: cx - rx * 0.24, y: cy + ry * 0.3, r: ry * 0.52 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const eyes: P.EyeInfo[] = [];
  face(ctx, g, cx + rx * 0.47, cy - ry * 0.42, rx * (0.22 + 0.04 * g.q), rx * 0.26, eyes);
  if (g.bandaid) P.bandaid(ctx, cx - rx * 0.5, cy - ry * 0.45, L * 0.13, -0.4);
  if (g.sparkle) P.sparkleStar(ctx, cx + rx * 1.15, cy - ry * 0.8, L * 0.045);

  const sp: Sprite = {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(g, 0.05),
    top: { x: cx, y: tipY - L * 0.08 },
  };
  NOZZLE.set(sp, ry);
  return sp;
}

function luckyPig(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 345 + ((gIn.hue % 20) - 10), 0.76, 0.05);
  const L = 200 * g.size;
  const rx = L * 0.3;
  const ry = L * 0.22;
  const legLen = L * 0.08;
  const hr = L * 0.15;
  const W = Math.ceil(rx * 2 + L * 0.7);
  const H = Math.ceil(ry * 2 + legLen + L * 0.5);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.1;
  const cy = H - legLen - ry - L * 0.04;
  const lw = Math.max(2.5, L * 0.017);
  const col = (dl = 0) => P.bodyColor(g, dl);
  if (g.sparkle) P.aura(ctx, cx + L * 0.08, cy - L * 0.06, rx * 1.4, 40);

  // short legs; a crumpled pig has one shorter leg
  const legs: [number, number, number][] = [
    [cx - rx * 0.55, 0.92, -0.06],
    [cx + rx * 0.45, 0.92, -0.06],
    [cx - rx * 0.35, 1, 0],
    [cx + rx * 0.62, g.wobble > 0.4 ? 0.6 : 1, 0],
  ];
  for (const [lx, f, dl] of legs) {
    const lp = makePath();
    const w = L * 0.075;
    lp.roundRect(lx - w / 2, cy + ry * 0.4, w, ry * 0.6 + legLen * f, w / 2);
    ctx.fillStyle = col(dl - 0.04);
    ctx.fill(lp);
    P.strokeBody(ctx, lp, g, lw * 0.8);
    ctx.fillStyle = hsl(g.hue, 0.3, 0.45);
    ctx.beginPath();
    ctx.ellipse(lx, cy + ry + legLen * f - 2, w * 0.5, w * 0.22, 0, 0, TAU);
    ctx.fill();
  }

  // curly tail
  ctx.save();
  ctx.strokeStyle = P.outlineColor(g);
  ctx.lineWidth = lw * 1.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const tx = cx - rx * 0.95;
  const ty = cy - ry * 0.25;
  ctx.moveTo(tx, ty);
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * TAU * 1.4;
    const rr = L * 0.045 * (1 - i / 40);
    ctx.lineTo(tx - L * 0.05 - Math.cos(a) * rr, ty - L * 0.02 - Math.sin(a) * rr);
  }
  ctx.stroke();
  ctx.restore();

  // body
  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, g.sat, Math.min(0.9, g.light + 0.1), 0.6));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.15, y: cy + ry * 0.08, r: ry * 0.62 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // head
  const hx = cx + rx * 0.9;
  const hy = cy - ry * 0.55;
  // ears (behind)
  for (const [ox, rot] of [
    [-0.55, -0.35],
    [0.2, 0.25],
  ]) {
    const e = makePath();
    const ex = hx + ox * hr;
    const ey = hy - hr * 0.75;
    e.moveTo(ex - hr * 0.3, ey + hr * 0.15);
    e.quadraticCurveTo(ex + Math.sin(rot) * hr * 0.6 - hr * 0.1, ey - hr * 0.75, ex + Math.sin(rot) * hr * 0.6 + hr * 0.2, ey - hr * 0.55);
    e.quadraticCurveTo(ex + hr * 0.35, ey - hr * 0.1, ex + hr * 0.3, ey + hr * 0.15);
    e.closePath();
    ctx.fillStyle = col(-0.06);
    ctx.fill(e);
    P.strokeBody(ctx, e, g, lw * 0.8);
  }
  const head = makePath();
  head.ellipse(hx, hy, hr * 1.05, hr * 0.95, 0, 0, TAU);
  ctx.fillStyle = col(0.03);
  ctx.fill(head);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);
  // snout
  const sn = makePath();
  sn.ellipse(hx + hr * 0.95, hy + hr * 0.22, hr * 0.3, hr * 0.27, 0, 0, TAU);
  ctx.fillStyle = col(-0.07);
  ctx.fill(sn);
  P.strokeBody(ctx, sn, g, lw * 0.8);
  ctx.fillStyle = hsl(g.hue, 0.45, 0.38);
  for (const oy of [-0.08, 0.12]) {
    ctx.beginPath();
    ctx.ellipse(hx + hr * 1.02, hy + hr * (0.22 + oy), hr * 0.06, hr * 0.08, 0, 0, TAU);
    ctx.fill();
  }
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.32 + 0.05 * g.q);
  const fx = hx + hr * 0.2;
  const fy = hy - hr * 0.22;
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.6, fy - er * 0.2, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.1, fy + er * 1.45, er * 0.55, 0.55);
  P.mouth(ctx, hx + hr * 0.6, hy + hr * 0.62, hr * 0.32, g.wobble > 0.4 ? 'wavy' : 'smile');

  // a ribbon with a little bow round the neck (rainbow for the very best)
  ctx.save();
  ctx.strokeStyle = g.rainbow ? rainbowFill(ctx, hx - hr, hy, hx + hr, hy + hr) : hsl(g.hue2 % 360, 0.75, 0.55);
  ctx.lineWidth = L * 0.03;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(hx - hr * 0.75, hy + hr * 0.55);
  ctx.quadraticCurveTo(hx - hr * 0.2, hy + hr * 1.05, hx + hr * 0.25, hy + hr * 0.9);
  ctx.stroke();
  ctx.fillStyle = g.rainbow ? '#ffd84a' : hsl(g.hue2 % 360, 0.75, 0.55);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx - hr * 0.25 + s * L * 0.035, hy + hr * 0.95, L * 0.035, L * 0.022, s * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.3, cy - ry * 0.5, L * 0.14, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.15, hy - hr * 0.95, L * 0.16, 0.15);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(g, 0.05),
    top: { x: hx, y: hy - hr * 1.5 },
  };
}

/** a heart-shaped leaf, tip at distance d0 from (cx, cy), pointing out along angle a */
function leafPath(cx: number, cy: number, a: number, s: number, d0: number): Path2D {
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const vx = -uy;
  const vy = ux;
  const ox = cx + ux * d0;
  const oy = cy + uy * d0;
  // local: x across, h outward
  const pt = (x: number, h: number): [number, number] => [ox + ux * h + vx * x, oy + uy * h + vy * x];
  const p = makePath();
  p.moveTo(...pt(0, 0));
  p.bezierCurveTo(...pt(-s * 0.95, s * 0.4), ...pt(-s * 0.8, s * 1.15), ...pt(0, s * 0.85));
  p.bezierCurveTo(...pt(s * 0.8, s * 1.15), ...pt(s * 0.95, s * 0.4), ...pt(0, 0));
  p.closePath();
  return p;
}

function clover(gIn: Genome, sticker: AnyCanvas | null): Sprite {
  const g = tinted(gIn, 112 + (gIn.hue % 26), 0.5, 0.05);
  const L = 230 * g.size;
  const R = L * 0.17;
  const s = L * 0.21;
  const W = Math.ceil(L * 1.05);
  const H = Math.ceil(L * 1.1);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = H / 2 - L * 0.02;
  const lw = Math.max(2.5, L * 0.017);
  if (g.sparkle) P.aura(ctx, cx, cy, R * 2.1, 90);

  // stem as a tail, and two little feet
  ctx.save();
  ctx.strokeStyle = P.outlineColor(g);
  ctx.lineWidth = L * 0.045;
  ctx.lineCap = 'round';
  const stem = () => {
    ctx.beginPath();
    ctx.moveTo(cx - R * 0.3, cy + R * 0.6);
    ctx.quadraticCurveTo(cx - R * 1.2, cy + R * 1.0, cx - R * 1.55, cy + R * 0.55);
    ctx.stroke();
  };
  stem();
  ctx.strokeStyle = P.bodyColor(g, -0.05);
  ctx.lineWidth = L * 0.045 - lw * 1.2;
  stem();
  ctx.restore();
  const footY = cy + R * 1.38;
  for (const [fx, f] of [
    [-0.35, 1],
    [0.4, g.wobble > 0.4 ? 0.8 : 1],
  ]) {
    const lg = makePath();
    const w = L * 0.06;
    lg.roundRect(cx + fx * R - w / 2, cy + R * 0.6, w, (footY - cy - R * 0.6) * f, w / 2);
    ctx.fillStyle = P.bodyColor(g, -0.1);
    ctx.fill(lg);
    P.strokeBody(ctx, lg, g, lw * 0.8);
    ctx.fillStyle = hsl(g.hue, g.sat, 0.3);
    ctx.beginPath();
    ctx.ellipse(cx + fx * R + w * 0.2, cy + R * 0.6 + (footY - cy - R * 0.6) * f, w * 0.7, w * 0.3, 0, 0, TAU);
    ctx.fill();
  }

  // four heart leaves on the diagonals (a crumpled one droops a bit)
  const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.2, Math.PI * 0.8];
  angles.forEach((a, i) => {
    const droop = g.wobble > 0.4 && i === 1 ? 0.3 : 0;
    const leaf = leafPath(cx, cy, a + droop, s * (i >= 2 ? 0.9 : 1), R * 0.55);
    const lx = cx + Math.cos(a) * (R * 0.55 + s * 0.6);
    const ly = cy + Math.sin(a) * (R * 0.55 + s * 0.6);
    if (g.rainbow) {
      ctx.fillStyle = rainbowFill(ctx, lx - s, ly - s, lx + s, ly + s);
      ctx.fill(leaf);
      ctx.fillStyle = P.bodyColor(g, 0, 0, 0.45);
      ctx.fill(leaf);
    } else P.shadeBody(ctx, leaf, g, lx, ly, s * 0.8, s * 0.8);
    P.crumpleFacets(ctx, leaf, g, lx, ly, s, s);
    // the pale mark every clover leaf has
    ctx.save();
    ctx.clip(leaf);
    ctx.strokeStyle = P.bodyColor(g, 0.2, 0, 0.7);
    ctx.lineWidth = L * 0.018;
    ctx.beginPath();
    ctx.moveTo(lx - Math.cos(a) * s * 0.2, ly - Math.sin(a) * s * 0.2);
    ctx.lineTo(lx + Math.cos(a) * s * 0.25, ly + Math.sin(a) * s * 0.25);
    ctx.stroke();
    ctx.restore();
    if (g.glossy) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(lx - s * 0.2, ly - s * 0.25, s * 0.18, s * 0.09, -0.5, 0, TAU);
      ctx.fill();
    }
    P.strokeBody(ctx, leaf, g, lw);
  });

  // the round middle with face and badge
  const body = P.blobPath({ cx, cy, rx: R, ry: R * 0.95, g });
  P.shadeBody(ctx, body, g, cx, cy, R, R, P.bodyColor(g, 0.08));
  P.pattern(ctx, body, g, cx, cy, R, R);
  P.crumpleFacets(ctx, body, g, cx, cy, R, R);
  if (g.glossy) P.gloss(ctx, cx, cy, R, R, 0.4);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - R * 0.22, y: cy + R * 0.26, r: R * 0.58 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const eyes: P.EyeInfo[] = [];
  face(ctx, g, cx + R * 0.48, cy - R * 0.32, R * (0.25 + 0.04 * g.q), R * 0.28, eyes);
  if (g.bandaid) P.bandaid(ctx, cx - R * 1.0, cy - R * 0.9, L * 0.13, -0.6);
  if (g.crown) P.crown(ctx, cx, cy - R * 0.85, L * 0.16, 0.1);
  if (g.sparkle) P.sparkleStar(ctx, cx + R * 1.9, cy - R * 1.4, L * 0.045);

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: R * 1.6,
    eyes,
    lid: P.bodyColor(g, 0.1),
    top: { x: cx, y: cy - R * 1.6 },
  };
}

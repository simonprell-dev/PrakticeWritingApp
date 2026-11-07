// Christmas folk (side view, facing right): elf, reindeer, hopping present, gingerbread man.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

/** 0 Wichtel, 1 Rentier, 2 Geschenk, 3 Lebkuchenmann (the kind is variant % KINDS) */
export const KINDS = 4;
export const KIND_NAMES = ['Wichtel', 'Rentier', 'Geschenk', 'Lebkuchenmann'];

export function weihnachtenSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = g.variant % KINDS;
  if (k === 0) return elf(g, sticker);
  if (k === 1) return reindeer(g, sticker);
  if (k === 2) return present(g, sticker);
  return gingerbread(g, sticker);
}

/** the same genome in other colours (outline, shading and pattern follow) */
const tint = (g: Genome, hue: number, sat = g.sat, light = g.light): Genome => ({ ...g, hue, sat, light });
/** one of a few fitting hues, chosen by the genome's free hue */
const choose = (g: Genome, hues: number[]) => hues[Math.floor((((g.hue % 360) + 360) % 360) / (360 / hues.length)) % hues.length];

/** a rounded stick from (x1, y1) to (x2, y2) */
function capsule(x1: number, y1: number, x2: number, y2: number, r: number): Path2D {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = makePath();
  p.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  p.arc(x1, y1, r, a + Math.PI / 2, a + Math.PI * 1.5);
  p.closePath();
  return p;
}

function face(ctx: Ctx, g: Genome, x: number, y: number, er: number, eyes: P.EyeInfo[]): void {
  eyes.push(P.eye(ctx, x, y, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, x - er * 1.6, y - er * 0.2, er * 0.65, 'googly', g.r));
}

// ------------------------------------------------------------------------------------------- Wichtel

function elf(g0: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 182 * g0.size;
  const g = tint(g0, choose(g0, [2, 128, 352, 145]));
  const red = g.hue < 60 || g.hue > 300;
  const skinG = tint(g0, 24, 0.3 + 0.45 * g0.sat, 0.8);
  const rx = L * 0.25;
  const ry = L * 0.23;
  const hr = L * 0.18;
  const legLen = L * 0.11;
  const W = Math.ceil(L * 0.92);
  const H = Math.ceil(L * 1.32);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const cx = W * 0.44;
  const cy = H - legLen - ry - L * 0.05;
  const hx = cx + rx * 0.25;
  const hy = cy - ry * 0.85 - hr * 0.72;
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.18, rx * 1.75, g.hue + 40);
  const mitten = hsl(red ? 130 : 2, g.sat, 0.48);

  // legs: striped stockings and curly boots
  const legs: [number, number][] = [
    [cx - rx * 0.38, 1],
    [cx + rx * 0.32, g.wobble > 0.4 ? 0.7 : 1],
  ];
  for (const [lx, f] of legs) {
    const lwid = L * 0.075;
    const lp = makePath();
    lp.roundRect(lx - lwid / 2, cy + ry * 0.5, lwid, ry * 0.5 + legLen * f, lwid / 2);
    ctx.fillStyle = '#fbf6ee';
    ctx.fill(lp);
    ctx.save();
    ctx.clip(lp);
    ctx.fillStyle = P.bodyColor(g, -0.05);
    for (let y = cy + ry * 0.5; y < cy + ry + legLen; y += lwid * 0.9) ctx.fillRect(lx - lwid, y, lwid * 2, lwid * 0.45);
    ctx.restore();
    P.strokeBody(ctx, lp, g, lw * 0.8);
    const fy = cy + ry + legLen * f - lwid * 0.2;
    const boot = makePath();
    boot.moveTo(lx - lwid * 0.75, fy + lwid * 0.35);
    boot.quadraticCurveTo(lx - lwid * 0.8, fy - lwid * 0.5, lx, fy - lwid * 0.5);
    boot.quadraticCurveTo(lx + lwid * 1.1, fy - lwid * 0.3, lx + lwid * 1.45, fy - lwid * 0.75);
    boot.quadraticCurveTo(lx + lwid * 1.5, fy + lwid * 0.4, lx + lwid * 0.7, fy + lwid * 0.45);
    boot.closePath();
    ctx.fillStyle = '#5b3a29';
    ctx.fill(boot);
    P.strokeBody(ctx, boot, g, lw * 0.7);
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.arc(lx + lwid * 1.45, fy - lwid * 0.75, lwid * 0.18, 0, TAU);
    ctx.fill();
  }

  // back mitten
  const backHand = makePath();
  backHand.arc(cx - rx * 0.92, cy + ry * 0.1, L * 0.055, 0, TAU);
  ctx.fillStyle = mitten;
  ctx.fill(backHand);
  P.strokeBody(ctx, backHand, g, lw * 0.8);

  // tunic
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 + 0.07 * Math.max(0, Math.sin(th)) });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(g.hue, g.sat, g.light + 0.15, 0.55));
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = '#3b2a20';
  ctx.fillRect(cx - rx * 1.3, cy + ry * 0.48, rx * 2.6, ry * 0.2);
  ctx.fillStyle = '#ffd23f';
  ctx.fillRect(cx + rx * 0.5, cy + ry * 0.44, ry * 0.26, ry * 0.28);
  ctx.fillStyle = '#3b2a20';
  ctx.fillRect(cx + rx * 0.5 + ry * 0.07, cy + ry * 0.51, ry * 0.12, ry * 0.14);
  // white fur hem
  ctx.fillStyle = '#fbf6ee';
  ctx.beginPath();
  for (let x = cx - rx * 1.2; x < cx + rx * 1.2; x += rx * 0.28) ctx.arc(x, cy + ry * 1.02, rx * 0.17, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.35);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.1, y: cy + ry * 0.08, r: ry * 0.58 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // front mitten
  const hand = makePath();
  hand.arc(cx + rx * 0.98, cy + ry * 0.12, L * 0.06, 0, TAU);
  ctx.fillStyle = mitten;
  ctx.fill(hand);
  P.strokeBody(ctx, hand, g, lw * 0.8);

  // collar
  const collar = makePath();
  collar.ellipse(hx - hr * 0.1, cy - ry * 0.8, hr * 0.95, hr * 0.32, 0, 0, TAU);
  ctx.fillStyle = mitten;
  ctx.fill(collar);
  P.strokeBody(ctx, collar, g, lw * 0.8);

  // pointy ear behind, then the head
  const ear = makePath();
  ear.moveTo(hx - hr * 0.6, hy - hr * 0.15);
  ear.quadraticCurveTo(hx - hr * 1.2, hy - hr * 0.35, hx - hr * 1.5, hy - hr * 0.65);
  ear.quadraticCurveTo(hx - hr * 1.15, hy + hr * 0.15, hx - hr * 0.65, hy + hr * 0.3);
  ear.closePath();
  ctx.fillStyle = P.bodyColor(skinG, -0.04);
  ctx.fill(ear);
  P.strokeBody(ctx, ear, skinG, lw * 0.8);
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr, ry: hr * 0.95, g: skinG });
  P.shadeBody(ctx, head, skinG, hx, hy, hr, hr);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, skinG, lw);

  // floppy pointed hat with fur brim and bobble
  const tipX = hx - hr * 1.7;
  const tipY = hy - hr * 1.75;
  const hat = makePath();
  hat.moveTo(hx - hr * 1.0, hy - hr * 0.45);
  hat.quadraticCurveTo(hx - hr * 0.7, hy - hr * 1.35, tipX, tipY);
  hat.quadraticCurveTo(hx + hr * 0.5, hy - hr * 2.55 - (g.wobble > 0.4 ? hr * 0.2 : 0), hx + hr * 1.0, hy - hr * 0.45);
  hat.closePath();
  P.shadeBody(ctx, hat, g, hx - hr * 0.3, hy - hr * 1.3, hr * 1.2, hr);
  if (g.pattern === 'dots' || g.pattern === 'spots') {
    ctx.save();
    ctx.clip(hat);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (const [ox, oy] of [
      [-0.5, -1.2],
      [0.2, -1.0],
      [-0.1, -1.6],
      [-1.0, -1.45],
    ]) {
      ctx.beginPath();
      ctx.arc(hx + ox * hr, hy + oy * hr, hr * 0.09, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  P.crumpleFacets(ctx, hat, g, hx - hr * 0.3, hy - hr * 1.3, hr * 1.2, hr);
  P.strokeBody(ctx, hat, g, lw);
  const brim = makePath();
  brim.roundRect(hx - hr * 1.12, hy - hr * 0.66, hr * 2.24, hr * 0.42, hr * 0.21);
  ctx.fillStyle = '#fbf6ee';
  ctx.fill(brim);
  P.strokeBody(ctx, brim, g, lw * 0.8);
  const bob = makePath();
  bob.arc(tipX, tipY, L * 0.055, 0, TAU);
  ctx.fillStyle = g.sparkle ? '#fff3a0' : '#fbf6ee';
  ctx.fill(bob);
  P.strokeBody(ctx, bob, g, lw * 0.8);

  // face
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.3 + 0.05 * g.q);
  face(ctx, g, hx + hr * 0.32, hy + hr * 0.02, er, eyes);
  P.blush(ctx, hx + hr * 0.5, hy + hr * 0.5, er * 0.55);
  ctx.fillStyle = hsl(6, 0.65, 0.68);
  ctx.beginPath();
  ctx.arc(hx + hr * 0.92, hy + hr * 0.22, hr * 0.19, 0, TAU);
  ctx.fill();
  P.mouth(ctx, hx + hr * 0.62, hy + hr * 0.62, hr * 0.38, g.wobble > 0.4 ? 'wavy' : 'smile');
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.45, cy - ry * 0.3, L * 0.14, 0.4);
  const top = { x: hx - hr * 0.55, y: hy - hr * 1.95 };
  if (g.crown) P.crown(ctx, top.x, top.y + hr * 0.15, L * 0.2, -0.25);

  return { canvas, badge: badgeAt, sticker, ax: cx, ay: cy, radius: rx * 1.1, eyes, lid: P.bodyColor(skinG, 0.04), top };
}

// ------------------------------------------------------------------------------------------- Rentier

function reindeer(g0: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g0.size;
  const g = tint(g0, 22 + (g0.hue % 14), 0.2 + 0.5 * g0.sat, g0.light - 0.16);
  const rx = L * 0.3;
  const ry = L * 0.19;
  const legLen = L * 0.17;
  const W = Math.ceil(rx * 2 + L * 0.68);
  const H = Math.ceil(ry * 2 + legLen + L * 0.78);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.1;
  const cy = H - legLen - ry - L * 0.04;
  const lw = Math.max(2.5, L * 0.017);
  const hr = L * 0.13;
  const hx = cx + rx * 1.0;
  const hy = cy - ry - L * 0.12;
  if (g.sparkle) P.aura(ctx, cx + rx * 0.2, cy - L * 0.12, rx * 1.45, 45);
  const ol = P.outlineColor(g);
  const cream = hsl(36, 0.35 + 0.3 * g.sat, 0.84);

  const legs: [number, number, number][] = [
    [cx - rx * 0.6, 0.94, -0.07],
    [cx + rx * 0.42, 0.94, -0.07],
    [cx - rx * 0.4, 1, 0],
    [cx + rx * 0.62, g.wobble > 0.4 ? 0.7 : 1, 0],
  ];
  for (const [lx, f, dl] of legs) {
    const lwid = L * 0.06;
    const lp = makePath();
    lp.roundRect(lx - lwid / 2, cy + ry * 0.4, lwid, ry * 0.6 + legLen * f, lwid / 2);
    ctx.fillStyle = P.bodyColor(g, dl);
    ctx.fill(lp);
    P.strokeBody(ctx, lp, g, lw * 0.8);
    ctx.fillStyle = '#3b2a22';
    ctx.beginPath();
    ctx.ellipse(lx, cy + ry + legLen * f - 2, lwid * 0.58, lwid * 0.3, 0, 0, TAU);
    ctx.fill();
  }

  // white tail tuft
  const tail = makePath();
  tail.ellipse(cx - rx * 1.0, cy - ry * 0.55, L * 0.045, L * 0.06, -0.6, 0, TAU);
  ctx.fillStyle = cream;
  ctx.fill(tail);
  P.strokeBody(ctx, tail, g, lw * 0.8);

  // neck, then body over it
  const neck = makePath();
  neck.moveTo(cx + rx * 0.4, cy - ry * 0.5);
  neck.quadraticCurveTo(hx - hr * 0.9, hy - hr * 0.2, hx - hr * 0.3, hy + hr * 0.1);
  neck.lineTo(hx + hr * 0.3, hy + hr * 0.7);
  neck.quadraticCurveTo(cx + rx * 1.0, cy - ry * 0.4, cx + rx * 0.85, cy);
  neck.closePath();
  ctx.fillStyle = P.bodyColor(g, 0.02);
  ctx.fill(neck);
  P.strokeBody(ctx, neck, g, lw);

  const body = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, body, g, cx, cy, rx, ry);
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(cx + rx * 0.1, cy + ry * 0.95, rx * 0.8, ry * 0.42, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(36, 0.4, 0.82, 0.55));
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.35);
  P.strokeBody(ctx, body, g, lw);
  const badgeAt = { x: cx - rx * 0.15, y: cy + ry * 0.02, r: ry * 0.7 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // collar with a golden bell
  ctx.save();
  ctx.lineCap = 'round';
  const collarCol = hsl(g.glossy ? 355 : 130, 0.35 + 0.45 * g.sat, 0.45);
  for (const [w, col] of [
    [L * 0.055 + lw, ol],
    [L * 0.055 - lw * 0.4, collarCol],
  ] as [number, string][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx + rx * 0.62, cy - ry * 0.9);
    ctx.quadraticCurveTo(cx + rx * 0.9, cy - ry * 0.35, cx + rx * 1.08, cy - ry * 0.55);
    ctx.stroke();
  }
  ctx.restore();
  const bell = makePath();
  bell.arc(cx + rx * 0.92, cy - ry * 0.3, L * 0.04, 0, TAU);
  ctx.fillStyle = '#ffcf3a';
  ctx.fill(bell);
  P.strokeBody(ctx, bell, tint(g0, 40, 0.8, 0.55), lw * 0.7);

  // antlers (behind the head)
  const antColor = hsl(34, 0.3 + 0.25 * g.sat, 0.68);
  const antler = (ox: number, s: number) => {
    const bx = hx + ox * hr;
    const by = hy - hr * 0.7;
    const lines: [number, number, number, number, number, number][] = [
      [bx, by, bx - hr * 0.35 * s, by - hr * 0.9 * s, bx - hr * 0.95 * s, by - hr * 1.5 * s],
      [bx - hr * 0.3 * s, by - hr * 0.75 * s, bx - hr * 0.1 * s, by - hr * 1.2 * s, bx + hr * 0.15 * s, by - hr * 1.45 * s],
      [bx - hr * 0.62 * s, by - hr * 1.18 * s, bx - hr * 0.5 * s, by - hr * 1.6 * s, bx - hr * 0.4 * s, by - hr * 1.85 * s],
      [bx - hr * 0.22 * s, by - hr * 0.5 * s, bx - hr * 0.6 * s, by - hr * 0.6 * s, bx - hr * 0.85 * s, by - hr * 0.85 * s],
    ];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [w, col] of [
      [hr * 0.2 + lw * 1.6, ol],
      [hr * 0.2, antColor],
    ] as [number, string][]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w * s;
      for (const [x1, y1, qx, qy, x2, y2] of lines) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(qx, qy, x2, y2);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  antler(0.25, 0.85);
  antler(-0.2, g.wobble > 0.4 ? 0.8 : 1);

  // ear, head, muzzle
  const ear = makePath();
  ear.ellipse(hx - hr * 0.85, hy - hr * 0.4, hr * 0.48, hr * 0.2, -0.45, 0, TAU);
  ctx.fillStyle = P.bodyColor(g, -0.04);
  ctx.fill(ear);
  P.strokeBody(ctx, ear, g, lw * 0.8);
  const head = makePath();
  head.ellipse(hx + hr * 0.1, hy, hr * 1.08, hr * 0.92, 0.15, 0, TAU);
  ctx.fillStyle = P.bodyColor(g, 0.04);
  ctx.fill(head);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);
  ctx.fillStyle = cream;
  ctx.beginPath();
  ctx.ellipse(hx + hr * 0.78, hy + hr * 0.38, hr * 0.42, hr * 0.32, 0.15, 0, TAU);
  ctx.fill();

  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.36 + 0.06 * g.q);
  face(ctx, g, hx + hr * 0.2, hy - hr * 0.15, er, eyes);
  P.blush(ctx, hx + hr * 0.3, hy + hr * 0.55, er * 0.5);
  // the nose: a shining red one for most of them
  const redNose = g.glossy || (g.seed & 1) === 1;
  const nx = hx + hr * 1.12;
  const ny = hy + hr * 0.22;
  const nr = hr * (redNose ? 0.24 : 0.17);
  if (redNose && g.sparkle) {
    const glow = ctx.createRadialGradient(nx, ny, nr * 0.5, nx, ny, nr * 2.6);
    glow.addColorStop(0, 'rgba(255,90,80,0.55)');
    glow.addColorStop(1, 'rgba(255,90,80,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(nx, ny, nr * 2.6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = redNose ? hsl(358, 0.5 + 0.45 * g.sat, 0.52) : '#3b2238';
  ctx.beginPath();
  ctx.arc(nx, ny, nr, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(nx - nr * 0.35, ny - nr * 0.35, nr * 0.3, 0, TAU);
  ctx.fill();
  P.mouth(ctx, hx + hr * 0.8, hy + hr * 0.58, hr * 0.32, g.wobble > 0.4 ? 'wavy' : 'cat');
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.35, cy - ry * 0.5, L * 0.15, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.05, hy - hr * 0.8, L * 0.15, 0.15);

  return { canvas, badge: badgeAt, sticker, ax: cx, ay: cy, radius: rx, eyes, lid: P.bodyColor(g, 0.06), top: { x: hx, y: hy - hr * 1.5 } };
}

// ------------------------------------------------------------------------------------------- Geschenk

/** the box; wobbly ones lean, crumpled ones get dented edges */
function boxPath(g: Genome, x: number, y: number, w: number, h: number, rad: number): Path2D {
  const p = makePath();
  if (g.wobble < 0.3) {
    p.roundRect(x, y, w, h, rad);
    return p;
  }
  const j = (i: number) => (((Math.sin(i * 12.9898 + g.seed * 0.37) * 43758.5453) % 1) + 1) % 1 - 0.5;
  const a = g.wobble * w * 0.07;
  const n = g.crumple > 0.5 ? 5 : 2;
  const corners: [number, number][] = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ];
  let k = 0;
  corners.forEach(([x1, y1], c) => {
    const [x2, y2] = corners[(c + 1) % 4];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const px = x1 + (x2 - x1) * t + j(k++) * a * (i === 0 ? 1 : 0.6);
      const py = y1 + (y2 - y1) * t + j(k++) * a * (i === 0 ? 1 : 0.6);
      if (c === 0 && i === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    }
  });
  p.closePath();
  return p;
}

function present(g0: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 225 * g0.size;
  const boxHue = choose(g0, [2, 210, 130, 285, 48, 330, 175]);
  const g = tint(g0, boxHue);
  const yellow = boxHue === 48;
  const ribbonG = tint(g0, yellow ? 355 : 46, Math.min(1, g0.sat + 0.15), yellow ? 0.52 : 0.6);
  const bw = L * 0.56;
  const bh = L * 0.48;
  const W = Math.ceil(L * 0.8);
  const H = Math.ceil(L * 0.98);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const bx = (W - bw) / 2;
  const by = H - L * 0.07 - bh;
  const cx = bx + bw / 2;
  const cy = by + bh / 2;
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.06, bw * 0.75, g.hue + 30);

  // little feet
  for (const [fx, f] of [
    [bx + bw * 0.28, 1],
    [bx + bw * 0.72, g.wobble > 0.4 ? 0.6 : 1],
  ]) {
    const foot = makePath();
    foot.ellipse(fx + L * 0.015, by + bh + L * 0.025 * f, L * 0.06, L * 0.035, 0, 0, TAU);
    ctx.fillStyle = P.bodyColor(g, -0.2);
    ctx.fill(foot);
    P.strokeBody(ctx, foot, g, lw * 0.8);
  }

  const box = boxPath(g, bx, by, bw, bh, L * 0.035);
  P.shadeBody(ctx, box, g, cx, cy, bw / 2, bh / 2);
  P.pattern(ctx, box, g, cx, cy, bw / 2, bh / 2, hsl(g.hue2, Math.min(1, g.sat + 0.05), Math.min(0.88, g.light + 0.22), 0.8));
  // ribbon cross
  const rbx = bx + bw * 0.4;
  const rby = by + bh * 0.6;
  const rw = bw * 0.14;
  ctx.save();
  ctx.clip(box);
  ctx.fillStyle = P.bodyColor(ribbonG);
  ctx.fillRect(rbx - rw / 2, by - 4, rw, bh + 8);
  ctx.fillRect(bx - 4, rby - rw / 2, bw + 8, rw);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(rbx - rw / 2, by - 4, rw * 0.3, bh + 8);
  ctx.restore();
  P.crumpleFacets(ctx, box, g, cx, cy, bw / 2, bh / 2);
  if (g.glossy) P.gloss(ctx, cx, cy + bh * 0.08, bw / 2, bh / 2, 0.35);
  P.strokeBody(ctx, box, g, lw);

  // lid
  const lidY = by - bh * 0.07;
  const lidH = bh * 0.25;
  const lid = boxPath(g, bx - bw * 0.05, lidY, bw * 1.1, lidH, L * 0.025);
  ctx.fillStyle = P.bodyColor(g, 0.07);
  ctx.fill(lid);
  ctx.save();
  ctx.clip(lid);
  ctx.fillStyle = P.bodyColor(ribbonG);
  ctx.fillRect(rbx - rw / 2, lidY - 4, rw, lidH + 8);
  ctx.restore();
  P.strokeBody(ctx, lid, g, lw);

  // bow
  const kx = rbx;
  const ky = lidY;
  for (const s of [-1, 1]) {
    const loop = makePath();
    loop.ellipse(kx + s * L * 0.075, ky - L * 0.04, L * 0.08, L * 0.045, s * -0.55, 0, TAU);
    ctx.fillStyle = P.bodyColor(ribbonG, 0.04);
    ctx.fill(loop);
    P.strokeBody(ctx, loop, ribbonG, lw * 0.8);
    const end = makePath();
    end.moveTo(kx, ky);
    end.lineTo(kx + s * L * 0.06, ky + L * 0.06);
    end.lineTo(kx + s * L * 0.025, ky + L * 0.065);
    end.closePath();
    ctx.fillStyle = P.bodyColor(ribbonG, -0.05);
    ctx.fill(end);
    P.strokeBody(ctx, end, ribbonG, lw * 0.7);
  }
  const knot = makePath();
  knot.arc(kx, ky - L * 0.01, L * 0.03, 0, TAU);
  ctx.fillStyle = P.bodyColor(ribbonG, 0.1);
  ctx.fill(knot);
  P.strokeBody(ctx, knot, ribbonG, lw * 0.8);

  const badgeAt = { x: rbx, y: rby, r: bh * 0.26 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // face on the right of the box
  const eyes: P.EyeInfo[] = [];
  const er = bh * (0.12 + 0.02 * g.q);
  face(ctx, g, bx + bw * 0.78, by + bh * 0.36, er, eyes);
  P.blush(ctx, bx + bw * 0.86, by + bh * 0.82, er * 0.6);
  P.mouth(ctx, bx + bw * 0.76, by + bh * 0.84, bh * 0.16, g.wobble > 0.4 ? 'wavy' : 'smile');
  if (g.bandaid) P.bandaid(ctx, bx + bw * 0.2, by + bh * 0.28, L * 0.14, -0.5);
  const top = { x: bx + bw * 0.8, y: lidY - L * 0.02 };
  if (g.crown) P.crown(ctx, top.x, top.y + L * 0.02, L * 0.18, 0.2);

  return { canvas, badge: badgeAt, sticker, ax: cx, ay: cy, radius: bw * 0.55, eyes, lid: P.bodyColor(g, 0.04), top };
}

// ------------------------------------------------------------------------------------------- Lebkuchenmann

function gingerbread(g0: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g0.size;
  const g = tint(g0, 27, 0.25 + 0.55 * g0.sat, g0.light - 0.1);
  const W = Math.ceil(L * 0.9);
  const H = Math.ceil(L * 1.13);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  const rx = L * 0.19;
  const ry = L * 0.2;
  const cx = W * 0.47;
  const cy = H - L * 0.42;
  const hr = L * 0.145;
  const hx = cx + L * 0.025;
  const hy = cy - ry - hr * 0.55;
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.1, rx * 2.3, 45);
  const sw = g.wobble > 0.4 ? 0.15 : 0;

  const ar = L * 0.065;
  const lr = L * 0.075;
  const parts: Path2D[] = [
    capsule(cx - rx * 0.5, cy - ry * 0.45, cx - rx * 1.45, cy - ry * (0.05 - sw), ar),
    capsule(cx + rx * 0.5, cy - ry * 0.45, cx + rx * 1.42, cy - ry * 0.8, ar),
    capsule(cx - rx * 0.4, cy + ry * 0.4, cx - rx * 0.62, cy + ry * 0.5 + L * 0.19, lr),
    capsule(cx + rx * 0.4, cy + ry * 0.4, cx + rx * 0.62, cy + ry * 0.5 + L * (g.wobble > 0.4 ? 0.14 : 0.19), lr),
  ];
  const torso = P.blobPath({ cx, cy, rx, ry, g });
  const head = P.blobPath({ cx: hx, cy: hy, rx: hr, ry: hr * 0.96, g });
  parts.push(torso, head);
  // outline everything first, then fill on top: one cookie without inner lines
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = P.outlineColor(g);
  ctx.lineWidth = lw * 2;
  for (const p of parts) ctx.stroke(p);
  ctx.restore();
  for (const p of parts) P.shadeBody(ctx, p, g, cx, cy - L * 0.05, rx * 1.4, ry * 1.8);
  P.pattern(ctx, torso, g, cx, cy, rx, ry, 'rgba(255,255,255,0.75)');
  P.crumpleFacets(ctx, torso, g, cx, cy, rx, ry);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  if (g.glossy) P.gloss(ctx, hx, hy, hr, hr, 0.3);

  // icing squiggles on hands and feet
  const icing = (x: number, y: number, a: number, w: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.strokeStyle = '#fffaf2';
    ctx.lineWidth = Math.max(2, L * 0.014);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    for (let i = 1; i <= 4; i++) ctx.lineTo(-w / 2 + (i * w) / 4, i % 2 ? -w * 0.18 : w * 0.18);
    ctx.stroke();
    ctx.restore();
  };
  icing(cx - rx * 1.2, cy - ry * 0.12, Math.PI / 2 - 0.4, ar * 1.6);
  icing(cx + rx * 1.18, cy - ry * 0.72, Math.PI / 2 + 0.6, ar * 1.6);
  icing(cx - rx * 0.58, cy + ry * 0.5 + L * 0.14, -0.2, lr * 1.6);
  icing(cx + rx * 0.58, cy + ry * 0.5 + L * (g.wobble > 0.4 ? 0.1 : 0.14), 0.2, lr * 1.6);

  const badgeAt = { x: cx, y: cy + ry * 0.1, r: ry * 0.56 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);

  // candy bow tie
  const tie = hsl(choose(g0, [355, 130, 205]), 0.35 + 0.5 * g.sat, 0.5);
  const tx = hx - L * 0.01;
  const ty = cy - ry * 0.85;
  ctx.save();
  ctx.fillStyle = tie;
  ctx.strokeStyle = P.outlineColor(g);
  ctx.lineWidth = lw * 0.7;
  ctx.lineJoin = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(tx + s * L * 0.07, ty - L * 0.04);
    ctx.lineTo(tx + s * L * 0.07, ty + L * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(tx, ty, L * 0.022, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // face: two eyes looking right, icing smile
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.27 + 0.05 * g.q);
  eyes.push(P.eye(ctx, hx - hr * 0.12, hy - hr * 0.12, er, g.eyeStyle, g.r, [0.5, 0]));
  eyes.push(P.eye(ctx, hx + hr * 0.5, hy - hr * 0.12, er * (g.eyeStyle === 'googly' ? 0.7 : 1), g.eyeStyle, g.r, [0.5, 0]));
  P.blush(ctx, hx + hr * 0.72, hy + hr * 0.38, er * 0.5);
  P.blush(ctx, hx - hr * 0.4, hy + hr * 0.38, er * 0.5);
  P.mouth(ctx, hx + hr * 0.2, hy + hr * 0.5, hr * 0.6, g.wobble > 0.4 ? 'wavy' : 'smile', '#fffaf2');
  if (g.bandaid) P.bandaid(ctx, hx - hr * 0.3, hy - hr * 0.6, L * 0.13, -0.4);
  const top = { x: hx, y: hy - hr * 0.95 };
  if (g.crown) P.crown(ctx, top.x, top.y + hr * 0.1, L * 0.16, 0.1);

  return { canvas, badge: badgeAt, sticker, ax: cx, ay: cy, radius: rx * 1.3, eyes, lid: P.bodyColor(g, 0.05), top };
}

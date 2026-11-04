// Zauberland princesses: round Krakel figures with a big head, a bell dress and the child's letter on it.
// Skin, hair and hair style vary per letter; the handwriting tier picks the dress (plain to glittering with
// a train), a diadem from "schön", the big crown at "prachtvoll".
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import { mulberry32, pick } from '../rng.ts';
import type { Genome } from './genome.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

const SKIN = ['#f9d7c0', '#f1c19c', '#e0a77f', '#c68660', '#9c6444', '#71462e'];
const HAIR = ['#3b2418', '#6b3e1f', '#c7782e', '#f2cf63', '#1f1a24', '#a0522d', '#e86fa8', '#7b5ce0'];

export interface PrincessLook {
  skin: string;
  hair: string;
  style: 'long' | 'bun' | 'braids' | 'curls';
}

/** the same look for the whole figure, the window bust and the riding pose */
export function princessLook(g: Genome): PrincessLook {
  const r = mulberry32(g.seed ^ 0x5eed);
  return { skin: pick(r, SKIN), hair: pick(r, HAIR), style: pick(r, ['long', 'bun', 'braids', 'curls'] as const) };
}

const T = { zerknittert: 0, schief: 1, nett: 2, schoen: 3, prachtvoll: 4 } as const;

function outline(g: Genome) {
  return P.outlineColor(g);
}

/** head with hair, face and headwear; (x, y) is the head centre, r its radius */
function drawHead(ctx: Ctx, g: Genome, look: PrincessLook, x: number, y: number, r: number, lw: number, eyes: P.EyeInfo[]) {
  const t = T[g.tier];
  ctx.save();
  ctx.lineJoin = 'round';
  // hair behind the head
  ctx.fillStyle = look.hair;
  ctx.strokeStyle = 'rgba(40,25,30,0.8)';
  ctx.lineWidth = lw * 0.8;
  const back = makePath();
  if (look.style === 'long') back.roundRect(x - r * 1.08, y - r * 0.6, r * 2.16, r * 2.2, r * 0.6);
  else if (look.style === 'curls') for (let i = 0; i < 9; i++) back.arc(x + Math.cos((i / 9) * TAU) * r * 0.95, y + Math.sin((i / 9) * TAU) * r * 0.85 + r * 0.15, r * 0.38, 0, TAU);
  else back.ellipse(x, y, r * 1.08, r * 1.05, 0, 0, TAU);
  ctx.fill(back);
  ctx.stroke(back);
  if (look.style === 'braids')
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + sx * r * 0.95, y + r * (0.45 + i * 0.38), r * 0.2, r * 0.24, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
    }
  if (look.style === 'bun') {
    ctx.beginPath();
    ctx.arc(x, y - r * 1.05, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // face
  const face = makePath();
  face.ellipse(x, y + r * 0.05, r * 0.88, r * 0.9, 0, 0, TAU);
  ctx.fillStyle = look.skin;
  ctx.fill(face);
  ctx.strokeStyle = 'rgba(80,45,40,0.85)';
  ctx.lineWidth = lw;
  ctx.stroke(face);
  // fringe
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.92, y - r * 0.05);
  ctx.quadraticCurveTo(x - r * 0.8, y - r * 1.05, x, y - r * 0.98);
  ctx.quadraticCurveTo(x + r * 0.85, y - r * 1.05, x + r * 0.92, y - r * 0.05);
  ctx.quadraticCurveTo(x + r * 0.5, y - r * 0.55, x + r * 0.05, y - r * 0.5);
  ctx.quadraticCurveTo(x - r * 0.45, y - r * 0.6, x - r * 0.92, y - r * 0.05);
  ctx.fill();
  ctx.restore();
  const er = r * 0.27;
  eyes.push(P.eye(ctx, x - r * 0.36, y + r * 0.1, er, g.eyeStyle, g.r, [0.1, 0.2]));
  eyes.push(P.eye(ctx, x + r * 0.36, y + r * 0.1, er, g.eyeStyle, g.r, [0.1, 0.2]));
  P.blush(ctx, x - r * 0.55, y + r * 0.5, r * 0.18);
  P.blush(ctx, x + r * 0.55, y + r * 0.5, r * 0.18);
  P.mouth(ctx, x, y + r * 0.58, r * 0.32, g.wobble > 0.4 ? 'wavy' : 'smile');
  if (t === 4) P.crown(ctx, x, y - r * 0.82, r * 1.0, 0);
  else if (t === 3) diadem(ctx, x, y - r * 0.78, r);
  else if (t === 2) flower(ctx, x + r * 0.62, y - r * 0.62, r * 0.22, hsl(g.hue2, 0.75, 0.7));
  if (g.bandaid) P.bandaid(ctx, x + r * 0.45, y - r * 0.35, r * 0.5, -0.5);
}

function diadem(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.fillStyle = '#ffe07a';
  ctx.strokeStyle = '#b07a1e';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y + r * 0.08);
  ctx.quadraticCurveTo(x - r * 0.3, y - r * 0.12, x, y - r * 0.32);
  ctx.quadraticCurveTo(x + r * 0.3, y - r * 0.12, x + r * 0.55, y + r * 0.08);
  ctx.quadraticCurveTo(x, y - r * 0.06, x - r * 0.55, y + r * 0.08);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#4fb3ff';
  ctx.beginPath();
  ctx.arc(x, y - r * 0.14, r * 0.08, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function flower(ctx: Ctx, x: number, y: number, r: number, col: string) {
  ctx.save();
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + Math.cos((i / 5) * TAU) * r * 0.6, y + Math.sin((i / 5) * TAU) * r * 0.6, r * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe14a';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** the bell dress from the waist (x, top) down to the hem at top + h */
function drawDress(ctx: Ctx, g: Genome, x: number, top: number, w: number, h: number, lw: number, sit: boolean): Path2D {
  const t = T[g.tier];
  const dress = makePath();
  const hem = top + h;
  const half = w / 2;
  dress.moveTo(x - half * 0.32, top);
  dress.lineTo(x + half * 0.32, top);
  if (sit) {
    dress.quadraticCurveTo(x + half * 1.15, top + h * 0.5, x + half * 0.85, hem);
    dress.lineTo(x - half * 0.85, hem);
    dress.quadraticCurveTo(x - half * 1.15, top + h * 0.5, x - half * 0.32, top);
  } else {
    dress.quadraticCurveTo(x + half * 0.55, top + h * 0.55, x + half, hem);
    // scalloped hem from tier "nett"
    const n = t >= 2 ? 5 : 1;
    for (let i = 0; i < n; i++) {
      const x1 = x + half - ((i + 1) * w) / n;
      dress.quadraticCurveTo((x + half - (i * w) / n + x1) / 2, hem + (t >= 2 ? h * 0.07 : 0), x1, hem);
    }
    dress.quadraticCurveTo(x - half * 0.55, top + h * 0.55, x - half * 0.32, top);
  }
  dress.closePath();
  const grad = ctx.createLinearGradient(x - half, top, x + half, hem);
  grad.addColorStop(0, P.bodyColor(g, 0.12));
  grad.addColorStop(1, P.bodyColor(g, -0.1));
  ctx.fillStyle = grad;
  ctx.fill(dress);
  ctx.save();
  ctx.clip(dress);
  if (t >= 1) {
    // a band with dots, from "schön" glittering stars
    ctx.fillStyle = hsl(g.hue2, 0.7, 0.8, 0.9);
    ctx.fillRect(x - w, hem - h * 0.16, w * 2, h * 0.08);
  }
  if (t >= 3) for (let i = 0; i < 7; i++) P.sparkleStar(ctx, x - half * 0.7 + ((i * 37) % 10) * half * 0.15, top + h * (0.35 + ((i * 53) % 10) * 0.05), w * 0.04, '#fffbe0');
  P.crumpleFacets(ctx, dress, g, x, top + h / 2, half, h / 2);
  ctx.restore();
  if (g.glossy) P.gloss(ctx, x, top + h * 0.55, half * 0.7, h * 0.45, 0.35);
  P.strokeBody(ctx, dress, g, lw);
  return dress;
}

function arm(ctx: Ctx, look: PrincessLook, x0: number, y0: number, x1: number, y1: number, lw: number, sleeve: string) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(80,45,40,0.85)';
  ctx.lineWidth = lw * 4.2;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = lw * 2.6;
  ctx.stroke();
  ctx.fillStyle = sleeve;
  ctx.beginPath();
  ctx.arc(x0, y0, lw * 2.4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** a whole princess, standing on the meadow ('stand') or sitting on a unicorn ('sit'); (ax, ay) is the waist */
export function princessSprite(g: Genome, sticker: AnyCanvas | null, pose: 'stand' | 'sit' = 'stand'): Sprite {
  const t = T[g.tier];
  const L = 170 * g.size;
  const look = princessLook(g);
  const sit = pose === 'sit';
  const hr = L * 0.2;
  const dressH = L * (sit ? 0.42 : 0.62);
  const dressW = L * (sit ? 0.62 : 0.66) * (t === 4 && !sit ? 1.15 : 1);
  const W = Math.ceil(t === 4 && !sit ? dressW * 2.1 : Math.max(dressW * 1.3, hr * 3) * (g.sparkle ? 1.25 : 1));
  const H = Math.ceil(hr * 3.3 + L * 0.06 + dressH + L * 0.12);
  const { canvas, ctx } = makeCanvas(W, H);
  const x = W / 2;
  const lw = Math.max(2.2, L * 0.016);
  const waist = hr * 3.3 + L * 0.06;
  const eyes: P.EyeInfo[] = [];
  if (g.sparkle) P.aura(ctx, x, waist, Math.min(dressW * 0.8, W / 2 / 1.26, waist / 1.26), g.hue + 20);
  // train behind the dress at "prachtvoll"
  if (t === 4 && !sit) {
    ctx.fillStyle = P.bodyColor(g, -0.05);
    ctx.beginPath();
    ctx.moveTo(x - dressW * 0.2, waist + dressH * 0.4);
    ctx.quadraticCurveTo(x - dressW * 0.9, waist + dressH * 0.9, x - dressW * 0.95, waist + dressH + L * 0.05);
    ctx.lineTo(x, waist + dressH);
    ctx.closePath();
    ctx.fill();
  }
  if (!sit) {
    // little shoes
    ctx.fillStyle = hsl(g.hue2, 0.6, 0.5);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + sx * dressW * 0.16, waist + dressH + L * 0.02, L * 0.05, L * 0.03, 0, 0, TAU);
      ctx.fill();
    }
  }
  drawDress(ctx, g, x, waist, dressW, dressH, lw, sit);
  // bodice
  const bod = makePath();
  bod.roundRect(x - hr * 0.62, waist - hr * 0.95, hr * 1.24, hr * 1.05, hr * 0.35);
  ctx.fillStyle = P.bodyColor(g, 0.05);
  ctx.fill(bod);
  P.strokeBody(ctx, bod, g, lw);
  const sleeve = hsl(g.hue2, 0.65, 0.78);
  if (sit) {
    arm(ctx, look, x - hr * 0.6, waist - hr * 0.7, x - hr * 0.2, waist + hr * 0.15, lw, sleeve);
    arm(ctx, look, x + hr * 0.6, waist - hr * 0.7, x + hr * 0.95, waist + hr * 0.05, lw, sleeve);
  } else {
    arm(ctx, look, x - hr * 0.6, waist - hr * 0.7, x - hr * 1.15, waist + hr * 0.25, lw, sleeve);
    arm(ctx, look, x + hr * 0.6, waist - hr * 0.7, x + hr * 1.15, waist + hr * 0.25, lw, sleeve);
  }
  const hy = waist - hr * 1.9;
  drawHead(ctx, g, look, x, hy, hr, lw, eyes);
  const badgeAt = { x, y: waist + dressH * (sit ? 0.42 : 0.45), r: Math.min(dressW * 0.2, dressH * 0.26) };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null, outline(g));
  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: x,
    ay: sit ? waist + dressH * 0.6 : waist + dressH,
    radius: L * 0.45,
    eyes,
    lid: look.skin,
    top: { x, y: Math.max(2, hy - hr * 1.5) },
  };
}

/** head and shoulders for looking out of a window (about 0.9 × r wide per unit) */
export function princessBust(g: Genome, r = 34): AnyCanvas {
  const look = princessLook(g);
  const W = Math.ceil(r * 3);
  const H = Math.ceil(r * 3.6);
  const { canvas, ctx } = makeCanvas(W, H);
  const x = W / 2;
  const lw = Math.max(2, r * 0.08);
  const sh = makePath();
  sh.roundRect(x - r * 1.05, r * 2.35, r * 2.1, r * 1.3, r * 0.5);
  ctx.fillStyle = P.bodyColor(g, 0.05);
  ctx.fill(sh);
  P.strokeBody(ctx, sh, g, lw);
  drawHead(ctx, g, look, x, r * 1.5, r, lw, []);
  return canvas;
}

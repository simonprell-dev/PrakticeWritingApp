// Zauberland fable creatures (side view, facing right): 0 unicorn, 1 pegasus, 2 lucky dragon.
// Chubby Krakel style like the savanna animals: round body, big eye, thick outline.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Genome } from './genome.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

export const FABLE_KINDS = ['Einhorn', 'Pegasus', 'Glücksdrache'];

const RAINBOW = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];

export function fableSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const L = 200 * g.size;
  const kind = g.variant;
  const dragon = kind === 2;
  const rx = L * (dragon ? 0.3 : 0.29);
  const ry = L * (dragon ? 0.22 : 0.18);
  const legLen = L * (dragon ? 0.08 : 0.17);
  const W = Math.ceil(rx * 2 + L * 0.85);
  const H = Math.ceil(ry * 2 + legLen + L * 0.8);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2 - L * 0.1;
  const cy = H - legLen - ry - L * 0.04;
  const lw = Math.max(2.5, L * 0.017);
  const body = (dl = 0) => P.bodyColor(g, dl);
  const maneCol = (i: number) => (g.rainbow || g.tier === 'prachtvoll' ? RAINBOW[i % RAINBOW.length] : hsl(g.hue2, Math.min(1, g.sat + 0.1), 0.62 + (i % 2) * 0.06));
  if (g.sparkle) P.aura(ctx, cx, cy - L * 0.1, rx * 1.4, g.hue + 20);

  // legs with hooves (dragons: short stubby feet)
  const legs: [number, number, number][] = [
    [cx - rx * 0.55, 0.92, -0.07],
    [cx + rx * 0.45, 0.92, -0.07],
    [cx - rx * 0.4, 1, 0],
    [cx + rx * 0.6, g.wobble > 0.4 ? 0.72 : 1, 0],
  ];
  legs.forEach(([lx, f, dl]) => {
    const lwid = L * (dragon ? 0.09 : 0.062);
    const lp = makePath();
    lp.roundRect(lx - lwid / 2, cy + ry * 0.4, lwid, ry * 0.6 + legLen * f, lwid / 2);
    ctx.fillStyle = body(dl);
    ctx.fill(lp);
    P.strokeBody(ctx, lp, g, lw * 0.8);
    ctx.fillStyle = dragon ? body(-0.2) : g.q > 0.7 ? '#f2c94c' : hsl(g.hue, 0.3, 0.45);
    ctx.beginPath();
    ctx.ellipse(lx, cy + ry + legLen * f - 2, lwid * 0.58, lwid * 0.3, 0, 0, TAU);
    ctx.fill();
  });

  // tail
  if (dragon) {
    const t = makePath();
    t.moveTo(cx - rx * 0.8, cy - ry * 0.1);
    t.quadraticCurveTo(cx - rx * 1.5, cy + ry * 0.2, cx - rx * 1.45, cy - ry * 0.55);
    t.quadraticCurveTo(cx - rx * 1.3, cy + ry * 0.05, cx - rx * 0.8, cy + ry * 0.45);
    t.closePath();
    ctx.fillStyle = body(-0.04);
    ctx.fill(t);
    P.strokeBody(ctx, t, g, lw * 0.8);
    spike(ctx, cx - rx * 1.45, cy - ry * 0.6, L * 0.05, maneCol(1), g, lw);
  } else {
    for (let i = 0; i < 4; i++) {
      const tp = makePath();
      const off = i * L * 0.025;
      tp.moveTo(cx - rx * 0.92, cy - ry * 0.35);
      tp.bezierCurveTo(cx - rx * 1.45, cy - ry * 0.4 + off, cx - rx * 1.25, cy + ry * 0.6 + off, cx - rx * 1.5 + off, cy + ry * 1.05);
      tp.bezierCurveTo(cx - rx * 1.05, cy + ry * 0.5, cx - rx * 1.1, cy - ry * 0.05, cx - rx * 0.85, cy - ry * 0.05);
      tp.closePath();
      ctx.fillStyle = maneCol(i * 2);
      ctx.fill(tp);
      if (i === 0) P.strokeBody(ctx, tp, g, lw * 0.7);
    }
  }

  // body
  const bodyPath = P.blobPath({ cx, cy, rx, ry, g });
  P.shadeBody(ctx, bodyPath, g, cx, cy, rx, ry);
  if (dragon) {
    // light belly
    ctx.save();
    ctx.clip(bodyPath);
    ctx.fillStyle = hsl(g.hue + 30, 0.6, 0.88);
    ctx.beginPath();
    ctx.ellipse(cx + rx * 0.1, cy + ry * 0.75, rx * 0.75, ry * 0.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else P.pattern(ctx, bodyPath, g, cx, cy, rx, ry, 'rgba(255,255,255,0.35)');
  P.crumpleFacets(ctx, bodyPath, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.4);
  P.strokeBody(ctx, bodyPath, g, lw);
  const badgeAt = { x: cx - rx * 0.15, y: cy + ry * 0.05, r: ry * 0.62 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  if (dragon) for (let i = 0; i < 4; i++) spike(ctx, cx - rx * 0.6 + i * rx * 0.38, cy - ry * 0.95 + Math.abs(i - 1.5) * ry * 0.08, L * 0.045, maneCol(i), g, lw);

  // neck and head
  const hr = L * (dragon ? 0.15 : 0.12);
  const hx = cx + rx * (dragon ? 0.95 : 1.02);
  const hy = cy - ry * (dragon ? 0.85 : 1.35);
  if (!dragon) {
    const neck = makePath();
    neck.moveTo(cx + rx * 0.35, cy - ry * 0.55);
    neck.quadraticCurveTo(cx + rx * 0.6, hy, hx - hr * 0.5, hy + hr * 0.1);
    neck.lineTo(hx + hr * 0.25, hy + hr * 0.75);
    neck.quadraticCurveTo(cx + rx * 0.95, cy - ry * 0.4, cx + rx * 0.85, cy - ry * 0.1);
    neck.closePath();
    ctx.fillStyle = body(0.02);
    ctx.fill(neck);
    P.strokeBody(ctx, neck, g, lw);
  }
  const head = makePath();
  if (dragon) head.ellipse(hx, hy, hr * 1.08, hr, 0, 0, TAU);
  else head.ellipse(hx + hr * 0.25, hy, hr * 1.2, hr * 0.85, 0.35, 0, TAU);
  ctx.fillStyle = body(0.04);
  ctx.fill(head);
  P.crumpleFacets(ctx, head, g, hx, hy, hr, hr);
  P.strokeBody(ctx, head, g, lw);

  // ears / little dragon horns
  const ear = makePath();
  ear.moveTo(hx - hr * 0.55, hy - hr * 0.55);
  ear.lineTo(hx - hr * 0.35, hy - hr * 1.35);
  ear.lineTo(hx - hr * 0.05, hy - hr * 0.7);
  ear.closePath();
  ctx.fillStyle = dragon ? '#f6e7b0' : body(-0.03);
  ctx.fill(ear);
  P.strokeBody(ctx, ear, g, lw * 0.8);

  // mane: flowing locks from the crest of the neck down the back (horses)
  if (!dragon) {
    const ax0 = hx - hr * 0.35;
    const ay0 = hy - hr * 0.75;
    const ax1 = cx + rx * 0.3;
    const ay1 = cy - ry * 0.95;
    const n = 6;
    for (let i = n - 1; i >= 0; i--) {
      const u = i / (n - 1);
      const sx = ax0 + (ax1 - ax0) * u;
      const sy = ay0 + (ay1 - ay0) * u;
      const len = hr * (1.1 - u * 0.35);
      const m = makePath();
      m.moveTo(sx + hr * 0.25, sy - hr * 0.1);
      m.bezierCurveTo(sx - len * 0.2, sy - hr * 0.35, sx - len * 0.9, sy + len * 0.1, sx - len * 0.75, sy + len * 0.85);
      m.bezierCurveTo(sx - len * 0.45, sy + len * 0.3, sx - hr * 0.05, sy + hr * 0.25, sx + hr * 0.25, sy - hr * 0.1);
      m.closePath();
      ctx.fillStyle = maneCol(i);
      ctx.fill(m);
      P.strokeBody(ctx, m, g, lw * 0.55);
    }
    // forelock between the ears
    const f = makePath();
    f.ellipse(hx + hr * 0.05, hy - hr * 0.6, hr * 0.32, hr * 0.22, -0.4, 0, TAU);
    ctx.fillStyle = maneCol(0);
    ctx.fill(f);
    P.strokeBody(ctx, f, g, lw * 0.5);
  }

  // the horn: longer and shinier the nicer the letter
  if (kind === 0) {
    const hl = L * (0.1 + 0.14 * g.q);
    const bx = hx + hr * 0.05;
    const by = hy - hr * 0.8;
    const tipX = bx + hl * 0.42;
    const tipY = by - hl;
    const horn = makePath();
    horn.moveTo(bx - hr * 0.2, by + hr * 0.05);
    horn.lineTo(tipX, tipY);
    horn.lineTo(bx + hr * 0.22, by + hr * 0.12);
    horn.closePath();
    const hg = ctx.createLinearGradient(bx, by, tipX, tipY);
    hg.addColorStop(0, g.q > 0.6 ? '#ffd84a' : '#f2e3c6');
    hg.addColorStop(1, g.q > 0.6 ? '#fff6c8' : '#fffaf0');
    ctx.fillStyle = hg;
    ctx.fill(horn);
    ctx.save();
    ctx.clip(horn);
    ctx.strokeStyle = 'rgba(170,120,40,0.55)';
    ctx.lineWidth = lw * 0.6;
    for (let i = 1; i < 5; i++) {
      const k = i / 5;
      ctx.beginPath();
      ctx.moveTo(bx - hr * 0.3 + (tipX - bx) * k, by + (tipY - by) * k + hr * 0.12);
      ctx.lineTo(bx + hr * 0.3 + (tipX - bx) * k, by + (tipY - by) * k - hr * 0.1);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = '#b07a1e';
    ctx.lineWidth = lw * 0.7;
    ctx.lineJoin = 'round';
    ctx.stroke(horn);
    ctx.restore();
    if (g.sparkle) P.sparkleStar(ctx, tipX, tipY, L * 0.04);
  }

  // face
  const eyes: P.EyeInfo[] = [];
  const er = hr * (0.4 + 0.06 * g.q);
  const fx = hx + hr * 0.2;
  const fy = hy - hr * 0.12;
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (!dragon) {
    // long lashes
    ctx.save();
    ctx.strokeStyle = 'rgba(40,30,50,0.9)';
    ctx.lineWidth = lw * 0.6;
    ctx.lineCap = 'round';
    for (const a of [-0.9, -0.5, -0.1]) {
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a - 0.6) * er, fy + Math.sin(a - 0.6) * er);
      ctx.lineTo(fx + Math.cos(a - 0.6) * er * 1.35, fy + Math.sin(a - 0.6) * er * 1.35);
      ctx.stroke();
    }
    ctx.restore();
  }
  P.blush(ctx, fx + er * 0.6, fy + er * 1.3, er * 0.55);
  ctx.fillStyle = 'rgba(60,30,60,0.6)';
  ctx.beginPath();
  ctx.ellipse(hx + hr * (dragon ? 0.85 : 1.15), hy + hr * (dragon ? 0.1 : 0.35), hr * 0.07, hr * 0.05, 0, 0, TAU);
  ctx.fill();
  P.mouth(ctx, hx + hr * (dragon ? 0.6 : 0.85), hy + hr * (dragon ? 0.5 : 0.62), hr * 0.38, g.wobble > 0.4 ? 'wavy' : 'smile');
  if (g.bandaid) P.bandaid(ctx, cx + rx * 0.35, cy - ry * 0.4, L * 0.14, 0.4);
  if (g.crown) P.crown(ctx, hx - hr * 0.45, hy - hr * 0.95, L * 0.15, -0.2);

  // wings: the moving part (pegasus big, dragon small)
  let tail: Sprite['tail'];
  if (kind !== 0) {
    const ws = L * (dragon ? 0.3 : 0.42);
    const { canvas: wc, ctx: w } = makeCanvas(Math.ceil(ws * 1.1), Math.ceil(ws * 0.9));
    const px = ws * 1.0;
    const py = ws * 0.8;
    const wing = makePath();
    wing.moveTo(px, py);
    if (dragon) {
      wing.lineTo(px - ws * 0.35, py - ws * 0.75);
      wing.quadraticCurveTo(px - ws * 0.55, py - ws * 0.5, px - ws * 0.9, py - ws * 0.55);
      wing.quadraticCurveTo(px - ws * 0.7, py - ws * 0.3, px - ws * 0.8, py - ws * 0.1);
      wing.quadraticCurveTo(px - ws * 0.4, py - ws * 0.15, px, py);
    } else {
      wing.bezierCurveTo(px - ws * 0.05, py - ws * 0.55, px - ws * 0.45, py - ws * 0.8, px - ws * 0.95, py - ws * 0.72);
      for (let i = 0; i < 4; i++) {
        const k = (i + 1) / 4;
        wing.quadraticCurveTo(px - ws * (0.98 - k * 0.15), py - ws * (0.55 - k * 0.3), px - ws * (0.9 - k * 0.55), py - ws * (0.5 - k * 0.42));
      }
      wing.closePath();
    }
    w.fillStyle = dragon ? hsl(g.hue2, 0.6, 0.72) : '#ffffff';
    w.fill(wing);
    if (!dragon) {
      w.save();
      w.clip(wing);
      w.fillStyle = hsl(g.hue2, 0.7, 0.85);
      w.beginPath();
      w.ellipse(px - ws * 0.6, py - ws * 0.45, ws * 0.35, ws * 0.2, -0.5, 0, TAU);
      w.fill();
      w.restore();
    }
    P.strokeBody(w, wing, g, lw * 0.8);
    tail = { canvas: wc, pivotX: px, pivotY: py, px: cx + rx * 0.2, py: cy - ry * 0.55 };
  }

  return {
    canvas,
    badge: badgeAt,
    sticker,
    ax: cx,
    ay: cy,
    radius: rx,
    eyes,
    lid: P.bodyColor(g, 0.05),
    tail,
    // the saddle: where a princess sits
    top: { x: cx + rx * 0.4, y: cy - ry * 0.75 },
  };
}

function spike(ctx: Ctx, x: number, y: number, s: number, col: string, g: Genome, lw: number) {
  const p = makePath();
  p.moveTo(x - s * 0.6, y + s * 0.4);
  p.lineTo(x, y - s);
  p.lineTo(x + s * 0.6, y + s * 0.4);
  p.closePath();
  ctx.fillStyle = col;
  ctx.fill(p);
  P.strokeBody(ctx, p, g, lw * 0.6);
}

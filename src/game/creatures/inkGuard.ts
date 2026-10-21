// Riesenburg guards: grumpy-cute ink blots with a folded paper hat (the enemies of neat writing).
import { makeCanvas, makePath } from '../canvas.ts';
import { TAU } from '../math.ts';
import { mulberry32 } from '../rng.ts';
import type { Sprite } from './sprite.ts';

/** radius in logical px, facing right */
export function inkGuardSprite(radius: number, seed: number): Sprite {
  const r = radius;
  const rand = mulberry32(seed);
  const W = Math.ceil(r * 3);
  const H = Math.ceil(r * 3.2);
  const { canvas, ctx } = makeCanvas(W, H);
  const cx = W / 2;
  const cy = H / 2 + r * 0.25;
  // splat body: circle with bumps and drips
  const body = makePath();
  const n = 80;
  const ph = rand() * TAU;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    let f = 1 + 0.07 * Math.sin(a * 7 + ph) + 0.04 * Math.sin(a * 11 + ph * 2);
    // drips at the bottom
    const down = Math.max(0, Math.sin(a));
    f += 0.18 * Math.pow(down, 8) * (0.6 + 0.4 * Math.sin(a * 5 + ph));
    const x = cx + Math.cos(a) * r * f;
    const y = cy + Math.sin(a) * r * 0.92 * f;
    if (i === 0) body.moveTo(x, y);
    else body.lineTo(x, y);
  }
  body.closePath();
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.15);
  g.addColorStop(0, '#5a4bb0');
  g.addColorStop(0.6, '#2f2470');
  g.addColorStop(1, '#1c1548');
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.strokeStyle = '#120d33';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.lineJoin = 'round';
  ctx.stroke(body);
  // little splashes around
  ctx.fillStyle = '#2f2470';
  for (let i = 0; i < 4; i++) {
    const a = rand() * TAU;
    const d = r * (1.15 + rand() * 0.25);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9, r * (0.06 + rand() * 0.06), 0, TAU);
    ctx.fill();
  }
  // shine
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, TAU);
  ctx.fill();
  // eyes with grumpy brows
  const eyes = [
    { x: cx - r * 0.05, y: cy - r * 0.15, r: r * 0.22 },
    { x: cx + r * 0.42, y: cy - r * 0.15, r: r * 0.22 },
  ];
  for (const e of eyes) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#120d33';
    ctx.beginPath();
    ctx.arc(e.x + e.r * 0.3, e.y + e.r * 0.1, e.r * 0.55, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x + e.r * 0.15, e.y - e.r * 0.12, e.r * 0.18, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#0c0826';
  ctx.lineWidth = Math.max(2.5, r * 0.09);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy - r * 0.48);
  ctx.lineTo(cx + r * 0.1, cy - r * 0.36);
  ctx.moveTo(cx + r * 0.28, cy - r * 0.36);
  ctx.lineTo(cx + r * 0.66, cy - r * 0.48);
  ctx.stroke();
  // pouting mouth
  ctx.strokeStyle = '#f2b8d8';
  ctx.lineWidth = Math.max(2, r * 0.07);
  ctx.beginPath();
  ctx.arc(cx + r * 0.2, cy + r * 0.32, r * 0.16, 1.15 * Math.PI, 1.85 * Math.PI);
  ctx.stroke();
  // folded paper hat
  const hx = cx + r * 0.05;
  const hy = cy - r * 0.78;
  ctx.fillStyle = '#fbf7ec';
  ctx.strokeStyle = '#7a6f8f';
  ctx.lineWidth = Math.max(1.5, r * 0.05);
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.62, hy + r * 0.12);
  ctx.lineTo(hx, hy - r * 0.55);
  ctx.lineTo(hx + r * 0.62, hy + r * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(80,70,110,0.45)';
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.45 + i * r * 0.05, hy - r * 0.02 * i);
    ctx.lineTo(hx + r * 0.2 - i * r * 0.02, hy - r * 0.02 * i);
    ctx.stroke();
  }
  ctx.fillStyle = '#ff6f91';
  ctx.beginPath();
  ctx.arc(hx, hy - r * 0.55, r * 0.08, 0, TAU);
  ctx.fill();
  return {
    canvas,
    ax: cx,
    ay: cy,
    radius: r,
    eyes,
    lid: '#2f2470',
    top: { x: cx, y: cy - r * 1.4 },
  };
}

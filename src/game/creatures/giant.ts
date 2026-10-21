// Riese Rumpel: the friendly-grumpy giant on top of the Riesenburg. Drawn live (one character, many moods).
import type { Ctx } from '../canvas.ts';
import { TAU } from '../math.ts';

export type GiantMood = 'idle' | 'laugh' | 'angry' | 'shock' | 'defeat';

const SKIN = '#c9a6f2';
const SKIN_DARK = '#8e64c9';
const LINE = '#3b2160';

/**
 * Draws the giant peeking over a wall. (x, y) is the middle of the wall top he leans on;
 * s scales him (1 ≈ 300 px tall), t is the scene time, flag (0..1) raises a white flag.
 */
export function drawGiant(ctx: Ctx, x: number, y: number, s: number, mood: GiantMood, t: number, flag = 0): void {
  ctx.save();
  const bounce = mood === 'laugh' ? Math.abs(Math.sin(t * 14)) * 10 : mood === 'angry' ? Math.sin(t * 40) * 2 : Math.sin(t * 2) * 3;
  ctx.translate(x, y - bounce * s);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = LINE;
  // body (the lower part is hidden behind the wall)
  const bg = ctx.createRadialGradient(-40, -170, 20, 0, -110, 170);
  bg.addColorStop(0, '#9a7bd6');
  bg.addColorStop(1, '#5d3f99');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.ellipse(0, -60, 150, 135, 0, Math.PI, TAU);
  ctx.lineTo(150, 20);
  ctx.lineTo(-150, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // belt with buckle
  ctx.fillStyle = '#4a2f1d';
  ctx.fillRect(-150, -26, 300, 22);
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(-18, -30, 36, 30);
  ctx.strokeRect(-18, -30, 36, 30);
  // arms: leaning on the wall, waving the flag, or up when angry
  const armY = mood === 'angry' ? -150 : -20;
  for (const sx of [-1, 1]) {
    const waving = flag > 0 && sx > 0;
    const ax = sx * 160;
    const ay = waving ? -210 * flag - 20 * (1 - flag) : armY + (mood === 'laugh' ? Math.sin(t * 14 + sx) * 6 : 0);
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.arc(ax, ay, 42, 0, TAU);
    ctx.fill();
    ctx.stroke();
    if (waving) {
      // white flag
      ctx.strokeStyle = '#7a5a3a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(ax, ay + 30);
      ctx.lineTo(ax + 10, ay - 190);
      ctx.stroke();
      const wave = Math.sin(t * 6) * 14;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(ax + 10, ay - 190);
      ctx.quadraticCurveTo(ax + 70, ay - 205 + wave, ax + 130, ay - 185);
      ctx.lineTo(ax + 125, ay - 115);
      ctx.quadraticCurveTo(ax + 70, ay - 135 - wave, ax + 10, ay - 120);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.lineWidth = 6;
    }
  }
  // head
  const hy = -235;
  const hg = ctx.createRadialGradient(-35, hy - 40, 10, 0, hy, 120);
  hg.addColorStop(0, '#e6d3ff');
  hg.addColorStop(1, SKIN);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(-112, hy + 5, 26, 34, 0, 0, TAU);
  ctx.ellipse(112, hy + 5, 26, 34, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, hy, 112, 104, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (mood === 'angry') {
    ctx.fillStyle = 'rgba(255,60,60,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, hy, 110, 102, 0, 0, TAU);
    ctx.fill();
  }
  // cheeks
  ctx.fillStyle = 'rgba(255,120,170,0.45)';
  ctx.beginPath();
  ctx.ellipse(-62, hy + 30, 22, 14, 0, 0, TAU);
  ctx.ellipse(62, hy + 30, 22, 14, 0, 0, TAU);
  ctx.fill();
  // eyes
  const ey = hy - 18;
  for (const sx of [-1, 1]) {
    const ex = sx * 40;
    if (mood === 'laugh') {
      ctx.beginPath();
      ctx.arc(ex, ey + 6, 16, 1.1 * Math.PI, 1.9 * Math.PI);
      ctx.stroke();
      continue;
    }
    const rr = mood === 'shock' ? 24 : 19;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex, ey, rr, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = LINE;
    ctx.beginPath();
    ctx.arc(ex + (mood === 'defeat' ? 0 : 3), ey + (mood === 'defeat' ? 5 : 2), mood === 'shock' ? 7 : 10, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(ex - 2, ey - 3, 4, 0, TAU);
    ctx.fill();
    if (mood === 'defeat') {
      // droopy lids
      ctx.fillStyle = SKIN_DARK;
      ctx.beginPath();
      ctx.arc(ex, ey, rr + 1, Math.PI, TAU);
      ctx.fill();
    }
  }
  // bushy brows
  ctx.lineWidth = 12;
  const tilt = mood === 'angry' ? 18 : mood === 'shock' ? -14 : mood === 'defeat' ? -8 : 6;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 70, hy - 52 - (mood === 'shock' ? 12 : 0));
    ctx.lineTo(sx * 18, hy - 52 + tilt - (mood === 'shock' ? 12 : 0));
    ctx.stroke();
  }
  ctx.lineWidth = 6;
  // nose
  ctx.fillStyle = '#e891c5';
  ctx.beginPath();
  ctx.ellipse(0, hy + 18, 22, 18, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  // mustache
  ctx.fillStyle = '#6b4a2b';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, hy + 36);
    ctx.quadraticCurveTo(sx * 30, hy + 26, sx * 58, hy + 40);
    ctx.quadraticCurveTo(sx * 70, hy + 50, sx * 60, hy + 58);
    ctx.quadraticCurveTo(sx * 30, hy + 52, 0, hy + 46);
    ctx.closePath();
    ctx.fill();
  }
  // mouth
  ctx.strokeStyle = LINE;
  if (mood === 'laugh') {
    ctx.fillStyle = '#7a2340';
    ctx.beginPath();
    ctx.ellipse(0, hy + 70, 34, 22 + Math.abs(Math.sin(t * 14)) * 6, 0, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (mood === 'shock') {
    ctx.fillStyle = '#7a2340';
    ctx.beginPath();
    ctx.ellipse(0, hy + 72, 14, 18, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (mood === 'angry') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.roundRect(-28, hy + 62, 56, 16, 6);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = -2; i <= 2; i++) {
      ctx.moveTo(i * 10, hy + 62);
      ctx.lineTo(i * 10, hy + 78);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, hy + 52, 26, mood === 'defeat' ? 1.15 * Math.PI : 0.2 * Math.PI, mood === 'defeat' ? 1.85 * Math.PI : 0.8 * Math.PI, mood === 'defeat');
    ctx.stroke();
  }
  // crown
  const cy = hy - 96;
  ctx.fillStyle = '#ffd34d';
  ctx.strokeStyle = '#a86b00';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-62, cy + 20);
  ctx.lineTo(-62, cy - 26);
  ctx.lineTo(-31, cy);
  ctx.lineTo(0, cy - 44);
  ctx.lineTo(31, cy);
  ctx.lineTo(62, cy - 26);
  ctx.lineTo(62, cy + 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const [gx, col] of [
    [-31, '#ff4f81'],
    [0, '#3fc1ff'],
    [31, '#7cff6b'],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(gx, cy + 6, 7, 0, TAU);
    ctx.fill();
  }
  // sweat drop when shocked
  if (mood === 'shock' || mood === 'defeat') {
    ctx.fillStyle = '#8fd8ff';
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(95, hy - 40);
    ctx.quadraticCurveTo(110, hy - 15, 95, hy - 8);
    ctx.quadraticCurveTo(80, hy - 15, 95, hy - 40);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

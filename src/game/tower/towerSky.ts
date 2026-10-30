// "Türme bauen" with high finish lines: the sky changes while the ground sinks away. `c` is how many
// metres the ground has sunk. First the trees on the horizon get smaller, birds, a balloon, clouds and a
// plane pass by, the sky turns dark, the earth curves, then come a satellite, the ISS and the moon.
import type { Ctx } from '../canvas.ts';
import { clamp, hsl, lerp, TAU } from '../math.ts';
import { mulberry32 } from '../rng.ts';
import { WORLD_H } from '../stage.ts';
import { TOWER } from './rules.ts';

const INK = '#2b1d45';
/** px a sky thing moves per metre the ground sinks */
const PASS = 45;

const smooth = (u: number): number => {
  const x = clamp(u);
  return x * x * (3 - 2 * x);
};

/** screen height of something that is at `rest` when the ground has sunk `q` metres */
const passY = (c: number, q: number, rest: number): number => rest + (c - q) * PASS;

function mix(a: string, b: string, k: number): string {
  const p = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = [0, 1, 2].map((i) => Math.round(lerp(p(a, i), p(b, i), k)));
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`;
}

const DUSK = ['#1d1450', '#5a43b8', '#d98bd0', '#ffc1c9'];
const SPACE = ['#03020c', '#080622', '#13185a', '#3d6fd6'];

/** the still part of the sky (gradient, stars, the ringed planet, the earth below); paint it again when c changes */
export function paintSky(ctx: Ctx, W: number, c: number, high: boolean): void {
  const G = TOWER.groundY;
  const r = mulberry32(21);
  const k = high ? smooth((c - 12) / 28) : 0;
  const sky = ctx.createLinearGradient(0, 0, 0, high ? WORLD_H : G);
  [0, 0.5, 0.85, 1].forEach((at, i) => sky.addColorStop(at, mix(DUSK[i], SPACE[i], k)));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, high ? WORLD_H : G);
  for (let i = 0; i < 180; i++) {
    const y = r() * G * 0.62;
    ctx.fillStyle = `rgba(255,255,255,${(0.3 + r() * 0.7) * lerp(1 - y / (G * 0.7), 1, k)})`;
    ctx.beginPath();
    ctx.arc(r() * W, y, r() < 0.9 ? 1 + r() * 1.3 : 2.4, 0, TAU);
    ctx.fill();
  }
  // in space there are stars everywhere
  for (let i = 0; i < 220 && k > 0; i++) {
    ctx.fillStyle = `rgba(255,255,255,${(0.25 + r() * 0.75) * k})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * WORLD_H, r() < 0.92 ? 0.8 + r() * 1.2 : 2.2, 0, TAU);
    ctx.fill();
  }
  // ringed planet (far away: it hardly moves)
  const px = W * 0.88;
  const py = 360 + c * 1.5;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,220,170,0.6)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(px, py, 110, 26, -0.25, Math.PI, TAU);
  ctx.stroke();
  const pg = ctx.createRadialGradient(px - 20, py - 20, 5, px, py, 62);
  pg.addColorStop(0, '#ffd59a');
  pg.addColorStop(1, '#e0885a');
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.arc(px, py, 60, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(px, py, 110, 26, -0.25, 0, Math.PI);
  ctx.stroke();
  // the little moon only in the low games: in the high ones the real moon comes later
  if (!high) {
    ctx.fillStyle = '#efe9ff';
    ctx.beginPath();
    ctx.arc(W * 0.1, 470, 26, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (high) paintEarth(ctx, W, c);
}

/** the land far below: a flat horizon with trees that bends into the round, blue earth */
function paintEarth(ctx: Ctx, W: number, c: number): void {
  const top = TOWER.groundY - 75 + 230 * smooth(c / 35);
  const R = 20000 / (1 + c / 6);
  const cx = W / 2;
  const cy = top + R;
  const blue = smooth((c - 10) / 25);
  ctx.save();
  // glowing air around the earth
  const glow = smooth((c - 15) / 25);
  if (glow > 0) {
    const g = ctx.createRadialGradient(cx, cy, R, cx, cy, R + 70);
    g.addColorStop(0, `rgba(140,200,255,${0.75 * glow})`);
    g.addColorStop(1, 'rgba(140,200,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 80, W, WORLD_H - top + 80);
  }
  const e = ctx.createLinearGradient(0, top, 0, WORLD_H);
  e.addColorStop(0, mix('#6fbf63', '#3f86e0', blue));
  e.addColorStop(1, mix('#4f9e57', '#1f4fa8', blue));
  ctx.fillStyle = e;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, TAU);
  ctx.fill();
  ctx.clip();
  // continents and clouds from high above
  if (blue > 0) {
    const r = mulberry32(7);
    for (let i = 0; i < 9; i++) {
      const x = r() * W;
      const y = top + 10 + r() * 140;
      ctx.fillStyle = i % 3 ? `rgba(98,180,90,${0.9 * blue})` : `rgba(255,255,255,${0.7 * blue})`;
      ctx.beginPath();
      ctx.ellipse(x, y, 60 + r() * 120, 14 + r() * 26, r() - 0.5, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  // trees and houses on the horizon: the higher, the smaller
  const s = 1 / (1 + c / 5);
  const a = 1 - smooth((c - 18) / 12);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  const r = mulberry32(5);
  for (let x = -40; x < W + 40; x += (36 + r() * 60) * Math.max(0.35, s)) {
    const dx = x - cx;
    if (Math.abs(dx) >= R) continue;
    const y = cy - Math.sqrt(R * R - dx * dx) + 3;
    if (r() < 0.18) house(ctx, x, y, 34 * s, hsl(r() * 360, 0.6, 0.7));
    else tree(ctx, x, y, (34 + r() * 26) * s, r());
  }
  ctx.restore();
}

function tree(ctx: Ctx, x: number, y: number, h: number, v: number): void {
  ctx.fillStyle = '#7a5236';
  ctx.fillRect(x - h * 0.06, y - h * 0.4, h * 0.12, h * 0.4);
  ctx.fillStyle = hsl(110 + v * 40, 0.5, 0.36 + v * 0.1);
  ctx.beginPath();
  if (v < 0.5) ctx.arc(x, y - h * 0.62, h * 0.34, 0, TAU);
  else {
    ctx.moveTo(x - h * 0.3, y - h * 0.3);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + h * 0.3, y - h * 0.3);
  }
  ctx.fill();
}

function house(ctx: Ctx, x: number, y: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x - h * 0.4, y - h * 0.6, h * 0.8, h * 0.6);
  ctx.fillStyle = '#c4553f';
  ctx.beginPath();
  ctx.moveTo(x - h * 0.5, y - h * 0.58);
  ctx.lineTo(x, y - h);
  ctx.lineTo(x + h * 0.5, y - h * 0.58);
  ctx.fill();
}

/** what flies by: birds, balloon, clouds, plane, satellite, ISS and the moon */
export function drawSkyThings(ctx: Ctx, W: number, c: number, t: number): void {
  const on = (y: number, m = 260) => y > -m && y < WORLD_H + m;
  // the moon
  const my = passY(c, 90, 330);
  if (on(my, 200)) moon(ctx, W * 0.7, my, 170);
  const sy = passY(c, 40, 300);
  if (on(sy)) satellite(ctx, W * 0.22 + Math.sin(t * 0.15) * 60, sy, t);
  const iy = passY(c, 48, 380);
  if (on(iy)) iss(ctx, ((t * 35) % (W + 700)) - 350, iy, t);
  for (const [q, fx, rest, s] of [
    [12, 0.15, 520, 1],
    [15, 0.62, 420, 1.3],
    [19, 0.32, 380, 1.1],
    [24, 0.84, 560, 1.4],
    [28, 0.06, 300, 0.9],
    [31, 0.5, 620, 1.2],
  ]) {
    const y = passY(c, q, rest);
    if (on(y)) cloud(ctx, ((fx * W + t * 9 * s) % (W + 400)) - 200, y, s);
  }
  const by = passY(c, 14, 470);
  if (on(by)) balloon(ctx, W * 0.74, by + Math.sin(t * 1.2) * 10);
  const py = passY(c, 20, 300);
  if (on(py)) plane(ctx, ((t * 140) % (W + 900)) - 300, py);
  const fy = passY(c, 5, 520);
  if (on(fy)) for (let i = 0; i < 5; i++) gull(ctx, ((t * 45 + i * 46) % (W + 500)) - 250, fy + Math.sin(i * 2.1) * 26, t + i);
}

function cloud(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  for (const [ox, oy, r] of [
    [-70, 10, 34],
    [-30, -14, 46],
    [20, -22, 52],
    [66, -2, 38],
    [96, 14, 26],
  ])
    ctx.arc(ox, oy, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,190,240,0.45)';
  ctx.fillRect(-100, 18, 220, 22);
  ctx.restore();
}

function gull(ctx: Ctx, x: number, y: number, t: number): void {
  const f = Math.sin(t * 8) * 8;
  ctx.save();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 16, y - f);
  ctx.quadraticCurveTo(x - 7, y - 8, x, y);
  ctx.quadraticCurveTo(x + 7, y - 8, x + 16, y - f);
  ctx.stroke();
  ctx.restore();
}

function balloon(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  const cols = ['#ff6b6b', '#ffd84a', '#5ec8ff', '#9be15d'];
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = cols[i];
    ctx.beginPath();
    ctx.ellipse(0, 0, 70 - i * 17, 80, 0, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 70, 80, 0, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-34, 70);
  ctx.lineTo(-16, 112);
  ctx.moveTo(34, 70);
  ctx.lineTo(16, 112);
  ctx.stroke();
  ctx.fillStyle = '#a0703c';
  ctx.fillRect(-20, 110, 40, 30);
  ctx.strokeRect(-20, 110, 40, 30);
  ctx.restore();
}

function plane(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  // a long white trail behind it
  const g = ctx.createLinearGradient(-520, 0, -60, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0.7)');
  ctx.fillStyle = g;
  ctx.fillRect(-520, -5, 460, 10);
  ctx.fillStyle = '#f4f6ff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 62, 12, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(-50, -4);
  ctx.lineTo(-66, -34);
  ctx.lineTo(-40, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(-26, 30);
  ctx.lineTo(10, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#5ec8ff';
  for (let i = 0; i < 5; i++) ctx.fillRect(-26 + i * 13, -5, 7, 5);
  ctx.restore();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#2f5fb8';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#a9c8ff';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w * i) / 4, y);
    ctx.lineTo(x + (w * i) / 4, y + h);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);
}

function satellite(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 0.4) * 0.2);
  panel(ctx, -86, -12, 56, 24);
  panel(ctx, 30, -12, 56, 24);
  ctx.fillStyle = '#ffd36b';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillRect(-30, -20, 60, 40);
  ctx.strokeRect(-30, -20, 60, 40);
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(0, -40);
  ctx.stroke();
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff5470' : '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -42, 5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** the space station: a long truss with big solar wings and modules in the middle */
function iss(ctx: Ctx, x: number, y: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.06 + Math.sin(t * 0.2) * 0.03);
  ctx.strokeStyle = '#c9cede';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-250, 0);
  ctx.lineTo(250, 0);
  ctx.stroke();
  for (const sx of [-230, -160, 160, 230]) {
    panel(ctx, sx - 26, -92, 52, 80);
    panel(ctx, sx - 26, 12, 52, 80);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.fillStyle = '#e8ebf5';
  for (const [mx, my, w, h] of [
    [-60, -16, 120, 32],
    [-16, -60, 32, 120],
    [60, -12, 50, 24],
  ]) {
    ctx.fillRect(mx, my, w, h);
    ctx.strokeRect(mx, my, w, h);
  }
  ctx.fillStyle = '#ffd36b';
  ctx.fillRect(-60, -6, 18, 12);
  // a little window with someone waving
  ctx.fillStyle = '#5ec8ff';
  ctx.beginPath();
  ctx.arc(0, -40, 8, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 22px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ISS', 0, 96);
  ctx.restore();
}

function moon(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.save();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  g.addColorStop(0, '#fbf8ee');
  g.addColorStop(1, '#c9c3b3');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,130,115,0.45)';
  const rnd = mulberry32(9);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU;
    const d = rnd() * r * 0.7;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.06 + rnd() * 0.12), 0, TAU);
    ctx.fill();
  }
  // a flag on top: someone has been here already
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.2, y - r * 0.98);
  ctx.lineTo(x + r * 0.2, y - r * 1.3);
  ctx.stroke();
  ctx.fillStyle = '#ff5470';
  ctx.fillRect(x + r * 0.2, y - r * 1.3, 34, 22);
  ctx.restore();
}

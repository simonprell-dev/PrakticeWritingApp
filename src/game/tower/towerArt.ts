// "Türme bauen": building blocks with the child's letter, their decorations, the plinths with the
// team names and the finish line.
import type { AnyCanvas, Ctx } from '../canvas.ts';
import { bandaid, crown, sparkleStar } from '../creatures/parts.ts';
import { hsl, TAU } from '../math.ts';
import { mulberry32 } from '../rng.ts';
import type { Deco } from './gags.ts';
import { TOWER } from './rules.ts';

export interface BlockLook {
  w: number;
  h: number;
  hue: number;
  stars: number;
  sticker: AnyCanvas | null;
  deco: Deco[];
  seed: number;
  t: number;
}

/** block width: nice blocks are straight and full width, crumpled ones a bit narrower */
export function blockWidth(stars: number, towerW: number = TOWER.towerW): number {
  return towerW * (stars >= 3 ? 1 : stars === 2 ? 0.94 : 0.88);
}

function outline(ctx: Ctx, w: number, h: number, stars: number, seed: number): void {
  const x0 = -w / 2;
  const y0 = -h / 2;
  const r = Math.min(14, h * 0.3);
  ctx.beginPath();
  if (stars > 1) {
    ctx.roundRect(x0, y0, w, h, r);
    return;
  }
  // crumpled: a slightly jagged outline
  const rnd = mulberry32(seed);
  const pts: [number, number][] = [];
  const n = 5;
  for (let i = 0; i < n; i++) pts.push([x0 + (w * i) / n, y0 + (rnd() - 0.5) * 4]);
  for (let i = 0; i < 3; i++) pts.push([x0 + w + (rnd() - 0.5) * 5, y0 + (h * i) / 3]);
  for (let i = n; i > 0; i--) pts.push([x0 + (w * i) / n, y0 + h + (rnd() - 0.5) * 4]);
  for (let i = 3; i > 0; i--) pts.push([x0 + (rnd() - 0.5) * 5, y0 + (h * i) / 3]);
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function partyHat(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(0.3);
  ctx.fillStyle = '#ff6fb5';
  ctx.strokeStyle = '#3b2a5c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-s * 0.5, 0);
  ctx.lineTo(0, -s * 1.2);
  ctx.lineTo(s * 0.5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(0, -s * 1.2, s * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function flower(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.fillStyle = '#ff7eb6';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + Math.cos((i / 5) * TAU) * s * 0.45, y + Math.sin((i / 5) * TAU) * s * 0.45, s * 0.38, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.32, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** a building block centred at (0, 0) */
export function drawBlock(ctx: Ctx, b: BlockLook): void {
  const { w, h, hue, stars } = b;
  const x0 = -w / 2;
  const y0 = -h / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  const sat = stars >= 4 ? 0.78 : stars >= 2 ? 0.62 : 0.42;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + h);
  g.addColorStop(0, hsl(hue, sat, 0.72));
  g.addColorStop(1, hsl(hue, sat, 0.5));
  outline(ctx, w, h, stars, b.seed);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  // bricks
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  const rows = Math.max(1, Math.round(h / 34));
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * rh;
    if (r) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
      ctx.stroke();
    }
    const off = r % 2 ? w / 4 : 0;
    for (let x = x0 + off + w / 2; x < x0 + w; x += w / 2) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rh);
      ctx.stroke();
    }
  }
  if (stars <= 1) {
    // creases of a crumpled block
    const rnd = mulberry32(b.seed + 7);
    ctx.fillStyle = 'rgba(40,20,60,0.12)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x0 + rnd() * w, y0);
      ctx.lineTo(x0 + rnd() * w, y0 + h);
      ctx.lineTo(x0 + rnd() * w, y0 + rnd() * h);
      ctx.fill();
    }
  } else if (stars === 2) {
    ctx.strokeStyle = 'rgba(40,20,60,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.8, y0);
    ctx.lineTo(x0 + w * 0.72, y0 + h * 0.4);
    ctx.lineTo(x0 + w * 0.82, y0 + h * 0.65);
    ctx.stroke();
  }
  if (stars >= 4 || b.deco.includes('shine')) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.roundRect(x0 + 6, y0 + 4, w - 12, Math.min(10, h * 0.2), 5);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = stars === 5 ? '#b07800' : hsl(hue, 0.5, 0.25);
  ctx.lineWidth = stars === 5 ? 5 : 3.5;
  outline(ctx, w, h, stars, b.seed);
  ctx.stroke();
  // white label with the child's own letter
  const ls = Math.min(h - 8, 96, w * 0.62);
  if (ls > 8) {
    ctx.fillStyle = 'rgba(255,253,245,0.95)';
    ctx.strokeStyle = stars === 5 ? '#e0a400' : 'rgba(40,20,60,0.35)';
    ctx.lineWidth = stars === 5 ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(-ls * 0.48, -ls / 2, ls * 0.96, ls, Math.min(10, ls * 0.2));
    ctx.fill();
    ctx.stroke();
    const st = b.sticker;
    if (st) {
      const s = (ls * 0.88) / Math.max(st.width, st.height);
      ctx.drawImage(st as CanvasImageSource, (-st.width * s) / 2, (-st.height * s) / 2, st.width * s, st.height * s);
    }
  }
  if (stars === 5 && ls > 20) {
    crown(ctx, ls * 0.42, -ls / 2 + 2, Math.min(30, ls * 0.4), 0.3);
    sparkleStar(ctx, x0 + 14, y0 + 12, 7 + 3 * Math.sin(b.t * 4 + b.seed), '#fff6b0');
  }
  if (stars <= 1 && h > 24) bandaid(ctx, x0 + w * 0.2, y0 + h * 0.3, Math.min(34, h * 0.8), -0.5);
  const ds = Math.min(26, h * 0.5);
  if (b.deco.includes('party')) partyHat(ctx, x0 + w - ds * 0.8, y0 + h * 0.45, ds);
  if (b.deco.includes('flower')) flower(ctx, x0 + ds * 0.7, y0 + h / 2, ds * 0.8);
  if (b.deco.includes('shine')) sparkleStar(ctx, x0 + w - 16, y0 + 12, 8 + 3 * Math.sin(b.t * 5 + b.seed), '#ffffff');
  ctx.restore();
}

/** stone plinth with the team name below a tower */
export function drawPlinth(ctx: Ctx, x: number, name: string, color: string, towerW: number = TOWER.towerW): void {
  const y = TOWER.groundY;
  const w = towerW + 64;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + 46, w * 0.55, 12, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#3b2a5c';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, y - 2, w, 48, 14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x - w / 2 + 8, y + 3, w - 16, 6);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(40,20,60,0.6)';
  ctx.lineWidth = 5;
  ctx.font = '700 28px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeText(name, x, y + 23, w - 20);
  ctx.fillText(name, x, y + 23, w - 20);
  ctx.restore();
}

/** dashed rainbow finish line with "Ziel" flags and metre marks every 10 m (`ground`: the ground on screen) */
export function drawGoalLine(ctx: Ctx, worldW: number, goal: number, ppm: number, ground: number = TOWER.groundY): void {
  ctx.save();
  ctx.font = '600 22px Fredoka, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (let m = 10; m < goal; m += 10) {
    const y = ground - m * ppm;
    if (y < -20 || y > ground - 20) continue;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(90, y);
    ctx.lineTo(worldW - 40, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.textAlign = 'left';
    ctx.fillText(`${m} m`, 26, y);
  }
  const y = ground - goal * ppm;
  if (y < -10) {
    ctx.restore();
    return;
  }
  const seg = 28;
  for (let x = 40, i = 0; x < worldW - 40; x += seg, i++) {
    ctx.fillStyle = hsl(i * 30, 0.85, 0.65);
    ctx.fillRect(x, y - 4, seg - 8, 8);
  }
  for (const sx of [70, worldW - 70]) {
    ctx.strokeStyle = '#6b4e3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(sx, y + 4);
    ctx.lineTo(sx, y - 74);
    ctx.stroke();
    // checkered flag
    const fx = sx < worldW / 2 ? sx : sx - 72;
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#2b1d45' : '#ffffff';
        ctx.fillRect(fx + c * 12, y - 74 + r * 12, 12, 12);
      }
  }
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(40,20,60,0.7)';
  ctx.lineWidth = 6;
  ctx.lineJoin = 'round';
  ctx.font = '700 34px Fredoka, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.strokeText(`Ziel: ${goal} m`, 160, y - 30);
  ctx.fillText(`Ziel: ${goal} m`, 160, y - 30);
  ctx.restore();
}

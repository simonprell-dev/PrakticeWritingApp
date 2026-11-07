// The advent calendar house: a snowy half-timbered house with 24 numbered doors of many shapes (windows,
// shutters, dormers, a bay window, the chimney flap, the front door ...), painted closed for the background;
// open doors are drawn on top. Everything is laid out in house units (1150 wide, ground at 800) and scaled
// into the world, so any world width works.
import { makePath, type Ctx } from '../canvas.ts';
import { sparkleStar } from '../creatures/parts.ts';
import { clamp, lerp, TAU } from '../math.ts';
import { mulberry32 } from '../rng.ts';

export type Shape = 'rect' | 'arch' | 'round' | 'oval' | 'star' | 'diamond' | 'shutter' | 'door' | 'dormer' | 'chimney' | 'cellar' | 'mailbox' | 'erker';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Slot extends Rect {
  shape: Shape;
}

/** house units */
const LW = 1150;
const LB = 800;
/** where the house stands in the world */
export const BASE_Y = 822;
export const HORIZON = 640;

const SLOTS: Slot[] = [
  // roof: chimney flap, round gable window, two dormers
  // the chimney stands on the left: the camera picture of the game covers the top right corner
  { shape: 'chimney', x: 88, y: 150, w: 84, h: 78 },
  { shape: 'round', x: 520, y: 148, w: 110, h: 110 },
  { shape: 'dormer', x: 285, y: 228, w: 100, h: 90 },
  { shape: 'dormer', x: 765, y: 228, w: 100, h: 90 },
  // upper floor
  { shape: 'shutter', x: 55, y: 365, w: 100, h: 100 },
  { shape: 'arch', x: 235, y: 365, w: 100, h: 100 },
  { shape: 'rect', x: 415, y: 365, w: 100, h: 100 },
  { shape: 'oval', x: 635, y: 365, w: 100, h: 100 },
  { shape: 'shutter', x: 815, y: 365, w: 100, h: 100 },
  { shape: 'arch', x: 995, y: 365, w: 100, h: 100 },
  // middle floor
  { shape: 'round', x: 55, y: 500, w: 100, h: 100 },
  { shape: 'erker', x: 205, y: 508, w: 160, h: 96 },
  { shape: 'star', x: 410, y: 495, w: 110, h: 110 },
  { shape: 'diamond', x: 630, y: 495, w: 110, h: 110 },
  { shape: 'arch', x: 815, y: 500, w: 100, h: 100 },
  { shape: 'shutter', x: 995, y: 500, w: 100, h: 100 },
  // ground floor
  { shape: 'door', x: 505, y: 615, w: 140, h: 185 },
  { shape: 'shutter', x: 50, y: 640, w: 100, h: 84 },
  { shape: 'cellar', x: 40, y: 756, w: 120, h: 42 },
  { shape: 'oval', x: 195, y: 645, w: 110, h: 100 },
  { shape: 'arch', x: 345, y: 640, w: 100, h: 110 },
  { shape: 'rect', x: 700, y: 645, w: 100, h: 100 },
  { shape: 'mailbox', x: 852, y: 662, w: 84, h: 80 },
  { shape: 'cellar', x: 980, y: 740, w: 120, h: 56 },
];

/** which slot each day (1..24) has: mixed like a real calendar; the 6th is the chimney, the 24th the front door */
const DAY_SLOT = [8, 19, 1, 13, 22, 0, 5, 11, 21, 3, 17, 9, 12, 2, 23, 6, 14, 20, 10, 4, 15, 7, 18, 16];

const STRUCTURE: Shape[] = ['dormer', 'erker', 'door'];

const COLORS = ['#d64045', '#2e8b57', '#d99a1e', '#3b6fd1', '#9b4dca', '#e2662a', '#1f9e9a', '#c2337a'];

export function doorColor(day: number): string {
  return day === 24 ? '#b3122a' : COLORS[(day * 5) % COLORS.length];
}

export function shapeOf(day: number): Shape {
  return SLOTS[DAY_SLOT[day - 1]].shape;
}

/** scale of the house */
export function houseK(W: number): number {
  return clamp((W - 520) / LW, 0.62, 1);
}

/** left edge of the house in the world: a bit right of the middle, room for Flocke and his bubble on the left */
export function houseX0(W: number): number {
  const k = houseK(W);
  const w = LW * k;
  return Math.min(W - w - 60 * k, Math.max(W * 0.5 - w / 2 + 150 * k, 470 * k + 40));
}

function map(W: number, lx: number, ly: number): { x: number; y: number } {
  const k = houseK(W);
  return { x: houseX0(W) + lx * k, y: BASE_Y - (LB - ly) * k };
}

function mapRect(W: number, r: Rect): Rect {
  const k = houseK(W);
  const p = map(W, r.x, r.y);
  return { x: p.x, y: p.y, w: r.w * k, h: r.h * k };
}

/** a door in world coordinates */
export function doorRect(W: number, day: number): Rect {
  return mapRect(W, SLOTS[DAY_SLOT[day - 1]]);
}

/** the house outline (for "is this tap on the house") */
export function houseRect(W: number): Rect {
  const k = houseK(W);
  const p = map(W, -60, 40);
  return { x: p.x, y: p.y, w: (LW + 120) * k, h: (LB - 40) * k };
}

/** the star on the roof */
export function roofStar(W: number): { x: number; y: number; r: number } {
  const p = map(W, 575, 22);
  return { x: p.x, y: p.y, r: 40 * houseK(W) };
}

/** top of the chimney (smoke) */
export function chimneyTop(W: number): { x: number; y: number } {
  return map(W, 130, 98);
}

/** where Flocke stands */
export function flockeSpot(W: number): { x: number; y: number } {
  return { x: houseX0(W) - 165 * houseK(W), y: 908 };
}

// ------------------------------------------------------------------------------------------- shapes

function star5(p: Path2D, x: number, y: number, r: number, inner = 0.5): void {
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    if (i === 0) p.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  p.closePath();
}

/** the outline of a door panel */
export function doorPath(shape: Shape, r: Rect): Path2D {
  const p = makePath();
  const { x, y, w, h } = r;
  const cx = x + w / 2;
  const cy = y + h / 2;
  switch (shape) {
    case 'round':
      p.arc(cx, cy, Math.min(w, h) / 2, 0, TAU);
      break;
    case 'oval':
      p.ellipse(cx, cy, w / 2, h / 2, 0, 0, TAU);
      break;
    case 'star':
      star5(p, cx, cy + h * 0.04, Math.min(w, h) * 0.56, 0.55);
      break;
    case 'diamond':
      p.moveTo(cx, y);
      p.lineTo(x + w, cy);
      p.lineTo(cx, y + h);
      p.lineTo(x, cy);
      p.closePath();
      break;
    case 'arch':
    case 'door':
    case 'dormer':
    case 'mailbox': {
      const rr = w / 2;
      p.moveTo(x, y + h);
      p.lineTo(x, y + rr);
      p.arc(cx, y + rr, rr, Math.PI, 0);
      p.lineTo(x + w, y + h);
      p.closePath();
      break;
    }
    case 'cellar':
      p.roundRect(x, y, w, h, [h * 0.5, h * 0.5, 3, 3]);
      break;
    default:
      p.roundRect(x, y, w, h, Math.min(w, h) * 0.08);
  }
  return p;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.round(clamp(f < 0 ? v * (1 + f) : v + (255 - v) * f, 0, 255));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function holly(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = '#1f7a3a';
  for (const a of [-0.5, 0.6]) {
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a + Math.PI) * 7 * s, y + Math.sin(a) * 4 * s, 9 * s, 4 * s, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#e5283b';
  for (const [dx, dy] of [
    [0, 0],
    [5, 3],
    [-4, 4],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, 3.4 * s, 0, TAU);
    ctx.fill();
  }
}

/** the number on a door: big, white, with a dark rim, readable from the back of the classroom */
export function doorNumber(ctx: Ctx, day: number, x: number, y: number, size: number): void {
  ctx.save();
  ctx.font = `700 ${Math.round(size)}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.16);
  ctx.strokeStyle = 'rgba(40,20,30,0.85)';
  ctx.strokeText(String(day), x, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(day), x, y);
  ctx.restore();
}

/** a closed door panel (back: the inside of the panel when it swings open, without number) */
export function drawDoorFace(ctx: Ctx, day: number, r: Rect, back = false): void {
  const shape = shapeOf(day);
  const p = doorPath(shape, r);
  const col = doorColor(day);
  const s = Math.min(r.w, r.h) / 100;
  ctx.save();
  ctx.fillStyle = back ? shade(col, -0.35) : col;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  // soft light from the top left, a lighter inner rim
  const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
  g.addColorStop(0, 'rgba(255,255,255,0.28)');
  g.addColorStop(0.6, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.15)');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = back ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 12 * s;
  ctx.stroke(p);
  if (!back) {
    ctx.strokeStyle = 'rgba(40,20,30,0.25)';
    ctx.lineWidth = 2.5 * s;
    if (shape === 'shutter') {
      // two shutter halves with slats
      ctx.beginPath();
      ctx.moveTo(r.x + r.w / 2, r.y);
      ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      for (let yy = r.y + 14 * s; yy < r.y + r.h - 6 * s; yy += 13 * s) {
        ctx.moveTo(r.x + 8 * s, yy);
        ctx.lineTo(r.x + r.w / 2 - 6 * s, yy);
        ctx.moveTo(r.x + r.w / 2 + 6 * s, yy);
        ctx.lineTo(r.x + r.w - 8 * s, yy);
      }
      ctx.stroke();
    } else if (shape === 'cellar' || shape === 'door') {
      ctx.beginPath();
      for (let k = 1; k < 4; k++) {
        const xx = r.x + (r.w * k) / 4;
        ctx.moveTo(xx, r.y);
        ctx.lineTo(xx, r.y + r.h);
      }
      ctx.stroke();
    } else if (shape === 'mailbox') {
      ctx.fillStyle = 'rgba(40,20,30,0.55)';
      ctx.fillRect(r.x + r.w * 0.2, r.y + r.h * 0.78, r.w * 0.6, 6 * s);
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(45,25,30,0.9)';
  ctx.lineWidth = 3.5 * s;
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.restore();
  if (back) return;
  // decoration and number
  const cx = r.x + r.w / 2;
  let ny = r.y + r.h / 2;
  let size = Math.min(r.w, r.h) * 0.5;
  if (shape === 'door') {
    // a wreath on the front door, the number below it
    ctx.save();
    ctx.strokeStyle = '#1f7a3a';
    ctx.lineWidth = 9 * s * 0.75;
    ctx.beginPath();
    ctx.arc(cx, r.y + r.h * 0.3, r.w * 0.2, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r.w * 0.2, r.y + r.h * 0.3 + Math.sin(a) * r.w * 0.2, 3.5 * s, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#e5283b';
    ctx.beginPath();
    ctx.moveTo(cx, r.y + r.h * 0.3 + r.w * 0.2);
    ctx.lineTo(cx - 10 * s, r.y + r.h * 0.3 + r.w * 0.2 + 14 * s);
    ctx.lineTo(cx + 10 * s, r.y + r.h * 0.3 + r.w * 0.2 + 14 * s);
    ctx.fill();
    ctx.restore();
    // door knob
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(r.x + r.w * 0.82, r.y + r.h * 0.6, 5 * s, 0, TAU);
    ctx.fill();
    ny = r.y + r.h * 0.66;
    size = r.w * 0.42;
  } else if (shape === 'star') {
    size *= 0.85;
    ny += r.h * 0.06;
  } else if (shape === 'diamond') size *= 0.9;
  else if (shape === 'arch' || shape === 'dormer' || shape === 'mailbox') ny += r.h * 0.08;
  else if (shape === 'cellar') size = r.h * 0.7;
  if (shape === 'rect' || shape === 'arch' || shape === 'erker' || shape === 'oval') holly(ctx, r.x + r.w * 0.78, r.y + r.h * 0.2, s);
  doorNumber(ctx, day, cx, ny, size);
}

/**
 * an open (or opening) door: the warm inside with whatever is drawn in it, and the panel swung to the left.
 * swing 0 closed .. 1 wide open
 */
export function drawDoorOpen(ctx: Ctx, day: number, r: Rect, swing: number, inside: (ctx: Ctx) => void): void {
  const p = doorPath(shapeOf(day), r);
  ctx.save();
  ctx.save();
  ctx.clip(p);
  const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h * 0.55, 4, r.x + r.w / 2, r.y + r.h * 0.55, Math.max(r.w, r.h) * 0.7);
  g.addColorStop(0, '#fff3c4');
  g.addColorStop(0.6, '#ffc861');
  g.addColorStop(1, '#c9762e');
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  inside(ctx);
  ctx.strokeStyle = 'rgba(80,40,10,0.45)';
  ctx.lineWidth = Math.min(r.w, r.h) * 0.1;
  ctx.stroke(p);
  ctx.restore();
  ctx.strokeStyle = 'rgba(45,25,30,0.9)';
  ctx.lineWidth = 3;
  ctx.stroke(p);
  ctx.restore();
  // the panel on its hinge (left edge): seen from the front first, then from the back
  const a = swing * 1.95;
  const sx = Math.cos(a);
  ctx.save();
  ctx.translate(r.x, 0);
  ctx.scale(sx, 1);
  ctx.translate(-r.x, 0);
  drawDoorFace(ctx, day, r, sx < 0);
  ctx.restore();
  // the small number stays readable on the open door
  if (swing > 0.5) {
    const s = Math.min(r.w, r.h);
    const x = r.x + r.w - s * 0.16;
    const y = r.y + s * 0.16;
    ctx.save();
    ctx.globalAlpha = clamp((swing - 0.5) * 3);
    ctx.fillStyle = doorColor(day);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.15, 0, TAU);
    ctx.fill();
    ctx.stroke();
    doorNumber(ctx, day, x, y + 1, s * 0.18);
    ctx.restore();
  }
}

// ------------------------------------------------------------------------------------------- the house

const ROOF_L = { x: -60, y: 352 };
const ROOF_A = { x: 575, y: 52 };
const ROOF_R = { x: 1210, y: 352 };

/** the fairy lights along the roof edges (world coordinates) */
export function roofLights(W: number): { x: number; y: number; hue: number }[] {
  const out: { x: number; y: number; hue: number }[] = [];
  const hues = [0, 45, 125, 200, 300];
  const n = 11;
  let i = 0;
  for (const [a, b] of [
    [ROOF_L, ROOF_A],
    [ROOF_A, ROOF_R],
  ]) {
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      const lx = lerp(a.x, b.x, f);
      const ly = lerp(a.y, b.y, f) + 40 + Math.sin(f * Math.PI * n) * 5;
      out.push({ ...map(W, lx, ly), hue: hues[i++ % hues.length] });
    }
  }
  return out;
}

function paintHouse(ctx: Ctx, W: number): void {
  const k = houseK(W);
  ctx.save();
  ctx.translate(houseX0(W), BASE_Y - LB * k);
  ctx.scale(k, k);
  // shadow on the snow
  ctx.fillStyle = 'rgba(90,100,170,0.22)';
  ctx.beginPath();
  ctx.ellipse(575, 805, 700, 40, 0, 0, TAU);
  ctx.fill();
  // warm glow of the house
  const glow = ctx.createRadialGradient(575, 500, 200, 575, 500, 900);
  glow.addColorStop(0, 'rgba(255,200,120,0.25)');
  glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-400, -100, 1950, 1000);
  // walls (cream with timber beams)
  const wall = ctx.createLinearGradient(0, 340, 0, 800);
  wall.addColorStop(0, '#f6e6c4');
  wall.addColorStop(1, '#e9cfa0');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 330, LW, 470);
  ctx.strokeStyle = '#7a4a2a';
  ctx.lineCap = 'butt';
  ctx.lineWidth = 14;
  ctx.beginPath();
  for (const y of [337, 480, 622, 793]) {
    ctx.moveTo(0, y);
    ctx.lineTo(LW, y);
  }
  for (const x of [7, LW - 7]) {
    ctx.moveTo(x, 330);
    ctx.lineTo(x, 800);
  }
  for (const x of [195, 375, 575, 775, 955]) {
    ctx.moveTo(x, 337);
    ctx.lineTo(x, 480);
    if (x !== 195 && x !== 375) {
      ctx.moveTo(x, 480);
      ctx.lineTo(x, 622);
    }
  }
  for (const x of [172, 322, 672, 825, 955]) {
    ctx.moveTo(x, 622);
    ctx.lineTo(x, 793);
  }
  // diagonal braces at the corners
  ctx.moveTo(7, 480);
  ctx.lineTo(45, 395);
  ctx.moveTo(LW - 7, 480);
  ctx.lineTo(LW - 45, 395);
  ctx.moveTo(575, 480);
  ctx.lineTo(545, 600);
  ctx.moveTo(575, 480);
  ctx.lineTo(605, 600);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,35,20,0.6)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 330, LW, 470);
  // roof
  ctx.fillStyle = '#a8343a';
  ctx.beginPath();
  ctx.moveTo(ROOF_L.x, ROOF_L.y);
  ctx.lineTo(ROOF_A.x, ROOF_A.y);
  ctx.lineTo(ROOF_R.x, ROOF_R.y);
  ctx.closePath();
  ctx.fill();
  // roof tiles
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,15,20,0.35)';
  ctx.lineWidth = 3;
  for (let y = 80; y < 360; y += 28) {
    ctx.beginPath();
    for (let x = -60; x < 1220; x += 40) ctx.arc(x + 20 + ((y / 28) % 2) * 20, y, 20, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#5e1b20';
  ctx.lineWidth = 5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(ROOF_L.x, ROOF_L.y);
  ctx.lineTo(ROOF_A.x, ROOF_A.y);
  ctx.lineTo(ROOF_R.x, ROOF_R.y);
  ctx.stroke();
  // gable: a round window in a wooden frame (slot 1 sits on it)
  // chimney
  const roofY = (x: number) => lerp(ROOF_A.y, ROOF_L.y, (ROOF_A.x - x) / (ROOF_A.x - ROOF_L.x));
  ctx.fillStyle = '#9a4b3c';
  ctx.strokeStyle = '#4f2219';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(70, 112);
  ctx.lineTo(190, 112);
  ctx.lineTo(190, roofY(190) + 14);
  ctx.lineTo(70, roofY(70) + 14);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(60,20,15,0.35)';
  ctx.lineWidth = 2.5;
  for (let y = 124, row = 0; y < 300; y += 18, row++) {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(190, y);
    for (let x = 70 + (row % 2) * 20; x < 190; x += 40) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 18);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.stroke();
  ctx.fillStyle = '#6e3328';
  ctx.fillRect(60, 98, 140, 18);
  ctx.strokeRect(60, 98, 140, 18);
  // snow on the roof: a thick white blanket with a wavy lower edge, icicles at the eaves
  ctx.fillStyle = '#f7faff';
  ctx.beginPath();
  ctx.moveTo(ROOF_L.x - 12, ROOF_L.y + 4);
  ctx.lineTo(ROOF_A.x, ROOF_A.y - 14);
  ctx.lineTo(ROOF_R.x + 12, ROOF_R.y + 4);
  const steps = 16;
  for (let i = steps; i >= 0; i--) {
    const f = i / steps;
    const x = lerp(ROOF_A.x, ROOF_R.x + 12, f);
    const y = lerp(ROOF_A.y + 30, ROOF_R.y + 18, f) + (i % 2 ? 14 : 0);
    ctx.lineTo(x, y);
  }
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const x = lerp(ROOF_A.x, ROOF_L.x - 12, f);
    const y = lerp(ROOF_A.y + 30, ROOF_L.y + 18, f) + (i % 2 ? 14 : 0);
    ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(130,150,200,0.7)';
  ctx.lineWidth = 3;
  ctx.stroke();
  // snow cap on the chimney
  ctx.fillStyle = '#f7faff';
  ctx.beginPath();
  ctx.ellipse(130, 98, 76, 14, 0, Math.PI, TAU);
  ctx.fill();
  // eaves with icicles
  ctx.fillStyle = '#e8f2ff';
  for (const [x0, x1] of [
    [-50, 160],
    [990, 1200],
  ]) {
    for (let x = x0; x < x1; x += 22) {
      const len = 12 + ((x * 37) % 23);
      ctx.beginPath();
      ctx.moveTo(x, 360);
      ctx.lineTo(x + 6, 360 + len);
      ctx.lineTo(x + 12, 360);
      ctx.fill();
    }
  }
  // fairy light wire along the roof
  ctx.strokeStyle = 'rgba(40,60,40,0.8)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (const [a, b] of [
    [ROOF_L, ROOF_A],
    [ROOF_A, ROOF_R],
  ])
    for (let k2 = 0; k2 <= 44; k2++) {
      const f = k2 / 44;
      ctx.lineTo(lerp(a.x, b.x, f), lerp(a.y, b.y, f) + 36 + Math.sin(f * Math.PI * 11) * 6);
    }
  ctx.stroke();
  // the star on top of the roof (lit later)
  ctx.fillStyle = '#e7c35a';
  ctx.strokeStyle = '#9a7420';
  ctx.lineWidth = 4;
  const sp = makePath();
  star5(sp, 575, 22, 40, 0.45);
  ctx.fill(sp);
  ctx.stroke(sp);
  // a wreath with a bow on the empty bit of wall
  ctx.strokeStyle = '#1f7a3a';
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(1052, 682, 34, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#e5283b';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    ctx.beginPath();
    ctx.arc(1052 + Math.cos(a) * 34, 682 + Math.sin(a) * 34, 5, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(1052, 716);
  ctx.lineTo(1030, 700);
  ctx.lineTo(1030, 732);
  ctx.closePath();
  ctx.moveTo(1052, 716);
  ctx.lineTo(1074, 700);
  ctx.lineTo(1074, 732);
  ctx.closePath();
  ctx.fill();
  // surroundings of the doors: frames, sills, dormers, the bay window, the front step
  for (const s of SLOTS) if (STRUCTURE.includes(s.shape)) frame(ctx, s);
  for (const s of SLOTS) if (!STRUCTURE.includes(s.shape)) frame(ctx, s);
  ctx.restore();
}

/** what is around a door: window frames and sills, a dormer, a bay window, the front door with step and lantern */
function frame(ctx: Ctx, s: Slot): void {
  const p = doorPath(s.shape, s);
  if (s.shape === 'dormer') {
    ctx.fillStyle = '#f2dfba';
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 4;
    ctx.fillRect(s.x - 16, s.y - 6, s.w + 32, s.h + 18);
    ctx.strokeRect(s.x - 16, s.y - 6, s.w + 32, s.h + 18);
    ctx.fillStyle = '#a8343a';
    ctx.beginPath();
    ctx.moveTo(s.x - 34, s.y + 4);
    ctx.lineTo(s.x + s.w / 2, s.y - 58);
    ctx.lineTo(s.x + s.w + 34, s.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5e1b20';
    ctx.stroke();
    ctx.fillStyle = '#f7faff';
    ctx.beginPath();
    ctx.moveTo(s.x - 40, s.y + 6);
    ctx.lineTo(s.x + s.w / 2, s.y - 66);
    ctx.lineTo(s.x + s.w + 40, s.y + 6);
    ctx.lineTo(s.x + s.w + 20, s.y + 10);
    ctx.lineTo(s.x + s.w / 2, s.y - 44);
    ctx.lineTo(s.x - 20, s.y + 10);
    ctx.closePath();
    ctx.fill();
  }
  if (s.shape === 'erker') {
    const x0 = s.x - 22;
    const x1 = s.x + s.w + 22;
    ctx.fillStyle = '#f2dfba';
    ctx.strokeStyle = '#7a4a2a';
    ctx.lineWidth = 5;
    ctx.fillRect(x0, s.y - 12, x1 - x0, s.h + 26);
    ctx.strokeRect(x0, s.y - 12, x1 - x0, s.h + 26);
    // little roof with snow
    ctx.fillStyle = '#a8343a';
    ctx.beginPath();
    ctx.moveTo(x0 - 14, s.y - 14);
    ctx.lineTo(x0 + 14, s.y - 30);
    ctx.lineTo(x1 - 14, s.y - 30);
    ctx.lineTo(x1 + 14, s.y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5e1b20';
    ctx.stroke();
    ctx.fillStyle = '#f7faff';
    ctx.beginPath();
    ctx.roundRect(x0 + 6, s.y - 38, x1 - x0 - 12, 14, 7);
    ctx.fill();
    // corbel underneath
    ctx.fillStyle = '#8a5a35';
    ctx.beginPath();
    ctx.moveTo(x0, s.y + s.h + 14);
    ctx.lineTo(x1, s.y + s.h + 14);
    ctx.lineTo(s.x + s.w / 2, s.y + s.h + 34);
    ctx.closePath();
    ctx.fill();
  }
  if (s.shape === 'door') {
    ctx.fillStyle = '#b9b3c4';
    ctx.strokeStyle = '#5d5670';
    ctx.lineWidth = 4;
    const f = doorPath('door', { x: s.x - 18, y: s.y - 18, w: s.w + 36, h: s.h + 18 });
    ctx.fill(f);
    ctx.stroke(f);
    ctx.fillStyle = '#a7a1b5';
    ctx.fillRect(s.x - 34, 796, s.w + 68, 16);
    ctx.strokeRect(s.x - 34, 796, s.w + 68, 16);
    // lantern
    const lx = s.x + s.w + 44;
    ctx.fillStyle = '#2d2a38';
    ctx.fillRect(lx - 3, 640, 6, 20);
    const lg = ctx.createRadialGradient(lx, 680, 4, lx, 680, 60);
    lg.addColorStop(0, 'rgba(255,220,130,0.8)');
    lg.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(lx - 60, 620, 120, 120);
    ctx.fillStyle = '#ffd56b';
    ctx.strokeStyle = '#2d2a38';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(lx - 14, 660, 28, 38, 5);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (s.shape === 'chimney' || s.shape === 'mailbox') {
    ctx.save();
    ctx.lineWidth = 8;
    ctx.strokeStyle = s.shape === 'chimney' ? '#4f2219' : '#7a4a2a';
    ctx.stroke(p);
    ctx.restore();
    return;
  }
  if (s.shape === 'cellar') {
    ctx.fillStyle = '#9e98ac';
    ctx.beginPath();
    ctx.roundRect(s.x - 10, s.y - 10, s.w + 20, s.h + 12, [s.h * 0.6, s.h * 0.6, 2, 2]);
    ctx.fill();
    return;
  }
  // window frame and sill
  ctx.save();
  ctx.lineWidth = 16;
  ctx.strokeStyle = '#fbf6ea';
  ctx.lineJoin = 'round';
  ctx.stroke(p);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(90,60,40,0.7)';
  ctx.stroke(p);
  if (s.shape !== 'round' && s.shape !== 'star' && s.shape !== 'diamond' && s.shape !== 'oval') {
    ctx.fillStyle = '#fbf6ea';
    ctx.fillRect(s.x - 14, s.y + s.h + 4, s.w + 28, 12);
    ctx.strokeRect(s.x - 14, s.y + s.h + 4, s.w + 28, 12);
    ctx.fillStyle = '#f7faff';
    ctx.beginPath();
    ctx.ellipse(s.x + s.w / 2, s.y + s.h + 4, s.w / 2 + 12, 7, 0, Math.PI, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function pine(ctx: Ctx, x: number, base: number, s: number, col = '#2d4470'): void {
  for (let i = 0; i < 4; i++) {
    const w = (60 - i * 12) * s;
    const y = base - i * 40 * s;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x, y - 74 * s);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(240,246,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - 36 * s);
    ctx.lineTo(x, y - 74 * s);
    ctx.lineTo(x + w * 0.5, y - 36 * s);
    ctx.quadraticCurveTo(x, y - 46 * s, x - w * 0.5, y - 36 * s);
    ctx.fill();
  }
  ctx.fillStyle = '#4a3324';
  ctx.fillRect(x - 7 * s, base, 14 * s, 18 * s);
}

/** the whole background: evening sky, snowy hills, the house with its doors closed, snow in front */
export function paintAdvent(ctx: Ctx, W: number, H: number): void {
  const r = mulberry32(2412);
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#141d55');
  sky.addColorStop(0.5, '#3a3c8c');
  sky.addColorStop(0.82, '#9c6aa6');
  sky.addColorStop(1, '#f0a58e');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON + 2);
  for (let i = 0; i < Math.round(W / 10); i++) {
    ctx.fillStyle = `rgba(255,255,240,${0.25 + r() * 0.6})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * (HORIZON - 220), 0.6 + r() * 1.5, 0, TAU);
    ctx.fill();
  }
  // moon (top right)
  const mx = W - 120;
  const mg = ctx.createRadialGradient(mx, 120, 30, mx, 120, 190);
  mg.addColorStop(0, 'rgba(255,248,210,0.45)');
  mg.addColorStop(1, 'rgba(255,248,210,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(mx - 190, 0, 380, 320);
  ctx.fillStyle = '#fff6d6';
  ctx.beginPath();
  ctx.arc(mx, 120, 48, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,205,160,0.5)';
  for (const [ox, oy, rr] of [
    [-14, -8, 10],
    [12, 12, 7],
    [10, -20, 5],
  ]) {
    ctx.beginPath();
    ctx.arc(mx + ox, 120 + oy, rr, 0, TAU);
    ctx.fill();
  }
  // hills with small pines
  ctx.fillStyle = '#a3a6d8';
  ctx.beginPath();
  ctx.moveTo(0, HORIZON);
  for (let x = 0; x <= W + 60; x += 60) ctx.lineTo(x, HORIZON - 80 - Math.sin(x * 0.003 + 2) * 45 - Math.sin(x * 0.011) * 14);
  ctx.lineTo(W, HORIZON);
  ctx.fill();
  for (let i = 0; i < Math.round(W / 70); i++) {
    const x = r() * W;
    pine(ctx, x, HORIZON - 40 - Math.sin(x * 0.003 + 2) * 30 + r() * 20, 0.3 + r() * 0.2, '#3a4a80');
  }
  ctx.fillStyle = '#cdd4f0';
  ctx.beginPath();
  ctx.moveTo(0, HORIZON + 10);
  for (let x = 0; x <= W + 60; x += 60) ctx.lineTo(x, HORIZON - 26 - Math.sin(x * 0.006 + 1) * 16);
  ctx.lineTo(W, HORIZON + 10);
  ctx.fill();
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#e3e9f8');
  ground.addColorStop(1, '#b9c5ea');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  // big pines at both sides
  const x0 = houseX0(W);
  const x1 = x0 + LW * houseK(W);
  pine(ctx, 60, 820, 1.25, '#2a5a48');
  pine(ctx, x0 - 330 > 140 ? x0 - 330 : -40, 760, 0.9, '#2f6a52');
  if (W - x1 > 90) pine(ctx, Math.max(x1 + 110, W - 80), 830, 1.3, '#2a5a48');
  paintHouse(ctx, W);
  // a path from the front door
  const d = doorRect(W, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.moveTo(d.x - 10, BASE_Y + 8);
  ctx.lineTo(d.x + d.w + 10, BASE_Y + 8);
  ctx.lineTo(d.x + d.w + 140, H);
  ctx.lineTo(d.x - 140, H);
  ctx.closePath();
  ctx.fill();
  // drifts
  for (let i = 0; i < Math.round(W / 150); i++) {
    const dx = r() * W;
    const dy = BASE_Y + 50 + r() * (H - BASE_Y - 50);
    const rw = 90 + r() * 140;
    ctx.fillStyle = 'rgba(150,165,220,0.22)';
    ctx.beginPath();
    ctx.ellipse(dx + 12, dy + 8, rw, rw * 0.15, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(250,252,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(dx, dy, rw, rw * 0.14, 0, 0, TAU);
    ctx.fill();
  }
  for (let i = 0; i < Math.round(W / 8); i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`;
    ctx.fillRect(r() * W, HORIZON + 20 + r() * (H - HORIZON - 20), 2, 2);
  }
  // all doors closed
  for (let day = 1; day <= 24; day++) drawDoorFace(ctx, day, doorRect(W, day));
}

/** the roof star: glowing when lit */
export function drawRoofStar(ctx: Ctx, W: number, t: number, lit: number): void {
  if (lit <= 0) return;
  const s = roofStar(W);
  const pulse = 0.8 + 0.2 * Math.sin(t * 3);
  ctx.save();
  ctx.globalAlpha = lit;
  const g = ctx.createRadialGradient(s.x, s.y, s.r * 0.3, s.x, s.y, s.r * 4);
  g.addColorStop(0, `rgba(255,240,150,${0.8 * pulse})`);
  g.addColorStop(1, 'rgba(255,240,150,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(s.x, s.y, s.r * 4, 0, TAU);
  ctx.fill();
  const p = makePath();
  star5(p, s.x, s.y, s.r * (1 + 0.08 * Math.sin(t * 5)), 0.45);
  ctx.fillStyle = '#ffe04a';
  ctx.strokeStyle = '#c4901a';
  ctx.lineWidth = 4;
  ctx.fill(p);
  ctx.stroke(p);
  for (let i = 0; i < 4; i++) {
    const a = t * 1.5 + (i / 4) * TAU;
    sparkleStar(ctx, s.x + Math.cos(a) * s.r * 1.8, s.y + Math.sin(a) * s.r * 1.4, s.r * 0.35);
  }
  ctx.restore();
}

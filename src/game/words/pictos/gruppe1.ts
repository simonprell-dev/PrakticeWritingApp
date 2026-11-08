// Pictures of the Wörter-Zoo, group 1: Oma, Eis, Esel, Sofa, Mond, Tor, Dino, Hund, Ampel, Tiger, Burg, Gras,
// Gurke, Pilz, Apfel, Katze, Frosch, Ball, Pinguin, Schuh, Ziege. Each is drawn around (0, 0) in a square of about
// 300 px: still while the class writes, then a funny moment fitting what it says, then a calm loop (see picto.ts).
import { crown } from '../../creatures/parts.ts';
import { clamp, ease, TAU } from '../../math.ts';
import type { Ctx2D, Picto } from '../picto.ts';

type C = Ctx2D;
type Fill = string | CanvasGradient;
const OL = '#3a2838';
const PI = Math.PI;

// ---------------------------------------------------------------- timing

interface Phase {
  /** playing the funny animation */
  on: boolean;
  /** seconds into the funny animation (0 otherwise) */
  s: number;
  /** after the funny animation: resting in the zoo */
  resting: boolean;
  /** seconds of rest */
  rest: number;
  /** 0..1, eyes closing for a blink while resting */
  blink: number;
  /** -1..1, slow breathing while resting */
  breathe: number;
}

function ph(t: number, alive: boolean, anim: number): Phase {
  const on = alive && t < anim;
  const resting = alive && !on;
  const rest = resting ? t - anim : 0;
  const k = rest % 3.4;
  const blink = resting && k > 2.6 && k < 2.85 ? Math.sin(((k - 2.6) / 0.25) * PI) : 0;
  return { on, s: on ? t : 0, resting, rest, blink, breathe: resting ? Math.sin(rest * 2.2) : 0 };
}
const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
const bump = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin(((x - a) / (b - a)) * PI));
/** a hop: 0 on the ground, 1 at the top, between a and b */
const hop = (x: number, a: number, b: number) => {
  const u = ramp(x, a, b);
  return u <= 0 || u >= 1 ? 0 : 4 * u * (1 - u);
};

// ---------------------------------------------------------------- drawing helpers

/** fill the current path and give it the thick dark outline */
function ink(ctx: C, fill: Fill, lw = 6): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) line(ctx, OL, lw);
}
function line(ctx: C, color: string, lw: number): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}
/** round shading: light from the top left */
function shade(ctx: C, x: number, y: number, r: number, light: string, base: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.15);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, dark);
  return g;
}
function lin(ctx: C, x0: number, y0: number, x1: number, y1: number, a: string, b: string): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
}
function ell(ctx: C, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}
function rr(ctx: C, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function shine(ctx: C, x: number, y: number, rx: number, ry: number, rot = -0.5, a = 0.55): void {
  ell(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}
function cheek(ctx: C, x: number, y: number, r: number, a = 0.45): void {
  ell(ctx, x, y, r, r * 0.62);
  ctx.fillStyle = `rgba(255,105,140,${a})`;
  ctx.fill();
}
/** big friendly eye; shut 0..1 closes it (from 0.8 on it is a closed line) */
function eye(ctx: C, x: number, y: number, r: number, lx = 0, ly = 0, shut = 0): void {
  ctx.save();
  if (shut >= 0.8) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.5, r * 0.85, 0.2 * PI, 0.8 * PI);
    line(ctx, OL, Math.max(3, r * 0.28));
    ctx.restore();
    return;
  }
  ell(ctx, x, y, r, r * (1 - shut));
  ctx.fillStyle = '#fff';
  ctx.fill();
  line(ctx, OL, Math.max(2.5, r * 0.17));
  ctx.clip();
  const px = x + lx * r * 0.38;
  const py = y + ly * r * 0.38;
  const pr = r * 0.6;
  ell(ctx, px, py, pr, pr);
  ctx.fillStyle = '#2a1d33';
  ctx.fill();
  ell(ctx, px - pr * 0.35, py - pr * 0.38, pr * 0.36, pr * 0.36);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ell(ctx, px + pr * 0.32, py + pr * 0.32, pr * 0.15, pr * 0.15);
  ctx.fill();
  ctx.restore();
}
/** happy closed eye: ^ */
function happyEye(ctx: C, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y + r * 0.45, r * 0.8, 1.2 * PI, 1.8 * PI);
  line(ctx, OL, Math.max(3, r * 0.3));
}
function smile(ctx: C, x: number, y: number, w: number, lw = 5): void {
  ctx.beginPath();
  ctx.arc(x, y - w * 0.5, w * 0.7, 0.25 * PI, 0.75 * PI);
  line(ctx, OL, lw);
}
function openMouth(ctx: C, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ell(ctx, x, y, w, h);
  ink(ctx, '#7a2340', 4);
  ctx.clip();
  ell(ctx, x, y + h * 0.8, w * 0.7, h * 0.55);
  ctx.fillStyle = '#ff8fa8';
  ctx.fill();
  ctx.restore();
}
function heart(ctx: C, x: number, y: number, s: number, col = '#ff5c8a', a = 1): void {
  if (a <= 0.02 || s <= 0.5) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s / 16, s / 16);
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.bezierCurveTo(-18, -2, -10, -18, 0, -8);
  ctx.bezierCurveTo(10, -18, 18, -2, 0, 10);
  ctx.closePath();
  ink(ctx, col, 3);
  ctx.restore();
}
function sparkle(ctx: C, x: number, y: number, r: number, col = '#fff3a0', a = 1): void {
  if (a <= 0.02 || r <= 0.5) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const an = (i / 8) * TAU - PI / 2;
    const q = i % 2 ? r * 0.32 : r;
    ctx.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q);
  }
  ctx.closePath();
  ink(ctx, col, 2.5);
  ctx.restore();
}
function star(ctx: C, x: number, y: number, r: number, col: string, rot = 0): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const an = (i / 10) * TAU - PI / 2 + rot;
    const q = i % 2 ? r * 0.48 : r;
    ctx.lineTo(x + Math.cos(an) * q, y + Math.sin(an) * q);
  }
  ctx.closePath();
  ink(ctx, col, 4);
}
/** sound waves: arcs around a direction */
function soundArcs(ctx: C, x: number, y: number, dir: number, k: number, n = 3, gap = 13): void {
  if (k <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, k);
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.arc(x, y, gap * (i + 1), dir - 0.55, dir + 0.55);
    line(ctx, OL, 4.5);
  }
  ctx.restore();
}
function drop(ctx: C, x: number, y: number, s: number, col = '#8fd8ff', a = 1): void {
  if (a <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(s / 10, s / 10);
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(8, -2, 7, 4);
  ctx.arc(0, 4, 7, 0, PI);
  ctx.quadraticCurveTo(-8, -2, 0, -12);
  ctx.closePath();
  ink(ctx, col, 2.5);
  ctx.restore();
}
/** stroke with a dark rim: a thick round "tube" (tails, horns) */
function tube(ctx: C, color: string, w: number): void {
  line(ctx, OL, w + 10);
  line(ctx, color, w);
}
/** scale around a point */
function scaleAt(ctx: C, x: number, y: number, sx: number, sy: number): void {
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  ctx.translate(-x, -y);
}
function rotAt(ctx: C, x: number, y: number, a: number): void {
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.translate(-x, -y);
}

// ---------------------------------------------------------------- the pictures

const Oma: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const talk = f.on ? bump(s, 0.15, 3.4) : 0;
    const lift = f.on ? ease.outBack(ramp(s, 0.1, 0.6)) * (1 - ease.inOutCubic(ramp(s, 2.9, 3.5))) : 0;
    const tilt = f.on ? Math.sin(s * 3.4) * 0.11 * talk : f.breathe * 0.02;
    const skin = '#ffd6b8';
    const hair = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#ffffff', '#dcdce8', '#a8a8bc');
    ctx.save();
    ctx.translate(0, f.breathe * 1.5);
    rr(ctx, -20, 20, 40, 45, 10);
    ink(ctx, '#f6c3a2', 5);
    // cardigan with a white collar and pearls
    ctx.beginPath();
    ctx.moveTo(-122, 148);
    ctx.bezierCurveTo(-126, 82, -92, 56, -36, 54);
    ctx.lineTo(36, 54);
    ctx.bezierCurveTo(92, 56, 126, 82, 122, 148);
    ctx.closePath();
    ink(ctx, shade(ctx, 0, 100, 120, '#c9a2e6', '#9c6ac6', '#6e4198'));
    ctx.beginPath();
    ctx.moveTo(-30, 54);
    ctx.lineTo(0, 98);
    ctx.lineTo(30, 54);
    ctx.closePath();
    ink(ctx, '#fff6fb', 4);
    for (let i = -4; i <= 4; i++) {
      ell(ctx, i * 8.5, 61 + (16 - i * i) * 1.2, 5, 5);
      ink(ctx, '#ffffff', 2);
    }
    // head
    ctx.save();
    rotAt(ctx, 0, 40, tilt);
    ell(ctx, 0, -116, 30, 24);
    ink(ctx, hair(0, -116, 30));
    ell(ctx, 0, -32, 80, 76);
    ink(ctx, hair(0, -32, 80));
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 62, -4, 12, 16);
      ink(ctx, skin, 5);
      ell(ctx, sx * 64, 14, 5, 5);
      ink(ctx, '#ffffff', 2);
    }
    ell(ctx, 0, -8, 60, 64);
    ink(ctx, shade(ctx, 0, -8, 62, '#ffeadb', skin, '#efb18c'));
    for (let i = -2; i <= 2; i++) {
      ell(ctx, i * 23, -64 + Math.abs(i) * 6, 17, 14);
      ink(ctx, hair(i * 23, -64, 17), 4);
    }
    for (const sx of [-1, 1]) {
      if (talk > 0.3) happyEye(ctx, sx * 26, -12, 10);
      else eye(ctx, sx * 26, -12, 10, 0, 0.1, f.blink);
      ctx.beginPath();
      ctx.arc(sx * 26, -12, 20, 0, TAU);
      ctx.fillStyle = 'rgba(220,240,255,0.25)';
      ctx.fill();
      line(ctx, '#8a5a2b', 4);
    }
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.quadraticCurveTo(0, -20, 6, -14);
    ctx.moveTo(-46, -14);
    ctx.lineTo(-58, -8);
    ctx.moveTo(46, -14);
    ctx.lineTo(58, -8);
    line(ctx, '#8a5a2b', 4);
    ell(ctx, 0, 7, 8, 7);
    ink(ctx, '#f7bf9b', 3);
    cheek(ctx, -40, 14, 12);
    cheek(ctx, 40, 14, 12);
    if (talk > 0.05) openMouth(ctx, 0, 31, 14, 5 + 7 * Math.abs(Math.sin(s * 8)) * talk);
    else smile(ctx, 0, 27, 28);
    ctx.restore();
    // a plate with cookies held up
    const py = 114 - 28 * lift;
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 98, (py + 140) / 2 + 6, 26, (140 - py) / 2 + 14, sx * 0.2);
      ink(ctx, '#8d5db8');
    }
    ell(ctx, 0, py, 96, 22);
    ink(ctx, '#f7f5ff', 5);
    ell(ctx, 0, py - 2, 72, 14);
    line(ctx, 'rgba(120,110,160,0.35)', 3);
    const cookie = (x: number, y: number) => {
      ell(ctx, x, y, 25, 13);
      ink(ctx, shade(ctx, x, y, 25, '#f0c27e', '#dca05a', '#b97a35'), 4);
      for (const [cx, cy] of [
        [-9, -3],
        [6, -5],
        [2, 4],
        [12, 2],
      ]) {
        ell(ctx, x + cx, y + cy, 3.2, 2.4);
        ctx.fillStyle = '#5a3418';
        ctx.fill();
      }
    };
    const jump = (i: number) => (f.on ? 26 * (hop(s, 0.7 + i * 0.25, 1.15 + i * 0.25) + hop(s, 1.8 + i * 0.25, 2.25 + i * 0.25)) : 0);
    cookie(-40, py - 10 - jump(0));
    cookie(40, py - 10 - jump(2));
    cookie(0, py - 20 - jump(1));
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 94, py + 4, 17, 15);
      ink(ctx, skin, 5);
    }
    for (let i = 0; i < 2; i++) {
      const k = f.on ? ramp(s, 0.9 + i * 0.9, 2.5 + i * 0.9) : 0;
      if (k > 0 && k < 1) heart(ctx, i ? -104 : 104, 10 - k * 120, 15, '#ff5c8a', bump(k, 0, 1));
    }
    ctx.restore();
  },
};

const Eis: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const melt = f.on ? ease.outCubic(ramp(s, 0.3, 2.8)) : f.resting ? 1 : 0;
    const shock = f.on ? bump(s, 0.7, 3.3) : 0;
    ctx.save();
    ctx.translate(shock * Math.sin(s * 45) * 3, 0);
    const cone = () => {
      ctx.beginPath();
      ctx.moveTo(-62, 8);
      ctx.lineTo(62, 8);
      ctx.lineTo(5, 144);
      ctx.quadraticCurveTo(0, 152, -5, 144);
      ctx.closePath();
    };
    cone();
    ink(ctx, lin(ctx, -60, 0, 60, 0, '#f6c886', '#d58c3c'));
    ctx.save();
    cone();
    ctx.clip();
    ctx.beginPath();
    for (let k = -6; k <= 6; k++) {
      ctx.moveTo(k * 22 - 80, 0);
      ctx.lineTo(k * 22 + 80, 160);
      ctx.moveTo(k * 22 + 80, 0);
      ctx.lineTo(k * 22 - 80, 160);
    }
    line(ctx, 'rgba(150,85,30,0.55)', 3);
    ctx.restore();
    cone();
    line(ctx, OL, 6);
    // strawberry scoop that melts a little
    const R = 76;
    const cy = -40 + melt * 9;
    const pink = '#ff9cc6';
    if (melt > 0)
      for (const [dx, len, w] of [
        [-40, 34, 8],
        [6, 66, 9],
        [42, 42, 7],
      ]) {
        const L = len * melt;
        ctx.beginPath();
        ctx.moveTo(dx - w, 0);
        ctx.lineTo(dx - w, 14 + L);
        ctx.arc(dx, 14 + L, w, PI, 0, true);
        ctx.lineTo(dx + w, 0);
        ctx.closePath();
        ink(ctx, pink, 5);
        shine(ctx, dx - w * 0.35, 10 + L, 2.5, 5, 0, 0.6);
      }
    ctx.save();
    const xr = Math.cos(0.45) * R;
    const yb = cy + Math.sin(0.45) * R;
    scaleAt(ctx, 0, yb, 1 + 0.07 * melt, 1 - 0.07 * melt);
    const scoop = () => {
      ctx.beginPath();
      ctx.arc(0, cy, R, PI - 0.45, TAU + 0.45);
      for (let i = 0; i < 5; i++) {
        const x0 = xr - i * ((2 * xr) / 5);
        const x1 = xr - (i + 1) * ((2 * xr) / 5);
        ctx.quadraticCurveTo((x0 + x1) / 2, yb + 28, x1, yb);
      }
      ctx.closePath();
    };
    scoop();
    ink(ctx, shade(ctx, 0, cy, R, '#ffd8ea', pink, '#e46a9e'));
    ctx.save();
    scoop();
    ctx.clip();
    for (const [x, y, a, c] of [
      [-50, -30, 0.4, '#ffe14d'],
      [-20, -55, -0.6, '#6ad1ff'],
      [30, -50, 0.9, '#8ce36b'],
      [52, -18, -0.3, '#ffffff'],
      [-58, 4, -1.1, '#6ad1ff'],
      [8, -64, 0.2, '#ffffff'],
      [56, 14, 1.2, '#ffe14d'],
    ] as [number, number, number, string][]) {
      ctx.save();
      ctx.translate(x, cy + y);
      ctx.rotate(a);
      rr(ctx, -6, -2.5, 12, 5, 2.5);
      ctx.fillStyle = c;
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    shine(ctx, -34, cy - 40, 20, 10);
    // face
    const er = 12 + shock * 5;
    for (const sx of [-1, 1]) {
      eye(ctx, sx * 26, cy + 2, er, 0, -0.4 * shock, f.blink);
      if (shock > 0.2) {
        ctx.beginPath();
        ctx.moveTo(sx * 14, cy - er - 14);
        ctx.lineTo(sx * 38, cy - er - 6);
        line(ctx, OL, 4);
      }
    }
    cheek(ctx, -50, cy + 22, 11);
    cheek(ctx, 50, cy + 22, 11);
    if (shock > 0.15) openMouth(ctx, 0, cy + 36, 9 + shock * 4, 7 + shock * 9);
    else smile(ctx, 0, cy + 32, 24);
    ctx.restore();
    // cherry on top
    const top = cy - R * (1 - 0.07 * melt) + 4;
    ctx.beginPath();
    ctx.moveTo(14, top - 12);
    ctx.quadraticCurveTo(18, top - 38, 36, top - 44);
    line(ctx, '#5b8a2a', 5);
    ell(ctx, 12, top - 4, 17, 16);
    ink(ctx, shade(ctx, 12, top - 4, 17, '#ff8a8a', '#e3262f', '#a8141c'), 5);
    shine(ctx, 6, top - 10, 5, 3);
    // sweat drops fly off
    if (shock > 0.05)
      for (const sx of [-1, 1]) {
        const k = (s * 1.6 + (sx > 0 ? 0.5 : 0)) % 1;
        drop(ctx, sx * (70 + k * 30), cy - 30 - k * 25, 9, '#8fd8ff', shock * (1 - k));
      }
    ctx.restore();
  },
};

const Esel: Picto = {
  anim: 3.2,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.2);
    const s = f.s;
    const bray = f.on ? Math.max(bump(s, 0.2, 1.4), bump(s, 1.6, 2.9)) : 0;
    const lift = f.on ? bump(s, 0.1, 3.1) : 0;
    const base = '#a6a4b8';
    const mane = '#5a5470';
    const fur = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#d2d0e0', base, '#7c7993');
    ctx.save();
    ctx.translate(-10, f.breathe * 1.2);
    // tail
    const sw = f.on ? Math.sin(s * 9) * 0.5 : Math.sin(f.rest * 1.5) * 0.15;
    ctx.save();
    rotAt(ctx, -100, 10, sw);
    ctx.beginPath();
    ctx.moveTo(-100, 10);
    ctx.quadraticCurveTo(-125, 30, -122, 70);
    line(ctx, OL, 6);
    ell(ctx, -122, 80, 10, 17);
    ink(ctx, mane, 4);
    ctx.restore();
    // legs (far ones darker)
    for (const [x, far] of [
      [-60, 1],
      [40, 1],
      [-82, 0],
      [62, 0],
    ]) {
      rr(ctx, x - 13, 45, 26, 86, 12);
      ink(ctx, far ? '#8e8ba3' : base, 5);
      rr(ctx, x - 14, 120, 28, 16, 6);
      ink(ctx, '#4a4258', 5);
    }
    // neck, body
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(62, -62);
    ctx.lineTo(104, -50);
    ctx.lineTo(90, 25);
    ctx.closePath();
    ink(ctx, base);
    ell(ctx, -10, 30, 95, 54);
    ink(ctx, fur(-10, 30, 95));
    ell(ctx, -5, 58, 62, 18);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fill();
    // mane on the neck
    for (let i = 0; i < 5; i++) {
      ell(ctx, 48 + i * 4, -2 - i * 15, 11, 12, 0.3);
      ink(ctx, mane, 4);
    }
    // head, lifted to bray
    ctx.save();
    rotAt(ctx, 70, -30, -0.38 * lift);
    const flop = bray * Math.sin(s * 12);
    for (const [ex, k] of [
      [70, 1],
      [92, -1],
    ]) {
      ctx.save();
      rotAt(ctx, ex, -78, -0.18 + k * 0.12 + flop * 0.35 * k);
      ell(ctx, ex, -118, 14, 44);
      ink(ctx, fur(ex, -118, 30));
      ell(ctx, ex, -114, 6, 30);
      ctx.fillStyle = '#e9b3c8';
      ctx.fill();
      ctx.restore();
    }
    ell(ctx, 98, -50, 54, 34, 0.38);
    ink(ctx, fur(98, -50, 54));
    ell(ctx, 74, -86, 16, 11, -0.4);
    ink(ctx, mane, 4);
    ell(ctx, 136, -26, 30, 27, 0.38);
    ink(ctx, shade(ctx, 136, -26, 30, '#fffaf4', '#eee3d8', '#cbbcae'), 5);
    ell(ctx, 148, -34, 4.5, 6.5, 0.4);
    ctx.fillStyle = OL;
    ctx.fill();
    eye(ctx, 92, -62, 12, 0.6, -0.2, f.blink);
    cheek(ctx, 110, -36, 10);
    if (bray > 0.05) {
      openMouth(ctx, 136, -6, 15, 4 + 13 * bray);
      rr(ctx, 126, -6 - 4 - 13 * bray + 2, 20, 8, 2);
      ink(ctx, '#ffffff', 2.5);
      soundArcs(ctx, 158, -12, 0.35, bray);
    } else {
      ctx.beginPath();
      ctx.moveTo(122, -4);
      ctx.quadraticCurveTo(136, 4, 150, -6);
      line(ctx, OL, 4.5);
    }
    ctx.restore();
    ctx.restore();
  },
};

const Sofa: Picto = {
  anim: 3.4,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.4);
    const s = f.s;
    const no = f.on ? bump(s, 0.05, 1.3) : 0;
    const u = f.on ? ramp(s, 1.6, 2.9) : 0;
    const air = hop(u, 0.18, 0.82);
    const squash = f.on ? 0.14 * (bump(u, 0, 0.2) + bump(u, 0.8, 1)) : 0;
    const cushion = f.on ? 22 * hop(s, 2.05, 3.2) : 0;
    const base = '#ef7d57';
    const fab = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#ffae8e', base, '#c4532f');
    ctx.save();
    ctx.translate(Math.sin(s * 14) * 9 * no, -90 * air + f.breathe);
    scaleAt(ctx, 0, 124, 1 + squash, 1 - squash);
    for (const x of [-118, 100]) {
      rr(ctx, x, 98, 18, 26, 5);
      ink(ctx, '#7a4a2a', 5);
    }
    rr(ctx, -118, -78, 236, 125, 42);
    ink(ctx, fab(0, -30, 140));
    // buttons on the backrest
    for (const x of [-70, 70]) {
      ell(ctx, x, -48, 4, 4);
      ctx.fillStyle = 'rgba(120,40,20,0.5)';
      ctx.fill();
    }
    rr(ctx, -112, 56, 224, 50, 14);
    ink(ctx, fab(0, 80, 120));
    for (const x of [-104, 2]) {
      rr(ctx, x, 16 - cushion * (x < 0 ? 1 : 0.7), 102, 46, 18);
      ink(ctx, fab(x + 50, 30, 60));
    }
    for (const sx of [-1, 1]) {
      rr(ctx, sx > 0 ? 100 : -152, -18, 52, 120, 26);
      ink(ctx, fab(sx * 126, 20, 60));
    }
    // a yellow throw pillow
    ctx.save();
    ctx.translate(92, 4 - cushion * 1.3);
    ctx.rotate(-0.3 + cushion * 0.03);
    rr(ctx, -21, -21, 42, 42, 12);
    ink(ctx, shade(ctx, 0, 0, 30, '#fff0a6', '#ffd23f', '#e0a91a'), 5);
    ctx.restore();
    // face
    const stern = no > 0.1;
    for (const sx of [-1, 1]) {
      if (air > 0.2) happyEye(ctx, sx * 30, -38, 13);
      else eye(ctx, sx * 30, -38, 13, stern ? Math.sin(s * 14) * 0.6 : 0, 0, f.blink);
      if (stern) {
        ctx.beginPath();
        ctx.moveTo(sx * 16, -56);
        ctx.lineTo(sx * 44, -60);
        line(ctx, OL, 5);
      }
    }
    cheek(ctx, -52, -20, 11);
    cheek(ctx, 52, -20, 11);
    if (stern) {
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(12, -10);
      line(ctx, OL, 5);
    } else if (air > 0.1) openMouth(ctx, 0, -10, 13, 11);
    else smile(ctx, 0, -14, 26);
    ctx.restore();
    // shadow while in the air
    if (air > 0) {
      ell(ctx, 0, 132, 130 * (1 - air * 0.4), 9);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fill();
    }
  },
};

const Mond: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4);
    const s = f.s;
    const yawn = f.on ? bump(s, 0.3, 2.4) : 0;
    const sleep = f.on ? ramp(s, 2.4, 3.2) : f.resting ? 1 : 0;
    ctx.save();
    ctx.rotate(-0.14 * yawn + (f.resting ? Math.sin(f.rest * 1.1) * 0.05 : 0));
    // crescent: big circle minus a circle up right
    const r1 = 122;
    const ox = 58;
    const oy = -26;
    const r2 = 102;
    const d = Math.hypot(ox, oy);
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(r1 * r1 - a * a);
    const ux = ox / d;
    const uy = oy / d;
    const p1 = [a * ux - h * uy, a * uy + h * ux];
    const p2 = [a * ux + h * uy, a * uy - h * ux];
    const cres = () => {
      ctx.beginPath();
      ctx.arc(0, 0, r1, Math.atan2(p2[1], p2[0]), Math.atan2(p1[1], p1[0]), true);
      ctx.arc(ox, oy, r2, Math.atan2(p1[1] - oy, p1[0] - ox), Math.atan2(p2[1] - oy, p2[0] - ox), false);
      ctx.closePath();
    };
    cres();
    ink(ctx, shade(ctx, -40, 0, 120, '#fff6c4', '#ffe27a', '#f0b43a'));
    ctx.save();
    cres();
    ctx.clip();
    for (const [x, y, r] of [
      [-95, 45, 11],
      [-60, 85, 8],
      [-100, -55, 7],
    ]) {
      ell(ctx, x, y, r, r);
      ctx.fillStyle = 'rgba(214,150,40,0.35)';
      ctx.fill();
    }
    ctx.restore();
    // face looking right
    if (sleep > 0.5 || yawn > 0.5) eye(ctx, -74, -40, 13, 0, 0, 1);
    else eye(ctx, -74, -40, 13, 0.5, 0, Math.max(f.blink, sleep * 1.6));
    cheek(ctx, -94, -8, 12);
    if (yawn > 0.05) openMouth(ctx, -66, 12, 8 + yawn * 6, 6 + yawn * 17);
    else smile(ctx, -66, 10, 20);
    if (yawn > 0.3) {
      // stretching little arm
      ctx.beginPath();
      ctx.moveTo(-108, 60);
      ctx.quadraticCurveTo(-140, 30, -132, -10 - yawn * 20);
      tube(ctx, '#ffd65a', 8);
    }
    // sleeping bubble
    if (f.resting || sleep > 0.9) {
      const k = 0.5 + 0.5 * Math.sin((f.rest + s) * 1.6);
      ell(ctx, -48, 22, 5 + k * 9, 5 + k * 9);
      ctx.fillStyle = 'rgba(190,230,255,0.6)';
      ctx.fill();
      line(ctx, 'rgba(90,140,200,0.8)', 2.5);
    }
    ctx.restore();
    // twinkling stars in the gap
    const tw = (k: number) => 1 + (alive ? 0.2 * Math.sin(t * 4 + k * 2) : 0);
    star(ctx, 72, -48, 19 * tw(0), '#fff1a8', 0.1);
    star(ctx, 100, 46, 13 * tw(1), '#fff1a8', -0.2);
    star(ctx, 132, -104, 11 * tw(2), '#fff1a8', 0.3);
  },
};

function soccerBall(ctx: C, x: number, y: number, r: number, rot: number): void {
  ctx.save();
  ell(ctx, x, y, r, r);
  ink(ctx, shade(ctx, x, y, r, '#ffffff', '#f4f4f8', '#c8c8d6'), 5);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const pent = (cx: number, cy: number, pr: number, a0: number) => {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) ctx.lineTo(cx + Math.cos(a0 + (i / 5) * TAU) * pr, cy + Math.sin(a0 + (i / 5) * TAU) * pr);
    ctx.closePath();
    ctx.fillStyle = '#2b2733';
    ctx.fill();
  };
  pent(0, 0, r * 0.36, -PI / 2);
  for (let i = 0; i < 5; i++) {
    const an = -PI / 2 + PI / 5 + (i / 5) * TAU;
    pent(Math.cos(an) * r * 0.95, Math.sin(an) * r * 0.95, r * 0.34, an);
  }
  ctx.restore();
  ell(ctx, x, y, r, r);
  line(ctx, OL, 5);
}

const Tor: Picto = {
  anim: 3.2,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.2);
    const s = f.s;
    const done = f.resting || s > 0.7;
    const hit = [55, -30];
    const bulge = f.on ? 34 * Math.exp(-Math.max(0, s - 0.7) * 2.2) * Math.cos(Math.max(0, s - 0.7) * 9) * (s > 0.7 ? 1 : 0) : 0;
    const joy = f.on ? hop(s, 1.3, 1.8) + hop(s, 1.9, 2.4) : 0;
    // grass
    rr(ctx, -165, 112, 330, 32, 16);
    ink(ctx, lin(ctx, 0, 112, 0, 144, '#8fe06a', '#5fb444'), 5);
    ctx.save();
    ctx.translate(0, -16 * joy);
    // net
    const nx = 112;
    const ny0 = -80;
    const ny1 = 112;
    rr(ctx, -nx, ny0, nx * 2, ny1 - ny0, 4);
    ctx.fillStyle = 'rgba(205,225,245,0.45)';
    ctx.fill();
    // ball in the net (behind the strings)
    let bx = 0;
    let by = 126;
    let br = 26;
    if (f.on && s < 0.7) {
      const k = ease.outCubic(ramp(s, 0.1, 0.7));
      bx = k * hit[0];
      by = 126 + (hit[1] - 126) * k - 60 * Math.sin(k * PI);
      br = 26 - k * 4;
    } else if (done) {
      const k = f.on ? ease.outBounce(ramp(s, 0.7, 1.4)) : 1;
      bx = hit[0] + 8 * k;
      by = hit[1] + (88 - hit[1]) * k;
      br = 22;
    }
    const rot = f.on ? s * 10 : 0.3;
    if (done) soccerBall(ctx, bx, by + 16 * joy, br, rot);
    const pt = (x: number, y: number): [number, number] => {
      const dx = x - hit[0];
      const dy = y - hit[1];
      const dd = Math.hypot(dx, dy) + 1;
      const push = bulge * Math.exp(-(dd * dd) / (2 * 50 * 50));
      return [x + (dx / dd) * push, y + (dy / dd) * push];
    };
    ctx.beginPath();
    for (let x = -nx + 16; x < nx; x += 19) {
      for (let y = ny0; y <= ny1; y += 8) {
        const [px, py] = pt(x, y);
        if (y === ny0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    for (let y = ny0 + 16; y < ny1; y += 17) {
      for (let x = -nx; x <= nx; x += 8) {
        const [px, py] = pt(x, y);
        if (x === -nx) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
    }
    line(ctx, 'rgba(110,120,150,0.7)', 2.5);
    // posts and crossbar
    ctx.beginPath();
    ctx.moveTo(-122, 116);
    ctx.lineTo(-122, -88);
    ctx.lineTo(122, -88);
    ctx.lineTo(122, 116);
    line(ctx, OL, 24);
    line(ctx, '#ffffff', 13);
    ctx.beginPath();
    ctx.moveTo(-122, -60);
    ctx.lineTo(-122, 90);
    ctx.moveTo(-100, -88);
    ctx.lineTo(100, -88);
    line(ctx, 'rgba(255,90,90,0.5)', 4);
    ctx.restore();
    // the ball in front, before and during the shot
    if (!done) soccerBall(ctx, bx, by, br, rot);
    // confetti
    if (f.on && s > 0.7) {
      const tau = s - 0.7;
      const fade = 1 - ramp(tau, 0.9, 1.4);
      const cols = ['#ff5c8a', '#ffd23f', '#3fc1ff', '#7cdb5a', '#b07cff'];
      for (let i = 0; i < 16; i++) {
        const an = i * 2.39;
        const v = 55 + (i % 3) * 18;
        const x = hit[0] + Math.cos(an) * v * tau;
        const y = hit[1] + Math.sin(an) * v * tau - 70 * tau + 80 * tau * tau;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(x, y);
        ctx.rotate(an + tau * 8);
        ctx.fillStyle = cols[i % 5];
        ctx.fillRect(-6, -3, 12, 6);
        ctx.restore();
      }
    }
  },
};

const Dino: Picto = {
  anim: 4.2,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4.2);
    const s = f.s;
    const roar = f.on ? bump(s, 0.15, 1.6) : 0;
    const leaf = f.on ? ease.outBack(ramp(s, 1.6, 2.0)) : f.resting ? 1 : 0;
    const eaten = f.on ? ramp(s, 2.1, 3.9) : f.resting ? 0.6 : 0;
    const chew = f.on && s > 2.1 ? Math.abs(Math.sin(s * 11)) : f.resting ? Math.abs(Math.sin(f.rest * 3)) * 0.5 : 0;
    const base = '#7ccf55';
    const skin = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#b8ef90', base, '#4c9a35');
    ctx.save();
    ctx.translate(-8 + Math.sin(s * 40) * 3 * roar, f.breathe * 1.5);
    // tail
    const sw = alive ? Math.sin((f.on ? s : f.rest) * 2.5) * 0.08 : 0;
    ctx.save();
    rotAt(ctx, -60, 50, sw);
    ctx.beginPath();
    ctx.moveTo(-50, 5);
    ctx.quadraticCurveTo(-120, 40, -158, 112);
    ctx.quadraticCurveTo(-100, 100, -45, 90);
    ctx.closePath();
    ink(ctx, skin(-100, 70, 70));
    for (const [x, y] of [
      [-95, 38],
      [-125, 68],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - 10, y + 8);
      ctx.lineTo(x - 8, y - 16);
      ctx.lineTo(x + 10, y - 2);
      ctx.closePath();
      ink(ctx, '#ff9f43', 4);
    }
    ctx.restore();
    // back spikes
    for (let i = 0; i < 5; i++) {
      const th = -2.5 + i * 0.32;
      const x = -5 + Math.cos(th) * 82;
      const y = 40 + Math.sin(th) * 72;
      const nx = Math.cos(th);
      const ny = Math.sin(th);
      ctx.beginPath();
      ctx.moveTo(x - ny * 14 - nx * 4, y + nx * 14 - ny * 4);
      ctx.lineTo(x + nx * 26, y + ny * 26);
      ctx.lineTo(x + ny * 14 - nx * 4, y - nx * 14 - ny * 4);
      ctx.closePath();
      ink(ctx, '#ff9f43', 5);
    }
    // legs, body, belly
    rr(ctx, -55, 78, 46, 56, 20);
    ink(ctx, skin(-32, 100, 40));
    rr(ctx, 18, 82, 42, 52, 20);
    ink(ctx, skin(38, 100, 40));
    ell(ctx, -5, 40, 82, 72);
    ink(ctx, skin(-5, 40, 82));
    ctx.save();
    ell(ctx, -5, 40, 82, 72);
    ctx.clip();
    ell(ctx, 30, 60, 42, 56);
    ctx.fillStyle = '#f3e7a1';
    ctx.fill();
    ctx.beginPath();
    for (let y = 30; y < 110; y += 16) {
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(30, y + 6, 66, y);
    }
    line(ctx, 'rgba(180,150,60,0.45)', 3);
    ctx.restore();
    for (const x of [-48, -30, 24, 42]) {
      ell(ctx, x + 8, 133, 6, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    // head
    ctx.save();
    rotAt(ctx, 30, -10, -0.28 * roar + chew * 0.04);
    for (let i = 0; i < 3; i++) {
      const x = 20 + i * 22;
      ctx.beginPath();
      ctx.moveTo(x - 12, -92 + i * -4);
      ctx.lineTo(x - 2, -122 - i * 2);
      ctx.lineTo(x + 10, -96 - i * 4);
      ctx.closePath();
      ink(ctx, '#ff9f43', 5);
    }
    ell(ctx, 66, -60, 66, 46, -0.08);
    ink(ctx, skin(60, -60, 66));
    shine(ctx, 40, -86, 16, 7);
    eye(ctx, 66, -74, 14, 0.5, 0, f.blink);
    ell(ctx, 116, -76, 4, 3);
    ctx.fillStyle = OL;
    ctx.fill();
    cheek(ctx, 92, -50, 12);
    if (roar > 0.05) {
      ctx.save();
      ell(ctx, 100, -34, 30, 6 + 22 * roar);
      ink(ctx, '#7a2340', 4);
      ctx.clip();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        const x = 80 + i * 13;
        ctx.moveTo(x, -34 - 6 - 22 * roar);
        ctx.lineTo(x + 5, -34 - 22 * roar + 6);
        ctx.lineTo(x + 10, -34 - 6 - 22 * roar);
        ctx.fill();
      }
      ctx.restore();
      soundArcs(ctx, 132, -38, -0.1, roar);
    } else if (chew > 0.1) openMouth(ctx, 104, -34, 12, 3 + chew * 7);
    else {
      ctx.beginPath();
      ctx.moveTo(78, -38);
      ctx.quadraticCurveTo(100, -24, 122, -42);
      line(ctx, OL, 5);
    }
    ctx.restore();
    // little arm with a lettuce leaf
    if (leaf > 0.02) {
      const sc = leaf * (1 - eaten * 0.65);
      ctx.save();
      ctx.translate(92, 2 - eaten * 10);
      ctx.scale(sc, sc);
      ctx.beginPath();
      for (let i = 0; i <= 18; i++) {
        const an = (i / 18) * TAU;
        const q = 26 + (i % 2) * 6;
        ctx.lineTo(Math.cos(an) * q, Math.sin(an) * q);
      }
      ctx.closePath();
      ink(ctx, shade(ctx, 0, 0, 30, '#c8f59a', '#86d957', '#4fa33a'), 5);
      ctx.beginPath();
      ctx.moveTo(-18, 18);
      ctx.lineTo(16, -14);
      ctx.moveTo(0, 2);
      ctx.lineTo(-8, -14);
      ctx.moveTo(6, -4);
      ctx.lineTo(18, 4);
      line(ctx, 'rgba(60,130,40,0.7)', 3);
      ctx.restore();
    }
    ell(ctx, 64, 22, 18, 10, 0.5);
    ink(ctx, skin(64, 22, 18), 5);
    ctx.restore();
  },
};

const Hund: Picto = {
  anim: 4.5,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4.5);
    const s = f.s;
    const spin = f.on ? ease.inOutCubic(ramp(s, 1.0, 3.4)) * 4 * PI : 0;
    const sx = Math.cos(spin);
    const bark = f.on ? bump(s, 3.5, 4.4) : 0;
    const wag = f.on ? Math.sin(s * 28) * 0.55 : f.resting ? Math.sin(f.rest * 7) * 0.3 : 0;
    const happy = f.on && s < 1.0;
    const base = '#d0955a';
    const fur = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#f0c896', base, '#a46a36');
    ctx.save();
    ctx.translate(-10, -22 * Math.abs(Math.sin(spin)) + f.breathe);
    ctx.scale(Math.sign(sx || 1) * Math.max(0.55, Math.abs(sx)), 1);
    // tail
    ctx.save();
    rotAt(ctx, -88, 5, wag);
    ctx.beginPath();
    ctx.moveTo(-88, 5);
    ctx.quadraticCurveTo(-130, -10, -125, -58);
    tube(ctx, base, 13);
    ctx.restore();
    for (const [x, far] of [
      [-55, 1],
      [50, 1],
      [-75, 0],
      [70, 0],
    ]) {
      rr(ctx, x - 12, 40, 24, 86, 11);
      ink(ctx, far ? '#b27b46' : base, 5);
      ell(ctx, x + 4, 128, 17, 9);
      ink(ctx, '#f6e3c8', 5);
    }
    ell(ctx, -10, 30, 88, 50);
    ink(ctx, fur(-10, 30, 88));
    ell(ctx, -40, 18, 26, 18, 0.2);
    ctx.fillStyle = 'rgba(120,70,30,0.35)';
    ctx.fill();
    // collar with a tag
    ctx.save();
    ctx.translate(50, -2);
    ctx.rotate(-1.25);
    rr(ctx, -32, -9, 64, 18, 8);
    ink(ctx, '#e8453c', 5);
    ctx.restore();
    ell(ctx, 45, 33, 9, 9);
    ink(ctx, '#ffd23f', 4);
    // head
    const hx = 80;
    const hy = -36;
    ctx.save();
    rotAt(ctx, 55, 0, bark * -0.15);
    ell(ctx, hx, hy, 50, 46);
    ink(ctx, fur(hx, hy, 50));
    ell(ctx, hx + 40, hy + 16, 34, 24);
    ink(ctx, shade(ctx, hx + 40, hy + 16, 34, '#fff6e6', '#f6e3c8', '#d9bf9c'), 5);
    ell(ctx, hx + 68, hy + 6, 12, 10);
    ink(ctx, '#2a1d22', 4);
    shine(ctx, hx + 64, hy + 2, 4, 2.5, 0, 0.7);
    eye(ctx, hx + 10, hy - 14, 12, 0.6, 0, f.blink);
    cheek(ctx, hx + 26, hy + 8, 9);
    if (bark > 0.05 || happy) {
      openMouth(ctx, hx + 44, hy + 34, 14, 5 + 10 * Math.max(bark, happy ? 0.5 : 0));
    } else {
      ctx.beginPath();
      ctx.moveTo(hx + 30, hy + 32);
      ctx.quadraticCurveTo(hx + 46, hy + 42, hx + 62, hy + 30);
      line(ctx, OL, 4.5);
      if (f.resting) {
        rr(ctx, hx + 40, hy + 34, 14, 16 + 3 * Math.sin(f.rest * 7), 7);
        ink(ctx, '#ff8fa8', 3.5);
      }
    }
    // floppy ear
    const ef = f.on ? Math.sin(s * 14) * 0.25 : 0;
    ctx.save();
    rotAt(ctx, hx - 18, hy - 30, ef);
    ctx.beginPath();
    ctx.moveTo(hx - 30, hy - 30);
    ctx.bezierCurveTo(hx - 52, hy - 10, hx - 48, hy + 40, hx - 26, hy + 44);
    ctx.bezierCurveTo(hx - 10, hy + 40, hx - 4, hy, hx - 2, hy - 36);
    ctx.closePath();
    ink(ctx, shade(ctx, hx - 26, hy, 40, '#9a6236', '#7a4a2a', '#5a321a'));
    ctx.restore();
    ctx.restore();
    ctx.restore();
    if (bark > 0.05) soundArcs(ctx, 148 - 10, -10, 0, bark);
  },
};

const Ampel: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const seq = [0, 1, 2, 1, 0, 2, 0, 1, 2, 0, 2, 1, 0, 2, 1, 0];
    let lit = [true, false, false];
    let face = 0;
    if (f.on && s < 2.5) {
      const k = Math.floor(s * 2 + s * s * 1.3);
      face = seq[k % seq.length];
      lit = [face === 0, face === 1, face === 2];
    } else if (f.on && s < 3.2) {
      lit = [true, true, true];
      face = 1;
    } else if (f.on || f.resting) {
      lit = [false, false, true];
      face = 2;
    }
    const dizzy = f.on ? bump(s, 2.3, 3.4) : 0;
    ctx.save();
    rotAt(ctx, 0, 140, Math.sin(s * 22) * 0.06 * dizzy + (f.resting ? Math.sin(f.rest * 1.8) * 0.015 : 0));
    rr(ctx, -12, 96, 24, 40, 4);
    ink(ctx, lin(ctx, -12, 0, 12, 0, '#a7acb8', '#727786'), 5);
    ell(ctx, 0, 138, 42, 10);
    ink(ctx, '#8a8f9c', 5);
    rr(ctx, -64, -148, 128, 250, 28);
    ink(ctx, lin(ctx, -64, 0, 64, 0, '#585e75', '#353a4c'));
    shine(ctx, -44, -120, 8, 16, 0, 0.25);
    const ys = [-88, -12, 64];
    const on = ['#ff4b4b', '#ffd23f', '#3fdc6b'];
    const onL = ['#ffb0b0', '#fff2a6', '#b4ffc9'];
    const off = ['#8e3a3a', '#94812f', '#2c7a47'];
    for (let i = 0; i < 3; i++) {
      const y = ys[i];
      // hood
      ctx.beginPath();
      ctx.arc(0, y, 42, PI * 1.05, PI * 1.95);
      line(ctx, '#23263a', 9);
      if (lit[i]) {
        ell(ctx, 0, y, 44, 44);
        ctx.fillStyle = on[i] + '55';
        ctx.fill();
      }
      ell(ctx, 0, y, 31, 31);
      ink(ctx, lit[i] ? shade(ctx, 0, y, 31, onL[i], on[i], on[i]) : off[i], 5);
      if (lit[i]) shine(ctx, -10, y - 12, 9, 5, -0.5, 0.6);
    }
    // the lit light has the face
    const fy = ys[face];
    const look = f.on && s < 2.5 ? Math.sin(s * 9) : 0;
    if (dizzy > 0.3) {
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        for (let k = 0; k < 20; k++) {
          const an = k * 0.6 + s * 10;
          const q = k * 0.4;
          ctx.lineTo(sx * 11 + Math.cos(an) * q, fy - 6 + Math.sin(an) * q);
        }
        line(ctx, OL, 2.5);
      }
      openMouth(ctx, 0, fy + 13, 6, 5);
    } else {
      for (const sx of [-1, 1]) eye(ctx, sx * 11, fy - 6, 8, look, 0, f.blink);
      if (f.on) openMouth(ctx, 0, fy + 14, 6, 5);
      else smile(ctx, 0, fy + 12, 16, 4);
    }
    ctx.restore();
  },
};

/** a tapered dark stripe from (x1, y1), w wide, to a point at (x2, y2) */
function stripe(ctx: C, x1: number, y1: number, x2: number, y2: number, w: number, col = '#3a2530'): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L;
  const ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * w, y1 + ny * w);
  ctx.quadraticCurveTo(x1 + dx * 0.5 + nx * w * 0.7, y1 + dy * 0.5 + ny * w * 0.7, x2, y2);
  ctx.quadraticCurveTo(x1 + dx * 0.5 - nx * w * 0.7, y1 + dy * 0.5 - ny * w * 0.7, x1 - nx * w, y1 - ny * w);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
}

const Tiger: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const growl = f.on ? bump(s, 0.1, 1.4) : 0;
    const cuddle = f.on ? ramp(s, 1.5, 1.9) * (1 - ramp(s, 3.3, 3.6)) : 0;
    const orange = '#ff9a3c';
    const fur = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#ffc98a', orange, '#e0701c');
    ctx.save();
    ctx.translate(0, 8 * growl + f.breathe * 1.2);
    // tail
    const sw = alive ? Math.sin((f.on ? s * 3 : f.rest * 1.4) + 0.5) * 14 : 0;
    ctx.beginPath();
    ctx.moveTo(60, 120);
    ctx.quadraticCurveTo(150, 120, 128 + sw * 0.5, 30 + sw);
    tube(ctx, orange, 18);
    ctx.setLineDash([8, 14]);
    ctx.strokeStyle = '#3a2530';
    ctx.lineWidth = 18;
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.setLineDash([]);
    // body
    ell(ctx, 0, 70, 82, 72);
    ink(ctx, fur(0, 70, 82));
    ctx.save();
    ell(ctx, 0, 70, 82, 72);
    ctx.clip();
    ell(ctx, 0, 92, 44, 52);
    ctx.fillStyle = '#fff8ee';
    ctx.fill();
    for (const sx of [-1, 1]) {
      stripe(ctx, sx * 84, 40, sx * 48, 48, 9);
      stripe(ctx, sx * 86, 76, sx * 52, 80, 9);
      stripe(ctx, sx * 76, 110, sx * 48, 108, 8);
    }
    ctx.restore();
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 40, 134, 30, 17);
      ink(ctx, fur(sx * 40, 134, 30), 5);
      ctx.beginPath();
      ctx.moveTo(sx * 40 - 8, 126);
      ctx.lineTo(sx * 40 - 8, 136);
      ctx.moveTo(sx * 40 + 8, 126);
      ctx.lineTo(sx * 40 + 8, 136);
      line(ctx, OL, 3);
    }
    // head
    ctx.save();
    rotAt(ctx, 0, 20, cuddle * 0.22 * Math.sin(s * 2.5 + 0.3) + Math.sin(s * 40) * 0.03 * growl + f.breathe * 0.02);
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 62, -114, 26, 26);
      ink(ctx, fur(sx * 62, -114, 26));
      ell(ctx, sx * 62, -110, 13, 13);
      ctx.fillStyle = '#ffe1d0';
      ctx.fill();
    }
    ell(ctx, 0, -50, 94, 80);
    ink(ctx, fur(0, -50, 94));
    ctx.save();
    ell(ctx, 0, -50, 94, 80);
    ctx.clip();
    stripe(ctx, 0, -132, 0, -96, 10);
    for (const sx of [-1, 1]) {
      stripe(ctx, sx * 28, -128, sx * 20, -100, 8);
      stripe(ctx, sx * 96, -78, sx * 62, -72, 9);
      stripe(ctx, sx * 96, -48, sx * 64, -46, 9);
      stripe(ctx, sx * 92, -18, sx * 66, -22, 8);
    }
    ctx.restore();
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 22, -16, 28, 22);
      ink(ctx, '#fff8ee', 4);
    }
    ell(ctx, 0, 6, 18, 11);
    ink(ctx, '#fff8ee', 4);
    for (const sx of [-1, 1])
      for (const [dx, dy] of [
        [14, -18],
        [24, -10],
        [32, -20],
      ]) {
        ell(ctx, sx * dx, dy, 2.3, 2.3);
        ctx.fillStyle = OL;
        ctx.fill();
      }
    ctx.beginPath();
    ctx.moveTo(-13, -36);
    ctx.lineTo(13, -36);
    ctx.lineTo(0, -24);
    ctx.closePath();
    ink(ctx, '#ff8fa8', 4);
    // eyes
    for (const sx of [-1, 1]) {
      if (cuddle > 0.3) happyEye(ctx, sx * 34, -62, 15);
      else eye(ctx, sx * 34, -62, 15, 0, 0, f.blink);
      if (growl > 0.15) {
        ctx.beginPath();
        ctx.moveTo(sx * 18, -78 + 2);
        ctx.lineTo(sx * 50, -88);
        line(ctx, '#3a2530', 6);
      }
    }
    if (cuddle > 0.1) {
      cheek(ctx, -56, -26, 15, 0.55 * cuddle);
      cheek(ctx, 56, -26, 15, 0.55 * cuddle);
    }
    if (growl > 0.1) {
      openMouth(ctx, 0, 2, 16, 5 + 9 * growl);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(sx * 12, 2 - 5 - 9 * growl + 2);
        ctx.lineTo(sx * 7, 2 - 5 - 9 * growl + 2);
        ctx.lineTo(sx * 9.5, 8 - 9 * growl + 6);
        ctx.closePath();
        ink(ctx, '#ffffff', 2);
      }
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(0, -16);
      ctx.moveTo(-12, -10);
      ctx.quadraticCurveTo(-6, -4, 0, -14);
      ctx.quadraticCurveTo(6, -4, 12, -10);
      line(ctx, OL, 4);
    }
    ctx.restore();
    if (f.on && cuddle > 0)
      for (let i = 0; i < 3; i++) {
        const k = ramp(s, 1.6 + i * 0.4, 2.8 + i * 0.4);
        if (k > 0 && k < 1) heart(ctx, (i - 1) * 70 + Math.sin(k * 6) * 8, -60 - k * 90, 16, '#ff5c8a', bump(k, 0, 1));
      }
    ctx.restore();
  },
};

function flag(ctx: C, x: number, y: number, col: string, ph: number, amp: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + 30);
  ctx.lineTo(x, y - 4);
  line(ctx, OL, 4);
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  for (let i = 1; i <= 6; i++) ctx.lineTo(x + i * 6, y - 2 + Math.sin(ph + i * 0.8) * amp * (i / 6));
  for (let i = 6; i >= 0; i--) ctx.lineTo(x + i * 6, y + 16 + Math.sin(ph + i * 0.8) * amp * (i / 6));
  ctx.closePath();
  ink(ctx, col, 3.5);
}

const Burg: Picto = {
  anim: 4.2,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4.2);
    const s = f.s;
    const a = f.on ? ease.outBounce(ramp(s, 0.2, 1.9)) * (PI / 2) : f.resting ? PI / 2 : 0;
    const king = f.on ? ease.outBack(ramp(s, 2.0, 2.6)) : f.resting ? 1 : 0;
    const wave = alive ? (f.on ? 3 + 4 * bump(s, 0.2, 4.2) : 3) : 2;
    const wph = alive ? t * (f.on ? 8 : 3) : 0;
    const stone = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#ebe5f5', '#c7c0d8', '#9a92ae');
    ctx.save();
    ctx.translate(0, 18);
    ctx.scale(0.84, 0.84);
    ell(ctx, 0, 138, 172, 22);
    ink(ctx, lin(ctx, 0, 118, 0, 160, '#8fe06a', '#5fb444'), 5);
    // middle tower behind
    rr(ctx, -36, -108, 72, 100, 4);
    ink(ctx, stone(0, -60, 60));
    ctx.beginPath();
    ctx.moveTo(-46, -106);
    ctx.lineTo(0, -168);
    ctx.lineTo(46, -106);
    ctx.closePath();
    ink(ctx, lin(ctx, -40, 0, 40, 0, '#ff7a6e', '#c9302f'));
    flag(ctx, 0, -196, '#ffd23f', wph, wave);
    ctx.beginPath();
    ctx.moveTo(-10, -60);
    ctx.lineTo(-10, -76);
    ctx.arc(0, -76, 10, PI, TAU);
    ctx.lineTo(10, -60);
    ctx.closePath();
    ink(ctx, '#3b2a35', 4);
    // wall with battlements
    ctx.beginPath();
    ctx.moveTo(-96, 136);
    ctx.lineTo(-96, -40);
    for (let i = 0; i < 6; i++) {
      const x = -96 + i * 32;
      ctx.lineTo(x + 18, -40);
      ctx.lineTo(x + 18, -24);
      ctx.lineTo(x + 32, -24);
      ctx.lineTo(x + 32, -40);
    }
    ctx.lineTo(96, 136);
    ctx.closePath();
    ink(ctx, stone(0, 40, 120));
    ctx.beginPath();
    for (const [x, y] of [
      [-70, 0],
      [-40, 22],
      [50, 6],
      [68, 40],
      [-62, 70],
      [58, 92],
      [-20, -6],
    ]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20, y);
    }
    line(ctx, 'rgba(100,90,120,0.45)', 3);
    // side towers with red roofs
    for (const sx of [-1, 1]) {
      const x = sx * 122;
      rr(ctx, x - 32, -62, 64, 198, 4);
      ink(ctx, stone(x, 30, 80));
      ctx.beginPath();
      ctx.moveTo(x - 42, -60);
      ctx.lineTo(x, -128);
      ctx.lineTo(x + 42, -60);
      ctx.closePath();
      ink(ctx, lin(ctx, x - 40, 0, x + 40, 0, '#ff7a6e', '#c9302f'));
      flag(ctx, x, -156, sx < 0 ? '#3fa9f5' : '#7cdb5a', wph + sx, wave * 0.8);
      ctx.beginPath();
      ctx.moveTo(x - 10, 10);
      ctx.lineTo(x - 10, -8);
      ctx.arc(x, -8, 10, PI, TAU);
      ctx.lineTo(x + 10, 10);
      ctx.closePath();
      ink(ctx, '#3b2a35', 4);
    }
    // gate
    ctx.beginPath();
    ctx.moveTo(-36, 136);
    ctx.lineTo(-36, 72);
    ctx.arc(0, 72, 36, PI, TAU);
    ctx.lineTo(36, 136);
    ctx.closePath();
    ink(ctx, '#3b2a35', 5);
    // the king (his crown) peeks out of the gate
    if (king > 0.01) {
      const bob = f.on ? Math.abs(Math.sin(s * 7)) * 6 * ramp(s, 2.6, 2.8) : Math.abs(Math.sin(f.rest * 2)) * 3;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-36, 136);
      ctx.lineTo(-36, 72);
      ctx.arc(0, 72, 36, PI, TAU);
      ctx.lineTo(36, 136);
      ctx.closePath();
      ctx.clip();
      crown(ctx, 0, 136 - 52 * king - bob, 50, 0.1 * Math.sin((f.on ? s : f.rest) * 3));
      ctx.restore();
      if (f.on) sparkle(ctx, 30, 70 - 20 * king, 10 * bump(s, 2.2, 3.4));
      if (f.resting) sparkle(ctx, -24, 90, 8 * Math.max(0, Math.sin(f.rest * 2.5)));
    }
    // drawbridge: closed it covers the gate, open it lies in front
    const e = 136 - 100 * Math.cos(a) + 30 * Math.sin(a);
    const hw = 38 + 10 * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(-38, 136);
    ctx.lineTo(38, 136);
    ctx.lineTo(hw, e);
    ctx.lineTo(-hw, e);
    ctx.closePath();
    ink(ctx, lin(ctx, 0, 136, 0, e, '#c98a52', '#9a6234'), 5);
    ctx.beginPath();
    for (const k of [-0.5, 0, 0.5]) {
      ctx.moveTo(k * 38, 136);
      ctx.lineTo(k * hw, e);
    }
    line(ctx, 'rgba(90,50,20,0.5)', 3);
    ctx.beginPath();
    ctx.moveTo(-44, 28);
    ctx.lineTo(-hw + 4, e);
    ctx.moveTo(44, 28);
    ctx.lineTo(hw - 4, e);
    line(ctx, '#5a5266', 3.5);
    ctx.restore();
  },
};

const Gras: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4);
    const s = f.s;
    const spurts = [
      [0.4, 0.75],
      [1.5, 1.85],
      [2.6, 2.95],
    ];
    let g = 1;
    let effort = 0;
    for (const [a, b] of spurts) {
      if (f.on) g += 0.12 * ease.outBack(ramp(s, a, b));
      if (f.on) effort = Math.max(effort, bump(s, a - 0.05, b + 0.1));
    }
    if (f.resting) g = 1.36;
    const look = f.on ? Math.sin(s * 2.4) : 0;
    const blades = 15;
    ell(ctx, 0, 128, 128, 18);
    ink(ctx, '#8a5a3a', 5);
    const greens = ['#4fae3a', '#6fcd4f', '#86de5f'];
    const blade = (i: number, front: boolean) => {
      const u = i / (blades - 1);
      const bx = -100 + u * 200 + (front ? 6 : 0);
      const by = 108;
      const h = (front ? 70 : 140) + 40 * (0.5 + 0.5 * Math.sin(i * 1.7 + (front ? 2 : 0)));
      const lean = (u - 0.5) * 0.7 + (alive ? Math.sin(t * 2.2 + i * 0.6) * (f.resting ? 0.06 : 0.1) : 0);
      const hh = h * (front ? 1 : g);
      const w = front ? 10 : 12;
      const tx = bx + Math.sin(lean) * hh;
      const ty = by - Math.cos(lean) * hh;
      ctx.beginPath();
      ctx.moveTo(bx - w, by);
      ctx.quadraticCurveTo(bx - w * 0.4 + Math.sin(lean) * hh * 0.3, by - hh * 0.55, tx, ty);
      ctx.quadraticCurveTo(bx + w * 0.6 + Math.sin(lean) * hh * 0.4, by - hh * 0.5, bx + w, by);
      ctx.closePath();
      ink(ctx, greens[(i + (front ? 1 : 0)) % 3], 4);
    };
    for (let i = 0; i < blades; i++) blade(i, false);
    ell(ctx, 0, 102, 108, 38);
    ink(ctx, shade(ctx, 0, 100, 108, '#9be872', '#5fc046', '#3e8f2e'));
    for (const i of [0, 1, 2, 12, 13]) blade(i, true);
    // face on the clump
    for (const sx of [-1, 1]) {
      if (effort > 0.4) happyEye(ctx, sx * 30, 98, 12);
      else eye(ctx, sx * 30, 98, 12, look, 0, f.blink);
    }
    cheek(ctx, -54, 112, 11);
    cheek(ctx, 54, 112, 11);
    if (effort > 0.4) {
      ctx.beginPath();
      ctx.moveTo(-12, 118);
      ctx.lineTo(12, 118);
      line(ctx, OL, 5);
    } else if (f.on) openMouth(ctx, 0, 120, 6, 6);
    else smile(ctx, 0, 116, 22);
  },
};

const Gurke: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3);
    const s = f.s;
    const fall = f.on ? ease.outBounce(ramp(s, 0.1, 1.0)) : f.resting ? 1 : 0;
    const glasses = alive;
    const cool = f.on ? ramp(s, 1.0, 1.4) : f.resting ? 1 : 0;
    const groove = f.on ? Math.sin(s * 6) * 0.07 * cool : f.resting ? Math.sin(f.rest * 2) * 0.04 : 0;
    ctx.save();
    ctx.rotate(-0.55 - 0.08 * cool + groove);
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(-140, 0);
      ctx.bezierCurveTo(-140, -58, -90, -50, 0, -50);
      ctx.bezierCurveTo(90, -50, 145, -50, 145, 0);
      ctx.bezierCurveTo(145, 52, 90, 54, 0, 54);
      ctx.bezierCurveTo(-90, 54, -140, 58, -140, 0);
      ctx.closePath();
    };
    rr(ctx, -158, -9, 22, 18, 6);
    ink(ctx, '#7a9a3a', 5);
    body();
    ink(ctx, shade(ctx, -20, -10, 140, '#7fd06a', '#3f9a3a', '#24642a'));
    ctx.save();
    body();
    ctx.clip();
    ctx.fillStyle = 'rgba(190,240,150,0.35)';
    for (const y of [-30, 4, 34]) {
      ell(ctx, 0, y, 140, 6);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(220,255,190,0.75)';
    for (let i = 0; i < 16; i++) {
      const x = -120 + ((i * 53) % 240);
      const y = -38 + ((i * 37) % 80);
      if (Math.abs(x - 25) < 55 && Math.abs(y + 5) < 40) continue;
      ell(ctx, x, y, 3.5, 3.5);
      ctx.fill();
    }
    ctx.restore();
    shine(ctx, -70, -32, 40, 7, 0, 0.4);
    // face
    for (const sx of [-1, 1]) eye(ctx, 25 + sx * 25, -12, 16, 0.3, 0, f.blink);
    cheek(ctx, -14, 14, 11);
    cheek(ctx, 66, 14, 11);
    if (cool > 0.5) {
      ctx.beginPath();
      ctx.moveTo(10, 24);
      ctx.quadraticCurveTo(30, 36, 48, 18);
      line(ctx, OL, 5);
    } else smile(ctx, 25, 24, 28);
    if (glasses) {
      ctx.save();
      ctx.translate(0, -175 * (1 - fall));
      ctx.beginPath();
      ctx.moveTo(-14, -20);
      ctx.lineTo(64, -20);
      line(ctx, '#1f1f2a', 5);
      for (const sx of [-1, 1]) {
        rr(ctx, 25 + sx * 25 - 20, -28, 40, 30, 11);
        ink(ctx, '#1f1f2a', 4);
        ctx.beginPath();
        ctx.moveTo(25 + sx * 25 - 12, -18);
        ctx.lineTo(25 + sx * 25 - 3, -25);
        line(ctx, 'rgba(255,255,255,0.7)', 3);
      }
      ctx.restore();
      if (f.on) sparkle(ctx, 60, -28, 14 * bump(s, 1.2, 2.0));
    }
    ctx.restore();
  },
};

/** four-leaf clover */
function clover(ctx: C, x: number, y: number, r: number, a = 1): void {
  if (a <= 0.02 || r < 1) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(r * 0.3, r * 1.2, r * 0.8, r * 1.6);
  line(ctx, '#3f8a2e', 3);
  for (let i = 0; i < 4; i++) {
    const an = (i / 4) * TAU + PI / 4;
    ell(ctx, Math.cos(an) * r * 0.55, Math.sin(an) * r * 0.55, r * 0.55, r * 0.55);
    ink(ctx, '#5fc046', 2.5);
  }
  ctx.restore();
}

const Pilz: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.5);
    const s = f.s;
    const jump = f.on ? hop(s, 0.2, 0.9) + hop(s, 1.0, 1.7) : 0;
    const land = f.on ? bump(s, 0.85, 1.05) + bump(s, 1.65, 1.9) : 0;
    const joy = f.on && s > 0.15;
    const wig = f.on ? Math.sin(s * 9) * 0.1 * ramp(s, 1.8, 2.0) : f.resting ? Math.sin(f.rest * 1.6) * 0.04 : 0;
    ctx.save();
    ctx.translate(0, -42 * jump);
    rotAt(ctx, 0, 135, wig);
    scaleAt(ctx, 0, 135, 1 + 0.1 * land, 1 - 0.1 * land);
    // stem
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.bezierCurveTo(-56, 60, -64, 108, -56, 128);
    ctx.quadraticCurveTo(0, 142, 56, 128);
    ctx.bezierCurveTo(64, 108, 56, 60, 46, 0);
    ctx.closePath();
    ink(ctx, shade(ctx, -10, 70, 70, '#ffffff', '#fff1dc', '#e2c9a6'));
    for (const sx of [-1, 1]) {
      if (joy) happyEye(ctx, sx * 21, 58, 12);
      else eye(ctx, sx * 21, 58, 12, 0, 0, f.blink);
    }
    cheek(ctx, -36, 76, 10);
    cheek(ctx, 36, 76, 10);
    if (joy) openMouth(ctx, 0, 88, 12, 9);
    else smile(ctx, 0, 86, 22);
    // cap, bouncing a little behind
    ctx.save();
    ctx.translate(0, 10 * land);
    ell(ctx, 0, 0, 124, 22);
    ink(ctx, '#f3dcb8', 5);
    const cap = () => {
      ctx.beginPath();
      ctx.moveTo(-140, -2);
      ctx.bezierCurveTo(-138, -160, 138, -160, 140, -2);
      ctx.quadraticCurveTo(0, 22, -140, -2);
      ctx.closePath();
    };
    cap();
    ink(ctx, shade(ctx, -20, -60, 140, '#ff8a7e', '#e8352d', '#a81c1c'));
    ctx.save();
    cap();
    ctx.clip();
    for (const [x, y, rx, ry] of [
      [-72, -60, 22, 17],
      [0, -94, 26, 17],
      [68, -56, 23, 18],
      [-22, -44, 13, 10],
      [108, -20, 12, 10],
      [-112, -24, 11, 9],
      [32, -22, 10, 8],
    ]) {
      ell(ctx, x, y, rx, ry);
      ink(ctx, '#ffffff', 3);
    }
    ctx.restore();
    shine(ctx, -60, -92, 28, 11, -0.4, 0.45);
    ctx.restore();
    ctx.restore();
    // lucky clovers and sparkles
    if (f.on)
      for (let i = 0; i < 4; i++) {
        const k = ramp(s, 0.3 + i * 0.5, 1.6 + i * 0.5);
        const an = i * 1.9 + 0.6;
        if (k > 0 && k < 1) {
          const x = Math.cos(an) * (90 + 50 * k);
          const y = -30 + Math.sin(an) * (60 + 40 * k) - 30 * k;
          if (i % 2) sparkle(ctx, x, y, 16, '#fff3a0', bump(k, 0, 1));
          else clover(ctx, x, y, 16, bump(k, 0, 1));
        }
      }
    if (f.resting) sparkle(ctx, 110, -110, 12 * Math.max(0, Math.sin(f.rest * 2)));
  },
};

const Apfel: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const bite = f.on ? ease.outBack(ramp(s, 0.25, 0.45)) : f.resting ? 1 : 0;
    const shock = f.on ? bump(s, 0.5, 1.7) : 0;
    const search = f.on ? ramp(s, 1.7, 1.9) * (1 - ramp(s, 3.3, 3.6)) : 0;
    const lookX = f.on ? (s < 1.7 ? 0.9 * ramp(s, 0.45, 0.6) : Math.sin((s - 1.7) * 6) * search) : f.resting ? Math.sin(f.rest * 0.8) * 0.4 : 0;
    const sway = f.on ? Math.sin((s - 1.7) * 6) * 0.06 * search : f.breathe * 0.02;
    ctx.save();
    rotAt(ctx, 0, 130, sway);
    const apple = () => {
      ctx.beginPath();
      ctx.moveTo(0, -72);
      ctx.bezierCurveTo(40, -112, 135, -86, 126, 8);
      ctx.bezierCurveTo(120, 92, 62, 134, 24, 126);
      ctx.quadraticCurveTo(0, 120, -24, 126);
      ctx.bezierCurveTo(-62, 134, -120, 92, -126, 8);
      ctx.bezierCurveTo(-135, -86, -40, -112, 0, -72);
      ctx.closePath();
    };
    const bites: [number, number, number][] = [
      [124, -26, 24],
      [114, 8, 28],
      [122, 42, 24],
    ];
    // stem and leaf
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.quadraticCurveTo(0, -100, 12, -118);
    tube(ctx, '#7a4a2a', 7);
    ctx.save();
    ctx.translate(12, -100);
    ctx.rotate(-0.4 + (alive ? Math.sin(t * 3) * 0.08 : 0));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(26, -28, 58, -6);
    ctx.quadraticCurveTo(28, 18, 0, 0);
    ctx.closePath();
    ink(ctx, lin(ctx, 0, -10, 50, 10, '#9be872', '#4fae3a'), 5);
    ctx.beginPath();
    ctx.moveTo(4, -1);
    ctx.lineTo(48, -5);
    line(ctx, 'rgba(50,110,40,0.6)', 2.5);
    ctx.restore();
    ctx.save();
    if (bite > 0)
      for (const [x, y, r] of bites) {
        ctx.beginPath();
        ctx.rect(-200, -200, 400, 400);
        ctx.arc(x, y, r * bite, 0, TAU);
        ctx.clip('evenodd');
      }
    apple();
    ink(ctx, shade(ctx, -10, 0, 126, '#ff8a7a', '#e8342f', '#a81a1f'), 0);
    if (bite > 0) {
      ctx.save();
      apple();
      ctx.clip();
      for (const [x, y, r] of bites) {
        ell(ctx, x, y, r * bite + 10, r * bite + 10);
        ctx.fillStyle = '#fff4d0';
        ctx.fill();
      }
      ell(ctx, 92, 4, 4, 7, 0.3);
      ctx.fillStyle = '#5a3418';
      ctx.fill();
      ctx.beginPath();
      for (const [x, y, r] of bites) {
        ctx.moveTo(x + r * bite, y);
        ctx.arc(x, y, r * bite, 0, TAU);
      }
      line(ctx, OL, 6);
      ctx.restore();
    }
    apple();
    line(ctx, OL, 6);
    ctx.restore();
    shine(ctx, -62, -48, 26, 13, -0.6, 0.5);
    // face
    for (const sx of [-1, 1]) eye(ctx, sx * 34 - 6, -4, 14 + shock * 4, lookX, -0.1, f.blink);
    cheek(ctx, -66, 26, 13);
    cheek(ctx, 52, 26, 13);
    if (shock > 0.1) openMouth(ctx, -6, 44, 9 + 4 * shock, 7 + 9 * shock);
    else if (search > 0.1) {
      ctx.beginPath();
      ctx.moveTo(-20, 44);
      ctx.quadraticCurveTo(-6, 36, 8, 46);
      line(ctx, OL, 5);
    } else smile(ctx, -6, 40, 28);
    ctx.restore();
    // crumbs fly off when it is bitten
    if (f.on && s > 0.25 && s < 1.2) {
      const k = ramp(s, 0.25, 1.2);
      for (let i = 0; i < 6; i++) {
        const an = -0.9 + i * 0.35;
        ell(ctx, 120 + Math.cos(an) * 60 * k, 10 + Math.sin(an) * 60 * k + 50 * k * k, 4, 3);
        ctx.fillStyle = `rgba(240,220,160,${1 - k})`;
        ctx.fill();
      }
    }
  },
};

const Katze: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const chin = f.on ? ramp(s, 0.2, 0.6) * (1 - ramp(s, 3.2, 3.6)) : 0;
    const purr = chin > 0.3 ? Math.sin(s * 70) * 1.5 : 0;
    const grey = '#a9abc4';
    const fur = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#d7d9ea', grey, '#7a7c9a');
    const sw = alive ? Math.sin((f.on ? s * 4 : f.rest * 1.3) + 1) * (f.on ? 22 : 10) : 0;
    ctx.save();
    ctx.translate(0, f.breathe * 1.2);
    // tail
    ctx.beginPath();
    ctx.moveTo(40, 126);
    ctx.quadraticCurveTo(128, 130, 120 + sw * 0.3, 50);
    ctx.quadraticCurveTo(116 + sw, 10, 96 + sw, 16);
    tube(ctx, grey, 16);
    // body
    ell(ctx, 0, 72, 66, 70);
    ink(ctx, fur(0, 72, 66));
    ell(ctx, 0, 84, 36, 48);
    ctx.fillStyle = '#f6f4fb';
    ctx.fill();
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 26, 136, 24, 14);
      ink(ctx, '#f6f4fb', 5);
    }
    // head
    ctx.save();
    ctx.translate(purr, -10 * chin);
    rotAt(ctx, 0, 0, 0.12 * chin * Math.sin(s * 2));
    for (const sx of [-1, 1]) {
      const twitch = f.resting && sx > 0 ? Math.max(0, Math.sin(f.rest * 4)) ** 8 * 0.2 : 0;
      ctx.save();
      rotAt(ctx, sx * 46, -92, twitch);
      ctx.beginPath();
      ctx.moveTo(sx * 76, -70);
      ctx.lineTo(sx * 68, -146);
      ctx.lineTo(sx * 18, -104);
      ctx.closePath();
      ink(ctx, fur(sx * 56, -110, 40));
      ctx.beginPath();
      ctx.moveTo(sx * 64, -86);
      ctx.lineTo(sx * 63, -128);
      ctx.lineTo(sx * 34, -104);
      ctx.closePath();
      ctx.fillStyle = '#ffb3c6';
      ctx.fill();
      ctx.restore();
    }
    ell(ctx, 0, -44, 82, 66);
    ink(ctx, fur(0, -44, 82));
    ctx.beginPath();
    for (const x of [-16, 0, 16]) {
      ctx.moveTo(x * 1.2, -106);
      ctx.lineTo(x, -86);
    }
    line(ctx, 'rgba(90,92,120,0.6)', 6);
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 15, -18, 19, 14);
      ink(ctx, '#f6f4fb', 3.5);
    }
    ctx.beginPath();
    ctx.moveTo(-9, -30);
    ctx.lineTo(9, -30);
    ctx.lineTo(0, -21);
    ctx.closePath();
    ink(ctx, '#ff8fab', 3.5);
    ctx.beginPath();
    ctx.moveTo(0, -21);
    ctx.lineTo(0, -14);
    ctx.moveTo(-12, -10);
    ctx.quadraticCurveTo(-6, -6, 0, -14);
    ctx.quadraticCurveTo(6, -6, 12, -10);
    line(ctx, OL, 3.5);
    ctx.beginPath();
    for (const sx of [-1, 1])
      for (const dy of [-14, 0, 14]) {
        ctx.moveTo(sx * 36, -20 + dy * 0.3);
        ctx.lineTo(sx * 104, -26 + dy);
      }
    line(ctx, OL, 3);
    for (const sx of [-1, 1]) {
      if (chin > 0.3) happyEye(ctx, sx * 30, -52, 15);
      else eye(ctx, sx * 30, -52, 15, 0, 0, f.blink);
    }
    cheek(ctx, -52, -26, 12, 0.35 + 0.3 * chin);
    cheek(ctx, 52, -26, 12, 0.35 + 0.3 * chin);
    ctx.restore();
    // scratching under the chin: little strokes and hearts
    if (chin > 0.3) {
      ctx.save();
      ctx.globalAlpha = chin;
      for (let i = 0; i < 3; i++) {
        const x = -22 + i * 22 + Math.sin(s * 14 + i) * 8;
        ctx.beginPath();
        ctx.moveTo(x - 8, 20);
        ctx.lineTo(x + 8, 26);
        line(ctx, OL, 4);
      }
      ctx.restore();
      for (let i = 0; i < 3; i++) {
        const k = ramp(s, 0.6 + i * 0.6, 1.8 + i * 0.6);
        if (k > 0 && k < 1) heart(ctx, (i - 1) * 60, -110 - k * 70, 15, '#ff5c8a', bump(k, 0, 1));
      }
    }
    ctx.restore();
  },
};

const Frosch: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const jump = f.on ? hop(s, 0.1, 0.9) : 0;
    const land = f.on ? bump(s, 0.85, 1.1) : 0;
    const kiss = f.on ? bump(s, 1.2, 2.5) : 0;
    const shy = f.on ? bump(s, 2.4, 3.6) : 0;
    const puff = f.on ? bump(s, 2.6, 3.5) : f.resting ? 0.25 + 0.25 * Math.sin(f.rest * 2.5) : 0;
    const green = '#6fcf4f';
    const skin = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#aef088', green, '#3f9a30');
    // lily pad
    ctx.beginPath();
    ctx.ellipse(0, 124, 150, 26, 0, -1.35, -1.85 + TAU);
    ctx.lineTo(0, 124);
    ctx.closePath();
    ink(ctx, lin(ctx, 0, 100, 0, 150, '#5dbb6a', '#2f8a45'), 5);
    ctx.save();
    ctx.translate(0, -80 * jump);
    scaleAt(ctx, 0, 120, 1 + 0.12 * land, 1 - 0.12 * land);
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 92, 92, 40, 28, sx * 0.3);
      ink(ctx, skin(sx * 92, 92, 40));
    }
    ell(ctx, 0, 40, 112, 72);
    ink(ctx, skin(0, 40, 112));
    ell(ctx, 0, 72, 62, 36);
    ctx.fillStyle = '#e6f7b0';
    ctx.fill();
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 52, -36, 38, 35);
      ink(ctx, skin(sx * 52, -36, 38));
      if (shy > 0.3) happyEye(ctx, sx * 52, -38, 22);
      else eye(ctx, sx * 52, -38, 23, 0, 0.1, f.blink);
    }
    cheek(ctx, -78, 14, 15, 0.4 + 0.4 * shy);
    cheek(ctx, 78, 14, 15, 0.4 + 0.4 * shy);
    for (const [x, y] of [
      [-30, 2],
      [-22, 6],
      [24, 0],
      [-60, 46],
    ]) {
      ell(ctx, x, y, 4, 3);
      ctx.fillStyle = 'rgba(40,110,30,0.4)';
      ctx.fill();
    }
    if (puff > 0.05) {
      ell(ctx, 0, 70, 22 + 30 * puff, 14 + 22 * puff);
      ink(ctx, shade(ctx, 0, 70, 40, '#ffffff', '#fbe9b8', '#e8c890'), 4);
    }
    if (kiss > 0.15) {
      ctx.save();
      ctx.translate(0, 30);
      ctx.scale(0.6 + 0.5 * kiss, 0.6 + 0.5 * kiss);
      ell(ctx, 0, -6, 14, 9);
      ink(ctx, '#ff6f9a', 4);
      ell(ctx, 0, 7, 14, 9);
      ink(ctx, '#ff6f9a', 4);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.moveTo(-74, 22);
      ctx.quadraticCurveTo(0, 74, 74, 22);
      line(ctx, OL, 5.5);
    }
    for (const sx of [-1, 1]) {
      ell(ctx, sx * 40, 110, 26, 13);
      ink(ctx, skin(sx * 40, 110, 26), 5);
      for (const k of [-1, 0, 1]) {
        ell(ctx, sx * 40 + k * 15, 120, 6, 5);
        ink(ctx, green, 3);
      }
    }
    ctx.restore();
    if (kiss > 0.15) heart(ctx, 84 + 40 * ramp(s, 1.4, 2.5), 40 - 130 * ramp(s, 1.4, 2.5), 20, '#ff5c8a', bump(s, 1.4, 2.6));
  },
};

const Ball: Picto = {
  anim: 3.2,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.2);
    const s = f.s;
    const R = 100;
    const ground = 124;
    let y = 0;
    let sq = 0;
    if (f.on) {
      for (const [a, b, h] of [
        [0, 1.2, 110],
        [1.2, 2.2, 70],
        [2.2, 3.0, 35],
      ]) {
        if (s >= a && s < b) {
          const u = (s - a) / (b - a);
          y = -h * 4 * u * (1 - u);
          const edge = Math.min(u, 1 - u);
          sq = edge < 0.08 ? (1 - edge / 0.08) * 0.16 * (h / 110 + 0.3) : 0;
        }
      }
    } else if (f.resting) y = -10 * Math.abs(Math.sin(f.rest * 2));
    const rot = f.on ? s * 3 : f.resting ? 0 : 0;
    // shadow
    ell(ctx, 0, ground + 6, R * (0.9 + y / 400), 12);
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fill();
    ctx.save();
    ctx.translate(0, y);
    scaleAt(ctx, 0, ground, 1 + sq, 1 - sq);
    const cy = ground - R;
    ctx.save();
    ell(ctx, 0, cy, R, R);
    ctx.clip();
    const cols = ['#ff4b5c', '#ffffff', '#ffd23f', '#3fa9f5', '#ffffff', '#5fd46b'];
    const px = -28;
    const py = cy - 38;
    for (let i = 0; i < 6; i++) {
      const a0 = rot + (i / 6) * TAU;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, 260, a0, a0 + TAU / 6);
      ctx.closePath();
      ctx.fillStyle = cols[i];
      ctx.fill();
    }
    const g = ctx.createRadialGradient(-40, cy - 40, 10, 0, cy, R * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,0.3)');
    g.addColorStop(0.6, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(60,20,60,0.3)');
    ctx.fillStyle = g;
    ctx.fillRect(-R, cy - R, R * 2, R * 2);
    ell(ctx, px, py, 14, 14);
    ink(ctx, '#ffffff', 3);
    ctx.restore();
    ell(ctx, 0, cy, R, R);
    line(ctx, OL, 6);
    shine(ctx, -46, cy - 52, 24, 11);
    // face
    const fun = f.on && Math.abs(y) > 20;
    for (const sx of [-1, 1]) {
      if (fun) happyEye(ctx, sx * 30, cy + 8, 15);
      else eye(ctx, sx * 30, cy + 8, 15, 0, 0, f.blink);
    }
    cheek(ctx, -56, cy + 30, 12);
    cheek(ctx, 56, cy + 30, 12);
    if (fun) openMouth(ctx, 0, cy + 42, 14, 12);
    else smile(ctx, 0, cy + 40, 30);
    ctx.restore();
  },
};

const Pinguin: Picto = {
  anim: 3.6,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 3.6);
    const s = f.s;
    const waddle = f.on ? Math.sin(s * 8) * bump(s, 0, 2.1) : f.resting ? Math.sin(f.rest * 1.6) * 0.25 : 0;
    const fix = f.on ? bump(s, 2.0, 3.5) : 0;
    const proud = f.on ? ramp(s, 2.6, 2.9) * (1 - ramp(s, 3.3, 3.6)) : 0;
    const dark = '#2c3148';
    const coat = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#5a6283', dark, '#191c2b');
    ctx.save();
    rotAt(ctx, 0, 140, waddle * 0.14);
    // flippers (the left one reaches for the bow tie in front of the body)
    const flipper = (sx: number) => {
      const flap = f.on ? -sx * (0.2 + Math.sin(s * 16) * 0.3) * bump(s, 0, 2.1) - (sx < 0 ? 1.15 * fix : 0) : 0;
      ctx.save();
      rotAt(ctx, sx * 70, -30, flap);
      ell(ctx, sx * 88, 20, 22, 58, -sx * 0.35);
      ink(ctx, coat(sx * 88, 20, 50));
      ctx.restore();
    };
    flipper(1);
    if (fix <= 0.05) flipper(-1);
    // body
    ell(ctx, 0, 5, 88, 126);
    ink(ctx, coat(0, 0, 110));
    ctx.save();
    ell(ctx, 0, 5, 88, 126);
    ctx.clip();
    ctx.fillStyle = '#fbfbff';
    ell(ctx, 0, 40, 64, 94);
    ctx.fill();
    ell(ctx, -26, -56, 32, 32);
    ctx.fill();
    ell(ctx, 26, -56, 32, 32);
    ctx.fill();
    ctx.restore();
    for (const y of [40, 70]) {
      ell(ctx, 0, y, 5, 5);
      ctx.fillStyle = dark;
      ctx.fill();
    }
    // face
    for (const sx of [-1, 1]) {
      if (proud > 0.3) happyEye(ctx, sx * 26, -58, 13);
      else eye(ctx, sx * 26, -58, 13, 0, 0, f.blink);
    }
    cheek(ctx, -46, -30, 11);
    cheek(ctx, 46, -30, 11);
    ctx.beginPath();
    ctx.moveTo(-17, -40);
    ctx.quadraticCurveTo(0, -46, 17, -40);
    ctx.lineTo(0, -16);
    ctx.closePath();
    ink(ctx, '#ffa43a', 4);
    if (fix > 0.05) flipper(-1);
    // bow tie of the tailcoat
    const bs = 1 + 0.3 * proud + 0.1 * Math.sin(s * 20) * fix;
    ctx.save();
    ctx.translate(0, 6);
    ctx.scale(bs, bs);
    ctx.rotate(Math.sin(s * 12) * 0.15 * fix);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(sx * 28, -13);
      ctx.lineTo(sx * 28, 13);
      ctx.closePath();
      ink(ctx, '#e83a5a', 4);
    }
    ell(ctx, 0, 0, 8, 8);
    ink(ctx, '#ff6f87', 4);
    ctx.restore();
    if (proud > 0.1) {
      sparkle(ctx, 44, -4, 14 * proud);
      sparkle(ctx, -40, 20, 9 * proud);
    }
    // feet
    for (const sx of [-1, 1]) {
      const lift = f.on ? Math.max(0, Math.sin(s * 8) * sx) * 12 * bump(s, 0, 2.1) : 0;
      ell(ctx, sx * 34, 130 - lift, 30, 12);
      ink(ctx, '#ffa43a', 5);
    }
    ctx.restore();
  },
};

const Schuh: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4);
    const s = f.s;
    const turn = f.on ? ramp(s, 0.4, 0.75) - ramp(s, 1.6, 1.95) : 0;
    const dir = Math.cos(turn * PI);
    const hopY = f.on ? 22 * (hop(s, 0.85, 1.25) + hop(s, 2.05, 2.45)) : 0;
    const ask = f.on ? ramp(s, 2.3, 2.6) : 0;
    const look = f.on ? (s < 0.4 ? 1 : Math.sin(s * 5)) : f.resting ? Math.sin(f.rest * 0.9) * 0.6 : 0;
    const red = '#e8473f';
    ctx.save();
    ctx.translate(0, 8 - hopY + f.breathe);
    ctx.scale(Math.sign(dir || 1) * Math.max(0.45, Math.abs(dir)), 1);
    const upper = () => {
      ctx.beginPath();
      ctx.moveTo(-128, 92);
      ctx.lineTo(-132, -20);
      ctx.quadraticCurveTo(-128, -52, -95, -50);
      ctx.quadraticCurveTo(-64, -34, -38, -50);
      ctx.lineTo(-32, -80);
      ctx.quadraticCurveTo(-14, -94, 0, -76);
      ctx.lineTo(62, -16);
      ctx.quadraticCurveTo(128, -2, 138, 60);
      ctx.quadraticCurveTo(140, 92, 116, 92);
      ctx.closePath();
    };
    upper();
    ink(ctx, shade(ctx, -10, 0, 140, '#ff8a7e', red, '#b02a28'));
    ctx.save();
    upper();
    ctx.clip();
    ell(ctx, 128, 74, 52, 42);
    ctx.fillStyle = '#f7f5f0';
    ctx.fill();
    line(ctx, OL, 5);
    ctx.beginPath();
    ctx.moveTo(-132, 40);
    ctx.quadraticCurveTo(-40, 20, 30, 64);
    line(ctx, '#ffffff', 9);
    ctx.restore();
    upper();
    line(ctx, OL, 6);
    // laces
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 17;
      const y = -66 + i * 16;
      ctx.beginPath();
      ctx.moveTo(x - 16, y - 2);
      ctx.lineTo(x + 6, y + 14);
      ctx.moveTo(x - 10, y + 14);
      ctx.lineTo(x + 2, y - 4);
      line(ctx, OL, 9);
      line(ctx, '#ffffff', 4.5);
    }
    ctx.beginPath();
    ctx.moveTo(-6, -74);
    ctx.quadraticCurveTo(-30, -112, -12, -116);
    ctx.quadraticCurveTo(4, -108, -6, -74);
    ctx.quadraticCurveTo(18, -108, 32, -96);
    line(ctx, OL, 8);
    line(ctx, '#ffffff', 3.5);
    // sole
    rr(ctx, -138, 88, 282, 30, 14);
    ink(ctx, lin(ctx, 0, 88, 0, 118, '#ffffff', '#d9d4cc'), 6);
    ctx.beginPath();
    for (let x = -110; x < 130; x += 26) {
      ctx.moveTo(x, 106);
      ctx.lineTo(x + 12, 106);
    }
    line(ctx, 'rgba(120,110,100,0.5)', 3);
    // face
    for (const [x, y] of [
      [38, 22],
      [80, 28],
    ])
      eye(ctx, x, y, 13, look, -0.1, f.blink);
    cheek(ctx, 104, 52, 10);
    if (ask > 0.1) {
      ctx.beginPath();
      ctx.moveTo(52, 62);
      ctx.quadraticCurveTo(64, 54, 76, 62);
      line(ctx, OL, 5);
    } else smile(ctx, 62, 58, 24);
    ctx.restore();
    // where is my other shoe?
    if (ask > 0.01) {
      ctx.save();
      ctx.globalAlpha = ask;
      ctx.translate(-70, -118 + Math.sin(s * 5) * 6);
      ctx.rotate(Math.sin(s * 3) * 0.15);
      ctx.beginPath();
      ctx.moveTo(-16, -14);
      ctx.quadraticCurveTo(-16, -36, 2, -36);
      ctx.quadraticCurveTo(20, -36, 18, -18);
      ctx.quadraticCurveTo(16, -6, 2, -2);
      ctx.lineTo(2, 10);
      tube(ctx, '#7f8cff', 8);
      ell(ctx, 2, 26, 6, 6);
      ink(ctx, '#7f8cff', 4);
      ctx.restore();
    }
  },
};

const Ziege: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const f = ph(t, alive, 4);
    const s = f.s;
    const paperIn = f.on ? ease.outCubic(ramp(s, 0.05, 0.6)) : 0;
    const eaten = f.on ? ramp(s, 0.7, 3.2) : 1;
    const chewing = f.on ? s > 0.6 && s < 3.3 : f.resting;
    const jaw = chewing ? Math.abs(Math.sin((f.on ? s : f.rest) * (f.on ? 13 : 4))) * (f.on ? 1 : 0.5) : 0;
    const burp = f.on ? bump(s, 3.25, 4.0) : 0;
    const white = '#f7f3ea';
    const fur = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#ffffff', white, '#cfc4b0');
    ctx.save();
    ctx.translate(-14, f.breathe * 1.2);
    // tail
    ctx.beginPath();
    ctx.moveTo(-96, 0);
    ctx.lineTo(-114, -26 + (alive ? Math.sin(t * 9) * 5 : 0));
    ctx.lineTo(-86, -10);
    ctx.closePath();
    ink(ctx, white, 5);
    for (const [x, far] of [
      [-52, 1],
      [36, 1],
      [-74, 0],
      [58, 0],
    ]) {
      rr(ctx, x - 9, 50, 18, 80, 8);
      ink(ctx, far ? '#ddd5c4' : white, 5);
      rr(ctx, x - 11, 122, 22, 14, 4);
      ink(ctx, '#5a4a42', 5);
    }
    ctx.beginPath();
    ctx.moveTo(36, 10);
    ctx.lineTo(58, -54);
    ctx.lineTo(100, -42);
    ctx.lineTo(78, 30);
    ctx.closePath();
    ink(ctx, white);
    ell(ctx, -12, 34, 92, 50);
    ink(ctx, fur(-12, 34, 92));
    ctx.save();
    ell(ctx, -12, 34, 92, 50);
    ctx.clip();
    ell(ctx, -38, 22, 34, 24, 0.2);
    ctx.fillStyle = '#d9b98f';
    ctx.fill();
    ctx.restore();
    // head
    ctx.save();
    rotAt(ctx, 70, -40, burp * -0.2);
    for (const k of [0, 1]) {
      ctx.beginPath();
      ctx.moveTo(62 + k * 16, -74);
      ctx.quadraticCurveTo(52 + k * 14, -116, 18 + k * 18, -112);
      tube(ctx, k ? '#d8b58a' : '#c9a47a', 10);
    }
    ell(ctx, 46, -58, 28, 11, 0.45);
    ink(ctx, fur(46, -58, 28), 5);
    ell(ctx, 90, -50, 44, 31, 0.55);
    ink(ctx, fur(90, -50, 44));
    // beard
    ctx.beginPath();
    ctx.moveTo(96, -14);
    ctx.quadraticCurveTo(100, 18, 92, 34 + jaw * 4);
    ctx.quadraticCurveTo(84, 14, 80, -16);
    ctx.closePath();
    ink(ctx, '#e8e0d0', 5);
    ell(ctx, 116, -26, 25, 21, 0.5);
    ink(ctx, shade(ctx, 116, -26, 25, '#ffffff', '#f8e8e4', '#e0c4bc'), 5);
    ell(ctx, 128, -34, 3.5, 5, 0.5);
    ctx.fillStyle = OL;
    ctx.fill();
    eye(ctx, 86, -62, 12, 0.6, 0, f.blink);
    cheek(ctx, 104, -38, 9);
    // the homework sheet in its mouth
    const L = 74 * (1 - eaten);
    if (f.on && L > 2) {
      ctx.save();
      ctx.translate(124, -8 + jaw * 3);
      ctx.rotate(0.55);
      ctx.translate(0, 40 * (1 - paperIn));
      ctx.globalAlpha = Math.min(1, paperIn * 2);
      ctx.beginPath();
      ctx.moveTo(-4, -22);
      for (let i = 0; i <= 6; i++) ctx.lineTo(-4 + (i % 2) * 6, -22 + (i / 6) * 44);
      ctx.lineTo(L, 22);
      ctx.lineTo(L, -22);
      ctx.closePath();
      ink(ctx, '#ffffff', 4);
      ctx.beginPath();
      for (const y of [-10, 2, 14]) {
        ctx.moveTo(6, y);
        ctx.lineTo(L - 6, y);
      }
      line(ctx, 'rgba(70,130,230,0.6)', 2.5);
      ctx.restore();
    }
    if (burp > 0.05) {
      openMouth(ctx, 122, -6, 10, 4 + 8 * burp);
      ell(ctx, 152 + burp * 10, -30 - burp * 16, 10 + 10 * burp, 8 + 8 * burp);
      ctx.save();
      ctx.globalAlpha = burp;
      ink(ctx, '#ffffff', 3);
      ctx.restore();
    } else if (jaw > 0.1) openMouth(ctx, 122, -6, 9, 2 + jaw * 6);
    else {
      ctx.beginPath();
      ctx.moveTo(110, -8);
      ctx.quadraticCurveTo(122, -2, 134, -10);
      line(ctx, OL, 4.5);
    }
    ctx.restore();
    ctx.restore();
    // paper bits fly off while chewing
    if (f.on && s > 0.7 && s < 3.2)
      for (let i = 0; i < 3; i++) {
        const k = (s * 1.3 + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.translate(112 + k * 50 + i * 8, -6 + k * 70 - 40 * k * (1 - k));
        ctx.rotate(k * 6 + i);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = OL;
        ctx.lineWidth = 2;
        ctx.fillRect(-6, -4, 12, 8);
        ctx.strokeRect(-6, -4, 12, 8);
        ctx.restore();
      }
  },
};

export const gruppe1: Record<string, Picto> = {
  Oma,
  Eis,
  Esel,
  Sofa,
  Mond,
  Tor,
  Dino,
  Hund,
  Ampel,
  Tiger,
  Burg,
  Gras,
  Gurke,
  Pilz,
  Apfel,
  Katze,
  Frosch,
  Ball,
  Pinguin,
  Schuh,
  Ziege,
};

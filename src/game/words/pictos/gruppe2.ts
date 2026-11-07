// Pictures of the Wörter-Zoo, group 2: Opa, Ei, Igel, Limo, Nest, Eule, Rabe, Hase, Kerze, Banane, Brot, Kran,
// Löwe, Kamel, Fisch, Schule, Fuchs, Puppe, Elefant, Kuh, Spinne. Each is drawn around (0, 0) in the style of
// the creatures (thick dark outline, round shapes, gloss, big eyes, blush) and comes alive with a funny moment
// that fits what it says in words.ts, then rests in a calm loop.
import { crown } from '../../creatures/parts.ts';
import type { Ctx2D, Picto } from '../picto.ts';

type C = Ctx2D;
const TAU = Math.PI * 2;
const OL = '#3a2734';

// ---------- time ----------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** smooth 0 -> 1 between a and b */
const ramp = (x: number, a: number, b: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** 0 -> 1 -> 0 between a and b */
const bell = (x: number, a: number, b: number) => (x <= a || x >= b ? 0 : Math.sin((Math.PI * (x - a)) / (b - a)));

interface Life {
  /** time inside the funny animation (0 while still, anim afterwards) */
  a: number;
  /** playing the funny animation */
  on: boolean;
  /** resting after it */
  rest: boolean;
  /** time since the rest began */
  r: number;
}

function life(t: number, alive: boolean, anim: number): Life {
  return { a: alive ? Math.min(t, anim) : 0, on: alive && t < anim, rest: alive && t >= anim, r: alive && t >= anim ? t - anim : 0 };
}

/** 1 for a short moment every period seconds (calm blinking) */
const blink = (t: number, period = 3.4, off = 1.3) => (((t + off) % period) + period) % period < 0.14 ? 1 : 0;

// ---------- drawing parts ----------

function paint(ctx: C, fill: string | CanvasGradient, lw = 6, stroke = OL): void {
  ctx.fillStyle = fill;
  ctx.fill();
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

function ell(ctx: C, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient, rot = 0, lw = 6, stroke = OL): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  paint(ctx, fill, lw, stroke);
}

function line(ctx: C, pts: number[], lw = 5, color = OL): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/** soft round light from the top left */
function shade(ctx: C, x: number, y: number, r: number, light: string, base: string, dark: string): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y, r * 1.15);
  g.addColorStop(0, light);
  g.addColorStop(0.55, base);
  g.addColorStop(1, dark);
  return g;
}

function gloss(ctx: C, x: number, y: number, rx: number, ry: number, rot = -0.5, a = 0.55): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}

function ground(ctx: C, x: number, y: number, rx: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, rx * 0.16, 0, 0, TAU);
  ctx.fillStyle = 'rgba(60,40,70,0.16)';
  ctx.fill();
}

interface EyeOpts {
  /** 0 open .. 1 closed */
  shut?: number;
  /** look direction, -1..1 */
  lx?: number;
  ly?: number;
  /** closed happy arc ^ */
  happy?: boolean;
}

function eye(ctx: C, x: number, y: number, r: number, o: EyeOpts = {}): void {
  const shut = o.shut ?? 0;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  if (o.happy) {
    ctx.lineWidth = Math.max(3, r * 0.32);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.35, r * 0.75, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (shut > 0.85) {
    ctx.lineWidth = Math.max(3, r * 0.28);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.8, y);
    ctx.quadraticCurveTo(x, y + r * 0.5, x + r * 0.8, y);
    ctx.stroke();
  } else {
    ctx.translate(x, y);
    ctx.scale(1, 1 - shut * 0.9);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.lineWidth = Math.max(2.5, r * 0.16);
    ctx.stroke();
    const px = (o.lx ?? 0.15) * r * 0.35;
    const py = (o.ly ?? 0) * r * 0.35;
    const pr = r * 0.62;
    ctx.fillStyle = '#2a1d33';
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(120,90,200,0.35)';
    ctx.beginPath();
    ctx.arc(px, py + pr * 0.35, pr * 0.6, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(px - pr * 0.35, py - pr * 0.38, pr * 0.34, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + pr * 0.32, py + pr * 0.3, pr * 0.15, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function cheek(ctx: C, x: number, y: number, r: number, a = 0.45): void {
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
  ctx.fillStyle = `rgba(255,110,150,${a})`;
  ctx.fill();
}

/** smile of width w; open 0..1 opens it into a laughing mouth */
function smile(ctx: C, x: number, y: number, w: number, open = 0): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = Math.max(3, w * 0.14);
  if (open > 0.05) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y - w * 0.05);
    ctx.quadraticCurveTo(x, y - w * 0.05 + w * 0.15, x + w * 0.5, y - w * 0.05);
    ctx.quadraticCurveTo(x, y + w * (0.25 + open * 0.6), x - w * 0.5, y - w * 0.05);
    ctx.closePath();
    ctx.fillStyle = '#7a2340';
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ff8fa8';
    ctx.beginPath();
    ctx.ellipse(x, y + w * (0.2 + open * 0.45), w * 0.26, w * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(x, y - w * 0.25, w * 0.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

/** small round "o" mouth (surprised, blowing, singing) */
function oMouth(ctx: C, x: number, y: number, r: number): void {
  ell(ctx, x, y, r * 0.8, r, '#7a2340', 0, Math.max(2.5, r * 0.35));
}

function sparkle(ctx: C, x: number, y: number, r: number, color = '#fff6a8'): void {
  if (r <= 0.5) return;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const rr = i % 2 ? r * 0.32 : r;
    if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  paint(ctx, color, 2.5, '#8a6a20');
}

function drop(ctx: C, x: number, y: number, r: number, fill = '#7cc8ff', lw = 3): void {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2);
  ctx.quadraticCurveTo(x + r * 0.9, y - r * 0.9, x + r, y);
  ctx.arc(x, y, r, 0, Math.PI);
  ctx.quadraticCurveTo(x - r * 0.9, y - r * 0.9, x, y - r * 2);
  ctx.closePath();
  paint(ctx, fill, lw, '#2f5f8a');
  gloss(ctx, x - r * 0.35, y - r * 0.2, r * 0.22, r * 0.4, 0, 0.7);
}

/** sound waves: n arcs around angle dir, k (0..1) lets them travel outwards */
function sound(ctx: C, x: number, y: number, dir: number, k: number, n = 3, lw = 5): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = OL;
  ctx.lineWidth = lw;
  for (let i = 0; i < n; i++) {
    const rr = 16 + i * 15 + (k % 1) * 15;
    ctx.globalAlpha = Math.max(0, 1 - (i + (k % 1)) / n);
    ctx.beginPath();
    ctx.arc(x, y, rr, dir - 0.55, dir + 0.55);
    ctx.stroke();
  }
  ctx.restore();
}

/** quick motion lines */
function whoosh(ctx: C, x: number, y: number, len: number, n = 3, gap = 16, alpha = 1): void {
  if (alpha <= 0.02) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) line(ctx, [x, y + i * gap, x + len * (1 - i * 0.2), y + i * gap], 4, 'rgba(58,39,52,0.7)');
  ctx.restore();
}

function bubble(ctx: C, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(220,245,255,0.55)';
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.strokeStyle = '#4a7fa8';
  ctx.stroke();
  gloss(ctx, x - r * 0.35, y - r * 0.35, r * 0.28, r * 0.18, -0.6, 0.9);
}

// ---------- the pictures ----------

const Opa: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // glasses fly up to the forehead, he looks for them, they drop back on the nose
    const up = L.on ? ramp(a, 0, 0.35) * (1 - ramp(a, 3.0, 3.35)) : 0;
    const search = L.on ? bell(a, 0.4, 3.0) : 0;
    const turn = Math.sin((a - 0.4) * 4.2) * search;
    const found = L.on ? bell(a, 3.3, 4) : 0;
    const bob = L.rest ? Math.sin(L.r * 2) * 2 : Math.abs(Math.sin(a * 8)) * -3 * search;
    ctx.save();
    // body: cardigan, shirt, bow tie
    ctx.beginPath();
    ctx.moveTo(-128, 150);
    ctx.quadraticCurveTo(-124, 62, -48, 56);
    ctx.lineTo(48, 56);
    ctx.quadraticCurveTo(124, 62, 128, 150);
    ctx.closePath();
    paint(ctx, shade(ctx, 0, 90, 130, '#c79a68', '#a77b4f', '#7e5634'));
    ctx.beginPath();
    ctx.moveTo(-34, 56);
    ctx.lineTo(34, 56);
    ctx.lineTo(0, 120);
    ctx.closePath();
    paint(ctx, '#cfe6ff', 5);
    for (const by of [128, 146]) ell(ctx, 0, by - 4, 6, 6, '#e8d2a6', 0, 3);
    ctx.save();
    ctx.translate(turn * 6, bob);
    // bow tie
    ctx.beginPath();
    ctx.moveTo(0, 68);
    ctx.lineTo(-24, 56);
    ctx.lineTo(-24, 82);
    ctx.closePath();
    ctx.moveTo(0, 68);
    ctx.lineTo(24, 56);
    ctx.lineTo(24, 82);
    ctx.closePath();
    paint(ctx, '#e04a5a', 4);
    ell(ctx, 0, 68, 7, 8, '#c23246', 0, 4);
    ctx.restore();
    // head
    ctx.save();
    ctx.translate(turn * 14, bob);
    ctx.rotate(turn * 0.08);
    const skin = shade(ctx, 0, -35, 80, '#ffe0c0', '#f4c9a0', '#dca27a');
    ell(ctx, -72, -32, 15, 21, '#f0bf94');
    ell(ctx, 72, -32, 15, 21, '#f0bf94');
    ell(ctx, 0, -35, 72, 82, skin);
    gloss(ctx, -26, -96, 22, 9, -0.3, 0.6);
    // forehead wrinkles
    for (const wy of [-88, -78]) {
      ctx.beginPath();
      ctx.moveTo(-26, wy);
      ctx.quadraticCurveTo(0, wy - 6 - search * 4, 26, wy);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(150,90,60,0.6)';
      ctx.stroke();
    }
    // white hair puffs at the sides
    for (const sx of [-1, 1]) {
      for (const [hx, hy, hr] of [
        [62, -68, 20],
        [74, -48, 18],
        [70, -84, 14],
      ])
        ell(ctx, sx * hx, hy, hr, hr, '#f2f2f6', 0, 4, '#8a8496');
    }
    // eyes (looking around while searching)
    const lx = L.on ? Math.sign(turn) * Math.min(1, Math.abs(turn) * 3) : 0.1;
    const shut = blink(L.rest ? L.r : a + 1.2, 3.6);
    const happy = found > 0.3;
    eye(ctx, -28, -40, 11, { shut, lx, happy });
    eye(ctx, 28, -40, 11, { shut, lx, happy });
    // bushy eyebrows (raised while searching)
    const brow = -60 - search * 9;
    ell(ctx, -30, brow, 20, 8, '#f2f2f6', 0.12, 3.5, '#8a8496');
    ell(ctx, 30, brow, 20, 8, '#f2f2f6', -0.12, 3.5, '#8a8496');
    // nose and cheeks
    cheek(ctx, -46, -6, 13);
    cheek(ctx, 46, -6, 13);
    ell(ctx, 0, -14, 15, 13, '#f0a888', 0, 4);
    gloss(ctx, -5, -19, 5, 3, -0.4, 0.7);
    // mouth below the moustache
    if (search > 0.2) oMouth(ctx, 0, 24, 7);
    else smile(ctx, 0, 22, 30);
    // big white moustache
    ell(ctx, -22, 4, 28, 13, '#f7f7fa', 0.25, 4, '#8a8496');
    ell(ctx, 22, 4, 28, 13, '#f7f7fa', -0.25, 4, '#8a8496');
    // glasses: on the nose, or up on the forehead
    const gy = -40 - up * 50;
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#4a3a2a';
    ctx.beginPath();
    ctx.arc(-28, gy, 22, 0, TAU);
    ctx.moveTo(50, gy);
    ctx.arc(28, gy, 22, 0, TAU);
    ctx.moveTo(-6, gy - 2);
    ctx.quadraticCurveTo(0, gy - 8, 6, gy - 2);
    ctx.moveTo(-50, gy - 2);
    ctx.lineTo(-68, gy - 8 + up * 10);
    ctx.moveTo(50, gy - 2);
    ctx.lineTo(68, gy - 8 + up * 10);
    ctx.fillStyle = 'rgba(200,230,255,0.25)';
    ctx.fill();
    ctx.stroke();
    gloss(ctx, -36, gy - 8, 7, 3, -0.6, 0.8);
    gloss(ctx, 20, gy - 8, 7, 3, -0.6, 0.8);
    if (found > 0) {
      sparkle(ctx, 60, gy - 22, 14 * found);
      sparkle(ctx, -62, gy - 26, 10 * found);
    }
    ctx.restore();
    ctx.restore();
  },
};

/** egg outline, a bit wider at the bottom */
function eggPath(ctx: C, cx: number, cy: number, w: number, h: number): void {
  ctx.beginPath();
  for (let i = 0; i <= 64; i++) {
    const th = (i / 64) * TAU;
    const s = Math.sin(th);
    const x = cx + Math.cos(th) * w * (1 + 0.1 * s);
    const y = cy + s * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function chick(ctx: C, x: number, y: number, r: number, shut: number, beak: number, lx = 0.1): void {
  // tuft
  ell(ctx, x - 4, y - r * 0.98, 7, 14, '#ffd84a', -0.3, 4);
  ell(ctx, x + 6, y - r * 0.95, 6, 12, '#ffd84a', 0.4, 4);
  ell(ctx, x, y, r, r * 0.95, shade(ctx, x, y, r, '#fff5a8', '#ffe04a', '#f0b82a'));
  gloss(ctx, x - r * 0.35, y - r * 0.5, r * 0.25, r * 0.12);
  eye(ctx, x - r * 0.35, y - r * 0.12, r * 0.2, { shut, lx });
  eye(ctx, x + r * 0.35, y - r * 0.12, r * 0.2, { shut, lx });
  cheek(ctx, x - r * 0.6, y + r * 0.22, r * 0.16);
  cheek(ctx, x + r * 0.6, y + r * 0.22, r * 0.16);
  // beak, opening
  ctx.beginPath();
  ctx.moveTo(x - r * 0.18, y + r * 0.12);
  ctx.lineTo(x, y + r * 0.02 - beak * r * 0.12);
  ctx.lineTo(x + r * 0.18, y + r * 0.12);
  ctx.closePath();
  paint(ctx, '#ff9a2e', 3.5);
  ctx.beginPath();
  ctx.moveTo(x - r * 0.16, y + r * 0.16);
  ctx.lineTo(x, y + r * 0.3 + beak * r * 0.15);
  ctx.lineTo(x + r * 0.16, y + r * 0.16);
  ctx.closePath();
  paint(ctx, '#f07a1e', 3.5);
}

const Ei: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const W = 88;
    const H = 112;
    const cy = 8;
    const crackY = -14;
    // wobble, crack, the top pops off and a chick peeks out
    const wob = L.on ? Math.sin(a * 15) * 0.13 * bell(a, 0, 1.7) : L.rest ? Math.sin(L.r * 1.6) * 0.03 : 0;
    const crack = L.on ? ramp(a, 0.9, 1.5) : L.rest ? 1 : 0;
    const open = alive ? ramp(a, 1.6, 2.0) : 0;
    const rise = alive ? ramp(a, 1.7, 2.3) : 0;
    const lift = open * (1 - ramp(a, 2.4, 3.0) * 0.35);
    ground(ctx, 0, cy + H + 8, 80);
    ctx.save();
    ctx.translate(0, cy + H);
    ctx.rotate(wob);
    ctx.translate(0, -(cy + H));
    // zigzag of the crack
    const zig: [number, number][] = [];
    for (let i = 0; i <= 10; i++) zig.push([-W * 1.15 + (i * W * 2.3) / 10, crackY + (i % 2 ? -13 : 11)]);
    const zigPath = (toY: number) => {
      ctx.beginPath();
      ctx.moveTo(-200, zig[0][1]);
      for (const [x, y] of zig) ctx.lineTo(x, y);
      ctx.lineTo(200, zig[zig.length - 1][1]);
      ctx.lineTo(200, toY);
      ctx.lineTo(-200, toY);
      ctx.closePath();
    };
    const fill = shade(ctx, 0, cy, H, '#fffaf0', '#fff1d6', '#ecd3a4');
    if (open <= 0) {
      eggPath(ctx, 0, cy, W, H);
      paint(ctx, fill);
      gloss(ctx, -32, cy - 60, 20, 11, -0.6);
      for (const [sx, sy] of [
        [30, -20],
        [-20, 60],
        [40, 70],
        [-45, 10],
      ])
        ell(ctx, sx, sy, 4, 3, 'rgba(200,160,110,0.5)', 0, 0);
      if (crack > 0) {
        const n = Math.max(1, Math.round(crack * (zig.length - 1)));
        ctx.save();
        eggPath(ctx, 0, cy, W, H);
        ctx.clip();
        line(ctx, zig.slice(0, n + 1).flat(), 4.5);
        ctx.restore();
      }
    } else {
      // the chick inside
      const cyChick = crackY + 30 - rise * 60;
      const shut = L.rest ? blink(L.r, 3) : a < 2.3 ? 1 : 0;
      const beak = L.on ? bell(a, 2.6, 3.1) + bell(a, 3.2, 3.7) : 0;
      const look = L.on ? Math.sin((a - 2.3) * 5) * bell(a, 2.3, 4) : 0.1;
      chick(ctx, 0, cyChick, 50, shut, beak, look);
      // lower shell
      ctx.save();
      zigPath(200);
      ctx.clip();
      eggPath(ctx, 0, cy, W, H);
      paint(ctx, fill);
      ctx.restore();
      line(ctx, zig.flat(), 5);
      // upper shell as a hat
      ctx.save();
      const hatY = -55 * lift - rise * 20;
      ctx.translate(-8 * lift, hatY);
      ctx.rotate(-0.35 * lift);
      zigPath(-200);
      ctx.clip();
      eggPath(ctx, 0, cy, W, H);
      paint(ctx, fill);
      gloss(ctx, -32, cy - 60, 20, 11, -0.6);
      ctx.restore();
      if (L.on && a < 2.6) {
        sparkle(ctx, -95, -40, 14 * bell(a, 1.6, 2.6));
        sparkle(ctx, 95, -60, 12 * bell(a, 1.6, 2.6));
      }
    }
    ctx.restore();
  },
};

const Igel: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // spikes bristle up and quiver, then he relaxes
    const angry = L.on ? ramp(a, 0, 0.3) * (1 - ramp(a, 2.6, 3.3)) : 0;
    const quiver = Math.sin(a * 45) * angry;
    const breathe = L.rest ? Math.sin(L.r * 2.2) : 0;
    const len = 0.42 + angry * 0.32 + quiver * 0.04 + breathe * 0.02;
    const cx = -18;
    const cy = 40;
    const rx = 92;
    const ry = 62;
    ground(ctx, 0, 124, 120);
    ctx.save();
    ctx.translate(quiver * 2, 0);
    // feet
    for (const fx of [-60, -10, 40, 70]) ell(ctx, fx, 112, 16, 11, '#c99a72', 0, 5);
    // spikes: a star around the back
    const spikes = (scale: number, fill: string) => {
      ctx.beginPath();
      const a0 = Math.PI * 0.92;
      const a1 = Math.PI * 2.08;
      const n = 30;
      for (let i = 0; i <= n * 2; i++) {
        const th = a0 + ((a1 - a0) * i) / (n * 2);
        const k = i % 2 ? 1 + len * scale * (0.85 + 0.15 * Math.sin(i * 1.7)) : 0.92;
        const x = cx + Math.cos(th) * rx * k;
        const y = cy + Math.sin(th) * ry * k;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.lineTo(cx + rx * 0.5, cy + ry * 0.7);
      ctx.lineTo(cx - rx * 0.6, cy + ry * 0.75);
      ctx.closePath();
      paint(ctx, fill, 5);
    };
    spikes(1, '#5e4030');
    spikes(0.6, '#8a6244');
    // light spike tips
    ctx.save();
    ctx.strokeStyle = 'rgba(255,230,190,0.55)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      const th = Math.PI * 1.05 + i * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * rx * 0.75, cy + Math.sin(th) * ry * 0.75);
      ctx.lineTo(cx + Math.cos(th) * rx * 1.15, cy + Math.sin(th) * ry * 1.15);
      ctx.stroke();
    }
    ctx.restore();
    // a leaf stuck on the spikes
    ell(ctx, -40, -40 - angry * 18, 18, 9, '#f0a030', -0.5, 4);
    // face: pointy snout to the right
    const nose = L.rest ? Math.sin(L.r * 9) * 1.5 * bell((L.r % 2.5) / 2.5, 0, 0.3) : 0;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.quadraticCurveTo(90, 10, 140 + nose, 58);
    ctx.quadraticCurveTo(130, 92, 70, 100);
    ctx.quadraticCurveTo(25, 102, 15, 75);
    ctx.closePath();
    paint(ctx, shade(ctx, 70, 55, 70, '#ffe6c4', '#f2cfa4', '#d8a878'));
    // belly
    ell(ctx, -15, 96, 50, 16, '#f2cfa4', 0, 5);
    ell(ctx, 60, 10, 12, 10, '#e8b890', 0, 4); // ear
    ell(ctx, 142 + nose, 58, 11, 10, '#2a1d33', 0, 3);
    gloss(ctx, 139 + nose, 54, 4, 2.5, -0.4, 0.8);
    const shut = blink(L.rest ? L.r : a + 1, 3.2);
    eye(ctx, 82, 40, 11, { shut: angry > 0.5 ? 0.35 : shut, lx: 0.4 });
    if (angry > 0.3) line(ctx, [68, 22, 94, 30], 5);
    cheek(ctx, 92, 70, 11);
    if (angry > 0.3) {
      ctx.beginPath();
      ctx.moveTo(98, 84);
      ctx.quadraticCurveTo(108, 78, 118, 84);
      ctx.lineWidth = 4;
      ctx.strokeStyle = OL;
      ctx.stroke();
    } else smile(ctx, 110, 80, 22);
    // "pieks" stars at spike tips
    if (angry > 0.2) {
      const s = angry * (0.6 + 0.4 * Math.abs(Math.sin(a * 9)));
      sparkle(ctx, -130, -10, 13 * s, '#fff');
      sparkle(ctx, -40, -75, 15 * s, '#fff');
      sparkle(ctx, 40, -55, 12 * s, '#fff');
    }
    ctx.restore();
  },
};

const Limo: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tickle = L.on ? bell(a, 0, 3) : 0;
    const giggle = Math.sin(a * 22) * tickle;
    const tt = alive ? t : 0;
    ground(ctx, 0, 126, 90);
    ctx.save();
    ctx.translate(0, 120);
    ctx.rotate(giggle * 0.05);
    ctx.scale(1 + giggle * 0.03, 1 - giggle * 0.03 + (L.rest ? Math.sin(L.r * 2) * 0.01 : 0));
    ctx.translate(0, -120);
    const glass = () => {
      ctx.beginPath();
      ctx.moveTo(-72, -95);
      ctx.lineTo(72, -95);
      ctx.lineTo(56, 112);
      ctx.quadraticCurveTo(54, 122, 42, 122);
      ctx.lineTo(-42, 122);
      ctx.quadraticCurveTo(-54, 122, -56, 112);
      ctx.closePath();
    };
    // straw behind
    ctx.save();
    ctx.translate(18, 40);
    ctx.rotate(0.35);
    ctx.beginPath();
    ctx.rect(-8, -205, 16, 200);
    paint(ctx, '#fff', 5);
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.rect(-8, -200 + i * 25, 16, 11);
      ctx.fillStyle = '#ff5a6e';
      ctx.fill();
    }
    ctx.restore();
    // glass and lemonade
    glass();
    ctx.fillStyle = 'rgba(215,240,255,0.7)';
    ctx.fill();
    ctx.save();
    glass();
    ctx.clip();
    const lg = ctx.createLinearGradient(0, -60, 0, 122);
    lg.addColorStop(0, '#fff07a');
    lg.addColorStop(1, '#ffc93a');
    ctx.fillStyle = lg;
    ctx.beginPath();
    const surf = -60 + Math.sin(tt * 6) * 2 * (tickle + 0.3);
    ctx.moveTo(-90, surf);
    for (let x = -90; x <= 90; x += 10) ctx.lineTo(x, surf + Math.sin(x * 0.08 + tt * 7) * 3);
    ctx.lineTo(90, 130);
    ctx.lineTo(-90, 130);
    ctx.closePath();
    ctx.fill();
    // ice cube
    ctx.save();
    ctx.translate(-30, -52 + Math.sin(tt * 3) * 2);
    ctx.rotate(0.3);
    ctx.beginPath();
    ctx.roundRect(-18, -18, 36, 36, 7);
    paint(ctx, 'rgba(240,252,255,0.85)', 3, '#7fb5d8');
    ctx.restore();
    // bubbles rising
    const n = 9;
    const speed = alive ? (L.on ? 120 + tickle * 120 : 45) : 0;
    for (let i = 0; i < n; i++) {
      const span = 175;
      const y = 115 - ((i * 47 + tt * speed + i * i * 7) % span);
      const x = -45 + ((i * 37) % 90) + Math.sin(tt * 5 + i) * 4;
      bubble(ctx, x, y, 4 + (i % 3) * 2.5);
    }
    ctx.restore();
    glass();
    ctx.lineWidth = 6;
    ctx.strokeStyle = OL;
    ctx.lineJoin = 'round';
    ctx.stroke();
    gloss(ctx, -48, 10, 7, 60, 0.08, 0.5);
    // face
    const laugh = tickle > 0.15;
    const shut = blink(L.rest ? L.r : a + 1, 3.3);
    eye(ctx, -26, 20, 13, { happy: laugh, shut });
    eye(ctx, 26, 20, 13, { happy: laugh, shut });
    cheek(ctx, -42, 44, 11, 0.55);
    cheek(ctx, 42, 44, 11, 0.55);
    smile(ctx, 0, 50, 34, laugh ? 0.6 + Math.abs(giggle) * 0.4 : 0);
    // lemon slice on the rim
    ctx.save();
    ctx.translate(-70, -96);
    ctx.rotate(-0.25 + giggle * 0.1);
    ctx.beginPath();
    ctx.arc(0, 0, 38, Math.PI * 0.9, Math.PI * 2.1);
    ctx.closePath();
    paint(ctx, '#ffe14a', 5);
    ctx.beginPath();
    ctx.arc(0, 0, 30, Math.PI * 0.95, Math.PI * 2.05);
    ctx.closePath();
    paint(ctx, '#fff6a6', 2.5, '#e8c02a');
    for (let i = 1; i < 5; i++) {
      const th = Math.PI * (1 + i / 5);
      line(ctx, [0, -2, Math.cos(th) * 28, Math.sin(th) * 28], 2.5, '#e8c02a');
    }
    ctx.restore();
    if (laugh) {
      sparkle(ctx, 95, -40, 10 + Math.abs(giggle) * 6, '#fff');
      sparkle(ctx, -100, 30, 8 + Math.abs(giggle) * 5, '#fff');
    }
    ctx.restore();
  },
};

const Nest: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // nest rocks, the middle baby wakes up, yawns, looks, and falls asleep again
    const rock = L.on ? Math.sin(a * 2.5) * 0.05 * bell(a, 0, 4) : Math.sin(L.r * 1.3) * 0.02;
    const awake = L.on ? ramp(a, 0.6, 0.9) * (1 - ramp(a, 3.2, 3.6)) : 0;
    const yawn = L.on ? bell(a, 1.0, 1.9) : 0;
    const peek = awake * 18;
    const look = L.on ? Math.sin((a - 1.9) * 4) * bell(a, 1.9, 3.2) : 0;
    // branch
    ctx.beginPath();
    ctx.moveTo(-190, 125);
    ctx.quadraticCurveTo(0, 105, 190, 118);
    ctx.lineTo(190, 136);
    ctx.quadraticCurveTo(0, 126, -190, 143);
    ctx.closePath();
    paint(ctx, '#8a5a36', 5);
    for (const [lx, ly, rot] of [
      [-160, 112, -0.6],
      [150, 104, 0.5],
      [175, 132, 0.2],
    ])
      ell(ctx, lx, ly, 22, 10, '#6cc04a', rot, 4);
    ctx.save();
    ctx.translate(0, 110);
    ctx.rotate(rock);
    ctx.translate(0, -110);
    // back rim
    ell(ctx, 0, 18, 140, 32, '#7a4e2c', 0, 6);
    // babies
    const babies: [number, number, number][] = [
      [-62, 6, 30],
      [0, -6 - peek, 34],
      [62, 6, 30],
    ];
    babies.forEach(([bx, by, br], i) => {
      ctx.save();
      const nod = Math.sin(tt * 1.6 + i * 2) * 0.06;
      ctx.translate(bx, by);
      ctx.rotate(i === 1 ? look * 0.2 + nod * (1 - awake) : nod);
      const mid = i === 1;
      chick(ctx, 0, 0, br, mid && awake > 0.5 ? (yawn > 0.3 ? 1 : blink(a, 1.2)) : 1, mid ? yawn * 1.6 : 0, look);
      ctx.restore();
    });
    // front bowl with twigs
    ctx.beginPath();
    ctx.moveTo(-152, 16);
    ctx.quadraticCurveTo(-150, 128, 0, 126);
    ctx.quadraticCurveTo(150, 128, 152, 16);
    ctx.quadraticCurveTo(0, 62, -152, 16);
    ctx.closePath();
    paint(ctx, shade(ctx, 0, 60, 150, '#c08a54', '#9b6b3c', '#704624'));
    ctx.save();
    ctx.clip();
    ctx.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const y = 30 + (i % 7) * 13;
      const x0 = -150 + ((i * 53) % 120);
      ctx.beginPath();
      ctx.moveTo(x0, y + 8);
      ctx.quadraticCurveTo(x0 + 70, y - 10, x0 + 150, y + 6);
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = i % 2 ? 'rgba(80,45,20,0.6)' : 'rgba(230,190,130,0.6)';
      ctx.stroke();
    }
    ctx.restore();
    // twigs poking out
    line(ctx, [-140, 30, -175, 10], 5, '#704624');
    line(ctx, [135, 40, 172, 22], 5, '#704624');
    line(ctx, [-110, 100, -150, 108], 5, '#704624');
    ctx.restore();
    // sleep bubbles drifting up from the left baby
    const k = (tt * 0.6) % 1;
    if (awake < 0.5)
      for (let i = 0; i < 3; i++) {
        const kk = (k + i / 3) % 1;
        ctx.save();
        ctx.globalAlpha = 1 - kk;
        bubble(ctx, -80 - kk * 40 + Math.sin(kk * 9) * 5, -40 - kk * 90, 6 + kk * 12);
        ctx.restore();
      }
  },
};

const Eule: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const play = L.on ? bell(a, 0, 3.5) : 0;
    const tilt = L.on ? Math.sin(a * 3.6) * 0.22 * play : L.rest ? Math.sin(L.r * 1.2) * 0.05 : 0;
    const flap = L.on ? Math.abs(Math.sin(a * 9)) * bell(a, 0.3, 1.6) : 0;
    const hoot = L.on ? Math.max(bell(a, 0.2, 0.7), bell(a, 0.9, 1.4)) : 0;
    // winks: left, right, both
    const wl = L.on ? (bell(a, 1.8, 2.2) > 0.3 || bell(a, 2.8, 3.2) > 0.3 ? 1 : 0) : L.rest ? blink(L.r, 4) : 0;
    const wr = L.on ? (bell(a, 2.3, 2.7) > 0.3 || bell(a, 2.8, 3.2) > 0.3 ? 1 : 0) : L.rest ? blink(L.r, 4) : 0;
    const bob = L.rest ? Math.sin(L.r * 2) * 2 : -flap * 6;
    // branch
    ctx.beginPath();
    ctx.roundRect(-170, 124, 340, 22, 11);
    paint(ctx, '#8a5a36', 5);
    ell(ctx, 150, 118, 20, 9, '#6cc04a', 0.5, 4);
    ctx.save();
    ctx.translate(0, bob);
    // wings
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 78, -10);
      ctx.rotate(s * (0.15 + flap * 0.9));
      ell(ctx, 0, 45, 30, 70, shade(ctx, 0, 45, 70, '#9a7652', '#7a5a3a', '#5a3e26'));
      ctx.restore();
    }
    // body
    ell(ctx, 0, 30, 92, 108, shade(ctx, 0, 30, 110, '#b08860', '#8e6a48', '#6a4a30'));
    ell(ctx, 0, 62, 58, 62, '#f1dfc0', 0, 4);
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(140,100,60,0.7)';
    for (const [vx, vy] of [
      [-22, 40],
      [10, 38],
      [-30, 70],
      [0, 68],
      [28, 72],
      [-12, 98],
      [16, 100],
    ]) {
      ctx.beginPath();
      ctx.moveTo(vx - 8, vy - 4);
      ctx.lineTo(vx, vy + 4);
      ctx.lineTo(vx + 8, vy - 4);
      ctx.stroke();
    }
    ctx.restore();
    // feet
    for (const fx of [-32, 32]) for (const d of [-9, 0, 9]) ell(ctx, fx + d, 128, 6, 9, '#f4a32a', 0, 3.5);
    // head
    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(tilt);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 40, -55);
      ctx.lineTo(s * 74, -110);
      ctx.lineTo(s * 76, -40);
      ctx.closePath();
      paint(ctx, '#7a5a3a');
    }
    ell(ctx, 0, -10, 86, 70, shade(ctx, 0, -10, 86, '#b08860', '#8e6a48', '#6a4a30'));
    gloss(ctx, -40, -55, 16, 7, -0.4, 0.4);
    ell(ctx, -36, 0, 40, 40, '#f1e0c4', 0, 4);
    ell(ctx, 36, 0, 40, 40, '#f1e0c4', 0, 4);
    ell(ctx, -36, 0, 27, 27, '#f4a32a', 0, 4);
    ell(ctx, 36, 0, 27, 27, '#f4a32a', 0, 4);
    const lx = L.on ? Math.sin(a * 2) * 0.6 : 0;
    eye(ctx, -36, 0, 20, { shut: wl, lx });
    eye(ctx, 36, 0, 20, { shut: wr, lx });
    cheek(ctx, -60, 30, 11);
    cheek(ctx, 60, 30, 11);
    // beak, opens for "huhu"
    ctx.beginPath();
    ctx.moveTo(-11, 22);
    ctx.lineTo(11, 22);
    ctx.lineTo(0, 44 - hoot * 4);
    ctx.closePath();
    paint(ctx, '#f6b83a', 4);
    if (hoot > 0.2) ell(ctx, 0, 48, 7, 6 * hoot, '#7a2340', 0, 3);
    ctx.restore();
    if (hoot > 0.05) {
      sound(ctx, 0, -20, -Math.PI * 0.85, a * 2, 2, 5);
      sound(ctx, 0, -20, -Math.PI * 0.15, a * 2, 2, 5);
    }
    ctx.restore();
  },
};

function coin(ctx: C, x: number, y: number, r: number, spin = 0): void {
  const w = Math.max(0.15, Math.abs(Math.cos(spin)));
  ell(ctx, x, y, r * w, r, shade(ctx, x, y, r, '#fff6b0', '#f6c626', '#c8901a'), 0, 4, '#8a5a10');
  ell(ctx, x, y, r * 0.6 * w, r * 0.6, 'rgba(0,0,0,0)', 0, 2.5, '#c8901a');
}

const Rabe: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // krah!, hop to the coin, peck it up, it glitters in the beak
    const krah = L.on ? bell(a, 0.1, 0.9) : 0;
    const hopK = L.on ? ramp(a, 0.9, 1.7) : alive ? 1 : 0;
    const hopY = L.on ? -Math.abs(Math.sin(((a - 0.9) / 0.8) * Math.PI * 2)) * 26 * bell(a, 0.9, 1.7) : 0;
    const peck = L.on ? bell(a, 1.8, 2.5) : 0;
    const has = alive && a > 2.15;
    const bx = -20 + hopK * 0;
    const rest = L.rest ? Math.sin(L.r * 2) : 0;
    const coinX = 80 - hopK * 0;
    ground(ctx, 0, 128, 110);
    if (!has) {
      coin(ctx, coinX, 112, 15, 0.2);
      ell(ctx, coinX + 34, 118, 12, 8, 'rgba(0,0,0,0)', 0, 5, '#c8901a');
      sparkle(ctx, coinX + 14, 92, 9 + Math.sin((alive ? t : 0) * 8) * 3, '#fff');
    } else {
      ell(ctx, coinX + 34, 118, 12, 8, 'rgba(0,0,0,0)', 0, 5, '#c8901a');
    }
    ctx.save();
    ctx.translate(bx, hopY + rest * 1.5);
    // tilt forward while pecking
    ctx.translate(20, 110);
    ctx.rotate(peck * 0.55);
    ctx.translate(-20, -110);
    // legs
    line(ctx, [0, 70, -4, 118, -18, 122], 5, '#4a4656');
    line(ctx, [-4, 118, 8, 122], 5, '#4a4656');
    line(ctx, [30, 70, 34, 118, 20, 122], 5, '#4a4656');
    line(ctx, [34, 118, 46, 122], 5, '#4a4656');
    const body = shade(ctx, 0, 20, 90, '#4a5070', '#2c2f42', '#181a26');
    // tail
    ctx.beginPath();
    ctx.moveTo(-60, 30);
    ctx.lineTo(-150, 80 + rest * 3);
    ctx.lineTo(-140, 100 + rest * 3);
    ctx.lineTo(-50, 62);
    ctx.closePath();
    paint(ctx, '#23263a', 6, '#0c0d14');
    ell(ctx, 0, 30, 82, 58, body, -0.25, 6, '#0c0d14');
    // wing with feather edge
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.quadraticCurveTo(-30, -10, -95, 50);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(-75 + i * 22, 70, -62 + i * 24, 56);
    ctx.quadraticCurveTo(40, 50, 30, 0);
    ctx.closePath();
    paint(ctx, '#1e2132', 5, '#0c0d14');
    gloss(ctx, -20, 2, 26, 9, -0.3, 0.25);
    // head
    ell(ctx, 58, -42, 44, 42, body, 0, 6, '#0c0d14');
    gloss(ctx, 40, -70, 14, 7, -0.4, 0.35);
    const shut = blink(L.rest ? L.r : a + 1, 3.1);
    eye(ctx, 70, -50, 14, { shut: krah > 0.4 ? 1 : shut, lx: 0.5 });
    cheek(ctx, 72, -24, 9, 0.5);
    // beak: upper and lower, opens on krah
    const open = krah * 0.5;
    ctx.save();
    ctx.translate(96, -40);
    ctx.save();
    ctx.rotate(-open * 0.5);
    ctx.beginPath();
    ctx.moveTo(-6, -14);
    ctx.quadraticCurveTo(30, -14, 54, 2);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    paint(ctx, '#5a5868', 5, '#0c0d14');
    ctx.restore();
    ctx.save();
    ctx.rotate(open * 0.6);
    ctx.beginPath();
    ctx.moveTo(-6, 4);
    ctx.lineTo(46, 4);
    ctx.quadraticCurveTo(24, 16, -6, 14);
    ctx.closePath();
    paint(ctx, '#4a4858', 5, '#0c0d14');
    ctx.restore();
    if (has) {
      coin(ctx, 40, 8, 13, (alive ? t : 0) * 3);
      sparkle(ctx, 56, -14, 8 + Math.abs(Math.sin((alive ? t : 0) * 5)) * 6, '#fff');
    }
    ctx.restore();
    ctx.restore();
    if (krah > 0.05) sound(ctx, 148, -62, -0.3, a * 2.5, 3, 5);
  },
};

const Hase: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // three hops, ears flopping, dust puffs
    const hop = L.on ? Math.abs(Math.sin(a * Math.PI)) : 0;
    const y = -hop * 36;
    const land = L.on ? Math.max(0, Math.cos(a * Math.PI * 2)) ** 6 * bell(a, 0, 3) : 0;
    const squash = 1 - land * 0.1;
    const x = L.on ? Math.sin((a * Math.PI) / 1.5) * 14 : 0;
    const ear = L.on ? -Math.sin(a * Math.PI * 2) * 0.35 : L.rest ? Math.sin(L.r * 1.7) * 0.06 : 0;
    const nose = L.rest ? Math.sin(L.r * 12) * 1.5 : 0;
    ground(ctx, x, 132, 90 * (1 - hop * 0.3));
    if (L.on) {
      const puff = land;
      if (puff > 0.05)
        for (const s of [-1, 1]) {
          ctx.save();
          ctx.globalAlpha = puff;
          ell(ctx, x + s * 95, 122, 14 * puff + 4, 10 * puff + 3, '#efe6d8', 0, 3, '#b8a890');
          ctx.restore();
        }
    }
    ctx.save();
    ctx.translate(x, y + 130);
    ctx.scale(1 + land * 0.08, squash);
    ctx.translate(0, -130);
    const fur = (cx: number, cy: number, r: number) => shade(ctx, cx, cy, r, '#ffffff', '#f2ece6', '#d8cdc2');
    // tail
    ell(ctx, -98, 66, 22, 22, '#ffffff', 0, 5);
    // back foot
    ell(ctx, -12, 118, 52, 16, fur(-12, 118, 52));
    // body
    ell(ctx, -22, 58, 80, 64, fur(-22, 58, 80));
    ell(ctx, 8, 72, 34, 40, '#fffaf6', 0, 0);
    // front paws
    ell(ctx, 40, 118, 18, 12, fur(40, 118, 18));
    ell(ctx, 66, 118, 18, 12, fur(66, 118, 18));
    // ears
    for (const [ex, rot, d] of [
      [32, -0.25, 0],
      [62, 0.12, 0.15],
    ] as const) {
      ctx.save();
      ctx.translate(ex, -48);
      ctx.rotate(rot + ear * (1 + d));
      ell(ctx, 0, -52, 17, 56, fur(0, -52, 56));
      ell(ctx, 0, -50, 8, 42, '#ffb4c4', 0, 0);
      ctx.restore();
    }
    // head
    ell(ctx, 58, -18, 54, 48, fur(58, -18, 54));
    gloss(ctx, 36, -46, 14, 7, -0.4, 0.7);
    const shut = blink(L.rest ? L.r : a + 1, 3.4);
    eye(ctx, 78, -26, 12, { shut, lx: 0.5, happy: L.on && hop > 0.6 });
    cheek(ctx, 80, 4, 11);
    // nose, mouth, teeth, whiskers
    ell(ctx, 109 + nose * 0.3, -10 + nose, 7, 5, '#ff8fa8', 0, 3);
    ctx.beginPath();
    ctx.rect(96, 10, 12, 10);
    paint(ctx, '#fff', 3);
    line(ctx, [102, 10, 102, 20], 2);
    ctx.beginPath();
    ctx.moveTo(108, -5);
    ctx.quadraticCurveTo(108, 8, 98, 10);
    ctx.moveTo(108, -5);
    ctx.quadraticCurveTo(110, 8, 116, 8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = OL;
    ctx.stroke();
    for (const wy of [-6, 2]) line(ctx, [116, wy, 146, wy - 6 + (wy > 0 ? 10 : 0)], 2.5, '#7a6a72');
    ctx.restore();
    if (L.on && hop > 0.5) whoosh(ctx, -150, -40 + y, 40, 3, 16, hop - 0.4);
  },
};

const Kerze: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // a gust comes, the flame nearly goes out, the candle is scared, then the flame comes back big
    const wind = L.on ? bell(a, 0.2, 2.0) : 0;
    const back = L.on ? bell(a, 2.0, 3.5) : 0;
    const scared = L.on ? ramp(a, 0.4, 0.7) * (1 - ramp(a, 1.9, 2.2)) : 0;
    const flick = Math.sin(tt * 11) * 0.5 + Math.sin(tt * 17) * 0.3;
    const size = (1 - wind * 0.75) * (1 + back * 0.35) + flick * 0.04;
    const bend = wind * 0.9 + flick * 0.06;
    const lean = -wind * 0.1;
    ctx.save();
    // holder
    ell(ctx, 0, 122, 92, 20, shade(ctx, 0, 118, 92, '#fff3a8', '#f2c234', '#c8901a'), 0, 6);
    ctx.beginPath();
    ctx.arc(104, 110, 16, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.lineWidth = 7;
    ctx.strokeStyle = OL;
    ctx.stroke();
    ctx.translate(0, 115);
    ctx.rotate(lean);
    ctx.translate(0, -115);
    // candle
    ctx.beginPath();
    ctx.roundRect(-42, -40, 84, 158, 12);
    const cg = ctx.createLinearGradient(-42, 0, 42, 0);
    cg.addColorStop(0, '#ff8a80');
    cg.addColorStop(0.4, '#ec5a50');
    cg.addColorStop(1, '#c23a36');
    paint(ctx, cg);
    // wax top with drips
    ctx.beginPath();
    ctx.moveTo(-42, -32);
    ctx.quadraticCurveTo(-42, -42, -30, -42);
    ctx.lineTo(30, -42);
    ctx.quadraticCurveTo(42, -42, 42, -32);
    ctx.lineTo(42, -8);
    ctx.quadraticCurveTo(34, 4, 30, -8);
    ctx.lineTo(30, -18);
    ctx.quadraticCurveTo(22, -24, 12, -18);
    ctx.lineTo(12, 18);
    ctx.quadraticCurveTo(4, 30, -4, 18);
    ctx.lineTo(-4, -18);
    ctx.quadraticCurveTo(-18, -24, -28, -18);
    ctx.lineTo(-28, -2);
    ctx.quadraticCurveTo(-36, 8, -42, -2);
    ctx.closePath();
    paint(ctx, '#ff9e94', 4);
    gloss(ctx, -26, 40, 6, 40, 0, 0.35);
    // wick
    line(ctx, [0, -42, bend * 4, -58], 5, '#3a2a2a');
    // flame with glow
    ctx.save();
    ctx.translate(bend * 4, -58);
    const glow = ctx.createRadialGradient(0, -26, 4, 0, -26, 80 * size + 10);
    glow.addColorStop(0, 'rgba(255,230,120,0.55)');
    glow.addColorStop(1, 'rgba(255,230,120,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, -26, 80 * size + 10, 0, TAU);
    ctx.fill();
    const flame = (s: number, fill: string, lw: number) => {
      const h = 70 * s;
      const w = 22 * s;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.bezierCurveTo(-w * 1.6, 0, -w * 0.8, -h * 0.55, bend * h * 0.7, -h);
      ctx.bezierCurveTo(w * 1.2 + bend * h * 0.3, -h * 0.5, w * 1.6, 0, 0, 4);
      ctx.closePath();
      paint(ctx, fill, lw, '#c8601a');
    };
    flame(size, '#ffb02e', 4);
    flame(size * 0.6, '#fff07a', 0);
    ctx.restore();
    // face
    const shut = blink(L.rest ? L.r : a + 1, 3.2);
    const happy = back > 0.3;
    eye(ctx, -17, 40, scared > 0.3 ? 13 : 11, { shut: scared > 0.3 ? 0 : shut, happy, lx: scared > 0.3 ? 0.9 : 0.1, ly: scared > 0.3 ? -0.5 : 0 });
    eye(ctx, 17, 40, scared > 0.3 ? 13 : 11, { shut: scared > 0.3 ? 0 : shut, happy, lx: scared > 0.3 ? 0.9 : 0.1, ly: scared > 0.3 ? -0.5 : 0 });
    cheek(ctx, -26, 62, 9, 0.5);
    cheek(ctx, 26, 62, 9, 0.5);
    if (scared > 0.3) oMouth(ctx, 0, 70, 8);
    else smile(ctx, 0, 66, 24, happy ? 0.5 : 0);
    if (scared > 0.3) drop(ctx, 34, 18, 6 * scared);
    ctx.restore();
    // wind lines
    if (wind > 0.05) {
      const k = (a * 1.5) % 1;
      ctx.save();
      ctx.globalAlpha = wind;
      for (let i = 0; i < 3; i++) {
        const y0 = -110 + i * 26;
        const x0 = -180 + k * 60;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(x0 + 40, y0 - 12, x0 + 80, y0);
        ctx.quadraticCurveTo(x0 + 100, y0 + 8, x0 + 92, y0 + 16);
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(120,170,220,0.9)';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      ctx.restore();
    }
    if (back > 0.2) {
      sparkle(ctx, -60, -120, 14 * back);
      sparkle(ctx, 62, -100, 11 * back);
    }
  },
};

const Banane: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // slips like on ice, swings wildly, then catches itself
    const slip = L.on ? bell(a, 0, 2.4) : 0;
    const rot = L.on ? Math.sin(a * 6.5) * 0.45 * slip : L.rest ? Math.sin(L.r * 1.8) * 0.1 : 0;
    const x = L.on ? Math.sin(a * 3.2) * 45 * slip : 0;
    const relief = L.on ? bell(a, 2.3, 3) : 0;
    ground(ctx, x * 0.5, 100, 110);
    ctx.save();
    ctx.translate(x, 10);
    ctx.rotate(rot - 0.42);
    // crescent around a circle: thick round belly below, pointed ends
    const CY = -160;
    const R = 170;
    const W = 52;
    const sp = (s: number): [number, number, number, number] => {
      const ph = Math.PI / 2 + 0.92 - s * 1.84;
      return [Math.cos(ph) * R, CY + Math.sin(ph) * R, Math.cos(ph), Math.sin(ph)];
    };
    const fat = (s: number) => Math.pow(Math.sin(Math.PI * s), 0.62);
    const edge = (s: number, k: number): [number, number] => {
      const [px, py, nx, ny] = sp(s);
      const w = (k > 0 ? W : W * 0.5) * k * fat(s);
      return [px + nx * w, py + ny * w];
    };
    const N = 40;
    const strokeAlong = (k: number, s0: number, s1: number, lw: number, color: string) => {
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const [ex, ey] = edge(s0 + ((s1 - s0) * i) / N, k);
        if (i === 0) ctx.moveTo(ex, ey);
        else ctx.lineTo(ex, ey);
      }
      ctx.lineWidth = lw;
      ctx.strokeStyle = color;
      ctx.lineCap = 'round';
      ctx.stroke();
    };
    // stem at the right end
    const [s1x, s1y] = sp(0.97);
    const [e1x, e1y] = sp(1);
    const dl = Math.hypot(e1x - s1x, e1y - s1y);
    const dx = (e1x - s1x) / dl;
    const dy = (e1y - s1y) / dl;
    line(ctx, [s1x - dx * 8, s1y - dy * 8, e1x + dx * 30, e1y + dy * 30], 20, OL);
    line(ctx, [s1x - dx * 8, s1y - dy * 8, e1x + dx * 30, e1y + dy * 30], 11, '#8a6a2a');
    ell(ctx, e1x + dx * 31, e1y + dy * 31, 7, 7, '#4a3418', 0, 3);
    // body
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const [ex, ey] = edge(i / N, 1);
      if (i === 0) ctx.moveTo(ex, ey);
      else ctx.lineTo(ex, ey);
    }
    for (let i = N; i >= 0; i--) {
      const [ex, ey] = edge(i / N, -1);
      ctx.lineTo(ex, ey);
    }
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -30, 0, 70);
    bg.addColorStop(0, '#fff3a0');
    bg.addColorStop(0.45, '#ffdb3a');
    bg.addColorStop(1, '#e8a818');
    paint(ctx, bg);
    // edges along the banana
    strokeAlong(0.62, 0.08, 0.92, 3.5, 'rgba(170,120,20,0.55)');
    strokeAlong(-0.45, 0.12, 0.88, 3.5, 'rgba(170,120,20,0.45)');
    // dark tip at the left end
    const [t0x, t0y] = sp(0);
    ell(ctx, t0x, t0y, 8, 7, '#4a3418', 0, 3);
    for (const [sx, sy] of [
      [-75, 0],
      [62, 6],
      [88, -20],
    ])
      ell(ctx, sx, sy, 4, 3, 'rgba(140,90,20,0.45)', 0, 0);
    gloss(ctx, -40, -2, 26, 5, 0.25, 0.55);
    // face on the belly
    const scared = slip > 0.25;
    const shut = blink(L.rest ? L.r : a + 1, 3.2);
    eye(ctx, -19, 18, scared ? 12 : 11, { shut: scared ? 0 : shut, lx: scared ? Math.sin(a * 6.5) : 0.1, happy: relief > 0.3 });
    eye(ctx, 19, 18, scared ? 12 : 11, { shut: scared ? 0 : shut, lx: scared ? Math.sin(a * 6.5) : 0.1, happy: relief > 0.3 });
    cheek(ctx, -36, 36, 8, 0.5);
    cheek(ctx, 36, 36, 8, 0.5);
    if (scared) oMouth(ctx, 0, 40, 7);
    else smile(ctx, 0, 38, 22, relief > 0.3 ? 0.4 : 0);
    if (scared) drop(ctx, 42, -4, 6);
    ctx.restore();
    if (slip > 0.3) whoosh(ctx, x - (x > 0 ? 190 : -110), 90, 70, 3, 14, slip);
    if (relief > 0.3) sparkle(ctx, 100, -40, 12 * relief, '#fff');
  },
};

const Brot: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // puffs up proudly, steam rises, crunchy sparkles
    const puff = L.on ? bell(a, 0, 1.4) * 0.12 + bell(a, 1.4, 2.2) * 0.06 : 0;
    const proud = L.on ? ramp(a, 0.2, 0.5) * (1 - ramp(a, 2.6, 3)) : 0;
    const breathe = L.rest ? Math.sin(L.r * 2) * 0.012 : 0;
    // board
    ctx.beginPath();
    ctx.roundRect(-170, 96, 340, 30, 14);
    paint(ctx, shade(ctx, 0, 110, 170, '#f0c890', '#d9a868', '#b8844a'), 5);
    ell(ctx, 150, 111, 7, 7, '#a07040', 0, 3);
    ctx.save();
    ctx.translate(0, 98);
    ctx.scale(1 + puff * 0.4, 1 + puff + breathe);
    ctx.translate(0, -98);
    ctx.beginPath();
    ctx.moveTo(-130, 92);
    ctx.quadraticCurveTo(-148, -20, -66, -54);
    ctx.quadraticCurveTo(0, -80, 66, -54);
    ctx.quadraticCurveTo(148, -20, 130, 92);
    ctx.quadraticCurveTo(0, 104, -130, 92);
    ctx.closePath();
    const bg = ctx.createLinearGradient(0, -70, 0, 100);
    bg.addColorStop(0, '#d98a34');
    bg.addColorStop(0.5, '#e8a858');
    bg.addColorStop(1, '#c87a30');
    paint(ctx, bg, 6, '#5a3418');
    // score cuts
    for (const cx of [-70, -10, 50]) {
      ctx.beginPath();
      ctx.moveTo(cx - 14, -36);
      ctx.quadraticCurveTo(cx + 10, -50, cx + 30, -66);
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#f8dca8';
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    // flour dots
    for (const [fx, fy] of [
      [-100, -10],
      [-40, -60],
      [20, -68],
      [90, -30],
      [100, 10],
    ])
      ell(ctx, fx, fy, 3.5, 2.5, 'rgba(255,255,255,0.75)', 0, 0);
    gloss(ctx, -70, -10, 20, 8, -0.6, 0.35);
    // face
    const shut = blink(L.rest ? L.r : a + 1, 3.4);
    eye(ctx, -34, 26, 12, { shut, happy: proud > 0.4 });
    eye(ctx, 34, 26, 12, { shut, happy: proud > 0.4 });
    cheek(ctx, -56, 50, 12, 0.5);
    cheek(ctx, 56, 50, 12, 0.5);
    smile(ctx, 0, 52, 34, proud * 0.6);
    ctx.restore();
    // steam wisps
    const steamA = alive ? (L.on ? 1 : 0.6) : 0.5;
    for (let i = 0; i < 3; i++) {
      const k = (tt * 0.5 + i / 3) % 1;
      ctx.save();
      ctx.globalAlpha = steamA * bell(k, 0, 1);
      const sx = -50 + i * 50;
      const sy = -95 - k * 60;
      ctx.beginPath();
      ctx.moveTo(sx, sy + 30);
      ctx.bezierCurveTo(sx - 18, sy + 18, sx + 18, sy + 6, sx, sy - 8);
      ctx.bezierCurveTo(sx - 16, sy - 18, sx + 10, sy - 26, sx + 2, sy - 34);
      ctx.lineWidth = 7;
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(150,140,160,0.6)';
      ctx.stroke();
      ctx.restore();
    }
    if (proud > 0.2) {
      const s = proud * (0.5 + 0.5 * Math.abs(Math.sin(a * 7)));
      sparkle(ctx, -135, -30, 14 * s);
      sparkle(ctx, 140, -10, 12 * s);
      sparkle(ctx, 0, -90, 10 * s, '#fff');
    }
  },
};

function babyElephant(ctx: C, wave: number, happy: boolean): void {
  // hangs at the hook by its trunk: trunk tip at (0, 0), body below
  const gray = '#a8b2c4';
  ell(ctx, -26, 66, 34, 26, gray, 0.2, 5);
  for (const lx of [-44, -30, -14, -2]) ell(ctx, lx, 90 + (lx % 2) * 2, 7, 11, gray, 0, 4);
  ell(ctx, 6, 38, 24, 22, gray, 0, 5);
  ell(ctx, -8, 40, 14, 18, '#d6a8b8', wave * 0.6 - 0.2, 4);
  line(ctx, [16, 30, 14, 10, 4, 0], 12, OL);
  line(ctx, [16, 30, 14, 10, 4, 0], 6, gray);
  eye(ctx, 14, 36, 5.5, { happy });
  cheek(ctx, 20, 48, 5);
}

const Kran: Picto = {
  anim: 4.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    const Y = -120; // jib
    // crate down, hook to the little elephant, lift it, swing
    let tx = 50;
    let hy = 10;
    let crateOn = true;
    let ele = false;
    let eleY = 0;
    if (alive) {
      if (a < 0.9) hy = 10 + ramp(a, 0, 0.9) * 50;
      else if (a < 1.6) {
        crateOn = false;
        hy = 60 - ramp(a, 0.9, 1.3) * 60;
        tx = 50 + ramp(a, 1.0, 1.6) * 70;
      } else {
        crateOn = false;
        tx = 120;
        hy = 0 + ramp(a, 1.6, 2.0) * 25 - ramp(a, 2.2, 3.2) * 85;
        ele = true;
      }
      eleY = hy;
    }
    const swing = ele ? (L.on ? Math.sin((a - 2.2) * 4) * 0.25 * ramp(a, 2.2, 2.8) : Math.sin(L.r * 1.8) * 0.1) : Math.sin(tt * 2) * 0.03;
    const happy = ele && a > 2.5;
    // base
    ctx.beginPath();
    ctx.roundRect(-128, 122, 96, 24, 6);
    paint(ctx, '#9aa0aa', 5);
    // crate on the ground once set down, elephant waiting on the ground
    if (!crateOn) {
      ctx.beginPath();
      ctx.roundRect(22, 82, 56, 46, 5);
      paint(ctx, '#c88a4a', 5);
      line(ctx, [22, 105, 78, 105], 4, '#8a5a2a');
      line(ctx, [50, 82, 50, 128], 4, '#8a5a2a');
    }
    if (alive && !ele) {
      ctx.save();
      ctx.translate(120, 30);
      babyElephant(ctx, 0, false);
      ctx.restore();
    }
    // tower (lattice)
    const yellow = '#f6c026';
    ctx.beginPath();
    ctx.rect(-96, Y, 32, 244);
    paint(ctx, yellow);
    for (let y = Y; y < 120; y += 30) line(ctx, [-96, y, -64, y + 30, -96, y + 30], 3, '#b8860a');
    // jib
    ctx.beginPath();
    ctx.rect(-160, Y - 6, 315, 20);
    paint(ctx, yellow);
    for (let x = -160; x < 150; x += 24) line(ctx, [x, Y + 14, x + 12, Y - 6, x + 24, Y + 14], 3, '#b8860a');
    // peak and tie cables
    ctx.beginPath();
    ctx.moveTo(-94, Y - 6);
    ctx.lineTo(-80, Y - 50);
    ctx.lineTo(-66, Y - 6);
    ctx.closePath();
    paint(ctx, yellow, 5);
    line(ctx, [-80, Y - 50, 150, Y - 6], 2.5);
    line(ctx, [-80, Y - 50, -155, Y - 6], 2.5);
    // counterweight
    ctx.beginPath();
    ctx.roundRect(-160, Y + 14, 40, 34, 4);
    paint(ctx, '#7a808c', 5);
    // cab with a face
    ctx.beginPath();
    ctx.roundRect(-62, Y + 14, 52, 42, 8);
    paint(ctx, '#ff8a3a', 5);
    ctx.beginPath();
    ctx.roundRect(-56, Y + 20, 40, 22, 5);
    paint(ctx, '#cfeaff', 3);
    const shut = blink(L.rest ? L.r : tt + 1, 3.5);
    eye(ctx, -45, Y + 31, 7, { shut, lx: 0.8, ly: ele ? 0.5 : 0.8, happy });
    eye(ctx, -27, Y + 31, 7, { shut, lx: 0.8, ly: ele ? 0.5 : 0.8, happy });
    smile(ctx, -36, Y + 50, 14);
    // trolley, cable, hook
    ctx.beginPath();
    ctx.roundRect(tx - 14, Y + 12, 28, 12, 3);
    paint(ctx, '#6a707c', 4);
    ctx.save();
    ctx.translate(tx, Y + 22);
    ctx.rotate(swing);
    const len = hy - (Y + 22);
    line(ctx, [0, 0, 0, len], 3);
    ctx.translate(0, len);
    ctx.beginPath();
    ctx.arc(0, 10, 9, -Math.PI * 0.4, Math.PI * 1.1);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#5a606a';
    ctx.stroke();
    if (crateOn) {
      line(ctx, [0, 18, -24, 38, 0, 18, 24, 38], 3);
      ctx.beginPath();
      ctx.roundRect(-28, 36, 56, 46, 5);
      paint(ctx, '#c88a4a', 5);
      line(ctx, [-28, 59, 28, 59], 4, '#8a5a2a');
      line(ctx, [0, 36, 0, 82], 4, '#8a5a2a');
    }
    if (ele) {
      ctx.rotate(-swing * 0.5);
      babyElephant(ctx, Math.sin(tt * 8), happy);
    }
    ctx.restore();
    void eleY;
    if (happy && L.on) {
      sparkle(ctx, 165, -40, 10 * bell(a, 2.5, 4.5), '#fff');
      sparkle(ctx, 70, -70, 8 * bell(a, 2.7, 4.5), '#fff');
    }
  },
};

const Loewe: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // a big roar, then a crown pops on and he is very proud
    const roar = L.on ? bell(a, 0.1, 1.3) : 0;
    const cr = alive ? ramp(a, 1.5, 1.8) : 0;
    const pop = alive ? 1 + bell(a, 1.5, 2.1) * 0.35 : 0;
    const proud = L.on ? ramp(a, 2.0, 2.3) : 0;
    const chin = L.on ? -proud * 0.12 * (1 - ramp(a, 3.1, 3.5)) : L.rest ? Math.sin(L.r * 1.4) * 0.04 : 0;
    const shake = Math.sin(a * 30) * roar;
    ctx.save();
    ctx.translate(shake * 3, 10);
    ctx.rotate(chin);
    // mane
    const mane = (R: number, fill: string | CanvasGradient) => {
      ctx.beginPath();
      const n = 16;
      for (let i = 0; i <= n * 8; i++) {
        const th = (i / (n * 8)) * TAU;
        const r = R * (1 + roar * 0.08) + Math.abs(Math.sin(th * (n / 2))) * 16 + Math.sin(th * 3 + a * 20) * roar * 4;
        const x = Math.cos(th) * r;
        const y = Math.sin(th) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      paint(ctx, fill);
    };
    mane(112, shade(ctx, 0, 0, 125, '#e8963a', '#d0702a', '#a04e1a'));
    mane(90, '#e8873a');
    // ears
    ell(ctx, -56, -58, 20, 20, '#f2b84a');
    ell(ctx, 56, -58, 20, 20, '#f2b84a');
    ell(ctx, -56, -58, 10, 10, '#e89a6a', 0, 0);
    ell(ctx, 56, -58, 10, 10, '#e89a6a', 0, 0);
    // face
    ell(ctx, 0, 4, 76, 72, shade(ctx, 0, 4, 76, '#ffe08a', '#f6c55a', '#e0a040'));
    gloss(ctx, -30, -40, 16, 7, -0.4, 0.5);
    const shut = blink(L.rest ? L.r : a + 1, 3.6);
    eye(ctx, -28, -14, 13, { shut: roar > 0.4 ? 1 : shut, happy: proud > 0.4 && L.on });
    eye(ctx, 28, -14, 13, { shut: roar > 0.4 ? 1 : shut, happy: proud > 0.4 && L.on });
    if (roar > 0.4) {
      line(ctx, [-44, -36, -16, -28], 5);
      line(ctx, [44, -36, 16, -28], 5);
    }
    cheek(ctx, -50, 20, 12);
    cheek(ctx, 50, 20, 12);
    // muzzle
    ell(ctx, -17, 30 + roar * 4, 22, 18, '#fff0c8', 0, 4);
    ell(ctx, 17, 30 + roar * 4, 22, 18, '#fff0c8', 0, 4);
    for (const [dx, dy] of [
      [-24, 28],
      [-14, 36],
      [-28, 38],
      [24, 28],
      [14, 36],
      [28, 38],
    ])
      ell(ctx, dx, dy + roar * 4, 2.2, 2.2, '#8a5a2a', 0, 0);
    if (roar > 0.1) {
      ctx.beginPath();
      ctx.ellipse(0, 52, 24 * roar + 6, 26 * roar + 4, 0, 0, TAU);
      paint(ctx, '#7a2340', 5);
      ell(ctx, 0, 62 + roar * 8, 14 * roar + 3, 8 * roar + 2, '#ff8fa8', 0, 0);
      // little fangs
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 12, 52 - 20 * roar);
        ctx.lineTo(s * 6, 52 - 20 * roar);
        ctx.lineTo(s * 9, 52 - 10 * roar);
        ctx.closePath();
        paint(ctx, '#fff', 2);
      }
    }
    // nose
    ctx.beginPath();
    ctx.moveTo(-15, 8 + roar * 2);
    ctx.lineTo(15, 8 + roar * 2);
    ctx.quadraticCurveTo(0, 30 + roar * 2, -15, 8 + roar * 2);
    ctx.closePath();
    paint(ctx, '#8a4a3a', 4);
    if (roar <= 0.1) {
      smile(ctx, -9, 42, 18);
      smile(ctx, 9, 42, 18);
    }
    // crown
    if (cr > 0) {
      ctx.save();
      ctx.translate(14, -92);
      ctx.scale(pop * cr, pop * cr);
      crown(ctx, 0, 0, 84, 0.18);
      ctx.restore();
    }
    ctx.restore();
    if (roar > 0.05) {
      sound(ctx, -130, 30, Math.PI, a * 3, 3, 5);
      sound(ctx, 130, 30, 0, a * 3, 3, 5);
    }
    if (L.on && cr > 0) {
      const s = bell(a, 1.5, 3.2);
      sparkle(ctx, -60, -150, 14 * s);
      sparkle(ctx, 95, -150, 12 * s);
      sparkle(ctx, 120, -90, 9 * s, '#fff');
    }
  },
};

const Kamel: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // the two humps jiggle one after the other, he grins smugly
    const jig = L.on ? bell(a, 0, 3.2) : 0;
    const h1 = 72 + Math.sin(a * 13) * 16 * jig;
    const h2 = 72 + Math.sin(a * 13 - 1.6) * 16 * jig;
    const sway = L.on ? Math.sin(a * 6.5) * 0.04 * jig : 0;
    const chew = L.rest ? Math.sin(L.r * 6) : 0;
    const sand = '#ddb06a';
    const fill = shade(ctx, -20, 0, 130, '#f2cc8a', sand, '#b8884a');
    ground(ctx, 0, 136, 140);
    ctx.save();
    ctx.translate(0, 130);
    ctx.rotate(sway);
    ctx.translate(0, -130);
    // legs
    for (const [lx, d] of [
      [-80, 1],
      [-50, 0],
      [40, 1],
      [68, 0],
    ]) {
      const lift = L.on ? Math.max(0, Math.sin(a * 6.5 + d * Math.PI)) * 6 * jig : 0;
      ctx.beginPath();
      ctx.roundRect(lx - 9, 36, 18, 94 - lift, 8);
      paint(ctx, d ? '#c89a58' : sand, 5);
      ell(ctx, lx, 84, 10, 8, d ? '#c89a58' : sand, 0, 4);
      ell(ctx, lx + 2, 128 - lift, 13, 7, '#7a5a3a', 0, 4);
    }
    // tail
    line(ctx, [-108, 0, -124, 40], 5);
    ell(ctx, -124, 46, 7, 11, '#7a5a3a', 0.2, 3);
    // neck
    ctx.beginPath();
    ctx.moveTo(52, 20);
    ctx.quadraticCurveTo(122, 10, 112, -72);
    ctx.lineWidth = 42;
    ctx.strokeStyle = OL;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = 30;
    ctx.strokeStyle = sand;
    ctx.stroke();
    // body with two humps
    ctx.beginPath();
    ctx.moveTo(-108, 22);
    ctx.bezierCurveTo(-116, -20, -100, -h1, -64, -h1);
    ctx.bezierCurveTo(-36, -h1, -34, -24, -18, -24);
    ctx.bezierCurveTo(-2, -24, 2, -h2, 30, -h2);
    ctx.bezierCurveTo(62, -h2, 64, -20, 78, -6);
    ctx.quadraticCurveTo(88, 46, 40, 50);
    ctx.lineTo(-76, 50);
    ctx.quadraticCurveTo(-112, 50, -108, 22);
    ctx.closePath();
    paint(ctx, fill);
    gloss(ctx, -78, -h1 + 18, 14, 6, -0.5, 0.5);
    gloss(ctx, 16, -h2 + 18, 14, 6, -0.5, 0.5);
    // head
    ctx.save();
    ctx.translate(122, -86);
    ctx.rotate(0.15 + sway);
    ell(ctx, -18, -26, 9, 12, sand, -0.4, 4);
    ell(ctx, 0, 0, 38, 25, shade(ctx, 0, 0, 38, '#f2cc8a', sand, '#c89a58'));
    ell(ctx, 28, 6, 16, 17, '#e8c080', 0, 4);
    line(ctx, [34, -2, 38, 0], 3);
    // mouth: chewing in the rest, a big grin when jiggling
    if (jig > 0.2) smile(ctx, 28, 16, 22, 0.3);
    else line(ctx, [18, 18 + chew * 2, 30, 20, 40, 17 - chew * 2], 3);
    const shut = blink(L.rest ? L.r : a + 1, 3.6);
    eye(ctx, -6, -6, 9, { shut: jig > 0.2 ? 0.4 : shut, lx: 0.5 });
    // heavy lid with lashes
    line(ctx, [-16, -12, -6, -17, 4, -12], 4);
    line(ctx, [-12, -15, -15, -20], 2.5);
    line(ctx, [-3, -17, -3, -22], 2.5);
    cheek(ctx, 6, 10, 7);
    ctx.restore();
    ctx.restore();
    if (jig > 0.4) {
      sparkle(ctx, -64, -h1 - 30, 9 * jig, '#fff');
      sparkle(ctx, 30, -h2 - 30, 9 * jig, '#fff');
    }
    // sun when it is very proud of its humps
    if (L.on) {
      const s = bell(a, 1.0, 3.5);
      if (s > 0.05) {
        ctx.save();
        ctx.translate(-150, -140);
        ctx.rotate(a);
        for (let i = 0; i < 8; i++) {
          ctx.rotate(Math.PI / 4);
          line(ctx, [0, 30 * s, 0, 42 * s], 4, '#f2a020');
        }
        ctx.restore();
        ell(ctx, -150, -140, 22 * s, 22 * s, '#ffd84a', 0, 4, '#c8801a');
      }
    }
  },
};

const Fisch: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // swims in a wave, blubbers bubbles
    const swim = L.on ? bell(a, 0, 3) : 0;
    const y = Math.sin(tt * 3) * 20 * swim + (L.rest ? Math.sin(L.r * 1.5) * 5 : 0);
    const x = Math.sin(tt * 1.5) * 18 * swim;
    const tail = Math.sin(tt * (L.on ? 12 : 4)) * (L.on ? 0.35 : alive ? 0.15 : 0);
    const blubb = L.on ? Math.abs(Math.sin(a * 6)) : L.rest ? bell(L.r % 2.5, 0, 0.6) : 0;
    ctx.save();
    ctx.translate(x - 10, y);
    ctx.rotate(Math.cos(tt * 3) * 0.12 * swim);
    // tail
    ctx.save();
    ctx.translate(-88, 0);
    ctx.rotate(tail);
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.quadraticCurveTo(-40, -60, -66, -70);
    ctx.quadraticCurveTo(-50, 0, -66, 70);
    ctx.quadraticCurveTo(-40, 60, 10, 0);
    ctx.closePath();
    paint(ctx, '#ff7a2e');
    line(ctx, [-6, 0, -48, -40], 3, 'rgba(255,220,180,0.8)');
    line(ctx, [-6, 0, -50, 0], 3, 'rgba(255,220,180,0.8)');
    line(ctx, [-6, 0, -48, 40], 3, 'rgba(255,220,180,0.8)');
    ctx.restore();
    // fins
    ctx.beginPath();
    ctx.moveTo(-40, -50);
    ctx.quadraticCurveTo(-10, -112, 40, -60);
    ctx.closePath();
    paint(ctx, '#ff9a4a');
    ctx.beginPath();
    ctx.moveTo(-10, 58);
    ctx.quadraticCurveTo(10, 100, 34, 56);
    ctx.closePath();
    paint(ctx, '#ff9a4a');
    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, 104, 66, 0, 0, TAU);
    paint(ctx, shade(ctx, 0, 0, 104, '#ffc070', '#ff8a3a', '#e0601e'));
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 0, 104, 66, 0, 0, TAU);
    ctx.clip();
    // white stripes
    for (const sx of [-50, 20]) {
      ctx.beginPath();
      ctx.ellipse(sx, 0, 14, 80, 0, 0, TAU);
      paint(ctx, '#ffffff', 4);
    }
    // scales
    ctx.strokeStyle = 'rgba(180,70,20,0.45)';
    ctx.lineWidth = 3;
    for (const [sx, sy] of [
      [-20, -20],
      [-20, 15],
      [-85, -10],
      [-85, 25],
      [45, 30],
    ]) {
      ctx.beginPath();
      ctx.arc(sx, sy, 12, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 104, 66, 0, 0, TAU);
    ctx.lineWidth = 6;
    ctx.strokeStyle = OL;
    ctx.stroke();
    gloss(ctx, -30, -40, 30, 9, -0.2, 0.5);
    // side fin
    ell(ctx, 20, 18, 18, 10, '#ff9a4a', 0.6, 4);
    // face
    const shut = blink(L.rest ? L.r : tt + 1, 3.3);
    eye(ctx, 58, -18, 18, { shut, lx: 0.6 });
    cheek(ctx, 66, 14, 10);
    if (blubb > 0.3) ell(ctx, 100, 16, 8, 6 + blubb * 6, '#7a2340', 0, 4);
    else smile(ctx, 92, 22, 22);
    ctx.restore();
    // bubbles
    if (alive) {
      const n = L.on ? 5 : 3;
      for (let i = 0; i < n; i++) {
        const k = (tt * (L.on ? 0.9 : 0.4) + i / n) % 1;
        bubble(ctx, x + 105 + Math.sin(k * 10 + i) * 8 + k * 25, y + 10 - k * 170, 6 + k * 10);
      }
    } else {
      bubble(ctx, 112, -40, 9);
      bubble(ctx, 128, -84, 13);
    }
  },
};

const Schule: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // the bell swings and rings, the house shakes a little, the clock jumps on
    const ring = L.on ? bell(a, 0, 3) : 0;
    const swing = Math.sin(a * 14) * 0.6 * ring;
    const shake = Math.sin(a * 40) * ring * 1.5;
    const hand = alive ? tt * (L.on ? 6 : 0.3) : 0;
    ctx.save();
    ctx.translate(shake, 0);
    // bell tower
    ctx.beginPath();
    ctx.rect(-26, -128, 52, 56);
    paint(ctx, '#f4e2c0');
    ctx.beginPath();
    ctx.rect(-16, -120, 32, 38);
    paint(ctx, '#5a4060', 4);
    ctx.save();
    ctx.translate(0, -120);
    ctx.rotate(swing);
    line(ctx, [0, 0, 0, 8], 4);
    ctx.beginPath();
    ctx.moveTo(-12, 30);
    ctx.quadraticCurveTo(-12, 6, 0, 6);
    ctx.quadraticCurveTo(12, 6, 12, 30);
    ctx.lineTo(15, 32);
    ctx.lineTo(-15, 32);
    ctx.closePath();
    paint(ctx, '#f6c626', 4);
    ell(ctx, 0, 34, 4, 4, '#c8901a', 0, 2.5);
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-36, -126);
    ctx.lineTo(0, -168);
    ctx.lineTo(36, -126);
    ctx.closePath();
    paint(ctx, '#d0453a');
    // flag
    line(ctx, [0, -168, 0, -196], 4);
    ctx.beginPath();
    ctx.moveTo(0, -196);
    ctx.quadraticCurveTo(14, -200 + Math.sin(tt * 6) * 3, 28, -192);
    ctx.lineTo(0, -184);
    ctx.closePath();
    paint(ctx, '#4fb3ff', 3);
    // building
    ctx.beginPath();
    ctx.rect(-140, -20, 280, 150);
    paint(ctx, shade(ctx, -40, 30, 200, '#ffd09a', '#f2a868', '#d8884a'));
    // roof
    ctx.beginPath();
    ctx.moveTo(-160, -16);
    ctx.lineTo(0, -98);
    ctx.lineTo(160, -16);
    ctx.closePath();
    paint(ctx, shade(ctx, 0, -60, 150, '#f07a6a', '#d0453a', '#a83028'));
    // clock in the gable
    ell(ctx, 0, -46, 22, 22, '#fff', 0, 5);
    line(ctx, [0, -46, Math.sin(hand) * 15, -46 - Math.cos(hand) * 15], 3.5);
    line(ctx, [0, -46, Math.sin(hand / 12) * 9, -46 - Math.cos(hand / 12) * 9], 4.5);
    // windows
    const win = (x: number, y: number, board = false) => {
      ctx.beginPath();
      ctx.roundRect(x - 22, y - 20, 44, 40, 5);
      paint(ctx, board ? '#3a6a4a' : '#bfe4ff', 5);
      if (board) {
        line(ctx, [x - 12, y - 6, x - 2, y - 10, x + 6, y - 4], 2.5, '#ffffff');
        line(ctx, [x - 10, y + 6, x + 12, y + 4], 2.5, '#ffffff');
      } else {
        line(ctx, [x, y - 20, x, y + 20], 3.5);
        line(ctx, [x - 22, y, x + 22, y], 3.5);
        gloss(ctx, x - 12, y - 10, 5, 3, -0.5, 0.8);
      }
    };
    win(-104, 22);
    win(-52, 22, true);
    win(52, 22);
    win(104, 22);
    win(-104, 88);
    win(104, 88);
    // door with a face above it
    ctx.beginPath();
    ctx.moveTo(-34, 130);
    ctx.lineTo(-34, 82);
    ctx.quadraticCurveTo(-34, 58, 0, 58);
    ctx.quadraticCurveTo(34, 58, 34, 82);
    ctx.lineTo(34, 130);
    ctx.closePath();
    paint(ctx, '#8a5a3a');
    line(ctx, [0, 60, 0, 130], 4);
    ell(ctx, -8, 100, 3.5, 3.5, '#f6c626', 0, 2);
    ell(ctx, 8, 100, 3.5, 3.5, '#f6c626', 0, 2);
    const shut = blink(L.rest ? L.r : tt + 1, 3.6);
    eye(ctx, -16, 20, 10, { shut, happy: ring > 0.3 });
    eye(ctx, 16, 20, 10, { shut, happy: ring > 0.3 });
    cheek(ctx, -30, 40, 8);
    cheek(ctx, 30, 40, 8);
    smile(ctx, 0, 42, 20, ring > 0.3 ? 0.5 : 0);
    // steps
    ctx.beginPath();
    ctx.rect(-52, 130, 104, 12);
    paint(ctx, '#b8b0c0', 4);
    // school bag by the door
    ctx.beginPath();
    ctx.roundRect(46, 100, 36, 38, 8);
    paint(ctx, '#4fb3ff', 4);
    ctx.beginPath();
    ctx.roundRect(46, 100, 36, 18, 8);
    paint(ctx, '#2f86d0', 4);
    ell(ctx, 64, 118, 4, 4, '#f6c626', 0, 2);
    ctx.restore();
    if (ring > 0.05) {
      sound(ctx, -10, -100, Math.PI * 1.05, a * 3, 3, 5);
      sound(ctx, 10, -100, -Math.PI * 0.05, a * 3, 3, 5);
    }
  },
};

const Fuchs: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    // hides behind its big tail, peeks left and right, comes out with a wink
    const hide = L.on ? ramp(a, 0.1, 0.8) * (1 - ramp(a, 2.6, 3.2)) : 0;
    const peek = L.on ? Math.sin((a - 0.8) * 4) * bell(a, 0.8, 2.6) : 0;
    const wink = L.on ? bell(a, 3.2, 4) > 0.3 : false;
    const breathe = L.rest ? Math.sin(L.r * 2) * 0.015 : 0;
    const wag = L.rest ? Math.sin(L.r * 1.6) * 0.06 : 0;
    const orange = '#f08a2c';
    const fur = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#ffb468', orange, '#c8641a');
    const tail = () => {
      ctx.save();
      ctx.translate(58 - hide * 50, 112);
      ctx.rotate(wag - hide * 0.4);
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.bezierCurveTo(40, 0, 90, -60, 70, -150);
      ctx.bezierCurveTo(60, -185, 20, -180, 18, -150);
      ctx.bezierCurveTo(30, -90, 0, -40, -24, -10);
      ctx.closePath();
      paint(ctx, fur(50, -80, 100));
      ctx.save();
      ctx.clip();
      ell(ctx, 44, -168, 40, 34, '#fff8f0', 0, 5);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(-10, 10);
      ctx.bezierCurveTo(40, 0, 90, -60, 70, -150);
      ctx.bezierCurveTo(60, -185, 20, -180, 18, -150);
      ctx.bezierCurveTo(30, -90, 0, -40, -24, -10);
      ctx.closePath();
      ctx.lineWidth = 6;
      ctx.strokeStyle = OL;
      ctx.stroke();
      ctx.restore();
    };
    ground(ctx, 0, 134, 110);
    if (hide < 0.35) tail();
    ctx.save();
    ctx.translate(0, 130);
    ctx.scale(1, 1 + breathe);
    ctx.translate(0, -130);
    // body
    ell(ctx, 0, 62, 68, 72, fur(0, 62, 72));
    ell(ctx, 0, 70, 36, 54, '#fff8f0', 0, 4);
    // paws
    ell(ctx, -28, 126, 18, 12, '#5a3a2a', 0, 5);
    ell(ctx, 28, 126, 18, 12, '#5a3a2a', 0, 5);
    // head
    ctx.save();
    ctx.translate(peek * 44, -50 - hide * 6);
    ctx.rotate(peek * 0.12);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 26, -42);
      ctx.lineTo(s * 62, -100);
      ctx.lineTo(s * 72, -26);
      ctx.closePath();
      paint(ctx, fur(s * 50, -60, 40));
      ctx.beginPath();
      ctx.moveTo(s * 38, -42);
      ctx.lineTo(s * 60, -82);
      ctx.lineTo(s * 64, -36);
      ctx.closePath();
      paint(ctx, '#5a3a2a', 0);
    }
    ctx.beginPath();
    ctx.moveTo(-84, -8);
    ctx.quadraticCurveTo(-80, -60, 0, -62);
    ctx.quadraticCurveTo(80, -60, 84, -8);
    ctx.quadraticCurveTo(50, 22, 0, 52);
    ctx.quadraticCurveTo(-50, 22, -84, -8);
    ctx.closePath();
    paint(ctx, fur(0, -10, 80));
    // white cheeks
    ctx.save();
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(-90, -4);
    ctx.quadraticCurveTo(-40, -6, 0, 18);
    ctx.quadraticCurveTo(40, -6, 90, -4);
    ctx.lineTo(0, 70);
    ctx.closePath();
    ctx.fillStyle = '#fff8f0';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(-84, -8);
    ctx.quadraticCurveTo(-80, -60, 0, -62);
    ctx.quadraticCurveTo(80, -60, 84, -8);
    ctx.quadraticCurveTo(50, 22, 0, 52);
    ctx.quadraticCurveTo(-50, 22, -84, -8);
    ctx.closePath();
    ctx.lineWidth = 6;
    ctx.strokeStyle = OL;
    ctx.stroke();
    gloss(ctx, -36, -44, 14, 6, -0.3, 0.5);
    const shut = blink(L.rest ? L.r : a + 1, 3.4);
    const lx = hide > 0.5 ? (peek > 0 ? 0.9 : -0.9) : 0.1;
    eye(ctx, -28, -16, 12, { shut, lx, ly: hide > 0.5 ? -0.3 : 0 });
    if (wink) eye(ctx, 28, -16, 12, { shut: 1 });
    else eye(ctx, 28, -16, 12, { shut, lx, ly: hide > 0.5 ? -0.3 : 0 });
    cheek(ctx, -46, 10, 10);
    cheek(ctx, 46, 10, 10);
    ell(ctx, 0, 40, 11, 8, '#2a1d33', 0, 3);
    gloss(ctx, -3, 37, 4, 2, -0.4, 0.8);
    smile(ctx, 8, 24, 22, wink ? 0.4 : 0);
    ctx.restore();
    ctx.restore();
    if (hide >= 0.35) tail();
    if (wink) sparkle(ctx, 70, -110, 14 * bell(a, 3.2, 4), '#fff');
  },
};

function teacup(ctx: C, x: number, y: number, s: number, steam: number, tt: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ell(ctx, 0, 14, 28, 6, '#fff', 0, 4);
  ctx.beginPath();
  ctx.moveTo(-20, -10);
  ctx.lineTo(20, -10);
  ctx.quadraticCurveTo(20, 14, 0, 14);
  ctx.quadraticCurveTo(-20, 14, -20, -10);
  ctx.closePath();
  paint(ctx, '#ffffff', 4);
  ell(ctx, 0, 2, 5, 4, '#ff8fb0', 0, 0);
  ctx.beginPath();
  ctx.arc(22, 0, 7, -Math.PI * 0.5, Math.PI * 0.5);
  ctx.lineWidth = 4;
  ctx.strokeStyle = OL;
  ctx.stroke();
  if (steam > 0.05) {
    ctx.globalAlpha = steam;
    for (const sx of [-7, 7]) {
      ctx.beginPath();
      ctx.moveTo(sx, -16);
      ctx.bezierCurveTo(sx - 8, -24 + Math.sin(tt * 5) * 2, sx + 8, -30, sx, -40);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(120,110,140,0.7)';
      ctx.stroke();
    }
  }
  ctx.restore();
}

const Puppe: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // waves, a teacup pops into its hand, it sips and offers it
    const wave = L.on ? Math.sin(a * 10) * bell(a, 0, 1.2) : 0;
    const cup = alive ? ramp(a, 1.1, 1.4) : 0;
    const cupPop = alive ? 1 + bell(a, 1.1, 1.6) * 0.3 : 0;
    const sip = L.on ? bell(a, 1.7, 2.8) : 0;
    const offer = L.on ? ramp(a, 3.0, 3.4) : alive ? 1 : 0;
    const tilt = L.on ? Math.sin(a * 2) * 0.08 : L.rest ? Math.sin(L.r * 1.5) * 0.06 : 0;
    ground(ctx, 0, 146, 80);
    ctx.save();
    ctx.translate(0, 140);
    ctx.rotate(tilt * 0.4);
    ctx.translate(0, -140);
    // legs with striped stockings and shoes
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(s * 22 - 10, 70, 20, 62, 8);
      paint(ctx, '#fff', 4);
      ctx.save();
      ctx.clip();
      for (let y = 76; y < 132; y += 14) {
        ctx.fillStyle = '#7a6aff';
        ctx.fillRect(s * 22 - 12, y, 24, 7);
      }
      ctx.restore();
      ell(ctx, s * 24, 136, 18, 10, '#d0453a', 0, 4);
    }
    // left arm (waves)
    ctx.save();
    ctx.translate(-42, -4);
    ctx.rotate(0.3 + bell(a, 0, 1.2) * 2.1 + wave * 0.45);
    ctx.beginPath();
    ctx.roundRect(-9, 0, 18, 58, 9);
    paint(ctx, '#fbd6bc', 5);
    ell(ctx, 0, 62, 12, 12, '#fbd6bc', 0, 5);
    ctx.restore();
    // right arm with the cup
    const armRot = -0.5 - sip * 1.4 - offer * 0.7 * (1 - sip);
    ctx.save();
    ctx.translate(42, -4);
    ctx.rotate(armRot);
    ctx.beginPath();
    ctx.roundRect(-9, 0, 18, 58, 9);
    paint(ctx, '#fbd6bc', 5);
    ell(ctx, 0, 62, 12, 12, '#fbd6bc', 0, 5);
    if (cup > 0) {
      ctx.save();
      ctx.translate(0, 62);
      ctx.rotate(-armRot);
      teacup(ctx, 8, -12, cup * cupPop, alive ? 0.4 + sip * 0.6 : 0, tt);
      ctx.restore();
    }
    ctx.restore();
    // dress with dots and a patch
    ctx.beginPath();
    ctx.moveTo(-34, -14);
    ctx.lineTo(34, -14);
    ctx.quadraticCurveTo(70, 50, 76, 84);
    ctx.quadraticCurveTo(0, 100, -76, 84);
    ctx.quadraticCurveTo(-70, 50, -34, -14);
    ctx.closePath();
    paint(ctx, shade(ctx, 0, 30, 90, '#ff9ac0', '#ec5a8a', '#c23a6a'));
    for (const [dx, dy] of [
      [-30, 20],
      [10, 10],
      [36, 46],
      [-46, 62],
      [0, 56],
      [50, 76],
      [-14, 80],
    ])
      ell(ctx, dx, dy, 5, 5, '#fff', 0, 0);
    ctx.beginPath();
    ctx.rect(14, 52, 22, 20);
    paint(ctx, '#ffe14a', 3);
    ctx.save();
    ctx.setLineDash([4, 4]);
    line(ctx, [16, 54, 34, 54, 34, 70, 16, 70, 16, 54], 2);
    ctx.restore();
    // collar
    ell(ctx, -14, -12, 18, 9, '#fff', 0.2, 4);
    ell(ctx, 14, -12, 18, 9, '#fff', -0.2, 4);
    // head
    ctx.save();
    ctx.translate(0, -70);
    ctx.rotate(tilt);
    // pigtails with bows
    for (const s of [-1, 1]) {
      const sw = Math.sin(tt * 4 + s) * (L.on ? 0.15 : 0.05);
      ctx.save();
      ctx.translate(s * 52, -16);
      ctx.rotate(s * (0.5 + sw));
      ell(ctx, s * 18, 30, 16, 34, '#e8742a', s * 0.2, 5);
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(s * 54, -18);
      ctx.lineTo(s * 76, -36);
      ctx.lineTo(s * 78, -2);
      ctx.closePath();
      ctx.moveTo(s * 54, -18);
      ctx.lineTo(s * 34, -38);
      ctx.lineTo(s * 32, -2);
      ctx.closePath();
      paint(ctx, '#4fb3ff', 4);
      ell(ctx, s * 54, -18, 6, 6, '#2f86d0', 0, 3);
    }
    ell(ctx, 0, 0, 56, 54, shade(ctx, 0, 0, 56, '#fff0e0', '#fbd6bc', '#e8b090'));
    // yarn bangs
    ctx.beginPath();
    ctx.moveTo(-56, -6);
    ctx.quadraticCurveTo(-56, -58, 0, -58);
    ctx.quadraticCurveTo(56, -58, 56, -6);
    for (let i = 0; i < 6; i++) {
      const x0 = 56 - (i * 112) / 6;
      ctx.quadraticCurveTo(x0 - 9, -14, x0 - 18.6, -26);
    }
    ctx.closePath();
    paint(ctx, '#e8742a', 5);
    // button eyes
    for (const s of [-1, 1]) {
      ell(ctx, s * 20, 6, 10, 10, '#2a1d33', 0, 3);
      for (const [hx, hy] of [
        [-3, -3],
        [3, -3],
        [-3, 3],
        [3, 3],
      ])
        ell(ctx, s * 20 + hx, 6 + hy, 1.5, 1.5, '#8a7a9a', 0, 0);
      gloss(ctx, s * 20 - 4, 1, 3, 2, -0.5, 0.8);
    }
    cheek(ctx, -32, 24, 10, 0.7);
    cheek(ctx, 32, 24, 10, 0.7);
    // stitched smile
    smile(ctx, 0, 30, 28, sip > 0.3 ? 0 : wave !== 0 ? 0.4 : 0);
    for (const sx of [-10, 0, 10]) line(ctx, [sx, 28 + Math.abs(sx) * -0.3, sx, 36 - Math.abs(sx) * 0.3], 2);
    ctx.restore();
    ctx.restore();
  },
};

const Elefant: Picto = {
  anim: 4,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // trumpets, lifts the trunk and showers itself
    const up = L.on ? ramp(a, 0, 0.6) * (1 - ramp(a, 3.3, 4)) : 0;
    const toot = L.on ? bell(a, 0.3, 1.0) : 0;
    const spray = L.on ? a > 0.9 && a < 3.4 : false;
    const ear = Math.sin(tt * (L.on ? 7 : 2)) * (L.on ? 0.18 : alive ? 0.06 : 0);
    const swayT = L.rest ? Math.sin(L.r * 1.6) : 0;
    const gray = '#a8b2c4';
    const fill = (x: number, y: number, r: number) => shade(ctx, x, y, r, '#c8d0de', gray, '#808aa0');
    ground(ctx, 0, 138, 140);
    // tail
    line(ctx, [-118, 10, -135, 50], 5);
    ell(ctx, -136, 56, 6, 9, '#5a6070', 0.2, 3);
    // legs
    for (const [lx, d] of [
      [-90, 1],
      [-50, 0],
      [10, 1],
      [48, 0],
    ]) {
      ctx.beginPath();
      ctx.roundRect(lx - 17, 50, 34, 82, 12);
      paint(ctx, d ? '#949eb2' : gray, 5);
      for (const n of [-8, 0, 8]) ell(ctx, lx + n, 126, 4, 3.5, '#eef0f4', 0, 2);
    }
    // body
    ell(ctx, -30, 24, 100, 70, fill(-30, 24, 100));
    gloss(ctx, -70, -16, 26, 9, -0.3, 0.45);
    // trunk (behind the ear's front)
    const tipX = 150 + up * 6 + swayT * 4;
    const tipY = 92 - up * 200 + swayT * 4;
    const cX = 150 + up * 20;
    const cY = 40 - up * 70;
    ctx.beginPath();
    ctx.moveTo(108, -6);
    ctx.quadraticCurveTo(cX, cY, tipX, tipY);
    ctx.lineCap = 'round';
    ctx.lineWidth = 36;
    ctx.strokeStyle = OL;
    ctx.stroke();
    ctx.lineWidth = 24;
    ctx.strokeStyle = gray;
    ctx.stroke();
    ell(ctx, tipX, tipY, 13, 9, '#949eb2', up * 1.2, 4);
    // head
    ell(ctx, 70, -20, 58, 54, fill(70, -20, 58));
    // tusk
    ctx.beginPath();
    ctx.moveTo(98, 20);
    ctx.quadraticCurveTo(120, 34, 130, 22);
    ctx.quadraticCurveTo(116, 20, 104, 10);
    ctx.closePath();
    paint(ctx, '#fffaf0', 4);
    // ear
    ctx.save();
    ctx.translate(40, -40);
    ctx.rotate(ear - 0.1);
    ell(ctx, -6, 30, 44, 56, fill(-6, 30, 56));
    ell(ctx, -6, 30, 30, 42, '#e6b8c8', 0, 0);
    ctx.restore();
    const shut = blink(L.rest ? L.r : tt + 1, 3.6);
    eye(ctx, 92, -36, 12, { shut: spray ? 1 : shut, happy: spray, lx: 0.4 });
    cheek(ctx, 100, -8, 10);
    smile(ctx, 88, 14, 18, toot > 0.2 ? 0.5 : 0);
    // water shower
    if (spray) {
      for (let i = 0; i < 16; i++) {
        const t0 = 0.9 + i * 0.14;
        const k = a - t0;
        if (k < 0 || k > 1.1) continue;
        const vx = -60 - ((i * 37) % 90);
        const vy = -170 - ((i * 53) % 70);
        const x = tipX + vx * k;
        const y = tipY - 10 + vy * k + 300 * k * k;
        if (y > 80) continue;
        drop(ctx, x, y, 6 + (i % 3));
      }
    }
    if (toot > 0.05) sound(ctx, tipX, tipY - 6, -Math.PI / 2, a * 3, 3, 5);
  },
};

const Kuh: Picto = {
  anim: 3.5,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // a big moo with its head up, the bell rings, then a glass of milk appears
    const moo = L.on ? bell(a, 0.1, 1.5) : 0;
    const bellSwing = Math.sin(tt * 10) * (L.on ? 0.5 * bell(a, 0, 2.2) : 0) + (L.rest ? Math.sin(L.r * 2) * 0.08 : 0);
    const tail = Math.sin(tt * (L.on ? 6 : 1.8)) * (alive ? 0.4 : 0);
    const milk = alive ? ramp(a, 1.8, 2.2) : 0;
    const milkPop = alive ? 1 + bell(a, 1.8, 2.5) * 0.3 : 0;
    const chew = L.rest ? Math.sin(L.r * 5) * 2 : 0;
    ground(ctx, -10, 140, 140);
    // tail
    ctx.save();
    ctx.translate(-128, -16);
    ctx.rotate(tail * 0.6);
    line(ctx, [0, 0, -16, 50, -12, 90], 5);
    ell(ctx, -12, 98, 9, 14, '#3a2a2a', 0, 3);
    ctx.restore();
    // legs
    for (const [lx, d] of [
      [-110, 1],
      [-78, 0],
      [20, 1],
      [52, 0],
    ]) {
      ctx.beginPath();
      ctx.roundRect(lx - 13, 40, 26, 92, 10);
      paint(ctx, d ? '#e8e6e0' : '#fbfbf7', 5);
      ctx.beginPath();
      ctx.roundRect(lx - 14, 118, 28, 18, 6);
      paint(ctx, '#4a3a3a', 4);
    }
    // udder
    ell(ctx, -32, 70, 26, 16, '#ffb4c4', 0, 5);
    for (const ux of [-44, -32, -20]) ell(ctx, ux, 88, 4.5, 7, '#ff9ab0', 0, 3);
    // body with spots
    ctx.beginPath();
    ctx.roundRect(-136, -40, 216, 110, 50);
    paint(ctx, shade(ctx, -30, 0, 140, '#ffffff', '#fbfbf7', '#dcd8d0'));
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-136, -40, 216, 110, 50);
    ctx.clip();
    for (const [sx, sy, sr] of [
      [-90, -20, 30],
      [-20, 30, 26],
      [40, -26, 22],
      [-70, 50, 18],
    ]) {
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const th = (i / 12) * TAU;
        const r = sr * (1 + 0.25 * Math.sin(th * 3 + sx));
        if (i === 0) ctx.moveTo(sx + Math.cos(th) * r, sy + Math.sin(th) * r);
        else ctx.lineTo(sx + Math.cos(th) * r, sy + Math.sin(th) * r);
      }
      ctx.closePath();
      ctx.fillStyle = '#3a2a2a';
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.roundRect(-136, -40, 216, 110, 50);
    ctx.lineWidth = 6;
    ctx.strokeStyle = OL;
    ctx.stroke();
    // milk glass
    if (milk > 0) {
      ctx.save();
      ctx.translate(130, 132);
      ctx.scale(milk * milkPop, milk * milkPop);
      ctx.beginPath();
      ctx.moveTo(-20, -60);
      ctx.lineTo(20, -60);
      ctx.lineTo(16, 0);
      ctx.lineTo(-16, 0);
      ctx.closePath();
      paint(ctx, '#ffffff', 5);
      ctx.beginPath();
      ctx.moveTo(-19, -58);
      ctx.lineTo(19, -58);
      ctx.lineTo(18, -48);
      ctx.lineTo(-18, -48);
      ctx.closePath();
      ctx.fillStyle = '#dff2ff';
      ctx.fill();
      gloss(ctx, -9, -22, 3, 12, 0, 0.8);
      ctx.restore();
      if (L.on) sparkle(ctx, 160, 60, 12 * bell(a, 1.8, 3.5), '#fff');
    }
    // head (looking at us), lifts for the moo
    ctx.save();
    ctx.translate(96, -46 - moo * 14);
    ctx.rotate(-moo * 0.25);
    // horns and ears
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 18, -40);
      ctx.quadraticCurveTo(s * 34, -70, s * 26, -78);
      ctx.quadraticCurveTo(s * 40, -66, s * 34, -36);
      ctx.closePath();
      paint(ctx, '#f8ecd0', 4);
      ell(ctx, s * 50, -26, 20, 10, '#fbfbf7', s * 0.4, 5);
      ell(ctx, s * 50, -26, 11, 5, '#ffb4c4', s * 0.4, 0);
    }
    ell(ctx, 0, -10, 40, 46, shade(ctx, 0, -10, 46, '#ffffff', '#fbfbf7', '#dcd8d0'));
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -10, 40, 46, 0, 0, TAU);
    ctx.clip();
    ell(ctx, 22, -44, 20, 18, '#3a2a2a', 0, 0);
    ctx.restore();
    const shut = blink(L.rest ? L.r : tt + 1, 3.6);
    eye(ctx, -15, -20, 10, { shut: moo > 0.4 ? 1 : shut });
    eye(ctx, 15, -20, 10, { shut: moo > 0.4 ? 1 : shut });
    // snout
    ell(ctx, 0, 22, 36, 24, '#ffb4c4');
    ell(ctx, -13, 18, 5, 6, '#c86a80', 0, 0);
    ell(ctx, 13, 18, 5, 6, '#c86a80', 0, 0);
    if (moo > 0.2) ell(ctx, 0, 36, 12, 6 + moo * 8, '#7a2340', 0, 4);
    else line(ctx, [-12, 34 + chew, 0, 38, 12, 34 - chew], 3.5);
    cheek(ctx, -30, 4, 8);
    cheek(ctx, 30, 4, 8);
    ctx.restore();
    // bell on a strap
    line(ctx, [64, -2, 96, 14, 128, -2], 6, '#d0453a');
    ctx.save();
    ctx.translate(96, 14);
    ctx.rotate(bellSwing);
    ctx.beginPath();
    ctx.moveTo(-12, 28);
    ctx.quadraticCurveTo(-12, 2, 0, 2);
    ctx.quadraticCurveTo(12, 2, 12, 28);
    ctx.lineTo(15, 30);
    ctx.lineTo(-15, 30);
    ctx.closePath();
    paint(ctx, '#f6c626', 4);
    ell(ctx, 0, 32, 4, 4, '#c8901a', 0, 2.5);
    ctx.restore();
    if (moo > 0.05) sound(ctx, 150, -70, -0.5, a * 2.5, 3, 5);
  },
};

const Spinne: Picto = {
  anim: 3,
  draw(ctx, t, alive) {
    const L = life(t, alive, this.anim);
    const a = L.a;
    const tt = alive ? t : 0;
    // bounces on its thread like a yo-yo and wiggles all eight legs, giggling
    const play = L.on ? bell(a, 0, 3) : 0;
    const y = -Math.abs(Math.sin(a * Math.PI * 1.5)) * 50 * play + (L.rest ? Math.sin(L.r * 1.4) * 4 : 0);
    const swing = L.rest ? Math.sin(L.r * 1.1) * 0.05 : Math.sin(a * 3) * 0.06 * play;
    const wig = L.on ? 0.5 * play : alive ? 0.12 : 0;
    const speed = L.on ? 16 : 2.5;
    // web in the corner
    ctx.save();
    ctx.strokeStyle = 'rgba(120,110,140,0.55)';
    ctx.lineWidth = 2.5;
    const wx = -150;
    const wy = -150;
    for (let i = 0; i <= 5; i++) {
      const th = (i / 5) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(th) * 120, wy + Math.sin(th) * 120);
      ctx.stroke();
    }
    for (const r of [30, 60, 90, 115]) {
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const th = (i / 5) * (Math.PI / 2);
        const x = wx + Math.cos(th) * r;
        const yy = wy + Math.sin(th) * r;
        if (i === 0) ctx.moveTo(x, yy);
        else ctx.quadraticCurveTo(wx + Math.cos(th - 0.16) * r * 0.9, wy + Math.sin(th - 0.16) * r * 0.9, x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(0, -200);
    ctx.rotate(swing);
    ctx.translate(0, 200);
    // thread
    line(ctx, [0, -200, 0, y - 20], 3, 'rgba(90,80,110,0.8)');
    ctx.translate(0, y + 20);
    // legs
    for (const s of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const base = -0.75 + i * 0.5;
        const w = Math.sin(tt * speed + i * 1.3 + (s > 0 ? 0.7 : 0)) * wig;
        const ang = base + w;
        const kx = s * (58 + Math.cos(ang) * 50);
        const ky = Math.sin(ang) * 50 - 30;
        const fx = s * (70 + Math.cos(ang) * 82);
        const fy = ky + 46 + w * 20;
        line(ctx, [s * 30, -4 + i * 10, kx, ky, fx, fy], 13, OL);
        line(ctx, [s * 30, -4 + i * 10, kx, ky, fx, fy], 7, '#7a5aa0');
        ell(ctx, fx, fy + 2, 7, 5, '#ff8fb0', 0, 3);
      }
    // body
    ell(ctx, 0, 10, 60, 56, shade(ctx, 0, 10, 60, '#9a7ac8', '#6a4a96', '#4a2e70'));
    for (const sy of [36, 50]) {
      ctx.beginPath();
      ctx.moveTo(-34, sy);
      ctx.quadraticCurveTo(0, sy + 12, 34, sy);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(255,200,240,0.5)';
      ctx.stroke();
    }
    gloss(ctx, -24, -22, 16, 7, -0.4, 0.5);
    const laugh = play > 0.2;
    const shut = blink(L.rest ? L.r : tt + 1, 3.2);
    eye(ctx, -20, -4, 15, { shut, happy: laugh });
    eye(ctx, 20, -4, 15, { shut, happy: laugh });
    eye(ctx, -8, -28, 7, { shut, happy: laugh });
    eye(ctx, 8, -28, 7, { shut, happy: laugh });
    cheek(ctx, -38, 18, 10, 0.6);
    cheek(ctx, 38, 18, 10, 0.6);
    smile(ctx, 0, 26, 26, laugh ? 0.5 + Math.abs(Math.sin(tt * 10)) * 0.3 : 0);
    ctx.restore();
  },
};

export const gruppe2: Record<string, Picto> = {
  Opa,
  Ei,
  Igel,
  Limo,
  Nest,
  Eule,
  Rabe,
  Hase,
  Kerze,
  Banane,
  Brot,
  Kran,
  Löwe: Loewe,
  Kamel,
  Fisch,
  Schule,
  Fuchs,
  Puppe,
  Elefant,
  Kuh,
  Spinne,
};

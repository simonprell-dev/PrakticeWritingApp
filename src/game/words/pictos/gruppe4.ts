// Pictures of the Wörter-Zoo, group 4: Papa, Ente, Rose, Maus, Hose, Wal, Tomate, Tulpe, Zebra, Wolke, Bus,
// Leiter, Zelt, Rakete, Biene, Kuchen, Schnecke, Giraffe, Brille, Zahn. Drawn around (0, 0) in a square of
// about 300, thick dark outline, round shapes, friendly faces; each comes alive with its own little joke.
import type { Ctx2D, Picto } from '../picto.ts';

const TAU = Math.PI * 2;
const OL = '#3b2a3f';
const LW = 6;

const clamp = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
const sm = (u: number) => u * u * (3 - 2 * u);
/** progress 0..1 of x through [a, b] */
const win = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
/** 0 -> 1 -> 0 over [a, b] */
const hump = (x: number, a: number, b: number) => {
  const u = win(x, a, b);
  return u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
};
/** rises over r seconds after a, holds, falls over r seconds before b */
const env = (x: number, a: number, b: number, r: number) => (x <= a || x >= b ? 0 : sm(win(x, a, a + r)) * (1 - sm(win(x, b - r, b))));

interface St {
  t: number;
  alive: boolean;
  /** time inside the funny animation (0 while still, anim once it is over) */
  a: number;
  /** the funny animation is playing */
  on: boolean;
  /** seconds of the calm loop, -1 before it */
  rest: number;
  /** calm breathing -1..1 (0 unless resting) */
  calm: number;
  blink: boolean;
}

function pic(anim: number, fn: (ctx: Ctx2D, s: St) => void): Picto {
  return {
    anim,
    draw(ctx, t, alive) {
      const rest = alive && t >= anim ? t - anim : -1;
      const s: St = {
        t: alive ? t : 0,
        alive,
        a: alive ? Math.min(t, anim) : 0,
        on: alive && t < anim,
        rest,
        calm: rest >= 0 ? Math.sin(rest * 2.2) : 0,
        blink: alive && (t + 0.9) % 3.4 < 0.16,
      };
      ctx.save();
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      fn(ctx, s);
      ctx.restore();
    },
  };
}

// ---------- drawing helpers ----------

function fs(ctx: Ctx2D, fill: string | CanvasGradient | null, lw = LW): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = OL;
    ctx.stroke();
  }
}

function ell(ctx: Ctx2D, x: number, y: number, rx: number, ry: number, fill: string | CanvasGradient | null, rot = 0, lw = LW): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
  fs(ctx, fill, lw);
}

function circ(ctx: Ctx2D, x: number, y: number, r: number, fill: string | CanvasGradient | null, lw = LW): void {
  ell(ctx, x, y, r, r, fill, 0, lw);
}

function rr(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient | null, lw = LW): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  fs(ctx, fill, lw);
}

function poly(ctx: Ctx2D, pts: number[], fill: string | null, lw = LW): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  fs(ctx, fill, lw);
}

/** a thick outlined stroke (arm, stem, neck): path built by `path` */
function tube(ctx: Ctx2D, path: () => void, w: number, color: string): void {
  ctx.beginPath();
  path();
  ctx.lineWidth = w + LW * 1.6;
  ctx.strokeStyle = OL;
  ctx.stroke();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function line(ctx: Ctx2D, pts: number[], color = OL, lw = LW): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke();
}

interface EyeOpt {
  closed?: boolean;
  happy?: boolean;
  look?: [number, number];
}

function eye(ctx: Ctx2D, x: number, y: number, r: number, o: EyeOpt = {}): void {
  ctx.save();
  ctx.strokeStyle = OL;
  ctx.lineWidth = Math.max(3, r * 0.32);
  if (o.happy) {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.45, r * 0.85, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  } else if (o.closed) {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.3, r * 0.85, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  } else {
    const [lx, ly] = o.look ?? [0.15, 0.1];
    ctx.lineWidth = Math.max(2.5, r * 0.2);
    circ(ctx, x, y, r, '#fff', Math.max(2.5, r * 0.2));
    const px = x + lx * r * 0.38;
    const py = y + ly * r * 0.38;
    circ(ctx, px, py, r * 0.6, '#2a1d33', 0);
    circ(ctx, px - r * 0.2, py - r * 0.24, r * 0.22, '#fff', 0);
    circ(ctx, px + r * 0.2, py + r * 0.2, r * 0.09, '#fff', 0);
  }
  ctx.restore();
}

function eyes(ctx: Ctx2D, x1: number, x2: number, y: number, r: number, s: St, o: EyeOpt = {}): void {
  const closed = o.closed || (!o.happy && s.blink);
  eye(ctx, x1, y, r, { ...o, closed });
  eye(ctx, x2, y, r, { ...o, closed });
}

/** smile of half-width w; open 0..1 opens it into a laughing mouth */
function mouth(ctx: Ctx2D, x: number, y: number, w: number, open = 0): void {
  ctx.save();
  if (open > 0.05) {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + w * (0.5 + 1.3 * open), x + w, y);
    ctx.quadraticCurveTo(x, y + w * 0.15, x - w, y);
    ctx.closePath();
    fs(ctx, '#6b2440', Math.max(3, w * 0.22));
    ctx.save();
    ctx.clip();
    ell(ctx, x, y + w * (0.45 + 1.1 * open), w * 0.55, w * 0.4, '#ff7f9c', 0, 0);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x, y + w * 0.75, x + w, y);
    ctx.lineWidth = Math.max(3, w * 0.25);
    ctx.strokeStyle = OL;
    ctx.stroke();
  }
  ctx.restore();
}

function cheek(ctx: Ctx2D, x: number, y: number, r: number, a = 0.45): void {
  ell(ctx, x, y, r, r * 0.65, `rgba(255,105,140,${a})`, 0, 0);
}

function shine(ctx: Ctx2D, x: number, y: number, rx: number, ry: number, rot = -0.5, a = 0.6): void {
  ell(ctx, x, y, rx, ry, `rgba(255,255,255,${a})`, rot, 0);
}

function heart(ctx: Ctx2D, x: number, y: number, s: number, fill = '#ff5d8f', lw = 3): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.7, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9);
  ctx.closePath();
  fs(ctx, fill, lw);
}

function star(ctx: Ctx2D, x: number, y: number, r: number, fill = '#ffe066', rot = 0, lw = 3): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.45 : r;
    if (i) ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    else ctx.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  fs(ctx, fill, lw);
}

/** falling drop pointing up, s = radius of its round end */
function drop(ctx: Ctx2D, x: number, y: number, s: number, fill = '#7cc8f5', lw = 3): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 2.2);
  ctx.bezierCurveTo(x + s * 0.5, y - s, x + s, y - s * 0.5, x + s, y);
  ctx.arc(x, y, s, 0, Math.PI);
  ctx.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.5, y - s, x, y - s * 2.2);
  ctx.closePath();
  fs(ctx, fill, lw);
}

/** puff of smoke / dust */
function puff(ctx: Ctx2D, x: number, y: number, r: number, a: number, col = '235,235,240'): void {
  if (a <= 0.01 || r <= 0.5) return;
  ctx.save();
  ctx.globalAlpha = a;
  for (const [dx, dy, f] of [[-0.55, 0.15, 0.7], [0.55, 0.2, 0.65], [0, -0.2, 0.85]]) circ(ctx, x + dx * r, y + dy * r, r * f, null, LW * 1.4);
  for (const [dx, dy, f] of [[-0.55, 0.15, 0.7], [0.55, 0.2, 0.65], [0, -0.2, 0.85]]) circ(ctx, x + dx * r, y + dy * r, r * f, `rgb(${col})`, 0);
  ctx.restore();
}

/** short motion lines */
function whoosh(ctx: Ctx2D, x: number, y: number, len: number, a: number, dir = -1): void {
  if (a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = a;
  for (let i = -1; i <= 1; i++) line(ctx, [x, y + i * 16, x + dir * len * (i === 0 ? 1 : 0.7), y + i * 16], 'rgba(60,45,70,0.55)', 4);
  ctx.restore();
}

// ---------- the pictures ----------

const SKIN = '#f7c9a1';

function drawRose(ctx: Ctx2D, s: St, smell: number): void {
  // stem, thorns, leaves
  tube(ctx, () => {
    ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(-12, 70, 4, 150);
  }, 11, '#4caf50');
  for (const [x, y, d] of [[-6, 40, -1], [-3, 100, 1], [-8, 70, -1]]) poly(ctx, [x, y - 6, x + d * 14, y - 12, x, y + 4], '#3f8f43', 3);
  for (const [x, y, rot] of [[-6, 85, -2.5], [-3, 55, -0.5]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot + Math.sin(s.t * 3) * 0.06 * smell);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(25, -26, 62, -4);
    ctx.quadraticCurveTo(26, 22, 0, 0);
    fs(ctx, '#5cc160', 5);
    line(ctx, [4, 0, 50, -4], '#3f8f43', 3);
    ctx.restore();
  }
  // bloom
  const sc = 1 + 0.05 * smell;
  ctx.save();
  ctx.translate(0, -60);
  ctx.scale(sc, sc);
  ell(ctx, -48, -24, 40, 34, '#c71f3f', -0.4);
  ell(ctx, 48, -24, 40, 34, '#c71f3f', 0.4);
  ell(ctx, 0, -40, 58, 34, '#d92a4a');
  // spiral heart
  ctx.strokeStyle = '#8c0f2a';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = i * 0.21;
    const r = 4 + i * 0.75;
    const x = Math.cos(a) * r * 1.25;
    const y = -40 + Math.sin(a) * r * 0.6;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
  // front cup
  ctx.beginPath();
  ctx.moveTo(-74, -32);
  ctx.bezierCurveTo(-80, 35, -30, 58, 0, 58);
  ctx.bezierCurveTo(30, 58, 80, 35, 74, -32);
  ctx.quadraticCurveTo(40, -2, 0, -10);
  ctx.quadraticCurveTo(-40, -2, -74, -32);
  ctx.closePath();
  fs(ctx, '#ef3b5a');
  line(ctx, [-60, -20, -40, 30, -10, 52], 'rgba(140,15,42,0.55)', 4);
  line(ctx, [60, -20, 40, 30, 10, 52], 'rgba(140,15,42,0.55)', 4);
  shine(ctx, -45, -5, 12, 6, -1.0, 0.5);
  // face
  const happy = smell > 0.3;
  eyes(ctx, -20, 20, 18, 8, s, { happy });
  mouth(ctx, 0, 32, 11, happy ? 0.4 : 0);
  cheek(ctx, -38, 30, 10, 0.5);
  cheek(ctx, 38, 30, 10, 0.5);
  ctx.restore();
}

function drawBusKid(ctx: Ctx2D, x: number, y: number, i: number, s: St): void {
  const skins = ['#f7c9a1', '#c98d62', '#f1b48a', '#8d5a3b'];
  const hair = ['#7a4a26', '#2e2230', '#e8b23a', '#d0602e'];
  circ(ctx, x, y, 15, skins[i % 4], 4);
  ctx.beginPath();
  ctx.arc(x, y - 2, 16, Math.PI * 1.05, Math.PI * 1.95);
  ctx.closePath();
  fs(ctx, hair[i % 4], 4);
  eyes(ctx, x - 5, x + 5, y + 1, 3.6, s, { look: [0.5, 0] });
  mouth(ctx, x + 1, y + 7, 5, 0.6);
}

export const gruppe4: Record<string, Picto> = {
  Papa: pic(4, (ctx, s) => {
    const fly = s.on ? env(s.a, 0, 4, 0.7) : 0;
    const sw = Math.sin(s.a * 2.4) * fly;
    const bob = s.calm * 3;
    const kx = sw * 55;
    const ky = -104 - 20 * fly + bob - Math.abs(Math.sin(s.a * 2.4)) * 10 * fly;
    const kr = Math.cos(s.a * 2.4) * 0.3 * fly;
    ctx.save();
    ctx.rotate(sw * 0.04);
    // body
    rr(ctx, -88, 58, 176, 100, 40, '#4caf7d');
    poly(ctx, [-26, 58, 0, 95, 26, 58], '#fff', 4);
    rr(ctx, -16, 32, 32, 30, 8, SKIN, 5);
    // arms holding the child up
    const CS = 1.4;
    const hand = (lx: number) => [kx + (Math.cos(kr) * lx - Math.sin(kr) * 14) * CS, ky + (Math.sin(kr) * lx + Math.cos(kr) * 14) * CS];
    const [h1x, h1y] = hand(-14);
    const [h2x, h2y] = hand(16);
    tube(ctx, () => {
      ctx.moveTo(-70, 80);
      ctx.quadraticCurveTo(-112, -10, h1x - 4, h1y + 6);
    }, 26, '#4caf7d');
    tube(ctx, () => {
      ctx.moveTo(70, 80);
      ctx.quadraticCurveTo(112, -10, h2x + 4, h2y + 6);
    }, 26, '#4caf7d');
    // head
    circ(ctx, -47, 6, 11, SKIN, 5);
    circ(ctx, 47, 6, 11, SKIN, 5);
    circ(ctx, 0, 0, 48, SKIN);
    ctx.beginPath();
    ctx.arc(0, 0, 50, Math.PI * 1.02, Math.PI * 1.98);
    ctx.quadraticCurveTo(30, -36, 10, -28);
    ctx.quadraticCurveTo(-20, -40, -50, -6);
    ctx.closePath();
    fs(ctx, '#7a4a26', 5);
    const look: [number, number] = [sw * 1.2, -1];
    eyes(ctx, -17, 17, -4, 9, s, { look, happy: fly > 0.5 && Math.abs(sw) < 0.3 });
    mouth(ctx, 0, 30, 13, fly > 0.2 ? 0.7 * fly : 0);
    ell(ctx, -13, 21, 15, 6.5, '#7a4a26', 0.25, 4);
    ell(ctx, 13, 21, 15, 6.5, '#7a4a26', -0.25, 4);
    cheek(ctx, -31, 14, 8);
    cheek(ctx, 31, 14, 8);
    ctx.restore();
    // child, flying like a plane
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(kr);
    ctx.scale(CS, CS);
    whoosh(ctx, -72, 0, 30, fly);
    tube(ctx, () => {
      ctx.moveTo(-26, -3);
      ctx.lineTo(-60, -9);
    }, 11, '#3d6fd1');
    tube(ctx, () => {
      ctx.moveTo(-26, 4);
      ctx.lineTo(-58, 8);
    }, 11, '#3d6fd1');
    ell(ctx, -6, 0, 34, 15, '#ff6b5e');
    tube(ctx, () => {
      ctx.moveTo(14, -6);
      ctx.lineTo(52, -26);
    }, 9, '#ff6b5e');
    circ(ctx, 42, -6, 20, SKIN, 5);
    ctx.beginPath();
    ctx.arc(42, -8, 21, Math.PI * 0.95, Math.PI * 1.75);
    ctx.quadraticCurveTo(40, -20, 28, -16);
    ctx.closePath();
    fs(ctx, '#f0c02c', 4);
    eye(ctx, 50, -10, 5, { happy: fly > 0.2 || s.blink });
    mouth(ctx, 52, 2, 7, 0.3 + 0.6 * fly);
    cheek(ctx, 40, 2, 5);
    ctx.restore();
    // hands on top
    circ(ctx, h1x, h1y, 12, SKIN, 5);
    circ(ctx, h2x, h2y, 12, SKIN, 5);
  }),

  Ente: pic(4, (ctx, s) => {
    const bobY = s.alive ? Math.sin(s.t * 3) * 4 : 0;
    const dive = s.on ? env(s.a, 1.3, 2.7, 0.35) : 0;
    const quack = s.on ? Math.max(hump(s.a, 0.15, 0.55), hump(s.a, 0.65, 1.05), hump(s.a, 3.0, 3.5)) : 0;
    const flap = s.on ? env(s.a, 2.6, 3.8, 0.15) * Math.sin(s.a * 28) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-300, -300, 600, 418);
    ctx.clip();
    ctx.translate(0, bobY + dive * 26);
    ctx.translate(-10, 55);
    ctx.rotate(dive * 1.3);
    ctx.translate(10, -55);
    poly(ctx, [-135, -8, -80, 20, -100, 55], '#ffd43b');
    ell(ctx, -10, 55, 100, 58, '#ffd43b');
    circ(ctx, 55, -35, 48, '#ffd43b');
    ell(ctx, 42, 10, 30, 20, '#ffd43b', 0, 0);
    shine(ctx, 30, -60, 16, 8);
    // wing
    ctx.save();
    ctx.translate(15, 35);
    ctx.rotate(-0.25 - flap * 0.6);
    ell(ctx, -40, 12, 50, 26, '#f5b915');
    line(ctx, [-70, 14, -40, 20, -16, 14], 'rgba(160,100,10,0.6)', 3);
    ctx.restore();
    // beak
    ctx.save();
    ctx.translate(98, -26);
    ctx.rotate(quack * 0.45);
    ell(ctx, 10, 6, 26, 9, '#f57a10');
    ctx.restore();
    ell(ctx, 112, -30, 28, 10, '#ff9a1f', -0.05);
    eye(ctx, 68, -52, 11, { closed: s.blink || dive > 0.3, happy: quack > 0.3, look: [0.6, 0] });
    cheek(ctx, 76, -20, 9);
    ctx.restore();
    // water
    const wave = (x: number) => 98 + Math.sin(x * 0.05 + s.t * 2.4) * 5;
    ctx.beginPath();
    ctx.moveTo(-150, wave(-150));
    for (let x = -140; x <= 150; x += 10) ctx.lineTo(x, wave(x));
    ctx.quadraticCurveTo(160, 135, 120, 142);
    ctx.lineTo(-120, 142);
    ctx.quadraticCurveTo(-160, 135, -150, wave(-150));
    ctx.closePath();
    fs(ctx, '#6ec1ef', 5);
    line(ctx, [-100, 120, -60, 120], 'rgba(255,255,255,0.7)', 4);
    line(ctx, [40, 126, 90, 126], 'rgba(255,255,255,0.7)', 4);
    // splash when the head comes up
    const sp = s.on ? win(s.a, 2.4, 3.2) : 0;
    if (sp > 0 && sp < 1)
      for (let i = 0; i < 6; i++) {
        const vx = (i - 2.5) * 30;
        const x = 95 + vx * sp;
        const y = 95 - 110 * sp + 130 * sp * sp;
        ctx.save();
        ctx.globalAlpha = 1 - sp * 0.6;
        drop(ctx, x, y, 7, '#8fd3fa', 3);
        ctx.restore();
      }
  }),

  Rose: pic(3.5, (ctx, s) => {
    const smell = s.on ? env(s.a, 0, 3.5, 0.5) : 0;
    ctx.save();
    ctx.translate(0, 150);
    ctx.rotate(Math.sin(s.t * 2.5) * 0.07 * smell + s.calm * 0.02);
    ctx.translate(0, -150);
    drawRose(ctx, s, smell);
    ctx.restore();
    // scent swirls and hearts
    if (smell > 0)
      for (let i = 0; i < 3; i++) {
        const p = (s.a * 0.45 + i / 3) % 1;
        const x0 = (i - 1) * 55;
        const y0 = -100 - p * 70;
        ctx.save();
        ctx.globalAlpha = smell * Math.sin(Math.PI * p);
        ctx.beginPath();
        for (let k = 0; k <= 12; k++) {
          const yy = y0 + 20 - k * 4;
          const xx = x0 + Math.sin(k * 0.7 + s.a * 4 + i) * 10;
          if (k) ctx.lineTo(xx, yy);
          else ctx.moveTo(xx, yy);
        }
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff7fb0';
        ctx.stroke();
        heart(ctx, x0 + Math.sin(s.a * 3 + i) * 10, y0 - 34, 9, '#ff7fb0', 2.5);
        ctx.restore();
      }
  }),

  Maus: pic(4, (ctx, s) => {
    const cheese = s.alive ? sm(win(s.a, 1.8, 2.3)) : 0;
    const sniff = s.on ? env(s.a, 0, 1.8, 0.2) : 0;
    const search = s.on && s.a < 1.8 ? Math.sin(s.a * 3.5) : 0;
    const lookC = cheese;
    const jump = s.on ? Math.abs(Math.sin(win(s.a, 2.4, 3.8) * Math.PI * 2)) * (s.a > 2.4 && s.a < 3.8 ? 1 : 0) : 0;
    const fx = search * 14 * sniff + lookC * -16;
    // cheese
    if (cheese > 0) {
      ctx.save();
      ctx.translate(-118, 128);
      ctx.scale(cheese, cheese);
      poly(ctx, [-38, 10, 38, 10, 38, -22, -38, -6], '#ffcf3a', 5);
      poly(ctx, [-38, -6, 38, -22, 10, -40], '#ffe27a', 5);
      ell(ctx, 10, -4, 7, 5, '#e9a91c', 0, 0);
      ell(ctx, -16, 2, 5, 4, '#e9a91c', 0, 0);
      ell(ctx, 26, -12, 4, 3, '#e9a91c', 0, 0);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(15, -jump * 26 + s.calm * 2);
    const G = '#a9a2b8';
    // tail
    ctx.beginPath();
    ctx.moveTo(50, 120);
    ctx.bezierCurveTo(140, 140, 150, 40, 110 + Math.sin(s.t * 4) * 8 * (s.alive ? 1 : 0), 20);
    ctx.lineWidth = 12;
    ctx.strokeStyle = OL;
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f2a7b8';
    ctx.stroke();
    // body and feet
    ell(ctx, 0, 85, 68, 58, G);
    ell(ctx, 0, 95, 42, 38, '#d8d2e2', 0, 0);
    ell(ctx, -36, 142, 24, 10, '#f2a7b8', 0, 5);
    ell(ctx, 36, 142, 24, 10, '#f2a7b8', 0, 5);
    // ears
    for (const sx of [-1, 1]) {
      const wig = s.alive ? Math.sin(s.t * 6 + sx) * 0.05 : 0;
      ctx.save();
      ctx.translate(sx * 60, -78);
      ctx.rotate(wig);
      circ(ctx, 0, 0, 42, G);
      circ(ctx, 0, 2, 27, '#f5b6c6', 0);
      ctx.restore();
    }
    // head
    ell(ctx, 0, -18, 68, 58, G);
    shine(ctx, -30, -52, 16, 8);
    eyes(ctx, -24 + fx, 24 + fx, -30, 13, s, { look: [lookC ? -1 : search, lookC ? 0.6 : 0], happy: jump > 0.2 });
    const ny = 6 + Math.sin(s.t * 22) * 3 * sniff;
    // whiskers
    for (const sx of [-1, 1])
      for (const k of [-1, 0, 1]) {
        const tw = Math.sin(s.t * 18 + k) * 4 * sniff;
        line(ctx, [fx + sx * 18, ny + 4 + k * 5, fx + sx * 66, ny + k * 14 + tw], 'rgba(59,42,63,0.8)', 2.5);
      }
    rr(ctx, fx - 9, ny + 16, 8, 11, 2, '#fff', 3);
    rr(ctx, fx + 1, ny + 16, 8, 11, 2, '#fff', 3);
    ctx.beginPath();
    ctx.moveTo(fx - 13, ny + 12);
    ctx.quadraticCurveTo(fx, ny + 22, fx + 13, ny + 12);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = OL;
    ctx.stroke();
    circ(ctx, fx, ny, 11, '#ff8fab', 5);
    cheek(ctx, fx - 42, -2, 10);
    cheek(ctx, fx + 42, -2, 10);
    // little hands
    ell(ctx, -26, 60, 11, 9, '#f2a7b8', 0, 4);
    ell(ctx, 26, 60, 11, 9, '#f2a7b8', 0, 4);
    ctx.restore();
  }),

  Hose: pic(3.5, (ctx, s) => {
    const cross = s.on ? env(s.a, 0.6, 3.4, 0.6) : 0;
    const shake = s.on ? Math.sin(s.a * 30) * 0.02 * cross : 0;
    const peek = s.on ? win(s.a, 0, 0.5) * (1 - win(s.a, 0.7, 1)) : 0;
    const B = '#4f7fd0';
    const leg = (sx: number, ang: number, hole: boolean) => {
      ctx.save();
      ctx.translate(sx * 55, -40);
      ctx.rotate(ang);
      const pts = sx < 0 ? [-49, -20, -44, 182, 40, 182, 52, 10] : [49, -20, 44, 182, -40, 182, -52, 10];
      poly(ctx, pts, B);
      rr(ctx, Math.min(pts[2], pts[4]) - 2, 162, Math.abs(pts[4] - pts[2]) + 4, 20, 5, '#79a2e6', 5);
      line(ctx, [sx * 30, 0, sx * 25, 160], 'rgba(255,230,120,0.6)', 3);
      if (hole) {
        ell(ctx, 0, 95, 20, 15, SKIN, 0.2, 5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU;
          line(ctx, [Math.cos(a) * 18, 95 + Math.sin(a) * 13, Math.cos(a) * 26, 95 + Math.sin(a) * 19], '#dfe9ff', 2.5);
        }
      }
      ctx.restore();
    };
    ctx.save();
    ctx.translate(0, -12);
    ctx.rotate(shake + s.calm * 0.015);
    leg(-1, -0.45 * cross, true);
    leg(1, 0.2 * cross, false);
    // hips
    ctx.beginPath();
    ctx.moveTo(-100, -106);
    ctx.lineTo(100, -106);
    ctx.lineTo(106, -25);
    ctx.lineTo(0, -6);
    ctx.lineTo(-106, -25);
    ctx.closePath();
    fs(ctx, B, 0);
    line(ctx, [-100, -106, -106, -25]);
    line(ctx, [100, -106, 106, -25]);
    line(ctx, [0, -106, 0, -55, -6, -12], 'rgba(30,50,110,0.6)', 3.5);
    line(ctx, [-88, -98, -55, -75, -48, -100], 'rgba(30,50,110,0.6)', 3.5);
    line(ctx, [88, -98, 55, -75, 48, -100], 'rgba(30,50,110,0.6)', 3.5);
    rr(ctx, -104, -138, 208, 34, 8, '#3d68b8');
    for (const x of [-70, -25, 25, 70]) rr(ctx, x - 5, -142, 10, 40, 4, '#5a8be0', 4);
    circ(ctx, 0, -121, 8, '#f2c94c', 4);
    // face
    const look: [number, number] = peek > 0 || cross > 0.1 ? [-0.7, 1] : [0, 0.2];
    eyes(ctx, -30, 30, -70, 11, s, { look, closed: cross > 0.5 && Math.sin(s.a * 3) > 0.6 });
    mouth(ctx, 0, -46, 12 - cross * 4, 0);
    cheek(ctx, -52, -50, 12, 0.35 + 0.5 * cross);
    cheek(ctx, 52, -50, 12, 0.35 + 0.5 * cross);
    ctx.restore();
  }),

  Wal: pic(4, (ctx, s) => {
    const blow = s.on ? env(s.a, 0.6, 3.6, 0.5) : 0;
    const inhale = s.on ? hump(s.a, 0, 0.7) : 0;
    ctx.save();
    ctx.translate(2, 20 + s.calm * 3);
    ctx.scale(1 + inhale * 0.05, 1 - inhale * 0.06);
    // spout
    const h = 40 + 150 * blow;
    const bx = 50;
    const by = -30;
    ctx.save();
    ctx.globalAlpha = 0.95;
    for (const [dx, w] of [[-1, 1], [1, 1], [0, 1.3]]) {
      tube(ctx, () => {
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + dx * 8, by - h * 0.8, bx + dx * (20 + h * 0.25), by - h * (dx === 0 ? 1 : 0.85));
      }, 9 * w, '#a8dcff');
    }
    for (let i = 0; i < 6; i++) {
      const p = (s.t * 1.3 + i / 6) % 1;
      const dx = (i - 2.5) * 0.42;
      const x = bx + dx * (30 + h * 0.4) * (0.5 + p * 0.6);
      const y = by - h + p * h * 0.7 * (s.alive ? 1 : 0.3);
      drop(ctx, x, y + (s.alive ? 0 : 6), 6, '#a8dcff', 3);
    }
    ctx.restore();
    // tail
    ctx.beginPath();
    ctx.moveTo(-80, 0);
    ctx.quadraticCurveTo(-130, 20, -140, -25);
    ctx.lineTo(-115, 30);
    ctx.quadraticCurveTo(-110, 70, -60, 80);
    ctx.closePath();
    fs(ctx, '#3f7fcc');
    ctx.save();
    ctx.translate(-140, -30);
    ctx.rotate(Math.sin(s.t * 4) * 0.15 * (s.alive ? 1 : 0));
    ell(ctx, -20, -10, 26, 12, '#3f7fcc', 0.6);
    ell(ctx, 18, -14, 24, 11, '#3f7fcc', -0.7);
    ctx.restore();
    // body
    ell(ctx, 20, 40, 128, 72, '#4a8fd6');
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(20, 40, 128, 72, 0, 0, TAU);
    ctx.clip();
    ell(ctx, 40, 98, 110, 40, '#d4e9f8', 0, 0);
    for (const y of [72, 84, 96]) line(ctx, [-20, y + 8, 40, y, 120, y - 12], 'rgba(80,120,170,0.45)', 3);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(20, 40, 128, 72, 0, 0, TAU);
    fs(ctx, null);
    shine(ctx, -10, -5, 30, 10, -0.2);
    ell(ctx, 10, 82, 32, 13, '#3f7fcc', 0.5, 5);
    ell(ctx, bx, by + 6, 8, 3, '#2d5c99', 0, 0);
    // face
    eye(ctx, 100, 22, 12, { happy: blow > 0.3, closed: s.blink });
    ctx.beginPath();
    ctx.moveTo(85, 58);
    ctx.quadraticCurveTo(120, 72, 142, 48);
    ctx.lineWidth = 5;
    ctx.strokeStyle = OL;
    ctx.stroke();
    cheek(ctx, 118, 44, 11);
    ctx.restore();
  }),

  Tomate: pic(3.5, (ctx, s) => {
    const glow = s.on ? env(s.a, 0, 3.5, 0.6) : 0;
    const jp = s.on ? win(s.a, 0.4, 3.0) : 0;
    const j = jp > 0 && jp < 1 ? Math.abs(Math.sin(jp * Math.PI * 3)) : 0;
    const squash = s.on && jp > 0 && jp < 1 ? 1 - Math.pow(1 - j, 6) : 0;
    ctx.save();
    // glow
    if (glow > 0) {
      const g = ctx.createRadialGradient(0, 15, 60, 0, 15, 190);
      g.addColorStop(0, `rgba(255,60,60,${0.45 * glow})`);
      g.addColorStop(1, 'rgba(255,60,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 15, 190, 0, TAU);
      ctx.fill();
    }
    ctx.translate(0, 120 - j * 45 + s.calm * 2);
    const sy = 1 + (squash - 0.6) * 0.08 * (jp > 0 && jp < 1 ? 1 : 0);
    ctx.scale(2 - sy, sy);
    ctx.translate(0, -120);
    const red = glow > 0 ? `hsl(${lerp(5, -6, glow)},${lerp(78, 92, glow)}%,${lerp(54, 44, glow)}%)` : 'hsl(5,78%,54%)';
    const grad = ctx.createRadialGradient(-40, -30, 10, 0, 15, 130);
    grad.addColorStop(0, '#ff8a75');
    grad.addColorStop(0.45, red);
    grad.addColorStop(1, glow > 0 ? '#9c0d22' : '#b8202a');
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const f = 1 + 0.018 * Math.cos(a * 6);
      const x = Math.cos(a) * 122 * f;
      const y = 18 + Math.sin(a) * 104 * f;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    fs(ctx, grad);
    line(ctx, [-30, -80, -20, -50], 'rgba(120,10,20,0.4)', 4);
    line(ctx, [30, -80, 20, -50], 'rgba(120,10,20,0.4)', 4);
    shine(ctx, -62, -30, 26, 13, -0.7);
    // calyx
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 14 : 48;
      const x = Math.cos(a) * r * 1.2;
      const y = -84 + Math.sin(a) * r * 0.55;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.closePath();
    fs(ctx, '#4cae4f', 5);
    tube(ctx, () => {
      ctx.moveTo(0, -88);
      ctx.quadraticCurveTo(2, -110, 14, -118);
    }, 8, '#3c9440');
    // face
    eyes(ctx, -38, 38, 6, 14, s, { happy: glow > 0.3 });
    mouth(ctx, 0, 40, 18, glow > 0.3 ? 0.8 : 0);
    cheek(ctx, -66, 34, 15 + 6 * glow, 0.5 + 0.4 * glow);
    cheek(ctx, 66, 34, 15 + 6 * glow, 0.5 + 0.4 * glow);
    ctx.restore();
    // sparkles
    if (glow > 0.2)
      for (let i = 0; i < 4; i++) {
        const a = s.a * 1.5 + (i * TAU) / 4;
        star(ctx, Math.cos(a) * 160, -10 + Math.sin(a) * 120, 11 * (0.6 + 0.4 * Math.sin(s.a * 6 + i)), '#ffe066', a);
      }
  }),

  Tulpe: pic(4, (ctx, s) => {
    let grow = 0;
    if (s.on) {
      grow = (sm(win(s.a, 0.2, 0.6)) + sm(win(s.a, 0.9, 1.3)) + sm(win(s.a, 1.6, 2.0))) / 3;
      const back = win(s.a, 2.9, 3.6);
      if (back > 0) grow *= 1 - back + Math.sin(back * Math.PI * 3) * 0.12 * (1 - back);
    }
    const sway = (s.alive ? Math.sin(s.t * 2.2) * 6 : 0) * (0.3 + grow);
    const top = -20 - 90 * grow;
    // leaves
    for (const [sx, tipx, tipy] of [[-1, -78, 10 - grow * 25], [1, 72, 28 - grow * 20]]) {
      ctx.beginPath();
      ctx.moveTo(0, 138);
      ctx.quadraticCurveTo(sx * 70, 110, tipx, tipy);
      ctx.quadraticCurveTo(sx * 15, 80, 0, 138);
      fs(ctx, '#5cc160', 5);
    }
    tube(ctx, () => {
      ctx.moveTo(0, 140);
      ctx.quadraticCurveTo(-sway * 0.5, (140 + top) / 2, sway, top);
    }, 11, '#47a34b');
    ell(ctx, 0, 142, 85, 14, '#8a5a3c', 0, 5);
    // bloom
    ctx.save();
    ctx.translate(sway, top - 42);
    ctx.rotate(sway * 0.01);
    const P = '#ff4f7b';
    ctx.beginPath();
    ctx.moveTo(-60, -52);
    ctx.quadraticCurveTo(-66, 34, 0, 36);
    ctx.quadraticCurveTo(66, 34, 60, -52);
    ctx.lineTo(30, -22);
    ctx.lineTo(0, -64);
    ctx.lineTo(-30, -22);
    ctx.closePath();
    fs(ctx, P);
    line(ctx, [-30, -22, -22, 10, -8, 30], 'rgba(160,20,60,0.5)', 4);
    line(ctx, [30, -22, 22, 10, 8, 30], 'rgba(160,20,60,0.5)', 4);
    shine(ctx, -36, -18, 9, 16, 0.2, 0.5);
    eyes(ctx, -18, 18, -2, 8, s, { happy: grow > 0.2 });
    mouth(ctx, 0, 14, 9, grow > 0.2 ? 0.6 : 0);
    cheek(ctx, -34, 12, 7);
    cheek(ctx, 34, 12, 7);
    ctx.restore();
  }),

  Zebra: pic(3.5, (ctx, s) => {
    const flip = s.on && s.a > 1.2 && s.a < 2.4;
    const W = flip ? '#2b2430' : '#fafafa';
    const Bk = flip ? '#fafafa' : '#2b2430';
    const ponder = s.on ? env(s.a, 0.2, 2.6, 0.3) : 0;
    const laugh = s.on ? env(s.a, 2.5, 3.5, 0.2) : 0;
    const hop = laugh * Math.abs(Math.sin(s.a * 12)) * 10;
    ctx.save();
    ctx.translate(-18, -hop + s.calm * 2);
    // tail
    tube(ctx, () => {
      ctx.moveTo(-105, 5);
      ctx.quadraticCurveTo(-130, 20 + (s.alive ? Math.sin(s.t * 5) * 10 : 0), -122, 70);
    }, 6, W);
    ell(ctx, -122, 78, 9, 14, '#2b2430', 0.1, 4);
    // legs
    for (const [x, dl] of [[-80, 0], [-50, 0], [28, 0], [58, 0]]) {
      ctx.beginPath();
      ctx.roundRect(x - 11, 40, 22, 98 + dl, 9);
      fs(ctx, W);
      ctx.save();
      ctx.clip();
      for (let y = 60; y < 130; y += 18) line(ctx, [x - 14, y, x + 14, y + 3], Bk, 5);
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(x - 11, 40, 22, 98 + dl, 9);
      fs(ctx, null);
      rr(ctx, x - 13, 130 + dl, 26, 14, 5, '#3a2f2a', 4);
    }
    // body
    ctx.beginPath();
    ctx.ellipse(-15, 18, 98, 56, 0, 0, TAU);
    fs(ctx, W, 0);
    ctx.save();
    ctx.clip();
    for (let i = -4; i <= 4; i++) {
      const x = -15 + i * 23;
      line(ctx, [x - 6, -45, x + 8, 15, x - 3, 80], Bk, 7);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(-15, 18, 98, 56, 0, 0, TAU);
    fs(ctx, null);
    // head + neck
    ctx.save();
    ctx.translate(55, -15);
    ctx.rotate(ponder * -0.22 + laugh * Math.sin(s.a * 12) * 0.05);
    ctx.translate(-55, 15);
    // mane
    line(ctx, [18, -12, 62, -122], OL, 26);
    for (let k = 0; k < 6; k++) {
      const u0 = k / 6;
      const u1 = (k + 1) / 6;
      line(ctx, [lerp(18, 62, u0), lerp(-12, -122, u0), lerp(18, 62, u1), lerp(-12, -122, u1)], k % 2 ? W : Bk, 16);
    }
    const head = () => {
      ctx.beginPath();
      ctx.moveTo(25, -10);
      ctx.lineTo(62, -112);
      ctx.quadraticCurveTo(95, -142, 122, -112);
      ctx.lineTo(160, -66);
      ctx.quadraticCurveTo(178, -34, 148, -28);
      ctx.lineTo(112, -40);
      ctx.lineTo(88, 18);
      ctx.closePath();
    };
    // ear
    poly(ctx, [70, -112, 72, -150, 92, -124], W, 5);
    head();
    fs(ctx, W, 0);
    ctx.save();
    ctx.clip();
    for (let k = 0; k < 7; k++) {
      const px = lerp(60, 112, k / 6);
      const py = lerp(10, -125, k / 6);
      line(ctx, [px - 60, py - 25, px + 50, py + 20], Bk, 6);
    }
    ell(ctx, 155, -46, 28, 24, '#5a4f58', 0.3, 0);
    ctx.restore();
    head();
    fs(ctx, null);
    ell(ctx, 160, -48, 4, 3, '#1e171f', 0, 0);
    eye(ctx, 108, -92, 12, { closed: s.blink, happy: laugh > 0.2, look: ponder > 0.2 ? [-1, 0.6] : [0.5, 0] });
    mouth(ctx, 145, -34, 10, laugh);
    cheek(ctx, 128, -66, 9);
    ctx.restore();
    ctx.restore();
    // puzzled dots
    if (ponder > 0.2 && !laugh)
      for (let i = 0; i < 3; i++) circ(ctx, 120 + i * 18, -150 - i * 14, 5 + i * 2, `rgba(255,255,255,${ponder})`, 3);
  }),

  Wolke: pic(4, (ctx, s) => {
    const dark = s.on ? env(s.a, 0.3, 4, 0.6) : 0;
    const swell = s.on ? hump(s.a, 0, 0.9) : 0;
    const rain = s.on ? env(s.a, 0.9, 4, 0.3) : 0;
    const drift = s.alive ? Math.sin(s.t * 1.6) * 6 : 0;
    ctx.save();
    ctx.translate(drift, -25 + s.calm * 3);
    ctx.scale(1 + swell * 0.08, 1 + swell * 0.08);
    const parts: [number, number, number][] = [[-75, 15, 52], [-22, -28, 68], [52, -12, 60], [98, 26, 44]];
    const g = Math.round(lerp(253, 165, dark));
    const col = `rgb(${g},${Math.round(lerp(253, 178, dark))},${Math.round(lerp(255, 200, dark))})`;
    const shape = (fill: string | null, lw: number) => {
      for (const [x, y, r] of parts) circ(ctx, x, y, r, fill, lw);
      rr(ctx, -125, 10, 260, 58, 29, fill, lw);
    };
    shape(null, LW * 2);
    shape(col, 0);
    shine(ctx, -40, -55, 22, 10, -0.4, 0.7);
    // face
    const wink = s.on && s.a > 1.2 && s.a < 2.2;
    eye(ctx, -30, 18, 12, { closed: s.blink || wink, look: [0, 1] });
    eye(ctx, 30, 18, 12, { closed: s.blink, look: [0, 1] });
    mouth(ctx, 0, 40, 15, rain > 0.3 ? 0.55 : 0);
    cheek(ctx, -55, 38, 11);
    cheek(ctx, 55, 38, 11);
    ctx.restore();
    // rain
    if (rain > 0)
      for (let i = 0; i < 9; i++) {
        const x = -105 + i * 26 + drift;
        const p = (s.a * 1.4 + ((i * 37) % 9) / 9) % 1;
        const y = 70 + p * 125;
        ctx.save();
        ctx.globalAlpha = rain * (1 - p * 0.5);
        drop(ctx, x, y, 6, '#6fb6f2', 3);
        ctx.restore();
      }
  }),

  Bus: pic(4.5, (ctx, s) => {
    const door = s.on ? env(s.a, 0, 2.2, 0.4) : 0;
    const drive = s.on ? env(s.a, 2.2, 4.5, 0.3) : 0;
    const dt = s.on ? Math.max(0, s.a - 2.2) : 0;
    const bounce = drive * Math.abs(Math.sin(s.a * 9)) * 6 + s.calm * 1.5;
    // exhaust
    for (let i = 0; i < 3; i++) {
      const p = (dt * 0.9 + i / 3) % 1;
      puff(ctx, -155 - p * 25, 45 - p * 35, 10 + p * 12, drive * (1 - p) * 0.9);
    }
    whoosh(ctx, -165, -20, 35, drive);
    ctx.save();
    ctx.translate(0, -bounce);
    rr(ctx, -150, -88, 296, 150, 26, '#ffc61a');
    rr(ctx, -150, 18, 296, 12, 0, '#2b2430', 0);
    shine(ctx, -110, -78, 40, 5, 0, 0.55);
    // windows with kids
    for (let i = 0; i < 4; i++) {
      const x = -134 + i * 50;
      rr(ctx, x, -70, 42, 44, 8, '#bfe6ff', 5);
      const pop = s.alive ? sm(win(s.a, 0.5 + i * 0.35, 0.8 + i * 0.35)) : 0;
      if (pop > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x + 3, -67, 36, 38, 6);
        ctx.clip();
        drawBusKid(ctx, x + 21, -30 - pop * 20 + Math.sin(s.t * 7 + i) * 2 * drive, i, s);
        ctx.restore();
        ctx.beginPath();
        ctx.roundRect(x, -70, 42, 44, 8);
        fs(ctx, null, 5);
      }
      line(ctx, [x + 8, -62, x + 18, -62], 'rgba(255,255,255,0.8)', 3);
    }
    // door
    const dw = 34 * (1 - door * 0.7);
    rr(ctx, 66, -70, 36, 120, 6, '#5a4a3a', 5);
    rr(ctx, 66, -70, dw, 120, 6, '#bfe6ff', 5);
    line(ctx, [66 + dw / 2, -66, 66 + dw / 2, 46], OL, 3);
    // windshield eye and face
    rr(ctx, 110, -70, 30, 50, 8, '#bfe6ff', 5);
    eye(ctx, 126, -42, 11, { closed: s.blink, happy: drive > 0.3, look: [0.6, 0.2] });
    mouth(ctx, 128, 0, 10, drive > 0.3 ? 0.7 : 0.2 * door);
    cheek(ctx, 118, -12, 7);
    circ(ctx, 142, 40, 9, '#fff6c2', 4);
    rr(ctx, 120, 56, 30, 10, 4, '#9a9aa5', 4);
    ctx.restore();
    // wheels
    for (const wx of [-88, 88]) {
      ctx.save();
      ctx.translate(wx, 66);
      ctx.rotate(dt * 9);
      circ(ctx, 0, 0, 30, '#2b2430');
      circ(ctx, 0, 0, 13, '#c9c9d2', 4);
      for (let k = 0; k < 3; k++) line(ctx, [0, 0, Math.cos((k * TAU) / 3) * 12, Math.sin((k * TAU) / 3) * 12], '#6a6a75', 3);
      ctx.restore();
    }
  }),

  Leiter: pic(4, (ctx, s) => {
    const rungs = [128, 78, 28, -22, -72, -122];
    const appear = s.alive ? sm(win(s.a, 0, 0.3)) : 0;
    const climbing = s.alive ? win(s.a, 0.3, 2.7) * 5 : 0;
    const k = Math.min(4, Math.floor(climbing));
    const f = climbing - k;
    const rung = climbing >= 5 ? rungs[5] : lerp(rungs[k], rungs[k + 1], sm(f));
    const hopArc = climbing < 5 ? Math.sin(Math.PI * f) * 18 : 0;
    const cheer = s.on ? hump(s.a, 2.8, 3.8) : 0;
    const wob = s.on ? Math.sin(s.a * 9) * 0.015 * (climbing > 0 && climbing < 5 ? 1 : 0) : 0;
    ctx.save();
    ctx.translate(0, 150);
    ctx.rotate(wob);
    ctx.translate(0, -150);
    const Wd = '#c98a4b';
    for (const y of rungs) {
      rr(ctx, -56, y - 7, 112, 14, 5, '#d99c5c', 5);
    }
    rr(ctx, -74, -152, 22, 304, 9, Wd);
    rr(ctx, 52, -152, 22, 304, 9, Wd);
    line(ctx, [-66, -140, -66, 140], 'rgba(255,230,190,0.6)', 3);
    line(ctx, [60, -140, 60, 140], 'rgba(255,230,190,0.6)', 3);
    for (const y of rungs) {
      circ(ctx, -63, y, 3, '#7a5030', 0);
      circ(ctx, 63, y, 3, '#7a5030', 0);
    }
    ctx.restore();
    // a little climber
    if (appear > 0) {
      const r = 22 * appear;
      const y = rung - 7 - r + 2 - hopArc - cheer * 28 + s.calm * 1.5;
      ctx.save();
      ctx.translate(0, y);
      line(ctx, [-8, r - 2, -10, r + 5], OL, 5);
      line(ctx, [8, r - 2, 10, r + 5], OL, 5);
      circ(ctx, 0, 0, r, '#ff7a59', 5);
      shine(ctx, -8, -10, 7, 4);
      line(ctx, [-r * 0.9, 0, -r * 1.4, -r * (0.3 + cheer)], OL, 5);
      line(ctx, [r * 0.9, 0, r * 1.4, -r * (0.3 + cheer)], OL, 5);
      eyes(ctx, -7, 7, -4, 5 * appear, s, { happy: cheer > 0.2, look: [0, -1] });
      mouth(ctx, 0, 6, 6, 0.6);
      ctx.restore();
      if (cheer > 0.1)
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i - 2) * 0.55;
          star(ctx, Math.cos(a) * 70 * cheer, y + 10 + Math.sin(a) * 32 * cheer, 9, '#ffe066', s.a * 3);
        }
    }
  }),

  Zelt: pic(4, (ctx, s) => {
    const night = s.alive ? sm(win(s.a, 0.6, 1.8)) : 0;
    const open = s.alive ? 0.3 + 0.7 * sm(win(s.a, 0, 0.8)) : 0.3;
    const lamp = s.alive ? sm(win(s.a, 1.6, 2.2)) : 0;
    const yawn = s.on ? hump(s.a, 2.6, 3.8) : 0;
    // moon and stars
    if (night > 0) {
      ctx.save();
      ctx.globalAlpha = night;
      const mx = -115;
      const my = -115 + (1 - night) * 30;
      ctx.beginPath();
      ctx.arc(mx, my, 30, -Math.PI / 2, Math.PI / 2, true);
      ctx.ellipse(mx, my, 14, 30, 0, Math.PI / 2, (3 * Math.PI) / 2, false);
      ctx.closePath();
      fs(ctx, '#ffe27a', 5);
      for (const [x, y, r, ph] of [[100, -130, 11, 0], [140, -80, 8, 1.3], [60, -165, 7, 2.1], [-60, -160, 8, 0.7], [-150, -40, 6, 2.6]]) {
        star(ctx, x, y, r * (0.75 + 0.25 * Math.sin(s.t * 4 + ph)), '#fff3a6', 0, 3);
      }
      ctx.restore();
    }
    // ropes and pegs
    line(ctx, [-60, -20, -168, 132], 'rgba(90,70,60,0.9)', 3);
    line(ctx, [60, -20, 168, 132], 'rgba(90,70,60,0.9)', 3);
    line(ctx, [-168, 124, -172, 142], OL, 5);
    line(ctx, [168, 124, 172, 142], OL, 5);
    ell(ctx, 0, 138, 175, 13, '#7fcf6a', 0, 5);
    // tent
    line(ctx, [0, -108, 0, -132], OL, 6);
    poly(ctx, [0, -132, 30, -124, 0, -116], '#ff5d5d', 3);
    ctx.save();
    ctx.translate(0, 132);
    ctx.scale(1 + yawn * 0.03, 1 - yawn * 0.03 + s.calm * 0.01);
    ctx.translate(0, -132);
    poly(ctx, [-142, 132, 0, -110, 142, 132], '#ff8a3d');
    poly(ctx, [-142, 132, 0, -110, -112, 132], '#ff9f5c', 0);
    line(ctx, [0, -110, -142, 132]);
    shine(ctx, -50, -10, 8, 40, 0.55, 0.35);
    // door: dark inside, warm lamp light, flaps
    poly(ctx, [-56, 132, 0, 30, 56, 132], '#4a3226', 5);
    if (lamp > 0) {
      const g = ctx.createRadialGradient(0, 100, 4, 0, 100, 70);
      g.addColorStop(0, `rgba(255,220,110,${lamp})`);
      g.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.save();
      poly(ctx, [-56, 132, 0, 30, 56, 132], null, 0);
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(-60, 30, 120, 105);
      rr(ctx, -9, 92, 18, 22, 5, '#ffe9a0', 3);
      ctx.restore();
    }
    const w = 50 * (1 - open) + 6;
    poly(ctx, [0, 30, -56, 132, -56 + w, 132], '#ff7a2a', 5);
    poly(ctx, [0, 30, 56, 132, 56 - w, 132], '#ff7a2a', 5);
    // face
    const sleepy = night > 0.5 && !s.on;
    eyes(ctx, -27, 27, -22, 10, s, { closed: sleepy || yawn > 0.3 });
    if (yawn > 0.05) ell(ctx, 0, 4, 7 + yawn * 4, 4 + yawn * 9, '#6b2440', 0, 4);
    else mouth(ctx, 0, 2, 10, 0);
    cheek(ctx, -46, -2, 9);
    cheek(ctx, 46, -2, 9);
    ctx.restore();
  }),

  Rakete: pic(4.5, (ctx, s) => {
    const shake = s.on && s.a < 1.9 ? [0, 0.6, 1.2].reduce((m, t0) => Math.max(m, hump(s.a, t0, t0 + 0.4)), 0) : 0;
    const fire = s.on ? env(s.a, 1.8, 4.3, 0.2) : 0;
    const lift = s.on ? sm(win(s.a, 2.0, 3.0)) * (1 - sm(win(s.a, 3.3, 4.3))) : 0;
    const smoke = s.on ? env(s.a, 1.7, 4.5, 0.3) : 0;
    // smoke clouds at the bottom
    for (let i = 0; i < 6; i++) {
      const sx = i % 2 ? 1 : -1;
      const p = ((s.a - 1.7) * 0.6 + Math.floor(i / 2) / 3) % 1;
      if (s.a > 1.7) puff(ctx, sx * (40 + p * 110), 135 - p * 15, 18 + p * 14, smoke * (1 - p * 0.6));
    }
    for (const t0 of [0, 0.6, 1.2]) {
      const p = win(s.a, t0, t0 + 0.6);
      if (s.on && p > 0 && p < 1) puff(ctx, (t0 === 0.6 ? 1 : -1) * (30 + p * 30), 130 - p * 10, 12 + p * 8, 1 - p);
    }
    ctx.save();
    ctx.translate(Math.sin(s.a * 60) * 3 * shake, -lift * 62 + s.calm * 2);
    // flame
    const L = fire * (40 + 15 * Math.sin(s.t * 30)) + (s.on && s.a < 1.8 ? shake * 18 : 0);
    if (L > 1) {
      ctx.beginPath();
      ctx.moveTo(-26, 92);
      ctx.quadraticCurveTo(-26, 92 + L * 0.6, 0, 92 + L);
      ctx.quadraticCurveTo(26, 92 + L * 0.6, 26, 92);
      ctx.closePath();
      fs(ctx, '#ff8b2b', 4);
      ctx.beginPath();
      ctx.moveTo(-13, 92);
      ctx.quadraticCurveTo(-13, 92 + L * 0.45, 0, 92 + L * 0.7);
      ctx.quadraticCurveTo(13, 92 + L * 0.45, 13, 92);
      ctx.closePath();
      fs(ctx, '#ffe066', 0);
    }
    // fins
    poly(ctx, [-40, 20, -84, 88, -80, 112, -38, 76], '#e8434b');
    poly(ctx, [40, 20, 84, 88, 80, 112, 38, 76], '#e8434b');
    poly(ctx, [-25, 70, 25, 70, 32, 94, -32, 94], '#8d8d9a', 5);
    // body
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(0, -150);
      ctx.bezierCurveTo(58, -110, 52, -20, 42, 74);
      ctx.lineTo(-42, 74);
      ctx.bezierCurveTo(-52, -20, -58, -110, 0, -150);
      ctx.closePath();
    };
    body();
    fs(ctx, '#f4f4fa', 0);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#e8434b';
    ctx.fillRect(-60, -160, 120, 62);
    ctx.fillRect(-60, 52, 120, 30);
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    ctx.fillRect(18, -160, 50, 260);
    ctx.restore();
    body();
    fs(ctx, null);
    line(ctx, [-44, -98, 44, -98], OL, 4);
    line(ctx, [-44, 52, 44, 52], OL, 4);
    shine(ctx, -24, -60, 7, 30, 0.1, 0.6);
    circ(ctx, 0, -58, 24, '#a6d8ff', 8);
    circ(ctx, 0, -58, 24, null, 4);
    shine(ctx, -8, -66, 8, 5, -0.6, 0.8);
    // face
    eyes(ctx, -16, 16, 6, 9, s, { closed: shake > 0.4 && !fire, happy: lift > 0.3, look: [0, -0.8] });
    mouth(ctx, 0, 26, 11, fire > 0.3 ? 0.8 : shake > 0 ? 0.3 : 0);
    cheek(ctx, -28, 22, 7);
    cheek(ctx, 28, 22, 7);
    ctx.restore();
  }),

  Biene: pic(4, (ctx, s) => {
    const fly = s.on ? env(s.a, 0, 3.4, 0.5) : 0;
    const w = s.a * 2.2;
    const honey = s.alive ? sm(win(s.a, 2.4, 2.9)) : 0;
    const bx = Math.sin(w) * 55 * fly + honey * 22 * (1 - fly);
    const by = Math.sin(w * 2) * 32 * fly - 10 + (s.alive ? Math.sin(s.t * 3) * 4 : 0);
    // dotted flight trail
    if (fly > 0.1)
      for (let i = 1; i <= 6; i++) {
        const ww = w - i * 0.22;
        circ(ctx, Math.sin(ww) * 55 * fly - 30, Math.sin(ww * 2) * 32 * fly - 10, 3, `rgba(60,45,70,${0.5 * fly * (1 - i / 7)})`, 0);
      }
    // honey pot
    if (honey > 0) {
      ctx.save();
      ctx.translate(-110, 112);
      ctx.scale(honey, honey);
      ell(ctx, 0, 0, 40, 34, '#d98b2b');
      rr(ctx, -30, -40, 60, 14, 6, '#c47722', 5);
      ctx.beginPath();
      ctx.moveTo(-28, -30);
      ctx.quadraticCurveTo(-20, -12, -12, -28);
      ctx.quadraticCurveTo(-4, -2, 6, -28);
      ctx.quadraticCurveTo(16, -8, 28, -30);
      ctx.closePath();
      fs(ctx, '#ffb300', 4);
      shine(ctx, -16, 0, 9, 5);
      ctx.restore();
    }
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(Math.cos(w) * 0.15 * fly);
    // wings behind
    const flap = s.alive ? 0.55 + 0.45 * Math.abs(Math.cos(s.t * (fly > 0.1 ? 40 : 8))) : 1;
    for (const [x, rot] of [[-22, -0.45], [16, 0.35]]) {
      ctx.save();
      ctx.translate(x, -50);
      ctx.rotate(rot);
      ell(ctx, 0, -30 * flap, 28, 42 * flap, 'rgba(205,235,255,0.85)', 0, 5);
      ctx.restore();
    }
    poly(ctx, [-78, -8, -108, 2, -78, 12], '#3a2f2a', 4);
    ctx.beginPath();
    ctx.ellipse(0, 0, 82, 64, 0, 0, TAU);
    fs(ctx, '#ffd23a', 0);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#2b2430';
    ctx.fillRect(-62, -70, 22, 140);
    ctx.fillRect(-20, -70, 22, 140);
    ctx.restore();
    ctx.beginPath();
    ctx.ellipse(0, 0, 82, 64, 0, 0, TAU);
    fs(ctx, null);
    shine(ctx, -30, -42, 18, 8, -0.3);
    // antennae
    for (const [x0, x1] of [[30, 34], [52, 72]]) {
      line(ctx, [x0, -56, x1, -92], OL, 4);
      circ(ctx, x1, -94, 6, '#2b2430', 3);
    }
    eyes(ctx, 30, 58, -12, 11, s, { happy: honey > 0.5 && !s.on, look: [0.4, 0] });
    mouth(ctx, 46, 16, 12, fly > 0.3 ? 0.6 : 0);
    cheek(ctx, 22, 12, 8);
    cheek(ctx, 70, 10, 7);
    ctx.restore();
  }),

  Kuchen: pic(3.5, (ctx, s) => {
    const apart = s.on ? env(s.a, 0.5, 3.2, 0.5) : 0;
    const gap = apart * 30;
    const hopL = s.on ? hump(s.a, 1.1, 1.8) : 0;
    const hopR = s.on ? hump(s.a, 1.9, 2.6) : 0;
    const wig = s.on ? Math.sin(s.a * 20) * 0.03 * hump(s.a, 0, 0.5) : 0;
    ell(ctx, 0, 118, 158, 26, '#eef4fb');
    ell(ctx, 0, 114, 130, 16, '#dbe6f3', 0, 0);
    const cake = () => {
      // body
      ctx.beginPath();
      ctx.moveTo(-125, -25);
      ctx.lineTo(-125, 92);
      ctx.ellipse(0, 92, 125, 26, 0, Math.PI, 0, true);
      ctx.lineTo(125, -25);
      ctx.closePath();
      fs(ctx, '#f2c48d');
      line(ctx, [-122, 62, -60, 70, 0, 72, 60, 70, 122, 62], '#ff8fb1', 9);
      // frosting top and drips
      ctx.beginPath();
      ctx.ellipse(0, -25, 125, 34, 0, 0, TAU);
      fs(ctx, '#ffb3cf');
      ctx.beginPath();
      ctx.moveTo(-125, -25);
      for (let i = 0; i <= 10; i++) {
        const x = -125 + i * 25;
        const d = i % 2 ? 20 + ((i * 7) % 3) * 6 : 6;
        ctx.quadraticCurveTo(x - 12, 5 + d, x, Math.sqrt(Math.max(0, 1 - (x / 125) ** 2)) * 34 - 25 + (i % 2 ? d : 2));
      }
      ctx.lineTo(125, -25);
      ctx.ellipse(0, -25, 125, 34, 0, 0, Math.PI, false);
      fs(ctx, '#ffb3cf', 0);
      ctx.beginPath();
      ctx.moveTo(-125, -25);
      for (let i = 0; i <= 10; i++) {
        const x = -125 + i * 25;
        const d = i % 2 ? 20 + ((i * 7) % 3) * 6 : 6;
        ctx.quadraticCurveTo(x - 12, 5 + d, x, Math.sqrt(Math.max(0, 1 - (x / 125) ** 2)) * 34 - 25 + (i % 2 ? d : 2));
      }
      ctx.lineWidth = 5;
      ctx.strokeStyle = OL;
      ctx.stroke();
      const cols = ['#4dabf7', '#ffd43b', '#69db7c', '#fff', '#b197fc'];
      for (let i = 0; i < 14; i++) {
        const x = -100 + ((i * 53) % 200);
        const y = -40 + ((i * 29) % 26);
        const a = i * 1.3;
        line(ctx, [x - Math.cos(a) * 5, y - Math.sin(a) * 3, x + Math.cos(a) * 5, y + Math.sin(a) * 3], cols[i % 5], 4);
      }
      shine(ctx, -70, -38, 22, 6, -0.1, 0.6);
    };
    const half = (side: number, hop: number) => {
      ctx.save();
      ctx.translate(side * gap, -hop * 22);
      ctx.translate(side * 60, 100);
      ctx.rotate(side * hop * 0.12 + wig);
      ctx.translate(-side * 60, -100);
      ctx.save();
      if (side !== 0) {
        ctx.beginPath();
        ctx.rect(side < 0 ? -200 : 0, -200, 200, 400);
        ctx.clip();
      }
      cake();
      // face, split in two
      eye(ctx, -36, 22, 12, { closed: s.blink, happy: apart > 0.3 });
      eye(ctx, 36, 22, 12, { closed: s.blink, happy: apart > 0.3 });
      mouth(ctx, 0, 42, 16, apart > 0.3 ? 0.7 : 0);
      cheek(ctx, -62, 40, 11);
      cheek(ctx, 62, 40, 11);
      ctx.restore();
      if (gap > 1) {
        ctx.beginPath();
        ctx.moveTo(0, -59);
        ctx.lineTo(0, 118);
        ctx.lineWidth = 5;
        ctx.strokeStyle = OL;
        ctx.stroke();
      }
      if (side >= 0) {
        line(ctx, [4, -62, 14, -96], '#3c9440', 4);
        circ(ctx, 6, -55, 17, '#e8304a', 5);
        shine(ctx, 0, -60, 5, 3, -0.6, 0.8);
      }
      ctx.restore();
    };
    if (gap === 0 && hopL === 0 && hopR === 0 && wig === 0) half(0, 0);
    else {
      half(-1, hopL);
      half(1, hopR);
    }
  }),

  Schnecke: pic(4.5, (ctx, s) => {
    const race = s.on ? env(s.a, 0.3, 4.0, 0.4) : 0;
    const move = s.on ? sm(win(s.a, 0.3, 4.0)) * 14 : s.alive ? 14 : 0;
    const proud = s.on ? hump(s.a, 3.9, 4.5) : 0;
    const lean = race * 0.12;
    ctx.save();
    ctx.translate(-24 + move, 0);
    // slime trail
    if (s.alive) line(ctx, [-150 - move * 2, 136, -120, 136], 'rgba(160,220,255,0.7)', 6);
    whoosh(ctx, -168, 40, 30, race);
    // sweat drops
    if (race > 0.3) {
      const p = (s.a * 1.6) % 1;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      drop(ctx, 160 + p * 20, -40 - p * 10 + p * p * 40, 6, '#8fd3fa', 3);
      ctx.restore();
    }
    // body
    ctx.save();
    ctx.translate(0, 136);
    ctx.transform(1, 0, -lean, 1, 0, 0);
    ctx.translate(0, -136);
    ctx.beginPath();
    ctx.moveTo(-150, 136);
    ctx.quadraticCurveTo(-150, 112, -100, 110);
    ctx.lineTo(80, 106);
    ctx.quadraticCurveTo(96, 50, 104, -6);
    ctx.bezierCurveTo(108, -48, 162, -44, 164, -2);
    ctx.quadraticCurveTo(170, 120, 120, 136);
    ctx.closePath();
    fs(ctx, '#c9e38a');
    shine(ctx, 122, -14, 9, 6, -0.6);
    // eye stalks
    const sw = s.alive ? Math.sin(s.t * 5) * 6 : 0;
    const back = race * 18;
    for (const [x0, x1, y1] of [[118, 100 - back + sw, -96], [146, 154 - back - sw, -92]]) {
      tube(ctx, () => {
        ctx.moveTo(x0, -22);
        ctx.quadraticCurveTo(x0, -60, x1, y1);
      }, 7, '#c9e38a');
      eye(ctx, x1, y1, 13, { closed: s.blink && !race, happy: proud > 0.2, look: [0.7, 0] });
    }
    mouth(ctx, 140, 22, 12, race > 0.3 ? 0.5 : proud);
    cheek(ctx, 120, 34, 8);
    ctx.restore();
    // shell
    ctx.save();
    ctx.translate(-22, 22);
    ctx.rotate(Math.sin(s.a * 10) * 0.04 * race);
    circ(ctx, 0, 0, 86, '#f0a24a');
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const a = (i / 120) * Math.PI * 5;
      const r = 72 * (1 - i / 128);
      const x = Math.cos(a + Math.PI) * r;
      const y = Math.sin(a + Math.PI) * r;
      if (i) ctx.lineTo(x * 0.98, y);
      else ctx.moveTo(x, y);
    }
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#a0561f';
    ctx.stroke();
    shine(ctx, -30, -46, 20, 10, -0.6);
    ctx.restore();
    // dust puffs
    for (let i = 0; i < 2; i++) {
      const p = (s.a * 1.2 + i / 2) % 1;
      puff(ctx, -150 - p * 25, 126 - p * 12, 9 + p * 6, race * (1 - p) * 0.8, '225,210,190');
    }
    ctx.restore();
  }),

  Giraffe: pic(4.5, (ctx, s) => {
    const up = s.on ? sm(win(s.a, 0.1, 0.9)) * (1 - sm(win(s.a, 1.3, 1.9))) : 0;
    const down = s.on ? sm(win(s.a, 1.4, 2.4)) * (1 - sm(win(s.a, 3.5, 4.4))) : 0;
    const sway = s.calm * 4;
    const P = (a: [number, number], b: [number, number], c: [number, number]) => {
      const x = lerp(a[0], b[0], up);
      const y = lerp(a[1], b[1], up);
      return [lerp(x, c[0], down), lerp(y, c[1], down)] as [number, number];
    };
    const B: [number, number] = [55, 40];
    const c1 = P([50, -10], [52, -20], [60, -150]);
    const c2 = P([40, -60], [42, -90], [150, -150]);
    const H = P([35 + sway, -108], [40, -150], [128, 40]);
    const hr = lerp(sway * 0.01, 0.5, down);
    const Y = '#f6c55a';
    const Br = '#b8753a';
    const bez = (u: number) => {
      const v = 1 - u;
      return [
        v * v * v * B[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u * u * u * H[0],
        v * v * v * B[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u * u * u * H[1],
      ];
    };
    ctx.save();
    ctx.translate(-40, 0);
    // legs
    for (const x of [-48, -22, 32, 58]) {
      rr(ctx, x - 8, 70, 16, 74, 7, Y, 5);
      rr(ctx, x - 10, 136, 20, 12, 4, '#4a3a32', 4);
    }
    // tail
    line(ctx, [-60, 50, -78, 98 + (s.alive ? Math.sin(s.t * 4) * 6 : 0)], OL, 4);
    ell(ctx, -78, 104, 6, 10, '#4a3a32', 0, 3);
    // neck
    ctx.beginPath();
    ctx.moveTo(B[0], B[1]);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], H[0], H[1]);
    ctx.lineWidth = 46;
    ctx.strokeStyle = OL;
    ctx.stroke();
    ctx.lineWidth = 34;
    ctx.strokeStyle = Y;
    ctx.stroke();
    for (const u of [0.25, 0.48, 0.7]) {
      const [x, y] = bez(u);
      ell(ctx, x, y, 8, 7, Br, u * 3, 0);
    }
    // body
    ell(ctx, 10, 62, 74, 42, Y);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(10, 62, 74, 42, 0, 0, TAU);
    ctx.clip();
    for (const [x, y, r] of [[-35, 50, 12], [-5, 75, 14], [25, 45, 11], [50, 75, 10], [-50, 80, 9], [5, 35, 8]]) ell(ctx, x, y, r, r * 0.8, Br, x * 0.05, 0);
    ctx.restore();
    // head
    ctx.save();
    ctx.translate(H[0], H[1]);
    ctx.rotate(hr);
    for (const x of [-12, 10]) {
      line(ctx, [x, -24, x * 1.1, -48], OL, 7);
      circ(ctx, x * 1.1, -50, 7, Br, 4);
    }
    ell(ctx, -36, -16, 16, 8, Y, -0.4, 5);
    ell(ctx, 36, -16, 16, 8, Y, 0.4, 5);
    ell(ctx, 0, 0, 34, 30, Y);
    ell(ctx, 0, 24, 28, 18, '#f3d9a4');
    ell(ctx, -8, 22, 3, 3, '#5a3a2a', 0, 0);
    ell(ctx, 8, 22, 3, 3, '#5a3a2a', 0, 0);
    const lookDown = down > 0.5;
    eyes(ctx, -13, 13, -6, 9, s, { look: lookDown ? [0.2, 1] : [0.1, 0.3], happy: up > 0.5 });
    mouth(ctx, 0, 32, 9, lookDown ? 0.6 : 0);
    cheek(ctx, -24, 12, 7);
    cheek(ctx, 24, 12, 7);
    ctx.restore();
    ctx.restore();
  }),

  Brille: pic(3, (ctx, s) => {
    const zoom = s.on ? env(s.a, 0.3, 2.4, 0.4) : 0;
    const glint = s.on ? win(s.a, 1.4, 2.1) : 0;
    const bounce = s.on ? hump(s.a, 0, 0.35) * 12 : 0;
    const look = s.on ? Math.sin(s.a * 5) : 0;
    ctx.save();
    ctx.translate(0, -bounce + s.calm * 2);
    const F = '#e5484d';
    // temples
    for (const sx of [-1, 1]) {
      tube(ctx, () => {
        ctx.moveTo(sx * 118, -18);
        ctx.lineTo(sx * 148, -34);
        ctx.lineTo(sx * 150, -4);
      }, 8, F);
    }
    for (const sx of [-1, 1]) {
      const cx = sx * 66;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, 0, 54, 0, TAU);
      ctx.fillStyle = 'rgba(200,235,255,0.55)';
      ctx.fill();
      ctx.clip();
      const er = lerp(18, 38, zoom);
      eye(ctx, cx + look * 6 * zoom, 4, er, { closed: s.blink && !zoom, look: [look, 0.1] });
      if (glint > 0 && glint < 1) {
        const gx = cx - 80 + glint * 160;
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath();
        ctx.moveTo(gx - 14, -60);
        ctx.lineTo(gx + 6, -60);
        ctx.lineTo(gx - 24, 60);
        ctx.lineTo(gx - 44, 60);
        ctx.closePath();
        ctx.fill();
      }
      ell(ctx, cx - 24, -26, 12, 6, 'rgba(255,255,255,0.75)', -0.7, 0);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, 0, 54, 0, TAU);
      ctx.lineWidth = 22;
      ctx.strokeStyle = OL;
      ctx.stroke();
      ctx.lineWidth = 12;
      ctx.strokeStyle = F;
      ctx.stroke();
    }
    tube(ctx, () => {
      ctx.moveTo(-14, -14);
      ctx.quadraticCurveTo(0, -30, 14, -14);
    }, 9, F);
    ctx.restore();
    if (zoom < 0.5 && s.on && s.a > 2.1)
      for (let i = 0; i < 4; i++) {
        const p = win(s.a, 2.1, 3);
        star(ctx, [-120, 120, -40, 60][i], [-70, -80, -95, 80][i] - p * 10, 12 * Math.sin(Math.PI * p), '#ffe066', p * 2);
      }
  }),

  Zahn: pic(4, (ctx, s) => {
    const wob = s.on ? env(s.a, 0, 2.4, 0.3) : 0;
    const ang = Math.sin(s.a * 14) * 0.13 * wob + (s.rest >= 0 ? Math.sin(s.rest * 2) * 0.02 : 0);
    const fairy = s.on ? env(s.a, 2.0, 4.0, 0.5) : 0;
    ctx.save();
    ctx.translate(0, 100);
    ctx.rotate(ang);
    ctx.translate(0, -100);
    ctx.translate(0, 8);
    const tooth = () => {
      ctx.beginPath();
      ctx.moveTo(-80, -60);
      ctx.bezierCurveTo(-88, -128, -20, -132, 0, -104);
      ctx.bezierCurveTo(20, -132, 88, -128, 80, -60);
      ctx.bezierCurveTo(78, -10, 70, 40, 56, 110);
      ctx.quadraticCurveTo(44, 140, 30, 110);
      ctx.quadraticCurveTo(15, 58, 0, 58);
      ctx.quadraticCurveTo(-15, 58, -30, 110);
      ctx.quadraticCurveTo(-44, 140, -56, 110);
      ctx.bezierCurveTo(-70, 40, -78, -10, -80, -60);
      ctx.closePath();
    };
    tooth();
    const g = ctx.createLinearGradient(-80, 0, 80, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#dfe8f5');
    fs(ctx, g);
    shine(ctx, -46, -86, 16, 9, -0.6, 0.9);
    const scared = wob > 0.3;
    eyes(ctx, -30, 30, -50, 13, s, { look: scared ? [Math.sin(s.a * 7), -0.4] : [0, 0.2], happy: fairy > 0.4 });
    if (scared) {
      ctx.beginPath();
      ctx.moveTo(-14, -14);
      for (let i = 1; i <= 4; i++) ctx.lineTo(-14 + i * 7, -14 + (i % 2 ? -5 : 0));
      ctx.lineWidth = 4;
      ctx.strokeStyle = OL;
      ctx.stroke();
    } else mouth(ctx, 0, -18, 15, fairy > 0.4 ? 0.7 : 0);
    cheek(ctx, -50, -24, 11);
    cheek(ctx, 50, -24, 11);
    if (scared) {
      const p = (s.a * 2) % 1;
      ctx.save();
      ctx.globalAlpha = 1 - p;
      drop(ctx, 82 + p * 25, -100 + p * 30, 6, '#8fd3fa', 3);
      ctx.restore();
    }
    ctx.restore();
    // gum
    ctx.beginPath();
    ctx.moveTo(-150, 150);
    ctx.lineTo(-150, 112);
    ctx.quadraticCurveTo(-120, 90, -80, 100);
    ctx.quadraticCurveTo(0, 116, 80, 100);
    ctx.quadraticCurveTo(120, 90, 150, 112);
    ctx.lineTo(150, 150);
    ctx.closePath();
    fs(ctx, '#f48aa6');
    shine(ctx, -110, 112, 18, 5, -0.2, 0.45);
    // the tooth fairy
    if (fairy > 0) {
      const fx = lerp(170, 110, fairy) + Math.sin(s.a * 3) * 10;
      const fy = lerp(-200, -125, fairy) + Math.sin(s.a * 5) * 8;
      ctx.save();
      ctx.globalAlpha = fairy;
      const fl = 0.6 + 0.4 * Math.abs(Math.sin(s.a * 25));
      ell(ctx, fx - 12, fy - 6, 10, 16 * fl, 'rgba(210,235,255,0.9)', -0.5, 3);
      ell(ctx, fx + 12, fy - 6, 10, 16 * fl, 'rgba(210,235,255,0.9)', 0.5, 3);
      poly(ctx, [fx, fy, fx - 12, fy + 24, fx + 12, fy + 24], '#ff8fc7', 3);
      circ(ctx, fx, fy - 6, 9, SKIN, 3);
      line(ctx, [fx - 10, fy + 8, fx - 30, fy + 18], OL, 3);
      star(ctx, fx - 33, fy + 20, 8, '#ffe066', s.a * 4, 2.5);
      for (let i = 0; i < 3; i++) {
        const p = (s.a * 1.5 + i / 3) % 1;
        star(ctx, fx - 40 - p * 40, fy + 25 + p * 50, 5 * (1 - p), '#fff3a6', 0, 2);
      }
      ctx.restore();
    }
  }),
};

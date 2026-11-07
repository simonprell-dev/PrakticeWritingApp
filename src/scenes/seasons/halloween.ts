// "Halloween": a friendly moonlit night in lilac and blue. A big smiling full moon, a crooked little haunted
// house with warm windows on a hill, a gnarly tree, a garden fence and a pumpkin field full of smiling
// lanterns. Little bats flutter far away, fireflies float about, mist drifts softly over the ground and the
// lanterns flicker.
// Ghosts float up and down, glide slowly and now and then hop up with a "Buh!"; pumpkins hop about on the
// field; little witches fly in arcs across the sky; black cats sneak, sit, pounce and arch their backs.
import { halloweenSprite } from '../../game/creatures/seasons/halloween.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { clamp, hsl, lerp, TAU } from '../../game/math.ts';
import { mulberry32, type Rand } from '../../game/rng.ts';
import { sfx } from '../../game/audio.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { t, tk } from '../../i18n/i18n.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HORIZON = 600;
/** the field where pumpkins and cats live */
const GROUND0 = 705;
const GROUND1 = 950;
/** witches fly between here and FLY1, ghosts float between GHOST0 and the field */
const SKY0 = 250;
const FLY1 = 660;
const GHOST0 = 420;

// ------------------------------------------------------------------------------------- the picture

function sky(ctx: Ctx2, W: number, hz: number) {
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#1f1a4f');
  g.addColorStop(0.55, '#463a86');
  g.addColorStop(1, '#8a6cb8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, hz + 80);
}

function stars(ctx: Ctx2, W: number, hz: number, r: Rand, n: number) {
  for (let i = 0; i < n; i++) {
    const y = Math.pow(r(), 1.6) * hz * 0.8;
    ctx.fillStyle = `rgba(255,250,225,${0.35 + r() * 0.55})`;
    ctx.beginPath();
    ctx.arc(r() * W, y, 0.8 + r() * 1.6, 0, TAU);
    ctx.fill();
  }
}

/** the big friendly full moon with a sleepy smile */
function moon(ctx: Ctx2, x: number, y: number, R: number) {
  const glow = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 2.8);
  glow.addColorStop(0, 'rgba(255,245,200,0.45)');
  glow.addColorStop(1, 'rgba(255,245,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - R * 2.8, y - R * 2.8, R * 5.6, R * 5.6);
  const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.35, R * 0.1, x, y, R);
  g.addColorStop(0, '#fffbe6');
  g.addColorStop(1, '#f6e3a6');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, TAU);
  ctx.fill();
  // soft craters
  ctx.fillStyle = 'rgba(214,190,130,0.35)';
  for (const [cx, cy, cr] of [
    [-0.5, -0.45, 0.16],
    [0.45, -0.5, 0.11],
    [0.55, 0.45, 0.14],
    [-0.62, 0.3, 0.09],
  ]) {
    ctx.beginPath();
    ctx.arc(x + cx * R, y + cy * R, cr * R, 0, TAU);
    ctx.fill();
  }
  // closed happy eyes, rosy cheeks and a smile
  ctx.strokeStyle = 'rgba(150,110,70,0.75)';
  ctx.lineWidth = Math.max(2, R * 0.045);
  ctx.lineCap = 'round';
  for (const ex of [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.arc(x + ex * R, y - R * 0.08, R * 0.13, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y + R * 0.12, R * 0.22, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,140,150,0.35)';
  for (const ex of [-0.48, 0.48]) {
    ctx.beginPath();
    ctx.ellipse(x + ex * R, y + R * 0.15, R * 0.13, R * 0.08, 0, 0, TAU);
    ctx.fill();
  }
}

function hills(ctx: Ctx2, W: number, base: number, amp: number, f: number, ph: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 80);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * f + ph)) - amp * 0.25 * Math.sin(x * f * 2.3 + ph * 2));
  ctx.lineTo(W, base + 80);
  ctx.closePath();
  ctx.fill();
}

/** the round hill the haunted house stands on */
function houseHill(ctx: Ctx2, x: number, top: number, w: number, base: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - w, base + 40);
  ctx.bezierCurveTo(x - w * 0.55, base - 10, x - w * 0.45, top, x, top);
  ctx.bezierCurveTo(x + w * 0.45, top, x + w * 0.55, base - 10, x + w, base + 40);
  ctx.closePath();
  ctx.fill();
}

/** where the house's windows glow (relative to its base, at scale s) */
function houseWindows(x: number, y: number, s: number): [number, number, number][] {
  return [
    [x - 52 * s, y - 70 * s, 16 * s],
    [x + 40 * s, y - 74 * s, 16 * s],
    [x - 8 * s, y - 158 * s, 13 * s],
    [x + 78 * s, y - 208 * s, 10 * s],
  ];
}

/** a crooked, cosy little haunted house with a tower */
function house(ctx: Ctx2, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.04);
  ctx.translate(-x, -y);
  const wall = '#6a5a9c';
  const wallDark = '#544680';
  const roof = '#3c2e66';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#2e2350';
  ctx.lineWidth = 3 * s;
  // the tower on the right
  ctx.fillStyle = wallDark;
  ctx.beginPath();
  ctx.moveTo(x + 60 * s, y - 120 * s);
  ctx.lineTo(x + 98 * s, y - 125 * s);
  ctx.lineTo(x + 102 * s, y - 230 * s);
  ctx.lineTo(x + 56 * s, y - 226 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x + 46 * s, y - 222 * s);
  ctx.quadraticCurveTo(x + 80 * s, y - 270 * s, x + 96 * s, y - 318 * s);
  ctx.quadraticCurveTo(x + 102 * s, y - 270 * s, x + 114 * s, y - 230 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // a little flag on the tower tip
  ctx.fillStyle = '#ff9b3d';
  ctx.beginPath();
  ctx.moveTo(x + 96 * s, y - 318 * s);
  ctx.lineTo(x + 122 * s, y - 310 * s);
  ctx.lineTo(x + 97 * s, y - 302 * s);
  ctx.closePath();
  ctx.fill();
  // main house
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(x - 90 * s, y);
  ctx.lineTo(x + 82 * s, y + 2 * s);
  ctx.lineTo(x + 78 * s, y - 118 * s);
  ctx.lineTo(x - 84 * s, y - 112 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // planks
  ctx.strokeStyle = 'rgba(40,30,80,0.25)';
  ctx.lineWidth = 2 * s;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(x - 88 * s, y - i * 23 * s);
    ctx.lineTo(x + 80 * s, y - i * 24 * s);
    ctx.stroke();
  }
  // upper floor (a bit crooked) with its own roof
  ctx.strokeStyle = '#2e2350';
  ctx.lineWidth = 3 * s;
  ctx.fillStyle = wall;
  ctx.beginPath();
  ctx.moveTo(x - 60 * s, y - 112 * s);
  ctx.lineTo(x + 40 * s, y - 116 * s);
  ctx.lineTo(x + 46 * s, y - 190 * s);
  ctx.lineTo(x - 52 * s, y - 184 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - 112 * s, y - 108 * s);
  ctx.lineTo(x - 70 * s, y - 140 * s);
  ctx.lineTo(x + 70 * s, y - 144 * s);
  ctx.lineTo(x + 102 * s, y - 114 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 74 * s, y - 182 * s);
  ctx.quadraticCurveTo(x - 30 * s, y - 220 * s, x - 2 * s, y - 262 * s);
  ctx.quadraticCurveTo(x + 30 * s, y - 220 * s, x + 66 * s, y - 192 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // chimney
  ctx.fillStyle = '#7d5a8a';
  ctx.fillRect(x - 46 * s, y - 238 * s, 16 * s, 34 * s);
  ctx.strokeRect(x - 46 * s, y - 238 * s, 16 * s, 34 * s);
  // the door with a round top
  ctx.fillStyle = '#8a5a3c';
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y + 1 * s);
  ctx.lineTo(x - 14 * s, y - 40 * s);
  ctx.arc(x, y - 40 * s, 14 * s, Math.PI, 0);
  ctx.lineTo(x + 14 * s, y + 1 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.arc(x + 7 * s, y - 20 * s, 2.5 * s, 0, TAU);
  ctx.fill();
  // warm windows (round ones, a crooked shutter)
  for (const [wx, wy, wr] of houseWindows(x, y, s)) {
    const g = ctx.createRadialGradient(wx, wy, wr * 0.2, wx, wy, wr);
    g.addColorStop(0, '#fff2b0');
    g.addColorStop(1, '#ffbf4a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(wx, wy, wr, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,90,0.8)';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.moveTo(wx - wr, wy);
    ctx.lineTo(wx + wr, wy);
    ctx.moveTo(wx, wy - wr);
    ctx.lineTo(wx, wy + wr);
    ctx.stroke();
    ctx.strokeStyle = '#2e2350';
    ctx.lineWidth = 3 * s;
  }
  ctx.restore();
}

/** a gnarly old tree with curly branches */
function tree(ctx: Ctx2, x: number, y: number, s: number) {
  ctx.save();
  ctx.strokeStyle = '#3a2c4a';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const branch = (x0: number, y0: number, a: number, len: number, w: number, depth: number, curl: number) => {
    ctx.lineWidth = w;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    const mx = (x0 + x1) / 2 + Math.cos(a + Math.PI / 2) * len * 0.18 * curl;
    const my = (y0 + y1) / 2 + Math.sin(a + Math.PI / 2) * len * 0.18 * curl;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx, my, x1, y1);
    ctx.stroke();
    if (depth <= 0) {
      // a little curl at the tip
      ctx.lineWidth = Math.max(2, w * 0.8);
      ctx.beginPath();
      ctx.arc(x1 + Math.cos(a + curl * 1.6) * 7 * s, y1 + Math.sin(a + curl * 1.6) * 7 * s, 7 * s, a - curl * 1.6 + Math.PI, a - curl * 1.6 + Math.PI + curl * 4.5, curl < 0);
      ctx.stroke();
      return;
    }
    branch(x1, y1, a - 0.5, len * 0.68, w * 0.62, depth - 1, -curl);
    branch(x1, y1, a + 0.45, len * 0.6, w * 0.58, depth - 1, curl);
  };
  // trunk, leaning a little
  ctx.fillStyle = '#3a2c4a';
  ctx.beginPath();
  ctx.moveTo(x - 34 * s, y + 6 * s);
  ctx.quadraticCurveTo(x - 10 * s, y - 60 * s, x - 18 * s, y - 150 * s);
  ctx.lineTo(x + 18 * s, y - 155 * s);
  ctx.quadraticCurveTo(x + 14 * s, y - 60 * s, x + 40 * s, y + 6 * s);
  ctx.closePath();
  ctx.fill();
  branch(x, y - 150 * s, -1.9, 95 * s, 22 * s, 3, 1);
  branch(x, y - 150 * s, -1.05, 105 * s, 20 * s, 3, -1);
  branch(x - 6 * s, y - 100 * s, -2.75, 80 * s, 14 * s, 2, 1);
  branch(x + 6 * s, y - 95 * s, -0.25, 85 * s, 14 * s, 2, -1);
  // a friendly knot hole
  ctx.fillStyle = '#251b33';
  ctx.beginPath();
  ctx.ellipse(x + 2 * s, y - 70 * s, 9 * s, 13 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** where the little lantern hangs in the tree (for its flicker) */
const treeLantern = (x: number, y: number, s: number): [number, number] => [x + 96 * s, y - 150 * s];

function hangingLantern(ctx: Ctx2, x: number, y: number, s: number) {
  ctx.strokeStyle = '#3a2c4a';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - 38 * s);
  ctx.lineTo(x, y - 12 * s);
  ctx.stroke();
  pumpkin(ctx, x, y, 0.42 * s, true, 0);
}

function ground(ctx: Ctx2, W: number, H: number, hz: number) {
  const g = ctx.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, '#4c5e6e');
  g.addColorStop(0.3, '#3f6650');
  g.addColorStop(1, '#2c4d3a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, hz + 10);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, hz + 6 - 8 * Math.sin(x * 0.004 + 1.2));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

/** a wobbly garden fence along the far edge of the field */
function fence(ctx: Ctx2, W: number, y: number, s: number, r: Rand, skip?: (x: number) => boolean) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#4a3f6e';
  ctx.lineWidth = 2.5 * s;
  const gap = 34 * s;
  ctx.fillStyle = '#a99cc8';
  for (const ry of [y - 26 * s, y - 52 * s]) {
    ctx.beginPath();
    ctx.moveTo(-10, ry);
    for (let x = 0; x <= W + 20; x += 60) ctx.lineTo(x, ry + Math.sin(x * 0.01) * 3 * s);
    ctx.lineTo(W + 20, ry + 7 * s);
    for (let x = W + 20; x >= -10; x -= 60) ctx.lineTo(x, ry + 7 * s + Math.sin(x * 0.01) * 3 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  for (let x = -10; x < W + gap; x += gap) {
    if (skip?.(x)) continue;
    const tilt = (r() - 0.5) * 0.16;
    const h = (66 + r() * 12) * s;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = r() < 0.15 ? '#b8acd6' : '#9c8fc0';
    ctx.beginPath();
    ctx.moveTo(-8 * s, 0);
    ctx.lineTo(-8 * s, -h + 8 * s);
    ctx.lineTo(0, -h);
    ctx.lineTo(8 * s, -h + 8 * s);
    ctx.lineTo(8 * s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** a pumpkin on the field; lit ones are lanterns with a smiling face */
function pumpkin(ctx: Ctx2, x: number, y: number, s: number, lit: boolean, hueShift: number) {
  ctx.save();
  const rx = 40 * s;
  const ry = 31 * s;
  const cy = y - ry * 0.9;
  ctx.fillStyle = 'rgba(20,30,30,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 1.05, ry * 0.25, 0, 0, TAU);
  ctx.fill();
  if (lit) {
    const glow = ctx.createRadialGradient(x, cy, rx * 0.5, x, cy, rx * 2.4);
    glow.addColorStop(0, 'rgba(255,190,80,0.35)');
    glow.addColorStop(1, 'rgba(255,190,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - rx * 2.4, cy - rx * 2.4, rx * 4.8, rx * 4.8);
  }
  const g = ctx.createRadialGradient(x - rx * 0.35, cy - ry * 0.4, rx * 0.1, x, cy, rx * 1.1);
  g.addColorStop(0, hsl(32 + hueShift, 0.95, 0.66));
  g.addColorStop(1, hsl(20 + hueShift, 0.9, 0.42));
  ctx.fillStyle = g;
  ctx.strokeStyle = hsl(18 + hueShift, 0.8, 0.25);
  ctx.lineWidth = Math.max(1.5, 3 * s);
  ctx.beginPath();
  ctx.ellipse(x, cy, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = hsl(18 + hueShift, 0.8, 0.35, 0.6);
  ctx.lineWidth = Math.max(1, 2.4 * s);
  for (const o of [-0.55, -0.2, 0.2, 0.55]) {
    ctx.beginPath();
    ctx.moveTo(x + rx * o * 0.6, cy - ry);
    ctx.quadraticCurveTo(x + rx * o * 1.35, cy, x + rx * o * 0.6, cy + ry);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(x, cy, rx, ry, 0, 0, TAU);
  ctx.stroke();
  // stem
  ctx.fillStyle = '#5d6b34';
  ctx.beginPath();
  ctx.moveTo(x - 4 * s, cy - ry + 4 * s);
  ctx.quadraticCurveTo(x - 2 * s, cy - ry - 10 * s, x + 6 * s, cy - ry - 14 * s);
  ctx.lineTo(x + 6 * s, cy - ry + 4 * s);
  ctx.closePath();
  ctx.fill();
  if (lit) {
    // happy carved face, glowing
    ctx.fillStyle = '#ffe58a';
    for (const ex of [-0.38, 0.38]) {
      ctx.beginPath();
      ctx.ellipse(x + ex * rx, cy - ry * 0.22, rx * 0.13, ry * 0.2, 0, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.55, cy + ry * 0.12);
    ctx.quadraticCurveTo(x, cy + ry * 0.85, x + rx * 0.55, cy + ry * 0.12);
    ctx.quadraticCurveTo(x, cy + ry * 0.45, x - rx * 0.55, cy + ry * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** a curly pumpkin vine with a few leaves */
function vine(ctx: Ctx2, x: number, y: number, len: number, s: number, r: Rand) {
  ctx.save();
  ctx.strokeStyle = '#4f8a43';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  const n = 6;
  for (let i = 1; i <= n; i++) ctx.quadraticCurveTo(x + (i - 0.5) * (len / n), y + (i % 2 ? -10 : 8) * s, x + i * (len / n), y + (r() - 0.5) * 6 * s);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const lx = x + (0.2 + r() * 0.7) * len;
    ctx.fillStyle = r() < 0.5 ? '#5f9e4c' : '#4d8a40';
    ctx.beginPath();
    ctx.ellipse(lx, y - 7 * s, 11 * s, 7 * s, -0.4 + r() * 0.8, 0, TAU);
    ctx.fill();
  }
  // a curl
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.arc(x + len * 0.5, y - 10 * s, 6 * s, 0, Math.PI * 1.6);
  ctx.stroke();
  ctx.restore();
}

function grassTuft(ctx: Ctx2, x: number, y: number, s: number, r: Rand) {
  ctx.strokeStyle = hsl(130 + r() * 30, 0.35, 0.3 + r() * 0.1);
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + k * 5 * s, y - (10 + r() * 10) * s);
    ctx.stroke();
  }
}

interface Lantern {
  x: number;
  y: number;
  /** glow radius */
  r: number;
  ph: number;
}

/** the house sits on its hill here (both the picture and the flicker need it) */
function houseSpot(W: number): { x: number; y: number; s: number } {
  return { x: Math.max(W * 0.72, W - 560), y: HORIZON - 150, s: 1.05 };
}

/** every pumpkin of the field (deterministic, the same for the picture and the flicker) */
function fieldPumpkins(W: number, H: number): { x: number; y: number; s: number; lit: boolean; hue: number }[] {
  const r = mulberry32(91);
  const list: { x: number; y: number; s: number; lit: boolean; hue: number }[] = [];
  // a row behind the fence-line on the field's far edge
  for (let x = 30 + r() * 60; x < W; x += 120 + r() * 110) list.push({ x, y: HORIZON + 46 + r() * 34, s: 0.42 + r() * 0.14, lit: r() < 0.45, hue: (r() - 0.5) * 12 });
  // a few big ones at the very front, left and right
  const front = [70, 210, W - 230, W - 80, W * 0.5 + 40];
  front.forEach((x, i) => list.push({ x: x + (r() - 0.5) * 40, y: H - 12 - r() * 26, s: 1.0 + r() * 0.35, lit: i % 2 === 0, hue: (r() - 0.5) * 12 }));
  return list;
}

function lanterns(W: number, H: number): Lantern[] {
  const out: Lantern[] = [];
  for (const p of fieldPumpkins(W, H)) if (p.lit) out.push({ x: p.x, y: p.y - 28 * p.s, r: 70 * p.s, ph: p.x * 0.37 });
  const h = houseSpot(W);
  for (const [wx, wy, wr] of houseWindows(h.x, h.y, h.s)) out.push({ x: wx, y: wy, r: wr * 2.6, ph: wx * 0.11 });
  const [tx, ty] = treeLantern(W * 0.07 + 30, HORIZON + 70, 1.15);
  out.push({ x: tx, y: ty - 10, r: 40, ph: 3 });
  return out;
}

// ------------------------------------------------------------------------------------- animation

interface Bat {
  x: number;
  y: number;
  v: number;
  s: number;
  ph: number;
  amp: number;
}
interface Fly {
  x: number;
  y: number;
  ph: number;
  sp: number;
  front: boolean;
}
interface Mist {
  x: number;
  y: number;
  w: number;
  h: number;
  v: number;
  a: number;
  front: boolean;
}

/** a tiny cute bat silhouette, wings flapping */
function drawBat(ctx: CanvasRenderingContext2D, b: Bat, t: number) {
  const flap = Math.sin(t * 11 + b.ph);
  const s = b.s;
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.v < 0) ctx.scale(-1, 1);
  ctx.fillStyle = '#2b2148';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 8 * s, (-6 - flap * 6) * s, side * 18 * s, (-4 - flap * 9) * s);
    ctx.quadraticCurveTo(side * 14 * s, 2 * s, side * 10 * s, 1 * s);
    ctx.quadraticCurveTo(side * 6 * s, 4 * s, 0, 3 * s);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 5 * s, 0, TAU);
  ctx.fill();
  // ears and tiny eyes
  ctx.beginPath();
  ctx.moveTo(-4 * s, -3 * s);
  ctx.lineTo(-3 * s, -8 * s);
  ctx.lineTo(-1 * s, -4 * s);
  ctx.moveTo(4 * s, -3 * s);
  ctx.lineTo(3 * s, -8 * s);
  ctx.lineTo(1 * s, -4 * s);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(-1.8 * s, -0.8 * s, 1.1 * s, 0, TAU);
  ctx.arc(1.8 * s, -0.8 * s, 1.1 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawFly(ctx: CanvasRenderingContext2D, f: Fly, t: number) {
  const a = 0.35 + 0.65 * Math.max(0, Math.sin(t * f.sp + f.ph));
  const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 14);
  g.addColorStop(0, `rgba(230,255,140,${0.9 * a})`);
  g.addColorStop(1, 'rgba(200,255,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(f.x - 14, f.y - 14, 28, 28);
  ctx.fillStyle = `rgba(250,255,210,${a})`;
  ctx.beginPath();
  ctx.arc(f.x, f.y, 2.4, 0, TAU);
  ctx.fill();
}

function drawMist(ctx: CanvasRenderingContext2D, m: Mist) {
  const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.w);
  g.addColorStop(0, `rgba(215,205,245,${m.a})`);
  g.addColorStop(1, 'rgba(215,205,245,0)');
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.scale(1, m.h / m.w);
  ctx.translate(-m.x, -m.y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(m.x, m.y, m.w, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** a soft flicker 0..1 from a few sines */
const flicker = (t: number, ph: number) => 0.5 + 0.25 * Math.sin(t * 7.3 + ph) + 0.15 * Math.sin(t * 13.1 + ph * 2.1) + 0.1 * Math.sin(t * 2.3 + ph * 0.7);

// ------------------------------------------------------------------------------------- behaviour

/** 0 ghost, 1 pumpkin, 2 witch, 3 cat */
const kindOf = (c: Creature) => c.genome.variant % 4;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function groundDepth(y: number) {
  return lerp(0.76, 1.08, clamp((y - GROUND0) / (GROUND1 - GROUND0)));
}

/** steer smoothly towards (tx, ty): gentle curves, never a sharp turn */
function steer(c: Creature, dt: number, speed: number, turn: number) {
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const d = Math.hypot(dx, dy) || 1;
  const v = speed * clamp(d / 80, 0.25, 1);
  c.vx = lerp(c.vx, (dx / d) * v, Math.min(1, dt * turn));
  c.vy = lerp(c.vy, (dy / d) * v, Math.min(1, dt * turn));
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (Math.abs(c.vx) > 12) c.facing = c.vx >= 0 ? 1 : -1;
  return d;
}

function walkTo(c: Creature, dt: number, speed: number) {
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const d = Math.hypot(dx, dy);
  c.vx = lerp(c.vx, (dx / (d || 1)) * speed, Math.min(1, dt * 4));
  c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.5, Math.min(1, dt * 4));
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
  return d;
}

function groundSpot(s: HabitatScene, c: Creature, reach: number): [number, number] {
  const B = s.bounds;
  return [clamp(c.x + (Math.random() - 0.5) * reach, B.x0, B.x1), clamp(c.y + (Math.random() - 0.5) * 140, GROUND0, GROUND1)];
}

/** a gentle wobble-over for shaky creatures (never so far that the letter is hard to read) */
function tumble(c: Creature, max = 0.55) {
  const t = c.stateT;
  c.rot = t < 0.3 ? (t / 0.3) * max * c.facing : t < 1.2 ? max * c.facing + Math.sin(t * 20) * 0.04 : Math.max(0, max * (1 - (t - 1.2) / 0.4)) * c.facing;
  if (t > 1.6) {
    c.state = 'idle';
    c.stateT = 0;
    c.rot = 0;
  }
}

/** something that hatched in the air drops onto the field */
function startFall(c: Creature) {
  c.state = 'fall';
  c.stateT = 0;
  c.vy = 0;
  c.vx = 0;
  c.ty = rnd(GROUND0 + 20, GROUND1 - 30);
}

function fall(s: HabitatScene, c: Creature, dt: number, sound: () => void) {
  c.vy += 1100 * dt;
  c.y += c.vy * dt;
  c.depth = lerp(c.depth, groundDepth(c.y), Math.min(1, dt * 4));
  c.rot = lerp(c.rot, 0, Math.min(1, dt * 5));
  if (c.y >= c.ty) {
    c.y = c.ty;
    c.vy = 0;
    c.state = 'idle';
    c.stateT = 0;
    s.particles.burst('puff', c.x, c.y + c.sprite.radius * 0.6, 5, { color: 'rgba(200,190,230,0.5)', size: 14, speed: 60, max: 0.5 });
    sound();
  }
}

function behaveGhost(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  if (!c.special) {
    c.special = 1;
    c.y = clamp(c.y, GHOST0, GROUND1 - 30);
    c.ty = c.y;
  }
  c.depth = lerp(0.8, 1.04, clamp((c.y - GHOST0) / (GROUND1 - GHOST0)));
  const bob = Math.sin(c.age * 1.6 + c.phase) * 14;
  const wob = c.genome.wobble > 0.4 ? 1.8 : 1;
  const sway = Math.sin(c.age * 1.1 + c.phase) * 0.05 * wob;
  if (c.state === 'idle') {
    c.state = 'glide';
    c.stateT = 0;
    c.tx = clamp(c.x + (Math.random() < 0.5 ? -1 : 1) * rnd(250, 700), B.x0 + 30, B.x1 - 30);
    c.ty = rnd(GHOST0, GROUND1 - 40);
  }
  if (c.state === 'glide') {
    const d = steer(c, dt, lerp(45, 80, c.genome.q), 1.0);
    c.lift = bob;
    c.rot = lerp(c.rot, sway + clamp(c.vx / 80, -1, 1) * 0.05, Math.min(1, dt * 3));
    if (d < 30 || c.stateT > 14) {
      c.stateT = 0;
      if (Math.random() < 0.4) {
        c.state = 'boo';
        s.particles.add({ kind: 'text', x: c.x + c.facing * c.sprite.radius * 0.6, y: c.y - c.lift - c.sprite.radius * c.depth - 20, vy: -45, max: 1.4, size: 34, color: '#f3eaff', text: t(tk('Buh!')) });
        sfx.boing();
      } else c.state = 'hover';
    }
  } else if (c.state === 'hover') {
    c.vx = lerp(c.vx, 0, Math.min(1, dt * 2));
    c.vy = lerp(c.vy, 0, Math.min(1, dt * 2));
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.lift = bob;
    c.rot = lerp(c.rot, sway, Math.min(1, dt * 3));
    if (c.stateT > 1.5 + (c.id % 3)) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'boo') {
    // a quick happy hop up, a little wiggle, and float down again
    const k = c.stateT;
    c.vx = lerp(c.vx, 0, Math.min(1, dt * 4));
    c.x += c.vx * dt;
    c.lift = bob + Math.sin(clamp(k / 0.8) * Math.PI) * 55;
    c.rot = Math.sin(k * 16) * 0.1 * Math.max(0, 1 - k / 0.9);
    if (k < 0.5 && Math.random() < dt * 10) s.particles.add({ kind: 'spark', x: c.x + rnd(-40, 40), y: c.y - c.lift + rnd(-40, 20), vy: -30, size: 8, max: 0.6, color: '#efe2ff' });
    if (k > 1.0) {
      c.state = 'hover';
      c.stateT = 0;
    }
  } else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, GHOST0, GROUND1);
}

function behavePumpkin(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  if (!c.special) {
    c.special = 1;
    if (c.y < GROUND0) startFall(c);
  }
  if (c.state === 'fall') {
    fall(s, c, dt, () => sfx.bonk());
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    return;
  }
  c.depth = groundDepth(c.y);
  const wob = c.genome.wobble > 0.4 ? 1.7 : 1;
  if (c.state === 'idle') {
    c.vx = lerp(c.vx, 0, Math.min(1, dt * 6));
    c.vy = lerp(c.vy, 0, Math.min(1, dt * 6));
    c.lift = Math.max(0, c.lift - dt * 200);
    c.rot = lerp(c.rot, Math.sin(c.age * 1.8 + c.phase) * 0.04 * wob, Math.min(1, dt * 5));
    if (c.stateT > 1.4 + (c.id % 3) * 0.7) {
      c.stateT = 0;
      if (c.genome.q > 0.4 && Math.random() < 0.2) {
        c.state = 'bigHop';
        sfx.boing();
      } else {
        c.state = 'hop';
        [c.tx, c.ty] = groundSpot(s, c, 520);
      }
    }
    if (c.genome.wobble > 0.4 && Math.random() < dt * 0.1) {
      c.state = 'tumble';
      c.stateT = 0;
      sfx.bonk();
    }
  } else if (c.state === 'hop') {
    // bouncy hops: only moves while in the air
    const per = 0.55;
    const ph = (c.stateT % per) / per;
    const air = ph < 0.75;
    const p = air ? ph / 0.75 : 0;
    c.lift = Math.sin(p * Math.PI) * lerp(26, 40, c.genome.q);
    if (air) walkTo(c, dt, lerp(90, 130, c.genome.q));
    else {
      c.vx *= 0.5;
      c.vy *= 0.5;
    }
    c.rot = (air ? 0.08 * c.facing * Math.cos(p * Math.PI) : 0) * wob;
    const d = Math.hypot(c.tx - c.x, c.ty - c.y);
    if ((d < 18 && !air) || c.stateT > 7) {
      c.state = 'idle';
      c.stateT = 0;
      if (Math.random() < 0.4) sfx.plopp(0.8);
    }
  } else if (c.state === 'bigHop') {
    // a big happy jump on the spot
    const k = clamp(c.stateT / 0.9);
    c.lift = Math.sin(k * Math.PI) * 95;
    c.rot = Math.sin(k * TAU) * 0.12 * c.facing;
    if (k >= 1) {
      c.state = 'idle';
      c.stateT = 0;
      c.lift = 0;
      s.particles.burst('spark', c.x, c.y - c.sprite.radius * c.depth, 5, { color: '#ffd27a', size: 10, speed: 120, max: 0.6 });
      sfx.plopp(1.2);
    }
  } else if (c.state === 'tumble') tumble(c);
  else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, GROUND0, GROUND1);
}

function flyTarget(s: HabitatScene, c: Creature) {
  const B = s.bounds;
  // alternate high and low waypoints far apart: the steering turns that into wide arcs
  c.special = c.special === 1 ? 2 : 1;
  c.tx = clamp(c.x + (c.facing >= 0 ? 1 : -1) * rnd(450, 900), B.x0 + 40, B.x1 - 40);
  if (Math.abs(c.tx - c.x) < 250) c.tx = clamp(c.x - c.facing * rnd(500, 900), B.x0 + 40, B.x1 - 40);
  c.ty = c.special === 1 ? rnd(SKY0 + 20, SKY0 + 150) : rnd(FLY1 - 170, FLY1 - 20);
}

function behaveWitch(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const speed = lerp(140, 200, c.genome.q);
  c.depth = lerp(c.depth, lerp(0.8, 1.0, clamp((c.y - SKY0) / (FLY1 - SKY0))), Math.min(1, dt * 3));
  if (c.state === 'idle') {
    c.state = 'fly';
    c.stateT = 0;
    flyTarget(s, c);
  }
  if (c.state === 'fly') {
    const d = steer(c, dt, speed, 0.9);
    c.lift = Math.sin(c.age * 2.2 + c.phase) * 8;
    c.rot = lerp(c.rot, clamp(c.vy / speed, -1, 1) * 0.2 * c.facing, Math.min(1, dt * 4));
    // a trail of little sparkles from the broom
    if (c.genome.q > 0.45 && Math.random() < dt * 7) {
      const col = ['#d7a6ff', '#ffc46b', '#a6ffb4'][Math.floor(Math.random() * 3)];
      s.particles.add({ kind: 'spark', x: c.x - c.facing * c.sprite.radius * c.depth * 0.95, y: c.y - c.lift + c.sprite.radius * 0.3, vy: 15, size: 7, max: 0.7, color: col });
    }
    if (d < 70 || c.stateT > 9) {
      c.stateT = 0;
      if (Math.random() < 0.22) {
        c.state = 'hover';
        if (Math.random() < 0.5) sfx.whoosh();
      } else flyTarget(s, c);
    }
  } else if (c.state === 'hover') {
    // stops for a moment and bobs on the broom
    c.vx = lerp(c.vx, 0, Math.min(1, dt * 2));
    c.vy = lerp(c.vy, 0, Math.min(1, dt * 2));
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.lift = Math.sin(c.stateT * 3 + c.phase) * 14;
    c.rot = lerp(c.rot, Math.sin(c.stateT * 3) * 0.06, Math.min(1, dt * 4));
    if (c.stateT > 1.6 + (c.id % 2)) {
      c.state = 'fly';
      c.stateT = 0;
      flyTarget(s, c);
    }
  } else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, B.y0, GROUND1);
}

function behaveCat(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  if (!c.special) {
    c.special = 1;
    if (c.y < GROUND0) startFall(c);
  }
  if (c.state === 'fall') {
    fall(s, c, dt, () => sfx.plopp(0.7));
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    return;
  }
  const gd = groundDepth(c.y);
  c.depth = gd;
  const wob = c.genome.wobble > 0.4 ? 1.6 : 1;
  if (c.state === 'idle') {
    // sits and looks about
    c.vx = lerp(c.vx, 0, Math.min(1, dt * 6));
    c.vy = lerp(c.vy, 0, Math.min(1, dt * 6));
    c.lift = Math.max(0, c.lift - dt * 200);
    c.rot = lerp(c.rot, 0, Math.min(1, dt * 6));
    if (c.stateT > 1.8 + (c.id % 3) * 0.8) {
      const k = Math.random();
      c.stateT = 0;
      if (k < 0.55) {
        c.state = 'sneak';
        [c.tx, c.ty] = groundSpot(s, c, 600);
      } else if (k < 0.8) {
        c.state = 'arch';
        sfx.pfff();
      } else {
        c.state = 'pounce';
        sfx.whoosh();
      }
    }
    if (c.genome.wobble > 0.4 && Math.random() < dt * 0.08) {
      c.state = 'tumble';
      c.stateT = 0;
      sfx.boing();
    }
  } else if (c.state === 'sneak') {
    // creeps along softly, low to the ground
    const d = walkTo(c, dt, lerp(38, 60, c.genome.q));
    c.lift = Math.abs(Math.sin(c.age * 9)) * 2.5;
    c.rot = Math.sin(c.age * 9) * 0.025 * wob;
    if (d < 12 || c.stateT > 9) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'arch') {
    // the back goes up: the cat puffs itself up a little and leans back
    const k = Math.sin(clamp(c.stateT / 1.4) * Math.PI);
    c.depth = gd * (1 + 0.12 * k);
    c.lift = k * 10;
    c.rot = -0.06 * k * c.facing;
    if (c.stateT > 1.4) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'pounce') {
    // a playful little leap forward
    const k = clamp(c.stateT / 0.65);
    if (c.stateT < 0.25) {
      c.lift = 0;
      c.rot = 0.05 * c.facing;
    } else {
      const p = clamp((c.stateT - 0.25) / 0.45);
      c.lift = Math.sin(p * Math.PI) * 45;
      c.rot = -0.1 * c.facing * Math.cos(p * Math.PI);
      if (p < 1) c.x += c.facing * 220 * dt;
    }
    if (c.x < B.x0 + 20) c.facing = 1;
    if (c.x > B.x1 - 20) c.facing = -1;
    if (k >= 1 && c.stateT > 0.75) {
      c.state = 'idle';
      c.stateT = 0;
      c.lift = 0;
    }
  } else if (c.state === 'tumble') tumble(c, 0.45);
  else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, GROUND0, GROUND1);
}

// ------------------------------------------------------------------------------------- the world

function paintField(ctx: Ctx2, W: number, H: number, r: Rand) {
  // vines and grass first, then the pumpkins
  for (let i = 0; i < Math.round(W / 9); i++) {
    const x = r() * W;
    const y = HORIZON + 30 + r() * (H - HORIZON - 30);
    const s = 0.55 + (y - HORIZON) / (H - HORIZON);
    grassTuft(ctx, x, y, s, r);
  }
  for (let i = 0; i < Math.round(W / 160); i++) {
    const y = HORIZON + 50 + r() * 60;
    vine(ctx, r() * W - 60, y, 140 + r() * 120, 0.6, r);
  }
  for (const p of fieldPumpkins(W, H)) pumpkin(ctx, p.x, p.y, p.s, p.lit, p.hue);
}

export const halloween: HabitatDef = {
  id: 'halloween',
  archetype: 'season',
  word: [tk('Gruselfreund'), tk('Gruselfreunde')],
  count: [tk('{n} Gruselfreund'), tk('{n} Gruselfreunde')],
  makeSprite: halloweenSprite,
  sortY: true,
  speechColor: '#f3eaff',
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: SKY0, y1: GROUND1 }),

  paint(ctx, W, H) {
    const r = mulberry32(31);
    sky(ctx, W, HORIZON);
    stars(ctx, W, HORIZON, r, Math.round(W / 9));
    moon(ctx, Math.min(W * 0.24, 470), 200, 118);
    hills(ctx, W, HORIZON - 30, 110, 0.003, 1.2, '#5a4790');
    const h = houseSpot(W);
    houseHill(ctx, h.x, h.y - 6, 330, HORIZON, '#4a3d7a');
    house(ctx, h.x, h.y, h.s);
    hills(ctx, W, HORIZON + 4, 50, 0.005, 4.0, '#463a72');
    ground(ctx, W, H, HORIZON);
    // a path up to the house
    ctx.fillStyle = 'rgba(190,170,210,0.25)';
    ctx.beginPath();
    ctx.moveTo(h.x - 10, h.y + 4);
    ctx.quadraticCurveTo(h.x - 60, HORIZON - 40, h.x - 30, HORIZON + 14);
    ctx.lineTo(h.x + 30, HORIZON + 14);
    ctx.quadraticCurveTo(h.x + 10, HORIZON - 40, h.x + 12, h.y + 4);
    ctx.closePath();
    ctx.fill();
    fence(ctx, W, HORIZON + 22, 0.8, r, (x) => Math.abs(x - h.x) < 34);
    const tx = W * 0.07 + 30;
    tree(ctx, tx, HORIZON + 70, 1.15);
    const [lx, ly] = treeLantern(tx, HORIZON + 70, 1.15);
    hangingLantern(ctx, lx, ly + 24, 1.15);
    paintField(ctx, W, H, r);
  },

  init(s) {
    const r = mulberry32(17);
    const bats: Bat[] = [];
    for (let i = 0; i < 6; i++) bats.push({ x: r() * s.W, y: 70 + r() * 300, v: (r() < 0.5 ? -1 : 1) * (40 + r() * 40), s: 1.1 + r() * 0.9, ph: r() * TAU, amp: 15 + r() * 30 });
    const flies: Fly[] = [];
    for (let i = 0; i < 34; i++) flies.push({ x: r() * s.W, y: lerp(HORIZON - 120, 1060, r()), ph: r() * TAU, sp: 1.2 + r() * 2.2, front: r() < 0.35 });
    const mist: Mist[] = [];
    for (let i = 0; i < 9; i++) {
      const front = i >= 6;
      mist.push({ x: r() * s.W, y: front ? 1000 + r() * 60 : HORIZON + 30 + r() * 300, w: 260 + r() * 260, h: 40 + r() * 30, v: 8 + r() * 12, a: front ? 0.12 : 0.16 + r() * 0.08, front });
    }
    s.amb.bats = bats;
    s.amb.flies = flies;
    s.amb.mist = mist;
    s.amb.lanterns = lanterns(s.W, 1080);
  },

  ambient(s, dt) {
    for (const b of s.amb.bats as Bat[]) {
      b.x += b.v * dt;
      if (b.x > s.W + 40) b.x = -40;
      if (b.x < -40) b.x = s.W + 40;
    }
    for (const f of s.amb.flies as Fly[]) {
      f.x += Math.sin(s.t * 0.4 + f.ph) * 14 * dt;
      f.y += Math.cos(s.t * 0.33 + f.ph * 1.3) * 10 * dt;
    }
    for (const m of s.amb.mist as Mist[]) {
      m.x += m.v * dt;
      if (m.x - m.w > s.W) m.x = -m.w;
    }
  },

  renderBack(s, ctx) {
    ctx.save();
    for (const b of s.amb.bats as Bat[]) drawBat(ctx, { ...b, y: b.y + Math.sin(s.t * 0.9 + b.ph) * b.amp }, s.t);
    // the lanterns and windows flicker softly
    for (const l of s.amb.lanterns as Lantern[]) {
      const f = flicker(s.t, l.ph);
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, `rgba(255,205,110,${0.12 + 0.2 * f})`);
      g.addColorStop(1, 'rgba(255,190,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.r, 0, TAU);
      ctx.fill();
    }
    for (const m of s.amb.mist as Mist[]) if (!m.front) drawMist(ctx, m);
    for (const f of s.amb.flies as Fly[]) if (!f.front) drawFly(ctx, f, s.t);
    ctx.restore();
  },

  renderFront(s, ctx) {
    ctx.save();
    for (const m of s.amb.mist as Mist[]) if (m.front) drawMist(ctx, m);
    for (const f of s.amb.flies as Fly[]) if (f.front) drawFly(ctx, f, s.t);
    ctx.restore();
  },

  behave(s, c, dt) {
    const k = kindOf(c);
    if (k === 0) behaveGhost(s, c, dt);
    else if (k === 1) behavePumpkin(s, c, dt);
    else if (k === 2) behaveWitch(s, c, dt);
    else behaveCat(s, c, dt);
  },

  tile(ctx, W, H, kit) {
    const hz = H * 0.56;
    const r = mulberry32(8);
    sky(ctx, W, hz);
    stars(ctx, W, hz, r, 50);
    moon(ctx, 92, 70, 44);
    hills(ctx, W, hz - 6, 36, 0.012, 1.2, '#5a4790');
    houseHill(ctx, 372, hz - 70, 140, hz, '#4a3d7a');
    house(ctx, 372, hz - 64, 0.42);
    ground(ctx, W, H, hz);
    fence(ctx, W, hz + 12, 0.42, r);
    for (let i = 0; i < 60; i++) {
      const y = hz + 16 + r() * (H - hz - 16);
      grassTuft(ctx, r() * W, y, 0.4 + (0.5 * (y - hz)) / (H - hz), r);
    }
    pumpkin(ctx, 30, hz + 34, 0.32, true, 0);
    pumpkin(ctx, 448, H - 10, 0.75, true, 4);
    pumpkin(ctx, 225, hz + 40, 0.28, false, -4);
    sparkleStar(ctx, 300, 40, 6, '#fff6c8');
    kit.draw(ctx, halloweenSprite(kit.genome(96, 5, 0), kit.sticker('A')), 130, 205, 0.6, 1);
    kit.draw(ctx, halloweenSprite(kit.genome(85, 9, 2), kit.sticker('b')), 300, 105, 0.5, -1);
    kit.draw(ctx, halloweenSprite(kit.genome(75, 3, 1), kit.sticker('m')), 300, 305, 0.6, -1);
  },
};

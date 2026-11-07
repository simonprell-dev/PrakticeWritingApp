// "Herbst": a golden afternoon at the edge of an autumn wood. Red, orange and yellow trees in front of a soft hill,
// a meadow with leaf piles, mushrooms, apples and chestnuts and an old wooden fence. Leaves fall and drift in the
// wind, now and then a gust blows them sideways, and the clouds hurry along. Hedgehogs trip about slowly,
// squirrels dash and hop, foxes trot and sniff, and paper kites dance in the sky.
import { autumnLeaf, herbstKind, herbstSprite, isKite } from '../../game/creatures/seasons/herbst.ts';
import { clamp, hsl, lerp, TAU } from '../../game/math.ts';
import { mulberry32, type Rand } from '../../game/rng.ts';
import { sfx } from '../../game/audio.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** where the meadow begins (the trees stand on it) */
const HORIZON = 600;
/** the animals walk between these heights */
const GROUND0 = 670;
const GROUND1 = 960;
/** kites dance between these heights */
const SKY0 = 170;
const SKY1 = 420;

/** autumn crown colours: red, orange, yellow, brown, a late green */
const CROWNS = [8, 24, 44, 30, 70];
const crownColor = (h: number, dl = 0) => hsl(h, h === 70 ? 0.45 : h === 30 ? 0.55 : 0.78, (h === 30 ? 0.4 : h === 44 ? 0.55 : 0.5) + dl);

// ---------------------------------------------------------------- painting

function sky(ctx: Ctx2, W: number, horizon: number) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#7db6e3');
  g.addColorStop(0.55, '#cfe0ea');
  g.addColorStop(1, '#ffd9a3');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 60);
}

function sun(ctx: Ctx2, x: number, y: number, r: number) {
  const glow = ctx.createRadialGradient(x, y, r * 0.4, x, y, r * 4.2);
  glow.addColorStop(0, 'rgba(255,214,130,0.85)');
  glow.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 4.2, y - r * 4.2, r * 8.4, r * 8.4);
  ctx.fillStyle = '#ffd36a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function hill(ctx: Ctx2, W: number, base: number, amp: number, f: number, ph: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 80);
  for (let x = 0; x <= W + 40; x += 30) ctx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(x * f + ph)) - amp * 0.15 * Math.sin(x * f * 2.7 + ph * 1.3));
  ctx.lineTo(W + 40, base + 80);
  ctx.closePath();
  ctx.fill();
}

function cloud(ctx: Ctx2, x: number, y: number, s: number, a = 0.9) {
  ctx.fillStyle = `rgba(255,247,236,${a})`;
  for (const [ox, oy, rr] of [
    [0, 0, 46],
    [42, -20, 56],
    [90, -2, 46],
    [44, 14, 46],
    [128, 8, 32],
  ]) {
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
    ctx.fill();
  }
}

/** a round deciduous tree in autumn colours; apples on some */
function tree(ctx: Ctx2, r: Rand, x: number, base: number, s: number, hue: number, apples: boolean) {
  ctx.save();
  // trunk with two branches
  ctx.fillStyle = '#6e4a30';
  ctx.beginPath();
  ctx.moveTo(x - 13 * s, base);
  ctx.quadraticCurveTo(x - 6 * s, base - 80 * s, x - 7 * s, base - 170 * s);
  ctx.lineTo(x + 7 * s, base - 170 * s);
  ctx.quadraticCurveTo(x + 6 * s, base - 80 * s, x + 13 * s, base);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 7 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, base - 110 * s);
  ctx.lineTo(x - 40 * s, base - 165 * s);
  ctx.moveTo(x + 2 * s, base - 130 * s);
  ctx.lineTo(x + 38 * s, base - 180 * s);
  ctx.stroke();
  // crown: overlapping puffs, darker underneath, lighter on the sunny side
  const cy = base - 215 * s;
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + r() * 0.5;
    const d = (40 + r() * 30) * s;
    puffs.push([x + Math.cos(a) * d * 1.15, cy + Math.sin(a) * d * 0.8, (44 + r() * 22) * s]);
  }
  puffs.push([x, cy, 70 * s]);
  ctx.fillStyle = crownColor(hue, -0.1);
  for (const [px, py, pr] of puffs) {
    ctx.beginPath();
    ctx.arc(px, py + 8 * s, pr, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = crownColor(hue, 0);
  for (const [px, py, pr] of puffs) {
    ctx.beginPath();
    ctx.arc(px, py, pr * 0.94, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = crownColor(hue, 0.12);
  for (const [px, py, pr] of puffs) {
    if (px < x - 10 * s && py > cy) continue;
    ctx.beginPath();
    ctx.arc(px + pr * 0.18, py - pr * 0.22, pr * 0.5, 0, TAU);
    ctx.fill();
  }
  // a few leaves of the neighbouring colour for life
  for (let i = 0; i < 14; i++) {
    const a = r() * TAU;
    const d = r() * 85 * s;
    ctx.fillStyle = crownColor(CROWNS[(CROWNS.indexOf(hue) + 1 + Math.floor(r() * 2)) % CROWNS.length], 0.05);
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d * 1.1, cy + Math.sin(a) * d * 0.75, 7 * s, 4 * s, r() * TAU, 0, TAU);
    ctx.fill();
  }
  if (apples) {
    for (let i = 0; i < 7; i++) {
      const a = r() * TAU;
      const d = (20 + r() * 60) * s;
      const ax = x + Math.cos(a) * d * 1.1;
      const ay = cy + Math.sin(a) * d * 0.7;
      ctx.fillStyle = '#d8322a';
      ctx.beginPath();
      ctx.arc(ax, ay, 8 * s, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(ax - 3 * s, ay - 3 * s, 2.2 * s, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

function fence(ctx: Ctx2, x0: number, x1: number, base: number, s: number) {
  ctx.save();
  ctx.lineJoin = 'round';
  const wood = '#a8743f';
  const dark = '#5e3b1d';
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = dark;
  // rails
  for (const h of [26, 52]) {
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.rect(x0 - 10 * s, base - h * s - 5 * s, x1 - x0 + 20 * s, 10 * s);
    ctx.fill();
    ctx.stroke();
  }
  // posts with pointed tops
  for (let x = x0; x <= x1 + 1; x += 64 * s) {
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(x - 8 * s, base + 4 * s);
    ctx.lineTo(x - 8 * s, base - 70 * s);
    ctx.lineTo(x, base - 80 * s);
    ctx.lineTo(x + 8 * s, base - 70 * s);
    ctx.lineTo(x + 8 * s, base + 4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,180,0.35)';
    ctx.fillRect(x - 6 * s, base - 68 * s, 3 * s, 68 * s);
  }
  ctx.restore();
}

function mushroom(ctx: Ctx2, x: number, y: number, s: number, red: boolean) {
  ctx.save();
  ctx.fillStyle = 'rgba(70,60,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2 * s, 20 * s, 5 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#f6ecd8';
  ctx.strokeStyle = '#7a5a3a';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(x - 7 * s, y);
  ctx.quadraticCurveTo(x - 9 * s, y - 14 * s, x - 6 * s, y - 24 * s);
  ctx.lineTo(x + 6 * s, y - 24 * s);
  ctx.quadraticCurveTo(x + 9 * s, y - 14 * s, x + 7 * s, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = red ? '#e0362c' : '#9a5b2e';
  ctx.beginPath();
  ctx.moveTo(x - 24 * s, y - 20 * s);
  ctx.quadraticCurveTo(x - 22 * s, y - 46 * s, x, y - 47 * s);
  ctx.quadraticCurveTo(x + 22 * s, y - 46 * s, x + 24 * s, y - 20 * s);
  ctx.quadraticCurveTo(x, y - 14 * s, x - 24 * s, y - 20 * s);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = red ? '#fff8ee' : 'rgba(255,230,190,0.45)';
  const dots: [number, number, number][] = red
    ? [
        [-12, -32, 3.5],
        [2, -40, 3],
        [12, -29, 3.2],
        [-2, -27, 2.4],
      ]
    : [[-8, -38, 5]];
  for (const [dx, dy, rr] of dots) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, rr * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function chestnut(ctx: Ctx2, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = '#7a3d1c';
  ctx.strokeStyle = '#3f1e0c';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 8 * s, 0.3, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9c19a';
  ctx.beginPath();
  ctx.ellipse(x - 2 * s, y + 4 * s, 5 * s, 3 * s, 0.3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(x + 3 * s, y - 3 * s, 2 * s, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function groundApple(ctx: Ctx2, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = '#d8322a';
  ctx.strokeStyle = '#6b1a12';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.arc(x, y, 10 * s, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(x - 4 * s, y - 4 * s, 2.6 * s, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#5a3a1e';
  ctx.lineWidth = 2 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - 9 * s);
  ctx.lineTo(x + 2 * s, y - 15 * s);
  ctx.stroke();
  ctx.restore();
}

/** a heap of colourful leaves */
function leafPile(ctx: Ctx2, r: Rand, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(90,70,20,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4 * s, 110 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = crownColor(24, -0.12);
  ctx.beginPath();
  ctx.ellipse(x, y, 100 * s, 42 * s, 0, Math.PI, TAU);
  ctx.fill();
  for (let i = 0; i < 70; i++) {
    const u = r() * 2 - 1;
    const top = Math.sqrt(1 - u * u) * 40 * s;
    const lx = x + u * 98 * s;
    const ly = y - r() * top;
    const h = CROWNS[Math.floor(r() * 4)];
    autumnLeaf(ctx, lx, ly, (8 + r() * 6) * s, r() * TAU, crownColor(h, r() * 0.12 - 0.04), 'rgba(90,40,10,0.35)');
  }
  ctx.restore();
}

function grass(ctx: Ctx2, r: Rand, x: number, y: number, s: number) {
  ctx.save();
  ctx.strokeStyle = hsl(60 + r() * 25, 0.45, 0.32 + r() * 0.12);
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + k * 6 * s, y - (12 + r() * 10) * s);
    ctx.stroke();
  }
  ctx.restore();
}

function meadow(ctx: Ctx2, W: number, H: number, top: number) {
  const ground = ctx.createLinearGradient(0, top, 0, H);
  ground.addColorStop(0, '#c2b552');
  ground.addColorStop(0.4, '#a8ad48');
  ground.addColorStop(1, '#86993c');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, top + 8);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, top + 4 - 8 * Math.sin(x * 0.005 + 0.4));
  ctx.lineTo(W + 40, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

function paintWood(ctx: Ctx2, W: number, H: number) {
  const r = mulberry32(1029);
  sky(ctx, W, HORIZON);
  const sx = W - Math.min(330, W * 0.18);
  sun(ctx, sx, 230, 66);
  // far hazy hills and the round hill with tiny trees
  hill(ctx, W, HORIZON - 70, 150, 0.0026, 0.6, 'rgba(176,150,170,0.55)');
  hill(ctx, W, HORIZON - 20, 120, 0.0038, 2.4, '#d9b66e');
  for (let i = 0; i < Math.round(W / 26); i++) {
    const x = r() * W;
    const y = HORIZON - 40 - r() * 60;
    ctx.fillStyle = crownColor(CROWNS[Math.floor(r() * 5)], 0.08);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 9 + r() * 7, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // the wood: a soft back row and a bright front row
  const back: [number, number, number, number][] = [];
  for (let x = -60 + r() * 60; x < W + 80; x += 95 + r() * 70) back.push([x, HORIZON + 4, 0.7 + r() * 0.25, CROWNS[Math.floor(r() * 5)]]);
  for (const [x, y, s, h] of back) tree(ctx, r, x, y, s, h, false);
  // haze over the far trees
  const haze = ctx.createLinearGradient(0, 0, 0, HORIZON);
  haze.addColorStop(0, 'rgba(255,228,190,0.2)');
  haze.addColorStop(1, 'rgba(255,228,190,0.5)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, HORIZON + 10);
  meadow(ctx, W, H, HORIZON);
  const front: [number, number, number, number, boolean][] = [];
  let k = 0;
  for (let x = -30 + r() * 40; x < W + 80; x += 170 + r() * 110) {
    front.push([x, HORIZON + 14 + r() * 22, 0.95 + r() * 0.35, CROWNS[(k * 2 + Math.floor(r() * 2)) % 5], k % 4 === 2]);
    k++;
  }
  front.sort((a, b) => a[1] - b[1]);
  for (const [x, y, s, h, ap] of front) {
    ctx.fillStyle = 'rgba(70,60,20,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + 20 * s, y + 3, 80 * s, 12 * s, 0, 0, TAU);
    ctx.fill();
    tree(ctx, r, x, y, s, h, ap);
  }
  // fences at both sides of the meadow
  fence(ctx, W * 0.04, W * 0.3, GROUND0 - 14, 1);
  fence(ctx, W * 0.72, W * 0.96, GROUND0 - 18, 1);
  // grass, fallen leaves, things on the ground
  for (let i = 0; i < Math.round(W / 12); i++) {
    const y = HORIZON + 30 + r() * (H - HORIZON - 30);
    grass(ctx, r, r() * W, y, 0.5 + (y - HORIZON) / (H - HORIZON));
  }
  for (let i = 0; i < Math.round(W / 8); i++) {
    const y = HORIZON + 20 + r() * (H - HORIZON - 20);
    const s = 0.5 + (y - HORIZON) / (H - HORIZON);
    autumnLeaf(ctx, r() * W, y, (7 + r() * 4) * s, (r() - 0.5) * 1.2, crownColor(CROWNS[Math.floor(r() * 4)], r() * 0.1 - 0.05), 'rgba(90,40,10,0.3)');
  }
  const piles = Math.max(3, Math.round(W / 480));
  for (let i = 0; i < piles; i++) {
    const y = 760 + r() * 260;
    leafPile(ctx, r, ((i + 0.25 + r() * 0.5) / piles) * W, y, 0.75 + (y - HORIZON) / 900);
  }
  for (let i = 0; i < Math.round(W / 170); i++) {
    const y = HORIZON + 40 + r() * (H - HORIZON - 60);
    const s = 0.6 + (y - HORIZON) / (H - HORIZON) * 0.7;
    const x = r() * W;
    mushroom(ctx, x, y, s, r() < 0.6);
    if (r() < 0.6) mushroom(ctx, x + 26 * s, y + 6 * s, s * 0.65, r() < 0.5);
  }
  for (let i = 0; i < Math.round(W / 110); i++) {
    const y = HORIZON + 30 + r() * (H - HORIZON - 40);
    const s = 0.6 + (y - HORIZON) / (H - HORIZON) * 0.6;
    if (r() < 0.45) groundApple(ctx, r() * W, y, s);
    else chestnut(ctx, r() * W, y, s);
  }
  // warm afternoon light
  const warm = ctx.createRadialGradient(sx, 230, 50, sx, 230, Math.max(W, H) * 1.0);
  warm.addColorStop(0, 'rgba(255,190,110,0.16)');
  warm.addColorStop(1, 'rgba(255,170,90,0.04)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- wind and leaves

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Leaf {
  x: number;
  y: number;
  s: number;
  rot: number;
  spin: number;
  hue: number;
  v: number;
  ph: number;
  push: number;
}
interface Wind {
  /** 0..1 strength of the current gust */
  gust: number;
  t: number;
  dur: number;
  next: number;
}

const windOf = (s: HabitatScene) => (s.amb.wind as Wind | undefined)?.gust ?? 0;

function makeLeaf(r: Rand, W: number, y: number, near: boolean): Leaf {
  return {
    x: r() * W,
    y,
    s: near ? 10 + r() * 5 : 6 + r() * 4,
    rot: r() * TAU,
    spin: (r() - 0.5) * 3,
    hue: CROWNS[Math.floor(r() * 4)],
    v: near ? 55 + r() * 35 : 35 + r() * 30,
    ph: r() * TAU,
    push: 0.6 + r() * 0.6,
  };
}

function moveLeaves(list: Leaf[], s: HabitatScene, dt: number, gust: number) {
  const wind = 22 + 260 * gust;
  for (const f of list) {
    f.y += f.v * (1 - 0.6 * gust) * dt + Math.sin(s.t * 2.2 + f.ph) * 14 * dt;
    f.x += (wind * f.push + Math.sin(s.t * 1.3 + f.ph) * 30) * dt;
    f.rot += f.spin * (1 + 2.5 * gust) * dt + Math.sin(s.t * 2 + f.ph) * dt;
    if (f.y > 1095) {
      f.y = -20;
      f.x = Math.random() * s.W;
    }
    if (f.x > s.W + 30) f.x = -30;
    if (f.x < -30) f.x = s.W + 30;
  }
}

function drawLeaves(ctx: CanvasRenderingContext2D, list: Leaf[]) {
  for (const f of list) {
    // the leaf flutters: it gets thinner as it turns
    const flip = 0.35 + 0.65 * Math.abs(Math.cos(f.rot * 1.3));
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(1, flip);
    autumnLeaf(ctx, 0, 0, f.s, f.rot, crownColor(f.hue, 0.03), 'rgba(90,40,10,0.4)');
    ctx.restore();
  }
}

// ---------------------------------------------------------------- behaviour

function kiteBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  const gust = windOf(s);
  c.depth = 0.9;
  const pick = () => {
    c.tx = clamp(c.x + (Math.random() - 0.5) * 600, B.x0 + 60, B.x1 - 60);
    c.ty = lerp(SKY0 + 20, SKY1 - 20, Math.random());
  };
  if (c.state === 'idle') {
    // just hatched: climb into the sky (or start dancing right away when already up there)
    c.state = c.y > SKY1 ? 'rise' : 'dance';
    c.stateT = 0;
    c.vy = 0;
    pick();
  }
  if (c.state === 'rise') {
    c.vy = lerp(c.vy, -240 - g.q * 80, dt * 2.5);
    c.vx = lerp(c.vx, clamp((c.tx - c.x) * 0.8, -90, 90), dt * 2);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.rot = Math.sin(c.age * 4 + c.phase) * 0.1;
    c.lift = lerp(c.lift, 0, dt * 4);
    if (Math.random() < dt * 6) s.particles.add({ kind: 'puff', x: c.x + (Math.random() - 0.5) * 30, y: c.y + c.sprite.radius, vy: 30, size: 10, max: 0.5, color: 'rgba(255,255,255,0.6)' });
    if (c.y <= c.ty || c.stateT > 4) {
      c.state = 'dance';
      c.stateT = 0;
      sfx.whoosh();
    }
  } else {
    // 'dance': drift towards a spot in the sky, sway and swing; gusts push the kites along
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    c.vx = lerp(c.vx, clamp(dx * 0.5, -80, 80) + gust * 130, dt * 1.4);
    c.vy = lerp(c.vy, clamp(dy * 0.6, -45, 45) - gust * 25, dt * 1.4);
    for (const o of s.creatures) {
      if (o === c || o.leaving || !isKite(o.genome) || o.state !== 'dance') continue;
      const ox = c.x - o.x;
      const oy = c.y - o.y;
      const d = Math.hypot(ox, oy);
      if (d > 0.01 && d < 200) {
        c.x += (ox / d) * (200 - d) * dt * 0.7;
        c.y += (oy / d) * (200 - d) * dt * 0.3;
      }
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (c.vx > 30) c.facing = 1;
    else if (c.vx < -30) c.facing = -1;
    const wob = g.wobble > 0.4 ? 1 : 0;
    c.lift = Math.sin(c.age * 1.7 + c.phase) * 16 + Math.sin(c.age * 0.6 + c.phase * 2) * 8;
    // gentle swing only, so the letter stays readable
    const swing = Math.sin(c.age * 1.3 + c.phase) * 0.1 + Math.sin(c.age * 3.1) * 0.03 * wob + c.vx / 1000;
    c.rot = lerp(c.rot, clamp(swing, -0.18, 0.18), Math.min(1, dt * 3));
    if (c.stateT > 4 + (c.id % 4) * 1.2) {
      c.stateT = 0;
      pick();
    }
    c.y = clamp(c.y, Math.max(B.y0, SKY0 - 20), SKY1 + 60);
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, B.y0, B.y1);
}

function startWalk(s: HabitatScene, c: Creature, reach: number) {
  const B = s.bounds;
  c.state = 'walk';
  c.stateT = 0;
  c.tx = clamp(c.x + (Math.random() - 0.5) * reach, B.x0, B.x1);
  c.ty = clamp(c.y + (Math.random() - 0.5) * 120, GROUND0, GROUND1);
}

function walkerBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  const kind = herbstKind(g);
  if (c.state === 'idle' && c.y < GROUND0 && c.stateT < 0.1) {
    // hatched up in the air: jump down onto the meadow
    c.state = 'drop';
    c.ty = lerp(GROUND0, GROUND1, Math.random());
    c.vy = 0;
  }
  c.depth = lerp(0.74, 1.08, clamp((c.y - GROUND0) / (GROUND1 - GROUND0)));
  const wob = g.wobble > 0.4 ? 1.6 : 1;
  if (c.state === 'drop') {
    c.vy = Math.min(c.vy + 700 * dt, 520);
    c.y += c.vy * dt;
    c.rot = Math.sin(c.stateT * 7) * 0.12;
    if (c.y >= c.ty) {
      c.y = c.ty;
      c.state = 'idle';
      c.stateT = 0.2;
      c.rot = 0;
      const colors = [crownColor(8), crownColor(24), crownColor(44), crownColor(30)];
      s.particles.burst('confetti', c.x, c.y + c.sprite.radius * 0.5 * c.depth, 8, { colors, size: 12, speed: 160, max: 0.8, gravity: 300 });
      sfx.plopp(0.6);
    }
  } else if (c.state === 'idle') {
    c.vx = lerp(c.vx, 0, dt * 5);
    c.vy = lerp(c.vy, 0, dt * 5);
    c.lift = Math.max(0, c.lift - dt * 300);
    c.rot = lerp(c.rot, 0, Math.min(1, dt * 8));
    const rest = kind === 1 ? 0.6 + (c.id % 3) * 0.4 : 1.6 + (c.id % 3);
    if (c.stateT > rest) {
      const roll = Math.random();
      if (kind === 1) {
        // squirrel: a quick dash with little hops, or one big jump on the spot
        if (roll < 0.25 && g.q > 0.3) {
          c.state = 'jump';
          c.stateT = 0;
        } else {
          startWalk(s, c, 900);
          c.state = 'dash';
        }
      } else if (kind === 2 && roll < 0.4) {
        c.state = 'sniff';
        c.stateT = 0;
      } else startWalk(s, c, kind === 0 ? 420 : 700);
    }
    if (g.wobble > 0.4 && Math.random() < dt * 0.15) {
      c.state = 'tumble';
      c.stateT = 0;
      sfx.boing();
    }
  } else if (c.state === 'walk' || c.state === 'dash') {
    const speed = kind === 0 ? lerp(26, 42, g.q) : kind === 1 ? lerp(190, 270, g.q) : lerp(60, 95, g.q);
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    const acc = kind === 1 ? 7 : 4;
    c.vx = lerp(c.vx, (dx / (d || 1)) * speed, Math.min(1, dt * acc));
    c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.5, Math.min(1, dt * acc));
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
    if (kind === 0) {
      // hedgehog: tiny quick steps, hardly any bob
      c.rot = Math.sin(c.age * 16) * 0.03 * wob;
      c.lift = Math.abs(Math.sin(c.age * 16)) * 2.5;
    } else if (kind === 1) {
      // squirrel: bounding hops
      const hop = Math.abs(Math.sin(c.stateT * 9));
      c.lift = hop * (24 + 18 * g.q);
      c.rot = -c.facing * Math.cos(c.stateT * 9) * 0.08 * Math.sign(Math.sin(c.stateT * 9));
      if (Math.random() < dt * 4) s.particles.add({ kind: 'puff', x: c.x - c.facing * c.sprite.radius * c.depth * 0.6, y: c.y + c.sprite.radius * 0.6 * c.depth, vy: -15, size: 9, max: 0.4, color: 'rgba(230,210,150,0.6)' });
    } else {
      // fox: an easy trot
      c.rot = Math.sin(c.age * 9) * 0.035 * wob;
      c.lift = Math.abs(Math.sin(c.age * 9)) * 5;
    }
    if (d < 15 || c.stateT > (kind === 1 ? 3 : 9)) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'jump') {
    const t = c.stateT / 0.7;
    c.lift = Math.sin(Math.min(1, t) * Math.PI) * (60 + 40 * g.q);
    c.rot = -c.facing * Math.sin(Math.min(1, t) * TAU) * 0.15;
    if (t >= 1) {
      c.state = 'idle';
      c.stateT = 0;
      c.lift = 0;
      c.rot = 0;
      s.particles.burst('puff', c.x, c.y + c.sprite.radius * 0.6 * c.depth, 4, { color: 'rgba(230,210,150,0.6)', size: 12, speed: 70, max: 0.4 });
    }
  } else if (c.state === 'sniff') {
    // fox: nose down, a little twitching, then off again
    const t = c.stateT;
    const down = clamp(t / 0.35) * clamp((2.2 - t) / 0.35);
    c.vx = lerp(c.vx, 0, dt * 6);
    c.lift = 0;
    c.rot = c.facing * (0.16 * down + Math.sin(t * 22) * 0.015 * down);
    if (down > 0.8 && Math.random() < dt * 2) {
      const nose = c.x + c.facing * c.sprite.radius * c.depth * 1.5;
      s.particles.add({ kind: 'puff', x: nose, y: c.y - c.sprite.radius * 0.2 * c.depth, vy: -25, vx: c.facing * 10, size: 8, max: 0.6, color: 'rgba(255,255,255,0.7)' });
    }
    if (t > 2.2) {
      c.rot = 0;
      startWalk(s, c, 700);
    }
  } else if (c.state === 'tumble') {
    const t = c.stateT;
    c.lift = 0;
    c.rot = t < 0.3 ? (t / 0.3) * 1.3 * c.facing : t < 1.4 ? 1.3 * c.facing + Math.sin(t * 20) * 0.05 : Math.max(0, 1.3 * (1 - (t - 1.4) / 0.4)) * c.facing;
    if (t > 1.8) {
      c.state = 'idle';
      c.stateT = 0;
      c.rot = 0;
    }
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, c.state === 'drop' ? B.y0 : GROUND0, B.y1);
}

// ---------------------------------------------------------------- the world

export const herbst: HabitatDef = {
  id: 'herbst',
  archetype: 'season',
  word: [tk('Herbsttier'), tk('Herbsttiere')],
  count: [tk('{n} Herbsttier'), tk('{n} Herbsttiere')],
  makeSprite: herbstSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: SKY0, y1: GROUND1 }),

  paint(ctx, W, H) {
    paintWood(ctx, W, H);
  },

  init(s) {
    const r = mulberry32(23);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 5; i++) clouds.push({ x: r() * s.W, y: 60 + r() * 220, s: 0.6 + r() * 0.6, v: 28 + r() * 26 });
    const back: Leaf[] = [];
    for (let i = 0; i < 46; i++) back.push(makeLeaf(r, s.W, r() * 1080, false));
    const front: Leaf[] = [];
    for (let i = 0; i < 16; i++) front.push(makeLeaf(r, s.W, r() * 1080, true));
    s.amb.clouds = clouds;
    s.amb.leavesBack = back;
    s.amb.leavesFront = front;
    s.amb.wind = { gust: 0, t: 0, dur: 0, next: 5 } as Wind;
  },

  ambient(s, dt) {
    const w = s.amb.wind as Wind;
    if (w.dur > 0) {
      w.t += dt;
      w.gust = Math.pow(Math.sin(clamp(w.t / w.dur) * Math.PI), 2);
      if (w.t >= w.dur) {
        w.dur = 0;
        w.gust = 0;
        w.next = 7 + Math.random() * 8;
      }
    } else {
      w.next -= dt;
      if (w.next <= 0) {
        w.t = 0;
        w.dur = 2.6 + Math.random() * 1.6;
      }
    }
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * (1 + w.gust * 1.5) * dt;
      if (c.x > s.W + 200) c.x = -260;
    }
    moveLeaves(s.amb.leavesBack as Leaf[], s, dt, w.gust);
    moveLeaves(s.amb.leavesFront as Leaf[], s, dt, w.gust);
  },

  renderBack(s, ctx) {
    ctx.save();
    for (const c of s.amb.clouds as Cloud[]) cloud(ctx, c.x, c.y, c.s);
    // the kites' strings, fading towards the ground
    ctx.lineWidth = 2;
    for (const c of s.creatures) {
      if (!isKite(c.genome) || c.spawn < 0.5) continue;
      const x0 = c.x;
      const y0 = c.y - c.lift + c.sprite.radius * c.depth * 0.3;
      const x1 = x0 - 120 - (c.id % 3) * 40;
      const y1 = Math.min(1080, y0 + 520);
      const gr = ctx.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, 'rgba(255,255,255,0.75)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 - 10, y0 + 260, x1, y1);
      ctx.stroke();
    }
    drawLeaves(ctx, s.amb.leavesBack as Leaf[]);
    ctx.restore();
  },

  renderFront(s, ctx) {
    ctx.save();
    drawLeaves(ctx, s.amb.leavesFront as Leaf[]);
    ctx.restore();
  },

  behave(s, c, dt) {
    if (isKite(c.genome)) kiteBehave(s, c, dt);
    else walkerBehave(s, c, dt);
  },

  tile(ctx, W, H, kit) {
    const r = mulberry32(7);
    const hz = H * 0.56;
    sky(ctx, W, hz);
    sun(ctx, W - 64, 62, 26);
    cloud(ctx, 30, 52, 0.38);
    hill(ctx, W, hz - 6, 54, 0.014, 1.0, '#d9b66e');
    for (let x = -10, i = 0; x < W + 40; x += 62 + r() * 30, i++) tree(ctx, r, x, hz + 8 + r() * 8, 0.38 + r() * 0.12, CROWNS[(i * 2 + 1) % 5], false);
    meadow(ctx, W, H, hz + 6);
    fence(ctx, 12, 150, hz + 46, 0.5);
    for (let i = 0; i < 40; i++) {
      const y = hz + 20 + r() * (H - hz - 20);
      autumnLeaf(ctx, r() * W, y, 5 + r() * 3, r() * 1.4 - 0.7, crownColor(CROWNS[Math.floor(r() * 4)]), 'rgba(90,40,10,0.3)');
    }
    leafPile(ctx, r, 395, 334, 0.5);
    mushroom(ctx, 40, 330, 0.7, true);
    // a kite in the sky, a hedgehog, a squirrel and a fox on the meadow
    const kg = kit.genome(95, 4, 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(250, 100);
    ctx.quadraticCurveTo(200, 190, 170, 250);
    ctx.stroke();
    kit.draw(ctx, herbstSprite(kg, kit.sticker('A')), 250, 82, 0.42);
    kit.draw(ctx, herbstSprite(kit.genome(78, 9, 1), kit.sticker('b')), 92, 262, 0.5);
    kit.draw(ctx, herbstSprite(kit.genome(70, 2, 0), kit.sticker('e')), 250, 300, 0.5);
    kit.draw(ctx, herbstSprite(kit.genome(85, 13, 2), kit.sticker('m')), 380, 252, 0.46, -1);
    for (let i = 0; i < 10; i++) autumnLeaf(ctx, r() * W, r() * hz, 5 + r() * 2, r() * TAU, crownColor(CROWNS[Math.floor(r() * 4)], 0.03), 'rgba(90,40,10,0.3)');
  },
};

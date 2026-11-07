// "Sankt Martin": a November evening. The sky fades from orange over lilac into deep blue, a little village with
// half-timbered houses and a church lies on the hill, a big friendly Martin's fire burns at the edge and a path
// runs through the picture. The lanterns walk along it in a procession: each follows the one ahead, they bob
// and sway, turn at the edge and come back; new lanterns join at the end. Stars come out, windows light up,
// the fire flickers and sprays sparks, and far away a small rider in a red cloak rides slowly over the hill.
import { martinSprite } from '../../game/creatures/seasons/martin.ts';
import type { Ctx } from '../../game/canvas.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { sfx } from '../../game/audio.ts';
import { clamp, lerp, TAU } from '../../game/math.ts';
import { mulberry32, type Rand } from '../../game/rng.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

/** where the houses stand */
const VILLAGE = 668;
/** the walking area on the path */
const WALK0 = 735;
const WALK1 = 950;
/** distance between two lanterns in the procession (along the way) */
const GAP = 128;
/** walking speed of the procession */
const SPEED = 48;

/** the middle of the path at x */
const pathY = (x: number) => 842 + 38 * Math.sin(x * 0.0029 + 0.5);
/** the far hill the rider crosses */
const ridgeY = (x: number) => 452 - 18 * Math.sin(x * 0.0021 + 1.1) - 9 * Math.sin(x * 0.0057 + 0.4);
/** the Martin's fire */
const fireAt = (W: number) => ({ x: W - 205, y: 706 });
/** the church tower */
const churchAt = (W: number) => Math.round(W * 0.43);

interface Win {
  x: number;
  y: number;
  w: number;
  h: number;
  on: number;
  ph: number;
}
interface House {
  x: number;
  base: number;
  w: number;
  h: number;
  roof: number;
  plaster: string;
  roofCol: string;
  braces: boolean;
}
interface Star {
  x: number;
  y: number;
  r: number;
  ph: number;
  sp: number;
  at: number;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  r: number;
}
interface Head {
  x: number;
  y: number;
  ang: number;
  dir: 1 | -1;
  d: number;
}
interface TrailPt {
  x: number;
  y: number;
  d: number;
}

// ---------------------------------------------------------------- the painted village

const PLASTER = ['#c9b29c', '#d3bda4', '#bfa892', '#cdb59e', '#c4ad9f'];
const ROOFS = ['#7d3f39', '#6e3a42', '#84493a', '#6a4048'];
const TIMBER = '#4a3330';

/** houses (deterministic for a width), leaving room for the church, the big tree and the fire */
function houses(W: number): House[] {
  const r = mulberry32(77);
  const ch = churchAt(W);
  const out: House[] = [];
  let x = 230;
  while (x < W - 470) {
    const w = 110 + r() * 60;
    if (x + w > ch - 150 && x < ch + 230) {
      x = ch + 230;
      continue;
    }
    out.push({
      x,
      base: VILLAGE + Math.round(r() * 10),
      w,
      h: 74 + r() * 26,
      roof: 46 + r() * 20,
      plaster: PLASTER[Math.floor(r() * PLASTER.length)],
      roofCol: ROOFS[Math.floor(r() * ROOFS.length)],
      braces: r() < 0.6,
    });
    x += w + 18 + r() * 40;
  }
  return out;
}

/** every window of the village, for painting and for lighting up */
function windowsOf(W: number): Omit<Win, 'on' | 'ph'>[] {
  const out: Omit<Win, 'on' | 'ph'>[] = [];
  for (const h of houses(W)) {
    const cols = h.w > 140 ? 3 : 2;
    for (let i = 0; i < cols; i++) {
      const cx = h.x + ((i + 0.5) / cols) * h.w;
      out.push({ x: cx - 11, y: h.base - h.h + 12, w: 22, h: 22 });
      if (!(cols === 3 && i === 1)) out.push({ x: cx - 11, y: h.base - h.h * 0.45, w: 22, h: 22 });
    }
    out.push({ x: h.x + h.w / 2 - 8, y: h.base - h.h - h.roof * 0.62, w: 16, h: 16 });
  }
  const c = churchAt(W);
  // tower window and the tall windows of the nave
  out.push({ x: c - 9, y: VILLAGE - 205, w: 18, h: 32 });
  for (let i = 0; i < 3; i++) out.push({ x: c + 70 + i * 48, y: VILLAGE - 92, w: 18, h: 42 });
  return out;
}

function house(ctx: Ctx, h: House) {
  const { x, base, w, h: hh, roof } = h;
  const top = base - hh;
  ctx.save();
  ctx.fillStyle = h.plaster;
  ctx.fillRect(x, top, w, hh);
  // gable
  ctx.beginPath();
  ctx.moveTo(x, top + 1);
  ctx.lineTo(x + w / 2, top - roof);
  ctx.lineTo(x + w, top + 1);
  ctx.closePath();
  ctx.fill();
  // half timbering
  ctx.strokeStyle = TIMBER;
  ctx.lineWidth = 6;
  ctx.lineCap = 'butt';
  ctx.strokeRect(x + 3, top + 3, w - 6, hh - 3);
  const mid = top + hh * 0.5;
  ctx.beginPath();
  ctx.moveTo(x, mid);
  ctx.lineTo(x + w, mid);
  const posts = w > 140 ? 3 : 2;
  for (let i = 1; i < posts; i++) {
    ctx.moveTo(x + (i / posts) * w, top);
    ctx.lineTo(x + (i / posts) * w, base);
  }
  if (h.braces) {
    ctx.moveTo(x + 3, mid);
    ctx.lineTo(x + w / posts - 2, top + 3);
    ctx.moveTo(x + w - 3, mid);
    ctx.lineTo(x + w - w / posts + 2, top + 3);
  }
  // gable beams
  ctx.moveTo(x + w * 0.2, top);
  ctx.lineTo(x + w * 0.8, top);
  ctx.moveTo(x + w / 2, top - roof);
  ctx.lineTo(x + w / 2, top);
  ctx.stroke();
  // roof edges
  ctx.strokeStyle = h.roofCol;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 10, top + 8);
  ctx.lineTo(x + w / 2, top - roof - 4);
  ctx.lineTo(x + w + 10, top + 8);
  ctx.stroke();
  // chimney
  ctx.fillStyle = h.roofCol;
  ctx.fillRect(x + w * 0.7, top - roof * 0.75, 14, roof * 0.4);
  // door
  ctx.fillStyle = '#5a3a30';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.5 - 12, base - 38, 24, 38, [10, 10, 0, 0]);
  ctx.fill();
  ctx.restore();
}

function church(ctx: Ctx, c: number) {
  const base = VILLAGE + 4;
  const stone = '#a69aa6';
  const dark = '#867a8a';
  ctx.save();
  // nave
  ctx.fillStyle = stone;
  ctx.fillRect(c + 30, base - 120, 180, 120);
  ctx.fillStyle = '#6c3f45';
  ctx.beginPath();
  ctx.moveTo(c + 18, base - 116);
  ctx.lineTo(c + 50, base - 172);
  ctx.lineTo(c + 192, base - 172);
  ctx.lineTo(c + 222, base - 116);
  ctx.closePath();
  ctx.fill();
  // tower
  ctx.fillStyle = stone;
  ctx.fillRect(c - 38, base - 300, 76, 300);
  ctx.fillStyle = dark;
  ctx.fillRect(c - 38, base - 300, 10, 300);
  ctx.fillRect(c - 44, base - 306, 88, 12);
  // spire
  ctx.fillStyle = '#5d4a62';
  ctx.beginPath();
  ctx.moveTo(c - 46, base - 304);
  ctx.lineTo(c, base - 440);
  ctx.lineTo(c + 46, base - 304);
  ctx.closePath();
  ctx.fill();
  // gold ball and a little cross
  ctx.fillStyle = '#e8c35a';
  ctx.beginPath();
  ctx.arc(c, base - 444, 6, 0, TAU);
  ctx.fill();
  ctx.fillRect(c - 2, base - 474, 4, 28);
  ctx.fillRect(c - 9, base - 466, 18, 4);
  // clock
  ctx.fillStyle = '#efe6d2';
  ctx.beginPath();
  ctx.arc(c, base - 252, 17, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4a3a40';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c, base - 252);
  ctx.lineTo(c, base - 264);
  ctx.moveTo(c, base - 252);
  ctx.lineTo(c + 8, base - 249);
  ctx.stroke();
  // door
  ctx.fillStyle = '#4e3330';
  ctx.beginPath();
  ctx.roundRect(c - 16, base - 52, 32, 52, [16, 16, 0, 0]);
  ctx.fill();
  ctx.restore();
}

/** bare November tree, branching out from (x, y) */
function bareTree(ctx: Ctx, r: Rand, x: number, y: number, len: number, w: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const branch = (x0: number, y0: number, l: number, a: number, wd: number, depth: number) => {
    const x1 = x0 + Math.cos(a) * l;
    const y1 = y0 + Math.sin(a) * l;
    ctx.lineWidth = wd;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * l * 0.2, (y0 + y1) / 2, x1, y1);
    ctx.stroke();
    if (depth <= 0 || wd < 1.2) return;
    const n = depth > 3 ? 2 : 2 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const da = (i - (n - 1) / 2) * (0.5 + r() * 0.3) + (r() - 0.5) * 0.25;
      branch(x1, y1, l * (0.66 + r() * 0.14), a + da, wd * 0.66, depth - 1);
    }
  };
  branch(x, y, len, -Math.PI / 2 + (r() - 0.5) * 0.12, w, 6);
  ctx.restore();
}

function sky(ctx: Ctx, W: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#1a2150');
  g.addColorStop(0.3, '#3b3a7a');
  g.addColorStop(0.5, '#875a94');
  g.addColorStop(0.66, '#e47f6b');
  g.addColorStop(0.78, '#ffb46e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);
}

/** the logs and stones of the fire (the flames are drawn live) */
function firePlace(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  // warm light on the ground
  const gl = ctx.createRadialGradient(x, y, 10 * s, x, y, 380 * s);
  gl.addColorStop(0, 'rgba(255,170,80,0.42)');
  gl.addColorStop(1, 'rgba(255,150,70,0)');
  ctx.fillStyle = gl;
  ctx.beginPath();
  ctx.ellipse(x, y, 380 * s, 150 * s, 0, 0, TAU);
  ctx.fill();
  // logs stacked like a tent
  ctx.lineCap = 'round';
  for (const [a, l, c] of [
    [-1.05, 120, '#6b4530'],
    [-2.1, 120, '#5e3d2b'],
    [-1.4, 130, '#7a5036'],
    [-1.75, 128, '#684330'],
  ] as const) {
    ctx.strokeStyle = c;
    ctx.lineWidth = 16 * s;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * 55 * s, y + 6 * s);
    ctx.lineTo(x - Math.cos(a) * 55 * s + Math.cos(a) * l * s, y + 6 * s + Math.sin(a) * l * s);
    ctx.stroke();
  }
  // stones around
  for (let i = 0; i < 9; i++) {
    const t = Math.PI * (0.05 + (i / 8) * 0.9);
    ctx.fillStyle = i % 2 ? '#7d7680' : '#8d8590';
    ctx.beginPath();
    ctx.ellipse(x - Math.cos(t) * 92 * s, y + 6 * s + Math.sin(t) * 14 * s, 17 * s, 11 * s, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** live flames: soft tongues of fire in three colours */
function flames(ctx: Ctx, x: number, y: number, s: number, t: number) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y - 70 * s, 10 * s, x, y - 70 * s, 260 * s);
  const f = 0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3);
  glow.addColorStop(0, `rgba(255,190,90,${0.42 * f})`);
  glow.addColorStop(1, 'rgba(255,150,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y - 70 * s, 260 * s, 0, TAU);
  ctx.fill();
  const layers: [string, number, number][] = [
    ['#ff6a2a', 1, 1],
    ['#ff9c35', 0.78, 0.8],
    ['#ffd35a', 0.55, 0.6],
    ['#fff2b0', 0.32, 0.38],
  ];
  layers.forEach(([col, k, wk], li) => {
    ctx.fillStyle = col;
    for (let i = -2; i <= 2; i++) {
      const ph = i * 1.9 + li * 0.7;
      const h = (150 - Math.abs(i) * 32) * k * s * (0.85 + 0.15 * Math.sin(t * 7 + ph) + 0.07 * Math.sin(t * 13 + ph * 2));
      const w = (34 - Math.abs(i) * 4) * wk * s;
      const bx = x + i * 26 * s * wk;
      const sway = Math.sin(t * 3 + ph) * 10 * s * k;
      ctx.beginPath();
      ctx.moveTo(bx - w, y - 6 * s);
      ctx.quadraticCurveTo(bx - w * 1.1, y - h * 0.45, bx + sway, y - h);
      ctx.quadraticCurveTo(bx + w * 1.1, y - h * 0.45, bx + w, y - 6 * s);
      ctx.closePath();
      ctx.fill();
    }
  });
  ctx.restore();
}

/** a small rider with a red cloak on a horse, as a silhouette (feet at y) */
function rider(ctx: Ctx, x: number, y: number, dir: number, t: number, a: number) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const dark = '#2c2344';
  ctx.strokeStyle = dark;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6;
  // legs walking
  for (const [lx, ph] of [
    [-11, 0],
    [-7, Math.PI],
    [9, Math.PI],
    [13, 0],
  ] as const) {
    const sw = Math.sin(t * 3 + ph) * 3;
    ctx.beginPath();
    ctx.moveTo(lx, -14);
    ctx.lineTo(lx + sw, 0);
    ctx.stroke();
  }
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.ellipse(1, -17, 16, 6.5, 0, 0, TAU);
  ctx.fill();
  // neck and head
  ctx.beginPath();
  ctx.moveTo(10, -20);
  ctx.lineTo(18, -31);
  ctx.lineTo(23, -29);
  ctx.lineTo(16, -16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(23, -28, 5, 3, 0.5, 0, TAU);
  ctx.fill();
  // tail
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-15, -19);
  ctx.quadraticCurveTo(-21, -14, -20, -7);
  ctx.stroke();
  // red cloak flowing back
  ctx.fillStyle = '#c8372f';
  ctx.beginPath();
  ctx.moveTo(1, -36);
  ctx.quadraticCurveTo(-10, -30, -16 - Math.sin(t * 2) * 1.5, -16);
  ctx.lineTo(3, -20);
  ctx.closePath();
  ctx.fill();
  // rider
  ctx.fillStyle = dark;
  ctx.fillRect(0, -36, 6, 14);
  ctx.beginPath();
  ctx.arc(3, -40, 4, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- the procession

const kindOf = (c: Creature) => c.genome.variant % 4;

function headStep(s: HabitatScene, h: Head, trail: TrailPt[], dt: number) {
  const B = s.bounds;
  if (h.dir > 0 && h.x > B.x1 - 90) h.dir = -1;
  if (h.dir < 0 && h.x < B.x0 + 90) h.dir = 1;
  const lane = (x: number) => clamp(pathY(x) + h.dir * 55, B.y0 + 15, B.y1 - 15);
  const tx = h.x + h.dir * 150;
  const want = Math.atan2(lane(tx) - h.y, tx - h.x);
  let da = want - h.ang;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  h.ang += clamp(da, -0.95 * dt, 0.95 * dt);
  const nx = clamp(h.x + Math.cos(h.ang) * SPEED * dt, B.x0, B.x1);
  const ny = clamp(h.y + Math.sin(h.ang) * SPEED * dt, B.y0, B.y1);
  h.d += Math.hypot(nx - h.x, ny - h.y);
  h.x = nx;
  h.y = ny;
  const last = trail[trail.length - 1];
  if (!last || h.d - last.d >= 6) trail.push({ x: h.x, y: h.y, d: h.d });
  const keep = h.d - (s.host.settings.game.maxCreatures + 4) * GAP - 300;
  while (trail.length > 2 && trail[1].d < keep) trail.shift();
}

/** the point of the way that lies at distance d */
function trailAt(trail: TrailPt[], d: number): TrailPt {
  if (d <= trail[0].d) return trail[0];
  let lo = 0;
  let hi = trail.length - 1;
  if (d >= trail[hi].d) return trail[hi];
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (trail[m].d < d) lo = m;
    else hi = m;
  }
  const a = trail[lo];
  const b = trail[hi];
  const k = (d - a.d) / Math.max(1e-6, b.d - a.d);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), d };
}

export const martin: HabitatDef = {
  id: 'martin',
  archetype: 'season',
  word: [tk('Laterne'), tk('Laternen')],
  count: [tk('{n} Laterne'), tk('{n} Laternen')],
  makeSprite: martinSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 330, y0: WALK0, y1: WALK1 }),

  paint(ctx, W, H) {
    const r = mulberry32(11);
    sky(ctx, W, VILLAGE + 40);
    // the last light of the sunset low on the left
    const sun = ctx.createRadialGradient(W * 0.18, VILLAGE, 20, W * 0.18, VILLAGE, 520);
    sun.addColorStop(0, 'rgba(255,200,120,0.55)');
    sun.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, VILLAGE + 40);
    // a few soft dusk clouds
    for (let i = 0; i < Math.round(W / 420); i++) {
      const cx = (i + 0.3 + r() * 0.4) * (W / Math.round(W / 420));
      const cy = 300 + r() * 120;
      ctx.fillStyle = 'rgba(255,170,150,0.22)';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 130 + r() * 80, 12 + r() * 6, 0, 0, TAU);
      ctx.fill();
    }
    // far hill
    ctx.fillStyle = '#4e4072';
    ctx.beginPath();
    ctx.moveTo(0, VILLAGE + 30);
    for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, ridgeY(x));
    ctx.lineTo(W, VILLAGE + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5c4b7c';
    ctx.beginPath();
    ctx.moveTo(0, VILLAGE + 30);
    for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, VILLAGE - 70 - 22 * Math.sin(x * 0.004 + 2.2));
    ctx.lineTo(W, VILLAGE + 30);
    ctx.closePath();
    ctx.fill();
    // small bare trees behind the village
    for (let i = 0; i < Math.round(W / 260); i++) {
      const x = 260 + r() * (W - 700);
      bareTree(ctx, r, x, VILLAGE + 4, 40 + r() * 22, 6, '#3d3158');
    }
    // the village
    const c = churchAt(W);
    church(ctx, c);
    for (const h of houses(W)) house(ctx, h);
    // dim windows (they light up live)
    for (const w of windowsOf(W)) {
      ctx.fillStyle = '#5a4656';
      ctx.fillRect(w.x, w.y, w.w, w.h);
    }
    // meadow
    const ground = ctx.createLinearGradient(0, VILLAGE, 0, H);
    ground.addColorStop(0, '#56584a');
    ground.addColorStop(1, '#30382f');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, VILLAGE + 6);
    for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, VILLAGE + 2 - 6 * Math.sin(x * 0.01 + 0.3));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    // a wooden fence along the village
    ctx.strokeStyle = '#4a3a34';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let x = 200; x < W - 420; x += 46) {
      ctx.moveTo(x, VILLAGE + 40);
      ctx.lineTo(x, VILLAGE + 14);
    }
    ctx.moveTo(196, VILLAGE + 22);
    ctx.lineTo(W - 420, VILLAGE + 22);
    ctx.moveTo(196, VILLAGE + 33);
    ctx.lineTo(W - 420, VILLAGE + 33);
    ctx.stroke();
    // the path to the church
    ctx.fillStyle = '#8f7d6a';
    ctx.beginPath();
    ctx.moveTo(c - 16, VILLAGE + 2);
    ctx.lineTo(c + 16, VILLAGE + 2);
    ctx.quadraticCurveTo(c + 30, VILLAGE + 80, c + 110, pathY(c + 110) - 60);
    ctx.lineTo(c - 110, pathY(c - 110) - 60);
    ctx.quadraticCurveTo(c - 30, VILLAGE + 80, c - 16, VILLAGE + 2);
    ctx.fill();
    // the main path through the picture
    const pw = (x: number) => 108 + 6 * Math.sin(x * 0.007);
    const pg = ctx.createLinearGradient(0, 760, 0, 940);
    pg.addColorStop(0, '#94826e');
    pg.addColorStop(1, '#7c6b5b');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.moveTo(-10, pathY(-10) - pw(-10));
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, pathY(x) - pw(x));
    for (let x = W + 20; x >= -10; x -= 20) ctx.lineTo(x, pathY(x) + pw(x));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,50,40,0.35)';
    ctx.lineWidth = 4;
    for (const sg of [-1, 1]) {
      ctx.beginPath();
      for (let x = -10; x <= W + 20; x += 20) ctx.lineTo(x, pathY(x) + sg * pw(x));
      ctx.stroke();
    }
    // pebbles on the path
    for (let i = 0; i < Math.round(W / 22); i++) {
      const x = r() * W;
      const y = pathY(x) + (r() - 0.5) * 1.7 * pw(x);
      ctx.fillStyle = r() < 0.5 ? 'rgba(175,160,140,0.6)' : 'rgba(90,75,62,0.45)';
      ctx.beginPath();
      ctx.ellipse(x, y, 3 + r() * 4, 2 + r() * 2, 0, 0, TAU);
      ctx.fill();
    }
    // grass tufts and fallen leaves on the meadow
    for (let i = 0; i < Math.round(W / 14); i++) {
      const x = r() * W;
      const y = VILLAGE + 50 + r() * (H - VILLAGE - 50);
      if (Math.abs(y - pathY(x)) < pw(x) + 8) continue;
      const s = 0.6 + (y - VILLAGE) / (H - VILLAGE);
      if (r() < 0.55) {
        ctx.strokeStyle = r() < 0.5 ? '#3f4a38' : '#6a6a50';
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        for (let k = -1; k <= 1; k++) {
          ctx.moveTo(x + k * 4 * s, y);
          ctx.lineTo(x + k * 8 * s, y - (10 + r() * 8) * s);
        }
        ctx.stroke();
      } else {
        ctx.fillStyle = ['#a8552c', '#c07a33', '#8a4a2e', '#b8923a'][Math.floor(r() * 4)];
        ctx.beginPath();
        ctx.ellipse(x, y, 6 * s, 3 * s, r() * TAU, 0, TAU);
        ctx.fill();
      }
    }
    // the fire place
    const F = fireAt(W);
    firePlace(ctx, F.x, F.y, 1);
    // big bare trees at the edges
    bareTree(ctx, r, 62, 770, 210, 26, '#2f2436');
    bareTree(ctx, r, W - 40, 740, 150, 20, '#2f2436');
  },

  init(s) {
    const r = mulberry32(23);
    const stars: Star[] = [];
    for (let i = 0; i < 80; i++) stars.push({ x: r() * s.W, y: 16 + Math.pow(r(), 1.4) * 250, r: 1 + r() * 1.8, ph: r() * TAU, sp: 1 + r() * 2, at: r() < 0.3 ? -10 : r() * 50 });
    s.amb.stars = stars;
    s.amb.wins = windowsOf(s.W).map((w) => ({ ...w, on: r() < 0.5 ? -10 : 2 + r() * 40, ph: r() * TAU })) as Win[];
    s.amb.sparks = [] as Spark[];
    s.amb.rider = { x: 300 + r() * (s.W * 0.4), dir: 1 };
    // the procession has been walking for a while already
    const B = s.bounds;
    const head: Head = { x: B.x0 + 100, y: pathY(B.x0 + 100) + 55, ang: 0, dir: 1, d: 0 };
    const trail: TrailPt[] = [];
    for (let i = 0; i < 100 * 15; i++) headStep(s, head, trail, 1 / 15);
    s.amb.head = head;
    s.amb.trail = trail;
  },

  ambient(s, dt) {
    headStep(s, s.amb.head as Head, s.amb.trail as TrailPt[], dt);
    // sparks from the fire
    const F = fireAt(s.W);
    const sparks = s.amb.sparks as Spark[];
    if (Math.random() < dt * 14 && sparks.length < 60)
      sparks.push({ x: F.x + (Math.random() - 0.5) * 70, y: F.y - 60 - Math.random() * 60, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 70, t: 0, life: 1.2 + Math.random() * 1.4, r: 1.5 + Math.random() * 2.2 });
    for (const p of sparks) {
      p.t += dt;
      p.x += (p.vx + Math.sin(p.t * 4 + p.r * 3) * 18) * dt;
      p.y += p.vy * dt;
      p.vy *= 1 - dt * 0.3;
    }
    s.amb.sparks = sparks.filter((p) => p.t < p.life);
    // the rider crosses the hill slowly, then starts again
    const rd = s.amb.rider as { x: number; dir: number };
    rd.x += rd.dir * 11 * dt;
    if (rd.x > s.W - 470) rd.x = 300;
  },

  renderBack(s, ctx) {
    ctx.save();
    for (const st of s.amb.stars as Star[]) {
      const a = clamp((s.t - st.at) / 4) * (0.55 + 0.45 * Math.sin(s.t * st.sp + st.ph));
      if (a <= 0.02) continue;
      if (st.r > 2.4) sparkleStar(ctx, st.x, st.y, st.r * 3 * a, `rgba(255,250,220,${a})`);
      ctx.fillStyle = `rgba(255,250,225,${a})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.r, 0, TAU);
      ctx.fill();
    }
    // the rider, fading in and out at the ends and behind the church tower
    const rd = s.amb.rider as { x: number; dir: number };
    const tower = churchAt(s.W);
    const a = clamp((rd.x - 300) / 60) * clamp((s.W - 470 - rd.x) / 60) * clamp((Math.abs(rd.x - tower) - 50) / 30);
    if (a > 0) rider(ctx, rd.x, ridgeY(rd.x) + 2, rd.dir, s.t, a * 0.95);
    // windows light up one by one
    for (const w of s.amb.wins as Win[]) {
      const k = clamp((s.t - w.on) / 1.5);
      if (k <= 0) continue;
      const f = k * (0.88 + 0.12 * Math.sin(s.t * 1.3 + w.ph));
      ctx.fillStyle = `rgba(255,200,100,${0.22 * f})`;
      ctx.fillRect(w.x - 6, w.y - 6, w.w + 12, w.h + 12);
      ctx.fillStyle = `rgba(255,214,128,${f})`;
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = `rgba(90,60,50,${0.8 * f})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w.x + w.w / 2, w.y);
      ctx.lineTo(w.x + w.w / 2, w.y + w.h);
      ctx.moveTo(w.x, w.y + w.h / 2);
      ctx.lineTo(w.x + w.w, w.y + w.h / 2);
      ctx.stroke();
    }
    // the fire and its sparks
    const F = fireAt(s.W);
    flames(ctx, F.x, F.y, 1, s.t);
    for (const p of s.amb.sparks as Spark[]) {
      const k = 1 - p.t / p.life;
      ctx.fillStyle = `rgba(255,${Math.round(180 + 60 * k)},90,${k})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + 0.5 * k), 0, TAU);
      ctx.fill();
    }
    // every lantern throws a warm light around itself and onto the path
    for (const c of s.creatures) {
      const R = c.sprite.radius * c.depth * ease(c.spawn);
      if (R <= 1) continue;
      const k = (0.25 + 0.35 * c.genome.q) * (1 + c.special * 1.4);
      const pool = ctx.createRadialGradient(c.x, c.y + R * 1.25, 0, c.x, c.y + R * 1.25, R * 1.6);
      pool.addColorStop(0, `rgba(255,200,110,${0.32 * k})`);
      pool.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = pool;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + R * 1.25, R * 1.6, R * 0.5, 0, 0, TAU);
      ctx.fill();
      if (c.special > 0.01) {
        const gr = R * (1.5 + c.special * 0.9);
        const glow = ctx.createRadialGradient(c.x, c.y - c.lift, R * 0.4, c.x, c.y - c.lift, gr);
        glow.addColorStop(0, `rgba(255,225,140,${0.55 * c.special})`);
        glow.addColorStop(1, 'rgba(255,210,120,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(c.x, c.y - c.lift, gr, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  },

  behave(s, c, dt) {
    const B = s.bounds;
    c.depth = lerp(0.8, 1.06, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    const head = s.amb.head as Head;
    const trail = s.amb.trail as TrailPt[];
    // the place in the procession: the oldest walks in front, new lanterns join at the end
    let slot = 0;
    for (const o of s.creatures) {
      if (o === c) break;
      if (!o.leaving) slot++;
    }
    const P = trailAt(trail, head.d - (slot + 1) * GAP - (c.id % 3) * 9);
    const tx = clamp(P.x, B.x0, B.x1);
    const ty = clamp(P.y + Math.sin(s.t * 0.5 + c.phase) * 12, B.y0, B.y1);
    const wob = c.genome.wobble > 0.4 ? 1.6 : 1;
    const kind = kindOf(c);
    if (c.state === 'shine') {
      // stop for a moment and glow brighter
      const t = c.stateT;
      c.special = Math.sin(clamp(t / 2.4) * Math.PI);
      c.vx = lerp(c.vx, 0, dt * 6);
      c.vy = lerp(c.vy, 0, dt * 6);
      c.lift = Math.max(0, Math.sin(clamp(t / 0.5) * Math.PI)) * 14;
      c.rot = lerp(c.rot, Math.sin(t * 2.5) * 0.04, dt * 4);
      if (Math.random() < dt * 8 * c.special) {
        const a = Math.random() * TAU;
        const rr = c.sprite.radius * c.depth * (0.9 + Math.random() * 0.4);
        s.particles.add({ kind: 'spark', x: c.x + Math.cos(a) * rr, y: c.y - c.lift + Math.sin(a) * rr, size: 8 + Math.random() * 7, max: 0.7, color: '#ffe9a0' });
      }
      if (t > 2.4) {
        c.state = 'walk';
        c.stateT = 0;
        c.special = 0;
      }
    } else if (c.state === 'stumble') {
      // a wobbly lantern trips a little and rights itself
      const t = c.stateT;
      c.rot = Math.sin(clamp(t / 1.1) * Math.PI) * 0.28 * c.facing + Math.sin(t * 14) * 0.03;
      c.vx = lerp(c.vx, 0, dt * 5);
      c.vy = lerp(c.vy, 0, dt * 5);
      c.lift = lerp(c.lift, 0, dt * 8);
      if (t > 1.2) {
        c.state = 'walk';
        c.stateT = 0;
      }
    } else {
      const dx = tx - c.x;
      const dy = ty - c.y;
      const d = Math.hypot(dx, dy);
      // far away (new or left behind): hurry; in its place: walk with the others
      const sp = d > 260 ? 175 : clamp(d * 1.6, 0, 120);
      c.vx = lerp(c.vx, (dx / (d || 1)) * sp, dt * 4);
      c.vy = lerp(c.vy, (dy / (d || 1)) * sp, dt * 4);
      const v = Math.hypot(c.vx, c.vy);
      const k = clamp(v / SPEED);
      const step = kind === 3 ? 9 : 7.5;
      c.lift = Math.abs(Math.sin(c.age * step + c.phase)) * 7 * k;
      c.rot = Math.sin(c.age * 3.2 + c.phase) * 0.07 * wob * (0.4 + 0.6 * k);
      c.special = Math.max(0, c.special - dt);
      if (d < 80 && c.stateT > 7 && Math.random() < dt * 0.045) {
        c.state = 'shine';
        c.stateT = 0;
        if (Math.random() < 0.3) sfx.sparkle();
      } else if (c.genome.wobble > 0.4 && c.stateT > 4 && Math.random() < dt * 0.04) {
        c.state = 'stumble';
        c.stateT = 0;
      }
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (Math.abs(c.vx) > 9) c.facing = c.vx >= 0 ? 1 : -1;
    c.x = clamp(c.x, B.x0 - 30, B.x1 + 30);
    c.y = clamp(c.y, B.y0, B.y1);
  },

  tile(ctx, W, H, kit) {
    const hz = 214;
    sky(ctx, W, hz + 20);
    const sun = ctx.createRadialGradient(W * 0.15, hz, 10, W * 0.15, hz, 160);
    sun.addColorStop(0, 'rgba(255,200,120,0.55)');
    sun.addColorStop(1, 'rgba(255,170,110,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, hz + 20);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = `rgba(255,250,225,${0.4 + (i % 3) * 0.2})`;
      ctx.beginPath();
      ctx.arc((i * 137 + 20) % W, 12 + ((i * 53) % 90), 1 + (i % 3) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#5c4b7c';
    ctx.beginPath();
    ctx.moveTo(0, hz + 10);
    for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, hz - 40 - 10 * Math.sin(x * 0.015 + 1));
    ctx.lineTo(W, hz + 10);
    ctx.fill();
    // a little village: two houses and the church, scaled down
    ctx.save();
    ctx.translate(0, hz);
    ctx.scale(0.42, 0.42);
    ctx.translate(0, -VILLAGE);
    church(ctx, 520);
    const hs: House[] = [
      { x: 150, base: VILLAGE, w: 140, h: 90, roof: 60, plaster: PLASTER[1], roofCol: ROOFS[0], braces: true },
      { x: 800, base: VILLAGE + 4, w: 120, h: 80, roof: 52, plaster: PLASTER[3], roofCol: ROOFS[2], braces: false },
    ];
    for (const h of hs) house(ctx, h);
    ctx.fillStyle = '#ffd680';
    for (const h of hs) {
      ctx.fillRect(h.x + h.w * 0.25 - 11, h.base - h.h + 12, 22, 22);
      ctx.fillRect(h.x + h.w * 0.75 - 11, h.base - h.h + 12, 22, 22);
    }
    ctx.fillRect(511, VILLAGE - 201, 18, 32);
    ctx.restore();
    const ground = ctx.createLinearGradient(0, hz, 0, H);
    ground.addColorStop(0, '#56584a');
    ground.addColorStop(1, '#30382f');
    ctx.fillStyle = ground;
    ctx.fillRect(0, hz, W, H - hz);
    ctx.fillStyle = '#8f7d6a';
    ctx.beginPath();
    ctx.moveTo(0, 262);
    ctx.quadraticCurveTo(W * 0.5, 238, W, 268);
    ctx.lineTo(W, 336);
    ctx.quadraticCurveTo(W * 0.5, 312, 0, 330);
    ctx.closePath();
    ctx.fill();
    firePlace(ctx, 432, 228, 0.36);
    flames(ctx, 432, 228, 0.36, 1.3);
    bareTree(ctx, mulberry32(4), 26, 250, 70, 9, '#2f2436');
    // three lanterns in a row
    const lan: [number, number, number, number, number, number][] = [
      [70, 4, 2, 95, 292, 0.47],
      [86, 7, 1, 200, 286, 0.5],
      [97, 3, 0, 310, 292, 0.53],
    ];
    for (const [score, seed, v, x, y, sc] of lan) {
      ctx.save();
      const glow = ctx.createRadialGradient(x, y, 5, x, y, 70);
      glow.addColorStop(0, 'rgba(255,215,130,0.45)');
      glow.addColorStop(1, 'rgba(255,215,130,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 70, 0, TAU);
      ctx.fill();
      ctx.restore();
      kit.draw(ctx, martinSprite(kit.genome(score, seed, v), kit.sticker(x < 150 ? 'L' : x < 250 ? 'M' : 'a')), x, y, sc, 1);
    }
  },
};

function ease(t: number): number {
  return clamp(t);
}

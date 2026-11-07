// "Ostern": a spring meadow with soft green hills, blossoming bushes, tulips and daffodils and a basket of eggs.
// Clouds drift, butterflies flutter and the flowers sway. Bunnies hop, chicks scurry in tiny steps and peck,
// painted eggs roll a little way and wobble, lambs trot and leap for joy.
import { osternSprite } from '../../game/creatures/seasons/ostern.ts';
import { clamp, hsl, lerp, TAU } from '../../game/math.ts';
import { mulberry32 } from '../../game/rng.ts';
import { sfx } from '../../game/audio.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HORIZON = 540;
const GROUND0 = 610;
const GROUND1 = 930;

const BLOSSOM = ['#ffd1e3', '#ffffff', '#ffb3cf', '#fff1a8', '#e8d4ff'];

function sky(ctx: Ctx2, W: number, horizon: number) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#86cdf5');
  g.addColorStop(1, '#e4f6ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 60);
}

function sun(ctx: Ctx2, x: number, y: number, r: number) {
  ctx.save();
  const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3.2);
  glow.addColorStop(0, 'rgba(255,245,170,0.9)');
  glow.addColorStop(1, 'rgba(255,240,170,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
  ctx.strokeStyle = 'rgba(255,215,80,0.55)';
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3);
    ctx.lineTo(x + Math.cos(a) * r * (i % 2 ? 1.6 : 1.8), y + Math.sin(a) * r * (i % 2 ? 1.6 : 1.8));
    ctx.stroke();
  }
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function hills(ctx: Ctx2, W: number, base: number, amp: number, f: number, ph: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 60);
  for (let x = 0; x <= W + 40; x += 30) ctx.lineTo(x, base - amp * (0.55 + 0.45 * Math.sin(x * f + ph)) - amp * 0.2 * Math.sin(x * f * 2.3 + ph * 1.7));
  ctx.lineTo(W, base + 60);
  ctx.closePath();
  ctx.fill();
}

function cloud(ctx: Ctx2, x: number, y: number, s: number, a = 0.92) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (const [ox, oy, rr] of [
    [0, 0, 50],
    [45, -20, 60],
    [95, 0, 48],
    [45, 15, 50],
  ]) {
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
    ctx.fill();
  }
}

/** a round green bush dotted with blossoms */
function bush(ctx: Ctx2, x: number, y: number, s: number, r: () => number, blossom: string, green = '#5fae4a') {
  ctx.save();
  const lumps: [number, number, number][] = [
    [-55, -30, 42],
    [0, -52, 52],
    [55, -30, 42],
    [-28, -12, 40],
    [28, -12, 40],
  ];
  ctx.fillStyle = 'rgba(40,90,30,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y, 100 * s, 14 * s, 0, 0, TAU);
  ctx.fill();
  for (const [ox, oy, rr] of lumps) {
    ctx.fillStyle = green;
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.arc(x - 12 * s, y - 70 * s, 26 * s, 0, TAU);
  ctx.fill();
  for (let i = 0; i < 22; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r());
    const fx = x + Math.cos(a) * 85 * s * d;
    const fy = y - 38 * s + Math.sin(a) * 38 * s * d;
    blossomDot(ctx, fx, fy, (4 + r() * 3) * s, blossom);
  }
  ctx.restore();
}

function blossomDot(ctx: Ctx2, x: number, y: number, r: number, col: string) {
  ctx.fillStyle = col;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8, r * 0.65, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ffcf3a';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, TAU);
  ctx.fill();
}

/** a blossoming tree on the hills */
function blossomTree(ctx: Ctx2, x: number, y: number, s: number, r: () => number) {
  ctx.save();
  ctx.fillStyle = '#8a6a50';
  ctx.fillRect(x - 5 * s, y - 50 * s, 10 * s, 50 * s);
  for (const [ox, oy, rr] of [
    [-24, -62, 30],
    [20, -66, 32],
    [0, -88, 34],
  ]) {
    ctx.fillStyle = '#f7c6dc';
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 10; i++) {
    ctx.beginPath();
    ctx.arc(x + (r() - 0.5) * 70 * s, y - (55 + r() * 50) * s, 3.5 * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** a tulip (kind 0) or a daffodil (kind 1) whose stem bends by `sway` */
function flower(ctx: Ctx2, x: number, y: number, s: number, kind: number, hue: number, sway: number) {
  const h = 70 * s;
  const tx = x + sway * h * 0.35;
  const ty = y - h;
  ctx.save();
  ctx.lineCap = 'round';
  // leaves
  ctx.fillStyle = '#4f9e3c';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + side * 22 * s + sway * 6 * s, y - h * 0.35, x + side * 8 * s + sway * 10 * s, y - h * 0.6);
    ctx.quadraticCurveTo(x + side * 6 * s, y - h * 0.25, x, y);
    ctx.fill();
  }
  ctx.strokeStyle = '#4a9a38';
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x, y - h * 0.6, tx, ty);
  ctx.stroke();
  ctx.translate(tx, ty);
  ctx.rotate(sway * 0.3);
  if (kind === 0) {
    // tulip cup
    ctx.fillStyle = hsl(hue, 0.8, 0.6);
    ctx.beginPath();
    ctx.moveTo(-13 * s, -22 * s);
    ctx.lineTo(-6 * s, -12 * s);
    ctx.lineTo(0, -25 * s);
    ctx.lineTo(6 * s, -12 * s);
    ctx.lineTo(13 * s, -22 * s);
    ctx.quadraticCurveTo(15 * s, 2 * s, 0, 3 * s);
    ctx.quadraticCurveTo(-15 * s, 2 * s, -13 * s, -22 * s);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(-5 * s, -10 * s, 3 * s, 8 * s, 0.2, 0, TAU);
    ctx.fill();
  } else {
    // daffodil: six petals and a trumpet, looking a little to the side
    ctx.fillStyle = '#fff07a';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 9 * s, -10 * s + Math.sin(a) * 9 * s, 8 * s, 4.5 * s, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffa928';
    ctx.beginPath();
    ctx.arc(0, -10 * s, 6.5 * s, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffd04a';
    ctx.beginPath();
    ctx.arc(0, -10 * s, 3.5 * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** a wicker basket full of painted eggs */
function basket(ctx: Ctx2, x: number, y: number, s: number) {
  ctx.save();
  ctx.fillStyle = 'rgba(40,90,30,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4 * s, 110 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  // handle
  ctx.strokeStyle = '#a8743f';
  ctx.lineWidth = 9 * s;
  ctx.beginPath();
  ctx.ellipse(x, y - 60 * s, 80 * s, 80 * s, 0, Math.PI, TAU);
  ctx.stroke();
  // eggs
  const eggs: [number, number, number, number][] = [
    [-55, -62, 340, -0.3],
    [-20, -72, 200, -0.1],
    [18, -70, 50, 0.15],
    [55, -60, 120, 0.3],
    [0, -56, 280, 0],
  ];
  for (const [ox, oy, hue, a] of eggs) {
    ctx.save();
    ctx.translate(x + ox * s, y + oy * s);
    ctx.rotate(a);
    ctx.fillStyle = hsl(hue, 0.7, 0.68);
    ctx.beginPath();
    ctx.ellipse(0, 0, 20 * s, 26 * s, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = hsl(hue + 160, 0.7, 0.9);
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo(-20 * s + i * 6.7 * s, (i % 2 ? -4 : 4) * s);
    ctx.stroke();
    ctx.restore();
  }
  // green straw
  ctx.strokeStyle = '#7cc45a';
  ctx.lineWidth = 3 * s;
  for (let i = 0; i < 14; i++) {
    const bx = x - 80 * s + i * 12 * s;
    ctx.beginPath();
    ctx.moveTo(bx, y - 45 * s);
    ctx.lineTo(bx + (i % 2 ? 6 : -6) * s, y - 60 * s);
    ctx.stroke();
  }
  // woven body
  ctx.fillStyle = '#c99254';
  ctx.beginPath();
  ctx.moveTo(x - 92 * s, y - 48 * s);
  ctx.lineTo(x + 92 * s, y - 48 * s);
  ctx.quadraticCurveTo(x + 86 * s, y, x + 60 * s, y);
  ctx.lineTo(x - 60 * s, y);
  ctx.quadraticCurveTo(x - 86 * s, y, x - 92 * s, y - 48 * s);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(120,75,35,0.5)';
  ctx.lineWidth = 3 * s;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.moveTo(x - 100 * s, y - 40 * s + k * 12 * s);
    ctx.lineTo(x + 100 * s, y - 40 * s + k * 12 * s);
    ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const bx = x - 92 * s + i * 12 * s;
    ctx.beginPath();
    ctx.moveTo(bx, y - 50 * s);
    ctx.lineTo(bx + 4 * s, y + 2 * s);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#b07a40';
  ctx.beginPath();
  ctx.roundRect(x - 96 * s, y - 54 * s, 192 * s, 12 * s, 6 * s);
  ctx.fill();
  ctx.restore();
}

function meadow(ctx: Ctx2, W: number, H: number, top: number) {
  const ground = ctx.createLinearGradient(0, top, 0, H);
  ground.addColorStop(0, '#a6da74');
  ground.addColorStop(1, '#72bb4c');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, top + 10);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, top + 6 - 12 * Math.sin(x * 0.005 + 0.4));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Fly {
  x: number;
  y: number;
  phase: number;
  hue: number;
  tx: number;
  ty: number;
}
interface Bloom {
  x: number;
  y: number;
  s: number;
  kind: number;
  hue: number;
  ph: number;
}

/** the swaying flowers: a row along the back edge and one along the front edge of the meadow */
function blooms(W: number, seed: number, y0: number, y1: number, gap: number, s0: number, skip = -1e9): Bloom[] {
  const r = mulberry32(seed);
  const out: Bloom[] = [];
  for (let x = 30 + r() * gap; x < W - 20; x += gap * (0.6 + r() * 0.8)) {
    const n = 1 + Math.floor(r() * 3);
    if (Math.abs(x - skip) > 150) for (let k = 0; k < n; k++)
      out.push({ x: x + k * 22, y: y0 + r() * (y1 - y0), s: s0 + r() * 0.3, kind: r() < 0.55 ? 0 : 1, hue: [350, 330, 10, 290, 40][Math.floor(r() * 5)], ph: r() * TAU });
  }
  return out.sort((a, b) => a.y - b.y);
}

const kindOf = (c: Creature) => c.genome.variant % 4;

function startMove(s: HabitatScene, c: Creature) {
  const B = s.bounds;
  const kind = kindOf(c);
  c.stateT = 0;
  const reach = kind === 1 ? 260 : kind === 2 ? 360 : 700;
  c.tx = clamp(c.x + (Math.random() - 0.5) * reach, B.x0, B.x1);
  c.ty = clamp(c.y + (Math.random() - 0.5) * (kind === 2 ? 60 : 120), B.y0, B.y1);
  if (kind === 0) c.state = 'hop';
  else if (kind === 2) c.state = 'roll';
  else if (kind === 3 && Math.random() < 0.3 && c.genome.q > 0.4) c.state = 'leap';
  else c.state = 'walk';
}

export const ostern: HabitatDef = {
  id: 'ostern',
  archetype: 'season',
  word: [tk('Ostertier'), tk('Ostertiere')],
  count: [tk('{n} Ostertier'), tk('{n} Ostertiere')],
  makeSprite: osternSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: GROUND0, y1: GROUND1 }),

  paint(ctx, W, H) {
    const r = mulberry32(43);
    sky(ctx, W, HORIZON);
    sun(ctx, W - 280, 150, 70);
    // soft green hills with blossoming trees
    hills(ctx, W, HORIZON - 30, 150, 0.0028, 0.8, '#bfe3a0');
    for (let i = 0; i < Math.round(W / 260); i++) blossomTree(ctx, r() * W, HORIZON - 70 - r() * 50, 0.45 + r() * 0.2, r);
    hills(ctx, W, HORIZON - 5, 90, 0.0042, 3.6, '#a2d684');
    // the meadow
    meadow(ctx, W, H, HORIZON);
    // blooming bushes along the back of the meadow
    const nb = Math.max(4, Math.round(W / 330));
    const bushes: [number, number, number, number][] = [];
    for (let i = 0; i < nb; i++) bushes.push([((i + 0.15 + r() * 0.7) / nb) * W, HORIZON + 28 + r() * 26, 0.75 + r() * 0.45, i]);
    bushes.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s, i] of bushes) bush(ctx, x, y, s, r, BLOSSOM[i % BLOSSOM.length], i % 3 === 1 ? '#6bb852' : '#5aa846');
    // the basket of eggs at the back right
    basket(ctx, W * 0.86, HORIZON + 78, 0.8);
    // lighter patches of grass
    for (let i = 0; i < 12; i++) {
      const x = r() * W;
      const y = HORIZON + 70 + r() * (H - HORIZON - 70);
      const s = 0.6 + (y - HORIZON) / (H - HORIZON);
      ctx.fillStyle = 'rgba(200,240,150,0.25)';
      ctx.beginPath();
      ctx.ellipse(x, y, 160 * s, 22 * s, 0, 0, TAU);
      ctx.fill();
    }
    // grass tufts, daisies and a few small flowers
    for (let i = 0; i < Math.round(W / 9); i++) {
      const x = r() * W;
      const y = HORIZON + 30 + r() * (H - HORIZON - 30);
      const s = 0.5 + (y - HORIZON) / (H - HORIZON);
      ctx.strokeStyle = hsl(95 + r() * 25, 0.5, 0.36 + r() * 0.12);
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + k * 5 * s, y - (12 + r() * 10) * s);
        ctx.stroke();
      }
      const f = r();
      if (f < 0.18) blossomDot(ctx, x + 6 * s, y - 16 * s, 4.5 * s, '#ffffff');
      else if (f < 0.24) blossomDot(ctx, x - 6 * s, y - 14 * s, 4 * s, BLOSSOM[Math.floor(r() * BLOSSOM.length)]);
    }
  },

  init(s) {
    const r = mulberry32(19);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 4; i++) clouds.push({ x: r() * s.W, y: 70 + r() * 200, s: 0.6 + r() * 0.6, v: 7 + r() * 10 });
    const flies: Fly[] = [];
    for (let i = 0; i < 5; i++) flies.push({ x: r() * s.W, y: 560 + r() * 380, phase: r() * TAU, hue: [50, 320, 200, 30, 280][i], tx: r() * s.W, ty: 560 + r() * 380 });
    s.amb.clouds = clouds;
    s.amb.flies = flies;
    s.amb.back = blooms(s.W, 5, HORIZON + 60, HORIZON + 85, 210, 0.8, s.W * 0.86);
    s.amb.front = blooms(s.W, 6, 1052, 1076, 280, 0.65);
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 200) c.x = -200;
    }
    for (const f of s.amb.flies as Fly[]) {
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 20) {
        f.tx = Math.random() * s.W;
        f.ty = 520 + Math.random() * 440;
      }
      f.x += (dx / (d || 1)) * 70 * dt;
      f.y += (dy / (d || 1)) * 70 * dt + Math.sin(s.t * 6 + f.phase) * 1.2;
    }
  },

  renderBack(s, ctx) {
    ctx.save();
    for (const c of s.amb.clouds as Cloud[]) cloud(ctx, c.x, c.y, c.s);
    for (const b of s.amb.back as Bloom[]) flower(ctx, b.x, b.y, b.s, b.kind, b.hue, Math.sin(s.t * 1.4 + b.ph) * 0.35);
    ctx.restore();
  },

  renderFront(s, ctx) {
    ctx.save();
    for (const b of s.amb.front as Bloom[]) flower(ctx, b.x, b.y, b.s, b.kind, b.hue, Math.sin(s.t * 1.3 + b.ph) * 0.3);
    for (const f of s.amb.flies as Fly[]) {
      const flap = Math.abs(Math.sin(s.t * 14 + f.phase));
      ctx.save();
      ctx.translate(f.x, f.y);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = hsl(f.hue, 0.85, 0.65);
        ctx.beginPath();
        ctx.ellipse(sx * 9 * flap, -5, 10 * flap + 2, 12, sx * 0.4, 0, TAU);
        ctx.fill();
        ctx.fillStyle = hsl(f.hue + 40, 0.9, 0.78);
        ctx.beginPath();
        ctx.ellipse(sx * 7 * flap, 6, 6 * flap + 1.5, 7, -sx * 0.3, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#3b2b2b';
      ctx.fillRect(-1.5, -10, 3, 18);
      ctx.restore();
    }
    ctx.restore();
  },

  behave(s, c, dt) {
    const B = s.bounds;
    const kind = kindOf(c);
    const q = c.genome.q;
    c.depth = lerp(0.72, 1.1, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    const wob = c.genome.wobble > 0.4 ? 1.6 : 1;
    if (c.state === 'idle') {
      c.vx = lerp(c.vx, 0, dt * 5);
      c.vy = lerp(c.vy, 0, dt * 5);
      c.lift = Math.max(0, c.lift - dt * 300);
      if (kind === 2 && c.special > 0) {
        // an egg wobbles out after rolling
        c.rot = lerp(c.rot, Math.sin(c.stateT * 9) * 0.2 * Math.exp(-c.stateT * 1.6) * wob, Math.min(1, dt * 10));
        if (c.stateT > 2) c.special = 0;
      } else if (kind === 1 && c.stateT % 1.6 > 1.1) {
        // a chick pecks at the grass
        c.rot = c.facing * 0.35 * Math.abs(Math.sin((c.stateT % 1.6 - 1.1) * TAU * 2));
      } else c.rot = lerp(c.rot, 0, Math.min(1, dt * 8));
      const rest = kind === 1 ? 0.6 + (c.id % 3) * 0.6 : 1.5 + (c.id % 3);
      if (c.stateT > rest) {
        if (kind === 2) c.special = 0;
        startMove(s, c);
      }
      if (c.genome.wobble > 0.4 && kind !== 2 && Math.random() < dt * 0.12) {
        c.state = 'tumble';
        c.stateT = 0;
        sfx.boing();
      }
    } else if (c.state === 'walk' || c.state === 'hop' || c.state === 'roll' || c.state === 'leap') {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      let speed = lerp(45, 80, q);
      let go = 1;
      if (kind === 0) {
        // bunny: a row of hops, moving only while in the air
        const T = 0.62;
        const u = (c.stateT % T) / T;
        const air = u < 0.72 ? Math.sin((u / 0.72) * Math.PI) : 0;
        go = u < 0.72 ? 1 : 0.05;
        speed = lerp(110, 160, q);
        c.lift = air * lerp(26, 44, q);
        c.rot = u < 0.72 ? -c.facing * 0.14 * Math.cos((u / 0.72) * Math.PI) : 0;
      } else if (kind === 1) {
        // chick: quick tiny steps
        speed = lerp(80, 120, q);
        c.lift = Math.abs(Math.sin(c.age * 24)) * 3;
        c.rot = Math.sin(c.age * 24) * 0.07 * wob;
      } else if (kind === 2) {
        // egg: rolls (rocks from side to side as it goes), the letter stays upright enough to read
        speed = lerp(55, 85, q);
        c.rot = Math.sin(c.x / (c.sprite.radius * 0.45)) * 0.26 * wob;
        c.lift = Math.abs(Math.sin(c.x / (c.sprite.radius * 0.45))) * 2;
      } else if (c.state === 'leap') {
        // lamb: happy leaps
        const T = 0.7;
        const u = (c.stateT % T) / T;
        speed = lerp(80, 110, q);
        c.lift = Math.sin(u * Math.PI) * lerp(28, 46, q);
        c.rot = -c.facing * 0.12 * Math.cos(u * Math.PI);
      } else {
        // lamb trot
        speed = lerp(45, 75, q);
        c.rot = Math.sin(c.age * 9) * 0.04 * wob;
        c.lift = Math.abs(Math.sin(c.age * 9)) * 4;
      }
      c.vx = lerp(c.vx, (dx / (d || 1)) * speed * go, dt * (kind === 0 ? 10 : 4));
      c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.5 * go, dt * (kind === 0 ? 10 : 4));
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
      const landed = kind !== 0 && c.state !== 'leap' ? true : c.lift < 3;
      if ((d < 15 || c.stateT > 8) && landed) {
        c.state = 'idle';
        c.stateT = 0;
        if (kind === 2) c.special = 1;
      }
    } else if (c.state === 'tumble') {
      const t = c.stateT;
      c.lift = Math.max(0, c.lift - dt * 300);
      c.rot = t < 0.3 ? (t / 0.3) * 1.3 * c.facing : t < 1.4 ? 1.3 * c.facing + Math.sin(t * 20) * 0.05 : Math.max(0, 1.3 * (1 - (t - 1.4) / 0.4)) * c.facing;
      if (t > 1.8) {
        c.state = 'idle';
        c.stateT = 0;
        c.rot = 0;
      }
    }
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    c.y = clamp(c.y, B.y0, B.y1);
  },

  tile(ctx, W, H, kit) {
    const hz = H * 0.5;
    sky(ctx, W, hz);
    sun(ctx, W - 70, 58, 26);
    cloud(ctx, 60, 60, 0.45);
    hills(ctx, W, hz - 5, 55, 0.012, 1.2, '#bfe3a0');
    hills(ctx, W, hz + 5, 30, 0.02, 3.9, '#a2d684');
    meadow(ctx, W, H, hz + 8);
    const r = mulberry32(7);
    bush(ctx, 40, hz + 40, 0.5, r, BLOSSOM[0]);
    bush(ctx, 445, hz + 34, 0.42, r, BLOSSOM[3], '#6bb852');
    for (const [x, y, k, h] of [
      [20, 350, 0, 350],
      [52, 356, 1, 0],
      [455, 352, 0, 30],
      [180, 352, 1, 0],
    ] as const)
      flower(ctx, x, y, 0.7, k, h, 0.1);
    kit.draw(ctx, osternSprite(kit.genome(70, 3, 1), kit.sticker('b')), 112, 268, 0.62, 1);
    kit.draw(ctx, osternSprite(kit.genome(96, 5, 0), kit.sticker('A')), 262, 232, 0.72, 1);
    kit.draw(ctx, osternSprite(kit.genome(82, 9, 2), kit.sticker('m')), 398, 288, 0.55, -1);
  },
};

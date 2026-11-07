// "Weihnachten": a snowy village in the evening, warm windows, a big decorated Christmas tree with a star,
// a starry sky. Snow falls softly, stars twinkle and the fairy lights on the tree blink gently.
import { KINDS, weihnachtenSprite } from '../../game/creatures/seasons/weihnachten.ts';
import { makePath } from '../../game/canvas.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { sfx } from '../../game/audio.ts';
import { clamp, hsl, lerp, TAU } from '../../game/math.ts';
import { mulberry32, type Rand } from '../../game/rng.ts';
import type { HabitatDef } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HORIZON = 600;
const GROUND0 = 690;
const GROUND1 = 955;
const TREE_TOP = 150;
const TREE_BASE = 660;

const KIND_GIFT = 2;

/** the tree stands in the middle of the village */
const treeX = (W: number) => W * 0.5;

/** the four layers of branches, top first: apex, bottom and half width */
function tiers(W: number): { x: number; apex: number; bottom: number; hw: number }[] {
  const x = treeX(W);
  return [0, 1, 2, 3].map((i) => ({ x, apex: TREE_TOP + 25 + i * 92, bottom: 300 + i * 102, hw: 82 + i * 46 }));
}

/** the fairy lights: they hang in swags across every layer */
function lights(W: number): { x: number; y: number; hue: number }[] {
  const out: { x: number; y: number; hue: number }[] = [];
  const hues = [0, 45, 125, 200, 300];
  tiers(W).forEach((t, i) => {
    const y0 = t.apex + (t.bottom - t.apex) * 0.45;
    const y1 = t.bottom - 14;
    const n = 5 + i * 2;
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n;
      // a sagging line from upper left to lower right
      const hwAt = (y: number) => ((y - t.apex) / (t.bottom - t.apex)) * t.hw;
      const y = lerp(y0, y1, f) + Math.sin(f * Math.PI) * 12;
      const w = hwAt(y) * 0.9;
      out.push({ x: t.x - w + f * 2 * w, y, hue: hues[(k + i * 2) % hues.length] });
    }
  });
  return out;
}

function star5(ctx: Ctx2, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function drawTree(ctx: Ctx2, W: number): void {
  const x = treeX(W);
  const r = mulberry32(77);
  // warm light on the snow around it
  const glow = ctx.createRadialGradient(x, TREE_BASE, 20, x, TREE_BASE, 380);
  glow.addColorStop(0, 'rgba(255,214,140,0.45)');
  glow.addColorStop(1, 'rgba(255,214,140,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(x, TREE_BASE, 380, 110, 0, 0, TAU);
  ctx.fill();
  // trunk
  ctx.fillStyle = '#6b4329';
  ctx.strokeStyle = '#3d2416';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.roundRect(x - 26, 600, 52, TREE_BASE - 600, 6);
  ctx.fill();
  ctx.stroke();
  const ts = tiers(W);
  for (let i = ts.length - 1; i >= 0; i--) {
    const t = ts[i];
    const p = makePath();
    p.moveTo(t.x, t.apex);
    p.quadraticCurveTo(t.x + t.hw * 0.45, t.apex + (t.bottom - t.apex) * 0.55, t.x + t.hw, t.bottom);
    // scalloped lower edge
    const n = 4 + i;
    for (let k = n - 1; k >= 0; k--) {
      const xa = t.x - t.hw + (k / n) * 2 * t.hw;
      const xm = t.x - t.hw + ((k + 0.5) / n) * 2 * t.hw;
      p.quadraticCurveTo(xm, t.bottom + 20, xa, t.bottom);
    }
    p.quadraticCurveTo(t.x - t.hw * 0.45, t.apex + (t.bottom - t.apex) * 0.55, t.x, t.apex);
    p.closePath();
    const gr = ctx.createLinearGradient(t.x - t.hw, 0, t.x + t.hw, 0);
    gr.addColorStop(0, '#2f8a4e');
    gr.addColorStop(0.55, '#1f6b3c');
    gr.addColorStop(1, '#14502c');
    ctx.fillStyle = gr;
    ctx.fill(p);
    ctx.strokeStyle = '#0d3a20';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.stroke(p);
    // a bit of snow on the scallops
    ctx.fillStyle = 'rgba(240,246,255,0.9)';
    for (let k = 0; k < n; k++) {
      if (r() < 0.35) continue;
      const xm = t.x - t.hw + ((k + 0.5) / n) * 2 * t.hw;
      ctx.beginPath();
      ctx.ellipse(xm, t.bottom + 10, t.hw / n * 0.55, 7, 0, 0, TAU);
      ctx.fill();
    }
  }
  // golden garlands under the lights
  ctx.strokeStyle = 'rgba(255,214,90,0.85)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const ls = lights(W);
  let start = 0;
  ts.forEach((_, i) => {
    const n = 5 + i * 2;
    ctx.beginPath();
    for (let k = 0; k < n; k++) ctx.lineTo(ls[start + k].x, ls[start + k].y - 4);
    ctx.stroke();
    start += n;
  });
  // baubles
  const cols = ['#e5383b', '#ffcf3a', '#4ea8ff', '#e8e8f2', '#c45bd6'];
  ts.forEach((t, i) => {
    const n = 2 + i;
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5 + (r() - 0.5) * 0.4) / n;
      const by = t.bottom - 8 - r() * 30;
      const hw = ((by - t.apex) / (t.bottom - t.apex)) * t.hw * 0.8;
      const bx = t.x - hw + f * 2 * hw;
      const br = 11 + r() * 5;
      ctx.fillStyle = cols[(k + i) % cols.length];
      ctx.strokeStyle = 'rgba(30,20,30,0.55)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#d9b45a';
      ctx.fillRect(bx - 4, by - br - 5, 8, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(bx - br * 0.35, by - br * 0.35, br * 0.28, 0, TAU);
      ctx.fill();
    }
  });
  // unlit bulbs (they light up in renderBack)
  for (const l of ls) {
    ctx.fillStyle = hsl(l.hue, 0.45, 0.4);
    ctx.beginPath();
    ctx.arc(l.x, l.y, 6, 0, TAU);
    ctx.fill();
  }
  // the star on top
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  star5(ctx, x, TREE_TOP, 40);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,230,0.75)';
  star5(ctx, x - 4, TREE_TOP - 4, 16);
  ctx.fill();
}

function drawLights(ctx: Ctx2, W: number, t: number | null): void {
  lights(W).forEach((l, i) => {
    const on = t === null ? 1 : 0.55 + 0.45 * Math.sin(t * 1.7 + i * 1.9);
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 20);
    g.addColorStop(0, hsl(l.hue, 1, 0.75, 0.75 * on));
    g.addColorStop(1, hsl(l.hue, 1, 0.7, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 20, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hsl(l.hue, 1, lerp(0.45, 0.8, on));
    ctx.beginPath();
    ctx.arc(l.x, l.y, 6, 0, TAU);
    ctx.fill();
  });
}

function house(ctx: Ctx2, x: number, base: number, s: number, r: Rand): void {
  const walls = ['#a8503f', '#8a5a3e', '#b9844c', '#6c7ba6', '#9a5a6a', '#7a8c5a'];
  const w = 150 * s;
  const h = 95 * s;
  const roofH = 70 * s;
  const left = x - w / 2;
  const top = base - h;
  // chimney
  ctx.fillStyle = '#5b3b33';
  ctx.fillRect(x + w * 0.18, top - roofH * 0.85, 18 * s, roofH * 0.6);
  ctx.fillStyle = '#f2f6ff';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.18 + 9 * s, top - roofH * 0.85, 13 * s, 6 * s, 0, 0, TAU);
  ctx.fill();
  // walls
  ctx.fillStyle = walls[Math.floor(r() * walls.length)];
  ctx.strokeStyle = 'rgba(30,20,40,0.6)';
  ctx.lineWidth = 3;
  ctx.fillRect(left, top, w, h);
  ctx.strokeRect(left, top, w, h);
  // snowy roof
  ctx.fillStyle = '#eef3ff';
  ctx.beginPath();
  ctx.moveTo(left - 14 * s, top + 4 * s);
  ctx.lineTo(x, top - roofH);
  ctx.lineTo(left + w + 14 * s, top + 4 * s);
  for (let k = 6; k >= 0; k--) ctx.quadraticCurveTo(left - 14 * s + ((k + 0.5) / 7) * (w + 28 * s), top + 16 * s, left - 14 * s + (k / 7) * (w + 28 * s), top + 4 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,140,190,0.8)';
  ctx.stroke();
  // warm windows with a glow
  const win = (wx: number, wy: number, ww: number, wh: number) => {
    const g = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 2, wx + ww / 2, wy + wh / 2, ww * 1.6);
    g.addColorStop(0, 'rgba(255,210,110,0.55)');
    g.addColorStop(1, 'rgba(255,210,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(wx - ww, wy - wh, ww * 3, wh * 3);
    ctx.fillStyle = '#ffd56b';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.strokeStyle = '#5b3b33';
    ctx.lineWidth = 3 * s;
    ctx.strokeRect(wx, wy, ww, wh);
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy);
    ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2);
    ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();
  };
  win(left + w * 0.12, top + h * 0.3, w * 0.22, h * 0.32);
  win(left + w * 0.66, top + h * 0.3, w * 0.22, h * 0.32);
  // door
  ctx.fillStyle = '#5b3b33';
  ctx.beginPath();
  ctx.roundRect(x - w * 0.09, base - h * 0.5, w * 0.18, h * 0.5, [w * 0.09, w * 0.09, 0, 0]);
  ctx.fill();
  // a wreath on some doors
  if (r() < 0.6) {
    ctx.strokeStyle = '#2f8a4e';
    ctx.lineWidth = 5 * s;
    ctx.beginPath();
    ctx.arc(x, base - h * 0.32, w * 0.055, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = '#e5383b';
    ctx.beginPath();
    ctx.arc(x, base - h * 0.32 + w * 0.055, 3 * s, 0, TAU);
    ctx.fill();
  }
}

function pine(ctx: Ctx2, x: number, base: number, s: number): void {
  ctx.fillStyle = '#2d4470';
  for (let i = 0; i < 3; i++) {
    const w = (40 - i * 9) * s;
    const y = base - i * 26 * s;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.lineTo(x, y - 48 * s);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(230,238,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(x - 9 * s, base - 76 * s);
  ctx.lineTo(x, base - 100 * s);
  ctx.lineTo(x + 9 * s, base - 76 * s);
  ctx.closePath();
  ctx.fill();
}

function paintWorld(ctx: Ctx2, W: number, H: number): void {
  const r = mulberry32(1224);
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#0e1744');
  sky.addColorStop(0.6, '#26387a');
  sky.addColorStop(1, '#6a64a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON + 2);
  // faint fixed stars
  for (let i = 0; i < Math.round(W / 12); i++) {
    ctx.fillStyle = `rgba(255,255,240,${0.25 + r() * 0.55})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * (HORIZON - 160), 0.6 + r() * 1.4, 0, TAU);
    ctx.fill();
  }
  // moon
  const mx = W * 0.12;
  const mg = ctx.createRadialGradient(mx, 140, 30, mx, 140, 200);
  mg.addColorStop(0, 'rgba(255,248,210,0.45)');
  mg.addColorStop(1, 'rgba(255,248,210,0)');
  ctx.fillStyle = mg;
  ctx.fillRect(mx - 200, 0, 400, 340);
  ctx.fillStyle = '#fff6d6';
  ctx.beginPath();
  ctx.arc(mx, 140, 52, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(220,205,160,0.45)';
  for (const [ox, oy, rr] of [
    [-16, -10, 11],
    [14, 12, 8],
    [10, -22, 6],
  ]) {
    ctx.beginPath();
    ctx.arc(mx + ox, 140 + oy, rr, 0, TAU);
    ctx.fill();
  }
  // far snowy hills with little pines
  ctx.fillStyle = '#9fb0dc';
  ctx.beginPath();
  ctx.moveTo(0, HORIZON);
  for (let x = 0; x <= W + 60; x += 60) ctx.lineTo(x, HORIZON - 70 - Math.sin(x * 0.0035 + 1) * 40 - Math.sin(x * 0.012) * 14);
  ctx.lineTo(W, HORIZON);
  ctx.fill();
  for (let i = 0; i < Math.round(W / 90); i++) {
    const x = r() * W;
    pine(ctx, x, HORIZON - 40 - Math.sin(x * 0.0035 + 1) * 30 + r() * 20, 0.45 + r() * 0.3);
  }
  ctx.fillStyle = '#c4d0ee';
  ctx.beginPath();
  ctx.moveTo(0, HORIZON + 10);
  for (let x = 0; x <= W + 60; x += 60) ctx.lineTo(x, HORIZON - 22 - Math.sin(x * 0.006 + 3) * 16);
  ctx.lineTo(W, HORIZON + 10);
  ctx.fill();
  // snow ground
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#dfe7f8');
  ground.addColorStop(1, '#b7c6e8');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HORIZON, W, H - HORIZON);
  // village along the horizon, with room for the tree in the middle
  const tx = treeX(W);
  let x = 70 + r() * 40;
  while (x < W - 60) {
    if (Math.abs(x - tx) > 300) house(ctx, x, HORIZON + 18 + r() * 14, 0.75 + r() * 0.3, r);
    x += 220 + r() * 70;
  }
  drawTree(ctx, W);
  // soft drifts and blue shadows
  for (let i = 0; i < Math.round(W / 140); i++) {
    const dx = r() * W;
    const dy = HORIZON + 120 + r() * (H - HORIZON - 120);
    const rw = 90 + r() * 140;
    ctx.fillStyle = 'rgba(150,170,220,0.22)';
    ctx.beginPath();
    ctx.ellipse(dx + 12, dy + 8, rw, rw * 0.16, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(250,252,255,0.75)';
    ctx.beginPath();
    ctx.ellipse(dx, dy, rw, rw * 0.15, 0, 0, TAU);
    ctx.fill();
  }
  // glitter in the snow
  for (let i = 0; i < Math.round(W / 8); i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.4 + r() * 0.5})`;
    ctx.fillRect(r() * W, HORIZON + 20 + r() * (H - HORIZON - 20), 2, 2);
  }
}

interface Flake {
  fx: number;
  y: number;
  r: number;
  v: number;
  ph: number;
}
interface Twinkle {
  fx: number;
  y: number;
  r: number;
  ph: number;
  sp: number;
}

function drawFlakes(s: { W: number; t: number }, ctx: CanvasRenderingContext2D, list: Flake[]): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (const f of list) {
    ctx.beginPath();
    ctx.arc(f.fx * s.W + Math.sin(s.t * 0.7 + f.ph) * 22, f.y, f.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export const weihnachten: HabitatDef = {
  id: 'weihnachten',
  archetype: 'season',
  word: [tk('Weihnachtsfreund'), tk('Weihnachtsfreunde')],
  count: [tk('{n} Weihnachtsfreund'), tk('{n} Weihnachtsfreunde')],
  makeSprite: weihnachtenSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: GROUND0, y1: GROUND1 }),

  paint: paintWorld,

  init(s) {
    const r = mulberry32(12);
    const flake = (big: boolean): Flake => ({ fx: r(), y: r() * 1080, r: big ? 3 + r() * 2.5 : 1.4 + r() * 1.6, v: big ? 45 + r() * 25 : 22 + r() * 20, ph: r() * TAU });
    s.amb.back = Array.from({ length: 60 }, () => flake(false));
    s.amb.front = Array.from({ length: 28 }, () => flake(true));
    s.amb.stars = Array.from({ length: 34 }, (): Twinkle => ({ fx: r(), y: 20 + r() * (HORIZON - 220), r: 7 + r() * 9, ph: r() * TAU, sp: 0.8 + r() * 1.4 }));
  },

  ambient(s, dt) {
    for (const list of [s.amb.back, s.amb.front] as Flake[][])
      for (const f of list) {
        f.y += f.v * dt;
        if (f.y > 1090) {
          f.y = -10;
          f.fx = Math.random();
        }
      }
  },

  renderBack(s, ctx) {
    for (const st of s.amb.stars as Twinkle[]) {
      const k = Math.max(0, Math.sin(s.t * st.sp + st.ph));
      if (k < 0.05) continue;
      ctx.globalAlpha = k;
      sparkleStar(ctx, st.fx * s.W, st.y, st.r * (0.5 + 0.5 * k));
    }
    ctx.globalAlpha = 1;
    // the tree star glows, the fairy lights blink softly
    const x = treeX(s.W);
    const pulse = 0.75 + 0.25 * Math.sin(s.t * 1.3);
    const g = ctx.createRadialGradient(x, TREE_TOP, 20, x, TREE_TOP, 120);
    g.addColorStop(0, `rgba(255,236,150,${0.5 * pulse})`);
    g.addColorStop(1, 'rgba(255,236,150,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, TREE_TOP, 120, 0, TAU);
    ctx.fill();
    drawLights(ctx, s.W, s.t);
    drawFlakes(s, ctx, s.amb.back as Flake[]);
  },

  renderFront(s, ctx) {
    drawFlakes(s, ctx, s.amb.front as Flake[]);
  },

  behave(s, c, dt) {
    const B = s.bounds;
    const kind = c.genome.variant % KINDS;
    c.depth = lerp(0.72, 1.1, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    const speed = lerp(50, 85, c.genome.q) * (kind === 0 ? 1.15 : kind === 3 ? 0.85 : 1);
    if (c.state === 'idle') {
      c.vx = lerp(c.vx, 0, dt * 5);
      c.lift = Math.max(0, c.lift - dt * 300);
      if (c.stateT > 1.5 + (c.id % 3)) {
        c.stateT = 0;
        const hop = kind === KIND_GIFT ? 1 : kind === 0 ? 0.45 : kind === 1 ? 0.25 : 0.15;
        c.state = Math.random() < hop ? 'hop' : 'walk';
        if (kind === KIND_GIFT && Math.random() < 0.6) {
          // presents like to be near the tree
          c.tx = clamp(treeX(s.W) + (Math.random() - 0.5) * 560, B.x0, B.x1);
          c.ty = lerp(B.y0, B.y0 + 110, Math.random());
        } else {
          c.tx = clamp(c.x + (Math.random() - 0.5) * 700, B.x0, B.x1);
          c.ty = clamp(c.y + (Math.random() - 0.5) * 120, B.y0, B.y1);
        }
      }
      if (c.genome.wobble > 0.4 && Math.random() < dt * 0.15) {
        c.state = 'tumble';
        c.stateT = 0;
        sfx.boing();
      }
    } else if (c.state === 'walk' || c.state === 'hop') {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      const v = c.state === 'hop' && kind === KIND_GIFT ? speed * 0.9 : speed;
      c.vx = lerp(c.vx, (dx / (d || 1)) * v, dt * 4);
      c.vy = lerp(c.vy, (dy / (d || 1)) * v * 0.5, dt * 4);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
      if (c.state === 'hop') {
        const height = kind === KIND_GIFT ? 20 + 30 * c.genome.q : kind === 1 ? 28 : 36;
        const freq = kind === KIND_GIFT ? 5 : 6;
        c.lift = Math.abs(Math.sin(c.stateT * freq)) * height;
        c.rot = kind === KIND_GIFT ? Math.sin(c.stateT * freq * 2) * 0.06 : Math.sin(c.age * 10) * 0.04;
      } else {
        c.lift = Math.abs(Math.sin(c.age * 10)) * 4;
        c.rot = Math.sin(c.age * (kind === 3 ? 7 : 10)) * (c.genome.wobble > 0.4 ? 0.09 : kind === 3 ? 0.07 : 0.04);
      }
      if (d < 15 || c.stateT > 8) {
        c.state = 'idle';
        c.stateT = 0;
        c.rot = 0;
      }
    } else if (c.state === 'tumble') {
      // fall over into the snow, wiggle, get back up
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
    // the whole village, small
    const VW = 1440;
    ctx.save();
    ctx.scale(W / VW, H / 1080);
    paintWorld(ctx, VW, 1080);
    drawLights(ctx, VW, null);
    ctx.restore();
    kit.draw(ctx, weihnachtenSprite(kit.genome(70, 3, 0), kit.sticker('W')), 95, 278, 0.5);
    kit.draw(ctx, weihnachtenSprite(kit.genome(92, 8, 2), kit.sticker('A')), 285, 300, 0.48);
    kit.draw(ctx, weihnachtenSprite(kit.genome(96, 5, 1), kit.sticker('R')), 395, 270, 0.48, -1);
  },
};

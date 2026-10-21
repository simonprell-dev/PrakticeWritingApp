// "Savanne": sunny grassland with acacias, a waterhole, drifting clouds and butterflies.
import { animalSprite } from '../game/creatures/savanna.ts';
import { sfx } from '../game/audio.ts';
import { clamp, hsl, lerp, TAU } from '../game/math.ts';
import { mulberry32 } from '../game/rng.ts';
import type { HabitatDef } from './habitat.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HORIZON = 560;
const GROUND0 = 610;
const GROUND1 = 930;

function acacia(ctx: Ctx2, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 10 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 6 * s, y - 90 * s);
  ctx.moveTo(x + 4 * s, y - 60 * s);
  ctx.lineTo(x - 30 * s, y - 100 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x + 10 * s, y - 110 * s, 90 * s, 22 * s, 0, 0, TAU);
  ctx.ellipse(x - 30 * s, y - 108 * s, 50 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
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

export const savanna: HabitatDef = {
  id: 'savanne',
  archetype: 'animal',
  word: ['Tier', 'Tiere'],
  makeSprite: animalSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: GROUND0, y1: GROUND1 }),

  paint(ctx, W, H) {
    const r = mulberry32(21);
    const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
    sky.addColorStop(0, '#7cc8f7');
    sky.addColorStop(1, '#ffe8b5');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, HORIZON + 2);
    // sun
    const sx = W - 260;
    const glow = ctx.createRadialGradient(sx, 150, 20, sx, 150, 260);
    glow.addColorStop(0, 'rgba(255,240,150,0.9)');
    glow.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 260, 0, 520, 420);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(sx, 150, 80, 0, TAU);
    ctx.fill();
    // hills
    ctx.fillStyle = 'rgba(150,140,200,0.45)';
    ctx.beginPath();
    ctx.moveTo(0, HORIZON);
    for (let x = 0; x <= W; x += 60) ctx.lineTo(x, HORIZON - 60 - Math.sin(x * 0.004) * 50 - Math.sin(x * 0.011) * 20);
    ctx.lineTo(W, HORIZON);
    ctx.fill();
    // ground
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, '#d9d36a');
    ground.addColorStop(1, '#a9c24a');
    ctx.fillStyle = ground;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);
    for (let i = 0; i < 5; i++) acacia(ctx, r() * W, HORIZON + 8 + r() * 10, 0.6 + r() * 0.5, 'rgba(90,80,60,0.75)');
    // waterhole
    const wx = W * 0.2;
    ctx.fillStyle = '#c9b46a';
    ctx.beginPath();
    ctx.ellipse(wx, 700, 230, 52, 0, 0, TAU);
    ctx.fill();
    const wg = ctx.createLinearGradient(0, 660, 0, 740);
    wg.addColorStop(0, '#7fd3f2');
    wg.addColorStop(1, '#3b9fd1');
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(wx, 700, 205, 40, 0, 0, TAU);
    ctx.fill();
    // grass tufts and flowers
    for (let i = 0; i < 160; i++) {
      const x = r() * W;
      const y = HORIZON + 20 + r() * (H - HORIZON - 20);
      const s = 0.5 + (y - HORIZON) / (H - HORIZON);
      ctx.strokeStyle = hsl(80 + r() * 30, 0.55, 0.35 + r() * 0.15);
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + k * 6 * s, y - (14 + r() * 10) * s);
        ctx.stroke();
      }
      if (r() < 0.15) {
        ctx.fillStyle = hsl(r() * 360, 0.8, 0.7);
        ctx.beginPath();
        ctx.arc(x + 4, y - 18 * s, 5 * s, 0, TAU);
        ctx.fill();
      }
    }
  },

  init(s) {
    const r = mulberry32(9);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 4; i++) clouds.push({ x: r() * s.W, y: 80 + r() * 220, s: 0.7 + r() * 0.6, v: 8 + r() * 12 });
    const flies: Fly[] = [];
    for (let i = 0; i < 3; i++) flies.push({ x: r() * s.W, y: 600 + r() * 300, phase: r() * TAU, hue: r() * 360, tx: r() * s.W, ty: 600 + r() * 300 });
    s.amb.clouds = clouds;
    s.amb.flies = flies;
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
        f.ty = 520 + Math.random() * 420;
      }
      f.x += (dx / (d || 1)) * 70 * dt;
      f.y += (dy / (d || 1)) * 70 * dt + Math.sin(s.t * 6 + f.phase) * 1.2;
    }
  },

  renderBack(s, ctx) {
    for (const c of s.amb.clouds as Cloud[]) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const [ox, oy, rr] of [
        [0, 0, 50],
        [45, -20, 60],
        [95, 0, 48],
        [45, 15, 50],
      ]) {
        ctx.beginPath();
        ctx.arc(c.x + ox * c.s, c.y + oy * c.s, rr * c.s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  renderFront(s, ctx) {
    for (const f of s.amb.flies as Fly[]) {
      const flap = Math.abs(Math.sin(s.t * 14 + f.phase));
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = hsl(f.hue, 0.85, 0.65);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * 9 * flap, -4, 10 * flap + 2, 12, sx * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#3b2b2b';
      ctx.fillRect(-1.5, -10, 3, 16);
      ctx.restore();
    }
  },

  behave(s, c, dt) {
    const B = s.bounds;
    c.depth = lerp(0.72, 1.1, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    const speed = lerp(50, 85, c.genome.q);
    if (c.state === 'idle') {
      c.vx = lerp(c.vx, 0, dt * 5);
      c.lift = Math.max(0, c.lift - dt * 300);
      if (c.stateT > 1.5 + (c.id % 3)) {
        c.state = Math.random() < 0.25 && c.genome.q > 0.6 ? 'hop' : 'walk';
        c.stateT = 0;
        c.tx = clamp(c.x + (Math.random() - 0.5) * 700, B.x0, B.x1);
        c.ty = clamp(c.y + (Math.random() - 0.5) * 120, B.y0, B.y1);
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
      c.vx = lerp(c.vx, (dx / (d || 1)) * speed, dt * 4);
      c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.5, dt * 4);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
      c.rot = Math.sin(c.age * 10) * (c.genome.wobble > 0.4 ? 0.09 : 0.04);
      c.lift = c.state === 'hop' ? Math.abs(Math.sin(c.stateT * 6)) * 40 : Math.abs(Math.sin(c.age * 10)) * 4;
      if (d < 15 || c.stateT > 8) {
        c.state = 'idle';
        c.stateT = 0;
        c.rot = 0;
      }
    } else if (c.state === 'tumble') {
      // fall over, wiggle, get back up
      const t = c.stateT;
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
};

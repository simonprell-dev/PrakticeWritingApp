// "Meer": underwater world with light rays, sand, corals, swaying seaweed and bubbles.
import { fishSprite } from '../game/creatures/fish.ts';
import { clamp, hsl, lerp, TAU } from '../game/math.ts';
import { mulberry32 } from '../game/rng.ts';
import type { Creature, HabitatDef, HabitatScene } from './habitat.ts';

interface Weed {
  x: number;
  h: number;
  hue: number;
  phase: number;
  width: number;
}

export const aquarium: HabitatDef = {
  id: 'meer',
  archetype: 'fish',
  word: ['Fisch', 'Fische'],
  makeSprite: fishSprite,
  bounds: (W) => ({ x0: 110, x1: W - 110, y0: 150, y1: 880 }),

  paint(ctx, W, H) {
    const r = mulberry32(7);
    const water = ctx.createLinearGradient(0, 0, 0, H);
    water.addColorStop(0, '#8fe3f3');
    water.addColorStop(0.35, '#38b2dd');
    water.addColorStop(1, '#155f98');
    ctx.fillStyle = water;
    ctx.fillRect(0, 0, W, H);
    // light rays
    for (let i = 0; i < 7; i++) {
      const x = (i / 6) * W + (r() - 0.5) * 120;
      const w = 60 + r() * 120;
      const g = ctx.createLinearGradient(0, 0, 0, H * 0.85);
      g.addColorStop(0, 'rgba(255,255,255,0.16)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x + w * 0.4 - 260, H * 0.85);
      ctx.lineTo(x - w * 0.6 - 260, H * 0.85);
      ctx.closePath();
      ctx.fill();
    }
    // distant rocks
    ctx.fillStyle = 'rgba(20,70,120,0.35)';
    for (let i = 0; i < 6; i++) {
      const x = r() * W;
      const w = 200 + r() * 260;
      ctx.beginPath();
      ctx.ellipse(x, H - 110, w, 120 + r() * 80, 0, Math.PI, 0);
      ctx.fill();
    }
    // sand
    const sandY = H - 120;
    const sand = ctx.createLinearGradient(0, sandY - 30, 0, H);
    sand.addColorStop(0, '#f6dfac');
    sand.addColorStop(1, '#d8b06e');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, sandY);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, sandY + Math.sin(x * 0.008) * 18 + Math.sin(x * 0.021) * 8);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    // pebbles and shells
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = hsl(30 + r() * 20, 0.35, 0.55 + r() * 0.25, 0.8);
      ctx.beginPath();
      ctx.ellipse(r() * W, sandY + 30 + r() * 80, 6 + r() * 12, 4 + r() * 6, r(), 0, TAU);
      ctx.fill();
    }
    // corals
    for (let i = 0; i < 5; i++) {
      const x = (i + 0.5) * (W / 5) + (r() - 0.5) * 140;
      const hue = [350, 18, 300, 40, 330][i];
      coral(ctx, x, sandY + 20, 70 + r() * 70, hue, r);
    }
    // starfish
    for (let i = 0; i < 3; i++) starfish(ctx, r() * W, sandY + 50 + r() * 40, 20 + r() * 10, r() * TAU);
  },

  init(s) {
    const r = mulberry32(3);
    const weeds: Weed[] = [];
    const n = Math.round(s.W / 140);
    for (let i = 0; i < n; i++) weeds.push({ x: (i + r()) * (s.W / n), h: 140 + r() * 230, hue: 110 + r() * 50, phase: r() * TAU, width: 16 + r() * 12 });
    s.amb.weeds = weeds;
    s.amb.bubbleT = 0;
  },

  ambient(s, dt) {
    s.amb.bubbleT = (s.amb.bubbleT as number) - dt;
    if ((s.amb.bubbleT as number) <= 0) {
      s.amb.bubbleT = 0.15 + Math.random() * 0.4;
      const x = Math.random() < 0.5 ? s.W * 0.08 : Math.random() * s.W;
      s.particles.add({ kind: 'bubble', x, y: 1040, vy: -70 - Math.random() * 80, size: 5 + Math.random() * 10, max: 12, rot: Math.random() * 10 });
    }
  },

  renderBack(s, ctx) {
    for (const w of s.amb.weeds as Weed[]) {
      ctx.save();
      ctx.strokeStyle = hsl(w.hue, 0.55, 0.38);
      ctx.lineWidth = w.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const base = 1080 - 90;
      ctx.moveTo(w.x, base);
      const segs = 6;
      for (let i = 1; i <= segs; i++) {
        const t = i / segs;
        const sway = Math.sin(s.t * 1.2 + w.phase + t * 2.2) * 26 * t;
        ctx.lineTo(w.x + sway, base - w.h * t);
      }
      ctx.stroke();
      ctx.strokeStyle = hsl(w.hue, 0.6, 0.5, 0.6);
      ctx.lineWidth = w.width * 0.35;
      ctx.stroke();
      ctx.restore();
    }
  },

  behave(s, c, dt) {
    const speed = [55, 70, 85, 95, 105][c.genome.q < 0.3 ? 0 : c.genome.q < 0.5 ? 1 : c.genome.q < 0.7 ? 2 : c.genome.q < 0.88 ? 3 : 4];
    if (c.stateT > 3 + (c.id % 5) || Math.hypot(c.tx - c.x, c.ty - c.y) < 40) {
      s.newTarget(c);
      c.stateT = 0;
    }
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy) || 1;
    let ax = (dx / d) * speed - c.vx;
    let ay = (dy / d) * speed * 0.6 - c.vy;
    separate(s, c, (fx, fy) => {
      ax += fx;
      ay += fy;
    });
    // wobbly low tier fish swim a bit erratically
    if (c.genome.wobble > 0.4) ay += Math.sin(c.age * 7 + c.phase) * 60;
    c.vx += ax * dt * 1.2;
    c.vy += ay * dt * 1.2;
    c.x += c.vx * dt;
    c.y += c.vy * dt + Math.sin(c.age * 2 + c.phase) * 0.25;
    const B = s.bounds;
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    c.y = clamp(c.y, B.y0, B.y1);
    if (Math.abs(c.vx) > 8) c.facing = c.vx >= 0 ? 1 : -1;
    // somersault now and then for the funny ones, loops for the beautiful ones
    if (c.special <= 0 && Math.random() < dt * (c.genome.wobble > 0.4 ? 0.08 : c.genome.q > 0.85 ? 0.04 : 0)) c.special = 1.0001;
    if (c.special > 1) {
      c.special += dt * 1.4;
      c.rot = (c.special - 1) * TAU * c.facing;
      if (c.special >= 2) {
        c.special = 0;
        c.rot = 0;
      }
    } else {
      c.special = Math.max(0, c.special - dt);
      c.rot = lerp(c.rot, clamp(c.vy / 200, -0.4, 0.4) * c.facing, dt * 4);
    }
    if (Math.random() < dt * 0.25) {
      const sp = c.sprite;
      s.particles.add({ kind: 'bubble', x: c.x + c.facing * sp.radius * 0.9, y: c.y - 10, vy: -60, size: 4 + Math.random() * 4, max: 5 });
    }
  },
};

/** Soft separation between creatures. */
export function separate(s: HabitatScene, c: Creature, apply: (fx: number, fy: number) => void): void {
  for (const o of s.creatures) {
    if (o === c || o.leaving) continue;
    const dx = c.x - o.x;
    const dy = c.y - o.y;
    const d = Math.hypot(dx, dy);
    const min = (c.sprite.radius + o.sprite.radius) * 0.9;
    if (d > 0 && d < min) {
      const f = ((min - d) / min) * 140;
      apply((dx / d) * f, (dy / d) * f);
    }
  }
}

function coral(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, h: number, hue: number, r: () => number) {
  ctx.save();
  ctx.strokeStyle = hsl(hue, 0.7, 0.62);
  ctx.lineCap = 'round';
  const branch = (bx: number, by: number, len: number, ang: number, w: number, depth: number) => {
    const ex = bx + Math.cos(ang) * len;
    const ey = by + Math.sin(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth > 0) {
      branch(ex, ey, len * 0.72, ang - 0.45 - r() * 0.3, w * 0.72, depth - 1);
      branch(ex, ey, len * 0.72, ang + 0.45 + r() * 0.3, w * 0.72, depth - 1);
    } else {
      ctx.fillStyle = hsl(hue, 0.8, 0.75);
      ctx.beginPath();
      ctx.arc(ex, ey, w * 0.9, 0, TAU);
      ctx.fill();
    }
  };
  branch(x, y, h * 0.45, -Math.PI / 2, 16, 3);
  ctx.restore();
}

function starfish(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, x: number, y: number, r: number, rot: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, 0.55);
  ctx.fillStyle = '#ff8a5c';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

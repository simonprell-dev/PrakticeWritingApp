// "Weltraum": aliens floating between planets, twinkling stars and shooting stars.
import { alienSprite } from '../game/creatures/alien.ts';
import { clamp, hsl, lerp, TAU } from '../game/math.ts';
import { mulberry32 } from '../game/rng.ts';
import { separate } from './aquarium.ts';
import type { HabitatDef } from './habitat.ts';

interface Twinkle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}

interface Shooting {
  x: number;
  y: number;
  t: number;
}

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function planet(ctx: Ctx2, x: number, y: number, r: number, hue: number, ring: boolean, rand: () => number) {
  if (ring) {
    ctx.save();
    ctx.strokeStyle = hsl(hue + 40, 0.6, 0.75, 0.7);
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.3, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, hsl(hue, 0.7, 0.78));
  g.addColorStop(1, hsl(hue, 0.6, 0.38));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = hsl(hue, 0.5, 0.3, 0.25);
    ctx.beginPath();
    ctx.arc(x + (rand() - 0.5) * r * 1.4, y + (rand() - 0.5) * r * 1.4, r * (0.08 + rand() * 0.15), 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  if (ring) {
    ctx.save();
    ctx.strokeStyle = hsl(hue + 40, 0.6, 0.75, 0.8);
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.7, r * 0.45, -0.3, 0, Math.PI);
    ctx.stroke();
    ctx.restore();
  }
}

export const space: HabitatDef = {
  id: 'weltraum',
  archetype: 'alien',
  word: ['Alien', 'Aliens'],
  makeSprite: alienSprite,
  bounds: (W) => ({ x0: 120, x1: W - 120, y0: 170, y1: 930 }),

  paint(ctx, W, H) {
    const r = mulberry32(11);
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#0a0f35');
    sky.addColorStop(0.6, '#24124f');
    sky.addColorStop(1, '#3e1a63');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) {
      const x = r() * W;
      const y = r() * H;
      const rad = 250 + r() * 300;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, hsl([300, 200, 260, 330, 180][i], 0.8, 0.6, 0.18));
      g.addColorStop(1, hsl(260, 0.8, 0.5, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 450; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
      const s = r() < 0.92 ? 1 + r() * 1.5 : 2.5 + r() * 1.5;
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, s, 0, TAU);
      ctx.fill();
    }
    planet(ctx, W - 180, H - 120, 190, 25, true, r);
    planet(ctx, 170, 160, 70, 200, false, r);
    planet(ctx, W * 0.55, 90, 38, 320, false, r);
    planet(ctx, W * 0.28, H - 60, 55, 140, true, r);
  },

  init(s) {
    const r = mulberry32(5);
    const tw: Twinkle[] = [];
    for (let i = 0; i < 60; i++) tw.push({ x: r() * s.W, y: r() * 1080, r: 3 + r() * 6, phase: r() * TAU, speed: 1 + r() * 2 });
    s.amb.twinkles = tw;
    s.amb.shooting = null;
    s.amb.shootT = 4;
  },

  ambient(s, dt) {
    s.amb.shootT = (s.amb.shootT as number) - dt;
    if ((s.amb.shootT as number) <= 0) {
      s.amb.shootT = 5 + Math.random() * 7;
      s.amb.shooting = { x: Math.random() * s.W * 0.6, y: Math.random() * 300, t: 0 } satisfies Shooting;
    }
    const sh = s.amb.shooting as Shooting | null;
    if (sh) {
      sh.t += dt;
      if (sh.t > 1.2) s.amb.shooting = null;
    }
  },

  renderBack(s, ctx) {
    for (const t of s.amb.twinkles as Twinkle[]) {
      const a = 0.5 + 0.5 * Math.sin(s.t * t.speed + t.phase);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fffbe0';
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU;
        const rr = i % 2 ? t.r * 0.25 : t.r;
        ctx.lineTo(t.x + Math.cos(ang) * rr, t.y + Math.sin(ang) * rr);
      }
      ctx.fill();
      ctx.restore();
    }
    const sh = s.amb.shooting as Shooting | null;
    if (sh) {
      const x = sh.x + sh.t * 900;
      const y = sh.y + sh.t * 380;
      const g = ctx.createLinearGradient(x - 220, y - 92, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, `rgba(255,255,255,${1 - sh.t / 1.2})`);
      ctx.strokeStyle = g;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - 220, y - 92);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  },

  behave(s, c, dt) {
    const speed = lerp(40, 75, c.genome.q);
    if (c.stateT > 4 + (c.id % 4) || Math.hypot(c.tx - c.x, c.ty - c.y) < 30) {
      s.newTarget(c, 80);
      c.stateT = 0;
    }
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy) || 1;
    let ax = (dx / d) * speed - c.vx;
    let ay = (dy / d) * speed - c.vy;
    separate(s, c, (fx, fy) => {
      ax += fx;
      ay += fy;
    });
    c.vx += ax * dt * 0.8;
    c.vy += ay * dt * 0.8;
    // jet sputter for the crumpled ones
    if (c.genome.wobble > 0.4 && Math.random() < dt * 0.6) {
      c.vx += (Math.random() - 0.5) * 120;
      c.vy += (Math.random() - 0.5) * 120;
      s.particles.add({ kind: 'puff', x: c.x, y: c.y + c.sprite.radius, vy: 60, size: 12, max: 0.6, color: 'rgba(200,200,220,0.6)' });
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt + Math.sin(c.age * 1.6 + c.phase) * 0.4;
    const B = s.bounds;
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    c.y = clamp(c.y, B.y0, B.y1);
    if (Math.abs(c.vx) > 10) c.facing = c.vx >= 0 ? 1 : -1;
    c.rot = Math.sin(c.age * 1.3 + c.phase) * (c.genome.wobble > 0.4 ? 0.25 : 0.1);
  },
};

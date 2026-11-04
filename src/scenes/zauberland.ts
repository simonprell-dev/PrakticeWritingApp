// "Zauberland": a pastel fairy-tale meadow with a castle on a hill. Letters hatch as fable creatures
// (mostly unicorns), princesses or castle parts; see docs/superpowers/specs/2026-11-04-zauberland-design.md.
import { MEADOW_Y0, MEADOW_Y1, paintZauberland } from '../game/castle/meadow.ts';
import { fableSprite } from '../game/creatures/fable.ts';
import { clamp, hsl, lerp, TAU } from '../game/math.ts';
import { mulberry32 } from '../game/rng.ts';
import type { HabitatDef } from './habitat.ts';
import { tk } from '../i18n/i18n.ts';


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

export const zauberland: HabitatDef = {
  id: 'zauberland',
  archetype: 'fable',
  word: [tk('Wesen'), tk('Wesen')],
  count: [tk('{n} Wesen'), tk('{n} Wesen')],
  makeSprite: fableSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: MEADOW_Y0, y1: MEADOW_Y1 }),

  paint: paintZauberland,

  init(s) {
    const r = mulberry32(13);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 5; i++) clouds.push({ x: r() * s.W, y: 60 + r() * 260, s: 0.6 + r() * 0.6, v: 6 + r() * 10 });
    const flies: Fly[] = [];
    for (let i = 0; i < 4; i++) flies.push({ x: r() * s.W, y: 660 + r() * 260, phase: r() * TAU, hue: [300, 200, 50, 160][i], tx: r() * s.W, ty: 660 + r() * 260 });
    s.amb.clouds = clouds;
    s.amb.flies = flies;
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 220) c.x = -220;
    }
    for (const f of s.amb.flies as Fly[]) {
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 20) {
        f.tx = Math.random() * s.W;
        f.ty = 640 + Math.random() * 300;
      }
      f.x += (dx / (d || 1)) * 60 * dt;
      f.y += (dy / (d || 1)) * 60 * dt + Math.sin(s.t * 6 + f.phase) * 1.1;
    }
  },

  renderBack(s, ctx) {
    for (const c of s.amb.clouds as Cloud[]) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      for (const [ox, oy, rr] of [
        [0, 0, 46],
        [42, -22, 58],
        [92, 0, 44],
        [44, 14, 48],
      ]) {
        ctx.beginPath();
        ctx.arc(c.x + ox * c.s, c.y + oy * c.s, rr * c.s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // twinkling stars
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + 0.5 * Math.sin(s.t * 2 + i * 1.7);
      const x = ((i * 337) % 1000) / 1000 * s.W;
      const y = 40 + ((i * 211) % 100) * 2.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        const rr = k % 2 ? 2.5 : 9;
        ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      ctx.fill();
      ctx.restore();
    }
  },

  renderFront(s, ctx) {
    for (const f of s.amb.flies as Fly[]) {
      const flap = Math.abs(Math.sin(s.t * 14 + f.phase));
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = hsl(f.hue, 0.85, 0.72);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * 9 * flap, -4, 10 * flap + 2, 12, sx * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#4a3a5b';
      ctx.fillRect(-1.5, -10, 3, 16);
      ctx.restore();
    }
  },

  // the Zauberland scene moves everybody itself; this is only the fallback for a bare HabitatScene
  behave(s, c, dt) {
    const B = s.bounds;
    c.depth = lerp(0.72, 1.05, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    c.vx = lerp(c.vx, 0, dt * 5);
  },
};

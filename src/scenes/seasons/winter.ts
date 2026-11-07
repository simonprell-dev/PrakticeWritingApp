// "Winter": a bright snowy day with snow-capped firs, soft hills and a frozen lake. Snow falls, clouds drift
// and the ice glints now and then. Snowmen bob, penguins waddle and sometimes slide on their bellies.
import { winterSprite } from '../../game/creatures/seasons/winter.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { clamp, lerp, TAU } from '../../game/math.ts';
import { mulberry32 } from '../../game/rng.ts';
import { sfx } from '../../game/audio.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HORIZON = 540;
const GROUND0 = 610;
const GROUND1 = 930;

/** the frozen lake in the walking area */
const lake = (W: number) => ({ x: W * 0.6, y: 790, rx: Math.min(380, W * 0.2), ry: 78 });

function fir(ctx: Ctx2, x: number, y: number, s: number, dark: string, snow: string) {
  ctx.save();
  ctx.fillStyle = '#6b4a35';
  ctx.fillRect(x - 6 * s, y - 16 * s, 12 * s, 18 * s);
  for (let k = 0; k < 3; k++) {
    const by = y - 12 * s - k * 42 * s;
    const w = (70 - k * 17) * s;
    const h = 62 * s;
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x - w, by);
    ctx.quadraticCurveTo(x, by + 10 * s, x + w, by);
    ctx.lineTo(x, by - h);
    ctx.closePath();
    ctx.fill();
    // snow on the branches
    ctx.fillStyle = snow;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.55, by - h * 0.42);
    ctx.lineTo(x, by - h);
    ctx.lineTo(x + w * 0.55, by - h * 0.42);
    for (let i = 4; i >= 0; i--) ctx.quadraticCurveTo(x - w * 0.55 + (i + 0.5) * w * 0.22, by - h * 0.32, x - w * 0.55 + i * w * 0.22, by - h * 0.42);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function ridge(ctx: Ctx2, W: number, base: number, amp: number, f: number, ph: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 40);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * f + ph)) - amp * 0.3 * Math.sin(x * f * 2.7 + ph * 2));
  ctx.lineTo(W, base + 40);
  ctx.closePath();
  ctx.fill();
}

function drawLake(ctx: Ctx2, x: number, y: number, rx: number, ry: number) {
  ctx.save();
  ctx.fillStyle = '#dbe8f4';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, rx + 22, ry + 14, 0, 0, TAU);
  ctx.fill();
  const g = ctx.createLinearGradient(0, y - ry, 0, y + ry);
  g.addColorStop(0, '#bfe6f7');
  g.addColorStop(1, '#8cc8ea');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, rx * 0.012);
  for (const [ox, oy, l] of [
    [-0.5, -0.3, 0.35],
    [-0.1, 0.1, 0.5],
    [0.35, -0.15, 0.3],
    [0.2, 0.45, 0.25],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + ox * rx, y + oy * ry);
    ctx.lineTo(x + (ox + l) * rx, y + (oy - l * 0.25) * ry);
    ctx.stroke();
  }
  // a few cracks in the ice
  ctx.strokeStyle = 'rgba(90,150,200,0.35)';
  ctx.lineWidth = Math.max(1.5, rx * 0.005);
  ctx.beginPath();
  ctx.moveTo(x - rx * 0.2, y + ry * 0.3);
  ctx.lineTo(x - rx * 0.05, y + ry * 0.05);
  ctx.lineTo(x + rx * 0.1, y + ry * 0.15);
  ctx.moveTo(x - rx * 0.05, y + ry * 0.05);
  ctx.lineTo(x - rx * 0.02, y - ry * 0.25);
  ctx.stroke();
  ctx.restore();
}

function sky(ctx: Ctx2, W: number, horizon: number) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#a9d3f0');
  g.addColorStop(1, '#eef6fc');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, horizon + 60);
}

function cloud(ctx: Ctx2, x: number, y: number, s: number, a = 0.9) {
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

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Flake {
  x: number;
  y: number;
  r: number;
  v: number;
  ph: number;
}
interface Glint {
  x: number;
  y: number;
  t: number;
  s: number;
}

const kindOf = (c: Creature) => c.genome.variant % 4;

function startWalk(s: HabitatScene, c: Creature) {
  const B = s.bounds;
  c.state = kindOf(c) === 3 && Math.random() < 0.7 ? 'hop' : 'walk';
  c.stateT = 0;
  c.tx = clamp(c.x + (Math.random() - 0.5) * 700, B.x0, B.x1);
  c.ty = clamp(c.y + (Math.random() - 0.5) * 120, B.y0, B.y1);
}

export const winter: HabitatDef = {
  id: 'winter',
  archetype: 'season',
  word: [tk('Wintertier'), tk('Wintertiere')],
  count: [tk('{n} Wintertier'), tk('{n} Wintertiere')],
  makeSprite: winterSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: GROUND0, y1: GROUND1 }),

  paint(ctx, W, H) {
    const r = mulberry32(31);
    sky(ctx, W, HORIZON);
    // pale winter sun
    const sx = W - 300;
    const glow = ctx.createRadialGradient(sx, 140, 20, sx, 140, 240);
    glow.addColorStop(0, 'rgba(255,250,215,0.95)');
    glow.addColorStop(1, 'rgba(255,250,215,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - 240, 0, 480, 400);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(sx, 140, 62, 0, TAU);
    ctx.fill();
    // distant mountains and hills
    ridge(ctx, W, HORIZON - 40, 190, 0.0031, 1.3, '#c9dcef');
    ridge(ctx, W, HORIZON - 10, 110, 0.0047, 4.1, '#dde9f5');
    // far firs on the hills
    for (let i = 0; i < Math.round(W / 70); i++) {
      const x = r() * W;
      fir(ctx, x, HORIZON - 4 - r() * 20, 0.35 + r() * 0.2, 'rgba(70,110,120,0.55)', 'rgba(245,250,255,0.85)');
    }
    // snow field
    const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
    ground.addColorStop(0, '#f2f7fc');
    ground.addColorStop(1, '#dce9f5');
    ctx.fillStyle = ground;
    ctx.beginPath();
    ctx.moveTo(0, HORIZON + 10);
    for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, HORIZON + 8 - 14 * Math.sin(x * 0.006 + 0.7));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    // soft snow drifts (shadows)
    for (let i = 0; i < 9; i++) {
      const x = r() * W;
      const y = HORIZON + 60 + r() * (H - HORIZON - 60);
      const s = 0.6 + (y - HORIZON) / (H - HORIZON);
      ctx.fillStyle = 'rgba(170,200,230,0.22)';
      ctx.beginPath();
      ctx.ellipse(x, y + 10 * s, 140 * s, 18 * s, 0, 0, Math.PI);
      ctx.fill();
    }
    // firs on the near edge of the field
    const firs: [number, number, number][] = [];
    for (let i = 0; i < Math.max(3, Math.round(W / 300)); i++) firs.push([((i + 0.2 + r() * 0.6) / Math.max(3, Math.round(W / 300))) * W, HORIZON + 30 + r() * 30, 0.9 + r() * 0.5]);
    firs.sort((a, b) => a[1] - b[1]);
    for (const [x, y, s] of firs) {
      ctx.fillStyle = 'rgba(150,180,215,0.35)';
      ctx.beginPath();
      ctx.ellipse(x + 20 * s, y + 2, 70 * s, 12 * s, 0, 0, TAU);
      ctx.fill();
      fir(ctx, x, y, s, '#2f7a5f', '#fbfdff');
    }
    // the frozen lake
    const L = lake(W);
    drawLake(ctx, L.x, L.y, L.rx, L.ry);
    // little snow mounds and twigs
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = HORIZON + 80 + r() * (H - HORIZON - 80);
      if (Math.hypot((x - L.x) / (L.rx + 40), (y - L.y) / (L.ry + 30)) < 1) continue;
      const s = 0.5 + (y - HORIZON) / (H - HORIZON);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(x, y, 34 * s, 14 * s, 0, Math.PI, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(160,190,225,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 34 * s, 5 * s, 0, 0, Math.PI);
      ctx.fill();
      if (r() < 0.3) {
        ctx.strokeStyle = '#8a6a4f';
        ctx.lineWidth = 3 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + 10 * s, y - 8 * s);
        ctx.lineTo(x + 18 * s, y - 32 * s);
        ctx.moveTo(x + 15 * s, y - 22 * s);
        ctx.lineTo(x + 26 * s, y - 30 * s);
        ctx.stroke();
        ctx.fillStyle = '#e04a4a';
        ctx.beginPath();
        ctx.arc(x + 26 * s, y - 31 * s, 4 * s, 0, TAU);
        ctx.arc(x + 19 * s, y - 34 * s, 4 * s, 0, TAU);
        ctx.fill();
      }
    }
    // fine snow sparkle
    for (let i = 0; i < 220; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.5 + r() * 0.5})`;
      ctx.beginPath();
      ctx.arc(r() * W, HORIZON + 20 + r() * (H - HORIZON), 1 + r() * 1.6, 0, TAU);
      ctx.fill();
    }
  },

  init(s) {
    const r = mulberry32(17);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 4; i++) clouds.push({ x: r() * s.W, y: 70 + r() * 200, s: 0.7 + r() * 0.6, v: 6 + r() * 10 });
    const flakes: Flake[] = [];
    for (let i = 0; i < 110; i++) flakes.push({ x: r() * s.W, y: r() * 1080, r: 2 + r() * 4, v: 30 + r() * 50, ph: r() * TAU });
    s.amb.clouds = clouds;
    s.amb.flakes = flakes;
    s.amb.glints = [] as Glint[];
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 200) c.x = -200;
    }
    for (const f of s.amb.flakes as Flake[]) {
      f.y += f.v * dt;
      f.x += Math.sin(s.t * 0.8 + f.ph) * 18 * dt + 6 * dt;
      if (f.y > 1090) {
        f.y = -10;
        f.x = Math.random() * s.W;
      }
      if (f.x > s.W + 10) f.x = -10;
    }
    const glints = s.amb.glints as Glint[];
    for (const g of glints) g.t += dt;
    if (glints.length && glints[0].t > 1) glints.shift();
    if (Math.random() < dt * 0.9) {
      const L = lake(s.W);
      const a = Math.random() * TAU;
      const d = Math.sqrt(Math.random()) * 0.8;
      glints.push({ x: L.x + Math.cos(a) * L.rx * d, y: L.y + Math.sin(a) * L.ry * d, t: 0, s: 10 + Math.random() * 12 });
    }
  },

  renderBack(s, ctx) {
    ctx.save();
    for (const c of s.amb.clouds as Cloud[]) cloud(ctx, c.x, c.y, c.s);
    for (const g of s.amb.glints as Glint[]) {
      const k = Math.sin(clamp(g.t) * Math.PI);
      sparkleStar(ctx, g.x, g.y, g.s * k, 'rgba(255,255,255,0.95)');
    }
    ctx.restore();
  },

  renderFront(s, ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = 'rgba(140,175,215,0.45)';
    ctx.lineWidth = 1.2;
    for (const f of s.amb.flakes as Flake[]) {
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, TAU);
      ctx.fill();
      if (f.y > HORIZON) ctx.stroke();
    }
    ctx.restore();
  },

  behave(s, c, dt) {
    const B = s.bounds;
    const kind = kindOf(c);
    c.depth = lerp(0.72, 1.1, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    const speed = lerp(45, 80, c.genome.q) * (kind === 0 ? 0.7 : kind === 2 ? 0.85 : 1);
    if (c.state === 'idle') {
      c.vx = lerp(c.vx, 0, dt * 5);
      c.vy = lerp(c.vy, 0, dt * 5);
      c.lift = Math.max(0, c.lift - dt * 300);
      c.rot = lerp(c.rot, 0, Math.min(1, dt * 8));
      if (c.stateT > 1.5 + (c.id % 3)) {
        if (kind === 1 && Math.random() < 0.35) {
          // penguin: off on the belly
          c.state = 'slide';
          c.stateT = 0;
          if (Math.random() < 0.5) c.facing = c.facing === 1 ? -1 : 1;
          if (c.x < B.x0 + 300) c.facing = 1;
          if (c.x > B.x1 - 300) c.facing = -1;
          c.vx = c.facing * lerp(200, 260, c.genome.q);
          c.vy = (Math.random() - 0.5) * 30;
          sfx.whoosh();
        } else startWalk(s, c);
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
      const wob = c.genome.wobble > 0.4 ? 1.6 : 1;
      if (kind === 0) {
        // snowman: tiny bobs, a gentle sway
        c.rot = Math.sin(c.age * 6) * 0.04 * wob;
        c.lift = Math.abs(Math.sin(c.age * 6)) * 5;
      } else if (kind === 1) {
        // penguin waddle
        c.rot = Math.sin(c.age * 11) * 0.13 * wob;
        c.lift = Math.abs(Math.sin(c.age * 11)) * 3;
      } else if (kind === 3 && c.state === 'hop') {
        c.rot = 0;
        c.lift = Math.abs(Math.sin(c.stateT * 6)) * 34;
      } else {
        c.rot = Math.sin(c.age * 8) * 0.04 * wob;
        c.lift = Math.abs(Math.sin(c.age * 8)) * 4;
      }
      if (d < 15 || c.stateT > 8) {
        c.state = 'idle';
        c.stateT = 0;
      }
    } else if (c.state === 'slide') {
      const t = c.stateT;
      // tip forward onto the belly, glide, slow down, get up again
      const down = clamp(t / 0.3) * clamp((2.6 - t) / 0.35);
      c.rot = c.facing * 1.35 * down;
      c.lift = -c.sprite.radius * 0.35 * c.depth * down;
      const slow = t < 0.3 ? 0.2 : 1;
      c.vx = lerp(c.vx, 0, dt * 0.9 * slow);
      c.x += c.vx * dt;
      c.y = clamp(c.y + c.vy * dt, B.y0, B.y1);
      if (c.x < B.x0 || c.x > B.x1) c.vx *= 0.8;
      if (t > 0.3 && t < 2.2 && Math.random() < dt * 14)
        s.particles.add({ kind: 'puff', x: c.x - c.facing * c.sprite.radius * c.depth, y: c.y + c.sprite.radius * 0.3 * c.depth, vx: -c.facing * 20, vy: -20, size: 10 + Math.random() * 8, max: 0.5, color: 'rgba(255,255,255,0.9)' });
      if (t > 2.6) {
        c.state = 'idle';
        c.stateT = 0;
        c.lift = 0;
      }
    } else if (c.state === 'tumble') {
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

  tile(ctx, W, H, kit) {
    const hz = H * 0.5;
    sky(ctx, W, hz);
    ctx.fillStyle = '#fff6cf';
    ctx.beginPath();
    ctx.arc(W - 70, 58, 30, 0, TAU);
    ctx.fill();
    cloud(ctx, 60, 60, 0.45);
    ridge(ctx, W, hz - 5, 60, 0.012, 1.2, '#c9dcef');
    ridge(ctx, W, hz + 5, 34, 0.02, 3.9, '#dde9f5');
    const ground = ctx.createLinearGradient(0, hz, 0, H);
    ground.addColorStop(0, '#f2f7fc');
    ground.addColorStop(1, '#dce9f5');
    ctx.fillStyle = ground;
    ctx.fillRect(0, hz + 8, W, H - hz - 8);
    fir(ctx, 40, hz + 24, 0.55, '#2f7a5f', '#fbfdff');
    fir(ctx, 440, hz + 18, 0.45, '#2f7a5f', '#fbfdff');
    drawLake(ctx, W * 0.55, H * 0.86, 150, 30);
    kit.draw(ctx, winterSprite(kit.genome(68, 3, 1), kit.sticker('b')), 105, 258, 0.62, 1);
    kit.draw(ctx, winterSprite(kit.genome(96, 5, 0), kit.sticker('A')), 270, 228, 0.78, 1);
    kit.draw(ctx, winterSprite(kit.genome(80, 9, 2), kit.sticker('m')), 400, 300, 0.48, -1);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc((i * 131) % W, (i * 71) % H, 1.5 + (i % 3), 0, TAU);
      ctx.fill();
    }
  },
};

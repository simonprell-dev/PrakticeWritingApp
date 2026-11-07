// "Neujahr": a town at night by the river. Rockets hatch, fly up and bloom in a ring of sparks, then glow
// quietly in the sky; lucky pigs and four-leaf clovers stroll on the promenade. Far away, small soft
// fireworks go off now and then, and the stars twinkle.
import { isRocket, neujahrKind, neujahrSprite, nozzleOf } from '../../game/creatures/seasons/neujahr.ts';
import { makeCanvas, type Ctx } from '../../game/canvas.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { sfx } from '../../game/audio.ts';
import { clamp, hsl, lerp, TAU } from '../../game/math.ts';
import { mulberry32, type Rand } from '../../game/rng.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

/** where the houses stand (and the river begins) */
const SHORE = 690;
/** the quay edge; the promenade lies below */
const QUAY = 800;
/** rockets float between these heights */
const SKY0 = 260;
const SKY1 = 540;
/** lucky charms walk between these heights */
const WALK0 = 870;
const WALK1 = 985;

interface Star {
  x: number;
  y: number;
  ph: number;
  sp: number;
  r: number;
}
interface Firework {
  x: number;
  y: number;
  t: number;
  hue: number;
  hue2: number;
  r: number;
  n: number;
}
interface Ripple {
  x: number;
  y: number;
  w: number;
  ph: number;
  hue: number;
}

// ---------------------------------------------------------------- the painted town

function windows(ctx: Ctx, r: Rand, x: number, y: number, w: number, h: number, lit: number, warm: boolean) {
  const cols = Math.max(1, Math.floor(w / 26));
  const rows = Math.max(1, Math.floor(h / 34));
  const gx = w / cols;
  const gy = h / rows;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const on = r() < lit;
      ctx.fillStyle = on ? (warm ? (r() < 0.25 ? '#ffe9a8' : '#ffc95a') : 'rgba(170,170,230,0.45)') : 'rgba(10,14,40,0.55)';
      ctx.fillRect(x + i * gx + gx * 0.28, y + j * gy + gy * 0.25, gx * 0.44, gy * 0.45);
    }
}

/** one row of buildings standing on y = base; near rows are darker and have warm windows */
function skyline(ctx: Ctx, W: number, base: number, r: Rand, near: boolean) {
  const body = near ? '#151b42' : '#28316a';
  let x = -40 - r() * 60;
  let i = 0;
  while (x < W + 40) {
    const w = near ? 90 + r() * 110 : 70 + r() * 120;
    const h = near ? 90 + r() * 150 : 150 + r() * 130;
    const kind = r();
    ctx.fillStyle = body;
    const top = base - h;
    if (near && i % 7 === 3) {
      // church with a tall spire
      const tw = 70;
      ctx.fillRect(x, top + 40, w, h - 40);
      ctx.fillRect(x + w / 2 - tw / 2, base - h - 90, tw, h + 90);
      ctx.beginPath();
      ctx.moveTo(x + w / 2 - tw / 2 - 6, base - h - 90);
      ctx.lineTo(x + w / 2, base - h - 200);
      ctx.lineTo(x + w / 2 + tw / 2 + 6, base - h - 90);
      ctx.fill();
      windows(ctx, r, x + 6, top + 60, w - 12, h - 70, 0.4, true);
      // round lit window in the tower
      ctx.fillStyle = '#ffd77a';
      ctx.beginPath();
      ctx.arc(x + w / 2, base - h - 50, 14, 0, TAU);
      ctx.fill();
    } else if (near && kind < 0.55) {
      // gabled house
      ctx.fillRect(x, top, w, h);
      ctx.beginPath();
      ctx.moveTo(x - 8, top + 2);
      ctx.lineTo(x + w / 2, top - w * 0.42);
      ctx.lineTo(x + w + 8, top + 2);
      ctx.fill();
      if (r() < 0.5) ctx.fillRect(x + w * 0.7, top - w * 0.32, 14, 34);
      windows(ctx, r, x + 6, top + 14, w - 12, h - 30, 0.5, true);
    } else if (!near && kind < 0.18) {
      // far tower with a dome
      const tw = 46 + r() * 20;
      ctx.fillRect(x, top + 60, w, h - 60);
      ctx.fillRect(x + w / 2 - tw / 2, top - 30, tw, h + 30);
      ctx.beginPath();
      ctx.arc(x + w / 2, top - 30, tw / 2, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x + w / 2 - 2, top - 30 - tw / 2 - 26, 4, 28);
      windows(ctx, r, x + 4, top + 70, w - 8, h - 80, 0.25, false);
    } else {
      ctx.fillRect(x, top, w, h);
      if (r() < 0.5) ctx.fillRect(x + w * 0.2, top - 16, w * 0.6, 18);
      windows(ctx, r, x + 6, top + 12, w - 12, h - 24, near ? 0.45 : 0.3, near);
    }
    x += w + (near ? r() * 10 : -10 + r() * 20);
    i++;
  }
}

/** the clock tower that is about to strike midnight */
function clockTower(ctx: Ctx, x: number, base: number) {
  const w = 96;
  const h = 330;
  ctx.fillStyle = '#121838';
  ctx.fillRect(x - w / 2, base - h, w, h);
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 10, base - h);
  ctx.lineTo(x, base - h - 90);
  ctx.lineTo(x + w / 2 + 10, base - h);
  ctx.fill();
  const cy = base - h + 60;
  const glow = ctx.createRadialGradient(x, cy, 10, x, cy, 90);
  glow.addColorStop(0, 'rgba(255,230,160,0.35)');
  glow.addColorStop(1, 'rgba(255,230,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 90, cy - 90, 180, 180);
  ctx.fillStyle = '#fff1c4';
  ctx.beginPath();
  ctx.arc(x, cy, 34, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#3b3560';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#3b3560';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 27, cy + Math.sin(a) * 27, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, cy);
  ctx.lineTo(x - 3, cy - 20);
  ctx.moveTo(x, cy);
  ctx.lineTo(x - 6, cy - 27);
  ctx.stroke();
  ctx.fillStyle = '#ffc95a';
  for (let j = 0; j < 4; j++) ctx.fillRect(x - 10, base - h + 130 + j * 48, 20, 26);
}

function lamp(ctx: Ctx, x: number, y: number) {
  const glow = ctx.createRadialGradient(x, y - 150, 6, x, y - 150, 110);
  glow.addColorStop(0, 'rgba(255,220,140,0.55)');
  glow.addColorStop(1, 'rgba(255,220,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 110, y - 260, 220, 220);
  ctx.fillStyle = '#0f1430';
  ctx.fillRect(x - 4, y - 140, 8, 140);
  ctx.fillRect(x - 12, y - 6, 24, 8);
  ctx.fillStyle = '#ffe3a0';
  ctx.beginPath();
  ctx.roundRect(x - 13, y - 168, 26, 30, 6);
  ctx.fill();
  ctx.fillStyle = '#0f1430';
  ctx.beginPath();
  ctx.moveTo(x - 17, y - 166);
  ctx.lineTo(x, y - 182);
  ctx.lineTo(x + 17, y - 166);
  ctx.fill();
}

function skyGradient(ctx: Ctx, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0a1238');
  sky.addColorStop(0.6, '#1f2a6b');
  sky.addColorStop(1, '#3d3a86');
  return sky;
}

function paintTown(ctx: Ctx, W: number, H: number) {
  const r = mulberry32(2027);
  const sky = skyGradient(ctx, SHORE);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, SHORE + 2);
  // stars
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    const y = r() * (SHORE - 200);
    ctx.fillStyle = `rgba(255,255,240,${0.25 + r() * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + r() * 1.6, 0, TAU);
    ctx.fill();
  }
  // crescent moon
  const mx = Math.min(260, W * 0.14);
  ctx.fillStyle = 'rgba(255,240,190,0.18)';
  ctx.beginPath();
  ctx.arc(mx, 140, 80, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff2c4';
  ctx.beginPath();
  ctx.arc(mx, 140, 48, 0, TAU);
  ctx.fill();
  ctx.fillStyle = sky;
  ctx.beginPath();
  ctx.arc(mx + 22, 126, 44, 0, TAU);
  ctx.fill();

  // the town, painted once more upside down into the river
  const { canvas: town, ctx: tc } = makeCanvas(W, SHORE);
  skyline(tc, W, SHORE, r, false);
  clockTower(tc, Math.round(W * 0.62), SHORE);
  skyline(tc, W, SHORE, r, true);
  ctx.drawImage(town as CanvasImageSource, 0, 0);

  const water = ctx.createLinearGradient(0, SHORE, 0, QUAY);
  water.addColorStop(0, '#26306e');
  water.addColorStop(1, '#141a45');
  ctx.fillStyle = water;
  ctx.fillRect(0, SHORE, W, QUAY - SHORE);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, SHORE, W, QUAY - SHORE);
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.translate(0, SHORE * 2);
  ctx.scale(1, -1);
  ctx.drawImage(town as CanvasImageSource, 0, 0);
  ctx.restore();
  // ripples break the reflection up
  for (let y = SHORE + 6; y < QUAY; y += 7 + r() * 6)
    for (let x = -50; x < W; x += 80 + r() * 160) {
      ctx.fillStyle = r() < 0.5 ? 'rgba(20,26,70,0.55)' : 'rgba(120,130,220,0.12)';
      ctx.fillRect(x, y, 60 + r() * 140, 2 + r() * 2);
    }

  // the quay and the promenade
  ctx.fillStyle = '#3a3f78';
  ctx.fillRect(0, QUAY - 4, W, 14);
  const ground = ctx.createLinearGradient(0, QUAY + 10, 0, H);
  ground.addColorStop(0, '#2c3064');
  ground.addColorStop(1, '#1b1e44');
  ctx.fillStyle = ground;
  ctx.fillRect(0, QUAY + 10, W, H - QUAY - 10);
  // railing
  ctx.fillStyle = '#10142f';
  ctx.fillRect(0, QUAY - 34, W, 6);
  for (let x = 10; x < W; x += 46) ctx.fillRect(x, QUAY - 34, 5, 32);
  // cobbles
  for (let i = 0; i < 700; i++) {
    const y = QUAY + 16 + r() * (H - QUAY - 16);
    const s = 0.5 + (y - QUAY) / (H - QUAY);
    ctx.fillStyle = `rgba(140,150,230,${0.04 + r() * 0.05})`;
    ctx.beginPath();
    ctx.ellipse(r() * W, y, 14 * s, 5 * s, 0, 0, TAU);
    ctx.fill();
  }
  // lamps with warm pools of light
  for (let x = 160 + r() * 120; x < W; x += 420 + r() * 80) {
    const pool = ctx.createRadialGradient(x, 870, 10, x, 870, 220);
    pool.addColorStop(0, 'rgba(255,210,130,0.22)');
    pool.addColorStop(1, 'rgba(255,210,130,0)');
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.ellipse(x, 870, 220, 70, 0, 0, TAU);
    ctx.fill();
    lamp(ctx, x, QUAY + 14);
  }
  // a garland of little lights over the promenade
  for (let x = 0; x < W; x += 34) {
    const y = QUAY + 30 + Math.abs(Math.sin((x / 420) * Math.PI)) * 22;
    ctx.fillStyle = hsl((x * 0.9) % 360, 0.8, 0.7, 0.85);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, TAU);
    ctx.fill();
  }
}

// ---------------------------------------------------------------- fireworks

/** a firework burst: dots fly out on a ring and sink a little while they fade */
function drawBurst(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, n: number, p: number, hue: number, hue2: number, alpha: number, dot: number) {
  const k = 1 - Math.pow(1 - p, 3);
  const a = (1 - p) * alpha;
  if (a <= 0) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU;
    const d = r * k;
    const px = x + Math.cos(ang) * d;
    const py = y + Math.sin(ang) * d + p * p * r * 0.35;
    ctx.globalAlpha = a;
    ctx.fillStyle = hsl(i % 2 ? hue : hue2, 0.9, 0.72);
    ctx.beginPath();
    ctx.arc(px, py, dot * (1 - p * 0.5), 0, TAU);
    ctx.fill();
    // a short soft trail towards the centre
    ctx.globalAlpha = a * 0.35;
    ctx.beginPath();
    ctx.arc(x + Math.cos(ang) * d * 0.8, y + Math.sin(ang) * d * 0.8 + p * p * r * 0.3, dot * 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

const FW_RISE = 0.9;
const FW_BURST = 1.9;

function drawFirework(ctx: CanvasRenderingContext2D, f: Firework) {
  if (f.t < FW_RISE) {
    const p = f.t / FW_RISE;
    ctx.save();
    ctx.globalAlpha = 0.45 * (1 - p * 0.3);
    ctx.fillStyle = hsl(f.hue, 0.6, 0.85);
    ctx.beginPath();
    ctx.arc(f.x, f.y + (1 - p) * 180, 2.2, 0, TAU);
    ctx.fill();
    ctx.restore();
    return;
  }
  const p = clamp((f.t - FW_RISE) / FW_BURST);
  drawBurst(ctx, f.x, f.y, f.r, f.n, p, f.hue, f.hue2, 0.6, 3);
  // its soft glow on the water
  const a = (1 - p) * 0.14;
  const gx = ctx.createRadialGradient(f.x, SHORE + 50, 4, f.x, SHORE + 50, f.r * 1.4);
  gx.addColorStop(0, hsl(f.hue, 0.9, 0.7, a));
  gx.addColorStop(1, hsl(f.hue, 0.9, 0.7, 0));
  ctx.fillStyle = gx;
  ctx.fillRect(f.x - f.r * 1.4, SHORE, f.r * 2.8, QUAY - SHORE);
}

/** a rocket's own bloom, kept in the ambient list so it can be drawn behind everything */
interface Bloom {
  x: number;
  y: number;
  t: number;
  r: number;
  n: number;
  hue: number;
  hue2: number;
  rainbow: boolean;
}
const BLOOM_T = 1.6;

function bloom(s: HabitatScene, c: Creature, big: boolean) {
  const g = c.genome;
  const q = g.q;
  const y = c.y - c.lift - c.sprite.radius * c.depth * 0.4;
  const list = s.amb.blooms as Bloom[];
  list.push({
    x: c.x,
    y,
    t: 0,
    r: (big ? 150 + q * 130 : 70 + q * 40) * c.depth,
    n: big ? Math.round(16 + q * 20) : 10,
    hue: g.hue,
    hue2: g.hue2,
    rainbow: g.rainbow,
  });
  if (big && q > 0.55) list.push({ x: c.x, y, t: -0.25, r: (90 + q * 70) * c.depth, n: 12, hue: g.hue2, hue2: g.hue + 40, rainbow: g.rainbow, });
  const colors = g.rainbow ? ['#ff6f91', '#ffd84a', '#8dff6b', '#7cdcff', '#c49bff'] : [hsl(g.hue, g.sat + 0.2, 0.75), hsl(g.hue2, g.sat + 0.2, 0.75), '#fff6c8'];
  s.particles.burst('spark', c.x, y, big ? Math.round(8 + q * 14) : 5, { colors, size: 12 + q * 6, speed: big ? 220 + q * 160 : 120, max: 1.2, gravity: 60 });
  if (big) s.particles.add({ kind: 'ring', x: c.x, y, size: 120 + q * 100, max: 0.6, color: 'rgba(255,250,220,0.6)' });
  c.special = 1;
}

// ---------------------------------------------------------------- behaviour

function rocketBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  c.depth = 0.85;
  c.special = Math.max(0, c.special - dt * 0.8);
  const nozzle = () => {
    const off = nozzleOf(c.sprite) * c.depth;
    return { x: c.x - Math.sin(c.rot) * off, y: c.y - c.lift + Math.cos(c.rot) * off };
  };
  if (c.state === 'idle') {
    // just hatched: fizz a moment, then off into the sky
    c.lift = 0;
    c.rot = Math.sin(c.age * 30) * 0.03;
    if (Math.random() < dt * 12) {
      const n = nozzle();
      s.particles.add({ kind: 'spark', x: n.x + (Math.random() - 0.5) * 10, y: n.y, vy: 40, vx: (Math.random() - 0.5) * 60, size: 7, max: 0.4, color: '#ffe08a' });
    }
    if (c.stateT > 0.7) {
      c.state = 'launch';
      c.stateT = 0;
      c.vy = 0;
      c.ty = clamp(Math.min(c.y - 160, lerp(SKY0, SKY1 - 60, Math.random())), Math.max(B.y0, SKY0), SKY1);
      c.tx = clamp(c.x + (Math.random() - 0.5) * 160, B.x0, B.x1);
    }
  } else if (c.state === 'launch' || c.state === 'rise') {
    const launch = c.state === 'launch';
    const top = launch ? 560 + g.q * 160 : 220;
    c.vy = lerp(c.vy, -top, dt * 3);
    c.vx = lerp(c.vx, (c.tx - c.x) * 1.2, dt * 2);
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.lift = lerp(c.lift, 0, dt * 5);
    // a wobbly rocket zigzags on its way up
    c.rot = clamp(c.vx / 900, -0.25, 0.25) + (g.wobble > 0.4 ? Math.sin(c.stateT * 9) * 0.12 : 0);
    if (Math.random() < dt * (launch ? 40 : 16)) {
      const n = nozzle();
      s.particles.add({ kind: 'spark', x: n.x + (Math.random() - 0.5) * 8, y: n.y, vx: (Math.random() - 0.5) * 50, vy: 60 + Math.random() * 60, size: 6 + Math.random() * 6, max: 0.5, color: Math.random() < 0.5 ? '#ffe08a' : '#ffb14a', gravity: 120 });
    }
    if (c.y <= c.ty || c.stateT > 4) {
      bloom(s, c, launch);
      if (launch) sfx.sparkle();
      c.state = 'float';
      c.stateT = 0;
      c.vy = 0;
      c.tx = clamp(c.x + (Math.random() - 0.5) * 300, B.x0, B.x1);
      c.ty = c.y;
    }
  } else if (c.state === 'loop') {
    // a happy loop in the air (wobbly rockets love it)
    const t = c.stateT / 1.8;
    c.rot = t * TAU * c.facing;
    c.lift = Math.sin(t * Math.PI) * 50;
    if (t >= 1) {
      c.state = 'float';
      c.stateT = 0;
      c.rot = 0;
    }
  } else {
    // 'float': glow quietly, drift a little, bob up and down
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    c.vx = lerp(c.vx, clamp(dx * 0.6, -30, 30), dt * 1.5);
    c.vy = lerp(c.vy, clamp(dy * 0.6, -20, 20), dt * 1.5);
    // keep a little distance from the other rockets
    for (const o of s.creatures) {
      if (o === c || o.leaving || o.state !== 'float' || !isRocket(o.genome)) continue;
      const ox = c.x - o.x;
      const oy = c.y - o.y;
      const d = Math.hypot(ox, oy);
      if (d > 0.01 && d < 190) {
        c.x += (ox / d) * (190 - d) * dt * 0.8;
        c.y += (oy / d) * (190 - d) * dt * 0.4;
      }
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (Math.abs(c.vx) > 8) c.facing = c.vx >= 0 ? 1 : -1;
    c.y = clamp(c.y, SKY0 - 30, SKY1 + 60);
    c.lift = Math.sin(c.age * 1.4 + c.phase) * 10;
    c.rot = lerp(c.rot, Math.sin(c.age * 0.9 + c.phase) * 0.07 + c.vx / 600, dt * 3);
    if (c.stateT > 5 + (c.id % 4) * 1.5) {
      c.stateT = 0;
      const roll = Math.random();
      if (roll < 0.3 && c.y > SKY0 + 80) {
        c.state = 'rise';
        c.vy = 0;
        c.ty = Math.max(SKY0, c.y - 90 - Math.random() * 90);
        c.tx = clamp(c.x + (Math.random() - 0.5) * 120, B.x0, B.x1);
      } else if (roll < 0.45 && g.wobble > 0.4) {
        c.state = 'loop';
      } else {
        c.tx = clamp(c.x + (Math.random() - 0.5) * 500, B.x0, B.x1);
        c.ty = lerp(SKY0, SKY1, Math.random());
      }
    }
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, B.y0, B.y1);
}

function walkerBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  const clover = neujahrKind(g) === 3;
  if (c.state === 'idle' && c.y < WALK0 && c.stateT < 0.1) {
    // hatched up in the air: float down to the promenade
    c.state = 'drop';
    c.ty = lerp(WALK0, WALK1, Math.random());
    c.vy = 0;
  }
  c.depth = lerp(0.8, 1.02, clamp((c.y - WALK0) / (WALK1 - WALK0)));
  const speed = lerp(45, 80, g.q);
  if (c.state === 'drop') {
    c.vy = Math.min(c.vy + 700 * dt, 520);
    c.y += c.vy * dt;
    c.rot = Math.sin(c.stateT * 7) * 0.15;
    if (c.y >= c.ty) {
      c.y = c.ty;
      c.state = 'hop';
      c.stateT = 0;
      c.rot = 0;
      c.tx = c.x;
      s.particles.burst('puff', c.x, c.y + c.sprite.radius * 0.6, 6, { color: 'rgba(200,205,255,0.35)', size: 18, speed: 90, max: 0.5 });
      sfx.plopp(0.6);
    }
  } else if (c.state === 'idle') {
    c.vx = lerp(c.vx, 0, dt * 5);
    c.lift = Math.max(0, c.lift - dt * 300);
    c.rot = lerp(c.rot, 0, dt * 6);
    if (c.stateT > 1.5 + (c.id % 3)) {
      c.state = Math.random() < (clover ? 0.5 : 0.2) && g.q > 0.5 ? 'hop' : 'walk';
      c.stateT = 0;
      c.tx = clamp(c.x + (Math.random() - 0.5) * 700, B.x0, B.x1);
      c.ty = clamp(c.y + (Math.random() - 0.5) * 100, WALK0, WALK1);
    }
    if (g.wobble > 0.4 && Math.random() < dt * 0.15) {
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
    c.rot = Math.sin(c.age * 10) * (g.wobble > 0.4 ? 0.09 : 0.04);
    c.lift = c.state === 'hop' ? Math.abs(Math.sin(c.stateT * 6)) * 36 : Math.abs(Math.sin(c.age * 10)) * 4;
    if (d < 15 || c.stateT > 8) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'tumble') {
    const t = c.stateT;
    c.rot = t < 0.3 ? (t / 0.3) * 1.3 * c.facing : t < 1.4 ? 1.3 * c.facing + Math.sin(t * 20) * 0.05 : Math.max(0, 1.3 * (1 - (t - 1.4) / 0.4)) * c.facing;
    c.lift = 0;
    if (t > 1.8) {
      c.state = 'idle';
      c.stateT = 0;
      c.rot = 0;
    }
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, c.state === 'drop' ? B.y0 : WALK0, B.y1);
}

// ---------------------------------------------------------------- the world

export const neujahr: HabitatDef = {
  id: 'neujahr',
  archetype: 'season',
  word: [tk('Glücksfigur'), tk('Glücksfiguren')],
  count: [tk('{n} Glücksfigur'), tk('{n} Glücksfiguren')],
  makeSprite: neujahrSprite,
  sortY: true,
  speechColor: '#fff6d6',
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: 230, y1: WALK1 }),

  paint(ctx, W, H) {
    paintTown(ctx, W, H);
  },

  init(s) {
    const r = mulberry32(31);
    const stars: Star[] = [];
    for (let i = 0; i < 46; i++) stars.push({ x: r() * s.W, y: 20 + r() * 330, ph: r() * TAU, sp: 0.6 + r() * 1.4, r: 4 + r() * 5 });
    const ripples: Ripple[] = [];
    for (let i = 0; i < 26; i++) ripples.push({ x: r() * s.W, y: SHORE + 12 + r() * (QUAY - SHORE - 30), w: 40 + r() * 90, ph: r() * TAU, hue: r() < 0.6 ? 42 : 230 });
    s.amb.stars = stars;
    s.amb.ripples = ripples;
    s.amb.fireworks = [] as Firework[];
    s.amb.blooms = [] as Bloom[];
    s.amb.nextFw = 1.5;
  },

  ambient(s, dt) {
    const fws = s.amb.fireworks as Firework[];
    s.amb.nextFw = (s.amb.nextFw as number) - dt;
    if ((s.amb.nextFw as number) <= 0) {
      s.amb.nextFw = 2.5 + Math.random() * 4;
      const hue = Math.random() * 360;
      fws.push({ x: 80 + Math.random() * (s.W - 160), y: 90 + Math.random() * 230, t: 0, hue, hue2: hue + 40 + Math.random() * 80, r: 40 + Math.random() * 45, n: 14 + Math.floor(Math.random() * 8) });
    }
    for (const f of fws) f.t += dt;
    s.amb.fireworks = fws.filter((f) => f.t < FW_RISE + FW_BURST);
    const bl = s.amb.blooms as Bloom[];
    for (const b of bl) b.t += dt;
    s.amb.blooms = bl.filter((b) => b.t < BLOOM_T);
  },

  renderBack(s, ctx) {
    for (const st of s.amb.stars as Star[]) {
      const tw = Math.pow(Math.max(0, Math.sin(s.t * st.sp + st.ph)), 3);
      if (tw < 0.05) continue;
      ctx.save();
      ctx.globalAlpha = tw * 0.85;
      sparkleStar(ctx, st.x, st.y, st.r * (0.6 + 0.4 * tw), '#fff8d8');
      ctx.restore();
    }
    for (const f of s.amb.fireworks as Firework[]) drawFirework(ctx, f);
    for (const rp of s.amb.ripples as Ripple[]) {
      const a = 0.12 + 0.12 * Math.sin(s.t * 1.3 + rp.ph);
      ctx.fillStyle = rp.hue === 42 ? `rgba(255,214,120,${a})` : `rgba(170,180,255,${a})`;
      ctx.fillRect(rp.x + Math.sin(s.t * 0.7 + rp.ph) * 12, rp.y, rp.w, 2);
    }
    // a soft glow behind every rocket in the sky, brighter right after it bloomed
    for (const c of s.creatures) {
      if (!isRocket(c.genome)) continue;
      const x = c.x;
      const y = c.y - c.lift;
      const R = c.sprite.radius * c.depth * (2.4 + c.special * 1.2) * Math.min(1, c.spawn * 2);
      const a = 0.18 + c.genome.q * 0.12 + c.special * 0.3;
      const gl = ctx.createRadialGradient(x, y, R * 0.1, x, y, R);
      gl.addColorStop(0, hsl(c.genome.hue, 0.9, 0.75, a));
      gl.addColorStop(1, hsl(c.genome.hue, 0.9, 0.75, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(x - R, y - R, R * 2, R * 2);
      if (c.state === 'launch' || c.state === 'rise' || c.state === 'idle') {
        // the flame under the rocket
        const off = nozzleOf(c.sprite) * c.depth;
        const fx = x - Math.sin(c.rot) * off;
        const fy = y + Math.cos(c.rot) * off;
        const len = (c.state === 'idle' ? 18 : 46) * (1 + Math.sin(s.t * 40 + c.id) * 0.15);
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(c.rot);
        for (const [w, l, col] of [
          [16, len, 'rgba(255,170,70,0.85)'],
          [8, len * 0.6, 'rgba(255,240,170,0.95)'],
        ] as const) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(-w / 2, 0);
          ctx.quadraticCurveTo(0, l * 1.4, w / 2, 0);
          ctx.fill();
        }
        ctx.restore();
      }
    }
    for (const b of s.amb.blooms as Bloom[]) {
      if (b.t < 0) continue;
      const p = b.t / BLOOM_T;
      if (b.rainbow) {
        for (let i = 0; i < 3; i++) drawBurst(ctx, b.x, b.y, b.r * (1 - i * 0.12), Math.round(b.n / 3), p, i * 120 + b.hue, i * 120 + 60, 0.9, 5);
      } else drawBurst(ctx, b.x, b.y, b.r, b.n, p, b.hue, b.hue2, 0.9, 5);
    }
  },

  behave(s, c, dt) {
    if (isRocket(c.genome)) rocketBehave(s, c, dt);
    else walkerBehave(s, c, dt);
  },

  tile(ctx, W, H, kit) {
    const r = mulberry32(5);
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
    sky.addColorStop(0, '#0a1238');
    sky.addColorStop(1, '#3d3a86');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,240,${0.3 + r() * 0.6})`;
      ctx.beginPath();
      ctx.arc(r() * W, r() * 180, 0.8 + r() * 1.4, 0, TAU);
      ctx.fill();
    }
    // houses
    const base = 238;
    let x = -10;
    while (x < W) {
      const w = 40 + r() * 50;
      const h = 40 + r() * 70;
      ctx.fillStyle = '#151b42';
      ctx.fillRect(x, base - h, w, h);
      if (r() < 0.5) {
        ctx.beginPath();
        ctx.moveTo(x - 3, base - h + 1);
        ctx.lineTo(x + w / 2, base - h - w * 0.4);
        ctx.lineTo(x + w + 3, base - h + 1);
        ctx.fill();
      }
      for (let i = 0; i < 4; i++) {
        if (r() < 0.5) continue;
        ctx.fillStyle = '#ffc95a';
        ctx.fillRect(x + 6 + r() * (w - 16), base - h + 8 + r() * (h - 20), 6, 8);
      }
      x += w + 2;
    }
    const water = ctx.createLinearGradient(0, base, 0, 280);
    water.addColorStop(0, '#26306e');
    water.addColorStop(1, '#141a45');
    ctx.fillStyle = water;
    ctx.fillRect(0, base, W, 280 - base);
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = 'rgba(255,214,120,0.25)';
      ctx.fillRect(r() * W, base + 6 + r() * 30, 20 + r() * 40, 2);
    }
    const ground = ctx.createLinearGradient(0, 280, 0, H);
    ground.addColorStop(0, '#2c3064');
    ground.addColorStop(1, '#1b1e44');
    ctx.fillStyle = ground;
    ctx.fillRect(0, 280, W, H - 280);
    ctx.fillStyle = '#3a3f78';
    ctx.fillRect(0, 278, W, 6);
    // two soft bursts
    drawBurst(ctx, 110, 80, 60, 18, 0.45, 330, 50, 1.4, 3.5);
    drawBurst(ctx, 395, 60, 46, 14, 0.4, 190, 120, 1.4, 3);
    // a glowing rocket in the sky, a lucky pig and a clover on the promenade
    const rg = kit.genome(95, 3, 0);
    const rocket = neujahrSprite(rg, kit.sticker('A'));
    const glow = ctx.createRadialGradient(250, 120, 6, 250, 120, 110);
    glow.addColorStop(0, hsl(rg.hue, 0.9, 0.75, 0.4));
    glow.addColorStop(1, hsl(rg.hue, 0.9, 0.75, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(140, 10, 220, 220);
    kit.draw(ctx, rocket, 250, 130, 0.42);
    kit.draw(ctx, neujahrSprite(kit.genome(75, 8, 1), kit.sticker('b')), 105, 300, 0.42);
    kit.draw(ctx, neujahrSprite(kit.genome(80, 11, 3), kit.sticker('e')), 390, 296, 0.52, -1);
  },
};

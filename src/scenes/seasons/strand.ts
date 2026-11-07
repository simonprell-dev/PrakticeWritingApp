// "Strand & Sonne": a summer beach by day. The sea reaches to the horizon, waves run up the sand and draw
// back, a sailing boat drifts far out, clouds pass and the water glitters. Crabs scuttle sideways, turtles
// stroll to the water and back, gulls fly in wide curves and land on the sand now and then, and sandcastles
// grow out of the sand and stay where they are.
import { footOf, isCastle, isGull, strandKind, strandSprite } from '../../game/creatures/seasons/strand.ts';
import { makePath, type Ctx } from '../../game/canvas.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { sfx } from '../../game/audio.ts';
import { clamp, ease, lerp, TAU } from '../../game/math.ts';
import { mulberry32 } from '../../game/rng.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

/** where the sky meets the sea */
const HORIZON = 430;
/** the calm waterline painted into the background */
const SHORE = 655;
/** the closest a turtle walks to the water */
const WATER_Y = 712;
/** creatures on the sand walk between these heights */
const WALK0 = 745;
const WALK1 = 995;
/** gulls fly between these heights */
const SKY0 = 190;
const SKY1 = 560;
/** one wave comes and goes in this many seconds */
const WAVE_T = 7;

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Crest {
  x: number;
  ph: number;
  sp: number;
}
interface Glint {
  x: number;
  y: number;
  ph: number;
  sp: number;
  r: number;
}
interface Boat {
  x: number;
  v: number;
}

// ---------------------------------------------------------------- painted bits

function cloud(ctx: Ctx, x: number, y: number, s: number, a = 0.95): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (const [ox, oy, rr] of [
    [0, 0, 42],
    [40, -22, 54],
    [88, -6, 46],
    [122, 8, 34],
    [48, 14, 44],
  ]) {
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function sailboat(ctx: Ctx, x: number, y: number, s: number, rock: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rock);
  ctx.scale(s, s);
  // hull
  ctx.fillStyle = '#c0533d';
  ctx.beginPath();
  ctx.moveTo(-34, -6);
  ctx.lineTo(34, -6);
  ctx.lineTo(24, 6);
  ctx.lineTo(-26, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff6e6';
  ctx.fillRect(-30, -6, 60, 3);
  // mast and sails
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(-1.5, -62, 3, 56);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(2, -60);
  ctx.quadraticCurveTo(28, -34, 26, -10);
  ctx.lineTo(2, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd25a';
  ctx.beginPath();
  ctx.moveTo(-3, -54);
  ctx.quadraticCurveTo(-20, -30, -24, -10);
  ctx.lineTo(-3, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff6f6f';
  ctx.beginPath();
  ctx.moveTo(1.5, -62);
  ctx.lineTo(14, -66);
  ctx.lineTo(1.5, -70);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function umbrella(ctx: Ctx, x: number, y: number, s: number, c1: string, c2: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // shadow on the sand
  ctx.fillStyle = 'rgba(150,100,40,0.18)';
  ctx.beginPath();
  ctx.ellipse(-20, 4, 110, 22, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.rotate(-0.12);
  ctx.fillStyle = '#f6f1e6';
  ctx.fillRect(-4, -200, 8, 204);
  // the canopy: a dome in coloured panels with a scalloped edge
  const R = 130;
  const top = -200;
  const rim = top + 22;
  const n = 6;
  const dome = makePath();
  dome.moveTo(-R, rim);
  dome.bezierCurveTo(-R * 0.95, top - 50, R * 0.95, top - 50, R, rim);
  for (let i = n - 1; i >= 0; i--) {
    const xa = -R + ((i + 1) / n) * 2 * R;
    const xb = -R + (i / n) * 2 * R;
    dome.quadraticCurveTo((xa + xb) / 2, rim - 14, xb, rim);
  }
  dome.closePath();
  ctx.save();
  ctx.clip(dome);
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? c1 : c2;
    ctx.beginPath();
    const a0 = Math.PI + (i / n) * Math.PI;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI;
    ctx.moveTo(0, rim + 40);
    ctx.lineTo(Math.cos(a0) * R * 2, rim + 40 + Math.sin(a0) * R * 2);
    ctx.lineTo(Math.cos(a1) * R * 2, rim + 40 + Math.sin(a1) * R * 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-R * 0.35, top - 18, R * 0.3, 10, -0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 3;
  ctx.stroke(dome);
  ctx.fillStyle = '#f6f1e6';
  ctx.beginPath();
  ctx.arc(0, top - 36, 7, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function towel(ctx: Ctx, x: number, y: number, w: number, h: number, ang: number, cols: string[]): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = 'rgba(150,100,40,0.15)';
  ctx.beginPath();
  ctx.roundRect(-w / 2 + 4, -h / 2 + 5, w, h, 8);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 8);
  ctx.clip();
  const n = cols.length * 2;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-w / 2 + (i / n) * w, -h / 2, w / n + 1, h);
  }
  ctx.restore();
  // fringes
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 2;
  for (const sx of [-1, 1])
    for (let k = 0; k < 6; k++) {
      const yy = -h / 2 + ((k + 0.5) / 6) * h;
      ctx.beginPath();
      ctx.moveTo((sx * w) / 2, yy);
      ctx.lineTo((sx * w) / 2 + sx * 8, yy);
      ctx.stroke();
    }
  ctx.restore();
}

function shell(ctx: Ctx, x: number, y: number, s: number, rot: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(140,80,60,0.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-s * 0.25, s * 0.7);
  ctx.lineTo(s * 0.25, s * 0.7);
  ctx.arc(0, 0, s, Math.PI * 0.1, Math.PI * 0.9, true);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  for (const a of [-0.6, -0.2, 0.2, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.6);
    ctx.lineTo(Math.sin(a) * s * 0.95, -Math.cos(a) * s * 0.95);
    ctx.stroke();
  }
  ctx.restore();
}

function starfish(ctx: Ctx, x: number, y: number, s: number, rot: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, 0.6);
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(150,60,40,0.55)';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? s * 0.42 : s;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU - Math.PI / 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5, s * 0.07, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function bucket(ctx: Ctx, x: number, y: number, s: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(150,100,40,0.18)';
  ctx.beginPath();
  ctx.ellipse(6, 2, 34, 9, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-24, -48);
  ctx.lineTo(24, -48);
  ctx.lineTo(18, 0);
  ctx.lineTo(-18, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(-23, -48, 46, 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, -48, 22, Math.PI, 0);
  ctx.stroke();
  // the little spade
  ctx.fillStyle = '#ffd84a';
  ctx.save();
  ctx.translate(36, -6);
  ctx.rotate(0.5);
  ctx.fillRect(-3, -40, 6, 30);
  ctx.beginPath();
  ctx.ellipse(0, -6, 11, 15, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** the calm waterline (a gentle curve) */
const shoreAt = (x: number) => SHORE + Math.sin(x * 0.004 + 0.6) * 7 + Math.sin(x * 0.011 + 2.1) * 3;

function sunPos(W: number): { x: number; y: number } {
  return { x: W - Math.min(300, W * 0.16), y: 150 };
}

function paintBeach(ctx: Ctx, W: number, H: number): void {
  const r = mulberry32(2026);
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#4fb0ee');
  sky.addColorStop(0.7, '#9fd8f8');
  sky.addColorStop(1, '#d6f1fc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON + 2);
  // the sun
  const sun = sunPos(W);
  const glow = ctx.createRadialGradient(sun.x, sun.y, 40, sun.x, sun.y, 260);
  glow.addColorStop(0, 'rgba(255,250,200,0.75)');
  glow.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sun.x - 260, sun.y - 260, 520, 520);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,224,90,0.55)';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.beginPath();
    ctx.moveTo(sun.x + Math.cos(a) * 92, sun.y + Math.sin(a) * 92);
    ctx.lineTo(sun.x + Math.cos(a) * 118, sun.y + Math.sin(a) * 118);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#ffe14d';
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, 72, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#fff3a6';
  ctx.beginPath();
  ctx.arc(sun.x - 18, sun.y - 20, 40, 0, TAU);
  ctx.fill();

  // a hazy island far away on the left
  ctx.fillStyle = '#9cc7d6';
  ctx.beginPath();
  ctx.moveTo(-20, HORIZON + 1);
  ctx.quadraticCurveTo(W * 0.06, HORIZON - 70, W * 0.13, HORIZON - 40);
  ctx.quadraticCurveTo(W * 0.18, HORIZON - 58, W * 0.24, HORIZON + 1);
  ctx.closePath();
  ctx.fill();
  // a lighthouse on it
  const lx = W * 0.12;
  ctx.fillStyle = '#f4f7fa';
  ctx.fillRect(lx - 6, HORIZON - 92, 12, 52);
  ctx.fillStyle = '#e5675b';
  ctx.fillRect(lx - 6, HORIZON - 80, 12, 9);
  ctx.fillRect(lx - 6, HORIZON - 60, 12, 9);
  ctx.beginPath();
  ctx.moveTo(lx - 9, HORIZON - 92);
  ctx.lineTo(lx, HORIZON - 104);
  ctx.lineTo(lx + 9, HORIZON - 92);
  ctx.fill();

  // the sea
  const sea = ctx.createLinearGradient(0, HORIZON, 0, SHORE + 12);
  sea.addColorStop(0, '#2c86c9');
  sea.addColorStop(0.55, '#38a9d6');
  sea.addColorStop(1, '#7fdcd8');
  ctx.fillStyle = sea;
  ctx.fillRect(0, HORIZON, W, SHORE + 30 - HORIZON);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(0, HORIZON, W, 2);
  // the sun's path on the water
  for (let y = HORIZON + 6; y < SHORE - 20; y += 8 + r() * 6) {
    const k = (y - HORIZON) / (SHORE - HORIZON);
    const w = 30 + k * 220;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = `rgba(255,250,210,${0.35 - k * 0.2})`;
      ctx.fillRect(sun.x - w / 2 + (r() - 0.5) * w, y, 12 + r() * 40 * (0.5 + k), 2 + k * 2);
    }
  }
  // gentle swell lines, longer when nearer
  for (let y = HORIZON + 10; y < SHORE - 10; y += 10 + ((y - HORIZON) / (SHORE - HORIZON)) * 22) {
    const k = (y - HORIZON) / (SHORE - HORIZON);
    for (let x = -60 + r() * 80; x < W; x += 90 + k * 260 + r() * 120) {
      ctx.strokeStyle = r() < 0.6 ? `rgba(255,255,255,${0.12 + k * 0.18})` : `rgba(20,90,150,${0.12 + k * 0.08})`;
      ctx.lineWidth = 1.5 + k * 2;
      ctx.beginPath();
      const w = 30 + k * 120 + r() * 40;
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + w / 2, y - 3 - k * 4, x + w, y);
      ctx.stroke();
    }
  }

  // the sand, with a darker wet stripe along the water
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, shoreAt(0));
  for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, shoreAt(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  const sand = ctx.createLinearGradient(0, SHORE - 10, 0, H);
  sand.addColorStop(0, '#d8b77f');
  sand.addColorStop(0.12, '#ecd09a');
  sand.addColorStop(0.3, '#f7e2b0');
  sand.addColorStop(1, '#efcf92');
  ctx.fillStyle = sand;
  ctx.fill();
  // grains and little ripples in the sand
  for (let i = 0; i < Math.round(W * 0.9); i++) {
    const y = SHORE + 20 + r() * (H - SHORE - 20);
    const s = 0.6 + (y - SHORE) / (H - SHORE);
    ctx.fillStyle = r() < 0.5 ? `rgba(170,120,60,${0.12 + r() * 0.12})` : `rgba(255,252,235,${0.3 + r() * 0.3})`;
    ctx.beginPath();
    ctx.arc(r() * W, y, (0.8 + r() * 1.4) * s, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(190,140,70,0.18)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = 0; i < Math.round(W / 60); i++) {
    const x = r() * W;
    const y = SHORE + 120 + r() * (H - SHORE - 140);
    const w = 40 + r() * 70;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 7, x + w, y);
    ctx.stroke();
  }

  // umbrellas and beach things up the beach (in the back strip and at the far ends)
  const cols: [string, string][] = [
    ['#ff6b6b', '#fff4e0'],
    ['#4fb3ff', '#ffe14d'],
    ['#7bd36a', '#ffffff'],
    ['#ff9f43', '#5f9dff'],
    ['#c58cff', '#fff4e0'],
  ];
  const nU = Math.max(2, Math.round(W / 640));
  for (let i = 0; i < nU; i++) {
    const x = ((i + 0.25 + r() * 0.5) / nU) * W;
    const [c1, c2] = cols[i % cols.length];
    umbrella(ctx, x, WATER_Y + 18 + r() * 8, 0.62 + r() * 0.08, c1, c2);
  }
  umbrella(ctx, 40, H - 70, 1.15, '#ff6b6b', '#fff4e0');
  umbrella(ctx, W - 30, H - 130, 1.05, '#4fb3ff', '#ffe14d');
  // towels flat on the sand
  const tcols = [
    ['#ff7aa2', '#fff1f5'],
    ['#46b8e8', '#ffffff', '#ffd84a'],
    ['#8bd86a', '#fff8d8'],
    ['#ffb347', '#ff6f6f'],
  ];
  const nT = Math.max(2, Math.round(W / 520));
  for (let i = 0; i < nT; i++) {
    const x = ((i + 0.2 + r() * 0.6) / nT) * W;
    towel(ctx, x, WALK0 + 50 + r() * (H - WALK0 - 80), 150 + r() * 40, 78 + r() * 14, (r() - 0.5) * 0.5, tcols[i % tcols.length]);
  }
  bucket(ctx, W * 0.5 + 260, WATER_Y + 40, 0.8, '#ff6b6b');
  // shells and starfish
  const shellCols = ['#fff1de', '#ffd2dc', '#ffe3b8', '#f7f2ff'];
  for (let i = 0; i < Math.round(W / 70); i++) {
    const x = r() * W;
    const y = SHORE + 30 + r() * (H - SHORE - 50);
    const s = 0.7 + (y - SHORE) / (H - SHORE) * 0.6;
    if (r() < 0.25) starfish(ctx, x, y, 16 * s, r() * TAU, r() < 0.5 ? '#ff8a65' : '#ffb24a');
    else shell(ctx, x, y, 9 * s, (r() - 0.5) * 1.2, shellCols[Math.floor(r() * shellCols.length)]);
  }
}

// ---------------------------------------------------------------- behaviour

const groundDepth = (y: number) => lerp(0.74, 1.0, clamp((y - WALK0) / (WALK1 - WALK0)));

/** a puff of sand */
function sandPuff(s: HabitatScene, x: number, y: number, n: number): void {
  s.particles.burst('puff', x, y, n, { color: 'rgba(235,205,150,0.6)', size: 16, speed: 90, max: 0.6 });
}

/** a creature that hatched up in the air drops down onto the sand */
function dropIn(s: HabitatScene, c: Creature, dt: number): boolean {
  if (c.state === 'idle' && c.stateT < 0.1 && c.y < WATER_Y) {
    c.state = 'drop';
    c.ty = lerp(WALK0, WALK1, Math.random());
    c.vy = 0;
  }
  if (c.state !== 'drop') return false;
  c.vy = Math.min(c.vy + 700 * dt, 520);
  c.y += c.vy * dt;
  c.depth = lerp(c.depth, groundDepth(c.ty), dt * 4);
  c.rot = Math.sin(c.stateT * 7) * 0.15;
  if (c.y >= c.ty) {
    c.y = c.ty;
    c.state = 'idle';
    c.stateT = 0;
    c.rot = 0;
    c.special = 0.5;
    sandPuff(s, c.x, c.y + footOf(c.sprite) * c.depth, 6);
    sfx.plopp(0.6);
  }
  return true;
}

function crabBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  if (!dropIn(s, c, dt)) {
    c.depth = groundDepth(c.y);
    if (c.state === 'idle') {
      // a short rest, then off sideways again
      c.vx = lerp(c.vx, 0, dt * 8);
      c.lift = Math.max(0, c.lift - dt * 60);
      c.rot = lerp(c.rot, 0, dt * 8);
      if (c.stateT > (c.special || 1)) {
        c.state = 'scuttle';
        c.stateT = 0;
        let dir = Math.random() < 0.5 ? -1 : 1;
        if (c.x < B.x0 + 200) dir = 1;
        if (c.x > B.x1 - 200) dir = -1;
        c.tx = clamp(c.x + dir * (90 + Math.random() * 220), B.x0, B.x1);
        c.ty = clamp(c.y + (Math.random() - 0.5) * 70, WALK0, WALK1);
      }
      if (g.wobble > 0.4 && Math.random() < dt * 0.12) {
        c.state = 'tumble';
        c.stateT = 0;
        sfx.boing();
      }
    } else if (c.state === 'scuttle') {
      const speed = lerp(110, 170, g.q);
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      c.vx = lerp(c.vx, (dx / (d || 1)) * speed, dt * 8);
      c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.4, dt * 8);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
      // quick little steps
      c.rot = Math.sin(c.age * 24) * (g.wobble > 0.4 ? 0.1 : 0.05);
      c.lift = Math.abs(Math.sin(c.age * 24)) * 4;
      if (d < 10 || c.stateT > 3) {
        c.state = 'idle';
        c.stateT = 0;
        c.special = 0.4 + Math.random() * 1.4;
      }
    } else if (c.state === 'tumble') {
      // falls on its back, kicks, rolls back
      const t = c.stateT;
      c.rot = t < 0.3 ? (t / 0.3) * Math.PI * c.facing : t < 1.3 ? Math.PI * c.facing + Math.sin(t * 25) * 0.08 : Math.max(0, Math.PI * (1 - (t - 1.3) / 0.4)) * c.facing;
      c.lift = t < 1.7 ? Math.sin(Math.min(1, t / 0.3) * Math.PI) * 20 : 0;
      if (t > 1.7) {
        c.state = 'idle';
        c.stateT = 0;
        c.rot = 0;
        c.lift = 0;
        c.special = 1;
      }
    } else {
      c.state = 'idle';
      c.stateT = 0;
    }
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, c.state === 'drop' ? B.y0 : WALK0, B.y1);
}

function turtleBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  if (!dropIn(s, c, dt)) {
    c.depth = groundDepth(c.y);
    if (c.state === 'idle') {
      c.vx = lerp(c.vx, 0, dt * 4);
      c.vy = lerp(c.vy, 0, dt * 4);
      c.lift = 0;
      c.rot = lerp(c.rot, 0, dt * 3);
      if (c.stateT > 2 + (c.id % 3)) {
        // take turns: down to the water, then back up the beach
        c.state = 'walk';
        c.stateT = 0;
        const toWater = c.y > WALK0 + 60 || (c.special !== 1 && Math.random() < 0.6);
        c.special = toWater ? 1 : 0;
        c.ty = toWater ? WATER_Y + Math.random() * 20 : lerp(WALK0 + 90, WALK1, Math.random());
        c.tx = clamp(c.x + (Math.random() - 0.5) * 360, B.x0, B.x1);
      }
    } else if (c.state === 'walk') {
      const speed = lerp(20, 34, g.q);
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      c.vx = lerp(c.vx, (dx / (d || 1)) * speed, dt * 2);
      c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.7, dt * 2);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.vx) > 3) c.facing = c.vx >= 0 ? 1 : -1;
      // slow, comfortable rocking
      c.rot = Math.sin(c.age * 3.2) * (g.wobble > 0.4 ? 0.06 : 0.03);
      c.lift = Math.abs(Math.sin(c.age * 3.2)) * 2.5;
      if (d < 8 || c.stateT > 14) {
        c.state = 'idle';
        c.stateT = 0;
        if (c.special === 1) {
          // a little splash: it has reached the water
          s.particles.burst('puff', c.x + c.facing * c.sprite.radius * c.depth * 0.6, c.y + footOf(c.sprite) * c.depth, 5, { color: 'rgba(190,240,255,0.7)', size: 14, speed: 70, max: 0.6 });
          sfx.blub();
        }
      }
    } else {
      c.state = 'idle';
      c.stateT = 0;
    }
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, c.state === 'drop' ? B.y0 : WATER_Y, B.y1);
}

function castleBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  const foot = footOf(c.sprite);
  if (c.state === 'idle' && c.stateT < 0.1) {
    // the castle grows out of the sand where the letter came down (or below it, on the beach)
    if (c.y < WALK0) c.y = lerp(WALK0, WALK1, Math.random());
    c.state = 'grow';
    c.stateT = 0;
    c.special = groundDepth(c.y);
  }
  const base = groundDepth(c.y);
  if (c.state === 'grow') {
    const k = lerp(0.15, 1, ease.outCubic(clamp(c.stateT / 1.2)));
    c.depth = base * k;
    // keep the bottom on the sand while it grows
    c.lift = -foot * base * (1 - k);
    c.rot = Math.sin(c.stateT * 30) * 0.05 * (1 - k);
    if (Math.random() < dt * 14) sandPuff(s, c.x + (Math.random() - 0.5) * c.sprite.radius * base * 1.6, c.y + foot * base, 1);
    if (c.stateT >= 1.2) {
      c.state = 'stand';
      c.stateT = 0;
      c.depth = base;
      c.lift = 0;
      c.rot = 0;
      sandPuff(s, c.x, c.y + foot * base, 5);
      sfx.plopp(0.8);
    }
  } else if (c.state === 'wiggle') {
    const t = c.stateT / 0.9;
    c.depth = base;
    c.lift = 0;
    c.rot = Math.sin(c.stateT * 24) * 0.07 * (1 - t);
    if (t >= 1) {
      c.state = 'stand';
      c.stateT = 0;
      c.rot = 0;
    }
  } else {
    // stands still and now and then gives a happy little wiggle (crooked castles more often, and they crumble a bit)
    c.state = 'stand';
    c.depth = base;
    c.lift = 0;
    c.rot = lerp(c.rot, 0, dt * 6);
    c.vx = 0;
    c.vy = 0;
    if (c.stateT > 3 && Math.random() < dt * (g.wobble > 0.4 ? 0.25 : 0.1)) {
      c.state = 'wiggle';
      c.stateT = 0;
      if (g.wobble > 0.4) sandPuff(s, c.x, c.y + foot * base * 0.6, 3);
    }
  }
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, WALK0, B.y1);
}

/** a gull's flying direction (radians) */
const HEADING = new WeakMap<Creature, number>();

function skyTarget(B: { x0: number; x1: number }, c: Creature): { x: number; y: number } {
  return { x: clamp(c.x + (Math.random() - 0.5) * 1100, B.x0 + 120, B.x1 - 120), y: lerp(SKY0 + 20, SKY1, Math.random()) };
}

function gullBehave(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const g = c.genome;
  if (c.state === 'idle' && c.stateT < 0.1) {
    if (c.y > WATER_Y) {
      c.state = 'sit';
      c.y = clamp(c.y, WALK0, WALK1);
    } else {
      c.state = 'fly';
      const t = skyTarget(B, c);
      c.tx = t.x;
      c.ty = t.y;
      HEADING.set(c, Math.random() < 0.5 ? -0.4 : Math.PI + 0.4);
    }
    c.stateT = 0;
    c.depth = c.state === 'sit' ? groundDepth(c.y) : 0.82;
  }
  let head = HEADING.get(c) ?? 0;
  if (c.state === 'fly' || c.state === 'descend') {
    const landing = c.state === 'descend';
    const speed = lerp(150, 210, g.q) * (landing ? 0.85 : 1);
    const want = Math.atan2(c.ty - c.y, c.tx - c.x);
    let diff = want - head;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    // turning only so fast makes the wide curves
    const turn = landing ? 2.2 : 1.0;
    head += clamp(diff, -turn * dt, turn * dt);
    c.vx = Math.cos(head) * speed;
    c.vy = Math.sin(head) * speed * 0.75;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    if (Math.abs(c.vx) > 10) c.facing = c.vx >= 0 ? 1 : -1;
    c.rot = lerp(c.rot, clamp(c.vy / speed, -1, 1) * 0.35 * c.facing, dt * 4);
    c.lift = landing ? 0 : Math.sin(c.age * 1.6 + c.phase) * 8;
    c.depth = lerp(c.depth, landing ? groundDepth(c.ty) : 0.82, dt * 1.5);
    const d = Math.hypot(c.tx - c.x, c.ty - c.y);
    if (landing) {
      if (d < 24 || c.stateT > 9) {
        c.state = 'sit';
        c.stateT = 0;
        c.vx = 0;
        c.vy = 0;
        c.rot = 0;
        sandPuff(s, c.x, c.y + footOf(c.sprite) * c.depth, 5);
      }
    } else if (d < 90 || c.stateT > 12) {
      if (c.stateT > 9 && Math.random() < 0.3) {
        // time for a short rest on the sand
        c.state = 'descend';
        c.tx = clamp(c.x + (Math.random() - 0.5) * 500, B.x0 + 60, B.x1 - 60);
        c.ty = lerp(WALK0 + 10, WALK1, Math.random());
      } else {
        const t = skyTarget(B, c);
        c.tx = t.x;
        c.ty = t.y;
      }
      c.stateT = c.state === 'descend' ? 0 : c.stateT;
    }
    // stay clear of the edges by turning back early
    if (c.x < B.x0 + 30 || c.x > B.x1 - 30) {
      c.tx = clamp(c.tx, B.x0 + 200, B.x1 - 200);
    }
  } else if (c.state === 'sit') {
    c.depth = lerp(c.depth, groundDepth(c.y), dt * 4);
    c.vx = 0;
    c.vy = 0;
    c.rot = lerp(c.rot, 0, dt * 6);
    // a few little hops while it looks around
    const hop = Math.sin(c.stateT * 5);
    c.lift = c.stateT % 2.4 < 0.63 ? Math.max(0, hop) * 14 : 0;
    if (c.stateT % 2.4 > 2.35 && Math.random() < 0.5) c.facing = c.facing === 1 ? -1 : 1;
    if (c.stateT > 2.5 + (c.id % 3) * 0.8) {
      c.state = 'fly';
      c.stateT = 0;
      const t = skyTarget(B, c);
      c.tx = t.x;
      c.ty = t.y;
      head = -Math.PI / 2 + (c.tx > c.x ? 0.7 : -0.7);
      sandPuff(s, c.x, c.y + footOf(c.sprite) * c.depth, 4);
    }
  } else {
    c.state = 'fly';
    c.stateT = 0;
  }
  HEADING.set(c, head);
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, B.y0, B.y1);
}

// ---------------------------------------------------------------- the world

/** how far the wave has run up the sand, 0..1 */
function runUp(t: number): number {
  const p = (t / WAVE_T) % 1;
  return p < 0.4 ? ease.outCubic(p / 0.4) : 1 - ease.inOutCubic((p - 0.4) / 0.6);
}

function waveEdge(x: number, t: number, up: number): number {
  const n = Math.floor(t / WAVE_T);
  return shoreAt(x) - 8 + up * (40 + 12 * Math.sin(x * 0.005 + n * 1.7) + 6 * Math.sin(x * 0.013 + n * 0.9 + 1.3));
}

export const strand: HabitatDef = {
  id: 'strand',
  archetype: 'season',
  word: [tk('Strandfreund'), tk('Strandfreunde')],
  count: [tk('{n} Strandfreund'), tk('{n} Strandfreunde')],
  makeSprite: strandSprite,
  sortY: true,
  speechColor: '#fffbe6',
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: SKY0 - 20, y1: WALK1 }),

  paint(ctx, W, H) {
    paintBeach(ctx, W, H);
  },

  init(s) {
    const r = mulberry32(77);
    const clouds: Cloud[] = [];
    const nC = Math.max(4, Math.round(s.W / 380));
    for (let i = 0; i < nC; i++) clouds.push({ x: ((i + r() * 0.8) / nC) * (s.W + 300) - 200, y: 50 + r() * 200, s: 0.6 + r() * 0.6, v: 6 + r() * 10 });
    const crests: Crest[] = [];
    for (let i = 0; i < 26; i++) crests.push({ x: r() * s.W, ph: r(), sp: 0.05 + r() * 0.05 });
    const glints: Glint[] = [];
    const sun = sunPos(s.W);
    for (let i = 0; i < 50; i++) {
      const y = HORIZON + 8 + r() * (SHORE - HORIZON - 30);
      const k = (y - HORIZON) / (SHORE - HORIZON);
      // most glitter sits in the sun's path
      const x = r() < 0.6 ? sun.x + (r() - 0.5) * (60 + k * 300) : r() * s.W;
      glints.push({ x, y, ph: r() * TAU, sp: 1.2 + r() * 2, r: 5 + k * 7 });
    }
    s.amb.clouds = clouds;
    s.amb.crests = crests;
    s.amb.glints = glints;
    s.amb.boat = { x: s.W * 0.35, v: 7 } as Boat;
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 80) c.x = -260;
    }
    const b = s.amb.boat as Boat;
    b.x += b.v * dt;
    if (b.x > s.W + 80) b.x = -80;
  },

  renderBack(s, ctx) {
    const t = s.t;
    for (const c of s.amb.clouds as Cloud[]) cloud(ctx, c.x, c.y, c.s, 0.9);
    const b = s.amb.boat as Boat;
    sailboat(ctx, b.x, HORIZON + 6 + Math.sin(t * 1.3) * 1.5, 0.75, Math.sin(t * 0.9) * 0.04);
    // wave crests rolling towards the beach
    ctx.save();
    ctx.lineCap = 'round';
    for (const cr of s.amb.crests as Crest[]) {
      const p = (cr.ph + t * cr.sp) % 1;
      const y = lerp(HORIZON + 20, SHORE - 18, Math.pow(p, 1.4));
      const k = (y - HORIZON) / (SHORE - HORIZON);
      const w = 30 + k * 150;
      ctx.strokeStyle = `rgba(255,255,255,${Math.sin(p * Math.PI) * (0.35 + k * 0.3)})`;
      ctx.lineWidth = 2 + k * 3;
      ctx.beginPath();
      ctx.moveTo(cr.x - w / 2, y + 2);
      ctx.quadraticCurveTo(cr.x, y - 4 - k * 4, cr.x + w / 2, y + 2);
      ctx.stroke();
    }
    ctx.restore();
    // glitter on the water
    for (const gl of s.amb.glints as Glint[]) {
      const tw = Math.pow(Math.max(0, Math.sin(t * gl.sp + gl.ph)), 4);
      if (tw < 0.05) continue;
      ctx.save();
      ctx.globalAlpha = tw * 0.9;
      sparkleStar(ctx, gl.x, gl.y, gl.r * (0.5 + 0.5 * tw), '#ffffff');
      ctx.restore();
    }
    // the wave running up the sand and drawing back
    const up = runUp(t);
    const p = (t / WAVE_T) % 1;
    const W = s.W;
    const top = SHORE - 30;
    // where the last wave reached: wet, darker sand that slowly dries
    ctx.beginPath();
    ctx.moveTo(0, top);
    for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, waveEdge(x, t, 1) + 3);
    ctx.lineTo(W + 30, top);
    ctx.closePath();
    ctx.fillStyle = `rgba(160,120,70,${p > 0.4 ? 0.16 * (1 - (p - 0.4) / 0.6) : 0.16 * up})`;
    ctx.fill();
    // the water itself
    const wpath = () => {
      ctx.beginPath();
      ctx.moveTo(0, top);
      for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, waveEdge(x, t, up));
      ctx.lineTo(W + 30, top);
      ctx.closePath();
    };
    wpath();
    const wg = ctx.createLinearGradient(0, top, 0, SHORE + 50);
    wg.addColorStop(0, 'rgba(127,220,216,0.95)');
    wg.addColorStop(1, 'rgba(160,235,230,0.55)');
    ctx.fillStyle = wg;
    ctx.fill();
    // the foam along its edge
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, waveEdge(x, t, up));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W + 30; x += 30) ctx.lineTo(x, waveEdge(x, t, up) - 10 - 4 * Math.sin(x * 0.02 + t));
    ctx.stroke();
    ctx.restore();

    // soft shadows under everybody on the sand, and a grown castle's little sand heap
    for (const c of s.creatures) {
      const onSand = !isGull(c.genome) || c.state === 'sit';
      const R = c.sprite.radius * c.depth * Math.min(1, c.spawn * 2);
      if (onSand && c.state !== 'drop') {
        const footY = c.y + footOf(c.sprite) * (isCastle(c.genome) ? groundDepth(c.y) : c.depth);
        ctx.fillStyle = 'rgba(150,100,40,0.2)';
        ctx.beginPath();
        ctx.ellipse(c.x, footY + 2, R * (isCastle(c.genome) ? 1.15 : 0.95), R * 0.22, 0, 0, TAU);
        ctx.fill();
        if (isCastle(c.genome)) {
          ctx.fillStyle = 'rgba(232,200,140,0.9)';
          ctx.beginPath();
          ctx.ellipse(c.x, footY, R * 1.2 * (c.state === 'grow' ? 1.25 : 1), R * 0.16, 0, Math.PI, 0);
          ctx.fill();
        }
      } else if (isGull(c.genome) && c.y < WALK1 && c.y > HORIZON) {
        // a gull flying over the beach casts a faint shadow on the sand
        ctx.fillStyle = 'rgba(150,100,40,0.08)';
        ctx.beginPath();
        ctx.ellipse(c.x, Math.max(WALK0, c.y + 260), R * 0.8, R * 0.15, 0, 0, TAU);
        ctx.fill();
      }
    }
  },

  behave(s, c, dt) {
    const k = strandKind(c.genome);
    if (k === 0) crabBehave(s, c, dt);
    else if (k === 1) gullBehave(s, c, dt);
    else if (k === 2) castleBehave(s, c, dt);
    else turtleBehave(s, c, dt);
  },

  tile(ctx, W, H, kit) {
    const r = mulberry32(9);
    const hz = 132;
    const shore = 205;
    const sky = ctx.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#4fb0ee');
    sky.addColorStop(1, '#d6f1fc');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hz + 1);
    // sun and a cloud
    ctx.fillStyle = 'rgba(255,250,200,0.55)';
    ctx.beginPath();
    ctx.arc(W - 70, 55, 52, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.arc(W - 70, 55, 32, 0, TAU);
    ctx.fill();
    cloud(ctx, 190, 50, 0.45);
    // sea
    const sea = ctx.createLinearGradient(0, hz, 0, shore);
    sea.addColorStop(0, '#2c86c9');
    sea.addColorStop(1, '#7fdcd8');
    ctx.fillStyle = sea;
    ctx.fillRect(0, hz, W, shore - hz + 4);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(r() * W, hz + 6 + r() * (shore - hz - 14), 14 + r() * 30, 2);
    }
    sailboat(ctx, 300, hz + 4, 0.4, 0);
    // sand with a foamy edge
    const sand = ctx.createLinearGradient(0, shore, 0, H);
    sand.addColorStop(0, '#e6c78f');
    sand.addColorStop(0.3, '#f7e2b0');
    sand.addColorStop(1, '#efcf92');
    ctx.fillStyle = sand;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, shore + Math.sin(x * 0.03) * 4);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= W + 10; x += 10) ctx.lineTo(x, shore + Math.sin(x * 0.03) * 4);
    ctx.stroke();
    umbrella(ctx, 455, 300, 0.55, '#ff6b6b', '#fff4e0');
    starfish(ctx, 60, 340, 12, 0.4, '#ff8a65');
    shell(ctx, 250, 345, 7, 0.2, '#ffd2dc');
    // a gull in the sky, a sandcastle and a crab on the sand
    kit.draw(ctx, strandSprite(kit.genome(78, 4, 1), kit.sticker('m')), 95, 92, 0.42);
    const shadow = (x: number, y: number, w: number) => {
      ctx.fillStyle = 'rgba(150,100,40,0.2)';
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.2, 0, 0, TAU);
      ctx.fill();
    };
    const castle = strandSprite(kit.genome(96, 2, 2), kit.sticker('A'));
    shadow(300, 238 + footOf(castle) * 0.55, castle.radius * 0.55 * 1.1);
    kit.draw(ctx, castle, 300, 238, 0.55);
    const crab = strandSprite(kit.genome(70, 7, 0), kit.sticker('k'));
    shadow(130, 282 + footOf(crab) * 0.5, crab.radius * 0.5);
    kit.draw(ctx, crab, 130, 282, 0.5);
  },
};

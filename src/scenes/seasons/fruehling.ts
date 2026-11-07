// "Frühling": a bright spring meadow full of flowers, a little brook winding through it, fruit trees in
// blossom and a rainbow in the sky. Petals drift on the wind, the brook glitters and clouds pass by.
// Flowers with faces grow out of the ground, sway and now and then wander a bit or sink away and grow
// again somewhere else; bees buzz from flower to flower, songbirds swoop and land on the grass,
// ladybirds crawl about.
import { fruehlingSprite } from '../../game/creatures/seasons/fruehling.ts';
import { sparkleStar } from '../../game/creatures/parts.ts';
import { clamp, hsl, lerp, TAU } from '../../game/math.ts';
import { mulberry32, type Rand } from '../../game/rng.ts';
import { sfx } from '../../game/audio.ts';
import type { Creature, HabitatDef, HabitatScene } from '../habitat.ts';
import { tk } from '../../i18n/i18n.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const HORIZON = 560;
/** the meadow where flowers and ladybirds live */
const GROUND0 = 650;
const GROUND1 = 940;
/** bees and birds fly between here and the meadow */
const SKY0 = 370;
const FLY1 = 820;

const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#748ffc', '#b197fc'];

// ------------------------------------------------------------------------------------- the picture

/** the brook: centre and half width at height y (it winds from the horizon to the bottom edge) */
function brookAt(W: number, H: number, hz: number, y: number): { x: number; w: number } {
  const t = clamp((y - hz) / (H - hz));
  const amp = Math.min(W * 0.16, 300);
  return { x: W * 0.6 + Math.sin(t * 5.6 + 0.4) * amp * (0.35 + 0.65 * t) - t * W * 0.12, w: lerp(H * 0.006, H * 0.06, t) };
}

function sky(ctx: Ctx2, W: number, hz: number) {
  const g = ctx.createLinearGradient(0, 0, 0, hz);
  g.addColorStop(0, '#86cdf7');
  g.addColorStop(1, '#eaf8ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, hz + 60);
}

function sun(ctx: Ctx2, x: number, y: number, r: number) {
  const glow = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 3.6);
  glow.addColorStop(0, 'rgba(255,248,190,0.95)');
  glow.addColorStop(1, 'rgba(255,248,190,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - r * 3.6, y - r * 3.6, r * 7.2, r * 7.2);
  ctx.fillStyle = '#ffe66b';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function rainbow(ctx: Ctx2, x: number, y: number, R: number, band: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineWidth = band + 1;
  RAINBOW.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.beginPath();
    ctx.arc(x, y, R - i * band, Math.PI, TAU);
    ctx.stroke();
  });
  ctx.restore();
}

function cloud(ctx: Ctx2, x: number, y: number, s: number, a = 0.95) {
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  for (const [ox, oy, rr] of [
    [0, 0, 48],
    [42, -22, 58],
    [92, -4, 46],
    [44, 14, 50],
    [130, 8, 34],
  ]) {
    ctx.beginPath();
    ctx.arc(x + ox * s, y + oy * s, rr * s, 0, TAU);
    ctx.fill();
  }
}

function hills(ctx: Ctx2, W: number, base: number, amp: number, f: number, ph: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 60);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, base - amp * (0.6 + 0.4 * Math.sin(x * f + ph)) - amp * 0.25 * Math.sin(x * f * 2.3 + ph * 2));
  ctx.lineTo(W, base + 60);
  ctx.closePath();
  ctx.fill();
}

/** a fruit tree in blossom (cherry pink or apple white) */
function blossomTree(ctx: Ctx2, x: number, y: number, s: number, r: Rand, pink: boolean) {
  ctx.save();
  // soft shadow
  ctx.fillStyle = 'rgba(40,110,40,0.22)';
  ctx.beginPath();
  ctx.ellipse(x + 10 * s, y + 4 * s, 95 * s, 16 * s, 0, 0, TAU);
  ctx.fill();
  // trunk and branches
  ctx.strokeStyle = '#7a5236';
  ctx.lineCap = 'round';
  ctx.lineWidth = 18 * s;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - 4 * s, y - 60 * s, x + 2 * s, y - 110 * s);
  ctx.stroke();
  ctx.lineWidth = 9 * s;
  ctx.beginPath();
  ctx.moveTo(x, y - 80 * s);
  ctx.lineTo(x - 55 * s, y - 140 * s);
  ctx.moveTo(x + 2 * s, y - 95 * s);
  ctx.lineTo(x + 60 * s, y - 145 * s);
  ctx.stroke();
  // blossom crown: puffs of flowers with a little green
  const base = pink ? [330, 0.75, 0.86] : [20, 0.5, 0.95];
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = Math.PI + (i / 13) * Math.PI;
    puffs.push([x + Math.cos(a) * (60 + r() * 45) * s, y - 150 * s + Math.sin(a) * (45 + r() * 30) * s, (34 + r() * 22) * s]);
  }
  puffs.push([x, y - 160 * s, 60 * s]);
  for (const [px, py, pr] of puffs) {
    ctx.fillStyle = hsl(base[0], base[1], base[2] - 0.12);
    ctx.beginPath();
    ctx.arc(px + 4 * s, py + 6 * s, pr, 0, TAU);
    ctx.fill();
  }
  for (const [px, py, pr] of puffs) {
    ctx.fillStyle = hsl(base[0] + (r() - 0.5) * 16, base[1], base[2] - r() * 0.05);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, TAU);
    ctx.fill();
  }
  // leaves peeking through and single blossoms
  for (let i = 0; i < 16; i++) {
    const [px, py, pr] = puffs[Math.floor(r() * puffs.length)];
    const a = r() * TAU;
    ctx.fillStyle = r() < 0.4 ? 'rgba(110,180,80,0.8)' : pink ? '#ffffff' : '#ffc6dc';
    ctx.beginPath();
    ctx.arc(px + Math.cos(a) * pr * 0.6, py + Math.sin(a) * pr * 0.6, 6 * s, 0, TAU);
    ctx.fill();
  }
  // fallen petals under the tree
  for (let i = 0; i < 18; i++) {
    ctx.fillStyle = pink ? '#ffd1e3' : '#ffffff';
    ctx.beginPath();
    ctx.ellipse(x + (r() - 0.5) * 200 * s, y + (r() - 0.3) * 24 * s, 4 * s, 2.5 * s, r() * TAU, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** the brook as a winding band, with a light bank and soft ripples */
function brook(ctx: Ctx2, W: number, H: number, hz: number) {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let y = hz + 2; y <= H + 20; y += 8) {
    const b = brookAt(W, H, hz, y);
    left.push([b.x - b.w, y]);
    right.push([b.x + b.w, y]);
  }
  const band = (grow: number) => {
    ctx.beginPath();
    left.forEach(([x, y], i) => {
      const g = grow * (0.2 + (0.8 * (y - hz)) / (H - hz));
      if (i) ctx.lineTo(x - g, y);
      else ctx.moveTo(x - g, y);
    });
    for (let i = right.length - 1; i >= 0; i--) {
      const [x, y] = right[i];
      ctx.lineTo(x + grow * (0.2 + (0.8 * (y - hz)) / (H - hz)), y);
    }
    ctx.closePath();
  };
  ctx.save();
  ctx.fillStyle = '#d8e6a0';
  band(H * 0.016);
  ctx.fill();
  const g = ctx.createLinearGradient(0, hz, 0, H);
  g.addColorStop(0, '#bfe9fb');
  g.addColorStop(1, '#5fb7e6');
  ctx.fillStyle = g;
  band(0);
  ctx.fill();
  ctx.clip();
  // ripples
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineCap = 'round';
  for (let y = hz + 30; y < H; y += 34 + (y - hz) * 0.06) {
    const b = brookAt(W, H, hz, y);
    ctx.lineWidth = Math.max(1.5, b.w * 0.07);
    ctx.beginPath();
    ctx.moveTo(b.x - b.w * 0.5, y);
    ctx.quadraticCurveTo(b.x - b.w * 0.1, y - b.w * 0.12, b.x + b.w * 0.25, y);
    ctx.stroke();
  }
  ctx.restore();
}

function grassTuft(ctx: Ctx2, x: number, y: number, s: number, r: Rand) {
  ctx.strokeStyle = hsl(95 + r() * 30, 0.55, 0.36 + r() * 0.12);
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  for (let k = -2; k <= 2; k++) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + k * 5 * s, y - (12 + r() * 10) * s);
    ctx.stroke();
  }
}

/** a small meadow flower: daisy, tulip or a round bloom */
function meadowFlower(ctx: Ctx2, x: number, y: number, s: number, r: Rand) {
  const kind = r();
  ctx.strokeStyle = '#4f9a3c';
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + (r() - 0.5) * 4 * s, y - 20 * s);
  ctx.stroke();
  const fy = y - 22 * s;
  if (kind < 0.4) {
    // daisy
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      ctx.beginPath();
      ctx.ellipse(x + Math.cos(a) * 5 * s, fy + Math.sin(a) * 5 * s, 4.5 * s, 2.4 * s, a, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd43b';
    ctx.beginPath();
    ctx.arc(x, fy, 3 * s, 0, TAU);
    ctx.fill();
  } else if (kind < 0.7) {
    // tulip
    ctx.fillStyle = hsl([350, 20, 45, 300][Math.floor(r() * 4)], 0.8, 0.62);
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, fy - 8 * s);
    ctx.lineTo(x - 3 * s, fy - 3 * s);
    ctx.lineTo(x, fy - 9 * s);
    ctx.lineTo(x + 3 * s, fy - 3 * s);
    ctx.lineTo(x + 6 * s, fy - 8 * s);
    ctx.quadraticCurveTo(x + 7 * s, fy + 4 * s, x, fy + 4 * s);
    ctx.quadraticCurveTo(x - 7 * s, fy + 4 * s, x - 6 * s, fy - 8 * s);
    ctx.fill();
  } else {
    ctx.fillStyle = hsl([200, 270, 330, 50, 15][Math.floor(r() * 5)], 0.75, 0.68);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * 4 * s, fy + Math.sin(a) * 4 * s, 3.6 * s, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(x, fy, 2.4 * s, 0, TAU);
    ctx.fill();
  }
}

function meadow(ctx: Ctx2, W: number, H: number, hz: number) {
  const ground = ctx.createLinearGradient(0, hz, 0, H);
  ground.addColorStop(0, '#b4e27e');
  ground.addColorStop(1, '#73c350');
  ctx.fillStyle = ground;
  ctx.beginPath();
  ctx.moveTo(0, hz + 10);
  for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, hz + 6 - 10 * Math.sin(x * 0.005 + 0.4));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.closePath();
  ctx.fill();
}

/** is (x, y) on the brook (with a margin)? */
function onBrook(W: number, H: number, hz: number, x: number, y: number, m: number) {
  const b = brookAt(W, H, hz, y);
  return Math.abs(x - b.x) < b.w + m;
}

// ------------------------------------------------------------------------------------- animation

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Petal {
  x: number;
  y: number;
  v: number;
  fall: number;
  rot: number;
  vr: number;
  s: number;
  ph: number;
  pink: boolean;
  front: boolean;
}
interface Glint {
  x: number;
  y: number;
  t: number;
  s: number;
}

function drawPetal(ctx: CanvasRenderingContext2D, p: Petal, t: number) {
  const flip = Math.cos(t * 2.2 + p.ph);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot);
  ctx.scale(1, 0.35 + 0.65 * Math.abs(flip));
  ctx.fillStyle = p.pink ? '#ffc2da' : '#fffaf4';
  ctx.strokeStyle = p.pink ? 'rgba(230,120,160,0.5)' : 'rgba(200,170,190,0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-p.s, 0);
  ctx.quadraticCurveTo(0, -p.s * 0.8, p.s, 0);
  ctx.quadraticCurveTo(0, p.s * 0.8, -p.s, 0);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------------------------- behaviour

/** 0 flower, 1 bee, 2 ladybird, 3 bird */
const kindOf = (c: Creature) => c.genome.variant % 4;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function groundDepth(y: number) {
  return lerp(0.74, 1.08, clamp((y - GROUND0) / (GROUND1 - GROUND0)));
}

/** steer smoothly towards (tx, ty): gentle curves, never a sharp turn */
function steer(c: Creature, dt: number, speed: number, turn: number) {
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const d = Math.hypot(dx, dy) || 1;
  const v = speed * clamp(d / 80, 0.25, 1);
  c.vx = lerp(c.vx, (dx / d) * v, Math.min(1, dt * turn));
  c.vy = lerp(c.vy, (dy / d) * v, Math.min(1, dt * turn));
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (Math.abs(c.vx) > 12) c.facing = c.vx >= 0 ? 1 : -1;
  return d;
}

function walkTo(c: Creature, dt: number, speed: number) {
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const d = Math.hypot(dx, dy);
  c.vx = lerp(c.vx, (dx / (d || 1)) * speed, dt * 4);
  c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.5, dt * 4);
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
  return d;
}

function groundSpot(s: HabitatScene, c: Creature, reach: number): [number, number] {
  const B = s.bounds;
  return [clamp(c.x + (Math.random() - 0.5) * reach, B.x0, B.x1), clamp(c.y + (Math.random() - 0.5) * 140, GROUND0, GROUND1)];
}

function tumble(c: Creature, max = 1.3) {
  const t = c.stateT;
  c.rot = t < 0.3 ? (t / 0.3) * max * c.facing : t < 1.4 ? max * c.facing + Math.sin(t * 20) * 0.05 : Math.max(0, max * (1 - (t - 1.4) / 0.4)) * c.facing;
  if (t > 1.8) {
    c.state = 'idle';
    c.stateT = 0;
    c.rot = 0;
  }
}

function behaveFlower(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  if (!c.special) {
    // a flower always grows out of the meadow
    c.special = 1;
    if (c.y < GROUND0) c.y = lerp(GROUND0 + 20, GROUND1 - 40, Math.random());
  }
  c.depth = groundDepth(c.y);
  const wob = c.genome.wobble > 0.4 ? 1.7 : 1;
  const sway = Math.sin(s.t * 1.7 + c.phase) * 0.05 * wob + Math.sin(s.t * 0.6 + c.x * 0.003) * 0.03;
  if (c.state === 'idle') {
    c.vx = 0;
    c.vy = 0;
    c.lift = Math.max(0, c.lift - dt * 120);
    c.rot = lerp(c.rot, sway, Math.min(1, dt * 4));
    if (c.stateT > 4 + (c.id % 4)) {
      const k = Math.random();
      c.stateT = 0;
      if (k < 0.3) {
        c.state = 'walk';
        [c.tx, c.ty] = groundSpot(s, c, 420);
      } else if (k < 0.45) {
        c.state = 'sink';
        sfx.plopp(0.7);
      }
    }
    if (c.genome.wobble > 0.4 && Math.random() < dt * 0.08) {
      c.state = 'tumble';
      c.stateT = 0;
      sfx.boing();
    }
  } else if (c.state === 'walk') {
    // little hops on its root
    const d = walkTo(c, dt, lerp(40, 60, c.genome.q));
    c.lift = Math.abs(Math.sin(c.stateT * 7)) * 10;
    c.rot = Math.sin(c.stateT * 7) * 0.08 * wob;
    if (d < 10 || c.stateT > 7) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'sink') {
    // shrink back into the soil ...
    c.spawn = Math.max(0, 1 - c.stateT / 0.5);
    c.rot = lerp(c.rot, 0, Math.min(1, dt * 6));
    if (c.stateT > 0.55) {
      s.particles.burst('puff', c.x, c.y, 6, { color: 'rgba(150,110,70,0.7)', size: 14, speed: 60, max: 0.5 });
      // ... and grow again somewhere else
      c.x = lerp(B.x0, B.x1, Math.random());
      c.y = lerp(GROUND0 + 10, GROUND1 - 10, Math.random());
      c.depth = groundDepth(c.y);
      c.spawn = 0;
      c.state = 'idle';
      c.stateT = 0;
      s.particles.burst('puff', c.x, c.y, 6, { color: 'rgba(150,110,70,0.7)', size: 14, speed: 60, max: 0.5 });
      s.particles.burst('spark', c.x, c.y - c.sprite.radius * c.depth * 0.8, 5, { color: '#fff6a8', size: 10, speed: 120, max: 0.7 });
      sfx.plopp(1);
    }
  } else if (c.state === 'tumble') tumble(c, 0.9);
  else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, GROUND0, GROUND1);
}

function behaveLadybird(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  if (!c.special) {
    c.special = 1;
    if (c.y < GROUND0) {
      // hatched in the air: flutter down onto the grass
      c.state = 'flutter';
      c.stateT = 0;
      c.tx = c.x + (Math.random() - 0.5) * 200;
      c.ty = lerp(GROUND0 + 20, GROUND1 - 60, Math.random());
    }
  }
  const speed = lerp(32, 55, c.genome.q);
  const wob = c.genome.wobble > 0.4 ? 1.6 : 1;
  if (c.state === 'flutter') {
    c.depth = lerp(c.depth, groundDepth(c.y), Math.min(1, dt * 3));
    const d = steer(c, dt, 150, 3);
    c.lift = Math.sin(clamp(c.stateT / 1.6) * Math.PI) * (c.y < GROUND0 ? 0 : 30) + Math.sin(c.age * 30) * 2;
    c.rot = Math.sin(c.age * 9) * 0.1;
    if ((d < 15 && c.y >= GROUND0) || c.stateT > 6) {
      c.state = 'idle';
      c.stateT = 0;
      c.lift = 0;
      c.y = clamp(c.y, GROUND0, GROUND1);
    }
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    c.y = clamp(c.y, B.y0, GROUND1);
    return;
  }
  c.depth = groundDepth(c.y);
  if (c.state === 'idle') {
    c.vx = lerp(c.vx, 0, dt * 5);
    c.vy = lerp(c.vy, 0, dt * 5);
    c.lift = Math.max(0, c.lift - dt * 200);
    c.rot = lerp(c.rot, 0, Math.min(1, dt * 8));
    if (c.stateT > 1.2 + (c.id % 3)) {
      c.stateT = 0;
      if (c.genome.q > 0.5 && Math.random() < 0.2) {
        // a short flight across the meadow
        c.state = 'flutter';
        [c.tx, c.ty] = groundSpot(s, c, 700);
        sfx.whoosh();
      } else {
        c.state = 'walk';
        [c.tx, c.ty] = groundSpot(s, c, 500);
      }
    }
    if (c.genome.wobble > 0.4 && Math.random() < dt * 0.12) {
      c.state = 'tumble';
      c.stateT = 0;
      sfx.boing();
    }
  } else if (c.state === 'walk') {
    const d = walkTo(c, dt, speed);
    // tiny quick steps
    c.rot = Math.sin(c.age * 16) * 0.035 * wob;
    c.lift = Math.abs(Math.sin(c.age * 16)) * 2;
    if (d < 12 || c.stateT > 9) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state === 'tumble') tumble(c);
  else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, GROUND0, GROUND1);
}

/** a flower for a bee to visit (its id), or 0 */
function pickFlower(s: HabitatScene, c: Creature): number {
  const list = s.creatures.filter((f) => f !== c && !f.leaving && kindOf(f) === 0 && f.state !== 'sink' && f.spawn >= 1 && f.id !== c.special);
  return list.length ? list[Math.floor(Math.random() * list.length)].id : 0;
}

/** where a bee hovers at a flower: just above the blossom */
function blossomOf(f: Creature): [number, number] {
  return [f.x + 25 * f.facing, f.y - f.lift - f.sprite.radius * f.depth * 1.38];
}

function flyTarget(s: HabitatScene, c: Creature, y0 = SKY0 + 20, y1 = FLY1) {
  const B = s.bounds;
  c.tx = clamp(c.x + (Math.random() - 0.5) * 900, B.x0 + 40, B.x1 - 40);
  c.ty = rnd(y0, y1);
  // do not fly back and forth on the spot
  if (Math.abs(c.tx - c.x) < 200) c.tx = clamp(c.x + (c.tx < c.x ? -300 : 300), B.x0 + 40, B.x1 - 40);
}

function behaveBee(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  c.depth = lerp(0.78, 1.0, clamp((c.y - SKY0) / (GROUND1 - SKY0)));
  const speed = lerp(110, 165, c.genome.q);
  // bees bob all the time
  c.lift = Math.sin(c.age * 5 + c.phase) * 7;
  if (c.state === 'idle') {
    c.special = pickFlower(s, c);
    c.state = c.special ? 'toFlower' : 'fly';
    c.stateT = 0;
    if (!c.special) flyTarget(s, c);
  }
  const flower = c.special ? s.creatures.find((f) => f.id === c.special) : undefined;
  if ((c.state === 'toFlower' || c.state === 'visit') && (!flower || flower.leaving || flower.state === 'sink')) {
    c.state = 'fly';
    c.stateT = 0;
    flyTarget(s, c);
  }
  if (c.state === 'toFlower' && flower) {
    [c.tx, c.ty] = blossomOf(flower);
    c.ty = clamp(c.ty, B.y0, GROUND1);
    // a little zig-zag on the way
    c.ty += Math.sin(c.stateT * 3 + c.phase) * 30;
    const d = steer(c, dt, speed, 2.2);
    c.rot = clamp(c.vy / speed, -1, 1) * 0.25 * c.facing;
    if (d < 40 || c.stateT > 9) {
      c.state = 'visit';
      c.stateT = 0;
      if (Math.random() < 0.5) sfx.tune();
    }
  } else if (c.state === 'visit' && flower) {
    // hover over the blossom, sipping
    const [bx, by] = blossomOf(flower);
    c.tx = bx + Math.sin(c.stateT * 2.5) * 22;
    c.ty = clamp(by, B.y0, GROUND1) + Math.cos(c.stateT * 2.5) * 8;
    steer(c, dt, 80, 4);
    c.rot = lerp(c.rot, 0.12 * c.facing, Math.min(1, dt * 4));
    if (Math.random() < dt * 1.5) s.particles.add({ kind: 'spark', x: c.x + rnd(-20, 20), y: c.y + rnd(-10, 20), vy: -20, size: 7, max: 0.6, color: '#ffe066' });
    if (c.stateT > 1.8 + (c.id % 3) * 0.6) {
      c.state = Math.random() < 0.75 ? 'idle' : 'fly';
      c.stateT = 0;
      if (c.state === 'fly') flyTarget(s, c);
    }
  } else if (c.state === 'fly') {
    const d = steer(c, dt, speed, 1.8);
    c.rot = clamp(c.vy / speed, -1, 1) * 0.25 * c.facing;
    if (d < 30 || c.stateT > 7) {
      c.state = 'idle';
      c.stateT = 0;
    }
  } else if (c.state !== 'toFlower' && c.state !== 'visit') c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, B.y0, GROUND1);
}

function behaveBird(s: HabitatScene, c: Creature, dt: number) {
  const B = s.bounds;
  const speed = lerp(150, 210, c.genome.q);
  if (c.state === 'idle') {
    c.state = 'fly';
    c.stateT = 0;
    flyTarget(s, c);
  }
  if (c.state === 'fly' || c.state === 'land') {
    c.depth = lerp(c.depth, lerp(0.78, 1.0, clamp((c.y - SKY0) / (GROUND1 - SKY0))), Math.min(1, dt * 3));
    const d = steer(c, dt, speed, c.state === 'land' ? 2 : 1.3);
    // swoop: glide with gentle waves
    c.lift = Math.sin(c.age * 3 + c.phase) * 12;
    c.rot = clamp(c.vy / speed, -1, 1) * 0.3 * c.facing;
    if (c.state === 'land') c.lift *= clamp(d / 120);
    if (d < (c.state === 'land' ? 12 : 40) || c.stateT > 8) {
      c.stateT = 0;
      if (c.state === 'land') {
        c.state = 'perch';
        c.vx = 0;
        c.vy = 0;
        c.y = clamp(c.y, GROUND0, GROUND1);
        if (Math.random() < 0.6) sfx.chirp();
      } else if (Math.random() < 0.35) {
        // come down onto the meadow
        c.state = 'land';
        c.tx = clamp(c.x + c.facing * rnd(150, 400), B.x0 + 40, B.x1 - 40);
        c.ty = rnd(GROUND0 + 10, GROUND1 - 20);
      } else flyTarget(s, c);
    }
  } else if (c.state === 'perch') {
    c.depth = groundDepth(c.y);
    // hop about and peck at the grass
    const t = c.stateT % 1.6;
    if (t < 0.4) {
      c.lift = Math.sin((t / 0.4) * Math.PI) * 16;
      c.x += c.facing * 50 * dt;
      c.rot = 0;
    } else {
      c.lift = 0;
      c.rot = t > 1.0 && t < 1.3 ? 0.35 * c.facing : lerp(c.rot, 0, Math.min(1, dt * 10));
    }
    if (c.x < B.x0 + 30) c.facing = 1;
    if (c.x > B.x1 - 30) c.facing = -1;
    if (c.stateT > 4 + (c.id % 3)) {
      c.state = 'fly';
      c.stateT = 0;
      flyTarget(s, c, SKY0 + 20, GROUND0 - 40);
      sfx.whoosh();
    }
  } else c.state = 'idle';
  c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
  c.y = clamp(c.y, B.y0, GROUND1);
}

// ------------------------------------------------------------------------------------- the world

export const fruehling: HabitatDef = {
  id: 'fruehling',
  archetype: 'season',
  word: [tk('Frühlingstier'), tk('Frühlingstiere')],
  count: [tk('{n} Frühlingstier'), tk('{n} Frühlingstiere')],
  makeSprite: fruehlingSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: SKY0, y1: GROUND1 }),

  paint(ctx, W, H) {
    const r = mulberry32(47);
    sky(ctx, W, HORIZON);
    sun(ctx, Math.min(260, W * 0.15), 150, 70);
    rainbow(ctx, W * 0.66, HORIZON + 80, Math.min(620, W * 0.4), 18, 0.42);
    // a few fixed far clouds
    cloud(ctx, W * 0.36, 120, 0.55, 0.6);
    cloud(ctx, W * 0.88, 90, 0.45, 0.6);
    hills(ctx, W, HORIZON - 20, 120, 0.0035, 2.1, '#c3e6a6');
    hills(ctx, W, HORIZON + 2, 70, 0.0052, 5.0, '#a9da86');
    // little blossom trees far away on the hills
    for (let i = 0; i < Math.round(W / 110); i++) {
      const x = r() * W;
      blossomTree(ctx, x, HORIZON - 10 - r() * 25, 0.22 + r() * 0.1, r, r() < 0.5);
    }
    meadow(ctx, W, H, HORIZON);
    brook(ctx, W, H, HORIZON);
    // fruit trees in blossom at the far edge of the meadow, away from the brook
    const n = Math.max(3, Math.round(W / 420));
    for (let i = 0; i < n; i++) {
      let x = ((i + 0.2 + r() * 0.6) / n) * W;
      const y = HORIZON + 40 + r() * 40;
      if (onBrook(W, H, HORIZON, x, y, 130)) x += brookAt(W, H, HORIZON, y).x < x ? 260 : -260;
      blossomTree(ctx, x, y, 0.95 + r() * 0.35, r, i % 2 === 0);
    }
    // grass and many little flowers, bigger towards the front
    for (let i = 0; i < Math.round(W / 6); i++) {
      const x = r() * W;
      const y = HORIZON + 30 + r() * (H - HORIZON - 30);
      if (onBrook(W, H, HORIZON, x, y, 14)) continue;
      const s = 0.55 + (y - HORIZON) / (H - HORIZON);
      if (r() < 0.55) grassTuft(ctx, x, y, s, r);
      else meadowFlower(ctx, x, y, s, r);
    }
    // stones by the brook
    for (let i = 0; i < 14; i++) {
      const y = HORIZON + 60 + r() * (H - HORIZON - 60);
      const b = brookAt(W, H, HORIZON, y);
      const side = r() < 0.5 ? -1 : 1;
      const s = 0.5 + (y - HORIZON) / (H - HORIZON);
      ctx.fillStyle = hsl(30, 0.08, 0.62 + r() * 0.12);
      ctx.beginPath();
      ctx.ellipse(b.x + side * (b.w + 12 * s), y, 12 * s, 7 * s, 0, 0, TAU);
      ctx.fill();
    }
  },

  init(s) {
    const r = mulberry32(23);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 4; i++) clouds.push({ x: r() * s.W, y: 70 + r() * 180, s: 0.6 + r() * 0.5, v: 7 + r() * 10 });
    const petals: Petal[] = [];
    for (let i = 0; i < 42; i++)
      petals.push({ x: r() * s.W, y: r() * 1000, v: 30 + r() * 40, fall: 18 + r() * 22, rot: r() * TAU, vr: (r() - 0.5) * 2, s: 5 + r() * 4, ph: r() * TAU, pink: r() < 0.6, front: r() < 0.45 });
    s.amb.clouds = clouds;
    s.amb.petals = petals;
    s.amb.glints = [] as Glint[];
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 220) c.x = -240;
    }
    // a soft breeze now and then
    const gust = 1 + 0.6 * Math.max(0, Math.sin(s.t * 0.25));
    for (const p of s.amb.petals as Petal[]) {
      p.x += (p.v * gust + Math.sin(s.t * 1.3 + p.ph) * 20) * dt;
      p.y += (p.fall + Math.sin(s.t * 2 + p.ph) * 25) * dt;
      p.rot += p.vr * dt;
      if (p.y > 1090 || p.x > s.W + 20) {
        p.x = Math.random() < 0.5 ? -20 : Math.random() * s.W;
        p.y = p.x < 0 ? Math.random() * 800 : -20;
      }
    }
    const glints = s.amb.glints as Glint[];
    for (const g of glints) g.t += dt;
    while (glints.length && glints[0].t > 1) glints.shift();
    if (Math.random() < dt * 3.5) {
      const y = lerp(HORIZON + 40, 1080, Math.pow(Math.random(), 0.7));
      const b = brookAt(s.W, 1080, HORIZON, y);
      glints.push({ x: b.x + (Math.random() - 0.5) * b.w * 1.4, y, t: 0, s: lerp(5, 14, (y - HORIZON) / (1080 - HORIZON)) });
    }
  },

  renderBack(s, ctx) {
    ctx.save();
    for (const c of s.amb.clouds as Cloud[]) cloud(ctx, c.x, c.y, c.s, 0.9);
    for (const g of s.amb.glints as Glint[]) sparkleStar(ctx, g.x, g.y, g.s * Math.sin(clamp(g.t) * Math.PI), 'rgba(255,255,255,0.95)');
    for (const p of s.amb.petals as Petal[]) if (!p.front) drawPetal(ctx, p, s.t);
    ctx.restore();
  },

  renderFront(s, ctx) {
    for (const p of s.amb.petals as Petal[]) if (p.front) drawPetal(ctx, p, s.t);
  },

  behave(s, c, dt) {
    const k = kindOf(c);
    if (k === 0) behaveFlower(s, c, dt);
    else if (k === 1) behaveBee(s, c, dt);
    else if (k === 2) behaveLadybird(s, c, dt);
    else behaveBird(s, c, dt);
  },

  tile(ctx, W, H, kit) {
    const hz = H * 0.5;
    const r = mulberry32(5);
    sky(ctx, W, hz);
    sun(ctx, 62, 56, 26);
    rainbow(ctx, W * 0.62, hz + 30, 190, 8, 0.5);
    cloud(ctx, 150, 48, 0.32, 0.9);
    hills(ctx, W, hz - 4, 40, 0.014, 1.5, '#c3e6a6');
    hills(ctx, W, hz + 6, 24, 0.022, 4.2, '#a9da86');
    meadow(ctx, W, H, hz);
    brook(ctx, W, H, hz);
    blossomTree(ctx, 60, hz + 22, 0.42, r, true);
    blossomTree(ctx, 430, hz + 14, 0.34, r, false);
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      const y = hz + 20 + r() * (H - hz - 20);
      if (onBrook(W, H, hz, x, y, 6)) continue;
      const s = 0.45 + (0.5 * (y - hz)) / (H - hz);
      if (r() < 0.5) grassTuft(ctx, x, y, s, r);
      else meadowFlower(ctx, x, y, s, r);
    }
    kit.draw(ctx, fruehlingSprite(kit.genome(96, 5, 0), kit.sticker('A')), 120, 330, 0.62, 1);
    kit.draw(ctx, fruehlingSprite(kit.genome(80, 9, 1), kit.sticker('b')), 300, 150, 0.55, -1);
    kit.draw(ctx, fruehlingSprite(kit.genome(70, 3, 2), kit.sticker('m')), 370, 300, 0.55, -1);
    kit.draw(ctx, fruehlingSprite(kit.genome(88, 7, 3), kit.sticker('e')), 400, 120, 0.45, -1);
  },
};

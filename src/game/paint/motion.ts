// How the painted animals of the Mal-Aquarium move: the pose each one is drawn in (squash, tilt, bobbing, the swing
// of its moving part) and, for the animals that do not simply swim, their own steering through the water.
import type { Bounds, Creature } from '../../scenes/habitat.ts';
import { clamp, lerp, TAU } from '../math.ts';
import type { Motion } from './species.ts';

export interface Pose {
  /** scale across and up (1 = as painted) */
  sx: number;
  sy: number;
  /** tilt (radians) on top of the creature's own */
  rot: number;
  /** up and down (px) */
  dy: number;
  /** angle of the moving part (tail, fins, claws, arms) around its pivot */
  limb: number;
}

/** seconds per beat of the jellyfish's bell and the octopus's arms */
const BEAT = 1.4;
/** seconds between two puffs of the pufferfish */
const PUFF = 9;

const smooth = (x: number) => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};

/** where in its beat the animal is (0..1) */
const beatAt = (t: number, phase: number) => (((t / BEAT + phase / TAU) % 1) + 1) % 1;

/** how far the bell (or the arms) is pulled together: quickly in, slowly out (0..1) */
function squeeze(t: number, phase: number): number {
  const u = beatAt(t, phase);
  return u < 0.25 ? smooth(u / 0.25) : 1 - smooth((u - 0.25) / 0.75);
}

/** how the animal looks at time t (seconds) while moving with speed vx */
export function poseOf(m: Motion, t: number, phase: number, vx: number): Pose {
  const wag = (amp: number) => Math.sin(t * (6 + Math.abs(vx) / 25) + phase) * amp;
  switch (m) {
    case 'swim': {
      const b = 1 + Math.sin(t * 3 + phase) * 0.015;
      return { sx: b, sy: b, rot: 0, dy: 0, limb: wag(0.3) };
    }
    case 'dart':
      // the pike's tail barely moves while it lurks and beats hard when it shoots off
      return { sx: 1, sy: 1, rot: 0, dy: 0, limb: wag(Math.abs(vx) > 150 ? 0.45 : 0.12) };
    case 'puff': {
      const u = (((t / PUFF + phase / TAU) % 1) + 1) % 1;
      const big = smooth((u - 0.7) / 0.05) * smooth((0.92 - u) / 0.05);
      const s = 1 + 0.32 * big;
      return { sx: s, sy: s, rot: 0, dy: 0, limb: wag(0.3 * (1 - big)) };
    }
    case 'bob':
      // the seahorse stands upright, rocks up and down, its little fin flutters
      return { sx: 1, sy: 1, rot: Math.sin(t * 0.9 + phase) * 0.06, dy: Math.sin(t * 1.8 + phase) * 12, limb: Math.sin(t * 14 + phase) * 0.25 };
    case 'pulse': {
      const c = squeeze(t, phase);
      // the tentacles follow the bell a little later
      return { sx: 1 + 0.1 * c, sy: 1 - 0.18 * c, rot: 0, dy: 0, limb: Math.sin(beatAt(t, phase) * TAU - 1.2) * 0.12 };
    }
    case 'arms': {
      const c = squeeze(t, phase);
      return { sx: 1 - 0.06 * c, sy: 1 + 0.08 * c, rot: 0, dy: 0, limb: Math.sin(t * 2.5 + phase) * 0.2 - c * 0.12 };
    }
    case 'glide':
      return { sx: 1, sy: 1, rot: Math.sin(t * 0.7 + phase) * 0.04, dy: 0, limb: Math.sin(t * 2.2 + phase) * 0.35 };
    case 'walk': {
      // little steps while it walks, the claws snap; a crab never tips over
      const going = Math.min(1, Math.abs(vx) / 30);
      return { sx: 1, sy: 1, rot: 0, dy: -Math.abs(Math.sin(t * 9 + phase)) * 4 * going, limb: Math.sin(t * 3.5 + phase) * 0.12 };
    }
    case 'sway':
      // the free-form animal has no separate part: the whole picture rocks gently
      return { sx: 1, sy: 1, rot: Math.sin(t * 2 + phase) * 0.07, dy: 0, limb: 0 };
  }
}

/** motions with their own steering; the others swim the habitat's way */
export const OWN_STEERING: ReadonlySet<Motion> = new Set<Motion>(['dart', 'bob', 'pulse', 'arms', 'walk']);

function retarget(c: Creature, B: Bounds, margin = 80): void {
  c.tx = lerp(B.x0 + margin, B.x1 - margin, Math.random());
  c.ty = lerp(B.y0 + margin * 0.5, B.y1 - margin * 0.5, Math.random());
  c.stateT = 0;
}

function keepInside(c: Creature, B: Bounds): void {
  if (c.x < B.x0 || c.x > B.x1) c.vx = 0;
  if (c.y < B.y0 || c.y > B.y1) c.vy = 0;
  c.x = clamp(c.x, B.x0, B.x1);
  c.y = clamp(c.y, B.y0, B.y1);
}

/** steering: replaces the habitat's default swimming for this motion (walk keeps to the sand, bob drifts slowly, dart waits and shoots) */
export function behavePainted(m: Motion, c: Creature, dt: number, B: Bounds, sandY: number): void {
  switch (m) {
    case 'walk':
      return walk(c, dt, B, sandY);
    case 'dart':
      return dart(c, dt, B);
    case 'bob':
      return drift(c, dt, B);
    case 'pulse':
    case 'arms':
      return pushes(m, c, dt, B);
    default:
      // swim, puff, glide and sway: the habitat's swimming (see OWN_STEERING)
      return;
  }
}

/** the crab sinks to the sand and walks sideways along it, now and then it stops */
function walk(c: Creature, dt: number, B: Bounds, sandY: number): void {
  if (c.state !== 'walk' && c.state !== 'rest') c.state = 'rest';
  const walking = c.state === 'walk';
  if (c.stateT > (walking ? 5 : 1.5 + (c.id % 3)) || (walking && Math.abs(c.tx - c.x) < 10)) {
    c.state = walking ? 'rest' : 'walk';
    c.stateT = 0;
    if (!walking) c.tx = lerp(B.x0 + 60, B.x1 - 60, Math.random());
  }
  const want = c.state === 'walk' ? Math.sign(c.tx - c.x) * 70 : 0;
  c.vx = lerp(c.vx, want, Math.min(1, dt * 4));
  c.vy = 0;
  c.x = clamp(c.x + c.vx * dt, B.x0, B.x1);
  // (not clamped to the bounds on purpose: the crab walks on the sand, which may lie below the swimming area)
  c.y = lerp(c.y, sandY, Math.min(1, dt * 1.5));
  c.rot = 0;
}

/** the pike lurks, then shoots off */
function dart(c: Creature, dt: number, B: Bounds): void {
  if (c.state !== 'lurk' && c.state !== 'shoot') c.state = 'lurk';
  if (c.state === 'lurk') {
    c.vx = lerp(c.vx, 0, Math.min(1, dt * 2));
    c.vy = lerp(c.vy, Math.sin(c.age * 1.5 + c.phase) * 8, Math.min(1, dt * 2));
    if (c.stateT > 2.5 + (c.id % 3)) {
      retarget(c, B);
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy) || 1;
      c.vx = (dx / d) * 520;
      c.vy = (dy / d) * 520 * 0.4;
      c.state = 'shoot';
    }
  } else {
    const k = Math.exp(-dt * 1.6);
    c.vx *= k;
    c.vy *= k;
    if (c.stateT > 1.4) {
      c.state = 'lurk';
      c.stateT = 0;
    }
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  keepInside(c, B);
  if (Math.abs(c.vx) > 20) c.facing = c.vx >= 0 ? 1 : -1;
  c.rot = lerp(c.rot, clamp(c.vy / 400, -0.3, 0.3) * c.facing, Math.min(1, dt * 4));
}

/** the seahorse drifts slowly to somewhere else */
function drift(c: Creature, dt: number, B: Bounds): void {
  if (c.stateT > 9 || Math.hypot(c.tx - c.x, c.ty - c.y) < 20) retarget(c, B);
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const d = Math.hypot(dx, dy) || 1;
  c.vx = lerp(c.vx, (dx / d) * 24, Math.min(1, dt));
  c.vy = lerp(c.vy, (dy / d) * 16, Math.min(1, dt));
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  keepInside(c, B);
  if (Math.abs(c.vx) > 8) c.facing = c.vx >= 0 ? 1 : -1;
  c.rot = 0;
}

/**
 * the jellyfish and the octopus move in pushes, in time with the squeeze of their pose: the jellyfish rises in
 * pushes and sinks slowly when it is high enough, the octopus pushes itself towards where it wants to go
 */
function pushes(m: 'pulse' | 'arms', c: Creature, dt: number, B: Bounds): void {
  // the jellyfish only cares about the height: it hardly moves sideways
  const there = m === 'pulse' ? Math.abs(c.ty - c.y) < 30 : Math.hypot(c.tx - c.x, c.ty - c.y) < 60;
  if (there || c.stateT > 14) retarget(c, B);
  const pushing = beatAt(c.age, c.phase) < 0.3;
  const dx = c.tx - c.x;
  const dy = c.ty - c.y;
  const d = Math.hypot(dx, dy) || 1;
  if (m === 'pulse') {
    // up only while the target is above; otherwise it lets itself sink
    if (pushing && dy < 0) c.vy -= 300 * dt;
    c.vy += (20 - c.vy) * dt * 1.2;
    c.vx = lerp(c.vx, Math.sign(dx) * Math.min(20, Math.abs(dx)), Math.min(1, dt));
  } else {
    if (pushing) {
      c.vx += (dx / d) * 360 * dt;
      c.vy += (dy / d) * 360 * dt;
    }
    c.vx -= c.vx * dt * 1.5;
    c.vy -= c.vy * dt * 1.5;
    if (Math.abs(c.vx) > 10) c.facing = c.vx >= 0 ? 1 : -1;
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  keepInside(c, B);
  c.rot = 0;
}

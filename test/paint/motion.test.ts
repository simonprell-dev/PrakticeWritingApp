import { describe, expect, it } from 'vitest';
import { makeGenome } from '../../src/game/creatures/genome.ts';
import type { Sprite } from '../../src/game/creatures/sprite.ts';
import { behavePainted, poseOf } from '../../src/game/paint/motion.ts';
import type { Motion } from '../../src/game/paint/species.ts';
import type { Bounds, Creature } from '../../src/scenes/habitat.ts';

const B: Bounds = { x0: 110, x1: 1810, y0: 150, y1: 880 };
const SAND = 960;

function creature(x: number, y: number, motion: Motion): Creature {
  const sprite = { radius: 80, motion } as Sprite;
  return {
    id: 1, genome: makeGenome(80, 'schoen', 5, 'fish'), sprite, x, y, vx: 0, vy: 0, facing: 1, face: 1, age: 0, spawn: 1,
    leaving: false, state: 'idle', stateT: 0, tx: x, ty: y, rot: 0, phase: 0.7, blink: 0, nextBlink: 3, depth: 1, lift: 0, special: 0,
  };
}

/** the poses of one second, every 1/30 s */
const second = (m: Motion, vx = 80) => Array.from({ length: 31 }, (_, i) => poseOf(m, 3 + i / 30, 0.4, vx));

describe('how the painted animals move', () => {
  it('the jellyfish pulses: its bell gets clearly flatter and taller within a second', () => {
    const sy = second('pulse').map((p) => p.sy);
    expect(Math.max(...sy) - Math.min(...sy)).toBeGreaterThanOrEqual(0.1);
  });

  it('a fish swims without being squashed, a crab walks without tipping over', () => {
    for (const p of second('swim')) expect(p.sx).toBe(p.sy);
    for (const p of second('walk')) expect(p.rot).toBe(0);
  });

  it('every motion gives a finite pose', () => {
    const all: Motion[] = ['swim', 'dart', 'puff', 'bob', 'pulse', 'arms', 'glide', 'walk', 'sway'];
    for (const m of all) for (const p of second(m)) for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
  });

  it('the crab keeps to the sand, even when it hatches high up in the water', () => {
    const c = creature(900, 300, 'walk');
    for (let t = 0; t < 10; t += 1 / 60) {
      c.age += 1 / 60;
      c.stateT += 1 / 60;
      behavePainted('walk', c, 1 / 60, B, SAND);
    }
    expect(Math.abs(c.y - SAND)).toBeLessThan(40);
    expect(c.x).toBeGreaterThanOrEqual(B.x0);
    expect(c.x).toBeLessThanOrEqual(B.x1);
  });

  it('the others that steer themselves stay in the water', () => {
    for (const m of ['dart', 'bob', 'pulse', 'arms'] as Motion[]) {
      const c = creature(900, 500, m);
      let moved = 0;
      for (let t = 0; t < 30; t += 1 / 60) {
        const x = c.x;
        const y = c.y;
        c.age += 1 / 60;
        c.stateT += 1 / 60;
        behavePainted(m, c, 1 / 60, B, SAND);
        moved += Math.hypot(c.x - x, c.y - y);
        expect(c.x).toBeGreaterThanOrEqual(B.x0 - 40);
        expect(c.x).toBeLessThanOrEqual(B.x1 + 40);
        expect(c.y).toBeGreaterThanOrEqual(B.y0);
        expect(c.y).toBeLessThanOrEqual(B.y1);
      }
      expect(moved, m).toBeGreaterThan(100);
    }
  });
});

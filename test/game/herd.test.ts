import { describe, expect, it } from 'vitest';
import { arcPoint, Herd, rainbowAlpha, type Arc } from '../../src/game/castle/herd.ts';
import { mulberry32 } from '../../src/game/rng.ts';

const B = { x0: 140, x1: 1780, y0: 640, y1: 930 };
const dt = 1 / 10;

function run(h: Herd, from: number, to: number, ready: () => number[], third: number | null, onTick?: (now: number) => void) {
  for (let now = from; now < to; now += dt) {
    h.update(dt, ready(), now, third);
    if (h.phase === 'gather') for (const id of h.members) h.arrived(id);
    onTick?.(now);
  }
}

describe('herd', () => {
  it('no herd below three', () => {
    const h = new Herd(mulberry32(1), B);
    const phases = new Set<string>();
    run(h, 0, 200, () => [1, 2], null, () => phases.add(h.phase));
    expect([...phases]).toEqual(['idle']);
  });

  it('first flight not before 10 s after the third and within the gap', () => {
    for (let seed = 1; seed < 20; seed++) {
      const h = new Herd(mulberry32(seed), B);
      let first = -1;
      run(h, 0, 75, () => [1, 2, 3], 0, (now) => {
        if (first < 0 && h.phase !== 'idle') first = now;
      });
      expect(first).toBeGreaterThanOrEqual(40 - 1e-6);
      expect(first).toBeLessThanOrEqual(70 + dt);
    }
  });

  it('one rainbow at a time', () => {
    const h = new Herd(mulberry32(5), B);
    let starts = 0;
    let last = 'idle';
    let lastBorn = -100;
    run(h, 0, 400, () => [1, 2, 3, 4], 0, (now) => {
      if (h.phase === 'fly' && last !== 'fly') {
        starts++;
        expect(now - lastBorn).toBeGreaterThanOrEqual(23);
        lastBorn = now;
      }
      last = h.phase;
    });
    expect(starts).toBeGreaterThanOrEqual(4);
  });

  it('flies once all arrived, or after 8 s of gathering', () => {
    const h = new Herd(mulberry32(2), B);
    let gatherAt = -1;
    let flyAt = -1;
    for (let now = 0; now < 100 && flyAt < 0; now += dt) {
      h.update(dt, [1, 2, 3], now, 0);
      if (h.phase === 'gather' && gatherAt < 0) gatherAt = now;
      if (h.phase === 'fly') flyAt = now;
    }
    expect(flyAt - gatherAt).toBeGreaterThan(7.5);
    expect(flyAt - gatherAt).toBeLessThan(8.5);
    expect(h.rainbow).not.toBeNull();
  });

  it('leavers are dropped', () => {
    const h = new Herd(mulberry32(3), B);
    let ready = [1, 2, 3, 4];
    for (let now = 0; now < 100 && h.phase !== 'gather'; now += dt) h.update(dt, ready, now, 0);
    expect(h.members).toEqual([1, 2, 3, 4]);
    ready = [1, 3, 4];
    h.update(dt, ready, 100, 0);
    expect(h.members).toEqual([1, 3, 4]);
  });

  it('arc is a bow', () => {
    const a: Arc = { x0: 300, x1: 1500, yBase: 800, height: 600 };
    expect(arcPoint(a, 0).x).toBeCloseTo(300);
    expect(arcPoint(a, 1).x).toBeCloseTo(1500);
    expect(arcPoint(a, 0.5).y).toBeCloseTo(200);
    expect(arcPoint(a, 0.2).y).toBeCloseTo(arcPoint(a, 0.8).y);
    expect(arcPoint(a, 0).y).toBeCloseTo(800);
  });

  it('rainbowAlpha', () => {
    expect(rainbowAlpha(0)).toBe(1);
    expect(rainbowAlpha(19)).toBe(1);
    expect(rainbowAlpha(21.5)).toBeGreaterThan(0);
    expect(rainbowAlpha(21.5)).toBeLessThan(1);
    expect(rainbowAlpha(23)).toBe(0);
  });
});

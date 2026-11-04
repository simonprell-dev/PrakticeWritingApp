// Zauberland herd: when at least three fable creatures live on the meadow they now and then gather, fly a
// big bow across the sky together and leave a rainbow along it. Pure timing and geometry; the scene moves
// the creatures.
import { clamp, lerp } from '../math.ts';
import type { Rand } from '../rng.ts';

export type HerdPhase = 'idle' | 'gather' | 'fly' | 'land';

export const MIN_HERD = 3;
export const GAP_MIN = 40;
export const GAP_MAX = 70;
export const AFTER_THIRD = 10;
export const RAINBOW_LIFE = 20;
export const RAINBOW_FADE = 3;
export const GATHER_MAX = 8;
export const FLY_TIME = 6;
export const LAND_TIME = 2;
/** each herd member flies this much of the bow behind the one before */
export const FOLLOW = 0.08;

export interface Arc {
  x0: number;
  x1: number;
  /** y of both ends */
  yBase: number;
  /** how far the top is above the ends */
  height: number;
}

export interface Meadow {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** a half-ellipse bow from x0 to x1; angle is the flight direction */
export function arcPoint(a: Arc, u: number): { x: number; y: number; angle: number } {
  const th = Math.PI * (1 - clamp(u));
  const rx = (a.x1 - a.x0) / 2;
  const cx = a.x0 + rx;
  const x = cx + Math.cos(th) * rx;
  const y = a.yBase - Math.sin(th) * a.height;
  // derivative along u: dx = rx·sin·π, dy = a.height·cos·π
  const angle = Math.atan2(a.height * Math.cos(th), rx * Math.sin(th));
  return { x, y, angle };
}

export function rainbowAlpha(age: number): number {
  return clamp(1 - (age - RAINBOW_LIFE) / RAINBOW_FADE);
}

export class Herd {
  phase: HerdPhase = 'idle';
  /** seconds in the current phase */
  t = 0;
  members: number[] = [];
  gatherPoint = { x: 0, y: 0 };
  arc: Arc | null = null;
  rainbow: { arc: Arc; born: number } | null = null;
  private nextAt: number | null = null;
  private here = new Set<number>();
  private rand: Rand;
  private meadow: Meadow;

  constructor(rand: Rand, meadow: Meadow) {
    this.rand = rand;
    this.meadow = meadow;
  }

  resize(meadow: Meadow): void {
    this.meadow = meadow;
  }

  /** the scene reports that a member reached the gathering point */
  arrived(id: number): void {
    this.here.add(id);
  }

  /** how far along the bow member k is (0..1) */
  memberU(k: number): number {
    const n = this.members.length;
    const u = (this.t / FLY_TIME) * (1 + FOLLOW * Math.max(0, n - 1)) - FOLLOW * k;
    return clamp(u);
  }

  /** ready: fable creatures that are not leaving; thirdArrivedAt: when the herd last reached three */
  update(dt: number, ready: number[], now: number, thirdArrivedAt: number | null): void {
    this.t += dt;
    if (this.rainbow && now - this.rainbow.born > RAINBOW_LIFE + RAINBOW_FADE) this.rainbow = null;
    if (this.phase !== 'idle') this.members = this.members.filter((id) => ready.includes(id));
    if (this.phase === 'idle') {
      if (ready.length < MIN_HERD || thirdArrivedAt === null) {
        this.nextAt = null;
        return;
      }
      if (this.nextAt === null) this.nextAt = Math.max(thirdArrivedAt + AFTER_THIRD, thirdArrivedAt + this.gap());
      if (now >= this.nextAt && !this.rainbow) this.startGather(ready);
    } else if (this.phase === 'gather') {
      if (this.members.length < MIN_HERD) return this.toIdle(now);
      if (this.members.every((id) => this.here.has(id)) || this.t >= GATHER_MAX) this.startFly(now);
    } else if (this.phase === 'fly') {
      if (this.t >= FLY_TIME) this.set('land');
    } else if (this.t >= LAND_TIME) this.toIdle(now);
  }

  private gap(): number {
    return lerp(GAP_MIN, GAP_MAX, this.rand());
  }

  private set(p: HerdPhase): void {
    this.phase = p;
    this.t = 0;
  }

  private startGather(ready: number[]): void {
    const M = this.meadow;
    const left = this.rand() < 0.5;
    const w = M.x1 - M.x0;
    this.gatherPoint = { x: M.x0 + w * (left ? lerp(0.08, 0.22, this.rand()) : lerp(0.78, 0.92, this.rand())), y: lerp(M.y0, M.y1, lerp(0.35, 0.6, this.rand())) };
    this.members = [...ready];
    this.here.clear();
    this.set('gather');
  }

  private startFly(now: number): void {
    const M = this.meadow;
    const g = this.gatherPoint;
    const other = M.x0 + M.x1 - g.x;
    // the top of the bow is high in the sky, above the castle
    const top = lerp(110, 190, this.rand());
    this.arc = { x0: g.x, x1: other, yBase: g.y, height: g.y - top };
    this.rainbow = { arc: this.arc, born: now };
    this.set('fly');
  }

  private toIdle(now: number): void {
    this.set('idle');
    this.members = [];
    this.here.clear();
    this.arc = null;
    this.nextAt = now + this.gap();
  }
}

/** Deterministic PRNG (mulberry32). */
export type Rand = () => number;

export function mulberry32(seed: number): Rand {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function hashBytes(b: ArrayLike<number>, step = 7): number {
  let h = 2166136261;
  for (let i = 0; i < b.length; i += step) {
    h ^= b[i] & 0xff;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const pick = <T>(r: Rand, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length];
export const range = (r: Rand, lo: number, hi: number) => lo + (hi - lo) * r();

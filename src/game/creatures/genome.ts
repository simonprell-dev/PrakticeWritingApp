// Creature genome: everything about a creature's look follows from the glyph score and a stable seed.
import type { Tier } from '../../vision/types.ts';
import { clamp, lerp } from '../math.ts';
import { mulberry32, pick, range, type Rand } from '../rng.ts';

export type Archetype = 'fish' | 'alien' | 'animal' | 'fighter';
export type Pattern = 'none' | 'stripes' | 'dots' | 'scales' | 'spots';
export type EyeStyle = 'cute' | 'googly' | 'sleepy';

export interface Genome {
  seed: number;
  q: number;
  tier: Tier;
  archetype: Archetype;
  hue: number;
  hue2: number;
  sat: number;
  light: number;
  /** outline irregularity 0..1 */
  wobble: number;
  /** crumpled paper look 0..1 */
  crumple: number;
  /** left/right or top/bottom asymmetry 0..1 */
  asym: number;
  glossy: boolean;
  sparkle: boolean;
  crown: boolean;
  rainbow: boolean;
  pattern: Pattern;
  eyeStyle: EyeStyle;
  eyeCount: number;
  bandaid: boolean;
  /** body shape or species variant */
  variant: number;
  /** overall scale 0.75..1.3 */
  size: number;
  /** radial harmonics (amplitude, phase) for k = 2..5 */
  harmonics: [number, number][];
  /** extra randomness for parts */
  r: Rand;
}

const TIER_IDX: Record<Tier, number> = { zerknittert: 0, schief: 1, nett: 2, schoen: 3, prachtvoll: 4 };

export function makeGenome(score: number, tier: Tier, seed: number, archetype: Archetype, teamHue?: number): Genome {
  const r = mulberry32(seed);
  const q = clamp(score / 100);
  const t = TIER_IDX[tier];
  let hue: number;
  let variant = 0;
  if (archetype === 'fish') {
    hue = pick(r, [8, 25, 42, 190, 205, 280, 330, 160, 55]) + range(r, -10, 10);
    variant = Math.floor(r() * 3); // 0 classic, 1 round, 2 long
  } else if (archetype === 'alien') {
    hue = pick(r, [95, 120, 160, 175, 265, 290, 315, 200]) + range(r, -10, 10);
    variant = Math.floor(r() * 3);
  } else if (archetype === 'animal') {
    variant = Math.floor(r() * 5); // lion, elephant, giraffe, zebra, hippo
    hue = [38, 210, 44, 0, 285][variant] + range(r, -6, 6);
  } else {
    hue = teamHue ?? 0;
    variant = Math.floor(r() * 3);
  }
  const hue2 = archetype === 'fish' ? hue + pick(r, [40, 160, 180, -40]) : hue + pick(r, [30, -30, 180]);
  const crumple = t === 0 ? lerp(1, 0.75, q / 0.3) : t === 1 ? 0.25 : 0;
  const wobble = [0.85, 0.5, 0.18, 0.05, 0][t];
  const asym = [0.8, 0.5, 0.2, 0, 0][t];
  const sat = [0.28, 0.45, 0.62, 0.75, 0.85][t] + range(r, -0.04, 0.04);
  const patternChance = [0.15, 0.3, 0.4, 0.75, 1][t];
  const pattern: Pattern = r() < patternChance ? pick(r, ['stripes', 'dots', 'scales', 'spots'] as const) : 'none';
  const eyeStyle: EyeStyle = t === 0 ? 'googly' : t === 1 ? (r() < 0.5 ? 'googly' : 'sleepy') : 'cute';
  const harmonics: [number, number][] = [];
  for (let k = 2; k <= 5; k++) harmonics.push([range(r, 0.3, 1) / k, range(r, 0, Math.PI * 2)]);
  return {
    seed,
    q,
    tier,
    archetype,
    hue,
    hue2,
    sat: archetype === 'animal' && variant === 3 ? 0 : sat,
    light: archetype === 'animal' && variant === 3 ? 0.9 : range(r, 0.56, 0.64),
    wobble,
    crumple,
    asym,
    glossy: t >= 2,
    sparkle: t >= 3,
    crown: t === 4,
    rainbow: t === 4 && r() < 0.6,
    pattern,
    eyeStyle,
    eyeCount: archetype === 'alien' ? pick(r, [1, 2, 2, 3]) : 1,
    bandaid: t === 0 ? r() < 0.7 : t === 1 ? r() < 0.25 : false,
    variant,
    size: lerp(0.78, 1.3, q),
    harmonics,
    r,
  };
}

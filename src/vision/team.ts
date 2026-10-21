// Team classification by pen colour (ink absorption direction) or by slip colour.
import { angleDeg, chroma, GREY_DIR, normalize3, type Vec3 } from './color.ts';
import type { TeamCalib, TeamId } from './types.ts';

/** Mean absorption (1 - N_c) of the strongest ink pixels of a glyph. */
export function absorptionOf(
  n: [Float32Array, Float32Array, Float32Array],
  ink: Float32Array,
  indices: ArrayLike<number>,
): Vec3 {
  let mx = 0;
  for (let k = 0; k < indices.length; k++) mx = Math.max(mx, ink[indices[k]]);
  const thr = mx * 0.6;
  const acc: Vec3 = [0, 0, 0];
  let cnt = 0;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    if (ink[i] < thr) continue;
    acc[0] += Math.max(0, 1 - n[0][i]);
    acc[1] += Math.max(0, 1 - n[1][i]);
    acc[2] += Math.max(0, 1 - n[2][i]);
    cnt++;
  }
  if (!cnt) return [0, 0, 0];
  return [acc[0] / cnt, acc[1] / cnt, acc[2] / cnt];
}

export interface TeamDecision {
  team?: TeamId;
  /** angle to the chosen team (degrees) */
  angle: number;
  /** the ink looks grey/black and no team uses a grey pen */
  neutral: boolean;
}

/** Nearest team by absorption direction; neutral when ambiguous or when grey ink matches no team. */
export function classifyPen(absorb: Vec3, calibs: TeamCalib[]): TeamDecision {
  const u = normalize3(absorb);
  const cands = calibs.map((c) => ({ team: c.team, a: angleDeg(u, normalize3(c.absorb)) }));
  const greyTeam = calibs.some((c) => angleDeg(normalize3(c.absorb), GREY_DIR) < 12);
  if (!greyTeam) cands.push({ team: undefined as unknown as TeamId, a: angleDeg(u, GREY_DIR) + 2 });
  cands.sort((x, y) => x.a - y.a);
  const best = cands[0];
  const second = cands[1];
  if (!best || !best.team) return { angle: best?.a ?? 180, neutral: true };
  if (best.a > 35 || (second && second.a - best.a < 4)) return { angle: best.a, neutral: true };
  return { team: best.team, angle: best.a, neutral: false };
}

/** Calibrates a pen colour from ink pixels. */
export function calibratePen(absorb: Vec3): [number, number, number] {
  return normalize3(absorb);
}

/** Calibrates a slip colour from raw RGB samples (paper pixels). */
export function calibrateSlip(r: number, g: number, b: number): [number, number, number] {
  return chroma(r, g, b);
}

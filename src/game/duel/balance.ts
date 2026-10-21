// All Team-Duell balance numbers in one place. q = score / 100.

export const BALANCE = {
  /** letters below this score spawn only a "Pfff?" cloud (anti-scribble rule) */
  minScore: 15,
  hp: (q: number) => 20 + 100 * q * q,
  dps: (q: number) => 6 + 10 * q,
  radius: (q: number) => 20 + 28 * q,
  speed: (q: number) => 70 - 25 * q,
  /** seconds between bonks */
  hitEvery: 0.6,
  lanes: 5,
  laneTop: 500,
  laneGap: 105,
  castleHp: { klein: 100, mittel: 200, gross: 350 } as const,
  /** castle centre distance from the world edge */
  castleInset: 195,
  castleRadius: 120,
  maxPerTeam: 30,
};

export function laneY(lane: number): number {
  return BALANCE.laneTop + lane * BALANCE.laneGap;
}

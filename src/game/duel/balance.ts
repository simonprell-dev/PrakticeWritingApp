// All Team-Duell numbers in one place.
//
// Rules: every letter becomes a fighter with 1–5 stars (its quality). A star is one strike.
// When two fighters meet, every exchange costs both of them one star; at 0 stars a fighter pops.
// At the enemy castle every strike pops one bubble of the bubble pile. A bubble machine refills
// the pile from its tank until the tank is empty. The castle falls when pile and tank are empty.

export const BALANCE = {
  /** letters below this score spawn only a "Pfff?" cloud (anti-scribble rule) */
  minScore: 15,
  /** strikes = stars of the letter */
  strength: (score: number) => (score < 30 ? 1 : score < 50 ? 2 : score < 70 ? 3 : score < 88 ? 4 : 5),
  radius: (strength: number) => 24 + 6 * strength,
  speed: (strength: number) => 80 - 6 * strength,
  /** seconds between strikes */
  hitEvery: 0.55,
  lanes: 5,
  laneTop: 478,
  laneGap: 110,
  /** castle centre distance from the world edge (the bubble machine sits behind it) */
  castleInset: 280,
  pile: {
    columns: 3,
    rows: 8,
    bubbleR: 30,
    spacing: 62,
    /** y of the lowest bubble row */
    baseY: 978,
  },
  /** bubbles on the pile at the start and in the machine's tank, per castle size */
  castle: {
    klein: { pile: 9, tank: 8 },
    mittel: { pile: 12, tank: 16 },
    gross: { pile: 15, tank: 28 },
  } as const,
  /** seconds between two bubbles from the machine, and their flight time */
  machineEvery: 2.6,
  machineFlight: 1.2,
  maxPerTeam: 30,
};

/** Klasse gegen Riesenburg: walls (bubbles on the pile and in the tank) and the giant's guards */
export const SIEGE = {
  walls: {
    klein: [
      { pile: 8, tank: 4 },
      { pile: 10, tank: 6 },
    ],
    mittel: [
      { pile: 8, tank: 5 },
      { pile: 10, tank: 8 },
      { pile: 12, tank: 10 },
    ],
    gross: [
      { pile: 8, tank: 6 },
      { pile: 10, tank: 8 },
      { pile: 12, tank: 10 },
      { pile: 14, tank: 12 },
    ],
  } as const,
  /** per wall: seconds between guards, star range, guards on the field at most */
  guards: [
    { every: 8, min: 1, max: 2, field: 2 },
    { every: 6.5, min: 1, max: 3, field: 3 },
    { every: 5.5, min: 2, max: 3, field: 4 },
    { every: 5, min: 2, max: 4, field: 5 },
  ],
  /** guards defend at this fraction of the world width */
  holdAt: 0.62,
  /** score that gives a guard k stars */
  scoreFor: [0, 20, 40, 60, 80, 95],
};

export function laneY(lane: number): number {
  return BALANCE.laneTop + lane * BALANCE.laneGap;
}

/** y of a bubble in the pile (row 0 = bottom) */
export function pileRowY(row: number): number {
  return BALANCE.pile.baseY - row * BALANCE.pile.spacing;
}

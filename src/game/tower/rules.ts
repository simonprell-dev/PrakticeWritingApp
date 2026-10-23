// All "Türme bauen" numbers in one place.
//
// Rules: every letter becomes a building block for the tower of its colour (pen or slip). The nicer
// the letter, the taller the block: 1–5 stars = 2, 3, 4, 6 or 8 metres. Alien Zork carries every
// block from the portal to its tower; when he is busy and the next block arrives, he clones himself.
// The first tower that reaches the finish line wins.
import { starsOf } from '../../recog/score.ts';

export const TOWER = {
  /** letters below this score only make "Pfff?" (anti-scribble rule, as in the duel) */
  minScore: 15,
  /** block height in metres per star (index = stars) */
  metres: [0, 2, 3, 4, 6, 8],
  /** height of the finish line in metres */
  goal: { klein: 24, mittel: 40, gross: 60 } as const,
  maxAliens: 8,
  /** chance that something funny happens on a delivery */
  gagChance: 0.4,
  groundY: 880,
  goalY: 330,
  portal: { y: 190, r: 78 },
  towerW: 168,
  /** blocks waiting next to the portal are shown smaller */
  waitScale: 0.62,
  slots: 6,
  /** UFO speed in px/s and the limits for one flight */
  flySpeed: 900,
  flyMin: 0.55,
  flyMax: 2.1,
  /** distance from the saucer centre to the top of a carried block */
  hang: 64,
  grabTime: 0.55,
  dropTime: 0.5,
  emergeTime: 0.6,
  emergeGap: 0.22,
  /** idle aliens hover in this band */
  sky: { y0: 150, y1: 460 },
};

export type GoalSize = keyof typeof TOWER.goal;

export const blockStars = (score: number): number => starsOf(score);
export const blockMetres = (score: number): number => TOWER.metres[starsOf(score)];

/** px per metre: the finish line is always at the same height on screen */
export function pxPerMetre(goal: number): number {
  return (TOWER.groundY - TOWER.goalY) / goal;
}

/** distance between two towers: wide for few towers, up to eight fit side by side */
export function towerSpacing(n: number, worldW: number): number {
  return Math.min(n === 2 ? 700 : 430, (worldW - (n > 4 ? 160 : 320)) / n);
}

/** tower centres, symmetric around the portal */
export function towerXs(n: number, worldW: number): number[] {
  const spacing = towerSpacing(n, worldW);
  return Array.from({ length: n }, (_, i) => worldW / 2 + (i - (n - 1) / 2) * spacing);
}

/** width of the towers: narrower when many stand side by side (the plinth is 64 px wider) */
export function towerWidth(n: number, worldW: number): number {
  return Math.min(TOWER.towerW, towerSpacing(n, worldW) - 76);
}

/** waiting places next to the portal, alternating left and right */
export function slotPos(i: number, worldW: number): { x: number; y: number } {
  const k = Math.floor(i / 2) + 1;
  const side = i % 2 ? 1 : -1;
  return { x: worldW / 2 + side * (k * 150), y: TOWER.portal.y + 40 + k * 14 };
}

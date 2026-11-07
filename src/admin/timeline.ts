// Arithmetic of the yearly timeline in the admin area: a day is 0..364 of a common year (the 29th of February
// counts as the 28th), a time runs from `from` to `to` and may run over New Year.
import { EASTER_MAX } from '../app/worlds.ts';

export const YEAR = 365;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const wrap = (d: number) => ((d % YEAR) + YEAR) % YEAR;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type DragKind = 'start' | 'end' | 'move';

export function dayOfYear(md: string): number {
  const m = Number(md.slice(0, 2)) - 1;
  const d = Math.min(Number(md.slice(3)), MONTH_DAYS[m]);
  return MONTH_DAYS.slice(0, m).reduce((a, b) => a + b, 0) + d - 1;
}

export function mmdd(day: number): string {
  let d = wrap(day);
  let m = 0;
  while (d >= MONTH_DAYS[m]) d -= MONTH_DAYS[m++];
  return `${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`;
}

/** a time after dragging its start, its end or all of it by `delta` days; at least 1 day, at most a year */
export function dragRange(r: { from: number; to: number }, kind: DragKind, delta: number): { from: number; to: number } {
  const len = wrap(r.to - r.from);
  if (kind === 'move') return { from: wrap(r.from + delta), to: wrap(r.to + delta) };
  if (kind === 'start') {
    const n = clamp(len - delta, 0, YEAR - 1);
    return { from: wrap(r.to - n), to: r.to };
  }
  const n = clamp(len + delta, 0, YEAR - 1);
  return { from: r.from, to: wrap(r.from + n) };
}

/** the days around Easter Sunday after dragging */
export function dragEaster(e: { before: number; after: number }, kind: DragKind, delta: number): { before: number; after: number } {
  const before = kind === 'end' ? e.before : clamp(e.before - delta, 0, EASTER_MAX);
  const after = kind === 'start' ? e.after : clamp(e.after + delta, 0, EASTER_MAX);
  return { before, after };
}

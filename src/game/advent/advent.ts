// The class advent calendar: 24 small writing tasks, which letters count, which door is up, and what the
// device remembers. See docs/superpowers/specs/2026-11-07-adventskalender-design.md.
import { t, tk } from '../../i18n/i18n.ts';
import type { ScannedGlyph, Tier } from '../../vision/types.ts';

export type AdventTask =
  /** n nicely written copies of one letter */
  | { kind: 'letter'; char: string; n: number }
  /** n beautiful letters of any kind */
  | { kind: 'nice'; n: number }
  /** n different letters */
  | { kind: 'different'; n: number }
  /** the letters of a word, each as often as it is in the word, in any order */
  | { kind: 'name'; word: string };

/** the letters counted for a door so far (upper case) */
export type Counted = string[];

/** an opened door: the most beautiful letter of its task */
export interface OpenDoor {
  char: string;
  score: number;
}

/** a little harder through December; the 6th is St Nicholas' day */
export const TASKS: AdventTask[] = [
  { kind: 'letter', char: 'S', n: 3 },
  { kind: 'nice', n: 3 },
  { kind: 'letter', char: 'A', n: 3 },
  { kind: 'name', word: 'MOND' },
  { kind: 'different', n: 3 },
  { kind: 'name', word: 'NIKOLAUS' },
  { kind: 'letter', char: 'E', n: 4 },
  { kind: 'letter', char: 'K', n: 4 },
  { kind: 'nice', n: 4 },
  { kind: 'name', word: 'SCHNEE' },
  { kind: 'different', n: 4 },
  { kind: 'letter', char: 'R', n: 4 },
  { kind: 'name', word: 'BAUM' },
  { kind: 'nice', n: 5 },
  { kind: 'letter', char: 'O', n: 5 },
  { kind: 'name', word: 'STERN' },
  { kind: 'different', n: 5 },
  { kind: 'name', word: 'KERZE' },
  { kind: 'nice', n: 5 },
  { kind: 'letter', char: 'W', n: 5 },
  { kind: 'name', word: 'GLOCKE' },
  { kind: 'different', n: 6 },
  { kind: 'nice', n: 6 },
  { kind: 'name', word: 'WEIHNACHTEN' },
];

const RANK: Record<Tier, number> = { zerknittert: 0, schief: 1, nett: 2, schoen: 3, prachtvoll: 4 };

/** without Latin letters a letter task wants nice characters and a word task different ones */
function plain(task: AdventTask, latin: boolean): AdventTask {
  if (latin) return task;
  if (task.kind === 'letter') return { kind: 'nice', n: task.n };
  if (task.kind === 'name') return { kind: 'different', n: task.word.length };
  return task;
}

export function needed(task: AdventTask, latin: boolean): number {
  const p = plain(task, latin);
  return p.kind === 'name' ? p.word.length : p.n;
}

/** whether this letter brings the door one step further, given the letters counted already */
export function counts(task: AdventTask, glyph: Pick<ScannedGlyph, 'score'>, done: Counted, latin: boolean): boolean {
  const s = glyph.score;
  if (s.rejected || s.tip === 'spiegel') return false;
  const p = plain(task, latin);
  // a letter task that fell back to nice characters is as strict as before: written nicely is enough
  const minRank = p.kind === 'nice' && task.kind === 'nice' ? RANK.schoen : RANK.nett;
  if (RANK[s.tier] < minRank) return false;
  if (done.length >= needed(task, latin)) return false;
  const c = s.char.toUpperCase();
  const had = done.map((x) => x.toUpperCase());
  if (p.kind === 'letter') return c === p.char;
  if (p.kind === 'different') return !had.includes(c);
  if (p.kind === 'name') {
    const want = [...p.word].filter((x) => x === c).length;
    return want > had.filter((x) => x === c).length;
  }
  return true;
}

export function isDone(task: AdventTask, done: Counted, latin: boolean): boolean {
  return done.length >= needed(task, latin);
}

/** the task as Flocke says it */
export function taskText(task: AdventTask, latin: boolean): string {
  const p = plain(task, latin);
  if (p.kind === 'letter') return t(tk('Schreib {n} schöne {c}!'), { n: p.n, c: p.char });
  if (p.kind === 'name') return t(tk('Schreib die Buchstaben von {w}!'), { w: p.word });
  if (p.kind === 'different') return latin ? t(tk('Schreib {n} verschiedene Buchstaben!'), { n: p.n }) : t(tk('Schreib {n} verschiedene Zeichen!'), { n: p.n });
  return latin ? t(tk('Schreib {n} ganz schöne Buchstaben!'), { n: p.n }) : t(tk('Schreib {n} ganz schöne Zeichen!'), { n: p.n });
}

/** the last door that may open today: the date in December up to the 24th, every door at any other time */
export function adventToday(now: Date): number {
  return now.getMonth() === 11 ? Math.min(24, now.getDate()) : 24;
}

/** the earliest closed door up to today, null when all of them are open */
export function currentDay(open: Set<number>, today: number): number | null {
  for (let d = 1; d <= today; d++) if (!open.has(d)) return d;
  return null;
}

/** how often to sleep until a door may open */
export function sleepsUntil(day: number, today: number): number {
  return Math.max(0, day - today);
}

const KEY = 'krakelkrone.advent';

/** the open doors of a year; anything broken or of another year is a closed calendar */
export function loadAdvent(year: number): Record<number, OpenDoor> {
  try {
    const raw = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as { year?: unknown; open?: Record<string, unknown> } | null;
    if (!raw || raw.year !== year || !raw.open || typeof raw.open !== 'object') return {};
    const out: Record<number, OpenDoor> = {};
    for (const [k, v] of Object.entries(raw.open)) {
      const day = Number(k);
      const door = v as Partial<OpenDoor> | null;
      if (Number.isInteger(day) && day >= 1 && day <= 24 && door && typeof door.char === 'string' && typeof door.score === 'number') out[day] = { char: door.char, score: door.score };
    }
    return out;
  } catch {
    return {};
  }
}

export function saveAdvent(year: number, open: Record<number, OpenDoor>): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify({ year, open }));
  } catch {
    // private window or full storage: the doors stay open for this visit
  }
}

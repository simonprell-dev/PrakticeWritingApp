// Which games the start screen offers today. The operator plans it in the admin area (a yearly timeline);
// the app fetches the plan, and these defaults hold until one is saved. Dates are the device's local days,
// the first and the last day included. See docs/superpowers/specs/2026-11-07-saisonwelten-design.md.
import { tk } from '../i18n/i18n.ts';

export type WorldId =
  | 'meer'
  | 'weltraum'
  | 'savanne'
  | 'zauberland'
  | 'duell'
  | 'riesenburg'
  | 'tuerme'
  | 'malen'
  | 'neujahr'
  | 'winter'
  | 'fruehling'
  | 'ostern'
  | 'strand'
  | 'herbst'
  | 'halloween'
  | 'martin'
  | 'weihnachten';

export type SeasonId = 'neujahr' | 'winter' | 'fruehling' | 'ostern' | 'strand' | 'herbst' | 'halloween' | 'martin' | 'weihnachten';

export const SEASON_IDS: SeasonId[] = ['neujahr', 'winter', 'fruehling', 'ostern', 'strand', 'herbst', 'halloween', 'martin', 'weihnachten'];

/** the games of the start screen in its order, then the seasonal worlds through the year */
export const WORLD_IDS: WorldId[] = ['meer', 'weltraum', 'savanne', 'zauberland', 'duell', 'riesenburg', 'tuerme', 'malen', ...SEASON_IDS];

export const SEASONAL: Set<WorldId> = new Set(SEASON_IDS);

/** start tile of a seasonal world (tk-marked, translated where shown) */
export const SEASON_INFO: Record<SeasonId, { icon: string; title: string; hint: string }> = {
  neujahr: { icon: '🎆', title: tk('Neujahr'), hint: tk('Raketen blühen am Himmel auf') },
  winter: { icon: '⛄', title: tk('Winter'), hint: tk('Schneemänner, Pinguine und Eisbären') },
  fruehling: { icon: '🌷', title: tk('Frühling'), hint: tk('Blumen, Bienen und Vögel auf der Wiese') },
  ostern: { icon: '🐣', title: tk('Ostern'), hint: tk('Osterhasen, Küken und bunte Eier') },
  strand: { icon: '🏖️', title: tk('Strand & Sonne'), hint: tk('Krebse, Möwen und Sandburgen') },
  herbst: { icon: '🍂', title: tk('Herbst'), hint: tk('Igel, Eichhörnchen, Füchse und Drachen') },
  halloween: { icon: '🎃', title: tk('Halloween'), hint: tk('Gespenster, Kürbisse und kleine Hexen') },
  martin: { icon: '🏮', title: tk('Sankt Martin'), hint: tk('Ein Laternenzug durchs Dorf') },
  weihnachten: { icon: '🎄', title: tk('Weihnachten'), hint: tk('Wichtel, Rentiere und Geschenke') },
};

export const isWorldId = (v: unknown): v is WorldId => typeof v === 'string' && (WORLD_IDS as string[]).includes(v);

export type WorldMode = 'plan' | 'on' | 'off';

export interface WorldEntry {
  mode: WorldMode;
  /** "MM-DD"; a `to` before `from` runs over New Year */
  from?: string;
  to?: string;
  /** days around Easter Sunday instead of fixed days */
  easter?: { before: number; after: number };
}

export interface WorldPlan {
  version: 1;
  worlds: Record<WorldId, WorldEntry>;
}

/** Easter days may lie this far from the Sunday */
export const EASTER_MAX = 60;

const whole = (from: string, to: string): WorldEntry => ({ mode: 'plan', from, to });

export const DEFAULT_PLAN: WorldPlan = {
  version: 1,
  worlds: {
    meer: { mode: 'on', from: '01-01', to: '12-31' },
    weltraum: { mode: 'on', from: '01-01', to: '12-31' },
    savanne: { mode: 'on', from: '01-01', to: '12-31' },
    zauberland: { mode: 'on', from: '01-01', to: '12-31' },
    duell: { mode: 'on', from: '01-01', to: '12-31' },
    riesenburg: { mode: 'on', from: '01-01', to: '12-31' },
    tuerme: { mode: 'on', from: '01-01', to: '12-31' },
    malen: { mode: 'on', from: '01-01', to: '12-31' },
    neujahr: whole('12-27', '01-06'),
    winter: whole('12-01', '02-29'),
    fruehling: whole('03-20', '05-31'),
    ostern: { mode: 'plan', easter: { before: 14, after: 1 } },
    strand: whole('06-01', '08-31'),
    herbst: whole('09-01', '11-30'),
    halloween: whole('10-15', '11-02'),
    martin: whole('11-01', '11-13'),
    weihnachten: whole('12-01', '12-26'),
  },
};

const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** a valid "MM-DD" (the 29th of February included) */
export function isMonthDay(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d\d-\d\d$/.test(v)) return false;
  const m = Number(v.slice(0, 2));
  const d = Number(v.slice(3));
  return m >= 1 && m <= 12 && d >= 1 && d <= MONTH_DAYS[m - 1];
}

const isEasterDays = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= EASTER_MAX;

function entryOf(raw: unknown): WorldEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;
  if (e.mode !== 'plan' && e.mode !== 'on' && e.mode !== 'off') return null;
  if (e.easter !== undefined) {
    const ea = e.easter as Record<string, unknown> | null;
    if (!ea || !isEasterDays(ea.before) || !isEasterDays(ea.after)) return null;
    return { mode: e.mode, easter: { before: ea.before, after: ea.after } };
  }
  if (!isMonthDay(e.from) || !isMonthDay(e.to)) return null;
  return { mode: e.mode, from: e.from, to: e.to };
}

/** a plan from the server or the browser: every missing or broken world gets its default, unknown ones go */
export function normalizePlan(raw: unknown): WorldPlan {
  const given = raw && typeof raw === 'object' ? ((raw as { worlds?: unknown }).worlds as Record<string, unknown> | undefined) : undefined;
  const worlds = {} as Record<WorldId, WorldEntry>;
  for (const id of WORLD_IDS) {
    const e = given && typeof given === 'object' ? entryOf(given[id]) : null;
    // Easter keeps its kind: fixed days for it, or Easter days for another world, are a broken entry
    const kindOk = e && (id === 'ostern') === !!e.easter;
    worlds[id] = kindOk ? e : structuredClone(DEFAULT_PLAN.worlds[id]);
  }
  return { version: 1, worlds };
}

/** Easter Sunday of a year (Gregorian calendar) */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** the day "MM-DD" in a year; the 29th of February is the 28th in a common year */
function onDay(md: string, year: number): Date {
  const m = Number(md.slice(0, 2)) - 1;
  const d = Number(md.slice(3));
  const last = new Date(year, m + 1, 0).getDate();
  return new Date(year, m, Math.min(d, last));
}

/** the planned time that begins in `year` (it may end in the next one) */
export function rangeIn(entry: WorldEntry, year: number): { from: Date; to: Date } {
  if (entry.easter) {
    const s = easterSunday(year);
    return { from: new Date(year, s.getMonth(), s.getDate() - entry.easter.before), to: new Date(year, s.getMonth(), s.getDate() + entry.easter.after) };
  }
  const from = onDay(entry.from ?? '01-01', year);
  let to = onDay(entry.to ?? '12-31', year);
  if (to < from) to = onDay(entry.to ?? '12-31', year + 1);
  return { from, to };
}

/** the planned time that holds `now`, if one does */
function runningRange(entry: WorldEntry, now: Date): { from: Date; to: Date } | null {
  const today = dayStart(now);
  for (const y of [today.getFullYear() - 1, today.getFullYear()]) {
    const r = rangeIn(entry, y);
    if (today >= r.from && today <= r.to) return r;
  }
  return null;
}

export function isActive(entry: WorldEntry, now: Date): boolean {
  if (entry.mode === 'on') return true;
  if (entry.mode === 'off') return false;
  return runningRange(entry, now) !== null;
}

/** the last day of the running planned time; null when always on, off or not running */
export function activeUntil(entry: WorldEntry, now: Date): Date | null {
  if (entry.mode !== 'plan') return null;
  return runningRange(entry, now)?.to ?? null;
}

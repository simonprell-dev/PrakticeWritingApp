// The yearly plan of the worlds as the app knows it: fetched from the server at start, kept in the browser for
// the next start (and for no internet), the defaults of src/app/worlds.ts until either exists.
import { activeUntil, DEFAULT_PLAN, isActive, normalizePlan, SEASON_IDS, SEASONAL, WORLD_IDS, type WorldId, type WorldPlan } from './worlds.ts';

const KEY = 'krakelkrone.worlds';
/** the start screen does not wait longer for the server */
const WAIT_MS = 2500;

let plan: WorldPlan | null = null;

function stored(): WorldPlan {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? normalizePlan(JSON.parse(raw)) : structuredClone(DEFAULT_PLAN);
  } catch {
    return structuredClone(DEFAULT_PLAN);
  }
}

function keep(p: WorldPlan): void {
  plan = p;
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // private window or full storage: it holds for this visit
  }
}

export function currentPlan(): WorldPlan {
  return (plan ??= stored());
}

/** forget what was read (the next call reads the browser storage again) */
export function resetPlan(): void {
  plan = null;
}

/** asks the server; on any trouble the plan known so far stays */
export async function loadPlan(fetcher: typeof fetch = fetch, timeoutMs = WAIT_MS): Promise<WorldPlan> {
  const before = currentPlan();
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      ctrl?.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    const res = await Promise.race([fetcher('/api/worlds', { signal: ctrl?.signal, cache: 'no-store' }), late]);
    if (!res || !res.ok) return before;
    const body = (await Promise.race([res.json(), late])) as { plan?: unknown } | null;
    if (!body || typeof body !== 'object') return before;
    const next = body.plan ? normalizePlan(body.plan) : structuredClone(DEFAULT_PLAN);
    keep(next);
    return next;
  } catch {
    return before;
  } finally {
    clearTimeout(timer);
  }
}

export function worldActive(id: WorldId, now = new Date()): boolean {
  return isActive(currentPlan().worlds[id], now);
}

/** the last day of a world's running time, null when it is always on or not planned now */
export function worldUntil(id: WorldId, now = new Date()): Date | null {
  return activeUntil(currentPlan().worlds[id], now);
}

/**
 * The games of the start screen today: the seasonal worlds in their time first (through the year), then the
 * others in their usual order. `built` says whether a seasonal world exists in this version of the app.
 */
export function offeredWorlds(now: Date, built: (id: WorldId) => boolean): { id: WorldId; until: Date | null }[] {
  const on = (id: WorldId) => worldActive(id, now) && (!SEASONAL.has(id) || built(id));
  const pick = (ids: WorldId[]) => ids.filter(on).map((id) => ({ id, until: worldUntil(id, now) }));
  return [...pick(SEASON_IDS), ...pick(WORLD_IDS.filter((id) => !SEASONAL.has(id)))];
}

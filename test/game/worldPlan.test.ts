import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { visibleSaves, type SaveMeta } from '../../src/app/saves.ts';
import { currentPlan, loadPlan, offeredWorlds, resetPlan, worldActive } from '../../src/app/worldPlan.ts';
import { DEFAULT_PLAN, type WorldPlan } from '../../src/app/worlds.ts';

const KEY = 'krakelkrone.worlds';
let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
  resetPlan();
});
afterEach(() => {
  delete (globalThis as { localStorage?: unknown }).localStorage;
  resetPlan();
});

const answer = (body: unknown) => (async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;
const halloweenOff = (): WorldPlan => {
  const p = structuredClone(DEFAULT_PLAN);
  p.worlds.halloween = { mode: 'off', from: '10-15', to: '11-02' };
  return p;
};

describe('world plan in the app', () => {
  it('without anything stored the defaults hold', () => {
    expect(currentPlan()).toEqual(DEFAULT_PLAN);
  });

  it('a plan from the server is kept for the next start', async () => {
    await loadPlan(answer({ plan: halloweenOff() }));
    expect(currentPlan().worlds.halloween.mode).toBe('off');
    resetPlan();
    expect(currentPlan().worlds.halloween.mode).toBe('off');
    expect(JSON.parse(store.get(KEY)!).worlds.halloween.mode).toBe('off');
  });

  it('no plan on the server means the defaults', async () => {
    store.set(KEY, JSON.stringify(halloweenOff()));
    resetPlan();
    expect(await loadPlan(answer({ plan: null }))).toEqual(DEFAULT_PLAN);
  });

  it('a server that does not answer keeps the stored plan', async () => {
    store.set(KEY, JSON.stringify(halloweenOff()));
    resetPlan();
    const never = (() => new Promise(() => undefined)) as unknown as typeof fetch;
    const t0 = Date.now();
    const p = await loadPlan(never, 50);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(p.worlds.halloween.mode).toBe('off');
  });

  it('a failing server keeps the stored plan', async () => {
    store.set(KEY, JSON.stringify(halloweenOff()));
    resetPlan();
    const fail = (async () => new Response('nope', { status: 503 })) as unknown as typeof fetch;
    expect((await loadPlan(fail)).worlds.halloween.mode).toBe('off');
    const boom = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect((await loadPlan(boom)).worlds.halloween.mode).toBe('off');
  });

  it('a broken stored plan is the default', () => {
    store.set(KEY, '{kaputt');
    resetPlan();
    expect(currentPlan()).toEqual(DEFAULT_PLAN);
  });

  it('works without a browser storage', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    resetPlan();
    expect(currentPlan()).toEqual(DEFAULT_PLAN);
  });

  it('a world is active in its time only', () => {
    expect(worldActive('halloween', new Date(2026, 9, 20))).toBe(true);
    expect(worldActive('halloween', new Date(2026, 10, 7))).toBe(false);
    expect(worldActive('meer', new Date(2026, 10, 7))).toBe(true);
  });

  it('the saves of a world out of its time are hidden, not lost', () => {
    const meta = (mode: SaveMeta['mode']) => ({ id: mode, name: mode, mode, savedAt: 1, auto: true, summary: '' }) as SaveMeta;
    const list = [meta('halloween'), meta('meer')];
    expect(visibleSaves(list, new Date(2026, 10, 7)).map((m) => m.mode)).toEqual(['meer']);
    expect(visibleSaves(list, new Date(2026, 9, 20)).map((m) => m.mode)).toEqual(['halloween', 'meer']);
  });
});

describe('offered worlds', () => {
  const built = () => true;

  it('the seasonal worlds of the day come first, with their last day', () => {
    const list = offeredWorlds(new Date(2026, 10, 7), built);
    expect(list.slice(0, 2).map((w) => w.id)).toEqual(['herbst', 'martin']);
    expect(list[1].until?.toDateString()).toBe(new Date(2026, 10, 13).toDateString());
    expect(list.slice(2).map((w) => w.id)).toEqual(['meer', 'weltraum', 'savanne', 'zauberland', 'duell', 'riesenburg', 'tuerme', 'malen']);
    expect(list[2].until).toBeNull();
  });

  it('a world that is not built yet is not offered', () => {
    const list = offeredWorlds(new Date(2026, 11, 24), (id) => id !== 'winter');
    expect(list.map((w) => w.id)).toContain('weihnachten');
    expect(list.map((w) => w.id)).not.toContain('winter');
  });

  it('a game switched off is gone, one switched on stays without a last day', () => {
    store.set(KEY, JSON.stringify({ ...DEFAULT_PLAN, worlds: { ...DEFAULT_PLAN.worlds, duell: { mode: 'off', from: '01-01', to: '12-31' }, halloween: { mode: 'on', from: '10-15', to: '11-02' } } }));
    resetPlan();
    const list = offeredWorlds(new Date(2026, 6, 1), built);
    expect(list.map((w) => w.id)).not.toContain('duell');
    expect(list.find((w) => w.id === 'halloween')).toEqual({ id: 'halloween', until: null });
  });
});

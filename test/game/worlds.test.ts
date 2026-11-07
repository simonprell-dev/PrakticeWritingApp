import { describe, expect, it } from 'vitest';
import { activeUntil, DEFAULT_PLAN, easterSunday, isActive, normalizePlan, SEASONAL, WORLD_IDS } from '../../src/app/worlds.ts';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);
const on = (id: keyof typeof DEFAULT_PLAN.worlds, y: number, m: number, d: number) => isActive(DEFAULT_PLAN.worlds[id], day(y, m, d));

describe('world plan', () => {
  it('knows the Easter Sundays', () => {
    expect(easterSunday(2026).toDateString()).toBe(new Date(2026, 3, 5).toDateString());
    expect(easterSunday(2027).toDateString()).toBe(new Date(2027, 2, 28).toDateString());
    expect(easterSunday(2025).toDateString()).toBe(new Date(2025, 3, 20).toDateString());
  });

  it('a time over New Year is active on both sides', () => {
    expect(on('neujahr', 2026, 12, 26)).toBe(false);
    expect(on('neujahr', 2026, 12, 27)).toBe(true);
    expect(on('neujahr', 2026, 12, 31)).toBe(true);
    expect(on('neujahr', 2027, 1, 1)).toBe(true);
    expect(on('neujahr', 2027, 1, 6)).toBe(true);
    expect(on('neujahr', 2027, 1, 7)).toBe(false);
  });

  it('the first and the last day count', () => {
    expect(on('weihnachten', 2026, 12, 1)).toBe(true);
    expect(on('weihnachten', 2026, 12, 26)).toBe(true);
    expect(on('weihnachten', 2026, 12, 27)).toBe(false);
    expect(on('weihnachten', 2026, 11, 30)).toBe(false);
  });

  it('Easter follows its Sunday', () => {
    expect(on('ostern', 2027, 3, 13)).toBe(false);
    expect(on('ostern', 2027, 3, 14)).toBe(true);
    expect(on('ostern', 2027, 3, 29)).toBe(true);
    expect(on('ostern', 2027, 3, 30)).toBe(false);
    expect(on('ostern', 2026, 4, 6)).toBe(true);
  });

  it('the winter keeps the 29th of February', () => {
    expect(on('winter', 2028, 2, 29)).toBe(true);
    expect(on('winter', 2027, 3, 1)).toBe(false);
  });

  it('on is always active and off never', () => {
    expect(isActive({ mode: 'on', from: '01-01', to: '01-01' }, day(2026, 7, 7))).toBe(true);
    expect(isActive({ mode: 'off', from: '01-01', to: '12-31' }, day(2026, 7, 7))).toBe(false);
  });

  it('the old games are always there', () => {
    for (const id of ['meer', 'weltraum', 'savanne', 'zauberland', 'duell', 'riesenburg', 'tuerme', 'malen'] as const) {
      expect(DEFAULT_PLAN.worlds[id].mode).toBe('on');
      expect(SEASONAL.has(id)).toBe(false);
    }
  });

  it('every seasonal world is planned', () => {
    for (const id of WORLD_IDS) if (SEASONAL.has(id)) expect(DEFAULT_PLAN.worlds[id].mode).toBe('plan');
    expect(SEASONAL.size).toBe(9);
  });

  it('tells the last day of the running time', () => {
    expect(activeUntil(DEFAULT_PLAN.worlds.neujahr, day(2026, 12, 31))?.toDateString()).toBe(new Date(2027, 0, 6).toDateString());
    expect(activeUntil(DEFAULT_PLAN.worlds.neujahr, day(2027, 1, 2))?.toDateString()).toBe(new Date(2027, 0, 6).toDateString());
    expect(activeUntil(DEFAULT_PLAN.worlds.martin, day(2026, 11, 7))?.toDateString()).toBe(new Date(2026, 10, 13).toDateString());
    expect(activeUntil(DEFAULT_PLAN.worlds.martin, day(2026, 11, 20))).toBeNull();
    expect(activeUntil(DEFAULT_PLAN.worlds.meer, day(2026, 11, 20))).toBeNull();
  });

  it('a broken or partial plan gets the defaults', () => {
    expect(normalizePlan(null)).toEqual(DEFAULT_PLAN);
    expect(normalizePlan('x')).toEqual(DEFAULT_PLAN);
    const p = normalizePlan({ version: 1, worlds: { weihnachten: { mode: 'kaputt' }, foo: { mode: 'on' }, halloween: { mode: 'off', from: '10-01', to: '10-31' }, ostern: { mode: 'plan', easter: { before: 99, after: 1 } } } });
    expect(p.worlds.weihnachten).toEqual(DEFAULT_PLAN.worlds.weihnachten);
    expect(p.worlds.halloween).toEqual({ mode: 'off', from: '10-01', to: '10-31' });
    expect(p.worlds.ostern).toEqual(DEFAULT_PLAN.worlds.ostern);
    expect('foo' in p.worlds).toBe(false);
    expect(Object.keys(p.worlds).sort()).toEqual([...WORLD_IDS].sort());
  });

  it('a wrong date is no date', () => {
    const p = normalizePlan({ worlds: { herbst: { mode: 'plan', from: '02-30', to: '13-01' } } });
    expect(p.worlds.herbst).toEqual(DEFAULT_PLAN.worlds.herbst);
  });
});

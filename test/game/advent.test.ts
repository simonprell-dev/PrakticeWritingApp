import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  adventToday,
  counts,
  currentDay,
  isDone,
  loadAdvent,
  needed,
  saveAdvent,
  sleepsUntil,
  TASKS,
  taskText,
  type AdventTask,
  type Counted,
} from '../../src/game/advent/advent.ts';

const g = (char: string, tier = 'schoen', extra: Record<string, unknown> = {}) => ({ score: { char, scoredAs: char, tier, tip: 'super', ...extra } }) as never;

describe('advent tasks', () => {
  it('there are 24, and every one has a text', () => {
    expect(TASKS).toHaveLength(24);
    for (const task of TASKS) expect(taskText(task, true).length).toBeGreaterThan(5);
  });

  it('a letter task counts that letter, big or small', () => {
    const task: AdventTask = { kind: 'letter', char: 'K', n: 3 };
    expect(counts(task, g('k'), [], true)).toBe(true);
    expect(counts(task, g('K'), [], true)).toBe(true);
    expect(counts(task, g('L'), [], true)).toBe(false);
  });

  it('crooked, rejected or mirrored letters do not count', () => {
    const task: AdventTask = { kind: 'letter', char: 'K', n: 3 };
    expect(counts(task, g('K', 'schief'), [], true)).toBe(false);
    expect(counts(task, g('K', 'zerknittert'), [], true)).toBe(false);
    expect(counts(task, g('K', 'nett'), [], true)).toBe(true);
    expect(counts(task, g('K', 'schoen', { rejected: true }), [], true)).toBe(false);
    expect(counts(task, g('K', 'schoen', { tip: 'spiegel' }), [], true)).toBe(false);
  });

  it('a nice task wants beautiful letters', () => {
    const task: AdventTask = { kind: 'nice', n: 5 };
    expect(counts(task, g('x', 'nett'), [], true)).toBe(false);
    expect(counts(task, g('x', 'schoen'), [], true)).toBe(true);
    expect(counts(task, g('x', 'prachtvoll'), [], true)).toBe(true);
  });

  it('a different task wants new letters each time', () => {
    const task: AdventTask = { kind: 'different', n: 4 };
    expect(counts(task, g('a'), ['A'], true)).toBe(false);
    expect(counts(task, g('b'), ['A'], true)).toBe(true);
  });

  it('a word task wants each letter of the word once', () => {
    const task: AdventTask = { kind: 'name', word: 'STERN' };
    expect(needed(task, true)).toBe(5);
    expect(counts(task, g('s'), [], true)).toBe(true);
    expect(counts(task, g('S'), ['S'], true)).toBe(false);
    expect(counts(task, g('X'), [], true)).toBe(false);
    const done: Counted = ['S', 'T', 'E', 'R'];
    expect(isDone(task, done, true)).toBe(false);
    expect(isDone(task, [...done, 'N'], true)).toBe(true);
  });

  it('a word with a letter twice wants it twice', () => {
    const task: AdventTask = { kind: 'name', word: 'KEKS' };
    expect(needed(task, true)).toBe(4);
    expect(counts(task, g('k'), ['K'], true)).toBe(true);
    expect(counts(task, g('k'), ['K', 'K'], true)).toBe(false);
  });

  it('without Latin letters every task wants nice or different characters', () => {
    const task: AdventTask = { kind: 'letter', char: 'K', n: 3 };
    expect(needed(task, false)).toBe(3);
    expect(counts(task, g('ა', 'nett'), [], false)).toBe(true);
    expect(counts({ kind: 'name', word: 'STERN' }, g('ა'), ['ა'], false)).toBe(false);
    expect(taskText(task, false)).not.toContain('K');
  });

  it('the tasks grow a little harder', () => {
    const first = needed(TASKS[0], true);
    const last = needed(TASKS[23], true);
    expect(last).toBeGreaterThan(first);
  });
});

describe('advent days', () => {
  it('in December the day is the date', () => {
    expect(adventToday(new Date(2026, 11, 5))).toBe(5);
    expect(adventToday(new Date(2026, 11, 24))).toBe(24);
  });

  it('after the 24th and outside December every door may open', () => {
    expect(adventToday(new Date(2026, 11, 28))).toBe(24);
    expect(adventToday(new Date(2026, 6, 1))).toBe(24);
  });

  it('the task is the earliest closed door up to today', () => {
    expect(currentDay(new Set([1, 2, 3, 4]), 7)).toBe(5);
    expect(currentDay(new Set([1, 2, 3, 4, 5, 6, 7]), 7)).toBeNull();
    expect(currentDay(new Set(), 1)).toBe(1);
  });

  it('tells how often to sleep until a door', () => {
    expect(sleepsUntil(10, 7)).toBe(3);
    expect(sleepsUntil(7, 7)).toBe(0);
  });
});

describe('advent storage', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
  });
  afterEach(() => delete (globalThis as { localStorage?: unknown }).localStorage);

  it('keeps the open doors of this year', () => {
    saveAdvent(2026, { 1: { char: 'K', score: 88 }, 3: { char: 'a', score: 70 } });
    expect(loadAdvent(2026)).toEqual({ 1: { char: 'K', score: 88 }, 3: { char: 'a', score: 70 } });
  });

  it('a new year starts with closed doors', () => {
    saveAdvent(2026, { 1: { char: 'K', score: 88 } });
    expect(loadAdvent(2027)).toEqual({});
  });

  it('broken or foreign contents are an empty calendar', () => {
    store.set('krakelkrone.advent', '{kaputt');
    expect(loadAdvent(2026)).toEqual({});
    store.set('krakelkrone.advent', JSON.stringify({ year: 2026, open: { 99: { char: 'K', score: 1 }, 2: 'x', 4: { char: 'a', score: 50 } } }));
    expect(loadAdvent(2026)).toEqual({ 4: { char: 'a', score: 50 } });
  });

  it('works without a browser storage', () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(loadAdvent(2026)).toEqual({});
    expect(() => saveAdvent(2026, { 1: { char: 'K', score: 88 } })).not.toThrow();
  });
});

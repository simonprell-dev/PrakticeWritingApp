import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/game/rng.ts';
import { RECENT, TaskPicker, taskKey, taskText, type MathTask, type TaskKind } from '../../src/game/math/tasks.ts';

const draw = (kinds: TaskKind[], n: number, seed = 1) => {
  const p = new TaskPicker(mulberry32(seed), kinds);
  return Array.from({ length: n }, () => p.next());
};

const CORE = new Set([0, 1, 2, 5, 10]);
const isCore = (a: number, b: number) => a <= 10 && b <= 10 && (CORE.has(a) || CORE.has(b) || a === b);

describe('TaskPicker', () => {
  it('every kind stays in its bounds', () => {
    for (const t of draw(['plus20'], 2000)) {
      expect(t.op).toBe('+');
      expect(t.a + t.b).toBeLessThanOrEqual(20);
      expect(t.result).toBe(t.a + t.b);
    }
    for (const t of draw(['minus20'], 2000)) {
      expect(t.op).toBe('−');
      expect(t.a).toBeLessThanOrEqual(20);
      expect(t.result).toBe(t.a - t.b);
      expect(t.result).toBeGreaterThanOrEqual(0);
    }
    let carry = 0;
    const pm = draw(['pm100'], 2000);
    for (const t of pm) {
      for (const v of [t.a, t.b, t.result]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
      expect(t.result).toBe(t.op === '+' ? t.a + t.b : t.a - t.b);
      const crosses = t.op === '+' ? (t.a % 10) + (t.b % 10) >= 10 : t.a % 10 < t.b % 10;
      if (crosses) carry++;
    }
    expect(carry / pm.length).toBeGreaterThanOrEqual(0.2);
    const mal = draw(['mal'], 2000);
    for (const t of mal) {
      expect(t.op).toBe('·');
      expect(isCore(t.a, t.b)).toBe(true);
      expect(t.result).toBe(t.a * t.b);
    }
    expect(mal.some((t) => t.a === 5 && t.b === 7)).toBe(true);
    expect(mal.some((t) => t.a === 7 && t.b === 5)).toBe(true);
    for (const t of draw(['geteilt'], 2000)) {
      expect(t.op).toBe(':');
      expect(t.b).not.toBe(0);
      expect(t.a % t.b).toBe(0);
      expect(t.result).toBe(t.a / t.b);
      expect(isCore(t.result, t.b)).toBe(true);
    }
  });

  it('no repeat within 15', () => {
    const keys = draw(['plus20', 'minus20', 'pm100', 'mal'], 500, 3).map(taskKey);
    for (let i = 0; i + RECENT < keys.length; i++) expect(new Set(keys.slice(i, i + RECENT + 1)).size).toBe(RECENT + 1);
  });

  it('kinds roughly balanced', () => {
    const ts = draw(['plus20', 'mal', 'pm100'], 3000, 4);
    for (const k of ['plus20', 'mal', 'pm100'] as TaskKind[]) {
      const share = ts.filter((t) => t.kind === k).length / ts.length;
      expect(share).toBeGreaterThan(0.25);
      expect(share).toBeLessThan(0.42);
    }
  });

  it('small pool does not hang', () => {
    const t0 = performance.now();
    const keys = draw(['geteilt'], 200, 5).map(taskKey);
    expect(performance.now() - t0).toBeLessThan(200);
    const pool = new Set(keys).size;
    const last = new Map<string, number>();
    let minGap = Infinity;
    keys.forEach((k, i) => {
      if (last.has(k)) minGap = Math.min(minGap, i - last.get(k)!);
      last.set(k, i);
    });
    expect(minGap).toBeGreaterThanOrEqual(Math.min(RECENT, pool - 1));
  });

  it('trivial tasks are rare', () => {
    const trivial = (t: MathTask) =>
      (t.op === '+' && t.a === 0 && t.b === 0) ||
      (t.op === '·' && ((t.a === 1 && t.b === 1) || (t.a === 0 && t.b === 0))) ||
      (t.op === '−' && (t.b === 0 || t.a === t.b));
    for (const k of ['plus20', 'minus20', 'mal'] as TaskKind[]) {
      const ts = draw([k], 3000, 6);
      expect(ts.filter(trivial).length / ts.length).toBeLessThanOrEqual(0.03);
    }
  });

  it('again brings the task back', () => {
    const p = new TaskPicker(mulberry32(8), ['plus20', 'minus20']);
    const t = p.next();
    p.again(t);
    const next = Array.from({ length: 24 }, () => taskKey(p.next()));
    const at = next.map((k, i) => (k === taskKey(t) ? i + 1 : -1)).filter((i) => i > 0);
    expect(at.length).toBe(1);
    expect(at[0]).toBeGreaterThanOrEqual(RECENT + 1);
  });

  it('export/from round-trips recent and the again queue', () => {
    const p = new TaskPicker(mulberry32(9), ['plus20']);
    for (let i = 0; i < 5; i++) p.next();
    const t = p.next();
    p.again(t);
    const q = TaskPicker.from(JSON.parse(JSON.stringify(p.export())), mulberry32(9), ['plus20']);
    expect(q.recent).toEqual(p.recent);
    expect(q.export()).toEqual(p.export());
  });

  it('taskKey treats swapped tasks as the same, taskText reads well', () => {
    const a: MathTask = { kind: 'plus20', a: 7, b: 5, op: '+', result: 12 };
    const b: MathTask = { ...a, a: 5, b: 7 };
    expect(taskKey(a)).toBe(taskKey(b));
    expect(taskText(a)).toBe('7 + 5');
    const m: MathTask = { kind: 'minus20', a: 12, b: 5, op: '−', result: 7 };
    expect(taskKey(m)).not.toBe(taskKey({ ...m, a: 5, b: 12 }));
  });
});

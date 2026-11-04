// Rechenmeer: random arithmetic tasks for grades 1/2 (LehrplanPLUS Bayern), never the same one within 15.
import type { Rand } from '../rng.ts';

export type TaskKind = 'plus20' | 'minus20' | 'pm100' | 'mal' | 'geteilt';
export const TASK_KINDS: readonly TaskKind[] = ['plus20', 'minus20', 'pm100', 'mal', 'geteilt'];

export interface MathTask {
  kind: TaskKind;
  a: number;
  b: number;
  op: '+' | '−' | '·' | ':';
  result: number;
}

/** a task comes back at the earliest after this many others */
export const RECENT = 15;
/** tries to find a task that was not asked lately */
const TRIES = 40;

/** the same for swapped tasks (5 + 7 and 7 + 5) */
export function taskKey(t: MathTask): string {
  if (t.op === '+' || t.op === '·') {
    const [x, y] = t.a <= t.b ? [t.a, t.b] : [t.b, t.a];
    return `${x}${t.op}${y}`;
  }
  return `${t.a}${t.op}${t.b}`;
}

export function taskText(t: MathTask): string {
  return `${t.a} ${t.op} ${t.b}`;
}

const int = (r: Rand, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const CORE = [0, 1, 2, 5, 10];

function plus20(r: Rand): MathTask {
  // now and then a task with 0, never 0 + 0
  const zero = r() < 0.03;
  const a = zero ? int(r, 1, 20) : int(r, 1, 19);
  const b = zero ? 0 : int(r, 1, 20 - a);
  const [x, y] = r() < 0.5 ? [a, b] : [b, a];
  return { kind: 'plus20', a: x, b: y, op: '+', result: x + y };
}

function minus20(r: Rand): MathTask {
  // never x − 0 or x − x
  const a = int(r, 2, 20);
  const b = int(r, 1, a - 1);
  return { kind: 'minus20', a, b, op: '−', result: a - b };
}

function pm100(r: Rand): MathTask {
  const plus = r() < 0.5;
  const form = int(r, 0, 3);
  let a: number;
  let b: number;
  if (plus) {
    if (form === 0) {
      // tens plus tens: 30 + 20
      a = 10 * int(r, 1, 8);
      b = 10 * int(r, 1, 9 - a / 10);
    } else if (form === 1) {
      // two-digit plus one-digit, with and without crossing the ten
      a = int(r, 11, 94);
      b = int(r, 1, Math.min(9, 100 - a));
    } else if (form === 2) {
      // two-digit plus tens
      a = int(r, 11, 89);
      b = 10 * int(r, 1, Math.floor((100 - a) / 10));
    } else {
      // two two-digit numbers
      a = int(r, 11, 78);
      b = int(r, 11, 100 - a - 1 < 11 ? 11 : 100 - a - 1);
      if (a + b > 100) b = 100 - a;
    }
    return { kind: 'pm100', a, b, op: '+', result: a + b };
  }
  if (form === 0) {
    a = 10 * int(r, 2, 10);
    b = 10 * int(r, 1, a / 10 - 1);
  } else if (form === 1) {
    a = int(r, 21, 99);
    b = int(r, 1, 9);
  } else if (form === 2) {
    a = int(r, 21, 99);
    b = 10 * int(r, 1, Math.floor(a / 10) - 1);
  } else {
    a = int(r, 22, 99);
    b = int(r, 11, a - 1);
  }
  return { kind: 'pm100', a, b, op: '−', result: a - b };
}

/** a core multiplication: a factor from 0, 1, 2, 5, 10 or a square, both orders */
function corePair(r: Rand, allowZero: boolean): [number, number] {
  if (r() < 0.25) {
    const s = int(r, 2, 10);
    return [s, s];
  }
  let c: number;
  do c = CORE[int(r, 0, CORE.length - 1)];
  while (c === 0 && (!allowZero || r() < 0.7));
  let o: number;
  // 1 · 1 and 0 · x with a small other factor are rare
  do o = int(r, 1, 10);
  while ((c === 1 && o === 1) || (c === 0 && o === 1));
  return r() < 0.5 ? [c, o] : [o, c];
}

function mal(r: Rand): MathTask {
  const [a, b] = corePair(r, true);
  return { kind: 'mal', a, b, op: '·', result: a * b };
}

function geteilt(r: Rand): MathTask {
  let q: number;
  let d: number;
  do [q, d] = corePair(r, false);
  while (q === 0 || d === 0 || (q === 1 && d === 1));
  return { kind: 'geteilt', a: q * d, b: d, op: ':', result: q };
}

const MAKERS: Record<TaskKind, (r: Rand) => MathTask> = { plus20, minus20, pm100, mal, geteilt };

interface Again {
  task: MathTask;
  /** draws until it is due */
  due: number;
}

export interface PickerSave {
  recent: string[];
  again: Again[];
  bag: TaskKind[];
}

export class TaskPicker {
  recent: string[] = [];
  private again_: Again[] = [];
  private bag: TaskKind[] = [];
  private readonly rand: Rand;
  private readonly kinds: TaskKind[];

  constructor(rand: Rand, kinds: TaskKind[]) {
    this.rand = rand;
    const valid = kinds.filter((k) => TASK_KINDS.includes(k));
    this.kinds = valid.length ? [...new Set(valid)] : ['plus20'];
  }

  /** the kinds are drawn from a shuffled bag, so each comes about equally often */
  private nextKind(): TaskKind {
    if (!this.bag.length) {
      this.bag = [...this.kinds];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rand() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop()!;
  }

  next(): MathTask {
    for (const a of this.again_) a.due--;
    const dueAt = this.again_.findIndex((a) => a.due <= 0 && !this.recent.includes(taskKey(a.task)));
    let task: MathTask;
    if (dueAt >= 0) task = this.again_.splice(dueAt, 1)[0].task;
    else {
      const kind = this.nextKind();
      let best: MathTask | null = null;
      let bestAge = -1;
      for (let i = 0; i < TRIES; i++) {
        const t = MAKERS[kind](this.rand);
        const at = this.recent.lastIndexOf(taskKey(t));
        if (at < 0) {
          best = t;
          break;
        }
        // all asked lately (a small pool): the one asked longest ago
        const age = this.recent.length - at;
        if (age > bestAge) {
          bestAge = age;
          best = t;
        }
      }
      task = best!;
    }
    this.recent.push(taskKey(task));
    if (this.recent.length > RECENT) this.recent.shift();
    return task;
  }

  /** a task that was solved by the game comes back later, after the usual gap */
  again(t: MathTask): void {
    this.again_.push({ task: t, due: RECENT + 1 + Math.floor(this.rand() * 4) });
  }

  export(): PickerSave {
    return { recent: [...this.recent], again: this.again_.map((a) => ({ task: { ...a.task }, due: a.due })), bag: [...this.bag] };
  }

  static from(data: PickerSave, rand: Rand, kinds: TaskKind[]): TaskPicker {
    const p = new TaskPicker(rand, kinds);
    p.recent = Array.isArray(data?.recent) ? data.recent.slice(-RECENT) : [];
    p.again_ = Array.isArray(data?.again) ? data.again.filter((a) => p.kinds.includes(a.task.kind)) : [];
    p.bag = Array.isArray(data?.bag) ? data.bag.filter((k) => p.kinds.includes(k)) : [];
    return p;
  }
}

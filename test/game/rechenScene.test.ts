import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS } from '../../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import type { MathTask } from '../../src/game/math/tasks.ts';
import { tierOf } from '../../src/recog/score.ts';
import { RechenScene, type RechenSave } from '../../src/scenes/rechenmeer.ts';
import type { SceneHost } from '../../src/scenes/scene.ts';
import type { ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

let gid = 1;
function digit(ch: string, x: number, opts: { y?: number; L?: number; mirrored?: boolean; score?: number } = {}): ScannedGlyph {
  const id = gid++;
  const score = opts.score ?? 75;
  return {
    id,
    box: { x, y: opts.y ?? 100, w: 30, h: 40 },
    regionId: 0,
    dots: 0,
    crop: { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i * 7 + id * 13) & 255) },
    score: {
      score,
      tier: tierOf(score),
      parts: { L: opts.L ?? 0.95, T: 1, S: 1, P: 1 },
      char: ch,
      scoredAs: ch,
      tip: opts.mirrored ? 'spiegel' : 'super',
      mirrored: opts.mirrored,
    },
    isNew: true,
  } as ScannedGlyph;
}

/** the digits of a number, side by side */
const num = (n: number, x0 = 100, y = 100) => [...String(n)].map((ch, i) => digit(ch, x0 + i * 36, { y }));

function host(noMirror = false, kinds = DEFAULTS.math.kinds): SceneHost {
  const settings = structuredClone(DEFAULTS);
  settings.recog.noMirror = noMirror;
  settings.math.kinds = [...kinds];
  return { settings, toast() {}, showCard() {}, progress() {} } as unknown as SceneHost;
}

function scene(noMirror = false): RechenScene {
  return new RechenScene(host(noMirror), 1920, 7);
}

const stickers = () => new Map<number, AnyCanvas>();
const right = (s: RechenScene) => s.answer(num(s.task!.result), stickers());
const wrong = (s: RechenScene) => s.answer(num(s.task!.result === 99 ? 98 : s.task!.result + 1), stickers());
const run = (s: RechenScene, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) s.update(1 / 30);
};
/** creatures and plants that are staying */
const life = (s: RechenScene) => s.creatures.filter((c) => !c.leaving).length + s.plants.filter((p) => !p.fade).length;

describe('Rechenmeer scene', () => {
  // Node has no createImageBitmap: saved pictures are decoded with @napi-rs/canvas instead
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())), { close() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('starts with a task, no practice letter and no surprise letters', () => {
    const s = scene();
    expect(s.task).not.toBeNull();
    expect(s.practiceTarget).toBeUndefined();
    expect(s.bonusLetters()).toEqual([]);
    expect(['plus20', 'minus20']).toContain(s.task!.kind);
  });

  it('right answer adds a creature or plant and a pearl, then a new task', () => {
    const s = scene();
    const before = s.task!;
    expect(right(s)).toBe('right');
    expect(life(s)).toBe(1);
    expect(s.pearls).toBe(1);
    expect(s.task).not.toBe(before);
  });

  it('ten right answers start a visitor; scans are busy; afterwards a new task and pearls 0', () => {
    const s = scene();
    for (let i = 0; i < 10; i++) expect(right(s)).toBe('right');
    expect(s.visitor?.kind).toBe('hai');
    expect(s.task).toBeNull();
    expect(s.answer(num(5), stickers())).toBe('busy');
    run(s, 11);
    expect(s.visitor).toBeNull();
    expect(s.task).not.toBeNull();
    expect(s.pearls).toBe(0);
    expect(s.section).toBe(1);
  });

  it('visitors alternate shark, dolphins', () => {
    const s = scene();
    const seen: string[] = [];
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < 10; i++) right(s);
      seen.push(s.visitor!.kind);
      run(s, 11);
    }
    expect(seen).toEqual(['hai', 'delfine', 'hai']);
  });

  it('wrong answer: no creature lost, misses 1, same task', () => {
    const s = scene();
    right(s);
    const task = s.task;
    expect(wrong(s)).toBe('wrong');
    expect(s.task).toBe(task);
    expect(s.misses).toBe(1);
    expect(life(s)).toBe(1);
    expect(s.pearls).toBe(1);
  });

  it('third miss shows the solution, then a new task; the old one comes back later; no pearl', () => {
    const s = scene();
    const task = s.task!;
    wrong(s);
    wrong(s);
    expect(s.misses).toBe(2);
    expect(wrong(s)).toBe('wrong');
    expect(s.reveal?.task).toBe(task);
    expect(s.answer(num(task.result), stickers())).toBe('busy');
    run(s, 5);
    expect(s.reveal).toBeNull();
    expect(s.task).not.toBe(task);
    expect(s.pearls).toBe(0);
    expect(life(s)).toBe(0);
    const key = (t: MathTask) => `${Math.min(t.a, t.b)}${t.op}${Math.max(t.a, t.b)}|${t.a}${t.op}${t.b}`;
    let back = false;
    for (let i = 0; i < 25 && !back; i++) {
      if (key(s.task!) === key(task) || (s.task!.op === task.op && s.task!.a === task.a && s.task!.b === task.b)) back = true;
      else right(s), s.visitor && run(s, 11);
    }
    expect(back).toBe(true);
  });

  it('"3" then "2" for 23 is right with no miss', () => {
    const s = scene();
    s.task = { kind: 'pm100', a: 20, b: 3, op: '+', result: 23 };
    expect(s.answer([digit('3', 140)], stickers())).toBe('partial');
    expect(s.misses).toBe(0);
    expect(s.answer([digit('2', 104)], stickers())).toBe('right');
    expect(s.misses).toBe(0);
    expect(s.pearls).toBe(1);
  });

  it('mirrored digit with right result counts, tip is spiegel, even with settings.recog.noMirror', () => {
    const s = scene(true);
    s.task = { kind: 'plus20', a: 10, b: 3, op: '+', result: 13 };
    const three = digit('3', 136, { mirrored: true });
    expect(s.answer([digit('1', 100), three], stickers())).toBe('right');
    expect(s.lastTip).toBe('spiegel');
    expect(life(s)).toBe(1);
  });

  it('unsure and several keep the task and count no miss', () => {
    const s = scene();
    const task = s.task;
    expect(s.answer([digit('7', 100, { L: 0.1 })], stickers())).toBe('unsure');
    expect(s.answer([digit('1', 100), digit('2', 600, { y: 400 })], stickers())).toBe('several');
    expect(s.answer([], stickers())).toBe('none');
    expect(s.task).toBe(task);
    expect(s.misses).toBe(0);
  });

  it('plants stay at 12', () => {
    const s = scene();
    s.plantShare = 1;
    for (let i = 0; i < 16; i++) {
      right(s);
      if (s.visitor) run(s, 11);
      run(s, 0.2);
    }
    run(s, 3);
    expect(s.plants.length).toBe(12);
  });

  it('save during a visitor and with pending digits restores task, pearls, creatures, plants; no visitor; pending empty', async () => {
    const s = scene();
    for (let i = 0; i < 7; i++) right(s);
    s.task = { kind: 'pm100', a: 20, b: 3, op: '+', result: 23 };
    expect(s.answer([digit('3', 140)], stickers())).toBe('partial');
    const saved = await s.saveState();
    expect(saved).not.toBeNull();
    const t = new RechenScene(host(false, ['plus20', 'minus20', 'pm100']), 1920, 8);
    await t.restoreState(JSON.parse(JSON.stringify(saved!.state)) as RechenSave);
    expect(t.task).toEqual(s.task);
    expect(t.pearls).toBe(7);
    expect(life(t)).toBe(life(s));
    expect(t.pending).toBeNull();
    expect(t.visitor).toBeNull();

    // saved while the shark is there: the next section starts with a new task
    s.pending = null;
    for (let i = 0; i < 3; i++) right(s);
    expect(s.visitor).not.toBeNull();
    const during = await s.saveState();
    const u = new RechenScene(host(), 1920, 9);
    await u.restoreState(JSON.parse(JSON.stringify(during!.state)) as RechenSave);
    expect(u.visitor).toBeNull();
    expect(u.task).not.toBeNull();
    expect(u.pearls).toBe(0);
    expect(u.section).toBe(1);
  });

  it('a scan flies the digits and the animal appears when they land', () => {
    const s = scene();
    const snap = { canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 640, detH: 480 };
    const gs = num(s.task!.result);
    s.handleScan({ glyphs: gs, newSheet: false } as unknown as Parameters<RechenScene['handleScan']>[0], snap);
    expect(life(s)).toBe(0);
    run(s, 6);
    expect(life(s)).toBe(1);
    expect(s.pearls).toBe(1);
  });
});

describe('Rechenmeer review fixes', () => {
  const res = (glyphs: ScannedGlyph[], shift = { dx: 0, dy: 0 }) => ({ glyphs, newSheet: false, shift }) as unknown as Parameters<RechenScene['handleScan']>[0];
  const snap = () => ({ canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 640, detH: 480 });

  it('a scan taken for one task is not judged against the next one', () => {
    const s = scene();
    const asked = s.task!;
    s.task = { kind: 'plus20', a: 1, b: 1, op: '+', result: 2 };
    expect(s.answer(num(asked.result === 3 ? 4 : 3), stickers(), undefined, asked)).toBe('busy');
    expect(s.misses).toBe(0);
    // the photo taken while the solution was shown: judged against nothing
    const t = scene();
    for (let i = 0; i < 3; i++) wrong(t);
    t.beginCapture(snap());
    run(t, 5);
    const before = t.task;
    t.handleScan(res(num(12)), snap());
    run(t, 6);
    expect(t.task).toBe(before);
    expect(t.misses).toBe(0);
  });

  it('pending digits follow the paper when it moves', () => {
    const s = scene();
    s.task = { kind: 'pm100', a: 20, b: 3, op: '+', result: 23 };
    s.handleScan(res([digit('3', 140)]), snap());
    run(s, 6);
    expect(s.pending?.length).toBe(1);
    // the sheet moved 30 px down; the "2" is written left of the moved "3"
    s.handleScan(res([digit('2', 104, { y: 130 })], { dx: 0, dy: 30 }), snap());
    run(s, 6);
    expect(s.misses).toBe(0);
    expect(s.pearls).toBe(1);
  });

  it('changing the task kinds in the settings applies at once', () => {
    const s = scene();
    s.host.settings.math.kinds = ['mal'];
    s.applySettings();
    expect(s.task!.kind).toBe('mal');
    for (let i = 0; i < 5; i++) {
      right(s);
      expect(s.task!.kind).toBe('mal');
    }
  });

  it('the task reads left to right also in Arabic and Hebrew', () => {
    const s = scene();
    s.task = { kind: 'minus20', a: 12, b: 5, op: '−', result: 7 };
    wrong(s);
    expect(s.note!.text).toContain('⁦12 − 5⁩');
    const c = createCanvas(1920, 1080);
    const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
    const dirs: string[] = [];
    const fill = ctx.fillText.bind(ctx);
    ctx.fillText = (text: string, x: number, y: number) => {
      if (text.includes('12 − 5 =')) dirs.push(ctx.direction);
      fill(text, x, y);
    };
    ctx.direction = 'rtl';
    s.render(ctx);
    expect(dirs.length).toBeGreaterThan(0);
    for (const d of dirs) expect(d).toBe('ltr');
  });

  it('a half number is judged when Fertig is pressed again without new digits', () => {
    const s = scene();
    s.task = { kind: 'plus20', a: 8, b: 5, op: '+', result: 13 };
    expect(s.answer([digit('3', 140)], stickers())).toBe('partial');
    expect(s.note).not.toBeNull();
    s.handleScan(res([{ ...digit('3', 140), isNew: false }]), snap());
    run(s, 2);
    expect(s.misses).toBe(1);
    expect(s.pending).toBeNull();
  });
});

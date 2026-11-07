// The advent calendar scene: letters open today's door, nothing else does, and the device remembers it.
import { createCanvas, Path2D, type Canvas } from '@napi-rs/canvas';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/app/settings.ts';
import { loadAdvent } from '../../src/game/advent/advent.ts';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { makeGenome } from '../../src/game/creatures/genome.ts';
import { tierOf } from '../../src/recog/score.ts';
import { advent, AdventScene, SURPRISES } from '../../src/scenes/advent.ts';
import type { SceneHost } from '../../src/scenes/scene.ts';
import type { TileKit } from '../../src/scenes/seasons/kit.ts';
import type { ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  };
});
afterEach(() => delete (globalThis as { localStorage?: unknown }).localStorage);

let gid = 1;
function glyph(char: string, score = 80): ScannedGlyph {
  const id = gid++;
  const data = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i * 7 + id * 13) & 255);
  return {
    id,
    box: { x: 100, y: 100, w: 40, h: 40 },
    regionId: 0,
    dots: 0,
    crop: { width: 16, height: 16, data },
    score: { score, tier: tierOf(score), parts: { L: 1, T: 1, S: 1, P: 1 }, char, scoredAs: char, tip: 'super' },
    isNew: true,
  } as unknown as ScannedGlyph;
}
const sticker = () => createCanvas(20, 24) as unknown as AnyCanvas;

function scene(now = new Date(2026, 11, 5, 9)): AdventScene {
  const settings = structuredClone(DEFAULTS);
  const host = { settings, toast() {}, showCard() {}, progress() {} } as unknown as SceneHost;
  return new AdventScene(host, 1920, now);
}

function run(s: AdventScene, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) s.update(1 / 30);
}

describe('advent calendar scene', () => {
  it('has a surprise and a joke for every door', () => {
    expect(SURPRISES).toHaveLength(24);
    for (const s of SURPRISES) expect(s.joke.length).toBeGreaterThan(10);
  });

  it('starts at the earliest closed door up to today', () => {
    expect(scene().day).toBe(1);
  });

  it('three nice S open the first door, and the device remembers it', () => {
    const s = scene();
    expect(s.feed(glyph('S'), sticker())).toBe(true);
    expect(s.feed(glyph('s'), sticker())).toBe(true);
    expect(s.open[1]).toBeUndefined();
    expect(s.feed(glyph('S', 95), sticker())).toBe(true);
    run(s, 8);
    expect(s.open[1]).toEqual({ char: 'S', score: 95 });
    expect(loadAdvent(2026)[1]).toEqual({ char: 'S', score: 95 });
    expect(s.day).toBe(2);
  });

  it('wrong or crooked letters do not count', () => {
    const s = scene();
    expect(s.feed(glyph('T'), sticker())).toBe(false);
    expect(s.feed(glyph('S', 30), sticker())).toBe(false);
    expect(s.counted).toEqual([]);
  });

  it('a future door stays shut and Flocke says how often to sleep', () => {
    const s = scene();
    const d = s.doorAt(8);
    expect(s.tap(d.x + d.w / 2, d.y + d.h / 2)).toBe(true);
    expect(s.day).toBe(1);
    expect(s.flocke).toContain('3');
  });

  it('a missed door can be chosen', () => {
    const s = scene();
    const d = s.doorAt(4);
    s.tap(d.x + d.w / 2, d.y + d.h / 2);
    expect(s.day).toBe(4);
  });

  it('the doors stay open on the next visit, with their figure', () => {
    const s = scene();
    for (let k = 0; k < 3; k++) s.feed(glyph('S'), sticker());
    run(s, 8);
    const again = scene(new Date(2026, 11, 6, 9));
    expect(again.open[1]).toBeDefined();
    expect(again.day).toBe(2);
    expect(again.creatures.length).toBeGreaterThanOrEqual(1);
  });

  it('all 24 doors: the finale runs and nothing becomes NaN', () => {
    const doors: Record<number, { char: string; score: number }> = {};
    for (let d = 1; d <= 23; d++) doors[d] = { char: 'A', score: 80 };
    store.set('krakelkrone.advent', JSON.stringify({ year: 2026, open: doors }));
    const s = scene(new Date(2026, 11, 24, 9));
    expect(s.day).toBe(24);
    for (const c of 'WEIHNACHTEN') s.feed(glyph(c), sticker());
    const ctx = createCanvas(1920, 1080).getContext('2d') as unknown as CanvasRenderingContext2D;
    for (let t = 0; t < 30; t += 1 / 30) {
      s.update(1 / 30);
      for (const c of s.creatures) expect(Number.isFinite(c.x) && Number.isFinite(c.y)).toBe(true);
    }
    s.render(ctx);
    expect(s.open[24]).toBeDefined();
    expect(s.day).toBeNull();
  });

  it('paints its background and its start tile', () => {
    const inked = (c: Canvas) => {
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
      return n / (c.width * c.height);
    };
    const bg = createCanvas(1920, 1080);
    advent.paint(bg.getContext('2d') as unknown as CanvasRenderingContext2D, 1920, 1080);
    expect(inked(bg)).toBeGreaterThan(0.99);
    const tile = createCanvas(480, 360);
    const kit: TileKit = {
      draw: (k, sp, x, y, sc) => {
        k.save();
        k.translate(x, y);
        k.scale(sc, sc);
        k.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
        k.restore();
      },
      genome: (score, seed) => makeGenome(score, tierOf(score), seed, 'season'),
      sticker,
    };
    advent.tile!(tile.getContext('2d') as unknown as CanvasRenderingContext2D, 480, 360, kit);
    expect(inked(tile)).toBeGreaterThan(0.99);
  });
});

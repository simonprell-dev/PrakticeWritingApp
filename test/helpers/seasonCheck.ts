// The checks every seasonal world must pass: its creatures draw, its background paints, and a scene full of them
// runs for a while without anybody leaving the world or turning into NaN.
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import type { HabitatDef } from '../../src/scenes/habitat.ts';
import { DEFAULTS } from '../../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { makeGenome } from '../../src/game/creatures/genome.ts';
import { tierOf } from '../../src/recog/score.ts';
import { HabitatScene } from '../../src/scenes/habitat.ts';
import type { SceneHost } from '../../src/scenes/scene.ts';
import type { TileKit } from '../../src/scenes/seasons/kit.ts';
import type { ScannedGlyph, Tier } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

const TIERS: [Tier, number][] = [
  ['zerknittert', 8],
  ['schief', 35],
  ['nett', 60],
  ['schoen', 80],
  ['prachtvoll', 97],
];

let gid = 1;
function glyph(score: number): ScannedGlyph {
  const id = gid++;
  const data = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i * 7 + id * 13) & 255);
  return {
    id,
    box: { x: 100, y: 100, w: 40, h: 40 },
    regionId: 0,
    dots: 0,
    crop: { width: 16, height: 16, data },
    score: {
      score,
      tier: tierOf(score),
      parts: { L: 1, T: 1, S: 1, P: 1 },
      char: 'a',
      scoredAs: 'a',
      tip: 'super',
    },
    isNew: true,
  } as unknown as ScannedGlyph;
}

const sticker = () => {
  const c = createCanvas(40, 46);
  const x = c.getContext('2d');
  x.fillStyle = '#23236b';
  x.fillRect(10, 8, 20, 30);
  return c as unknown as AnyCanvas;
};

/** share of pixels that are not transparent */
function inked(c: AnyCanvas): number {
  const x = (c as unknown as ReturnType<typeof createCanvas>).getContext('2d');
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++;
  return n / (c.width * c.height);
}

export function checkSeasonWorld(id: string, def: HabitatDef | undefined): void {
  describe(id, () => {
    it('knows its own id and the season archetype', () => {
      expect(def!.id).toBe(id);
      expect(def!.archetype).toBe('season');
    });

    it('draws every kind at every tier', () => {
      for (const [tier, score] of TIERS)
        for (let seed = 1; seed <= 48; seed++) {
          const g = makeGenome(score, tier, seed, 'season');
          const sp = def!.makeSprite(g, sticker());
          expect(sp.canvas.width).toBeGreaterThan(10);
          expect(sp.canvas.height).toBeGreaterThan(10);
          expect(inked(sp.canvas)).toBeGreaterThan(0.08);
          expect(Number.isFinite(sp.ax) && Number.isFinite(sp.ay) && Number.isFinite(sp.radius)).toBe(true);
        }
    });

    it('paints its background', () => {
      const c = createCanvas(1920, 1080);
      def!.paint(c.getContext('2d') as unknown as CanvasRenderingContext2D, 1920, 1080);
      expect(inked(c as unknown as AnyCanvas)).toBeGreaterThan(0.99);
    });

    it('draws its start tile', () => {
      expect(def!.tile).toBeTypeOf('function');
      const c = createCanvas(480, 360);
      const ctx = c.getContext('2d') as unknown as CanvasRenderingContext2D;
      const kit: TileKit = {
        draw: (k, sp, x, y, s) => {
          k.save();
          k.translate(x, y);
          k.scale(s, s);
          k.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
          k.restore();
        },
        genome: (score, seed, variant) => {
          let g = makeGenome(score, tierOf(score), seed, 'season');
          for (let s = seed; variant !== undefined && g.variant !== variant;) g = makeGenome(score, tierOf(score), ++s, 'season');
          return g;
        },
        sticker,
      };
      def!.tile!(ctx, 480, 360, kit);
      expect(inked(c as unknown as AnyCanvas)).toBeGreaterThan(0.99);
    });

    for (const W of [1920, 1440])
      it(`a full world runs half a minute and stays inside (${W} wide)`, () => {
        const settings = structuredClone(DEFAULTS);
        settings.game.maxCreatures = 30;
        const host = {
          settings,
          toast() {},
          showCard() {},
          progress() {},
        } as unknown as SceneHost;
        const s = new HabitatScene(def!, host, W);
        for (const [, score] of TIERS) for (let k = 0; k < 4; k++) s.addCreature(glyph(score), sticker());
        const B = s.bounds;
        const ctx = createCanvas(W, 1080).getContext('2d') as unknown as CanvasRenderingContext2D;
        for (let t = 0; t < 30; t += 1 / 30) {
          s.update(1 / 30);
          for (const c of s.creatures) {
            expect(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.rot) && Number.isFinite(c.lift)).toBe(true);
            if (c.leaving) continue;
            expect(c.x).toBeGreaterThanOrEqual(B.x0 - 40);
            expect(c.x).toBeLessThanOrEqual(B.x1 + 40);
            expect(c.y).toBeGreaterThanOrEqual(B.y0 - 40);
            expect(c.y).toBeLessThanOrEqual(B.y1 + 40);
          }
        }
        s.render(ctx);
        expect(s.creatures.length).toBeGreaterThan(0);
      });
  });
}

// The checks for pictures of the Wörter-Zoo: a picture that draws while still and while alive, inside its square.
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { PICTO_SIZE } from '../../src/game/words/picto.ts';
import type { Picto } from '../../src/game/words/picto.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

/** share of inked pixels in the square, and whether anything spills far outside it */
function shot(pictos: Record<string, Picto>, word: string, t: number, alive: boolean) {
  const S = PICTO_SIZE * 2;
  const c = createCanvas(S, S);
  const ctx = c.getContext('2d');
  ctx.translate(S / 2, S / 2);
  pictos[word].draw(ctx as unknown as CanvasRenderingContext2D, t, alive);
  const d = ctx.getImageData(0, 0, S, S).data;
  let inside = 0;
  let outside = 0;
  const lo = PICTO_SIZE * 0.25;
  const hi = PICTO_SIZE * 1.75;
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++)
      if (d[(y * S + x) * 4 + 3] > 20) {
        if (x >= lo && x < hi && y >= lo && y < hi) inside++;
        else outside++;
      }
  return { inside: inside / (PICTO_SIZE * PICTO_SIZE * 2.25), outside };
}

export function checkPictos(pictos: Record<string, Picto>, words = Object.keys(pictos)): void {
  for (const word of words)
    describe(word, () => {
      it('has a picture with a funny animation of 2 to 5 seconds', () => {
        expect(pictos[word]).toBeDefined();
        expect(pictos[word].anim).toBeGreaterThanOrEqual(2);
        expect(pictos[word].anim).toBeLessThanOrEqual(5);
      });

      it('draws while still and all through its life, inside its square', () => {
        for (const [t, alive] of [[0, false], [0.1, true], [0.7, true], [1.5, true], [pictos[word].anim * 0.8, true], [pictos[word].anim + 3, true]] as const) {
          const s = shot(pictos, word, t, alive);
          expect(s.inside).toBeGreaterThan(0.06);
          expect(s.outside).toBe(0);
        }
      });
    });
}


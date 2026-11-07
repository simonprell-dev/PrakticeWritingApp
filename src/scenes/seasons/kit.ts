// What a seasonal world gets to draw its start tile with (given by src/ui/previews.ts, so a world file
// does not import the start screen).
import type { AnyCanvas } from '../../game/canvas.ts';
import type { Genome } from '../../game/creatures/genome.ts';
import type { Sprite } from '../../game/creatures/sprite.ts';

export interface TileKit {
  /** draws a sprite with its letter sticker, anchored at (x, y); flip -1 looks left */
  draw(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, scale: number, flip?: number): void;
  /** a 'season' genome for a score 0..100; variant picks the kind (the sprite uses variant % kinds) */
  genome(score: number, seed: number, variant?: number): Genome;
  /** a letter as the child might have written it */
  sticker(ch: string): AnyCanvas;
}

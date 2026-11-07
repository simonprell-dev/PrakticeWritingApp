// A picture of the Wörter-Zoo: drawn on a canvas around (0, 0), about PICTO_SIZE wide and high, friendly and
// clear like the creatures of the other worlds (thick outline, round shapes, eyes on animals and on many
// things). Still while the class writes; once the word is right it comes alive for a moment.
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** the picture fits in a square of this size around (0, 0) */
export const PICTO_SIZE = 300;

export interface Picto {
  /**
   * t: seconds since it came alive (0 while still). While alive it plays its own funny animation for `anim`
   * seconds and then rests in a calm loop (breathing, blinking, a little wobble) for as long as it is shown.
   */
  draw(ctx: Ctx2D, t: number, alive: boolean): void;
  /** length of the funny animation in seconds (2 to 5) */
  anim: number;
}

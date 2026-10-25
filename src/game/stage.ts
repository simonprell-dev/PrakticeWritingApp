// The world is always 1080 units high; its width follows the screen aspect (nothing is cropped).
// Only screens narrower than MIN_W (phones and tablets held upright) get bands above and below.
export const WORLD_H = 1080;
/** the scenes need at least this much width */
const MIN_W = 1300;
/** colour of the bands above and below the world on upright screens */
const BAND = '#241a45';

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** world width in world units */
  worldW = 1920;
  /** world -> device pixel scale */
  scale = 1;
  /** device pixels above the world (upright screens) */
  offsetY = 0;
  dpr = 1;
  private listeners: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.resize();
  }

  onResize(fn: () => void): void {
    this.listeners.push(fn);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const cssW = Math.max(320, r.width || window.innerWidth);
    const cssH = Math.max(240, r.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    const w = Math.round(cssW * this.dpr);
    const h = Math.round(cssH * this.dpr);
    if (this.canvas.width === w && this.canvas.height === h) return;
    this.canvas.width = w;
    this.canvas.height = h;
    const fit = h / WORLD_H;
    if (w / fit >= MIN_W) {
      this.scale = fit;
      this.worldW = Math.min(2600, w / fit);
      this.offsetY = 0;
    } else {
      // upright: the whole width fits, the world sits in the middle
      this.scale = w / MIN_W;
      this.worldW = MIN_W;
      this.offsetY = Math.round((h - WORLD_H * this.scale) / 2);
    }
    for (const fn of this.listeners) fn();
  }

  /** Sets the world transform on the context. */
  begin(): CanvasRenderingContext2D {
    const c = this.ctx;
    if (this.offsetY) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = BAND;
      c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    c.setTransform(this.scale, 0, 0, this.scale, 0, this.offsetY);
    if (this.offsetY) {
      // bubbles and confetti stay inside the world
      c.save();
      c.beginPath();
      c.rect(0, 0, this.worldW, WORLD_H);
      c.clip();
    }
    return c;
  }

  /** after drawing a frame */
  end(): void {
    if (this.offsetY) this.ctx.restore();
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * this.dpr) / this.scale,
      y: ((clientY - r.top) * this.dpr - this.offsetY) / this.scale,
    };
  }

  /** world -> CSS pixels (for DOM overlays) */
  toCss(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (x * this.scale) / this.dpr, y: r.top + (y * this.scale + this.offsetY) / this.dpr };
  }
}

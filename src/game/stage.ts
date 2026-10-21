// The world is always 1080 units high; its width follows the screen aspect (no letterbox, no cropping).
export const WORLD_H = 1080;

export class Stage {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** world width in world units */
  worldW = 1920;
  /** world -> device pixel scale */
  scale = 1;
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
    this.scale = h / WORLD_H;
    this.worldW = Math.min(2600, Math.max(1300, w / this.scale));
    for (const fn of this.listeners) fn();
  }

  /** Sets the world transform on the context. */
  begin(): CanvasRenderingContext2D {
    const c = this.ctx;
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    return c;
  }

  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - r.left) * this.dpr) / this.scale,
      y: ((clientY - r.top) * this.dpr) / this.scale,
    };
  }

  /** world -> CSS pixels (for DOM overlays) */
  toCss(x: number, y: number): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: r.left + (x * this.scale) / this.dpr, y: r.top + (y * this.scale) / this.dpr };
  }
}

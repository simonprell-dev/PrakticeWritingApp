// requestAnimationFrame loop with a fixed 1/60 s simulation step; pauses while the tab is hidden.

export class Loop {
  private running = false;
  private last = 0;
  private acc = 0;
  private raf = 0;
  paused = false;
  readonly step = 1 / 60;
  private update: (dt: number) => void;
  private render: () => void;

  constructor(update: (dt: number) => void, render: () => void) {
    this.update = update;
    this.render = render;
    document.addEventListener('visibilitychange', () => {
      this.last = performance.now();
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused && !document.hidden) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= this.step && n < 6) {
          this.update(this.step);
          this.acc -= this.step;
          n++;
        }
        if (n === 6) this.acc = 0;
      }
      this.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}

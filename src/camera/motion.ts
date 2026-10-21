// Motion detection on a tiny grey copy of the video: drives the automatic scan and the "Hände weg!" wait.
import type { Settings } from '../app/settings.ts';
import type { Camera } from './camera.ts';

const PW = 160;
const PH = 90;

export class MotionProbe {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private prev: Float32Array | null = null;
  last: Float32Array | null = null;
  private camera: Camera;
  private cam: () => Settings['camera'];

  constructor(camera: Camera, cam: () => Settings['camera']) {
    this.camera = camera;
    this.cam = cam;
    this.canvas.width = PW;
    this.canvas.height = PH;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  /** Fraction of pixels that changed since the previous sample (mean-normalised, robust to exposure drift). */
  sample(): number {
    const id = this.camera.probe(this.cam(), this.ctx, PW, PH);
    if (!id) return 0;
    const g = new Float32Array(PW * PH);
    let mean = 0;
    for (let i = 0, p = 0; i < g.length; i++, p += 4) {
      g[i] = (id.data[p] + id.data[p + 1] + id.data[p + 2]) / 765;
      mean += g[i];
    }
    mean /= g.length;
    for (let i = 0; i < g.length; i++) g[i] = g[i] / (mean || 1);
    let changed = 0;
    if (this.prev) for (let i = 0; i < g.length; i++) if (Math.abs(g[i] - this.prev[i]) > 0.045) changed++;
    this.prev = g;
    this.last = g;
    return this.prev ? changed / g.length : 0;
  }

  /** Difference between the current frame and a reference frame (fraction of changed pixels). */
  differs(ref: Float32Array | null): number {
    if (!ref || !this.last) return 1;
    let changed = 0;
    for (let i = 0; i < ref.length; i++) if (Math.abs(ref[i] - this.last[i]) > 0.08) changed++;
    return changed / ref.length;
  }

  /** Waits until the picture is still (no hands moving) or the time is up. */
  async waitStill(maxMs = 3000, onWaiting?: () => void): Promise<boolean> {
    const t0 = performance.now();
    let calm = 0;
    let warned = false;
    while (performance.now() - t0 < maxMs) {
      const m = this.sample();
      if (m < 0.006) {
        calm++;
        if (calm >= 3) return true;
      } else {
        calm = 0;
        if (!warned && m > 0.02) {
          warned = true;
          onWaiting?.();
        }
      }
      await new Promise((r) => setTimeout(r, 110));
    }
    return false;
  }
}

export type AutoState = 'watching' | 'moving' | 'settling' | 'cooldown';

/** Scans automatically after something changed under the camera and then stayed still. */
export class AutoScan {
  state: AutoState = 'watching';
  /** 0..1 while settling (HUD ring) */
  progress = 0;
  enabled = false;
  private timer = 0;
  private settleMs = 0;
  private cooldownUntil = 0;
  private scannedRef: Float32Array | null = null;
  private probe: MotionProbe;
  private delay: () => number;
  private onScan: () => Promise<void>;
  private busy: () => boolean;
  onChange: (() => void) | null = null;

  constructor(probe: MotionProbe, delay: () => number, busy: () => boolean, onScan: () => Promise<void>) {
    this.probe = probe;
    this.delay = delay;
    this.busy = busy;
    this.onScan = onScan;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    clearInterval(this.timer);
    this.state = 'watching';
    this.progress = 0;
    if (on) this.timer = window.setInterval(() => void this.tick(), 125);
    this.onChange?.();
  }

  /** Remember what the last scan saw, so an unchanged sheet does not trigger again. */
  markScanned(): void {
    this.probe.sample();
    this.scannedRef = this.probe.last ? this.probe.last.slice() : null;
    this.cooldownUntil = performance.now() + 2000;
    this.state = 'cooldown';
  }

  private async tick(): Promise<void> {
    if (!this.enabled || this.busy()) return;
    const m = this.probe.sample();
    const now = performance.now();
    const prevState = this.state;
    if (this.state === 'cooldown') {
      if (now >= this.cooldownUntil) this.state = 'watching';
    } else if (this.state === 'watching') {
      if (m > 0.02) this.state = 'moving';
    } else if (this.state === 'moving') {
      if (m < 0.004) {
        this.state = 'settling';
        this.settleMs = 0;
      }
    } else if (this.state === 'settling') {
      if (m > 0.01) this.state = 'moving';
      else {
        this.settleMs += 125;
        this.progress = Math.min(1, this.settleMs / (this.delay() * 1000));
        if (this.progress >= 1) {
          this.progress = 0;
          if (this.probe.differs(this.scannedRef) > 0.005) {
            this.state = 'cooldown';
            this.cooldownUntil = now + 2000;
            await this.onScan();
          } else this.state = 'watching';
        }
      }
    }
    if (this.state !== 'settling') this.progress = 0;
    if (prevState !== this.state || this.state === 'settling') this.onChange?.();
  }
}

// Promise API around the vision worker, with an in-thread fallback (?noworker or no Worker support).
import type { Vec3 } from '../vision/color.ts';
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';
import type { EngineInfo } from './engine.ts';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number };

export interface VisionClient {
  init(): Promise<EngineInfo>;
  scan(frame: RGBAImage, opts: VisionOptions): Promise<ScanResult>;
  reset(): Promise<void>;
  calibrate(frame: RGBAImage, kind: 'pen'): Promise<{ absorb: Vec3; pixels: number }>;
  calibrate(frame: RGBAImage, kind: 'slip'): Promise<{ rgb: Vec3 }>;
}

const BASE = new URL(import.meta.env.BASE_URL || '/', location.href).href;

class WorkerVision implements VisionClient {
  private w: Worker;
  private seq = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.w = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module' });
    this.w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; value?: unknown; error?: string }>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      clearTimeout(p.timer);
      this.pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.value);
      else p.reject(new Error(e.data.error));
    };
    this.w.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || 'Worker-Fehler'));
      this.pending.clear();
    };
  }

  private call<T>(msg: Record<string, unknown>, transfer: Transferable[] = [], timeout = 20000): Promise<T> {
    const id = this.seq++;
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('Zeitüberschreitung bei der Auswertung'));
      }, timeout);
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject, timer });
      this.w.postMessage({ ...msg, id }, transfer);
    });
  }

  init() {
    return this.call<EngineInfo>({ type: 'init', base: BASE }, [], 60000);
  }
  scan(frame: RGBAImage, opts: VisionOptions) {
    return this.call<ScanResult>({ type: 'scan', frame, opts }, [frame.data.buffer as ArrayBuffer]);
  }
  reset() {
    return this.call<void>({ type: 'reset' });
  }
  calibrate(frame: RGBAImage, kind: 'pen' | 'slip') {
    return this.call<never>({ type: 'calibrate', frame, kind }, [frame.data.buffer as ArrayBuffer]);
  }
}

class InlineVision implements VisionClient {
  private engine: Promise<import('./engine.ts').Engine>;
  constructor() {
    this.engine = import('./engine.ts').then((m) => new m.Engine());
  }
  async init() {
    return (await this.engine).init(BASE);
  }
  async scan(frame: RGBAImage, opts: VisionOptions) {
    return (await this.engine).scan(frame, opts);
  }
  async reset() {
    (await this.engine).reset();
  }
  async calibrate(frame: RGBAImage, kind: 'pen' | 'slip') {
    return (await this.engine).calibrate(frame, kind) as never;
  }
}

export function createVision(): VisionClient {
  const noWorker = new URLSearchParams(location.search).has('noworker') || typeof Worker === 'undefined';
  if (!noWorker) {
    try {
      return new WorkerVision();
    } catch {
      /* fall through */
    }
  }
  return new InlineVision();
}

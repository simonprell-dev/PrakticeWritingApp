// Promise API around the vision workers. Several workers recognise the glyphs of one scan in parallel;
// falls back to a single worker or to the main thread (?noworker or no Worker support).
import type { Vec3 } from '../vision/color.ts';
import type { GlyphJob } from '../vision/pipeline.ts';
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';
import type { EngineInfo } from './engine.ts';
import type { Analysis } from './recognizer.ts';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: number };

export interface VisionClient {
  init(): Promise<EngineInfo>;
  scan(frame: RGBAImage, opts: VisionOptions): Promise<ScanResult>;
  reset(): Promise<void>;
  calibrate(frame: RGBAImage, kind: 'pen'): Promise<{ absorb: Vec3; pixels: number }>;
  calibrate(frame: RGBAImage, kind: 'slip'): Promise<{ rgb: Vec3 }>;
}

const BASE = new URL(import.meta.env.BASE_URL || '/', location.href).href;

/** one worker */
class WorkerHandle {
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

  call<T>(msg: Record<string, unknown>, transfer: Transferable[] = [], timeout = 20000): Promise<T> {
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
}

class WorkerPool implements VisionClient {
  private workers: WorkerHandle[];

  constructor(n: number) {
    this.workers = Array.from({ length: n }, () => new WorkerHandle());
  }

  private get main(): WorkerHandle {
    return this.workers[0];
  }

  async init() {
    const infos = await Promise.all(this.workers.map((w) => w.call<EngineInfo>({ type: 'init', base: BASE }, [], 60000)));
    return infos[0];
  }

  async scan(frame: RGBAImage, opts: VisionOptions): Promise<ScanResult> {
    if (this.workers.length === 1) return this.main.call<ScanResult>({ type: 'scan', frame, opts }, [frame.data.buffer as ArrayBuffer]);
    const { id, jobs } = await this.main.call<{ id: number; jobs: GlyphJob[] }>({ type: 'segment', frame, opts }, [frame.data.buffer as ArrayBuffer]);
    const t0 = performance.now();
    let analyses: Analysis[];
    if (jobs.length <= 2) analyses = await this.main.call<Analysis[]>({ type: 'analyze', jobs, opts });
    else {
      // glyphs are spread over all workers and recognised at the same time
      const k = Math.min(this.workers.length, jobs.length);
      const size = Math.ceil(jobs.length / k);
      const parts = await Promise.all(
        Array.from({ length: k }, (_, i) => this.workers[i].call<Analysis[]>({ type: 'analyze', jobs: jobs.slice(i * size, (i + 1) * size), opts })),
      );
      analyses = parts.flat();
    }
    const recognize = Math.round(performance.now() - t0);
    return this.main.call<ScanResult>({ type: 'finish', scanId: id, analyses, opts, timings: { recognize } });
  }

  reset() {
    return this.main.call<void>({ type: 'reset' });
  }

  calibrate(frame: RGBAImage, kind: 'pen' | 'slip') {
    return this.main.call<never>({ type: 'calibrate', frame, kind }, [frame.data.buffer as ArrayBuffer]);
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
  const q = new URLSearchParams(location.search);
  const noWorker = q.has('noworker') || typeof Worker === 'undefined';
  if (!noWorker) {
    try {
      // leave one core for drawing; at most 4 workers
      const cores = navigator.hardwareConcurrency || 2;
      const n = q.has('oneworker') ? 1 : Math.max(1, Math.min(4, cores - 1));
      return new WorkerPool(n);
    } catch {
      /* fall through */
    }
  }
  return new InlineVision();
}

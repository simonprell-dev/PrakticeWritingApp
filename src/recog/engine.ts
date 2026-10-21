// Loads model + templates and runs scans. Used inside the workers (and in-thread as a fallback).
// A scan can run in one go (scan) or in three phases spread over several workers:
// segment (worker 0) -> analyze (all workers, glyphs in parallel) -> finish (worker 0).
import { GlyphMemory } from '../vision/dedup.ts';
import {
  analyzeJobs,
  calibratePen,
  calibrateSlip,
  finishScan,
  runScan,
  segmentFrame,
  type FrameSegmentation,
  type GlyphJob,
} from '../vision/pipeline.ts';
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';
import { GlyphNet, type GlyphNetMeta } from './cnn.ts';
import { Recognizer, type Analysis } from './recognizer.ts';
import { TemplateBank, type TemplateMeta } from './templates.ts';

export interface EngineInfo {
  hasModel: boolean;
  accuracy?: { top1: number; group: number };
}

export class Engine {
  recognizer: Recognizer | null = null;
  memory = new GlyphMemory('sheet');
  info: EngineInfo = { hasModel: false };
  private pending = new Map<number, FrameSegmentation>();
  private seq = 1;

  async init(base: string): Promise<EngineInfo> {
    const get = async (p: string) => {
      const r = await fetch(new URL(p, base));
      if (!r.ok) throw new Error(`${p}: ${r.status}`);
      return r;
    };
    const [tm, tb] = await Promise.all([get('model/templates-v1.json').then((r) => r.json()), get('model/templates-v1.bin').then((r) => r.arrayBuffer())]);
    const bank = new TemplateBank(tm as TemplateMeta, tb);
    let net: GlyphNet | null = null;
    try {
      const [nm, nb] = await Promise.all([get('model/glyphnet-v1.json').then((r) => r.json()), get('model/glyphnet-v1.bin').then((r) => r.arrayBuffer())]);
      net = new GlyphNet(nm as GlyphNetMeta, nb);
      this.info = { hasModel: true, accuracy: (nm as GlyphNetMeta).accuracy };
    } catch {
      this.info = { hasModel: false };
    }
    let calib: Record<string, number> = {};
    try {
      calib = (await get('model/calib-v1.json').then((r) => r.json())).median ?? {};
    } catch {
      /* optional */
    }
    this.recognizer = new Recognizer(bank, net, calib);
    this.warmUp();
    return this.info;
  }

  /** One scan of a tiny drawn letter, so the first real scan does not wait for the JIT compiler. */
  private warmUp(): void {
    const w = 240;
    const h = 160;
    const data = new Uint8ClampedArray(w * h * 4).fill(235);
    for (let y = 40; y < 120; y++) {
      for (let x = 0; x < w; x++) {
        const stem = x >= 60 && x < 68;
        const foot = y >= 112 && x >= 60 && x < 110;
        const ring = Math.abs(Math.hypot(x - 160, y - 85) - 26) < 4;
        if (stem || foot || ring) data.set([30, 30, 60, 255], (y * w + x) * 4);
      }
    }
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    try {
      runScan({ width: w, height: h, data }, { pen: 'auto', ruled: 'auto', strictness: 'mittel', style: 'beide', dedup: 'sheet', debug: false }, { recognizer: this.recognizer!, memory: new GlyphMemory() });
    } catch {
      /* warm-up only */
    }
  }

  private ready(): Recognizer {
    if (!this.recognizer) throw new Error('engine not ready');
    return this.recognizer;
  }

  private memoryFor(opts: VisionOptions): GlyphMemory {
    if (this.memory.mode !== opts.dedup) this.memory = new GlyphMemory(opts.dedup);
    return this.memory;
  }

  scan(frame: RGBAImage, opts: VisionOptions): ScanResult {
    return runScan(frame, opts, { recognizer: this.ready(), memory: this.memoryFor(opts) });
  }

  /** phase 1: returns the glyph jobs, keeps the rest until finish() */
  segment(frame: RGBAImage, opts: VisionOptions): { id: number; jobs: GlyphJob[] } {
    const seg = segmentFrame(frame, opts);
    const id = this.seq++;
    this.pending.set(id, seg);
    // never keep more than a few unfinished scans
    for (const k of this.pending.keys()) if (k < id - 3) this.pending.delete(k);
    return { id, jobs: seg.glyphs.map((g) => g.job) };
  }

  /** phase 2: recognition and per-glyph scoring */
  analyze(jobs: GlyphJob[], opts: VisionOptions): Analysis[] {
    return analyzeJobs(jobs, opts, this.ready());
  }

  /** phase 3: scan-wide scoring, duplicates, result */
  finish(id: number, analyses: Analysis[], opts: VisionOptions, timings: Record<string, number>): ScanResult {
    const seg = this.pending.get(id);
    if (!seg) throw new Error('Scan nicht gefunden');
    this.pending.delete(id);
    return finishScan(seg, analyses, opts, { recognizer: this.ready(), memory: this.memoryFor(opts) }, timings);
  }

  reset(): void {
    this.memory.reset();
  }

  calibrate(frame: RGBAImage, kind: 'pen' | 'slip') {
    return kind === 'pen' ? calibratePen(frame) : calibrateSlip(frame);
  }
}

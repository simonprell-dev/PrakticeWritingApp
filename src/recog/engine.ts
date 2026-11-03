// Loads model + templates and runs scans. Used inside the workers (and in-thread as a fallback).
// A scan can run in one go (scan) or in three phases spread over several workers:
// segment (worker 0) -> analyze (all workers, glyphs in parallel) -> finish (worker 0).
import { findCards, type CardScan } from '../vision/cards.ts';
import { GlyphMemory, type MemGlyph } from '../vision/dedup.ts';
import {
  analyzeJobs,
  calibratePen,
  calibrateSlip,
  finishScan,
  matchKnown,
  runScan,
  segmentFrame,
  type FrameSegmentation,
  type GlyphJob,
} from '../vision/pipeline.ts';
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';
import { GlyphNet, type GlyphNetMeta } from './cnn.ts';
import { Recognizer, type Analysis } from './recognizer.ts';
import { scriptOf, type ScriptId } from './scripts.ts';
import { TemplateBank, type TemplateMeta } from './templates.ts';

export interface SavedMemory {
  mode: 'sheet' | 'slips';
  items: MemGlyph[];
}

export interface EngineInfo {
  hasModel: boolean;
  accuracy?: { top1: number; group: number };
}

export class Engine {
  /** the Druckschrift recogniser (loaded by init) */
  recognizer: Recognizer | null = null;
  /** one recogniser per script, each with its own model (loaded on first use) */
  private scripts = new Map<ScriptId, Recognizer>();
  private infos = new Map<ScriptId, EngineInfo>();
  private base = '';
  memory = new GlyphMemory('sheet');
  info: EngineInfo = { hasModel: false };
  private pending = new Map<number, FrameSegmentation>();
  private seq = 1;

  async init(base: string): Promise<EngineInfo> {
    this.base = base;
    this.info = await this.load('druck');
    this.recognizer = this.scripts.get('druck')!;
    this.warmUp();
    return this.info;
  }

  /** loads the model and templates of a script (once); every script has files of its own */
  async load(script: ScriptId): Promise<EngineInfo> {
    const known = this.infos.get(script);
    if (known) return known;
    const def = scriptOf(script);
    const dir = `model/${def.modelDir}`;
    const get = async (p: string) => {
      const r = await fetch(new URL(dir + p, this.base));
      if (!r.ok) throw new Error(`${dir + p}: ${r.status}`);
      return r;
    };
    const [tm, tb] = await Promise.all([get('templates-v1.json').then((r) => r.json()), get('templates-v1.bin').then((r) => r.arrayBuffer())]);
    const bank = new TemplateBank(tm as TemplateMeta, tb);
    let net: GlyphNet | null = null;
    let info: EngineInfo;
    try {
      const [nm, nb] = await Promise.all([get('glyphnet-v1.json').then((r) => r.json()), get('glyphnet-v1.bin').then((r) => r.arrayBuffer())]);
      net = new GlyphNet(nm as GlyphNetMeta, nb);
      info = { hasModel: true, accuracy: (nm as GlyphNetMeta).accuracy };
    } catch {
      info = { hasModel: false };
    }
    let calib: Record<string, number> = {};
    try {
      calib = (await get('calib-v1.json').then((r) => r.json())).median ?? {};
    } catch {
      /* optional */
    }
    this.scripts.set(script, new Recognizer(bank, net, calib, def));
    this.infos.set(script, info);
    return info;
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

  /** the recogniser of the script being written */
  private ready(opts?: VisionOptions): Recognizer {
    const r = this.scripts.get(opts?.script ?? 'druck');
    if (!r) throw new Error(opts?.script && opts.script !== 'druck' ? `Schrift ${opts.script} nicht geladen` : 'engine not ready');
    return r;
  }

  private memoryFor(opts: VisionOptions): GlyphMemory {
    if (this.memory.mode !== opts.dedup) this.memory = new GlyphMemory(opts.dedup);
    return this.memory;
  }

  scan(frame: RGBAImage, opts: VisionOptions): ScanResult {
    return runScan(frame, opts, { recognizer: this.ready(opts), memory: this.memoryFor(opts) });
  }

  /** phase 1: returns the jobs of the glyphs that are not known yet, keeps the rest until finish() */
  segment(frame: RGBAImage, opts: VisionOptions): { id: number; jobs: GlyphJob[] } {
    const seg = segmentFrame(frame, opts);
    const t0 = performance.now();
    const jobs = matchKnown(seg, this.memoryFor(opts));
    seg.timings.known = Math.round(performance.now() - t0);
    const id = this.seq++;
    this.pending.set(id, seg);
    // never keep more than a few unfinished scans
    for (const k of this.pending.keys()) if (k < id - 3) this.pending.delete(k);
    return { id, jobs };
  }

  /** phase 2: recognition and per-glyph scoring */
  analyze(jobs: GlyphJob[], opts: VisionOptions): Analysis[] {
    return analyzeJobs(jobs, opts, this.ready(opts));
  }

  /** phase 3: scan-wide scoring, duplicates, result */
  finish(id: number, analyses: Analysis[], opts: VisionOptions, timings: Record<string, number>): ScanResult {
    const seg = this.pending.get(id);
    if (!seg) throw new Error('Scan nicht gefunden');
    this.pending.delete(id);
    return finishScan(seg, analyses, opts, { recognizer: this.ready(opts), memory: this.memoryFor(opts) }, timings);
  }

  reset(): void {
    this.memory.reset();
  }

  /** the glyphs remembered so far (for a saved game), without the debug inputs */
  exportMemory(): SavedMemory {
    return {
      mode: this.memory.mode,
      items: this.memory.items.map((m) => ({ ...m, known: m.known && { ...m.known, analysis: { ...m.known.analysis, cnn: undefined } } })),
    };
  }

  importMemory(m: SavedMemory): void {
    this.memory = new GlyphMemory(m.mode);
    this.memory.items = m.items;
  }

  /** Mal-Aquarium: the colouring cards in the frame (no model needed) */
  cards(frame: RGBAImage): CardScan {
    return findCards(frame);
  }

  calibrate(frame: RGBAImage, kind: 'pen' | 'slip') {
    return kind === 'pen' ? calibratePen(frame) : calibrateSlip(frame);
  }
}

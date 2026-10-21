// Loads model + templates and runs scans. Used inside the worker (and in-thread as a fallback).
import { GlyphMemory } from '../vision/dedup.ts';
import { calibratePen, calibrateSlip, runScan } from '../vision/pipeline.ts';
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';
import { GlyphNet, type GlyphNetMeta } from './cnn.ts';
import { Recognizer } from './recognizer.ts';
import { TemplateBank, type TemplateMeta } from './templates.ts';

export interface EngineInfo {
  hasModel: boolean;
  accuracy?: { top1: number; group: number };
}

export class Engine {
  recognizer: Recognizer | null = null;
  memory = new GlyphMemory('sheet');
  info: EngineInfo = { hasModel: false };

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
    return this.info;
  }

  scan(frame: RGBAImage, opts: VisionOptions): ScanResult {
    if (!this.recognizer) throw new Error('engine not ready');
    if (this.memory.mode !== opts.dedup) {
      this.memory = new GlyphMemory(opts.dedup);
    }
    return runScan(frame, opts, { recognizer: this.recognizer, memory: this.memory });
  }

  reset(): void {
    this.memory.reset();
  }

  calibrate(frame: RGBAImage, kind: 'pen' | 'slip') {
    return kind === 'pen' ? calibratePen(frame) : calibrateSlip(frame);
  }
}

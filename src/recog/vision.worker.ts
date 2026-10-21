/// <reference lib="webworker" />
import type { RGBAImage, ScanResult, VisionOptions } from '../vision/types.ts';
import { Engine } from './engine.ts';

export type WorkerRequest =
  | { id: number; type: 'init'; base: string }
  | { id: number; type: 'scan'; frame: RGBAImage; opts: VisionOptions }
  | { id: number; type: 'reset' }
  | { id: number; type: 'calibrate'; frame: RGBAImage; kind: 'pen' | 'slip' };

const engine = new Engine();
const scope = self as unknown as DedicatedWorkerGlobalScope;

function transferables(res: ScanResult): Transferable[] {
  const t: Transferable[] = res.glyphs.map((g) => g.crop.data.buffer as ArrayBuffer);
  if (res.debug) {
    t.push(res.debug.ink.data.buffer as ArrayBuffer, res.debug.mask.data.buffer as ArrayBuffer);
  }
  return t;
}

scope.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      const info = await engine.init(msg.base);
      scope.postMessage({ id: msg.id, ok: true, value: info });
    } else if (msg.type === 'scan') {
      const res = engine.scan(msg.frame, msg.opts);
      scope.postMessage({ id: msg.id, ok: true, value: res }, transferables(res));
    } else if (msg.type === 'reset') {
      engine.reset();
      scope.postMessage({ id: msg.id, ok: true, value: null });
    } else if (msg.type === 'calibrate') {
      scope.postMessage({ id: msg.id, ok: true, value: engine.calibrate(msg.frame, msg.kind) });
    }
  } catch (err) {
    scope.postMessage({ id: msg.id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};

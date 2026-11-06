// The series of pictures taken of the test sheet, and what they say: a field passes with 9 of 10 good pictures.
import type { DotProbe } from '../vision/markProbe.ts';
import { BOX_PITCH, DOT_PITCH, type TestField } from './markTestSheet.ts';

export interface Shot {
  field: string;
  source: 'druck' | 'kopie';
  view: 'nah' | 'ganz';
  probe: DotProbe;
  /** characters the recognition saw in the field: printed marks must not count as writing */
  glyphs: number;
  pxPerMm: number;
}

export interface FieldResult {
  field: string;
  source: Shot['source'];
  view: Shot['view'];
  shots: number;
  passed: number;
  ok: boolean;
}

/** pictures of a series */
export const SERIES = 10;
const NEEDED = 9;

export const pxPerMm = (f: TestField, pitchPx: number) => pitchPx / (f.kind === 'dots' ? DOT_PITCH : BOX_PITCH);

export function summarize(shots: Shot[]): FieldResult[] {
  const out = new Map<string, FieldResult>();
  for (const s of shots) {
    const key = `${s.field}|${s.source}|${s.view}`;
    const r = out.get(key) ?? { field: s.field, source: s.source, view: s.view, shots: 0, passed: 0, ok: false };
    r.shots++;
    if (s.probe.readable && s.glyphs === 0) r.passed++;
    r.ok = r.shots >= SERIES && r.passed / r.shots >= NEEDED / SERIES;
    out.set(key, r);
  }
  return [...out.values()];
}

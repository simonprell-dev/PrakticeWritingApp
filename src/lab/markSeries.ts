// The series of pictures taken of the test sheet, and what they say: a series passes with 9 of 10 good pictures.
import type { DotProbe } from '../vision/markProbe.ts';
import type { Box } from '../vision/types.ts';
import { BOX_PITCH, DOT_PITCH, type TestField } from './markTestSheet.ts';

export interface Shot {
  /** when the series began; every series is judged on its own */
  series: number;
  field: string;
  source: 'druck' | 'kopie';
  view: 'nah' | 'ganz';
  camera: string;
  /** picture size of the camera */
  size: string;
  probe: DotProbe;
  /** characters the recognition saw in the field: printed marks must not count as writing */
  glyphs: number;
  pxPerMm: number;
  /** share of the frame that is blown out */
  clipped?: number;
}

export interface SeriesResult {
  series: number;
  field: string;
  source: Shot['source'];
  view: Shot['view'];
  camera: string;
  shots: number;
  passed: number;
  ok: boolean;
}

/** pictures of a series */
export const SERIES = 10;
const NEEDED = 9;

export const markPitchMm = (f: TestField) => (f.kind === 'dots' ? DOT_PITCH : BOX_PITCH);

export const pxPerMm = (f: TestField, pitchPx: number) => pitchPx / markPitchMm(f);

/** how many of the glyphs have their centre in the frame */
export function glyphsInside(glyphs: { box: Box }[], frame: Box): number {
  return glyphs.filter(({ box: b }) => {
    const x = b.x + b.w / 2;
    const y = b.y + b.h / 2;
    return x >= frame.x && y >= frame.y && x < frame.x + frame.w && y < frame.y + frame.h;
  }).length;
}

export function summarize(shots: Shot[]): SeriesResult[] {
  const out = new Map<number, SeriesResult>();
  for (const s of shots) {
    const r = out.get(s.series) ?? { series: s.series, field: s.field, source: s.source, view: s.view, camera: s.camera, shots: 0, passed: 0, ok: false };
    r.shots++;
    if (s.probe.readable && s.glyphs === 0) r.passed++;
    r.ok = r.shots >= SERIES && r.passed / r.shots >= NEEDED / SERIES;
    out.set(s.series, r);
  }
  return [...out.values()];
}

// Pale dots vanish when the paper is blown out, so the lab shows how much of the picture is at the top of the
// range and offers whatever the camera lets the browser change.
import type { RGBAImage } from '../vision/types.ts';

/** a pixel this bright has lost what is printed on it */
const CLIPPED = 250;

interface Range {
  min: number;
  max: number;
  step?: number;
}

export interface ExposureCaps {
  exposureMode?: string[];
  exposureTime?: Range;
  exposureCompensation?: Range;
  brightness?: Range;
}

export interface ExposureKnob extends Range {
  key: 'exposureTime' | 'exposureCompensation' | 'brightness';
  /** the camera must leave its automatic for this knob */
  manual: boolean;
}

export function overexposedShare(img: RGBAImage): number {
  const n = img.width * img.height;
  if (!n) return 0;
  let over = 0;
  for (let i = 0; i < n; i++) {
    const grey = 0.299 * img.data[i * 4] + 0.587 * img.data[i * 4 + 1] + 0.114 * img.data[i * 4 + 2];
    if (grey >= CLIPPED) over++;
  }
  return over / n;
}

/** the best way this camera offers to darken the picture */
export function exposureKnob(caps: ExposureCaps): ExposureKnob | null {
  const wide = (r?: Range): r is Range => !!r && r.max > r.min;
  if (wide(caps.exposureTime) && caps.exposureMode?.includes('manual')) return { key: 'exposureTime', manual: true, ...caps.exposureTime };
  if (wide(caps.exposureCompensation)) return { key: 'exposureCompensation', manual: false, ...caps.exposureCompensation };
  if (wide(caps.brightness)) return { key: 'brightness', manual: false, ...caps.brightness };
  return null;
}

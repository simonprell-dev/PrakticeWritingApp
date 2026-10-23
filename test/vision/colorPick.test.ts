import { describe, expect, it } from 'vitest';
import { angleDeg, chroma, PEN_PRESETS, SLIP_PRESETS } from '../../src/vision/color.ts';
import { calibratePen } from '../../src/vision/pipeline.ts';
import { samplePen, sampleSlip } from '../../src/ui/colorPicker.ts';

/** paper with a thick stroke of the given colour in the middle (and some shading) */
function page(paper: [number, number, number], ink: [number, number, number]) {
  const w = 320;
  const h = 200;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const light = 1 - 0.15 * (x / w);
      const onStroke = Math.abs(y - 100) < 6 && x > 80 && x < 240;
      const c = onStroke ? ink : paper;
      data.set([c[0] * light, c[1] * light, c[2] * light, 255], (y * w + x) * 4);
    }
  }
  return { width: w, height: h, data } as unknown as ImageData;
}

describe('tapping a colour in the photo', () => {
  it('measures a pen colour like the recognition does', () => {
    const img = page([238, 236, 230], [205, 45, 55]);
    const s = samplePen(img, 160, 101, 9)!;
    expect(s).not.toBeNull();
    expect(angleDeg(s.value, PEN_PRESETS.rot.absorb)).toBeLessThan(12);
    expect(angleDeg(s.value, PEN_PRESETS.blau.absorb)).toBeGreaterThan(30);
    // the same direction as the automatic calibration of the recognition
    const auto = calibratePen(img as unknown as { width: number; height: number; data: Uint8ClampedArray });
    expect(angleDeg(s.value, auto.absorb)).toBeLessThan(6);
  });

  it('finds nothing when the tap misses the ink', () => {
    expect(samplePen(page([238, 236, 230], [40, 70, 200]), 160, 40, 9)).toBeNull();
  });

  it('measures the paper of a coloured slip and leaves the writing out', () => {
    const img = page([250, 225, 110], [30, 30, 40]);
    const s = sampleSlip(img, 160, 100, 16)!;
    const yellow = chroma(250, 225, 110);
    expect(Math.hypot(s.value[0] - yellow[0], s.value[1] - yellow[1])).toBeLessThan(0.01);
    expect(Math.hypot(s.value[0] - SLIP_PRESETS.gelb.slip[0], s.value[1] - SLIP_PRESETS.gelb.slip[1])).toBeLessThan(0.04);
  });
});

import { describe, expect, it } from 'vitest';
import { quadAspect, quadPoint, quadSize, warpQuad, type Quad } from '../../src/camera/perspective.ts';
import type { Pt } from '../../src/game/paint/fishCard.ts';
import type { RGBAImage } from '../../src/vision/types.ts';

/** a pinhole camera (focal length f, optical axis in the middle of a w × h photo) tilted by `tilt` around x */
function camera(f: number, w: number, h: number, tilt: number, turn = 0) {
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  const cz = Math.cos(turn);
  const sz = Math.sin(turn);
  return ([X, Y]: Pt): Pt => {
    // the sheet lies in the plane z = 0, 60 cm in front of the camera
    const x1 = cz * X - sz * Y;
    const y1 = sz * X + cz * Y;
    const y = ct * y1;
    const z = st * y1 + 60;
    return [w / 2 + (f * x1) / z, h / 2 + (f * y) / z];
  };
}

function sheetQuad(sheetW: number, sheetH: number, cam: (p: Pt) => Pt): Quad {
  return [cam([-sheetW / 2, -sheetH / 2]), cam([sheetW / 2, -sheetH / 2]), cam([sheetW / 2, sheetH / 2]), cam([-sheetW / 2, sheetH / 2])];
}

describe('slanted sheet', () => {
  it('finds the real proportions of an A4 sheet seen at a steep angle', () => {
    for (const [tilt, turn] of [
      [0.8, 0.3],
      [1.15, -0.2],
    ]) {
      const cam = camera(1400, 1920, 1080, tilt, turn);
      expect(quadAspect(sheetQuad(29.7, 21, cam), 1920, 1080)).toBeCloseTo(29.7 / 21, 1);
      expect(quadAspect(sheetQuad(21, 29.7, cam), 1920, 1080)).toBeCloseTo(21 / 29.7, 1);
    }
  });

  it('assumes a usual camera when the sheet lies square in front of it (mirror on the tablet)', () => {
    // the side lengths alone would make this sheet almost twice as wide as it is
    for (const f of [1300, 1536, 1800]) {
      const r = quadAspect(sheetQuad(29.7, 21, camera(f, 1920, 1080, 1.0)), 1920, 1080);
      expect(Math.abs(r / (29.7 / 21) - 1)).toBeLessThan(0.12);
    }
  });

  it('falls back to the side lengths for a picture taken straight from above', () => {
    const q: Quad = [
      [100, 100],
      [400, 100],
      [400, 300],
      [100, 300],
    ];
    expect(quadAspect(q, 1280, 720)).toBeCloseTo(1.5, 5);
    expect(quadSize(q, 1280, 720, 1280)).toEqual({ w: 300, h: 200 });
  });

  it('straightens the quad: a point of the sheet lands where it belongs', () => {
    const W = 200;
    const H = 150;
    const data = new Uint8ClampedArray(W * H * 4).fill(255);
    const q: Quad = [
      [40, 30],
      [170, 20],
      [190, 140],
      [10, 120],
    ];
    const [cx, cy] = quadPoint(q, 0.2, 0.3);
    for (let y = Math.round(cy) - 2; y <= Math.round(cy) + 2; y++)
      for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 2; x++) data.fill(0, (y * W + x) * 4, (y * W + x) * 4 + 3);
    const out = warpQuad({ width: W, height: H, data } as RGBAImage, q, 100, 80);
    const at = (x: number, y: number) => out.data[(y * 100 + x) * 4];
    expect(at(20, 24)).toBeLessThan(60);
    expect(at(70, 60)).toBe(255);
    const [x, y] = quadPoint(q, 1, 1);
    expect(x).toBeCloseTo(190, 5);
    expect(y).toBeCloseTo(140, 5);
  });
});

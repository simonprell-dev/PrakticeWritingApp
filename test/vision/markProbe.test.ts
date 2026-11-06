import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/game/rng.ts';
import { probeDots } from '../../src/vision/markProbe.ts';
import type { RGBAImage } from '../../src/vision/types.ts';

interface Paint {
  w?: number;
  h?: number;
  paper?: number;
  noise?: number;
  dots?: { pitch: number; r: number; ink: number; angle?: number };
  /** ruled lines: spacing, offset, darkness, skew in radians */
  lines?: { every: number; at?: number; ink: number; skew?: number };
}

/** a grey page with an anti-aliased dot lattice and ruled lines */
function page({ w = 600, h = 300, paper = 255, noise = 3, dots, lines }: Paint): RGBAImage {
  const g = new Float32Array(w * h).fill(paper);
  if (lines) {
    const skew = Math.tan(lines.skew ?? 0);
    for (let x = 0; x < w; x++)
      for (let y = 0; y < h; y++) {
        const d = (y - x * skew - (lines.at ?? 0) + lines.every * 100) % lines.every;
        if (Math.min(d, lines.every - d) < 0.8) g[y * w + x] = lines.ink;
      }
  }
  if (dots) {
    const { pitch, r, ink, angle = 0 } = dots;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const n = Math.ceil(Math.hypot(w, h) / pitch);
    for (let i = -n; i <= n; i++)
      for (let j = -n; j <= n; j++) {
        const cx = w / 2 + pitch / 2 + (i * c - j * s) * pitch;
        const cy = h / 2 + pitch / 2 + (i * s + j * c) * pitch;
        for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++)
          for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
            if (x < 0 || y < 0 || x >= w || y >= h) continue;
            const cover = Math.max(0, Math.min(1, r + 0.5 - Math.hypot(x - cx, y - cy)));
            g[y * w + x] = g[y * w + x] * (1 - cover) + ink * cover;
          }
      }
  }
  const rand = mulberry32(7);
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = g[i] + (rand() * 2 - 1) * noise;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  return { width: w, height: h, data };
}

describe('probeDots', () => {
  it('finds a clear lattice', () => {
    const p = probeDots(page({ dots: { pitch: 24, r: 3, ink: 217 } }), { pitchPx: 24 });
    expect(p.readable).toBe(true);
    expect(Math.abs(p.pitchPx - 24)).toBeLessThanOrEqual(1);
    expect(p.hitRate).toBeGreaterThanOrEqual(0.9);
    expect(p.falseRate).toBeLessThanOrEqual(0.1);
    expect(p.contrast).toBeGreaterThan(0.05);
  });

  it('finds a tilted lattice', () => {
    expect(probeDots(page({ dots: { pitch: 24, r: 3, ink: 217, angle: 0.105 } }), { pitchPx: 24 }).readable).toBe(true);
  });

  it('finds big dots and tiny dots', () => {
    expect(probeDots(page({ dots: { pitch: 54, r: 6, ink: 217 } }), { pitchPx: 54 }).readable).toBe(true);
    expect(probeDots(page({ dots: { pitch: 15, r: 1.2, ink: 180 } }), { pitchPx: 15 }).readable).toBe(true);
  });

  it('a distance a little off the expected one is fine', () => {
    expect(probeDots(page({ dots: { pitch: 24, r: 3, ink: 217 } }), { pitchPx: 28 }).readable).toBe(true);
  });

  it('empty paper is not readable', () => {
    const p = probeDots(page({ noise: 0 }), { pitchPx: 24 });
    expect(p.readable).toBe(false);
    expect(p.pitchPx).toBe(0);
  });

  it('noise is not readable', () => {
    expect(probeDots(page({ noise: 6 }), { pitchPx: 24 }).readable).toBe(false);
  });

  it('dots too faint for the noise', () => {
    expect(probeDots(page({ noise: 6, dots: { pitch: 24, r: 3, ink: 250 } }), { pitchPx: 24 }).readable).toBe(false);
  });

  it('a lattice of another spacing is not the printed one', () => {
    expect(probeDots(page({ dots: { pitch: 48, r: 3, ink: 217 } }), { pitchPx: 24 }).readable).toBe(false);
    expect(probeDots(page({ dots: { pitch: 9, r: 1.5, ink: 217 } }), { pitchPx: 24 }).readable).toBe(false);
  });

  it('a small patch of dots on an empty picture is not readable', () => {
    const img = page({ dots: { pitch: 24, r: 3, ink: 217 } });
    for (let y = 0; y < img.height; y++)
      for (let x = 0; x < img.width; x++) if (x > 110 || y > 90) img.data.fill(255, (y * img.width + x) * 4, (y * img.width + x) * 4 + 3);
    expect(probeDots(img, { pitchPx: 24 }).readable).toBe(false);
  });

  it('ruled lines are no dots', () => {
    expect(probeDots(page({ lines: { every: 24, ink: 200 } }), { pitchPx: 24 }).readable).toBe(false);
  });

  it('skewed ruled lines are no dots', () => {
    expect(probeDots(page({ lines: { every: 24, ink: 200, skew: 0.03 } }), { pitchPx: 24 }).readable).toBe(false);
  });

  it('dots between ruled lines', () => {
    expect(probeDots(page({ dots: { pitch: 24, r: 3, ink: 217 }, lines: { every: 24, at: 150, ink: 200 } }), { pitchPx: 24 }).readable).toBe(true);
  });

  it('dots right beside skewed ruled lines', () => {
    expect(probeDots(page({ dots: { pitch: 24, r: 3, ink: 190 }, lines: { every: 72, at: 158, ink: 170, skew: 0.02 } }), { pitchPx: 24 }).readable).toBe(true);
  });

  it('a tiny picture does not crash', () => {
    expect(probeDots(page({ w: 3, h: 2 }), { pitchPx: 24 }).readable).toBe(false);
  });
});

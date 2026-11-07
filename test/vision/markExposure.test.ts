import { describe, expect, it } from 'vitest';
import { exposureKnob, overexposedShare } from '../../src/lab/markExposure.ts';
import type { RGBAImage } from '../../src/vision/types.ts';

function grey(values: number[]): RGBAImage {
  const data = new Uint8ClampedArray(values.length * 4);
  values.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  return { width: values.length, height: 1, data };
}

describe('overexposed share', () => {
  it('counts the pixels at the top of the range', () => {
    expect(overexposedShare(grey([255, 252, 200, 120]))).toBe(0.5);
  });

  it('a well exposed sheet has none, even when very bright', () => {
    expect(overexposedShare(grey([235, 240, 221, 238]))).toBe(0);
  });

  it('an empty picture has none', () => {
    expect(overexposedShare({ width: 0, height: 0, data: new Uint8ClampedArray(0) })).toBe(0);
  });
});

describe('exposure knob', () => {
  const range = { min: 1, max: 100, step: 1 };

  it('prefers the exposure time, which needs the manual mode', () => {
    expect(exposureKnob({ exposureMode: ['continuous', 'manual'], exposureTime: range, exposureCompensation: range, brightness: range })).toEqual({ key: 'exposureTime', manual: true, ...range });
  });

  it('does not use the exposure time without a manual mode', () => {
    expect(exposureKnob({ exposureMode: ['continuous'], exposureTime: range, exposureCompensation: range })).toEqual({ key: 'exposureCompensation', manual: false, ...range });
  });

  it('falls back to the brightness', () => {
    expect(exposureKnob({ brightness: range })).toEqual({ key: 'brightness', manual: false, ...range });
  });

  it('a range without width is no knob', () => {
    expect(exposureKnob({ brightness: { min: 5, max: 5, step: 1 } })).toBeNull();
  });

  it('a camera that offers nothing has no knob', () => {
    expect(exposureKnob({})).toBeNull();
  });
});

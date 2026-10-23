// Colour helpers for team classification.

export type Vec3 = [number, number, number];

export const GREY_DIR: Vec3 = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];

export function normalize3(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]);
  return l > 1e-9 ? [v[0] / l, v[1] / l, v[2] / l] : [...GREY_DIR];
}

/** Angle between two unit vectors in degrees. */
export function angleDeg(a: Vec3, b: Vec3): number {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return (Math.acos(d) * 180) / Math.PI;
}

/** Chromaticity (r, g) and brightness of an sRGB colour (0..255). */
export function chroma(r: number, g: number, b: number): Vec3 {
  const s = r + g + b + 1e-6;
  return [r / s, g / s, Math.max(r, g, b) / 255];
}

/** Typical ink absorption directions (1 - I/bg per channel) for preset pen colours. */
export const PEN_PRESETS: Record<string, { label: string; absorb: Vec3; css: string }> = {
  rot: { label: 'Rot', absorb: normalize3([0.12, 0.78, 0.62]), css: '#e5484d' },
  blau: { label: 'Blau', absorb: normalize3([0.8, 0.55, 0.18]), css: '#3e7bfa' },
  gruen: { label: 'Grün', absorb: normalize3([0.72, 0.25, 0.66]), css: '#30a46c' },
  lila: { label: 'Lila', absorb: normalize3([0.5, 0.8, 0.3]), css: '#8e4ec6' },
  orange: { label: 'Orange', absorb: normalize3([0.05, 0.45, 0.85]), css: '#f76b15' },
  pink: { label: 'Pink', absorb: normalize3([0.1, 0.8, 0.3]), css: '#e93d82' },
  tuerkis: { label: 'Türkis', absorb: normalize3([0.85, 0.2, 0.35]), css: '#12a594' },
  braun: { label: 'Braun', absorb: normalize3([0.35, 0.65, 0.9]), css: '#8d5a3b' },
  schwarz: { label: 'Schwarz', absorb: [...GREY_DIR], css: '#2b2b2b' },
};

/** Typical slip colours as chromaticity + brightness. */
export const SLIP_PRESETS: Record<string, { label: string; slip: Vec3; css: string }> = {
  gelb: { label: 'Gelb', slip: [0.4, 0.39, 0.95], css: '#ffe066' },
  rosa: { label: 'Rosa', slip: [0.405, 0.29, 0.95], css: '#ff9ec7' },
  hellblau: { label: 'Hellblau', slip: [0.28, 0.335, 0.92], css: '#8ecdf5' },
  gruen: { label: 'Grün', slip: [0.3, 0.405, 0.85], css: '#9be39b' },
  orange: { label: 'Orange', slip: [0.46, 0.33, 0.95], css: '#ffb366' },
  weiss: { label: 'Weiß', slip: [0.333, 0.333, 0.95], css: '#ffffff' },
  lila: { label: 'Lila', slip: [0.33, 0.27, 0.93], css: '#c9a6f5' },
  rot: { label: 'Rot', slip: [0.53, 0.235, 0.9], css: '#f26b6b' },
  blau: { label: 'Blau', slip: [0.19, 0.32, 0.9], css: '#6aa5f2' },
};

import type { Box, GrayF, Mask, RGBAImage } from './types.ts';

export function grayF(width: number, height: number): GrayF {
  return { width, height, data: new Float32Array(width * height) };
}

export function mask(width: number, height: number): Mask {
  return { width, height, data: new Uint8Array(width * height) };
}

export function rgba(width: number, height: number): RGBAImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function clampBox(b: Box, w: number, h: number): Box {
  const x = Math.max(0, Math.floor(b.x));
  const y = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(w, Math.ceil(b.x + b.w));
  const y1 = Math.min(h, Math.ceil(b.y + b.h));
  return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
}

export function cropRGBA(img: RGBAImage, box: Box): RGBAImage {
  const b = clampBox(box, img.width, img.height);
  const out = rgba(b.w, b.h);
  for (let y = 0; y < b.h; y++) {
    const s = ((b.y + y) * img.width + b.x) * 4;
    out.data.set(img.data.subarray(s, s + b.w * 4), y * b.w * 4);
  }
  return out;
}

/** Area-averaging resample of an RGBA image (downscaling), returns one Float32 plane per channel. */
export function resizeRGBAToPlanes(img: RGBAImage, ow: number, oh: number): [Float32Array, Float32Array, Float32Array] {
  const r = new Float32Array(ow * oh);
  const g = new Float32Array(ow * oh);
  const b = new Float32Array(ow * oh);
  const sx = img.width / ow;
  const sy = img.height / oh;
  if (sx === 1 && sy === 1) {
    const d = img.data;
    for (let i = 0, p = 0; i < ow * oh; i++, p += 4) {
      r[i] = d[p];
      g[i] = d[p + 1];
      b[i] = d[p + 2];
    }
    return [r, g, b];
  }
  const d = img.data;
  const W = img.width;
  for (let oy = 0; oy < oh; oy++) {
    const y0 = oy * sy;
    const y1 = y0 + sy;
    for (let ox = 0; ox < ow; ox++) {
      const x0 = ox * sx;
      const x1 = x0 + sx;
      let ar = 0;
      let ag = 0;
      let ab = 0;
      let aw = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y1) && y < img.height; y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.ceil(x1) && x < W; x++) {
          const wgt = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          const p = (y * W + x) * 4;
          ar += d[p] * wgt;
          ag += d[p + 1] * wgt;
          ab += d[p + 2] * wgt;
          aw += wgt;
        }
      }
      const i = oy * ow + ox;
      r[i] = ar / aw;
      g[i] = ag / aw;
      b[i] = ab / aw;
    }
  }
  return [r, g, b];
}

/** Area-averaging resample of a float plane to an arbitrary size. */
export function resizeArea(src: Float32Array, w: number, h: number, ow: number, oh: number): Float32Array {
  const out = new Float32Array(ow * oh);
  const fi = w / ow;
  if (Number.isInteger(fi) && fi === h / oh && fi > 1) {
    const inv = 1 / (fi * fi);
    for (let y = 0; y < h; y++) {
      const orow = ((y / fi) | 0) * ow;
      for (let x = 0; x < w; x++) out[orow + ((x / fi) | 0)] += src[y * w + x];
    }
    for (let i = 0; i < out.length; i++) out[i] *= inv;
    return out;
  }
  const sx = w / ow;
  const sy = h / oh;
  for (let oy = 0; oy < oh; oy++) {
    const y0 = oy * sy;
    const y1 = y0 + sy;
    for (let ox = 0; ox < ow; ox++) {
      const x0 = ox * sx;
      const x1 = x0 + sx;
      let acc = 0;
      let aw = 0;
      for (let y = Math.floor(y0); y < Math.ceil(y1) && y < h; y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        if (wy <= 0) continue;
        for (let x = Math.floor(x0); x < Math.ceil(x1) && x < w; x++) {
          const wgt = wy * (Math.min(x + 1, x1) - Math.max(x, x0));
          if (wgt <= 0) continue;
          acc += src[y * w + x] * wgt;
          aw += wgt;
        }
      }
      out[oy * ow + ox] = aw > 0 ? acc / aw : 0;
    }
  }
  return out;
}

/** Bilinear sample with clamping. */
export function sampleBilinear(src: Float32Array, w: number, h: number, x: number, y: number): number {
  const xf = Math.min(Math.max(x, 0), w - 1);
  const yf = Math.min(Math.max(y, 0), h - 1);
  const x0 = Math.floor(xf);
  const y0 = Math.floor(yf);
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = xf - x0;
  const fy = yf - y0;
  const a = src[y0 * w + x0] * (1 - fx) + src[y0 * w + x1] * fx;
  const b = src[y1 * w + x0] * (1 - fx) + src[y1 * w + x1] * fx;
  return a * (1 - fy) + b * fy;
}

/** Rotates (multiples of 90°, clockwise) and optionally mirrors an RGBA image. */
export function orientRGBA(img: RGBAImage, rotation: 0 | 90 | 180 | 270, mirror: boolean): RGBAImage {
  if (rotation === 0 && !mirror) return img;
  const { width: w, height: h, data } = img;
  const ow = rotation === 90 || rotation === 270 ? h : w;
  const oh = rotation === 90 || rotation === 270 ? w : h;
  const out = rgba(ow, oh);
  const u32in = new Uint32Array(data.buffer, data.byteOffset, w * h);
  const u32out = new Uint32Array(out.data.buffer);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const mx = mirror ? ow - 1 - x : x;
      let sx: number;
      let sy: number;
      if (rotation === 0) {
        sx = mx;
        sy = y;
      } else if (rotation === 90) {
        sx = y;
        sy = h - 1 - mx;
      } else if (rotation === 180) {
        sx = w - 1 - mx;
        sy = h - 1 - y;
      } else {
        sx = w - 1 - y;
        sy = mx;
      }
      u32out[y * ow + x] = u32in[sy * w + sx];
    }
  }
  return out;
}

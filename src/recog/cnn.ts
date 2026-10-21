// Pure TypeScript inference for GlyphNet (exported by tools/train/export.py, float16 weights).

export type LayerSpec =
  | { type: 'conv'; in: number; out: number; k: 3; relu: boolean; w: number; b: number }
  | { type: 'maxpool'; k: 2 }
  | { type: 'dense'; in: number; out: number; w: number; b: number };

export interface GlyphNetMeta {
  version: string;
  input: [number, number];
  classes: string;
  dtype: 'f16';
  temperature: number;
  preprocess: { size: number; fit: number; strokePx: number; blur: number };
  layers: LayerSpec[];
  accuracy?: { top1: number; group: number };
}

const F16 = (() => {
  const t = new Float32Array(65536);
  for (let h = 0; h < 65536; h++) {
    const s = h & 0x8000 ? -1 : 1;
    const e = (h >> 10) & 0x1f;
    const f = h & 0x3ff;
    if (e === 0) t[h] = s * 2 ** -14 * (f / 1024);
    else if (e === 31) t[h] = f ? NaN : s * Infinity;
    else t[h] = s * 2 ** (e - 15) * (1 + f / 1024);
  }
  return t;
})();

export function decodeF16(buf: ArrayBuffer): Float32Array {
  const u16 = new Uint16Array(buf);
  const out = new Float32Array(u16.length);
  for (let i = 0; i < u16.length; i++) out[i] = F16[u16[i]];
  return out;
}

export class GlyphNet {
  readonly meta: GlyphNetMeta;
  private weights: Float32Array;

  constructor(meta: GlyphNetMeta, weightsBin: ArrayBuffer) {
    this.meta = meta;
    this.weights = decodeF16(weightsBin);
  }

  /** Raw logits for one 28x28 input (row-major, ink = 1). */
  logits(input: Float32Array): Float32Array {
    let [h, w] = this.meta.input;
    let c = 1;
    let x = input;
    const W = this.weights;
    for (const L of this.meta.layers) {
      if (L.type === 'conv') {
        x = conv3(x, c, h, w, W, L.w, L.b, L.out, L.relu);
        c = L.out;
      } else if (L.type === 'maxpool') {
        x = maxpool2(x, c, h, w);
        h = Math.floor(h / 2);
        w = Math.floor(w / 2);
      } else {
        const out = new Float32Array(L.out);
        for (let j = 0; j < L.out; j++) {
          let acc = W[L.b + j];
          const off = L.w + j * L.in;
          for (let i = 0; i < L.in; i++) acc += W[off + i] * x[i];
          out[j] = acc;
        }
        x = out;
      }
    }
    return x;
  }

  /** Temperature-calibrated class probabilities. */
  probs(input: Float32Array): Float32Array {
    const z = this.logits(input);
    const t = this.meta.temperature || 1;
    let mx = -Infinity;
    for (let i = 0; i < z.length; i++) mx = Math.max(mx, z[i] / t);
    let sum = 0;
    const p = new Float32Array(z.length);
    for (let i = 0; i < z.length; i++) {
      p[i] = Math.exp(z[i] / t - mx);
      sum += p[i];
    }
    for (let i = 0; i < p.length; i++) p[i] /= sum;
    return p;
  }
}

/**
 * 3x3 convolution (padding 1) as im2col + matrix product: the inner loop runs over all h*w output
 * pixels at once, which V8 executes several times faster than many short row loops.
 */
function conv3(
  x: Float32Array,
  c: number,
  h: number,
  w: number,
  W: Float32Array,
  wOff: number,
  bOff: number,
  o: number,
  relu: boolean,
): Float32Array {
  const hw = h * w;
  const K = c * 9;
  const col = new Float32Array(K * hw);
  for (let ci = 0; ci < c; ci++) {
    const src = ci * hw;
    for (let ky = 0; ky < 3; ky++) {
      for (let kx = 0; kx < 3; kx++) {
        const row = (ci * 9 + ky * 3 + kx) * hw;
        const dy = ky - 1;
        const dx = kx - 1;
        for (let y = 0; y < h; y++) {
          const sy = y + dy;
          if (sy < 0 || sy >= h) continue;
          const x0 = dx < 0 ? 1 : 0;
          const x1 = dx > 0 ? w - 1 : w;
          const d = row + y * w;
          const s0 = src + sy * w + dx;
          for (let xx = x0; xx < x1; xx++) col[d + xx] = x[s0 + xx];
        }
      }
    }
  }
  const out = new Float32Array(o * hw);
  for (let oi = 0; oi < o; oi++) out.fill(W[bOff + oi], oi * hw, (oi + 1) * hw);
  // register blocking: 4 output channels x 2 inputs per pass, every input value is loaded once
  let oi = 0;
  for (; oi + 4 <= o; oi += 4) {
    const b0 = oi * hw;
    const b1 = b0 + hw;
    const b2 = b1 + hw;
    const b3 = b2 + hw;
    const r0 = wOff + oi * K;
    const r1 = r0 + K;
    const r2 = r1 + K;
    const r3 = r2 + K;
    let k = 0;
    for (; k + 2 <= K; k += 2) {
      const w0 = W[r0 + k], w1 = W[r1 + k], w2 = W[r2 + k], w3 = W[r3 + k];
      const v0 = W[r0 + k + 1], v1 = W[r1 + k + 1], v2 = W[r2 + k + 1], v3 = W[r3 + k + 1];
      const ca = k * hw;
      const cb = ca + hw;
      for (let i = 0; i < hw; i++) {
        const p = col[ca + i];
        const q = col[cb + i];
        out[b0 + i] += w0 * p + v0 * q;
        out[b1 + i] += w1 * p + v1 * q;
        out[b2 + i] += w2 * p + v2 * q;
        out[b3 + i] += w3 * p + v3 * q;
      }
    }
    for (; k < K; k++) {
      const w0 = W[r0 + k], w1 = W[r1 + k], w2 = W[r2 + k], w3 = W[r3 + k];
      const ca = k * hw;
      for (let i = 0; i < hw; i++) {
        const p = col[ca + i];
        out[b0 + i] += w0 * p;
        out[b1 + i] += w1 * p;
        out[b2 + i] += w2 * p;
        out[b3 + i] += w3 * p;
      }
    }
  }
  for (; oi < o; oi++) {
    const ob = oi * hw;
    const wk = wOff + oi * K;
    for (let k = 0; k < K; k++) {
      const wv = W[wk + k];
      const cb = k * hw;
      for (let i = 0; i < hw; i++) out[ob + i] += wv * col[cb + i];
    }
  }
  if (relu) for (let i = 0; i < out.length; i++) if (out[i] < 0) out[i] = 0;
  return out;
}

function maxpool2(x: Float32Array, c: number, h: number, w: number): Float32Array {
  const oh = Math.floor(h / 2);
  const ow = Math.floor(w / 2);
  const out = new Float32Array(c * oh * ow);
  for (let ci = 0; ci < c; ci++) {
    const ib = ci * h * w;
    const ob = ci * oh * ow;
    for (let y = 0; y < oh; y++) {
      for (let xx = 0; xx < ow; xx++) {
        const i = ib + 2 * y * w + 2 * xx;
        let m = x[i];
        if (x[i + 1] > m) m = x[i + 1];
        if (x[i + w] > m) m = x[i + w];
        if (x[i + w + 1] > m) m = x[i + w + 1];
        out[ob + y * ow + xx] = m;
      }
    }
  }
  return out;
}

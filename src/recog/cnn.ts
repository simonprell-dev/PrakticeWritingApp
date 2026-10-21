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
  const pw = w + 2;
  const ph = h + 2;
  const padded = new Float32Array(c * ph * pw);
  for (let ci = 0; ci < c; ci++) {
    for (let y = 0; y < h; y++) {
      padded.set(x.subarray(ci * h * w + y * w, ci * h * w + y * w + w), ci * ph * pw + (y + 1) * pw + 1);
    }
  }
  const out = new Float32Array(o * h * w);
  const acc = new Float32Array(h * w);
  for (let oi = 0; oi < o; oi++) {
    acc.fill(W[bOff + oi]);
    for (let ci = 0; ci < c; ci++) {
      const base = ci * ph * pw;
      const k = wOff + (oi * c + ci) * 9;
      for (let ky = 0; ky < 3; ky++) {
        for (let kx = 0; kx < 3; kx++) {
          const wv = W[k + ky * 3 + kx];
          if (wv === 0) continue;
          for (let y = 0; y < h; y++) {
            const src = base + (y + ky) * pw + kx;
            const dst = y * w;
            for (let xx = 0; xx < w; xx++) acc[dst + xx] += wv * padded[src + xx];
          }
        }
      }
    }
    const ob = oi * h * w;
    if (relu) for (let i = 0; i < h * w; i++) out[ob + i] = acc[i] > 0 ? acc[i] : 0;
    else out.set(acc, ob);
  }
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

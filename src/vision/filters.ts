// Separable filters on Float32 planes.

/** Box blur with radius r (window 2r+1), border windows are clipped and renormalised. O(1) per pixel. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src.slice();
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  // horizontal
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    let n = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) {
      acc += src[row + x];
      n++;
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / n;
      const add = x + r + 1;
      const rem = x - r;
      if (add < w) {
        acc += src[row + add];
        n++;
      }
      if (rem >= 0) {
        acc -= src[row + rem];
        n--;
      }
    }
  }
  // vertical
  for (let x = 0; x < w; x++) {
    let acc = 0;
    let n = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) {
      acc += tmp[y * w + x];
      n++;
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      const add = y + r + 1;
      const rem = y - r;
      if (add < h) {
        acc += tmp[add * w + x];
        n++;
      }
      if (rem >= 0) {
        acc -= tmp[rem * w + x];
        n--;
      }
    }
  }
  return out;
}

/** 1D running max/min (van Herk / Gil-Werman) over a strided line. */
function vhgw(
  src: Float32Array,
  dst: Float32Array,
  offset: number,
  stride: number,
  n: number,
  r: number,
  isMax: boolean,
  g: Float32Array,
  hbuf: Float32Array,
): void {
  const k = 2 * r + 1;
  const pad = isMax ? -Infinity : Infinity;
  const len = n + 2 * r;
  const m = Math.ceil(len / k) * k;
  const val = (i: number) => {
    const j = i - r;
    return j >= 0 && j < n ? src[offset + j * stride] : pad;
  };
  for (let s = 0; s < m; s += k) {
    let acc = val(s);
    g[s] = acc;
    for (let i = s + 1; i < s + k; i++) {
      const v = val(i);
      acc = isMax ? (v > acc ? v : acc) : v < acc ? v : acc;
      g[i] = acc;
    }
    acc = val(s + k - 1);
    hbuf[s + k - 1] = acc;
    for (let i = s + k - 2; i >= s; i--) {
      const v = val(i);
      acc = isMax ? (v > acc ? v : acc) : v < acc ? v : acc;
      hbuf[i] = acc;
    }
  }
  for (let j = 0; j < n; j++) {
    // window in padded coordinates: [j, j + 2r]
    const a = hbuf[j];
    const b = g[j + 2 * r];
    dst[offset + j * stride] = isMax ? (a > b ? a : b) : a < b ? a : b;
  }
}

function rankFilter(src: Float32Array, w: number, h: number, r: number, isMax: boolean): Float32Array {
  if (r <= 0) return src.slice();
  const k = 2 * r + 1;
  const maxLen = Math.ceil((Math.max(w, h) + 2 * r) / k) * k;
  const g = new Float32Array(maxLen);
  const hb = new Float32Array(maxLen);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) vhgw(src, tmp, y * w, 1, w, r, isMax, g, hb);
  for (let x = 0; x < w; x++) vhgw(tmp, out, x, w, h, r, isMax, g, hb);
  return out;
}

/** Max filter along the rows only (window 2r+1 wide, 1 high). */
export function rowMaxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r <= 0) return src.slice();
  const k = 2 * r + 1;
  const len = Math.ceil((w + 2 * r) / k) * k;
  const g = new Float32Array(len);
  const hb = new Float32Array(len);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) vhgw(src, out, y * w, 1, w, r, true, g, hb);
  return out;
}

/** Square max filter (grey dilation) with radius r. */
export function maxFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  return rankFilter(src, w, h, r, true);
}

/** Square min filter (grey erosion) with radius r. */
export function minFilter(src: Float32Array, w: number, h: number, r: number): Float32Array {
  return rankFilter(src, w, h, r, false);
}

/** Separable Gaussian blur, edges replicated. */
export function gaussianBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  if (sigma <= 0) return src.slice();
  const r = Math.max(1, Math.ceil(2.5 * sigma));
  const k = new Float32Array(2 * r + 1);
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const xx = x + i < 0 ? 0 : x + i >= w ? w - 1 : x + i;
        acc += src[y * w + xx] * k[i + r];
      }
      tmp[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i < 0 ? 0 : y + i >= h ? h - 1 : y + i;
        acc += tmp[yy * w + x] * k[i + r];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
}

/** Variance of the 4-neighbour Laplacian, a cheap sharpness measure. */
export function laplacianVariance(src: Float32Array, w: number, h: number): number {
  let s = 0;
  let s2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * src[i] - src[i - 1] - src[i + 1] - src[i - w] - src[i + w];
      s += l;
      s2 += l * l;
      n++;
    }
  }
  if (n === 0) return 0;
  const m = s / n;
  return s2 / n - m * m;
}

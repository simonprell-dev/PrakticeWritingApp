// Pictures in saved games: canvases and RGBA images become data URLs (PNG for the little letters, JPEG for
// the coloured cards) and back. Data URLs are never fetch()ed: the CSP only allows our own server.
import { makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import type { RGBAImage } from '../vision/types.ts';

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function canvasToDataURL(c: AnyCanvas, type = 'image/png', quality = 0.88): Promise<string> {
  if ('toDataURL' in c) return c.toDataURL(type, quality);
  const blob = await c.convertToBlob({ type, quality });
  return `data:${blob.type};base64,${toBase64(new Uint8Array(await blob.arrayBuffer()))}`;
}

export function rgbaToDataURL(img: RGBAImage, type = 'image/png', quality = 0.88): Promise<string> {
  const { canvas, ctx } = makeCanvas(img.width, img.height);
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
  return canvasToDataURL(canvas, type, quality);
}

export async function dataURLToRGBA(url: string): Promise<RGBAImage> {
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(url);
  if (!m) throw new Error('Bild im Spielstand fehlt');
  const bmp = await createImageBitmap(new Blob([fromBase64(m[2])], { type: m[1] }));
  const { ctx } = makeCanvas(bmp.width, bmp.height);
  ctx.drawImage(bmp, 0, 0);
  const id = ctx.getImageData(0, 0, bmp.width, bmp.height);
  bmp.close();
  return { width: id.width, height: id.height, data: new Uint8ClampedArray(id.data) };
}

const encoded = new WeakMap<object, string>();

/** a picture loaded from a saved game keeps its text, so saving it again costs nothing */
export function rememberEncoded(key: object, s: string): void {
  encoded.set(key, s);
}

/** Encodes a picture once (it never changes); later saves reuse the text. */
export async function encodeOnce(key: object, make: () => Promise<string>): Promise<string> {
  const hit = encoded.get(key);
  if (hit) return hit;
  const s = await make();
  encoded.set(key, s);
  return s;
}

const TYPED = {
  Uint8Array,
  Uint8ClampedArray,
  Int8Array,
  Uint16Array,
  Int16Array,
  Uint32Array,
  Int32Array,
  Float32Array,
  Float64Array,
} as const;
type TypedName = keyof typeof TYPED;

/** Deep copy that turns typed arrays into JSON-friendly `{ $typed, b64 }` objects. */
export function packTyped(v: unknown): unknown {
  if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
    const name = v.constructor.name as TypedName;
    if (name in TYPED) return { $typed: name, b64: toBase64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
  }
  if (Array.isArray(v)) return v.map(packTyped);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = packTyped(x);
    return out;
  }
  return v;
}

export function unpackTyped(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(unpackTyped);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.$typed === 'string' && typeof o.b64 === 'string' && o.$typed in TYPED) {
      const bytes = fromBase64(o.b64);
      const T = TYPED[o.$typed as TypedName];
      return new T(bytes.buffer, 0, bytes.byteLength / T.BYTES_PER_ELEMENT);
    }
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(o)) out[k] = unpackTyped(x);
    return out;
  }
  return v;
}

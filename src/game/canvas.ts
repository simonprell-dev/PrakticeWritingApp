// Canvas factory so sprite generation runs in the browser and in Node previews (@napi-rs/canvas).
import type { RGBAImage } from '../vision/types.ts';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type Factory = (w: number, h: number) => AnyCanvas;
type PathCtor = new (p?: Path2D | string) => Path2D;

let factory: Factory = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};
let PathImpl: PathCtor | null = typeof Path2D !== 'undefined' ? Path2D : null;

export function setCanvasFactory(f: Factory, path?: PathCtor): void {
  factory = f;
  if (path) PathImpl = path;
}

/** an empty path, or one from SVG path data */
export function makePath(d?: string): Path2D {
  if (!PathImpl) throw new Error('Path2D not available');
  return d === undefined ? new PathImpl() : new PathImpl(d);
}

export function makeCanvas(w: number, h: number): { canvas: AnyCanvas; ctx: Ctx } {
  const canvas = factory(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
  const ctx = canvas.getContext('2d') as Ctx;
  return { canvas, ctx };
}

/** RGBA buffer (e.g. a glyph sticker from the worker) to a canvas. */
export function canvasFromRGBA(img: RGBAImage): AnyCanvas {
  const { canvas, ctx } = makeCanvas(img.width, img.height);
  const id = ctx.createImageData(img.width, img.height);
  id.data.set(img.data);
  ctx.putImageData(id, 0, 0);
  return canvas;
}

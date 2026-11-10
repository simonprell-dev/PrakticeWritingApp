// Handwriting samples ("Schriftproben") of a lesson: every letter the recognition found for the first time,
// cut out of the paper (the transparent ink sticker, no photo, no name), in the order it was written, with
// what it is. After the lesson the app asks whether the class gives them to improve the recognition; they go
// to the server (POST /api/samples, server/samples.js) and from there, through the admin's download, into the
// training (tools/train/import_samples.py).
//
// How sure a label is:
//   wort    – the Wörter-Zoo: the whole word stood there spelled right, so every letter is what it should be
//   uebung  – practice: the practice letter, and the recognition agreed
//   erkannt – only the recognition's guess (checked by hand before training)
import { makeCanvas } from '../game/canvas.ts';
import type { RGBAImage, ScannedGlyph } from '../vision/types.ts';

export type LabelSource = 'wort' | 'uebung' | 'erkannt';

export interface SampleEntry {
  glyphId: number;
  seq: number;
  /** which photo of the lesson */
  scan: number;
  label: string;
  source: LabelSource;
  recognized: string;
  target: string | null;
  score: number;
  tier: string;
  mirrored: boolean;
  rejected: boolean;
  dots: number;
  box: { x: number; y: number; w: number; h: number };
  crop: RGBAImage;
}

export interface SampleMeta {
  game: string;
  ticket: string;
  script: string;
  style: string;
  lang: string;
}

/** at most this many letters of one lesson (the server takes no more) */
export const MAX_SAMPLES = 400;
/** the longest side of a sample picture */
const MAX_SIDE = 128;
/** fewer letters than this are not worth a question */
export const MIN_SAMPLES = 5;

/** what a letter is, as far as the app knows it without a person looking */
export function labelOf(g: ScannedGlyph, target: string | null): { label: string; source: LabelSource } {
  const char = g.score.char;
  if (g.score.mirrored || g.score.rejected) return { label: char, source: 'erkannt' };
  if (target && char === target) return { label: target, source: 'uebung' };
  return { label: char, source: 'erkannt' };
}

export class SampleCollector {
  private list: SampleEntry[] = [];
  private scans = 0;

  /** a new lesson */
  reset(): void {
    this.list = [];
    this.scans = 0;
  }

  get size(): number {
    return this.list.length;
  }

  entries(): readonly SampleEntry[] {
    return this.list;
  }

  /** the letters of one photo: only those seen for the first time; `target` is the practice letter, if any */
  addScan(glyphs: readonly ScannedGlyph[], target: string | null): void {
    const scan = this.scans++;
    for (const g of glyphs) {
      if (!g.isNew || !g.score.char || this.list.length >= MAX_SAMPLES) continue;
      const { label, source } = labelOf(g, target);
      this.list.push({
        glyphId: g.id,
        seq: this.list.length,
        scan,
        label,
        source,
        recognized: g.score.char,
        target,
        score: Math.round(Math.max(0, Math.min(100, g.score.score))),
        tier: g.score.tier,
        mirrored: !!g.score.mirrored,
        rejected: !!g.score.rejected,
        dots: g.dots,
        box: { x: Math.round(g.box.x), y: Math.round(g.box.y), w: Math.round(g.box.w), h: Math.round(g.box.h) },
        crop: g.crop,
      });
    }
  }

  /** a word spelled right (Wörter-Zoo): these letters are `chars`, sure */
  confirm(glyphIds: readonly number[], chars: readonly string[]): void {
    if (glyphIds.length !== chars.length) return;
    glyphIds.forEach((id, i) => {
      const e = this.list.find((x) => x.glyphId === id);
      if (e && !e.mirrored && !e.rejected) {
        e.label = chars[i];
        e.source = 'wort';
      }
    });
  }

  /** the upload of the lesson (POST /api/samples) */
  async payload(meta: SampleMeta, encode: (img: RGBAImage) => Promise<string> = encodeSample) {
    const samples = [];
    for (const e of this.list) {
      samples.push({
        seq: e.seq,
        scan: e.scan,
        label: e.label,
        source: e.source,
        recognized: e.recognized,
        target: e.target ?? '',
        score: e.score,
        tier: e.tier,
        mirrored: e.mirrored,
        rejected: e.rejected,
        dots: e.dots,
        box: e.box,
        png: await encode(e.crop),
      });
    }
    return { ...meta, samples };
  }
}

/** base64 of the bytes */
function base64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** a letter as a small PNG (base64), its long side at most 128 px */
export async function encodeSample(img: RGBAImage): Promise<string> {
  const src = makeCanvas(img.width, img.height);
  const data = src.ctx.createImageData(img.width, img.height);
  data.data.set(img.data);
  src.ctx.putImageData(data, 0, 0);
  const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * k));
  const h = Math.max(1, Math.round(img.height * k));
  let out = src.canvas;
  if (k < 1) {
    const dst = makeCanvas(w, h);
    dst.ctx.imageSmoothingQuality = 'high';
    dst.ctx.drawImage(src.canvas as CanvasImageSource, 0, 0, w, h);
    out = dst.canvas;
  }
  const c = out as AnyCanvasLike;
  if (typeof c.convertToBlob === 'function') return base64(new Uint8Array(await (await c.convertToBlob({ type: 'image/png' })).arrayBuffer()));
  if (typeof c.toBuffer === 'function') return base64(new Uint8Array(c.toBuffer('image/png')));
  const blob = await new Promise<Blob | null>((ok) => c.toBlob!(ok, 'image/png'));
  if (!blob) throw new Error('PNG');
  return base64(new Uint8Array(await blob.arrayBuffer()));
}

/** what the three kinds of canvas (browser, offscreen, Node previews) offer to get a PNG */
interface AnyCanvasLike {
  convertToBlob?(o: { type: string }): Promise<Blob>;
  toBlob?(cb: (b: Blob | null) => void, type: string): void;
  toBuffer?(type: string): Uint8Array;
}

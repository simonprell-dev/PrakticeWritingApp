// The real fields of the test sheet, rendered and softened like a camera picture, through the real measurement.
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/game/rng.ts';
import { BOX_PITCH, DOT_PITCH, FIELD_INSET, markTestSvg, TEST_FIELDS } from '../../src/lab/markTestSheet.ts';
import { boxBlur } from '../../src/vision/filters.ts';
import { probeDots } from '../../src/vision/markProbe.ts';
import type { RGBAImage } from '../../src/vision/types.ts';

/** the inner part of a field at a camera scale; `edit` changes the page before it is drawn */
async function picture(id: string, pxPerMm: number, edit: (svg: string) => string = (s) => s): Promise<{ img: RGBAImage; pitchPx: number }> {
  const f = TEST_FIELDS.find((x) => x.id === id)!;
  const { x, y, w, h } = f.box;
  const ix = x + w * FIELD_INSET;
  const iy = y + h * FIELD_INSET;
  const iw = w * (1 - 2 * FIELD_INSET);
  const ih = h * (1 - 2 * FIELD_INSET);
  const W = Math.round(iw * pxPerMm);
  const H = Math.round(ih * pxPerMm);
  const svg = edit(markTestSvg(f.page)).replace('viewBox="0 0 210 297" width="210mm" height="297mm"', `viewBox="${ix} ${iy} ${iw} ${ih}" width="${W}" height="${H}"`);
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');
  ctx.drawImage(await loadImage(Buffer.from(svg)), 0, 0);
  const raw = ctx.getImageData(0, 0, W, H).data;
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) grey[i] = 0.299 * raw[i * 4] + 0.587 * raw[i * 4 + 1] + 0.114 * raw[i * 4 + 2];
  const soft = boxBlur(grey, W, H, 1);
  const rand = mulberry32(5);
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = soft[i] + (rand() * 2 - 1) * 2;
    data[i * 4 + 3] = 255;
  }
  return { img: { width: W, height: H, data }, pitchPx: pxPerMm * (f.kind === 'dots' ? DOT_PITCH : BOX_PITCH) };
}

const read = async (id: string, pxPerMm: number, edit?: (svg: string) => string) => {
  const { img, pitchPx } = await picture(id, pxPerMm, edit);
  return probeDots(img, { pitchPx });
};
const noDots = (svg: string) => svg.replace(/<circle [^>]*\/>/g, '');

describe('fields of the test sheet', () => {
  for (const id of ['weiss-blass-016', 'zeile-blass-016', 'band-blass-016', 'liniert-blass-016', 'kariert-blass-016'])
    it(`${id} is readable from near`, async () => {
      expect((await read(id, 18)).readable).toBe(true);
    });

  for (const id of ['liniert-dunkel-022', 'liniert-dunkel-030', 'kariert-blass-030', 'kariert-kraeftig-022', 'kariert-dunkel-022', 'weiss-dunkel-030', 'band-blass-030'])
    it(`${id}: a stronger dot does not score worse`, async () => {
      expect((await read(id, 18)).readable).toBe(true);
    });

  for (const scale of [3.6, 5, 18]) {
    it(`the boxes are readable at ${scale} px/mm`, async () => {
      expect((await read('kaestchen-hell', scale)).readable).toBe(true);
      expect((await read('kaestchen-dunkel', scale)).readable).toBe(true);
    });
  }

  for (const scale of [12, 13.24, 14, 18])
    for (const id of ['kariert-blass-016', 'liniert-blass-016'])
      it(`${id} without its dots is not readable at ${scale} px/mm`, async () => {
        expect((await read(id, scale, noDots)).readable).toBe(false);
      });

  it('half a field lost is not readable', async () => {
    const f = TEST_FIELDS.find((x) => x.id === 'weiss-blass-016')!;
    const mid = f.box.x + f.box.w / 2;
    const half = (svg: string) => svg.replace(/<circle cx="([\d.]+)"[^>]*\/>/g, (m, cx) => (Number(cx) > mid ? '' : m));
    expect((await read('weiss-blass-016', 18, half)).readable).toBe(false);
  });

  it('every second dot lost is not readable', async () => {
    let n = 0;
    const every = (svg: string) => svg.replace(/<circle [^>]*\/>/g, (m) => (n++ % 2 ? '' : m));
    expect((await read('weiss-blass-016', 18, every)).readable).toBe(false);
  });
});

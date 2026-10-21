import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GlyphNet, type GlyphNetMeta } from '../../src/recog/cnn.ts';
import { Recognizer } from '../../src/recog/recognizer.ts';
import { TemplateBank, type TemplateMeta } from '../../src/recog/templates.ts';

const MODEL = fileURLToPath(new URL('../../public/model/', import.meta.url));

const toAB = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

let bank: TemplateBank | null = null;
export function loadBank(): TemplateBank {
  if (!bank) {
    const meta = JSON.parse(readFileSync(MODEL + 'templates-v1.json', 'utf8')) as TemplateMeta;
    bank = new TemplateBank(meta, toAB(readFileSync(MODEL + 'templates-v1.bin')));
  }
  return bank;
}

export function hasModel(): boolean {
  return existsSync(MODEL + 'glyphnet-v1.json') && existsSync(MODEL + 'glyphnet-v1.bin');
}

let net: GlyphNet | null = null;
export function loadNet(): GlyphNet | null {
  if (!hasModel()) return null;
  if (!net) {
    const meta = JSON.parse(readFileSync(MODEL + 'glyphnet-v1.json', 'utf8')) as GlyphNetMeta;
    net = new GlyphNet(meta, toAB(readFileSync(MODEL + 'glyphnet-v1.bin')));
  }
  return net;
}

export function loadRecognizer(withNet = true): Recognizer {
  let calib: Record<string, number> = {};
  if (existsSync(MODEL + 'calib-v1.json')) calib = JSON.parse(readFileSync(MODEL + 'calib-v1.json', 'utf8')).median ?? {};
  return new Recognizer(loadBank(), withNet ? loadNet() : null, calib);
}

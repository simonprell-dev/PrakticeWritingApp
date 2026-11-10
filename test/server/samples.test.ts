import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { pngSize, validateSampleBatch, validateSampleDelete } from '../../server/samples.js';
import { ZipWriter } from '../../server/zip.js';

/** a tiny valid PNG header (signature + IHDR) of w × h; enough for the size check */
function png(w: number, h: number): string {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  b[24] = 8;
  b[25] = 6;
  return b.toString('base64');
}

const sample = (patch: Record<string, unknown> = {}) => ({
  seq: 0,
  scan: 0,
  label: 'A',
  source: 'uebung',
  recognized: 'A',
  target: 'A',
  score: 72,
  tier: 'schoen',
  mirrored: false,
  rejected: false,
  dots: 0,
  box: { x: 10, y: 20, w: 30, h: 40 },
  png: png(30, 40),
  ...patch,
});
const batch = (patch: Record<string, unknown> = {}) => ({ game: 'meer', ticket: 'a.b', script: 'druck', style: 'beide', lang: 'de', samples: [sample()], ...patch });

describe('a lesson of handwriting samples', () => {
  it('takes the letters with their order, label and where it comes from', () => {
    const v = validateSampleBatch(batch({ samples: [sample(), sample({ seq: 1, label: 'ß', source: 'wort', target: '', recognized: 'B' })] }));
    expect(v.ok).toBe(true);
    expect(v.value?.samples).toHaveLength(2);
    expect(v.value?.samples[1]).toMatchObject({ seq: 1, label: 'ß', source: 'wort', recognized: 'B', target: null });
    expect(v.value?.samples[0].png).toBeInstanceOf(Buffer);
    expect(v.value).toMatchObject({ game: 'meer', ticket: 'a.b', script: 'druck', style: 'beide', lang: 'de' });
  });

  it('a label is exactly one character', () => {
    expect(validateSampleBatch(batch({ samples: [sample({ label: 'AB' })] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: [sample({ label: '' })] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: [sample({ label: 'あ' })] })).ok).toBe(true);
  });

  it('only real small PNG images', () => {
    expect(validateSampleBatch(batch({ samples: [sample({ png: Buffer.from('nope').toString('base64') })] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: [sample({ png: png(400, 20) })] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: [sample({ png: 'A'.repeat(60_000) })] })).ok).toBe(false);
    expect(pngSize(Buffer.from(png(30, 40), 'base64'))).toEqual({ w: 30, h: 40 });
  });

  it('refuses an empty lesson, too many letters, unknown games, sources and fields', () => {
    expect(validateSampleBatch(batch({ samples: [] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: Array.from({ length: 401 }, (_, i) => sample({ seq: i })) })).ok).toBe(false);
    expect(validateSampleBatch(batch({ game: 'mond' })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: [sample({ source: 'geraten' })] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ name: 'Paul' })).ok).toBe(false);
    expect(validateSampleBatch(batch({ samples: [sample({ name: 'Paul' })] })).ok).toBe(false);
    expect(validateSampleBatch(batch({ ticket: undefined })).ok).toBe(false);
    expect(validateSampleBatch(null).ok).toBe(false);
  });

  it('the admin deletes one lesson, the downloaded ones or all', () => {
    expect(validateSampleDelete({ batch: '0b8a2f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b' })).toEqual({ ok: true, value: { batch: '0b8a2f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b' } });
    expect(validateSampleDelete({ exported: true })).toEqual({ ok: true, value: { exported: true } });
    expect(validateSampleDelete({ all: true })).toEqual({ ok: true, value: { all: true } });
    expect(validateSampleDelete({ batch: 'x; drop table' }).ok).toBe(false);
    expect(validateSampleDelete({}).ok).toBe(false);
  });
});

/** reads a stored ZIP back: name -> content, through the central directory */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
    const lName = buf.readUInt16LE(local + 26);
    const lExtra = buf.readUInt16LE(local + 28);
    const data = buf.subarray(local + 30 + lName + lExtra, local + 30 + lName + lExtra + size);
    out.set(name, method === 8 ? inflateRawSync(data) : Buffer.from(data));
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

describe('the download package', () => {
  it('is a ZIP with the files as written, UTF-8 names included', () => {
    const parts: Buffer[] = [];
    const zip = new ZipWriter((b) => parts.push(b));
    zip.add('LIESMICH.txt', Buffer.from('Hallo Schriftproben – äöü'));
    zip.add('images/b1/0.png', Buffer.from([1, 2, 3, 4]));
    zip.add('samples.csv', Buffer.from('id,label\n1,ß\n'));
    zip.end();
    const files = unzip(Buffer.concat(parts));
    expect([...files.keys()]).toEqual(['LIESMICH.txt', 'images/b1/0.png', 'samples.csv']);
    expect(files.get('samples.csv')!.toString('utf8')).toBe('id,label\n1,ß\n');
    expect([...files.get('images/b1/0.png')!]).toEqual([1, 2, 3, 4]);
  });
});

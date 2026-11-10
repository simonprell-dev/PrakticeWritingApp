import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi } from '../../server/api.js';

let clock = 1_000_000;
let stored = 0;
const lessons: { game: string; samples: unknown[] }[] = [];
const fakeDb = {
  ready: true,
  migrate: async () => {},
  cleanup: async () => {},
  close: async () => {},
  sampleCount: async () => stored,
  addSamples: async (b: { game: string; samples: unknown[] }) => {
    lessons.push(b);
    stored += b.samples.length;
    return 'id';
  },
};
let api: ReturnType<typeof createApi>;
const make = () => (api = createApi({ ADMIN_PASSWORD: '', GEOIP: 'off' } as unknown as NodeJS.ProcessEnv, { now: () => clock, db: fakeDb }));

async function post(path: string, body: unknown, ip = '10.0.0.1'): Promise<{ status: number; json: Record<string, unknown> }> {
  const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'x' },
    socket: { remoteAddress: ip },
  });
  let status = 0;
  let out = '';
  const res = {
    headersSent: false,
    writeHead(s: number) {
      status = s;
      return { end: (d?: Buffer) => (out = d ? d.toString() : '') };
    },
  };
  await api.handle(req as never, res as never, new URL(`http://x${path}`));
  return { status, json: out ? JSON.parse(out) : {} };
}

function png(): string {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(20, 16);
  b.writeUInt32BE(30, 20);
  return b.toString('base64');
}
const lesson = (ticket: string, n = 3) => ({
  game: 'meer',
  ticket,
  script: 'druck',
  style: 'beide',
  lang: 'de',
  samples: Array.from({ length: n }, (_, i) => ({
    seq: i,
    scan: 0,
    label: 'A',
    source: 'erkannt',
    recognized: 'A',
    target: '',
    score: 50,
    tier: 'nett',
    mirrored: false,
    rejected: false,
    dots: 0,
    box: { x: 1, y: 2, w: 3, h: 4 },
    png: png(),
  })),
});
const ticket = async () => (await post('/api/rating/ticket', { game: 'meer' })).json.ticket as string;

afterEach(async () => {
  await api?.close();
  lessons.length = 0;
  stored = 0;
  clock = 1_000_000;
});

describe('uploading the handwriting samples of a lesson', () => {
  it('with the ticket of the lesson, after a minute, once', async () => {
    make();
    const tk = await ticket();
    clock += 61_000;
    expect((await post('/api/samples', lesson(tk))).status).toBe(200);
    expect(lessons).toHaveLength(1);
    expect((await post('/api/samples', lesson(tk))).status).toBe(403);
    expect(lessons).toHaveLength(1);
  });

  it('the same lesson ticket still carries the vote of the feedback light', async () => {
    make();
    const votes: unknown[] = [];
    Object.assign(fakeDb, { addRating: async (v: unknown) => void votes.push(v) });
    const tk = await ticket();
    clock += 61_000;
    await post('/api/samples', lesson(tk));
    expect((await post('/api/rating', { game: 'meer', rating: 'gruen', ticket: tk })).status).toBe(200);
    expect(votes).toHaveLength(1);
  });

  it('not right after the start and not without a real ticket', async () => {
    make();
    const tk = await ticket();
    expect((await post('/api/samples', lesson(tk))).status).toBe(403);
    clock += 61_000;
    expect((await post('/api/samples', lesson('abc.def'))).status).toBe(403);
    expect(lessons).toHaveLength(0);
  });

  it('a full store takes nothing more', async () => {
    make();
    stored = 299_999;
    const tk = await ticket();
    clock += 61_000;
    expect((await post('/api/samples', lesson(tk, 3))).status).toBe(507);
    expect(lessons).toHaveLength(0);
  });
});

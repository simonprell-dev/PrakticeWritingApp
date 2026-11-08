import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { createApi } from '../../server/api.js';

let clock = 1_000_000;
const votes: unknown[] = [];
const fakeDb = { ready: true, migrate: async () => {}, cleanup: async () => {}, addRating: async (v: unknown) => void votes.push(v), close: async () => {} };
let api: ReturnType<typeof createApi>;

function make() {
  api = createApi({ ADMIN_PASSWORD: '', GEOIP: 'off' } as unknown as NodeJS.ProcessEnv, { now: () => clock, db: fakeDb });
}

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

const ticket = async (game = 'meer', ip?: string) => (await post('/api/rating/ticket', { game }, ip)).json.ticket as string;

afterEach(async () => {
  await api?.close();
  votes.length = 0;
  clock = 1_000_000;
});

describe('spam protection of the feedback light', () => {
  it('a vote with the ticket of the game, after a minute, counts once', async () => {
    make();
    const tk = await ticket();
    clock += 61_000;
    expect((await post('/api/rating', { game: 'meer', rating: 'gruen', ticket: tk })).status).toBe(200);
    expect(votes).toEqual([{ game: 'meer', rating: 'gruen', lang: null }]);
  });

  it('a vote right after the start does not count', async () => {
    make();
    const tk = await ticket();
    clock += 5_000;
    expect((await post('/api/rating', { game: 'meer', rating: 'rot', ticket: tk })).status).toBe(403);
    expect(votes).toEqual([]);
  });

  it('a made-up ticket or one of another game does not count', async () => {
    make();
    const tk = await ticket('duell');
    clock += 61_000;
    expect((await post('/api/rating', { game: 'meer', rating: 'rot', ticket: tk })).status).toBe(403);
    expect((await post('/api/rating', { game: 'meer', rating: 'rot', ticket: 'abc.def' })).status).toBe(403);
    expect((await post('/api/rating', { game: 'meer', rating: 'rot' })).status).toBe(400);
    expect(votes).toEqual([]);
  });

  it('the same ticket twice counts once', async () => {
    make();
    const tk = await ticket();
    clock += 61_000;
    await post('/api/rating', { game: 'meer', rating: 'gruen', ticket: tk });
    clock += 4 * 60_000;
    expect((await post('/api/rating', { game: 'meer', rating: 'gruen', ticket: tk })).status).toBe(403);
    expect(votes).toHaveLength(1);
  });

  it('one vote per game and address every three minutes', async () => {
    make();
    const a = await ticket();
    const b = await ticket();
    clock += 61_000;
    await post('/api/rating', { game: 'meer', rating: 'gruen', ticket: a });
    expect((await post('/api/rating', { game: 'meer', rating: 'rot', ticket: b })).status).toBe(429);
    // another address (another school) votes for the same game
    const c = await ticket('meer', '10.0.0.2');
    clock += 61_000;
    expect((await post('/api/rating', { game: 'meer', rating: 'gelb', ticket: c }, '10.0.0.2')).status).toBe(200);
    expect(votes).toHaveLength(2);
  });

  it('a ticket only for a game there is', async () => {
    make();
    expect((await post('/api/rating/ticket', { game: 'mond' })).status).toBe(400);
  });
});

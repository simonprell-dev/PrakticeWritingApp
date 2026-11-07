import { describe, expect, it } from 'vitest';
import { validateWorlds, WORLD_IDS as SERVER_IDS } from '../../server/validate.js';
import { DEFAULT_PLAN, WORLD_IDS } from '../../src/app/worlds.ts';

const plan = (patch: Record<string, unknown>) => ({ version: 1, worlds: { ...structuredClone(DEFAULT_PLAN.worlds), ...patch } });

describe('validateWorlds', () => {
  it('server and app know the same worlds', () => {
    expect([...SERVER_IDS].sort()).toEqual([...WORLD_IDS].sort());
  });

  it('takes the default plan', () => {
    expect(validateWorlds(DEFAULT_PLAN)).toEqual({ ok: true, value: DEFAULT_PLAN });
  });

  it('takes the 29th of February', () => {
    expect(validateWorlds(plan({ winter: { mode: 'plan', from: '12-01', to: '02-29' } })).ok).toBe(true);
  });

  for (const [what, patch] of [
    ['an unknown world', { foo: { mode: 'on', from: '01-01', to: '12-31' } }],
    ['an unknown mode', { meer: { mode: 'x', from: '01-01', to: '12-31' } }],
    ['month 13', { herbst: { mode: 'plan', from: '13-01', to: '11-30' } }],
    ['the 30th of February', { herbst: { mode: 'plan', from: '02-30', to: '11-30' } }],
    ['a short date', { herbst: { mode: 'plan', from: '2-1', to: '11-30' } }],
    ['Easter 61 days before', { ostern: { mode: 'plan', easter: { before: 61, after: 1 } } }],
    ['Easter after a negative day', { ostern: { mode: 'plan', easter: { before: 1, after: -1 } } }],
    ['fixed days for Easter', { ostern: { mode: 'plan', from: '04-01', to: '04-10' } }],
    ['a missing world', { meer: undefined }],
  ] as const)
    it(`refuses ${what}`, () => {
      const body = plan(patch as Record<string, unknown>);
      if ('meer' in patch && patch.meer === undefined) delete (body.worlds as Record<string, unknown>).meer;
      expect(validateWorlds(body).ok).toBe(false);
    });

  it('refuses a body without worlds', () => {
    expect(validateWorlds({ version: 1 }).ok).toBe(false);
    expect(validateWorlds(null).ok).toBe(false);
  });
});

describe('GET /api/worlds', () => {
  it('answers with no plan when there is no database', async () => {
    const { createApi } = await import('../../server/api.js');
    const api = createApi({ ADMIN_PASSWORD: '' } as unknown as NodeJS.ProcessEnv);
    let status = 0;
    let body = '';
    const res = {
      headersSent: false,
      writeHead(s: number) {
        status = s;
        return { end: (d?: Buffer) => (body = d ? d.toString() : '') };
      },
    };
    const req = { method: 'GET', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
    await api.handle(req as never, res as never, new URL('http://x/api/worlds'));
    await api.close();
    expect(status).toBe(200);
    expect(JSON.parse(body)).toEqual({ plan: null });
  });
});

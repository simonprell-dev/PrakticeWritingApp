import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { buildIndex, GeoIp, lookup, parseIp } from '../../server/geo.js';

// a few lines in the format of dbip-country-lite-YYYY-MM.csv
const CSV = [
  '0.0.0.0,0.255.255.255,ZZ',
  '1.0.0.0,1.0.0.255,AU',
  '5.10.0.0,5.10.255.255,DE',
  '10.0.0.0,10.255.255.255,ZZ',
  '200.0.0.0,200.0.0.255,BR',
  '255.255.255.0,255.255.255.255,US',
  '2001:db8::,2001:db8:ffff:ffff:ffff:ffff:ffff:ffff,ZZ',
  '2a00:1450::,2a00:1450:ffff:ffff:ffff:ffff:ffff:ffff,IE',
  '2a02:8100::,2a02:81ff:ffff:ffff:ffff:ffff:ffff:ffff,DE',
].join('\n');

describe('parseIp', () => {
  it('reads IPv4, IPv6 and IPv4 inside IPv6', () => {
    expect(parseIp('1.2.3.4')).toEqual({ v: 4, n: 0x01020304 });
    expect(parseIp('::ffff:5.10.1.2')).toEqual({ v: 4, n: 0x050a0102 });
    expect(parseIp('2a00:1450:4001:80b::200e')).toEqual({ v: 6, hi: 0x2a00145040010_80bn });
    expect(parseIp('::1')).toEqual({ v: 6, hi: 0n });
    expect(parseIp('[2a02:8100::1]')).toEqual({ v: 6, hi: 0x2a02810000000000n });
  });

  it('refuses everything else', () => {
    for (const bad of ['', 'unknown', '1.2.3', '300.1.1.1', 'abc::xyz', undefined]) expect(parseIp(bad)).toBeNull();
  });
});

describe('lookup', () => {
  const index = buildIndex(CSV);

  it('finds the country of an address', () => {
    expect(lookup(index, '5.10.200.1')).toBe('DE');
    expect(lookup(index, '1.0.0.0')).toBe('AU');
    expect(lookup(index, '255.255.255.255')).toBe('US');
    expect(lookup(index, '::ffff:200.0.0.9')).toBe('BR');
    expect(lookup(index, '2a00:1450:4001:80b::200e')).toBe('IE');
    expect(lookup(index, '2a02:8150::1')).toBe('DE');
  });

  it('knows nothing about private networks, gaps and broken input', () => {
    expect(lookup(index, '10.1.2.3')).toBeNull();
    expect(lookup(index, '127.0.0.1')).toBeNull();
    expect(lookup(index, '2001:db8::1')).toBeNull();
    expect(lookup(index, 'unknown')).toBeNull();
    expect(lookup(null, '5.10.0.1')).toBeNull();
  });
});

describe('GeoIp', () => {
  let dir = '';
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('downloads the list of the month, keeps it, and loads it again without the network', async () => {
    dir = mkdtempSync(join(tmpdir(), 'kk-geo-'));
    const asked: string[] = [];
    const fetchFn = async (url: string) => {
      asked.push(url);
      return url.endsWith('2026-11.csv.gz') ? new Response(gzipSync(CSV)) : new Response('', { status: 404 });
    };
    const g = new GeoIp({ dir, fetch: fetchFn as typeof fetch, now: () => new Date('2026-11-03T10:00:00Z') });
    await g.refresh();
    expect(g.month).toBe('2026-11');
    expect(g.country('5.10.0.1')).toBe('DE');
    expect(readdirSync(dir)).toEqual(['dbip-country-lite-2026-11.csv.gz']);
    // up to date: no second download
    await g.refresh();
    expect(asked).toHaveLength(1);

    const offline = new GeoIp({ dir, fetch: (async () => { throw new Error('offline'); }) as typeof fetch });
    await offline.loadSaved();
    expect(offline.country('200.0.0.1')).toBe('BR');
  });

  it('falls back to last month early in a month and stays empty when nothing can be loaded', async () => {
    dir = mkdtempSync(join(tmpdir(), 'kk-geo-'));
    const fetchFn = async (url: string) => (url.endsWith('2026-10.csv.gz') ? new Response(gzipSync(CSV)) : new Response('', { status: 404 }));
    const g = new GeoIp({ dir, fetch: fetchFn as typeof fetch, now: () => new Date('2026-11-01T06:00:00Z') });
    await g.refresh();
    expect(g.month).toBe('2026-10');

    const none = new GeoIp({ dir: join(dir, 'empty'), fetch: (async () => new Response('', { status: 500 })) as typeof fetch });
    await none.refresh();
    expect(none.country('5.10.0.1')).toBeNull();
  });
});

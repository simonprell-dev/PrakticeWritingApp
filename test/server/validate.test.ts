import { describe, expect, it } from 'vitest';
import { makeToken, readCookie, safeEqual, SESSION_MS, verifyToken } from '../../server/session.js';
import {
  clientIp,
  countsAsVisit,
  MAX_MESSAGE,
  MIN_FILL_MS,
  parseDays,
  parseJson,
  RateLimiter,
  validateContact,
  validateMessageAction,
} from '../../server/validate.js';

describe('countsAsVisit', () => {
  const browser = { accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/140.0 Safari/537.36' };

  it('counts a browser opening the page', () => {
    expect(countsAsVisit('GET', browser, '')).toBe(true);
    expect(countsAsVisit('GET', browser, '?lab')).toBe(true);
  });

  it('does not count HEAD requests, non-pages, prefetches, crawlers and test runs', () => {
    expect(countsAsVisit('HEAD', browser, '')).toBe(false);
    expect(countsAsVisit('GET', { ...browser, accept: '*/*' }, '')).toBe(false);
    expect(countsAsVisit('GET', { ...browser, 'sec-purpose': 'prefetch' }, '')).toBe(false);
    expect(countsAsVisit('GET', { ...browser, 'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)' }, '')).toBe(false);
    expect(countsAsVisit('GET', { ...browser, 'user-agent': 'Mozilla/5.0 HeadlessChrome/140.0' }, '')).toBe(false);
    expect(countsAsVisit('GET', { ...browser, 'user-agent': 'curl/8.4.0' }, '')).toBe(false);
    expect(countsAsVisit('GET', browser, '?e2e')).toBe(false);
  });
});

describe('validateContact', () => {
  const base = { message: 'Tolles Spiel!', elapsedMs: MIN_FILL_MS + 500 };

  it('accepts a message with optional name and e-mail', () => {
    const v = validateContact({ ...base, name: ' Simon ', email: 'a@b.de', lang: 'de', website: '' });
    expect(v).toEqual({ ok: true, spam: false, value: { message: 'Tolles Spiel!', name: 'Simon', email: 'a@b.de', lang: 'de' } });
  });

  it('needs a message', () => {
    expect(validateContact({ ...base, message: '   ' }).ok).toBe(false);
    expect(validateContact({ elapsedMs: 5000 }).ok).toBe(false);
  });

  it('caps the lengths', () => {
    expect(validateContact({ ...base, message: 'x'.repeat(MAX_MESSAGE) }).ok).toBe(true);
    expect(validateContact({ ...base, message: 'x'.repeat(MAX_MESSAGE + 1) }).ok).toBe(false);
    expect(validateContact({ ...base, name: 'x'.repeat(101) }).ok).toBe(false);
  });

  it('checks the e-mail address only when given', () => {
    expect(validateContact({ ...base, email: 'keine-adresse' }).ok).toBe(false);
    expect(validateContact({ ...base, email: '' }).ok).toBe(true);
  });

  it('marks bots as spam: honeypot filled or sent too fast', () => {
    expect(validateContact({ ...base, website: 'http://spam' })).toEqual({ ok: true, spam: true });
    expect(validateContact({ ...base, elapsedMs: 200 })).toEqual({ ok: true, spam: true });
    expect(validateContact({ message: 'hi' })).toEqual({ ok: true, spam: true });
  });

  it('removes control characters and refuses unknown fields and types', () => {
    const v = validateContact({ ...base, message: 'a\u0000b\r\nc' });
    expect(v.value?.message).toBe('ab\nc');
    expect(validateContact({ ...base, extra: 1 }).ok).toBe(false);
    expect(validateContact({ ...base, message: 42 }).ok).toBe(false);
    expect(validateContact({ ...base, lang: 'xx' }).ok).toBe(false);
  });
});

describe('small helpers', () => {
  it('parseDays clamps to 1..400 with 30 as default', () => {
    expect(parseDays(null)).toBe(30);
    expect(parseDays('abc')).toBe(30);
    expect(parseDays('7')).toBe(7);
    expect(parseDays('0')).toBe(1);
    expect(parseDays('100000')).toBe(400);
  });

  it('validateMessageAction knows status changes and delete', () => {
    expect(validateMessageAction({ status: 'done' })).toEqual({ ok: true, value: { status: 'done' } });
    expect(validateMessageAction({ delete: true })).toEqual({ ok: true, value: { delete: true } });
    expect(validateMessageAction({ status: 'gone' }).ok).toBe(false);
    expect(validateMessageAction({ status: 'done', delete: true }).ok).toBe(false);
  });

  it('clientIp takes the first forwarded address', () => {
    expect(clientIp({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }, '10.0.0.1')).toBe('1.2.3.4');
    expect(clientIp({}, '::1')).toBe('::1');
  });

  it('parseJson returns undefined for broken JSON', () => {
    expect(parseJson(Buffer.from('{"a":1}'))).toEqual({ a: 1 });
    expect(parseJson(Buffer.from('{a'))).toBeUndefined();
  });
});

describe('RateLimiter', () => {
  it('lets `limit` requests through per window and key', () => {
    let t = 0;
    const rl = new RateLimiter(3, 1000, () => t);
    expect([rl.hit('a'), rl.hit('a'), rl.hit('a'), rl.hit('a')]).toEqual([true, true, true, false]);
    expect(rl.hit('b')).toBe(true);
    t = 1000;
    expect(rl.hit('a')).toBe(true);
  });

  it('prune forgets finished windows', () => {
    let t = 0;
    const rl = new RateLimiter(1, 1000, () => t);
    rl.hit('a');
    rl.hit('b');
    t = 1500;
    rl.hit('c');
    rl.prune();
    expect([...rl.hits.keys()]).toEqual(['c']);
  });
});

describe('admin session', () => {
  it('compares passwords', () => {
    expect(safeEqual('geheim', 'geheim')).toBe(true);
    expect(safeEqual('geheim', 'geheim!')).toBe(false);
    expect(safeEqual('', 'x')).toBe(false);
  });

  it('signs tokens that expire after 12 hours', () => {
    const tok = makeToken('s3cret', 1000);
    expect(verifyToken('s3cret', tok, 2000)).toBe(true);
    expect(verifyToken('s3cret', tok, 1000 + SESSION_MS + 1)).toBe(false);
    expect(verifyToken('other', tok, 2000)).toBe(false);
  });

  it('refuses tampered tokens', () => {
    const [payload, mac] = makeToken('s3cret', 1000).split('.');
    const forged = Buffer.from(JSON.stringify({ exp: 9e15 })).toString('base64url');
    expect(verifyToken('s3cret', `${forged}.${mac}`, 2000)).toBe(false);
    expect(verifyToken('s3cret', `${payload}.${mac}x`, 2000)).toBe(false);
    expect(verifyToken('s3cret', `${payload}`, 2000)).toBe(false);
    expect(verifyToken('s3cret', null, 2000)).toBe(false);
  });

  it('reads one cookie from the header', () => {
    expect(readCookie('a=1; kk_admin=tok.en; b=2', 'kk_admin')).toBe('tok.en');
    expect(readCookie(undefined, 'kk_admin')).toBeNull();
  });
});

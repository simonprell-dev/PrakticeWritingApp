// Pure validation and rate-limit helpers for the API (no I/O, tested in test/server/).

export const EVENT_TYPES = ['visit', 'game_start', 'game_end', 'scan'];
export const MODES = ['meer', 'weltraum', 'savanne', 'malen', 'duell', 'riesenburg', 'tuerme'];
export const SCRIPTS = ['druck', 'grund', 'schreib', 'hiragana', 'katakana', 'kyrillisch', 'arabisch', 'devanagari', 'griechisch', 'hebraeisch', 'hangul', 'thai'];
export const LANGS = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'tr', 'uk', 'ru', 'el', 'he', 'ar', 'hi', 'th', 'ko', 'ja'];

export const MAX_BODY = 2048;
/** the contact form carries up to 4000 characters, which may be several bytes each */
export const MAX_CONTACT_BODY = 24 * 1024;
export const MAX_MESSAGE = 4000;
export const MAX_NAME = 100;
export const MAX_EMAIL = 200;
export const MAX_CHARS = 5000;
export const MAX_DURATION = 24 * 3600;
/** a human needs at least this long to write a message (bots fill forms instantly) */
export const MIN_FILL_MS = 3000;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

/**
 * A usage event from the app. Returns { ok: true, value } with exactly the stored fields, or
 * { ok: false, error }. Unknown fields, unknown values and out-of-range numbers are refused.
 */
export function validateEvent(body) {
  if (!isObj(body)) return { ok: false, error: 'not an object' };
  const allowed = new Set(['type', 'mode', 'script', 'lang', 'chars', 'durationS']);
  for (const k of Object.keys(body)) if (!allowed.has(k)) return { ok: false, error: `unknown field ${k}` };
  const { type, mode, script, lang, chars, durationS } = body;
  if (!EVENT_TYPES.includes(type)) return { ok: false, error: 'type' };
  if (mode !== undefined && mode !== null && !MODES.includes(mode)) return { ok: false, error: 'mode' };
  if (type !== 'visit' && !mode) return { ok: false, error: 'mode missing' };
  if (script !== undefined && script !== null && !SCRIPTS.includes(script)) return { ok: false, error: 'script' };
  if (lang !== undefined && lang !== null && !LANGS.includes(lang)) return { ok: false, error: 'lang' };
  if (chars !== undefined && chars !== null && (!isInt(chars) || chars < 0 || chars > MAX_CHARS)) return { ok: false, error: 'chars' };
  if (durationS !== undefined && durationS !== null && (typeof durationS !== 'number' || !Number.isFinite(durationS) || durationS < 0)) {
    return { ok: false, error: 'durationS' };
  }
  return {
    ok: true,
    value: {
      type,
      mode: mode || null,
      script: script || null,
      lang: lang || null,
      chars: isInt(chars) ? chars : null,
      // a game left open overnight still counts, but at most one day
      durationS: typeof durationS === 'number' ? Math.min(MAX_DURATION, Math.round(durationS)) : null,
    },
  };
}

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

/** strips control characters except line breaks and tabs */
function clean(s) {
  return s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
}

/**
 * A message from the contact form. `spam: true` means a bot was caught (honeypot filled or sent too
 * fast): the caller answers as if it worked, but stores nothing.
 */
export function validateContact(body) {
  if (!isObj(body)) return { ok: false, error: 'not an object' };
  const allowed = new Set(['message', 'name', 'email', 'website', 'elapsedMs', 'lang']);
  for (const k of Object.keys(body)) if (!allowed.has(k)) return { ok: false, error: `unknown field ${k}` };
  const str = (v) => (v === undefined || v === null ? '' : typeof v === 'string' ? clean(v) : null);
  const message = str(body.message);
  const name = str(body.name);
  const email = str(body.email);
  const website = str(body.website);
  if (message === null || name === null || email === null || website === null) return { ok: false, error: 'type' };
  if (website) return { ok: true, spam: true };
  if (!isInt(body.elapsedMs) || body.elapsedMs < MIN_FILL_MS) return { ok: true, spam: true };
  if (!message) return { ok: false, error: 'message missing' };
  if (message.length > MAX_MESSAGE) return { ok: false, error: 'message too long' };
  if (name.length > MAX_NAME) return { ok: false, error: 'name too long' };
  if (email.length > MAX_EMAIL || (email && !EMAIL.test(email))) return { ok: false, error: 'email' };
  const lang = body.lang === undefined || body.lang === null ? null : LANGS.includes(body.lang) ? body.lang : undefined;
  if (lang === undefined) return { ok: false, error: 'lang' };
  return { ok: true, spam: false, value: { message, name: name || null, email: email || null, lang } };
}

/** `days` of the stats request: 1..400, default 30 */
export function parseDays(raw) {
  const n = Number(raw);
  if (raw === null || raw === undefined || raw === '' || !Number.isFinite(n)) return 30;
  return Math.min(400, Math.max(1, Math.round(n)));
}

export const MESSAGE_STATUS = ['new', 'read', 'done'];

/** an admin change of one message: { status } or { delete: true } */
export function validateMessageAction(body) {
  if (!isObj(body)) return { ok: false, error: 'not an object' };
  if (body.delete === true && Object.keys(body).length === 1) return { ok: true, value: { delete: true } };
  if (MESSAGE_STATUS.includes(body.status) && Object.keys(body).length === 1) return { ok: true, value: { status: body.status } };
  return { ok: false, error: 'action' };
}

/**
 * Fixed-window rate limit per key (an IP address), kept only in memory and only for the window.
 * `hit(key)` returns true when the request may go through.
 */
export class RateLimiter {
  /** @param {number} limit @param {number} windowMs @param {() => number} [now] */
  constructor(limit, windowMs, now = () => Date.now()) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.now = now;
    /** @type {Map<string, {start: number, count: number}>} */
    this.hits = new Map();
  }

  hit(key) {
    const t = this.now();
    const e = this.hits.get(key);
    if (!e || t - e.start >= this.windowMs) {
      this.hits.set(key, { start: t, count: 1 });
      if (this.hits.size > 50_000) this.prune();
      return true;
    }
    e.count++;
    return e.count <= this.limit;
  }

  /** forgets all windows that are over */
  prune() {
    const t = this.now();
    for (const [k, e] of this.hits) if (t - e.start >= this.windowMs) this.hits.delete(k);
  }
}

/** The client address for the rate limit: Railway's proxy puts it first in X-Forwarded-For. */
export function clientIp(headers, remote) {
  const fwd = headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd || '').split(',')[0].trim();
  return first || remote || 'unknown';
}

/** Parses a JSON request body (a Buffer). Returns undefined when it is not valid JSON. */
export function parseJson(buf) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return undefined;
  }
}

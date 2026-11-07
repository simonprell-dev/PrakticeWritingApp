// Pure validation and rate-limit helpers for the API (no I/O, tested in test/server/).

export const LANGS = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'tr', 'uk', 'ru', 'el', 'he', 'ar', 'hi', 'th', 'ko', 'ja'];

export const MAX_BODY = 2048;
/** the contact form carries up to 4000 characters, which may be several bytes each */
export const MAX_CONTACT_BODY = 24 * 1024;
export const MAX_MESSAGE = 4000;
export const MAX_NAME = 100;
export const MAX_EMAIL = 200;
/** a human needs at least this long to write a message (bots fill forms instantly) */
export const MIN_FILL_MS = 3000;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

const BOT = /bot|crawl|spider|slurp|preview|monitor|uptime|curl|wget|python|headless|lighthouse/i;

/**
 * Whether serving the app page counts as one page view: a browser opening the page (not a prefetch,
 * not a crawler or uptime check, not an end-to-end test run with ?e2e).
 */
export function countsAsVisit(method, headers, search) {
  if (method !== 'GET') return false;
  if (!String(headers.accept || '').includes('text/html')) return false;
  if (headers['sec-purpose'] || headers.purpose) return false;
  if (BOT.test(String(headers['user-agent'] || ''))) return false;
  return !new URLSearchParams(search).has('e2e');
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

/** the games the yearly plan knows; the same list as WORLD_IDS in src/app/worlds.ts (a test checks it) */
export const WORLD_IDS = [
  'meer', 'weltraum', 'savanne', 'zauberland', 'duell', 'riesenburg', 'tuerme', 'malen',
  'neujahr', 'winter', 'fruehling', 'ostern', 'strand', 'herbst', 'halloween', 'martin', 'weihnachten', 'advent',
];
/** the plan is small; this leaves room */
export const MAX_WORLDS_BODY = 8 * 1024;
const WORLD_MODES = ['plan', 'on', 'off'];
const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isMonthDay = (v) =>
  typeof v === 'string' && /^\d\d-\d\d$/.test(v) && +v.slice(0, 2) >= 1 && +v.slice(0, 2) <= 12 && +v.slice(3) >= 1 && +v.slice(3) <= MONTH_DAYS[+v.slice(0, 2) - 1];
const isEasterDay = (v) => isInt(v) && v >= 0 && v <= 60;

/** the yearly plan of the worlds from the admin area: every known world once, nothing else */
export function validateWorlds(body) {
  if (!isObj(body) || !isObj(body.worlds)) return { ok: false, error: 'worlds' };
  const keys = Object.keys(body.worlds);
  if (keys.length !== WORLD_IDS.length || !keys.every((k) => WORLD_IDS.includes(k))) return { ok: false, error: 'world ids' };
  const worlds = {};
  for (const id of WORLD_IDS) {
    const e = body.worlds[id];
    if (!isObj(e) || !WORLD_MODES.includes(e.mode)) return { ok: false, error: `${id}: mode` };
    if (id === 'ostern') {
      if (!isObj(e.easter) || !isEasterDay(e.easter.before) || !isEasterDay(e.easter.after)) return { ok: false, error: `${id}: easter` };
      worlds[id] = { mode: e.mode, easter: { before: e.easter.before, after: e.easter.after } };
    } else {
      if (!isMonthDay(e.from) || !isMonthDay(e.to)) return { ok: false, error: `${id}: days` };
      worlds[id] = { mode: e.mode, from: e.from, to: e.to };
    }
  }
  return { ok: true, value: { version: 1, worlds } };
}

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

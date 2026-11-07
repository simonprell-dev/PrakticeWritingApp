// The /api routes: the contact form and the admin area, plus the page view counter (called by server.js).
// No IP address is stored and no cookie is set except the admin's own session cookie.
import { Db } from './db.js';
import { GeoIp } from './geo.js';
import { clearCookie, COOKIE, makeToken, readCookie, safeEqual, sessionCookie, sessionSecret, verifyToken } from './session.js';
import {
  clientIp,
  MAX_BODY,
  MAX_CONTACT_BODY,
  MESSAGE_STATUS,
  parseDays,
  parseJson,
  RateLimiter,
  validateContact,
  validateMessageAction,
  validateWorlds,
  MAX_WORLDS_BODY,
} from './validate.js';

const DAY_MS = 24 * 3600 * 1000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, body, extra = {}) {
  const headers = { 'Cache-Control': 'no-store', ...extra };
  if (body === undefined) {
    res.writeHead(status, headers).end();
    return;
  }
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': data.length, ...headers }).end(data);
}

/** reads the request body up to `limit` bytes; more ends the request with 413 */
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (declared > limit) return reject(new HttpError(413, 'Zu groß'));
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        // stop reading; the answer closes the connection
        req.pause();
        reject(new HttpError(413, 'Zu groß'));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function jsonBody(req, limit) {
  // sendBeacon sends text/plain unless told otherwise; both are fine, anything else is not JSON
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json' && type !== 'text/plain') throw new HttpError(415, 'JSON erwartet');
  const body = parseJson(await readBody(req, limit));
  if (body === undefined) throw new HttpError(400, 'Kein gültiges JSON');
  return body;
}

/** POSTs from other sites are refused (the admin cookie is SameSite=Strict as well) */
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function createApi(env = process.env) {
  const db = env.DATABASE_URL ? new Db(env.DATABASE_URL, env.DATABASE_SSL === 'true') : null;
  const adminPassword = env.ADMIN_PASSWORD || '';
  const secret = sessionSecret(env);
  const limits = {
    contact: new RateLimiter(5, 15 * 60_000),
    login: new RateLimiter(8, 15 * 60_000),
    admin: new RateLimiter(300, 60_000),
  };
  const timers = [];
  // the country of a page view; GEOIP=off counts without countries
  const geo = db && env.GEOIP !== 'off' ? new GeoIp({ dir: env.GEOIP_DIR || '.geoip' }) : null;
  void geo?.start();

  if (db) {
    const start = async () => {
      try {
        await db.migrate();
        await db.cleanup();
        console.log('Datenbank verbunden.');
      } catch (e) {
        console.warn('Datenbank nicht erreichbar, neuer Versuch in 30 s:', e.message);
        timers.push(setTimeout(start, 30_000).unref());
      }
    };
    void start();
    timers.push(setInterval(() => db.ready && db.cleanup().catch((e) => console.warn('Aufräumen:', e.message)), DAY_MS).unref());
    timers.push(setInterval(() => Object.values(limits).forEach((l) => l.prune()), 10 * 60_000).unref());
  } else {
    console.warn('Hinweis: DATABASE_URL fehlt – Aufrufzähler, Kontaktformular und Admin sind aus (API antwortet 503).');
  }

  const needDb = () => {
    if (!db) throw new HttpError(503, 'Keine Datenbank eingerichtet');
    if (!db.ready) throw new HttpError(503, 'Datenbank noch nicht bereit');
    return db;
  };
  /**
   * The yearly plan of the worlds, read once from the database (null: none saved). A database that is set up but
   * not ready answers 503, so nobody takes the defaults for the saved plan. The read is kept as a promise, so a
   * plan saved while it runs is not overwritten by the older value.
   */
  let worlds = null;
  const loadWorlds = () => {
    if (!db) return Promise.resolve(null);
    if (!db.ready) throw new HttpError(503, 'Datenbank noch nicht bereit');
    worlds ??= db.getSetting('worlds').catch((e) => {
      worlds = null;
      throw e;
    });
    return worlds;
  };

  const isAdmin = (req) => verifyToken(secret, readCookie(req.headers.cookie, COOKIE));
  const secure = (req) => req.headers['x-forwarded-proto'] === 'https';

  /** @returns {Promise<void>} */
  async function route(req, res, url) {
    const path = url.pathname;
    const method = req.method;
    const ip = clientIp(req.headers, req.socket.remoteAddress);
    if (method === 'POST' && !sameOrigin(req)) throw new HttpError(403, 'Fremde Herkunft');

    if (path === '/api/contact' && method === 'POST') {
      if (!limits.contact.hit(ip)) throw new HttpError(429, 'Zu viele Nachrichten – bitte später noch einmal versuchen.');
      const d = needDb();
      const v = validateContact(await jsonBody(req, MAX_CONTACT_BODY));
      if (!v.ok) throw new HttpError(400, v.error);
      if (!v.spam) await d.addMessage(v.value);
      return send(res, 200, { ok: true });
    }

    // the plan for every visitor; without a database the app keeps its defaults
    if (path === '/api/worlds' && method === 'GET') return send(res, 200, { plan: await loadWorlds() });

    if (path.startsWith('/api/admin/')) {
      if (!adminPassword) throw new HttpError(503, 'Admin ist aus (ADMIN_PASSWORD fehlt)');

      if (path === '/api/admin/login' && method === 'POST') {
        if (!limits.login.hit(ip)) throw new HttpError(429, 'Zu viele Anmeldeversuche – bitte 15 Minuten warten.');
        const body = await jsonBody(req, MAX_BODY);
        const pw = body && typeof body.password === 'string' ? body.password : '';
        if (!pw || !safeEqual(pw, adminPassword)) throw new HttpError(401, 'Falsches Passwort');
        return send(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie(makeToken(secret), secure(req)) });
      }
      if (path === '/api/admin/logout' && method === 'POST') {
        return send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie(secure(req)) });
      }

      if (!limits.admin.hit(ip)) throw new HttpError(429, 'Zu viele Anfragen');
      if (!isAdmin(req)) throw new HttpError(401, 'Bitte anmelden');

      if (path === '/api/admin/me' && method === 'GET') return send(res, 200, { ok: true, db: !!db?.ready });
      if (path === '/api/admin/stats' && method === 'GET') {
        // geo: the month of the loaded country list, null while there is none
        return send(res, 200, { ...(await needDb().stats(parseDays(url.searchParams.get('days')))), geo: geo?.month ?? null });
      }
      if (path === '/api/admin/messages' && method === 'GET') {
        const page = Math.max(1, Math.min(10_000, Math.round(Number(url.searchParams.get('page')) || 1)));
        const st = url.searchParams.get('status');
        const status = MESSAGE_STATUS.includes(st) ? st : null;
        return send(res, 200, await needDb().messages(page, 20, status));
      }
      if (path === '/api/admin/worlds' && method === 'GET') {
        needDb();
        return send(res, 200, { plan: await loadWorlds() });
      }
      if (path === '/api/admin/worlds' && method === 'POST') {
        const d = needDb();
        const v = validateWorlds(await jsonBody(req, MAX_WORLDS_BODY));
        if (!v.ok) throw new HttpError(400, `Ungültiger Plan (${v.error})`);
        await d.setSetting('worlds', v.value);
        worlds = Promise.resolve(v.value);
        return send(res, 200, { ok: true });
      }
      const m = /^\/api\/admin\/messages\/(\d{1,18})$/.exec(path);
      if (m && method === 'POST') {
        const v = validateMessageAction(await jsonBody(req, MAX_BODY));
        if (!v.ok) throw new HttpError(400, v.error);
        if (!(await needDb().changeMessage(m[1], v.value))) throw new HttpError(404, 'Nachricht nicht gefunden');
        return send(res, 200, { ok: true });
      }
    }
    throw new HttpError(404, 'Unbekannte Adresse');
  }

  return {
    /** one page view today, with its country; without a database it is not counted, a failure only gets logged */
    countVisit(req) {
      if (!db?.ready) return;
      const country = geo?.country(clientIp(req.headers, req.socket.remoteAddress)) ?? null;
      db.addVisit(country).catch((e) => console.warn('Aufrufzähler:', e.message));
    },
    /** answers a request below /api/ */
    async handle(req, res, url) {
      try {
        await route(req, res, url);
      } catch (e) {
        if (res.headersSent) return;
        if (e instanceof HttpError) {
          const extra = e.status === 503 ? { 'Retry-After': '60' } : e.status === 413 ? { Connection: 'close' } : {};
          send(res, e.status, { error: e.message }, extra);
        } else {
          console.warn('API-Fehler:', e?.message || e);
          send(res, 500, { error: 'Serverfehler' });
        }
      }
    },
    async close() {
      timers.forEach((t) => clearTimeout(t));
      geo?.stop();
      await db?.close().catch(() => undefined);
    },
  };
}

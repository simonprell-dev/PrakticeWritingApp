// Spam protection of the feedback light (pure helpers, tested in test/server/). When a game starts the app gets
// a signed ticket for it (POST /api/rating/ticket); a vote only counts with a ticket of its game, at least a
// minute after the start and at most 12 hours, and every ticket once. A script so has to wait a minute for each
// vote, on top of the limits per address in server/api.js. Nothing of this goes into the database.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** a game shorter than this gets no question in the app (src/ui/feedbackLight.ts MIN_PLAY_MS) */
export const RATING_MIN_MS = 60_000;
export const RATING_MAX_MS = 12 * 3600 * 1000;

const sign = (key, payload) => createHmac('sha256', key).update(`rating:${payload}`).digest('base64url');

/** a ticket for `game`, started at `now` */
export function makeRatingTicket(key, game, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ g: game, t: now, n: randomBytes(9).toString('base64url') })).toString('base64url');
  return `${payload}.${sign(key, payload)}`;
}

/** { ok: true, nonce, until } when the ticket may carry a vote for `game` now, else { ok: false, error } */
export function checkRatingTicket(key, ticket, game, now = Date.now()) {
  if (typeof ticket !== 'string' || ticket.length > 400) return { ok: false, error: 'ticket' };
  const [payload, mac, extra] = ticket.split('.');
  if (!payload || !mac || extra !== undefined) return { ok: false, error: 'ticket' };
  const want = Buffer.from(sign(key, payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { ok: false, error: 'ticket' };
  let body;
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, error: 'ticket' };
  }
  if (!body || body.g !== game || typeof body.t !== 'number' || typeof body.n !== 'string') return { ok: false, error: 'ticket' };
  if (now < body.t + RATING_MIN_MS) return { ok: false, error: 'early' };
  if (now > body.t + RATING_MAX_MS) return { ok: false, error: 'late' };
  return { ok: true, nonce: body.n, until: body.t + RATING_MAX_MS };
}

/** the tickets that carried a vote, kept until they would be too old anyway */
export class TicketBook {
  /** @param {() => number} [now] */
  constructor(now = () => Date.now()) {
    this.now = now;
    this.used = new Map();
  }

  /** false when the ticket was used before */
  use(nonce, until) {
    if (this.used.has(nonce)) return false;
    this.used.set(nonce, until);
    return true;
  }

  prune() {
    const t = this.now();
    for (const [n, until] of this.used) if (until < t) this.used.delete(n);
  }

  get size() {
    return this.used.size;
  }
}

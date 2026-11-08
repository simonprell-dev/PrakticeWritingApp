import { describe, expect, it } from 'vitest';
import { checkRatingTicket, makeRatingTicket, RATING_MAX_MS, RATING_MIN_MS, TicketBook } from '../../server/ratingGuard.js';

const KEY = 'k3y';

describe('the ticket of a game for the feedback light', () => {
  it('counts after a minute of play, for its own game', () => {
    const tk = makeRatingTicket(KEY, 'meer', 1000);
    expect(checkRatingTicket(KEY, tk, 'meer', 1000 + RATING_MIN_MS)).toMatchObject({ ok: true });
  });

  it('a vote sooner than a minute after the start does not count', () => {
    const tk = makeRatingTicket(KEY, 'meer', 1000);
    expect(checkRatingTicket(KEY, tk, 'meer', 1000 + RATING_MIN_MS - 1)).toEqual({ ok: false, error: 'early' });
  });

  it('an old ticket does not count', () => {
    const tk = makeRatingTicket(KEY, 'meer', 1000);
    expect(checkRatingTicket(KEY, tk, 'meer', 1000 + RATING_MAX_MS + 1)).toEqual({ ok: false, error: 'late' });
  });

  it('a ticket of another game, of another key or changed does not count', () => {
    const tk = makeRatingTicket(KEY, 'meer', 1000);
    const later = 1000 + RATING_MIN_MS;
    expect(checkRatingTicket(KEY, tk, 'duell', later).ok).toBe(false);
    expect(checkRatingTicket('other', tk, 'meer', later).ok).toBe(false);
    const [, mac] = tk.split('.');
    const forged = Buffer.from(JSON.stringify({ g: 'meer', t: 0, n: 'x' })).toString('base64url');
    expect(checkRatingTicket(KEY, `${forged}.${mac}`, 'meer', later).ok).toBe(false);
    expect(checkRatingTicket(KEY, 'quatsch', 'meer', later).ok).toBe(false);
    expect(checkRatingTicket(KEY, undefined, 'meer', later).ok).toBe(false);
  });

  it('every ticket has its own number', () => {
    const a = checkRatingTicket(KEY, makeRatingTicket(KEY, 'meer', 1000), 'meer', 1000 + RATING_MIN_MS);
    const b = checkRatingTicket(KEY, makeRatingTicket(KEY, 'meer', 1000), 'meer', 1000 + RATING_MIN_MS);
    expect(a.ok && b.ok && a.nonce !== b.nonce).toBe(true);
  });
});

describe('a ticket is used once', () => {
  it('the second vote with the same ticket is refused', () => {
    let now = 0;
    const book = new TicketBook(() => now);
    expect(book.use('n1', 5000)).toBe(true);
    expect(book.use('n1', 5000)).toBe(false);
    expect(book.use('n2', 5000)).toBe(true);
  });

  it('used tickets are forgotten once they are too old anyway', () => {
    let now = 0;
    const book = new TicketBook(() => now);
    book.use('n1', 5000);
    now = 6000;
    book.prune();
    expect(book.size).toBe(0);
  });
});

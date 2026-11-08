// The feedback light after a game: green, yellow or red, one tap. The vote goes to the server (POST /api/rating,
// nothing about who voted) with the ticket the game got when it started (spam protection, server/ratingGuard.js);
// red opens the contact form right away, so the reason can follow.
import { button, h, modal } from './dom.ts';
import { openContact } from './contact.ts';
import { toast } from './toast.ts';
import { language, t } from '../i18n/i18n.ts';

/** a game left sooner than this was only looked into: no question */
export const MIN_PLAY_MS = 60_000;

export type Rating = 'gruen' | 'gelb' | 'rot';

/** whether the light comes when a game is left */
export function shouldAsk(on: boolean, playedMs: number, asked: boolean): boolean {
  return on && !asked && playedMs >= MIN_PLAY_MS;
}

const post = (path: string, body: unknown) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'omit', body: JSON.stringify(body) });

/** the ticket of a game that starts; null without a server (then no vote is sent) */
export function requestTicket(game: string): Promise<string | null> {
  return post('/api/rating/ticket', { game })
    .then((r) => (r.ok ? (r.json() as Promise<{ ticket?: unknown }>) : null))
    .then((j) => (typeof j?.ticket === 'string' ? j.ticket : null))
    .catch(() => null);
}

function send(game: string, rating: Rating, ticket: Promise<string | null>): void {
  void ticket.then((tk) => (tk ? post('/api/rating', { game, rating, lang: language(), ticket: tk }) : null)).catch(() => undefined);
}

/**
 * Asks how the game was. `game` is its id (as the server knows it), `title` its shown name, `ticket` from
 * requestTicket() at its start. `done` runs when the
 * window is closed – after a vote or when it is skipped; on red the contact form opens after it.
 */
export function openFeedbackLight(game: string, title: string, ticket: Promise<string | null>, done: (rating: Rating | null) => void): void {
  let closed = false;
  const finish = (rating: Rating | null) => {
    if (closed) return;
    closed = true;
    m.close();
    if (rating) send(game, rating, ticket);
    done(rating);
    if (rating === 'rot')
      openContact({
        kind: 'feedback',
        game,
        gameTitle: title,
        intro: t('Schade! Was hat nicht gepasst? Schreib es uns – dann machen wir es besser.'),
      });
    else if (rating) toast(t('Danke für deine Stimme! 💚'), 'good');
  };
  const light = (rating: Rating, icon: string, label: string) =>
    h(
      'button',
      { type: 'button', class: `light ${rating}`, onclick: () => finish(rating), 'aria-label': label },
      h('span', { class: 'bulb' }, icon),
      h('span', { class: 'light-label' }, label),
    );
  const content = h(
    'div',
    { class: 'feedback-light' },
    h('h2', null, t('Wie war das Spiel?')),
    h('p', { class: 'help' }, title),
    h('div', { class: 'lights' }, light('gruen', '😀', t('Super!')), light('gelb', '😐', t('Geht so')), light('rot', '🙁', t('Nicht gut'))),
    h('div', { class: 'actions' }, button(t('Überspringen'), () => finish(null), 'btn small')),
  );
  const m = modal(content, () => finish(null));
}

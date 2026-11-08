// Admin section "Feedback-Ampel": the votes after a game (green / yellow / red) per game over a time range, the
// latest votes, and deleting them: one, those of a game, or all. Talks to /api/admin/ratings (server/api.js).
import { clear, h } from '../ui/dom.ts';
import { gameName } from './worldsPanel.ts';

type Rating = 'gruen' | 'gelb' | 'rot';
interface GameRow {
  game: string;
  gruen: number;
  gelb: number;
  rot: number;
}
interface Vote {
  id: string;
  created_at: string;
  game: string;
  rating: Rating;
  lang: string | null;
}
export interface Ratings {
  days: number;
  perGame: GameRow[];
  latest: Vote[];
  allTime: number;
}

export interface RatingsDeps {
  api<T>(path: string, body?: unknown): Promise<T>;
  fail(e: unknown): void;
}

const LIGHT: Record<Rating, string> = { gruen: '🟢', gelb: '🟡', rot: '🔴' };
const LABEL: Record<Rating, string> = { gruen: 'Grün', gelb: 'Gelb', rot: 'Rot' };
const fmt = new Intl.NumberFormat('de-DE');
const pct = (n: number, all: number) => (all ? `${Math.round((100 * n) / all)} %` : '–');

/** a bar split into green, yellow and red, with the counts as text beside it (not by colour alone) */
function bar(r: GameRow): HTMLElement {
  const all = r.gruen + r.gelb + r.rot;
  const part = (k: Rating) => (r[k] ? h('span', { class: `rb ${k}`, style: `flex:${r[k]}`, title: `${LABEL[k]}: ${r[k]} (${pct(r[k], all)})` }) : null);
  return h('div', { class: 'rating-bar', role: 'img', 'aria-label': `Grün ${r.gruen}, Gelb ${r.gelb}, Rot ${r.rot}` }, part('gruen'), part('gelb'), part('rot'));
}

export function ratingsPanel(d: RatingsDeps): HTMLElement {
  let days = 30;
  const box = h('div', { class: 'panel ratings' });
  const del = async (what: unknown, question: string) => {
    if (!confirm(question)) return;
    await d.api('/api/admin/ratings/delete', what).catch(d.fail);
    load();
  };
  const range = h('select', null, ...[7, 30, 90, 365].map((n) => h('option', { value: String(n), selected: n === days }, `${n} Tage`))) as HTMLSelectElement;
  range.addEventListener('change', () => {
    days = Number(range.value);
    load();
  });

  function render(r: Ratings): void {
    clear(box);
    const sum = r.perGame.reduce((a, g) => ({ game: 'alle', gruen: a.gruen + g.gruen, gelb: a.gelb + g.gelb, rot: a.rot + g.rot }), { game: 'alle', gruen: 0, gelb: 0, rot: 0 });
    const total = sum.gruen + sum.gelb + sum.rot;
    box.append(
      h('div', { class: 'ratings-head' }, h('h2', null, 'Feedback-Ampel'), range, h('button', { type: 'button', onclick: load }, '↻')),
      h('p', { class: 'muted' }, `Nach einem Spiel (ab 1 Minute) fragt die App „Wie war das Spiel?“. Gespeichert werden nur Spiel, Farbe, Sprache und Zeitpunkt; nach 12 Monaten werden die Stimmen gelöscht. Bei Rot öffnet sich das Kontaktfeld – die Nachricht steht dann unten mit „💬 Feedback“ und dem Spiel. Schutz vor Spam: Eine Stimme zählt nur mit dem Ticket, das die App beim Spielstart bekommt (frühestens nach 1 Minute, jedes Ticket einmal), höchstens eine pro Spiel und Anschluss alle 3 Minuten und 20 pro Stunde. Insgesamt gespeichert: ${fmt.format(r.allTime)}.`),
    );
    if (!total) {
      box.append(h('p', { class: 'muted' }, `Keine Stimmen in den letzten ${r.days} Tagen.`));
    } else {
      const row = (g: GameRow, isSum = false) => {
        const all = g.gruen + g.gelb + g.rot;
        return h(
          'tr',
          isSum ? { class: 'sum' } : null,
          h('td', null, isSum ? 'Alle Spiele' : gameName(g.game)),
          ...(['gruen', 'gelb', 'rot'] as Rating[]).map((k) => h('td', { class: 'num' }, `${fmt.format(g[k])}`, h('span', { class: 'muted' }, ` · ${pct(g[k], all)}`))),
          h('td', { class: 'num' }, fmt.format(all)),
          h('td', { class: 'bar-cell' }, bar(g)),
          h(
            'td',
            null,
            isSum
              ? null
              : h('button', { type: 'button', class: 'small', title: 'Alle Stimmen zu diesem Spiel löschen', onclick: () => void del({ game: g.game }, `Alle Stimmen zu „${gameName(g.game)}“ löschen (auch ältere als ${r.days} Tage)?`) }, '🗑'),
          ),
        );
      };
      box.append(
        h(
          'table',
          { class: 'ratings-table' },
          h('thead', null, h('tr', null, h('th', null, 'Spiel'), h('th', { class: 'num' }, '🟢 Grün'), h('th', { class: 'num' }, '🟡 Gelb'), h('th', { class: 'num' }, '🔴 Rot'), h('th', { class: 'num' }, 'Stimmen'), h('th'), h('th'))),
          h('tbody', null, ...r.perGame.map((g) => row(g)), row(sum, true)),
        ),
        h('h3', null, 'Letzte Stimmen'),
        h(
          'ul',
          { class: 'votes' },
          ...r.latest.map((v) =>
            h(
              'li',
              null,
              h('span', { title: LABEL[v.rating] }, LIGHT[v.rating]),
              h('span', null, gameName(v.game)),
              h('span', { class: 'muted' }, new Date(v.created_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })),
              v.lang ? h('span', { class: 'muted' }, v.lang) : null,
              h('button', { type: 'button', class: 'small', title: 'Diese Stimme löschen', onclick: () => void del({ id: v.id }, 'Diese Stimme löschen?') }, '🗑'),
            ),
          ),
        ),
      );
    }
    if (r.allTime)
      box.append(
        h('div', { class: 'world-actions' }, h('button', { type: 'button', onclick: () => void del({ all: true }, `Wirklich alle ${fmt.format(r.allTime)} Stimmen löschen? Das lässt sich nicht rückgängig machen.`) }, '🗑 Alle Stimmen löschen')),
      );
  }

  function load(): void {
    d.api<Ratings>(`/api/admin/ratings?days=${days}`).then(render).catch(d.fail);
  }

  box.append(h('h2', null, 'Feedback-Ampel'), h('p', { class: 'muted' }, 'Lade …'));
  load();
  return box;
}

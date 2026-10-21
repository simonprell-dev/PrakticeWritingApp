import type { AnyCanvas } from '../game/canvas.ts';
import type { DuelResult, DuelTeamResult } from '../scenes/duelScene.ts';
import type { SiegeResult } from '../scenes/siegeScene.ts';
import { button, h, modal } from './dom.ts';

function stickerCanvas(st: AnyCanvas): HTMLCanvasElement {
  const c = h('canvas', { width: 120, height: 120 });
  const ctx = c.getContext('2d')!;
  const s = 100 / Math.max(st.width, st.height);
  ctx.drawImage(st as CanvasImageSource, 60 - (st.width * s) / 2, 60 - (st.height * s) / 2, st.width * s, st.height * s);
  return c;
}

export function confetti(colors: string[], n = 90): void {
  for (let i = 0; i < n; i++) {
    const c = h('div', {
      class: 'confetti',
      style: `left:${Math.random() * 100}vw;background:${colors[i % colors.length]};animation-duration:${2.5 + Math.random() * 2.5}s;animation-delay:${Math.random() * 0.8}s;border-radius:${Math.random() < 0.3 ? '50%' : '3px'}`,
    });
    document.body.append(c);
    setTimeout(() => c.remove(), 6000);
  }
}

function teamCol(t: DuelTeamResult, winner: boolean): HTMLElement {
  return h(
    'div',
    { class: 'team-col', style: `border-color:${t.color};${winner ? 'background:#fffbe6' : ''}` },
    h('h3', { style: `color:${t.color}` }, (winner ? '🏆 ' : '') + t.name),
    h('div', { style: 'font-size:1.2rem' }, `✎ ${t.stats.written} Zeichen geschrieben · ${t.stats.castleDamage} ${t.stats.castleDamage === 1 ? 'Blase' : 'Blasen'} zerplatzt`),
    h('div', { class: 'stars', style: 'font-size:1.8rem' }, '★'.repeat(t.avgStars), h('span', { class: 'off' }, '★'.repeat(5 - t.avgStars))),
    t.best
      ? h('div', { class: 'trophy' }, h('b', null, '👑 Schönstes Zeichen'), stickerCanvas(t.best.sticker), h('span', { class: 'help' }, `${t.best.score} Punkte`))
      : null,
    t.bravest && t.bravest.hits > 0
      ? h('div', { class: 'trophy' }, h('b', null, '💪 Tapferste Figur'), stickerCanvas(t.bravest.sticker), h('span', { class: 'help' }, `${t.bravest.hits} Treffer`))
      : null,
  );
}

export function openVictory(r: DuelResult, again: () => void, menu: () => void): void {
  const [a, b] = r.teams;
  const winnerTeam = r.winner === 'A' ? a : r.winner === 'B' ? b : null;
  confetti(winnerTeam ? [winnerTeam.color, '#ffcf3d', '#ffffff'] : [a.color, b.color, '#ffcf3d']);
  const content = h(
    'div',
    { class: 'victory', style: 'min-width:min(820px,92vw)' },
    h(
      'div',
      { class: 'banner', style: winnerTeam ? `color:${winnerTeam.color}` : '' },
      winnerTeam ? `${winnerTeam.name} gewinnt!` : 'Unentschieden – alle haben gewonnen!',
    ),
    h('p', { class: 'help', style: 'font-size:1.1rem;margin-top:-.4em' }, 'Ihr habt toll geschrieben! Hier sind eure schönsten Zeichen:'),
    h('div', { class: 'teams' }, teamCol(a, r.winner === 'A'), teamCol(b, r.winner === 'B')),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button('Menü', () => {
        m.close();
        menu();
      }, 'btn'),
      button('Nochmal!', () => {
        m.close();
        again();
      }, 'btn primary'),
    ),
  );
  const m = modal(content);
}

export function openSiegeResult(r: SiegeResult, again: () => void, menu: () => void): void {
  confetti(r.won ? [r.color, '#ffcf3d', '#ffffff', '#8f6ee0'] : [r.color, '#ffcf3d']);
  const castles = h('div', { style: 'font-size:2.6rem;letter-spacing:.15em;margin:.2em 0' });
  for (let i = 0; i < r.wallsTotal; i++) castles.append(h('span', { style: i < r.walls ? '' : 'filter:grayscale(1);opacity:.35' }, '🏰'));
  const minutes = Math.floor(r.seconds / 60);
  const content = h(
    'div',
    { class: 'victory', style: 'min-width:min(760px,92vw)' },
    h('div', { class: 'banner', style: `color:${r.color}` }, r.won ? 'Die Riesenburg ist erobert!' : 'Gut gekämpft!'),
    h('p', { style: 'font-size:1.3rem;margin:.2em 0' }, r.won ? `${r.className} hat Riese Rumpel besiegt!` : `${r.className} hat ${r.walls} von ${r.wallsTotal} Mauern geschafft.`),
    castles,
    h(
      'div',
      { class: 'team-col', style: `border-color:${r.color};max-width:620px;margin:0 auto` },
      h('div', { style: 'font-size:1.25rem' }, `✎ ${r.stats.written} Zeichen geschrieben · ⭐ ${r.stars} Sterne · ${r.stats.castleDamage} Blasen zerplatzt`),
      h('div', { class: 'help' }, `Spielzeit: ${minutes ? minutes + ' Min ' : ''}${Math.floor(r.seconds % 60)} s`),
      h(
        'div',
        { style: 'display:flex;gap:30px;justify-content:center;flex-wrap:wrap' },
        r.best ? h('div', { class: 'trophy' }, h('b', null, '👑 Schönstes Zeichen'), stickerCanvas(r.best.sticker), h('span', { class: 'help' }, `${r.best.score} Punkte`)) : null,
        r.bravest && r.bravest.hits > 0
          ? h('div', { class: 'trophy' }, h('b', null, '💪 Tapferste Figur'), stickerCanvas(r.bravest.sticker), h('span', { class: 'help' }, `${r.bravest.hits} Treffer`))
          : null,
      ),
    ),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button('Menü', () => {
        m.close();
        menu();
      }, 'btn'),
      button('Nochmal!', () => {
        m.close();
        again();
      }, 'btn primary'),
    ),
  );
  const m = modal(content);
}

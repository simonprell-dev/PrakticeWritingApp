import type { AnyCanvas } from '../game/canvas.ts';
import type { DuelResult, DuelTeamResult } from '../scenes/duelScene.ts';
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
    h('div', { style: 'font-size:1.2rem' }, `✎ ${t.stats.written} Zeichen geschrieben`),
    h('div', { class: 'stars', style: 'font-size:1.8rem' }, '★'.repeat(t.avgStars), h('span', { class: 'off' }, '★'.repeat(5 - t.avgStars))),
    t.best
      ? h('div', { class: 'trophy' }, h('b', null, '👑 Schönstes Zeichen'), stickerCanvas(t.best.sticker), h('span', { class: 'help' }, `${t.best.score} Punkte`))
      : null,
    t.bravest && t.bravest.kills > 0
      ? h('div', { class: 'trophy' }, h('b', null, '💪 Tapferste Figur'), stickerCanvas(t.bravest.sticker), h('span', { class: 'help' }, `${t.bravest.kills}× gewonnen`))
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

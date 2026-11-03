import type { AnyCanvas } from '../game/canvas.ts';
import type { DuelResult, DuelTeamResult } from '../scenes/duelScene.ts';
import type { SiegeResult } from '../scenes/siegeScene.ts';
import type { TowerResult } from '../scenes/towerScene.ts';
import { donateBlock } from './donate.ts';
import { button, h, modal } from './dom.ts';
import { t } from '../i18n/i18n.ts';

/** "Spielzeit: 3 Min 12 s" (with a full stop when it ends a sentence) */
function playTime(seconds: number, dot = false): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (dot) return m ? t('Spielzeit: {m} Min {s} s.', { m, s }) : t('Spielzeit: {s} s.', { s });
  return m ? t('Spielzeit: {m} Min {s} s', { m, s }) : t('Spielzeit: {s} s', { s });
}

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

function teamCol(tm: DuelTeamResult, winner: boolean): HTMLElement {
  const written = tm.stats.written;
  const popped = tm.stats.castleDamage;
  return h(
    'div',
    { class: 'team-col', style: `border-color:${tm.color};${winner ? 'background:#fffbe6' : ''}` },
    h('h3', { style: `color:${tm.color}` }, (winner ? '🏆 ' : '') + tm.name),
    h(
      'div',
      { style: 'font-size:1.2rem' },
      popped === 1
        ? t('✎ {written} Zeichen geschrieben · {popped} Blase zerplatzt', { written, popped })
        : t('✎ {written} Zeichen geschrieben · {popped} Blasen zerplatzt', { written, popped }),
    ),
    h('div', { class: 'stars', style: 'font-size:1.8rem' }, '★'.repeat(tm.avgStars), h('span', { class: 'off' }, '★'.repeat(5 - tm.avgStars))),
    tm.best
      ? h('div', { class: 'trophy' }, h('b', null, t('👑 Schönstes Zeichen')), stickerCanvas(tm.best.sticker), h('span', { class: 'help' }, t('{n} Punkte', { n: tm.best.score })))
      : null,
    tm.bravest && tm.bravest.hits > 0
      ? h('div', { class: 'trophy' }, h('b', null, t('💪 Tapferste Figur')), stickerCanvas(tm.bravest.sticker), h('span', { class: 'help' }, t('{n} Treffer', { n: tm.bravest.hits })))
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
      winnerTeam ? t('{team} gewinnt!', { team: winnerTeam.name }) : t('Unentschieden – alle haben gewonnen!'),
    ),
    h('p', { class: 'help', style: 'font-size:1.1rem;margin-top:-.4em' }, t('Ihr habt toll geschrieben! Hier sind eure schönsten Zeichen:')),
    h('div', { class: 'teams' }, teamCol(a, r.winner === 'A'), teamCol(b, r.winner === 'B')),
    donateBlock(),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button(t('Menü'), () => {
        m.close();
        menu();
      }, 'btn'),
      button(t('Nochmal!'), () => {
        m.close();
        again();
      }, 'btn primary'),
    ),
  );
  const m = modal(content);
}

export function openTowerResult(r: TowerResult, again: () => void, menu: () => void): void {
  const winner = r.winner === null ? null : r.players[r.winner];
  confetti(winner ? [winner.color, '#ffcf3d', '#ffffff'] : [...r.players.map((p) => p.color), '#ffcf3d']);
  const ranking = r.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.metres - a.p.metres);
  const medals = ['🥇', '🥈', '🥉', '🏅'];
  const rows = h('div', { class: 'tower-ranking' });
  ranking.forEach(({ p, i }) => {
    // equal heights share the medal of the better place
    const place = ranking.findIndex((o) => o.p.metres === p.metres);
    rows.append(
      h(
        'div',
        { class: 'tower-row', style: `border-color:${p.color};${i === r.winner ? 'background:#fffbe6' : ''}` },
        h('div', { class: 'medal' }, medals[Math.min(place, medals.length - 1)]),
        h(
          'div',
          { class: 'tower-info' },
          h('h3', { style: `color:${p.color}` }, (i === r.winner ? '🏆 ' : '') + p.name),
          h('div', { class: 'tower-bar' }, h('span', { style: `width:${Math.min(100, (p.metres / r.goal) * 100)}%;background:${p.color}` })),
          h('div', { class: 'help' }, t('{metres} m von {goal} m · ✎ {written} Zeichen · {blocks} Bausteine', { metres: p.metres, goal: r.goal, written: p.written, blocks: p.blocks })),
          p.blocks ? h('div', { class: 'stars' }, '★'.repeat(p.avgStars), h('span', { class: 'off' }, '★'.repeat(5 - p.avgStars))) : null,
        ),
        p.best ? h('div', { class: 'trophy' }, h('b', null, t('👑 Schönstes')), stickerCanvas(p.best.sticker), h('span', { class: 'help' }, t('{n} Punkte', { n: p.best.score }))) : null,
      ),
    );
  });
  const content = h(
    'div',
    { class: 'victory', style: 'min-width:min(860px,92vw)' },
    h('div', { class: 'banner', style: winner ? `color:${winner.color}` : '' }, winner ? t('Sieg für {team}!', { team: winner.name }) : t('Unentschieden!')),
    h(
      'p',
      { style: 'font-size:1.2rem;margin:.1em 0 .6em' },
      r.clones
        ? t('Die Aliens haben sich {clones}× geklont und {gags} lustige Pannen erlebt.', { clones: r.clones, gags: r.gags })
        : t('Zork hat alles allein geschafft – mit {gags} lustigen Pannen.', { gags: r.gags }),
      ` ${playTime(r.seconds, true)}`,
    ),
    rows,
    donateBlock(),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button(t('Menü'), () => {
        m.close();
        menu();
      }, 'btn'),
      button(t('Nochmal!'), () => {
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
  const content = h(
    'div',
    { class: 'victory', style: 'min-width:min(760px,92vw)' },
    h('div', { class: 'banner', style: `color:${r.color}` }, r.won ? t('Die Riesenburg ist erobert!') : t('Gut gekämpft!')),
    h('p', { style: 'font-size:1.3rem;margin:.2em 0' }, r.won
        ? t('{name} hat Riese Rumpel besiegt!', { name: r.className })
        : t('{name} hat {walls} von {total} Mauern geschafft.', { name: r.className, walls: r.walls, total: r.wallsTotal })),
    castles,
    h(
      'div',
      { class: 'team-col', style: `border-color:${r.color};max-width:620px;margin:0 auto` },
      h('div', { style: 'font-size:1.25rem' }, t('✎ {written} Zeichen geschrieben · ⭐ {stars} Sterne · {popped} Blasen zerplatzt', { written: r.stats.written, stars: r.stars, popped: r.stats.castleDamage })),
      h('div', { class: 'help' }, playTime(r.seconds)),
      h(
        'div',
        { style: 'display:flex;gap:30px;justify-content:center;flex-wrap:wrap' },
        r.best ? h('div', { class: 'trophy' }, h('b', null, t('👑 Schönstes Zeichen')), stickerCanvas(r.best.sticker), h('span', { class: 'help' }, t('{n} Punkte', { n: r.best.score }))) : null,
        r.bravest && r.bravest.hits > 0
          ? h('div', { class: 'trophy' }, h('b', null, t('💪 Tapferste Figur')), stickerCanvas(r.bravest.sticker), h('span', { class: 'help' }, t('{n} Treffer', { n: r.bravest.hits })))
          : null,
      ),
    ),
    donateBlock(),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button(t('Menü'), () => {
        m.close();
        menu();
      }, 'btn'),
      button(t('Nochmal!'), () => {
        m.close();
        again();
      }, 'btn primary'),
    ),
  );
  const m = modal(content);
}

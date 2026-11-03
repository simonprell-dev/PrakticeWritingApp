// Setup for "Türme bauen": 2–8 towers, colours (pen or slip), height of the finish line, time limit.
import type { Settings } from '../app/settings.ts';
import { TOWER } from '../game/tower/rules.ts';
import { t } from '../i18n/i18n.ts';
import { colorCard, type ColorDeps } from './duelLobby.ts';
import { button, clear, h, modal, segmented } from './dom.ts';

export interface TowerLobbyDeps extends ColorDeps {
  settings: Settings;
  start: () => void;
  openCamera: () => void;
}

export function openTowerLobby(d: TowerLobbyDeps): void {
  const s = d.settings.tower;
  const teamsBox = h('div', { class: 'teams' });
  const many = () => teamsBox.classList.toggle('many', s.count > 2);
  const warn = h('p', { class: 'help warn-line' });

  const render = () => {
    clear(teamsBox);
    many();
    const players = s.players.slice(0, s.count);
    players.forEach((p, i) => teamsBox.append(colorCard(p, s.by, t('Turm {n}', { n: i + 1 }), t('Turm {n}', { n: i + 1 }), d, render, players, i + 1)));
    const keys = players.map((p) => (s.by === 'pen' ? p.pen : p.slip));
    warn.textContent = new Set(keys).size < keys.length ? `⚠️ ${t('Zwei Türme haben dieselbe Farbe – bitte verschiedene Farben wählen.')}` : s.count > 4 ? t('Tipp: Bei vielen Teams die Farben im Foto zeigen (🎨) – oder beim Foto die Taste mit der Teamnummer drücken (1–8), dann ist die Farbe egal.') : '';
  };
  render();

  const content = h(
    'div',
    { style: 'min-width:min(980px,92vw)' },
    h('h2', null, `🏗️ ${t('Türme bauen')}`),
    h(
      'p',
      { class: 'help', style: 'font-size:1.05rem' },
      t('Jedes Team baut seinen eigenen Turm. Jeder geschriebene Buchstabe kommt aus dem Portal und wird zu einem Baustein – je schöner, desto höher (1 bis 5 Sterne). Alien Zork fliegt jeden Stein mit seinem Traktorstrahl auf den richtigen Turm. Hat er zu viel zu tun, klont er sich einfach! Wer zuerst über die Ziellinie baut, gewinnt.'),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Teams')),
      segmented(
        ['2', '3', '4', '5', '6', '7', '8'].map((v) => ({ value: v, label: v })),
        String(s.count),
        (v) => {
          s.count = Number(v);
          d.save();
          render();
        },
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Teams erkennen an')),
      segmented(
        [
          { value: 'pen', label: t('Stiftfarbe') },
          { value: 'slip', label: t('Zettelfarbe') },
        ],
        s.by,
        (v) => {
          s.by = v;
          d.save();
          render();
        },
      ),
    ),
    teamsBox,
    warn,
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Ziellinie')),
      segmented(
        [
          { value: 'klein', label: t('Niedrig ({n} m)', { n: TOWER.goal.klein }) },
          { value: 'mittel', label: t('Mittel ({n} m)', { n: TOWER.goal.mittel }) },
          { value: 'gross', label: t('Hoch ({n} m)', { n: TOWER.goal.gross }) },
          { value: 'hoch', label: `🚀 ${t('Weltall ({n} m)', { n: TOWER.goal.hoch })}` },
          { value: 'mond', label: `🌙 ${t('Mond ({n} m)', { n: TOWER.goal.mond })}` },
        ],
        s.goal,
        (v) => {
          s.goal = v;
          d.save();
        },
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Zeitlimit')),
      segmented(
        ['0', '3', '5', '10', '15', '20', '30'].map((v) => ({ value: v, label: v === '0' ? t('Keins') : t('{n} Min', { n: v }) })),
        String(s.timeLimit),
        (v) => {
          s.timeLimit = Number(v);
          d.save();
        },
      ),
    ),
    h('p', { class: 'help' }, t('Bei „Weltall“ und „Mond“ wachsen die Türme aus dem Bild: Die Welt sinkt nach unten weg – über die Wolken, ins Weltall, an der ISS vorbei bis zum Mond.')),
    h('p', { class: 'help' }, t('Bausteine: {list}. Gekritzel macht nur „Pfff?“.', {
      list: TOWER.metres
        .slice(1)
        .map((m, i) => (i ? t('{n} Sterne = {m} m', { n: i + 1, m }) : t('1 Stern = {m} m', { m })))
        .join(', '),
    })),
    h(
      'div',
      { class: 'actions' },
      button(`📷 ${t('Kamera')}`, () => d.openCamera(), 'btn small'),
      button(t('Abbrechen'), () => m.close(), 'btn'),
      button(
        t("Los geht's!"),
        () => {
          m.close();
          d.start();
        },
        'btn primary',
      ),
    ),
  );
  const m = modal(content);
}

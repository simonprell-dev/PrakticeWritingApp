// Setup for "Türme bauen": 2–8 towers, colours (pen or slip), height of the finish line, time limit.
import type { Settings } from '../app/settings.ts';
import { TOWER } from '../game/tower/rules.ts';
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
    players.forEach((t, i) => teamsBox.append(colorCard(t, s.by, `Turm ${i + 1}`, `Turm ${i + 1}`, d, render, players, i + 1)));
    const keys = players.map((t) => (s.by === 'pen' ? t.pen : t.slip));
    warn.textContent = new Set(keys).size < keys.length ? '⚠️ Zwei Türme haben dieselbe Farbe – bitte verschiedene Farben wählen.' : s.count > 4 ? 'Tipp: Bei vielen Teams die Farben im Foto zeigen (🎨) – oder beim Foto die Taste mit der Teamnummer drücken (1–8), dann ist die Farbe egal.' : '';
  };
  render();

  const content = h(
    'div',
    { style: 'min-width:min(980px,92vw)' },
    h('h2', null, '🏗️ Türme bauen'),
    h(
      'p',
      { class: 'help', style: 'font-size:1.05rem' },
      'Jedes Team baut seinen eigenen Turm. Jeder geschriebene Buchstabe kommt aus dem Portal und wird zu einem Baustein – je schöner, desto höher (1 bis 5 Sterne). Alien Zork fliegt jeden Stein mit seinem Traktorstrahl auf den richtigen Turm. Hat er zu viel zu tun, klont er sich einfach! Wer zuerst über die Ziellinie baut, gewinnt.',
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Teams'),
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
      h('label', null, 'Teams erkennen an'),
      segmented(
        [
          { value: 'pen', label: 'Stiftfarbe' },
          { value: 'slip', label: 'Zettelfarbe' },
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
      h('label', null, 'Ziellinie'),
      segmented(
        [
          { value: 'klein', label: `Niedrig (${TOWER.goal.klein} m)` },
          { value: 'mittel', label: `Mittel (${TOWER.goal.mittel} m)` },
          { value: 'gross', label: `Hoch (${TOWER.goal.gross} m)` },
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
      h('label', null, 'Zeitlimit'),
      segmented(
        ['0', '3', '5', '10'].map((v) => ({ value: v, label: v === '0' ? 'Keins' : `${v} Min` })),
        String(s.timeLimit),
        (v) => {
          s.timeLimit = Number(v);
          d.save();
        },
      ),
    ),
    h('p', { class: 'help' }, `Bausteine: ${TOWER.metres.slice(1).map((m, i) => `${i + 1} ${i ? 'Sterne' : 'Stern'} = ${m} m`).join(', ')}. Gekritzel macht nur „Pfff?“.`),
    h(
      'div',
      { class: 'actions' },
      button('📷 Kamera', () => d.openCamera(), 'btn small'),
      button('Abbrechen', () => m.close(), 'btn'),
      button(
        "Los geht's!",
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

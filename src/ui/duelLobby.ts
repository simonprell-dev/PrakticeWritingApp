// Team-Duell setup: names, colours (pen or slip), optional colour calibration, castle strength, time limit.
import type { Settings, TeamSettings } from '../app/settings.ts';
import { PEN_PRESETS, SLIP_PRESETS, type Vec3 } from '../vision/color.ts';
import { t } from '../i18n/i18n.ts';
import { openColorPicker } from './colorPicker.ts';
import { button, clear, h, modal, segmented } from './dom.ts';

export interface ColorDeps {
  save: () => void;
  /** a photo from the document camera to tap the colour in */
  photo: () => Promise<HTMLCanvasElement | null>;
}

/** the colour a team is recognised by (calibrated or the preset) */
export function teamValue(t: TeamSettings, by: 'pen' | 'slip'): Vec3 {
  return by === 'pen' ? (t.penCalib ?? PEN_PRESETS[t.pen]?.absorb ?? PEN_PRESETS.rot.absorb) : (t.slipCalib ?? SLIP_PRESETS[t.slip]?.slip ?? SLIP_PRESETS.gelb.slip);
}

export interface LobbyDeps extends ColorDeps {
  settings: Settings;
  start: () => void;
  openCamera: () => void;
}

/**
 * One team (or tower): name, colour preset (pen or slip) and, optionally, the colour tapped in a photo
 * of the real pens or slips. `others` are the other teams (for the "too similar" warning), `photoKey`
 * the number key that takes the photo for this team.
 */
export function colorCard(
  team: TeamSettings,
  by: 'pen' | 'slip',
  title: string,
  fallbackName: string,
  d: ColorDeps,
  rerender: () => void,
  others: TeamSettings[] = [],
  photoKey?: number,
): HTMLElement {
  const name = h('input', { type: 'text', value: team.name, maxlength: '24' }) as HTMLInputElement;
  name.addEventListener('input', () => {
    team.name = name.value || fallbackName;
    d.save();
  });
  const presets = by === 'pen' ? PEN_PRESETS : SLIP_PRESETS;
  const current = by === 'pen' ? team.pen : team.slip;
  const swatches = h('div', { class: 'row' });
  for (const [key, p] of Object.entries(presets)) {
    const b = button(
      h('span', { style: `display:inline-block;width:1.3em;height:1.3em;border-radius:50%;background:${p.css};border:2px solid #3b2a5c` }),
      () => {
        if (by === 'pen') {
          team.pen = key;
          team.penCalib = undefined;
        } else {
          team.slip = key;
          team.slipCalib = undefined;
        }
        d.save();
        rerender();
      },
      `btn icon${key === current ? ' on' : ''}`,
      t(p.label),
    );
    swatches.append(b);
  }
  const calibInfo = h('div', { class: 'help' });
  const calibrated = by === 'pen' ? !!team.penCalib : !!team.slipCalib;
  calibInfo.textContent = calibrated ? `✓ ${t('Farbe im Foto angelernt')}` : t('Noch nicht angelernt (Voreinstellung).');
  const calBtn = button(
    by === 'pen' ? `🎨 ${t('Stiftfarbe im Foto zeigen')}` : `🎨 ${t('Zettelfarbe im Foto zeigen')}`,
    () =>
      openColorPicker({
        kind: by,
        name: team.name,
        others: others.filter((o) => o !== team).map((o) => ({ name: o.name, value: teamValue(o, by) })),
        photo: d.photo,
        onPick: (v) => {
          if (by === 'pen') team.penCalib = v;
          else team.slipCalib = v;
          d.save();
          rerender();
        },
      }),
    'btn small',
  );
  const pc = presets[current];
  return h(
    'div',
    { class: 'team-col', style: `border-color:${pc?.css ?? '#3b2a5c'}` },
    h(
      'div',
      { class: 'team-head' },
      h('h3', null, title),
      photoKey
        ? h(
            'span',
            { class: 'photo-key', title: t('Taste {n} (oder Team-Knopf {n}) macht sofort ein Foto – alle Zeichen darauf gehören zu diesem Team', { n: photoKey }) },
            `📷 ${t('Taste')}`,
            h('kbd', { style: `background:${pc?.css ?? '#3b2a5c'}` }, String(photoKey)),
          )
        : null,
    ),
    h('div', { class: 'row' }, name),
    h('div', { class: 'help' }, by === 'pen' ? t('Stiftfarbe:') : t('Zettelfarbe:')),
    swatches,
    h('div', { class: 'row' }, calBtn),
    calibInfo,
  );
}

export function openDuelLobby(d: LobbyDeps): void {
  const s = d.settings.duel;
  const teamsBox = h('div', { class: 'teams' });
  const card = (team: TeamSettings) =>
    colorCard(team, s.by, team.id === 'A' ? t('Team links') : t('Team rechts'), team.id === 'A' ? t('Team A') : t('Team B'), d, render, s.teams, team.id === 'A' ? 1 : 2);
  const render = () => {
    clear(teamsBox);
    teamsBox.append(card(s.teams[0]), card(s.teams[1]));
  };
  render();

  const content = h(
    'div',
    { style: 'min-width:min(820px,92vw)' },
    h('h2', null, `⚔️ ${t('Team-Duell')}`),
    h(
      'p',
      { class: 'help', style: 'font-size:1.05rem' },
      t('Jedes Team schreibt Buchstaben und Zahlen auf kleine Zettel. Unter der Kamera wird jedes Zeichen zu einer Figur mit 1 bis 5 Sternen – je schöner geschrieben, desto mehr. Jeder Stern ist ein Schlag: Treffen sich zwei Figuren, ziehen sie sich gegenseitig Sterne ab. An der gegnerischen Burg lässt jeder Schlag eine Seifenblase platzen. Die Seifenblasen-Maschine bläst neue nach, bis ihr Tank leer ist. Wer zuerst alle Blasen des Gegners zum Platzen bringt, gewinnt!'),
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
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Seifenblasen')),
      segmented(
        [
          { value: 'klein', label: t('Wenige (kurzes Spiel)') },
          { value: 'mittel', label: t('Mittel') },
          { value: 'gross', label: t('Viele (langes Spiel)') },
        ],
        s.castle,
        (v) => {
          s.castle = v;
          d.save();
        },
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Zeitlimit')),
      segmented(
        ['0', '3', '5', '10'].map((v) => ({ value: v, label: v === '0' ? t('Keins') : t('{n} Min', { n: v }) })),
        String(s.timeLimit),
        (v) => {
          s.timeLimit = Number(v);
          d.save();
        },
      ),
    ),
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

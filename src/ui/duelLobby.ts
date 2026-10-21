// Team-Duell setup: names, colours (pen or slip), optional colour calibration, castle strength, time limit.
import type { Settings, TeamSettings } from '../app/settings.ts';
import { chroma, PEN_PRESETS, SLIP_PRESETS, type Vec3 } from '../vision/color.ts';
import { button, clear, h, modal, segmented } from './dom.ts';

export interface LobbyDeps {
  settings: Settings;
  save: () => void;
  calibratePen: () => Promise<{ absorb: Vec3; pixels: number } | null>;
  calibrateSlip: () => Promise<{ rgb: Vec3 } | null>;
  start: () => void;
  openCamera: () => void;
}

export function openDuelLobby(d: LobbyDeps): void {
  const s = d.settings.duel;
  const teamsBox = h('div', { class: 'teams' });

  const teamCard = (t: TeamSettings) => {
    const name = h('input', { type: 'text', value: t.name, maxlength: '24' }) as HTMLInputElement;
    name.addEventListener('input', () => {
      t.name = name.value || (t.id === 'A' ? 'Team A' : 'Team B');
      d.save();
    });
    const presets = s.by === 'pen' ? PEN_PRESETS : SLIP_PRESETS;
    const current = s.by === 'pen' ? t.pen : t.slip;
    const swatches = h('div', { class: 'row' });
    for (const [key, p] of Object.entries(presets)) {
      const b = button(
        h('span', { style: `display:inline-block;width:1.3em;height:1.3em;border-radius:50%;background:${p.css};border:2px solid #3b2a5c` }),
        () => {
          if (s.by === 'pen') {
            t.pen = key;
            t.penCalib = undefined;
          } else {
            t.slip = key;
            t.slipCalib = undefined;
          }
          d.save();
          render();
        },
        `btn icon${key === current ? ' on' : ''}`,
        p.label,
      );
      swatches.append(b);
    }
    const calibInfo = h('div', { class: 'help' });
    const calibrated = s.by === 'pen' ? !!t.penCalib : !!t.slipCalib;
    calibInfo.textContent = calibrated ? '✓ Farbe mit der Kamera geprüft' : 'Farbe noch nicht geprüft (Voreinstellung).';
    const calBtn = button(
      '🎨 Farbe prüfen',
      async () => {
        calibInfo.textContent =
          s.by === 'pen' ? 'Male mit dem Stift ein paar dicke Striche in die Bildmitte …' : 'Lege einen leeren Zettel in die Bildmitte …';
        await new Promise((r) => setTimeout(r, 1800));
        if (s.by === 'pen') {
          const res = await d.calibratePen();
          if (!res || res.pixels < 80) {
            calibInfo.textContent = 'Ich sehe zu wenig Tinte in der Mitte. Bitte dicker malen und nochmal.';
            return;
          }
          t.penCalib = res.absorb;
          calibInfo.textContent = '✓ Stiftfarbe gemerkt!';
        } else {
          const res = await d.calibrateSlip();
          if (!res) return;
          t.slipCalib = chroma(res.rgb[0], res.rgb[1], res.rgb[2]);
          calibInfo.textContent = '✓ Zettelfarbe gemerkt!';
        }
        d.save();
      },
      'btn small',
    );
    const pc = presets[current];
    return h(
      'div',
      { class: 'team-col', style: `border-color:${pc?.css ?? '#3b2a5c'}` },
      h('h3', null, t.id === 'A' ? 'Team links' : 'Team rechts'),
      h('div', { class: 'row' }, name),
      h('div', { class: 'help' }, s.by === 'pen' ? 'Stiftfarbe:' : 'Zettelfarbe:'),
      swatches,
      h('div', { class: 'row' }, calBtn),
      calibInfo,
    );
  };

  const render = () => {
    clear(teamsBox);
    teamsBox.append(teamCard(s.teams[0]), teamCard(s.teams[1]));
  };
  render();

  const content = h(
    'div',
    { style: 'min-width:min(820px,92vw)' },
    h('h2', null, '⚔️ Team-Duell'),
    h(
      'p',
      { class: 'help', style: 'font-size:1.05rem' },
      'Jedes Team schreibt Buchstaben und Zahlen auf kleine Zettel. Unter der Kamera wird jedes Zeichen zu einer Figur. Je schöner, desto stärker! Wessen Seifenblasen-Burg zuerst platzt, verliert.',
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
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Burg-Stärke'),
      segmented(
        [
          { value: 'klein', label: 'Kurz' },
          { value: 'mittel', label: 'Mittel' },
          { value: 'gross', label: 'Lang' },
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

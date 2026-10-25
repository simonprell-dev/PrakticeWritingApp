import type { SaveMeta } from '../app/saves.ts';
import type { CameraMode, HabitatId, Settings } from '../app/settings.ts';
import { button, h, segmented } from './dom.ts';
import { openGuide } from './guide.ts';
import { howtoSection } from './howto.ts';
import { legalLinks, legalWarning } from './legal.ts';
import { continueBanner } from './savesPanel.ts';
import { tilePreview, type TileKind } from './previews.ts';

export interface StartDeps {
  settings: Settings;
  save: () => void;
  camera: () => { ok: boolean; label: string; handheld: boolean; configured: boolean };
  /** "So spielt ihr": switches between a fixed camera and a phone or tablet, then opens the camera setup */
  setCameraMode: (mode: CameraMode) => void;
  openCamera: () => void;
  openSettings: () => void;
  openPicker: (done: () => void) => void;
  startHabitat: (id: HabitatId) => void;
  openPaint: () => void;
  openDuel: () => void;
  openSiege: () => void;
  openTowers: () => void;
  /** the game played last (to continue it), if there is one */
  lastGame: () => Promise<SaveMeta | null>;
  resume: (id: string) => void;
  openSaves: () => void;
}

const COLORS = ['#ff6f91', '#ff9671', '#ffc75f', '#7ccf6b', '#4fb3ff', '#8f7bff', '#ff6fd8'];

export function renderStart(root: HTMLElement, d: StartDeps): void {
  const s = d.settings;
  // "Krakel" wobbles like a scribble, "Krone" wears the crown
  const word = (text: string, cls: string, offset: number) =>
    h(
      'span',
      { class: `logo-word ${cls}`, 'aria-hidden': 'true' },
      ...[...text].map((ch, i) => h('span', { style: `color:${COLORS[(i + offset) % COLORS.length]};animation-delay:${(i + offset) * 0.12}s` }, ch)),
    );
  const logo = h(
    'h1',
    { class: 'logo', 'aria-label': 'Krakel & Krone' },
    word('Krakel', 'krakel', 0),
    h('span', { class: 'logo-amp', 'aria-hidden': 'true' }, '&'),
    word('Krone', 'krone', 6),
  );
  const targetChip = h('span');
  const renderTarget = () => {
    targetChip.innerHTML = '';
    if (s.practice.mode !== 'ueben') return;
    targetChip.append(
      button(
        [h('span', null, 'Üben:'), h('span', { class: 'glyph' }, s.practice.targets.join(' ')), h('span', null, `je ${s.practice.count}×`), h('span', null, '✎')],
        () => d.openPicker(renderTarget),
        'btn target-chip',
        'Buchstaben wählen',
      ),
    );
  };
  const mode = segmented(
    [
      { value: 'frei', label: '✏️ Frei schreiben' },
      { value: 'ueben', label: '🎯 Buchstaben üben' },
    ],
    s.practice.mode,
    (v) => {
      s.practice.mode = v;
      d.save();
      renderTarget();
      if (v === 'ueben') d.openPicker(renderTarget);
    },
  );
  renderTarget();

  const tile = (id: TileKind, label: string, hint: string, onClick: () => void) => {
    const cv = h('canvas', { width: 480, height: 360 });
    const t = button([cv, h('div', { class: 'label' }, label), h('div', { class: 'hint' }, hint)], onClick, 'tile', label);
    const draw = () => tilePreview(id, cv);
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
    return t;
  };
  const cam = d.camera();
  const short = cam.label.length > 32 ? cam.label.slice(0, 30) + '…' : cam.label;
  const camChip = cam.handheld
    ? button('📱 Kamera: Handy/Tablet', d.openCamera, 'btn small cam-chip ok', 'Kamera einrichten')
    : button(cam.ok ? `📷 ${short}` : '📷 Kamera einrichten', d.openCamera, `btn small cam-chip ${cam.ok ? 'ok' : cam.configured ? 'bad' : ''}`, cam.label);

  // "Weiterspielen" appears as soon as the saved games are read
  const cont = h('div', { class: 'continue-row' });
  void d.lastGame().then((m) => {
    if (m) cont.append(continueBanner(m, () => d.resume(m.id)));
  });

  root.append(
    h(
      'div',
      { class: 'start' },
      logo,
      h('p', { class: 'subtitle' }, 'Schreib schön – und dein Krakel bekommt eine Krone!'),
      cont,
      h('div', { class: 'mode-row' }, mode, targetChip),
      h(
        'div',
        { class: 'tiles' },
        tile('meer', '🐠 Meer', 'Fische im Ozean', () => d.startHabitat('meer')),
        tile('weltraum', '👽 Weltraum', 'Aliens zwischen den Planeten', () => d.startHabitat('weltraum')),
        tile('savanne', '🦒 Savanne', 'Tiere in der Steppe', () => d.startHabitat('savanne')),
        tile('duell', '⚔️ Team-Duell', 'Zwei Teams, Zettel, Blasen-Burgen', d.openDuel),
        tile('riesenburg', '🏰 Riesenburg', 'Die ganze Klasse gegen den Riesen', d.openSiege),
        tile('tuerme', '🏗️ Türme bauen', 'Bis zu 8 Teams, Aliens helfen', d.openTowers),
        tile('malen', '🎨 Mal-Aquarium', 'Fische ausmalen – sie schwimmen los', d.openPaint),
      ),
      howtoSection({ mode: s.camera.mode, choose: d.setCameraMode }),
      h(
        'div',
        { class: 'footer' },
        camChip,
        button('📂 Spielstände', d.openSaves, 'btn small'),
        button('⚙️ Einstellungen', d.openSettings, 'btn small'),
        button('👩‍🏫 Für Lehrer und Eltern', openGuide, 'btn small'),
      ),
      legalLinks(),
    ),
  );
  void legalWarning().then((w) => {
    if (w) root.querySelector('.start')?.append(w);
  });
}

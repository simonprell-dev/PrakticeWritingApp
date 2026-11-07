import { RECHENMEER } from '../app/features.ts';
import { offeredWorlds } from '../app/worldPlan.ts';
import { SEASON_INFO, SEASONAL, type FrontId, type SeasonId, type WorldId } from '../app/worlds.ts';
import { SEASON_DEFS } from '../scenes/seasons/index.ts';
import type { SaveMeta } from '../app/saves.ts';
import type { CameraMode, HabitatId, Settings } from '../app/settings.ts';
import { openContact } from './contact.ts';
import { donateButton } from './donate.ts';
import { button, h, segmented } from './dom.ts';
import { openGuide } from './guide.ts';
import { howtoSection } from './howto.ts';
import { legalLinks, legalWarning } from './legal.ts';
import { continueBanner } from './savesPanel.ts';
import { tilePreview, type TileKind } from './previews.ts';
import { openScriptPicker, scriptTile } from './scriptPicker.ts';
import { languageButton } from './languagePicker.ts';
import type { ScriptId } from '../recog/scripts.ts';
import { t } from '../i18n/i18n.ts';

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
  /** another script was chosen on the world map */
  setScript: (s: ScriptId) => void;
  /** another page language was chosen (the page reloads) */
  setLanguage: (lang: string) => void;
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
        [h('span', null, t('Üben:')), h('span', { class: 'glyph' }, s.practice.targets.join(' ')), h('span', null, t('je {n}×', { n: s.practice.count })), h('span', null, '✎')],
        () => d.openPicker(renderTarget),
        'btn target-chip',
        t('Buchstaben wählen'),
      ),
    );
  };
  const mode = segmented(
    [
      { value: 'frei', label: t('✏️ Frei schreiben') },
      { value: 'ueben', label: t('🎯 Buchstaben üben') },
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

  const tile = (id: TileKind, label: string, hint: string, onClick: () => void, until: Date | null = null) => {
    const cv = h('canvas', { width: 480, height: 360 });
    // a seasonal world tells when it goes again
    const badge = until ? [h('div', { class: 'until' }, t('nur bis {date}', { date: `${until.getDate()}.${until.getMonth() + 1}.` }))] : [];
    const b = button([cv, ...badge, h('div', { class: 'label' }, label), h('div', { class: 'hint' }, hint)], onClick, `tile${until ? ' seasonal' : ''}`, label);
    const draw = () => tilePreview(id, cv);
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
    return b;
  };
  const worldTile = (id: WorldId, until: Date | null) => {
    if (SEASONAL.has(id)) {
      const s = SEASON_INFO[id as FrontId];
      return tile(id as FrontId, `${s.icon} ${t(s.title)}`, t(s.hint), () => d.startHabitat(id as FrontId), until);
    }
    const fixed: Record<Exclude<WorldId, FrontId>, () => HTMLElement> = {
      meer: () => tile('meer', t('🐠 Meer'), t('Fische im Ozean'), () => d.startHabitat('meer'), until),
      weltraum: () => tile('weltraum', t('👽 Weltraum'), t('Aliens zwischen den Planeten'), () => d.startHabitat('weltraum'), until),
      savanne: () => tile('savanne', t('🦒 Savanne'), t('Tiere in der Steppe'), () => d.startHabitat('savanne'), until),
      zauberland: () => tile('zauberland', t('🦄 Zauberland'), t('Einhörner, Prinzessinnen und eine Burg'), () => d.startHabitat('zauberland'), until),
      duell: () => tile('duell', t('⚔️ Team-Duell'), t('Zwei Teams, Zettel, Blasen-Burgen'), d.openDuel, until),
      riesenburg: () => tile('riesenburg', t('🏰 Riesenburg'), t('Die ganze Klasse gegen den Riesen'), d.openSiege, until),
      tuerme: () => tile('tuerme', t('🏗️ Türme bauen'), t('Bis zu 8 Teams, Aliens helfen'), d.openTowers, until),
      malen: () => tile('malen', t('🎨 Mal-Aquarium'), t('Meerestiere ausmalen – sie schwimmen los'), d.openPaint, until),
    };
    return fixed[id as Exclude<WorldId, FrontId>]();
  };
  const cam = d.camera();
  const short = cam.label.length > 32 ? cam.label.slice(0, 30) + '…' : cam.label;
  const camChip = cam.handheld
    ? button(t('📱 Kamera: Handy/Tablet'), d.openCamera, 'btn small cam-chip ok', t('Kamera einrichten'))
    : button(cam.ok ? `📷 ${short}` : t('📷 Kamera einrichten'), d.openCamera, `btn small cam-chip ${cam.ok ? 'ok' : cam.configured ? 'bad' : ''}`, cam.label);

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
      h('p', { class: 'subtitle' }, t('Schreib schön – und dein Krakel bekommt eine Krone!')),
      cont,
      h('div', { class: 'mode-row' }, mode, targetChip),
      h(
        'div',
        { class: 'tiles' },
        scriptTile(s.script, () => openScriptPicker(s.script, d.setScript)),
        ...offeredWorlds(new Date(), (id) => id === 'advent' || !!SEASON_DEFS[id as SeasonId]).flatMap(({ id, until }) => {
          const one = worldTile(id, until);
          // the Rechenmeer is outside the plan; while it is switched on in the code it follows the Zauberland
          return id === 'zauberland' && RECHENMEER ? [one, tile('rechenmeer', t('🐬 Rechenmeer'), t('Rechnen füllt das Meer'), () => d.startHabitat('rechenmeer'))] : [one];
        }),
      ),
      howtoSection({ mode: s.camera.mode, choose: d.setCameraMode }),
      h(
        'div',
        { class: 'footer' },
        camChip,
        languageButton(d.setLanguage),
        button(t('📂 Spielstände'), d.openSaves, 'btn small'),
        button(t('⚙️ Einstellungen'), d.openSettings, 'btn small'),
        button(t('👩‍🏫 Für Lehrer und Eltern'), openGuide, 'btn small'),
        button(t('✉️ Kontakt & Feedback'), () => openContact(), 'btn small'),
        donateButton(),
      ),
      legalLinks(),
    ),
  );
  void legalWarning().then((w) => {
    if (w) root.querySelector('.start')?.append(w);
  });
}

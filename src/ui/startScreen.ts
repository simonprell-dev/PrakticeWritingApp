import type { HabitatId, Settings } from '../app/settings.ts';
import { withArticle } from '../recog/classes.ts';
import { button, h, modal, segmented } from './dom.ts';
import { legalLinks, legalWarning, openLegal } from './legal.ts';
import { tilePreview } from './previews.ts';

export interface StartDeps {
  settings: Settings;
  save: () => void;
  camera: () => { ok: boolean; label: string };
  openCamera: () => void;
  openSettings: () => void;
  openPicker: (done: () => void) => void;
  startHabitat: (id: HabitatId) => void;
  openDuel: () => void;
  openSiege: () => void;
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
        [h('span', null, 'Üben:'), h('span', { class: 'glyph' }, s.practice.target), h('span', null, `× ${s.practice.count}`), h('span', null, '✎')],
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

  const tile = (id: 'meer' | 'weltraum' | 'savanne' | 'duell' | 'riesenburg', label: string, hint: string, onClick: () => void) => {
    const cv = h('canvas', { width: 480, height: 360 });
    const t = button([cv, h('div', { class: 'label' }, label), h('div', { class: 'hint' }, hint)], onClick, 'tile', label);
    const draw = () => tilePreview(id, cv);
    if (document.fonts?.ready) void document.fonts.ready.then(draw);
    else draw();
    return t;
  };
  const cam = d.camera();
  const short = cam.label.length > 32 ? cam.label.slice(0, 30) + '…' : cam.label;
  const camChip = button(cam.ok ? `📷 ${short}` : '📷 Kamera einrichten', d.openCamera, `btn small cam-chip ${cam.ok ? 'ok' : 'bad'}`, cam.label);

  root.append(
    h(
      'div',
      { class: 'start' },
      logo,
      h('p', { class: 'subtitle' }, 'Schreib schön – und dein Krakel bekommt eine Krone!'),
      h('div', { class: 'mode-row' }, mode, targetChip),
      h(
        'div',
        { class: 'tiles' },
        tile('meer', '🐠 Meer', 'Fische im Ozean', () => d.startHabitat('meer')),
        tile('weltraum', '👽 Weltraum', 'Aliens zwischen den Planeten', () => d.startHabitat('weltraum')),
        tile('savanne', '🦒 Savanne', 'Tiere in der Steppe', () => d.startHabitat('savanne')),
        tile('duell', '⚔️ Team-Duell', 'Zwei Teams, Zettel, Blasen-Burgen', d.openDuel),
        tile('riesenburg', '🏰 Riesenburg', 'Die ganze Klasse gegen den Riesen', d.openSiege),
      ),
      h(
        'div',
        { class: 'footer' },
        camChip,
        button('⚙️ Einstellungen', d.openSettings, 'btn small'),
        button('❓ Hilfe', openHelp, 'btn small'),
      ),
      legalLinks(),
    ),
  );
  void legalWarning().then((w) => {
    if (w) root.querySelector('.start')?.append(w);
  });
}

export function openHelp(): void {
  const content = h(
    'div',
    { style: 'max-width:760px' },
    h('h2', null, 'So geht’s'),
    h('h3', null, '1. Kamera'),
    h('p', null, 'Dokumentenkamera anschließen, „Kamera einrichten“ öffnen, Bild drehen bis die Schrift aufrecht ist und einen Rahmen um das Blatt ziehen.'),
    h('h3', null, '2. Schreiben'),
    h('p', null, 'Die Kinder schreiben Buchstaben oder Zahlen unter die Kamera. Dann „Fertig!“ drücken – oder Leertaste, Enter oder den Presenter. Mit „Automatisch scannen“ (Einstellungen) geht es auch ohne Knopf.'),
    h('h3', null, '3. Staunen'),
    h('p', null, 'Jedes Zeichen wird zu einem Wesen. Je schöner geschrieben, desto prächtiger. Krakelige Zeichen werden zu lustigen, zerknitterten Wesen. Antippen zeigt das Zeichen groß mit einem Tipp.'),
    h('h3', null, 'Tasten'),
    h(
      'ul',
      null,
      h('li', null, 'Leertaste / Enter / Bild↓ / Pfeil → : Scannen'),
      h('li', null, 'N: Neues Blatt (alles Geschriebene gilt als neu)'),
      h('li', null, 'A: Automatisch scannen an/aus'),
      h('li', null, 'F: Vollbild, Esc: Menü'),
    ),
    h('h3', null, 'Team-Duell'),
    h('p', null, `Zwei Teams schreiben auf kleine Zettel (z. B. rote und blaue Stifte). Jedes Zeichen wird zu einer Figur mit 1–5 Sternen – so oft kann sie zuschlagen. Treffen sich zwei Figuren, ziehen sie sich Sterne ab. An der gegnerischen Burg lässt jeder Schlag eine Seifenblase platzen; die Seifenblasen-Maschine bläst neue nach, bis ihr Tank leer ist. Gekritzel macht nur „Pfff“. Beispiel-Aufgabe: „Schreibt ${withArticle('A')} bis ${withArticle('Z')}!“`),
    h('h3', null, 'Klasse gegen Riesenburg'),
    h('p', null, 'Die ganze Klasse ist ein Team gegen Riese Rumpel. Jedes Zeichen wird zu einer Figur mit 1–5 Sternen. Die Figuren besiegen die Tintenklecks-Wächter und lassen die Seifenblasen der Riesenburg platzen – Mauer für Mauer, mit Zwischensequenzen, bis der Riese aufgibt. Alle Stiftfarben zählen.'),
    h('h3', null, 'Datenschutz'),
    h(
      'p',
      null,
      'Die Kamerabilder werden nur auf diesem Gerät ausgewertet, nirgendwohin geschickt und nicht gespeichert. Es gibt keine Konten, keine Cookies und kein Tracking. Bitte die Kamera nur auf das Papier richten und als Teamnamen keine Namen von Kindern verwenden.',
    ),
    h(
      'div',
      { class: 'actions' },
      button('Datenschutzerklärung', () => {
        m.close();
        void openLegal('datenschutz');
      }, 'btn small'),
      button('Alles klar!', () => m.close(), 'btn primary'),
    ),
  );
  const m = modal(content);
}

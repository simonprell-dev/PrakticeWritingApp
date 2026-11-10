import { RECHENMEER } from '../app/features.ts';
import { clearSaves } from '../app/saves.ts';
import { resetSettings, type Settings } from '../app/settings.ts';
import { TASK_KINDS, type TaskKind } from '../game/math/tasks.ts';
import { button, h, modal, segmented, toggle } from './dom.ts';
import { toast } from './toast.ts';
import { t, tk } from '../i18n/i18n.ts';

/** the kinds of tasks of the Rechenmeer, as they are named in the settings */
const MATH_LABELS: [TaskKind, string][] = [
  ['plus20', tk('Plus bis 20')],
  ['minus20', tk('Minus bis 20')],
  ['pm100', tk('Plus und Minus bis 100')],
  ['mal', tk('Einmaleins (Kernaufgaben)')],
  ['geteilt', tk('Geteilt (Umkehr der Kernaufgaben)')],
];

export interface SettingsDeps {
  settings: Settings;
  save: () => void;
  openCamera: () => void;
  replace: (s: Settings) => void;
  modelInfo: string;
}

export function openSettings(d: SettingsDeps, onClose?: () => void): void {
  const s = d.settings;
  const row = (label: string, ctrl: HTMLElement, help?: string) =>
    h('div', null, h('div', { class: 'row' }, h('label', null, label), ctrl), help ? h('div', { class: 'help', style: 'margin:-4px 0 8px' }, help) : null);
  const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(s.game.volume) }) as HTMLInputElement;
  vol.addEventListener('input', () => {
    s.game.volume = Number(vol.value);
    d.save();
  });
  const delay = h('input', { type: 'range', min: '1', max: '3', step: '0.5', value: String(s.recog.autoDelay) }) as HTMLInputElement;
  const delayLabel = h('span', null, `${s.recog.autoDelay} s`);
  delay.addEventListener('input', () => {
    s.recog.autoDelay = Number(delay.value);
    delayLabel.textContent = `${delay.value} s`;
    d.save();
  });
  // Rechenmeer: the kinds of tasks; the last one that is on stays on
  const mathToggles = () =>
    MATH_LABELS.map(([kind, label]) => {
      const el = toggle(t(label), s.math.kinds.includes(kind), (on) => {
        const kinds = s.math.kinds.filter((k) => k !== kind);
        if (on) kinds.push(kind);
        if (!kinds.length) {
          toast(t('Mindestens eine Aufgabenart muss an bleiben.'), 'info');
          el.click();
          return;
        }
        s.math.kinds = TASK_KINDS.filter((k) => kinds.includes(k));
        d.save();
      });
      return el;
    });
  const set = <T extends string>(apply: (v: T) => void) => (v: T) => {
    apply(v);
    d.save();
  };
  const content = h(
    'div',
    { style: 'min-width:min(760px,90vw)' },
    h('h2', null, t('⚙️ Einstellungen')),
    h('h3', null, t('Kamera')),
    h('div', { class: 'row' }, button(t('📷 Kamera einrichten …'), () => {
      m.close();
      d.openCamera();
    }, 'btn small'), h('span', { class: 'help' }, s.camera.label ? t('Aktuell: {camera}', { camera: s.camera.label }) : t('Noch keine Kamera gewählt'))),
    h('h3', null, t('Erkennung')),
    row(
      t('Strenge'),
      segmented(
        [
          { value: 'leicht', label: t('Leicht') },
          { value: 'mittel', label: t('Mittel') },
          { value: 'streng', label: t('Streng') },
        ],
        s.recog.strictness,
        set((v) => (s.recog.strictness = v)),
      ),
      t('Leicht: schon wackelige Buchstaben werden zu schönen Wesen. Streng: nur sehr saubere Schrift wird „Prachtstück“.'),
    ),
    // Druck- or Grundschrift templates: only the Druckschrift model knows both
    s.script !== 'druck' ? null : row(
      t('Vorlage'),
      segmented(
        [
          { value: 'beide', label: t('Beide') },
          { value: 'grund', label: t('Grundschrift') },
          { value: 'druck', label: t('Druckschrift') },
        ],
        s.recog.style,
        set((v) => (s.recog.style = v)),
      ),
      t('Womit die Buchstaben verglichen werden.'),
    ),
    row(
      t('Stift'),
      segmented(
        [
          { value: 'auto', label: t('Automatisch') },
          { value: 'felt', label: t('Filzstift') },
          { value: 'pencil', label: t('Bleistift') },
        ],
        s.recog.pen,
        set((v) => (s.recog.pen = v)),
      ),
    ),
    row(
      t('Lineatur'),
      segmented(
        [
          { value: 'auto', label: t('Automatisch') },
          { value: 'L1', label: t('Lineatur 1') },
          { value: 'L2', label: t('Lineatur 2') },
          { value: 'L3', label: t('Lineatur 3') },
          { value: 'liniert', label: t('Normal liniert') },
          { value: 'blanko', label: t('Ohne Linien') },
        ],
        s.recog.lineatur,
        set((v) => (s.recog.lineatur = v)),
      ),
    ),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'row' },
        toggle(t('Spiegelschrift zählt nicht'), s.recog.noMirror, (on) => {
          s.recog.noMirror = on;
          d.save();
        }),
      ),
      h(
        'div',
        { class: 'help', style: 'margin:-4px 0 8px' },
        t('An: Spiegelverkehrte Buchstaben (z. B. ein umgedrehtes S, Z oder N) werden nicht als Buchstabe gezählt – es schlüpft kein Wesen und es gibt keinen Baustein. Aus: Sie zählen, bekommen aber weniger Sterne und den Tipp „Dreh mich um“. b/d und p/q lassen sich dabei nicht unterscheiden.'),
      ),
    ),
    row(
      t('Automatisch scannen'),
      segmented(
        [
          { value: 'aus', label: t('Aus') },
          { value: 'an', label: t('An') },
        ],
        s.recog.autoScan ? 'an' : 'aus',
        set((v) => (s.recog.autoScan = v === 'an')),
      ),
      t('Scannt von selbst, wenn sich unter der Kamera etwas verändert hat und die Hände weg sind.'),
    ),
    row(t('Wartezeit'), h('span', { class: 'row', style: 'margin:0' }, delay, delayLabel)),
    h('h3', null, t('Spiel')),
    row(
      t('Wesen gleichzeitig'),
      segmented(
        ['20', '30', '50'].map((v) => ({ value: v, label: v })),
        String(s.game.maxCreatures),
        set((v) => (s.game.maxCreatures = Number(v))),
      ),
      t('Wenn es mehr werden, schwimmen die ältesten Wesen weg.'),
    ),
    row(
      t('Töne'),
      segmented(
        [
          { value: 'an', label: t('An') },
          { value: 'aus', label: t('Aus') },
        ],
        s.game.sound ? 'an' : 'aus',
        set((v) => (s.game.sound = v === 'an')),
      ),
    ),
    row(t('Lautstärke'), vol),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'row' },
        toggle(t('Messemodus'), s.game.fair, (on) => {
          s.game.fair = on;
          d.save();
        }),
      ),
      h('div', { class: 'help', style: 'margin:-4px 0 8px' }, t('Blendet im Mal-Aquarium einen QR-Code und die Webadresse ein, damit Besucher das Spiel zu Hause wiederfinden.')),
    ),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'row' },
        toggle(t('Feedback-Ampel nach dem Spiel'), s.game.feedback, (on) => {
          s.game.feedback = on;
          d.save();
        }),
      ),
      h('div', { class: 'help', style: 'margin:-4px 0 8px' }, t('Nach einem Spiel fragt eine Ampel „Wie war das Spiel?“ (Grün, Gelb, Rot). Bei Rot öffnet sich das Kontaktfeld. Gespeichert wird nur die Farbe und das Spiel.')),
    ),
    row(
      t('Schriftproben spenden'),
      segmented(
        [
          { value: 'fragen', label: t('Nach jeder Stunde fragen') },
          { value: 'immer', label: t('Immer hochladen') },
          { value: 'nie', label: t('Nie') },
        ],
        s.game.samples,
        set((v) => (s.game.samples = v)),
      ),
      t('Mit den ausgeschnittenen Buchstaben einer Stunde (keine Fotos, keine Namen) verbessern wir die Erkennung für Kinderschrift. Bitte nur, wenn Schule und Eltern einverstanden sind.'),
    ),
    ...(RECHENMEER
      ? [
          h('h3', null, t('Rechenmeer')),
          h('div', { class: 'help', style: 'margin:-4px 0 8px' }, t('Welche Aufgaben im Rechenmeer drankommen (Klasse 1/2). Mindestens eine bleibt an.')),
          h('div', { class: 'row', style: 'flex-wrap:wrap;gap:8px' }, ...mathToggles()),
        ]
      : []),
    h('h3', null, t('Spielstände')),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'row' },
        toggle(t('Letztes Spiel merken'), s.game.autosave === true, (on) => {
          s.game.autosave = on;
          d.save();
        }),
        button(
          t('🗑 Alle Spielstände löschen'),
          () => {
            if (!confirm(t('Alle gespeicherten Spiele löschen? Das lässt sich nicht rückgängig machen.'))) return;
            void clearSaves().then(
              () => toast(t('Alle Spielstände sind gelöscht.'), 'good'),
              () => toast(t('Löschen hat nicht geklappt.'), 'warn'),
            );
          },
          'btn small',
        ),
      ),
      h(
        'div',
        { class: 'help', style: 'margin:-4px 0 8px' },
        t('An: Die App merkt sich das letzte Spiel jeder Spielart und fragt beim nächsten Mal, ob ihr weiterspielen wollt. Gespeichert wird nur in diesem Browser – mit den ausgeschnittenen Buchstaben und ausgemalten Fischen, ohne Kamerafotos. Auf gemeinsam genutzten Geräten lieber ausschalten.'),
      ),
    ),
    h('h3', null, t('Über')),
    h('p', { class: 'help' }, t('Alle Bilder werden nur auf diesem Gerät ausgewertet und nirgendwohin geschickt. Gespeichert werden nur diese Einstellungen und die Spielstände – beides nur in diesem Browser.')),
    h('p', { class: 'help' }, d.modelInfo),
    h(
      'div',
      { class: 'actions' },
      button(t('Alles zurücksetzen'), () => {
        if (!confirm(t('Alle Einstellungen zurücksetzen und alle Spielstände löschen?'))) return;
        const fresh = resetSettings();
        fresh.firstRunDone = true;
        void clearSaves().catch(() => undefined);
        d.replace(fresh);
        m.close();
      }, 'btn small'),
      button(t('Fertig'), () => m.close(), 'btn primary'),
    ),
  );
  const m = modal(content, onClose);
}


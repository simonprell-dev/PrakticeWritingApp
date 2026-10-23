import { clearSaves } from '../app/saves.ts';
import { resetSettings, type Settings } from '../app/settings.ts';
import { button, h, modal, segmented, toggle } from './dom.ts';
import { toast } from './toast.ts';

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
  const set = <T extends string>(apply: (v: T) => void) => (v: T) => {
    apply(v);
    d.save();
  };
  const content = h(
    'div',
    { style: 'min-width:min(760px,90vw)' },
    h('h2', null, '⚙️ Einstellungen'),
    h('h3', null, 'Kamera'),
    h('div', { class: 'row' }, button('📷 Kamera einrichten …', () => {
      m.close();
      d.openCamera();
    }, 'btn small'), h('span', { class: 'help' }, s.camera.label ? `Aktuell: ${s.camera.label}` : 'Noch keine Kamera gewählt')),
    h('h3', null, 'Erkennung'),
    row(
      'Strenge',
      segmented(
        [
          { value: 'leicht', label: 'Leicht' },
          { value: 'mittel', label: 'Mittel' },
          { value: 'streng', label: 'Streng' },
        ],
        s.recog.strictness,
        set((v) => (s.recog.strictness = v)),
      ),
      'Leicht: schon wackelige Buchstaben werden zu schönen Wesen. Streng: nur sehr saubere Schrift wird „Prachtstück“.',
    ),
    row(
      'Vorlage',
      segmented(
        [
          { value: 'beide', label: 'Beide' },
          { value: 'grund', label: 'Grundschrift' },
          { value: 'druck', label: 'Druckschrift' },
        ],
        s.recog.style,
        set((v) => (s.recog.style = v)),
      ),
      'Womit die Buchstaben verglichen werden.',
    ),
    row(
      'Stift',
      segmented(
        [
          { value: 'auto', label: 'Automatisch' },
          { value: 'felt', label: 'Filzstift' },
          { value: 'pencil', label: 'Bleistift' },
        ],
        s.recog.pen,
        set((v) => (s.recog.pen = v)),
      ),
    ),
    row(
      'Lineatur',
      segmented(
        [
          { value: 'auto', label: 'Automatisch' },
          { value: 'L1', label: 'Lineatur 1' },
          { value: 'L2', label: 'Lineatur 2' },
          { value: 'L3', label: 'Lineatur 3' },
          { value: 'liniert', label: 'Normal liniert' },
          { value: 'blanko', label: 'Ohne Linien' },
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
        toggle('Spiegelschrift zählt nicht', s.recog.noMirror, (on) => {
          s.recog.noMirror = on;
          d.save();
        }),
      ),
      h(
        'div',
        { class: 'help', style: 'margin:-4px 0 8px' },
        'An: Spiegelverkehrte Buchstaben (z. B. ein umgedrehtes S, Z oder N) werden nicht als Buchstabe gezählt – es schlüpft kein Wesen und es gibt keinen Baustein. Aus: Sie zählen, bekommen aber weniger Sterne und den Tipp „Dreh mich um“. b/d und p/q lassen sich dabei nicht unterscheiden.',
      ),
    ),
    row(
      'Automatisch scannen',
      segmented(
        [
          { value: 'aus', label: 'Aus' },
          { value: 'an', label: 'An' },
        ],
        s.recog.autoScan ? 'an' : 'aus',
        set((v) => (s.recog.autoScan = v === 'an')),
      ),
      'Scannt von selbst, wenn sich unter der Kamera etwas verändert hat und die Hände weg sind.',
    ),
    row('Wartezeit', h('span', { class: 'row', style: 'margin:0' }, delay, delayLabel)),
    h('h3', null, 'Spiel'),
    row(
      'Wesen gleichzeitig',
      segmented(
        ['20', '30', '50'].map((v) => ({ value: v, label: v })),
        String(s.game.maxCreatures),
        set((v) => (s.game.maxCreatures = Number(v))),
      ),
      'Wenn es mehr werden, schwimmen die ältesten Wesen weg.',
    ),
    row(
      'Töne',
      segmented(
        [
          { value: 'an', label: 'An' },
          { value: 'aus', label: 'Aus' },
        ],
        s.game.sound ? 'an' : 'aus',
        set((v) => (s.game.sound = v === 'an')),
      ),
    ),
    row('Lautstärke', vol),
    h('h3', null, 'Spielstände'),
    h(
      'div',
      null,
      h(
        'div',
        { class: 'row' },
        toggle('Letztes Spiel merken', s.game.autosave, (on) => {
          s.game.autosave = on;
          d.save();
        }),
        button(
          '🗑 Alle Spielstände löschen',
          () => {
            if (!confirm('Alle gespeicherten Spiele löschen? Das lässt sich nicht rückgängig machen.')) return;
            void clearSaves().then(
              () => toast('Alle Spielstände sind gelöscht.', 'good'),
              () => toast('Löschen hat nicht geklappt.', 'warn'),
            );
          },
          'btn small',
        ),
      ),
      h(
        'div',
        { class: 'help', style: 'margin:-4px 0 8px' },
        'An: Die App merkt sich das letzte Spiel jeder Spielart und fragt beim nächsten Mal, ob ihr weiterspielen wollt. Gespeichert wird nur in diesem Browser – mit den ausgeschnittenen Buchstaben und ausgemalten Fischen, ohne Kamerafotos. Auf gemeinsam genutzten Geräten lieber ausschalten.',
      ),
    ),
    h('h3', null, 'Über'),
    h('p', { class: 'help' }, 'Alle Bilder werden nur auf diesem Gerät ausgewertet und nirgendwohin geschickt. Gespeichert werden nur diese Einstellungen und die Spielstände – beides nur in diesem Browser.'),
    h('p', { class: 'help' }, d.modelInfo),
    h(
      'div',
      { class: 'actions' },
      button('Alles zurücksetzen', () => {
        if (!confirm('Alle Einstellungen zurücksetzen und alle Spielstände löschen?')) return;
        const fresh = resetSettings();
        fresh.firstRunDone = true;
        void clearSaves().catch(() => undefined);
        d.replace(fresh);
        m.close();
      }, 'btn small'),
      button('Fertig', () => m.close(), 'btn primary'),
    ),
  );
  const m = modal(content, onClose);
}


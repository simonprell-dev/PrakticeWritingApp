// Setup for "Klasse gegen Riesenburg": class name, size of the castle, time limit.
import type { Settings } from '../app/settings.ts';
import { button, h, modal, segmented } from './dom.ts';

export function openSiegeLobby(settings: Settings, save: () => void, start: () => void, openCamera: () => void): void {
  const s = settings.siege;
  const name = h('input', { type: 'text', value: s.className, maxlength: '24' }) as HTMLInputElement;
  name.addEventListener('input', () => {
    s.className = name.value.trim() || 'Unsere Klasse';
    save();
  });
  const content = h(
    'div',
    { style: 'min-width:min(760px,92vw)' },
    h('h2', null, '🏰 Klasse gegen Riesenburg'),
    h(
      'p',
      { class: 'help', style: 'font-size:1.05rem' },
      'Die ganze Klasse gegen Riese Rumpel! Jedes geschriebene Zeichen wird zu einer Figur mit 1 bis 5 Sternen – je schöner, desto mehr. Die Figuren kämpfen gegen die Tintenklecks-Wächter und lassen die Seifenblasen der Riesenburg platzen. Mauer für Mauer – bis der Riese die weiße Fahne schwenkt.',
    ),
    h('div', { class: 'row' }, h('label', null, 'Name der Klasse'), name),
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Riesenburg'),
      segmented(
        [
          { value: 'klein', label: '2 Mauern' },
          { value: 'mittel', label: '3 Mauern' },
          { value: 'gross', label: '4 Mauern' },
        ],
        s.size,
        (v) => {
          s.size = v;
          save();
        },
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Zeitlimit'),
      segmented(
        ['0', '5', '10', '15'].map((v) => ({ value: v, label: v === '0' ? 'Keins' : `${v} Min` })),
        String(s.timeLimit),
        (v) => {
          s.timeLimit = Number(v);
          save();
        },
      ),
    ),
    h('p', { class: 'help' }, 'Tipp: Jedes Kind schreibt Buchstaben auf kleine Zettel oder ein gemeinsames Blatt. Alle Stiftfarben zählen.'),
    h(
      'div',
      { class: 'actions' },
      button('📷 Kamera', () => openCamera(), 'btn small'),
      button('Abbrechen', () => m.close(), 'btn'),
      button(
        'Angriff!',
        () => {
          m.close();
          start();
        },
        'btn primary',
      ),
    ),
  );
  const m = modal(content);
}

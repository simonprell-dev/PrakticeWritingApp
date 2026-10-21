import type { Settings } from '../app/settings.ts';
import { PRACTICE_SETS } from '../recog/classes.ts';
import { button, h, modal, segmented } from './dom.ts';

/** Letter grid to choose what to practise and how often. */
export function openTargetPicker(settings: Settings, onDone: () => void): void {
  let chosen = settings.practice.target;
  let count = settings.practice.count;
  const grids = h('div');
  const keys: HTMLButtonElement[] = [];
  for (const set of PRACTICE_SETS) {
    const row = h('div', { class: 'picker-set' });
    for (const ch of set.chars) {
      const k = button(ch, () => {
        chosen = ch;
        keys.forEach((b) => b.classList.toggle('on', b.textContent === ch));
      }, `picker-key${ch === chosen ? ' on' : ''}`);
      keys.push(k);
      row.append(k);
    }
    grids.append(h('h3', null, set.label), row);
  }
  const content = h(
    'div',
    null,
    h('h2', null, 'Was wollen wir üben?'),
    grids,
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Wie oft?'),
      segmented(
        [3, 5, 10].map((n) => ({ value: String(n), label: `${n}×` })),
        String(count),
        (v) => (count = Number(v)),
      ),
    ),
    h(
      'div',
      { class: 'actions' },
      button('Fertig', () => {
        settings.practice.target = chosen;
        settings.practice.count = count;
        settings.practice.mode = 'ueben';
        m.close();
      }, 'btn primary'),
    ),
  );
  const m = modal(content, onDone);
}

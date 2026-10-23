import type { Settings } from '../app/settings.ts';
import { PRACTICE_SETS } from '../recog/classes.ts';
import { button, h, modal, segmented } from './dom.ts';

/**
 * Letter grid to choose what to practise and how often. Several letters can be chosen: they are
 * practised one after the other, in the order they were tapped (the small numbers show it).
 */
export function openTargetPicker(settings: Settings, onDone: () => void): void {
  let chosen = [...settings.practice.targets];
  let count = settings.practice.count;
  let surprise = settings.practice.surprise;
  const grids = h('div');
  const keys: HTMLButtonElement[] = [];
  const order = h('span', { class: 'glyphs' });
  const info = h('span', { class: 'help' });
  const done = button('Fertig', () => finish(), 'btn primary');

  const refresh = () => {
    for (const k of keys) {
      const i = chosen.indexOf(k.textContent ?? '');
      k.classList.toggle('on', i >= 0);
      if (i >= 0 && chosen.length > 1) k.dataset.n = String(i + 1);
      else delete k.dataset.n;
    }
    order.textContent = chosen.join(' → ');
    info.textContent = chosen.length ? (chosen.length === 1 ? 'Tippe weitere Buchstaben an, um mehrere nacheinander zu üben.' : 'Reihenfolge wie angetippt.') : 'Bitte mindestens einen Buchstaben antippen.';
    done.disabled = !chosen.length;
  };

  for (const set of PRACTICE_SETS) {
    const row = h('div', { class: 'picker-set' });
    for (const ch of set.chars) {
      const k = button(ch, () => {
        chosen = chosen.includes(ch) ? chosen.filter((c) => c !== ch) : [...chosen, ch];
        refresh();
      }, 'picker-key');
      keys.push(k);
      row.append(k);
    }
    grids.append(h('h3', null, set.label), row);
  }

  const finish = () => {
    if (!chosen.length) return;
    settings.practice.targets = chosen;
    settings.practice.count = count;
    settings.practice.surprise = surprise;
    settings.practice.mode = 'ueben';
    m.close();
  };

  const content = h(
    'div',
    null,
    h('h2', null, 'Was wollen wir üben?'),
    h(
      'div',
      { class: 'picker-order' },
      h('b', null, 'Reihenfolge:'),
      order,
      button('✕ Leeren', () => {
        chosen = [];
        refresh();
      }, 'btn small'),
      info,
    ),
    grids,
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Wie oft jeder?'),
      segmented(
        [3, 5, 10].map((n) => ({ value: String(n), label: `${n}×` })),
        String(count),
        (v) => (count = Number(v)),
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, 'Überraschungs-Buchstaben'),
      segmented(
        [
          { value: 'an', label: 'An' },
          { value: 'aus', label: 'Aus' },
        ],
        surprise ? 'an' : 'aus',
        (v) => (surprise = v === 'an'),
      ),
    ),
    h('p', { class: 'help' }, 'Ab und zu schwebt eine Blase mit einem anderen Buchstaben durchs Bild. Wer ihn schreibt, lässt die Blase platzen – und ein neues Wesen kommt heraus.'),
    h('div', { class: 'actions' }, done),
  );
  refresh();
  const m = modal(content, onDone);
}

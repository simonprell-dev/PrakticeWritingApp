import type { Settings } from '../app/settings.ts';
import { t } from '../i18n/i18n.ts';
import { scriptOf } from '../recog/scripts.ts';
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
  const done = button(t('Fertig'), () => finish(), 'btn primary');

  const refresh = () => {
    for (const k of keys) {
      const i = chosen.indexOf(k.textContent ?? '');
      k.classList.toggle('on', i >= 0);
      if (i >= 0 && chosen.length > 1) k.dataset.n = String(i + 1);
      else delete k.dataset.n;
    }
    order.textContent = chosen.join(' → ');
    info.textContent = chosen.length ? (chosen.length === 1 ? t('Tippe weitere Buchstaben an, um mehrere nacheinander zu üben.') : t('Reihenfolge wie angetippt.')) : t('Bitte mindestens einen Buchstaben antippen.');
    done.disabled = !chosen.length;
  };

  const def = scriptOf(settings.script);
  for (const set of def.practice) {
    const row = h('div', { class: 'picker-set script-glyphs', lang: def.lang, dir: def.dir });
    for (const ch of [...set.chars]) {
      const k = button(ch, () => {
        chosen = chosen.includes(ch) ? chosen.filter((c) => c !== ch) : [...chosen, ch];
        refresh();
      }, 'picker-key');
      keys.push(k);
      row.append(k);
    }
    grids.append(h('h3', null, t(set.label)), row);
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
    h('h2', null, t('Was wollen wir üben?')),
    h(
      'div',
      { class: 'picker-order' },
      h('b', null, t('Reihenfolge:')),
      order,
      button(`✕ ${t('Leeren')}`, () => {
        chosen = [];
        refresh();
      }, 'btn small'),
      info,
    ),
    grids,
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Wie oft jeder?')),
      segmented(
        [3, 5, 10].map((n) => ({ value: String(n), label: t('{n}×', { n }) })),
        String(count),
        (v) => (count = Number(v)),
      ),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Überraschungs-Buchstaben')),
      segmented(
        [
          { value: 'an', label: t('An') },
          { value: 'aus', label: t('Aus') },
        ],
        surprise ? 'an' : 'aus',
        (v) => (surprise = v === 'an'),
      ),
    ),
    h('p', { class: 'help' }, t('Ab und zu schwebt eine Blase mit einem anderen Buchstaben durchs Bild. Wer ihn schreibt, lässt die Blase platzen – und ein neues Wesen kommt heraus.')),
    h('div', { class: 'actions' }, done),
  );
  refresh();
  const m = modal(content, onDone);
}

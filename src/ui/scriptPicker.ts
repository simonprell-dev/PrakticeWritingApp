// "Schriften der Welt": the world map tile on the start screen and the big map to choose a script.
import { t } from '../i18n/i18n.ts';
import { SCRIPT_IDS, scriptOf, type ScriptId } from '../recog/scripts.ts';
import { button, h, modal } from './dom.ts';
import { renderWorldMap, scriptsOfRegion } from './worldMap.ts';
import type { MapRegion } from './worldMapData.ts';

/** labels of the map pins: the script names */
function pinLabels(): Record<string, string> {
  const labels: Record<string, string> = { worldMap: t('Weltkarte der Schriften') };
  for (const id of SCRIPT_IDS) labels[id] = t(scriptOf(id).name);
  return labels;
}

/** the tile: the map with the chosen script highlighted (not interactive itself: tapping the tile opens the big map) */
export function scriptTile(script: ScriptId, onOpen: () => void): HTMLElement {
  const def = scriptOf(script);
  const map = renderWorldMap({ selected: script, onPick: () => undefined, labels: pinLabels() });
  map.setAttribute('aria-hidden', 'true');
  for (const pin of map.querySelectorAll('.wm-pin')) pin.setAttribute('tabindex', '-1');
  // Europe to Japan, in the 4:3 format of the other tiles
  map.setAttribute('viewBox', '405 5 540 405');
  return button(
    [
      h('div', { class: 'map-frame' }, map),
      h('div', { class: 'label' }, `🌍 ${t('Schriften der Welt')}`),
      h('div', { class: 'hint' }, `${t('Jetzt:')} `, h('span', { class: 'glyph script', lang: def.lang }, def.sample), ` ${t(def.name)}`),
    ],
    onOpen,
    'tile tile-map',
    t('Schrift wählen'),
  );
}

/** the big map and a button for every script; picking one closes it */
export function openScriptPicker(current: ScriptId, onPick: (s: ScriptId) => void): void {
  const pick = (s: ScriptId) => {
    m.close();
    if (s !== current) onPick(s);
  };
  const map = renderWorldMap({
    selected: current,
    labels: pinLabels(),
    onPick: (v) => {
      // a region with several scripts (Latin letters, Japanese) shows its buttons
      if (v === 'latin' || v === 'japan') {
        const first = list.querySelector<HTMLButtonElement>(`[data-script="${scriptsOfRegion(v as MapRegion)[0]}"]`);
        first?.focus();
        first?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        return;
      }
      pick(v as ScriptId);
    },
  });
  const list = h(
    'div',
    { class: 'script-list' },
    ...SCRIPT_IDS.map((id) => {
      const def = scriptOf(id);
      const b = button(
        [h('span', { class: 'script-sample', lang: def.lang, style: `font-family:${def.font}` }, def.sample), h('span', null, t(def.name))],
        () => pick(id),
        `btn script-btn${id === current ? ' on' : ''}`,
        t(def.name),
      );
      b.dataset.script = id;
      return b;
    }),
  );
  const content = h(
    'div',
    { class: 'script-picker' },
    h('h2', null, `🌍 ${t('Welche Schrift wollen wir üben?')}`),
    h('p', { class: 'help' }, t('Tippe auf der Karte oder unten auf eine Schrift. Jede Schrift hat ihre eigene Erkennung. Schreibt die Zeichen mit etwas Abstand zueinander.')),
    h('div', { class: 'map-frame big' }, map),
    list,
    h('div', { class: 'actions' }, button(t('Schließen'), () => m.close(), 'btn primary')),
  );
  const m = modal(content);
}

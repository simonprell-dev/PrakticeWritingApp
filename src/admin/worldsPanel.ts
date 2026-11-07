// Admin section "Welten": per game a switch (by plan / always on / off) and a yearly timeline whose bar is
// dragged: at its ends to change the first or last day, in the middle to move it. Saves the whole plan.
import { h } from '../ui/dom.ts';
import { isActive, normalizePlan, rangeIn, SEASON_INFO, SEASONAL, WORLD_IDS, type FrontId, type WorldEntry, type WorldId, type WorldMode, type WorldPlan } from '../app/worlds.ts';
import { dayOfYear, dragDays, dragEaster, easterYear, YEAR, type DragKind } from './timeline.ts';

const NAMES: Record<Exclude<WorldId, FrontId>, string> = {
  meer: '🐠 Meer',
  weltraum: '👽 Weltraum',
  savanne: '🦒 Savanne',
  zauberland: '🦄 Zauberland',
  duell: '⚔️ Team-Duell',
  riesenburg: '🏰 Riesenburg',
  tuerme: '🏗️ Türme bauen',
  malen: '🎨 Mal-Aquarium',
};
const COLORS: Partial<Record<WorldId, string>> = {
  neujahr: '#f1c232',
  winter: '#8fb8de',
  fruehling: '#93c47d',
  ostern: '#f4a6c6',
  strand: '#f6b26b',
  herbst: '#c27c3a',
  halloween: '#8e5bb5',
  martin: '#e69138',
  weihnachten: '#cc4125',
  advent: '#e06666',
};
const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MODES: [WorldMode, string][] = [
  ['plan', 'nach Zeitplan'],
  ['on', 'immer an'],
  ['off', 'aus'],
];

const nameOf = (id: WorldId) => (SEASONAL.has(id) ? `${SEASON_INFO[id as FrontId].icon} ${SEASON_INFO[id as FrontId].title}` : NAMES[id as Exclude<WorldId, FrontId>]);
const short = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
/** day of the year 0..364 of a date (the 29th of February counts as the 28th) */
const dayOf = (d: Date) => dayOfYear(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);

/** first and last day of an entry on this year's timeline */
function span(e: WorldEntry, now: Date): { from: number; to: number } {
  if (e.easter) {
    const r = rangeIn(e, easterYear(e.easter, now));
    return { from: dayOf(r.from), to: dayOf(r.to) };
  }
  return { from: dayOfYear(e.from!), to: dayOfYear(e.to!) };
}

function describe(e: WorldEntry, now: Date): string {
  if (e.mode === 'on') return 'immer an';
  if (e.mode === 'off') return 'aus';
  const r = rangeIn(e, e.easter ? easterYear(e.easter, now) : now.getFullYear());
  const easter = e.easter ? ` (Ostern ${r.to.getFullYear()}: ${e.easter.before} Tage vorher bis ${e.easter.after} danach)` : '';
  return `${short(r.from)} – ${short(r.to)}${easter}${isActive(e, now) ? ' · jetzt aktiv' : ''}`;
}

export interface WorldsDeps {
  api<T>(path: string, body?: unknown): Promise<T>;
  fail(e: unknown): void;
}

export function worldsPanel(d: WorldsDeps): HTMLElement {
  const box = h('div', { class: 'panel worlds' }, h('h2', null, 'Welten'), h('p', { class: 'muted' }, 'Lade …'));
  let saved: WorldPlan | null = null;
  let draft: WorldPlan | null = null;
  const now = new Date();
  const today = dayOf(now);
  const note = h('span', { class: 'muted' });
  const save = h('button', { type: 'button', class: 'primary' }, 'Speichern') as HTMLButtonElement;
  const reset = h('button', { type: 'button' }, 'Zurücksetzen') as HTMLButtonElement;
  const rows = h('div', { class: 'world-rows' });

  const dirty = () => JSON.stringify(saved) !== JSON.stringify(draft);
  const mark = () => {
    save.disabled = reset.disabled = !dirty();
    if (dirty()) note.textContent = 'Nicht gespeichert';
  };

  function track(id: WorldId, info: HTMLElement): HTMLElement {
    const t = h('div', { class: 'world-track' });
    const paint = () => {
      const e = draft!.worlds[id];
      const { from, to } = span(e, now);
      const pieces = to >= from ? [[from, to]] : [[from, YEAR - 1], [0, to]];
      t.replaceChildren(
        ...pieces.map(([a, b], k) =>
          h(
            'div',
            {
              class: `world-bar${e.mode === 'off' ? ' off' : e.mode === 'on' ? ' always' : ''}`,
              style: `left:${(100 * a) / YEAR}%;width:${(100 * (b - a + 1)) / YEAR}%;background:${COLORS[id] ?? '#9aa3b8'}`,
            },
            k === 0 ? h('div', { class: 'grip start', 'data-kind': 'start' }) : null,
            k === pieces.length - 1 ? h('div', { class: 'grip end', 'data-kind': 'end' }) : null,
          ),
        ),
        h('div', { class: 'world-today', style: `left:${(100 * (today + 0.5)) / YEAR}%` }),
      );
      info.textContent = describe(e, now);
    };
    let drag: { kind: DragKind; x: number; width: number; start: WorldEntry } | null = null;
    t.addEventListener('pointerdown', (ev) => {
      const target = ev.target as HTMLElement;
      if (!target.closest('.world-bar')) return;
      drag = { kind: (target.dataset.kind as DragKind | undefined) ?? 'move', x: ev.clientX, width: t.getBoundingClientRect().width, start: structuredClone(draft!.worlds[id]) };
      t.setPointerCapture(ev.pointerId);
      ev.preventDefault();
    });
    t.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const delta = Math.round(((ev.clientX - drag.x) / drag.width) * YEAR);
      const s = drag.start;
      draft!.worlds[id] = s.easter ? { ...s, easter: dragEaster(s.easter, drag.kind, delta) } : { ...s, ...dragDays({ from: s.from!, to: s.to! }, drag.kind, delta) };
      paint();
      mark();
    });
    const end = () => (drag = null);
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
    (t as HTMLElement & { paint?: () => void }).paint = paint;
    paint();
    return t;
  }

  function row(id: WorldId): HTMLElement {
    const info = h('span', { class: 'world-when' });
    const tr = track(id, info);
    const sel = h('select', null, ...MODES.map(([v, label]) => h('option', { value: v, selected: draft!.worlds[id].mode === v }, label))) as HTMLSelectElement;
    sel.addEventListener('change', () => {
      draft!.worlds[id] = { ...draft!.worlds[id], mode: sel.value as WorldMode };
      (tr as HTMLElement & { paint?: () => void }).paint?.();
      mark();
    });
    return h('div', { class: 'world-row' }, h('div', { class: 'world-name' }, nameOf(id), info), sel, tr);
  }

  const months = () => h('div', { class: 'world-row world-months' }, h('div'), h('div'), h('div', { class: 'world-month-row' }, ...MONTHS.map((m) => h('span', null, m))));

  function render(): void {
    rows.replaceChildren(
      h('h3', null, 'Immer da'),
      months(),
      ...WORLD_IDS.filter((id) => !SEASONAL.has(id)).map(row),
      h('h3', null, 'Jahreszeiten und Feste · jedes Jahr wieder'),
      months(),
      ...WORLD_IDS.filter((id) => SEASONAL.has(id)).map(row),
    );
    mark();
  }

  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await d.api('/api/admin/worlds', draft);
      saved = structuredClone(draft);
      note.textContent = 'Gespeichert. Gilt für alle Geräte ab dem nächsten Laden der App.';
      mark();
    } catch (e) {
      note.textContent = (e as Error).message;
      save.disabled = false;
      d.fail(e);
    }
  });
  reset.addEventListener('click', () => {
    draft = structuredClone(saved);
    note.textContent = '';
    render();
  });

  // through the admin route: a database that is not ready answers 503 instead of a plan that looks saved
  void d
    .api<{ plan: unknown }>('/api/admin/worlds')
    .then(({ plan }) => {
      saved = normalizePlan(plan);
      draft = structuredClone(saved);
      box.replaceChildren(
        h('h2', null, 'Welten'),
        h('p', { class: 'muted' }, 'Wann welches Spiel auf dem Startbildschirm steht. Balken an den Enden ziehen ändert Anfang oder Ende, in der Mitte ziehen verschiebt. Die rote Linie ist heute.'),
        rows,
        h('div', { class: 'world-actions' }, save, reset, note),
      );
      render();
    })
    .catch(d.fail);
  return box;
}

// Admin section "Schriftproben": the handwriting samples classes gave after a lesson (server/samples.js) – how
// many, how sure their labels are, the latest lessons with their letters, the download package for the
// training (tools/train/import_samples.py) and clearing up. Talks to /api/admin/samples*.
import { clear, h } from '../ui/dom.ts';
import { gameName } from './worldsPanel.ts';

type Source = 'wort' | 'uebung' | 'erkannt';
interface Lesson {
  batch: string;
  created_at: string;
  n: number;
  mode: string | null;
  script: string;
  lang: string | null;
  exported: boolean;
  labels: string;
  ids: string[];
  sources: Source[];
}
export interface SampleStats {
  total: number;
  fresh: number;
  batches: number;
  bytes: number;
  bySource: { source: Source; n: number }[];
  byScript: { script: string; n: number }[];
  latest: Lesson[];
}

export interface SamplesDeps {
  api<T>(path: string, body?: unknown): Promise<T>;
  fail(e: unknown): void;
}

const SOURCE: Record<Source, string> = { wort: '✅ sicher (Wort richtig)', uebung: '🔵 ziemlich sicher (Übung)', erkannt: '⚪ nur erkannt (prüfen)' };
const fmt = new Intl.NumberFormat('de-DE');

export function samplesPanel(d: SamplesDeps): HTMLElement {
  const box = h('div', { class: 'panel samples' }, h('h2', null, 'Schriftproben'), h('p', { class: 'muted' }, 'Lade …'));
  const del = async (what: unknown, question: string) => {
    if (!confirm(question)) return;
    await d.api('/api/admin/samples/delete', what).catch(d.fail);
    load();
  };
  // the download runs in the browser; the counts change once the server has marked the package
  const download = (which: 'neu' | 'alle', label: string, n: number) =>
    h('a', { class: `button-link${which === 'neu' ? ' primary' : ''}`, href: `/api/admin/samples/export?which=${which}`, download: '', onclick: () => setTimeout(load, 4000) }, `${label} (${fmt.format(n)})`);

  function render(s: SampleStats): void {
    clear(box);
    const count = (src: Source) => s.bySource.find((x) => x.source === src)?.n ?? 0;
    box.append(
      h('div', { class: 'ratings-head' }, h('h2', null, 'Schriftproben (Training der Erkennung)'), h('button', { type: 'button', onclick: load }, '↻')),
      h(
        'p',
        { class: 'muted' },
        'Ausgeschnittene Buchstaben, die Klassen nach einer Stunde freiwillig hochladen (keine Fotos, keine Namen). Paket herunterladen und lokal einlesen: ',
        h('code', null, 'python tools/train/import_samples.py <paket.zip>'),
        ' – danach in ',
        h('code', null, 'tools/train/data/krakel/'),
        ' prüfen (uebersicht.html) und trainieren. Heruntergeladene Proben lassen sich hier löschen; nach 12 Monaten löscht der Server sie selbst.',
      ),
      h(
        'div',
        { class: 'cards' },
        h('div', { class: 'card' }, h('div', { class: 'label' }, 'Buchstaben'), h('div', { class: 'value' }, fmt.format(s.total)), h('div', { class: 'muted' }, `${fmt.format(s.batches)} Stunden · ${(s.bytes / 1e6).toFixed(1)} MB`)),
        h('div', { class: 'card' }, h('div', { class: 'label' }, 'Neu'), h('div', { class: 'value' }, fmt.format(s.fresh)), h('div', { class: 'muted' }, 'noch nicht heruntergeladen')),
        ...(['wort', 'uebung', 'erkannt'] as Source[]).map((src) => h('div', { class: 'card' }, h('div', { class: 'label' }, SOURCE[src]), h('div', { class: 'value' }, fmt.format(count(src))))),
      ),
      h('p', { class: 'muted' }, s.byScript.length ? `Schriften: ${s.byScript.map((x) => `${x.script} ${fmt.format(x.n)}`).join(' · ')}` : ''),
      h(
        'div',
        { class: 'world-actions' },
        download('neu', '⬇ Neue herunterladen', s.fresh),
        download('alle', '⬇ Alle herunterladen', s.total),
        h('button', { type: 'button', onclick: () => void del({ exported: true }, 'Alle schon heruntergeladenen Schriftproben löschen?') }, '🗑 Heruntergeladene löschen'),
        h('button', { type: 'button', onclick: () => void del({ all: true }, `Wirklich alle ${fmt.format(s.total)} Schriftproben löschen? Das lässt sich nicht rückgängig machen.`) }, '🗑 Alle löschen'),
      ),
    );
    if (!s.latest.length) {
      box.append(h('p', { class: 'muted' }, 'Noch keine Schriftproben.'));
      return;
    }
    box.append(
      h('h3', null, 'Letzte Stunden'),
      ...s.latest.map((l) =>
        h(
          'div',
          { class: `lesson${l.exported ? ' exported' : ''}` },
          h(
            'div',
            { class: 'meta' },
            h('b', null, l.mode ? gameName(l.mode) : '–'),
            h('span', null, new Date(l.created_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })),
            h('span', { class: 'muted' }, `${l.script}${l.lang ? ` · ${l.lang}` : ''} · ${l.n} Buchstaben`),
            l.exported ? h('span', { class: 'kind' }, 'heruntergeladen') : h('span', { class: 'kind idee' }, 'neu'),
            h('button', { type: 'button', class: 'small', title: 'Diese Stunde löschen', onclick: () => void del({ batch: l.batch }, 'Die Schriftproben dieser Stunde löschen?') }, '🗑'),
          ),
          h('div', { class: 'lesson-labels', title: 'in der Reihenfolge des Schreibens' }, l.labels),
          h(
            'div',
            { class: 'lesson-strip' },
            ...l.ids.map((id, i) => h('img', { src: `/api/admin/samples/png/${id}`, alt: [...l.labels][i] ?? '', title: `${[...l.labels][i] ?? ''} · ${l.sources[i]}`, class: l.sources[i], loading: 'lazy' })),
            l.n > l.ids.length ? h('span', { class: 'muted' }, `+${l.n - l.ids.length}`) : null,
          ),
        ),
      ),
    );
  }

  function load(): void {
    d.api<SampleStats>('/api/admin/samples').then(render).catch(d.fail);
  }
  load();
  return box;
}

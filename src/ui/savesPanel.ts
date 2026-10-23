// Saved games: "continue or start new?", saving a game under a name, and the list of all saved games
// (load, download as a file, delete, open a file).
import { MODES, when, type GameMode, type SaveMeta } from '../app/saves.ts';
import { button, clear, h, modal } from './dom.ts';
import { toast } from './toast.ts';

function thumbImg(m: SaveMeta, cls = 'save-thumb'): HTMLElement {
  return m.thumb ? h('img', { src: m.thumb, class: cls, alt: '' }) : h('div', { class: `${cls} empty` }, MODES[m.mode].icon);
}

function title(m: SaveMeta): string {
  return m.auto ? `${MODES[m.mode].icon} ${MODES[m.mode].title}` : `${MODES[m.mode].icon} ${m.name}`;
}

/** the button on the start screen that continues the last game */
export function continueBanner(m: SaveMeta, onClick: () => void): HTMLElement {
  return button(
    [h('span', { class: 'cont-play' }, '▶'), thumbImg(m, 'cont-thumb'), h('span', { class: 'cont-text' }, h('b', null, `Weiterspielen: ${title(m)}`), h('span', null, `${m.summary} · ${when(m.savedAt)}`))],
    onClick,
    'btn continue-banner',
    'Das letzte Spiel weiterspielen',
  );
}

export interface ContinueDeps {
  resume: (id: string) => void;
  fresh: () => void;
  /** keeps the old game as a named save (so a new one can start); returns its new id */
  keep: () => Promise<string>;
}

/** A mode was chosen and there is an unfinished game of it: continue it or start a new one? */
export function openContinue(m: SaveMeta, d: ContinueDeps): void {
  // after "aufheben" the game lives on under its new id
  let id = m.id;
  const keepBtn = button(
    '📌 Altes Spiel unter einem Namen aufheben',
    () => {
      keepBtn.disabled = true;
      void d.keep().then(
        (kept) => {
          id = kept;
          keepBtn.textContent = '✓ Aufgehoben (unter 📂 Spielstände)';
        },
        () => {
          keepBtn.disabled = false;
          toast('Das hat nicht geklappt.', 'warn');
        },
      );
    },
    'btn small',
  );
  const content = h(
    'div',
    { style: 'max-width:min(620px,92vw);text-align:center' },
    h('h2', null, `${MODES[m.mode].icon} ${MODES[m.mode].title}`),
    h('p', { style: 'font-size:1.2rem;margin:.2em 0 .8em' }, 'Möchtet ihr das letzte Spiel weiterspielen oder ein neues beginnen?'),
    h('div', { class: 'save-card' }, thumbImg(m), h('div', null, h('b', null, m.summary), h('div', { class: 'help' }, `gemerkt ${when(m.savedAt)}`))),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button(
        'Neues Spiel',
        () => {
          m2.close();
          d.fresh();
        },
        'btn',
      ),
      button(
        '▶ Weiterspielen',
        () => {
          m2.close();
          d.resume(id);
        },
        'btn primary',
      ),
    ),
    h('p', { class: 'help', style: 'margin-bottom:.3em' }, 'Ein neues Spiel ersetzt das alte, sobald etwas Neues dazukommt.'),
    keepBtn,
  );
  const m2 = modal(content);
}

export interface SaveDialogDeps {
  mode: GameMode;
  defaultName: string;
  save: (name: string) => Promise<void>;
  download: (name: string) => Promise<void>;
}

/** In the game: save it under a name (in this browser) or as a file. */
export function openSaveDialog(d: SaveDialogDeps): void {
  const name = h('input', { type: 'text', value: d.defaultName, maxlength: '60' }) as HTMLInputElement;
  const busy = (b: HTMLButtonElement, on: boolean) => {
    b.disabled = on;
    b.classList.toggle('busy', on);
  };
  const run = (b: HTMLButtonElement, fn: (n: string) => Promise<void>, ok: string) => {
    busy(b, true);
    fn(name.value.trim() || d.defaultName).then(
      () => {
        m.close();
        toast(ok, 'good');
      },
      (e) => {
        busy(b, false);
        toast('Speichern hat nicht geklappt: ' + (e as Error).message, 'warn', 6000);
      },
    );
  };
  const saveBtn: HTMLButtonElement = button('💾 Speichern', () => run(saveBtn, d.save, `Gespeichert: ${name.value.trim() || d.defaultName}`), 'btn primary');
  const fileBtn: HTMLButtonElement = button('⬇️ Als Datei herunterladen', () => run(fileBtn, d.download, 'Die Datei ist im Download-Ordner.'), 'btn');
  const content = h(
    'div',
    { style: 'max-width:min(620px,92vw)' },
    h('h2', null, '💾 Spiel speichern'),
    h('div', { class: 'row' }, h('label', null, 'Name'), name),
    h(
      'p',
      { class: 'help' },
      'Gespeichert wird nur in diesem Browser. Später unter „📂 Spielstände“ auf der Startseite wieder laden. Als Datei lässt sich das Spiel auch auf einen anderen Computer mitnehmen. Das letzte Spiel jeder Spielart merkt sich die App außerdem von selbst.',
    ),
    h('div', { class: 'actions' }, button('Abbrechen', () => m.close(), 'btn'), fileBtn, saveBtn),
  );
  const m = modal(content);
  setTimeout(() => name.select(), 50);
}

export interface SavesListDeps {
  list: () => Promise<SaveMeta[]>;
  load: (id: string) => void;
  download: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** reads a file and loads it */
  open: (f: File) => Promise<void>;
}

/** All saved games: load, download, delete; or open a file. */
export function openSavesList(d: SavesListDeps): void {
  const box = h('div', { class: 'save-list' }, h('p', { class: 'help' }, 'Lade …'));
  const render = async () => {
    const all = await d.list().catch(() => [] as SaveMeta[]);
    clear(box);
    if (!all.length) {
      box.append(h('p', { class: 'help' }, 'Noch keine Spielstände. Sobald ihr spielt, merkt sich die App das letzte Spiel jeder Spielart; im Spiel speichert „💾“ es unter einem Namen.'));
      return;
    }
    for (const m of all) {
      box.append(
        h(
          'div',
          { class: 'save-row' },
          thumbImg(m),
          h(
            'div',
            { class: 'save-info' },
            h('b', null, title(m)),
            h('span', null, m.auto ? `${m.summary} · zuletzt gespielt` : `${MODES[m.mode].title} · ${m.summary}`),
            h('span', { class: 'help' }, when(m.savedAt)),
          ),
          h(
            'div',
            { class: 'save-btns' },
            button(
              '▶ Laden',
              () => {
                list.close();
                d.load(m.id);
              },
              'btn small primary',
            ),
            button('⬇️', () => void d.download(m.id).catch((e) => toast((e as Error).message, 'warn')), 'btn small icon', 'Als Datei herunterladen'),
            button(
              '🗑',
              () => {
                if (!confirm(`„${m.auto ? MODES[m.mode].title + ' (zuletzt gespielt)' : m.name}“ löschen?`)) return;
                void d.remove(m.id).then(render);
              },
              'btn small icon',
              'Löschen',
            ),
          ),
        ),
      );
    }
  };
  const input = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' }) as HTMLInputElement;
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    d.open(f).then(
      () => list.close(),
      (e) => toast((e as Error).message, 'warn', 6000),
    );
  });
  const content = h(
    'div',
    { style: 'width:min(820px,92vw)' },
    h('h2', null, '📂 Spielstände'),
    box,
    input,
    h('p', { class: 'help' }, 'Die Spielstände liegen nur in diesem Browser. Sie enthalten die ausgeschnittenen Buchstaben und ausgemalten Fische, aber keine Kamerafotos.'),
    h('div', { class: 'actions' }, button('📁 Datei öffnen …', () => input.click(), 'btn'), button('Schließen', () => list.close(), 'btn primary')),
  );
  const list = modal(content);
  void render();
}

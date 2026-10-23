// Saved games. The last game of every mode is kept automatically (to continue it later), and games can be
// saved under a name, deleted, downloaded as a file and loaded from a file. Everything stays in this
// browser (IndexedDB) unless a file is downloaded.

export type GameMode = 'meer' | 'weltraum' | 'savanne' | 'malen' | 'duell' | 'riesenburg' | 'tuerme';

export const MODES: Record<GameMode, { icon: string; title: string }> = {
  meer: { icon: '🐠', title: 'Meer' },
  weltraum: { icon: '👽', title: 'Weltraum' },
  savanne: { icon: '🦒', title: 'Savanne' },
  malen: { icon: '🎨', title: 'Mal-Aquarium' },
  duell: { icon: '⚔️', title: 'Team-Duell' },
  riesenburg: { icon: '🏰', title: 'Riesenburg' },
  tuerme: { icon: '🏗️', title: 'Türme bauen' },
};

export const FORMAT = 'krakel-und-krone-spielstand';

export interface SaveMeta {
  id: string;
  name: string;
  mode: GameMode;
  savedAt: number;
  /** kept automatically: the last game of its mode */
  auto: boolean;
  /** e.g. "12 Fische" */
  summary: string;
  /** small picture of the game (JPEG data URL) */
  thumb?: string;
}

export interface SaveGame extends SaveMeta {
  format: typeof FORMAT;
  version: 1;
  /** settings the game was played with (practice letters, teams …) */
  config: Record<string, unknown>;
  /** glyphs the recognition already knows, so children can go on writing on the same sheet */
  memory?: unknown;
  /** the game itself */
  state: unknown;
}

export const autoId = (mode: GameMode) => `auto-${mode}`;

export function newSaveId(): string {
  return `save-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

// ---------------------------------------------------------------- storage

let opening: Promise<IDBDatabase | null> | null = null;
/** without IndexedDB (very old browsers, some private windows) saves last for this session only */
const fallback = new Map<string, SaveGame>();

function db(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    try {
      const r = indexedDB.open('krakel-und-krone', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('meta', { keyPath: 'id' });
        r.result.createObjectStore('games', { keyPath: 'id' });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

function result<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('Speicherfehler'));
  });
}

function finished(t: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = t.onabort = () => reject(t.error ?? new Error('Speicherfehler'));
  });
}

function metaOf(g: SaveGame): SaveMeta {
  return { id: g.id, name: g.name, mode: g.mode, savedAt: g.savedAt, auto: g.auto, summary: g.summary, thumb: g.thumb };
}

/** all saved games, newest first (without the games themselves) */
export async function listSaves(): Promise<SaveMeta[]> {
  const d = await db();
  const all = d ? await result(d.transaction('meta').objectStore('meta').getAll() as IDBRequest<SaveMeta[]>) : [...fallback.values()].map(metaOf);
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function getMeta(id: string): Promise<SaveMeta | null> {
  const d = await db();
  if (!d) return fallback.has(id) ? metaOf(fallback.get(id)!) : null;
  return ((await result(d.transaction('meta').objectStore('meta').get(id))) as SaveMeta | undefined) ?? null;
}

export async function loadSave(id: string): Promise<SaveGame | null> {
  const d = await db();
  if (!d) return fallback.get(id) ?? null;
  return ((await result(d.transaction('games').objectStore('games').get(id))) as SaveGame | undefined) ?? null;
}

export async function putSave(g: SaveGame): Promise<void> {
  const d = await db();
  if (!d) {
    fallback.set(g.id, g);
    return;
  }
  const t = d.transaction(['meta', 'games'], 'readwrite');
  t.objectStore('meta').put(metaOf(g));
  t.objectStore('games').put(g);
  await finished(t);
}

export async function deleteSave(id: string): Promise<void> {
  const d = await db();
  if (!d) {
    fallback.delete(id);
    return;
  }
  const t = d.transaction(['meta', 'games'], 'readwrite');
  t.objectStore('meta').delete(id);
  t.objectStore('games').delete(id);
  await finished(t);
}

export async function clearSaves(): Promise<void> {
  const d = await db();
  fallback.clear();
  if (!d) return;
  const t = d.transaction(['meta', 'games'], 'readwrite');
  t.objectStore('meta').clear();
  t.objectStore('games').clear();
  await finished(t);
}

// ---------------------------------------------------------------- files

function fileName(g: SaveGame): string {
  const slug = g.name
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c]!)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `krakel-und-krone-${slug || 'spiel'}.json`;
}

/** downloads the game as a file (to keep it, or to take it to another computer) */
export function downloadSave(g: SaveGame): void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(g)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName(g);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** reads a downloaded game; it becomes a saved game of its own */
export async function readSaveFile(f: File): Promise<SaveGame> {
  let g: Partial<SaveGame>;
  try {
    g = JSON.parse(await f.text());
  } catch {
    g = {};
  }
  if (g.format !== FORMAT || !g.mode || !(g.mode in MODES) || g.state === undefined) throw new Error('Das ist keine Spielstand-Datei von Krakel & Krone.');
  if (g.version !== 1) throw new Error('Dieser Spielstand ist von einer neueren Version. Bitte die Seite neu laden.');
  return { ...(g as SaveGame), id: newSaveId(), auto: false, name: String(g.name || MODES[g.mode].title).slice(0, 60) };
}

// ---------------------------------------------------------------- words

const pad = (n: number) => String(n).padStart(2, '0');

/** "heute, 10:42", "gestern, 9:05" or "23.10.2026, 10:42" */
export function when(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date(now)) - day(d)) / 86400000);
  const time = `${d.getHours()}:${pad(d.getMinutes())}`;
  if (diff === 0) return `heute, ${time}`;
  if (diff === 1) return `gestern, ${time}`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}, ${time}`;
}

/** default name of a game saved now, e.g. "Meer – 23.10., 10:42" */
export function defaultName(mode: GameMode, now = new Date()): string {
  return `${MODES[mode].title} – ${pad(now.getDate())}.${pad(now.getMonth() + 1)}., ${now.getHours()}:${pad(now.getMinutes())}`;
}

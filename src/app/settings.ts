// App settings, persisted in localStorage (only on this device, nothing personal).
import type { Quad } from '../camera/perspective.ts';
import { detectLocale } from '../i18n/detect.ts';
import { t, tk } from '../i18n/i18n.ts';
import type { FrontId } from './worlds.ts';
import { isScriptId, scriptOf, type ScriptId } from '../recog/scripts.ts';
import type { PenPreset, PlayerId, Rotation, Strictness } from '../vision/types.ts';
import { TASK_KINDS, type TaskKind } from '../game/math/tasks.ts';

export type HabitatId = 'meer' | 'weltraum' | 'savanne' | 'zauberland' | 'woerterzoo' | 'rechenmeer' | FrontId;

/**
 * fest: a document camera or webcam looks at the paper all the time (projector in class);
 * hand: a phone or tablet is held over the paper for every photo (the game runs on the device);
 * spiegel: a tablet stands, a mirror on its front camera looks at the paper in front of it, at a slant
 */
export type CameraMode = 'fest' | 'hand' | 'spiegel';

/**
 * Phones and tablets (iPads report themselves as Macs with touch). Digital classroom boards often run
 * Android too, but have a big screen and a document camera on them: they keep the fixed camera.
 */
export function isHandheld(): boolean {
  if (typeof navigator === 'undefined' || typeof screen === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return /Android|Mobile/i.test(ua) && Math.min(screen.width, screen.height) <= 1050;
}

export interface TeamSettings {
  id: PlayerId;
  name: string;
  /** preset key in PEN_PRESETS or SLIP_PRESETS */
  pen: string;
  slip: string;
  /** calibrated values override the presets */
  penCalib?: [number, number, number];
  slipCalib?: [number, number, number];
}

export interface Settings {
  version: 1;
  /** the script being practised (each has its own model); chosen on the world map */
  script: ScriptId;
  /** language of the page ('' = not chosen yet: the browser language decides) */
  lang: string;
  camera: {
    mode: CameraMode;
    deviceId?: string;
    label?: string;
    rotation: Rotation;
    mirror: boolean;
    /** normalised region of interest 0..1 */
    roi?: { x: number; y: number; w: number; h: number };
    /** mirror: the corners of the sheet, normalised 0..1 (top left, top right, bottom right, bottom left) */
    quad?: Quad;
  };
  recog: {
    pen: PenPreset;
    /** German school lines: Lineatur 1/2 (four lines), 3 (two lines), plain ruled or blank paper */
    lineatur: 'auto' | 'L1' | 'L2' | 'L3' | 'liniert' | 'blanko';
    strictness: Strictness;
    style: 'beide' | 'druck' | 'grund';
    autoScan: boolean;
    /** seconds of stillness before an automatic scan */
    autoDelay: number;
    /** mirror writing does not count as a letter */
    noMirror: boolean;
  };
  game: {
    maxCreatures: number;
    sound: boolean;
    volume: number;
    habitat: HabitatId;
    /** keep the last game of every mode (to continue it later); null = not asked yet */
    autosave: boolean | null;
    /** trade fair: the Mal-Aquarium shows a QR code and the web address, so visitors can find the game */
    fair: boolean;
  };
  practice: {
    mode: 'frei' | 'ueben';
    /** letters to practise, one after the other */
    targets: string[];
    /** how often each letter */
    count: number;
    /** now and then a surprise letter floats in the scene; writing it frees a creature */
    surprise: boolean;
  };
  duel: {
    by: 'pen' | 'slip';
    teams: [TeamSettings, TeamSettings];
    castle: 'klein' | 'mittel' | 'gross';
    /** minutes, 0 = no limit */
    timeLimit: number;
  };
  siege: {
    className: string;
    size: 'klein' | 'mittel' | 'gross';
    /** minutes, 0 = no limit */
    timeLimit: number;
  };
  tower: {
    by: 'pen' | 'slip';
    /** number of towers (2–8); the first ones of players[] take part */
    count: number;
    players: TeamSettings[];
    /** height of the finish line */
    goal: 'klein' | 'mittel' | 'gross' | 'hoch' | 'mond';
    /** minutes, 0 = no limit */
    timeLimit: number;
  };
  /** Rechenmeer: the kinds of tasks that are asked (at least one) */
  math: { kinds: TaskKind[] };
  /** Wörter-Zoo: how much help (1 copy, 2 remember, 3 picture only) and the letters the class knows */
  woerter: { help: WordHelp; known: string };
  firstRunDone: boolean;
}

/** Wörter-Zoo help: 1 the word stands there, 2 it is covered after 5 s, 3 only the picture */
export type WordHelp = 1 | 2 | 3;

/** every letter a word of the Wörter-Zoo may have (lower case) */
export const WORD_LETTERS = 'abcdefghijklmnopqrstuvwxyzäöüß';

export const DEFAULTS: Settings = {
  version: 1,
  script: 'druck',
  lang: '',
  camera: { mode: 'fest', rotation: 0, mirror: false },
  recog: { pen: 'auto', lineatur: 'auto', strictness: 'mittel', style: 'beide', autoScan: false, autoDelay: 1.5, noMirror: false },
  game: { maxCreatures: 30, sound: true, volume: 0.7, habitat: 'meer', autosave: null, fair: false },
  practice: { mode: 'frei', targets: ['A'], count: 5, surprise: true },
  duel: {
    by: 'pen',
    teams: [
      { id: 'A', name: tk('Rote Raketen'), pen: 'rot', slip: 'rosa' },
      { id: 'B', name: tk('Blaue Blitze'), pen: 'blau', slip: 'hellblau' },
    ],
    castle: 'mittel',
    timeLimit: 0,
  },
  siege: { className: tk('Unsere Klasse'), size: 'mittel', timeLimit: 0 },
  tower: {
    by: 'pen',
    count: 2,
    players: [
      { id: 'A', name: tk('Rote Raketen'), pen: 'rot', slip: 'rosa' },
      { id: 'B', name: tk('Blaue Blitze'), pen: 'blau', slip: 'hellblau' },
      { id: 'C', name: tk('Grüne Geckos'), pen: 'gruen', slip: 'gruen' },
      { id: 'D', name: tk('Lila Lamas'), pen: 'lila', slip: 'gelb' },
      { id: 'E', name: tk('Orange Otter'), pen: 'orange', slip: 'orange' },
      { id: 'F', name: tk('Pinke Pinguine'), pen: 'pink', slip: 'lila' },
      { id: 'G', name: tk('Türkise Tiger'), pen: 'tuerkis', slip: 'blau' },
      { id: 'H', name: tk('Braune Bären'), pen: 'braun', slip: 'rot' },
    ],
    goal: 'mittel',
    timeLimit: 0,
  },
  math: { kinds: ['plus20', 'minus20'] },
  woerter: { help: 1, known: WORD_LETTERS },
  firstRunDone: false,
};

// key kept from the working title "Buchstaben-Zoo", so existing settings stay
const KEY = 'buchstaben-zoo.settings';

function merge<T>(base: T, over: unknown): T {
  if (!over || typeof over !== 'object' || Array.isArray(base)) return (over as T) ?? base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over as Record<string, unknown>)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? merge(b, v) : v;
  }
  return out as T;
}

/** the first character of a script (the practice target after switching) */
export function firstChar(script: ScriptId): string {
  return scriptOf(script).practice[0].chars[0];
}

/** the defaults with the team and class names in the page language (they can be renamed) */
function localDefaults(): Settings {
  const s = structuredClone(DEFAULTS);
  for (const team of [...s.duel.teams, ...s.tower.players]) team.name = t(team.name);
  s.siege.className = t(s.siege.className);
  return s;
}

/** the defaults for this device (phones and tablets hold the camera in the hand) */
function freshSettings(): Settings {
  const s = localDefaults();
  s.camera.mode = isHandheld() ? 'hand' : 'fest';
  // first visit: language and script from the browser (language list and time zone; no location query)
  const loc = detectLocale();
  s.lang = loc.lang;
  s.script = loc.script;
  s.practice.targets = [firstChar(loc.script)];
  return s;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSettings();
    const parsed = JSON.parse(raw);
    const s = merge(localDefaults(), parsed);
    // older versions only knew fixed cameras; on a phone or tablet the camera is held in the hand
    if (!parsed.camera?.mode) s.camera.mode = isHandheld() ? 'hand' : 'fest';
    if (!Array.isArray(s.duel.teams) || s.duel.teams.length !== 2) s.duel.teams = localDefaults().duel.teams;
    if (!Array.isArray(s.tower.players) || !s.tower.players.length) s.tower.players = localDefaults().tower.players;
    // older versions had four towers: keep those teams, add the new ones
    s.tower.players = localDefaults().tower.players.map((d, i) => ({ ...d, ...s.tower.players[i], id: d.id }));
    s.tower.count = Math.min(8, Math.max(2, Math.round(Number(s.tower.count)) || 2));
    // older versions only knew "ruled: on/off"
    const oldRuled = (parsed.recog as { ruled?: unknown } | undefined)?.ruled;
    if (!parsed.recog?.lineatur && oldRuled === 'off') s.recog.lineatur = 'blanko';
    delete (s.recog as { ruled?: unknown }).ruled;
    // older versions practised a single letter
    const oldTarget = (parsed.practice as { target?: unknown } | undefined)?.target;
    if (!Array.isArray(parsed.practice?.targets)) s.practice.targets = typeof oldTarget === 'string' ? [oldTarget] : [...DEFAULTS.practice.targets];
    if (!s.practice.targets.length) s.practice.targets = [...DEFAULTS.practice.targets];
    delete (s.practice as { target?: unknown }).target;
    // older versions only knew the Latin letters: they keep the Druckschrift
    if (!isScriptId(s.script)) s.script = 'druck';
    if (typeof s.lang !== 'string') s.lang = '';
    // Rechenmeer: only known task kinds, each once, at least one
    const kinds = Array.isArray(s.math?.kinds) ? [...new Set(s.math.kinds.filter((k) => (TASK_KINDS as readonly string[]).includes(k)))] : [];
    s.math = { kinds: kinds.length ? kinds : [...DEFAULTS.math.kinds] };
    s.woerter = cleanWoerter(s.woerter);
    return s;
  } catch {
    return freshSettings();
  }
}

/**
 * Wörter-Zoo settings from storage or a saved game: a known help level, only letters a word may have, each
 * once, in the order of WORD_LETTERS; none known at all means all (the lobby keeps at least one word possible)
 */
export function cleanWoerter(raw: unknown): Settings['woerter'] {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const help: WordHelp = r.help === 2 || r.help === 3 ? r.help : 1;
  const given = typeof r.known === 'string' ? r.known.toLowerCase() : WORD_LETTERS;
  const known = [...WORD_LETTERS].filter((c) => given.includes(c)).join('');
  return { help, known: known || WORD_LETTERS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: settings live for this session only */
  }
}

export function resetSettings(): Settings {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  return freshSettings();
}

// App settings, persisted in localStorage (only on this device, nothing personal).
import type { PenPreset, PlayerId, Rotation, Strictness } from '../vision/types.ts';

export type HabitatId = 'meer' | 'weltraum' | 'savanne';

/**
 * fest: a document camera or webcam looks at the paper all the time (projector in class);
 * hand: a phone or tablet is held over the paper for every photo (the game runs on the device)
 */
export type CameraMode = 'fest' | 'hand';

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
  camera: {
    mode: CameraMode;
    deviceId?: string;
    label?: string;
    rotation: Rotation;
    mirror: boolean;
    /** normalised region of interest 0..1 */
    roi?: { x: number; y: number; w: number; h: number };
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
    goal: 'klein' | 'mittel' | 'gross';
    /** minutes, 0 = no limit */
    timeLimit: number;
  };
  firstRunDone: boolean;
}

export const DEFAULTS: Settings = {
  version: 1,
  camera: { mode: 'fest', rotation: 0, mirror: false },
  recog: { pen: 'auto', lineatur: 'auto', strictness: 'mittel', style: 'beide', autoScan: false, autoDelay: 1.5, noMirror: false },
  game: { maxCreatures: 30, sound: true, volume: 0.7, habitat: 'meer', autosave: null },
  practice: { mode: 'frei', targets: ['A'], count: 5, surprise: true },
  duel: {
    by: 'pen',
    teams: [
      { id: 'A', name: 'Rote Raketen', pen: 'rot', slip: 'rosa' },
      { id: 'B', name: 'Blaue Blitze', pen: 'blau', slip: 'hellblau' },
    ],
    castle: 'mittel',
    timeLimit: 0,
  },
  siege: { className: 'Unsere Klasse', size: 'mittel', timeLimit: 0 },
  tower: {
    by: 'pen',
    count: 2,
    players: [
      { id: 'A', name: 'Rote Raketen', pen: 'rot', slip: 'rosa' },
      { id: 'B', name: 'Blaue Blitze', pen: 'blau', slip: 'hellblau' },
      { id: 'C', name: 'Grüne Geckos', pen: 'gruen', slip: 'gruen' },
      { id: 'D', name: 'Lila Lamas', pen: 'lila', slip: 'gelb' },
      { id: 'E', name: 'Orange Otter', pen: 'orange', slip: 'orange' },
      { id: 'F', name: 'Pinke Pinguine', pen: 'pink', slip: 'lila' },
      { id: 'G', name: 'Türkise Tiger', pen: 'tuerkis', slip: 'blau' },
      { id: 'H', name: 'Braune Bären', pen: 'braun', slip: 'rot' },
    ],
    goal: 'mittel',
    timeLimit: 0,
  },
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

/** the defaults for this device (phones and tablets hold the camera in the hand) */
function freshSettings(): Settings {
  const s = structuredClone(DEFAULTS);
  s.camera.mode = isHandheld() ? 'hand' : 'fest';
  return s;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSettings();
    const parsed = JSON.parse(raw);
    const s = merge(structuredClone(DEFAULTS), parsed);
    // older versions only knew fixed cameras; on a phone or tablet the camera is held in the hand
    if (!parsed.camera?.mode) s.camera.mode = isHandheld() ? 'hand' : 'fest';
    if (!Array.isArray(s.duel.teams) || s.duel.teams.length !== 2) s.duel.teams = structuredClone(DEFAULTS.duel.teams);
    if (!Array.isArray(s.tower.players) || !s.tower.players.length) s.tower.players = structuredClone(DEFAULTS.tower.players);
    // older versions had four towers: keep those teams, add the new ones
    s.tower.players = DEFAULTS.tower.players.map((d, i) => ({ ...structuredClone(d), ...s.tower.players[i], id: d.id }));
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
    return s;
  } catch {
    return freshSettings();
  }
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

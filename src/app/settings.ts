// App settings, persisted in localStorage (only on this device, nothing personal).
import type { PenPreset, Rotation, Strictness, TeamId } from '../vision/types.ts';

export type HabitatId = 'meer' | 'weltraum' | 'savanne';

export interface TeamSettings {
  id: TeamId;
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
    deviceId?: string;
    label?: string;
    rotation: Rotation;
    mirror: boolean;
    /** normalised region of interest 0..1 */
    roi?: { x: number; y: number; w: number; h: number };
  };
  recog: {
    pen: PenPreset;
    ruled: 'auto' | 'on' | 'off';
    strictness: Strictness;
    style: 'beide' | 'druck' | 'grund';
    autoScan: boolean;
    /** seconds of stillness before an automatic scan */
    autoDelay: number;
  };
  game: {
    maxCreatures: number;
    sound: boolean;
    volume: number;
    habitat: HabitatId;
  };
  practice: {
    mode: 'frei' | 'ueben';
    target: string;
    count: number;
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
  firstRunDone: boolean;
}

export const DEFAULTS: Settings = {
  version: 1,
  camera: { rotation: 0, mirror: false },
  recog: { pen: 'auto', ruled: 'auto', strictness: 'mittel', style: 'beide', autoScan: false, autoDelay: 1.5 },
  game: { maxCreatures: 30, sound: true, volume: 0.7, habitat: 'meer' },
  practice: { mode: 'frei', target: 'A', count: 5 },
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

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw);
    const s = merge(structuredClone(DEFAULTS), parsed);
    if (!Array.isArray(s.duel.teams) || s.duel.teams.length !== 2) s.duel.teams = structuredClone(DEFAULTS.duel.teams);
    return s;
  } catch {
    return structuredClone(DEFAULTS);
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
  return structuredClone(DEFAULTS);
}

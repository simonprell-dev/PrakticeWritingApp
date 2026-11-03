// Anonymous usage statistics: small events to POST /api/event (no id, no cookie, the server stores no IP).
// Can be switched off in the settings ("Anonyme Nutzungsstatistik senden"). Failures are ignored.
import type { GameMode } from './saves.ts';
import type { Settings } from './settings.ts';

export type EventType = 'visit' | 'game_start' | 'game_end' | 'scan';

export interface EventData {
  mode?: GameMode;
  chars?: number;
  durationS?: number;
}

let current: (() => Settings) | null = null;

/** where to read the opt-out, script and language from (set once by the app; settings can be replaced) */
export function useTelemetrySettings(get: () => Settings): void {
  current = get;
}

/** The writing system of the games. One place to change when settings.script exists. */
export function scriptOf(s: Settings): string {
  const v = (s as { script?: unknown }).script;
  return typeof v === 'string' && v ? v : 'druck';
}

/** The language of the page. One place to change when settings.lang exists. */
export function langOf(s: Settings): string {
  const v = (s as { lang?: unknown }).lang;
  return typeof v === 'string' && v ? v : 'de';
}

export function track(type: EventType, data: EventData = {}): void {
  const s = current?.();
  if (!s || s.game.telemetry === false) return;
  // end-to-end test runs (?e2e) stay out of the numbers
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('e2e')) return;
  const body = JSON.stringify({ type, script: scriptOf(s), lang: langOf(s), ...data });
  try {
    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/event', blob)) return;
    void fetch('/api/event', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true, credentials: 'omit' }).catch(() => undefined);
  } catch {
    /* statistics never get in the way of the game */
  }
}

/** One game from start to end: counts the written characters and sends start and end once each. */
export class GameTally {
  private mode: GameMode | null = null;
  private started = 0;
  private chars = 0;
  private ended = true;
  /** the thank-you with the donate button was shown in this game */
  thanked = false;

  start(mode: GameMode): void {
    this.mode = mode;
    this.started = performance.now();
    this.chars = 0;
    this.ended = false;
    this.thanked = false;
    track('game_start', { mode });
  }

  /** one scan: how many characters (or painted cards) were recognised */
  scan(chars: number): void {
    if (!this.mode || this.ended) return;
    this.chars += chars;
    track('scan', { mode: this.mode, chars: Math.max(0, Math.min(5000, Math.round(chars))) });
  }

  end(): void {
    if (!this.mode || this.ended) return;
    this.ended = true;
    track('game_end', { mode: this.mode, durationS: Math.round((performance.now() - this.started) / 1000), chars: Math.min(5000, this.chars) });
  }
}

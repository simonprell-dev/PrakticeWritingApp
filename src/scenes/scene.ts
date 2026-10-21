import type { Settings } from '../app/settings.ts';
import type { AnyCanvas } from '../game/canvas.ts';
import type { ScanResult, ScannedGlyph } from '../vision/types.ts';

/** The scanned camera frame, used for the polaroid animation. Glyph boxes are in detection coordinates. */
export interface Snapshot {
  canvas: AnyCanvas;
  detW: number;
  detH: number;
}

export interface CreatureInfo {
  glyph: ScannedGlyph;
  sticker: AnyCanvas;
  name: string;
}

export interface SceneHost {
  settings: Settings;
  toast(text: string, kind?: 'info' | 'good' | 'warn'): void;
  showCard(info: CreatureInfo): void;
  /** practice progress or creature count changed */
  progress(): void;
  /** duel finished */
  finished?(stats: unknown): void;
}

export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, worldW: number): void;
  /** the photo was just taken (shown while the recognition runs) */
  beginCapture?(snap: Snapshot): void;
  /** the recognition failed */
  cancelCapture?(): void;
  handleScan(res: ScanResult, snap: Snapshot): void;
  /** world coordinates; returns true when something was hit */
  tap(x: number, y: number): boolean;
  resize(worldW: number): void;
  destroy(): void;
  /** a cutscene is running: the app fades out the top HUD */
  cinematic?: boolean;
}

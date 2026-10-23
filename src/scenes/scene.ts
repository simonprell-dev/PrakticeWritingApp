import type { Settings } from '../app/settings.ts';
import type { AnyCanvas } from '../game/canvas.ts';
import type { ScanResult, ScannedGlyph } from '../vision/types.ts';
import type { SceneSave } from './saved.ts';

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
  /** a painted fish was tapped (Mal-Aquarium): show it big; release lets it swim away */
  showPainted?(info: { picture: AnyCanvas; name: AnyCanvas | null; release: () => void }): void;
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
  /** the game to keep (pictures as data URLs), or null while there is nothing worth keeping */
  saveState?(): Promise<SceneSave | null>;
  /** continues a saved game in this freshly made scene (no intro) */
  restoreState?(state: unknown): Promise<void>;
}

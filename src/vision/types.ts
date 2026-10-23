// Shared vision types. Everything in src/vision is DOM-free so it runs in the worker and in Node tests.

/** ImageData-compatible RGBA buffer. */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** Single-channel float image. */
export interface GrayF {
  width: number;
  height: number;
  data: Float32Array;
}

/** Binary mask, values 0 or 1. */
export interface Mask {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Rotation = 0 | 90 | 180 | 270;
/** colour of a player or team (pen or slip): A/B in the duel, up to eight towers in "Türme bauen" */
export type PlayerId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
export const PLAYER_IDS: PlayerId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
/** the two sides of the team duel */
export type TeamId = 'A' | 'B';
export type PenPreset = 'auto' | 'felt' | 'pencil';
export type Strictness = 'leicht' | 'mittel' | 'streng';
export type Tier = 'zerknittert' | 'schief' | 'nett' | 'schoen' | 'prachtvoll';
export type TemplateStyle = 'druck' | 'grund';

/** Team colour calibration: absorption direction for pen mode, chromaticity + brightness for slip mode. */
export interface TeamCalib {
  team: PlayerId;
  /** unit vector of ink absorption per channel (pen mode) */
  absorb: [number, number, number];
  /** normalised slip colour (slip mode): r/(r+g+b), g/(r+g+b) and mean brightness 0..1 */
  slip: [number, number, number];
}

export interface VisionOptions {
  pen: PenPreset;
  ruled: 'auto' | 'on' | 'off';
  /** line system of the paper (German school lines: Lineatur 1/2 = school4, Lineatur 3 = school2) */
  lineatur?: 'auto' | 'school4' | 'school2' | 'plain' | 'none';
  team?: { by: 'pen' | 'slip'; calibs: TeamCalib[] };
  /** practice target character, e.g. "B" */
  target?: string;
  /** practice mode: surprise letters shown in the scene, they may be written instead of the target */
  bonus?: string[];
  strictness: Strictness;
  style: 'beide' | TemplateStyle;
  /** mirror writing does not count as a letter (the glyph comes back with score.rejected) */
  noMirror?: boolean;
  /** duel mode uses stricter duplicate detection (physical slips) */
  dedup: 'sheet' | 'slips';
  debug: boolean;
}

export interface Region {
  id: number;
  box: Box;
  team?: PlayerId;
}

export interface RuledLine {
  /** horizontal: y at x=0 (detection coordinates); vertical: x at y=0 */
  pos: number;
  thickness: number;
  orientation: 'h' | 'v';
}

export type TipId =
  | 'form'
  | 'ruhig'
  | 'gerade'
  | 'bauch'
  | 'punkt'
  | 'groesse'
  | 'linie'
  | 'zone'
  | 'anderes'
  | 'spiegel'
  | 'super';

export interface GlyphScore {
  /** 0..100 */
  score: number;
  tier: Tier;
  /** component scores 0..1: legibility, template similarity, stroke quality, proportions */
  parts: { L: number; T: number; S: number; P: number };
  /** best guess of the written character */
  char: string;
  /** character the score was computed against (target in practice mode) */
  scoredAs: string;
  tip: TipId;
  /** character it looks like instead (practice mode, when it matches another char better) */
  looksLike?: string;
  /** written in mirror writing */
  mirrored?: boolean;
  /** mirror writing while "mirror writing does not count" is on: not a letter, nothing spawns */
  rejected?: boolean;
  top3?: { char: string; p: number }[];
  /** combined score before the strictness curve (0..1), for calibration */
  raw?: number;
}

export interface ScannedGlyph {
  id: number;
  /** detection coordinates (long side 1280) */
  box: Box;
  regionId: number;
  team?: PlayerId;
  /** number of dots/dashes merged on top (i, j, umlauts) */
  dots: number;
  /** transparent ink cut-out (child's own handwriting) for the creature badge */
  crop: RGBAImage;
  score: GlyphScore;
  isNew: boolean;
}

export interface DebugLayers {
  ink: GrayF;
  mask: Mask;
  paper?: Mask;
  lines: RuledLine[];
  cnnInputs: Float32Array[];
}

export interface ScanResult {
  frameW: number;
  frameH: number;
  /** factor detection->frame coordinates */
  scale: number;
  regions: Region[];
  glyphs: ScannedGlyph[];
  shift: { dx: number; dy: number };
  newSheet: boolean;
  duplicates: number;
  /** glyphs that went through the recognition; known ones keep the result of their first scan */
  analyzed: number;
  neutral: number;
  timings: Record<string, number>;
  debug?: DebugLayers;
}

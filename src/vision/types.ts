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
export type TeamId = 'A' | 'B';
export type PenPreset = 'auto' | 'felt' | 'pencil';
export type Strictness = 'leicht' | 'mittel' | 'streng';
export type Tier = 'zerknittert' | 'schief' | 'nett' | 'schoen' | 'prachtvoll';
export type TemplateStyle = 'druck' | 'grund';

/** Team colour calibration: absorption direction for pen mode, chromaticity + brightness for slip mode. */
export interface TeamCalib {
  team: TeamId;
  /** unit vector of ink absorption per channel (pen mode) */
  absorb: [number, number, number];
  /** normalised slip colour (slip mode): r/(r+g+b), g/(r+g+b) and mean brightness 0..1 */
  slip: [number, number, number];
}

export interface VisionOptions {
  pen: PenPreset;
  ruled: 'auto' | 'on' | 'off';
  team?: { by: 'pen' | 'slip'; calibs: TeamCalib[] };
  /** practice target character, e.g. "B" */
  target?: string;
  strictness: Strictness;
  style: 'beide' | TemplateStyle;
  /** duel mode uses stricter duplicate detection (physical slips) */
  dedup: 'sheet' | 'slips';
  debug: boolean;
}

export interface Region {
  id: number;
  box: Box;
  team?: TeamId;
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
  top3?: { char: string; p: number }[];
  /** combined score before the strictness curve (0..1), for calibration */
  raw?: number;
}

export interface ScannedGlyph {
  id: number;
  /** detection coordinates (long side 1280) */
  box: Box;
  regionId: number;
  team?: TeamId;
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
  neutral: number;
  timings: Record<string, number>;
  debug?: DebugLayers;
}

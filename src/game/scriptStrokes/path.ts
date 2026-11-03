// Shared helpers and the format of the stroke tables for the other scripts (src/game/scriptStrokes/*.ts).
//
// A table maps every character to its strokes in writing order, in the path language of strokes.ts:
//   M x y            move (start of the stroke)
//   L x y            straight line
//   C x1 y1 x2 y2 x y  cubic curve
//   O cx cy rx ry a0 a1  elliptic arc from angle a0 to a1 (degrees; decreasing = counter-clockwise)
//   D x y [x y]      a dot, or two dots as one stroke
// Coordinates are in bands. With school lines: top line y = 0, middle line 1, base line 2, bottom line 3,
// x from 0 to the glyph width w. With `box: true` the character sits in a square practice box from
// (0, 0) to (2, 2), like the kana.

export interface ScriptGlyph {
  w: number;
  strokes: string[];
  /** written in the square box instead of on school lines */
  box?: true;
}

export type StrokeTable = Record<string, ScriptGlyph>;

/** an elliptic arc as a stroke command (angles in degrees, decreasing = counter-clockwise) */
export const RING = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number) => `O${cx} ${cy} ${rx} ${ry} ${a0} ${a1}`;

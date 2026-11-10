// Exports the school letter strokes (src/game/strokes.ts, Druckschrift and Grundschrift) for the
// synthetic training glyphs of the druck model (tools/train/strokes_synth.py).
// Usage: npx vite-node tools/export-strokes.ts   -> tools/train/data/strokes.json
//
// Format: { "druck": { "A": { "w": 1.4, "strokes": [ { "dot": false, "pts": [[x, y], …] }, … ] }, … },
//           "grund": { … } }
// Coordinates are school line bands as in strokes.ts: top line y = 0, middle 1, base 2, bottom 3.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writtenGlyph } from '../src/game/strokes.ts';

/** classes of the druck model (tools/train/common.py CHARSET) */
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzß';
const STYLES = ['druck', 'grund'] as const;

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;

const out: Record<string, Record<string, { w: number; strokes: { dot: boolean; pts: number[][] }[] }>> = {};
for (const style of STYLES) {
  out[style] = {};
  const missing: string[] = [];
  for (const ch of CHARSET) {
    const g = writtenGlyph(ch, style);
    if (!g || g.box) {
      missing.push(ch);
      continue;
    }
    out[style][ch] = { w: r4(g.w), strokes: g.strokes.map((s) => ({ dot: s.dot, pts: s.pts.map((p) => [r4(p.x), r4(p.y)]) })) };
  }
  console.log(`${style}: ${Object.keys(out[style]).length}/${CHARSET.length} characters` + (missing.length ? `, missing: ${missing.join(' ')}` : ', none missing'));
}

const dir = fileURLToPath(new URL('./train/data/', import.meta.url));
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}strokes.json`, JSON.stringify(out));
console.log(`wrote ${dir}strokes.json`);

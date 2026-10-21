// Score calibration on synthetic handwriting with defined quality levels (0 = clean ... 4 = very shaky).
// Prints the raw score distribution per level (to tune the strictness curves in src/recog/score.ts) and
// with --write stores per-character template similarity medians in public/model/calib-v1.json.
// Usage: node tools/calibrate.ts [--write] [--no-cnn]
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CHARSET, groupOf } from '../src/recog/classes.ts';
import { Recognizer } from '../src/recog/recognizer.ts';
import { GlyphMemory } from '../src/vision/dedup.ts';
import { runScan } from '../src/vision/pipeline.ts';
import type { VisionOptions } from '../src/vision/types.ts';
import { loadBank, loadNet } from '../test/helpers/load.ts';
import { makePage, rng } from '../test/helpers/synth.ts';

const write = process.argv.includes('--write');
const noCnn = process.argv.includes('--no-cnn');
const bank = loadBank();
const rec = new Recognizer(bank, noCnn ? null : loadNet(), {});
const LEVELS = [
  { jitter: 0, rot: 0, shear: 0 },
  { jitter: 1.5, rot: 0.08, shear: 0.1 },
  { jitter: 3, rot: 0.15, shear: 0.2 },
  { jitter: 4.5, rot: 0.25, shear: 0.3 },
  { jitter: 6.5, rot: 0.4, shear: 0.4 },
];
const base: VisionOptions = { pen: 'auto', ruled: 'off', strictness: 'mittel', style: 'beide', dedup: 'sheet', debug: false };
const q = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? NaN;
};

const tByChar = new Map<string, number[]>();
const r = rng(42);
console.log(`model: ${rec.net ? 'CNN + Vorlagen' : 'nur Vorlagen'}`);
for (let li = 0; li < LEVELS.length; li++) {
  const L = LEVELS[li];
  const rawT: number[] = [];
  const rawF: number[] = [];
  const scoreT: number[] = [];
  let correct = 0;
  let total = 0;
  for (const style of ['druck', 'grund'] as const) {
    for (const ch of CHARSET) {
      const spec = {
        width: 320,
        height: 320,
        seed: Math.floor(r() * 1e6),
        glyphs: [
          {
            char: ch,
            x: 160,
            y: 160,
            size: 120,
            pen: 6 + r() * 3,
            style,
            jitter: L.jitter,
            rotate: (r() * 2 - 1) * L.rot,
            shear: (r() * 2 - 1) * L.shear,
          },
        ],
      };
      const page = makePage(bank, spec);
      const t = runScan(page, { ...base, target: ch }, { recognizer: rec, memory: new GlyphMemory() }).glyphs[0];
      const page2 = makePage(bank, spec);
      const f = runScan(page2, base, { recognizer: rec, memory: new GlyphMemory() }).glyphs[0];
      if (t) {
        rawT.push(t.score.raw ?? 0);
        scoreT.push(t.score.score);
        if (li === 1) {
          const list = tByChar.get(ch) ?? [];
          list.push(t.score.parts.T);
          tByChar.set(ch, list);
        }
      }
      if (f) {
        rawF.push(f.score.raw ?? 0);
        total++;
        if (groupOf(f.score.char) === groupOf(ch) || f.score.char.toLowerCase() === ch.toLowerCase()) correct++;
      }
    }
  }
  console.log(
    `level ${li}: target raw p10 ${q(rawT, 0.1).toFixed(3)} med ${q(rawT, 0.5).toFixed(3)} p90 ${q(rawT, 0.9).toFixed(3)} | ` +
      `free raw med ${q(rawF, 0.5).toFixed(3)} | score med ${q(scoreT, 0.5)} | free accuracy ${((100 * correct) / Math.max(1, total)).toFixed(0)}%`,
  );
}

if (write) {
  const median: Record<string, number> = {};
  for (const [ch, list] of tByChar) median[ch] = Math.round(q(list, 0.5) * 1000) / 1000;
  const file = fileURLToPath(new URL('../public/model/calib-v1.json', import.meta.url));
  writeFileSync(file, JSON.stringify({ version: 'v1', note: 'median template similarity at quality level 1', median }));
  console.log('wrote', file);
}

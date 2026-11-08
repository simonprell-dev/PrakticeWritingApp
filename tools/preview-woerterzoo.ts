// Renders the Wörter-Zoo to PNGs to look at it (dev only, @napi-rs/canvas): the picture with each help level,
// "Fast!", "Schau nochmal genau hin!", a picture alive (splendid and crumpled), the walk into the zoo, a small and
// a full zoo, at 1920 and 1440 wide, and the start tile.
// Usage: npx vite-node tools/preview-woerterzoo.ts <outDir>
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULTS, type WordHelp } from '../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { WORDS } from '../src/game/words/words.ts';
import { tierOf } from '../src/recog/score.ts';
import type { SceneHost, Snapshot } from '../src/scenes/scene.ts';
import { woerterzoo, WoerterZooScene } from '../src/scenes/woerterzoo.ts';
import type { ScanResult, ScannedGlyph } from '../src/vision/types.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
for (const dir of ['tools/train/fonts', '../PrakticeWritingApp/tools/train/fonts']) {
  if (!existsSync(`${dir}/Fredoka.ttf`)) continue;
  GlobalFonts.registerFromPath(resolve(dir, 'Fredoka.ttf'), 'Fredoka');
  GlobalFonts.registerFromPath(resolve(dir, 'PatrickHand-Regular.ttf'), 'Hand');
  break;
}

const [out = 'preview-out'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

let id = 1;
const TALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜbdfhklßtäöü';
const DESC = 'gjpqy';
/** a word as a child might write it: one glyph per letter, cut out tight, a little uneven */
function written(word: string, score: number): ScannedGlyph[] {
  let x = 200;
  return [...word].map((ch, i) => {
    const tall = TALL.includes(ch);
    const desc = DESC.includes(ch);
    const h = tall ? 64 : desc ? 58 : 36;
    const w = ch === 'm' || ch === 'M' || ch === 'W' ? 46 : ch === 'i' || ch === 'l' ? 14 : 32;
    const y = (tall ? 300 : 328) + Math.sin(i * 1.7) * 3;
    const c = createCanvas(w * 2, h * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#23236b';
    ctx.font = '120px Hand';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const m = ctx.measureText(ch);
    const ih = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
    const iw = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    const k = Math.min((h * 2) / Math.max(1, ih), (w * 2) / Math.max(1, iw));
    ctx.save();
    ctx.translate(w, h);
    ctx.scale(k, k);
    ctx.fillText(ch, (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2, (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2);
    ctx.restore();
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const g = {
      id: id++,
      box: { x, y, w, h },
      regionId: 0,
      dots: 0,
      crop: { width: c.width, height: c.height, data: new Uint8ClampedArray(img.data) },
      score: { score, tier: tierOf(score), parts: { L: 1, T: 1, S: 1, P: 1 }, char: ch, scoredAs: ch, tip: 'super' },
      isNew: true,
    } as unknown as ScannedGlyph;
    x += w + 10;
    return g;
  });
}

const snap = (): Snapshot => ({ canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 1280, detH: 960 });
const res = (glyphs: ScannedGlyph[]) => ({ glyphs, newSheet: false }) as unknown as ScanResult;

function make(W: number, help: WordHelp, seed = 1) {
  const settings = structuredClone(DEFAULTS);
  settings.woerter.help = help;
  const host = { settings, toast() {}, showCard() {}, progress() {} } as unknown as SceneHost;
  return new WoerterZooScene(host, W, seed);
}
const run = (s: WoerterZooScene, sec: number) => {
  for (let t = 0; t < sec; t += 1 / 30) s.update(1 / 30);
};
const finish = (s: WoerterZooScene) => {
  for (let t = 0; t < 20 && (s.phase !== 'ask' || s.fx.flights.length); t += 1 / 30) s.update(1 / 30);
};
const use = (s: WoerterZooScene, word: string) => (s.word = WORDS.find((w) => w.word === word)!);
const write = (s: WoerterZooScene, word: string, score: number, wait = 2.2) => {
  s.handleScan(res(written(word, score)), snap());
  run(s, wait);
};
const fill = (s: WoerterZooScene, n: number) => {
  for (let i = 0; i < n; i++) {
    finish(s);
    write(s, s.word.word, [95, 30, 60, 80, 45, 90, 20, 70][i % 8]);
    finish(s);
  }
};
const shot = (s: WoerterZooScene, name: string) => {
  const cv = createCanvas(s.W, 1080);
  s.render(cv.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/woerterzoo-${name}.png`, cv.toBuffer('image/png'));
  console.log(`${out}/woerterzoo-${name}.png`);
};

for (const W of [1920, 1440]) {
  // help 1 with a few words in the zoo
  let s = make(W, 1);
  fill(s, 5);
  run(s, 1);
  use(s, 'Banane');
  shot(s, `${W}-ask`);
  // Fast: one letter wrong
  write(s, 'Baname', 70);
  run(s, 0.5);
  shot(s, `${W}-fast`);
  // the capital
  s = make(W, 2, 4);
  fill(s, 3);
  use(s, 'Hund');
  run(s, 6);
  shot(s, `${W}-covered`);
  write(s, 'hund', 70);
  run(s, 0.5);
  shot(s, `${W}-gross`);
  // far off
  s = make(W, 3, 5);
  fill(s, 2);
  use(s, 'Tomate');
  run(s, 1);
  shot(s, `${W}-nurbild`);
  write(s, 'Kamel', 70);
  run(s, 0.4);
  shot(s, `${W}-daneben`);
  // right and splendid / right and crumpled
  s = make(W, 1, 6);
  fill(s, 4);
  use(s, 'Elefant');
  write(s, 'Elefant', 96);
  run(s, 1.2);
  shot(s, `${W}-alive-pracht`);
  s = make(W, 1, 7);
  use(s, 'Maus');
  write(s, 'Maus', 18);
  run(s, 1.4);
  shot(s, `${W}-alive-knautschi`);
  finish(s);
  // into the zoo
  s = make(W, 1, 8);
  fill(s, 3);
  write(s, s.word.word, 75);
  for (let t = 0; t < 20 && s.phase !== 'walk'; t += 1 / 30) s.update(1 / 30);
  run(s, 0.75);
  shot(s, `${W}-walk`);
  // a full zoo
  s = make(W, 1, 9);
  fill(s, W === 1920 ? 14 : 30);
  run(s, 6);
  shot(s, `${W}-zoo-${W === 1920 ? 14 : 30}`);
}

const tile = createCanvas(480, 360);
woerterzoo.tile!(tile.getContext('2d') as unknown as CanvasRenderingContext2D, 480, 360, undefined as never);
writeFileSync(`${out}/woerterzoo-tile.png`, tile.toBuffer('image/png'));
console.log(`${out}/woerterzoo-tile.png`);

// Renders the pictures of a Wörter-Zoo group to one PNG to look at: per word a row with the still picture and
// four moments of its funny animation, the word below. Dev only.
// Usage: npx vite-node tools/preview-pictos.ts <group file, e.g. src/game/words/pictos/gruppe1.ts> <out.png>
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { PICTO_SIZE, type Picto } from '../src/game/words/picto.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
for (const dir of ['tools/train/fonts', '../PrakticeWritingApp/tools/train/fonts'])
  if (existsSync(`${dir}/Fredoka.ttf`)) {
    GlobalFonts.registerFromPath(resolve(dir, 'Fredoka.ttf'), 'Fredoka');
    break;
  }

const [file, out = 'pictos.png'] = process.argv.slice(2);
if (!file) throw new Error('usage: npx vite-node tools/preview-pictos.ts <group file> <out.png>');
const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<string, unknown>;
const group = Object.values(mod).find((v): v is Record<string, Picto> => !!v && typeof v === 'object' && Object.values(v).every((p) => p && typeof (p as Picto).draw === 'function'));
if (!group) throw new Error(`no Record<string, Picto> exported by ${file}`);

const cell = PICTO_SIZE * 1.15;
const words = Object.keys(group);
const cols = 5;
const c = createCanvas(cell * cols, (cell + 40) * words.length);
const ctx = c.getContext('2d');
ctx.fillStyle = '#e8f2e0';
ctx.fillRect(0, 0, c.width, c.height);
words.forEach((word, row) => {
  const p = group[word];
  const moments: [number, boolean][] = [
    [0, false],
    [p.anim * 0.15, true],
    [p.anim * 0.45, true],
    [p.anim * 0.8, true],
    [p.anim + 2, true],
  ];
  moments.forEach(([t, alive], col) => {
    ctx.save();
    ctx.translate(col * cell + cell / 2, row * (cell + 40) + cell / 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.strokeRect(-PICTO_SIZE / 2, -PICTO_SIZE / 2, PICTO_SIZE, PICTO_SIZE);
    p.draw(ctx as unknown as CanvasRenderingContext2D, t, alive);
    ctx.restore();
  });
  ctx.fillStyle = '#2d2342';
  ctx.font = '32px Fredoka, sans-serif';
  ctx.fillText(`${word}  (anim ${p.anim}s)`, 12, row * (cell + 40) + cell + 26);
});
writeFileSync(out, c.toBuffer('image/png'));
console.log(`wrote ${out}`);

// Renders one frame of every scene with fake scans to PNG (dev only, @napi-rs/canvas).
// Usage: node tools/preview-scenes.ts [outDir]
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DEFAULTS } from '../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../src/game/canvas.ts';
import { tierOf } from '../src/recog/score.ts';
import { aquarium } from '../src/scenes/aquarium.ts';
import { DuelScene } from '../src/scenes/duelScene.ts';
import { HabitatScene } from '../src/scenes/habitat.ts';
import { savanna } from '../src/scenes/savanna.ts';
import type { SceneHost } from '../src/scenes/scene.ts';
import { space } from '../src/scenes/space.ts';
import type { ScannedGlyph, TeamId } from '../src/vision/types.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
const font = (f: string) => fileURLToPath(new URL(`../tools/train/fonts/${f}`, import.meta.url));
GlobalFonts.registerFromPath(font('Fredoka.ttf'), 'Fredoka');
GlobalFonts.registerFromPath(font('PatrickHand-Regular.ttf'), 'Hand');

const out = process.argv[2] ?? fileURLToPath(new URL('../tools/train/out/', import.meta.url));
mkdirSync(out, { recursive: true });

let id = 1;
function glyph(ch: string, score: number, team?: TeamId, color = '#23236b'): ScannedGlyph {
  const c = createCanvas(70, 80);
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.font = '72px Hand';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(ch, 35, 44);
  const img = x.getImageData(0, 0, 70, 80);
  return {
    id: id++,
    box: { x: 0, y: 0, w: 70, h: 80 },
    regionId: 0,
    team,
    dots: 0,
    crop: { width: 70, height: 80, data: new Uint8ClampedArray(img.data) },
    score: { score, tier: tierOf(score), parts: { L: 1, T: 1, S: 1, P: 1 }, char: ch, scoredAs: ch, tip: 'form' },
    isNew: true,
  };
}

const host: SceneHost = {
  settings: structuredClone(DEFAULTS),
  toast: () => undefined,
  showCard: () => undefined,
  progress: () => undefined,
};
const W = 1920;
const H = 1080;
const letters = 'AbC4eFgH2kLmN8oPqR';

for (const def of [aquarium, space, savanna]) {
  const scene = new HabitatScene(def, host, W);
  [...letters].forEach((ch, i) => {
    const g = glyph(ch, [8, 25, 40, 55, 65, 75, 85, 92, 98][i % 9]);
    const { canvasFromRGBA } = { canvasFromRGBA: (img: ScannedGlyph['crop']) => {
      const cv = createCanvas(img.width, img.height);
      const cx = cv.getContext('2d');
      const d = cx.createImageData(img.width, img.height);
      d.data.set(img.data);
      cx.putImageData(d, 0, 0);
      return cv as unknown as AnyCanvas;
    } };
    scene.addCreature(g, canvasFromRGBA(g.crop));
  });
  for (let t = 0; t < 4; t += 1 / 30) scene.update(1 / 30);
  scene.creatures[3].bubble = { text: 'Ganz langsam und ruhig schreiben.', t: 1, good: false };
  const cv = createCanvas(W, H);
  scene.render(cv.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/scene-${def.id}.png`, cv.toBuffer('image/png'));
  console.log('wrote scene', def.id);
}

const duel = new DuelScene(host, W);
const spawn = (team: TeamId, ch: string, score: number) => {
  const g = glyph(ch, score, team, team === 'A' ? '#d0303a' : '#2a4fd0');
  const cv = createCanvas(g.crop.width, g.crop.height);
  const cx = cv.getContext('2d');
  const d = cx.createImageData(g.crop.width, g.crop.height);
  d.data.set(g.crop.data);
  cx.putImageData(d, 0, 0);
  duel.glyphs.set(g.id, { glyph: g, sticker: cv as unknown as AnyCanvas });
  duel.sim.spawn(team, score, g.id);
};
[...'ABCDEFGH'].forEach((ch, i) => spawn('A', ch, [95, 40, 70, 20, 85, 55, 10, 65][i]));
[...'abcdefgh'].forEach((ch, i) => spawn('B', ch, [60, 90, 35, 75, 50, 80, 45, 30][i]));
const snap = (name: string) => {
  const dc = createCanvas(W, H);
  duel.render(dc.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/${name}`, dc.toBuffer('image/png'));
  console.log('wrote', name);
};
for (let t = 0; t < 6; t += 1 / 30) duel.update(1 / 30);
snap('scene-duel.png');
[...'KLMN'].forEach((ch, i) => spawn('A', ch, [95, 92, 90, 85][i]));
for (let t = 0; t < 22; t += 1 / 30) duel.update(1 / 30);
snap('scene-duel-2.png');

// ---- Klasse gegen Riesenburg
const { SiegeScene } = await import('../src/scenes/siegeScene.ts');
const siegeHost: SceneHost = { ...host, settings: { ...structuredClone(DEFAULTS), siege: { className: 'Klasse 2b', size: 'mittel', timeLimit: 0 } }, finished: () => console.log('siege finished') };
const siege = new SiegeScene(siegeHost, W);
const siegeSnap = (name: string) => {
  const dc = createCanvas(W, H);
  siege.render(dc.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/${name}`, dc.toBuffer('image/png'));
  console.log('wrote', name);
};
const stepSiege = (sec: number) => {
  for (let t = 0; t < sec; t += 1 / 30) siege.update(1 / 30);
};
stepSiege(0.9);
siegeSnap('siege-1-rise.png');
stepSiege(1.2);
siegeSnap('siege-2-laugh.png');
stepSiege(1.7);
siegeSnap('siege-3-banner.png');
stepSiege(1.6);
siegeSnap('siege-4-countdown.png');
stepSiege(2);
const addClass = (ch: string, score: number) => {
  const g = glyph(ch, score, 'A', '#c2410c');
  const cv = createCanvas(g.crop.width, g.crop.height);
  const cx = cv.getContext('2d');
  const d = cx.createImageData(g.crop.width, g.crop.height);
  d.data.set(g.crop.data);
  cx.putImageData(d, 0, 0);
  siege.glyphs.set(g.id, { glyph: g, sticker: cv as unknown as AnyCanvas });
  siege.sim.spawn('A', score, g.id);
};
[...'KlasseZweiB'].forEach((ch, i) => addClass(ch, [95, 70, 85, 40, 90, 60, 75, 95, 30, 88, 66][i]));
stepSiege(12);
siegeSnap('siege-5-battle.png');
// speed up: empty the first wall
siege.sim.castles.B.pile = siege.sim.castles.B.pile.map(() => 0);
siege.sim.castles.B.tank = 0;
siege.sim.castles.B.flying = [];
[...'ABC'].forEach((ch) => addClass(ch, 95));
for (let i = 0; i < 40 * 30 && !siege.seq; i++) siege.update(1 / 30);
stepSiege(0.9);
siegeSnap('siege-6-wall-burst.png');
stepSiege(1.6);
siegeSnap('siege-7-wall-banner.png');
// finale: jump to the last wall and win
while (siege.sim.stage < siege.walls.length - 1 || siege.seq) {
  if (!siege.seq) {
    siege.sim.castles.B.pile = siege.sim.castles.B.pile.map(() => 0);
    siege.sim.castles.B.tank = 0;
    siege.sim.castles.B.flying = [];
    addClass('X', 95);
  }
  siege.update(1 / 30);
}
siege.sim.castles.B.pile = siege.sim.castles.B.pile.map(() => 0);
siege.sim.castles.B.tank = 0;
siege.sim.castles.B.flying = [];
addClass('Y', 95);
for (let i = 0; i < 40 * 30 && !siege.seq; i++) siege.update(1 / 30);
stepSiege(3.6);
siegeSnap('siege-8-victory.png');

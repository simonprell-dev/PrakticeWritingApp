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
import type { PlayerId, ScannedGlyph, TeamId } from '../src/vision/types.ts';

setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D);
const font = (f: string) => fileURLToPath(new URL(`../tools/train/fonts/${f}`, import.meta.url));
GlobalFonts.registerFromPath(font('Fredoka.ttf'), 'Fredoka');
GlobalFonts.registerFromPath(font('PatrickHand-Regular.ttf'), 'Hand');

const out = process.argv[2] ?? fileURLToPath(new URL('../tools/train/out/', import.meta.url));
mkdirSync(out, { recursive: true });

let id = 1;
function glyph(ch: string, score: number, team?: PlayerId, color = '#23236b'): ScannedGlyph {
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

// ---- Türme bauen
const { TowerScene } = await import('../src/scenes/towerScene.ts');
const towerSettings = structuredClone(DEFAULTS);
towerSettings.tower.count = 3;
const tower = new TowerScene({ ...host, settings: towerSettings, finished: () => console.log('tower finished') }, W);
const towerSnap = (name: string) => {
  const dc = createCanvas(W, H);
  tower.render(dc.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/${name}`, dc.toBuffer('image/png'));
  console.log('wrote', name);
};
const stepTower = (sec: number) => {
  for (let t = 0; t < sec; t += 1 / 30) tower.update(1 / 30);
};
const PEN = ['#d0303a', '#2a4fd0', '#2a8f3a'];
const addTower = (p: number, ch: string, score: number) => {
  const g = glyph(ch, score, (['A', 'B', 'C'] as const)[p], PEN[p]);
  const cv = createCanvas(g.crop.width, g.crop.height);
  const cx = cv.getContext('2d');
  const d = cx.createImageData(g.crop.width, g.crop.height);
  d.data.set(g.crop.data);
  cx.putImageData(d, 0, 0);
  tower.glyphs.set(g.id, { glyph: g, sticker: cv as unknown as AnyCanvas });
  tower.sim.addBlock(p, score, g.id);
};
/** delivers one block with a given gag and takes pictures at gag times (0..1) */
const gagShot = (gag: string, p: number, ch: string, score: number, at: number[]) => {
  tower.sim.forceGag = gag;
  addTower(p, ch, score);
  const running = () => tower.sim.aliens.find((a) => a.job?.gag?.id === gag && a.job.gagT >= 0);
  for (let i = 0; i < 30 * 15 && !running(); i++) tower.update(1 / 30);
  tower.sim.forceGag = null;
  const a = running();
  if (!a) return console.log('gag did not start:', gag);
  const dur = a.job!.gag!.dur;
  let done = 0;
  for (const u of at) {
    stepTower(u * dur - done);
    done = u * dur;
    towerSnap(`tower-gag-${gag}-${Math.round(u * 100)}.png`);
  }
  stepTower(6);
};
stepTower(1.3);
towerSnap('tower-1-intro.png');
stepTower(1.5);
towerSnap('tower-2-banner.png');
stepTower(3.2);
[...'AbC4eF'].forEach((ch, i) => addTower(i % 3, ch, [95, 60, 30, 80, 45, 20][i]));
stepTower(0.9);
towerSnap('tower-3-portal.png');
stepTower(1.1);
towerSnap('tower-4-carry.png');
stepTower(8);
towerSnap('tower-5-built.png');
gagShot('hatschi', 0, 'K', 92, [0.2, 0.45]);
gagShot('regenwolke', 1, 'm', 70, [0.7]);
gagShot('vogel', 2, 'R', 85, [0.5]);
gagShot('falscherTurm', 0, 'S', 65, [0.45]);
gagShot('kaugummi', 1, 'p', 55, [0.6]);
gagShot('massband', 2, 'T', 75, [0.4]);
gagShot('sonnenbrille', 0, 'Z', 96, [0.5]);
gagShot('landkarte', 1, 'h', 66, [0.3]);
gagShot('bluemchen', 2, 'w', 60, [0.7]);
// let them get up to mischief
stepTower(9);
towerSnap('tower-6-mischief.png');
stepTower(5);
towerSnap('tower-7-mischief.png');
// finish: red tower goes over the line
while (tower.sim.towers[0].metres < tower.sim.goal - 8) {
  addTower(0, 'X', 95);
  stepTower(4);
}
addTower(0, 'Y', 95);
for (let i = 0; i < 30 * 20 && !tower.seq; i++) tower.update(1 / 30);
stepTower(2.2);
towerSnap('tower-8-victory.png');

// eight teams side by side
{
  const eight = structuredClone(DEFAULTS);
  eight.tower.count = 8;
  const sc = new TowerScene({ ...host, settings: eight, finished: () => undefined }, W);
  const step = (sec: number) => {
    for (let t = 0; t < sec; t += 1 / 30) sc.update(1 / 30);
  };
  step(6.2);
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
  for (let round = 0; round < 3; round++)
    ids.forEach((id, p) => {
      const g = glyph('AbCdEfGh'[p], [95, 70, 45, 85, 60, 30, 90, 75][(p + round) % 8], id, '#3b2a5c');
      const cv = createCanvas(g.crop.width, g.crop.height);
      const cx = cv.getContext('2d');
      const d = cx.createImageData(g.crop.width, g.crop.height);
      d.data.set(g.crop.data);
      cx.putImageData(d, 0, 0);
      sc.glyphs.set(g.id, { glyph: g, sticker: cv as unknown as AnyCanvas });
      sc.sim.addBlock(p, g.score.score, g.id);
    });
  step(30);
  const dc = createCanvas(W, H);
  sc.render(dc.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/tower-9-eight.png`, dc.toBuffer('image/png'));
  console.log('wrote tower-9-eight.png');
}

// ---- practice mode: surprise letter in a bubble, written -> bursts, a creature hatches there
GlobalFonts.registerFromPath(font('PlaywriteDEGrund.ttf'), 'Grundschrift');
for (const def of [aquarium, space, savanna]) {
  const practice = structuredClone(DEFAULTS);
  practice.practice = { mode: 'ueben', targets: ['B'], count: 5, surprise: true };
  const sc = new HabitatScene(def, { ...host, settings: practice }, W);
  [...'BBB'].forEach((ch, i) => {
    const g = glyph(ch, [90, 60, 75][i]);
    const cv = createCanvas(g.crop.width, g.crop.height);
    const cx = cv.getContext('2d');
    const d = cx.createImageData(g.crop.width, g.crop.height);
    d.data.set(g.crop.data);
    cx.putImageData(d, 0, 0);
    sc.addCreature(g, cv as unknown as AnyCanvas);
  });
  sc.wishIn = 0.1;
  for (let t = 0; t < 2; t += 1 / 30) sc.update(1 / 30);
  sc.wish!.char = 'm';
  const shot = (name: string) => {
    const dc = createCanvas(W, H);
    sc.render(dc.getContext('2d') as unknown as CanvasRenderingContext2D);
    writeFileSync(`${out}/${name}`, dc.toBuffer('image/png'));
    console.log('wrote', name, 'wish', sc.wish?.char, 'freed', sc.wishesFreed);
  };
  shot(`wish-${def.id}-1.png`);
  const m = glyph('m', 82);
  m.score.scoredAs = 'm';
  const snapCanvas = createCanvas(640, 360);
  sc.handleScan(
    { frameW: 1280, frameH: 720, scale: 1, regions: [], glyphs: [m], shift: { dx: 0, dy: 0 }, newSheet: false, duplicates: 0, analyzed: 1, neutral: 0, timings: {} },
    { canvas: snapCanvas as unknown as AnyCanvas, detW: 1280, detH: 720 },
  );
  for (let t = 0; t < 2.3; t += 1 / 30) sc.update(1 / 30);
  shot(`wish-${def.id}-2-freed.png`);
}

// ---- how a letter is written: the big demonstration in the middle of the writing
{
  const practice = structuredClone(DEFAULTS);
  practice.practice = { mode: 'ueben', targets: ['B', 'a'], count: 5, surprise: true };
  const sc = new HabitatScene(space, { ...host, settings: practice }, W);
  sc.showDemo('B');
  for (let t = 0; t < 2.2; t += 1 / 30) sc.update(1 / 30);
  const dc = createCanvas(W, H);
  sc.render(dc.getContext('2d') as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/demo-B.png`, dc.toBuffer('image/png'));
  console.log('wrote demo-B.png');
}

// Renders a seasonal world to PNG to look at it (dev only, @napi-rs/canvas): the scene with 18 letters of all
// qualities after a few seconds, a later moment, the start tile and every kind of creature at every tier.
// Usage: npx vite-node tools/preview-season.ts <world file, e.g. src/scenes/seasons/winter.ts> <outDir>
import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { DEFAULTS } from "../src/app/settings.ts";
import { setCanvasFactory, type AnyCanvas } from "../src/game/canvas.ts";
import { makeGenome } from "../src/game/creatures/genome.ts";
import { drawBadgeSticker } from "../src/game/creatures/sprite.ts";
import { tierOf } from "../src/recog/score.ts";
import { HabitatScene, type HabitatDef } from "../src/scenes/habitat.ts";
import type { SceneHost } from "../src/scenes/scene.ts";
import type { TileKit } from "../src/scenes/seasons/kit.ts";
import type { ScannedGlyph } from "../src/vision/types.ts";

setCanvasFactory(
  (w, h) => createCanvas(w, h) as unknown as AnyCanvas,
  Path2D as unknown as typeof globalThis.Path2D,
);
// the fonts are not in git; a worktree uses the ones of the main checkout
for (const dir of [
  "tools/train/fonts",
  "../PrakticeWritingApp/tools/train/fonts",
]) {
  if (!existsSync(`${dir}/Fredoka.ttf`)) continue;
  GlobalFonts.registerFromPath(resolve(dir, "Fredoka.ttf"), "Fredoka");
  GlobalFonts.registerFromPath(resolve(dir, "PatrickHand-Regular.ttf"), "Hand");
  break;
}

const [file, out = "preview-out"] = process.argv.slice(2);
if (!file)
  throw new Error("usage: node tools/preview-season.ts <world file> <outDir>");
mkdirSync(out, { recursive: true });
const mod = (await import(pathToFileURL(resolve(file)).href)) as Record<
  string,
  unknown
>;
const def = Object.values(mod).find(
  (v): v is HabitatDef =>
    !!v && typeof v === "object" && "paint" in v && "makeSprite" in v,
);
if (!def) throw new Error(`no HabitatDef exported by ${file}`);

let id = 1;
function letter(ch: string, size = 70): AnyCanvas {
  const c = createCanvas(size, size * 1.15);
  const x = c.getContext("2d");
  x.fillStyle = "#23236b";
  x.font = `${size}px Hand`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText(ch, size / 2, size * 0.62);
  return c as unknown as AnyCanvas;
}
function glyph(
  ch: string,
  score: number,
): { g: ScannedGlyph; sticker: AnyCanvas } {
  const sticker = letter(ch);
  const img = (sticker as unknown as ReturnType<typeof createCanvas>)
    .getContext("2d")
    .getImageData(0, 0, sticker.width, sticker.height);
  const g = {
    id: id++,
    box: { x: 0, y: 0, w: sticker.width, h: sticker.height },
    regionId: 0,
    dots: 0,
    crop: {
      width: sticker.width,
      height: sticker.height,
      data: new Uint8ClampedArray(img.data),
    },
    score: {
      score,
      tier: tierOf(score),
      parts: { L: 1, T: 1, S: 1, P: 1 },
      char: ch,
      scoredAs: ch,
      tip: "form",
    },
    isNew: true,
  } as unknown as ScannedGlyph;
  return { g, sticker };
}

const host = {
  settings: structuredClone(DEFAULTS),
  toast: () => undefined,
  showCard: () => undefined,
  progress: () => undefined,
} as unknown as SceneHost;
const W = 1920;
const H = 1080;
const scene = new HabitatScene(def, host, W);
[..."AbC4eFgH2kLmN8oPqR"].forEach((ch, i) => {
  const { g, sticker } = glyph(ch, [8, 25, 40, 55, 65, 75, 85, 92, 98][i % 9]);
  scene.addCreature(g, sticker);
});
const shot = (name: string) => {
  const cv = createCanvas(W, H);
  scene.render(cv.getContext("2d") as unknown as CanvasRenderingContext2D);
  writeFileSync(`${out}/${def.id}-${name}.png`, cv.toBuffer("image/png"));
};
for (let t = 0; t < 4; t += 1 / 30) scene.update(1 / 30);
shot("scene");
for (let t = 0; t < 14; t += 1 / 30) scene.update(1 / 30);
shot("later");

const draw: TileKit["draw"] = (ctx, sp, x, y, scale, flip = 1) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  if (sp.tail)
    ctx.drawImage(
      sp.tail.canvas as CanvasImageSource,
      sp.tail.px - sp.ax - sp.tail.pivotX,
      sp.tail.py - sp.ay - sp.tail.pivotY,
    );
  ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
  drawBadgeSticker(ctx, sp, flip);
  ctx.restore();
};
const kit: TileKit = {
  draw,
  genome: (score, seed, variant) => {
    let g = makeGenome(score, tierOf(score), seed, "season");
    for (let s = seed; variant !== undefined && g.variant !== variant;)
      g = makeGenome(score, tierOf(score), ++s, "season");
    return g;
  },
  sticker: (ch) => letter(ch, 90),
};
if (def.tile) {
  const cv = createCanvas(480, 360);
  def.tile(
    cv.getContext("2d") as unknown as CanvasRenderingContext2D,
    480,
    360,
    kit,
  );
  writeFileSync(`${out}/${def.id}-tile.png`, cv.toBuffer("image/png"));
}

// every variant (rows) at every tier (columns)
const scores = [8, 35, 60, 80, 97];
const cell = 220;
const sheet = createCanvas(cell * scores.length, cell * 12);
const sx = sheet.getContext("2d");
sx.fillStyle = "#dfe6ee";
sx.fillRect(0, 0, sheet.width, sheet.height);
for (let v = 0; v < 12; v++)
  scores.forEach((score, i) => {
    const sp = def.makeSprite(
      kit.genome(score, 100 + v * 7 + i, v),
      letter("a"),
    );
    const k = Math.min(
      1,
      (cell * 0.8) / Math.max(sp.canvas.width, sp.canvas.height),
    );
    draw(
      sx as unknown as CanvasRenderingContext2D,
      sp,
      i * cell + cell / 2,
      v * cell + cell / 2,
      k,
    );
  });
writeFileSync(`${out}/${def.id}-kinds.png`, sheet.toBuffer("image/png"));
console.log(`wrote ${out}/${def.id}-{scene,later,tile,kinds}.png`);

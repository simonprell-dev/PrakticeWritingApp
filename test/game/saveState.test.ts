import { createCanvas, loadImage } from '@napi-rs/canvas';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { packTyped, unpackTyped } from '../../src/app/imageCodec.ts';
import { defaultName, when } from '../../src/app/saves.ts';
import { DEFAULTS } from '../../src/app/settings.ts';
import type { AnyCanvas } from '../../src/game/canvas.ts';
import { DuelSim } from '../../src/game/duel/duelSim.ts';
import { CARD, CARD_PX } from '../../src/game/paint/fishCard.ts';
import type { SpeciesId } from '../../src/game/paint/species.ts';
import { mulberry32 } from '../../src/game/rng.ts';
import { TowerSim } from '../../src/game/tower/towerSim.ts';
import { PaintScene, type PaintSave } from '../../src/scenes/paintScene.ts';
import { restoredId } from '../../src/scenes/saved.ts';
import type { SceneHost, Snapshot } from '../../src/scenes/scene.ts';
import type { CardHit } from '../../src/vision/cards.ts';
import type { RGBAImage } from '../../src/vision/types.ts';
import { colourful, drawLook } from '../helpers/cardScene.ts';

const step = (sim: { step(dt: number): void; drain(): unknown[] }, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) {
    sim.step(1 / 60);
    sim.drain();
  }
};

describe('saved games', () => {
  it('a tower game goes on where it stopped: towers stand, blocks on their way come again', () => {
    const sim = new TowerSim(3, 40, 1920, 0, mulberry32(1));
    sim.addBlock(0, 95, 1);
    sim.addBlock(2, 40, 2);
    step(sim, 20);
    sim.addBlock(1, 80, 3);
    step(sim, 0.5);
    const saved = JSON.parse(JSON.stringify(sim.exportState()));
    expect(saved.pending.map((b: { glyphId: number }) => b.glyphId)).toEqual([3]);

    // another screen width, the recognition counts from 1 again
    const again = new TowerSim(3, 40, 1600, 0, mulberry32(2));
    again.importState(saved, restoredId);
    expect(again.towers.map((t) => t.metres)).toEqual([8, 0, 3]);
    expect(again.towers[0].blocks[0].glyphId).toBe(restoredId(1));
    expect(again.stats.map((s) => s.written)).toEqual([1, 1, 1]);
    expect(again.aliens.length).toBe(sim.aliens.length);
    step(again, 20);
    expect(again.towers.map((t) => t.metres)).toEqual([8, 6, 3]);
    expect(again.stats[1].written).toBe(1);
  });

  it('a duel goes on with its fighters, bubbles and stats', () => {
    const sim = new DuelSim('mittel', 1920, 300, mulberry32(3));
    sim.spawn('A', 95, 1);
    sim.spawn('B', 60, 2);
    step(sim, 3);
    const saved = JSON.parse(JSON.stringify(sim.exportState()));
    const again = new DuelSim('mittel', 1600, 300, mulberry32(4));
    again.importState(saved, restoredId);
    again.resize(1600);
    expect(again.fighters.map((f) => f.glyphId)).toEqual([restoredId(1), restoredId(2)]);
    expect(again.remaining('A')).toBe(sim.remaining('A'));
    expect(again.remaining('B')).toBe(sim.remaining('B'));
    expect(again.castles.B.x).toBe(sim.castles.B.x - 320);
    expect(again.time).toBeCloseTo(sim.time);
    expect(again.stats.A.best?.glyphId).toBe(restoredId(1));
  });

  it('glyph ids of a continued game never meet new ones; guards keep their id', () => {
    expect(restoredId(1)).toBeGreaterThan(100000);
    expect(restoredId(-1)).toBe(-1);
  });

  it('typed arrays survive a trip through JSON', () => {
    const v = { a: new Uint8Array([1, 2, 255]), b: [{ c: new Float32Array([0.5, -2]) }], d: 'x', e: undefined };
    const back = unpackTyped(JSON.parse(JSON.stringify(packTyped(v)))) as typeof v;
    expect([...back.a]).toEqual([1, 2, 255]);
    expect(back.a).toBeInstanceOf(Uint8Array);
    expect([...back.b[0].c]).toEqual([0.5, -2]);
    expect(back.d).toBe('x');
    expect('e' in back).toBe(false);
  });

  it('says when a game was saved', () => {
    const now = new Date(2026, 9, 23, 15, 0).getTime();
    expect(when(new Date(2026, 9, 23, 10, 42).getTime(), now)).toBe('heute, 10:42');
    expect(when(new Date(2026, 9, 22, 9, 5).getTime(), now)).toBe('gestern, 9:05');
    expect(when(new Date(2026, 8, 3, 8, 0).getTime(), now)).toBe('03.09.2026, 8:00');
    expect(defaultName('malen', new Date(2026, 9, 23, 10, 7))).toBe('Mal-Aquarium – 23.10., 10:07');
  });
});

describe('saved Mal-Aquarium', () => {
  // Node has no createImageBitmap: the saved JPEGs are decoded with @napi-rs/canvas instead
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())), { close() {} }));
  });
  afterEach(() => vi.unstubAllGlobals());

  const toasts: string[] = [];
  const host = { settings: DEFAULTS, toast: (t: string) => toasts.push(t), showCard() {}, progress() {} } as unknown as SceneHost;
  const snap: Snapshot = { canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 640, detH: 480 };

  /** a coloured card of this animal as the detection cuts it out */
  function card(sp: SpeciesId, fills?: Record<string, string>): RGBAImage {
    const c = createCanvas(Math.round(CARD.w * CARD_PX), Math.round(CARD.h * CARD_PX));
    const ctx = c.getContext('2d');
    drawLook(ctx as unknown as CanvasRenderingContext2D, CARD_PX, fills ? { species: sp, fills } : colourful(sp));
    const id = ctx.getImageData(0, 0, c.width, c.height);
    return { width: id.width, height: id.height, data: new Uint8ClampedArray(id.data) };
  }

  const hit = (species: SpeciesId, image: RGBAImage, thumb: number[]): CardHit => ({
    species,
    image,
    thumb,
    quad: [[100, 100], [300, 100], [300, 250], [100, 250]],
    match: 0.5,
    colored: 0.6,
  });

  it('every animal comes back as what it was; fish of old saves are fish', async () => {
    const scene = new PaintScene(host, 1920);
    for (const [sp, x] of [['hai', 500], ['freiform', 1200]] as const) {
      const { skin, sprite } = scene.makeSkin(card(sp), [0.5], undefined, sp);
      scene.addPainted(skin, sprite, x, 400, false);
    }
    const saved = JSON.parse(JSON.stringify((await scene.saveState())!.state)) as PaintSave;
    expect(saved.fish.map((f) => f.species)).toEqual(['hai', 'freiform']);

    const again = new PaintScene(host, 1920);
    await again.restoreState(saved);
    expect(again.creatures.map((c) => c.painted?.species)).toEqual(['hai', 'freiform']);
    expect(again.creatures.map((c) => c.sprite.motion)).toEqual(['swim', 'sway']);
    // the shark keeps its size
    expect(again.creatures[0].sprite.radius).toBeCloseTo(scene.creatures[0].sprite.radius);

    // a game saved before there were other animals: no species anywhere
    const old = { fish: saved.fish.map(({ species: _, ...f }) => f), known: [[0.1], [0.2]], away: 0 };
    const fromOld = new PaintScene(host, 1920);
    await fromOld.restoreState(old);
    expect(fromOld.creatures.map((c) => c.painted?.species)).toEqual(['fisch', 'fisch']);
    expect(fromOld.known.map((k) => k.species)).toEqual(['fisch', 'fisch']);
  });

  it('a carp and a clownfish coloured just alike are two animals, not one card seen twice', () => {
    toasts.length = 0;
    const scene = new PaintScene(host, 1920);
    const fills = { body: '#ff8a2a', tail: '#2f9bff', dorsal: '#ffd23c' };
    const thumb = Array.from({ length: 12 * 8 * 3 }, (_, i) => (i % 7) / 7);
    scene.handleCards({ frameW: 640, frameH: 480, cards: [hit('karpfen', card('karpfen', fills), thumb)], unsure: 0, ms: 1 }, snap);
    scene.handleCards({ frameW: 640, frameH: 480, cards: [hit('clownfisch', card('clownfisch', fills), thumb)], unsure: 0, ms: 1 }, snap);
    expect(scene.known.map((k) => k.species)).toEqual(['karpfen', 'clownfisch']);
    expect(scene.fx.polaroid?.label).toBe('Ein neuer Clownfisch!');
    expect(toasts.some((t) => t.includes('kenne'))).toBe(false);
    // the same clownfish again is known
    scene.handleCards({ frameW: 640, frameH: 480, cards: [hit('clownfisch', card('clownfisch', fills), thumb)], unsure: 0, ms: 1 }, snap);
    expect(scene.known.length).toBe(2);
    expect(scene.fx.polaroid?.label).toBe('1 kenne ich schon');
  });

  it('says which animal is new, and asks again once when a card was not clear', () => {
    toasts.length = 0;
    const scene = new PaintScene(host, 1920);
    const scan = (cards: CardHit[], unsure = 0) => {
      scene.handleCards({ frameW: 640, frameH: 480, cards, unsure, ms: 1 }, snap);
      return scene.fx.polaroid?.label;
    };
    const t = (n: number) => Array.from({ length: 12 * 8 * 3 }, (_, i) => ((i * n) % 11) / 11);
    expect(scan([hit('hai', card('hai'), t(1))])).toBe('Ein neuer Hai!');
    expect(scan([hit('seepferdchen', card('seepferdchen'), t(2))])).toBe('Ein neues Seepferdchen!');
    expect(scan([hit('qualle', card('qualle'), t(3))])).toBe('Eine neue Qualle!');
    expect(scan([hit('freiform', card('freiform'), t(4))])).toBe('Ein neues Tier!');
    expect(scan([hit('krebs', card('krebs'), t(5)), hit('krake', card('krake'), t(6)), hit('hecht', card('hecht'), t(7))])).toBe('3 neue Tiere!');
    expect(toasts).toEqual([]);
    expect(scan([], 2)).toBe('Keine Karte gefunden');
    expect(toasts).toEqual(['Diese Karte erkenne ich nicht sicher – bitte flach und ganz ins Bild legen']);
  });
});

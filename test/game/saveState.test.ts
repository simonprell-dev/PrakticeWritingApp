import { describe, expect, it } from 'vitest';
import { packTyped, unpackTyped } from '../../src/app/imageCodec.ts';
import { defaultName, when } from '../../src/app/saves.ts';
import { DuelSim } from '../../src/game/duel/duelSim.ts';
import { mulberry32 } from '../../src/game/rng.ts';
import { TowerSim } from '../../src/game/tower/towerSim.ts';
import { restoredId } from '../../src/scenes/saved.ts';

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

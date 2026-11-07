// The games read their texts aloud: what the giant, Zork and the creatures say goes to gameVoice once, as it
// appears (never every frame).
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/game/voice/gameVoice.ts', () => ({ speak: vi.fn(), hush: vi.fn() }));

import { DEFAULTS } from '../../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { speak } from '../../src/game/voice/gameVoice.ts';
import { TIP_TEXT, tierOf } from '../../src/recog/score.ts';
import { aquarium } from '../../src/scenes/aquarium.ts';
import { HabitatScene } from '../../src/scenes/habitat.ts';
import type { SceneHost } from '../../src/scenes/scene.ts';
import { SiegeScene } from '../../src/scenes/siegeScene.ts';
import { TowerScene } from '../../src/scenes/towerScene.ts';
import type { ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));
beforeEach(() => vi.mocked(speak).mockClear());

const host = () => ({ settings: structuredClone(DEFAULTS), toast() {}, showCard() {}, progress() {}, finished() {} }) as unknown as SceneHost;

function run(s: { update(dt: number): void }, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 30) s.update(1 / 30);
}

/** how often a text was handed to gameVoice */
const said = (text: string) => vi.mocked(speak).mock.calls.filter((c) => c.includes(text)).length;

describe('the games speak their lines', () => {
  it('Riese Rumpel says his line when the Riesenburg starts, once', () => {
    const s = new SiegeScene(host(), 1920);
    run(s, 3);
    expect(said('Hohoho! An meiner Riesenburg kommt keiner vorbei!')).toBe(1);
  });

  it('the Riesenburg banner is read with its line', () => {
    const s = new SiegeScene(host(), 1920);
    run(s, 4);
    expect(speak).toHaveBeenCalledWith('Klasse gegen Riesenburg', expect.stringContaining('jeder Stern ist ein Schlag!'));
  });

  it('Zork introduces himself when the towers start, once', () => {
    const s = new TowerScene(host(), 1920);
    run(s, 3);
    expect(said('Hallo! Ich bin Zork. Ich baue eure Türme!')).toBe(1);
    expect(speak).toHaveBeenCalledWith('Türme bauen!', 'Je schöner der Buchstabe, desto höher der Baustein. Wer ist zuerst oben?');
  });

  it('a new creature in the sea says its tip in its speech bubble, once', () => {
    const s = new HabitatScene(aquarium, host(), 1920);
    const data = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 7) & 255));
    const g = {
      id: 1,
      box: { x: 100, y: 100, w: 40, h: 40 },
      regionId: 0,
      dots: 0,
      crop: { width: 16, height: 16, data },
      score: { score: 90, tier: tierOf(90), parts: { L: 1, T: 1, S: 1, P: 1 }, char: 'a', scoredAs: 'a', tip: 'super' },
      isNew: true,
    } as unknown as ScannedGlyph;
    const snap = { canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 640, detH: 480 };
    s.handleScan({ glyphs: [g], newSheet: false } as unknown as Parameters<HabitatScene['handleScan']>[0], snap);
    run(s, 6);
    expect(s.creatures.length).toBe(1);
    expect(said(TIP_TEXT.super)).toBe(1);
  });
});

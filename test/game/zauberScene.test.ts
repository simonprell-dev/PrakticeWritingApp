import { createCanvas, Path2D } from '@napi-rs/canvas';
import { beforeAll, describe, expect, it } from 'vitest';
import { DEFAULTS } from '../../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { Castle, SLOTS } from '../../src/game/castle/castle.ts';
import { arcPoint } from '../../src/game/castle/herd.ts';
import { tierOf } from '../../src/recog/score.ts';
import type { SceneHost } from '../../src/scenes/scene.ts';
import { rollKind, ZauberScene, type ZKind } from '../../src/scenes/zauberland.ts';
import type { ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

let gid = 1;
function glyph(score = 70): ScannedGlyph {
  const id = gid++;
  const data = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i * 7 + id * 13) & 255);
  return {
    id,
    box: { x: 100, y: 100, w: 40, h: 40 },
    regionId: 0,
    dots: 0,
    crop: { width: 16, height: 16, data },
    score: { score, tier: tierOf(score), parts: { L: 1, T: 1, S: 1, P: 1 }, char: 'a', scoredAs: 'a', tip: 'super' },
    isNew: true,
  } as unknown as ScannedGlyph;
}

function scene(max = 30, W = 1920): ZauberScene {
  const settings = structuredClone(DEFAULTS);
  settings.game.maxCreatures = max;
  const host = { settings, toast() {}, showCard() {}, progress() {} } as unknown as SceneHost;
  const s = new ZauberScene(host, W, 7);
  return s;
}

const sticker = () => createCanvas(20, 24) as unknown as AnyCanvas;
const add = (s: ZauberScene, kind: ZKind, score = 70) => s.add(kind, glyph(score), sticker());

function run(s: ZauberScene, seconds: number, each?: () => void) {
  for (let t = 0; t < seconds; t += 1 / 30) {
    s.update(1 / 30);
    each?.();
  }
}

describe('Zauberland scene', () => {
  it('rollKind weights', () => {
    const empty = new Castle();
    const n = { fable: 0, princess: 0, part: 0 };
    for (let i = 0; i < 10000; i++) n[rollKind((i + 0.5) / 10000, empty)]++;
    expect(n.fable / 10000).toBeCloseTo(0.4, 1);
    expect(n.princess / 10000).toBeCloseTo(0.3, 1);
    expect(n.part / 10000).toBeCloseTo(0.3, 1);
    const full = new Castle();
    while (!full.full()) full.add(full.nextSlot()!, { q: 0.5, tier: 'nett', glyphId: null });
    const m = { fable: 0, princess: 0, part: 0 };
    for (let i = 0; i < 7000; i++) m[rollKind((i + 0.5) / 7000, full)]++;
    expect(m.part).toBe(0);
    expect(m.fable / 7000).toBeCloseTo(4 / 7, 1);
    for (let id = 1; id <= 12; id++) full.assignRoom(id);
    for (let i = 0; i < 100; i++) expect(rollKind(i / 100, full)).toBe('fable');
  });

  it('a princess walks in and looks out of her own window within 60 s', () => {
    const s = scene();
    const p = add(s, 'princess')!;
    const room = s.castle.roomOf(p.id);
    expect(room).not.toBeNull();
    let sawWindow = false;
    let hidden = 0;
    let longest = 0;
    run(s, 120, () => {
      if (p.state === 'window') {
        sawWindow = true;
        expect(s.castle.owner.get(room!)).toBe(p.id);
      }
      hidden = p.state === 'inside' || p.state === 'window' ? hidden + 1 / 30 : 0;
      longest = Math.max(longest, hidden);
    });
    expect(sawWindow).toBe(true);
    expect(longest).toBeLessThanOrEqual(15);
  });

  it('a princess rides a free unicorn', () => {
    const s = scene();
    const p = add(s, 'princess')!;
    const u = add(s, 'fable')!;
    let rode = false;
    run(s, 150, () => {
      if (s.rider.get(p.id) === u.id) {
        rode = true;
        expect(Math.abs(p.x - u.x)).toBeLessThan(2);
      }
    });
    expect(rode).toBe(true);
  });

  it('every princess gets her own room, also several at once', () => {
    const s = scene();
    const ps = [0, 1, 2, 3, 4].map(() => add(s, 'princess')!);
    const rooms = ps.map((p) => s.castle.roomOf(p.id));
    expect(rooms.every((r) => r !== null && SLOTS[r].kind === 'room')).toBe(true);
    expect(new Set(rooms).size).toBe(5);
  });

  it('leaving princess comes out, dismounts and frees her room', () => {
    const s = scene(1);
    const p = add(s, 'princess')!;
    run(s, 120, () => {});
    // wait until she is inside the castle
    for (let i = 0; i < 30 * 120 && p.state !== 'inside'; i++) s.update(1 / 30);
    expect(p.state).toBe('inside');
    add(s, 'fable');
    const seen: string[] = [];
    run(s, 25, () => {
      if (seen[seen.length - 1] !== p.state) seen.push(p.state);
    });
    expect(seen).toContain('atDoor');
    expect(p.leaving || !s.creatures.includes(p)).toBe(true);
    expect(s.castle.roomOf(p.id)).toBeNull();
  });

  it('leaving unicorn drops its rider and skips the herd', () => {
    const s = scene(2);
    const p = add(s, 'princess')!;
    const u = add(s, 'fable')!;
    for (let i = 0; i < 30 * 200 && s.rider.get(p.id) !== u.id; i++) s.update(1 / 30);
    expect(s.rider.get(p.id)).toBe(u.id);
    // a third creature: the oldest (the princess) must go first, so make the unicorn the oldest instead
    s.creatures.splice(s.creatures.indexOf(u), 1);
    s.creatures.unshift(u);
    add(s, 'fable');
    run(s, 5);
    expect(s.rider.has(p.id)).toBe(false);
    expect(u.leaving || !s.creatures.includes(u)).toBe(true);
    expect(s.herd.members).not.toContain(u.id);
  });

  it('herd of three flies an arc and leaves one rainbow', () => {
    const s = scene();
    const us = [0, 1, 2].map(() => add(s, 'fable')!);
    let flew = false;
    run(s, 90, () => {
      // after the first 0.9 s, in which they glide from where they stood onto the bow
      if (s.herd.phase === 'fly' && s.herd.arc && s.herd.t > 0.9) {
        flew = true;
        expect(s.herd.rainbow?.arc).toBe(s.herd.arc);
        us.forEach((u) => {
          const k = s.herd.members.indexOf(u.id);
          if (k < 0) return;
          const p = arcPoint(s.herd.arc!, s.herd.memberU(k));
          expect(Math.hypot(p.x - u.x, p.y - u.y)).toBeLessThan(40);
        });
      }
    });
    expect(flew).toBe(true);
  });

  it('castle parts are not creatures and never leave', () => {
    const s = scene(2);
    for (let i = 0; i < 20; i++) add(s, 'part');
    run(s, 2);
    expect(s.castle.parts.length).toBe(18);
    // the castle is full after 16 parts; the last letters hatch as fable creatures instead
    expect(s.creatures.filter((c) => !c.leaving).length).toBe(2);
    expect(s.castle.parts.filter((p) => p.glyphId !== null).length).toBe(16);
  });
});

describe('Zauberland review fixes', () => {
  it('a princess riding in the herd stays on her mount through the whole flight', () => {
    const s = scene();
    [0, 1, 2].forEach(() => add(s, 'fable'));
    const p = add(s, 'princess')!;
    for (let i = 0; i < 30 * 100 && s.herd.phase !== 'gather'; i++) s.update(1 / 30);
    expect(s.herd.phase).toBe('gather');
    const m = s.herd.members[0];
    s.rider.set(p.id, m);
    p.state = 'riding';
    p.stateT = 0;
    let flew = false;
    for (let i = 0; i < 30 * 20 && s.herd.phase !== 'land'; i++) {
      s.update(1 / 30);
      if (s.herd.phase === 'fly') flew = true;
      expect(s.rider.get(p.id)).toBe(m);
    }
    expect(flew).toBe(true);
  });

  it('the herd does not jump when the flight starts', () => {
    const s = scene();
    const us = [0, 1, 2, 3].map(() => add(s, 'fable')!);
    for (let i = 0; i < 30 * 100 && s.herd.phase !== 'fly'; i++) {
      const before = us.map((u) => [u.x, u.y]);
      s.update(1 / 30);
      if ((s.herd.phase as string) === 'fly') {
        us.forEach((u, k) => expect(Math.hypot(u.x - before[k][0], u.y - before[k][1])).toBeLessThan(30));
      }
    }
    expect(s.herd.phase).toBe('fly');
    for (let i = 0; i < 30 * 2; i++) {
      const before = us.map((u) => [u.x, u.y]);
      s.update(1 / 30);
      us.forEach((u, k) => expect(Math.hypot(u.x - before[k][0], u.y - before[k][1])).toBeLessThan(40));
    }
  });

  it('a letter that becomes a castle part still shows its stars and rating', () => {
    class PartsOnly extends ZauberScene {
      protected roll(): ZKind {
        return 'part';
      }
    }
    const settings = structuredClone(DEFAULTS);
    const host = { settings, toast() {}, showCard() {}, progress() {} } as unknown as SceneHost;
    const s = new PartsOnly(host, 1920, 1);
    const snap = { canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 640, detH: 480 };
    const g = glyph(80);
    s.handleScan({ glyphs: [g], newSheet: false } as unknown as Parameters<ZauberScene['handleScan']>[0], snap);
    let stars = false;
    for (let i = 0; i < 30 * 6 && !stars; i++) {
      s.update(1 / 30);
      stars = s.particles.list.some((q) => q.kind === 'text' && q.text?.includes('★'));
    }
    expect(s.castle.parts.some((p) => p.glyphId === g.id)).toBe(true);
    expect(stars).toBe(true);
  });
});

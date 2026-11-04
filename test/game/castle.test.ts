import { describe, expect, it } from 'vitest';
import { Castle, castleLayout, doorOf, SLOTS, slotRect, windowOf } from '../../src/game/castle/castle.ts';
import { WORLD_H } from '../../src/game/stage.ts';

const part = { q: 0.5, tier: 'nett' as const, glyphId: 1 };

function supported(c: Castle): boolean {
  return c.parts.every((p) => SLOTS[p.slot].on.every((o) => c.built(o)));
}

describe('castle', () => {
  it('starts with the base room and tower', () => {
    expect(new Castle().parts.map((p) => p.slot)).toEqual([0, 1]);
    expect(SLOTS.length).toBe(18);
    expect(SLOTS.filter((s) => s.kind === 'room').length).toBe(12);
    expect(SLOTS[0].kind).toBe('room');
    expect(SLOTS[1].kind).toBe('tower');
  });

  it('builds in fixed order and never floats', () => {
    const c = new Castle();
    for (let i = 0; i < 16; i++) {
      const s = c.nextSlot();
      expect(s).not.toBeNull();
      expect(SLOTS[s!].on.every((o) => c.built(o))).toBe(true);
      c.add(s!, part);
    }
    expect(c.full()).toBe(true);
    expect(c.nextSlot()).toBeNull();
    expect(supported(c)).toBe(true);
  });

  it('every princess gets her own room, rooms are built when needed', () => {
    const c = new Castle();
    expect(c.assignRoom(10)).toEqual({ slot: 0, built: false });
    const second = c.assignRoom(11)!;
    expect(second.built).toBe(true);
    expect(SLOTS[second.slot].kind).toBe('room');
    const slots = [0, second.slot];
    for (let id = 12; id <= 15; id++) slots.push(c.assignRoom(id)!.slot);
    expect(new Set(slots).size).toBe(6);
    expect(c.owner.size).toBe(6);
    expect(supported(c)).toBe(true);
  });

  it('a room skipped over leaves tower places free for later parts', () => {
    const c = new Castle();
    for (let id = 1; id <= 6; id++) c.assignRoom(id);
    expect(supported(c)).toBe(true);
    const next = c.nextSlot()!;
    const skipped = SLOTS.some((s) => s.kind !== 'room' && !c.built(s.i) && c.parts.some((p) => p.slot > s.i));
    if (skipped) expect(SLOTS[next].kind).not.toBe('room');
    c.add(next, part);
    expect(supported(c)).toBe(true);
  });

  it('twelve rooms, then no more', () => {
    const c = new Castle();
    for (let id = 1; id <= 12; id++) expect(c.assignRoom(id)).not.toBeNull();
    expect(c.assignRoom(13)).toBeNull();
    expect(c.roomsFree()).toBe(0);
    const old = [...c.owner].find(([, id]) => id === 5)![0];
    c.freeRoom(5);
    expect(c.roomsFree()).toBe(1);
    expect(c.assignRoom(13)).toEqual({ slot: old, built: false });
    expect(supported(c)).toBe(true);
  });

  it('round trip', () => {
    const c = new Castle();
    c.assignRoom(3);
    c.assignRoom(4);
    c.add(c.nextSlot()!, { q: 0.9, tier: 'prachtvoll', glyphId: 7 });
    const back = Castle.from(JSON.parse(JSON.stringify(c.export())));
    expect(back.parts).toEqual(c.parts);
    expect([...back.owner]).toEqual([...c.owner]);
  });

  it('fits 1280 and 1920 worlds', () => {
    for (const W of [1280, 1920]) {
      const L = castleLayout(W);
      for (const s of SLOTS) {
        const r = slotRect(L, s);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(W);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.y + r.h).toBeLessThanOrEqual(WORLD_H);
        if (s.kind === 'room') {
          const w = windowOf(L, s.i);
          expect(w.x).toBeGreaterThan(r.x);
          expect(w.x).toBeLessThan(r.x + r.w);
        }
      }
      const base = slotRect(L, SLOTS[0]);
      expect(base.y + base.h).toBeGreaterThanOrEqual(560);
      expect(base.y + base.h).toBeLessThanOrEqual(640);
      const d = doorOf(L);
      expect(d.x).toBeGreaterThan(0);
      expect(d.x).toBeLessThan(W);
      expect(d.y).toBeLessThanOrEqual(640);
    }
  });
});

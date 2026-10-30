import { describe, expect, it } from 'vitest';
import { CARD, flatten, insidePolygon, lineSamples, partPolygons, toCard } from '../../src/game/paint/fishCard.ts';
import { labelsFor, textWidth } from '../../src/game/paint/sheets.ts';
import { ANIMALS, SPECIES, type Motion, type SpeciesId } from '../../src/game/paint/species.ts';
import { polygonArea } from '../../src/vision/geometry.ts';

const SUM_FISCH = 226508.49661076887;

describe('species register', () => {
  it('keeps the fish exactly as printed before', () => {
    expect(SPECIES.fisch.place).toEqual({ s: 0.82, x: 6, y: 12 });
    expect(SPECIES.fisch.parts.map((p) => p.id)).toEqual(['tail', 'dorsal', 'anal', 'pelvic', 'body', 'pectoral']);
    expect(lineSamples('fisch', 1).length).toBe(516);
    // the card detection compares against these points: they must not move
    const sum = lineSamples('fisch', 1).reduce((a, s) => a + s.x * 3 + s.y * 7 + s.nx * 11 + s.ny * 13, 0);
    expect(sum).toBeCloseTo(SUM_FISCH, 4);
  });

  it('lists all animals but the free-form card', () => {
    expect(ANIMALS).toContain('fisch');
    expect(ANIMALS).not.toContain('freiform');
    expect(SPECIES.freiform.parts).toEqual([]);
  });

  it('gives every animal its motion', () => {
    const motion: Record<SpeciesId, Motion> = {
      fisch: 'swim', clownfisch: 'swim', doktorfisch: 'swim', kugelfisch: 'puff', karpfen: 'swim', hecht: 'dart', hai: 'swim',
      seepferdchen: 'bob', qualle: 'pulse', krake: 'arms', schildkroete: 'glide', krebs: 'walk', freiform: 'sway',
    };
    for (const [id, m] of Object.entries(motion)) expect(SPECIES[id as SpeciesId].motion, id).toBe(m);
  });

  it('draws every animal with its own outline', () => {
    const seen = new Map<string, SpeciesId>();
    for (const sp of ANIMALS) {
      for (const p of SPECIES[sp].parts) {
        expect(seen.get(p.d), `${sp}.${p.id}`).toBeUndefined();
        seen.set(p.d, sp);
      }
    }
  });
});

describe.each(ANIMALS)('the %s', (sp) => {
  const def = SPECIES[sp];
  const polys = partPolygons(sp);

  it('stays inside the frame, clear of the texts', () => {
    const lo = CARD.frame + 2;
    const { hint, nameBox } = labelsFor(sp);
    // a millimetre of air above the name box, so a blank card has no name
    const hi = { x: CARD.w - CARD.frame - 2, y: Math.min(CARD.h - CARD.frame - 2, nameBox.y - 1) };
    const hintX0 = hint.x - textWidth(hint.text, hint.size);
    for (const p of def.parts) {
      for (const [ax, ay] of polys[p.id]) {
        const [x, y] = toCard(sp, ax, ay);
        expect(x, `${p.id} x`).toBeGreaterThanOrEqual(lo);
        expect(x, `${p.id} x`).toBeLessThanOrEqual(hi.x);
        expect(y, `${p.id} y`).toBeGreaterThanOrEqual(lo);
        expect(y, `${p.id} y`).toBeLessThanOrEqual(hi.y);
        // not under the "Mal mich bunt an!" in the top right corner
        expect(x < hintX0 || y > hint.y + 1.5, `${p.id} under the hint at (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
      }
    }
  });

  it('has 3 to 6 colouring areas, each big enough for a child', () => {
    expect(def.parts.length).toBeGreaterThanOrEqual(3);
    expect(def.parts.length).toBeLessThanOrEqual(6);
    for (const p of def.parts) {
      expect(flatten(p.d), `${p.id} is one closed outline`).toHaveLength(1);
      const mm = polygonArea(polys[p.id].map(([x, y]) => toCard(sp, x, y)));
      expect(mm, p.id).toBeGreaterThanOrEqual(25);
    }
  });

  it('has its eyes on the animal and a pivot in the box', () => {
    expect(def.eyes.length).toBeGreaterThanOrEqual(1);
    for (const e of def.eyes) {
      expect(Object.values(polys).some((poly) => insidePolygon(poly, e.x, e.y))).toBe(true);
      expect(Math.hypot(e.pupil.x - e.x, e.pupil.y - e.y) + e.pupil.r).toBeLessThan(e.r);
    }
    const ids = def.parts.map((p) => p.id);
    for (const m of def.moving) expect(ids).toContain(m);
    expect(def.moving.length).toBeGreaterThanOrEqual(1);
    const { box, pivot } = def;
    expect(pivot.x).toBeGreaterThanOrEqual(box.x0);
    expect(pivot.x).toBeLessThanOrEqual(box.x1);
    expect(pivot.y).toBeGreaterThanOrEqual(box.y0);
    expect(pivot.y).toBeLessThanOrEqual(box.y1);
    expect(def.size).toBeGreaterThan(0.4);
    expect(def.size).toBeLessThan(2.5);
  });

  it('has a box around all its parts', () => {
    const { box } = def;
    for (const p of def.parts) {
      for (const [x, y] of polys[p.id]) {
        expect(x, p.id).toBeGreaterThanOrEqual(box.x0);
        expect(x, p.id).toBeLessThanOrEqual(box.x1);
        expect(y, p.id).toBeGreaterThanOrEqual(box.y0);
        expect(y, p.id).toBeLessThanOrEqual(box.y1);
      }
    }
  });

  // the jellyfish, the octopus and the crab look at the child; all others look to the right
  const forward = ['qualle', 'krake', 'krebs'].includes(sp);
  it(forward ? 'looks forward, its eyes on the animal' : 'looks to the right', () => {
    for (const e of def.eyes) expect(Object.values(polys).some((poly) => insidePolygon(poly, e.x, e.y))).toBe(true);
    const mean = def.eyes.reduce((s, e) => s + e.x, 0) / def.eyes.length;
    const mid = (def.box.x0 + def.box.x1) / 2;
    if (forward) expect(Math.abs(mean - mid)).toBeLessThan(0.1 * (def.box.x1 - def.box.x0));
    else expect(mean).toBeGreaterThan(mid);
  });
});

import { describe, expect, it } from 'vitest';
import { markTestSvg, TEST_FIELDS } from '../../src/lab/markTestSheet.ts';

describe('mark test sheet', () => {
  it('has 60 dot fields and 2 box fields, each with its own id', () => {
    expect(TEST_FIELDS.filter((f) => f.kind === 'dots').length).toBe(60);
    expect(TEST_FIELDS.filter((f) => f.kind === 'boxes').map((f) => f.id)).toEqual(['kaestchen-hell', 'kaestchen-dunkel']);
    expect(new Set(TEST_FIELDS.map((f) => f.id)).size).toBe(62);
  });

  it('page 1 holds white, row and band, page 2 ruled and squared', () => {
    const papers = (page: number) => new Set(TEST_FIELDS.filter((f) => f.page === page && f.kind === 'dots').map((f) => f.paper));
    expect([...papers(1)].sort()).toEqual(['band', 'weiss', 'zeile']);
    expect([...papers(2)].sort()).toEqual(['kariert', 'liniert']);
  });

  it('every id stands on its page, and the page is A4', () => {
    for (const page of [1, 2] as const) {
      const svg = markTestSvg(page);
      expect(svg).toContain('width="210mm"');
      expect(svg).toContain('height="297mm"');
      for (const f of TEST_FIELDS) if (f.page === page) expect(svg).toContain(`>${f.id}<`);
    }
  });

  it('the pale field has the colour and size of the design', () => {
    const f = TEST_FIELDS.find((x) => x.id === 'weiss-blass-016')!;
    expect(f.color).toBe('#d9dde8');
    expect(f.radius).toBe(0.16);
    expect(markTestSvg(1)).toContain('r="0.16" fill="#d9dde8"');
  });

  it('no field leaves the printable area and none overlap', () => {
    for (const f of TEST_FIELDS) {
      expect(f.box.x).toBeGreaterThanOrEqual(10);
      expect(f.box.y).toBeGreaterThanOrEqual(10);
      expect(f.box.x + f.box.w).toBeLessThanOrEqual(200);
      expect(f.box.y + f.box.h).toBeLessThanOrEqual(287);
      for (const g of TEST_FIELDS) {
        if (f === g || f.page !== g.page) continue;
        const apart = f.box.x + f.box.w <= g.box.x || g.box.x + g.box.w <= f.box.x || f.box.y + f.box.h <= g.box.y || g.box.y + g.box.h <= f.box.y;
        expect(apart).toBe(true);
      }
    }
  });
});

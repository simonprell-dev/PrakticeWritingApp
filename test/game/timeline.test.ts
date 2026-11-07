import { describe, expect, it } from 'vitest';
import { dayOfYear, dragDays, dragEaster, dragRange, easterYear, mmdd } from '../../src/admin/timeline.ts';

describe('admin timeline', () => {
  it('turns days into dates and back', () => {
    expect(dayOfYear('01-01')).toBe(0);
    expect(dayOfYear('12-31')).toBe(364);
    expect(dayOfYear('02-29')).toBe(dayOfYear('02-28'));
    expect(mmdd(dayOfYear('12-31'))).toBe('12-31');
    expect(mmdd(dayOfYear('03-01'))).toBe('03-01');
    for (let d = 0; d < 365; d++) expect(dayOfYear(mmdd(d))).toBe(d);
  });

  it('moving runs over the end of the year', () => {
    expect(dragRange({ from: 360, to: 5 }, 'move', 10)).toEqual({ from: 5, to: 15 });
    expect(dragRange({ from: 3, to: 20 }, 'move', -10)).toEqual({ from: 358, to: 10 });
  });

  it('a time keeps at least one day', () => {
    expect(dragRange({ from: 10, to: 12 }, 'start', 5)).toEqual({ from: 12, to: 12 });
    expect(dragRange({ from: 10, to: 12 }, 'end', -5)).toEqual({ from: 10, to: 10 });
  });

  it('a time is never longer than a year', () => {
    expect(dragRange({ from: 10, to: 300 }, 'end', 200)).toEqual({ from: 10, to: 9 });
    expect(dragRange({ from: 10, to: 300 }, 'start', -200)).toEqual({ from: 301, to: 300 });
  });

  it('the start may be pulled over New Year', () => {
    expect(dragRange({ from: 5, to: 20 }, 'start', -10)).toEqual({ from: 360, to: 20 });
  });

  it('Easter days stay between 0 and 60', () => {
    expect(dragEaster({ before: 14, after: 1 }, 'start', -3)).toEqual({ before: 17, after: 1 });
    expect(dragEaster({ before: 14, after: 1 }, 'end', 5)).toEqual({ before: 14, after: 6 });
    expect(dragEaster({ before: 14, after: 1 }, 'move', 2)).toEqual({ before: 12, after: 3 });
    expect(dragEaster({ before: 2, after: 1 }, 'start', 10)).toEqual({ before: 0, after: 1 });
    expect(dragEaster({ before: 58, after: 1 }, 'start', -10)).toEqual({ before: 60, after: 1 });
    expect(dragEaster({ before: 1, after: 59 }, 'move', 5)).toEqual({ before: 0, after: 60 });
  });
});

describe('dragging keeps exact dates', () => {
  it('a drag of no day changes nothing, not even the 29th of February', () => {
    for (const kind of ['start', 'end', 'move'] as const) expect(dragDays({ from: '12-01', to: '02-29' }, kind, 0)).toEqual({ from: '12-01', to: '02-29' });
  });

  it('moving there and back keeps the 29th of February', () => {
    expect(dragDays({ from: '12-01', to: '02-29' }, 'move', 0)).toEqual({ from: '12-01', to: '02-29' });
    expect(dragDays({ from: '12-01', to: '02-29' }, 'move', 3)).toEqual({ from: '12-04', to: '03-03' });
    expect(dragDays({ from: '12-01', to: '02-29' }, 'start', 3)).toEqual({ from: '12-04', to: '02-29' });
  });
});

describe('Easter in the admin', () => {
  it('moving keeps the length at the limits', () => {
    expect(dragEaster({ before: 14, after: 1 }, 'move', 20)).toEqual({ before: 0, after: 15 });
    expect(dragEaster({ before: 55, after: 1 }, 'move', -20)).toEqual({ before: 56, after: 0 });
  });

  it('shows the next Easter once this one is over', () => {
    expect(easterYear({ before: 14, after: 1 }, new Date(2026, 10, 7))).toBe(2027);
    expect(easterYear({ before: 14, after: 1 }, new Date(2026, 1, 1))).toBe(2026);
    expect(easterYear({ before: 14, after: 1 }, new Date(2026, 3, 6))).toBe(2026);
    expect(easterYear({ before: 14, after: 1 }, new Date(2026, 3, 7))).toBe(2027);
  });
});

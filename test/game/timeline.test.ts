import { describe, expect, it } from 'vitest';
import { dayOfYear, dragEaster, dragRange, mmdd } from '../../src/admin/timeline.ts';

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

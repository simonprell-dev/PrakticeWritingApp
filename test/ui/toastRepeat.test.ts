import { describe, expect, it } from 'vitest';
import { isRepeat } from '../../src/ui/toast.ts';

describe('the same hint twice', () => {
  it('a hint right at the start of the page is shown (nothing was shown before)', () => {
    expect(isRepeat(undefined, 200)).toBe(false);
  });

  it('the same hint again within 1.5 s is left out, later it is shown', () => {
    expect(isRepeat(1000, 2000)).toBe(true);
    expect(isRepeat(1000, 2600)).toBe(false);
  });
});

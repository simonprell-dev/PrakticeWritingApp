import { describe, expect, it } from 'vitest';
import { MIN_PLAY_MS, shouldAsk } from '../../src/ui/feedbackLight.ts';

describe('when the feedback light comes after a game', () => {
  it('after a game played for a while, once', () => {
    expect(shouldAsk(true, MIN_PLAY_MS + 1, false)).toBe(true);
    expect(shouldAsk(true, MIN_PLAY_MS + 1, true)).toBe(false);
  });

  it('not after a game only looked into', () => {
    expect(shouldAsk(true, MIN_PLAY_MS - 1, false)).toBe(false);
  });

  it('not when it is switched off in the settings', () => {
    expect(shouldAsk(false, 10 * MIN_PLAY_MS, false)).toBe(false);
  });
});

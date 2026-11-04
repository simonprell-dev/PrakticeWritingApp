import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULTS, loadSettings } from '../../src/app/settings.ts';
import { MODES } from '../../src/app/saves.ts';
import { rechenVisionPatch } from '../../src/scenes/rechenmeer.ts';

function stored(value: unknown) {
  const mem = new Map<string, string>([['buchstaben-zoo.settings', JSON.stringify(value)]]);
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
}

describe('Rechenmeer settings', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loadSettings fills math.kinds; empty or unknown kinds fall back to the default', () => {
    stored({ version: 1 });
    expect(loadSettings().math.kinds).toEqual(['plus20', 'minus20']);
    stored({ version: 1, math: { kinds: [] } });
    expect(loadSettings().math.kinds).toEqual(['plus20', 'minus20']);
    stored({ version: 1, math: { kinds: ['quatsch', 'mal', 'mal'] } });
    expect(loadSettings().math.kinds).toEqual(['mal']);
    stored({ version: 1, math: { kinds: 'mal' } });
    expect(loadSettings().math.kinds).toEqual(['plus20', 'minus20']);
  });

  it('visionOptions in the Rechenmeer: digits, mirrored digits count, a script with digits', () => {
    const s = structuredClone(DEFAULTS);
    s.recog.noMirror = true;
    expect(rechenVisionPatch(s)).toEqual({ digits: true, noMirror: false, script: 'druck' });
    s.script = 'grund';
    expect(rechenVisionPatch(s).script).toBe('grund');
    s.script = 'arabisch';
    expect(rechenVisionPatch(s).script).toBe('druck');
  });

  it('the Rechenmeer is a game mode with its own icon', () => {
    expect(MODES.rechenmeer).toEqual({ icon: '🐬', title: 'Rechenmeer' });
  });
});

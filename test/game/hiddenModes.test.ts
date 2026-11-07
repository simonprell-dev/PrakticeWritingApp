import { describe, expect, it, vi } from 'vitest';
import { FORMAT, MODES, modeAvailable, readSaveFile, visibleSaves, type GameMode, type SaveMeta } from '../../src/app/saves.ts';
import { SEASONAL, type WorldId } from '../../src/app/worlds.ts';

const meta = (mode: GameMode, savedAt: number) => ({ id: mode, name: mode, mode, savedAt, auto: true, summary: '' }) as SaveMeta;

describe('hidden game modes', () => {
  it('hidden modes do not appear in the saves', () => {
    expect(visibleSaves([meta('rechenmeer', 2), meta('meer', 1)]).map((m) => m.mode)).toEqual(['meer']);
  });

  it('the Rechenmeer is off, every other mode stays', () => {
    expect(modeAvailable('rechenmeer')).toBe(false);
    for (const m of Object.keys(MODES) as GameMode[]) if (m !== 'rechenmeer' && !SEASONAL.has(m as WorldId)) expect(modeAvailable(m)).toBe(true);
  });

  it('a Rechenmeer save file is refused like a foreign file', async () => {
    const f = { text: async () => JSON.stringify({ format: FORMAT, version: 1, mode: 'rechenmeer', state: {} }) } as File;
    await expect(readSaveFile(f)).rejects.toThrow();
  });

  it('a save file of another mode still loads', async () => {
    const f = { text: async () => JSON.stringify({ format: FORMAT, version: 1, mode: 'meer', state: {} }) } as File;
    await expect(readSaveFile(f)).resolves.toMatchObject({ mode: 'meer' });
  });
});

describe('save files of other times', () => {
  const file = (mode: string) => ({ text: async () => JSON.stringify({ format: FORMAT, version: 1, mode, state: {} }) }) as File;

  it('a file of a world out of its time says the world comes back', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 11, 10));
    try {
      await expect(readSaveFile(file('halloween'))).rejects.toThrow(/Jahreszeit/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a mode that is a name of every object is no mode', async () => {
    await expect(readSaveFile(file('toString'))).rejects.toThrow(/keine Spielstand-Datei/);
  });
});

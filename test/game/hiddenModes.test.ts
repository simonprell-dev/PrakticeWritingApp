import { describe, expect, it } from 'vitest';
import { FORMAT, MODES, modeAvailable, readSaveFile, visibleSaves, type GameMode, type SaveMeta } from '../../src/app/saves.ts';

const meta = (mode: GameMode, savedAt: number) => ({ id: mode, name: mode, mode, savedAt, auto: true, summary: '' }) as SaveMeta;

describe('hidden game modes', () => {
  it('hidden modes do not appear in the saves', () => {
    expect(visibleSaves([meta('rechenmeer', 2), meta('meer', 1)]).map((m) => m.mode)).toEqual(['meer']);
  });

  it('the Rechenmeer is off, every other mode stays', () => {
    expect(modeAvailable('rechenmeer')).toBe(false);
    for (const m of Object.keys(MODES) as GameMode[]) if (m !== 'rechenmeer') expect(modeAvailable(m)).toBe(true);
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

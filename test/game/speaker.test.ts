import { describe, expect, it } from 'vitest';
import { hushAll, Speaker, voiceSources, type SpeakerDeps } from '../../src/game/voice/speaker.ts';
import { voiceId } from '../../src/game/voiceId.ts';
import { pieceFile, sentenceFile } from '../../src/game/voice/pieces.ts';

function fake(available: Set<string>, opts: { lang?: string; volume?: number; files?: string[] | null } = {}) {
  const log: string[] = [];
  const deps: SpeakerDeps = {
    lang: () => opts.lang ?? 'de',
    volume: () => opts.volume ?? 1,
    translate: (k) => `[${opts.lang ?? 'de'}] ${k}`,
    async play(url) {
      if (!available.has(url)) return false;
      log.push(`play ${url}`);
      return true;
    },
    async tts(text, lang, voice) {
      log.push(`tts ${lang} ${voice} ${text}`);
    },
    halt() {
      log.push('halt');
    },
    async files() {
      return opts.files === null ? null : new Set(opts.files ?? []);
    },
    preload() {},
  };
  return { deps, log };
}

const id = voiceId('Hallo Kinder!');

describe('voice sources', () => {
  it('German has the recording first, then the generated voice', () => {
    expect(voiceSources('Hallo Kinder!', 'de')).toEqual([`/voice/${id}.wav`, `/voice/ai/de/${id}.mp3`]);
  });

  it('other languages only have the generated voice', () => {
    expect(voiceSources('Hallo Kinder!', 'fr')).toEqual([`/voice/ai/fr/${id}.mp3`]);
  });
});

describe('speaker', () => {
  it('a recording wins over the generated voice', async () => {
    const { deps, log } = fake(new Set([`/voice/${id}.wav`, `/voice/ai/de/${id}.mp3`]));
    await new Speaker(deps).run([{ key: 'Hallo Kinder!', voice: 'erzaehler' }]);
    expect(log).toEqual([`play /voice/${id}.wav`]);
  });

  it('without a recording the generated voice speaks', async () => {
    const { deps, log } = fake(new Set([`/voice/ai/de/${id}.mp3`]));
    await new Speaker(deps).run([{ key: 'Hallo Kinder!', voice: 'erzaehler' }]);
    expect(log).toEqual([`play /voice/ai/de/${id}.mp3`]);
  });

  it('without any file the browser reads the translated text', async () => {
    const { deps, log } = fake(new Set(), { lang: 'fr' });
    await new Speaker(deps).run([{ key: 'Hallo Kinder!', voice: 'flocke' }]);
    expect(log).toEqual(['tts fr flocke [fr] Hallo Kinder!']);
  });

  it('reads the lines one after the other', async () => {
    const { deps, log } = fake(new Set());
    await new Speaker(deps).run([
      { key: 'Eins.', voice: 'erzaehler' },
      { key: 'Zwei!', voice: 'wesen' },
    ]);
    expect(log).toEqual(['tts de erzaehler [de] Eins.', 'tts de wesen [de] Zwei!']);
  });

  it('tells which line comes next, right before it is read', async () => {
    const { deps, log } = fake(new Set());
    await new Speaker(deps).run(
      [
        { key: 'Eins.', voice: 'erzaehler' },
        { key: 'Zwei!', voice: 'wesen' },
      ],
      (i) => log.push(`line ${i}`),
    );
    expect(log).toEqual(['line 0', 'tts de erzaehler [de] Eins.', 'line 1', 'tts de wesen [de] Zwei!']);
  });

  it('with the sound off no line is announced', async () => {
    const seen: number[] = [];
    const { deps } = fake(new Set(), { volume: 0 });
    await new Speaker(deps).run([{ key: 'Eins.', voice: 'erzaehler' }], (i) => seen.push(i));
    expect(seen).toEqual([]);
  });

  it('a stopped run announces no further line', async () => {
    const seen: number[] = [];
    const { deps } = fake(new Set());
    const s = new Speaker(deps);
    const p = s.run(
      [
        { key: 'Eins.', voice: 'erzaehler' },
        { key: 'Zwei.', voice: 'erzaehler' },
      ],
      (i) => seen.push(i),
    );
    s.stop();
    await p;
    expect(seen).toEqual([0]);
  });

  it('a missing file is not asked for twice', async () => {
    const asked: string[] = [];
    const { deps } = fake(new Set());
    const s = new Speaker({ ...deps, play: async (url) => (asked.push(url), false) });
    await s.run([{ key: 'Hallo Kinder!', voice: 'erzaehler' }]);
    await s.run([{ key: 'Hallo Kinder!', voice: 'erzaehler' }]);
    expect(asked).toEqual([`/voice/${id}.wav`, `/voice/ai/de/${id}.mp3`]);
  });

  it('with the sound off nothing is said', async () => {
    const { deps, log } = fake(new Set([`/voice/${id}.wav`]), { volume: 0 });
    await new Speaker(deps).run([{ key: 'Hallo Kinder!', voice: 'erzaehler' }]);
    expect(log).toEqual([]);
  });

  it('a new run stops the one before after its current line', async () => {
    const { deps, log } = fake(new Set());
    const s = new Speaker(deps);
    const first = s.run([
      { key: 'Eins.', voice: 'erzaehler' },
      { key: 'Zwei.', voice: 'erzaehler' },
      { key: 'Drei.', voice: 'erzaehler' },
    ]);
    const second = s.run([{ key: 'Neu!', voice: 'flocke' }]);
    await Promise.all([first, second]);
    expect(log).not.toContain('tts de erzaehler [de] Drei.');
    expect(log).toContain('tts de flocke [de] Neu!');
    expect(log).toContain('halt');
  });

  it('stop ends a run', async () => {
    const { deps, log } = fake(new Set());
    const s = new Speaker(deps);
    const p = s.run([
      { key: 'Eins.', voice: 'erzaehler' },
      { key: 'Zwei.', voice: 'erzaehler' },
    ]);
    s.stop();
    await p;
    expect(log.filter((l) => l.startsWith('tts')).length).toBeLessThanOrEqual(1);
  });
});

describe('the mute button', () => {
  it('hushes every speaker at once', async () => {
    const { deps, log } = fake(new Set());
    const a = new Speaker(deps);
    const b = new Speaker(deps);
    const pa = a.run([
      { key: 'Eins.', voice: 'erzaehler' },
      { key: 'Zwei.', voice: 'erzaehler' },
    ]);
    const pb = b.run([
      { key: 'Drei.', voice: 'flocke' },
      { key: 'Vier.', voice: 'flocke' },
    ]);
    hushAll();
    await Promise.all([pa, pb]);
    expect(log.filter((l) => l === 'halt').length).toBeGreaterThanOrEqual(2);
    expect(log).not.toContain('tts de erzaehler [de] Zwei.');
    expect(log).not.toContain('tts de flocke [de] Vier.');
  });
});

describe('a text with a filled gap', () => {
  const line = {
    key: 'Mauer {n} geschafft!',
    voice: 'riese' as const,
    text: 'Mauer 3 geschafft!',
    gap: true,
    pieces: [
      { text: 'Mauer', gap: false },
      { text: '3', gap: true },
      { text: 'geschafft!', gap: false },
    ],
  };
  const url = (f: string) => `/voice/ai/de/${f}.mp3`;
  const all = [sentenceFile('Mauer 3 geschafft!'), pieceFile('riese', 'Mauer'), pieceFile('riese', '3'), pieceFile('riese', 'geschafft!')];

  it('a whole sentence made for it comes first', async () => {
    const { deps, log } = fake(new Set(all.map(url)), { files: all });
    await new Speaker(deps).run([line]);
    expect(log).toEqual([`play ${url(all[0])}`]);
  });

  it('else it is put together from its pieces', async () => {
    const { deps, log } = fake(new Set(all.map(url)), { files: all.slice(1) });
    await new Speaker(deps).run([line]);
    expect(log).toEqual(all.slice(1).map((f) => `play ${url(f)}`));
  });

  it('a value without a file is read by the browser, the rest from the files', async () => {
    const files = [all[1], all[3]];
    const { deps, log } = fake(new Set(all.map(url)), { files });
    await new Speaker(deps).run([line]);
    expect(log).toEqual([`play ${url(all[1])}`, 'tts de riese 3', `play ${url(all[3])}`]);
  });

  it('a fixed part without a file: the browser reads the whole text, no mix of voices', async () => {
    const { deps, log } = fake(new Set(all.map(url)), { files: [all[1], all[2]] });
    await new Speaker(deps).run([line]);
    expect(log).toEqual(['tts de riese Mauer 3 geschafft!']);
  });

  it('without a list of files the browser reads the whole text', async () => {
    const { deps, log } = fake(new Set(all.map(url)), { files: null });
    await new Speaker(deps).run([line]);
    expect(log).toEqual(['tts de riese Mauer 3 geschafft!']);
  });
});

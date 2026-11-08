// The Wörter-Zoo scene: a picture, the written word on the writing line, "Fast!" and "Daneben", the help
// levels, the zoo and the saved game.
import { createCanvas, loadImage, Path2D } from '@napi-rs/canvas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanWoerter, DEFAULTS, WORD_LETTERS, type Settings } from '../../src/app/settings.ts';
import { setCanvasFactory, type AnyCanvas } from '../../src/game/canvas.ts';
import { usable, WORDS } from '../../src/game/words/words.ts';
import { tierOf } from '../../src/recog/score.ts';
import type { SceneHost, Snapshot } from '../../src/scenes/scene.ts';
import { fieldLayout, makeTag, woerterzoo, WoerterZooScene, zooSlots } from '../../src/scenes/woerterzoo.ts';
import { wordsOffered, wordsPossible } from '../../src/ui/woerterLobby.ts';
import type { ScanResult, ScannedGlyph } from '../../src/vision/types.ts';

beforeAll(() => setCanvasFactory((w, h) => createCanvas(w, h) as unknown as AnyCanvas, Path2D as unknown as typeof globalThis.Path2D));

let gid = 1;
/** a word written in one line: one glyph per letter, left to right */
function written(word: string, score = 80, y = 200): ScannedGlyph[] {
  return [...word].map((char, i) => {
    const id = gid++;
    const data = new Uint8ClampedArray(16 * 16 * 4).map((_, k) => (k % 4 === 3 ? 255 : (k * 7 + id * 13) & 255));
    const tall = char !== char.toLowerCase() || 'bdfhklt'.includes(char);
    return {
      id,
      box: { x: 100 + i * 52, y: tall ? y : y + 20, w: 40, h: tall ? 60 : 40 },
      regionId: 0,
      dots: 0,
      crop: { width: 16, height: 16, data },
      score: { score, tier: tierOf(score), parts: { L: 1, T: 1, S: 1, P: 1 }, char, scoredAs: char, tip: 'super' },
      isNew: true,
    } as unknown as ScannedGlyph;
  });
}

const snap = (): Snapshot => ({ canvas: createCanvas(640, 480) as unknown as AnyCanvas, detW: 1280, detH: 960 });
const res = (glyphs: ScannedGlyph[]) => ({ glyphs, newSheet: false }) as unknown as ScanResult;

function scene(woerter: Partial<Settings['woerter']> = {}, seed = 1) {
  const settings = structuredClone(DEFAULTS);
  settings.woerter = { ...settings.woerter, ...woerter };
  const toasts: string[] = [];
  const host = { settings, toast: (t: string) => toasts.push(t), showCard() {}, progress() {} } as unknown as SceneHost;
  const s = new WoerterZooScene(host, 1920, seed);
  return { s, toasts };
}

function run(s: WoerterZooScene, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 30) s.update(1 / 30);
}

/** waits until the next picture is asked */
function finish(s: WoerterZooScene) {
  for (let t = 0; t < 20 && (s.phase !== 'ask' || s.fx.flights.length); t += 1 / 30) s.update(1 / 30);
}

/** writes a word and waits until its letters landed on the writing line */
function write(s: WoerterZooScene, word: string, score = 80) {
  s.handleScan(res(written(word, score)), snap());
  run(s, 2.5);
}

describe('Wörter-Zoo', () => {
  it('starts with an easy word and asks for it', () => {
    const { s } = scene();
    expect(s.word.level).toBe(1);
    run(s, 1);
    expect(s.phase).toBe('ask');
    expect(s.caption).toBe(s.word.word);
  });

  it('the right word comes alive and moves into the zoo, then the next picture comes', () => {
    const { s } = scene();
    run(s, 1);
    const first = s.word.word;
    write(s, first, 95);
    expect(s.phase).toBe('alive');
    expect(s.done?.entry.tier).toBe('prachtvoll');
    expect(s.field.every((f) => f.landed)).toBe(true);
    finish(s);
    expect(s.zoo.map((e) => e.word.word)).toEqual([first]);
    expect(s.zoo[0].letters).toHaveLength(first.length);
    expect(s.word.word).not.toBe(first);
    expect(s.phase).toBe('ask');
    expect(s.countText()).toBe('1 Wort im Zoo');
  });

  it('the quality is the mean of the letters', () => {
    const { s } = scene();
    run(s, 1);
    const w = s.word.word;
    const gs = written(w, 40);
    gs[0].score.score = 100;
    s.handleScan(res(gs), snap());
    run(s, 2);
    const mean = (100 + 40 * (w.length - 1)) / w.length;
    expect(s.done?.entry.score).toBeCloseTo(mean);
    expect(s.done?.entry.tier).toBe(tierOf(mean));
  });

  it('one wrong letter: "Fast!" with the place, and the same word stays', () => {
    const { s } = scene();
    run(s, 1);
    const w = s.word.word;
    const wrong = w.slice(0, -1) + (w.endsWith('x') ? 'y' : 'x');
    write(s, wrong);
    expect(s.feedback).toMatchObject({ kind: 'fast', reason: 'buchstabe', at: w.length - 1, written: wrong });
    expect(s.tries).toBe(1);
    expect(s.word.word).toBe(w);
    expect(s.phase).toBe('ask');
    expect(s.zoo).toHaveLength(0);
  });

  it('a small first letter: names of things are written with a capital', () => {
    const { s } = scene();
    run(s, 1);
    // a word whose first letter looks different small and big
    s.word = WORDS.find((x) => x.word === 'Hund')!;
    write(s, 'hund');
    expect(s.feedback).toMatchObject({ kind: 'fast', reason: 'gross', at: 0 });
  });

  it('after the third "Fast" the word counts anyway', () => {
    const { s } = scene();
    run(s, 1);
    const w = s.word.word;
    const wrong = w + 'x';
    write(s, wrong);
    write(s, wrong);
    expect(s.tries).toBe(2);
    expect(s.phase).toBe('ask');
    write(s, wrong);
    expect(s.phase).toBe('alive');
    expect(s.done?.counted).toBe(true);
    finish(s);
    expect(s.zoo.map((e) => e.word.word)).toEqual([w]);
    expect(s.tries).toBe(0);
  });

  it('far off: "Schau nochmal genau hin!", the word stays', () => {
    const { s } = scene();
    run(s, 1);
    const w = s.word.word;
    write(s, 'Qqqqqqq');
    expect(s.feedback?.kind).toBe('daneben');
    expect(s.tries).toBe(0);
    expect(s.word.word).toBe(w);
  });

  it('letters far apart or in another line: the longest group in one line is the word', () => {
    const { s } = scene();
    run(s, 1);
    const w = s.word.word;
    const stray = written('Z', 80, 600);
    s.handleScan(res([...stray, ...written(w)]), snap());
    run(s, 2);
    expect(s.phase).toBe('alive');
  });

  it('nothing new on the paper is no try', () => {
    const { s, toasts } = scene();
    run(s, 1);
    s.handleScan(res([]), snap());
    run(s, 2);
    expect(s.feedback).toBeNull();
    expect(toasts.length).toBe(1);
  });

  it('only words of the letters the class knows', () => {
    const known = 'amoisel';
    const { s } = scene({ known });
    const k = new Set(known);
    for (let i = 0; i < 6; i++) {
      run(s, 1);
      expect(usable(s.word, k)).toBe(true);
      write(s, s.word.word);
      finish(s);
    }
    expect(s.zoo).toHaveLength(6);
    expect(s.zoo.every((e) => usable(e.word, k))).toBe(true);
  });

  it('no word fits the letters: all words come', () => {
    const { s } = scene({ known: 'x' });
    expect(WORDS.map((w) => w.word)).toContain(s.word.word);
  });

  it('help 2: the word is covered after 5 seconds, a tap uncovers it', () => {
    const { s } = scene({ help: 2 });
    run(s, 1);
    expect(s.covered).toBe(false);
    expect(s.caption).toBe(s.word.word);
    run(s, 5);
    expect(s.covered).toBe(true);
    expect(s.caption).toBe('');
    // the caption at the bottom of the card
    expect(s.tap(1920 / 2, 24 + 444)).toBe(true);
    expect(s.covered).toBe(false);
    run(s, 6);
    expect(s.covered).toBe(true);
    // far off: the word comes back for a moment
    write(s, 'Qqqqqqq');
    expect(s.covered).toBe(false);
  });

  it('help 3: only the picture; the first letter on demand', () => {
    const { s } = scene({ help: 3 });
    run(s, 1);
    expect(s.caption).toBe('');
    expect(s.syllables).toBe(s.word.syllables.join(' – '));
    // the button at the right of the caption
    expect(s.tap(1920 / 2 + 440 / 2 - 54, 24 + 444)).toBe(true);
    expect(s.caption.startsWith(s.word.word[0])).toBe(true);
    expect(s.caption).not.toBe(s.word.word);
  });

  it('a game comes back with its zoo, its name signs and the word asked', async () => {
    vi.stubGlobal('createImageBitmap', async (blob: Blob) => Object.assign(await loadImage(Buffer.from(await blob.arrayBuffer())), { close() {} }));
    try {
      const { s } = scene({}, 3);
      for (let i = 0; i < 3; i++) {
        run(s, 1);
        write(s, s.word.word, 50 + i * 20);
        finish(s);
      }
      run(s, 1);
      write(s, s.word.word + 'x');
      const asked = s.word.word;
      const saved = await s.saveState();
      expect(saved!.summary).toBe('3 Wörter im Zoo');
      const { s: again } = scene({}, 4);
      await again.restoreState(JSON.parse(JSON.stringify(saved!.state)));
      expect(again.zoo.map((e) => e.word.word)).toEqual(s.zoo.map((e) => e.word.word));
      expect(again.zoo.map((e) => e.tier)).toEqual(s.zoo.map((e) => e.tier));
      expect(again.zoo.every((e, i) => e.letters.length === s.zoo[i].letters.length)).toBe(true);
      expect(again.zoo[0].letters[0].glyph.id).toBeGreaterThan(1e9);
      expect(again.word.word).toBe(asked);
      expect(again.tries).toBe(1);
      expect(again.seen).toEqual(s.seen);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('an empty zoo is nothing to keep', async () => {
    const { s } = scene();
    expect(await s.saveState()).toBeNull();
  });

  it('30 seconds with a full zoo: everything moves, nothing becomes NaN', () => {
    const { s } = scene({}, 9);
    for (let i = 0; i < 26; i++) {
      run(s, 1);
      write(s, s.word.word, (i * 37) % 100);
      finish(s);
    }
    expect(s.zoo.length).toBe(26);
    const cv = createCanvas(1920, 1080);
    const ctx = cv.getContext('2d') as unknown as CanvasRenderingContext2D;
    for (let t = 0; t < 30; t += 1 / 30) {
      s.update(1 / 30);
      if (Math.round(t * 30) % 90 === 0) s.render(ctx);
    }
    for (const e of s.zoo) {
      expect(Number.isFinite(e.x) && Number.isFinite(e.y) && Number.isFinite(e.k)).toBe(true);
      expect(e.x).toBeGreaterThan(0);
      expect(e.x).toBeLessThan(1920);
    }
    // tapping an animal makes it jump and talk
    const e = s.zoo[0];
    expect(s.tap(e.x, e.y - 150 * e.k)).toBe(true);
    s.resize(1440);
    run(s, 5);
    for (const z of s.zoo) expect(z.x).toBeLessThan(1440);
  });

  it('draws the scene, the tile and the name signs', () => {
    const { s } = scene({ help: 3 });
    run(s, 1);
    const cv = createCanvas(1920, 1080);
    s.render(cv.getContext('2d') as unknown as CanvasRenderingContext2D);
    const tile = createCanvas(480, 360);
    woerterzoo.tile!(tile.getContext('2d') as unknown as CanvasRenderingContext2D, 480, 360, undefined as never);
    for (const tier of ['zerknittert', 'schief', 'nett', 'schoen', 'prachtvoll'] as const) {
      const tag = makeTag([], 'Hund', tier);
      expect(tag.width).toBeGreaterThan(60);
    }
  });
});

describe('Wörter-Zoo layout', () => {
  it('the letters stand on the writing line as they were written', () => {
    const F = { x: 100, y: 500, w: 600, h: 112 };
    const r = fieldLayout(written('Hund'), F);
    expect(r).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(r[i].x).toBeGreaterThan(r[i - 1].x);
    // all sit on the base line, the capital reaches up near the top line, the small ones fill the middle band
    for (const q of r) expect(q.y + q.h).toBeCloseTo(500 + 72);
    expect(r[0].y).toBeLessThan(500 + 30);
    expect(r[1].y).toBeCloseTo(500 + 44, -1);
    expect(Math.min(...r.map((q) => q.x))).toBeGreaterThanOrEqual(F.x);
    expect(Math.max(...r.map((q) => q.x + q.w))).toBeLessThanOrEqual(F.x + F.w);
  });

  it('many entries stand closer and smaller, inside the zoo', () => {
    const few = zooSlots(4, 1920);
    const many = zooSlots(60, 1920);
    expect(many[0].k).toBeLessThan(few[0].k);
    for (const p of many) {
      expect(p.x).toBeLessThan(1920);
      expect(p.y).toBeLessThan(1080);
    }
  });
});

describe('Wörter-Zoo settings', () => {
  it('old or broken settings get the defaults', () => {
    expect(cleanWoerter(undefined)).toEqual({ help: 1, known: WORD_LETTERS });
    expect(cleanWoerter({ help: 7, known: 42 })).toEqual({ help: 1, known: WORD_LETTERS });
    expect(cleanWoerter({ help: 3, known: 'MAMx!a' })).toEqual({ help: 3, known: 'amx' });
    expect(cleanWoerter({ help: 2, known: '' })).toEqual({ help: 2, known: WORD_LETTERS });
  });

  it('the lobby counts the words the letters allow', () => {
    expect(wordsPossible(WORD_LETTERS)).toBe(WORDS.length);
    expect(wordsPossible('')).toBe(0);
    expect(wordsPossible('amo')).toBeGreaterThanOrEqual(2);
  });

  it('the tile is there on a German page with a Latin script only', () => {
    expect(wordsOffered('druck', 'de')).toBe(true);
    expect(wordsOffered('grund', 'de')).toBe(true);
    expect(wordsOffered('druck', 'en')).toBe(false);
    expect(wordsOffered('hiragana', 'de')).toBe(false);
  });
});

beforeEach(() => {
  gid = 1;
});
afterEach(() => vi.unstubAllGlobals());

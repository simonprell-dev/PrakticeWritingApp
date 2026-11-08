// Reads texts aloud. For every text the best voice there is: a recording made with voice.html
// (public/voice/<id>.wav, German), else a voice generated on the operator's machine with Piper
// (public/voice/ai/<lang>/<id>.mp3, tools/voice-ai.py), else the browser's own speech. The file name comes
// from the German text (voiceId), so a recording belongs to exactly one text.
import { soundVolume } from '../audio.ts';
import { language, t } from '../../i18n/i18n.ts';
import { voiceId } from '../voiceId.ts';
import { pieceFile, sentenceFile, type Piece } from './pieces.ts';

/** the speakers of the game (the roles of voice/SPRECHERTEXT.md) */
export type Voice = 'erzaehler' | 'flocke' | 'wesen' | 'riese' | 'zork' | 'blase' | 'ausruf' | 'buchstaben';

export interface Line {
  /** the German text (translation key, also the file name) */
  key: string;
  voice: Voice;
  /** the text as shown, read by the browser when there is no file */
  text?: string;
  /** a text with a filled gap (a name, a number): said as a whole sentence made for it, or in pieces */
  gap?: boolean;
  /** the pieces of such a text (pieces.ts) */
  pieces?: Piece[];
}

export interface SpeakerDeps {
  lang(): string;
  /** 0 while the sound is off */
  volume(): number;
  translate(key: string): string;
  /** plays a file to its end; false when it cannot be loaded */
  play(url: string, volume: number): Promise<boolean>;
  /** the browser's speech; resolves when done */
  tts(text: string, lang: string, voice: Voice, volume: number): Promise<void>;
  /** stops whatever is playing or speaking */
  halt(): void;
  /** the generated files of a language (its manifest, without .mp3), null when the list cannot be loaded */
  files(lang: string): Promise<Set<string> | null>;
  /** starts loading a file that is played soon (no gap between pieces) */
  preload(url: string): void;
}

/** the files that may hold a text, best first */
export function voiceSources(key: string, lang: string): string[] {
  const id = voiceId(key);
  return [...(lang === 'de' ? [`/voice/${id}.wav`] : []), `/voice/ai/${lang}/${id}.mp3`];
}

/** how the browser's speech sounds for each voice */
const TTS: Record<Voice, { pitch: number; rate: number }> = {
  erzaehler: { pitch: 1, rate: 0.92 },
  flocke: { pitch: 1.5, rate: 1 },
  riese: { pitch: 0.55, rate: 0.85 },
  zork: { pitch: 1.7, rate: 1.12 },
  blase: { pitch: 1.3, rate: 0.95 },
  ausruf: { pitch: 1.2, rate: 1 },
  buchstaben: { pitch: 1, rate: 0.85 },
  wesen: { pitch: 1.35, rate: 1.02 },
};

const LOCALE: Record<string, string> = {
  de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', it: 'it-IT', pt: 'pt-PT', nl: 'nl-NL', pl: 'pl-PL', tr: 'tr-TR',
  uk: 'uk-UA', ru: 'ru-RU', el: 'el-GR', he: 'he-IL', ar: 'ar-SA', hi: 'hi-IN', th: 'th-TH', ko: 'ko-KR', ja: 'ja-JP',
};

function browserDeps(): SpeakerDeps {
  let audio: HTMLAudioElement | null = null;
  const lists = new Map<string, Promise<Set<string> | null>>();
  const loaded = new Map<string, HTMLAudioElement>();
  return {
    files(lang) {
      let p = lists.get(lang);
      if (!p) {
        p = fetch(`/voice/ai/${lang}/manifest.json`)
          .then((r) => (r.ok ? r.json() : null))
          .then((m: Record<string, string> | null) => (m ? new Set(Object.keys(m)) : null))
          .catch(() => null);
        lists.set(lang, p);
      }
      return p;
    },
    preload(url) {
      if (typeof Audio === 'undefined' || loaded.has(url)) return;
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      loaded.set(url, a);
      if (loaded.size > 60) loaded.delete(loaded.keys().next().value!);
    },
    lang: language,
    volume: soundVolume,
    translate: (k) => t(k),
    play(url, volume) {
      return new Promise((resolve) => {
        if (typeof Audio === 'undefined') return resolve(false);
        const a = new Audio(url);
        audio = a;
        a.volume = Math.min(1, volume * 1.3);
        let started = false;
        a.addEventListener('playing', () => (started = true));
        a.addEventListener('ended', () => resolve(true));
        // a file that is not there fails before it plays; one that is stopped counts as played
        a.addEventListener('error', () => resolve(started));
        a.addEventListener('pause', () => started && resolve(true));
        a.play().catch(() => resolve(started));
      });
    },
    tts(text, lang, voice, volume) {
      return new Promise((resolve) => {
        const synth = typeof speechSynthesis === 'undefined' ? null : speechSynthesis;
        if (!synth) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = LOCALE[lang] ?? lang;
        const best = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
        if (best) u.voice = best;
        u.pitch = TTS[voice].pitch;
        u.rate = TTS[voice].rate;
        u.volume = volume;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
      });
    },
    halt() {
      audio?.pause();
      audio = null;
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    },
  };
}

/** every speaker there is, so the mute button can silence them all at once */
const live = new Set<WeakRef<Speaker>>();

/** stops all reading aloud right now (the mute button) */
export function hushAll(): void {
  for (const ref of live) {
    const sp = ref.deref();
    if (sp) sp.stop();
    else live.delete(ref);
  }
}

export class Speaker {
  private readonly deps: SpeakerDeps;
  /** files known to be missing (no second request) */
  private readonly missing = new Set<string>();
  /** the run that may speak; an older one stops after its current line */
  private turn = 0;

  constructor(deps: SpeakerDeps = browserDeps()) {
    this.deps = deps;
    live.add(new WeakRef(this));
  }

  /** reads the lines one after the other; a later run or stop() ends it. onLine hears the index of each line
   * right before it is read (for subtitles); with the sound off nothing is read and onLine is not called. */
  async run(lines: Line[], onLine?: (index: number) => void): Promise<void> {
    if (this.turn) this.deps.halt();
    const mine = ++this.turn;
    for (const [i, line] of lines.entries()) {
      if (mine !== this.turn) return;
      const volume = this.deps.volume();
      if (volume <= 0) return;
      onLine?.(i);
      await this.say(line, volume);
    }
  }

  stop(): void {
    this.turn++;
    this.deps.halt();
  }

  /** a text with a filled gap from the generated files: the whole sentence, else its pieces (a value without
   * a file read by the browser). False when a fixed part has no file: then the browser reads it all. */
  private async sayFilled(line: Line, lang: string, volume: number): Promise<boolean> {
    const files = await this.deps.files(lang);
    if (!files || !line.text) return false;
    const url = (f: string) => `/voice/ai/${lang}/${f}.mp3`;
    const whole = sentenceFile(line.text);
    if (files.has(whole) && (await this.deps.play(url(whole), volume))) return true;
    const pieces = line.pieces ?? [];
    if (!pieces.length || pieces.some((p) => !p.gap && !files.has(pieceFile(line.voice, p.text)))) return false;
    const mine = this.turn;
    for (const p of pieces) if (files.has(pieceFile(line.voice, p.text))) this.deps.preload(url(pieceFile(line.voice, p.text)));
    for (const p of pieces) {
      if (mine !== this.turn) return true;
      const f = pieceFile(line.voice, p.text);
      if (!files.has(f) || !(await this.deps.play(url(f), volume))) await this.deps.tts(p.text, lang, line.voice, volume);
    }
    return true;
  }

  private async say(line: Line, volume: number): Promise<void> {
    const lang = this.deps.lang();
    if (line.gap && (await this.sayFilled(line, lang, volume))) return;
    for (const url of line.gap ? [] : voiceSources(line.key, lang)) {
      if (this.missing.has(url)) continue;
      if (await this.deps.play(url, volume)) return;
      this.missing.add(url);
    }
    await this.deps.tts(line.text ?? this.deps.translate(line.key), lang, line.voice, volume);
  }
}

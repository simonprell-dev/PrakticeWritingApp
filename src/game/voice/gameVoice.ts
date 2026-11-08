// Speech for the whole game: a scene shows a text (speech bubble, hint, banner) and calls speak(text). The
// text is looked up among the lines of the recording script (voice/lines.json, npm run voice): if it is one,
// its speaker reads it with the best voice there is (src/game/voice/speaker.ts), in the page's language.
// Texts that are no line (labels, errors) stay silent. A text with a filled gap ("Sieg für Team Blau!") is
// said as a whole sentence made beforehand or put together from pieces (pieces.ts).
import lines from '../../../voice/lines.json';
import source from '../../i18n/source.json';
import { language, t } from '../../i18n/i18n.ts';
import { piecesOf } from './pieces.ts';
import { Speaker, type Line, type Voice } from './speaker.ts';

/** a line about to be said */
export interface Spoken extends Line {
  text: string;
  gap: boolean;
}

/** strips emoji and extra spaces, as the recording script does */
export function normalizeVoiceText(s: string): string {
  return s
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Row {
  text: string;
  speaker: string;
  partOf?: string;
}

/** German source key (with its emoji) for every normalized German text */
const SOURCE = new Map<string, string>();
for (const k of source as string[]) {
  const n = normalizeVoiceText(k);
  if (!SOURCE.has(n)) SOURCE.set(n, k);
}

/** what may be spoken: the normalized German text (or template) and who speaks it */
const SPOKEN = new Map<string, Voice>();
for (const r of lines as Row[]) {
  // letters are recorded for gaps; on their own they are not shown as a text. Error messages carry a
  // technical text in their gap: they are not read to children.
  if (r.speaker === 'buchstaben' || /\{error\}/.test(r.partOf ?? '')) continue;
  const key = normalizeVoiceText(r.partOf ?? r.text);
  if (!SPOKEN.has(key)) SPOKEN.set(key, r.speaker as Voice);
}

interface Index {
  lang: string;
  exact: Map<string, string>;
  templates: { re: RegExp; key: string; shown: string }[];
}
let index: Index | null = null;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** the spoken lines in the language of the page, rebuilt when it changes */
function build(): Index {
  const lang = language();
  if (index?.lang === lang) return index;
  const exact = new Map<string, string>();
  const templates: Index['templates'] = [];
  for (const key of SPOKEN.keys()) {
    const shown = normalizeVoiceText(t(SOURCE.get(key) ?? key));
    if (/\{\w+\}/.test(shown)) {
      const re = new RegExp(`^${escape(shown).replace(/\\\{\w+\\\}/g, '(.+?)')}$`);
      templates.push({ re, key, shown });
    } else exact.set(shown, key);
  }
  index = { lang, exact, templates };
  return index;
}

/** the line a shown text is, or null when it is not spoken */
export function lineOf(shown: string): Spoken | null {
  const text = normalizeVoiceText(shown);
  if (!text) return null;
  const ix = build();
  const key = ix.exact.get(text);
  if (key) return { key, voice: SPOKEN.get(key)!, text, gap: false };
  for (const tpl of ix.templates) {
    const m = tpl.re.exec(text);
    if (m) return { key: tpl.key, voice: SPOKEN.get(tpl.key)!, text, gap: true, pieces: piecesOf(tpl.shown, m.slice(1)) };
  }
  return null;
}

/** the important speakers are not talked over by the little ones */
const RANK: Record<Voice, number> = { erzaehler: 2, riese: 2, zork: 2, flocke: 2, blase: 1, wesen: 1, ausruf: 1, buchstaben: 1 };

/** whether the next line may cut in on the one being said */
export function pickLine(current: Spoken | null, next: Spoken): boolean {
  if (!current) return true;
  if (current.key === next.key && current.text === next.text) return false;
  return RANK[next.voice] >= RANK[current.voice];
}

/** what happens with a new line: said now, said when the current one is done (a speaker of the same rank
 * does not cut off a sentence; only the newest one waits), or dropped */
export function arrange(current: Spoken | null, next: Spoken): 'say' | 'wait' | 'drop' {
  if (!current) return 'say';
  if (!pickLine(current, next)) return 'drop';
  return RANK[next.voice] > RANK[current.voice] ? 'say' : 'wait';
}

const speaker = new Speaker();
let current: Spoken | null = null;
/** what is said once the current lines are done */
let waiting: Spoken[] = [];
let turn = 0;

function play(found: Spoken[]): void {
  const mine = ++turn;
  current = found[0];
  waiting = [];
  void speaker
    .run(found, (i) => {
      if (mine === turn) current = found[i];
    })
    .then(() => {
      if (mine !== turn) return;
      current = null;
      const next = waiting;
      if (next.length) play(next);
    });
}

/** says shown texts (one after the other) if they are lines of the game; others are left out */
export function speak(...shown: string[]): void {
  const found = shown.map(lineOf).filter((l): l is Spoken => !!l);
  if (!found.length) return;
  const how = arrange(current, found[0]);
  if (how === 'say') play(found);
  else if (how === 'wait' && !(waiting[0]?.key === found[0].key && waiting[0].text === found[0].text)) waiting = found;
}

/** ends what is being said (leaving a game) */
export function hush(): void {
  turn++;
  current = null;
  waiting = [];
  speaker.stop();
}

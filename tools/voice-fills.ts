// Lists, for every language, what is generated for the texts with a gap (src/game/voice/pieces.ts):
//   - whole sentences for the common values (team names, small numbers) – they sound best
//   - the pieces of every text and the values on their own (numbers 0..50, letters, names) – for the rest
// Writes voice/fills.json; tools/voice-ai.py makes the files from it. Every entry is checked against what the
// game does at runtime (lineOf), so the files are found again.
// Usage: npx vite-node tools/voice-fills.ts   (part of npm run voice)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import source from '../src/i18n/source.json';
import { detectLocale, LANGS } from '../src/i18n/detect.ts';
import { setLanguage, t } from '../src/i18n/i18n.ts';
import { lineOf, normalizeVoiceText } from '../src/game/voice/gameVoice.ts';
import { pieceFile, sentenceFile } from '../src/game/voice/pieces.ts';
import { scriptOf } from '../src/recog/scripts.ts';
import { withArticle } from '../src/recog/classes.ts';
import { DEFAULTS } from '../src/app/settings.ts';
import { MODES } from '../src/app/saves.ts';
import { ALIEN_NAMES } from '../src/scenes/towerScene.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

interface Row {
  text: string;
  speaker: string;
  partOf?: string;
}
export interface Fill {
  file: string;
  speaker: string;
  text: string;
}

/** numbers in a whole sentence, and on their own as a piece */
const SMALL = Array.from({ length: 12 }, (_, i) => String(i + 1));
const ALL_NUMBERS = Array.from({ length: 51 }, (_, i) => String(i));
/** "{n}× das A": how often a letter is practised */
const TIMES_NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1));
/** at most this many whole sentences per text */
const MAX_SENTENCES = 40;

const rows = JSON.parse(readFileSync(ROOT + 'voice/lines.json', 'utf8')) as Row[];
const templates = new Map<string, string>();
for (const r of rows) if (r.partOf && r.speaker !== 'buchstaben' && !/\{error\}/.test(r.partOf) && !templates.has(r.partOf)) templates.set(r.partOf, r.speaker);
const keyOf = new Map<string, string>();
for (const k of source as string[]) if (!keyOf.has(normalizeVoiceText(k))) keyOf.set(normalizeVoiceText(k), k);

/** the names a gap {name} can hold in a text (as the game passes them: translated) */
function names(key: string): string[] {
  if (/Schreibt schöne|gegen Riese/.test(key)) return [t(DEFAULTS.siege.className)];
  if (/^Ich bin \{name\}/.test(key)) return ALIEN_NAMES;
  if (/^Weiter geht/.test(key)) return Object.values(MODES).map((m) => t(m.title));
  return [...new Set([...DEFAULTS.tower.players, ...DEFAULTS.duel.teams].map((p) => t(p.name)))];
}

function letters(lang: string): string[] {
  const def = scriptOf(detectLocale([lang]).script);
  return [...new Set(def.practice.flatMap((s) => [...s.chars]))].map(withArticle);
}

const product = (ds: string[][]) => ds.reduce((n, d) => n * d.length, 1);

function* combos(ph: string[], ds: string[][], at = 0, acc: Record<string, string> = {}): Generator<Record<string, string>> {
  if (at === ph.length) return yield { ...acc };
  for (const v of ds[at]) yield* combos(ph, ds, at + 1, { ...acc, [ph[at]]: v });
}

const out: Record<string, Fill[]> = {};
for (const lang of LANGS) {
  await setLanguage(lang);
  const fills = new Map<string, Fill>();
  const add = (f: Fill) => !fills.has(f.file) && fills.set(f.file, f);
  const abc = letters(lang);
  for (const [tpl, speaker] of templates) {
    const key = keyOf.get(normalizeVoiceText(tpl)) ?? tpl;
    const ph = [...new Set([...tpl.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
    const times = (p: string) => tpl.includes(`{${p}}×`);
    const domain = (p: string, all: boolean) =>
      p === 'name' ? names(key) : p === 'c' || p === 'next' ? abc : !all ? SMALL : times(p) ? TIMES_NUMBERS : ALL_NUMBERS;
    const said = (params: Record<string, string>) => {
      const text = normalizeVoiceText(t(key, params));
      const l = lineOf(text);
      return l && l.key === normalizeVoiceText(tpl) ? { text, l } : null;
    };
    // whole sentences when there are not too many
    const small = ph.map((p) => domain(p, false));
    if (product(small) <= MAX_SENTENCES)
      for (const params of combos(ph, small)) {
        const s = said(params);
        if (s) add({ file: sentenceFile(s.text), speaker, text: s.text });
      }
    // the pieces: every value of every gap once, the other gaps with their first value
    for (const [i, p] of ph.entries())
      for (const v of domain(p, true)) {
        const params = Object.fromEntries(ph.map((q, j) => [q, j === i ? v : domain(q, false)[0]]));
        for (const piece of said(params)?.l.pieces ?? []) add({ file: pieceFile(speaker, piece.text), speaker, text: piece.text });
      }
  }
  out[lang] = [...fills.values()];
}
await setLanguage('de');
writeFileSync(ROOT + 'voice/fills.json', JSON.stringify(out, null, 1));
console.log('fills:', Object.entries(out).map(([l, f]) => `${l} ${f.length}`).join(', '));

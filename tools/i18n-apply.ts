// Merges a batch of translations into a catalogue by position in src/i18n/source.json, so translators
// never have to retype the German keys.
//
//   node tools/i18n-apply.ts <lang> <batch.json>
//     batch.json: { "from": 0, "texts": ["…", "…"] }   texts[i] translates source.json[from + i]
//   node tools/i18n-apply.ts <lang> --dump <from> <count>
//     prints the German texts from..from+count-1 with their numbers (to translate them)
//   node tools/i18n-apply.ts <lang> --check
//     placeholders ({n}, {name} …) of every translation must match the German text
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const source = JSON.parse(readFileSync(join(ROOT, 'src', 'i18n', 'source.json'), 'utf8')) as string[];
const [lang, arg, a, b] = process.argv.slice(2);
if (!lang || !/^[a-z]{2}$/.test(lang)) throw new Error('usage: node tools/i18n-apply.ts <lang> <batch.json> | --dump <from> <count> | --check');
const file = join(ROOT, 'src', 'i18n', 'locales', `${lang}.json`);
const cat: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

if (arg === '--dump') {
  const from = Number(a);
  const n = Number(b);
  console.log(JSON.stringify(source.slice(from, from + n).map((s, i) => [from + i, s]), null, 1));
} else if (arg === '--check') {
  let bad = 0;
  for (const s of source) {
    const tr = cat[s];
    if (tr && holes(tr) !== holes(s)) {
      bad++;
      console.log(`placeholders differ: ${JSON.stringify(s)} -> ${JSON.stringify(tr)}`);
    }
  }
  const missing = source.filter((s) => !cat[s]).length;
  console.log(`${lang}: ${source.length - missing}/${source.length} translated, ${bad} with wrong placeholders`);
  process.exitCode = bad ? 1 : 0;
} else {
  const batch = JSON.parse(readFileSync(arg, 'utf8')) as { from: number; texts: string[] };
  batch.texts.forEach((tr, i) => {
    const s = source[batch.from + i];
    if (s === undefined) throw new Error(`no German text #${batch.from + i}`);
    if (typeof tr === 'string' && tr.trim()) cat[s] = tr;
  });
  // keys in source order, so diffs stay small
  const out: Record<string, string> = {};
  for (const s of source) if (cat[s]) out[s] = cat[s];
  writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
  console.log(`${lang}: ${Object.keys(out).length}/${source.length}`);
}

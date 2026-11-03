// Collects every text marked with t('…') or tk('…') in src/ into src/i18n/source.json and reports, per
// language catalogue in src/i18n/locales/, which texts are still missing or no longer used.
//
//   node tools/i18n-extract.ts            write source.json, list missing translations
//   node tools/i18n-extract.ts --prune    also remove unused entries from the catalogues
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SRC = join(ROOT, 'src');
const LOCALES = join(SRC, 'i18n', 'locales');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.ts$/.test(n) && !/\.test\.ts$/.test(n) ? [p] : [];
  });
}

/** a JS string literal ('…' or "…", no template literals) as its value */
function unquote(lit: string): string {
  return JSON.parse(lit[0] === '"' ? lit : '"' + lit.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"');
}

const CALL = /\bt[k]?\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
const texts = new Map<string, string[]>();
for (const f of files(SRC)) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(CALL)) {
    const s = unquote(m[1]);
    if (!s.trim()) continue;
    const where = texts.get(s) ?? [];
    where.push(relative(ROOT, f).replace(/\\/g, '/'));
    texts.set(s, where);
  }
}
const sorted = [...texts.keys()].sort();
writeFileSync(join(SRC, 'i18n', 'source.json'), JSON.stringify(sorted, null, 1) + '\n');
console.log(`${sorted.length} texts in src/i18n/source.json`);

if (existsSync(LOCALES)) {
  const prune = process.argv.includes('--prune');
  for (const n of readdirSync(LOCALES).filter((n) => n.endsWith('.json')).sort()) {
    const p = join(LOCALES, n);
    const cat = JSON.parse(readFileSync(p, 'utf8')) as Record<string, string>;
    const missing = sorted.filter((s) => !cat[s]);
    const unused = Object.keys(cat).filter((k) => !texts.has(k));
    console.log(`${n}: ${missing.length} missing, ${unused.length} unused`);
    if (prune && unused.length) {
      for (const k of unused) delete cat[k];
      writeFileSync(p, JSON.stringify(cat, null, 1) + '\n');
    }
  }
}

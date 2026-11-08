// Writes docs/woerter-zoo-lautgetreu.md: the rules of sound-true spelling and the check list of every word of
// the Wörter-Zoo (from src/game/words/lautgetreu.ts), so the document always matches the code.
// Usage: npx vite-node tools/lautgetreu-doc.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KNOWN_SPELLINGS, soundKey } from '../src/game/words/lautgetreu.ts';
import { WORDS } from '../src/game/words/words.ts';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const md: string[] = [
  '# Wörter-Zoo: lautgetreue Schreibungen',
  '',
  'Schreibanfänger schreiben, was sie hören: „Fogel“, „Hunt“, „Schtern“, „Tiga“. Im Startfenster des Wörter-Zoos stellt die Lehrkraft ein, wie damit umgegangen wird:',
  '',
  '- **Lautgetreu zählt:** Das Wort ist geschafft. Danach steht die richtige Schreibung groß auf der Karte, die Stimme sagt „Gut gehört – das zählt! So schreibt man es richtig.“',
  '- **Nur richtig geschrieben** (Vorgabe): „Gut gehört!“ mit der geschriebenen und der richtigen Schreibung untereinander; das Wort wird noch einmal geschrieben (nach dem dritten Versuch zählt es trotzdem).',
  '',
  'Groß- und Kleinschreibung spielt bei „Lautgetreu zählt“ keine Rolle.',
  '',
  '## Wie geprüft wird',
  '',
  'Beide Schreibungen – die richtige und die geschriebene – werden in eine **Lautform** übersetzt (`soundKey` in `src/game/words/lautgetreu.ts`). Stimmen die Lautformen überein, ist die Schreibung lautgetreu. Die Regeln in ihrer Reihenfolge:',
  '',
  '| Regel | Beispiel |',
  '|---|---|',
  '| ß → s | Fuß → Fus |',
  '| sch vor t/p am Wortanfang → s | Schtern → Stern, Schpinne → Spinne |',
  '| chs, x → ks | Fuchs = Fuks = Fux |',
  '| ph, v, pf → f | Elephant = Elefant, Fogel = Vogel, Afel = Apfel |',
  '| qu → kw | Kwalle = Qualle |',
  '| ck → k, tz und ts → z, dt → t | Schneke = Schnecke, Kaze = Katse = Katze |',
  '| äu, eu, oi klingen gleich; ei, ai klingen gleich | Oile = Eule, Ais = Eis |',
  '| ie, ih → i; ä → e | Bine = Biene, Ber = Bär |',
  '| Dehnungs-h nach einem Vokal fällt weg | Schu = Schuh, Zan = Zahn, Ur = Uhr |',
  '| doppelte Vokale und Konsonanten → einfach | Waal = Wal, Bal = Ball, Pupe = Puppe |',
  '| gu vor einem Vokal → gw | Pingwin = Pinguin |',
  '| -er am Wortende → a; -el, -en → l, n | Tiga = Tiger, Nudl = Nudel, Kuchn = Kuchen |',
  '| b, d, g am Wortende und vor einem Konsonanten → p, t, k | Hunt = Hund, Burk = Burg |',
  '',
  'Was die Regeln nicht erreichen (z. B. „Schiraffe“), steht in der **Prüfliste** unten und zählt von dort.',
  '',
  'Nicht lautgetreu – und darum nicht „richtig“ – ist eine Schreibung, in der ein Laut fehlt oder falsch ist: „Ent“ (Ente), „Hnd“ (Hund), „Pils“ (Pilz: z klingt ts).',
  '',
  '## Prüfliste',
  '',
  'Für jedes Wort die bekannten lautgetreuen Schreibungen von Erstklässlern. Der Test `test/game/lautgetreu.test.ts` gleicht jedes Wort gegen seine Liste ab: jede Schreibung muss als lautgetreu zählen, keine darf für ein anderes Wort zählen, und keine zwei Wörter des Zoos haben dieselbe Lautform.',
  '',
  '| Stufe | Wort | Lautform | bekannte lautgetreue Schreibungen |',
  '|---:|---|---|---|',
];
for (const w of WORDS) {
  const list = KNOWN_SPELLINGS[w.word];
  md.push(`| ${w.level} | ${w.word} | \`${soundKey(w.word)}\` | ${list.length ? list.join(', ') : '–'} |`);
}
md.push('', `Neue Schreibungen, die in der Klasse auffallen: in \`KNOWN_SPELLINGS\` eintragen, \`npx vitest run test/game/lautgetreu.test.ts\` prüft sie, \`npx vite-node tools/lautgetreu-doc.ts\` schreibt dieses Dokument neu.`, '');
writeFileSync(ROOT + 'docs/woerter-zoo-lautgetreu.md', md.join('\n'));
console.log('wrote docs/woerter-zoo-lautgetreu.md');

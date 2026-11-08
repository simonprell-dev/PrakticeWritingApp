// The words of the Wörter-Zoo: a picture appears, the class writes its word. Fitting the first school year in
// Bavaria: level 1 short and written as spoken, level 2 longer, level 3 with the first special spellings of the
// basic vocabulary of year 1/2 (ch, sch, ie, doubled letters, a silent h). Nouns start with a capital letter.
// See docs/superpowers/specs/2026-11-07-woerter-zoo-design.md.
import { tk } from '../../i18n/i18n.ts';
import type { ScannedGlyph } from '../../vision/types.ts';

export interface ZooWord {
  word: string;
  /** spoken slowly in help level 3 ("Ba–na–ne") */
  syllables: string[];
  level: 1 | 2 | 3;
  /** an animal moves around in the zoo; a thing stays and wobbles */
  animal: boolean;
  /** what it says when it comes alive (German, tk) */
  say: string;
}

const w = (word: string, syllables: string, level: 1 | 2 | 3, animal: boolean, say: string): ZooWord => ({ word, syllables: syllables.split('-'), level, animal, say });

export const WORDS: ZooWord[] = [
  // level 1: short, written as spoken
  w('Oma', 'O-ma', 1, false, tk('Komm her, ich hab Kekse für dich!')),
  w('Opa', 'O-pa', 1, false, tk('Wo ist denn bloß meine Brille?')),
  w('Mama', 'Ma-ma', 1, false, tk('Hab dich lieb, mein Schatz!')),
  w('Papa', 'Pa-pa', 1, false, tk('Huiii, Flugzeug fliegen!')),
  w('Eis', 'Eis', 1, false, tk('Hilfe, ich schmelze!')),
  w('Ei', 'Ei', 1, false, tk('Knack! Wer kommt da raus?')),
  w('Ast', 'Ast', 1, false, tk('Ich bin ein Ast, kein Zweig, ist doch klar!')),
  w('Ente', 'En-te', 1, true, tk('Quak! Wer will baden?')),
  w('Esel', 'E-sel', 1, true, tk('I-aah! Ich bin gar nicht dumm!')),
  w('Igel', 'I-gel', 1, true, tk('Nicht streicheln, das piekst!')),
  w('Nase', 'Na-se', 1, false, tk('Ha-ha-hatschi!')),
  w('Rose', 'Ro-se', 1, false, tk('Riech mal, wie gut ich dufte!')),
  w('Sofa', 'So-fa', 1, false, tk('Hüpfen verboten! … Na gut, einmal.')),
  w('Limo', 'Li-mo', 1, false, tk('Blubb blubb, das kitzelt!')),
  w('Lama', 'La-ma', 1, true, tk('Ich spucke nur ein kleines bisschen!')),
  w('Maus', 'Maus', 1, true, tk('Piep! Hat jemand Käse gesehen?')),
  w('Mond', 'Mond', 1, false, tk('Gähn … ist es schon Nacht?')),
  w('Nest', 'Nest', 1, false, tk('Pssst, hier schlafen Vogelkinder!')),
  w('Hut', 'Hut', 1, false, tk('Steht mir der Hut? Er steht mir gut!')),
  w('Hose', 'Ho-se', 1, false, tk('Ich hab ein Loch – guck nicht hin!')),
  w('Tor', 'Tor', 1, false, tk('Tooor! Tooor! Tooor!')),
  w('Eule', 'Eu-le', 1, true, tk('Huhu! Ich bin wach, du auch?')),
  w('Auto', 'Au-to', 1, false, tk('Brumm brumm, anschnallen bitte!')),
  w('Wal', 'Wal', 1, true, tk('Pfffff! Ich mach eine Wasserfontäne!')),
  w('Dino', 'Di-no', 1, true, tk('Roooar! Keine Angst, ich esse nur Salat.')),
  w('Rabe', 'Ra-be', 1, true, tk('Krah! Ich sammle glänzende Sachen!')),
  w('Nudel', 'Nu-del', 1, false, tk('Ich bin so lang, ich weiß gar nicht, wo ich aufhöre!')),
  w('Tomate', 'To-ma-te', 1, false, tk('Ich werde ganz rot vor Freude!')),
  // level 2: longer, still written as spoken
  w('Hund', 'Hund', 2, true, tk('Wuff! Wirfst du den Ball?')),
  w('Hase', 'Ha-se', 2, true, tk('Hoppel hoppel, ich bin schneller als du!')),
  w('Lampe', 'Lam-pe', 2, false, tk('Klick! Jetzt wird es hell!')),
  w('Tulpe', 'Tul-pe', 2, false, tk('Ich wachse und wachse und wachse!')),
  w('Ampel', 'Am-pel', 2, false, tk('Rot, gelb, grün – ich kann mich nicht entscheiden!')),
  w('Kerze', 'Ker-ze', 2, false, tk('Puste mich nicht aus, bitte!')),
  w('Krone', 'Kro-ne', 2, false, tk('Ich bin die Krone von Krakel und Krone!')),
  w('Zebra', 'Ze-bra', 2, true, tk('Bin ich weiß mit schwarzen Streifen oder schwarz mit weißen?')),
  w('Tiger', 'Ti-ger', 2, true, tk('Grrr … ich bin ein Kuscheltiger!')),
  w('Banane', 'Ba-na-ne', 2, false, tk('Vorsicht, nicht ausrutschen!')),
  w('Blume', 'Blu-me', 2, false, tk('Summ summ, wo sind die Bienen?')),
  w('Wolke', 'Wol-ke', 2, false, tk('Gleich regnet es – auf dich!')),
  w('Burg', 'Burg', 2, false, tk('Zugbrücke runter, der König kommt!')),
  w('Brot', 'Brot', 2, false, tk('Ich bin frisch und knusprig!')),
  w('Rad', 'Rad', 2, false, tk('Klingeling, aus dem Weg!')),
  w('Bus', 'Bus', 2, false, tk('Alle einsteigen, wir fahren zur Schule!')),
  w('Gras', 'Gras', 2, false, tk('Ich wachse, auch wenn du nicht hinschaust!')),
  w('Kran', 'Kran', 2, false, tk('Ich hebe alles hoch, sogar einen Elefanten!')),
  w('Ameise', 'A-mei-se', 2, true, tk('Ich trage zehnmal so viel wie ich wiege!')),
  w('Leiter', 'Lei-ter', 2, false, tk('Kletter mal ganz nach oben!')),
  w('Gurke', 'Gur-ke', 2, false, tk('Ich bin cool wie eine Gurke!')),
  w('Löwe', 'Lö-we', 2, true, tk('Ich bin der König – heute Nachmittag.')),
  w('Bär', 'Bär', 2, true, tk('Brumm! Ist da Honig drin?')),
  w('Zelt', 'Zelt', 2, false, tk('Heute schlafen wir draußen!')),
  w('Pilz', 'Pilz', 2, false, tk('Ich bin ein Glückspilz!')),
  w('Kamel', 'Ka-mel', 2, true, tk('Zwei Höcker, kein Durst!')),
  w('Melone', 'Me-lo-ne', 2, false, tk('Spuck die Kerne weit!')),
  w('Rakete', 'Ra-ke-te', 2, false, tk('Drei, zwei, eins … Start!')),
  // level 3: the first special spellings
  w('Apfel', 'Ap-fel', 3, false, tk('Wer hat hier reingebissen?')),
  w('Fisch', 'Fisch', 3, true, tk('Blubb! Ich kann nicht sprechen, nur blubbern.')),
  w('Schaf', 'Schaf', 3, true, tk('Mäh! Ich bin ganz flauschig!')),
  w('Biene', 'Bie-ne', 3, true, tk('Summ summ, ich hab Honig gemacht!')),
  w('Katze', 'Kat-ze', 3, true, tk('Miau! Kraul mich am Kinn!')),
  w('Schule', 'Schu-le', 3, false, tk('Ring ring, die Pause ist vorbei!')),
  w('Buch', 'Buch', 3, false, tk('Lies mich, ich hab eine tolle Geschichte!')),
  w('Kuchen', 'Ku-chen', 3, false, tk('Ein Stück für dich, ein Stück für mich!')),
  w('Frosch', 'Frosch', 3, true, tk('Quaak! Küss mich – oder lieber doch nicht!')),
  w('Fuchs', 'Fuchs', 3, true, tk('Ich bin schlau, ich hab mich versteckt!')),
  w('Stern', 'Stern', 3, false, tk('Ich funkle nur für dich!')),
  w('Schnecke', 'Schne-cke', 3, true, tk('Ich bin gaaanz schnell … für eine Schnecke.')),
  w('Ball', 'Ball', 3, false, tk('Boing! Boing! Fang mich!')),
  w('Puppe', 'Pup-pe', 3, false, tk('Spielst du mit mir Teeparty?')),
  w('Schiff', 'Schiff', 3, false, tk('Tuuut! Alle Mann an Bord!')),
  w('Giraffe', 'Gi-raf-fe', 3, true, tk('Wie ist das Wetter da unten?')),
  w('Pinguin', 'Pin-gu-in', 3, true, tk('Ich trage immer einen Frack!')),
  w('Elefant', 'E-le-fant', 3, true, tk('Törööö! Wer will duschen?')),
  w('Drache', 'Dra-che', 3, true, tk('Ich spucke nur Seifenblasen!')),
  w('Brille', 'Bril-le', 3, false, tk('Mit mir siehst du alles ganz scharf!')),
  w('Schuh', 'Schuh', 3, false, tk('Wo ist mein zweiter Schuh?')),
  w('Kuh', 'Kuh', 3, true, tk('Muh! Frische Milch gefällig?')),
  w('Uhr', 'Uhr', 3, false, tk('Tick tack, gleich ist Pause!')),
  w('Zahn', 'Zahn', 3, false, tk('Ich wackle! Bald kommt die Zahnfee!')),
  w('Ziege', 'Zie-ge', 3, true, tk('Mäh! Ich fresse deine Hausaufgaben!')),
  w('Spinne', 'Spin-ne', 3, true, tk('Ich hab acht Beine zum Kitzeln!')),
  w('Affe', 'Af-fe', 3, true, tk('Uh uh ah ah, wer hat meine Banane?')),
];

/** the letters of a word as the class must know them (lower case, umlauts and ß on their own) */
const lettersOf = (word: string) => [...word.toLowerCase()];

/** a word made only of the letters the class knows */
export function usable(word: ZooWord, known: Set<string>): boolean {
  return lettersOf(word.word).every((c) => known.has(c));
}

/** the next word: easy ones first, none twice before every usable one was there; null when none fits */
export function nextWord(known: Set<string>, seen: string[], rand: () => number): ZooWord | null {
  const fit = WORDS.filter((x) => usable(x, known));
  if (!fit.length) return null;
  // a round: once all were there, they come again
  const round = seen.length % fit.length === 0 && seen.length ? [] : seen.slice(-(seen.length % fit.length || fit.length));
  let open = fit.filter((x) => !round.includes(x.word));
  if (!open.length) open = fit;
  // the first words of a round are the easiest there are
  const easiest = Math.min(...open.map((x) => x.level));
  const pool = round.length < 3 ? open.filter((x) => x.level === easiest) : open;
  return pool[Math.floor(rand() * pool.length) % pool.length];
}

type Written = Pick<ScannedGlyph, 'score' | 'box'>;

/** the word written in one line: the longest group of neighbouring letters, read from left to right */
export function readWord(glyphs: Written[]): string {
  if (!glyphs.length) return '';
  const byX = [...glyphs].sort((a, b) => a.box.x - b.box.x);
  const groups: Written[][] = [];
  for (const g of byX) {
    const cy = g.box.y + g.box.h / 2;
    const group = groups.find((gr) => {
      const last = gr[gr.length - 1];
      const ly = last.box.y + last.box.h / 2;
      const h = Math.max(last.box.h, g.box.h);
      const gap = g.box.x - (last.box.x + last.box.w);
      // the same line, and at most about one letter apart
      return Math.abs(cy - ly) < h * 0.6 && gap < Math.max(last.box.w, g.box.w) * 1.2;
    });
    if (group) group.push(g);
    else groups.push([g]);
  }
  const best = groups.reduce((a, b) => (b.length > a.length ? b : a));
  return best.map((g) => g.score.char).join('');
}

/** letters whose small and big forms look alike: for them, the size cannot be told apart reliably */
const SAME_SHAPE = new Set('cksouvwxz'.split(''));

export type Verdict = { result: 'richtig' } | { result: 'fast'; reason: 'gross' | 'buchstabe'; at: number } | { result: 'daneben' };

/** first place where two words differ */
function firstDiff(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** right, close (one letter, or only the capital) or off; only the first letter's size is judged */
export function judge(target: string, written: string): Verdict {
  if (!written) return { result: 'daneben' };
  const t = target.toLowerCase();
  const wr = written.toLowerCase();
  if (t === wr) {
    const first = target[0];
    const smallFirst = written[0] !== first && written[0] === first.toLowerCase();
    if (smallFirst && !SAME_SHAPE.has(first.toLowerCase())) return { result: 'fast', reason: 'gross', at: 0 };
    return { result: 'richtig' };
  }
  if (distance(t, wr) === 1) return { result: 'fast', reason: 'buchstabe', at: firstDiff(t, wr) };
  return { result: 'daneben' };
}

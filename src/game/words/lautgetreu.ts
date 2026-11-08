// Sound-true spelling ("lautgetreu") in the Wörter-Zoo. Children who are just starting to write put down what
// they hear: "Fogel", "Hunt", "Schtern", "Tiga". Depending on the setting such a spelling counts (with the
// right one shown after) or is close and gets written again.
//
// Two checks, both in soundsRight():
//   1. soundKey(): both spellings are turned into a form of their sounds by the rules below (the usual ways
//      first graders write what they hear); the same form means the same sounds.
//   2. KNOWN_SPELLINGS: per word the sound-true spellings that are known to come up, a check list every word is
//      tested against (test/game/lautgetreu.test.ts). A spelling the rules do not reach (e.g. "Schiraffe") is
//      accepted from this list.
// See docs/woerter-zoo-lautgetreu.md for the rules and the list as a table.

const V = 'aeiouöüyɔæå';

/**
 * The sounds of a written word, the same for spellings that sound the same. The order of the rules matters:
 * letter groups first (sch, ch, ck, tz, diphthongs), then lengthening marks, doubled letters and the end of
 * the word.
 */
export function soundKey(word: string): string {
  let x = word.toLowerCase().normalize('NFC').trim();
  x = x.replace(/ß/g, 's');
  // "Schtern", "Schpinne": st / sp at the start are spoken scht / schp
  x = x.replace(/^sch(?=[tp])/, 's');
  // ks sounds
  x = x.replace(/chs/g, 'ks').replace(/x/g, 'ks');
  // letter groups for one sound
  x = x.replace(/sch/g, 'š').replace(/ch/g, 'ç');
  x = x.replace(/ph/g, 'f').replace(/v/g, 'f').replace(/pf/g, 'f').replace(/qu/g, 'kw');
  x = x.replace(/ck/g, 'k').replace(/tz/g, 'z').replace(/ts/g, 'z').replace(/dt/g, 't');
  // diphthongs: eu / äu / oi sound the same, ei / ai too
  x = x.replace(/äu|eu|oi|oj/g, 'ɔ').replace(/ei|ai|ey|ay/g, 'æ').replace(/au/g, 'å');
  // long i and ä
  x = x.replace(/ieh|ie|ih/g, 'i').replace(/ä/g, 'e');
  // a silent h after a vowel ("Schuh", "Zahn", "Uhr")
  x = x.replace(new RegExp(`([${V}])h(?![${V}])`, 'g'), '$1');
  // doubled vowels ("Waal") and consonants ("Ball", "Puppe")
  x = x.replace(/([aeo])\1/g, '$1');
  x = x.replace(/([bdfgklmnprstzšçw])\1/g, '$1');
  // "Pingwin": gu before a vowel sounds gw
  x = x.replace(new RegExp(`gu(?=[${V}])`, 'g'), 'gw');
  // the end of a word: -er sounds a ("Tiga"), -el / -en lose their e ("Nudl", "Kuchn")
  x = x.replace(/er$/, 'a').replace(/el$/, 'l').replace(/en$/, 'n');
  // b, d, g sound p, t, k at the end of a word and before another consonant ("Hunt", "Burk")
  x = x.replace(new RegExp(`[bdg](?=$|[^${V}lrw])`, 'g'), (c) => ({ b: 'p', d: 't', g: 'k' })[c as 'b' | 'd' | 'g']);
  return x;
}

/**
 * The check list: per word of the zoo the sound-true spellings that first graders are known to write. Each one
 * must count (by the rules or, where they do not reach, from this list) – and none may count for another word.
 */
export const KNOWN_SPELLINGS: Record<string, string[]> = {
  Oma: ['Ohma'],
  Opa: ['Ohpa'],
  Mama: [],
  Papa: [],
  Eis: ['Ais'],
  Ei: ['Ai'],
  Ast: ['Asst'],
  Ente: ['Ennte'],
  Esel: ['Esl', 'Ehsel'],
  Igel: ['Iegel', 'Igl'],
  Nase: ['Nahse'],
  Rose: ['Rohse'],
  Sofa: ['Sohfa', 'Sova'],
  Limo: ['Liemo'],
  Lama: ['Lahma'],
  Maus: [],
  Mond: ['Mont', 'Mohnt'],
  Nest: ['Nesst'],
  Hut: ['Huht'],
  Hose: ['Hohse'],
  Tor: ['Tohr'],
  Eule: ['Oile', 'Euhle'],
  Auto: [],
  Wal: ['Wahl', 'Waal'],
  Dino: ['Dieno'],
  Rabe: ['Rahbe'],
  Nudel: ['Nudl', 'Nuhdel'],
  Tomate: ['Tomahte'],
  Hund: ['Hunt'],
  Hase: ['Hahse'],
  Lampe: [],
  Tulpe: [],
  Ampel: ['Ampl'],
  Kerze: ['Kertse', 'Kärze'],
  Krone: ['Krohne'],
  Zebra: ['Tsebra', 'Zehbra'],
  Tiger: ['Tieger', 'Tiga'],
  Banane: ['Banahne'],
  Blume: ['Bluhme'],
  Wolke: ['Wolcke'],
  Burg: ['Burk'],
  Brot: ['Broht', 'Brod'],
  Rad: ['Rat', 'Raad'],
  Bus: ['Buss'],
  Gras: ['Grahs', 'Graas'],
  Kran: ['Krahn'],
  Ameise: ['Amaise'],
  Leiter: ['Laita', 'Leita'],
  Gurke: ['Gurcke'],
  Löwe: [],
  Bär: ['Ber', 'Bähr'],
  Zelt: ['Tselt'],
  Pilz: ['Pilts'],
  Kamel: ['Kamehl'],
  Melone: ['Mehlone'],
  Rakete: ['Rakehte'],
  Apfel: ['Afel', 'Apfl'],
  Fisch: [],
  Schaf: ['Schahf'],
  Biene: ['Bine'],
  Katze: ['Kaze', 'Katse'],
  Schule: ['Schuhle'],
  Buch: [],
  Kuchen: ['Kuchn', 'Kuhchen'],
  Frosch: [],
  Fuchs: ['Fuks', 'Fux'],
  Stern: ['Schtern'],
  Schnecke: ['Schneke'],
  Ball: ['Bal'],
  Puppe: ['Pupe'],
  Schiff: ['Schif'],
  Giraffe: ['Schiraffe', 'Schirafe', 'Girafe'],
  Pinguin: ['Pingwin', 'Pinguihn'],
  Elefant: ['Elefand', 'Elephant'],
  Drache: [],
  Brille: ['Brile'],
  Schuh: ['Schu'],
  Kuh: ['Ku'],
  Uhr: ['Ur'],
  Zahn: ['Zan', 'Tsan'],
  Ziege: ['Zige', 'Tsige'],
  Spinne: ['Schpinne', 'Schpine', 'Spine'],
  Affe: ['Afe'],
};

/** whether `written` sounds like `target` (the case of the letters does not matter here) */
export function soundsRight(target: string, written: string): boolean {
  if (!written.trim()) return false;
  if (soundKey(target) === soundKey(written)) return true;
  const w = written.trim().toLowerCase();
  return (KNOWN_SPELLINGS[target] ?? []).some((s) => s.toLowerCase() === w);
}

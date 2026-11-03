// The writing systems ("scripts") the game can practise. Every script has a model of its own
// (tools/train/scripts.py trains them); scripts are never mixed in one recognition.
import { tk } from '../i18n/i18n.ts';
import { GROUPS as LATIN_GROUPS, PRACTICE_SETS as LATIN_SETS, surprisePool as latinSurprisePool } from './classes.ts';

export type ScriptId =
  | 'druck'
  | 'grund'
  | 'schreib'
  | 'hiragana'
  | 'katakana'
  | 'kyrillisch'
  | 'arabisch'
  | 'devanagari'
  | 'griechisch'
  | 'hebraeisch'
  | 'hangul'
  | 'thai';

/** which writing animation a script gets (src/game/strokes.ts) */
export type StrokeStyle = 'druck' | 'grund' | 'kana' | 'schreib' | 'kyrillisch' | 'griechisch' | 'hebraeisch' | 'arabisch' | 'devanagari' | 'hangul' | 'thai';

export interface PracticeSet {
  /** German label (translated in the UI) */
  label: string;
  chars: string;
}

export interface ScriptDef {
  id: ScriptId;
  /** German name (translated in the UI) */
  name: string;
  /** a few characters to show on the world map pin and in buttons */
  sample: string;
  /** all characters the model knows (each one code point) */
  chars: string;
  /** characters that look the same in isolation; their probabilities are summed */
  groups: string[];
  practice: PracticeSet[];
  dir: 'ltr' | 'rtl';
  /**
   * latin: the German school rules (umlaut dots, upper/lower case by height, school line zones, mirror
   * writing); block: all parts of a character are one glyph, no Latin special rules
   */
  seg: 'latin' | 'block';
  /** model files below public/model/ ('' = the original Druckschrift model) */
  modelDir: string;
  /** CSS font stack to show the characters */
  font: string;
  /** BCP 47 language of the characters (lang attribute, so the browser picks matching glyph forms) */
  lang: string;
  /** writing animations exist: Druckschrift and Grundschrift (src/game/strokes.ts), kana (KanjiVG), the others in src/game/scriptStrokes/ */
  strokes?: StrokeStyle;
  /** world map region the script belongs to (src/ui/worldMapData.ts) */
  region: string;
}

const LATIN = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzß';
const latinSets: PracticeSet[] = LATIN_SETS.map((s) => ({ label: s.label, chars: s.chars }));

const HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';
const KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
/** the kana table in rows of five (あ, か, さ … ), the last row has わ, を, ん */
const kanaRows = (s: string, names: string[]): PracticeSet[] => {
  const rows: PracticeSet[] = [];
  const sizes = [5, 5, 5, 5, 5, 5, 5, 3, 5, 3];
  let i = 0;
  sizes.forEach((n, k) => {
    rows.push({ label: names[k], chars: s.slice(i, i + n) });
    i += n;
  });
  return rows;
};
const KANA_ROWS = [tk('a-Reihe'), tk('ka-Reihe'), tk('sa-Reihe'), tk('ta-Reihe'), tk('na-Reihe'), tk('ha-Reihe'), tk('ma-Reihe'), tk('ya-Reihe'), tk('ra-Reihe'), tk('wa-Reihe und n')];

const RU_UP = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ';
const RU_LO = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';
const ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
const DEVA_VOWELS = 'अआइईउऊऋएऐओऔ';
const DEVA_CONS = 'कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह';
const GR_UP = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';
const GR_LO = 'αβγδεζηθικλμνξοπρσςτυφχψω';
const HE_LETTERS = 'אבגדהוזחטיכלמנסעפצקרשת';
const HE_FINAL = 'ךםןףץ';
const KO_CONS = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ';
const KO_VOW = 'ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ';
const KO_SYL = '가나다라마바사아자차카타파하';
const THAI = 'กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ';

export const SCRIPTS: Record<ScriptId, ScriptDef> = {
  druck: {
    id: 'druck', name: tk('Druckschrift'), sample: 'Aa', chars: LATIN, groups: LATIN_GROUPS, practice: latinSets, dir: 'ltr', seg: 'latin',
    modelDir: '', font: "Druckvorlage, Fredoka, system-ui, sans-serif", lang: 'de', strokes: 'druck', region: 'latin',
  },
  grund: {
    id: 'grund', name: tk('Grundschrift'), sample: 'Aa', chars: LATIN, groups: LATIN_GROUPS, practice: latinSets, dir: 'ltr', seg: 'latin',
    modelDir: 'grund/', font: "Grundschrift, Druckvorlage, system-ui, sans-serif", lang: 'de', strokes: 'grund', region: 'latin',
  },
  schreib: {
    id: 'schreib', name: tk('Schreibschrift'), sample: 'Aa', chars: LATIN, groups: LATIN_GROUPS, practice: latinSets, dir: 'ltr', seg: 'latin',
    modelDir: 'schreib/', font: "KK-schreib, Grundschrift, cursive", lang: 'de', strokes: 'schreib', region: 'latin',
  },
  hiragana: {
    id: 'hiragana', name: tk('Hiragana'), sample: 'あ', chars: HIRAGANA, groups: [], practice: kanaRows(HIRAGANA, KANA_ROWS), dir: 'ltr', seg: 'block',
    modelDir: 'hiragana/', font: "KK-hiragana, 'Hiragino Maru Gothic ProN', 'Yu Gothic', 'Noto Sans JP', sans-serif", lang: 'ja', strokes: 'kana', region: 'japan',
  },
  katakana: {
    id: 'katakana', name: tk('Katakana'), sample: 'ア', chars: KATAKANA, groups: [], practice: kanaRows(KATAKANA, KANA_ROWS), dir: 'ltr', seg: 'block',
    modelDir: 'katakana/', font: "KK-katakana, 'Hiragino Maru Gothic ProN', 'Yu Gothic', 'Noto Sans JP', sans-serif", lang: 'ja', strokes: 'kana', region: 'japan',
  },
  kyrillisch: {
    id: 'kyrillisch', name: tk('Kyrillisch'), sample: 'Бб', chars: RU_UP + RU_LO,
    // capitals and small letters that only differ in size
    groups: ['Вв', 'Гг', 'Дд', 'Жж', 'Зз', 'Ии', 'Йй', 'Кк', 'Лл', 'Мм', 'Нн', 'Оо', 'Пп', 'Рр', 'Сс', 'Тт', 'Уу', 'Фф', 'Хх', 'Цц', 'Чч', 'Шш', 'Щщ', 'Ъъ', 'Ыы', 'Ьь', 'Ээ', 'Юю', 'Яя'],
    practice: [
      { label: tk('Großbuchstaben'), chars: RU_UP },
      { label: tk('Kleinbuchstaben'), chars: RU_LO },
    ],
    dir: 'ltr', seg: 'block', modelDir: 'kyrillisch/', font: "KK-kyrillisch, Fredoka, system-ui, sans-serif", lang: 'ru', strokes: 'kyrillisch', region: 'kyrillisch',
  },
  arabisch: {
    id: 'arabisch', name: tk('Arabisch'), sample: 'ب', chars: ARABIC, groups: [], practice: [{ label: tk('Buchstaben'), chars: ARABIC }], dir: 'rtl', seg: 'block',
    modelDir: 'arabisch/', font: "KK-arabisch, 'Noto Naskh Arabic', 'Segoe UI', sans-serif", lang: 'ar', strokes: 'arabisch', region: 'arabisch',
  },
  devanagari: {
    id: 'devanagari', name: tk('Devanagari (Hindi)'), sample: 'क', chars: DEVA_VOWELS + DEVA_CONS, groups: ['घध', 'बव', 'भम'],
    practice: [
      { label: tk('Vokale'), chars: DEVA_VOWELS },
      { label: tk('Konsonanten'), chars: DEVA_CONS },
    ],
    dir: 'ltr', seg: 'block', modelDir: 'devanagari/', font: "KK-devanagari, 'Nirmala UI', 'Noto Sans Devanagari', sans-serif", lang: 'hi', strokes: 'devanagari', region: 'devanagari',
  },
  griechisch: {
    id: 'griechisch', name: tk('Griechisch'), sample: 'Ωω', chars: GR_UP + GR_LO, groups: ['Οο', 'Κκ', 'Χχ', 'Ψψ', 'Ππ', 'Ττ', 'Ιι', 'Θθ', 'Φφ', 'Ρρ', 'Ββ'],
    practice: [
      { label: tk('Großbuchstaben'), chars: GR_UP },
      { label: tk('Kleinbuchstaben'), chars: GR_LO },
    ],
    dir: 'ltr', seg: 'block', modelDir: 'griechisch/', font: "KK-griechisch, system-ui, sans-serif", lang: 'el', strokes: 'griechisch', region: 'griechisch',
  },
  hebraeisch: {
    id: 'hebraeisch', name: tk('Hebräisch'), sample: 'א', chars: HE_LETTERS + HE_FINAL, groups: ['וין', 'דרך', 'הח', 'בכ', 'סם'],
    practice: [
      { label: tk('Buchstaben'), chars: HE_LETTERS },
      { label: tk('Endformen'), chars: HE_FINAL },
    ],
    dir: 'rtl', seg: 'block', modelDir: 'hebraeisch/', font: "KK-hebraeisch, Fredoka, 'Segoe UI', sans-serif", lang: 'he', strokes: 'hebraeisch', region: 'hebraeisch',
  },
  hangul: {
    id: 'hangul', name: tk('Hangul (Koreanisch)'), sample: '한', chars: KO_CONS + KO_VOW + KO_SYL, groups: [],
    practice: [
      { label: tk('Konsonanten'), chars: KO_CONS },
      { label: tk('Vokale'), chars: KO_VOW },
      { label: tk('Silben'), chars: KO_SYL },
    ],
    dir: 'ltr', seg: 'block', modelDir: 'hangul/', font: "KK-hangul, 'Malgun Gothic', 'Noto Sans KR', sans-serif", lang: 'ko', strokes: 'hangul', region: 'hangul',
  },
  thai: {
    id: 'thai', name: tk('Thailändisch'), sample: 'ก', chars: THAI, groups: ['ขฃ', 'คฅ'], practice: [{ label: tk('Konsonanten'), chars: THAI }], dir: 'ltr', seg: 'block',
    modelDir: 'thai/', font: "KK-thai, 'Leelawadee UI', 'Noto Sans Thai', sans-serif", lang: 'th', strokes: 'thai', region: 'thai',
  },
};

export const SCRIPT_IDS = Object.keys(SCRIPTS) as ScriptId[];

export function isScriptId(v: unknown): v is ScriptId {
  return typeof v === 'string' && Object.hasOwn(SCRIPTS, v);
}

export function scriptOf(id: ScriptId | undefined): ScriptDef {
  return SCRIPTS[id ?? 'druck'] ?? SCRIPTS.druck;
}

/** group lookup of one script: character -> the group string it belongs to (itself if none) */
export function groupMapOf(def: ScriptDef): (ch: string) => string {
  const m = new Map<string, string>();
  for (const g of def.groups) for (const c of g) m.set(c, g);
  return (ch) => m.get(ch) ?? ch;
}

/**
 * Which writing animation a letter gets (src/game/strokes.ts): Druck- and Grundschrift and the kana
 * have stroke orders; the Druckschrift model also shows the Grundschrift hooks unless the Vorlage is
 * "Druckschrift".
 */
export function strokeStyle(script: ScriptId, templateStyle: string): StrokeStyle | null {
  if (script === 'druck') return templateStyle === 'druck' ? 'druck' : 'grund';
  return scriptOf(script).strokes ?? null;
}

/** characters for the surprise bubbles: from the practice set of the target, never one confusable with the practised ones */
export function surprisePool(script: ScriptId, target: string, alsoAvoid: string[] = []): string[] {
  const def = scriptOf(script);
  if (def.seg === 'latin') return latinSurprisePool(target, alsoAvoid);
  const set = def.practice.find((s) => s.chars.includes(target)) ?? def.practice[0];
  const groupOf = groupMapOf(def);
  const avoid = new Set([target, ...alsoAvoid].map(groupOf));
  return [...set.chars].filter((c) => !avoid.has(groupOf(c)));
}

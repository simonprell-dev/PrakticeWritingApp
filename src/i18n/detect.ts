// First visit: the page language and the script to practise, guessed from where the game is opened.
// Only what the browser tells every page anyway (its language list and time zone): no location
// query, no permission prompt, nothing sent anywhere.
import type { ScriptId } from '../recog/scripts.ts';

/** the languages the page is translated into */
export const LANGS = ['de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'tr', 'uk', 'ru', 'el', 'he', 'ar', 'hi', 'th', 'ko', 'ja'] as const;
export type Lang = (typeof LANGS)[number];

export const RTL_LANGS: ReadonlySet<string> = new Set(['ar', 'he']);

/** the script children learn first in a language (Latin languages: the German Druckschrift) */
const SCRIPT_OF_LANG: Record<string, ScriptId> = {
  ja: 'hiragana',
  ru: 'kyrillisch',
  uk: 'kyrillisch',
  be: 'kyrillisch',
  bg: 'kyrillisch',
  sr: 'kyrillisch',
  mk: 'kyrillisch',
  kk: 'kyrillisch',
  ky: 'kyrillisch',
  mn: 'kyrillisch',
  ar: 'arabisch',
  hi: 'devanagari',
  mr: 'devanagari',
  ne: 'devanagari',
  el: 'griechisch',
  he: 'hebraeisch',
  ko: 'hangul',
  th: 'thai',
};

/** time zones of the countries of each script (when the browser language does not tell) */
const SCRIPT_OF_ZONE: [RegExp, ScriptId, Lang][] = [
  [/^Asia\/Tokyo$/, 'hiragana', 'ja'],
  [/^Asia\/(Seoul|Pyongyang)$/, 'hangul', 'ko'],
  [/^Asia\/Bangkok$/, 'thai', 'th'],
  [/^Asia\/(Kolkata|Calcutta|Kathmandu|Katmandu)$/, 'devanagari', 'hi'],
  [/^Asia\/(Jerusalem|Tel_Aviv)$/, 'hebraeisch', 'he'],
  [/^Europe\/(Athens|Nicosia)$|^Asia\/(Nicosia|Famagusta)$/, 'griechisch', 'el'],
  [/^Europe\/(Moscow|Kaliningrad|Samara|Volgograd|Saratov|Ulyanovsk|Astrakhan|Kirov|Minsk)$|^Asia\/(Yekaterinburg|Omsk|Novosibirsk|Barnaul|Tomsk|Novokuznetsk|Krasnoyarsk|Irkutsk|Chita|Yakutsk|Khandyga|Vladivostok|Ust-Nera|Magadan|Sakhalin|Srednekolymsk|Kamchatka|Anadyr|Almaty|Bishkek|Ulaanbaatar)$/, 'kyrillisch', 'ru'],
  [/^Europe\/(Kyiv|Kiev|Simferopol)$/, 'kyrillisch', 'uk'],
  [/^Europe\/(Sofia|Belgrade|Skopje)$/, 'kyrillisch', 'en'],
  [/^Africa\/(Cairo|Casablanca|Algiers|Tunis|Tripoli|Khartoum|Nouakchott)$|^Asia\/(Riyadh|Dubai|Qatar|Kuwait|Bahrain|Baghdad|Damascus|Amman|Beirut|Aden|Muscat|Gaza|Hebron)$/, 'arabisch', 'ar'],
];

export function isLang(v: unknown): v is Lang {
  return typeof v === 'string' && (LANGS as readonly string[]).includes(v);
}

/** best supported language from a browser language list ("de-AT" -> de) */
export function langFrom(list: readonly string[]): Lang | null {
  for (const l of list) {
    const base = l.toLowerCase().split('-')[0];
    if (isLang(base)) return base;
  }
  return null;
}

export function detectLocale(
  languages: readonly string[] = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [],
  timeZone: string = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone ?? '' : '',
): { lang: Lang; script: ScriptId } {
  const lang = langFrom(languages);
  const zone = SCRIPT_OF_ZONE.find(([re]) => re.test(timeZone));
  // a language with a script of its own decides; English (and unknown languages) leave it to the time zone
  for (const l of languages) {
    const s = SCRIPT_OF_LANG[l.toLowerCase().split('-')[0]];
    if (s) return { lang: lang ?? zone?.[2] ?? 'en', script: s };
    if (isLang(l.toLowerCase().split('-')[0]) && l.toLowerCase().split('-')[0] !== 'en') break;
  }
  if (lang && lang !== 'en') return { lang, script: 'druck' };
  if (zone) return { lang: lang ?? zone[2], script: zone[1] };
  return { lang: lang ?? 'de', script: 'druck' };
}

// Translations. German is the source language and the German text is the key:
//   t('Fertig!')                      -> "Done!" in English
//   t('{n} Tiere', { n: 3 })          -> "3 animals"
//   tk('Großbuchstaben')              -> marks a text for translation where it is defined; t(value) translates it where it is shown
// The texts are collected by tools/i18n-extract.ts into src/i18n/source.json; every language has a
// catalogue src/i18n/locales/<lang>.json (German text -> translation). Missing entries stay German.
import { isLang, RTL_LANGS, type Lang } from './detect.ts';

let catalog: Record<string, string> = {};
let current: Lang = 'de';

const catalogs = import.meta.glob<{ default: Record<string, string> }>('./locales/*.json');

/** loads the catalogue of a language and sets lang/dir of the page; call before the first t() */
export async function setLanguage(lang: string): Promise<void> {
  const l: Lang = isLang(lang) ? lang : 'de';
  catalog = {};
  if (l !== 'de') {
    const load = catalogs[`./locales/${l}.json`];
    try {
      if (load) catalog = (await load()).default;
    } catch {
      /* stays German */
    }
  }
  current = l;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.documentElement.dir = RTL_LANGS.has(l) ? 'rtl' : 'ltr';
  }
}

/** the language of the page */
export function language(): Lang {
  return current;
}

/** the translation of a German text; {name} placeholders are filled from params */
export function t(source: string, params?: Record<string, string | number>): string {
  const s = catalog[source] || source;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}

/** marks a German text for the translation catalogue without translating it (translated where it is shown) */
export function tk<T extends string>(source: T): T {
  return source;
}

/** names of the languages in their own language (for the language menu) */
export const LANG_NAMES: Record<Lang, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  pl: 'Polski',
  tr: 'Türkçe',
  uk: 'Українська',
  ru: 'Русский',
  el: 'Ελληνικά',
  he: 'עברית',
  ar: 'العربية',
  hi: 'हिन्दी',
  th: 'ไทย',
  ko: '한국어',
  ja: '日本語',
};

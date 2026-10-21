// Character set, confusable groups and German helpers. Must match tools/train/common.py.

export const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzß';
export const NUM_CLASSES = CHARSET.length;

/** Characters that look identical in isolation; their probabilities are summed. */
export const GROUPS = ['0Oo', '1Il', 'cC', 'kK', 'mM', 'pP', 'sS', 'uU', 'vV', 'wW', 'xX', 'yY', 'zZ', 'jJ'];

const groupMap = new Map<string, string>();
for (const g of GROUPS) for (const c of g) groupMap.set(c, g);

export function groupOf(ch: string): string {
  return groupMap.get(ch) ?? ch;
}

export const UMLAUTS: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' };
const UMLAUT_BASE: Record<string, string> = Object.fromEntries(Object.entries(UMLAUTS).map(([b, u]) => [u, b]));

/** Base letter the classifier sees (umlaut dots are stripped before recognition). */
export function baseOf(ch: string): string {
  return UMLAUT_BASE[ch] ?? ch;
}

export function isUmlaut(ch: string): boolean {
  return ch in UMLAUT_BASE;
}

/** Number of dots/dashes the character carries on top. */
export function expectedDots(ch: string): number {
  if (ch === 'i' || ch === 'j') return 1;
  return isUmlaut(ch) ? 2 : 0;
}

export function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

/** "das B", "die 3", "das ß" */
export function withArticle(ch: string): string {
  return `${isDigit(ch) ? 'die' : 'das'} ${ch}`;
}

export const PRACTICE_SETS = [
  { label: 'Großbuchstaben', chars: 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ' },
  { label: 'Kleinbuchstaben', chars: 'abcdefghijklmnopqrstuvwxyzäöüß' },
  { label: 'Zahlen', chars: '0123456789' },
];

export function classIndex(ch: string): number {
  return CHARSET.indexOf(ch);
}

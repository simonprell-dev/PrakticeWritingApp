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

/**
 * Letters for the surprise bubbles of the practice mode: the same kind as the practice letter (capitals,
 * small letters or digits), never one the recogniser could confuse with it (or with the other practice
 * letters in `alsoAvoid`), and no umlauts or ß (they differ from other letters only by their dots).
 */
export function surprisePool(target: string, alsoAvoid: string[] = []): string[] {
  const set = PRACTICE_SETS.find((s) => s.chars.includes(target)) ?? PRACTICE_SETS[0];
  const avoid = new Set([target, ...alsoAvoid].map((c) => groupOf(baseOf(c))));
  return [...set.chars].filter((c) => !isUmlaut(c) && c !== 'ß' && !avoid.has(groupOf(c)));
}

/** where a letter sits in the school lines: bands its body reaches above and below the base line */
export function zoneOf(ch: string): [number, number] {
  const b = baseOf(ch);
  if (isDigit(b) || b !== b.toLowerCase()) return [2, 0];
  if ('bdfhklß'.includes(b)) return [2, 0];
  if (b === 't') return [1.6, 0];
  if ('gjpqy'.includes(b)) return [1, 1];
  return [1, 0];
}

/** measured position in the bands (see GlyphFeatures.zone) */
export interface Zone {
  top: number;
  bottom: number;
  /** the base line was a guess (evenly spaced lines): it may also be one band higher */
  ambiguous: boolean;
}

/** how far (in bands) a written letter is from where it belongs in the school lines */
export function zoneDeviation(ch: string, z: Zone): number {
  const [eT, eB] = zoneOf(ch);
  // ß is taught with and without a descender (Bavarian Druckschrift: below the base line)
  const bottoms = baseOf(ch) === 'ß' ? [eB, 1] : [eB];
  const dev = (k: number) => Math.min(...bottoms.map((b) => Math.abs(z.top - k - eT) + Math.abs(z.bottom + k - b)));
  return z.ambiguous ? Math.min(dev(0), dev(1)) : dev(0);
}

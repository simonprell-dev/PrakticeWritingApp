// Stable file names for recorded voice lines: a short readable slug of the text plus a hash, so a
// recording belongs to exactly one text (a changed text needs a new recording).

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** "Hallo! Ich bin Zork." -> "hallo-ich-bin-zork-1k3x9" */
export function voiceId(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
    .replace(/-+$/g, '');
  return `${slug || 'zeile'}-${fnv1a(text).toString(36).slice(0, 5)}`;
}

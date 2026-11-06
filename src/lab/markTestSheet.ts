// A throwaway A4 test sheet: dot fields in several shades and sizes on the papers of the planned print templates,
// to measure in the lab what the printer, the copier and the camera really keep. Units are mm.

export interface TestField {
  id: string;
  kind: 'dots' | 'boxes';
  paper: 'weiss' | 'zeile' | 'band' | 'liniert' | 'kariert';
  color: string;
  /** dots: radius; boxes: half the side */
  radius: number;
  page: 1 | 2;
  box: { x: number; y: number; w: number; h: number };
}

/** spacing of the dots */
export const DOT_PITCH = 3;
/** spacing of the boxes */
export const BOX_PITCH = 4;

const SHADES: [string, string][] = [
  ['blass', '#d9dde8'],
  ['mittel', '#c6cddd'],
  ['kraeftig', '#aab3c8'],
  ['dunkel', '#8d879c'],
];
const RADII: [string, number][] = [
  ['016', 0.16],
  ['022', 0.22],
  ['030', 0.3],
];
const FIELD_W = 58;
const FIELD_H = 20;
const COLS = [15, 76, 137];
const TOP = 16;
const ROW = 22.5;
const BOX_ROW = 205;

function dotFields(page: 1 | 2, papers: TestField['paper'][]): TestField[] {
  const out: TestField[] = [];
  let row = 0;
  for (const paper of papers)
    for (const [shade, color] of SHADES) {
      RADII.forEach(([size, radius], c) => {
        out.push({ id: `${paper}-${shade}-${size}`, kind: 'dots', paper, color, radius, page, box: { x: COLS[c], y: TOP + row * ROW, w: FIELD_W, h: FIELD_H } });
      });
      row++;
    }
  return out;
}

export const TEST_FIELDS: TestField[] = [
  ...dotFields(1, ['weiss', 'zeile', 'band']),
  ...dotFields(2, ['liniert', 'kariert']),
  { id: 'kaestchen-hell', kind: 'boxes', paper: 'weiss', color: '#8d879c', radius: 1, page: 2, box: { x: COLS[0], y: BOX_ROW, w: FIELD_W, h: FIELD_H } },
  { id: 'kaestchen-dunkel', kind: 'boxes', paper: 'weiss', color: '#6d6680', radius: 1, page: 2, box: { x: COLS[1], y: BOX_ROW, w: FIELD_W, h: FIELD_H } },
];

function paperOf(f: TestField): string {
  const { x, y, w, h } = f.box;
  if (f.paper === 'zeile' || f.paper === 'band') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f.paper === 'zeile' ? '#f8fafe' : '#e3edfa'}"/>`;
  const lines: string[] = [];
  if (f.paper === 'liniert') for (let v = y + 4; v < y + h; v += 8) lines.push(`<line x1="${x}" y1="${v}" x2="${x + w}" y2="${v}" stroke="#b3c4de" stroke-width="0.3"/>`);
  if (f.paper === 'kariert') {
    for (let v = y; v <= y + h; v += 5) lines.push(`<line x1="${x}" y1="${v}" x2="${x + w}" y2="${v}" stroke="#c9d6e8" stroke-width="0.3"/>`);
    for (let v = x; v <= x + w; v += 5) lines.push(`<line x1="${v}" y1="${y}" x2="${v}" y2="${y + h}" stroke="#c9d6e8" stroke-width="0.3"/>`);
  }
  return lines.join('');
}

function marksOf(f: TestField): string {
  const { x, y, w, h } = f.box;
  const out: string[] = [];
  const pitch = f.kind === 'dots' ? DOT_PITCH : BOX_PITCH;
  for (let v = y + pitch / 2; v < y + h; v += pitch)
    for (let u = x + pitch / 2; u < x + w; u += pitch) {
      const cx = +u.toFixed(2);
      const cy = +v.toFixed(2);
      out.push(
        f.kind === 'dots'
          ? `<circle cx="${cx}" cy="${cy}" r="${f.radius}" fill="${f.color}"/>`
          : `<rect x="${cx - f.radius}" y="${cy - f.radius}" width="${2 * f.radius}" height="${2 * f.radius}" fill="${f.color}"/>`,
      );
    }
  return out.join('');
}

export function markTestSvg(page: 1 | 2): string {
  const fields = TEST_FIELDS.filter((f) => f.page === page)
    .map((f) => `<text x="${f.box.x}" y="${f.box.y - 0.6}" font-size="1.9" fill="#555" font-family="sans-serif">${f.id}</text>${paperOf(f)}${marksOf(f)}`)
    .join('\n');
  // the crown of the corners, to judge it on paper
  const crown = page === 2 ? `<path transform="translate(166 215)" d="M-4 2.4 L-4.6 -2.4 L-1.9 -0.4 L0 -3.2 L1.9 -0.4 L4.6 -2.4 L4 2.4 Z" fill="#6d6680"/><text x="137" y="${BOX_ROW - 0.6}" font-size="1.9" fill="#555" font-family="sans-serif">krone</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297" width="210mm" height="297mm">
<rect width="210" height="297" fill="#fff"/>
<text x="15" y="11" font-size="3" fill="#555" font-family="sans-serif">Krakel &amp; Krone · Testblatt ${page} von 2 · mit 100 % Skalierung drucken</text>
${fields}
${crown}
</svg>`;
}

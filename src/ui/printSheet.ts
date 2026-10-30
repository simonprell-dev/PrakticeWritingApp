// The copy template of the Mal-Aquarium: an A4 page with six cards and cut lines, as SVG.
// It is printed from the page itself (a print-only element), so no pop-up window is needed.
import { INK } from '../game/paint/cardArt.ts';
import { CARD, FREEFORM, LINE, SHEET, sheetLayout } from '../game/paint/fishCard.ts';
import { labelsFor, sheetSpecies, type SheetId } from '../game/paint/sheets.ts';
import { SPECIES, type SpeciesId } from '../game/paint/species.ts';
import { isLocalHost } from './legal.ts';

/** one card as SVG, its frame's top-left corner at (x, y) mm */
function cardSvg(sp: SpeciesId, x: number, y: number): string {
  const { w, h, frame: f } = CARD;
  const def = SPECIES[sp];
  const L = labelsFor(sp);
  const u = 1 / def.place.s;
  const parts = def.parts.map((p) => `<path d="${p.d}" fill="#fff" stroke="${INK}" stroke-width="${LINE.outline * u}" stroke-linejoin="round"/>`).join('');
  const lines = def.lines.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${LINE.inner * u}" stroke-linecap="round"/>`).join('');
  const strokes = def.strokes.map((d) => `
<path d="${d}" fill="none" stroke="${INK}" stroke-width="${LINE.outline * u * 0.8}" stroke-linecap="round"/>`).join('');
  const eyes = def.eyes
    .map(({ pupil, ...eye }) => `
<circle cx="${eye.x}" cy="${eye.y}" r="${eye.r}" fill="#fff" stroke="${INK}" stroke-width="${LINE.inner * u * 1.3}"/>
<circle cx="${pupil.x}" cy="${pupil.y}" r="${pupil.r}" fill="${INK}"/>
<circle cx="${pupil.x - 0.9}" cy="${pupil.y - 1}" r="0.85" fill="#fff"/>`)
    .join('');
  const text = (l: { text: string; x: number; y: number }, size: number, anchor: string) =>
    `<text x="${l.x}" y="${l.y}" font-size="${size}" text-anchor="${anchor}" fill="#4a4458" font-family="Fredoka, sans-serif" font-weight="600">${l.text}</text>`;
  // the free-form card has no animal; the inner group is a matrix, so only the cards count as translate(...)
  const animal = def.parts.length ? `<g transform="matrix(${def.place.s} 0 0 ${def.place.s} ${def.place.x} ${def.place.y})">${parts}${lines}${strokes}${eyes}</g>
` : '';
  // the free-form card: a box around the hint and a drawn arrow (they tell the camera which way up it lies)
  const { hintBox: b, arrow: a } = FREEFORM;
  const marks = L.arrow
    ? `<g fill="none" stroke="#4a4458" stroke-width="${FREEFORM.width}" stroke-linecap="round" stroke-linejoin="round"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}"/><path d="M${a.x0} ${a.y}H${a.x1} M${a.x1 - a.head} ${a.y - a.head * 0.75}L${a.x1} ${a.y}L${a.x1 - a.head} ${a.y + a.head * 0.75}"/></g>
`
    : '';
  return `<g transform="translate(${x} ${y})">
<path d="M0 0H${w}V${h}H0Z M${f} ${f}V${h - f}H${w - f}V${f}Z" fill="${INK}" fill-rule="evenodd"/>
${animal}${text(L.hint, L.hint.size, 'end')}
${L.arrow ? text(L.arrow, L.hint.size, 'end') + '\n' + marks : ''}${text(L.name, L.name.size, 'start')}
<line x1="${L.line.x0}" y1="${L.line.y}" x2="${L.line.x1}" y2="${L.line.y}" stroke="#6d6680" stroke-width="0.35"/>
</g>`;
}

/** y (mm) of the footer's baseline: below the cut lines of the bottom row, inside the printable margin */
export const FOOTER_Y = 292.3;

/** the whole A4 page (mm units); `host` is the web address shown in the footer (left out if empty) */
export function sheetSvg(id: SheetId = 'fisch', opts: { host?: string } = {}): string {
  const L = sheetLayout();
  const animals = sheetSpecies(id);
  const cut: string[] = [];
  // dashed cut lines between the cards (and around them)
  for (let c = 0; c <= SHEET.cols; c++) {
    const x = L.x0 + c * L.cellW;
    cut.push(`<line x1="${x}" y1="${L.y0}" x2="${x}" y2="${L.y0 + SHEET.rows * L.cellH}"/>`);
  }
  for (let r = 0; r <= SHEET.rows; r++) {
    const y = L.y0 + r * L.cellH;
    cut.push(`<line x1="${L.x0}" y1="${y}" x2="${L.x0 + SHEET.cols * L.cellW}" y2="${y}"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SHEET.w} ${SHEET.h}" width="${SHEET.w}mm" height="${SHEET.h}mm">
<rect width="${SHEET.w}" height="${SHEET.h}" fill="#fff"/>
<g stroke="#b8b4c4" stroke-width="${LINE.frameDash}" stroke-dasharray="2 1.6">${cut.join('')}</g>
<text x="${L.x0 + 1}" y="${L.y0 - 1.6}" font-size="2.6" fill="#8d879c" font-family="Fredoka, sans-serif">✂ Krakel &amp; Krone · Mal-Aquarium – ausmalen, ausschneiden (der schwarze Rahmen muss ganz bleiben) und unter die Kamera legen</text>
${L.cells.map((c, i) => cardSvg(animals[i], c.x, c.y)).join('\n')}
<text x="${SHEET.w / 2}" y="${FOOTER_Y}" font-size="2.2" text-anchor="middle" fill="#9a95a8" font-family="Fredoka, sans-serif">${opts.host ? `${opts.host.replace(/&/g, '&amp;').replace(/</g, '&lt;')} · ` : ''}Ein Projekt von PrellDynamics · prelldynamics.de</text>
</svg>`;
}

/** Opens the print dialog with the template (there it can also be saved as PDF). */
export function printSheet(id: SheetId = 'fisch'): void {
  document.querySelector('.print-sheet')?.remove();
  const el = document.createElement('div');
  el.className = 'print-sheet';
  el.innerHTML = sheetSvg(id, { host: isLocalHost() ? '' : location.host });
  document.body.append(el);
  const done = () => {
    el.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // give the browser a moment to lay out the SVG before the dialog takes its picture
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}

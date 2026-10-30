// The copy template of the Mal-Aquarium: an A4 page with six fish cards and cut lines, as SVG.
// It is printed from the page itself (a print-only element), so no pop-up window is needed.
import { INK } from '../game/paint/cardArt.ts';
import { CARD, LABELS, LINE, SHEET, sheetLayout } from '../game/paint/fishCard.ts';
import { SPECIES } from '../game/paint/species.ts';

/** one card as SVG, its frame's top-left corner at (x, y) mm */
function cardSvg(x: number, y: number): string {
  const { w, h, frame: f } = CARD;
  const sp = SPECIES.fisch;
  const u = 1 / sp.place.s;
  const parts = sp.parts.map((p) => `<path d="${p.d}" fill="#fff" stroke="${INK}" stroke-width="${LINE.outline * u}" stroke-linejoin="round"/>`).join('');
  const lines = sp.lines.map((d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${LINE.inner * u}" stroke-linecap="round"/>`).join('');
  const { pupil, ...eye } = sp.eyes[0];
  return `<g transform="translate(${x} ${y})">
<path d="M0 0H${w}V${h}H0Z M${f} ${f}V${h - f}H${w - f}V${f}Z" fill="${INK}" fill-rule="evenodd"/>
<g transform="translate(${sp.place.x} ${sp.place.y}) scale(${sp.place.s})">${parts}${lines}
<path d="${sp.strokes[0]}" fill="none" stroke="${INK}" stroke-width="${LINE.outline * u * 0.8}" stroke-linecap="round"/>
<circle cx="${eye.x}" cy="${eye.y}" r="${eye.r}" fill="#fff" stroke="${INK}" stroke-width="${LINE.inner * u * 1.3}"/>
<circle cx="${pupil.x}" cy="${pupil.y}" r="${pupil.r}" fill="${INK}"/>
<circle cx="${pupil.x - 0.9}" cy="${pupil.y - 1}" r="0.85" fill="#fff"/></g>
<text x="${LABELS.hint.x}" y="${LABELS.hint.y}" font-size="${LABELS.hint.size}" text-anchor="end" fill="#4a4458" font-family="Fredoka, sans-serif" font-weight="600">${LABELS.hint.text}</text>
<text x="${LABELS.name.x}" y="${LABELS.name.y}" font-size="${LABELS.name.size}" fill="#4a4458" font-family="Fredoka, sans-serif" font-weight="600">${LABELS.name.text}</text>
<line x1="${LABELS.line.x0}" y1="${LABELS.line.y}" x2="${LABELS.line.x1}" y2="${LABELS.line.y}" stroke="#6d6680" stroke-width="0.35"/>
</g>`;
}

/** the whole A4 page (mm units) */
export function sheetSvg(): string {
  const L = sheetLayout();
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
${L.cells.map((c) => cardSvg(c.x, c.y)).join('\n')}
</svg>`;
}

/** Opens the print dialog with the template (there it can also be saved as PDF). */
export function printSheet(): void {
  document.querySelector('.print-sheet')?.remove();
  const el = document.createElement('div');
  el.className = 'print-sheet';
  el.innerHTML = sheetSvg();
  document.body.append(el);
  const done = () => {
    el.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // give the browser a moment to lay out the SVG before the dialog takes its picture
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}

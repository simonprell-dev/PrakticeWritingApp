// Mal-Aquarium: how it works, the copy template to print, and the big view of a painted fish.
import type { AnyCanvas } from '../game/canvas.ts';
import { drawCard } from '../game/paint/cardArt.ts';
import { CARD } from '../game/paint/fishCard.ts';
import { button, h, modal } from './dom.ts';
import { printSheet } from './printSheet.ts';

export function cardPreview(width = 300): HTMLCanvasElement {
  const k = (width - 16) / CARD.w;
  const cv = h('canvas', { width, height: Math.round(CARD.h * k + 16), class: 'card-preview' });
  const ctx = cv.getContext('2d')!;
  const draw = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate(8, 8);
    drawCard(ctx, k, { fills: { body: '#ffb347', tail: '#ff6f91', dorsal: '#4fb3ff', anal: '#4fb3ff', pelvic: '#4fb3ff', pectoral: '#ffd84a' } });
    ctx.restore();
  };
  if (document.fonts?.ready) void document.fonts.ready.then(draw);
  draw();
  return cv;
}

export function openPaintLobby(start: () => void, openCamera: () => void): void {
  const step = (n: string, title: string, text: string) => h('li', null, h('span', { class: 'step-n' }, n), h('div', null, h('b', null, title), h('br'), text));
  const content = h(
    'div',
    { style: 'max-width:min(900px,92vw)' },
    h('h2', null, '🎨 Mal-Aquarium'),
    h(
      'div',
      { class: 'paint-lobby' },
      h(
        'div',
        null,
        h(
          'p',
          { class: 'help', style: 'font-size:1.05rem;margin-top:0' },
          'Hier geht es nicht um Buchstaben, sondern ums Malen: Jedes Kind malt einen Fisch bunt an – und der Fisch schwimmt mit genau diesen Farben im Aquarium.',
        ),
        h(
          'ol',
          { class: 'steps' },
          step('1', 'Vorlage drucken', 'Sechs Fische passen auf ein A4-Blatt. Gern auch kopieren.'),
          step('2', 'Ausmalen', 'Mit Buntstiften, Filzstiften oder Wachsmalern. Wer mag, gibt dem Fisch unten einen Namen.'),
          step('3', 'Unter die Kamera', 'Ausgeschnitten oder als ganzes Blatt. Der schwarze Rahmen muss ganz zu sehen sein. „Fertig!“ drücken – und der Fisch schwimmt los.'),
        ),
        h('p', { class: 'help' }, 'Tipp: Ein Fisch, der nachgemalt und gleich wieder gezeigt wird, bekommt seine neuen Farben. Fische antippen zeigt sie groß.'),
      ),
      cardPreview(300),
    ),
    h(
      'div',
      { class: 'actions' },
      button('📷 Kamera', () => openCamera(), 'btn small'),
      button('🖨️ Vorlage drucken', () => printSheet(), 'btn'),
      button('Abbrechen', () => m.close(), 'btn'),
      button(
        "Los geht's!",
        () => {
          m.close();
          start();
        },
        'btn primary',
      ),
    ),
  );
  const m = modal(content);
}

/** a painted fish, big; it can be sent away (e.g. when a card was scanned twice) */
export function openPaintedCard(info: { picture: AnyCanvas; name: AnyCanvas | null; release: () => void }): void {
  const pic = h('canvas', { width: info.picture.width, height: info.picture.height, class: 'painted-big' });
  pic.getContext('2d')!.drawImage(info.picture as CanvasImageSource, 0, 0);
  let name: HTMLElement | null = null;
  if (info.name) {
    const nc = h('canvas', { width: info.name.width, height: info.name.height, class: 'painted-name' });
    nc.getContext('2d')!.drawImage(info.name as CanvasImageSource, 0, 0);
    name = h('p', { class: 'painted-name-row' }, h('span', null, 'Ich heiße'), nc);
  }
  const content = h(
    'div',
    { style: 'text-align:center' },
    pic,
    name ?? h('p', { style: 'font-size:1.3rem' }, 'Blubb! Bin ich nicht schön bunt?'),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button(
        '👋 Wegschwimmen lassen',
        () => {
          m.close();
          info.release();
        },
        'btn small',
      ),
      button('Schließen', () => m.close(), 'btn primary'),
    ),
  );
  const m = modal(content);
}

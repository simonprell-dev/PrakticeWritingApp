// After a lesson: "Schriftproben spenden?" – the letters of the lesson as they would be uploaded (so the teacher
// sees exactly what leaves the device), upload or not, and "do not ask again".
import type { SampleEntry } from '../app/samples.ts';
import { makeCanvas } from '../game/canvas.ts';
import { t } from '../i18n/i18n.ts';
import { button, h, modal } from './dom.ts';

/** at most this many letters are shown; the rest is counted */
const SHOWN = 72;

function thumb(e: SampleEntry): HTMLElement {
  const { canvas, ctx } = makeCanvas(e.crop.width, e.crop.height);
  const img = ctx.createImageData(e.crop.width, e.crop.height);
  img.data.set(e.crop.data);
  ctx.putImageData(img, 0, 0);
  const el = canvas as HTMLCanvasElement;
  if (!(el instanceof HTMLCanvasElement)) {
    // an offscreen canvas cannot be shown: copy it into one that can
    const c = h('canvas', { width: e.crop.width, height: e.crop.height }) as HTMLCanvasElement;
    c.getContext('2d')!.drawImage(canvas as CanvasImageSource, 0, 0);
    return h('span', { class: 'sample-thumb', title: e.label }, c);
  }
  return h('span', { class: 'sample-thumb', title: e.label }, el);
}

export interface SamplesQuestionDeps {
  entries: readonly SampleEntry[];
  /** uploads; the window is closed already */
  upload(): void;
  /** "do not ask again" was ticked when the window closed */
  never(): void;
  /** the window is closed (after any choice) */
  done(): void;
}

export function openSamplesQuestion(d: SamplesQuestionDeps): void {
  let closed = false;
  const neverBox = h('input', { type: 'checkbox' }) as HTMLInputElement;
  const finish = (upload: boolean) => {
    if (closed) return;
    closed = true;
    m.close();
    if (neverBox.checked && !upload) d.never();
    d.done();
    if (upload) d.upload();
  };
  const more = d.entries.length - SHOWN;
  const content = h(
    'div',
    { class: 'samples-question', style: 'width:min(720px,90vw)' },
    h('h2', null, t('📤 Schriftproben spenden?')),
    h('p', null, t('Mit den Buchstaben dieser Stunde können wir die Erkennung für Kinderschrift verbessern. Hochgeladen werden nur diese ausgeschnittenen Buchstaben – keine Fotos, keine Namen.')),
    h('div', { class: 'sample-grid' }, ...d.entries.slice(0, SHOWN).map(thumb), more > 0 ? h('span', { class: 'sample-more' }, t('+{n} weitere', { n: more })) : null),
    h(
      'p',
      { class: 'help' },
      t('Bitte nur hochladen, wenn Ihre Schule und die Eltern damit einverstanden sind. Die Buchstaben werden nur für das Training der Erkennung genutzt und spätestens nach 12 Monaten gelöscht.'),
      ' ',
      h('a', { href: '/datenschutz', target: '_blank', rel: 'noopener' }, t('Datenschutzerklärung')),
    ),
    h('label', { class: 'samples-never' }, neverBox, ' ', t('Nicht mehr fragen (in den Einstellungen änderbar)')),
    h('div', { class: 'actions' }, button(t('Nicht hochladen'), () => finish(false), 'btn'), button(t('📤 Hochladen'), () => finish(true), 'btn primary')),
  );
  const m = modal(content, () => finish(false));
}

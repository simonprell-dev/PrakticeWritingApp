// Mal-Aquarium: how it works, the copy template to choose and print, and the big view of a painted animal.
import type { AnyCanvas } from '../game/canvas.ts';
import { drawCard } from '../game/paint/cardArt.ts';
import { CARD } from '../game/paint/fishCard.ts';
import { sheetSpecies, sheetTitle, type SheetId } from '../game/paint/sheets.ts';
import { ANIMALS, SPECIES } from '../game/paint/species.ts';
import type { PaintGallery } from '../scenes/paintScene.ts';
import { t } from '../i18n/i18n.ts';
import { button, clear, h, modal, segmented } from './dom.ts';
import { printSheet } from './printSheet.ts';

const SAMPLE = ['#ffb347', '#ff6f91', '#4fb3ff', '#ffd84a', '#7ed957', '#b983ff'];
const SHEET_KEY = 'kk.paintSheet';
const SIMPLE_SHEETS: SheetId[] = ['mix-a', 'mix-b', 'freiform'];

function isSheetId(v: unknown): v is SheetId {
  return v === 'mix-a' || v === 'mix-b' || (typeof v === 'string' && Object.hasOwn(SPECIES, v));
}

function loadSheet(): SheetId {
  try {
    const v = localStorage.getItem(SHEET_KEY);
    if (isSheetId(v)) return v;
  } catch {
    /* no storage: the choice lives for this visit only */
  }
  return 'mix-a';
}

function saveSheet(id: SheetId): void {
  try {
    localStorage.setItem(SHEET_KEY, id);
  } catch {
    /* ignore */
  }
}

/** the six cards of a sheet, small, in a 3 x 2 grid, coloured with sample fills */
export function sheetPreview(id: SheetId, width = 360): HTMLCanvasElement {
  const gap = 8;
  const pad = 8;
  const k = (width - 2 * pad - 2 * gap) / (3 * CARD.w);
  const cv = h('canvas', { width, height: Math.round(2 * CARD.h * k + gap + 2 * pad), class: 'card-preview' });
  const ctx = cv.getContext('2d')!;
  const animals = sheetSpecies(id);
  const draw = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    animals.forEach((species, i) => {
      const fills: Record<string, string> = {};
      SPECIES[species].parts.forEach((p, j) => (fills[p.id] = SAMPLE[(i + j) % SAMPLE.length]));
      ctx.save();
      ctx.translate(pad + (i % 3) * (CARD.w * k + gap), pad + Math.floor(i / 3) * (CARD.h * k + gap));
      drawCard(ctx, k, { species, fills });
      ctx.restore();
    });
  };
  if (document.fonts?.ready) void document.fonts.ready.then(draw);
  draw();
  return cv;
}

export function openPaintLobby(start: () => void, openCamera: () => void): void {
  let sheet = loadSheet();
  const chooser = h('div', { class: 'sheet-chooser' });
  const previewBox = h('div', { class: 'sheet-preview' });
  const heading = h('p', { class: 'help sheet-title' });
  const refresh = () => {
    clear(previewBox);
    previewBox.append(sheetPreview(sheet));
    heading.textContent = t('Vorlage: {title}', { title: t(sheetTitle(sheet)) });
    clear(chooser);
    const isSingle = sheet in SPECIES && sheet !== 'freiform';
    const select = h('select', { 'aria-label': t('Ein Tier wählen') }) as HTMLSelectElement;
    select.append(h('option', { value: '' }, t('Ein Tier: …')));
    for (const id of ANIMALS) select.append(h('option', { value: id }, t(SPECIES[id].name)));
    select.value = isSingle ? sheet : '';
    select.onchange = () => {
      if (!isSheetId(select.value)) return;
      sheet = select.value;
      saveSheet(sheet);
      refresh();
    };
    const seg = segmented(
      SIMPLE_SHEETS.map((value) => ({ value, label: t(sheetTitle(value)) })),
      (isSingle ? '' : sheet) as SheetId,
      (v) => {
        sheet = v;
        saveSheet(sheet);
        refresh();
      },
    );
    chooser.append(seg, select);
  };
  refresh();
  const step = (n: string, title: string, text: string) => h('li', null, h('span', { class: 'step-n' }, n), h('div', null, h('b', null, title), h('br'), text));
  const content = h(
    'div',
    { style: 'max-width:min(900px,92vw)' },
    h('h2', null, `🎨 ${t('Mal-Aquarium')}`),
    h(
      'div',
      { class: 'paint-lobby' },
      h(
        'div',
        null,
        h(
          'p',
          { class: 'help', style: 'font-size:1.05rem;margin-top:0' },
          t('Hier geht es nicht um Buchstaben, sondern ums Malen: Jedes Kind malt ein Tier bunt an – und das Tier schwimmt mit genau diesen Farben im Aquarium.'),
        ),
        h(
          'ol',
          { class: 'steps' },
          step('1', t('Vorlage drucken'), t('Sechs Tiere passen auf ein A4-Blatt. Gern auch kopieren.')),
          step('2', t('Ausmalen'), t('Mit Buntstiften, Filzstiften oder Wachsmalern. Wer mag, gibt dem Tier unten einen Namen.')),
          step('3', t('Unter die Kamera'), t('Ausgeschnitten oder als ganzes Blatt. Der schwarze Rahmen muss ganz zu sehen sein. „Fertig!“ drücken – und das Tier schwimmt los.')),
        ),
        h('p', { class: 'help' }, t('Tipp: Ein Tier, das nachgemalt und gleich wieder gezeigt wird, bekommt seine neuen Farben. Tiere antippen zeigt sie groß.')),
      ),
      h('div', { class: 'sheet-side' }, chooser, heading, previewBox),
    ),
    h(
      'div',
      { class: 'actions' },
      button(`📷 ${t('Kamera')}`, () => openCamera(), 'btn small'),
      button(`🖨️ ${t('Vorlage drucken')}`, () => printSheet(sheet), 'btn'),
      button(t('Abbrechen'), () => m.close(), 'btn'),
      button(
        t("Los geht's!"),
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

/** a canvas copied into the page (the pictures may be offscreen canvases) */
function copyCanvas(src: AnyCanvas, cls: string): HTMLCanvasElement {
  const c = h('canvas', { width: src.width, height: src.height, class: cls });
  c.getContext('2d')!.drawImage(src as CanvasImageSource, 0, 0);
  return c;
}

/** „3 Tiere gescannt, 2 schwimmen gerade im Aquarium.“: a whole sentence for each singular/plural case */
function scannedText(n: number, here: number): string {
  if (n === 1) return here === 1 ? t('1 Tier gescannt, 1 schwimmt gerade im Aquarium.') : t('1 Tier gescannt, {here} schwimmen gerade im Aquarium.', { here });
  return here === 1 ? t('{n} Tiere gescannt, 1 schwimmt gerade im Aquarium.', { n }) : t('{n} Tiere gescannt, {here} schwimmen gerade im Aquarium.', { n, here });
}

/** all animals scanned in this game; tapping one that is still here shows it big */
export function openPaintGallery(g: PaintGallery): void {
  const here = g.animals.filter((a) => !a.gone).length;
  const tiles = g.animals.map((a, i) => {
    const tile = button(
      [
        copyCanvas(a.picture, ''),
        a.name ? copyCanvas(a.name, 'tile-name') : null,
        h('small', null, a.gone ? t('Nr. {n} · weggeschwommen', { n: i + 1 }) : t('Nr. {n}', { n: i + 1 })),
      ],
      () => {
        if (!a.show) return;
        m.close();
        a.show();
      },
      `tile${a.gone ? ' gone' : ''}`,
      a.gone ? t('Schon weggeschwommen') : t('Groß ansehen'),
    );
    return tile;
  });
  const content = h(
    'div',
    { style: 'min-width:min(760px,90vw)' },
    h('h2', null, `🐠 ${t('Alle Tiere')}`),
    h(
      'p',
      { class: 'help' },
      g.animals.length
        ? scannedText(g.animals.length, here)
        : t('Noch keine Tiere – leg eine ausgemalte Karte unter die Kamera!'),
    ),
    tiles.length ? h('div', { class: 'painted-gallery' }, ...tiles) : null,
    g.unseen ? h('p', { class: 'help' }, g.unseen === 1 ? t('Dazu 1 Tier aus dem gespeicherten Spiel, das schon vorher weggeschwommen ist.') : t('Dazu {n} Tiere aus dem gespeicherten Spiel, die schon vorher weggeschwommen sind.', { n: g.unseen })) : null,
    h('div', { class: 'actions' }, button(t('Schließen'), () => m.close(), 'btn primary')),
  );
  const m = modal(content);
}

/** a painted animal, big; it can be sent away (e.g. when a card was scanned twice) */
export function openPaintedCard(info: { picture: AnyCanvas; name: AnyCanvas | null; release: () => void }): void {
  const pic = h('canvas', { width: info.picture.width, height: info.picture.height, class: 'painted-big' });
  pic.getContext('2d')!.drawImage(info.picture as CanvasImageSource, 0, 0);
  let name: HTMLElement | null = null;
  if (info.name) {
    const nc = h('canvas', { width: info.name.width, height: info.name.height, class: 'painted-name' });
    nc.getContext('2d')!.drawImage(info.name as CanvasImageSource, 0, 0);
    name = h('p', { class: 'painted-name-row' }, h('span', null, t('Ich heiße')), nc);
  }
  const content = h(
    'div',
    { style: 'text-align:center' },
    pic,
    name ?? h('p', { style: 'font-size:1.3rem' }, t('Blubb! Bin ich nicht schön bunt?')),
    h(
      'div',
      { class: 'actions', style: 'justify-content:center' },
      button(
        `👋 ${t('Wegschwimmen lassen')}`,
        () => {
          m.close();
          info.release();
        },
        'btn small',
      ),
      button(t('Schließen'), () => m.close(), 'btn primary'),
    ),
  );
  const m = modal(content);
}

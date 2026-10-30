// Mal-Aquarium: how it works, the copy template to choose and print, and the big view of a painted animal.
import type { AnyCanvas } from '../game/canvas.ts';
import { drawCard } from '../game/paint/cardArt.ts';
import { CARD } from '../game/paint/fishCard.ts';
import { sheetSpecies, sheetTitle, type SheetId } from '../game/paint/sheets.ts';
import { ANIMALS, SPECIES } from '../game/paint/species.ts';
import { button, clear, h, modal, segmented } from './dom.ts';
import { printSheet } from './printSheet.ts';

const SAMPLE = ['#ffb347', '#ff6f91', '#4fb3ff', '#ffd84a', '#7ed957', '#b983ff'];
const SHEET_KEY = 'kk.paintSheet';
const SIMPLE_SHEETS: { value: SheetId; label: string }[] = [
  { value: 'mix-a', label: sheetTitle('mix-a') },
  { value: 'mix-b', label: sheetTitle('mix-b') },
  { value: 'freiform', label: sheetTitle('freiform') },
];

function isSheetId(v: unknown): v is SheetId {
  return v === 'mix-a' || v === 'mix-b' || (typeof v === 'string' && v in SPECIES);
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
    heading.textContent = `Vorlage: ${sheetTitle(sheet)}`;
    clear(chooser);
    const isSingle = sheet in SPECIES && sheet !== 'freiform';
    const select = h('select', { 'aria-label': 'Ein Tier wählen' }) as HTMLSelectElement;
    select.append(h('option', { value: '' }, 'Ein Tier: …'));
    for (const id of ANIMALS) select.append(h('option', { value: id }, SPECIES[id].name));
    select.value = isSingle ? sheet : '';
    select.onchange = () => {
      if (!isSheetId(select.value)) return;
      sheet = select.value;
      saveSheet(sheet);
      refresh();
    };
    const seg = segmented(
      SIMPLE_SHEETS,
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
          'Hier geht es nicht um Buchstaben, sondern ums Malen: Jedes Kind malt ein Tier bunt an – und das Tier schwimmt mit genau diesen Farben im Aquarium.',
        ),
        h(
          'ol',
          { class: 'steps' },
          step('1', 'Vorlage drucken', 'Sechs Tiere passen auf ein A4-Blatt. Gern auch kopieren.'),
          step('2', 'Ausmalen', 'Mit Buntstiften, Filzstiften oder Wachsmalern. Wer mag, gibt dem Tier unten einen Namen.'),
          step('3', 'Unter die Kamera', 'Ausgeschnitten oder als ganzes Blatt. Der schwarze Rahmen muss ganz zu sehen sein. „Fertig!“ drücken – und das Tier schwimmt los.'),
        ),
        h('p', { class: 'help' }, 'Tipp: Ein Tier, das nachgemalt und gleich wieder gezeigt wird, bekommt seine neuen Farben. Tiere antippen zeigt sie groß.'),
      ),
      h('div', { class: 'sheet-side' }, chooser, heading, previewBox),
    ),
    h(
      'div',
      { class: 'actions' },
      button('📷 Kamera', () => openCamera(), 'btn small'),
      button('🖨️ Vorlage drucken', () => printSheet(sheet), 'btn'),
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

/** a painted animal, big; it can be sent away (e.g. when a card was scanned twice) */
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

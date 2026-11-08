// Setup for the Wörter-Zoo: how much help (copy, remember, picture only) and the letters the class already
// knows, as the reading primer brings them in. Only words made of these letters come; at least one must fit.
import { WORD_LETTERS, type Settings, type Spelling, type WordHelp } from '../app/settings.ts';
import { usable, WORDS } from '../game/words/words.ts';
import { language, t } from '../i18n/i18n.ts';
import { scriptOf, type ScriptId } from '../recog/scripts.ts';
import { button, h, modal, segmented } from './dom.ts';

/** the words are German: the Wörter-Zoo is offered on a German page with a Latin script */
export const wordsOffered = (script: ScriptId, lang: string = language()) => lang === 'de' && scriptOf(script).seg === 'latin';

/** how many words of the zoo can come with these letters */
export function wordsPossible(known: string): number {
  const k = new Set(known);
  return WORDS.filter((w) => usable(w, k)).length;
}

export function openWoerterLobby(settings: Settings, save: () => void, start: () => void, openCamera: () => void): void {
  const s = settings.woerter;
  let known = new Set(s.known);
  const keys: HTMLButtonElement[] = [];
  const info = h('p', { class: 'help', style: 'font-weight:600' });
  const go = button(
    t('Los geht’s!'),
    () => {
      m.close();
      start();
    },
    'btn primary',
  );
  const refresh = () => {
    for (const k of keys) k.classList.toggle('on', known.has(k.dataset.ch ?? ''));
    const n = wordsPossible([...known].join(''));
    info.textContent = n ? (n === 1 ? t('Damit ist 1 Wort möglich.') : t('Damit sind {n} Wörter möglich.', { n })) : t('Damit ist noch kein Wort möglich – bitte mehr Buchstaben wählen.');
    info.style.color = n ? '' : '#e5484d';
    go.disabled = !n;
    // only a choice that works is kept
    if (n) {
      s.known = [...WORD_LETTERS].filter((c) => known.has(c)).join('');
      save();
    }
  };
  const grid = h('div', { class: 'picker-set', lang: 'de' });
  for (const ch of WORD_LETTERS) {
    const k = button(
      ch === 'ß' ? 'ß' : `${ch.toUpperCase()} ${ch}`,
      () => {
        if (known.has(ch)) known.delete(ch);
        else known.add(ch);
        refresh();
      },
      'picker-key',
    );
    k.dataset.ch = ch;
    k.style.minWidth = '3.4em';
    keys.push(k);
    grid.append(k);
  }
  const content = h(
    'div',
    { style: 'min-width:min(820px,92vw)' },
    h('h2', null, `🦁 ${t('Wörter-Zoo')}`),
    h(
      'p',
      { class: 'help', style: 'font-size:1.05rem' },
      t('Ein Bild erscheint – die Kinder schreiben das Wort dazu auf Papier, Namen von Dingen mit großem Anfangsbuchstaben. Stimmt das Wort, wird das Bild lebendig und zieht in den Zoo ein.'),
    ),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Hilfe')),
      segmented(
        [
          { value: '1', label: t('Abschreiben') },
          { value: '2', label: t('Merkwort') },
          { value: '3', label: t('Nur Bild') },
        ],
        String(s.help),
        (v) => {
          s.help = Number(v) as WordHelp;
          save();
        },
      ),
    ),
    h('p', { class: 'help' }, t('Abschreiben: Bild und Wort stehen da. Merkwort: Das Wort verschwindet nach 5 Sekunden. Nur Bild: Die Stimme spricht das Wort in Silben vor.')),
    h(
      'div',
      { class: 'row' },
      h('label', null, t('Schreibweise')),
      segmented(
        [
          { value: 'lautgetreu', label: t('Lautgetreu zählt') },
          { value: 'streng', label: t('Nur richtig geschrieben') },
        ],
        s.spelling,
        (v) => {
          s.spelling = v as Spelling;
          save();
        },
      ),
    ),
    h(
      'p',
      { class: 'help' },
      t('Lautgetreu zählt: Wer schreibt, was er hört („Hunt“, „Fogel“, „Schtern“), hat das Wort geschafft – danach zeigt der Zoo, wie man es richtig schreibt. Nur richtig geschrieben: Dann heißt es „Gut gehört!“ und das Wort wird noch einmal geschrieben.'),
    ),
    h('h3', null, t('Diese Buchstaben kennt die Klasse schon')),
    grid,
    h(
      'div',
      { class: 'row' },
      button(
        t('alle'),
        () => {
          known = new Set(WORD_LETTERS);
          refresh();
        },
        'btn small',
      ),
      button(
        t('keine'),
        () => {
          known = new Set();
          refresh();
        },
        'btn small',
      ),
      info,
    ),
    h(
      'div',
      { class: 'actions' },
      button(`📷 ${t('Kamera')}`, () => openCamera(), 'btn small'),
      button(t('Abbrechen'), () => m.close(), 'btn'),
      go,
    ),
  );
  const m = modal(content);
  refresh();
}

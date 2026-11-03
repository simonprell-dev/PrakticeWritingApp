// The language menu: the page is reloaded in the chosen language.
import { LANGS } from '../i18n/detect.ts';
import { language, LANG_NAMES, t } from '../i18n/i18n.ts';
import { button, h, modal } from './dom.ts';

/** the button for the start screen footer: the current language, opens the menu */
export function languageButton(choose: (lang: string) => void): HTMLElement {
  return button(`🌐 ${LANG_NAMES[language()]}`, () => openLanguagePicker(choose), 'btn small', t('Sprache wählen'));
}

export function openLanguagePicker(choose: (lang: string) => void): void {
  const now = language();
  const list = h(
    'div',
    { class: 'lang-list' },
    ...LANGS.map((l) =>
      button(
        h('span', { lang: l }, LANG_NAMES[l]),
        () => {
          m.close();
          if (l !== now) choose(l);
        },
        `btn small${l === now ? ' on' : ''}`,
      ),
    ),
  );
  const content = h(
    'div',
    { style: 'min-width:min(560px,90vw)' },
    h('h2', null, `🌐 ${t('Sprache')}`),
    list,
    h('div', { class: 'actions' }, button(t('Schließen'), () => m.close(), 'btn primary')),
  );
  const m = modal(content);
}

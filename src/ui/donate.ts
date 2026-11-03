// The PayPal donate button: in the start screen footer, on every victory screen and once after a free game.
import { button, h, modal } from './dom.ts';
import { t, tk } from '../i18n/i18n.ts';

export const DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=8PTR5EKKK72WW';

const TITLE = tk('Krakel & Krone mit einer Spende über PayPal unterstützen');

export function donateButton(label = t('💛 Spenden'), cls = 'btn small'): HTMLAnchorElement {
  return h('a', { class: cls, href: DONATE_URL, target: '_blank', rel: 'noopener noreferrer', title: t(TITLE) }, label);
}

/** "Danke fürs Spielen!" with the donate button, for the end of a game */
export function donateBlock(title = true): HTMLElement {
  return h(
    'div',
    { class: 'donate-block' },
    h('div', null, title ? h('b', null, t('💛 Danke fürs Spielen!'), ' ') : null, t('Krakel & Krone ist kostenlos und ohne Werbung. Wenn es euch gefällt, freuen wir uns über eine kleine Spende.')),
    donateButton(t('💛 Spenden über PayPal'), 'btn small donate-btn'),
  );
}

/** A free game is left: a short thank-you before the menu (one button, closes with Escape too). */
export function openDonateThanks(done: () => void): void {
  const content = h(
    'div',
    { style: 'text-align:center;max-width:520px' },
    h('div', { style: 'font-size:3.2rem' }, '🎉'),
    h('h2', null, t('Danke fürs Spielen!')),
    donateBlock(false),
    h('div', { class: 'actions', style: 'justify-content:center' }, button(t('Weiter zum Menü'), () => m.close(), 'btn primary')),
  );
  const m = modal(content, done);
}

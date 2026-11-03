// The PayPal donate button: in the start screen footer, on every victory screen and once after a free game.
import { button, h, modal } from './dom.ts';

export const DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=8PTR5EKKK72WW';

const TITLE = 'Krakel & Krone mit einer Spende über PayPal unterstützen';

export function donateButton(label = '💛 Spenden', cls = 'btn small'): HTMLAnchorElement {
  return h('a', { class: cls, href: DONATE_URL, target: '_blank', rel: 'noopener noreferrer', title: TITLE }, label);
}

/** "Danke fürs Spielen!" with the donate button, for the end of a game */
export function donateBlock(title = true): HTMLElement {
  return h(
    'div',
    { class: 'donate-block' },
    h('div', null, title ? h('b', null, '💛 Danke fürs Spielen! ') : null, 'Krakel & Krone ist kostenlos und ohne Werbung. Wenn es euch gefällt, freuen wir uns über eine kleine Spende.'),
    donateButton('💛 Spenden über PayPal', 'btn small donate-btn'),
  );
}

/** A free game is left: a short thank-you before the menu (one button, closes with Escape too). */
export function openDonateThanks(done: () => void): void {
  const content = h(
    'div',
    { style: 'text-align:center;max-width:520px' },
    h('div', { style: 'font-size:3.2rem' }, '🎉'),
    h('h2', null, 'Danke fürs Spielen!'),
    donateBlock(false),
    h('div', { class: 'actions', style: 'justify-content:center' }, button('Weiter zum Menü', () => m.close(), 'btn primary')),
  );
  const m = modal(content, done);
}

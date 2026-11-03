// "Kontakt & Feedback": a message to the operator, stored on the server (POST /api/contact).
import { button, h, modal } from './dom.ts';
import { toast } from './toast.ts';
import { language, t } from '../i18n/i18n.ts';

const MAX_MESSAGE = 4000;
/** the server ignores forms sent faster than this (bots) */
const MIN_FILL_MS = 3000;

export function openContact(lang: string = language()): void {
  const opened = performance.now();
  const message = h('textarea', { rows: 7, maxlength: String(MAX_MESSAGE), required: true, placeholder: t('Lob, Ideen, Fehler, Fragen …') }) as HTMLTextAreaElement;
  const name = h('input', { type: 'text', maxlength: '100', autocomplete: 'name' }) as HTMLInputElement;
  const email = h('input', { type: 'email', maxlength: '200', autocomplete: 'email', placeholder: t('nur wenn wir antworten sollen') }) as HTMLInputElement;
  // honeypot: hidden from people, bots fill it in
  const website = h('input', { type: 'text', name: 'website', tabindex: '-1', autocomplete: 'off' }) as HTMLInputElement;
  const left = h('span', { class: 'help' }, `0 / ${MAX_MESSAGE}`);
  message.addEventListener('input', () => (left.textContent = `${message.value.length} / ${MAX_MESSAGE}`));
  const field = (label: string, ctrl: HTMLElement) => h('label', { class: 'contact-field' }, h('span', null, label), ctrl);
  const sendBtn = button(t('✉️ Absenden'), () => void submit(), 'btn primary');

  async function submit(): Promise<void> {
    const text = message.value.trim();
    if (!text) {
      toast(t('Bitte schreib eine Nachricht.'), 'warn');
      message.focus();
      return;
    }
    if (email.value.trim() && !email.checkValidity()) {
      toast(t('Die E-Mail-Adresse sieht nicht richtig aus.'), 'warn');
      email.focus();
      return;
    }
    const elapsedMs = Math.round(performance.now() - opened);
    if (elapsedMs < MIN_FILL_MS) await new Promise((r) => setTimeout(r, MIN_FILL_MS - elapsedMs + 50));
    sendBtn.disabled = true;
    try {
      const r = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          message: text,
          name: name.value.trim() || undefined,
          email: email.value.trim() || undefined,
          website: website.value,
          elapsedMs: Math.round(performance.now() - opened),
          lang,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        throw new Error(r.status === 429 && j?.error ? j.error : r.status === 503 ? t('Das Kontaktformular ist gerade nicht erreichbar.') : t('Senden hat nicht geklappt.'));
      }
      m.close();
      toast(t('Danke für deine Nachricht! 💌'), 'good', 4500);
    } catch (e) {
      sendBtn.disabled = false;
      const msg = e instanceof TypeError ? t('Keine Verbindung zum Server.') : (e as Error).message;
      toast(`${msg} ${t('Bitte später noch einmal versuchen.')}`, 'warn', 6000);
    }
  }

  const content = h(
    'form',
    {
      class: 'contact',
      style: 'width:min(620px,90vw)',
      onsubmit: (e: Event) => {
        e.preventDefault();
        void submit();
      },
    },
    h('h2', null, t('✉️ Kontakt & Feedback')),
    h('p', { class: 'help' }, t('Wie gefällt euch Krakel & Krone? Wir freuen uns über Lob, Ideen und Hinweise auf Fehler.')),
    field(t('Nachricht *'), message),
    h('div', { style: 'text-align:right;margin-top:-6px' }, left),
    h('div', { class: 'contact-row' }, field(t('Name (freiwillig)'), name), field(t('E-Mail (freiwillig)'), email)),
    h('div', { class: 'contact-hp', 'aria-hidden': 'true' }, h('label', null, 'Website ', website)),
    h(
      'p',
      { class: 'help' },
      t('Gespeichert werden nur deine Nachricht und – wenn du sie angibst – Name und E-Mail, damit wir antworten können. Wir löschen die Nachricht, wenn sie erledigt ist, spätestens nach 12 Monaten. Bitte keine Namen oder Daten von Kindern hineinschreiben.'),
      ' ',
      ...t('Mehr in der {link}.')
        .split(/(\{link\})/)
        .map((s) => (s === '{link}' ? h('a', { href: '/datenschutz', target: '_blank', rel: 'noopener' }, t('Datenschutzerklärung')) : s)),
    ),
    h('div', { class: 'actions' }, button(t('Abbrechen'), () => m.close(), 'btn'), sendBtn),
  );
  const m = modal(content);
  setTimeout(() => message.focus(), 50);
}

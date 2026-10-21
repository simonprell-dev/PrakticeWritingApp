import { h } from './dom.ts';

let box: HTMLElement | null = null;
const recent = new Map<string, number>();

export function toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', ms = 3200): void {
  const now = performance.now();
  if ((recent.get(text) ?? 0) > now - 1500) return;
  recent.set(text, now);
  if (!box) {
    box = h('div', { class: 'toasts', 'aria-live': 'polite' });
    document.body.append(box);
  }
  const t = h('div', { class: `toast ${kind}` }, text);
  box.append(t);
  while (box.children.length > 3) box.firstElementChild?.remove();
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}

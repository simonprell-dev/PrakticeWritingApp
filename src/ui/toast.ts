import { h } from './dom.ts';

let box: HTMLElement | null = null;
const recent = new Map<string, number>();

/** whether a hint shown last at `last` is the same one again (left out); a hint never shown is none */
export function isRepeat(last: number | undefined, now: number): boolean {
  return last !== undefined && last > now - 1500;
}

export function toast(text: string, kind: 'info' | 'good' | 'warn' = 'info', ms = 3200): void {
  const now = performance.now();
  if (isRepeat(recent.get(text), now)) return;
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

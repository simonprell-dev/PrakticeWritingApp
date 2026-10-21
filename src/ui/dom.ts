// Minimal hyperscript helper.
type Child = Node | string | number | null | undefined | false;
type Props = Record<string, unknown> & { class?: string; style?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (k in el && typeof v !== 'string') (el as unknown as Record<string, unknown>)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el: Element): void {
  while (el.firstChild) el.firstChild.remove();
}

/** Button that never keeps focus (so the space bar keeps triggering scans, not the last clicked button). */
export function button(label: Child | Child[], onClick: (e: MouseEvent) => void, cls = 'btn', title?: string): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button', title, 'aria-label': title });
  for (const c of Array.isArray(label) ? label : [label]) if (c !== null && c !== undefined && c !== false) b.append(c instanceof Node ? c : String(c));
  b.addEventListener('click', (e) => {
    b.blur();
    onClick(e);
  });
  return b;
}

export function segmented<T extends string>(options: { value: T; label: string }[], current: T, onChange: (v: T) => void, cls = ''): HTMLElement {
  const wrap = h('div', { class: `seg ${cls}`, role: 'radiogroup' });
  const render = (val: T) => {
    clear(wrap);
    for (const o of options) {
      wrap.append(
        button(
          o.label,
          () => {
            render(o.value);
            onChange(o.value);
          },
          `seg-btn${o.value === val ? ' on' : ''}`,
        ),
      );
    }
  };
  render(current);
  return wrap;
}

export function modal(content: HTMLElement, onClose?: () => void, cls = ''): { el: HTMLElement; close: () => void } {
  const back = h('div', { class: `modal-back ${cls}` });
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, content);
  back.append(box);
  const close = () => {
    back.classList.add('closing');
    setTimeout(() => back.remove(), 180);
    document.removeEventListener('keydown', onKey, true);
    onClose?.();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      e.preventDefault();
      close();
    }
  };
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(back);
  return { el: back, close };
}

export function isModalOpen(): boolean {
  return !!document.querySelector('.modal-back:not(.closing)');
}

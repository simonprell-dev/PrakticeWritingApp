// Admin page (/admin): login, page views per day and the contact inbox. Talks to /api/admin/* (server/api.js).
import './admin.css';
import { clear, h } from '../ui/dom.ts';

interface DayRow {
  day: string;
  visits: number;
}
interface Stats {
  days: number;
  from: string;
  to: string;
  /** page views in the range */
  visits: number;
  allTime: number;
  /** the first day with a page view, null before the first one */
  firstDay: string | null;
  unread: number;
  perDay: DayRow[];
}
interface Message {
  id: string;
  created_at: string;
  name: string | null;
  email: string | null;
  message: string;
  lang: string | null;
  status: 'new' | 'read' | 'done';
}
interface MessagePage {
  items: Message[];
  total: number;
  page: number;
  pageSize: number;
}

const root = document.getElementById('admin')!;
const fmt = new Intl.NumberFormat('de-DE');
const num = (n: number) => fmt.format(n);
let days = 30;
let msgPage = 1;
let msgStatus: '' | Message['status'] = '';

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new ApiError(r.status, j.error || `Fehler ${r.status}`);
  return j;
}

// ------------------------------------------------------------------ login

function showLogin(note = ''): void {
  clear(root);
  const pw = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Passwort', required: true }) as HTMLInputElement;
  const err = h('div', { class: 'error' }, note);
  const submit = h('button', { class: 'primary', type: 'submit' }, 'Anmelden');
  const form = h(
    'form',
    {
      class: 'login',
      onsubmit: async (e: Event) => {
        e.preventDefault();
        submit.disabled = true;
        err.textContent = '';
        try {
          await api('/api/admin/login', { password: pw.value });
          void showDashboard();
        } catch (x) {
          err.textContent = (x as Error).message;
          submit.disabled = false;
          pw.select();
        }
      },
    },
    h('h1', { style: 'margin:0;font-size:20px' }, '👑 Krakel & Krone · Admin'),
    pw,
    submit,
    err,
  );
  root.append(form);
  pw.focus();
}

// ------------------------------------------------------------------ dashboard

function card(label: string, value: string, sub?: string): HTMLElement {
  return h('div', { class: 'card' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), sub ? h('div', { class: 'muted' }, sub) : null);
}

function table(head: string[], rows: (string | number)[][], numeric: boolean[]): HTMLElement {
  if (!rows.length) return h('p', { class: 'muted' }, 'Noch keine Daten.');
  return h(
    'table',
    null,
    h('thead', null, h('tr', null, ...head.map((t, i) => h('th', { class: numeric[i] ? 'num' : '' }, t)))),
    h('tbody', null, ...rows.map((r) => h('tr', null, ...r.map((c, i) => h('td', { class: numeric[i] ? 'num' : '' }, typeof c === 'number' ? num(c) : c))))),
  );
}

const SVG = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, ...kids: (Node | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}

/** every day of the range, also the ones without page views */
function fillDays(s: Stats): DayRow[] {
  const by = new Map(s.perDay.map((d) => [d.day, d]));
  const out: DayRow[] = [];
  const d = new Date(s.from + 'T12:00:00Z');
  const end = new Date(s.to + 'T12:00:00Z');
  while (d <= end) {
    const key = d.toISOString().slice(0, 10);
    out.push(by.get(key) ?? { day: key, visits: 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

const dayLabel = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`;

/** one bar per day; hovering a day shows its number */
function barChart(rows: DayRow[], unit: string): HTMLElement {
  const W = 720;
  const H = 180;
  const pad = { l: 36, r: 6, t: 8, b: 22 };
  const max = Math.max(1, ...rows.map((r) => r.visits));
  // round the top of the scale to a friendly number
  const step = 10 ** Math.floor(Math.log10(max));
  const top = Math.ceil(max / step) * step;
  const bw = (W - pad.l - pad.r) / rows.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / top);
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${unit} pro Tag` });
  for (const v of [0, top / 2, top]) {
    g.append(svg('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v) }));
    g.append(svg('text', { x: pad.l - 4, y: y(v) + 4, 'text-anchor': 'end' }, num(v)));
  }
  const labelEvery = Math.ceil(rows.length / 10);
  rows.forEach((r, i) => {
    const x = pad.l + i * bw;
    const v = r.visits;
    const bh = Math.max(v ? 1 : 0, y(0) - y(v));
    const tip = svg('title', {}, `${dayLabel(r.day)}: ${num(v)} ${unit}`);
    // the whole column is the hover target, wider than the bar
    g.append(svg('rect', { class: 'hit', x, y: pad.t, width: bw, height: H - pad.t - pad.b, fill: 'transparent' }, tip));
    g.append(svg('rect', { class: 'bar visits', x: x + bw * 0.15, y: y(0) - bh, width: Math.max(1, bw * 0.7), height: bh, rx: Math.min(3, bw * 0.2), 'pointer-events': 'none' }));
    if (i % labelEvery === 0) g.append(svg('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle' }, dayLabel(r.day)));
  });
  return h('div', { class: 'chart' }, g);
}

async function renderStats(box: HTMLElement): Promise<number> {
  const s = await api<Stats>(`/api/admin/stats?days=${days}`);
  clear(box);
  const rows = fillDays(s);
  const avg = Math.round(s.visits / rows.length);
  box.append(
    h(
      'div',
      { class: 'cards' },
      card('Aufrufe heute', num(rows[rows.length - 1]?.visits ?? 0)),
      card(`Aufrufe in ${s.days} Tagen`, num(s.visits), `Ø ${num(avg)} pro Tag`),
      card('Aufrufe insgesamt', num(s.allTime), s.firstDay ? `seit ${dayLabel(s.firstDay)}${s.firstDay.slice(0, 4)}` : undefined),
      card('Neue Nachrichten', num(s.unread)),
    ),
    h('div', { class: 'panel' }, h('h2', null, 'Aufrufe pro Tag'), barChart(rows, 'Aufrufe')),
    h(
      'details',
      { class: 'panel' },
      h('summary', null, 'Alle Tage als Tabelle'),
      table(['Tag', 'Aufrufe'], [...rows].reverse().map((r) => [dayLabel(r.day) + r.day.slice(0, 4), r.visits]), [false, true]),
    ),
  );
  return s.unread;
}

const STATUS_LABEL = { '': 'Alle', new: 'Neu', read: 'Gelesen', done: 'Erledigt' } as const;

async function renderMessages(box: HTMLElement): Promise<void> {
  const q = new URLSearchParams({ page: String(msgPage) });
  if (msgStatus) q.set('status', msgStatus);
  const p = await api<MessagePage>(`/api/admin/messages?${q}`);
  clear(box);
  const reload = () => void renderMessages(box).catch(fail);
  const change = async (m: Message, body: unknown) => {
    await api(`/api/admin/messages/${m.id}`, body).catch(fail);
    reload();
  };
  box.append(
    h('h2', null, `Nachrichten (${num(p.total)})`),
    h(
      'div',
      { class: 'filter' },
      ...(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((k) =>
        h(
          'button',
          {
            type: 'button',
            class: msgStatus === k ? 'on' : '',
            onclick: () => {
              msgStatus = k;
              msgPage = 1;
              reload();
            },
          },
          STATUS_LABEL[k],
        ),
      ),
    ),
  );
  if (!p.items.length) box.append(h('p', { class: 'muted' }, 'Keine Nachrichten.'));
  for (const m of p.items) {
    const when = new Date(m.created_at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
    const btn = (label: string, body: unknown, on = false) => h('button', { type: 'button', class: on ? 'primary' : '', onclick: () => void change(m, body) }, label);
    box.append(
      h(
        'div',
        { class: `msg ${m.status}` },
        h(
          'div',
          { class: 'meta' },
          h('b', null, m.name || 'Ohne Namen'),
          m.email ? h('a', { href: `mailto:${m.email}?subject=${encodeURIComponent('Krakel & Krone')}` }, m.email) : null,
          h('span', null, when),
          m.lang ? h('span', null, m.lang) : null,
        ),
        h('div', { class: 'text' }, m.message),
        h(
          'div',
          { class: 'tools' },
          m.status === 'new' ? btn('Als gelesen markieren', { status: 'read' }) : btn('Als ungelesen markieren', { status: 'new' }),
          m.status === 'done' ? btn('Wieder offen', { status: 'read' }) : btn('✓ Erledigt', { status: 'done' }, true),
          h(
            'button',
            {
              type: 'button',
              onclick: () => {
                if (confirm('Diese Nachricht endgültig löschen?')) void change(m, { delete: true });
              },
            },
            '🗑 Löschen',
          ),
        ),
      ),
    );
  }
  const pages = Math.max(1, Math.ceil(p.total / p.pageSize));
  if (pages > 1) {
    const go = (delta: number) => () => {
      msgPage = Math.min(pages, Math.max(1, msgPage + delta));
      reload();
    };
    const prev = h('button', { type: 'button', onclick: go(-1) }, '‹ Neuere');
    const next = h('button', { type: 'button', onclick: go(1) }, 'Ältere ›');
    prev.disabled = msgPage <= 1;
    next.disabled = msgPage >= pages;
    box.append(h('div', { class: 'pager' }, prev, h('span', { class: 'muted' }, `Seite ${msgPage} von ${pages}`), next));
  }
}

function fail(e: unknown): void {
  if (e instanceof ApiError && e.status === 401) return showLogin('Bitte neu anmelden.');
  const box = document.getElementById('admin-error');
  if (box) box.textContent = (e as Error).message;
}

async function showDashboard(): Promise<void> {
  clear(root);
  const range = h('select', null, ...[7, 30, 90, 365].map((d) => h('option', { value: String(d), selected: d === days }, `${d} Tage`))) as HTMLSelectElement;
  const stats = h('div', null, h('p', { class: 'muted' }, 'Lade …'));
  const inbox = h('div', { class: 'panel' });
  const refresh = () => {
    document.getElementById('admin-error')!.textContent = '';
    void renderStats(stats).catch(fail);
    void renderMessages(inbox).catch(fail);
  };
  range.addEventListener('change', () => {
    days = Number(range.value);
    void renderStats(stats).catch(fail);
  });
  root.append(
    h(
      'header',
      null,
      h('h1', null, '👑 Krakel & Krone · Admin'),
      range,
      h('button', { type: 'button', onclick: refresh }, '↻ Aktualisieren'),
      h(
        'button',
        {
          type: 'button',
          onclick: async () => {
            await api('/api/admin/logout', {}).catch(() => undefined);
            showLogin('Abgemeldet.');
          },
        },
        'Abmelden',
      ),
    ),
    h('main', null, h('div', { id: 'admin-error', class: 'error' }), stats, inbox),
  );
  refresh();
}

async function start(): Promise<void> {
  try {
    await api('/api/admin/me');
    await showDashboard();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return showLogin();
    clear(root);
    root.append(
      h(
        'div',
        { class: 'login' },
        h('h1', { style: 'margin:0;font-size:20px' }, '👑 Krakel & Krone · Admin'),
        h('p', null, e instanceof ApiError && e.status === 503 ? (e as Error).message : 'Der Server ist nicht erreichbar.'),
        h('p', { class: 'muted' }, 'Der Admin-Bereich braucht die Server-Variablen DATABASE_URL und ADMIN_PASSWORD (siehe README).'),
      ),
    );
  }
}

void start();

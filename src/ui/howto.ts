// "So spielt ihr" on the start screen: three little animations show how the game is played with a document
// camera and a projector, with a phone or tablet in the hand, and (coming soon) with a tablet and a mirror.
import type { CameraMode } from '../app/settings.ts';
import { button, h } from './dom.ts';

const INK = '#3b2a5c';

const pencil = (x: number, y: number, s: number) => `<g transform="translate(${x} ${y}) rotate(-30) scale(${s})">
<path d="M0 0 9 -16 -9 -16z" fill="#f2c79a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M0 0 3.5 -6 -3.5 -6z" fill="#2b4fd0"/>
<rect x="-9" y="-78" width="18" height="62" fill="#ffcf3d" stroke="${INK}" stroke-width="3"/>
<rect x="-9" y="-90" width="18" height="12" rx="3" fill="#ff8fb1" stroke="${INK}" stroke-width="3"/></g>`;

/** a little round creature with a crown (centre x, y, radius r) */
const creature = (x: number, y: number, r: number, body = '#ffcf3d') => `
<ellipse cx="${x}" cy="${y + r + 3}" rx="${r * 0.9}" ry="${r * 0.18}" fill="rgba(0,0,0,0.15)"/>
<circle cx="${x}" cy="${y}" r="${r}" fill="${body}" stroke="${INK}" stroke-width="3"/>
<circle cx="${x - r * 0.35}" cy="${y - r * 0.2}" r="${r * 0.2}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
<circle cx="${x + r * 0.35}" cy="${y - r * 0.2}" r="${r * 0.2}" fill="#fff" stroke="${INK}" stroke-width="1.5"/>
<circle cx="${x - r * 0.3}" cy="${y - r * 0.17}" r="${r * 0.1}" fill="#2a1d33"/>
<circle cx="${x + r * 0.4}" cy="${y - r * 0.17}" r="${r * 0.1}" fill="#2a1d33"/>
<path d="M${x - r * 0.3} ${y + r * 0.3} q${r * 0.3} ${r * 0.3} ${r * 0.6} 0" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M${x - r * 0.55} ${y - r * 0.8} l${r * 0.1} -${r * 0.6} ${r * 0.3} ${r * 0.3} ${r * 0.15} -${r * 0.5} ${r * 0.15} ${r * 0.5} ${r * 0.3} -${r * 0.3} ${r * 0.1} ${r * 0.6}z" fill="#ffd34d" stroke="#a86b00" stroke-width="2" stroke-linejoin="round"/>`;

const water = (id: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe3f3"/><stop offset="1" stop-color="#2b86c4"/></linearGradient>`;

/** document camera on the table, the projector screen shows what hatches */
const DOC_CAM = `<svg viewBox="0 0 320 200" class="ht ht1" aria-hidden="true">
<defs>${water('ht-water1')}</defs>
<rect width="320" height="200" rx="18" fill="#eaf4ff"/>
<rect y="160" width="320" height="40" fill="#efd3a6"/>
<line x1="0" y1="160" x2="320" y2="160" stroke="#c99e62" stroke-width="3"/>
<line x1="247" y1="98" x2="247" y2="160" stroke="#6b5a8f" stroke-width="4"/>
<line x1="225" y1="160" x2="269" y2="160" stroke="#6b5a8f" stroke-width="6" stroke-linecap="round"/>
<rect x="186" y="14" width="122" height="84" rx="6" fill="#dff3ff" stroke="${INK}" stroke-width="3"/>
<rect x="191" y="19" width="112" height="74" rx="4" fill="url(#ht-water1)"/>
<g class="ht1-creature">${creature(247, 62, 16)}</g>
<path class="ht1-signal" d="M128 58 C 150 34, 168 34, 184 46" fill="none" stroke="#8f7bff" stroke-width="4" stroke-dasharray="6 8" stroke-linecap="round"/>
<polygon points="70,136 152,136 163,158 59,158" fill="#fffdf7" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<path class="ht1-write" pathLength="1" d="M107 144 c-1 -4 -10 -4 -11 2 c0 6 9 7 11 1 M107 141 v11 M117 138 v14 c0 -6 9 -7 9 -1 c0 5 -9 6 -9 1" fill="none" stroke="#2b4fd0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<g class="ht1-pencil">${pencil(120, 150, 0.42)}</g>
<rect x="32" y="150" width="60" height="10" rx="4" fill="#6b5a8f" stroke="${INK}" stroke-width="3"/>
<path d="M48 150 V60 H102" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<polygon class="ht1-light" points="102,74 126,74 160,154 70,154" fill="#fff3a8"/>
<rect x="96" y="54" width="32" height="20" rx="6" fill="#8f7bff" stroke="${INK}" stroke-width="3"/>
<circle class="ht1-flash" cx="112" cy="76" r="6" fill="#fff"/>
</svg>`;

/** a hand holds the phone over the sheet, takes the photo, and the creature appears on the phone */
const HANDHELD = `<svg viewBox="0 0 320 200" class="ht ht2" aria-hidden="true">
<defs>${water('ht-water2')}<clipPath id="ht-screen2"><rect x="77" y="26" width="90" height="148" rx="9"/></clipPath></defs>
<rect width="320" height="200" rx="18" fill="#f0d6ad"/>
<path d="M0 44 C 80 36 170 52 320 40 M0 122 C 90 112 200 132 320 118 M0 176 C 100 168 220 182 320 172" stroke="#e2bf8a" stroke-width="3" fill="none"/>
<g transform="rotate(-5 120 100)">
<rect x="62" y="22" width="116" height="156" rx="5" fill="#fffdf7" stroke="${INK}" stroke-width="2.5"/>
<g stroke="#9fb6ea" stroke-width="1.5"><line x1="70" y1="62" x2="170" y2="62"/><line x1="70" y1="104" x2="170" y2="104"/><line x1="70" y1="146" x2="170" y2="146"/></g>
<path d="M78 102 l10 -34 l10 34 m-16 -12 h12 M108 68 v34 c0 -14 18 -14 18 -5 c0 13 -18 13 -18 5 M140 92 c-4 -6 -14 -4 -14 4 c0 8 10 9 14 3" fill="none" stroke="#2b4fd0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<g class="ht2-phone">
<ellipse cx="176" cy="160" rx="24" ry="15" fill="#f2c79a" stroke="${INK}" stroke-width="2.5"/>
<rect x="70" y="14" width="104" height="172" rx="16" fill="#2b2340" stroke="${INK}" stroke-width="3"/>
<g clip-path="url(#ht-screen2)">
<g class="ht2-vf">
<rect x="77" y="26" width="90" height="148" fill="#fffdf7"/>
<path d="M86 98 l9 -30 l9 30 m-14 -10 h11 M110 68 v30 c0 -12 15 -12 15 -4 c0 11 -15 11 -15 4 M144 90 c-3 -5 -12 -4 -12 3 c0 7 8 8 12 3" fill="none" stroke="#2b4fd0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="none" stroke="#ffcf3d" stroke-width="4" stroke-linecap="round"><path d="M84 46 v-10 h10 M160 46 v-10 h-10 M84 154 v10 h10 M160 154 v10 h-10"/></g>
<circle cx="122" cy="160" r="8" fill="#ffcf3d" stroke="#fff" stroke-width="3"/>
</g>
<g class="ht2-game">
<rect x="77" y="26" width="90" height="148" fill="url(#ht-water2)"/>
<rect x="77" y="160" width="90" height="14" fill="#f2d9a2"/>
<g class="ht2-creature">${creature(122, 104, 18, '#ff8a5c')}</g>
<circle cx="96" cy="70" r="4" fill="none" stroke="#fff" stroke-width="2"/><circle cx="150" cy="52" r="3" fill="none" stroke="#fff" stroke-width="2"/>
</g>
<rect class="ht2-flash" x="77" y="26" width="90" height="148" fill="#fff"/>
</g>
<rect x="104" y="18" width="36" height="4" rx="2" fill="#5a4d78"/>
</g>
</svg>`;

/** coming soon: the tablet stands, a mirror on its front camera looks down at the paper in front */
const MIRROR = `<svg viewBox="0 0 320 200" class="ht ht3" aria-hidden="true">
<defs>${water('ht-water3')}</defs>
<rect width="320" height="200" rx="18" fill="#efeaff"/>
<rect y="132" width="320" height="68" fill="#efd3a6"/>
<line x1="0" y1="132" x2="320" y2="132" stroke="#c99e62" stroke-width="3"/>
<polygon points="150,124 262,130 272,144 156,140" fill="#6b5a8f" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<polygon points="150,26 262,32 258,130 146,124" fill="#2b2340" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<polygon points="157,38 254,43 251,121 154,116" fill="url(#ht-water3)"/>
<g class="ht3-creature">${creature(203, 82, 15, '#7ccf6b')}</g>
<polygon class="ht3-cone" points="196,24 212,25 156,180 36,176" fill="#fff3a8"/>
<path d="M196 24 L36 176 M212 25 L156 180" stroke="#e0b400" stroke-width="2" stroke-dasharray="5 6" fill="none" class="ht3-rays"/>
<polygon points="34,150 150,146 164,190 22,194" fill="#fffdf7" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<path class="ht3-write" pathLength="1" d="M52 178 l8 -20 l8 20 m-13 -7 h10 M78 158 v20 c0 -9 13 -9 13 -3 c0 8 -13 8 -13 3 M106 172 c-4 -5 -12 -3 -12 3 c0 7 9 7 12 2" fill="none" stroke="#2b4fd0" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
<g class="ht3-pencil">${pencil(108, 174, 0.42)}</g>
<polygon points="188,30 220,31 226,12 184,11" fill="#cfe9ff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<line x1="190" y1="16" x2="218" y2="17" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
<circle cx="204" cy="33" r="2.5" fill="#9fd8ff"/>
</svg>`;

export interface HowtoDeps {
  mode: CameraMode;
  /** switch to this way of playing and open the camera setup */
  choose: (mode: CameraMode) => void;
}

export function howtoSection(d: HowtoDeps): HTMLElement {
  const card = (opt: { svg: string; title: string; who: string; steps: string[]; mode?: CameraMode; soon?: boolean }) => {
    const art = h('div', { class: 'howto-art' });
    art.innerHTML = opt.svg;
    const active = !!opt.mode && opt.mode === d.mode;
    return h(
      'article',
      { class: `howto-card${active ? ' active' : ''}${opt.soon ? ' soon' : ''}` },
      opt.soon ? h('span', { class: 'soon-badge' }, 'Kommt bald') : active ? h('span', { class: 'soon-badge on' }, '✓ So spielt ihr gerade') : null,
      art,
      h('h3', null, opt.title),
      h('p', { class: 'howto-who' }, opt.who),
      h('ol', null, ...opt.steps.map((s) => h('li', null, s))),
      opt.mode
        ? button(active ? '📷 Kamera einrichten' : 'So spielen', () => d.choose(opt.mode!), `btn small${active ? '' : ' primary'}`)
        : button('Kommt bald', () => undefined, 'btn small'),
    );
  };
  const soon = card({
    svg: MIRROR,
    title: '🪞 Tablet mit Spiegel',
    who: 'Ganz ohne Halten – wie beim Osmo',
    steps: [
      'Das Tablet steht im Ständer, ein kleiner Spiegel sitzt auf der Frontkamera.',
      'Davor schreiben oder malen: Das Tablet schaut über den Spiegel zu.',
      'Die Wesen erscheinen von selbst auf dem Tablet.',
    ],
    soon: true,
  });
  (soon.querySelector('button') as HTMLButtonElement).disabled = true;
  return h(
    'section',
    { class: 'howto', 'aria-label': 'So spielt ihr' },
    h('h2', null, 'So spielt ihr'),
    h(
      'div',
      { class: 'howto-cards' },
      card({
        svg: DOC_CAM,
        title: '📽️ Dokumentenkamera & Beamer',
        who: 'Für die ganze Klasse',
        steps: [
          'Die Kamera schaut von oben aufs Blatt, der Beamer zeigt das Spiel.',
          'Schreiben oder malen – dann „Fertig!“ oder die Leertaste.',
          'Aus jedem Buchstaben schlüpft ein Wesen an der Tafel.',
        ],
        mode: 'fest',
      }),
      card({
        svg: HANDHELD,
        title: '📱 Handy oder Tablet',
        who: 'Für zu Hause und kleine Gruppen',
        steps: [
          'Schreiben oder malen, das Blatt flach hinlegen.',
          '„Fertig!“ tippen, das Gerät übers Blatt halten und auf den runden Knopf tippen.',
          'Das Wesen erscheint direkt auf dem Gerät.',
        ],
        mode: 'hand',
      }),
      soon,
    ),
  );
}

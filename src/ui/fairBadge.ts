// Trade fair mode: a small sign with a QR code and the web address, so visitors find the game again at home.
import qrcode from 'qrcode-generator';
import { h } from './dom.ts';

/** the QR code of a text as an SVG (one path, no quiet zone: the sign is white around it) */
export function qrSvg(text: string): SVGSVGElement {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${n} ${n}`);
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `QR-Code: ${text}`);
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'currentColor');
  svg.append(path);
  return svg;
}

/** the sign for this page's own address (wherever the game runs) */
export function fairBadge(): HTMLElement {
  const url = `${location.origin}/`;
  return h(
    'div',
    { class: 'fair-badge' },
    h('div', { class: 'fair-title' }, 'Spiel mit – auch zu Hause!'),
    qrSvg(url),
    h('div', { class: 'fair-url' }, location.host),
  );
}

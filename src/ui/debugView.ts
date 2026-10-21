// ?debug: shows the ink map, the glyph mask and a score table of the last scan.
import { TIER_LABEL } from '../recog/score.ts';
import type { ScanResult } from '../vision/types.ts';
import { button, h } from './dom.ts';

let panel: HTMLElement | null = null;

export function showDebug(res: ScanResult): void {
  panel?.remove();
  if (!res.debug) return;
  const { ink, mask } = res.debug;
  const cv = h('canvas', { width: ink.width, height: ink.height });
  const ctx = cv.getContext('2d')!;
  const id = ctx.createImageData(ink.width, ink.height);
  for (let i = 0; i < ink.data.length; i++) {
    const v = Math.min(255, ink.data[i] * 400);
    const m = mask.data[i];
    id.data[i * 4] = m ? 255 : 255 - v;
    id.data[i * 4 + 1] = m ? 80 : 255 - v;
    id.data[i * 4 + 2] = m ? 80 : 255 - v * 0.5;
    id.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
  ctx.strokeStyle = '#00a';
  ctx.lineWidth = 2;
  ctx.font = '16px monospace';
  for (const g of res.glyphs) {
    ctx.strokeRect(g.box.x, g.box.y, g.box.w, g.box.h);
    ctx.fillStyle = '#00a';
    ctx.fillText(`${g.score.char}${g.score.score}`, g.box.x, g.box.y - 3);
  }
  for (const l of res.debug.lines) {
    ctx.strokeStyle = 'rgba(0,160,0,0.6)';
    ctx.beginPath();
    if (l.orientation === 'h') {
      ctx.moveTo(0, l.pos);
      ctx.lineTo(ink.width, l.pos);
    } else {
      ctx.moveTo(l.pos, 0);
      ctx.lineTo(l.pos, ink.height);
    }
    ctx.stroke();
  }
  const table = h('table');
  table.append(h('tr', null, ...['#', 'Zeichen', 'Top-3', 'L', 'T', 'S', 'P', 'Score', 'Stufe', 'Team', 'neu'].map((t) => h('td', null, h('b', null, t)))));
  res.glyphs.forEach((g, i) => {
    const cnn = res.debug!.cnnInputs[i];
    const c28 = h('canvas', { width: 28, height: 28, style: 'width:42px;height:42px' });
    if (cnn) {
      const cx = c28.getContext('2d')!;
      const im = cx.createImageData(28, 28);
      for (let k = 0; k < 784; k++) {
        const v = 255 - cnn[k] * 255;
        im.data[k * 4] = im.data[k * 4 + 1] = im.data[k * 4 + 2] = v;
        im.data[k * 4 + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
    }
    const p = g.score.parts;
    table.append(
      h(
        'tr',
        null,
        h('td', null, c28),
        h('td', null, g.score.char + (g.dots ? ` (${g.dots}·)` : '')),
        h('td', null, g.score.top3?.map((t) => `${t.char}${(t.p * 100).toFixed(0)}`).join(' ') ?? '–'),
        ...[p.L, p.T, p.S, p.P].map((v) => h('td', null, v.toFixed(2))),
        h('td', null, String(g.score.score)),
        h('td', null, TIER_LABEL[g.score.tier]),
        h('td', null, g.team ?? '–'),
        h('td', null, g.isNew ? '✓' : ''),
      ),
    );
  });
  panel = h(
    'div',
    { class: 'debug-panel' },
    h('div', null, button('×', () => panel?.remove(), 'btn small'), ` Zeiten: ${JSON.stringify(res.timings)}`),
    cv,
    table,
  );
  document.body.append(panel);
}

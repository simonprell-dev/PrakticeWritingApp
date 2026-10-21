import { TIER_LABEL, TIP_TEXT } from '../recog/score.ts';
import type { CreatureInfo } from '../scenes/scene.ts';
import { starCount } from '../scenes/habitat.ts';
import { button, h, modal } from './dom.ts';

export function starsEl(score: number, cls = 'stars'): HTMLElement {
  const n = starCount(score);
  return h('span', { class: cls }, '★'.repeat(n), h('span', { class: 'off' }, '★'.repeat(5 - n)));
}

/** Shows the child's letter big, with stars and a friendly tip. */
export function openGlyphCard(info: CreatureInfo, debug: boolean): void {
  const g = info.glyph;
  const cv = h('canvas', { width: 220, height: 220 });
  const ctx = cv.getContext('2d')!;
  const st = info.sticker;
  const s = 180 / Math.max(st.width, st.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(st as CanvasImageSource, 110 - (st.width * s) / 2, 110 - (st.height * s) / 2, st.width * s, st.height * s);
  const tip = g.score.tip === 'anderes' && g.score.looksLike ? `Das sieht aus wie ein ${g.score.looksLike}.` : TIP_TEXT[g.score.tip];
  const content = h(
    'div',
    null,
    h(
      'div',
      { class: 'card-glyph' },
      cv,
      h(
        'div',
        null,
        h('div', { class: 'tier' }, TIER_LABEL[g.score.tier]),
        starsEl(g.score.score, 'stars big-stars'),
        h('p', { style: 'font-size:1.3rem;margin:.4em 0' }, tip),
        h('p', { class: 'help' }, `Ich glaube, das ist ${/[0-9]/.test(g.score.char) ? 'die' : 'ein'} „${g.score.char}“.`),
        debug
          ? h(
              'p',
              { class: 'help' },
              `Score ${g.score.score} · L ${g.score.parts.L.toFixed(2)} · T ${g.score.parts.T.toFixed(2)} · S ${g.score.parts.S.toFixed(2)} · P ${g.score.parts.P.toFixed(2)}`,
              g.score.top3 ? ` · ${g.score.top3.map((t) => `${t.char} ${(t.p * 100).toFixed(0)}%`).join(', ')}` : '',
            )
          : null,
      ),
    ),
    h('div', { class: 'actions' }, button('Schließen', () => m.close(), 'btn primary')),
  );
  const m = modal(content);
}

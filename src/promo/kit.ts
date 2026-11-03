// Small helpers for the presentation film: easing, creatures from the real generator, confetti.
import { makeGenome, type Archetype, type Genome } from '../game/creatures/genome.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { letterSticker } from '../ui/previews.ts';
import { tierOf } from '../recog/score.ts';

export const W = 1600;
export const H = 900;
export const INK = '#3b2a5c';
export const FONT = "'Fredoka', 'Segoe UI', system-ui, sans-serif";

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
/** 0 before a, 1 after b, smooth in between */
export const span = (t: number, a: number, b: number) => {
  const k = clamp((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};
export const outBack = (k: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};

/** deterministic pseudo random number for index i */
export const rnd = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function genome(score: number, seed: number, a: Archetype, hue?: number, variant?: number): Genome {
  let g = makeGenome(score, tierOf(score), seed, a, hue);
  let s = seed;
  while (variant !== undefined && g.variant !== variant) g = makeGenome(score, tierOf(score), ++s, a, hue);
  return g;
}

/** stars 1–5 like in the duel and the towers */
export const starsOf = (score: number) => (score >= 90 ? 5 : score >= 75 ? 4 : score >= 55 ? 3 : score >= 35 ? 2 : 1);

const cache = new Map<string, Sprite>();
/** one creature, made once */
export function creature(key: string, make: (sticker: ReturnType<typeof letterSticker>) => Sprite, ch: string, color?: string): Sprite {
  let sp = cache.get(key);
  if (!sp) {
    sp = make(letterSticker(ch, color));
    cache.set(key, sp);
  }
  return sp;
}

/** draws a sprite with its body centre at (x, y), `r` = wanted body radius, wag = tail angle */
export function drawSprite(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, r: number, flip = 1, wag = 0, rot = 0, squash = 0): void {
  const s = r / sp.radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s * flip * (1 - squash), s * (1 + squash));
  if (sp.tail) {
    ctx.save();
    ctx.translate(sp.tail.px - sp.ax, sp.tail.py - sp.ay);
    ctx.rotate(wag);
    ctx.drawImage(sp.tail.canvas as CanvasImageSource, -sp.tail.pivotX, -sp.tail.pivotY);
    ctx.restore();
  }
  ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
  drawBadgeSticker(ctx, sp, flip);
  ctx.restore();
}

/** a row of little stars */
export function drawStars(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, size = 26, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = '#7a4b00';
  ctx.fillStyle = '#ffd34d';
  const text = '★'.repeat(n);
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
  ctx.restore();
}

const CONFETTI = ['#ff6fb1', '#ffd34d', '#5bc8ff', '#7ccf6b', '#a98bff', '#ff8a5c'];
/** confetti falling from the top, `k` seconds since it started */
export function drawConfetti(ctx: CanvasRenderingContext2D, k: number, n = 90, w = W, h = H): void {
  if (k < 0) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const delay = rnd(i) * 0.8;
    const age = k - delay;
    if (age < 0) continue;
    const x = rnd(i + 7) * w + Math.sin(age * 2 + i) * 30;
    const y = -20 + age * (180 + rnd(i + 3) * 160);
    if (y > h + 20) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(age * (2 + rnd(i + 5) * 4));
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.fillRect(-7, -4, 14, 8);
    ctx.restore();
  }
  ctx.restore();
}

/** rounded rectangle with fill and optional outline */
export function pill(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string, lw = 4): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color = INK, align: CanvasTextAlign = 'center', weight = 600, font = FONT): void {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

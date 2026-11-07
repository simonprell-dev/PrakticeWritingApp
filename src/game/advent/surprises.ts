// What is behind each of the 24 doors: a figure from the Christmas and winter worlds, a little funny scene
// (a "gag", reused over the month with different figures) and a joke of the day.
import { sfx } from '../audio.ts';
import { makeCanvas, type AnyCanvas, type Ctx } from '../canvas.ts';
import { makeGenome, type Genome } from '../creatures/genome.ts';
import { sparkleStar } from '../creatures/parts.ts';
import { weihnachtenSprite } from '../creatures/seasons/weihnachten.ts';
import { winterSprite } from '../creatures/seasons/winter.ts';
import { drawBadgeSticker, type Sprite } from '../creatures/sprite.ts';
import { clamp, ease, lerp, TAU } from '../math.ts';
import type { Particles } from '../particles.ts';
import { tierOf } from '../../recog/score.ts';
import { t, tk } from '../../i18n/i18n.ts';

export type Who = 'wichtel' | 'rentier' | 'geschenk' | 'lebkuchen' | 'schneemann' | 'pinguin' | 'eisbaer' | 'hase';
export type GagId = 'sneeze' | 'giftrun' | 'juggle' | 'hiccup' | 'slide' | 'nikolaus' | 'nose' | 'button' | 'dough' | 'snore' | 'fly' | 'snowball' | 'spin' | 'boing' | 'finale';

export interface Surprise {
  /** the little scene */
  gag: GagId;
  /** the figure of the day */
  who: Who;
  /** the joke of the day (tk-marked) */
  joke: string;
}

export const SURPRISES: Surprise[] = [
  { gag: 'sneeze', who: 'rentier', joke: tk('Warum niest das Rentier? Weil ihm der Weihnachtsmann Puderzucker auf die Nase gestreut hat!') },
  { gag: 'giftrun', who: 'geschenk', joke: tk('Was macht ein Geschenk, wenn ihm kalt ist? Es zieht sich dickes Geschenkpapier an!') },
  { gag: 'juggle', who: 'wichtel', joke: tk('Was sagt der große Stift zum kleinen Stift? Wachsmalstift!') },
  { gag: 'hiccup', who: 'hase', joke: tk('Was ist weiß und hüpft durch den Wald? Ein Schneehase mit Schluckauf!') },
  { gag: 'slide', who: 'pinguin', joke: tk('Was sagt ein Pinguin, wenn er auf dem Bauch rutscht? Wer braucht schon einen Schlitten?') },
  { gag: 'nikolaus', who: 'lebkuchen', joke: tk('Was ist rot-weiß und kommt die Treppe herunter? Der Nikolaus, der den Schornstein nicht gefunden hat!') },
  { gag: 'nose', who: 'schneemann', joke: tk('Wie nennt man einen Schneemann im Sommer? Pfütze!') },
  { gag: 'button', who: 'lebkuchen', joke: tk('Warum ging der Lebkuchenmann zum Arzt? Er fühlte sich so krümelig!') },
  { gag: 'dough', who: 'wichtel', joke: tk('Welche Kekse sind am lustigsten? Die Kicher-Plätzchen!') },
  { gag: 'snore', who: 'eisbaer', joke: tk('Warum sind Eisbären so gute Freunde? Weil sie immer cool bleiben!') },
  { gag: 'fly', who: 'rentier', joke: tk('Warum fliegen Rentiere? Weil Laufen im tiefen Schnee viel zu lange dauert!') },
  { gag: 'snowball', who: 'hase', joke: tk('Was ist grün und klopft an die Tür? Ein Klopfsalat!') },
  { gag: 'spin', who: 'pinguin', joke: tk('Welcher Baum hat keine Blätter? Der Weihnachtsbaum – der hat Nadeln!') },
  { gag: 'boing', who: 'geschenk', joke: tk('Was liegt am Strand und spricht ganz undeutlich? Eine Nuschel!') },
  { gag: 'hiccup', who: 'eisbaer', joke: tk('Wie nennt man einen Bumerang, der nicht zurückkommt? Einen Stock!') },
  { gag: 'sneeze', who: 'schneemann', joke: tk('Warum sind Sterne so schlau? Weil sie so viele helle Köpfchen haben!') },
  { gag: 'juggle', who: 'lebkuchen', joke: tk('Was hat vier Beine und kann trotzdem nicht laufen? Ein Tisch!') },
  { gag: 'dough', who: 'lebkuchen', joke: tk('Treffen sich zwei Kerzen. Fragt die eine: Ist Wasser gefährlich? Sagt die andere: Ja, davon kann man ausgehen!') },
  { gag: 'slide', who: 'eisbaer', joke: tk('Was macht ein Clown im Büro? Faxen!') },
  { gag: 'spin', who: 'rentier', joke: tk('Was essen Schneemänner zum Frühstück? Schneeflocken mit kalter Milch!') },
  { gag: 'snowball', who: 'schneemann', joke: tk('Was sagt die Glocke, wenn sie sich freut? Ich bin ganz klingel-glücklich!') },
  { gag: 'snore', who: 'wichtel', joke: tk('Was ist kalt, weiß und fährt Ski? Ein Schneemann im Urlaub!') },
  { gag: 'nose', who: 'schneemann', joke: tk('Was sagt ein Schneemann zum anderen? Komisch, hier riecht es nach Karotten!') },
  { gag: 'finale', who: 'rentier', joke: tk('Was macht der Weihnachtsmann im Garten? Ho-ho-hochbeete!') },
];

const XMAS: Who[] = ['wichtel', 'rentier', 'geschenk', 'lebkuchen'];
const WINTER: Who[] = ['schneemann', 'pinguin', 'eisbaer', 'hase'];

/** a 'season' genome whose variant draws this kind of figure */
export function genomeOf(who: Who, score: number, seed: number): Genome {
  const idx = XMAS.includes(who) ? XMAS.indexOf(who) : WINTER.indexOf(who);
  let g = makeGenome(score, tierOf(score), seed, 'season');
  for (let s = seed + 1, n = 0; g.variant % 4 !== idx && n < 400; s++, n++) g = makeGenome(score, tierOf(score), s, 'season');
  return g;
}

export function spriteOf(who: Who, g: Genome, sticker: AnyCanvas | null): Sprite {
  return XMAS.includes(who) ? weihnachtenSprite(g, sticker) : winterSprite(g, sticker);
}

/** draws a sprite with its letter; (x, y) is the body centre */
export function drawFig(
  ctx: Ctx,
  sp: Sprite,
  x: number,
  y: number,
  o: { s?: number; sx?: number; sy?: number; rot?: number; flip?: number; alpha?: number; canvas?: AnyCanvas } = {},
): void {
  const s = o.s ?? 1;
  const flip = o.flip ?? 1;
  ctx.save();
  if (o.alpha !== undefined) ctx.globalAlpha *= clamp(o.alpha);
  ctx.translate(x, y);
  ctx.rotate(o.rot ?? 0);
  ctx.scale(flip * s * (o.sx ?? 1), s * (o.sy ?? 1));
  if (sp.tail) ctx.drawImage(sp.tail.canvas as CanvasImageSource, sp.tail.px - sp.ax - sp.tail.pivotX, sp.tail.py - sp.ay - sp.tail.pivotY);
  ctx.drawImage((o.canvas ?? sp.canvas) as CanvasImageSource, -sp.ax, -sp.ay);
  drawBadgeSticker(ctx as CanvasRenderingContext2D, sp, flip);
  ctx.restore();
}

// ------------------------------------------------------------------------------------------- the stage

/** what a gag may use of the scene */
export interface Stage {
  particles: Particles;
  W: number;
  /** Flocke's face */
  flockeHead: { x: number; y: number };
  /** Flocke says something */
  say(text: string, good: boolean): void;
  /** Flocke gets a snowball in the face */
  splat(): void;
  /** a helper figure (the hare that steals the nose, the elf in the present) */
  extra(who: Who): Sprite;
}

/** a surprise being played */
export interface Act {
  day: number;
  s: Surprise;
  /** seconds since the gag started */
  t: number;
  /** where the figure stands (the gag may move it; the figure stays where it ends) */
  x: number;
  y: number;
  /** the stage position at the start */
  x0: number;
  S: number;
  dir: 1 | -1;
  sp: Sprite;
  genome: Genome;
  v: Record<string, number>;
  cache: Record<string, AnyCanvas>;
}

export interface Gag {
  len: number;
  /** events between t0 and t1 (particles, sounds, Flocke) */
  tick(a: Act, st: Stage, t0: number, t1: number): void;
  draw(ctx: Ctx, a: Act, st: Stage): void;
}

/** a big outlined text that floats up */
function pop(st: Stage, x: number, y: number, text: string, color = '#ffffff', size = 44): void {
  st.particles.add({ kind: 'text', x, y, vy: -45, max: 1.9, size, color, text });
}

const headY = (a: Act) => a.y - a.sp.radius * a.S * 1.05;
const feetY = (a: Act) => a.y + (a.sp.canvas.height - a.sp.ay) * a.S;
const nose = (a: Act) => ({ x: a.x + a.dir * a.sp.radius * a.S * 0.95, y: a.y - a.sp.radius * a.S * 0.45 });

function circleStars(ctx: Ctx, x: number, y: number, r: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const ang = t * 5 + (i / 3) * TAU;
    sparkleStar(ctx, x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.35, r * 0.32, '#ffe45a');
  }
}

/** a copy of a canvas tinted with flour */
function floured(src: AnyCanvas): AnyCanvas {
  const { canvas, ctx } = makeCanvas(src.width, src.height);
  ctx.drawImage(src as CanvasImageSource, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillRect(0, 0, src.width, src.height);
  return canvas;
}

/** the snowman's nose in sprite pixels (same numbers as the winter sprite) */
function snowNose(g: Genome): { bx: number; tip: number; y: number; hx: number; r2: number; hy: number } {
  const L = 200 * g.size;
  const r1 = L * 0.27;
  const r2 = L * 0.19;
  const W = Math.ceil(r1 * 2 + L * 0.62);
  const H = Math.ceil(r1 * 2 + r2 * 1.7 + L * 0.42);
  const cx = W / 2 - L * 0.04;
  const cy = H - r1 - L * 0.03;
  const hx = cx + r1 * 0.1;
  const hy = cy - r1 - r2 * 0.68;
  return { bx: hx + r2 * 0.72, tip: hx + r2 * (g.wobble > 0.4 ? 1.47 : 1.62), y: hy + r2 * 0.12, hx, r2, hy };
}

/** the snowman without his carrot */
function noseless(sp: Sprite, g: Genome): AnyCanvas {
  const n = snowNose(g);
  const { canvas, ctx } = makeCanvas(sp.canvas.width, sp.canvas.height);
  ctx.drawImage(sp.canvas as CanvasImageSource, 0, 0);
  let col = '#eef3fa';
  try {
    const d = ctx.getImageData(Math.round(n.hx), Math.round(n.hy + n.r2 * 0.45), 1, 1).data;
    if (d[3] > 200) col = `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch {
    /* keep the default */
  }
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(n.hx + n.r2 * 1.02, n.y - n.r2 * 0.25, n.tip - n.hx, n.r2 * 0.5);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse((n.bx + n.hx + n.r2) / 2 - 1, n.y, (n.hx + n.r2 - n.bx) / 2 + 2, n.r2 * 0.18, 0, 0, TAU);
  ctx.fill();
  // a small surprised "o" where the nose was
  ctx.fillStyle = '#d9a0a0';
  ctx.beginPath();
  ctx.arc(n.bx + n.r2 * 0.08, n.y, n.r2 * 0.06, 0, TAU);
  ctx.fill();
  return canvas;
}

function carrot(ctx: Ctx, x: number, y: number, len: number, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#f07a1a';
  ctx.strokeStyle = '#9a4210';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -len * 0.18);
  ctx.quadraticCurveTo(len * 0.7, -len * 0.05, len, 0);
  ctx.quadraticCurveTo(len * 0.7, len * 0.05, 0, len * 0.18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3e9a3a';
  ctx.beginPath();
  ctx.ellipse(-len * 0.12, -len * 0.08, len * 0.16, len * 0.06, -0.5, 0, TAU);
  ctx.ellipse(-len * 0.12, len * 0.08, len * 0.16, len * 0.06, 0.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** hops: 0..1 height of a hop with the given frequency */
const hop = (t: number, f: number) => Math.abs(Math.sin(t * f));

// ------------------------------------------------------------------------------------------- the gags

const CONFETTI = ['#ff6f91', '#ffd84a', '#7cdcff', '#8dff6b', '#c58bff'];

const sneeze: Gag = {
  len: 4.4,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    const h = headY(a);
    if (at(0.2)) pop(st, a.x, h - 30, t('Haa …'), '#ffffff', 38);
    if (at(1.0)) pop(st, a.x, h - 40, t('Haaaa …!'), '#ffffff', 44);
    if (at(1.8)) {
      sfx.sneeze();
      pop(st, a.x, h - 50, t('HATSCHI!'), '#ffd84a', 62);
      const n = nose(a);
      const snow = a.s.who === 'schneemann';
      for (let i = 0; i < 60; i++) {
        st.particles.add({
          kind: snow && i % 2 ? 'spark' : 'confetti',
          x: n.x,
          y: n.y,
          vx: a.dir * (250 + Math.random() * 550),
          vy: -350 + Math.random() * 380,
          gravity: 520,
          size: 12 + Math.random() * 8,
          max: 1.4 + Math.random() * 0.8,
          rot: Math.random() * TAU,
          vr: (Math.random() - 0.5) * 10,
          color: snow ? ['#ffffff', '#cfe8ff', '#a8d4ff'][i % 3] : CONFETTI[i % CONFETTI.length],
        });
      }
    }
    if (at(2.7)) st.say(t('Gesundheit!'), true);
  },
  draw(ctx, a) {
    const t = a.t;
    let sx = 1;
    let sy = 1;
    let rot = 0;
    let dx = 0;
    if (t < 1.8) {
      const p = ease.inOutCubic(clamp(t / 1.7));
      sy = 1 + 0.16 * p + Math.sin(t * 20) * 0.01 * p;
      sx = 1 - 0.07 * p;
      rot = -a.dir * 0.2 * p;
    } else {
      const r = Math.exp(-(t - 1.8) * 4);
      sy = 1 - 0.14 * r;
      sx = 1 + 0.1 * r;
      rot = a.dir * 0.3 * r;
      dx = -a.dir * 50 * a.S * r;
    }
    drawFig(ctx, a.sp, a.x + dx, a.y, { s: a.S, sx, sy, rot, flip: a.dir });
  },
};

/** the figure hops out of the picture to the right and comes back from the left */
const giftrun: Gag = {
  len: 5.2,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.35)) {
      sfx.whoosh();
      pop(st, a.x, headY(a) - 30, t('Huiii!'), '#ffd84a', 48);
    }
    if (at(1.9)) st.say(t('Nanu? Wo ist es hin?'), false);
    if (at(3.85)) {
      sfx.boing();
      pop(st, a.x, headY(a) - 40, t('Tadaa! Da bin ich wieder!'), '#ffffff', 44);
      st.particles.burst('heart', a.x, headY(a), 8, { color: '#ff6fa3', size: 24, speed: 160, max: 1.2, gravity: -60 });
    }
  },
  draw(ctx, a, st) {
    const t = a.t;
    const W = st.W;
    let x = a.x;
    let lift = 0;
    let sy = 1;
    if (t < 0.3) sy = 1 - 0.15 * Math.sin((t / 0.3) * Math.PI);
    else if (t < 1.6) {
      const p = (t - 0.3) / 1.3;
      x = lerp(a.x, W + 280, ease.inQuad(p));
      lift = hop(p * Math.PI * 4, 1) * 110 * a.S;
    } else if (t < 2.2) return;
    else if (t < 3.8) {
      const p = (t - 2.2) / 1.6;
      x = lerp(-280, a.x, ease.outCubic(p));
      lift = hop(p * Math.PI * 5, 1) * 100 * a.S;
    } else sy = 1 - 0.18 * Math.exp(-(t - 3.8) * 5) * Math.cos((t - 3.8) * 18);
    drawFig(ctx, a.sp, x, a.y - lift, { s: a.S, sy, flip: 1, rot: lift > 0 ? Math.sin(t * 14) * 0.08 : 0 });
  },
};

const BALLS = ['#e5383b', '#ffcf3a', '#4ea8ff'];
function ballAt(a: Act, i: number, t: number): { x: number; y: number } {
  const ang = t * 5.5 + (i / 3) * TAU;
  return { x: a.x + Math.cos(ang) * 75 * a.S, y: headY(a) - 95 * a.S + Math.sin(ang) * 55 * a.S };
}

/** juggling three baubles; one falls on the juggler's head */
const juggle: Gag = {
  len: 5.4,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.3)) pop(st, a.x + 120 * a.S, headY(a) - 140 * a.S, t('Guckt mal!'), '#ffffff', 42);
    if (at(3.8)) {
      sfx.bonk();
      pop(st, a.x, headY(a) - 50, t('BONK!'), '#ffd84a', 60);
      st.particles.burst('spark', a.x, headY(a), 10, { color: '#fff6a8', size: 16, speed: 240, max: 0.8 });
    }
    if (at(4.4)) pop(st, a.x, headY(a) - 60, t('Aua! Hihi!'), '#ffffff', 42);
  },
  draw(ctx, a) {
    const t = a.t;
    const gy = feetY(a) - 10;
    const dizzy = t > 3.8 ? Math.exp(-(t - 3.8) * 1.2) : 0;
    const sy = t > 3.8 ? 1 - 0.2 * Math.exp(-(t - 3.8) * 6) : 1 + Math.sin(t * 11) * 0.02;
    drawFig(ctx, a.sp, a.x, a.y, { s: a.S, sy, rot: Math.sin(t * 6) * 0.25 * dizzy, flip: a.dir });
    if (t > 3.8 && t < 5.2) circleStars(ctx, a.x, headY(a) - 10, 55 * a.S, t);
    for (let i = 0; i < 3; i++) {
      let p: { x: number; y: number };
      if (t < 3) p = ballAt(a, i, t);
      else if (i === 0) {
        const s0 = ballAt(a, 0, 3);
        if (t < 3.8) {
          const u = (t - 3) / 0.8;
          p = { x: lerp(s0.x, a.x, u), y: lerp(s0.y, headY(a) - 18 * a.S, u) - Math.sin(u * Math.PI) * 260 * a.S };
        } else {
          const u = clamp((t - 3.8) / 0.7);
          p = { x: a.x + a.dir * 220 * a.S * u, y: lerp(headY(a) - 18 * a.S, gy, ease.outBounce(u)) - Math.sin(u * Math.PI) * 90 * a.S };
        }
      } else {
        const s0 = ballAt(a, i, 3);
        const dt = t - 3;
        p = { x: s0.x + (i === 1 ? -1 : 1) * 90 * dt, y: Math.min(gy, s0.y + 0.5 * 1800 * dt * dt) };
      }
      ctx.fillStyle = BALLS[i];
      ctx.strokeStyle = 'rgba(30,20,30,0.6)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 15 * a.S, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(p.x - 5 * a.S, p.y - 5 * a.S, 4.5 * a.S, 0, TAU);
      ctx.fill();
    }
  },
};

const HICS = [0.4, 1.1, 1.7, 2.3, 2.8, 3.3, 3.75];
const hiccup: Gag = {
  len: 5,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    HICS.forEach((h, i) => {
      if (!at(h)) return;
      sfx.hiccup();
      const n = nose(a);
      pop(st, a.x + (i % 2 ? -1 : 1) * 70 * a.S, headY(a) - 30, t('Hicks!'), '#ffffff', 40 + i * 2);
      st.particles.burst('spark', n.x, n.y, 7, { color: '#ffe45a', size: 16, speed: 220, max: 0.9, gravity: 200 });
    });
    if (at(4.05)) st.say(t('BUH!'), false);
    if (at(4.2)) sfx.boing();
    if (at(4.5)) pop(st, a.x, headY(a) - 70, t('Huch! Weg ist er!'), '#ffd84a', 44);
  },
  draw(ctx, a) {
    const t = a.t;
    let lift = 0;
    let sy = 1;
    for (const h of HICS) {
      const s = t - h;
      if (s >= 0 && s < 0.35) {
        lift = Math.sin((s / 0.35) * Math.PI) * 55 * a.S;
        sy = 1 + 0.12 * Math.sin((s / 0.35) * Math.PI);
      }
    }
    // Flocke's "BUH!" makes it jump very high
    const s = t - 4.2;
    if (s >= 0 && s < 0.6) lift = Math.sin((s / 0.6) * Math.PI) * 150 * a.S;
    drawFig(ctx, a.sp, a.x, a.y - lift, { s: a.S, sy, flip: a.dir });
  },
};

/** belly slide out of the picture and back in */
const slide: Gag = {
  len: 5.2,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.6)) pop(st, a.x, headY(a) - 20, t('Wiiiiiii!'), '#ffffff', 50);
    if (at(0.5) || at(2.3)) sfx.whoosh();
    const tt = t1;
    if ((tt > 0.5 && tt < 1.9) || (tt > 2.3 && tt < 3.9)) {
      const x = slideX(a, st, tt);
      if (x > -50 && x < st.W + 50 && Math.random() < 0.8)
        st.particles.add({ kind: 'puff', x: x - 90 * a.S, y: feetY(a) - 10, vx: -60 - Math.random() * 120, vy: -60 - Math.random() * 80, size: 14 + Math.random() * 10, max: 0.6, color: 'rgba(255,255,255,0.9)' });
    }
    if (at(4.4)) pop(st, a.x, headY(a) - 50, t('Nochmal!'), '#ffd84a', 50);
  },
  draw(ctx, a, st) {
    const t = a.t;
    if (t >= 1.9 && t < 2.3) return;
    const lie = t < 0.5 ? ease.inOutCubic(t / 0.5) : t < 3.9 ? 1 : 1 - ease.outBack(clamp((t - 3.9) / 0.5));
    const x = slideX(a, st, t);
    const y = a.y + a.sp.radius * a.S * 0.35 * clamp(lie);
    const tall = a.sp.canvas.height > a.sp.canvas.width * 0.9;
    drawFig(ctx, a.sp, x, tall ? y : a.y + 10 * a.S * lie, { s: a.S, rot: tall ? (Math.PI / 2) * lie : 0.12 * lie, sy: tall ? 1 : 1 - 0.18 * lie, sx: tall ? 1 : 1 + 0.1 * lie, flip: 1 });
  },
};
function slideX(a: Act, st: Stage, t: number): number {
  if (t < 0.5) return a.x;
  if (t < 1.9) return lerp(a.x, st.W + 320, ease.inQuad((t - 0.5) / 1.4));
  if (t < 2.3) return st.W + 320;
  if (t < 3.9) return lerp(-320, a.x, ease.outCubic((t - 2.3) / 1.6));
  return a.x;
}

function boot(ctx: Ctx, x: number, y: number, s: number): void {
  // y is the sole; the boot points to the right
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#d42a35';
  ctx.strokeStyle = '#6d0f17';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-60, -170);
  ctx.lineTo(50, -170);
  ctx.lineTo(50, -70);
  ctx.quadraticCurveTo(130, -60, 135, -20);
  ctx.quadraticCurveTo(135, 0, 110, 0);
  ctx.lineTo(-60, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-45, -150, 20, 130);
  // fur rim
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#c9d3e6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-75, -200, 140, 44, 22);
  ctx.fill();
  ctx.stroke();
  // sole
  ctx.fillStyle = '#3b2a2a';
  ctx.fillRect(-60, -8, 172, 10);
  ctx.restore();
}

function hat(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(0.25 + Math.sin(t * 6) * 0.06);
  ctx.fillStyle = '#d42a35';
  ctx.strokeStyle = '#6d0f17';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-36, 0);
  ctx.quadraticCurveTo(0, -80, 50, -60);
  ctx.lineTo(36, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-42, -6, 84, 18, 9);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(52, -60, 11, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** St Nicholas' day: a huge boot lands, chocolate coins rain, the figure climbs out with a Nicholas hat */
const nikolaus: Gag = {
  len: 5.8,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.7)) {
      sfx.thud(2);
      st.particles.burst('puff', a.v.bx, feetY(a), 14, { color: 'rgba(255,255,255,0.9)', size: 26, speed: 220, max: 0.7 });
    }
    if (t1 > 0.8 && t1 < 2.6 && Math.random() < 0.7) {
      st.particles.add({ kind: 'drop', x: a.x + (Math.random() - 0.4) * 500 * a.S, y: -20, vy: 200, gravity: 900, size: 11 + Math.random() * 5, max: 1.4, color: '#f2c230' });
    }
    if (at(2.5)) {
      sfx.fanfare();
      pop(st, a.x, headY(a) - 80 * a.S, t('Ho! Ho! Ho!'), '#ffffff', 58);
    }
    if (at(3.4)) st.say(t('Juhu, der Nikolaus war da!'), true);
  },
  draw(ctx, a) {
    const t = a.t;
    if (a.v.bx === undefined) a.v.bx = a.x + a.dir * 150 * a.S;
    const bx = a.v.bx;
    const gy = feetY(a);
    const by = t < 0.7 ? lerp(-60, gy, ease.inQuad(t / 0.7)) : gy;
    const squash = t > 0.7 && t < 1.1 ? 1 - 0.15 * Math.sin(((t - 0.7) / 0.4) * Math.PI) : 1;
    const bs = 0.95 * a.S;
    const alpha = 1 - clamp((t - 5) / 0.8);
    // the figure climbs out of the boot, then jumps next to it
    let fx = bx;
    let fy = gy + 60 * a.S;
    if (t >= 1.4 && t < 2.2) fy = lerp(gy + 60 * a.S, by - 200 * bs - a.sp.radius * a.S * 0.6, ease.outBack((t - 1.4) / 0.8));
    else if (t >= 2.2) {
      const u = clamp((t - 2.2) / 0.6);
      const top = by - 200 * bs - a.sp.radius * a.S * 0.6;
      fx = lerp(bx, a.x, u);
      fy = lerp(top, a.y, u) - Math.sin(u * Math.PI) * 120 * a.S;
    }
    const inside = t < 2.2;
    if (t >= 1.4 || !inside) {
      if (inside) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(bx - 400, -1000, 800, by - 190 * bs + 1000);
        ctx.clip();
      }
      drawFig(ctx, a.sp, fx, fy, { s: a.S, flip: a.dir });
      hat(ctx, fx + a.dir * 6 * a.S, fy - a.sp.radius * a.S * 0.95, a.S, t);
      if (inside) ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(bx, by);
    ctx.scale(a.dir / squash, squash);
    boot(ctx, 0, 0, bs);
    ctx.restore();
  },
};

/** the snowman sneezes his carrot nose away, a hare steals it ... and brings it back */
const noseGag: Gag = {
  len: 5.9,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.7)) {
      sfx.sneeze();
      pop(st, a.x, headY(a) - 30, t('Ha-TSCHI!'), '#ffffff', 50);
    }
    if (at(1.3)) sfx.plopp();
    if (at(1.5)) pop(st, a.x, headY(a) - 60, t('Meine Nase!'), '#ffd84a', 46);
    if (at(2.4)) {
      sfx.chomp();
      pop(st, a.v.cx, feetY(a) - 160 * a.S, t('Mampf?'), '#ffffff', 40);
    }
    if (at(3.0)) st.say(t('He! Das ist doch keine Möhre zum Essen!'), false);
    if (at(4.7)) {
      sfx.boing();
      pop(st, a.x + a.dir * 140 * a.S, headY(a) - 50, t('Hihi, war nur Spaß!'), '#ffffff', 44);
      st.particles.burst('heart', a.x, headY(a), 8, { color: '#ff6fa3', size: 24, speed: 160, max: 1.2, gravity: -60 });
    }
  },
  draw(ctx, a, st) {
    const t = a.t;
    const n = snowNose(a.genome);
    // nose position in the world (sprite px -> world)
    const nx = a.x + a.dir * (n.bx - a.sp.ax) * a.S;
    const ny = a.y + (n.y - a.sp.ay) * a.S;
    const len = (n.tip - n.bx) * a.S;
    const gy = feetY(a) - 8 * a.S;
    const cx = a.x + a.dir * 210 * a.S;
    a.v.cx = cx;
    if (!a.cache.noseless) a.cache.noseless = noseless(a.sp, a.genome);
    const without = t >= 0.7 && t < 4.7;
    const wob = t < 0.7 ? Math.sin(t * 25) * 0.04 : 0;
    drawFig(ctx, a.sp, a.x, a.y, { s: a.S, flip: a.dir, rot: wob, canvas: without ? a.cache.noseless : undefined });
    const hare = st.extra('hase');
    const hs = a.S * 0.85;
    const side = a.dir;
    const far = side > 0 ? st.W + 160 : -160;
    const nearNose = a.x + a.dir * 150 * a.S;
    // the carrot
    let carrotAt: { x: number; y: number; rot: number } | null = null;
    let hx = far;
    let hface = -side;
    let hlift = 0;
    if (t >= 0.7 && t < 1.3) {
      const u = (t - 0.7) / 0.6;
      carrotAt = { x: lerp(nx, cx, u), y: lerp(ny, gy, u) - Math.sin(u * Math.PI) * 120 * a.S, rot: a.dir * u * 6 };
    } else if (t >= 1.3 && t < 2.4) carrotAt = { x: cx, y: gy - Math.abs(Math.sin((t - 1.3) * 9)) * 20 * a.S * Math.exp(-(t - 1.3) * 4), rot: 0 };
    if (t >= 1.6 && t < 2.4) {
      const u = (t - 1.6) / 0.8;
      hx = lerp(far, cx + side * 50 * a.S, ease.outCubic(u));
      hlift = hop(u * Math.PI * 3, 1) * 50 * a.S;
    } else if (t >= 2.4 && t < 2.6) hx = cx + side * 50 * a.S;
    else if (t >= 2.6 && t < 3.6) {
      const u = (t - 2.6) / 1;
      hx = lerp(cx + side * 50 * a.S, far, ease.inQuad(u));
      hface = side;
      hlift = hop(u * Math.PI * 4, 1) * 45 * a.S;
    } else if (t >= 3.6 && t < 3.9) hx = far;
    else if (t >= 3.9 && t < 4.7) {
      const u = (t - 3.9) / 0.8;
      hx = lerp(far, nearNose, ease.outCubic(u));
      hlift = hop(u * Math.PI * 3, 1) * 45 * a.S;
    } else if (t >= 4.7 && t < 5.0) hx = nearNose;
    else if (t >= 5.0) {
      const u = clamp((t - 5.0) / 0.9);
      hx = lerp(nearNose, far, ease.inQuad(u));
      hface = side;
      hlift = hop(u * Math.PI * 3, 1) * 45 * a.S;
    }
    const hy = feetY(a) - (hare.canvas.height - hare.ay) * hs - hlift;
    const holds = t >= 2.4 && t < 4.7;
    if (holds) carrotAt = { x: hx + hface * hare.radius * hs * 0.85, y: hy - hare.radius * hs * 0.25, rot: hface > 0 ? 0 : Math.PI };
    if (t >= 1.6) drawFig(ctx, hare, hx, hy, { s: hs, flip: hface });
    if (carrotAt) carrot(ctx, carrotAt.x, carrotAt.y, len, carrotAt.rot);
  },
};

/** a dance until a button pops off and rolls away */
const button: Gag = {
  len: 5.2,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.2)) pop(st, a.x, headY(a) - 30, t('La la la!'), '#ffffff', 44);
    if (at(2.2)) {
      sfx.plopp(1.5);
      pop(st, a.x, headY(a) - 50, t('Plopp!'), '#ffd84a', 50);
      a.v.bx = a.x;
      a.v.by = a.y;
      a.v.bvx = a.dir * 420;
      a.v.bvy = -620;
    }
    if (a.v.bx !== undefined && a.v.got === undefined) {
      const dt = t1 - t0;
      a.v.bvy += 1500 * dt;
      a.v.bx += a.v.bvx * dt;
      a.v.by += a.v.bvy * dt;
      const gy = feetY(a) - 10 * a.S;
      if (a.v.by > gy) {
        a.v.by = gy;
        a.v.bvy = -Math.abs(a.v.bvy) * 0.5;
        a.v.bvx *= 0.75;
      }
      a.v.bx = clamp(a.v.bx, 40, st.W - 40);
    }
    if (at(2.8)) pop(st, a.x, headY(a) - 60, t('Ups! Mein Knopf!'), '#ffffff', 44);
    if (t1 > 3.4 && a.v.got === undefined && a.v.bx !== undefined) {
      // run after it
      const d = a.v.bx - a.x;
      a.x += Math.sign(d) * Math.min(Math.abs(d), 260 * (t1 - t0));
      if (Math.abs(d) < 30 * a.S || t1 > 4.6) {
        a.v.got = 1;
        sfx.chomp();
        pop(st, a.x, headY(a) - 60, t('Hab ihn!'), '#ffd84a', 46);
      }
    }
  },
  draw(ctx, a) {
    const t = a.t;
    let rot = 0;
    let lift = 0;
    let dx = 0;
    let sy = 1;
    if (t < 2.3) {
      rot = Math.sin(t * 9) * 0.25;
      lift = hop(t, 9) * 35 * a.S;
      dx = Math.sin(t * 4.5) * 25 * a.S;
    } else if (t < 3.4) sy = 1 + 0.1 * Math.exp(-(t - 2.3) * 5);
    else if (a.v.got === undefined) lift = hop(t, 12) * 12 * a.S;
    drawFig(ctx, a.sp, a.x + dx, a.y - lift, { s: a.S, rot, sy, flip: a.dir });
    if (a.v.bx !== undefined && a.v.got === undefined) {
      const r = 10 * a.S;
      ctx.save();
      ctx.translate(a.v.bx, a.v.by);
      ctx.rotate(a.v.bx * 0.05);
      ctx.fillStyle = '#e5283b';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-r * 0.5, -1.5, r, 3);
      ctx.restore();
    }
  },
};

function bowl(ctx: Ctx, x: number, y: number, s: number, front: boolean): void {
  // y = bottom of the bowl
  const w = 120 * s;
  const h = 70 * s;
  if (!front) {
    ctx.fillStyle = '#f3dca8';
    ctx.strokeStyle = '#a8865a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y - h, w, 20 * s, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.fillStyle = '#4ea8ff';
  ctx.strokeStyle = '#1d4f8a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - w, y - h);
  ctx.quadraticCurveTo(x - w, y, x, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y - h);
  ctx.ellipse(x, y - h, w, 20 * s, 0, 0, Math.PI);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(x + i * 40 * s, y - h * 0.45 + Math.abs(i) * 4 * s, 7 * s, 0, TAU);
    ctx.fill();
  }
}

/** the figure trips into the cookie dough and comes out white with flour */
const dough: Gag = {
  len: 5.4,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    const bx = a.x + a.dir * 170 * a.S;
    const gy = feetY(a);
    if (at(0.2)) pop(st, a.x, headY(a) - 30, t('Mmh, Keksteig!'), '#ffffff', 44);
    if (at(0.8)) pop(st, a.x, headY(a) - 40, t('Huch!'), '#ffd84a', 46);
    if (at(1.4)) {
      sfx.pfff();
      pop(st, bx, gy - 200 * a.S, t('PUFF!'), '#ffffff', 60);
      for (let i = 0; i < 34; i++)
        st.particles.add({ kind: 'puff', x: bx + (Math.random() - 0.5) * 160 * a.S, y: gy - 80 * a.S, vx: (Math.random() - 0.5) * 260, vy: -100 - Math.random() * 260, size: 18 + Math.random() * 20, max: 1.2 + Math.random() * 0.6, color: 'rgba(255,255,255,0.92)' });
    }
    if (at(2.0)) pop(st, bx, gy - 150 * a.S, t('Blubb!'), '#ffffff', 40);
    if (at(2.7)) sfx.boing();
    if (at(3.4)) pop(st, a.x, headY(a) - 50, t('Pfff! Lecker!'), '#ffd84a', 48);
    if (t1 > 3.4 && t1 < 4.6 && Math.random() < 0.5)
      st.particles.add({ kind: 'puff', x: a.x + (Math.random() - 0.5) * 120 * a.S, y: a.y + (Math.random() - 0.5) * 100 * a.S, vx: (Math.random() - 0.5) * 200, vy: 40, size: 10, max: 0.6, color: 'rgba(255,255,255,0.9)' });
  },
  draw(ctx, a) {
    const t = a.t;
    const bx = a.x + a.dir * 170 * a.S;
    const gy = feetY(a);
    if (!a.cache.flour) a.cache.flour = floured(a.sp.canvas);
    const bw = t > 1.4 && t < 2.7 ? Math.sin(t * 20) * 0.04 : 0;
    ctx.save();
    ctx.translate(bx, gy);
    ctx.rotate(bw);
    ctx.translate(-bx, -gy);
    bowl(ctx, bx, gy, a.S, false);
    ctx.restore();
    let x = a.x;
    let y = a.y;
    let rot = 0;
    let hide = false;
    if (t >= 0.8 && t < 1.4) {
      const u = (t - 0.8) / 0.6;
      x = lerp(a.x, bx, u);
      y = lerp(a.y, gy - 40 * a.S, u) - Math.sin(u * Math.PI) * 150 * a.S;
      rot = a.dir * u * Math.PI;
    } else if (t >= 1.4 && t < 2.7) hide = true;
    else if (t >= 2.7 && t < 3.3) {
      const u = (t - 2.7) / 0.6;
      x = lerp(bx, a.x, u);
      y = lerp(gy - 40 * a.S, a.y, u) - Math.sin(u * Math.PI) * 170 * a.S;
      rot = -a.dir * (1 - u) * 0.6;
    }
    if (!hide) {
      const shake = t > 3.3 && t < 4.6 ? Math.sin(t * 30) * 0.06 : 0;
      drawFig(ctx, a.sp, x, y, { s: a.S, rot: rot + shake, flip: a.dir });
      if (t >= 2.7) drawFig(ctx, a.sp, x, y, { s: a.S, rot: rot + shake, flip: a.dir, canvas: a.cache.flour, alpha: 1 - clamp((t - 3.6) / 1.8) });
    }
    ctx.save();
    ctx.translate(bx, gy);
    ctx.rotate(bw);
    ctx.translate(-bx, -gy);
    bowl(ctx, bx, gy, a.S, true);
    ctx.restore();
  },
};

/** falls asleep standing, a snore bubble grows and pops */
const snore: Gag = {
  len: 5.2,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    for (const T of [0.3, 1.1, 1.9, 2.6]) if (at(T)) st.particles.add({ kind: 'text', x: a.x - a.dir * 40 * a.S, y: headY(a) - 10, vx: -a.dir * 25, vy: -55, max: 2.2, size: 34 + T * 8, color: '#cfe0ff', text: 'Z' });
    if (at(1.0)) sfx.yawn();
    if (at(3.1)) {
      sfx.plopp(2);
      const n = nose(a);
      st.particles.add({ kind: 'ring', x: n.x, y: n.y, size: 60 * a.S, max: 0.4, color: 'rgba(200,230,255,0.95)' });
      st.particles.burst('drop', n.x, n.y, 12, { color: 'rgba(200,230,255,0.9)', size: 6, speed: 260, gravity: 600, max: 0.6 });
      pop(st, a.x, headY(a) - 60, t('PLOPP! Huch!'), '#ffd84a', 50);
    }
    if (at(3.8)) st.say(t('Guten Morgen, Schlafmütze!'), true);
  },
  draw(ctx, a) {
    const t = a.t;
    const sleep = t < 3.1;
    const rot = sleep ? -a.dir * 0.22 * clamp(t / 0.6) : -a.dir * 0.22 * Math.max(0, 1 - (t - 3.1) * 4);
    const sy = sleep ? 1 + 0.05 * Math.sin(t * 3) : 1;
    const s = t - 3.1;
    const lift = s >= 0 && s < 0.6 ? Math.sin((s / 0.6) * Math.PI) * 110 * a.S : 0;
    drawFig(ctx, a.sp, a.x, a.y - lift, { s: a.S, rot, sy, flip: a.dir });
    if (sleep && t > 0.6) {
      const n = nose(a);
      const r = (5 + 34 * clamp((t - 0.6) / 2.4)) * (1 + 0.15 * Math.sin(t * 3)) * a.S;
      ctx.save();
      ctx.fillStyle = 'rgba(190,225,255,0.5)';
      ctx.strokeStyle = 'rgba(120,170,230,0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(n.x + a.dir * r * 0.8, n.y + 6 * a.S, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(n.x + a.dir * r * 0.8 - r * 0.35, n.y + 6 * a.S - r * 0.35, r * 0.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  },
};

/** flies a loop, crashes head first into the snow, pops out again */
const fly: Gag = {
  len: 5.6,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.6)) {
      sfx.whoosh();
      pop(st, a.x, headY(a) - 80, t('Ich kann fliiiegen!'), '#ffffff', 48);
    }
    if (t1 > 0.5 && t1 < 2.6 && Math.random() < 0.6) {
      const p = flyPos(a, t1);
      st.particles.add({ kind: 'spark', x: p.x - a.dir * 40, y: p.y, size: 12, max: 0.8, color: '#fff6a8' });
    }
    if (at(3.0)) {
      sfx.thud(2);
      const p = flyPos(a, 3);
      pop(st, p.x, feetY(a) - 160 * a.S, t('PLUMPS!'), '#ffd84a', 58);
      for (let i = 0; i < 24; i++)
        st.particles.add({ kind: 'puff', x: p.x + (Math.random() - 0.5) * 100, y: feetY(a) - 10, vx: (Math.random() - 0.5) * 360, vy: -150 - Math.random() * 250, gravity: 400, size: 16 + Math.random() * 12, max: 1, color: 'rgba(255,255,255,0.95)' });
    }
    if (at(3.6)) st.say(t('Landen üben wir noch!'), false);
    if (at(4.95)) pop(st, a.x, headY(a) - 50, t('Tadaa!'), '#ffffff', 52);
  },
  draw(ctx, a) {
    const t = a.t;
    const p = flyPos(a, t);
    const gy = feetY(a) - 6 * a.S;
    if (t >= 3.0 && t < 4.2) {
      // stuck upside down in the snow, legs wiggling
      ctx.save();
      ctx.beginPath();
      ctx.rect(p.x - 400, -2000, 800, gy + 2000);
      ctx.clip();
      drawFig(ctx, a.sp, p.x, p.y, { s: a.S, rot: p.rot + Math.sin(t * 22) * 0.08, flip: a.dir });
      ctx.restore();
      ctx.fillStyle = '#f7faff';
      ctx.beginPath();
      ctx.ellipse(p.x, gy, 90 * a.S, 18 * a.S, 0, 0, TAU);
      ctx.fill();
      return;
    }
    drawFig(ctx, a.sp, p.x, p.y, { s: a.S, rot: p.rot, flip: a.dir, sy: t < 0.5 ? 1 - 0.15 * Math.sin((t / 0.5) * Math.PI) : 1 });
  },
};
function flyPos(a: Act, t: number): { x: number; y: number; rot: number } {
  const R = 190 * a.S;
  const lx = a.x0 + a.dir * 120 * a.S;
  if (t < 0.5) return { x: a.x0, y: a.y, rot: 0 };
  if (t < 2.5) {
    const p = (t - 0.5) / 2;
    const th = ease.inOutCubic(p) * TAU;
    return { x: a.x0 + a.dir * (Math.sin(th) * R + p * 120 * a.S), y: a.y - 90 * a.S * Math.sin(p * Math.PI) - R + Math.cos(th) * R, rot: -a.dir * th };
  }
  if (t < 3.0) {
    const u = (t - 2.5) / 0.5;
    return { x: lx + a.dir * 160 * a.S * u, y: a.y - Math.sin(u * Math.PI) * 90 * a.S + u * 70 * a.S, rot: a.dir * u * Math.PI * 0.8 };
  }
  const cx = lx + a.dir * 160 * a.S;
  if (t < 4.2) return { x: cx, y: a.y + 70 * a.S, rot: a.dir * Math.PI * 0.8 };
  const u = clamp((t - 4.2) / 0.7);
  return { x: lerp(cx, a.x0, u), y: lerp(a.y + 70 * a.S, a.y, u) - Math.sin(u * Math.PI) * 160 * a.S, rot: a.dir * Math.PI * 0.8 * (1 - u) - a.dir * u * TAU };
}

/** a snowball right into Flocke's face */
const snowball: Gag = {
  len: 4.9,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.2)) pop(st, a.x, headY(a) - 30, t('Hihi …'), '#ffffff', 40);
    if (at(1.0)) sfx.whoosh();
    if (at(1.7)) {
      sfx.splat();
      st.splat();
      const f = st.flockeHead;
      st.particles.burst('puff', f.x, f.y, 16, { color: 'rgba(255,255,255,0.95)', size: 20, speed: 260, max: 0.7 });
      pop(st, f.x, f.y - 90, t('PLATSCH!'), '#ffffff', 56);
      st.say(t('Hey! Mitten auf die Nase!'), false);
    }
    if (at(2.0)) {
      sfx.laugh();
      pop(st, a.x, headY(a) - 40, t('Treffer! Hihihi!'), '#ffd84a', 46);
    }
    if (at(3.7)) st.say(t('Na warte, morgen bin ich dran!'), true);
  },
  draw(ctx, a, st) {
    const t = a.t;
    let sy = 1;
    let rot = 0;
    let lift = 0;
    if (t < 0.9) sy = 1 - 0.2 * Math.sin(clamp(t / 0.9) * Math.PI);
    else if (t < 1.1) rot = -a.dir * 0.3 * Math.sin(((t - 0.9) / 0.2) * Math.PI);
    else if (t > 1.8 && t < 3.6) {
      lift = hop(t, 10) * 30 * a.S;
      rot = Math.sin(t * 20) * 0.08;
    }
    drawFig(ctx, a.sp, a.x, a.y - lift, { s: a.S, sy, rot, flip: a.dir });
    const hand = { x: a.x + a.dir * a.sp.radius * a.S * 0.7, y: a.y - a.sp.radius * a.S * 0.2 };
    let b: { x: number; y: number } | null = null;
    if (t >= 0.5 && t < 1.0) b = hand;
    else if (t >= 1.0 && t < 1.7) {
      const u = (t - 1.0) / 0.7;
      const f = st.flockeHead;
      b = { x: lerp(hand.x, f.x, u), y: lerp(hand.y, f.y, u) - Math.sin(u * Math.PI) * 200 * a.S };
    }
    if (b) {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#a9bbdc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 16 * a.S, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  },
};

/** a pirouette until everything spins */
const spin: Gag = {
  len: 4.9,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.3)) pop(st, a.x, headY(a) - 30, t('Wuiii!'), '#ffffff', 48);
    if (at(2.5)) {
      sfx.boing();
      pop(st, a.x, headY(a) - 60, t('Mir ist schwindelig!'), '#ffd84a', 46);
    }
  },
  draw(ctx, a) {
    const t = a.t;
    if (t < 2.4) {
      const ang = t * t * 7;
      const sx = Math.cos(ang);
      drawFig(ctx, a.sp, a.x, a.y - Math.abs(Math.sin(ang)) * 14 * a.S, { s: a.S, sx: Math.abs(sx) < 0.12 ? 0.12 * Math.sign(sx || 1) : sx, flip: a.dir });
      return;
    }
    const d = Math.exp(-(t - 2.4) * 0.9);
    drawFig(ctx, a.sp, a.x + Math.sin(t * 4) * 30 * a.S * d, a.y, { s: a.S, rot: Math.sin(t * 6) * 0.3 * d, flip: a.dir });
    circleStars(ctx, a.x, headY(a) - 10, 55 * a.S, t);
  },
};

/** the present rattles, then an elf on a spring jumps out: "Kuckuck!" */
const boing: Gag = {
  len: 5,
  tick(a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.4)) pop(st, a.x, headY(a) - 30, t('Rappel, rappel …'), '#ffffff', 40);
    if (at(1.3)) {
      sfx.boing();
      st.particles.burst('confetti', a.x, headY(a), 24, { colors: CONFETTI, size: 13, speed: 320, max: 1.3, gravity: 420 });
    }
    if (at(1.5)) pop(st, a.x, headY(a) - 230 * a.S, t('Kuckuck!'), '#ffd84a', 54);
    if (at(3.65)) pop(st, a.x, headY(a) - 200 * a.S, t('Tschüss!'), '#ffffff', 44);
  },
  draw(ctx, a, st) {
    const t = a.t;
    const top = headY(a) + 10 * a.S;
    let h = 0;
    if (t >= 1.3 && t < 3.6) {
      const e = t - 1.3;
      h = 120 * a.S * (1 - Math.exp(-e * 3) * Math.cos(e * 12));
    } else if (t >= 3.6 && t < 4.0) h = 120 * a.S * (1 - (t - 3.6) / 0.4);
    if (h > 2) {
      const elf = st.extra('wichtel');
      const es = 0.72 * a.S;
      const ey = top - h - (elf.canvas.height - elf.ay) * es;
      ctx.strokeStyle = '#c0c6dc';
      ctx.lineWidth = 7;
      ctx.beginPath();
      const n = 8;
      for (let i = 0; i <= n; i++) ctx.lineTo(a.x + (i % 2 ? 14 : -14) * a.S, top - (h * i) / n);
      ctx.stroke();
      drawFig(ctx, elf, a.x, ey, { s: es, rot: Math.sin(t * 9) * 0.15 });
    }
    let rot = 0;
    let lift = 0;
    if (t < 1.3) rot = Math.sin(t * 40) * 0.1 * (t / 1.3);
    else if (t > 4.1) lift = hop(t - 4.1, 8) * 40 * a.S;
    drawFig(ctx, a.sp, a.x, a.y - lift, { s: a.S, rot, flip: a.dir });
  },
};

const FIREWORKS = [0.9, 1.8, 2.6, 3.5, 4.4, 5.2, 6.1, 7.0, 7.8];
/** December 24th: everybody dances, confetti, fireworks, the roof star shines */
const finale: Gag = {
  len: 9,
  tick(_a, st, t0, t1) {
    const at = (T: number) => t0 < T && t1 >= T;
    if (at(0.2)) {
      sfx.win();
      st.say(t('Frohe Weihnachten! Ihr habt alle 24 Türchen geschafft!'), true);
    }
    const n = Math.round((t1 - t0) * 50 + Math.random());
    for (let i = 0; i < n; i++)
      st.particles.add({ kind: 'confetti', x: Math.random() * st.W, y: -10, vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 120, gravity: 40, size: 12 + Math.random() * 8, max: 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 8, color: CONFETTI[i % CONFETTI.length] });
    FIREWORKS.forEach((T, i) => {
      if (!at(T)) return;
      sfx.plopp(2);
      const x = st.W * (0.12 + ((i * 0.37) % 0.76));
      const y = 120 + ((i * 97) % 260);
      st.particles.add({ kind: 'ring', x, y, size: 160, max: 0.6, color: CONFETTI[i % CONFETTI.length] });
      st.particles.burst('spark', x, y, 22, { color: ['#fff6a8', '#ffb3d1', '#b3f0ff'][i % 3], size: 18, speed: 380, max: 1.2, gravity: 120 });
    });
  },
  draw(ctx, a, st) {
    const ft = a.t;
    drawFig(ctx, a.sp, a.x + Math.sin(ft * 4) * 30 * a.S, a.y - hop(ft, 7) * 45 * a.S, { s: a.S, rot: Math.sin(ft * 7) * 0.25, flip: Math.sin(ft * 2) > 0 ? 1 : -1 });
    // "Frohe Weihnachten!" across the sky
    const k = ease.outBack(clamp((ft - 0.6) / 0.8)) * (1 - clamp((ft - 8.4) / 0.6));
    if (k <= 0) return;
    ctx.save();
    ctx.translate(st.W / 2, 330);
    ctx.scale(k * (1 + Math.sin(ft * 4) * 0.03), k * (1 + Math.sin(ft * 4) * 0.03));
    ctx.font = '700 110px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#7a1020';
    const text = t('Frohe Weihnachten!');
    ctx.strokeText(text, 0, 0, st.W - 60);
    const g = ctx.createLinearGradient(0, -50, 0, 50);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(1, '#ffc23a');
    ctx.fillStyle = g;
    ctx.fillText(text, 0, 0, st.W - 60);
    ctx.restore();
  },
};

export const GAGS: Record<GagId, Gag> = { sneeze, giftrun, juggle, hiccup, slide, nikolaus, nose: noseGag, button, dough, snore, fly, snowball, spin, boing, finale };

/** gags that run out of the picture to the right always start facing right */
export const RIGHTWARD: GagId[] = ['giftrun', 'slide', 'fly'];

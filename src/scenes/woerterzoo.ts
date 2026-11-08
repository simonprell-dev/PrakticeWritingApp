// The Wörter-Zoo: a picture appears, the class writes its word on paper, the app reads the word. When it is
// right the picture comes alive, shows how nicely it was written and moves into the zoo at the bottom, with
// the written word as its name sign. See docs/superpowers/specs/2026-11-07-woerter-zoo-design.md.
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, makeCanvas, type AnyCanvas, type Ctx } from '../game/canvas.ts';
import { bandaid, crown, sparkleStar } from '../game/creatures/parts.ts';
import { animalSprite } from '../game/creatures/savanna.ts';
import { clamp, ease, lerp, TAU } from '../game/math.ts';
import { mulberry32 } from '../game/rng.ts';
import { speak } from '../game/voice/gameVoice.ts';
import { PICTO_SIZE, type Picto } from '../game/words/picto.ts';
import { PICTOS } from '../game/words/pictos/index.ts';
import { judge, nextWord, readWord, usable, WORDS, type Verdict, type ZooWord } from '../game/words/words.ts';
import { TIER_LABEL, tierOf } from '../recog/score.ts';
import type { ScanResult, ScannedGlyph, Tier } from '../vision/types.ts';
import { WORD_LETTERS, type WordHelp } from '../app/settings.ts';
import { HabitatScene, starCount, type HabitatDef } from './habitat.ts';
import { loadGlyph, saveGlyph, type SavedGlyph, type SceneSave } from './saved.ts';
import type { SceneHost, Snapshot } from './scene.ts';
import { t, tk } from '../i18n/i18n.ts';

// ------------------------------------------------------------------------------------------- layout

/** the picture card at the top in the middle */
const CARD_W = 440;
const CARD_Y = 24;
const CARD_H = 500;
const PIC_S = 1.12;
const PIC_DY = 200;
/** the caption (the word) at the bottom of the card */
const CAP_DY = 444;
/** the writing line under the card, where the letters fly to */
const FIELD_Y = 544;
const FIELD_H = 112;
/** where the zoo begins, and its entrance */
const ZOO_Y = 668;
const GATE_X = 150;
const PATH_Y = 878;
/** seconds: the new card pops up, the picture walks from the card to the gate */
const ENTER = 0.6;
const WALK = 1.3;
/** help level 2: the word stands there this long */
const MEMO = 5;
/** after this many "Fast" the word counts anyway */
const MAX_TRIES = 3;

const FONT = 'Fredoka, system-ui, sans-serif';
const INK = '#3b2a5c';
const ALL = new Set(WORD_LETTERS);

/** letters reaching up to the top line and letters hanging below the base line */
const TALL = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜbdfhklßtäöü');
const DESC = new Set('gjpqy');

const hashStr = (s: string) => [...s].reduce((h, c) => (Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0), 2166136261);

/** a plain stand-in while a word has no picture yet: a friendly circle with a question mark */
function placeholder(word: string): Picto {
  const hue = hashStr(word) % 360;
  return {
    anim: 2,
    draw(ctx, time, alive) {
      const u = alive && time < 2 ? time / 2 : 1;
      const hop = alive ? Math.abs(Math.sin(u * Math.PI * 3)) * 30 * (1 - u) : 0;
      const breathe = 1 + Math.sin(time * 2.4) * 0.02;
      ctx.save();
      ctx.translate(0, -hop);
      ctx.scale(breathe, 1 / breathe);
      ctx.fillStyle = `hsl(${hue} 70% 82%)`;
      ctx.strokeStyle = `hsl(${hue} 45% 32%)`;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 118, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `hsl(${hue} 45% 32%)`;
      ctx.font = `700 150px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 8);
      ctx.restore();
    },
  };
}

const standIns = new Map<string, Picto>();
/** the picture of a word (a stand-in while it has none) */
export function pictoOf(word: string): Picto {
  const p = PICTOS[word];
  if (p) return p;
  let s = standIns.get(word);
  if (!s) standIns.set(word, (s = placeholder(word)));
  return s;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** the school lines of the writing line: top, middle, base and bottom */
function lines(F: Rect) {
  return { top: F.y + 16, mid: F.y + 44, base: F.y + 72, low: F.y + 100 };
}

type Written = { box: Rect; score: { char: string } };

/**
 * The written letters on the writing line as the child wrote them: the same shape and spacing, sized so
 * capitals reach the top line, standing on the base line, centred
 */
export function fieldLayout(letters: Written[], F: Rect): Rect[] {
  if (!letters.length) return [];
  const L = lines(F);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const tall = letters.filter((l) => TALL.has(l.score.char) && !DESC.has(l.score.char)).map((l) => l.box.h);
  const small = letters.filter((l) => !TALL.has(l.score.char) && !DESC.has(l.score.char)).map((l) => l.box.h);
  const fs: number[] = [];
  if (tall.length) fs.push((L.base - L.top) / avg(tall));
  if (small.length) fs.push((L.base - L.mid) / avg(small));
  let f = fs.length ? avg(fs) : (L.base - L.top) / Math.max(...letters.map((l) => l.box.h));
  const x0 = Math.min(...letters.map((l) => l.box.x));
  const x1 = Math.max(...letters.map((l) => l.box.x + l.box.w));
  f = Math.min(f, (F.w - 50) / Math.max(1, x1 - x0));
  if (!Number.isFinite(f) || f <= 0) f = 1;
  const sitting = letters.filter((l) => !DESC.has(l.score.char)).map((l) => l.box.y + l.box.h);
  const bottom = sitting.length ? sitting.sort((a, b) => a - b)[Math.floor(sitting.length / 2)] : Math.max(...letters.map((l) => l.box.y + l.box.h));
  const left = F.x + F.w / 2 - ((x1 - x0) * f) / 2;
  return letters.map((l) => ({ x: left + (l.box.x - x0) * f, y: L.base - (bottom - l.box.y) * f, w: l.box.w * f, h: l.box.h * f }));
}

// ------------------------------------------------------------------------------------------- the zoo

/** a pen of the zoo (drawn on the background) */
interface Pen {
  x: number;
  y: number;
  w: number;
  h: number;
  ground: 'gras' | 'sand' | 'teich';
}

function pens(W: number): Pen[] {
  const out: Pen[] = [];
  const x0 = 290;
  const x1 = W - 30;
  const n = Math.max(2, Math.round((x1 - x0) / 330));
  const w = (x1 - x0) / n;
  const grounds: Pen['ground'][] = ['gras', 'sand', 'teich', 'gras', 'sand', 'gras', 'teich'];
  for (let i = 0; i < n; i++) {
    out.push({ x: x0 + i * w + 8, y: 712, w: w - 16, h: 132, ground: grounds[i % grounds.length] });
    out.push({ x: x0 + i * w + 8 + (i === 0 ? 0 : 0), y: 924, w: w - 16, h: 146, ground: grounds[(i + 3) % grounds.length] });
  }
  return out;
}

function tree(ctx: Ctx, x: number, y: number, s: number, hue = 115): void {
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath();
  ctx.roundRect(x - 9 * s, y - 60 * s, 18 * s, 62 * s, 6 * s);
  ctx.fill();
  for (const [dx, dy, r, l] of [
    [0, -110, 54, 0.42],
    [-38, -80, 40, 0.38],
    [38, -82, 42, 0.36],
    [0, -70, 44, 0.4],
  ]) {
    ctx.fillStyle = `hsl(${hue} 48% ${l * 100}%)`;
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(x - 16 * s, y - 128 * s, 18 * s, 0, TAU);
  ctx.fill();
}

function bush(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.fillStyle = '#4f9e46';
  for (const [dx, r] of [
    [-22, 20],
    [0, 26],
    [22, 19],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y - r * s * 0.7, r * s, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff7aa8';
  for (const [dx, dy] of [
    [-14, -22],
    [10, -30],
    [22, -14],
  ]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, 4 * s, 0, TAU);
    ctx.fill();
  }
}

/** a low wooden fence along a line */
function fence(ctx: Ctx, x0: number, x1: number, y: number, h = 30): void {
  ctx.fillStyle = '#c98b4e';
  ctx.strokeStyle = '#7a4f2a';
  ctx.lineWidth = 2;
  for (let x = x0; x <= x1; x += 34) {
    ctx.beginPath();
    ctx.roundRect(x - 4, y - h, 8, h + 4, 3);
    ctx.fill();
    ctx.stroke();
  }
  for (const dy of [h * 0.72, h * 0.3]) {
    ctx.beginPath();
    ctx.roundRect(x0 - 4, y - dy - 3, x1 - x0 + 8, 6, 3);
    ctx.fill();
    ctx.stroke();
  }
}

function drawPen(ctx: Ctx, p: Pen): void {
  ctx.save();
  ctx.fillStyle = p.ground === 'sand' ? '#f4dfa6' : '#a9dd8c';
  ctx.beginPath();
  ctx.roundRect(p.x, p.y, p.w, p.h, 26);
  ctx.fill();
  if (p.ground === 'teich') {
    ctx.fillStyle = '#7fd0f0';
    ctx.strokeStyle = '#5bb2d8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.ellipse(p.x + p.w * 0.72, p.y + p.h * 0.55, p.w * 0.2, p.h * 0.26, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x + p.w * 0.68, p.y + p.h * 0.5, 14, Math.PI * 1.1, Math.PI * 1.6);
    ctx.stroke();
  } else if (p.ground === 'sand') {
    ctx.fillStyle = 'rgba(190,150,90,0.35)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.arc(p.x + ((i * 97) % Math.max(1, p.w - 30)) + 15, p.y + 20 + ((i * 53) % Math.max(1, p.h - 40)), 4, 0, TAU);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = 'rgba(60,140,60,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 10; i++) {
      const gx = p.x + 20 + ((i * 131) % Math.max(1, p.w - 40));
      const gy = p.y + 24 + ((i * 71) % Math.max(1, p.h - 40));
      ctx.beginPath();
      ctx.moveTo(gx - 5, gy);
      ctx.lineTo(gx, gy - 10);
      ctx.lineTo(gx + 5, gy);
      ctx.stroke();
    }
  }
  ctx.restore();
  // the low fence in front of the pen
  fence(ctx, p.x + 10, p.x + p.w - 10, p.y + p.h - 2, 24);
}

/** the entrance: two pillars with an arch and the sign "Wörter-Zoo" */
function drawGate(ctx: Ctx, x: number, top: number, bottom: number): void {
  const half = 92;
  for (const sx of [-1, 1]) {
    const px = x + sx * half;
    ctx.fillStyle = '#e8875a';
    ctx.strokeStyle = '#8c4a2c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(px - 22, top + 40, 44, bottom - top - 40, 8);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(140,74,44,0.45)';
    ctx.lineWidth = 2;
    for (let y = top + 70; y < bottom - 10; y += 26) {
      ctx.beginPath();
      ctx.moveTo(px - 22, y);
      ctx.lineTo(px + 22, y);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = '#a8740f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(px, top + 34, 16, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  // the arch with the name
  ctx.fillStyle = '#7c5cff';
  ctx.strokeStyle = '#3b2a8c';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - half - 30, top + 92);
  ctx.quadraticCurveTo(x, top - 10, x + half + 30, top + 92);
  ctx.lineTo(x + half + 30, top + 58);
  ctx.quadraticCurveTo(x, top - 48, x - half - 30, top + 58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('Wörter-Zoo'), x, top + 40, half * 2);
  ctx.restore();
  // little flags
  for (const sx of [-1, 1]) {
    const px = x + sx * half;
    ctx.strokeStyle = '#5a4030';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px, top + 18);
    ctx.lineTo(px, top - 22);
    ctx.stroke();
    ctx.fillStyle = sx < 0 ? '#ff6f91' : '#4fb3ff';
    ctx.beginPath();
    ctx.moveTo(px, top - 22);
    ctx.lineTo(px + 26, top - 14);
    ctx.lineTo(px, top - 6);
    ctx.closePath();
    ctx.fill();
  }
}

export function paintWoerterZoo(ctx: Ctx, W: number, H: number): void {
  // sky and hills: calm, so the picture and the word stand out
  const sky = ctx.createLinearGradient(0, 0, 0, ZOO_Y);
  sky.addColorStop(0, '#bfe6ff');
  sky.addColorStop(1, '#f2fbff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, ZOO_Y + 10);
  ctx.fillStyle = '#ffe680';
  ctx.beginPath();
  ctx.arc(110, 120, 58, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,230,128,0.35)';
  ctx.beginPath();
  ctx.arc(110, 120, 86, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#c7ecb5';
  ctx.beginPath();
  ctx.moveTo(0, ZOO_Y);
  for (let x = 0; x <= W; x += 40) ctx.lineTo(x, ZOO_Y - 40 - Math.sin(x / 260) * 34 - Math.sin(x / 97) * 8);
  ctx.lineTo(W, ZOO_Y);
  ctx.closePath();
  ctx.fill();
  // the ground of the zoo
  const g = ctx.createLinearGradient(0, ZOO_Y, 0, H);
  g.addColorStop(0, '#8fd17a');
  g.addColorStop(1, '#69b85a');
  ctx.fillStyle = g;
  ctx.fillRect(0, ZOO_Y, W, H - ZOO_Y);
  // trees along the back
  for (let x = 330; x < W; x += 210) tree(ctx, x + ((x * 7) % 50), ZOO_Y + 26, 0.62 + ((x * 13) % 20) / 100, 105 + ((x * 3) % 30));
  fence(ctx, 0, W, ZOO_Y + 34, 34);
  for (const p of pens(W)) drawPen(ctx, p);
  // the path from the gate through the zoo
  ctx.fillStyle = '#f0d9a8';
  ctx.strokeStyle = '#d8b878';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(GATE_X - 70, H);
  ctx.lineTo(GATE_X - 70, PATH_Y + 10);
  ctx.quadraticCurveTo(GATE_X - 60, PATH_Y - 30, GATE_X + 60, PATH_Y - 30);
  for (let x = GATE_X + 60; x <= W + 20; x += 60) ctx.lineTo(x, PATH_Y - 30 + Math.sin(x / 300) * 6);
  for (let x = W + 20; x >= GATE_X + 60; x -= 60) ctx.lineTo(x, PATH_Y + 32 + Math.sin(x / 300) * 6);
  ctx.quadraticCurveTo(GATE_X + 70, PATH_Y + 30, GATE_X + 70, H);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(200,170,110,0.55)';
  for (let x = GATE_X + 90; x < W; x += 75) {
    ctx.beginPath();
    ctx.ellipse(x, PATH_Y + Math.sin(x / 300) * 6 + ((x * 7) % 20) - 10, 9, 5, 0, 0, TAU);
    ctx.fill();
  }
  for (let x = 420; x < W; x += 390) bush(ctx, x, PATH_Y + 52, 0.9);
  drawGate(ctx, GATE_X, ZOO_Y - 46, PATH_Y + 40);
  // a signpost by the gate
  ctx.fillStyle = '#8a5a34';
  ctx.fillRect(GATE_X + 128, PATH_Y + 40, 8, 120);
}

/** where the entries of the zoo stand: rows of places, closer together the more there are */
export function zooSlots(n: number, W: number): { x: number; y: number; k: number; gap: number }[] {
  const rows = n > 22 ? 3 : 2;
  const feet = rows === 3 ? [806, 910, 1012] : [824, 1012];
  const x0 = 300;
  const x1 = W - 60;
  const cols = Math.max(1, Math.ceil(n / rows));
  const gap = (x1 - x0) / cols;
  const k = clamp(gap / 440, 0.17, 0.4);
  return Array.from({ length: n }, (_, i) => {
    const row = i % rows;
    const col = Math.floor(i / rows);
    return { x: x0 + gap * (col + 0.5) + (row % 2 ? gap * 0.22 : 0), y: feet[row], k, gap };
  });
}

// ------------------------------------------------------------------------------------------- the world

interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}

export const woerterzoo: HabitatDef = {
  id: 'woerterzoo',
  archetype: 'animal',
  word: [tk('Wort'), tk('Wörter')],
  count: [tk('{n} Wort im Zoo'), tk('{n} Wörter im Zoo')],
  // the zoo draws its own pictures; this is only there for the bare habitat engine
  makeSprite: animalSprite,
  bounds: (W) => ({ x0: 300, x1: W - 60, y0: 760, y1: 1010 }),
  paint: paintWoerterZoo,

  init(s) {
    const r = mulberry32(7);
    s.amb.clouds = Array.from({ length: 5 }, (): Cloud => ({ x: r() * s.W, y: 40 + r() * 300, s: 0.5 + r() * 0.5, v: 5 + r() * 9 }));
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 200) c.x = -200;
    }
  },

  renderBack(s, ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const c of s.amb.clouds as Cloud[])
      for (const [ox, oy, rr] of [
        [0, 0, 40],
        [38, -18, 50],
        [82, 0, 38],
        [40, 12, 42],
      ]) {
        ctx.beginPath();
        ctx.arc(c.x + ox * c.s, c.y + oy * c.s, rr * c.s, 0, TAU);
        ctx.fill();
      }
    ctx.restore();
  },

  behave() {},

  tile(ctx, _W, H) {
    // the gate and the first pens close up, three pictures with their name signs
    const s = H / 520;
    ctx.save();
    ctx.scale(s, s);
    ctx.translate(-10, -560);
    paintWoerterZoo(ctx, 1440, 1080);
    const show: [string, number, number, number, Tier][] = [
      ['Hund', 380, 832, 0.5, 'prachtvoll'],
      ['Ente', 600, 832, 0.4, 'schoen'],
      ['Banane', 480, 1026, 0.46, 'nett'],
    ];
    for (const [word, x, y, k, tier] of show) {
      shadow(ctx, x, y, k);
      ctx.save();
      ctx.translate(x, y - (PICTO_SIZE / 2) * k);
      ctx.scale(k, k);
      pictoOf(word).draw(ctx, 9, true);
      ctx.restore();
      if (tier === 'prachtvoll') for (const [dx, dy] of [[-0.45, -0.8], [0.5, -0.95], [0.4, -0.2]]) sparkleStar(ctx, x + dx * PICTO_SIZE * k, y + dy * PICTO_SIZE * k, 12);
      const tag = makeTag([], word, tier);
      const th = 40;
      ctx.drawImage(tag as CanvasImageSource, x - (tag.width * th) / tag.height / 2, y + 4, (tag.width * th) / tag.height, th);
    }
    ctx.restore();
  },
};

function shadow(ctx: Ctx, x: number, y: number, k: number): void {
  ctx.fillStyle = 'rgba(40,70,30,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y, 110 * k, 22 * k, 0, 0, TAU);
  ctx.fill();
}

// ------------------------------------------------------------------------------------------- name signs

interface Letter {
  glyph: ScannedGlyph;
  sticker: AnyCanvas;
}

const TAG_H = 72;
const TAG_TOP = 30;

/**
 * The name sign of a zoo entry: the word as the child wrote it (its letters), on a sign that shows how
 * nicely it was written (crumpled paper with a plaster … gold with a crown)
 */
export function makeTag(letters: Letter[], word: string, tier: Tier): AnyCanvas {
  const pad = 22;
  let rects: Rect[] = [];
  let inner = 0;
  if (letters.length) {
    // the same placing as on the writing line, a bit smaller
    const L = { x: 0, y: -14, w: 4000, h: FIELD_H };
    rects = fieldLayout(letters.map((l) => ({ box: l.glyph.box, score: l.glyph.score })), L);
    const x0 = Math.min(...rects.map((r) => r.x));
    const x1 = Math.max(...rects.map((r) => r.x + r.w));
    const k = 0.62;
    rects = rects.map((r) => ({ x: (r.x - x0) * k, y: (r.y + 14) * k + 6, w: r.w * k, h: r.h * k }));
    inner = (x1 - x0) * k;
  }
  const { ctx: m } = makeCanvas(4, 4);
  m.font = `600 44px Hand, ${FONT}`;
  if (!letters.length) inner = m.measureText(word).width;
  const w = Math.ceil(inner + pad * 2);
  const { canvas, ctx } = makeCanvas(w + 8, TAG_H + TAG_TOP + 8);
  ctx.translate(4, TAG_TOP);
  const tilt = tier === 'schief' ? -0.06 : tier === 'zerknittert' ? 0.04 : 0;
  ctx.translate(w / 2, TAG_H / 2);
  ctx.rotate(tilt);
  ctx.translate(-w / 2, -TAG_H / 2);
  const look: Record<Tier, [string, string]> = {
    zerknittert: ['#ece6d8', '#9a9184'],
    schief: ['#f5e2bd', '#9c7a4a'],
    nett: ['#f8dca4', '#9c6b34'],
    schoen: ['#fff1b8', '#d39a00'],
    prachtvoll: ['#ffe066', '#b07800'],
  };
  const [fill, edge] = look[tier];
  if (tier === 'prachtvoll') {
    const g = ctx.createLinearGradient(0, 0, 0, TAG_H);
    g.addColorStop(0, '#fff6b0');
    g.addColorStop(1, '#ffc93a');
    ctx.fillStyle = g;
  } else ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = tier === 'schoen' || tier === 'prachtvoll' ? 5 : 3.5;
  ctx.beginPath();
  if (tier === 'zerknittert') {
    // crumpled paper: a wobbly edge
    const pts = 14;
    for (let i = 0; i <= pts; i++) ctx.lineTo((i / pts) * w, (i % 2 ? 3 : -2));
    for (let i = 0; i <= 4; i++) ctx.lineTo(w + (i % 2 ? -3 : 2), (i / 4) * TAG_H);
    for (let i = pts; i >= 0; i--) ctx.lineTo((i / pts) * w, TAG_H + (i % 2 ? -3 : 2));
    for (let i = 4; i >= 0; i--) ctx.lineTo(i % 2 ? 3 : -2, (i / 4) * TAG_H);
  } else ctx.roundRect(0, 0, w, TAG_H, 14);
  ctx.fill();
  ctx.stroke();
  if (tier === 'zerknittert') {
    ctx.strokeStyle = 'rgba(120,110,95,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.2, 4);
    ctx.lineTo(w * 0.35, TAG_H - 6);
    ctx.moveTo(w * 0.7, 6);
    ctx.lineTo(w * 0.58, TAG_H - 4);
    ctx.stroke();
  }
  if (letters.length)
    letters.forEach((l, i) => {
      const r = rects[i];
      ctx.drawImage(l.sticker as CanvasImageSource, pad + r.x, r.y, r.w, r.h);
    });
  else {
    ctx.fillStyle = '#23236b';
    ctx.font = `600 44px Hand, ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(word, pad, TAG_H / 2 + 2);
  }
  if (tier === 'zerknittert') bandaid(ctx, w - 14, 12, 34, 0.6);
  if (tier === 'schoen') sparkleStar(ctx, w - 6, 4, 9, '#fff3a0');
  if (tier === 'prachtvoll') {
    sparkleStar(ctx, 4, TAG_H - 2, 9, '#ffffff');
    sparkleStar(ctx, w - 4, 6, 11, '#ffffff');
    crown(ctx, w / 2, 2, 40, 0);
  }
  return canvas;
}

// ------------------------------------------------------------------------------------------- the scene

export interface ZooEntry {
  word: ZooWord;
  picto: Picto;
  /** how nicely the word was written: the mean of its letters */
  score: number;
  tier: Tier;
  letters: Letter[];
  tag: AnyCanvas;
  x: number;
  y: number;
  /** its place and size in the zoo */
  hx: number;
  hy: number;
  k: number;
  range: number;
  facing: 1 | -1;
  /** seconds since its picture came alive (the funny animation plays again when it is tapped) */
  live: number;
  state: 'arrive' | 'idle' | 'walk';
  stateT: number;
  dur: number;
  tx: number;
  /** a thing wobbles now and then; everybody jumps when tapped */
  wobble: number;
  jump: number;
  /** what it says when tapped, shown for a moment */
  bubble: number;
}

export type Feedback =
  | { kind: 'fast'; reason: 'gross' | 'buchstabe' | 'laut'; written: string; at: number; t: number }
  | { kind: 'daneben'; written: string; t: number };

type Phase = 'enter' | 'ask' | 'alive' | 'walk';

interface FieldLetter extends Letter {
  rect: Rect;
  landed: boolean;
}

export interface WoerterSave {
  zoo: { word: string; score: number; letters: SavedGlyph[] }[];
  seen: string[];
  current: string | null;
  tries: number;
}

export class WoerterZooScene extends HabitatScene {
  protected letters = false;
  /** the word of the picture shown */
  word: ZooWord;
  phase: Phase = 'enter';
  phaseT = 0;
  /** seconds the current word has been asked */
  askT = 0;
  /** "Fast" so far for this word */
  tries = 0;
  zoo: ZooEntry[] = [];
  /** the words that were there, oldest first */
  seen: string[] = [];
  feedback: Feedback | null = null;
  /** the written letters on the writing line */
  field: FieldLetter[] = [];
  /** the word that was just written right: it is alive on the card, then walks into the zoo */
  done: { entry: ZooEntry; counted: boolean } | null = null;
  /** the word stands there again until askT reaches this (help 2 and 3) */
  private revealUntil = 0;
  /** help 3: the first letter was asked for */
  private firstShown = false;
  private flying = 0;
  private verdict: { v: Verdict; written: string; letters: Letter[] } | null = null;
  private wiggle = 0;
  private rand: () => number;
  private talker: ZooEntry | null = null;

  constructor(host: SceneHost, worldW: number, seed = Date.now()) {
    super(woerterzoo, host, worldW);
    this.rand = mulberry32(seed);
    this.word = this.pick();
    this.seen.push(this.word.word);
  }

  // ----------------------------------------------------------------------------------------- state

  get help(): WordHelp {
    return this.host.settings.woerter?.help ?? 1;
  }

  /** the letters the class knows; when none of the words fits, all of them */
  private get known(): Set<string> {
    const k = new Set(this.host.settings.woerter?.known ?? WORD_LETTERS);
    return WORDS.some((w) => usable(w, k)) ? k : ALL;
  }

  private pick(): ZooWord {
    return nextWord(this.known, this.seen, this.rand) ?? WORDS[0];
  }

  /** help 2: the word is covered (it was there for 5 seconds; tapping uncovers it) */
  get covered(): boolean {
    return this.help === 2 && this.phase === 'ask' && this.askT >= MEMO && this.askT >= this.revealUntil;
  }

  /** what the caption of the card shows right now */
  get caption(): string {
    const w = this.word.word;
    if (this.phase === 'alive' || this.phase === 'walk' || this.help === 1) return w;
    if (this.help === 2) return this.covered ? '' : w;
    if (this.askT < this.revealUntil) return w;
    return this.firstShown ? w[0] + ' _'.repeat(w.length - 1) : '';
  }

  /** "Ba – na – ne" */
  get syllables(): string {
    return this.word.syllables.join(' – ');
  }

  private get card(): Rect {
    return { x: this.W / 2 - CARD_W / 2, y: CARD_Y, w: CARD_W, h: CARD_H };
  }

  private get fieldRect(): Rect {
    const w = clamp(this.word.word.length * 100 + 140, 560, this.W - 80);
    return { x: this.W / 2 - w / 2, y: FIELD_Y, w, h: FIELD_H };
  }

  /** the side panels (feedback on the right, the quality on the left) */
  private get rightPanel(): Rect {
    const x = this.W / 2 + CARD_W / 2 + 28;
    return { x, y: 196, w: Math.min(560, this.W - x - 24), h: 330 };
  }

  private get leftPanel(): Rect {
    const r = this.W / 2 - CARD_W / 2 - 28;
    const w = Math.min(460, r - 24);
    return { x: r - w, y: 196, w, h: 300 };
  }

  private buttons() {
    const c = this.card;
    return { listen: { x: c.x + 54, y: c.y + CAP_DY, r: 34 }, first: { x: c.x + c.w - 54, y: c.y + CAP_DY, r: 34 } };
  }

  // ----------------------------------------------------------------------------------------- letters

  handleScan(res: ScanResult, snap: Snapshot): void {
    const stickers = new Map<number, AnyCanvas>();
    for (const g of res.glyphs) stickers.set(g.id, canvasFromRGBA(g.crop));
    const fresh = res.glyphs.filter((g) => g.isNew && !g.score.rejected);
    const asking = this.phase === 'ask' || this.phase === 'enter';
    // the word: the longest group of new letters standing next to each other in one line
    const tokens = fresh.map((g, i) => ({ box: g.box, score: { ...g.score, char: String.fromCharCode(0xe000 + i) } }));
    const group = asking ? [...readWord(tokens)].map((c) => fresh[c.charCodeAt(0) - 0xe000]) : [];
    const written = group.map((g) => g.score.char).join('');
    const letters = group.map((g) => ({ glyph: g, sticker: stickers.get(g.id)! }));
    if (asking && group.length) {
      this.feedback = null;
      const rects = fieldLayout(group, this.fieldRect);
      this.field = letters.map((l, i) => ({ ...l, rect: rects[i], landed: false }));
      this.flying = group.length;
      this.verdict = { v: judge(this.word.word, written, this.host.settings.woerter?.spelling ?? 'streng'), written, letters };
    }
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => {
        const f = this.field.find((x) => x.glyph === g);
        return f && !f.landed && group.includes(g) ? { x: f.rect.x + f.rect.w / 2, y: f.rect.y + f.rect.h / 2 } : null;
      },
      (g) => this.landed(g),
    );
    if (res.newSheet) this.host.toast(t('Neues Blatt erkannt!'), 'info');
    if (!asking && fresh.length) this.host.toast(t('Moment, gleich kommt das nächste Bild!'), 'info');
    else if (!fresh.length) {
      if (res.glyphs.length) this.host.toast(t('Ich habe nichts Neues gefunden. Schreib noch etwas!'), 'info');
      else this.host.toast(t('Ich sehe noch keine Buchstaben. Schreib etwas unter die Kamera!'), 'warn');
    }
  }

  /** a letter arrived on the writing line; with the last one the word is judged */
  private landed(g: ScannedGlyph): void {
    const f = this.field.find((x) => x.glyph === g);
    if (!f || f.landed) return;
    f.landed = true;
    sfx.plopp(0.6);
    this.particles.burst('spark', f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2, 5, { color: '#fff6a8', size: 10, speed: 160, max: 0.6 });
    if (--this.flying <= 0 && this.verdict) {
      const v = this.verdict;
      this.verdict = null;
      this.react(v.v, v.written, v.letters);
    }
  }

  /** the written word was judged */
  react(v: Verdict, written: string, letters: Letter[]): void {
    if (this.phase !== 'ask' && this.phase !== 'enter') return;
    if (v.result === 'richtig') return this.success(letters, false, v.lautgetreu === true);
    if (v.result === 'fast') {
      this.tries++;
      if (this.tries >= MAX_TRIES) return this.success(letters, true);
      this.feedback = { kind: 'fast', reason: v.reason, written, at: v.at, t: 0 };
      sfx.boing();
      if (v.reason === 'gross') speak(t('Fast! Namen von Dingen schreibt man groß.'));
      else if (v.reason === 'laut') speak(t('Gut gehört! Aber so schreibt man es richtig.'));
      else speak(t('Fast! Ein Buchstabe stimmt noch nicht.'));
      return;
    }
    this.feedback = { kind: 'daneben', written, t: 0 };
    sfx.bonk();
    speak(t('Schau nochmal genau hin!'));
    // help 2 and 3: the word comes back for a moment
    if (this.help >= 2) this.revealUntil = this.askT + 3;
  }

  /** the word is in the zoo; `counted`: after three "Fast", `soundTrue`: written as heard ("Hunt"), which counts
   * with the sound-true setting – the right spelling stands big on the card */
  private success(letters: Letter[], counted: boolean, soundTrue = false): void {
    const score = letters.length ? letters.reduce((a, l) => a + l.glyph.score.score, 0) / letters.length : 60;
    const tier = tierOf(score);
    const picto = pictoOf(this.word.word);
    const entry: ZooEntry = {
      word: this.word,
      picto,
      score,
      tier,
      letters,
      tag: makeTag(letters, this.word.word, tier),
      x: this.W / 2,
      y: CARD_Y + PIC_DY,
      hx: 0,
      hy: 0,
      k: 0.4,
      range: 0,
      facing: 1,
      live: 0,
      state: 'arrive',
      stateT: 0,
      dur: 1,
      tx: 0,
      wobble: 0,
      jump: 0,
      bubble: 0,
    };
    this.done = { entry, counted };
    this.feedback = null;
    this.setPhase('alive');
    sfx.fanfare();
    const p = { x: this.W / 2, y: CARD_Y + PIC_DY };
    this.particles.burst('confetti', p.x, p.y, 40, { colors: ['#ff6f91', '#ffd84a', '#7cdcff', '#8dff6b'], size: 13, speed: 420, max: 1.6, gravity: 420 });
    if (tier === 'prachtvoll') this.particles.add({ kind: 'ring', x: p.x, y: p.y, size: 380, max: 0.6, color: 'rgba(255,240,160,0.95)' });
    if (soundTrue) speak(t('Gut gehört – das zählt! So schreibt man es richtig.'), t(this.word.say));
    else if (counted) speak(t('Fast richtig – das zählt auch!'), t(this.word.say));
    else speak(t('Richtig!'), t(this.word.say));
    this.host.progress();
  }

  private setPhase(p: Phase): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** the next picture comes */
  private nextPicture(): void {
    this.word = this.pick();
    this.seen.push(this.word.word);
    this.tries = 0;
    this.askT = 0;
    this.revealUntil = 0;
    this.firstShown = false;
    this.feedback = null;
    this.field = [];
    this.setPhase('enter');
    sfx.sparkle();
  }

  /** the card is up: the question, in help 2 the reminder, in help 3 the syllables */
  private ask(): void {
    const ask = t('Was ist das? Schreib es auf!');
    if (this.help === 2) speak(ask, t('Schau – merk dir’s – schreib!'));
    else if (this.help === 3) speak(ask, this.syllables);
    else speak(ask);
  }

  // ----------------------------------------------------------------------------------------- time

  update(dt: number): void {
    super.update(dt);
    this.phaseT += dt;
    this.wiggle = Math.max(0, this.wiggle - dt * 2.5);
    if (this.feedback) this.feedback.t += dt;
    if (this.phase === 'enter' && this.phaseT >= ENTER) {
      this.setPhase('ask');
      this.ask();
    }
    if (this.phase === 'ask') this.askT += dt;
    const d = this.done;
    if (d) {
      d.entry.live += dt;
      if (this.phase === 'alive') {
        // a wave through the written letters, sparkles on a splendid word
        if (d.entry.tier === 'prachtvoll' && Math.random() < dt * 8) {
          const a = Math.random() * TAU;
          this.particles.add({ kind: 'spark', x: this.W / 2 + Math.cos(a) * 190, y: CARD_Y + PIC_DY + Math.sin(a) * 170, size: 10 + Math.random() * 8, max: 0.8, color: '#fff7b8' });
        }
        if (this.phaseT >= this.aliveTime()) this.setPhase('walk');
      } else if (this.phase === 'walk' && this.phaseT >= WALK) {
        this.enterZoo(d.entry);
        this.done = null;
        this.nextPicture();
      }
    }
    for (const e of this.zoo) {
      this.move(e, dt);
      if (e.tier === 'prachtvoll' && Math.random() < dt * 0.8) {
        const r = (PICTO_SIZE / 2) * e.k;
        this.particles.add({ kind: 'spark', x: e.x + (Math.random() - 0.5) * r * 2, y: e.y - r + (Math.random() - 0.5) * r * 2, size: 8 + Math.random() * 6, max: 0.8, color: '#fff7b8' });
      }
    }
    if (this.talker && (this.talker.bubble -= dt) <= 0) this.talker = null;
  }

  /** the picture is alive this long: its funny animation, then a moment to look */
  private aliveTime(): number {
    return Math.max(4.2, (this.done?.entry.picto.anim ?? 2) + 1.6);
  }

  private enterZoo(e: ZooEntry): void {
    this.zoo.push(e);
    e.x = GATE_X;
    e.y = PATH_Y + 6;
    e.state = 'arrive';
    e.stateT = 0;
    this.layoutZoo();
    this.particles.burst('puff', e.x, e.y, 8, { color: 'rgba(255,255,255,0.85)', size: 24, speed: 140, max: 0.6 });
    sfx.plopp();
    this.host.progress();
  }

  /** every entry gets its place; with many they stand closer and smaller */
  private layoutZoo(): void {
    const slots = zooSlots(this.zoo.length, this.W);
    this.zoo.forEach((e, i) => {
      const s = slots[i];
      const moved = Math.hypot(e.hx - s.x, e.hy - s.y) > 4;
      e.hx = s.x;
      e.hy = s.y;
      e.k = s.k;
      e.range = Math.min(160, s.gap * 0.42);
      if (moved && e.state !== 'arrive') {
        e.state = 'arrive';
        e.stateT = 0;
      }
    });
  }

  resize(worldW: number): void {
    super.resize(worldW);
    // also called from the base constructor, before the zoo exists
    if (!this.zoo) return;
    this.layoutZoo();
    for (const e of this.zoo) {
      e.x = clamp(e.x, 0, worldW);
    }
  }

  private move(e: ZooEntry, dt: number): void {
    e.live += dt;
    e.stateT += dt;
    e.wobble = Math.max(0, e.wobble - dt);
    e.jump = Math.max(0, e.jump - dt);
    if (e.state === 'arrive') {
      // along the path from the gate, then up or down to its place
      const dx = e.hx - e.x;
      const dy = e.hy - e.y;
      const d = Math.hypot(dx, dy);
      const sp = 240;
      if (d < 4) {
        e.x = e.hx;
        e.y = e.hy;
        e.state = 'idle';
        e.stateT = 0;
        e.dur = 1 + this.rand() * 3;
        return;
      }
      const onPath = Math.abs(dx) > 40 && Math.abs(e.y - PATH_Y) < 60;
      const vx = onPath ? Math.sign(dx) : dx / d;
      const vy = onPath ? (PATH_Y - e.y) * 0.05 : dy / d;
      e.x += vx * Math.min(sp * dt, Math.abs(dx) + 1);
      e.y += clamp(vy * sp * dt, -Math.abs(dy), Math.abs(dy));
      if (Math.abs(dx) > 2) e.facing = dx >= 0 ? 1 : -1;
      return;
    }
    if (!e.word.animal) {
      // things stay where they are and wobble now and then
      if (e.stateT > e.dur) {
        e.stateT = 0;
        e.dur = 4 + this.rand() * 6;
        e.wobble = 0.9;
      }
      return;
    }
    if (e.state === 'idle') {
      if (e.stateT > e.dur) {
        e.state = 'walk';
        e.stateT = 0;
        e.tx = e.hx + (this.rand() * 2 - 1) * e.range;
      }
      return;
    }
    const dx = e.tx - e.x;
    const step = Math.min(Math.abs(dx), 46 * dt);
    e.x += Math.sign(dx) * step;
    if (Math.abs(dx) > 1) e.facing = dx >= 0 ? 1 : -1;
    if (Math.abs(dx) <= 1 || e.stateT > 8) {
      e.state = 'idle';
      e.stateT = 0;
      e.dur = 1.5 + this.rand() * 4;
    }
  }

  // ----------------------------------------------------------------------------------------- tapping

  tap(x: number, y: number): boolean {
    if (this.phase === 'ask') {
      const b = this.buttons();
      if (this.help === 3 && Math.hypot(x - b.listen.x, y - b.listen.y) < b.listen.r + 8) {
        sfx.click();
        speak(this.syllables);
        return true;
      }
      if (this.help === 3 && Math.hypot(x - b.first.x, y - b.first.y) < b.first.r + 8) {
        sfx.click();
        this.firstShown = true;
        return true;
      }
      const c = this.card;
      if (this.help === 2 && x >= c.x && x <= c.x + c.w && y >= c.y + CAP_DY - 50 && y <= c.y + CAP_DY + 50) {
        sfx.click();
        this.revealUntil = this.askT + MEMO;
        return true;
      }
    }
    const c = this.card;
    if ((this.phase === 'ask' || this.phase === 'alive') && x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + CAP_DY - 50) {
      sfx.boing();
      this.wiggle = 1;
      if (this.help === 3 && this.phase === 'ask') speak(this.syllables);
      return true;
    }
    for (const e of [...this.zoo].sort((a, b) => b.y - a.y)) {
      const r = (PICTO_SIZE / 2) * e.k;
      if (Math.hypot(x - e.x, y - (e.y - r)) < r * 1.1) {
        sfx.boing();
        e.jump = 0.6;
        e.live = 0;
        e.bubble = 3.5;
        this.talker = e;
        speak(t(e.word.say));
        this.particles.burst('heart', e.x, e.y - r * 2, 5, { color: '#ff6fa3', size: 20, speed: 110, max: 1, gravity: -80 });
        return true;
      }
    }
    return false;
  }

  // ----------------------------------------------------------------------------------------- drawing

  render(ctx: CanvasRenderingContext2D): void {
    if (this.bg) ctx.drawImage(this.bg as CanvasImageSource, 0, 0);
    this.def.renderBack?.(this, ctx);
    for (const e of [...this.zoo].sort((a, b) => a.y - b.y)) this.drawEntry(ctx, e);
    this.drawCard(ctx);
    this.drawField(ctx);
    this.drawFeedback(ctx);
    this.drawQuality(ctx);
    this.drawSay(ctx);
    this.drawWalker(ctx);
    if (this.talker) this.drawTalk(ctx, this.talker);
    this.particles.render(ctx);
    this.fx.render(ctx);
  }

  private drawEntry(ctx: CanvasRenderingContext2D, e: ZooEntry): void {
    const k = e.k;
    const walking = e.state !== 'idle' && e.word.animal;
    const bob = walking ? Math.abs(Math.sin(e.live * 8)) * 6 * (k / 0.4) : 0;
    const hop = e.jump > 0 ? Math.sin((1 - e.jump / 0.6) * Math.PI) * 50 * (k / 0.4) : e.state === 'arrive' && !e.word.animal ? Math.abs(Math.sin(e.stateT * 7)) * 16 : 0;
    const rot = e.wobble > 0 ? Math.sin(e.wobble * 24) * 0.12 * e.wobble : walking ? Math.sin(e.live * 8) * 0.04 : 0;
    shadow(ctx, e.x, e.y, k);
    ctx.save();
    ctx.translate(e.x, e.y - bob - hop);
    ctx.rotate(rot);
    ctx.translate(0, -(PICTO_SIZE / 2) * k);
    ctx.scale(k * (e.word.animal ? e.facing : 1), k);
    e.picto.draw(ctx, e.live, true);
    ctx.restore();
    // the name sign at its feet
    const th = 44 * (k / 0.4) + 6;
    const tw = (e.tag.width * th) / e.tag.height;
    ctx.drawImage(e.tag as CanvasImageSource, e.x - tw / 2, e.y - th * 0.18, tw, th);
  }

  private drawCard(ctx: CanvasRenderingContext2D): void {
    const c = this.card;
    let s = 1;
    let alpha = 1;
    if (this.phase === 'enter') s = ease.outBack(clamp(this.phaseT / ENTER));
    if (this.phase === 'walk') {
      alpha = clamp(1 - this.phaseT / 0.5);
      s = 1 - 0.1 * clamp(this.phaseT / 0.5);
    }
    if (alpha <= 0 || s <= 0) return;
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.rotate(Math.sin(this.wiggle * 18) * 0.03 * this.wiggle);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = 'rgba(40,30,80,0.18)';
    ctx.beginPath();
    ctx.roundRect(c.x + 8, c.y + 12, c.w, c.h, 36);
    ctx.fill();
    const alive = this.phase === 'alive' && this.done;
    ctx.fillStyle = '#fffdf6';
    ctx.strokeStyle = alive ? '#f0b400' : '#7c5cff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(c.x, c.y, c.w, c.h, 36);
    ctx.fill();
    ctx.stroke();
    // a soft glow behind the picture
    const px = cx;
    const py = c.y + PIC_DY;
    const glow = ctx.createRadialGradient(px, py, 20, px, py, 200);
    glow.addColorStop(0, alive ? 'rgba(255,236,140,0.75)' : 'rgba(200,230,255,0.7)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(c.x + 10, c.y + 10, c.w - 20, CAP_DY - 60);
    if (this.phase !== 'walk') {
      ctx.save();
      ctx.translate(px, py);
      ctx.scale(PIC_S, PIC_S);
      if (alive) this.done!.entry.picto.draw(ctx, this.done!.entry.live, true);
      else pictoOf(this.word.word).draw(ctx, this.t, false);
      ctx.restore();
      if (alive && this.done!.entry.tier === 'prachtvoll') {
        const lift = ease.outBack(clamp(this.phaseT / 0.6));
        crown(ctx, c.x + 62, c.y + 92, 96 * lift, -0.35);
      }
    }
    this.drawCaption(ctx, c);
    ctx.restore();
  }

  private drawCaption(ctx: CanvasRenderingContext2D, c: Rect): void {
    const y = c.y + CAP_DY;
    const cx = c.x + c.w / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // a thin line to write on, like in the exercise book
    ctx.strokeStyle = 'rgba(124,92,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x + 30, y + 28);
    ctx.lineTo(c.x + c.w - 30, y + 28);
    ctx.stroke();
    const text = this.caption;
    const school = this.host.settings.script === 'grund' ? 'Grundschrift, Druckvorlage' : 'Druckvorlage, Grundschrift';
    if (this.covered) {
      // help 2: a cloth over the word
      const w = c.w - 120;
      ctx.fillStyle = '#7c5cff';
      ctx.strokeStyle = '#4a33b0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, y - 44, w, 88, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.arc(cx - w / 2 + 30 + i * ((w - 60) / 5), y - 44, 12, 0, Math.PI);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      ctx.font = `700 34px ${FONT}`;
      ctx.fillText(t('Merkwort'), cx, y - 14, w - 30);
      ctx.font = `600 22px ${FONT}`;
      ctx.fillText(t('Antippen zum Nachschauen'), cx, y + 22, w - 30);
    } else if (text) {
      const done = this.phase === 'alive' || this.phase === 'walk';
      ctx.fillStyle = done ? '#2f9e44' : INK;
      let size = 76;
      ctx.font = `${size}px ${school}, ${FONT}`;
      const maxW = this.help === 3 && !done ? c.w - 210 : c.w - 50;
      while (size > 40 && ctx.measureText(text).width > maxW) {
        size -= 4;
        ctx.font = `${size}px ${school}, ${FONT}`;
      }
      ctx.fillText(text, cx, y);
      // help 2: the reminder while the word stands there
      if (this.help === 2 && this.phase === 'ask' && this.askT < MEMO) {
        const left = clamp(1 - this.askT / MEMO);
        ctx.fillStyle = 'rgba(124,92,255,0.25)';
        ctx.fillRect(c.x + 40, y + 36, (c.w - 80), 8);
        ctx.fillStyle = '#7c5cff';
        ctx.fillRect(c.x + 40, y + 36, (c.w - 80) * left, 8);
      }
    }
    if (this.help === 3 && this.phase === 'ask') this.drawHelpButtons(ctx, text);
    ctx.restore();
  }

  /** help 3: listen again (left) and the first letter (right) */
  private drawHelpButtons(ctx: CanvasRenderingContext2D, text: string): void {
    const b = this.buttons();
    const pulse = 1 + Math.sin(this.t * 3) * 0.04;
    for (const [btn, kind] of [
      [b.listen, 'listen'],
      [b.first, 'first'],
    ] as const) {
      ctx.save();
      ctx.translate(btn.x, btn.y);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = kind === 'listen' ? '#4fb3ff' : '#ffb84a';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, btn.r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#ffffff';
      if (kind === 'listen') {
        // a loudspeaker with sound waves
        ctx.beginPath();
        ctx.moveTo(-16, -7);
        ctx.lineTo(-8, -7);
        ctx.lineTo(2, -16);
        ctx.lineTo(2, 16);
        ctx.lineTo(-8, 7);
        ctx.lineTo(-16, 7);
        ctx.closePath();
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        for (const r of [9, 17]) {
          ctx.beginPath();
          ctx.arc(2, 0, r, -0.8, 0.8);
          ctx.stroke();
        }
      } else {
        ctx.font = `700 34px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.firstShown ? this.word.word[0] : 'A?', 0, 2, btn.r * 1.7);
      }
      ctx.restore();
    }
    if (!text) {
      // nothing written there: an ear to listen
      ctx.fillStyle = 'rgba(59,42,92,0.45)';
      ctx.font = `600 28px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('Hör gut zu!'), this.W / 2, b.listen.y, CARD_W - 190);
    }
  }

  private drawField(ctx: CanvasRenderingContext2D): void {
    if (this.phase === 'walk' && this.phaseT > 0.4) return;
    const F = this.fieldRect;
    const L = lines(F);
    const alpha = this.phase === 'walk' ? clamp(1 - this.phaseT / 0.4) : this.phase === 'enter' ? clamp(this.phaseT / ENTER) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = this.feedback?.kind === 'fast' ? '#ff9f1a' : this.feedback ? '#e5484d' : this.done ? '#2f9e44' : '#7c5cff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(F.x, F.y, F.w, F.h, 24);
    ctx.fill();
    ctx.stroke();
    // school lines: the middle band a little coloured, the base line red
    ctx.fillStyle = 'rgba(124,200,255,0.16)';
    ctx.fillRect(F.x + 18, L.mid, F.w - 36, L.base - L.mid);
    for (const [y, col] of [
      [L.top, 'rgba(80,120,200,0.45)'],
      [L.mid, 'rgba(80,120,200,0.35)'],
      [L.base, 'rgba(229,72,77,0.7)'],
      [L.low, 'rgba(80,120,200,0.45)'],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(F.x + 18, y);
      ctx.lineTo(F.x + F.w - 18, y);
      ctx.stroke();
    }
    if (!this.field.length) {
      ctx.fillStyle = 'rgba(59,42,92,0.35)';
      ctx.font = `600 30px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('Hier landet dein Wort'), F.x + F.w / 2, (L.mid + L.base) / 2, F.w - 60);
    }
    const fb = this.feedback;
    this.field.forEach((f, i) => {
      if (!f.landed) return;
      const r = f.rect;
      const wave = this.phase === 'alive' ? Math.max(0, Math.sin(this.phaseT * 6 - i * 0.6)) * 12 : 0;
      ctx.drawImage(f.sticker as CanvasImageSource, r.x, r.y - wave, r.w, r.h);
      if (fb?.kind === 'fast' && fb.at === i) this.mark(ctx, r);
    });
    // a missing letter at the end: the mark stands behind the last one
    if (fb?.kind === 'fast' && fb.at >= this.field.length && this.field.length) {
      const last = this.field[this.field.length - 1].rect;
      this.mark(ctx, { x: last.x + last.w + 10, y: L.mid, w: 30, h: L.base - L.mid });
    }
    ctx.restore();
  }

  /** a red ring around the place that is not right yet */
  private mark(ctx: CanvasRenderingContext2D, r: Rect): void {
    const pulse = 1 + Math.sin(this.t * 6) * 0.06;
    ctx.save();
    ctx.strokeStyle = '#e5484d';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, (r.w / 2 + 12) * pulse, (r.h / 2 + 10) * pulse, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /** a panel with a coloured border */
  private panel(ctx: CanvasRenderingContext2D, r: Rect, fill: string, edge: string, pop: number): void {
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.scale(pop, pop);
    ctx.translate(-(r.x + r.w / 2), -(r.y + r.h / 2));
    ctx.fillStyle = 'rgba(40,30,80,0.16)';
    ctx.beginPath();
    ctx.roundRect(r.x + 6, r.y + 8, r.w, r.h, 28);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 28);
    ctx.fill();
    ctx.stroke();
  }

  /** "Fast!": the written word, the right one below, the place marked; or "Schau nochmal genau hin!" */
  private drawFeedback(ctx: CanvasRenderingContext2D): void {
    const fb = this.feedback;
    if (!fb || this.phase !== 'ask') return;
    const R = this.rightPanel;
    if (R.w < 260) return;
    const pop = fb.t < 0.3 ? ease.outBack(fb.t / 0.3) : 1;
    ctx.save();
    ctx.textBaseline = 'middle';
    if (fb.kind === 'daneben') {
      ctx.font = `700 40px ${FONT}`;
      const lines2 = wrap(ctx, t('Schau nochmal genau hin!'), R.w - 40);
      ctx.font = `600 28px ${FONT}`;
      const hint = this.help === 1 ? t('Vergleiche jeden Buchstaben mit dem Wort.') : t('Das Wort ist kurz wieder da.');
      const lines3 = wrap(ctx, hint, R.w - 40);
      const h = 44 + lines2.length * 48 + 14 + lines3.length * 34 + 22;
      this.panel(ctx, { ...R, h }, '#fff0f2', '#e5484d', pop);
      ctx.fillStyle = INK;
      ctx.textAlign = 'center';
      ctx.font = `700 40px ${FONT}`;
      lines2.forEach((l, i) => ctx.fillText(l, R.x + R.w / 2, R.y + 50 + i * 48));
      ctx.font = `600 28px ${FONT}`;
      ctx.fillStyle = 'rgba(59,42,92,0.75)';
      lines3.forEach((l, i) => ctx.fillText(l, R.x + R.w / 2, R.y + 44 + lines2.length * 48 + 14 + i * 34));
      ctx.restore();
      return;
    }
    ctx.font = `600 28px ${FONT}`;
    const msg = fb.reason === 'gross' ? t('Namen von Dingen schreibt man groß.') : fb.reason === 'laut' ? t('So schreibt man es richtig.') : t('Ein Buchstabe stimmt noch nicht.');
    const msgLines = wrap(ctx, msg, R.w - 40);
    const h = 252 + msgLines.length * 32 + 12;
    this.panel(ctx, { ...R, h }, '#fff8e6', '#ff9f1a', pop);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e07b00';
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText(fb.reason === 'laut' ? t('Gut gehört!') : t('Fast!'), R.x + 26, R.y + 44);
    // tries: one dot for each "Fast"
    for (let i = 0; i < MAX_TRIES; i++) {
      ctx.fillStyle = i < this.tries ? '#ff9f1a' : 'rgba(255,159,26,0.25)';
      ctx.beginPath();
      ctx.arc(R.x + R.w - 30 - (MAX_TRIES - 1 - i) * 26, R.y + 44, 9, 0, TAU);
      ctx.fill();
    }
    const target = this.word.word;
    const size = clamp(Math.floor((R.w - 60) / Math.max(fb.written.length, target.length, 4) / 0.62), 36, 62);
    const at = fb.at;
    this.markedWord(ctx, fb.written, R.x + R.w / 2, R.y + 112, size, at, '#e5484d', fb.reason === 'buchstabe' && at >= fb.written.length);
    arrowDown(ctx, R.x + R.w / 2, R.y + 160);
    this.markedWord(ctx, target, R.x + R.w / 2, R.y + 206, size, at, '#2f9e44', false);
    ctx.fillStyle = INK;
    ctx.font = `600 28px ${FONT}`;
    ctx.textAlign = 'center';
    msgLines.forEach((l, i) => ctx.fillText(l, R.x + R.w / 2, R.y + 262 + i * 32));
    ctx.restore();
  }

  /** a word with one letter in colour (or a gap at the end), centred */
  private markedWord(ctx: CanvasRenderingContext2D, word: string, cx: number, y: number, size: number, at: number, color: string, gapAtEnd: boolean): void {
    ctx.font = `600 ${size}px ${FONT}`;
    const chars = [...word];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const gapW = gapAtEnd ? size * 0.5 : 0;
    let x = cx - (widths.reduce((a, b) => a + b, 0) + gapW) / 2;
    ctx.textAlign = 'left';
    chars.forEach((c, i) => {
      if (i === at) {
        ctx.fillStyle = color === '#e5484d' ? 'rgba(229,72,77,0.15)' : 'rgba(47,158,68,0.15)';
        ctx.beginPath();
        ctx.roundRect(x - 4, y - size * 0.62, widths[i] + 8, size * 1.2, 10);
        ctx.fill();
        ctx.fillStyle = color;
      } else ctx.fillStyle = INK;
      ctx.fillText(c, x, y);
      if (i === at) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, y + size * 0.5);
        ctx.lineTo(x + widths[i], y + size * 0.5);
        ctx.stroke();
      }
      x += widths[i];
    });
    if (gapAtEnd) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.roundRect(x + 4, y - size * 0.4, gapW - 8, size * 0.8, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** how nicely the word was written: stars and the stage, as in the other worlds */
  private drawQuality(ctx: CanvasRenderingContext2D): void {
    const d = this.done;
    if (!d || (this.phase === 'walk' && this.phaseT > 0.5)) return;
    const R = this.leftPanel;
    if (R.w < 240) return;
    const pop = this.phase === 'alive' ? ease.outBack(clamp((this.phaseT - 0.3) / 0.35)) : 1 - clamp(this.phaseT / 0.5);
    if (pop <= 0) return;
    const tier = d.entry.tier;
    const gold = tier === 'prachtvoll' || tier === 'schoen';
    ctx.save();
    const tag = d.entry.tag;
    const th = 74;
    const tw = Math.min(R.w - 40, (tag.width * th) / tag.height);
    const thh = (tag.height * tw) / tag.width;
    this.panel(ctx, { ...R, h: 226 + thh + 14 }, gold ? '#fffbe6' : '#ffffff', gold ? '#f0b400' : '#7c5cff', pop);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2f9e44';
    ctx.font = `700 42px ${FONT}`;
    ctx.fillText(d.counted ? t('Fast richtig!') : t('Richtig!'), R.x + R.w / 2, R.y + 48, R.w - 30);
    const n = starCount(d.entry.score);
    for (let i = 0; i < 5; i++) star(ctx, R.x + R.w / 2 + (i - 2) * 54, R.y + 112, 22, i < n);
    ctx.fillStyle = INK;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(t('{tier}!', { tier: t(TIER_LABEL[tier]) }), R.x + R.w / 2, R.y + 186, R.w - 30);
    ctx.drawImage(tag as CanvasImageSource, R.x + R.w / 2 - tw / 2, R.y + 214, tw, thh);
    if (tier === 'prachtvoll') crown(ctx, R.x + R.w / 2, R.y - 4, 70, -0.08);
    ctx.restore();
  }

  /** the picture says its sentence */
  private drawSay(ctx: CanvasRenderingContext2D): void {
    const d = this.done;
    if (!d || this.phase !== 'alive' || this.phaseT < 0.5) return;
    const R = this.rightPanel;
    if (R.w < 240) return;
    const pop = ease.outBack(clamp((this.phaseT - 0.5) / 0.3));
    ctx.save();
    ctx.font = `600 34px ${FONT}`;
    const ls = wrap(ctx, t(d.entry.word.say), R.w - 50);
    const h = ls.length * 44 + 40;
    const r = { x: R.x, y: R.y + 30, w: R.w, h };
    this.panel(ctx, r, '#fffbe6', '#f0b400', pop);
    // the tail points at the picture
    ctx.fillStyle = '#fffbe6';
    ctx.strokeStyle = '#f0b400';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(r.x + 2, r.y + h / 2 - 16);
    ctx.lineTo(r.x - 34, r.y + h / 2 + 6);
    ctx.lineTo(r.x + 2, r.y + h / 2 + 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(r.x + 1, r.y + h / 2 - 14, 6, 26);
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ls.forEach((l, i) => ctx.fillText(l, r.x + 26, r.y + 20 + 22 + i * 44));
    ctx.restore();
  }

  /** the picture walks from the card down to the gate of the zoo */
  private drawWalker(ctx: CanvasRenderingContext2D): void {
    const d = this.done;
    if (!d || this.phase !== 'walk') return;
    const u = ease.inOutCubic(clamp(this.phaseT / WALK));
    const k = zooSlots(this.zoo.length + 1, this.W)[this.zoo.length].k;
    const x0 = this.W / 2;
    const y0 = CARD_Y + PIC_DY;
    const x1 = GATE_X;
    const y1 = PATH_Y + 6 - (PICTO_SIZE / 2) * k;
    const x = lerp(x0, x1, u);
    const y = lerp(y0, y1, u) - Math.sin(u * Math.PI) * 120;
    const s = lerp(PIC_S, k, u);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (d.entry.word.animal && x1 < x0 ? -1 : 1), s);
    d.entry.picto.draw(ctx, d.entry.live, true);
    ctx.restore();
    const tag = d.entry.tag;
    const th = lerp(70, 44 * (k / 0.4) + 6, u);
    const tw = (tag.width * th) / tag.height;
    ctx.drawImage(tag as CanvasImageSource, x - tw / 2, y + (PICTO_SIZE / 2) * s - th * 0.18, tw, th);
  }

  /** a tapped zoo entry says its sentence */
  private drawTalk(ctx: CanvasRenderingContext2D, e: ZooEntry): void {
    const a = clamp(e.bubble / 0.4) * clamp((3.5 - e.bubble) / 0.2);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = `600 28px ${FONT}`;
    const text = t(e.word.say);
    const w = Math.min(520, ctx.measureText(text).width + 40);
    const h = 54;
    const top = e.y - PICTO_SIZE * e.k - 20;
    const x = clamp(e.x - w / 2, 10, this.W - w - 10);
    const y = Math.max(10, top - h - 18);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#5b4b8a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 22);
    ctx.moveTo(e.x - 10, y + h);
    ctx.lineTo(e.x, y + h + 16);
    ctx.lineTo(e.x + 10, y + h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2 + 1, w - 24);
    ctx.restore();
  }

  // ----------------------------------------------------------------------------------------- counting and saving

  count(): number {
    return this.zoo.length;
  }

  countText(): string {
    const n = this.count();
    return t(this.def.count[n === 1 ? 0 : 1], { n });
  }

  async saveState(): Promise<SceneSave | null> {
    if (!this.zoo.length) return null;
    const zoo = await Promise.all(this.zoo.map(async (e) => ({ word: e.word.word, score: Math.round(e.score * 10) / 10, letters: await Promise.all(e.letters.map((l) => saveGlyph(l.glyph))) })));
    const state: WoerterSave = { zoo, seen: [...this.seen], current: this.phase === 'ask' || this.phase === 'enter' ? this.word.word : null, tries: this.tries };
    return { state, summary: this.countText() };
  }

  /** the zoo comes back with its words and name signs; the picture asked last is asked again */
  async restoreState(raw: unknown): Promise<void> {
    const s = raw as Partial<WoerterSave>;
    const byWord = new Map(WORDS.map((w) => [w.word, w]));
    this.zoo = [];
    for (const z of s.zoo ?? []) {
      const word = byWord.get(z.word);
      if (!word) continue;
      const letters = await Promise.all((z.letters ?? []).map((g) => loadGlyph(g)));
      const score = Number.isFinite(z.score) ? z.score : 60;
      const tier = tierOf(score);
      this.zoo.push({
        word,
        picto: pictoOf(word.word),
        score,
        tier,
        letters,
        tag: makeTag(letters, word.word, tier),
        x: 0,
        y: 0,
        hx: 0,
        hy: 0,
        k: 0.4,
        range: 0,
        facing: this.rand() < 0.5 ? 1 : -1,
        live: 10 + this.rand() * 5,
        state: 'idle',
        stateT: 0,
        dur: 1 + this.rand() * 3,
        tx: 0,
        wobble: 0,
        jump: 0,
        bubble: 0,
      });
    }
    this.layoutZoo();
    for (const e of this.zoo) {
      e.x = e.hx;
      e.y = e.hy;
      e.tx = e.hx;
      e.state = 'idle';
    }
    this.seen = Array.isArray(s.seen) ? s.seen.filter((w) => byWord.has(w)) : this.zoo.map((e) => e.word.word);
    const cur = s.current ? byWord.get(s.current) : undefined;
    if (cur && usable(cur, this.known)) {
      this.word = cur;
      this.tries = clamp(Math.round(Number(s.tries) || 0), 0, MAX_TRIES - 1);
      if (this.seen[this.seen.length - 1] !== cur.word) this.seen.push(cur.word);
    } else {
      this.word = this.pick();
      this.seen.push(this.word.word);
      this.tries = 0;
    }
    this.feedback = null;
    this.field = [];
    this.done = null;
    this.askT = 0;
    this.setPhase('enter');
  }
}

/** a star of the quality, gold when earned */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.46 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = on ? '#ffc21a' : 'rgba(255,194,26,0.18)';
  ctx.strokeStyle = on ? '#b8860b' : 'rgba(184,134,11,0.4)';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** a thick arrow pointing down: from the written word to the right one */
function arrowDown(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(59,42,92,0.5)';
  ctx.beginPath();
  ctx.moveTo(x - 7, y - 18);
  ctx.lineTo(x + 7, y - 18);
  ctx.lineTo(x + 7, y);
  ctx.lineTo(x + 17, y);
  ctx.lineTo(x, y + 18);
  ctx.lineTo(x - 17, y);
  ctx.lineTo(x - 7, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** breaks a text into lines that fit */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxW) {
      out.push(line);
      line = word;
    } else line = next;
  }
  out.push(line);
  return out;
}

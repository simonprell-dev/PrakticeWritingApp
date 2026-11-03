// What the laptop shows in the film: the practice task, the creatures hatching, and a short animated look
// into every game. All scenes draw in screen coordinates (W × H) with their own time `u` in seconds.
import { alienSprite } from '../game/creatures/alien.ts';
import { bubbleSprite } from '../game/creatures/bubble.ts';
import { fighterSprite } from '../game/creatures/duelFigure.ts';
import { fishSprite } from '../game/creatures/fish.ts';
import { drawGiant } from '../game/creatures/giant.ts';
import { inkGuardSprite } from '../game/creatures/inkGuard.ts';
import { paintedSprite } from '../game/creatures/paintedAnimal.ts';
import { animalSprite } from '../game/creatures/savanna.ts';
import type { Sprite } from '../game/creatures/sprite.ts';
import { drawBeam, drawPortal, drawShootingStar, drawUfo } from '../game/creatures/ufo.ts';
import { cardImage, drawCard, type CardLook } from '../game/paint/cardArt.ts';
import { drawSchoolLines, drawWriting, writeDuration, writtenGlyph } from '../game/strokes.ts';
import { blockWidth, drawBlock } from '../game/tower/towerArt.ts';
import { TAU } from '../game/math.ts';
import { letterSticker } from '../ui/previews.ts';
import { clamp, creature, drawConfetti, drawSprite, drawStars, FONT, genome, H, INK, lerp, outBack, pill, rnd, span, starsOf, text, W } from './kit.ts';

type C = CanvasRenderingContext2D;

// ---------- shared backgrounds ----------

function sea(ctx: C, u: number, bubbles = 14): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8fe3f3');
  g.addColorStop(1, '#1d6fa8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // light rays
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const x = 150 + i * 340 + Math.sin(u * 0.4 + i) * 40;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 90, 0);
    ctx.lineTo(x - 60, H);
    ctx.lineTo(x - 200, H);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = '#f2d9a2';
  ctx.beginPath();
  ctx.moveTo(0, H - 90);
  for (let x = 0; x <= W; x += 80) ctx.lineTo(x, H - 90 + Math.sin(x * 0.01) * 14);
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();
  // seaweed
  for (const [x, hgt, hue] of [
    [110, 220, 130],
    [160, 150, 110],
    [1450, 260, 140],
    [1510, 170, 120],
  ]) {
    ctx.strokeStyle = `hsl(${hue},55%,40%)`;
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, H - 70);
    for (let k = 1; k <= 6; k++) ctx.lineTo(x + Math.sin(u * 1.4 + k * 0.8 + x) * 14 * (k / 6), H - 70 - (hgt * k) / 6);
    ctx.stroke();
  }
  for (let i = 0; i < bubbles; i++) {
    const y = H - (((u * (40 + rnd(i) * 50) + rnd(i + 1) * H) % (H + 60)) - 30);
    const x = rnd(i + 2) * W + Math.sin(u * 2 + i) * 10;
    const b = bubbleSprite(5 + (i % 4) * 4, i * 30);
    ctx.drawImage(b as CanvasImageSource, x, y, b.width * 1.6, b.height * 1.6);
  }
}

// ---------- the practice task (before the photo) ----------

const B = () => writtenGlyph('B', true)!;

/** the task as the app shows it: "Schreibe 3× das B", the animated template and a tip */
export function drawTask(ctx: C, u: number, done = 0): void {
  sea(ctx, u, 10);
  // header with progress
  pill(ctx, 470, 40, 660, 110, 55, 'rgba(255,255,255,0.92)', INK, 5);
  text(ctx, 'Schreibe 3× das', 760, 96, 52);
  text(ctx, 'B', 1000, 92, 74, '#5b3bd6', 'center', 400, "'Grundschrift', 'Druckvorlage', cursive");
  // the template card
  pill(ctx, 130, 220, 720, 560, 40, '#fffdf7', INK, 5);
  const unit = 150;
  const oy = 300;
  drawSchoolLines(ctx, 180, 800, oy, unit, 4);
  const g = B();
  const dur = writeDuration(g) + 1.4;
  drawWriting(ctx, g, 410, oy, (u % dur) * 1, { unit, ink: '#5b3bd6', ghost: true, guides: true, pen: 0.14 });
  text(ctx, 'Tippen = nochmal zeigen', 490, 740, 30, '#8a7fb0', 'center', 500);
  // the tip creature with a speech bubble
  const fish = creature('tipfish', (s) => fishSprite(genome(96, 5, 'fish'), s), 'B');
  drawSprite(ctx, fish, 1180 + Math.sin(u * 1.3) * 20, 560 + Math.sin(u * 2) * 12, 110, -1, Math.sin(u * 7) * 0.35);
  pill(ctx, 960, 250, 520, 150, 36, '#fff', INK, 5);
  ctx.beginPath();
  ctx.moveTo(1150, 395);
  ctx.lineTo(1190, 450);
  ctx.lineTo(1210, 395);
  ctx.fillStyle = '#fff';
  ctx.fill();
  text(ctx, 'Bäuche schön', 1220, 300, 44);
  text(ctx, 'zumachen!', 1220, 352, 44);
  // the done button
  pill(ctx, 1230, 770, 300, 90, 45, '#7c5cff', INK, 5);
  text(ctx, '📷 Fertig!', 1380, 816, 44, '#fff');
  progress(ctx, done);
}

/** three dots under the header, filled for every letter done */
function progress(ctx: C, done: number): void {
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(740 + i * 60, 180, 18, 0, TAU);
    ctx.fillStyle = i < done ? '#ffd34d' : 'rgba(255,255,255,0.7)';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

// ---------- the child's three B (the same in the polaroid and on paper) ----------

/** how the child writes the three letters: offset, tilt, size, pen speed */
export const KID_B = [
  { dx: 0, rot: -0.03, s: 1, score: 96 },
  { dx: 1.75, rot: 0.06, s: 0.95, score: 78 },
  { dx: 3.5, rot: -0.1, s: 1.06, score: 52 },
];

/** draws the child's letters, each written up to its time in `times`; returns the pen (caller's coordinates) */
export function drawKidLetters(ctx: C, x: number, oy: number, unit: number, times: number[]): { x: number; y: number } | null {
  const base = ctx.getTransform().inverse();
  let pen: { x: number; y: number } | null = null;
  KID_B.forEach((b, i) => {
    const t = times[i];
    if (t <= 0) return;
    ctx.save();
    const ox = x + b.dx * unit;
    ctx.translate(ox, oy + unit);
    ctx.rotate(b.rot);
    ctx.scale(b.s, b.s);
    const p = drawWriting(ctx, B(), 0, -unit, t, { unit, ink: '#2b4fd0', pen: 0.13 });
    if (p) {
      const q = base.multiply(ctx.getTransform()).transformPoint(new DOMPoint(p.x, p.y));
      pen = { x: q.x, y: q.y };
    }
    ctx.restore();
  });
  return pen;
}
export const kidWriteDuration = () => writeDuration(B());

// ---------- after the photo: polaroid, hatching, celebration ----------

const HATCH = [
  { x: 470, y: 520 },
  { x: 800, y: 470 },
  { x: 1130, y: 540 },
];

function bFish(i: number): Sprite {
  const b = KID_B[i];
  return creature(`bfish${i}`, (s) => fishSprite(genome(b.score, 11 + i * 7, 'fish'), s), 'B');
}

/** the three B fish swim around (u = seconds since they hatched) */
function swimB(ctx: C, u: number, from: number): void {
  for (let i = 0; i < 3; i++) {
    const h = HATCH[i];
    const k = span(u, from, from + 3);
    const cx = lerp(h.x, 300 + i * 500, k);
    const cy = lerp(h.y, 300 + i * 150, k);
    const x = cx + Math.sin(u * 0.6 + i * 2) * 140 * k;
    const y = cy + Math.sin(u * 1.1 + i) * 40;
    const vx = Math.cos(u * 0.6 + i * 2) * k;
    drawSprite(ctx, bFish(i), x, y, 95 - i * 8, vx < -0.05 ? -1 : 1, Math.sin(u * 7 + i) * 0.35);
  }
}

/** after the space bar: u = seconds since the photo */
export function drawResult(ctx: C, u: number): void {
  sea(ctx, u + 20, 10);
  // the polaroid
  const p = span(u, 0, 0.4) * (1 - span(u, 1.5, 1.9));
  if (p > 0) {
    ctx.save();
    ctx.globalAlpha = p;
    ctx.translate(800, 380);
    ctx.rotate(-0.05);
    ctx.scale(0.8 + p * 0.2, 0.8 + p * 0.2);
    pill(ctx, -360, -230, 720, 470, 10, '#fff', INK, 4);
    ctx.fillStyle = '#fffdf7';
    ctx.fillRect(-330, -200, 660, 330);
    drawSchoolLines(ctx, -320, 320, -150, 100, 4);
    drawKidLetters(ctx, -270, -150, 100, [99, 99, 99]);
    text(ctx, '3 neue Zeichen!', 0, 185, 46);
    ctx.restore();
  }
  // bubbles pop, fish hatch
  for (let i = 0; i < 3; i++) {
    const at = 1.7 + i * 0.45;
    const h = HATCH[i];
    if (u < at) continue;
    const k = u - at;
    if (k < 0.45) {
      const b = bubbleSprite(60, i * 60);
      const s = outBack(clamp(k / 0.35)) * 1.6;
      ctx.drawImage(b as CanvasImageSource, h.x - (b.width * s) / 2, h.y - (b.height * s) / 2, b.width * s, b.height * s);
      continue;
    }
    if (k < 0.8) {
      // pop ring
      ctx.save();
      ctx.globalAlpha = 1 - (k - 0.45) / 0.35;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(h.x, h.y, 100 + (k - 0.45) * 300, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (u > 2.15) {
    if (u < 6) {
      for (let i = 0; i < 3; i++) {
        const k = u - (2.15 + i * 0.45);
        if (k < 0) continue;
        const h = HATCH[i];
        const r = (95 - i * 8) * outBack(clamp(k / 0.5));
        drawSprite(ctx, bFish(i), h.x, h.y + Math.sin(u * 2 + i) * 10, r, 1, Math.sin(u * 7 + i) * 0.35);
        drawStars(ctx, h.x, h.y - 150, starsOf(KID_B[i].score), 40, clamp(k * 3));
      }
    } else swimB(ctx, u - 6, 0);
  }
  // celebration
  const c = span(u, 3.6, 4.1);
  if (c > 0) {
    ctx.save();
    ctx.globalAlpha = c;
    ctx.translate(800, 110);
    ctx.scale(0.7 + 0.3 * outBack(c), 0.7 + 0.3 * outBack(c));
    pill(ctx, -380, -62, 760, 124, 62, '#ffd34d', INK, 6);
    text(ctx, '🎉 Geschafft! 3 × B', 0, 4, 64);
    ctx.restore();
    drawConfetti(ctx, u - 3.6);
  }
}

// ---------- the games ----------

/** Meer: the B fish swim with others, a surprise bubble floats by and pops */
export function drawMeer(ctx: C, u: number): void {
  sea(ctx, u + 30, 14);
  const others: [string, number, number][] = [
    ['A', 98, 5],
    ['b', 60, 12],
    ['3', 14, 31],
    ['m', 85, 44],
  ];
  others.forEach(([ch, score, seed], i) => {
    const sp = creature(`sea${ch}`, (s) => fishSprite(genome(score, seed, 'fish'), s), ch);
    const a = span(u, 0.3 + i * 0.4, 1 + i * 0.4);
    const x = 200 + ((u * (60 + i * 25) + i * 420) % 1300);
    const y = 220 + i * 140 + Math.sin(u * 1.5 + i) * 30;
    ctx.save();
    ctx.globalAlpha = a;
    drawSprite(ctx, sp, x, y, 70 + (score / 100) * 30, 1, Math.sin(u * 8 + i) * 0.35);
    ctx.restore();
  });
  swimB(ctx, u + 8, 0);
  // the surprise bubble with an R
  const bx = 1250 - u * 40;
  const by = 260 + Math.sin(u * 1.4) * 30;
  if (u < 5) {
    const b = bubbleSprite(70, 200);
    ctx.drawImage(b as CanvasImageSource, bx - b.width, by - b.height, b.width * 2, b.height * 2);
    text(ctx, 'R', bx, by + 6, 90, '#5b3bd6', 'center', 400, "'Grundschrift', 'Druckvorlage', cursive");
  } else {
    const sp = creature('seaR', (s) => fishSprite(genome(92, 21, 'fish'), s), 'R');
    const k = clamp((u - 5) / 0.5);
    drawSprite(ctx, sp, bx, by, 90 * outBack(k), -1, Math.sin(u * 8) * 0.35);
    if (u < 7.5) {
      pill(ctx, bx - 260, by - 220, 420, 100, 40, '#fff', INK, 4);
      text(ctx, 'Juhu, du hast mich befreit!', bx - 50, by - 170, 30);
    }
  }
}

export function drawWeltraum(ctx: C, u: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0a0f35');
  g.addColorStop(1, '#3e1a63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * Math.abs(Math.sin(u * 1.5 + i))})`;
    ctx.beginPath();
    ctx.arc(rnd(i) * W, rnd(i + 50) * H, 1.2 + (i % 3), 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = '#ff9f5a';
  ctx.beginPath();
  ctx.arc(W - 120, H - 60, 240, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,180,0.7)';
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.ellipse(W - 120, H - 60, 380, 70, -0.25, 0, TAU);
  ctx.stroke();
  drawShootingStar(ctx as never, 200 + ((u * 300) % 1500), 120 + ((u * 60) % 200), (u * 0.6) % 1);
  const aliens: [string, number, number, number, number][] = [
    ['M', 97, 8, 760, 430],
    ['e', 45, 3, 330, 300],
    ['K', 82, 14, 1150, 300],
    ['z', 18, 40, 480, 650],
  ];
  aliens.forEach(([ch, score, seed, x, y], i) => {
    const sp = creature(`alien${ch}`, (s) => alienSprite(genome(score, seed, 'alien'), s), ch);
    const a = span(u, i * 0.35, 0.6 + i * 0.35);
    ctx.save();
    ctx.globalAlpha = a;
    drawSprite(ctx, sp, x + Math.sin(u * 0.7 + i) * 50, y + Math.sin(u * 1.6 + i * 2) * 25, 70 + score * 0.6, i % 2 ? -1 : 1, 0, Math.sin(u + i) * 0.08);
    drawStars(ctx, x + Math.sin(u * 0.7 + i) * 50, y - 60 - score * 0.9 + Math.sin(u * 1.6 + i * 2) * 25, starsOf(score), 30, a);
    ctx.restore();
  });
}

export function drawSavanne(ctx: C, u: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#7cc8f7');
  g.addColorStop(0.55, '#ffe8b5');
  g.addColorStop(0.56, '#d9d36a');
  g.addColorStop(1, '#a9c24a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.arc(W - 200, 150, 90, 0, TAU);
  ctx.fill();
  // acacia
  ctx.fillStyle = '#7a5a3a';
  ctx.fillRect(250, 330, 22, 180);
  ctx.fillStyle = '#5f8f3a';
  ctx.beginPath();
  ctx.ellipse(261, 320, 170, 45, 0, 0, TAU);
  ctx.fill();
  const animals: [string, number, number, number][] = [
    ['L', 96, 4, 0],
    ['7', 70, 2, 2],
    ['g', 85, 6, 1],
    ['s', 30, 9, 3],
    ['H', 90, 12, 4],
  ];
  animals.forEach(([ch, score, seed, variant], i) => {
    const sp = creature(`ani${ch}`, (s) => animalSprite(genome(score, seed, 'animal', undefined, variant), s), ch);
    const dir = i % 2 ? -1 : 1;
    const x = dir > 0 ? -150 + ((u * 110 + i * 360) % 1900) : 1750 - ((u * 90 + i * 300) % 1900);
    const y = 600 + (i % 3) * 90;
    drawSprite(ctx, sp, x, y + Math.abs(Math.sin(u * 6 + i)) * -10, 90 + (i % 3) * 15, dir, Math.sin(u * 6 + i) * 0.3);
  });
}

function bubbleStack(ctx: C, x: number, n: number, hue: number, popAt: number[], u: number): void {
  for (let i = 0; i < n; i++) {
    const popped = popAt[i] !== undefined && u > popAt[i];
    if (popped) continue;
    const col = i % 2;
    const row = Math.floor(i / 2);
    const b = bubbleSprite(26, i * 40, hue, true);
    ctx.drawImage(b as CanvasImageSource, x + col * 70, H - 230 - row * 70, 70, 70);
  }
}

export function drawDuell(ctx: C, u: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#9fd8ff');
  g.addColorStop(0.55, '#e8f6ff');
  g.addColorStop(0.56, '#a6dd6f');
  g.addColorStop(1, '#78c25a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  bubbleStack(ctx, 40, 10, 0, [], u);
  const pops: number[] = [];
  pops[9] = 5.6;
  bubbleStack(ctx, W - 180, 10, 220, pops, u);
  text(ctx, 'Team Rot', 110, 355, 40, '#c2252f', 'center', 700);
  text(ctx, 'Team Blau', W - 110, 355, 40, '#1f45c4', 'center', 700);
  const red = creature('duelR', (s) => fighterSprite(genome(94, 9, 'fighter', 358), s, 52), 'R', '#c2252f');
  const red2 = creature('duelR2', (s) => fighterSprite(genome(60, 29, 'fighter', 358), s, 52), 'a', '#c2252f');
  const blue = creature('duelB', (s) => fighterSprite(genome(55, 19, 'fighter', 220), s, 52), 'k', '#1f45c4');
  const meet = 2.4;
  const hop = (k: number) => -Math.abs(Math.sin(k * 9)) * 18;
  // red runs to the middle, fights, then on to the blue castle
  const rx = u < meet ? lerp(300, 720, u / meet) : u < 4 ? 720 + Math.sin(u * 30) * 8 * (u < 3.6 ? 1 : 0) : lerp(720, W - 260, clamp((u - 4) / 1.5));
  const bx = u < meet ? lerp(1300, 880, u / meet) : 880 + Math.sin(u * 30) * 8;
  drawSprite(ctx, red, rx, 640 + hop(u), 70, 1);
  drawStars(ctx, rx, 545 + hop(u), u < 3 ? 5 : 4, 30);
  drawSprite(ctx, red2, lerp(200, 520, clamp(u / 4)), 720 + hop(u + 0.3), 56, 1);
  drawStars(ctx, lerp(200, 520, clamp(u / 4)), 640 + hop(u + 0.3), 3, 26);
  if (u < 3.6) {
    drawSprite(ctx, blue, bx, 640 + hop(u + 0.5), 66, -1);
    drawStars(ctx, bx, 545 + hop(u + 0.5), u < 3 ? 3 : 1, 30);
  } else if (u < 4.2) {
    ctx.save();
    ctx.globalAlpha = 1 - (u - 3.6) / 0.6;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(bx, 640, 70 + (u - 3.6) * 250, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  // the clash
  if (u > meet && u < 3.7) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + u * 3;
      const r = 40 + ((u - meet) * 160) % 60;
      drawStars(ctx, 800 + Math.cos(a) * r, 600 + Math.sin(a) * r, 1, 28);
    }
  }
  if (u > 5.5 && u < 6.2) {
    ctx.save();
    ctx.globalAlpha = 1 - (u - 5.5) / 0.7;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(W - 75, H - 230 - 4 * 70 + 35, 40 + (u - 5.5) * 200, 0, TAU);
    ctx.stroke();
    ctx.restore();
    text(ctx, 'Plopp!', W - 300, 470, 48, '#fff', 'center', 700);
  }
}

export function drawRiesenburg(ctx: C, u: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#8fb8ff');
  g.addColorStop(0.5, '#ffd1e8');
  g.addColorStop(0.51, '#a6dd6f');
  g.addColorStop(1, '#78c25a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const fallen = u > 4.6;
  const walls: [number, number, number, number][] = [
    [1060, 300, 460, 0.55],
    [990, 470, 380, 0.62],
  ];
  walls.forEach(([x, top, w, l], wi) => {
    if (wi === 1 && fallen) return;
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#3b2160';
    ctx.fillStyle = `hsl(262,38%,${l * 100}%)`;
    ctx.beginPath();
    ctx.roundRect(x, top, w, H - top, 20);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `hsl(${262 + i * 20},60%,80%)`;
      ctx.beginPath();
      ctx.arc(x + 50 + (i * (w - 100)) / 3, top, 26, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
    }
  });
  if (!fallen) for (let i = 0; i < 6; i++) ctx.drawImage(bubbleSprite(17, i * 40, 262, true) as CanvasImageSource, 920 + (i % 3) * 70, 720 + Math.floor(i / 3) * 70, 70, 70);
  else if (u < 5.4) {
    ctx.save();
    ctx.globalAlpha = 1 - (u - 4.6) / 0.8;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      ctx.drawImage(bubbleSprite(12, i * 30) as CanvasImageSource, 1150 + Math.cos(a) * (u - 4.6) * 500, 650 + Math.sin(a) * (u - 4.6) * 400, 50, 50);
    }
    ctx.restore();
  }
  drawGiant(ctx as never, 1290, 300, 0.75, u < 4.6 ? 'laugh' : u < 6 ? 'angry' : 'shock', u);
  const guard = creature('guard', () => inkGuardSprite(28, 3), '');
  drawSprite(ctx, guard, 860 - Math.sin(u * 2) * 40, 760, 50, -1, 0, Math.sin(u * 5) * 0.1);
  const colors = [358, 220, 140, 45, 290];
  for (let i = 0; i < 5; i++) {
    const ch = 'KRAFT'[i];
    const sp = creature(`class${i}`, (s) => fighterSprite(genome(70 + i * 6, 40 + i, 'fighter', colors[i]), s, 44), ch);
    const x = -100 + ((u * 160 + i * 170) % 1000);
    drawSprite(ctx, sp, x, 770 - (i % 2) * 70 - Math.abs(Math.sin(u * 9 + i)) * 16, 52, 1);
  }
  if (u > 4.6 && u < 6.5) text(ctx, 'Eine Mauer ist gefallen!', 600, 200, 56, '#fff', 'center', 700);
}

const TOWERS = [
  { x: 330, color: '#c2252f', hue: 358, letters: ['A', 'b', '3', 'K'], stars: [5, 3, 2, 4] },
  { x: 800, color: '#1d7a35', hue: 140, letters: ['R', 'm', 'E'], stars: [5, 4, 3] },
  { x: 1270, color: '#1f45c4', hue: 222, letters: ['K', 'm', 'u', 'L'], stars: [4, 2, 5, 3] },
];
const BLOCK_H = [0, 44, 60, 76, 100, 124];

export function drawTuerme(ctx: C, u: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1d1450');
  g.addColorStop(0.55, '#7a58cc');
  g.addColorStop(0.79, '#ffc1c9');
  g.addColorStop(0.8, '#86d66e');
  g.addColorStop(1, '#4f9e57');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(u + i))})`;
    ctx.beginPath();
    ctx.arc(rnd(i) * W, rnd(i + 9) * 420, 2, 0, TAU);
    ctx.fill();
  }
  const ground = 790;
  // goal line
  ctx.setLineDash([18, 14]);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(W, 250);
  ctx.stroke();
  ctx.setLineDash([]);
  text(ctx, '🏁 Ziel: 24 m', W - 40, 225, 32, '#fff', 'right');
  drawPortal(ctx as never, 800, 130, 70, u, 1, 0);
  // the delivery: a block flies from the portal to the green tower
  const flying = { from: 0.6, land: 3.2 };
  TOWERS.forEach((tw, ti) => {
    let y = ground;
    const n = ti === 1 && u < flying.land ? tw.letters.length - 1 : tw.letters.length;
    for (let i = 0; i < n; i++) {
      const h = BLOCK_H[tw.stars[i]];
      ctx.save();
      ctx.translate(tw.x, y - h / 2);
      ctx.scale(0.8, 0.8);
      drawBlock(ctx as never, { w: blockWidth(tw.stars[i]) * 1.6, h: h / 0.8, hue: tw.hue, stars: tw.stars[i], sticker: letterSticker(tw.letters[i], tw.color), deco: [], seed: i + ti * 5, t: u });
      ctx.restore();
      y -= h;
    }
    ctx.fillStyle = '#5a3f2a';
    ctx.fillRect(tw.x - 150, ground, 300, 26);
  });
  if (u < flying.land + 0.3) {
    const k = span(u, flying.from, flying.land);
    const tw = TOWERS[1];
    let top = ground;
    for (let i = 0; i < tw.letters.length - 1; i++) top -= BLOCK_H[tw.stars[i]];
    const h = BLOCK_H[tw.stars[2]];
    const bx = 800 + Math.sin(k * Math.PI) * 260;
    const by = lerp(200, top - h / 2, k);
    drawBeam(ctx as never, bx, by - 150, by - 10, 150, 1, u);
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(0.8, 0.8);
    drawBlock(ctx as never, { w: blockWidth(3) * 1.6, h: h / 0.8, hue: tw.hue, stars: 3, sticker: letterSticker('E', tw.color), deco: [], seed: 9, t: u });
    ctx.restore();
    ctx.save();
    ctx.translate(bx, by - 170);
    ctx.scale(1.3, 1.3);
    drawUfo(ctx as never, { hue: 105, face: 'grin', t: u, boss: true });
    ctx.restore();
  } else {
    // Zork does a looping and waves
    const k = u - flying.land;
    ctx.save();
    ctx.translate(800 + Math.cos(k * 2) * 300, 360 + Math.sin(k * 2) * 90);
    ctx.rotate(Math.sin(k * 2) * 0.2);
    ctx.scale(1.3, 1.3);
    drawUfo(ctx as never, { hue: 105, face: 'grin', t: u, boss: true });
    ctx.restore();
  }
}

const PAINTED: CardLook = { fills: { body: '#ff9a3c', tail: '#ff5f8f', dorsal: '#4fb3ff', anal: '#4fb3ff', pelvic: '#4fb3ff', pectoral: '#ffd84a' } };
const PAINTED_2: CardLook = { fills: { body: '#8f6bff', tail: '#7ccf6b', dorsal: '#ffd84a', anal: '#ffd84a', pelvic: '#ffd84a', pectoral: '#ff6fd8' } };
let painted: Sprite[] | null = null;

export function drawMalen(ctx: C, u: number): void {
  sea(ctx, u + 50, 10);
  painted ??= [paintedSprite('fisch', cardImage(PAINTED), 1.35), paintedSprite('fisch', cardImage(PAINTED_2), 1.1)];
  // the coloured card lies on the left
  const out = span(u, 1.2, 3.2);
  ctx.save();
  ctx.translate(110, 360);
  ctx.rotate(-0.1);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(16, 20, 440, 410);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-14, -14, 440, 410);
  drawCard(ctx as never, 4.4, PAINTED);
  text(ctx, 'Flossi', 300, 340, 44, '#d6336c', 'center', 400, "'Grundschrift', 'Druckvorlage', cursive");
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 8;
  ctx.setLineDash([6, 18]);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(470, 430);
  ctx.quadraticCurveTo(620, 210, 820, 330);
  ctx.globalAlpha = 1 - out;
  ctx.stroke();
  ctx.restore();
  const x = lerp(330, 1050, out) + Math.sin(u * 0.8) * 60 * out;
  const y = lerp(560, 400, out) + Math.sin(u * 1.5) * 25;
  drawSprite(ctx, painted[0], x, y, 150 * (0.4 + 0.6 * out), 1, Math.sin(u * 7) * 0.3);
  drawSprite(ctx, painted[1], 1300 - Math.sin(u * 0.5) * 120, 690 + Math.sin(u * 1.3) * 20, 100, -1, Math.sin(u * 7 + 1) * 0.3);
  if (u > 3) {
    const a = span(u, 3, 3.3);
    ctx.save();
    ctx.globalAlpha = a;
    pill(ctx, x - 220, y - 270, 440, 110, 45, '#fff', INK, 4);
    text(ctx, 'Hallo, ich bin', x - 70, y - 214, 34);
    text(ctx, 'Flossi', x + 110, y - 214, 46, '#d6336c', 'center', 400, "'Grundschrift', 'Druckvorlage', cursive");
    ctx.restore();
  }
}

/** a calm background for title, feature cards and the end */
export function drawCalm(ctx: C, u: number): void {
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#ffe3f1');
  g.addColorStop(0.5, '#fdf6ff');
  g.addColorStop(1, '#dff4ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {
    const y = H - (((u * (25 + rnd(i) * 30) + rnd(i + 1) * H) % (H + 100)) - 50);
    const b = bubbleSprite(8 + (i % 4) * 5, i * 25);
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.drawImage(b as CanvasImageSource, rnd(i + 4) * W, y, b.width * 2, b.height * 2);
    ctx.restore();
  }
  const ring: [string, () => Sprite][] = [
    ['fish', () => creature('calmF', (s) => fishSprite(genome(97, 5, 'fish'), s), 'K')],
    ['alien', () => creature('calmA', (s) => alienSprite(genome(95, 8, 'alien'), s), 'r')],
    ['animal', () => creature('calmL', (s) => animalSprite(genome(96, 4, 'animal', undefined, 0), s), 'o')],
  ];
  ring.forEach(([, make], i) => {
    const x = [180, 1420, 1300][i];
    const y = [700, 680, 210][i];
    drawSprite(ctx, make(), x + Math.sin(u * 0.8 + i) * 25, y + Math.sin(u * 1.4 + i * 2) * 18, 85, i ? -1 : 1, Math.sin(u * 6 + i) * 0.3);
  });
}

export { FONT };

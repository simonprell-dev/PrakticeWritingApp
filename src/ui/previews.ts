// Little animated-looking preview pictures for the start tiles, drawn with the real creature generator.
import { makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import { alienSprite } from '../game/creatures/alien.ts';
import { bubbleSprite } from '../game/creatures/bubble.ts';
import { fighterSprite } from '../game/creatures/duelFigure.ts';
import { fishSprite } from '../game/creatures/fish.ts';
import { drawGiant } from '../game/creatures/giant.ts';
import { inkGuardSprite } from '../game/creatures/inkGuard.ts';
import { makeGenome, type Archetype, type Genome } from '../game/creatures/genome.ts';
import { animalSprite } from '../game/creatures/savanna.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { TAU } from '../game/math.ts';
import { tierOf } from '../recog/score.ts';

export function letterSticker(ch: string, color = '#2b2b7a', size = 90): AnyCanvas {
  const { canvas, ctx } = makeCanvas(size, size * 1.15);
  ctx.fillStyle = color;
  ctx.font = `${size * 0.9}px Grundschrift, Druckvorlage, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, size / 2, size * 0.62);
  return canvas;
}

function draw(ctx: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, scale: number, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * flip, scale);
  if (sp.tail) ctx.drawImage(sp.tail.canvas as CanvasImageSource, sp.tail.px - sp.ax - sp.tail.pivotX, sp.tail.py - sp.ay - sp.tail.pivotY);
  ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
  drawBadgeSticker(ctx, sp, flip);
  ctx.restore();
}

function genome(score: number, seed: number, a: Archetype, hue?: number, variant?: number): Genome {
  let g = makeGenome(score, tierOf(score), seed, a, hue);
  let s = seed;
  while (variant !== undefined && g.variant !== variant) g = makeGenome(score, tierOf(score), ++s, a, hue);
  return g;
}

export function tilePreview(kind: 'meer' | 'weltraum' | 'savanne' | 'duell' | 'riesenburg', canvas: HTMLCanvasElement): void {
  const W = 480;
  const H = 360;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  if (kind === 'meer') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fe3f3');
    g.addColorStop(1, '#1d6fa8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#f2d9a2';
    ctx.fillRect(0, H - 40, W, 40);
    for (let i = 0; i < 9; i++) ctx.drawImage(bubbleSprite(5 + (i % 4) * 3, i * 30) as CanvasImageSource, 30 + i * 50, 40 + ((i * 97) % 220));
    draw(ctx, fishSprite(genome(96, 5, 'fish'), letterSticker('A')), 300, 165, 0.85);
    draw(ctx, fishSprite(genome(55, 12, 'fish'), letterSticker('b')), 120, 260, 0.6, -1);
    draw(ctx, fishSprite(genome(12, 31, 'fish'), letterSticker('3')), 100, 90, 0.5);
  } else if (kind === 'weltraum') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0f35');
    g.addColorStop(1, '#3e1a63');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.4 + ((i * 37) % 60) / 100})`;
      ctx.beginPath();
      ctx.arc((i * 131) % W, (i * 71) % H, 1 + (i % 3) * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ff9f5a';
    ctx.beginPath();
    ctx.arc(W - 40, H - 30, 80, 0, TAU);
    ctx.fill();
    draw(ctx, alienSprite(genome(95, 8, 'alien'), letterSticker('M')), 280, 190, 0.9);
    draw(ctx, alienSprite(genome(45, 3, 'alien'), letterSticker('e')), 100, 140, 0.6);
  } else if (kind === 'savanne') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7cc8f7');
    g.addColorStop(0.55, '#ffe8b5');
    g.addColorStop(0.56, '#d9d36a');
    g.addColorStop(1, '#a9c24a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(W - 70, 60, 36, 0, TAU);
    ctx.fill();
    draw(ctx, animalSprite(genome(70, 2, 'animal', undefined, 2), letterSticker('7')), 110, 200, 0.6);
    draw(ctx, animalSprite(genome(96, 4, 'animal', undefined, 0), letterSticker('L')), 300, 250, 0.75);
  } else if (kind === 'riesenburg') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fb8ff');
    g.addColorStop(0.5, '#ffd1e8');
    g.addColorStop(0.51, '#a6dd6f');
    g.addColorStop(1, '#78c25a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // castle walls
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#3b2160';
    for (const [x, top, w, l] of [
      [300, 120, 200, 0.55],
      [270, 190, 170, 0.62],
    ] as const) {
      ctx.fillStyle = `hsl(262,38%,${l * 100}%)`;
      ctx.beginPath();
      ctx.roundRect(x, top, w, H - top, 10);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = `hsl(${262 + i * 20},60%,80%)`;
        ctx.beginPath();
        ctx.arc(x + 25 + i * (w - 50) / 3, top, 12, Math.PI, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    for (let i = 0; i < 6; i++) ctx.drawImage(bubbleSprite(17, i * 40, 262, true) as CanvasImageSource, 262 + (i % 3) * 34, 280 + Math.floor(i / 3) * 34);
    drawGiant(ctx as never, 400, 135, 0.3, 'laugh', 0.3);
    draw(ctx, inkGuardSprite(28, 3), 200, 270, 1, -1);
    draw(ctx, fighterSprite(genome(95, 9, 'fighter', 25), letterSticker('K'), 40), 95, 285, 1);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#9fd8ff');
    g.addColorStop(0.45, '#e8f6ff');
    g.addColorStop(0.46, '#a6dd6f');
    g.addColorStop(1, '#78c25a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) ctx.drawImage(bubbleSprite(22, i * 40, 0) as CanvasImageSource, 6 + (i % 2) * 34, 140 + Math.floor(i / 2) * 50);
    for (let i = 0; i < 6; i++) ctx.drawImage(bubbleSprite(22, i * 40, 220) as CanvasImageSource, W - 56 - (i % 2) * 34, 140 + Math.floor(i / 2) * 50);
    draw(ctx, fighterSprite(genome(90, 9, 'fighter', 358), letterSticker('R'), 52), 175, 240, 1);
    draw(ctx, fighterSprite(genome(70, 19, 'fighter', 220), letterSticker('k'), 44), 310, 245, 1, -1);
  }
}

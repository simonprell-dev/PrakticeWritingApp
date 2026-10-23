// Shared cutscene overlays: the big banner and the "3, 2, 1, Los!" countdown.
import { clamp, ease } from '../game/math.ts';

export interface Banner {
  title: string;
  sub: string;
  /** seconds since it appeared, and how long it stays */
  t: number;
  dur: number;
}

/** Big white banner with two spinning stars; `time` turns the stars. */
export function drawBanner(ctx: CanvasRenderingContext2D, worldW: number, b: Banner, time: number, y = 400): void {
  const pop = ease.outBack(clamp(b.t / 0.35));
  const fade = clamp((b.dur - b.t) / 0.35);
  const w = Math.min(1150, worldW - 160);
  const h = 210;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(worldW / 2, y);
  ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.strokeStyle = '#3b2a5c';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 40);
  ctx.fill();
  ctx.stroke();
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#ffd84a';
    ctx.strokeStyle = '#9a5b00';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const cx = sx * (w / 2 - 70);
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5 + time;
      const rr = i % 2 ? 18 : 40;
      ctx.lineTo(cx + Math.cos(a) * rr, Math.sin(a) * rr - 20);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7c5cff';
  ctx.font = '700 70px Fredoka, system-ui, sans-serif';
  ctx.fillText(b.title, 0, -12, w - 240);
  ctx.fillStyle = '#3b2a5c';
  ctx.font = '600 32px Fredoka, system-ui, sans-serif';
  ctx.fillText(b.sub, 0, 55, w - 80);
  ctx.restore();
}

/** seconds the countdown runs ("3", "2", "1", "Los!") */
export const COUNTDOWN_SECONDS = 2.3;

/** `countdown` = seconds since the countdown started (negative = hidden) */
export function drawCountdown(ctx: CanvasRenderingContext2D, worldW: number, countdown: number, y = 560): void {
  if (countdown < 0) return;
  const step = Math.min(3, Math.floor(countdown / 0.55));
  const local = countdown - step * 0.55;
  const text = ['3', '2', '1', 'Los!'][step];
  const s = ease.outBack(clamp(local / 0.25)) * (step === 3 ? 1.1 : 1);
  ctx.save();
  ctx.globalAlpha = step === 3 ? clamp((COUNTDOWN_SECONDS - countdown) / 0.5) : 1;
  ctx.translate(worldW / 2, y);
  ctx.scale(s, s);
  ctx.font = `700 ${step === 3 ? 200 : 260}px Fredoka, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 18;
  ctx.strokeStyle = '#3b2a5c';
  ctx.lineJoin = 'round';
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = step === 3 ? '#ffd84a' : '#ffffff';
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

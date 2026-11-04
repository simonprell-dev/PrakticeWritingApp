// The painted Zauberland background: pastel sky, hills, the castle hill, a path to the gate and a flower meadow.
import { castleLayout, CASTLE_GROUND } from './castle.ts';
import { hsl, TAU } from '../math.ts';
import { mulberry32 } from '../rng.ts';

type Ctx2 = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const HORIZON = 600;
export const MEADOW_Y0 = 650;
export const MEADOW_Y1 = 930;

export function paintZauberland(ctx: Ctx2, W: number, H: number): void {
  const r = mulberry32(77);
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
  sky.addColorStop(0, '#b9a4ff');
  sky.addColorStop(0.55, '#f3c4ff');
  sky.addColorStop(1, '#ffe1ef');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HORIZON + 2);
  // soft sun
  const sx = W * 0.12;
  const glow = ctx.createRadialGradient(sx, 140, 10, sx, 140, 220);
  glow.addColorStop(0, 'rgba(255,250,220,0.95)');
  glow.addColorStop(1, 'rgba(255,240,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 220, 0, 440, 380);
  // twinkles in the upper sky
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.5})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * HORIZON * 0.55, 1 + r() * 2, 0, TAU);
    ctx.fill();
  }
  // far hills
  for (const [col, amp, off] of [
    ['rgba(190,160,235,0.7)', 70, 0],
    ['rgba(160,215,190,0.85)', 45, 2],
  ] as const) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, MEADOW_Y0);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, HORIZON - 30 - Math.sin(x * 0.005 + off) * amp - Math.sin(x * 0.013 + off) * amp * 0.3);
    ctx.lineTo(W, MEADOW_Y0);
    ctx.fill();
  }
  // the castle hill
  const L = castleLayout(W);
  const cx = W / 2;
  const hw = (L.cols * L.cell) / 2 + 160;
  ctx.fillStyle = '#9fdcae';
  ctx.beginPath();
  ctx.moveTo(cx - hw - 140, MEADOW_Y0 + 10);
  ctx.bezierCurveTo(cx - hw, CASTLE_GROUND - 6, cx - hw * 0.6, CASTLE_GROUND - 12, cx, CASTLE_GROUND - 12);
  ctx.bezierCurveTo(cx + hw * 0.6, CASTLE_GROUND - 12, cx + hw, CASTLE_GROUND - 6, cx + hw + 140, MEADOW_Y0 + 10);
  ctx.closePath();
  ctx.fill();
  // meadow
  const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
  ground.addColorStop(0, '#b6e8b0');
  ground.addColorStop(1, '#86cf8e');
  ctx.fillStyle = ground;
  ctx.fillRect(0, MEADOW_Y0 - 20, W, H - MEADOW_Y0 + 20);
  ctx.fillStyle = '#b6e8b0';
  ctx.beginPath();
  ctx.moveTo(0, MEADOW_Y0 - 20);
  for (let x = 0; x <= W; x += 50) ctx.lineTo(x, MEADOW_Y0 - 20 - Math.sin(x * 0.01) * 8);
  ctx.lineTo(W, MEADOW_Y0);
  ctx.lineTo(0, MEADOW_Y0);
  ctx.fill();
  // path from the gate
  ctx.fillStyle = 'rgba(255,240,215,0.85)';
  ctx.beginPath();
  ctx.moveTo(cx - L.cell * 0.3, CASTLE_GROUND);
  ctx.lineTo(cx + L.cell * 0.3, CASTLE_GROUND);
  ctx.quadraticCurveTo(cx + 60, MEADOW_Y0 + 60, cx + 120, H);
  ctx.lineTo(cx - 120, H);
  ctx.quadraticCurveTo(cx - 60, MEADOW_Y0 + 60, cx - L.cell * 0.3, CASTLE_GROUND);
  ctx.fill();
  // flowers and grass
  for (let i = 0; i < 220; i++) {
    const x = r() * W;
    const y = MEADOW_Y0 - 10 + r() * (H - MEADOW_Y0 + 10);
    if (Math.abs(x - cx) < 90 + (y - MEADOW_Y0) * 0.2 && r() < 0.8) continue;
    const s = 0.5 + (y - HORIZON) / (H - HORIZON);
    ctx.strokeStyle = hsl(120 + r() * 30, 0.45, 0.45 + r() * 0.12);
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + k * 5 * s, y - (10 + r() * 8) * s);
      ctx.stroke();
    }
    if (r() < 0.45) {
      const col = hsl([330, 50, 280, 0, 200][Math.floor(r() * 5)], 0.85, 0.72);
      ctx.fillStyle = col;
      for (let k = 0; k < 5; k++) {
        ctx.beginPath();
        ctx.arc(x + Math.cos((k / 5) * TAU) * 4 * s, y - 16 * s + Math.sin((k / 5) * TAU) * 4 * s, 3.2 * s, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#fff4a0';
      ctx.beginPath();
      ctx.arc(x, y - 16 * s, 2.2 * s, 0, TAU);
      ctx.fill();
    }
  }
}


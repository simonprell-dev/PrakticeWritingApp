// Rechenmeer: the plants a right answer grows on the sand – seagrass, coral and sea anemone, with the child's
// number on a white badge at their foot. They sway; the better the number is written, the richer the colours.
import { badge, sparkleStar } from '../creatures/parts.ts';
import type { AnyCanvas, Ctx } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import { mulberry32 } from '../rng.ts';
import type { ScannedGlyph, Tier } from '../../vision/types.ts';

export type PlantKind = 'seegras' | 'koralle' | 'anemone';
export const PLANT_KINDS: readonly PlantKind[] = ['seegras', 'koralle', 'anemone'];

export interface Plant {
  kind: PlantKind;
  x: number;
  tier: Tier;
  seed: number;
  /** scene time it was planted */
  born: number;
  glyph: ScannedGlyph;
  sticker: AnyCanvas;
  /** 0..1 while the oldest plant fades away */
  fade?: number;
}

const TIER_IDX: Record<Tier, number> = { zerknittert: 0, schief: 1, nett: 2, schoen: 3, prachtvoll: 4 };
/** badge radius at the foot */
export const PLANT_BADGE = 20;

/** colour saturation and lightness by tier: crumpled is pale, splendid is bright */
function tone(tier: Tier): { sat: number; light: number } {
  const t = TIER_IDX[tier];
  return { sat: 0.3 + t * 0.16, light: 0.42 + t * 0.03 };
}

function seegras(ctx: Ctx, p: Plant, gy: number, t: number, h: number) {
  const r = mulberry32(p.seed);
  const { sat, light } = tone(p.tier);
  const hue = 105 + r() * 40;
  const blades = 5 + Math.floor(r() * 3);
  for (let i = 0; i < blades; i++) {
    const bx = p.x + (i - (blades - 1) / 2) * 9;
    const bh = h * (0.65 + r() * 0.35);
    const sway = Math.sin(t * 1.3 + i * 0.7 + p.seed) * 18 * (bh / 200);
    ctx.strokeStyle = hsl(hue + i * 4, sat, light - 0.05 + (i % 2) * 0.06);
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bx, gy);
    ctx.bezierCurveTo(bx + sway * 0.3, gy - bh * 0.35, bx - sway * 0.4, gy - bh * 0.7, bx + sway, gy - bh);
    ctx.stroke();
  }
}

function koralle(ctx: Ctx, p: Plant, gy: number, t: number, h: number) {
  const r = mulberry32(p.seed);
  const { sat, light } = tone(p.tier);
  const hue = [350, 12, 330, 20][Math.floor(r() * 4)];
  ctx.lineCap = 'round';
  const branch = (x: number, y: number, len: number, a: number, w: number, depth: number) => {
    const x2 = x + Math.cos(a) * len;
    const y2 = y + Math.sin(a) * len;
    ctx.strokeStyle = hsl(hue, sat, light + depth * 0.04);
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    if (depth >= 3) {
      ctx.fillStyle = hsl(hue, sat, light + 0.18);
      ctx.beginPath();
      ctx.arc(x2, y2, w * 0.7, 0, TAU);
      ctx.fill();
      return;
    }
    const sway = Math.sin(t * 0.9 + p.seed + depth) * 0.04;
    branch(x2, y2, len * 0.72, a - 0.42 - r() * 0.2 + sway, w * 0.72, depth + 1);
    branch(x2, y2, len * 0.72, a + 0.42 + r() * 0.2 + sway, w * 0.72, depth + 1);
  };
  branch(p.x, gy, h * 0.38, -Math.PI / 2, 16, 0);
}

function anemone(ctx: Ctx, p: Plant, gy: number, t: number, h: number) {
  const r = mulberry32(p.seed);
  const { sat, light } = tone(p.tier);
  const hue = [290, 320, 45, 180][Math.floor(r() * 4)];
  const top = gy - h * 0.45;
  // tentacles
  const n = 11;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI + (i / (n - 1)) * Math.PI;
    const wave = Math.sin(t * 2 + i * 0.8 + p.seed) * 0.18;
    const len = h * 0.45;
    const ex = p.x + Math.cos(a + wave) * len * 0.8;
    const ey = top + Math.sin(a + wave) * len;
    ctx.strokeStyle = hsl(hue + 20, sat, light + 0.12);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * 14, top);
    ctx.quadraticCurveTo(p.x + Math.cos(a) * len * 0.5, top + Math.sin(a) * len * 0.6 + wave * 20, ex, ey);
    ctx.stroke();
    ctx.fillStyle = hsl(hue + 40, sat, light + 0.25);
    ctx.beginPath();
    ctx.arc(ex, ey, 5, 0, TAU);
    ctx.fill();
  }
  // the stem
  ctx.fillStyle = hsl(hue, sat, light);
  ctx.beginPath();
  ctx.moveTo(p.x - 26, gy);
  ctx.quadraticCurveTo(p.x - 30, top + 6, p.x - 18, top);
  ctx.lineTo(p.x + 18, top);
  ctx.quadraticCurveTo(p.x + 30, top + 6, p.x + 26, gy);
  ctx.closePath();
  ctx.fill();
}

const DRAW: Record<PlantKind, typeof seegras> = { seegras, koralle, anemone };
const HEIGHT: Record<PlantKind, number> = { seegras: 210, koralle: 200, anemone: 170 };

/** draws a plant standing on the sand at groundY; grow 0..1 while it grows */
export function drawPlant(ctx: Ctx, p: Plant, groundY: number, t: number, grow: number): void {
  const k = Math.max(0, Math.min(1, grow));
  const h = HEIGHT[p.kind] * (0.15 + 0.85 * k);
  ctx.save();
  if (p.fade) ctx.globalAlpha = Math.max(0, 1 - p.fade);
  DRAW[p.kind](ctx, p, groundY, t, h);
  if (p.tier === 'prachtvoll') {
    const r = mulberry32(p.seed + 1);
    for (let i = 0; i < 3; i++) sparkleStar(ctx, p.x + (r() - 0.5) * 80, groundY - h * (0.3 + r() * 0.6), 5 + Math.sin(t * 3 + i) * 2);
  }
  if (k > 0.6) badge(ctx, p.x, groundY - PLANT_BADGE * 0.6, PLANT_BADGE, p.sticker);
  ctx.restore();
}

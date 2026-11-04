// Drawing the Zauberland castle. Every part has the same shape and stone; the handwriting tier only picks the
// decoration (roof colour, flag, flower box, gold trim). The whole castle is drawn into one cached picture
// that is only redrawn when it grows.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { TAU } from '../math.ts';
import { WORLD_H } from '../stage.ts';
import type { Tier } from '../../vision/types.ts';
import { Castle, GATE_COL, SLOTS, slotRect, castleLayout, type BuiltPart, type Layout } from './castle.ts';

const STONE = '#f7efff';
const STONE_DARK = '#e2d2f4';
const LINE = '#6b4f8f';
const TIER_I: Record<Tier, number> = { zerknittert: 0, schief: 1, nett: 2, schoen: 3, prachtvoll: 4 };
const ROOF = ['#b9a9c9', '#93b3ea', '#ff9ec7', '#b48cff', '#ffd23f'];

type Rect = { x: number; y: number; w: number; h: number };

function lw(L: Layout) {
  return Math.max(2, L.cell * 0.035);
}

/** stone block with brick lines and an outline */
function stone(ctx: Ctx, r: Rect, L: Layout, crack = false) {
  const p = makePath();
  p.rect(r.x, r.y, r.w, r.h);
  const g = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
  g.addColorStop(0, STONE);
  g.addColorStop(1, STONE_DARK);
  ctx.fillStyle = g;
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = 'rgba(120,90,160,0.18)';
  ctx.lineWidth = lw(L) * 0.6;
  const bh = L.rowH / 5;
  for (let y = r.y + r.h - bh, k = 0; y > r.y; y -= bh, k++) {
    ctx.beginPath();
    ctx.moveTo(r.x, y);
    ctx.lineTo(r.x + r.w, y);
    ctx.stroke();
    for (let x = r.x + (k % 2 ? L.cell / 6 : L.cell / 3); x < r.x + r.w; x += L.cell / 3) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + bh);
      ctx.stroke();
    }
  }
  if (crack) {
    ctx.strokeStyle = 'rgba(90,60,120,0.5)';
    ctx.beginPath();
    ctx.moveTo(r.x + r.w * 0.8, r.y + r.h * 0.1);
    ctx.lineTo(r.x + r.w * 0.7, r.y + r.h * 0.3);
    ctx.lineTo(r.x + r.w * 0.78, r.y + r.h * 0.45);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw(L);
  ctx.lineJoin = 'round';
  ctx.stroke(p);
}

/** battlements on top of a wall */
function crenels(ctx: Ctx, x: number, y: number, w: number, L: Layout) {
  const n = 3;
  const cw = w / (n * 2 - 1);
  for (let i = 0; i < n; i++) stone(ctx, { x: x + i * 2 * cw, y: y - cw * 0.8, w: cw, h: cw * 0.8 + 1 }, L);
}

/** the glass of a room's window (where a princess looks out) */
export function windowRect(L: Layout, slot: number): Rect {
  const r = slotRect(L, SLOTS[slot]);
  const w = r.w * 0.42;
  const h = r.h * 0.44;
  return { x: r.x + (r.w - w) / 2, y: r.y + r.h * 0.15, w, h };
}

export function archPath(r: Rect): Path2D {
  const p = makePath();
  const rad = r.w / 2;
  p.moveTo(r.x, r.y + r.h);
  p.lineTo(r.x, r.y + rad);
  p.arc(r.x + rad, r.y + rad, rad, Math.PI, 0);
  p.lineTo(r.x + r.w, r.y + r.h);
  p.closePath();
  return p;
}

function shield(ctx: Ctx, x: number, y: number, s: number, sticker: AnyCanvas | null, gold: boolean, L: Layout) {
  const p = makePath();
  p.moveTo(x - s, y - s);
  p.lineTo(x + s, y - s);
  p.lineTo(x + s, y + s * 0.2);
  p.quadraticCurveTo(x + s, y + s * 0.9, x, y + s * 1.3);
  p.quadraticCurveTo(x - s, y + s * 0.9, x - s, y + s * 0.2);
  p.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill(p);
  ctx.strokeStyle = gold ? '#c9961a' : LINE;
  ctx.lineWidth = lw(L) * (gold ? 1.4 : 1);
  ctx.stroke(p);
  if (sticker) {
    const k = (s * 1.6) / Math.max(sticker.width, sticker.height);
    ctx.drawImage(sticker as CanvasImageSource, x - (sticker.width * k) / 2, y + s * 0.1 - (sticker.height * k) / 2, sticker.width * k, sticker.height * k);
  }
}

function flag(ctx: Ctx, x: number, y: number, size: number, col: string, limp: boolean, L: Layout) {
  ctx.save();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw(L);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - size);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  if (limp) {
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.7, x + size * 0.12, y - size * 0.35);
    ctx.lineTo(x, y - size * 0.55);
  } else {
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.35, y - size * 1.05, x + size * 0.65, y - size * 0.85);
    ctx.quadraticCurveTo(x + size * 0.35, y - size * 0.7, x, y - size * 0.62);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = lw(L) * 0.7;
  ctx.stroke();
  ctx.restore();
}

function roof(ctx: Ctx, x: number, w: number, base: number, h: number, t: number, L: Layout) {
  const p = makePath();
  p.moveTo(x - w * 0.08, base);
  p.lineTo(x + w / 2, base - h);
  p.lineTo(x + w * 1.08, base);
  p.closePath();
  if (t === 4) {
    const g = ctx.createLinearGradient(x, base - h, x + w, base);
    g.addColorStop(0, '#fff3a0');
    g.addColorStop(1, '#f2b705');
    ctx.fillStyle = g;
  } else ctx.fillStyle = ROOF[t];
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = lw(L) * 0.8;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.1, base - (h * i) / 4);
    ctx.lineTo(x + w * 1.1, base - (h * i) / 4);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw(L);
  ctx.lineJoin = 'round';
  ctx.stroke(p);
}

/** one built part (its decoration follows its tier) */
export function drawPart(ctx: Ctx, castle: Castle, L: Layout, part: BuiltPart, stickers: Map<number, AnyCanvas>): void {
  const s = SLOTS[part.slot];
  const r = slotRect(L, s);
  const t = TIER_I[part.tier];
  const sticker = part.glyphId !== null ? (stickers.get(part.glyphId) ?? null) : null;
  const above = SLOTS.find((o) => o.on.includes(s.i) && o.col === s.col);
  const covered = above ? castle.built(above.i) : false;
  if (s.kind === 'room') {
    stone(ctx, r, L, t === 0);
    if (!covered) crenels(ctx, r.x, r.y, r.w, L);
    const wr = windowRect(L, s.i);
    const glass = archPath(wr);
    const gl = ctx.createLinearGradient(0, wr.y, 0, wr.y + wr.h);
    gl.addColorStop(0, '#7a74e6');
    gl.addColorStop(1, '#3d3990');
    ctx.fillStyle = gl;
    ctx.fill(glass);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(wr.x + wr.w * 0.32, wr.y + wr.h * 0.38, wr.w * 0.1, wr.h * 0.18, 0.3, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = t >= 3 ? '#c9961a' : LINE;
    ctx.lineWidth = lw(L) * (t >= 3 ? 1.8 : 1.2);
    ctx.stroke(glass);
    if (t >= 2) {
      // flower box under the window
      ctx.fillStyle = '#a0704a';
      ctx.fillRect(wr.x - wr.w * 0.15, wr.y + wr.h, wr.w * 1.3, r.h * 0.07);
      const cols = ['#ff6fa3', '#ffe14a', '#8f6bff', '#ff9f3a'];
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = cols[(i + part.slot) % 4];
        ctx.beginPath();
        ctx.arc(wr.x + wr.w * (0.0 + i * 0.33), wr.y + wr.h - r.h * 0.005, r.w * 0.045, 0, TAU);
        ctx.fill();
      }
    }
    if (t === 4) {
      // a hanging banner beside the window
      ctx.fillStyle = '#ff6fa3';
      ctx.beginPath();
      ctx.moveTo(r.x + r.w * 0.08, r.y + r.h * 0.12);
      ctx.lineTo(r.x + r.w * 0.2, r.y + r.h * 0.12);
      ctx.lineTo(r.x + r.w * 0.2, r.y + r.h * 0.6);
      ctx.lineTo(r.x + r.w * 0.14, r.y + r.h * 0.52);
      ctx.lineTo(r.x + r.w * 0.08, r.y + r.h * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    shield(ctx, r.x + r.w / 2, r.y + r.h * 0.8, r.w * 0.1, sticker, t >= 3, L);
  } else if (s.kind === 'tower' || s.kind === 'spire') {
    const w = r.w * (s.kind === 'spire' ? 0.6 : 0.9);
    const x = r.x + (r.w - w) / 2;
    const body = { x, y: r.y + (s.kind === 'spire' ? r.h * 0.45 : r.h * 0.12), w, h: s.kind === 'spire' ? r.h * 0.55 : r.h * 0.88 };
    stone(ctx, body, L, t === 0);
    // slit windows
    ctx.fillStyle = '#3c3a78';
    const slits = s.rows > 1 ? 2 : 1;
    for (let i = 0; i < slits; i++) {
      ctx.beginPath();
      ctx.roundRect(x + w / 2 - w * 0.07, body.y + body.h * (0.2 + i * 0.4), w * 0.14, body.h * (0.22 / slits) * 1.6, w * 0.07);
      ctx.fill();
    }
    const roofH = s.kind === 'spire' ? r.h * 0.55 : L.rowH * 0.95;
    roof(ctx, x, w, body.y, roofH, t, L);
    const hasFlag = s.i === 16 && castle.built(17);
    if (!hasFlag) flag(ctx, x + w / 2, body.y - roofH + 2, L.rowH * 0.45, ROOF[(t + 2) % 5], t === 0, L);
    if (sticker) shield(ctx, x + w / 2, body.y + body.h * 0.72, w * 0.16, sticker, t >= 3, L);
  } else {
    // the great flag on top of the keep
    const x = r.x + r.w / 2;
    const base = r.y + r.h + L.rowH * 0.05;
    const size = r.h * 1.05;
    ctx.save();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = lw(L) * 1.3;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, base - size);
    ctx.stroke();
    const cloth = makePath();
    const limp = t === 0;
    cloth.moveTo(x, base - size);
    if (limp) {
      cloth.quadraticCurveTo(x + r.w * 0.2, base - size * 0.8, x + r.w * 0.15, base - size * 0.3);
      cloth.lineTo(x, base - size * 0.45);
    } else {
      cloth.quadraticCurveTo(x + r.w * 0.5, base - size * 1.08, x + r.w * 1.0, base - size * 0.82);
      cloth.quadraticCurveTo(x + r.w * 0.55, base - size * 0.55, x, base - size * 0.4);
    }
    cloth.closePath();
    if (t === 4) {
      const g = ctx.createLinearGradient(0, base - size, 0, base - size * 0.4);
      ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#8f6bff'].forEach((c, i) => {
        g.addColorStop(i / 6, c);
        g.addColorStop((i + 1) / 6 - 0.001, c);
      });
      ctx.fillStyle = g;
    } else ctx.fillStyle = ROOF[Math.max(2, t)];
    ctx.fill(cloth);
    ctx.lineWidth = lw(L);
    ctx.stroke(cloth);
    ctx.restore();
    if (sticker) shield(ctx, x + r.w * 0.38, base - size * 0.72, r.w * 0.12, sticker, t >= 3, L);
  }
}

/** the low wall and the gate between the ground parts */
function drawGateWall(ctx: Ctx, castle: Castle, L: Layout) {
  const ground = castle.parts.map((p) => SLOTS[p.slot]).filter((s) => s.row === 0);
  const cols = [GATE_COL, ...ground.map((s) => s.col)];
  const c0 = Math.min(...cols);
  const c1 = Math.max(...cols);
  const h = L.rowH * 0.55;
  stone(ctx, { x: L.x0 + c0 * L.cell + L.cell * 0.3, y: L.y0 - h, w: (c1 - c0) * L.cell + L.cell * 0.4, h }, L);
  // gatehouse
  const g = { x: L.x0 + GATE_COL * L.cell, y: L.y0 - L.rowH, w: L.cell, h: L.rowH };
  stone(ctx, g, L);
  if (!castle.built(8)) crenels(ctx, g.x, g.y, g.w, L);
  const door = gateRect(L);
  const p = archPath(door);
  ctx.fillStyle = '#a0704a';
  ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = 'rgba(70,40,20,0.45)';
  ctx.lineWidth = lw(L);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(door.x + (door.w * i) / 4, door.y);
    ctx.lineTo(door.x + (door.w * i) / 4, door.y + door.h);
    ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw(L) * 1.2;
  ctx.stroke(p);
}

export function gateRect(L: Layout): Rect {
  const w = L.cell * 0.56;
  const h = L.rowH * 0.78;
  return { x: L.x0 + GATE_COL * L.cell + (L.cell - w) / 2, y: L.y0 - h, w, h };
}

/** the open gate (0 closed .. 1 open): a dark archway drawn over the closed door */
export function drawGateOpen(ctx: Ctx, L: Layout, open: number): void {
  if (open <= 0) return;
  const door = gateRect(L);
  ctx.save();
  ctx.globalAlpha = Math.min(1, open);
  ctx.fillStyle = '#2b2350';
  ctx.fill(archPath(door));
  ctx.restore();
}

/** draws the castle without the cache (built in order so upper parts overlap lower ones) */
export function drawCastle(ctx: Ctx, castle: Castle, L: Layout, stickers: Map<number, AnyCanvas>, hide: readonly number[] = []): void {
  drawGateWall(ctx, castle, L);
  const parts = [...castle.parts].filter((p) => !hide.includes(p.slot)).sort((a, b) => SLOTS[a.slot].row - SLOTS[b.slot].row || a.slot - b.slot);
  for (const p of parts) drawPart(ctx, castle, L, p, stickers);
}

/** a part popping into place: k 0..1 grows it from its bottom middle */
export function drawBuildPop(ctx: Ctx, castle: Castle, L: Layout, part: BuiltPart, stickers: Map<number, AnyCanvas>, k: number): void {
  const r = slotRect(L, SLOTS[part.slot]);
  ctx.save();
  ctx.translate(r.x + r.w / 2, r.y + r.h);
  ctx.scale(k, k);
  ctx.translate(-(r.x + r.w / 2), -(r.y + r.h));
  drawPart(ctx, castle, L, part, stickers);
  ctx.restore();
}

export class CastleCache {
  private key = '';
  private img: AnyCanvas | null = null;

  /** the castle as one picture of the whole world size; hide leaves out a part that is still popping in */
  get(castle: Castle, worldW: number, stickers: Map<number, AnyCanvas>, hide: readonly number[] = []): AnyCanvas {
    const key = `${castle.parts.map((p) => p.slot).join(',')}|${worldW}|${hide.join(',')}|${stickers.size}`;
    if (this.img && key === this.key) return this.img;
    const { canvas, ctx } = makeCanvas(Math.round(worldW), WORLD_H);
    drawCastle(ctx, castle, castleLayout(worldW), stickers, hide);
    this.img = canvas;
    this.key = key;
    return canvas;
  }
}

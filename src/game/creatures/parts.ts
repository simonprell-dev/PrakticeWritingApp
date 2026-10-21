// Shared drawing parts for all creatures: bodies, crumple, eyes, mouth, blush, crown, plaster, badge.
import { makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Rand } from '../rng.ts';
import type { EyeStyle, Genome } from './genome.ts';

export interface BlobOpts {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** extra radial shaping per angle (theta = 0 points right), returns factor */
  shape?: (theta: number) => number;
  /** symmetric about the vertical axis */
  mirrorX?: boolean;
  g: Genome;
  points?: number;
}

/** Smooth closed blob; low tiers get wobbly harmonics, crumpled ones become jagged polygons. */
export function blobPath(o: BlobOpts): Path2D {
  const { g } = o;
  const crumpled = g.crumple > 0.5;
  const n = crumpled ? 18 : (o.points ?? 72);
  const pts: [number, number][] = [];
  const jitter = (i: number) => (crumpled ? (((Math.sin(i * 12.9898 + g.seed) * 43758.5453) % 1) + 1) % 1 : 0);
  for (let i = 0; i < n; i++) {
    const th = (i / n) * TAU;
    let f = 1;
    const thSym = o.mirrorX ? Math.abs(Math.atan2(Math.sin(th), Math.abs(Math.cos(th)))) : th;
    g.harmonics.forEach(([a, ph], k) => {
      const kk = k + 2;
      const symPart = Math.cos(kk * thSym + ph);
      const asymPart = Math.cos(kk * th + ph * 1.7);
      f += a * 0.14 * g.wobble * ((1 - g.asym) * symPart + g.asym * asymPart);
    });
    if (crumpled) f *= 0.9 + 0.16 * jitter(i);
    if (o.shape) f *= o.shape(th);
    pts.push([o.cx + Math.cos(th) * o.rx * f, o.cy + Math.sin(th) * o.ry * f]);
  }
  const p = makePath();
  if (crumpled) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  }
  // quadratic curves through midpoints
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const m = mid(a, b);
    p.quadraticCurveTo(a[0], a[1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

export function bodyColor(g: Genome, dl = 0, ds = 0, a = 1): string {
  return hsl(g.hue, g.sat + ds, g.light + dl, a);
}

export function outlineColor(g: Genome): string {
  return hsl(g.hue, Math.min(1, g.sat + 0.1), Math.max(0.12, g.light - 0.38));
}

/** Fill a body path with a soft top-left light and an optional gloss highlight. */
export function shadeBody(ctx: Ctx, path: Path2D, g: Genome, cx: number, cy: number, rx: number, ry: number, base?: string): void {
  const grad = ctx.createRadialGradient(cx - rx * 0.35, cy - ry * 0.45, Math.min(rx, ry) * 0.1, cx, cy, Math.max(rx, ry) * 1.15);
  grad.addColorStop(0, base ? base : bodyColor(g, 0.14));
  grad.addColorStop(0.55, base ? base : bodyColor(g, 0));
  grad.addColorStop(1, bodyColor(g, -0.14));
  ctx.fillStyle = grad;
  ctx.fill(path);
}

export function gloss(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, strength = 0.55): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,255,255,${strength})`;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.38, cy - ry * 0.52, rx * 0.28, ry * 0.14, -0.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${strength * 0.8})`;
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.05, cy - ry * 0.68, rx * 0.07, ry * 0.05, -0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function strokeBody(ctx: Ctx, path: Path2D, g: Genome, width: number): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = outlineColor(g);
  ctx.lineWidth = width;
  ctx.stroke(path);
  if (g.wobble > 0.4) {
    // sketchy second outline, slightly offset
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = width * 0.6;
    ctx.translate(width * 0.5, -width * 0.4);
    ctx.rotate(0.012);
    ctx.stroke(path);
  }
  ctx.restore();
}

/** Crumpled paper: shaded facets and crease lines clipped to the body. */
export function crumpleFacets(ctx: Ctx, path: Path2D, g: Genome, cx: number, cy: number, rx: number, ry: number): void {
  if (g.crumple <= 0) return;
  const r = g.r;
  ctx.save();
  ctx.clip(path);
  const n = Math.round(6 + 10 * g.crumple);
  for (let i = 0; i < n; i++) {
    const x = cx + (r() * 2 - 1) * rx;
    const y = cy + (r() * 2 - 1) * ry;
    const s = (0.3 + r() * 0.5) * Math.max(rx, ry);
    const a = r() * TAU;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
    ctx.lineTo(x + Math.cos(a + 1.9 + r()) * s, y + Math.sin(a + 1.9 + r()) * s);
    ctx.closePath();
    ctx.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.12 * g.crumple})` : `rgba(0,0,0,${0.1 * g.crumple})`;
    ctx.fill();
  }
  ctx.strokeStyle = `rgba(0,0,0,${0.22 * g.crumple})`;
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let i = 0; i < 3 + Math.round(3 * g.crumple); i++) {
    let x = cx + (r() * 2 - 1) * rx * 0.8;
    let y = cy + (r() * 2 - 1) * ry * 0.8;
    const a = r() * TAU;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 3; k++) {
      x += Math.cos(a + (r() - 0.5)) * rx * 0.25;
      y += Math.sin(a + (r() - 0.5)) * ry * 0.25;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Body pattern clipped to the path. */
export function pattern(ctx: Ctx, path: Path2D, g: Genome, cx: number, cy: number, rx: number, ry: number, color?: string): void {
  if (g.pattern === 'none') return;
  const r = g.r;
  const col = color ?? hsl(g.hue2, Math.min(1, g.sat + 0.05), Math.min(0.85, g.light + 0.12), 0.75);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  if (g.pattern === 'stripes') {
    const n = 3 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const x = cx - rx * 0.6 + (i / (n - 1)) * rx * 1.0;
      ctx.beginPath();
      ctx.ellipse(x, cy, rx * 0.07, ry * 1.2, 0.12 * (r() - 0.5), 0, TAU);
      ctx.fill();
    }
  } else if (g.pattern === 'dots' || g.pattern === 'spots') {
    const n = g.pattern === 'dots' ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.8;
      const s = (g.pattern === 'dots' ? 0.07 : 0.15) * Math.min(rx, ry) * (0.7 + r() * 0.6);
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, s * 1.2, s, r(), 0, TAU);
      ctx.fill();
    }
  } else if (g.pattern === 'scales') {
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    const s = Math.min(rx, ry) * 0.22;
    for (let y = cy - ry; y < cy + ry; y += s * 0.8) {
      const off = Math.round((y - cy) / (s * 0.8)) % 2 ? s / 2 : 0;
      for (let x = cx - rx + off; x < cx + rx; x += s) {
        ctx.beginPath();
        ctx.arc(x, y, s / 2, 0.15 * Math.PI, 0.85 * Math.PI);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export interface EyeInfo {
  x: number;
  y: number;
  r: number;
}

/** Big cute eye (or a funny googly one). Returns the eye for live blinking. */
export function eye(ctx: Ctx, x: number, y: number, r: number, style: EyeStyle, rand: Rand, look: [number, number] = [0.25, 0]): EyeInfo {
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(40,30,50,0.9)';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  let px = x + look[0] * r * 0.35;
  let py = y + look[1] * r * 0.35;
  let pr = r * 0.62;
  if (style === 'googly') {
    const a = rand() * TAU;
    px = x + Math.cos(a) * r * 0.42;
    py = y + Math.sin(a) * r * 0.42;
    pr = r * (0.38 + rand() * 0.18);
  }
  ctx.fillStyle = '#2a1d33';
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, TAU);
  ctx.fill();
  if (style !== 'googly') {
    // iris sheen
    ctx.fillStyle = 'rgba(120,90,200,0.35)';
    ctx.beginPath();
    ctx.arc(px, py + pr * 0.35, pr * 0.6, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(px - pr * 0.35, py - pr * 0.38, pr * 0.34, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px + pr * 0.32, py + pr * 0.3, pr * 0.15, 0, TAU);
  ctx.fill();
  if (style === 'sleepy') {
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.strokeStyle = 'rgba(40,30,50,0.9)';
    ctx.beginPath();
    ctx.moveTo(x - r * 1.0, y - r * 0.15);
    ctx.quadraticCurveTo(x, y - r * 0.45, x + r * 1.0, y - r * 0.15);
    ctx.stroke();
  }
  ctx.restore();
  return { x, y, r };
}

export function blush(ctx: Ctx, x: number, y: number, r: number, alpha = 0.45): void {
  ctx.save();
  ctx.fillStyle = `rgba(255,110,150,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export function mouth(ctx: Ctx, x: number, y: number, w: number, kind: 'smile' | 'cat' | 'open' | 'wavy', color = '#3b2238'): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, w * 0.16);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (kind === 'smile') {
    ctx.arc(x, y - w * 0.25, w * 0.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  } else if (kind === 'cat') {
    ctx.moveTo(x - w * 0.5, y);
    ctx.quadraticCurveTo(x - w * 0.25, y + w * 0.35, x, y);
    ctx.quadraticCurveTo(x + w * 0.25, y + w * 0.35, x + w * 0.5, y);
    ctx.stroke();
  } else if (kind === 'open') {
    ctx.fillStyle = '#7a2340';
    ctx.ellipse(x, y, w * 0.3, w * 0.36, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ff8fa8';
    ctx.beginPath();
    ctx.ellipse(x, y + w * 0.16, w * 0.18, w * 0.12, 0, 0, TAU);
    ctx.fill();
  } else {
    ctx.moveTo(x - w * 0.55, y);
    for (let i = 1; i <= 4; i++) ctx.quadraticCurveTo(x - w * 0.55 + (i - 0.5) * w * 0.275, y + (i % 2 ? w * 0.22 : -w * 0.05), x - w * 0.55 + i * w * 0.275, y + w * 0.08);
    ctx.stroke();
  }
  ctx.restore();
}

export function crown(ctx: Ctx, x: number, y: number, w: number, tilt = -0.15): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  const h = w * 0.7;
  const grad = ctx.createLinearGradient(0, -h, 0, 0);
  grad.addColorStop(0, '#fff3a0');
  grad.addColorStop(1, '#f2b705');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#a86b00';
  ctx.lineWidth = Math.max(1.5, w * 0.05);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(-w / 2, -h * 0.55);
  ctx.lineTo(-w / 4, -h * 0.25);
  ctx.lineTo(0, -h);
  ctx.lineTo(w / 4, -h * 0.25);
  ctx.lineTo(w / 2, -h * 0.55);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const gems = ['#ff4f81', '#3fc1ff', '#7cff6b'];
  [-w / 4, 0, w / 4].forEach((gx, i) => {
    ctx.fillStyle = gems[i];
    ctx.beginPath();
    ctx.arc(gx, -h * 0.18, w * 0.07, 0, TAU);
    ctx.fill();
  });
  ctx.fillStyle = '#fff';
  for (const [px, py] of [
    [-w / 2, -h * 0.55],
    [0, -h],
    [w / 2, -h * 0.55],
  ]) {
    ctx.beginPath();
    ctx.arc(px, py, w * 0.06, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

export function bandaid(ctx: Ctx, x: number, y: number, w: number, angle: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const h = w * 0.36;
  ctx.fillStyle = '#f7c7a1';
  ctx.strokeStyle = '#c98f63';
  ctx.lineWidth = Math.max(1, w * 0.04);
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe2cc';
  ctx.fillRect(-w * 0.16, -h / 2 + 1, w * 0.32, h - 2);
  ctx.fillStyle = '#c98f63';
  for (const [dx, dy] of [
    [-0.06, -0.1],
    [0.06, -0.1],
    [-0.06, 0.1],
    [0.06, 0.1],
  ]) {
    ctx.beginPath();
    ctx.arc(dx * w, dy * w, w * 0.02, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** White badge with the child's handwriting inside. */
export function badge(ctx: Ctx, x: number, y: number, r: number, sticker: AnyCanvas | null, ring = 'rgba(0,0,0,0.25)'): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  ctx.strokeStyle = ring;
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.stroke();
  if (sticker) {
    const s = (r * 1.45) / Math.max(sticker.width, sticker.height);
    const w = sticker.width * s;
    const h = sticker.height * s;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sticker as CanvasImageSource, x - w / 2, y - h / 2, w, h);
  }
  ctx.restore();
}

export function sparkleStar(ctx: Ctx, x: number, y: number, r: number, color = '#fff8c4'): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Soft glow halo around top tier creatures (baked into the sprite). */
export function aura(ctx: Ctx, cx: number, cy: number, r: number, hue: number): void {
  const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.25);
  g.addColorStop(0, hsl(hue, 1, 0.8, 0.35));
  g.addColorStop(1, hsl(hue, 1, 0.8, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.25, 0, TAU);
  ctx.fill();
}

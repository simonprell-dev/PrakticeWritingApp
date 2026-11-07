// Home-made St. Martin's lanterns with a face (side view, facing right): a crescent moon, a puffy star, a round
// paper lampion with stripes and an owl. Each glows warmly from inside, has a wire handle on top, crepe paper
// streamers below and two little feet to walk in the lantern procession.
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../../canvas.ts';
import { clamp, hsl, TAU } from '../../math.ts';
import type { Genome } from '../genome.ts';
import * as P from '../parts.ts';
import type { Sprite } from '../sprite.ts';

export const MARTIN_KINDS = ['Mond-Laterne', 'Stern-Laterne', 'Lampion', 'Eulen-Laterne'];

/** which kind a genome hatches as (0 moon, 1 star, 2 lampion, 3 owl) */
export const martinKind = (g: Genome): number => g.variant % MARTIN_KINDS.length;

const RAINBOW = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];
/** bright paper colours for stars and lampions */
const PAPER = [4, 22, 44, 130, 195, 265, 320];

/** the genome with the colours of the kind; paler on low tiers like the other worlds */
function tinted(g: Genome, hue: number, sat: number, light: number): Genome {
  const f = clamp(g.sat / 0.75, 0.4, 1.15);
  return { ...g, hue, sat: Math.min(1, sat * f), light };
}

const paperHue = (g: Genome): number => PAPER[Math.floor((((g.hue % 360) + 360) % 360) / (360 / PAPER.length)) % PAPER.length];

/** outline wobble of a body point at angle th (same harmonics as P.blobPath) */
function wob(g: Genome, th: number): number {
  let f = 1;
  g.harmonics.forEach(([a, ph], k) => {
    const kk = k + 2;
    f += a * 0.14 * g.wobble * ((1 - g.asym) * Math.cos(kk * th + ph) + g.asym * Math.cos(kk * th + ph * 1.7));
  });
  return f;
}

const jit = (g: Genome, i: number) => (((Math.sin(i * 12.9898 + g.seed) * 43758.5453) % 1) + 1) % 1;

/** a closed path through points: smooth curves, or straight jagged edges when crumpled */
function outline(pts: [number, number][], crumpled: boolean): Path2D {
  const p = makePath();
  const n = pts.length;
  if (crumpled) {
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(pts[i][0], pts[i][1]);
    p.closePath();
    return p;
  }
  const mid = (a: [number, number], b: [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const m0 = mid(pts[n - 1], pts[0]);
  p.moveTo(m0[0], m0[1]);
  for (let i = 0; i < n; i++) {
    const m = mid(pts[i], pts[(i + 1) % n]);
    p.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
  }
  p.closePath();
  return p;
}

/** a body around (cx, cy) with a radial shape; crumpled bodies get fewer, jittered corners */
function radialBody(g: Genome, cx: number, cy: number, rx: number, ry: number, shape: (th: number) => number, n: number): Path2D {
  const crumpled = g.crumple > 0.5;
  const m = crumpled ? Math.round(n * 0.45) : n;
  const pts: [number, number][] = [];
  for (let i = 0; i < m; i++) {
    const th = (i / m) * TAU;
    let f = wob(g, th) * shape(th);
    if (crumpled) f *= 0.93 + 0.12 * jit(g, i);
    pts.push([cx + Math.cos(th) * rx * f, cy + Math.sin(th) * ry * f]);
  }
  return outline(pts, crumpled);
}

/** soft warm light around the lantern (baked into the sprite) */
function halo(ctx: Ctx, x: number, y: number, r: number, k: number): void {
  const gr = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 1.45);
  gr.addColorStop(0, `rgba(255,200,95,${0.42 * k})`);
  gr.addColorStop(1, 'rgba(255,190,80,0)');
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.arc(x, y, r * 1.45, 0, TAU);
  ctx.fill();
}

/** the candle light shining through the paper */
function innerGlow(ctx: Ctx, body: Path2D, x: number, y: number, r: number, k: number): void {
  ctx.save();
  ctx.clip(body);
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(255,250,205,${0.85 * k})`);
  gr.addColorStop(0.45, `rgba(255,226,140,${0.5 * k})`);
  gr.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** how strongly a lantern glows: dim when crumpled, bright when beautiful */
const glowOf = (g: Genome) => 0.35 + 0.65 * g.q;

/** wire handle over the lantern with a little ring on top; returns the ring top */
function handle(ctx: Ctx, cx: number, topY: number, half: number, rise: number, lw: number): { x: number; y: number } {
  ctx.save();
  ctx.strokeStyle = '#5b5560';
  ctx.lineWidth = Math.max(1.5, lw * 0.6);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - half, topY);
  ctx.quadraticCurveTo(cx, topY - rise * 1.6, cx + half, topY);
  ctx.stroke();
  const ry = topY - rise * 0.8 - lw * 1.6;
  ctx.lineWidth = Math.max(1.5, lw * 0.7);
  ctx.beginPath();
  ctx.arc(cx, ry, lw * 1.6, 0, TAU);
  ctx.stroke();
  ctx.restore();
  return { x: cx, y: ry - lw * 1.6 };
}

/** crepe paper streamers hanging from (x, y), drifting back (to the left) */
function streamers(ctx: Ctx, g: Genome, x: number, y: number, len: number, lw: number): void {
  const n = g.rainbow ? 5 : g.q > 0.7 ? 4 : g.q > 0.3 ? 3 : 2;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const col = g.rainbow ? RAINBOW[(i * 2) % RAINBOW.length] : hsl(g.hue2 + i * 25, Math.max(0.35, g.sat), 0.6);
    const sx = x - i * lw * 1.6;
    const l = len * (0.75 + 0.25 * ((i * 37) % 5) / 4);
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2.5, lw * 1.5);
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.bezierCurveTo(sx - l * 0.25, y + l * 0.3, sx + l * 0.05, y + l * 0.6, sx - l * 0.3, y + l);
    ctx.stroke();
  }
  ctx.restore();
}

/** two little feet under the lantern */
function feet(ctx: Ctx, g: Genome, cx: number, y: number, w: number, lw: number): void {
  for (const [fx, f] of [
    [cx - w * 0.55, 1],
    [cx + w * 0.45, g.wobble > 0.4 ? 0.7 : 1],
  ] as const) {
    const foot = makePath();
    foot.ellipse(fx + w * 0.12, y, w * 0.4 * f, w * 0.2, 0, 0, TAU);
    ctx.fillStyle = '#5a3d34';
    ctx.fill(foot);
    P.strokeBody(ctx, foot, { ...g, hue: 15, sat: 0.3, light: 0.4 }, lw * 0.7);
  }
}

function face(ctx: Ctx, g: Genome, fx: number, fy: number, er: number, mouthW: number): P.EyeInfo[] {
  const eyes: P.EyeInfo[] = [];
  eyes.push(P.eye(ctx, fx, fy, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, fx - er * 1.6, fy - er * 0.15, er * 0.65, 'googly', g.r));
  P.blush(ctx, fx + er * 0.45, fy + er * 1.35, er * 0.55);
  P.mouth(ctx, fx + er * 0.25, fy + er * 1.75, mouthW, g.wobble > 0.4 ? 'wavy' : 'smile');
  return eyes;
}

function sparkles(ctx: Ctx, g: Genome, cx: number, cy: number, r: number): void {
  if (!g.sparkle) return;
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI * 0.9 + i * 0.6 + g.r() * 0.3;
    P.sparkleStar(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * (0.09 + g.r() * 0.05));
  }
}

/** everything around the body that all lanterns share */
interface Frame {
  canvas: AnyCanvas;
  ctx: Ctx;
  L: number;
  R: number;
  cx: number;
  cy: number;
  lw: number;
}

function frame(g: Genome, scale: number): Frame {
  const L = 200 * g.size;
  const R = L * 0.3 * scale;
  const W = Math.ceil(R * 3.0 + L * 0.12);
  const H = Math.ceil(R * 3.3 + L * 0.2);
  const { canvas, ctx } = makeCanvas(W, H);
  const lw = Math.max(2.5, L * 0.017);
  return { canvas, ctx, L, R, cx: W / 2, cy: R * 1.62 + L * 0.06, lw };
}

/** what every lantern draws before its body */
function before(f: Frame, g: Genome, bottom: number, topY: number, half: number): { x: number; y: number } {
  const { ctx, R, cx, cy, lw } = f;
  if (g.sparkle) P.aura(ctx, cx, cy, R * 1.3, 45);
  halo(ctx, cx, cy, R, glowOf(g));
  streamers(ctx, g, cx - R * 0.25, bottom - lw, R * 0.9, lw);
  feet(ctx, g, cx, bottom + R * 0.08, R * 0.32, lw);
  return handle(ctx, cx, topY, half, R * 0.4, lw);
}

function finish(f: Frame, g: Genome, sticker: AnyCanvas | null, badgeAt: { x: number; y: number; r: number }, eyes: P.EyeInfo[], lid: string, ring: { x: number; y: number }, plaster: [number, number]): Sprite {
  const { ctx, L, R, cx, cy } = f;
  if (g.bandaid) P.bandaid(ctx, plaster[0], plaster[1], L * 0.13, 0.45);
  if (g.crown) P.crown(ctx, ring.x, ring.y + L * 0.01, L * 0.16, 0.1);
  sparkles(ctx, g, cx, cy, R * 1.25);
  return { canvas: f.canvas, badge: badgeAt, sticker, ax: cx, ay: cy, radius: R, eyes, lid, top: { x: ring.x, y: ring.y - L * 0.04 } };
}

export function martinSprite(g: Genome, sticker: AnyCanvas | null): Sprite {
  const k = martinKind(g);
  if (k === 0) return moon(g, sticker);
  if (k === 1) return star(g, sticker);
  if (k === 2) return lampion(g, sticker);
  return owl(g, sticker);
}

// ---------------------------------------------------------------- moon

function moon(g: Genome, sticker: AnyCanvas | null): Sprite {
  const f = frame(g, 1.08);
  const { ctx, R, cx, cy, lw } = f;
  const kg = tinted(g, 46 + ((g.hue % 16) - 8), 0.9, 0.64);
  // crescent: the outer circle without a circle bitten out at the back (upper left)
  const ccx = -0.92 * R;
  const ccy = -0.42 * R;
  const rc = 0.8 * R;
  const crumpled = g.crumple > 0.5;
  const n = crumpled ? 30 : 90;
  const d = Math.hypot(ccx, ccy);
  const a = (R * R - rc * rc + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, R * R - a * a));
  const bx = (a * ccx) / d;
  const by = (a * ccy) / d;
  const i1: [number, number] = [bx - (h * ccy) / d, by + (h * ccx) / d];
  const i2: [number, number] = [bx + (h * ccy) / d, by - (h * ccx) / d];
  let t1 = Math.atan2(i1[1], i1[0]);
  let t2 = Math.atan2(i2[1], i2[0]);
  // the outer arc goes the long way round (away from the bite)
  const away = Math.atan2(-ccy, -ccx);
  const norm = (x: number) => ((x % TAU) + TAU) % TAU;
  if (norm(away - t1) > norm(t2 - t1)) [t1, t2] = [t2, t1];
  const sweep = norm(t2 - t1);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const th = t1 + (sweep * i) / n;
    let w = wob(g, th);
    if (crumpled) w *= 0.94 + 0.1 * jit(g, i);
    pts.push([cx + Math.cos(th) * R * w, cy + Math.sin(th) * R * w]);
  }
  // back along the bite, the short way (inside the outer circle)
  const p1 = Math.atan2(i2[1] - ccy, i2[0] - ccx);
  const p2 = Math.atan2(i1[1] - ccy, i1[0] - ccx);
  let ps = norm(p2 - p1);
  const midIn = (s: number) => {
    const ph = p1 + s / 2;
    return Math.hypot(ccx + Math.cos(ph) * rc, ccy + Math.sin(ph) * rc) < R;
  };
  if (!midIn(ps)) ps = ps - TAU;
  const m = Math.round(n * 0.6);
  for (let i = 1; i < m; i++) {
    const ph = p1 + (ps * i) / m;
    const x = ccx + Math.cos(ph) * rc;
    const y = ccy + Math.sin(ph) * rc;
    let w = wob(g, Math.atan2(y, x) + 1);
    if (crumpled) w *= 0.96 + 0.08 * jit(g, i + 100);
    pts.push([cx + x * w, cy + y * w]);
  }
  const body = outline(pts, crumpled);
  const top = before(f, g, cy + R * 0.98, cy - R * 0.92, R * 0.42);
  P.shadeBody(ctx, body, kg, cx, cy, R, R);
  innerGlow(ctx, body, cx + R * 0.35, cy + R * 0.2, R * 1.0, glowOf(g));
  P.pattern(ctx, body, g, cx + R * 0.3, cy + R * 0.1, R * 0.7, R * 0.8, 'rgba(255,255,255,0.5)');
  // a few craters
  ctx.save();
  ctx.clip(body);
  ctx.fillStyle = hsl(kg.hue, kg.sat, kg.light - 0.12, 0.35);
  for (const [ox, oy, rr] of [
    [0.72, 0.55, 0.1],
    [0.15, 0.72, 0.08],
    [0.82, -0.05, 0.07],
  ]) {
    ctx.beginPath();
    ctx.arc(cx + ox * R, cy + oy * R, rr * R, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  P.crumpleFacets(ctx, body, g, cx + R * 0.3, cy, R * 0.8, R);
  if (g.glossy) P.gloss(ctx, cx + R * 0.55, cy + R * 0.15, R * 0.5, R * 0.8, 0.4);
  P.strokeBody(ctx, body, { ...kg, light: kg.light + 0.04 }, lw);
  const badgeAt = { x: cx + R * 0.3, y: cy + R * 0.38, r: R * 0.36 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const er = R * (0.15 + 0.03 * g.q);
  const eyes: P.EyeInfo[] = [];
  eyes.push(P.eye(ctx, cx + R * 0.52, cy - R * 0.32, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, cx + R * 0.24, cy - R * 0.3, er * 0.65, 'googly', g.r));
  P.blush(ctx, cx + R * 0.74, cy - R * 0.08, er * 0.6);
  P.mouth(ctx, cx + R * 0.72, cy + R * 0.04, R * 0.16, g.wobble > 0.4 ? 'wavy' : 'smile');
  return finish(f, g, sticker, badgeAt, eyes, P.bodyColor(kg, 0.04), top, [cx + R * 0.6, cy + R * 0.6]);
}

// ---------------------------------------------------------------- star

function star(g: Genome, sticker: AnyCanvas | null): Sprite {
  const f = frame(g, 1.08);
  const { ctx, R, cx, cy, lw } = f;
  const kg = tinted(g, paperHue(g), 0.85, 0.62);
  const tilt = g.wobble > 0.4 ? 0.12 : 0;
  const shape = (th: number) => 0.6 + 0.4 * Math.pow((1 + Math.cos(5 * (th + Math.PI / 2 - tilt))) / 2, 1.5);
  const body = radialBody(g, cx, cy, R, R, shape, 150);
  const top = before(f, g, cy + R * 0.82, cy - R * 0.9, R * 0.16);
  P.shadeBody(ctx, body, kg, cx, cy, R, R);
  innerGlow(ctx, body, cx, cy + R * 0.05, R * 0.95, glowOf(g));
  P.pattern(ctx, body, g, cx, cy, R * 0.8, R * 0.8, 'rgba(255,255,255,0.45)');
  P.crumpleFacets(ctx, body, g, cx, cy, R, R);
  // paper fold lines from the middle to the points
  ctx.save();
  ctx.clip(body);
  ctx.strokeStyle = hsl(kg.hue, kg.sat, kg.light - 0.18, 0.35);
  ctx.lineWidth = Math.max(1.2, lw * 0.5);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + tilt + (i * TAU) / 5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * R * 0.45, cy + Math.sin(a) * R * 0.45);
    ctx.lineTo(cx + Math.cos(a) * R * 0.95, cy + Math.sin(a) * R * 0.95);
    ctx.stroke();
  }
  ctx.restore();
  if (g.glossy) P.gloss(ctx, cx, cy, R * 0.75, R * 0.75, 0.45);
  P.strokeBody(ctx, body, kg, lw);
  const badgeAt = { x: cx - R * 0.08, y: cy + R * 0.17, r: R * 0.36 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const er = R * (0.14 + 0.03 * g.q);
  const eyes: P.EyeInfo[] = [];
  eyes.push(P.eye(ctx, cx + R * 0.36, cy - R * 0.28, er, g.eyeStyle, g.r, [0.45, 0]));
  if (g.eyeStyle === 'googly') eyes.push(P.eye(ctx, cx + R * 0.08, cy - R * 0.33, er * 0.65, 'googly', g.r));
  P.blush(ctx, cx + R * 0.52, cy - R * 0.03, er * 0.6);
  P.mouth(ctx, cx + R * 0.44, cy + R * 0.1, R * 0.14, g.wobble > 0.4 ? 'wavy' : 'smile');
  return finish(f, g, sticker, badgeAt, eyes, P.bodyColor(kg, 0.04), top, [cx - R * 0.55, cy - R * 0.05]);
}

// ---------------------------------------------------------------- lampion

function lampion(g: Genome, sticker: AnyCanvas | null): Sprite {
  const f = frame(g, 1);
  const { ctx, R, cx, cy, lw } = f;
  const kg = tinted(g, paperHue(g), 0.85, 0.6);
  const rx = R;
  const ry = R * 0.86;
  const body = P.blobPath({ cx, cy, rx, ry, g });
  const capW = R * 0.5;
  const capH = R * 0.16;
  const top = before(f, g, cy + ry + capH * 0.6, cy - ry - capH * 0.5, capW * 0.42);
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  // curved stripes like on a paper globe
  ctx.save();
  ctx.clip(body);
  const n = 7;
  for (let i = 0; i < n; i++) {
    if (!g.rainbow && i % 2 === 0) continue;
    const a0 = -1 + (2 * i) / n;
    const a1 = -1 + (2 * (i + 1)) / n;
    const band = makePath();
    // the strip between two meridians: right edge forwards, left edge back
    for (let k = 0; k <= 24; k++) {
      const t = -Math.PI / 2 + (Math.PI * k) / 24;
      const x = cx + a1 * rx * Math.cos(t) * 1.05;
      const y = cy + Math.sin(t) * ry * 1.05;
      if (k === 0) band.moveTo(x, y);
      else band.lineTo(x, y);
    }
    for (let k = 24; k >= 0; k--) {
      const t = -Math.PI / 2 + (Math.PI * k) / 24;
      band.lineTo(cx + a0 * rx * Math.cos(t) * 1.05, cy + Math.sin(t) * ry * 1.05);
    }
    band.closePath();
    ctx.fillStyle = g.rainbow ? RAINBOW[i % RAINBOW.length] : hsl(g.hue2, Math.max(0.35, kg.sat), 0.72, 0.85);
    ctx.fill(band);
  }
  // paper ribs
  ctx.strokeStyle = hsl(kg.hue, kg.sat, kg.light - 0.2, 0.4);
  ctx.lineWidth = Math.max(1.2, lw * 0.45);
  for (let k = 1; k < 6; k++) {
    const y = cy - ry + (2 * ry * k) / 6;
    ctx.beginPath();
    ctx.ellipse(cx, y, rx * Math.sqrt(1 - ((y - cy) / ry) ** 2), rx * 0.06, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  innerGlow(ctx, body, cx, cy + R * 0.05, R * 1.05, glowOf(g));
  P.pattern(ctx, body, g, cx, cy, rx * 0.8, ry * 0.8, 'rgba(255,255,255,0.4)');
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.42);
  P.strokeBody(ctx, body, kg, lw);
  // cardboard rims at the top and the bottom
  const rimG: Genome = { ...g, hue: 25, sat: 0.35, light: 0.42 };
  for (const [y, w] of [
    [cy - ry - capH * 0.1, capW],
    [cy + ry + capH * 0.1, capW * 0.85],
  ] as const) {
    const rim = makePath();
    rim.roundRect(cx - w / 2, y - capH / 2, w, capH, capH * 0.35);
    ctx.fillStyle = '#7a5a48';
    ctx.fill(rim);
    P.strokeBody(ctx, rim, rimG, lw * 0.8);
  }
  const badgeAt = { x: cx - R * 0.15, y: cy + R * 0.14, r: R * 0.4 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  const er = R * (0.15 + 0.03 * g.q);
  const eyes = face(ctx, g, cx + R * 0.48, cy - R * 0.36, er, R * 0.16);
  return finish(f, g, sticker, badgeAt, eyes, P.bodyColor(kg, 0.04), top, [cx - R * 0.55, cy - R * 0.4]);
}

// ---------------------------------------------------------------- owl

function owl(g: Genome, sticker: AnyCanvas | null): Sprite {
  const f = frame(g, 1);
  const { ctx, R, cx, cy, lw } = f;
  const kg = tinted(g, 26 + ((g.hue % 24) - 12), 0.7, 0.55);
  const rx = R * 0.9;
  const ry = R;
  // ear tufts
  for (const [ex, a] of [
    [-0.42, -0.35],
    [0.5, 0.3],
  ] as const) {
    const t = makePath();
    const bx = cx + ex * rx;
    const by = cy - ry * 0.75;
    t.moveTo(bx - R * 0.2, by + R * 0.05);
    t.quadraticCurveTo(bx + Math.sin(a) * R * 0.3, by - R * 0.45, bx + Math.sin(a) * R * 0.32, by - R * 0.42);
    t.quadraticCurveTo(bx + R * 0.1, by - R * 0.15, bx + R * 0.22, by + R * 0.05);
    t.closePath();
    ctx.fillStyle = P.bodyColor(kg, -0.06);
    ctx.fill(t);
    P.strokeBody(ctx, t, kg, lw * 0.8);
  }
  const body = P.blobPath({ cx, cy, rx, ry, g, shape: (th) => 1 - 0.06 * Math.max(0, -Math.sin(th)) });
  const top = before(f, g, cy + ry * 0.98, cy - ry * 0.95, R * 0.2);
  P.shadeBody(ctx, body, kg, cx, cy, rx, ry);
  innerGlow(ctx, body, cx + R * 0.05, cy + R * 0.25, R * 1.0, glowOf(g));
  P.pattern(ctx, body, g, cx, cy, rx, ry, hsl(kg.hue, kg.sat, kg.light + 0.15, 0.6));
  ctx.save();
  ctx.clip(body);
  // light belly with paper feathers
  ctx.fillStyle = hsl(44, Math.max(0.4, kg.sat), 0.82, 0.9);
  ctx.beginPath();
  ctx.ellipse(cx + R * 0.1, cy + R * 0.38, rx * 0.66, ry * 0.6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = g.rainbow ? 'rgba(0,0,0,0)' : hsl(kg.hue, kg.sat, kg.light - 0.05, 0.55);
  ctx.lineWidth = Math.max(1.5, lw * 0.55);
  let row = 0;
  for (let y = cy + R * 0.0; y < cy + R; y += R * 0.2, row++) {
    for (let x = cx - R * 0.5 + (row % 2) * R * 0.1; x < cx + R * 0.75; x += R * 0.2) {
      if (g.rainbow) ctx.strokeStyle = RAINBOW[(row + Math.round(x)) % RAINBOW.length];
      ctx.beginPath();
      ctx.arc(x, y, R * 0.09, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
  // wing at the side
  const wing = makePath();
  wing.ellipse(cx - rx * 0.55, cy + ry * 0.2, rx * 0.28, ry * 0.5, g.wobble > 0.4 ? 0.5 : 0.2, 0, TAU);
  ctx.fillStyle = P.bodyColor(kg, -0.07);
  ctx.fill(wing);
  P.strokeBody(ctx, wing, kg, lw * 0.8);
  P.crumpleFacets(ctx, body, g, cx, cy, rx, ry);
  if (g.glossy) P.gloss(ctx, cx, cy, rx, ry, 0.38);
  P.strokeBody(ctx, body, kg, lw);
  const badgeAt = { x: cx + R * 0.12, y: cy + R * 0.42, r: R * 0.36 };
  P.badge(ctx, badgeAt.x, badgeAt.y, badgeAt.r, null);
  // facial discs and big eyes
  const er = R * (0.17 + 0.03 * g.q);
  const ex1 = cx - R * 0.02;
  const ex2 = cx + R * 0.48;
  const ey = cy - R * 0.36;
  ctx.fillStyle = hsl(44, Math.max(0.4, kg.sat), 0.86);
  for (const ex of [ex1, ex2]) {
    ctx.beginPath();
    ctx.arc(ex, ey, er * 1.45, 0, TAU);
    ctx.fill();
  }
  const eyes: P.EyeInfo[] = [];
  eyes.push(P.eye(ctx, ex1, ey, er * 0.9, g.eyeStyle, g.r, [0.45, 0]));
  eyes.push(P.eye(ctx, ex2, ey, er, g.eyeStyle, g.r, [0.45, 0]));
  // beak
  const beak = makePath();
  beak.moveTo(cx + R * 0.18, cy - R * 0.2);
  beak.lineTo(cx + R * 0.34, cy - R * 0.2);
  beak.lineTo(cx + R * 0.27, cy - R * 0.02);
  beak.closePath();
  ctx.fillStyle = hsl(38, 0.9 * clamp(g.sat / 0.6, 0.6, 1), 0.55);
  ctx.fill(beak);
  P.strokeBody(ctx, beak, { ...g, hue: 30, sat: 0.7, light: 0.55 }, lw * 0.6);
  P.blush(ctx, ex2 + er * 0.9, ey + er * 1.4, er * 0.55);
  return finish(f, g, sticker, badgeAt, eyes, hsl(44, Math.max(0.4, kg.sat), 0.86), top, [cx - R * 0.5, cy - R * 0.1]);
}

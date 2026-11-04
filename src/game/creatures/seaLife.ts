// Rechenmeer: the sea animals a right answer brings. The outlines are the animals of the Mal-Aquarium, here
// coloured by the genome (no child painting), with the child's number on a white badge. The starfish is new.
import { cardImage } from '../paint/cardArt.ts';
import { SPECIES, type Motion, type SpeciesId } from '../paint/species.ts';
import { makeCanvas, makePath, type AnyCanvas, type Ctx } from '../canvas.ts';
import { hsl, TAU } from '../math.ts';
import type { Genome } from './genome.ts';
import { paintedSprite } from './paintedAnimal.ts';
import * as P from './parts.ts';
import type { Sprite } from './sprite.ts';

export type SeaAnimal = 'seepferdchen' | 'clownfisch' | 'doktorfisch' | 'kugelfisch' | 'qualle' | 'krebs' | 'schildkroete' | 'krake' | 'seestern';
export const SEA_ANIMALS: readonly SeaAnimal[] = ['seepferdchen', 'clownfisch', 'doktorfisch', 'kugelfisch', 'qualle', 'krebs', 'schildkroete', 'krake', 'seestern'];

/** animals that live on the sand */
export const ON_SAND: ReadonlySet<SeaAnimal> = new Set(['krebs', 'schildkroete', 'seestern']);

export function seaMotion(kind: SeaAnimal): Motion {
  return kind === 'seestern' ? 'walk' : SPECIES[kind as SpeciesId].motion;
}

/** px per animal unit in the scene (the Mal-Aquarium uses 2.5 · species size) */
const K = 2.1;
const PAD = 26;
/** the largest body radius of an animal (px) */
const MAX_R = 84;

/** the colours of the parts: the body in the genome's colour, fins and the rest in its second colour */
function fills(kind: SpeciesId, g: Genome): Record<string, string> {
  const out: Record<string, string> = {};
  const second = (dl: number) => hsl(g.hue2, Math.min(1, g.sat + 0.05), Math.min(0.85, g.light + dl));
  SPECIES[kind].parts.forEach((p, i) => {
    if (p.id === 'body' || p.id === 'shell' || p.id === 'bell' || p.id === 'head') out[p.id] = P.bodyColor(g);
    else out[p.id] = second(i % 2 ? 0.08 : -0.02);
  });
  // the clownfish keeps its orange, the stripes are its white parts
  if (kind === 'clownfisch') for (const id of Object.keys(out)) if (id !== 'body') out[id] = hsl(28, g.sat, g.light + 0.05);
  return out;
}

function starfish(g: Genome): Sprite {
  const R = 40 * g.size;
  const W = Math.ceil(2 * R + 2 * PAD);
  const { canvas, ctx } = makeCanvas(W, W);
  const cx = W / 2;
  const cy = W / 2;
  const path = makePath();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const r = i % 2 ? R * 0.45 : R;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 9;
  ctx.stroke(path);
  P.shadeBody(ctx, path, g, cx, cy, R, R);
  if (g.pattern !== 'none') P.pattern(ctx, path, g, cx, cy, R, R);
  ctx.lineWidth = 3;
  ctx.strokeStyle = P.outlineColor(g);
  ctx.stroke(path);
  const eyes = [P.eye(ctx, cx - R * 0.16, cy - R * 0.28, R * 0.1, g.eyeStyle, g.r), P.eye(ctx, cx + R * 0.16, cy - R * 0.28, R * 0.1, g.eyeStyle, g.r)];
  P.mouth(ctx, cx, cy - R * 0.08, R * 0.16, 'smile');
  return { canvas, ax: cx, ay: cy, radius: R, eyes, lid: P.bodyColor(g), top: { x: cx, y: cy - R }, motion: 'walk' };
}

/** a sea animal for a right answer; the badge in the middle of its body shows the child's number */
export function seaSprite(kind: SeaAnimal, g: Genome, sticker: AnyCanvas | null): Sprite {
  let base: Sprite;
  if (kind === 'seestern') base = starfish(g);
  else {
    const img = cardImage({ species: kind, fills: fills(kind, g) });
    const k = K * SPECIES[kind].size * g.size;
    base = paintedSprite(kind, img, k);
    // big animals in their biggest size stay inside the sea's scale
    if (base.radius > MAX_R) base = paintedSprite(kind, img, (k * MAX_R) / base.radius);
  }
  // a frame around the animal for the glow, the crown and the sparkles
  const W = base.canvas.width + 2 * PAD;
  const H = base.canvas.height + 2 * PAD;
  const { canvas, ctx } = makeCanvas(W, H);
  const ax = base.ax + PAD;
  const ay = base.ay + PAD;
  if (g.tier === 'prachtvoll') P.aura(ctx, ax, ay, base.radius, g.hue);
  ctx.drawImage(base.canvas as CanvasImageSource, PAD, PAD);
  if (g.glossy) P.gloss(ctx, ax - base.radius * 0.2, ay - base.radius * 0.25, base.radius * 0.35, base.radius * 0.2, 0.35);
  if (g.crumple > 0.5) {
    // crumpled paper: a few soft creases over the animal
    ctx.strokeStyle = 'rgba(60,40,60,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(ax + (g.r() - 0.5) * base.radius, ay + (g.r() - 0.5) * base.radius);
      ctx.lineTo(ax + (g.r() - 0.5) * base.radius, ay + (g.r() - 0.5) * base.radius);
      ctx.stroke();
    }
  }
  if (g.sparkle) for (let i = 0; i < 4; i++) P.sparkleStar(ctx, ax + (g.r() - 0.5) * base.radius * 1.8, ay + (g.r() - 0.5) * base.radius * 1.6, 5 + g.r() * 5);
  const top = { x: base.top.x + PAD, y: base.top.y + PAD };
  if (g.crown) P.crown(ctx, top.x, top.y + 4, Math.max(26, base.radius * 0.45));
  const br = Math.max(16, base.radius * 0.36);
  const badge = { x: ax, y: ay + (kind === 'seestern' ? base.radius * 0.18 : 0), r: br };
  // the badge never covers an eye (the octopus has its eyes in the middle of its body)
  for (const e of base.eyes) {
    const ex = e.x + PAD;
    const ey = e.y + PAD;
    if (Math.hypot(ex - badge.x, ey - badge.y) < br + e.r) badge.y = Math.max(badge.y, ey + e.r + br + 2);
  }
  P.badge(ctx, badge.x, badge.y, badge.r, null);
  const shift = (e: { x: number; y: number; r: number }) => ({ ...e, x: e.x + PAD, y: e.y + PAD });
  return {
    canvas,
    ax,
    ay,
    radius: base.radius,
    eyes: base.eyes.map(shift),
    lid: base.lid,
    ...(base.tail ? { tail: { ...base.tail, px: base.tail.px + PAD, py: base.tail.py + PAD } } : {}),
    top,
    badge,
    sticker,
    motion: seaMotion(kind),
  };
}

let shark: Sprite | null = null;

/** the friendly shark of the big moment, (x, y) its middle, s its scale (1 ≈ 360 px long), facing right */
export function drawShark(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  shark ??= paintedSprite('hai', cardImage({ species: 'hai', fills: { body: '#7fa6c9', tail: '#6b93b8', dorsal: '#6b93b8', pelvic: '#9cbbd6', pectoral: '#9cbbd6' } }), 3.6);
  const sp = shark;
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 1.6) * 6);
  ctx.scale(s, s);
  if (sp.tail) {
    ctx.save();
    ctx.translate(sp.tail.px - sp.ax, sp.tail.py - sp.ay);
    ctx.rotate(Math.sin(t * 5) * 0.25);
    ctx.drawImage(sp.tail.canvas as CanvasImageSource, -sp.tail.pivotX, -sp.tail.pivotY);
    ctx.restore();
  }
  ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
  // a happy cheek, so nobody is afraid of him
  const e = sp.eyes[0];
  if (e) P.blush(ctx, e.x - sp.ax - e.r * 0.4, e.y - sp.ay + e.r * 2.2, e.r * 1.2, 0.5);
  ctx.restore();
}

/** a dolphin, (x, y) its middle, s its scale (1 ≈ 200 px long), angle the direction it jumps, facing right */
export function drawDolphin(ctx: Ctx, x: number, y: number, s: number, angle: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const body = makePath('M -100 0 C -80 -22 -30 -38 30 -34 C 62 -32 84 -20 94 -6 L 112 -2 C 114 4 106 8 92 8 C 70 22 20 30 -30 22 C -60 18 -84 10 -100 0 Z');
  const fin = makePath('M 0 -34 C 8 -58 22 -66 34 -68 C 28 -56 26 -44 30 -34 Z');
  const flipper = makePath('M 20 14 C 16 32 6 42 -6 46 C 0 34 2 24 4 16 Z');
  const tailWag = Math.sin(t * 6) * 6;
  const tail = makePath(`M -96 -2 C -110 -10 -122 ${-26 + tailWag} -134 ${-30 + tailWag} C -128 -14 -128 -2 -132 ${12 + tailWag} C -120 ${10 + tailWag} -108 6 -96 4 Z`);
  for (const p of [tail, fin, flipper, body]) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 9;
    ctx.stroke(p);
  }
  for (const p of [tail, fin, flipper]) {
    ctx.fillStyle = '#5f8fc4';
    ctx.fill(p);
  }
  const g = ctx.createLinearGradient(0, -36, 0, 26);
  g.addColorStop(0, '#6f9fd2');
  g.addColorStop(0.55, '#8db8e2');
  g.addColorStop(0.7, '#e8f3ff');
  g.addColorStop(1, '#f6fbff');
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.strokeStyle = '#24476e';
  ctx.lineWidth = 4;
  for (const p of [tail, fin, flipper, body]) ctx.stroke(p);
  // eye and smile
  ctx.fillStyle = '#1d1a24';
  ctx.beginPath();
  ctx.arc(66, -14, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(68, -16, 2, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(84, 2);
  ctx.quadraticCurveTo(96, 6, 106, 2);
  ctx.stroke();
  P.blush(ctx, 72, 2, 7, 0.5);
  ctx.restore();
}

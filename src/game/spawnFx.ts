// Scan feedback: the photo appears as a polaroid, glyph boxes pop up, stickers fly into the scene.
import type { Snapshot } from '../scenes/scene.ts';
import type { ScannedGlyph } from '../vision/types.ts';
import { sfx } from './audio.ts';
import type { AnyCanvas } from './canvas.ts';
import { clamp, ease, lerp, TAU } from './math.ts';
import type { Particles } from './particles.ts';

interface Flight {
  glyph: ScannedGlyph;
  sticker: AnyCanvas;
  from: { x: number; y: number; s: number };
  to: { x: number; y: number };
  delay: number;
  t: number;
  dur: number;
  landed: boolean;
  onLand: () => void;
}

interface Polaroid {
  snap: Snapshot;
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  closing: number;
  boxes: { x: number; y: number; w: number; h: number; isNew: boolean; at: number; team?: string }[];
}

export class SpawnFx {
  polaroid: Polaroid | null = null;
  flights: Flight[] = [];
  private particles: Particles;

  constructor(particles: Particles) {
    this.particles = particles;
  }

  busy(): boolean {
    return !!this.polaroid || this.flights.length > 0;
  }

  /**
   * @param target where each new glyph should fly to (world coords), or null to skip
   * @param onLand called when the sticker arrives
   */
  start(
    snap: Snapshot,
    glyphs: ScannedGlyph[],
    stickers: Map<number, AnyCanvas>,
    worldW: number,
    target: (g: ScannedGlyph, i: number) => { x: number; y: number } | null,
    onLand: (g: ScannedGlyph, i: number) => void,
    teamColor?: (g: ScannedGlyph) => string,
  ): void {
    sfx.shutter();
    const maxW = Math.min(620, worldW * 0.36);
    const aspect = snap.canvas.height / snap.canvas.width;
    const w = maxW;
    const h = maxW * aspect;
    const x = worldW / 2 - w / 2;
    const y = 120;
    const sc = w / snap.detW;
    const newOnes = glyphs.filter((g) => g.isNew);
    const stagger = clamp(3.2 / Math.max(1, newOnes.length), 0.07, 0.26);
    let k = 0;
    const boxes: Polaroid['boxes'] = [];
    glyphs.forEach((g) => {
      const bx = x + g.box.x * sc;
      const by = y + g.box.y * sc;
      const bw = g.box.w * sc;
      const bh = g.box.h * sc;
      const at = 0.3 + (g.isNew ? k : 0) * stagger * 0.5;
      boxes.push({ x: bx, y: by, w: bw, h: bh, isNew: g.isNew, at, team: teamColor?.(g) });
      if (!g.isNew) return;
      const idx = k++;
      const to = target(g, idx);
      const st = stickers.get(g.id);
      if (!to || !st) return;
      this.flights.push({
        glyph: g,
        sticker: st,
        from: { x: bx + bw / 2, y: by + bh / 2, s: Math.max(bw, bh) },
        to,
        delay: 0.6 + idx * stagger,
        t: 0,
        dur: 0.75,
        landed: false,
        onLand: () => onLand(g, idx),
      });
    });
    this.polaroid = { snap, x, y, w, h, t: 0, closing: -1, boxes };
  }

  update(dt: number): void {
    const p = this.polaroid;
    if (p) {
      p.t += dt;
      const lastBox = p.boxes.reduce((m, b) => Math.max(m, b.at), 0);
      const pending = this.flights.some((f) => f.t < f.delay + 0.1);
      if (p.closing < 0 && !pending && p.t > Math.max(1.4, lastBox + 0.8)) p.closing = 0;
      if (p.closing >= 0) {
        p.closing += dt;
        if (p.closing > 0.45) this.polaroid = null;
      }
    }
    for (const f of this.flights) {
      f.t += dt;
      const u = (f.t - f.delay) / f.dur;
      if (u > 0 && u < 1 && Math.random() < 0.5) {
        const pos = this.flightPos(f, ease.inOutCubic(u));
        this.particles.add({ kind: 'spark', x: pos.x, y: pos.y, size: 9, max: 0.5, color: '#fff6b0' });
      }
      if (u >= 1 && !f.landed) {
        f.landed = true;
        f.onLand();
      }
    }
    this.flights = this.flights.filter((f) => !f.landed);
  }

  private flightPos(f: Flight, u: number) {
    const cx = (f.from.x + f.to.x) / 2;
    const cy = Math.min(f.from.y, f.to.y) - 220;
    const x = (1 - u) * (1 - u) * f.from.x + 2 * (1 - u) * u * cx + u * u * f.to.x;
    const y = (1 - u) * (1 - u) * f.from.y + 2 * (1 - u) * u * cy + u * u * f.to.y;
    return { x, y };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const p = this.polaroid;
    if (p) {
      const enter = ease.outBack(clamp(p.t / 0.35));
      const exit = p.closing >= 0 ? 1 - ease.inQuad(clamp(p.closing / 0.45)) : 1;
      const s = enter * (0.85 + 0.15 * exit);
      ctx.save();
      ctx.globalAlpha = exit;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(-0.025);
      ctx.scale(s, s);
      ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
      const pad = 16;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(p.x - pad + 8, p.y - pad + 10, p.w + 2 * pad, p.h + 2 * pad + 40);
      ctx.fillStyle = '#fffdf7';
      ctx.fillRect(p.x - pad, p.y - pad, p.w + 2 * pad, p.h + 2 * pad + 40);
      ctx.drawImage(p.snap.canvas as CanvasImageSource, p.x, p.y, p.w, p.h);
      // flash
      if (p.t < 0.3) {
        ctx.fillStyle = `rgba(255,255,255,${1 - p.t / 0.3})`;
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
      for (const b of p.boxes) {
        const u = clamp((p.t - b.at) / 0.25);
        if (u <= 0) continue;
        const grow = ease.outBack(u);
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.scale(grow, grow);
        ctx.lineWidth = 3;
        ctx.strokeStyle = b.isNew ? (b.team ?? '#ffcc00') : 'rgba(140,140,140,0.8)';
        ctx.setLineDash(b.isNew ? [] : [5, 4]);
        ctx.beginPath();
        ctx.roundRect(-b.w / 2 - 4, -b.h / 2 - 4, b.w + 8, b.h + 8, 6);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    for (const f of this.flights) {
      const u = (f.t - f.delay) / f.dur;
      if (u <= 0) continue;
      const e = ease.inOutCubic(clamp(u));
      const pos = this.flightPos(f, e);
      const size = lerp(f.from.s, 80, e);
      const sc = size / Math.max(f.sticker.width, f.sticker.height);
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(Math.sin(e * TAU) * 0.3);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.62, 0, TAU);
      ctx.fill();
      ctx.drawImage(f.sticker as CanvasImageSource, (-f.sticker.width * sc) / 2, (-f.sticker.height * sc) / 2, f.sticker.width * sc, f.sticker.height * sc);
      ctx.restore();
    }
  }
}

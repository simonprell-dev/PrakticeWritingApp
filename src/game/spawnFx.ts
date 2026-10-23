// Scan feedback in two phases:
//  1. capture(): flash + shutter right when the photo is taken, the photo appears as a polaroid with a
//     moving scan light while the recognition runs in the worker,
//  2. start(): the results arrive in the same polaroid, glyph boxes pop up, stickers fly into the scene.
import type { Snapshot } from '../scenes/scene.ts';
import type { ScannedGlyph } from '../vision/types.ts';
import { sfx } from './audio.ts';
import type { AnyCanvas } from './canvas.ts';
import { clamp, ease, lerp, TAU } from './math.ts';
import type { Particles } from './particles.ts';

interface Flight {
  glyph?: ScannedGlyph;
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
  /** p.t when the results arrived, -1 while scanning */
  resultAt: number;
  closing: number;
  label: string;
  boxes: { x: number; y: number; w: number; h: number; isNew: boolean; at: number; team?: string; rejected?: boolean }[];
}

/** something found in the photo: a box in the polaroid, and maybe a sticker that flies into the scene */
export interface FxItem {
  /** detection coordinates */
  box: { x: number; y: number; w: number; h: number };
  isNew: boolean;
  rejected?: boolean;
  /** box colour */
  team?: string;
  fly?: { sticker: AnyCanvas; to: { x: number; y: number }; onLand: () => void; glyph?: ScannedGlyph };
}

export class SpawnFx {
  polaroid: Polaroid | null = null;
  flights: Flight[] = [];
  private particles: Particles;
  private flashT = -1;
  private worldW = 1920;
  /** y of the polaroid (scenes with something important at the top move it down) */
  top = 120;

  constructor(particles: Particles) {
    this.particles = particles;
  }

  busy(): boolean {
    return !!this.polaroid || this.flights.length > 0;
  }

  private layout(snap: Snapshot, worldW: number) {
    const w = Math.min(620, worldW * 0.36);
    const h = (w * snap.canvas.height) / snap.canvas.width;
    return { x: worldW / 2 - w / 2, y: this.top, w, h };
  }

  /** Phase 1: the photo was just taken. */
  capture(snap: Snapshot, worldW: number): void {
    sfx.shutter();
    this.worldW = worldW;
    this.flashT = 0;
    this.polaroid = { snap, ...this.layout(snap, worldW), t: 0, resultAt: -1, closing: -1, label: 'Ich schaue', boxes: [] };
  }

  /** The recognition failed: let the polaroid go away. */
  cancel(): void {
    if (this.polaroid && this.polaroid.resultAt < 0) this.polaroid.closing = 0;
  }

  /**
   * Phase 2: results.
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
    const newOnes = glyphs.filter((g) => g.isNew);
    const valid = newOnes.filter((g) => !g.score.rejected).length;
    const mirrored = newOnes.length - valid;
    const known = glyphs.length - newOnes.length;
    const fresh = valid === 1 ? '1 neues Zeichen!' : `${valid} neue Zeichen!`;
    const extra = [mirrored ? `${mirrored} spiegelverkehrt` : '', known ? `${known} kenne ich schon` : ''].filter(Boolean).join(', ');
    let label: string;
    if (valid) label = extra ? `${fresh} (${extra})` : fresh;
    else if (mirrored) label = 'Spiegelschrift zählt nicht!';
    else label = known ? 'Nichts Neues – alles schon bekannt' : 'Nichts gefunden';
    let k = 0;
    const items = glyphs.map((g): FxItem => {
      const item: FxItem = { box: g.box, isNew: g.isNew, rejected: g.score.rejected, team: teamColor?.(g) };
      if (!g.isNew || g.score.rejected) return item;
      const idx = k++;
      const to = target(g, idx);
      const st = stickers.get(g.id);
      if (to && st) item.fly = { sticker: st, to, onLand: () => onLand(g, idx), glyph: g };
      return item;
    });
    this.show(snap, worldW, label, items);
  }

  /** Phase 2 for anything found in the photo (glyphs, colouring cards): boxes in the polaroid, stickers fly in. */
  show(snap: Snapshot, worldW: number, label: string, items: FxItem[]): void {
    let p = this.polaroid;
    if (!p || p.snap.canvas !== snap.canvas || p.closing >= 0) {
      this.capture(snap, worldW);
      p = this.polaroid!;
    }
    p.snap = snap;
    p.resultAt = p.t;
    p.label = label;
    const sc = p.w / snap.detW;
    const stagger = clamp(2.4 / Math.max(1, items.filter((i) => i.isNew).length), 0.06, 0.18);
    let k = 0;
    p.boxes = [];
    for (const it of items) {
      const bx = p.x + it.box.x * sc;
      const by = p.y + it.box.y * sc;
      const bw = it.box.w * sc;
      const bh = it.box.h * sc;
      const at = p.resultAt + 0.04 + (it.isNew ? k : 0) * stagger * 0.5;
      p.boxes.push({ x: bx, y: by, w: bw, h: bh, isNew: it.isNew, at, team: it.team, rejected: it.rejected });
      if (!it.isNew || it.rejected) continue;
      const idx = k++;
      if (!it.fly) continue;
      this.flights.push({
        glyph: it.fly.glyph,
        sticker: it.fly.sticker,
        from: { x: bx + bw / 2, y: by + bh / 2, s: Math.max(bw, bh) },
        to: it.fly.to,
        delay: 0.08 + idx * stagger,
        t: 0,
        dur: 0.5,
        landed: false,
        onLand: it.fly.onLand,
      });
    }
  }

  update(dt: number): void {
    if (this.flashT >= 0) {
      this.flashT += dt;
      if (this.flashT > 0.3) this.flashT = -1;
    }
    const p = this.polaroid;
    if (p) {
      p.t += dt;
      if (p.closing < 0) {
        if (p.resultAt < 0) {
          if (p.t > 10) p.closing = 0; // recognition never answered
        } else {
          const lastBox = p.boxes.reduce((m, b) => Math.max(m, b.at), p.resultAt);
          const pending = this.flights.some((f) => f.t < f.delay + 0.1);
          if (!pending && p.t > Math.max(p.resultAt + 0.9, lastBox + 0.5)) p.closing = 0;
        }
      } else {
        p.closing += dt;
        if (p.closing > 0.4) this.polaroid = null;
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
    const cy = Math.min(f.from.y, f.to.y) - 200;
    const x = (1 - u) * (1 - u) * f.from.x + 2 * (1 - u) * u * cx + u * u * f.to.x;
    const y = (1 - u) * (1 - u) * f.from.y + 2 * (1 - u) * u * cy + u * u * f.to.y;
    return { x, y };
  }

  render(ctx: CanvasRenderingContext2D): void {
    const p = this.polaroid;
    if (p) {
      const enter = ease.outBack(clamp(p.t / 0.28));
      const exit = p.closing >= 0 ? 1 - ease.inQuad(clamp(p.closing / 0.4)) : 1;
      const s = enter * (0.85 + 0.15 * exit);
      ctx.save();
      ctx.globalAlpha = exit;
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(-0.025);
      ctx.scale(s, s);
      ctx.translate(-(p.x + p.w / 2), -(p.y + p.h / 2));
      const pad = 16;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(p.x - pad + 8, p.y - pad + 10, p.w + 2 * pad, p.h + 2 * pad + 44);
      ctx.fillStyle = '#fffdf7';
      ctx.fillRect(p.x - pad, p.y - pad, p.w + 2 * pad, p.h + 2 * pad + 44);
      ctx.drawImage(p.snap.canvas as CanvasImageSource, p.x, p.y, p.w, p.h);
      if (p.t < 0.25) {
        ctx.fillStyle = `rgba(255,255,255,${1 - p.t / 0.25})`;
        ctx.fillRect(p.x, p.y, p.w, p.h);
      }
      // moving scan light while the recognition runs
      if (p.resultAt < 0) {
        const u = ((p.t * 1.4) % 1.25) - 0.12;
        const bx = p.x + u * p.w;
        const band = p.w * 0.16;
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x, p.y, p.w, p.h);
        ctx.clip();
        const g = ctx.createLinearGradient(bx - band, 0, bx + band, 0);
        g.addColorStop(0, 'rgba(255,240,120,0)');
        g.addColorStop(0.5, 'rgba(255,240,120,0.55)');
        g.addColorStop(1, 'rgba(255,240,120,0)');
        ctx.fillStyle = g;
        ctx.fillRect(bx - band, p.y, band * 2, p.h);
        ctx.restore();
      }
      for (const b of p.boxes) {
        const u = clamp((p.t - b.at) / 0.22);
        if (u <= 0) continue;
        const grow = ease.outBack(u);
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.scale(grow, grow);
        ctx.lineWidth = 3;
        ctx.strokeStyle = b.rejected && b.isNew ? '#ff5470' : b.isNew ? (b.team ?? '#ffcc00') : 'rgba(140,140,140,0.8)';
        ctx.setLineDash(b.isNew && !b.rejected ? [] : [5, 4]);
        ctx.beginPath();
        ctx.roundRect(-b.w / 2 - 4, -b.h / 2 - 4, b.w + 8, b.h + 8, 6);
        ctx.stroke();
        if (b.rejected && b.isNew) {
          // little mirror sign: the letter is the wrong way round
          ctx.fillStyle = '#ff5470';
          ctx.font = '700 18px Fredoka, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('⇄', 0, -b.h / 2 - 10);
        }
        ctx.restore();
      }
      // caption on the white border
      ctx.fillStyle = '#3b2a5c';
      ctx.font = '600 26px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      const dots = p.resultAt < 0 ? '.'.repeat(1 + (Math.floor(p.t * 3) % 3)) : '';
      ctx.fillText(p.label + dots, p.x + p.w / 2, p.y + p.h + 40);
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
    // camera flash over the whole screen
    if (this.flashT >= 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - this.flashT / 0.3)})`;
      ctx.fillRect(0, 0, this.worldW, 1080);
      ctx.restore();
    }
  }
}

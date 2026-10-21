// Shared engine for the three single-player habitats (sea, space, savanna).
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import { makeGenome, type Archetype, type Genome } from '../game/creatures/genome.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { clamp, ease, lerp, TAU } from '../game/math.ts';
import { Particles } from '../game/particles.ts';
import { hashBytes } from '../game/rng.ts';
import { SpawnFx } from '../game/spawnFx.ts';
import { WORLD_H } from '../game/stage.ts';
import { TIER_LABEL, TIP_TEXT } from '../recog/score.ts';
import type { ScanResult, ScannedGlyph } from '../vision/types.ts';
import type { Scene, SceneHost, Snapshot } from './scene.ts';

export interface Creature {
  id: number;
  glyph: ScannedGlyph;
  sticker: AnyCanvas;
  genome: Genome;
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  /** smoothed facing for turning animation */
  face: number;
  age: number;
  /** grows 0 -> 1 after hatching */
  spawn: number;
  leaving: boolean;
  state: string;
  stateT: number;
  tx: number;
  ty: number;
  rot: number;
  phase: number;
  blink: number;
  nextBlink: number;
  /** savanna depth scale */
  depth: number;
  /** jump height (px) */
  lift: number;
  special: number;
  bubble?: { text: string; t: number; good: boolean };
}

export interface Bounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface HabitatDef {
  id: 'meer' | 'weltraum' | 'savanne';
  archetype: Archetype;
  word: [string, string];
  makeSprite(g: Genome, sticker: AnyCanvas): Sprite;
  bounds(W: number): Bounds;
  paint(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, W: number, H: number): void;
  init?(s: HabitatScene): void;
  ambient?(s: HabitatScene, dt: number): void;
  renderBack?(s: HabitatScene, ctx: CanvasRenderingContext2D): void;
  renderFront?(s: HabitatScene, ctx: CanvasRenderingContext2D): void;
  behave(s: HabitatScene, c: Creature, dt: number): void;
  /** y sorting (savanna) */
  sortY?: boolean;
  speechColor?: string;
}

let nextId = 1;

export class HabitatScene implements Scene {
  readonly def: HabitatDef;
  readonly host: SceneHost;
  creatures: Creature[] = [];
  album: Creature[] = [];
  particles = new Particles();
  fx = new SpawnFx(this.particles);
  W = 1920;
  t = 0;
  bg: AnyCanvas | null = null;
  /** free state for ambient animation */
  amb: Record<string, unknown> = {};
  /** practice progress */
  practiceDone = 0;
  goalReached = false;
  written = 0;

  constructor(def: HabitatDef, host: SceneHost, worldW: number) {
    this.def = def;
    this.host = host;
    this.resize(worldW);
    def.init?.(this);
  }

  get bounds(): Bounds {
    return this.def.bounds(this.W);
  }

  resize(worldW: number): void {
    this.W = worldW;
    const { canvas, ctx } = makeCanvas(Math.round(worldW), WORLD_H);
    this.def.paint(ctx as CanvasRenderingContext2D, worldW, WORLD_H);
    this.bg = canvas;
    for (const c of this.creatures) {
      c.x = clamp(c.x, this.bounds.x0, this.bounds.x1);
    }
  }

  beginCapture(snap: Snapshot): void {
    this.fx.capture(snap, this.W);
  }

  cancelCapture(): void {
    this.fx.cancel();
  }

  handleScan(res: ScanResult, snap: Snapshot): void {
    const stickers = new Map<number, AnyCanvas>();
    for (const g of res.glyphs) stickers.set(g.id, canvasFromRGBA(g.crop));
    const fresh = res.glyphs.filter((g) => g.isNew);
    const target = this.host.settings.practice.mode === 'ueben' ? this.host.settings.practice.target : undefined;
    const best = fresh.reduce<ScannedGlyph | null>((b, g) => (!b || g.score.score > b.score.score ? g : b), null);
    const worst = fresh.reduce<ScannedGlyph | null>((b, g) => (!b || g.score.score < b.score.score ? g : b), null);
    const B = this.bounds;
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => {
        const fx = g.box.x / Math.max(1, snap.detW);
        return { x: lerp(B.x0 + 80, B.x1 - 80, fx), y: lerp(B.y0 + 40, B.y1 - 40, Math.random()) };
      },
      (g) => {
        const sticker = stickers.get(g.id)!;
        const c = this.addCreature(g, sticker);
        this.written++;
        // only letters that really are the target count towards the practice goal
        if (target && !g.score.looksLike && g.score.tip !== 'spiegel') this.practiceDone++;
        sfx.hatch(g.score.score);
        this.particles.burst('puff', c.x, c.y, 10, { color: 'rgba(255,255,255,0.8)', size: 26, speed: 160, max: 0.6 });
        if (g.score.score >= 70) this.particles.burst('spark', c.x, c.y, 10, { color: '#fff6a8', size: 14, speed: 260, max: 0.9 });
        const stars = '★'.repeat(starCount(g.score.score)) + '☆'.repeat(5 - starCount(g.score.score));
        this.particles.add({ kind: 'text', x: c.x, y: c.y - c.sprite.radius - 30, vy: -40, max: 1.8, size: 34, color: '#ffd84a', text: stars });
        if (g === best || fresh.length === 1) {
          this.particles.add({
            kind: 'text',
            x: c.x,
            y: c.y - c.sprite.radius - 70,
            vy: -40,
            max: 1.8,
            size: 30,
            color: '#ffffff',
            text: TIER_LABEL[g.score.tier] + '!',
          });
        }
        if (g === best && fresh.length > 1) {
          sfx.fanfare();
          c.bubble = { text: 'Ich bin am schönsten!', t: 0, good: true };
        }
        if (target && g === worst) {
          const tipText = g.score.tip === 'anderes' && g.score.looksLike ? `Ich sehe aus wie ein ${g.score.looksLike}!` : TIP_TEXT[g.score.tip];
          c.bubble = { text: tipText, t: 0, good: g.score.tip === 'super' };
        } else if (fresh.length === 1) {
          c.bubble = { text: TIP_TEXT[g.score.tip], t: 0, good: g.score.score >= 70 };
        }
        this.host.progress();
      },
    );
    if (res.newSheet) this.host.toast('Neues Blatt erkannt!', 'info');
    if (!fresh.length) {
      if (res.glyphs.length) this.host.toast('Ich habe nichts Neues gefunden. Schreib noch etwas!', 'info');
      else this.host.toast('Ich sehe noch keine Buchstaben. Schreib etwas unter die Kamera!', 'warn');
    }
  }

  addCreature(g: ScannedGlyph, sticker: AnyCanvas): Creature {
    const seed = hashBytes(g.crop.data, 13) ^ g.id;
    const genome = makeGenome(g.score.score, g.score.tier, seed, this.def.archetype);
    const sprite = this.def.makeSprite(genome, sticker);
    const B = this.bounds;
    const fl = this.fx.flights.find((f) => f.glyph === g);
    const x = fl?.to.x ?? lerp(B.x0, B.x1, Math.random());
    const y = fl?.to.y ?? lerp(B.y0, B.y1, Math.random());
    const c: Creature = {
      id: nextId++,
      glyph: g,
      sticker,
      genome,
      sprite,
      x,
      y,
      vx: 0,
      vy: 0,
      facing: Math.random() < 0.5 ? 1 : -1,
      face: 1,
      age: 0,
      spawn: 0,
      leaving: false,
      state: 'idle',
      stateT: 0,
      tx: x,
      ty: y,
      rot: 0,
      phase: Math.random() * TAU,
      blink: 0,
      nextBlink: 1 + Math.random() * 4,
      depth: 1,
      lift: 0,
      special: 0,
    };
    c.face = c.facing;
    this.creatures.push(c);
    // population limit: the oldest move out (they are never removed in front of the children)
    const max = this.host.settings.game.maxCreatures;
    const staying = this.creatures.filter((k) => !k.leaving);
    if (staying.length > max) {
      const oldest = staying.slice(0, staying.length - max);
      for (const o of oldest) o.leaving = true;
    }
    return c;
  }

  update(dt: number): void {
    this.t += dt;
    this.fx.update(dt);
    this.def.ambient?.(this, dt);
    const B = this.bounds;
    for (const c of this.creatures) {
      c.age += dt;
      c.spawn = Math.min(1, c.spawn + dt / 0.45);
      c.stateT += dt;
      c.blink -= dt;
      c.nextBlink -= dt;
      if (c.nextBlink <= 0) {
        c.blink = 0.14;
        c.nextBlink = 2 + Math.random() * 5;
      }
      if (c.leaving) {
        const dir = c.x < (B.x0 + B.x1) / 2 ? -1 : 1;
        c.facing = dir as 1 | -1;
        c.vx = lerp(c.vx, dir * 260, dt * 2);
        c.x += c.vx * dt;
      } else this.def.behave(this, c, dt);
      c.face = lerp(c.face, c.facing, Math.min(1, dt * 6));
      if (c.genome.sparkle && Math.random() < dt * 3) {
        const a = Math.random() * TAU;
        const r = c.sprite.radius * (0.8 + Math.random() * 0.5);
        this.particles.add({ kind: 'spark', x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r, size: 8 + Math.random() * 8, max: 0.8, color: '#fff7b8' });
      }
      if (c.bubble) {
        c.bubble.t += dt;
        if (c.bubble.t > 4) c.bubble = undefined;
      }
    }
    // remove creatures that left the screen
    const gone = this.creatures.filter((c) => c.leaving && (c.x < -300 || c.x > this.W + 300));
    if (gone.length) {
      this.album.push(...gone);
      this.creatures = this.creatures.filter((c) => !gone.includes(c));
    }
    this.particles.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.bg) ctx.drawImage(this.bg as CanvasImageSource, 0, 0);
    this.def.renderBack?.(this, ctx);
    const list = this.def.sortY ? [...this.creatures].sort((a, b) => a.y - b.y) : this.creatures;
    for (const c of list) this.drawCreature(ctx, c);
    this.particles.render(ctx);
    this.def.renderFront?.(this, ctx);
    for (const c of list) if (c.bubble) this.drawBubble(ctx, c);
    this.fx.render(ctx);
  }

  drawCreature(ctx: CanvasRenderingContext2D, c: Creature): void {
    const sp = c.sprite;
    const grow = ease.outBack(c.spawn);
    const sq = 1 + Math.sin(c.age * 3 + c.phase) * 0.03;
    ctx.save();
    ctx.translate(c.x, c.y - c.lift);
    ctx.rotate(c.rot);
    const s = c.depth * grow;
    ctx.scale(c.face * s * (2 - sq), s * sq);
    if (sp.tail) {
      const wag = Math.sin(c.age * (6 + Math.abs(c.vx) / 25) + c.phase) * (c.genome.wobble > 0.4 ? 0.5 : 0.3);
      ctx.save();
      ctx.translate(sp.tail.px - sp.ax, sp.tail.py - sp.ay);
      ctx.rotate(wag);
      ctx.drawImage(sp.tail.canvas as CanvasImageSource, -sp.tail.pivotX, -sp.tail.pivotY);
      ctx.restore();
    }
    ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
    drawBadgeSticker(ctx, sp, c.face);
    if (c.blink > 0) {
      for (const e of sp.eyes) {
        ctx.fillStyle = sp.lid;
        ctx.beginPath();
        ctx.arc(e.x - sp.ax, e.y - sp.ay, e.r * 1.08, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(40,30,50,0.9)';
        ctx.lineWidth = Math.max(2, e.r * 0.18);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(e.x - sp.ax, e.y - sp.ay - e.r * 0.2, e.r * 0.7, 0.2 * Math.PI, 0.8 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawBubble(ctx: CanvasRenderingContext2D, c: Creature): void {
    const b = c.bubble!;
    const a = clamp(b.t / 0.25) * clamp((4 - b.t) / 0.4);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '600 30px Fredoka, system-ui, sans-serif';
    const w = Math.min(520, ctx.measureText(b.text).width + 40);
    const h = 58;
    const x = clamp(c.x - w / 2, 10, this.W - w - 10);
    const y = Math.max(10, c.y - c.sprite.radius * c.depth - h - 40);
    ctx.fillStyle = b.good ? '#fffbe6' : '#ffffff';
    ctx.strokeStyle = b.good ? '#f0b400' : '#5b4b8a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    ctx.moveTo(c.x - 12, y + h);
    ctx.lineTo(c.x, y + h + 22);
    ctx.lineTo(c.x + 12, y + h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2a5c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(b.text, x + w / 2, y + h / 2 + 1, w - 30);
    ctx.restore();
  }

  tap(x: number, y: number): boolean {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (c.leaving) continue;
      if (Math.hypot(c.x - x, c.y - y) < c.sprite.radius * c.depth * 1.1) {
        sfx.boing();
        c.special = 1;
        this.particles.burst('heart', c.x, c.y - c.sprite.radius, 5, { color: '#ff6fa3', size: 22, speed: 120, max: 1, gravity: -80 });
        this.host.showCard({ glyph: c.glyph, sticker: c.sticker, name: this.def.word[0] });
        return true;
      }
    }
    return false;
  }

  /** Random wander target inside the bounds. */
  newTarget(c: Creature, margin = 60): void {
    const B = this.bounds;
    c.tx = lerp(B.x0 + margin, B.x1 - margin, Math.random());
    c.ty = lerp(B.y0 + margin * 0.5, B.y1 - margin * 0.5, Math.random());
  }

  destroy(): void {
    this.creatures = [];
  }

  count(): number {
    return this.creatures.filter((c) => !c.leaving).length + this.album.length;
  }
}

export function starCount(score: number): number {
  return score < 30 ? 1 : score < 50 ? 2 : score < 70 ? 3 : score < 88 ? 4 : 5;
}

// Shared engine for the three single-player habitats (sea, space, savanna).
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import { bubbleSprite } from '../game/creatures/bubble.ts';
import { drawPencil, drawSchoolLines, drawWriting, writeDuration, writtenGlyph, type WrittenGlyph } from '../game/strokes.ts';
import { makeGenome, type Archetype, type Genome } from '../game/creatures/genome.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { clamp, ease, lerp, TAU } from '../game/math.ts';
import { poseOf } from '../game/paint/motion.ts';
import type { SpeciesId } from '../game/paint/species.ts';
import { Particles } from '../game/particles.ts';
import { hashBytes } from '../game/rng.ts';
import { SpawnFx } from '../game/spawnFx.ts';
import { WORLD_H } from '../game/stage.ts';
import { surprisePool, withArticle } from '../recog/classes.ts';
import { TIER_LABEL, TIP_TEXT } from '../recog/score.ts';
import type { RGBAImage, ScanResult, ScannedGlyph } from '../vision/types.ts';
import { loadGlyph, saveGlyph, type SavedGlyph, type SceneSave } from './saved.ts';
import type { Scene, SceneHost, Snapshot } from './scene.ts';

export interface Creature {
  id: number;
  /** the child's letter (missing for painted fish) */
  glyph?: ScannedGlyph;
  sticker?: AnyCanvas;
  /** a fish coloured in on a card (Mal-Aquarium) */
  painted?: PaintedSkin;
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
  bubble?: { text: string; t: number; good: boolean; image?: AnyCanvas };
}

/** the skin of an animal coloured in on a card */
export interface PaintedSkin {
  /** the animal printed on the card */
  species: SpeciesId;
  /** the card, cut out straight */
  image: RGBAImage;
  /** 12 × 8 colours to recognise the card again */
  thumb: number[];
  /** handwritten name of the fish, if any */
  name: AnyCanvas | null;
  /** the whole fish in one small picture */
  picture: AnyCanvas;
  /** sprite px per fish unit */
  k: number;
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

/** practice mode: a bubble with a surprise letter; writing that letter bursts it and frees a creature */
export interface Wish {
  char: string;
  /** home position (the creature hatches here) */
  x: number;
  y: number;
  t: number;
  /** seconds since it burst, -1 while it waits */
  pop: number;
  /** a matching letter is on its way */
  claimed: boolean;
  /** short reaction to a near miss */
  hint: { text: string; t: number } | null;
}

const WISH_R = 108;

/** a habitat in a saved game */
export interface HabitatSave {
  creatures: { glyph: SavedGlyph; x: number; y: number; facing: 1 | -1 }[];
  /** creatures that already swam away */
  away: number;
  practiceIndex: number;
  practiceDone: number;
  goalReached: boolean;
  written: number;
  wishesFreed: number;
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
  /** practice progress: which letter of the list, and how often it was written */
  practiceIndex = 0;
  practiceDone = 0;
  goalReached = false;
  written = 0;
  wish: Wish | null = null;
  /** seconds until the next surprise bubble */
  wishIn = 12;
  wishesFreed = 0;
  private recentWishes: string[] = [];
  /** big demonstration of how the practice letter is written */
  demo: { glyph: WrittenGlyph; t: number; dur: number } | null = null;
  /** creatures that swam away in an earlier session (a game that was continued) */
  awayBefore = 0;
  /** letters hatch here; false in the Mal-Aquarium (no practice, no surprise letters) */
  protected letters = true;

  constructor(def: HabitatDef, host: SceneHost, worldW: number) {
    this.def = def;
    this.host = host;
    this.resize(worldW);
    def.init?.(this);
  }

  get bounds(): Bounds {
    return this.def.bounds(this.W);
  }

  /** the letter being practised right now (undefined while writing freely) */
  get practiceTarget(): string | undefined {
    const p = this.host.settings.practice;
    if (!this.letters || p.mode !== 'ueben' || !p.targets.length) return undefined;
    return p.targets[Math.min(this.practiceIndex, p.targets.length - 1)];
  }

  /** on to the next practice letter; false when the list is done */
  nextTarget(): boolean {
    if (this.practiceIndex + 1 >= this.host.settings.practice.targets.length) return false;
    this.practiceIndex++;
    this.practiceDone = 0;
    this.goalReached = false;
    return true;
  }

  /** start the list of practice letters again from the first one */
  restartPractice(): void {
    this.practiceIndex = 0;
    this.practiceDone = 0;
    this.goalReached = false;
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
    // mirror writing that does not count (setting) hatches nothing
    const fresh = res.glyphs.filter((g) => g.isNew && !g.score.rejected);
    const target = this.practiceTarget;
    const best = fresh.reduce<ScannedGlyph | null>((b, g) => (!b || g.score.score > b.score.score ? g : b), null);
    const worst = fresh.reduce<ScannedGlyph | null>((b, g) => (!b || g.score.score < b.score.score ? g : b), null);
    const B = this.bounds;
    // the surprise letter: the first new glyph that really is it flies into the bubble
    const wish = this.wish && this.wish.pop < 0 && !this.wish.claimed ? this.wish : null;
    const wishGlyph = wish ? fresh.find((g) => g.score.scoredAs === wish.char && !g.score.looksLike && g.score.tip !== 'spiegel') : undefined;
    if (wish && wishGlyph) wish.claimed = true;
    else if (wish) {
      const near = fresh.find((g) => g.score.scoredAs === wish.char);
      if (near) wish.hint = { text: near.score.tip === 'spiegel' ? 'Andersrum!' : 'Fast! Nochmal!', t: 0 };
    }
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => {
        if (wish && g === wishGlyph) return { x: wish.x, y: wish.y };
        const fx = g.box.x / Math.max(1, snap.detW);
        return { x: lerp(B.x0 + 80, B.x1 - 80, fx), y: lerp(B.y0 + 40, B.y1 - 40, Math.random()) };
      },
      (g) => {
        const sticker = stickers.get(g.id)!;
        const c = this.addCreature(g, sticker);
        this.written++;
        // only letters that really are the target count towards the practice goal
        if (target && g.score.scoredAs === target && !g.score.looksLike && g.score.tip !== 'spiegel') this.practiceDone++;
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
          const tipText = g.score.tip === 'anderes' && g.score.looksLike ? `Ich sehe aus wie ${withArticle(g.score.looksLike)}!` : TIP_TEXT[g.score.tip];
          c.bubble = { text: tipText, t: 0, good: g.score.tip === 'super' };
        } else if (fresh.length === 1) {
          c.bubble = { text: TIP_TEXT[g.score.tip], t: 0, good: g.score.score >= 70 };
        }
        if (g === wishGlyph) this.popWish(c);
        this.host.progress();
      },
    );
    if (res.newSheet) this.host.toast('Neues Blatt erkannt!', 'info');
    if (!fresh.length && !res.glyphs.some((g) => g.isNew)) {
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
    return this.place({ glyph: g, sticker, genome, sprite }, x, y);
  }

  /** puts a new creature into the scene; the oldest swim away when there are too many */
  protected place(look: Pick<Creature, 'glyph' | 'sticker' | 'painted' | 'genome' | 'sprite'>, x: number, y: number): Creature {
    const c: Creature = {
      id: nextId++,
      ...look,
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
    this.updateWish(dt);
    if (this.demo) {
      this.demo.t += dt;
      if (this.demo.t > this.demo.dur) this.demo = null;
    }
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
      } else this.behave(c, dt);
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

  /** how a creature moves when it is not leaving */
  protected behave(c: Creature, dt: number): void {
    this.def.behave(this, c, dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.bg) ctx.drawImage(this.bg as CanvasImageSource, 0, 0);
    this.def.renderBack?.(this, ctx);
    const list = this.def.sortY ? [...this.creatures].sort((a, b) => a.y - b.y) : this.creatures;
    for (const c of list) this.drawCreature(ctx, c);
    this.drawWish(ctx);
    this.particles.render(ctx);
    this.def.renderFront?.(this, ctx);
    for (const c of list) if (c.bubble) this.drawBubble(ctx, c);
    this.drawDemo(ctx);
    this.fx.render(ctx);
  }

  drawCreature(ctx: CanvasRenderingContext2D, c: Creature): void {
    const sp = c.sprite;
    const grow = ease.outBack(c.spawn);
    // a painted animal moves its own way (Mal-Aquarium); everybody else squashes a little and wags its tail
    const pose = sp.motion ? poseOf(sp.motion, c.age, c.phase, c.vx) : null;
    const sq = 1 + Math.sin(c.age * 3 + c.phase) * 0.03;
    ctx.save();
    ctx.translate(c.x, c.y - c.lift + (pose?.dy ?? 0));
    ctx.rotate(c.rot + (pose?.rot ?? 0));
    const s = c.depth * grow;
    if (pose) ctx.scale(c.face * s * pose.sx, s * pose.sy);
    else ctx.scale(c.face * s * (2 - sq), s * sq);
    if (sp.tail) {
      const wag = pose ? pose.limb : Math.sin(c.age * (6 + Math.abs(c.vx) / 25) + c.phase) * (c.genome.wobble > 0.4 ? 0.5 : 0.3);
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
    const img = b.image;
    const ih = 50;
    const iw = img ? Math.min(300, (img.width * ih) / img.height) : 0;
    const w = Math.min(520 + iw, ctx.measureText(b.text).width + 40 + (img ? iw + 10 : 0));
    const h = img ? 66 : 58;
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
    ctx.textBaseline = 'middle';
    if (img) {
      ctx.textAlign = 'left';
      ctx.fillText(b.text, x + 20, y + h / 2 + 1);
      ctx.drawImage(img as CanvasImageSource, x + w - 20 - iw, y + (h - ih) / 2, iw, ih);
    } else {
      ctx.textAlign = 'center';
      ctx.fillText(b.text, x + w / 2, y + h / 2 + 1, w - 30);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- how a letter is written

  /** the stroke template of a letter in the chosen script (Grundschrift with its small hooks) */
  private template(ch: string): WrittenGlyph | null {
    return writtenGlyph(ch, this.host.settings.recog.style !== 'druck');
  }

  /** Lineatur 3 has only the two lines of the middle band */
  private lineKind(): 2 | 4 {
    return this.host.settings.recog.lineatur === 'L3' ? 2 : 4;
  }

  /** big demonstration: "So schreibt man das B" with numbers, arrows and a pencil */
  showDemo(ch: string): void {
    const glyph = this.template(ch);
    if (!glyph) return;
    this.demo = { glyph, t: 0, dur: 0.7 + writeDuration(glyph) + 1.4 + 0.6 };
    sfx.sparkle();
  }

  private drawDemo(ctx: CanvasRenderingContext2D): void {
    const d = this.demo;
    if (!d) return;
    const g = d.glyph;
    const inT = ease.outBack(clamp(d.t / 0.45));
    const outT = clamp((d.t - (d.dur - 0.6)) / 0.6);
    const cw = Math.min(820, this.W * 0.56);
    const ch = 510;
    // at the end the card shrinks up to the task at the top
    const cx = lerp(this.W / 2, this.W / 2, outT);
    const cy = lerp(560, 60, ease.inOutCubic(outT));
    const s = inT * (1 - 0.85 * ease.inOutCubic(outT));
    ctx.save();
    ctx.globalAlpha = 1 - outT * 0.6;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.fillStyle = 'rgba(255,253,246,0.97)';
    ctx.strokeStyle = '#3b2a5c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(-cw / 2, -ch / 2, cw, ch, 36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2a5c';
    ctx.font = '700 40px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`So schreibt man ${withArticle(g.char)}:`, 0, -ch / 2 + 46);
    const u = 108;
    const top = -ch / 2 + 130;
    drawSchoolLines(ctx, -cw / 2 + 30, cw / 2 - 30, top, u, this.lineKind());
    const ox = (-g.w * u) / 2;
    const pen = drawWriting(ctx, g, ox, top, d.t - 0.7, { unit: u, ink: '#5b3bd6', ghost: true, guides: true, pen: 0.16 });
    if (pen) drawPencil(ctx, ox + pen.x * u, top + pen.y * u, 1.6);
    ctx.restore();
  }

  // ---------------------------------------------------------------- surprise letters

  /** surprise letters the recognition should know about (only while a bubble waits) */
  bonusLetters(): string[] {
    return this.wish && this.wish.pop < 0 ? [this.wish.char] : [];
  }

  private updateWish(dt: number): void {
    const p = this.host.settings.practice;
    const on = this.letters && p.mode === 'ueben' && p.surprise;
    const w = this.wish;
    if (!w) {
      if (!on) return;
      this.wishIn -= dt;
      if (this.wishIn <= 0) this.spawnWish();
      return;
    }
    w.t += dt;
    // switched off, or a new practice letter the surprise letter could be confused with
    if (w.pop < 0 && !w.claimed && (!on || !this.surpriseLetters().includes(w.char))) {
      this.wish = null;
      this.wishIn = 8;
      return;
    }
    if (w.hint) {
      w.hint.t += dt;
      if (w.hint.t > 2.2) w.hint = null;
    }
    if (w.pop < 0 && Math.random() < dt * 4) {
      const a = Math.random() * TAU;
      const q = this.wishPos(w);
      this.particles.add({ kind: 'spark', x: q.x + Math.cos(a) * WISH_R * 1.15, y: q.y + Math.sin(a) * WISH_R * 1.15, size: 10, max: 0.8, color: '#fff6b0' });
    }
    if (w.pop >= 0) {
      w.pop += dt;
      if (w.pop > 0.8) {
        this.wish = null;
        this.wishIn = 25 + Math.random() * 20;
      }
    }
  }

  private spawnWish(): void {
    const pool = this.surpriseLetters();
    const unused = pool.filter((c) => !this.recentWishes.includes(c));
    const list = unused.length ? unused : pool;
    const char = list[Math.floor(Math.random() * list.length) % list.length];
    if (!char) return;
    this.recentWishes = [...this.recentWishes, char].slice(-5);
    const B = this.bounds;
    const y = lerp(B.y0 + 110, B.y1 - 110, Math.random() * 0.6);
    // keep clear of the photo that appears at the top centre while scanning
    const inner = y < 560 ? 420 : 0;
    const left = Math.random() < 0.5;
    const lo = left ? B.x0 + 110 : this.W / 2 + inner;
    const hi = left ? this.W / 2 - inner : B.x1 - 110;
    const x = lo < hi ? lerp(lo, hi, Math.random()) : left ? B.x0 + 110 : B.x1 - 110;
    this.wish = { char, x, y, t: 0, pop: -1, claimed: false, hint: null };
    sfx.sparkle();
    this.host.toast(`Überraschung! Wer ${withArticle(char)} schreibt, lässt die Blase platzen!`, 'info');
  }

  /** letters a surprise bubble may show: none of the practice letters, nothing confusable with them */
  private surpriseLetters(): string[] {
    const t = this.practiceTarget;
    return t ? surprisePool(t, this.host.settings.practice.targets) : [];
  }

  private wishPos(w: Wish): { x: number; y: number } {
    return { x: w.x + Math.sin(this.t * 0.9 + 1) * 10, y: w.y + Math.sin(this.t * 1.6) * 12 };
  }

  private popWish(c: Creature): void {
    const w = this.wish;
    if (!w) return;
    w.pop = 0;
    this.wishesFreed++;
    const { x, y } = this.wishPos(w);
    sfx.plopp(2);
    sfx.fanfare();
    this.particles.add({ kind: 'ring', x, y, size: WISH_R * 1.7, max: 0.45, color: 'rgba(255,255,255,0.95)' });
    this.particles.burst('drop', x, y, 18, { color: 'rgba(210,240,255,0.95)', size: 7, speed: 340, gravity: 600, max: 0.7 });
    this.particles.burst('confetti', x, y, 28, { colors: ['#ff6f91', '#ffd84a', '#7cdcff', '#8dff6b'], size: 13, speed: 320, max: 1.4, gravity: 420 });
    this.particles.add({ kind: 'text', x, y: y - WISH_R - 40, vy: -40, max: 2, size: 46, color: '#ffd84a', text: 'Befreit!' });
    c.bubble = { text: 'Juhu, du hast mich befreit!', t: 0, good: true };
  }

  /** the surprise bubble: the letter as a template on writing lines, inside a soap bubble */
  private drawWish(ctx: CanvasRenderingContext2D): void {
    const w = this.wish;
    if (!w || w.pop >= 0.25) return;
    const { x, y } = this.wishPos(w);
    const R = WISH_R;
    const appear = ease.outBack(clamp(w.t / 0.7));
    const swell = w.pop >= 0 ? 1 + w.pop * 2 : 1;
    const wob = w.claimed ? Math.sin(this.t * 30) * 0.06 : w.hint ? Math.sin(this.t * 25) * 0.08 * (1 - w.hint.t / 2.2) : 0;
    const g = this.template(w.char);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(appear * swell * (1 + wob), appear * swell * (1 - wob));
    ctx.globalAlpha = w.pop >= 0 ? clamp(1 - w.pop / 0.25) : 1;
    const glow = ctx.createRadialGradient(0, 0, R * 0.6, 0, 0, R * 1.45);
    glow.addColorStop(0, 'rgba(255,250,210,0.55)');
    glow.addColorStop(1, 'rgba(255,250,210,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, R * 1.45, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.96, 0, TAU);
    ctx.fill();
    if (g) {
      // the letter writes itself on school lines inside the bubble, again and again
      const u = R * 0.52;
      const top = -1.5 * u;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.94, 0, TAU);
      ctx.clip();
      drawSchoolLines(ctx, -R, R, top, u, this.lineKind());
      ctx.restore();
      const t = w.t % (writeDuration(g) + 1.6);
      const pen = drawWriting(ctx, g, (-g.w * u) / 2, top, t, { unit: u, ink: '#5b3bd6', ghost: true, pen: 0.2 });
      if (pen) drawPencil(ctx, (-g.w * u) / 2 + pen.x * u, top + pen.y * u, u / 50);
    }
    const b = bubbleSprite(R, (this.t * 40) % 360, 200);
    ctx.drawImage(b as CanvasImageSource, -b.width / 2, -b.height / 2);
    ctx.restore();
    if (w.pop >= 0) return;
    // label above the bubble
    const text = w.hint?.text ?? 'Schreib mich!';
    const pulse = 1 + Math.sin(this.t * 4) * 0.05;
    ctx.save();
    ctx.translate(x, y - R * appear - 34);
    ctx.scale(appear * pulse, appear * pulse);
    ctx.font = '700 28px Fredoka, system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 34;
    ctx.fillStyle = w.hint ? '#fff0f2' : '#ffffff';
    ctx.strokeStyle = w.hint ? '#e5484d' : '#7c5cff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-tw / 2, -24, tw, 48, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2a5c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 1);
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
        this.showCreature(c);
        return true;
      }
    }
    return false;
  }

  /** a creature was tapped */
  protected showCreature(c: Creature): void {
    if (c.glyph && c.sticker) this.host.showCard({ glyph: c.glyph, sticker: c.sticker, name: this.def.word[0] });
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

  /** e.g. "12 Fische" */
  countText(): string {
    const n = this.count();
    return `${n} ${n === 1 ? this.def.word[0] : this.def.word[1]}`;
  }

  async saveState(): Promise<SceneSave | null> {
    const living = this.creatures.filter((c) => !c.leaving && c.glyph);
    const away = this.album.length + this.awayBefore;
    if (!living.length && !away) return null;
    const summary = this.countText();
    const creatures = await Promise.all(living.map(async (c) => ({ glyph: await saveGlyph(c.glyph!), x: Math.round(c.x), y: Math.round(c.y), facing: c.facing })));
    const state: HabitatSave = {
      creatures,
      away,
      practiceIndex: this.practiceIndex,
      practiceDone: this.practiceDone,
      goalReached: this.goalReached,
      written: this.written,
      wishesFreed: this.wishesFreed,
    };
    return { state, summary };
  }

  async restoreState(raw: unknown): Promise<void> {
    const s = raw as HabitatSave;
    const loaded = await Promise.all(s.creatures.map((c) => loadGlyph(c.glyph)));
    s.creatures.forEach((sc, i) => {
      const c = this.addCreature(loaded[i].glyph, loaded[i].sticker);
      this.settle(c, sc);
    });
    this.awayBefore = s.away;
    this.practiceIndex = s.practiceIndex;
    this.practiceDone = s.practiceDone;
    this.goalReached = s.goalReached;
    this.written = s.written;
    this.wishesFreed = s.wishesFreed;
  }

  /** a creature of a saved game comes back where it was */
  protected settle(c: Creature, at: { x: number; y: number; facing: 1 | -1 }): void {
    const B = this.bounds;
    c.x = clamp(at.x, B.x0, B.x1);
    c.y = clamp(at.y, B.y0, B.y1);
    c.tx = c.x;
    c.ty = c.y;
    c.facing = at.facing;
    c.face = at.facing;
  }

  count(): number {
    return this.creatures.filter((c) => !c.leaving).length + this.album.length + this.awayBefore;
  }
}

export function starCount(score: number): number {
  return score < 30 ? 1 : score < 50 ? 2 : score < 70 ? 3 : score < 88 ? 4 : 5;
}

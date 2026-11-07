// The class advent calendar: a snowy house with 24 doors. The letters the class writes fly into today's door;
// when the task is done the door springs open and a funny surprise jumps out, with a joke of the day.
// Wichtel Flocke stands in front of the house and says what to do. See
// docs/superpowers/specs/2026-11-07-adventskalender-design.md.
import { adventToday, counts, currentDay, isDone, loadAdvent, needed, saveAdvent, sleepsUntil, taskText, TASKS, type AdventTask, type OpenDoor } from '../game/advent/advent.ts';
import {

  chimneyTop,
  houseK,
  doorPath,
  doorRect,
  drawDoorFace,
  drawDoorOpen,
  drawRoofStar,
  flockeSpot,
  houseRect,
  houseX0,
  paintAdvent,
  roofLights,
  shapeOf,
  type Rect,
} from '../game/advent/house.ts';
import { drawFig, GAGS, genomeOf, RIGHTWARD, spriteOf, SURPRISES, type Act, type Stage, type Who } from '../game/advent/surprises.ts';
import { Telling } from '../game/advent/telling.ts';
import { sfx } from '../game/audio.ts';
import { makeCanvas, type AnyCanvas, type Ctx } from '../game/canvas.ts';
import type { Genome } from '../game/creatures/genome.ts';
import { sparkleStar } from '../game/creatures/parts.ts';
import { weihnachtenSprite } from '../game/creatures/seasons/weihnachten.ts';
import type { Sprite } from '../game/creatures/sprite.ts';
import { clamp, ease, hsl, lerp, TAU } from '../game/math.ts';
import { mulberry32 } from '../game/rng.ts';
import { Speaker } from '../game/voice/speaker.ts';
import { scriptOf } from '../recog/scripts.ts';
import type { ScannedGlyph, Tier } from '../vision/types.ts';
import { HabitatScene, type Creature, type HabitatDef } from './habitat.ts';
import type { SceneSave } from './saved.ts';
import type { SceneHost, Snapshot } from './scene.ts';
import { t, tk } from '../i18n/i18n.ts';

export { SURPRISES, type Surprise } from '../game/advent/surprises.ts';

/** the door swings open, then the figure jumps out onto the stage in front of the house */
const SWING = 0.7;
const JUMP = 0.7;
const STAGE_Y = 928;
const STAGE_S = 1.3;
const FLOCKE_S = 1.1;
const Y0 = 868;
const Y1 = 1010;

interface Flake {
  fx: number;
  y: number;
  r: number;
  v: number;
  ph: number;
}

function drawFlakes(s: { W: number; t: number }, ctx: CanvasRenderingContext2D, list: Flake[]): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (const f of list) {
    ctx.beginPath();
    ctx.arc(f.fx * s.W + Math.sin(s.t * 0.7 + f.ph) * 22, f.y, f.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** the fairy lights on the roof; t null: all on (start tile) */
function drawLights(ctx: Ctx, W: number, t: number | null): void {
  roofLights(W).forEach((l, i) => {
    const on = t === null ? 1 : 0.55 + 0.45 * Math.sin(t * 1.9 + i * 1.7);
    const g = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 18);
    g.addColorStop(0, hsl(l.hue, 1, 0.75, 0.75 * on));
    g.addColorStop(1, hsl(l.hue, 1, 0.7, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = hsl(l.hue, 1, lerp(0.45, 0.8, on));
    ctx.beginPath();
    ctx.arc(l.x, l.y, 5.5, 0, TAU);
    ctx.fill();
  });
}

/** smoke from the chimney: a few soft puffs, no state */
function drawSmoke(ctx: Ctx, W: number, t: number): void {
  const top = chimneyTop(W);
  for (let i = 0; i < 5; i++) {
    const p = (t * 0.22 + i / 5) % 1;
    ctx.fillStyle = `rgba(235,235,250,${0.4 * (1 - p)})`;
    ctx.beginPath();
    ctx.arc(top.x + Math.sin(p * 6 + i) * 16 + p * 50, top.y - 10 - p * 190, 12 + p * 30, 0, TAU);
    ctx.fill();
  }
}

/** a letter painted like a child's letter (for doors opened on an earlier visit) */
function paintedLetter(ch: string): AnyCanvas {
  const { canvas, ctx } = makeCanvas(72, 84);
  ctx.fillStyle = '#23236b';
  ctx.font = '500 66px Fredoka, "Comic Sans MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 36, 46);
  return canvas;
}

/** Flocke's badge: a golden star */
function starSticker(): AnyCanvas {
  const { canvas, ctx } = makeCanvas(64, 64);
  ctx.fillStyle = '#ffcf3a';
  ctx.strokeStyle = '#b8860b';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2;
    const r = i % 2 ? 13 : 28;
    ctx.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return canvas;
}

/** draws the figure of a door small inside the open door */
function miniFigure(ctx: Ctx, sp: Sprite, r: Rect, t: number): void {
  const s = (Math.min(r.w, r.h) * 0.92) / Math.max(sp.canvas.width, sp.canvas.height);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2 + Math.min(r.w, r.h) * 0.06;
  const bob = Math.sin(t * 2 + r.x) * 2;
  drawFig(ctx, sp, cx - (sp.canvas.width / 2 - sp.ax) * s, cy - (sp.canvas.height / 2 - sp.ay) * s + bob, { s });
}

/** smaller when the snow gets crowded */
const depthAt = (y: number, n: number) => lerp(0.82, 1.05, clamp((y - Y0) / (Y1 - Y0))) * (n > 14 ? 0.8 : n > 7 ? 0.9 : 1);

export const advent: HabitatDef = {
  id: 'advent',
  archetype: 'season',
  word: [tk('Adventsfreund'), tk('Adventsfreunde')],
  count: [tk('{n} Adventsfreund'), tk('{n} Adventsfreunde')],
  makeSprite: weihnachtenSprite,
  sortY: true,
  // the snow in front of the house
  bounds: (W) => ({ x0: Math.max(140, flockeSpot(W).x + 170), x1: W - 140, y0: Y0, y1: Y1 }),

  paint: paintAdvent,

  init(s) {
    const r = mulberry32(24);
    const flake = (big: boolean): Flake => ({ fx: r(), y: r() * 1080, r: big ? 3 + r() * 2.5 : 1.4 + r() * 1.6, v: big ? 45 + r() * 25 : 22 + r() * 20, ph: r() * TAU });
    s.amb.back = Array.from({ length: 70 }, () => flake(false));
    s.amb.front = Array.from({ length: 30 }, () => flake(true));
  },

  ambient(s, dt) {
    for (const list of [s.amb.back, s.amb.front] as Flake[][])
      for (const f of list) {
        f.y += f.v * dt;
        if (f.y > 1090) {
          f.y = -10;
          f.fx = Math.random();
        }
      }
  },

  renderBack(s, ctx) {
    drawSmoke(ctx, s.W, s.t);
    drawLights(ctx, s.W, s.t);
    drawFlakes(s, ctx, s.amb.back as Flake[]);
  },

  renderFront(s, ctx) {
    drawFlakes(s, ctx, s.amb.front as Flake[]);
  },

  behave(s, c, dt) {
    const B = s.bounds;
    const kind = c.genome.variant % 4;
    c.depth = depthAt(c.y, s.creatures.length);
    const speed = lerp(50, 85, c.genome.q);
    if (c.state === 'idle') {
      c.vx = lerp(c.vx, 0, dt * 5);
      c.lift = Math.max(0, c.lift - dt * 300);
      c.rot = lerp(c.rot, 0, dt * 8);
      if (c.stateT > 1.5 + (c.id % 3)) {
        c.stateT = 0;
        c.state = Math.random() < (kind === 2 ? 0.7 : 0.4) ? 'hop' : 'walk';
        c.tx = clamp(c.x + (Math.random() - 0.5) * 700, B.x0, B.x1);
        c.ty = clamp(c.y + (Math.random() - 0.5) * 120, B.y0, B.y1);
      }
    } else if (c.state === 'walk' || c.state === 'hop') {
      const dx = c.tx - c.x;
      const dy = c.ty - c.y;
      const d = Math.hypot(dx, dy);
      c.vx = lerp(c.vx, (dx / (d || 1)) * speed, dt * 4);
      c.vy = lerp(c.vy, (dy / (d || 1)) * speed * 0.5, dt * 4);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (Math.abs(c.vx) > 5) c.facing = c.vx >= 0 ? 1 : -1;
      if (c.state === 'hop') {
        c.lift = Math.abs(Math.sin(c.stateT * 6)) * 32;
        c.rot = Math.sin(c.stateT * 12) * 0.06;
      } else {
        c.lift = Math.abs(Math.sin(c.age * 10)) * 4;
        c.rot = Math.sin(c.age * 9) * 0.05;
      }
      if (d < 15 || c.stateT > 8) {
        c.state = 'idle';
        c.stateT = 0;
      }
    } else {
      c.state = 'idle';
      c.stateT = 0;
    }
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    c.y = clamp(c.y, B.y0, B.y1);
  },

  tile(ctx, W, H, kit) {
    // the house close up: one door open with its figure and glitter, Flocke in front
    const VW = 1440;
    const s = H / 860;
    ctx.save();
    ctx.scale(s, s);
    ctx.translate(-(VW - W / s) / 2 - 40, -190);
    paintAdvent(ctx, VW, 1080);
    drawLights(ctx, VW, null);
    drawRoofStar(ctx, VW, 0.3, 1);
    const day = 16;
    const r = doorRect(VW, day);
    const g = genomeOf(SURPRISES[day - 1].who, 92, 5);
    const sp = spriteOf(SURPRISES[day - 1].who, g, kit.sticker('S'));
    drawDoorOpen(ctx, day, r, 1, (k) => miniFigure(k, sp, r, 0));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.4;
      sparkleStar(ctx, r.x + r.w / 2 + Math.cos(a) * r.w * 0.85, r.y + r.h / 2 + Math.sin(a) * r.h * 0.85, 9 + (i % 3) * 5);
    }
    const f = flockeSpot(VW);
    const flocke = spriteOf('wichtel', genomeOf('wichtel', 86, 7), starSticker());
    kit.draw(ctx, flocke, f.x + 40, f.y, 1.25);
    const deer = spriteOf('rentier', genomeOf('rentier', 95, 11), kit.sticker('A'));
    kit.draw(ctx, deer, doorRect(VW, 24).x + 300, 950, 1.05, -1);
    ctx.restore();
  },
};

interface Best {
  char: string;
  score: number;
  sticker: AnyCanvas | null;
}

interface Bouncer {
  sticker: AnyCanvas;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  t: number;
}

type Mood = 'task' | 'good' | 'oops' | 'joke';

const RANK: Record<Tier, number> = { zerknittert: 0, schief: 1, nett: 2, schoen: 3, prachtvoll: 4 };

const PRAISE = [tk('Super! Noch {n}!'), tk('Juhu! Noch {n}!'), tk('Wow, wie schön! Noch {n}!'), tk('Klasse! Noch {n}!'), tk('Das Türchen kichert schon! Noch {n}!')];
const PRAISE_ONE = [tk('Super! Nur noch einer!'), tk('Fast offen! Nur noch einer!')];
const FLOCKE_TAPPED = [tk('Hihi, das kitzelt!'), tk('Ich bin Flocke, der Türchen-Wichtel!'), tk('Psst … hinter jedem Türchen wartet etwas Lustiges!'), tk('Ich habe heute schon drei Kekse genascht.')];

export class AdventScene extends HabitatScene {
  /** no practice mode and no surprise bubbles in the calendar */
  protected letters = false;
  readonly year: number;
  /** the last door that may open today */
  readonly today: number;
  /** open doors of this year on this device */
  open: Record<number, OpenDoor>;
  /** the door the class is working on (null: all doors up to today are open) */
  day: number | null;
  /** letters counted for this door (upper case) */
  counted: string[] = [];
  /** what Flocke says */
  flocke = '';
  private flockeTitle: string | null = null;
  private mood: Mood = 'task';
  private moodT = 0;
  private hold = 0;
  private best: Best | null = null;
  /** progress of doors the class switched away from */
  private progress = new Map<number, { counted: string[]; best: Best | null }>();
  private act: Act | null = null;
  private actT = 0;
  private figs = new Map<number, number>();
  private daySprites = new Map<number, Sprite>();
  private flockeSp: Sprite;
  private splatT = -1;
  private bouncers: Bouncer[] = [];
  private shake = new Map<number, number>();
  private pulse = 0;
  private giggleIn = 4;
  private giggle = 0;
  private landed = new Set<number>();
  private extras = new Map<Who, Sprite>();
  private stage: Stage;
  private readonly speaker: Pick<Speaker, 'run' | 'stop'>;
  /** the story being read (kept a moment after the end, to fade out) */
  private telling: Telling | null = null;
  private tellingOut = 0;

  constructor(host: SceneHost, worldW: number, now = new Date(), speaker: Pick<Speaker, 'run' | 'stop'> = new Speaker()) {
    super(advent, host, worldW);
    this.speaker = speaker;
    this.year = now.getFullYear();
    this.today = adventToday(now);
    this.open = loadAdvent(this.year);
    this.flockeSp = spriteOf('wichtel', genomeOf('wichtel', 86, 7), starSticker());
    const B = this.bounds;
    const r = mulberry32(this.year);
    for (const d of Object.keys(this.open).map(Number).sort((a, b) => a - b)) {
      const c = this.addFigure(d, this.open[d], null, lerp(B.x0 + 60, B.x1 - 60, r()), lerp(B.y0, B.y1, r()));
      c.spawn = 1;
    }
    this.day = currentDay(this.openSet(), this.today);
    this.say(this.taskLine(), 'task', 0);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.stage = {
      particles: this.particles,
      get W() {
        return self.W;
      },
      get flockeHead() {
        return self.flockeHead();
      },
      say: (text, good) => self.say(text, good ? 'good' : 'oops', 4),
      splat: () => {
        self.splatT = 0;
      },
      extra: (who) => self.extra(who),
    };
  }

  // ------------------------------------------------------------------------------------------- state

  private get latin(): boolean {
    return scriptOf(this.host.settings.script).seg === 'latin';
  }

  private get task(): AdventTask | null {
    return this.day === null ? null : TASKS[this.day - 1];
  }

  private openSet(): Set<number> {
    return new Set(Object.keys(this.open).map(Number));
  }

  /** a door in world coordinates */
  doorAt(day: number): { x: number; y: number; w: number; h: number } {
    return doorRect(this.W, day);
  }

  private say(text: string, mood: Mood, hold: number, title: string | null = null): void {
    this.flocke = text;
    this.flockeTitle = title ?? (mood === 'task' && this.day !== null ? t('Türchen {n}', { n: this.day }) : null);
    this.mood = mood;
    this.moodT = 0;
    this.hold = hold;
  }

  private taskLine(): string {
    const task = this.task;
    if (!task) return Object.keys(this.open).length >= 24 ? t('Frohe Weihnachten! Alle 24 Türchen sind offen!') : t('Alle Türchen bis heute sind offen! Morgen geht es weiter.');
    return taskText(task, this.latin);
  }

  private backToTask(): void {
    this.say(this.taskLine(), 'task', 0);
  }

  private extra(who: Who): Sprite {
    let sp = this.extras.get(who);
    if (!sp) {
      sp = spriteOf(who, genomeOf(who, 80, who.length * 101), null);
      this.extras.set(who, sp);
    }
    return sp;
  }

  private flockeHead(): { x: number; y: number } {
    const f = flockeSpot(this.W);
    return { x: f.x + 18, y: f.y - this.flockeSp.radius * FLOCKE_S * 0.75 };
  }

  /** the figure of a door, in front of the house */
  private addFigure(day: number, door: OpenDoor, sticker: AnyCanvas | null, x: number, y: number, genome?: Genome, sprite?: Sprite): Creature {
    const s = SURPRISES[day - 1];
    const g = genome ?? genomeOf(s.who, door.score, this.year * 31 + day * 977);
    const st = sticker ?? paintedLetter(door.char);
    const sp = sprite ?? spriteOf(s.who, g, st);
    this.daySprites.set(day, sp);
    const c = this.place({ sprite: sp, genome: g, sticker: st }, x, y);
    c.depth = depthAt(c.y, this.creatures.length);
    this.figs.set(c.id, day);
    return c;
  }

  /** every figure of a door stays: nobody moves out */
  protected place(look: Pick<Creature, 'glyph' | 'sticker' | 'painted' | 'genome' | 'sprite'>, x: number, y: number): Creature {
    const c = super.place(look, x, y);
    for (const o of this.creatures) o.leaving = false;
    return c;
  }

  // ------------------------------------------------------------------------------------------- letters

  /** a letter arrives at the door: true when it counts */
  feed(g: ScannedGlyph, sticker: AnyCanvas): boolean {
    const task = this.task;
    if (!task || this.act || this.day === null) {
      if (this.act) this.say(t('Moment, das Türchen geht gerade auf!'), 'oops', 3);
      return false;
    }
    if (!counts(task, g, this.counted, this.latin)) {
      this.say(this.whyNot(task, g), 'oops', 4);
      return false;
    }
    this.counted.push(g.score.char.toUpperCase());
    if (!this.best || g.score.score > this.best.score) this.best = { char: g.score.char, score: g.score.score, sticker };
    this.pulse = 1;
    const r = this.doorAt(this.day);
    this.particles.burst('spark', r.x + r.w / 2, r.y + r.h / 2, 12, { color: '#fff6a8', size: 16, speed: 260, max: 0.9 });
    if (isDone(task, this.counted, this.latin)) this.openDoor();
    else {
      const left = needed(task, this.latin) - this.counted.length;
      const list = left === 1 ? PRAISE_ONE : PRAISE;
      this.say(t(list[Math.floor(Math.random() * list.length)], { n: left }), 'good', 3.5);
    }
    return true;
  }

  /** why a letter did not count, said kindly and a bit cheekily */
  private whyNot(task: AdventTask, g: ScannedGlyph): string {
    const s = g.score;
    if (s.tip === 'spiegel') return t('Hihi, das ist andersrum!');
    const strict = task.kind === 'nice';
    if (RANK[s.tier] < (strict ? RANK.schoen : RANK.nett)) return strict ? t('Fast! Das geht noch ein bisschen schöner!') : t('Fast! Schreib es noch ein bisschen ordentlicher!');
    if (!this.latin) return t('Fast! Probier ein anderes Zeichen!');
    const c = s.char.toUpperCase();
    if (task.kind === 'letter') return t('Hihi, das ist kein {c}!', { c: task.char });
    if (task.kind === 'different') return t('Ein {c} hatten wir schon! Ein anderer Buchstabe!', { c });
    if (task.kind === 'name') return task.word.includes(c) ? t('Genug {c}! Uns fehlen noch andere Buchstaben.', { c }) : t('Hihi, in {w} gibt es kein {c}!', { w: task.word, c });
    return t('Fast! Nochmal!');
  }

  private openDoor(): void {
    const d = this.day!;
    const b = this.best!;
    this.open[d] = { char: b.char, score: b.score };
    saveAdvent(this.year, this.open);
    this.progress.delete(d);
    const s = SURPRISES[d - 1];
    const genome = genomeOf(s.who, b.score, this.year * 31 + d * 977);
    const sticker = b.sticker ?? paintedLetter(b.char);
    const sp = spriteOf(s.who, genome, sticker);
    this.daySprites.set(d, sp);
    const r = this.doorAt(d);
    const B = this.bounds;
    const fx = flockeSpot(this.W).x;
    const x = clamp(r.x + r.w / 2, Math.max(B.x0 + 160, fx + 300), B.x1 - 200);
    const dir: 1 | -1 = RIGHTWARD.includes(s.gag) ? 1 : s.gag === 'snowball' ? -1 : x < this.W * 0.6 ? 1 : -1;
    this.act = { day: d, s, t: -(SWING + JUMP), x, y: STAGE_Y, x0: x, S: STAGE_S, dir, sp, genome, v: {}, cache: { sticker } };
    this.actT = 0;
    this.best = null;
    this.counted = [];
    sfx.fanfare();
    this.particles.add({ kind: 'ring', x: r.x + r.w / 2, y: r.y + r.h / 2, size: Math.max(r.w, r.h) * 1.6, max: 0.5, color: 'rgba(255,240,160,0.95)' });
    this.particles.burst('confetti', r.x + r.w / 2, r.y + r.h / 2, 36, { colors: ['#ff6f91', '#ffd84a', '#7cdcff', '#8dff6b'], size: 13, speed: 360, max: 1.5, gravity: 420 });
    this.say(t('Geschafft! Das Türchen geht auf!'), 'good', 0);
    this.tell(d);
  }

  // ------------------------------------------------------------------------------------------- stories

  /** a story of this door is being read */
  private isTelling(day: number): boolean {
    return !!this.telling && !this.telling.done && this.telling.day === day;
  }

  /** reads the story of a door aloud, with subtitles; it ends the story before */
  private tell(day: number): void {
    const tl = new Telling(day);
    this.telling = tl;
    this.tellingOut = 0;
    const end = () => tl.end();
    this.speaker.run(tl.lines, (i) => tl.heardLine(i)).then(end, end);
  }

  /** a new sentence of the story is on screen */
  private storyLine(tl: Telling): void {
    const voice = tl.lines[tl.shown].voice;
    // Flocke's sentence goes into Flocke's bubble; the figure hops when it speaks (its bubble: drawFigureLine)
    if (voice === 'flocke') this.say(t(tl.lines[tl.shown].key), 'good', 0);
    if (voice === 'wesen') {
      const c = this.figureOf(tl.day);
      if (c && !this.act) this.jump(c);
    }
  }

  private figureOf(day: number): Creature | null {
    return this.creatures.find((c) => this.figs.get(c.id) === day) ?? null;
  }

  /** the figure's sentence of the story, as a speech bubble over the figure */
  private drawFigureLine(ctx: CanvasRenderingContext2D): void {
    const tl = this.telling;
    if (!tl || tl.done || tl.lines[tl.shown].voice !== 'wesen') return;
    let at: { x: number; top: number } | null = null;
    const a = this.act;
    if (a && a.day === tl.day && a.t >= 0) at = { x: a.x, top: a.y - a.sp.radius * a.S };
    else {
      const c = this.figureOf(tl.day);
      if (c) at = { x: c.x, top: c.y - c.lift - c.sprite.radius * c.depth };
    }
    if (!at) return;
    const text = t(tl.lines[tl.shown].key);
    const pop = tl.shownT < 0.3 ? ease.outBack(tl.shownT / 0.3) : 1;
    ctx.save();
    ctx.font = '600 32px Fredoka, system-ui, sans-serif';
    const lines = wrap(ctx, text, 420);
    const lh = 40;
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44;
    const h = lines.length * lh + 26;
    const tipY = Math.max(h + 40, at.top - 16);
    const x = clamp(at.x - w / 2, 16, this.W - w - 16);
    const y = tipY - 22 - h;
    ctx.translate(at.x, tipY);
    ctx.scale(pop, pop);
    ctx.translate(-at.x, -tipY);
    ctx.fillStyle = '#fffbe6';
    ctx.strokeStyle = '#f0b400';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 24);
    const tx = clamp(at.x, x + 30, x + w - 30);
    ctx.moveTo(tx - 14, y + h);
    ctx.lineTo(at.x, tipY);
    ctx.lineTo(tx + 14, y + h);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(tx - 11, y + h - 4, 22, 6);
    ctx.fillStyle = '#3b2a5c';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, y + 13 + lh * i + lh / 2));
    ctx.restore();
  }

  /** the story's subtitles: title and the sentence being read, calm, in the sky to the left of the roof */
  private drawSubtitles(ctx: CanvasRenderingContext2D): void {
    const tl = this.telling;
    if (!tl) return;
    const alpha = tl.done ? clamp(1 - this.tellingOut / 0.6) : clamp(tl.shown === 0 ? tl.shownT / 0.4 : 1);
    if (alpha <= 0) return;
    const body = 32;
    const lh = body * 1.3;
    const pad = 22;
    const x = 24;
    const y = 20;
    const font = `600 ${body}px Fredoka, system-ui, sans-serif`;
    ctx.save();
    ctx.globalAlpha = alpha;
    // the box is as tall as the longest sentence of the story, so it does not jump
    ctx.font = font;
    const layout = (w: number) => {
      const wrapped = tl.lines.map((l, i) => (i === 0 ? [] : wrap(ctx, t(l.key), w - 2 * pad)));
      return { w, wrapped, h: pad + 34 + Math.max(1, ...wrapped.map((l) => l.length)) * lh + pad - 6 };
    };
    let L = layout(Math.min(700, this.W - 48));
    // the chimney stands on the left of the roof: the box stays left of it when it would reach down to it
    const chim = chimneyTop(this.W);
    const k = houseK(this.W);
    if (y + L.h > chim.y - 16 * k - 14) L = layout(Math.max(360, chim.x - 76 * k - 16 - x));
    const { w, wrapped, h } = L;
    ctx.fillStyle = 'rgba(28,22,66,0.84)';
    ctx.strokeStyle = 'rgba(255,214,110,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 22);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd86e';
    ctx.font = '700 26px Fredoka, system-ui, sans-serif';
    ctx.fillText(t(tl.lines[0].key), x + pad, y + pad + 12, w - 2 * pad);
    // the sentence fades in softly
    const lines = wrapped[tl.shown];
    ctx.globalAlpha = alpha * clamp(tl.shownT / 0.35);
    ctx.font = font;
    ctx.fillStyle = { erzaehler: '#ffffff', wesen: '#fff1b8', flocke: '#ffd9ec' }[tl.lines[tl.shown].voice];
    // a short sentence sits in the middle of the room the box keeps for the longest one
    const rows = Math.max(1, ...wrapped.map((l) => l.length));
    const y0 = y + pad + 34 + ((rows - lines.length) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x + pad, y0 + lh * i + lh / 2));
    ctx.restore();
  }

  /** the story is over: Flocke tells the joke of the day */
  private storyDone(tl: Telling): void {
    if (!this.act) this.tellJoke(tl.day, 30);
  }

  private finishAct(): void {
    const a = this.act!;
    this.act = null;
    const B = this.bounds;
    const c = this.addFigure(a.day, this.open[a.day], a.cache.sticker ?? null, clamp(a.x, B.x0, B.x1), clamp(a.y, B.y0, B.y1), a.genome, a.sp);
    c.spawn = 1;
    c.facing = a.dir;
    c.face = a.dir;
    this.day = currentDay(this.openSet(), this.today);
    const p = this.day === null ? undefined : this.progress.get(this.day);
    this.counted = p?.counted ?? [];
    this.best = p?.best ?? null;
    // during the story Flocke keeps quiet; the joke comes when it is over
    if (this.isTelling(a.day)) this.backToTask();
    else this.tellJoke(a.day, 40);
  }

  private tellJoke(day: number, hold: number): void {
    this.say(t(SURPRISES[day - 1].joke), 'joke', hold, t('Witz des Tages'));
  }

  protected flightTarget(_g: ScannedGlyph, _snap: Snapshot): { x: number; y: number } {
    const d = this.act?.day ?? this.day;
    if (d === null) {
      const h = houseRect(this.W);
      return { x: h.x + h.w / 2, y: h.y + h.h * 0.6 };
    }
    const r = this.doorAt(d);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  protected hatch(g: ScannedGlyph, sticker: AnyCanvas, _wish: boolean): Creature | null {
    if (this.feed(g, sticker)) this.landed.add(g.id);
    else {
      const at = this.flightTarget(g, null as unknown as Snapshot);
      this.bouncers.push({ sticker, x: at.x, y: at.y, vx: (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 160), vy: -560, rot: 0, vr: (Math.random() - 0.5) * 14, t: 0 });
      this.particles.add({ kind: 'text', x: at.x, y: at.y - 60, vy: -40, max: 1.4, size: 40, color: '#ffd84a', text: t('Boing!') });
      sfx.boing();
    }
    return null;
  }

  protected hatchedAt(g: ScannedGlyph): { x: number; y: number; r: number } | null {
    if (!this.landed.has(g.id)) return null;
    this.landed.delete(g.id);
    const at = this.flightTarget(g, null as unknown as Snapshot);
    return { x: at.x, y: at.y, r: 50 };
  }

  // ------------------------------------------------------------------------------------------- tapping

  tap(x: number, y: number): boolean {
    for (let d = 1; d <= 24; d++) {
      const r = this.doorAt(d);
      if (x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 6 && y <= r.y + r.h + 6) return this.tapDoor(d);
    }
    const f = flockeSpot(this.W);
    if (Math.hypot(x - f.x, y - (f.y - 20)) < 95) {
      sfx.boing();
      if (this.act) return true;
      if (this.mood === 'task') {
        const line = FLOCKE_TAPPED[Math.floor(Math.random() * FLOCKE_TAPPED.length)];
        this.say(t(line), 'good', 3);
        // Flocke says it aloud, unless a story is being read
        if (!this.telling || this.telling.done) void this.speaker.run([{ key: line, voice: 'flocke' }]);
      } else this.backToTask();
      return true;
    }
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      if (Math.hypot(c.x - x, c.y - y) < c.sprite.radius * c.depth * 1.1) {
        this.jump(c);
        const d = this.figs.get(c.id);
        if (d && !this.act && !this.isTelling(d)) this.tell(d);
        return true;
      }
    }
    return false;
  }

  private jump(c: Creature): void {
    sfx.boing();
    c.state = 'jump';
    c.stateT = 0;
    this.particles.burst('heart', c.x, c.y - c.sprite.radius, 5, { color: '#ff6fa3', size: 22, speed: 120, max: 1, gravity: -80 });
  }

  private tapDoor(d: number): boolean {
    if (this.act) return true;
    if (this.open[d]) {
      for (const c of this.creatures) if (this.figs.get(c.id) === d) this.jump(c);
      const r = this.doorAt(d);
      this.particles.burst('spark', r.x + r.w / 2, r.y + r.h / 2, 8, { color: '#fff6a8', size: 14, speed: 200, max: 0.8 });
      if (!this.isTelling(d)) this.tell(d);
      return true;
    }
    if (d > this.today) {
      const n = sleepsUntil(d, this.today);
      this.say(n === 1 ? t('Nicht schummeln! Nur noch 1 Mal schlafen.') : t('Nicht schummeln! Noch {n} Mal schlafen.', { n }), 'oops', 4);
      this.shake.set(d, 0);
      sfx.bonk();
      return true;
    }
    // a closed door up to today: it becomes the task (progress of the other door is kept)
    if (d !== this.day) {
      if (this.day !== null) this.progress.set(this.day, { counted: this.counted, best: this.best });
      this.day = d;
      const p = this.progress.get(d);
      this.counted = p?.counted ?? [];
      this.best = p?.best ?? null;
      sfx.click();
    }
    this.backToTask();
    this.pulse = 1;
    return true;
  }

  // ------------------------------------------------------------------------------------------- time

  update(dt: number): void {
    super.update(dt);
    this.moodT += dt;
    if (this.hold > 0 && this.moodT > this.hold && !this.act) this.backToTask();
    if (this.splatT >= 0) {
      this.splatT += dt;
      if (this.splatT > 3.2) this.splatT = -1;
    }
    this.pulse = Math.max(0, this.pulse - dt * 1.5);
    this.giggle = Math.max(0, this.giggle - dt);
    for (const [d, v] of this.shake) {
      if (v + dt > 0.6) this.shake.delete(d);
      else this.shake.set(d, v + dt);
    }
    for (const b of this.bouncers) {
      b.t += dt;
      b.vy += 1400 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
    }
    this.bouncers = this.bouncers.filter((b) => b.t < 1.4);
    // today's door giggles and glitters, more with every letter
    const task = this.task;
    if (task && this.day !== null && !this.act) {
      const r = this.doorAt(this.day);
      const prog = this.counted.length / needed(task, this.latin);
      if (Math.random() < dt * (1.5 + 10 * prog)) {
        const a = Math.random() * TAU;
        this.particles.add({ kind: 'spark', x: r.x + r.w / 2 + Math.cos(a) * r.w * 0.7, y: r.y + r.h / 2 + Math.sin(a) * r.h * 0.7, size: 8 + Math.random() * 8, max: 0.8, color: '#fff6a8' });
      }
      this.giggleIn -= dt;
      if (this.giggleIn <= 0) {
        this.giggleIn = 5 + Math.random() * 4;
        this.giggle = 0.7;
        this.particles.add({ kind: 'text', x: r.x + r.w / 2 + 20, y: r.y - 10, vy: -35, max: 1.5, size: 30, color: '#ffffff', text: t('hihi') });
      }
    }
    const tl = this.telling;
    if (tl) {
      if (!tl.done) {
        if (tl.update(dt)) this.storyLine(tl);
        if (tl.done) this.storyDone(tl);
      } else if ((this.tellingOut += dt) > 0.6) this.telling = null;
    }
    const a = this.act;
    if (a) {
      this.actT += dt;
      const t0 = a.t;
      a.t += dt;
      const gag = GAGS[a.s.gag];
      if (t0 < -JUMP && a.t >= -JUMP) {
        sfx.boing();
        this.say(t('Überraschung!'), 'good', 0);
      }
      if (a.t > 0) gag.tick(a, this.stage, Math.max(0, t0), a.t);
      if (a.t >= gag.len) this.finishAct();
    }
  }

  private get party(): boolean {
    return !!this.act && this.act.s.gag === 'finale' && this.act.t > 0;
  }

  protected behave(c: Creature, dt: number): void {
    if (this.party) {
      // everybody dances, spread out in two rows in front of the house
      const B = this.bounds;
      const i = this.creatures.indexOf(c);
      const n = this.creatures.length;
      const tx = lerp(B.x0 + 30, B.x1 - 30, (i + 0.5) / n);
      const ty = i % 2 ? B.y0 + 10 : B.y1 - 20;
      const dx = tx - c.x;
      const dy = ty - c.y;
      c.x += Math.sign(dx) * Math.min(Math.abs(dx), 380 * dt);
      c.y += Math.sign(dy) * Math.min(Math.abs(dy), 200 * dt);
      c.depth = depthAt(c.y, this.creatures.length);
      c.lift = Math.abs(Math.sin(this.t * 7 + c.phase)) * 40;
      c.rot = Math.sin(this.t * 3.5 + c.phase) * 0.3;
      if (Math.sin(this.t * 1.75 + c.phase) * Math.sin(this.t * 1.75 + c.phase - 0.1) < 0) c.facing = c.facing === 1 ? -1 : 1;
      c.state = 'idle';
      c.stateT = 0;
      return;
    }
    if (c.state === 'jump') {
      c.depth = depthAt(c.y, this.creatures.length);
      const u = c.stateT / 0.6;
      c.lift = Math.sin(clamp(u) * Math.PI) * 90;
      c.rot = Math.sin(clamp(u) * TAU) * 0.15;
      if (u >= 1) {
        c.state = 'idle';
        c.stateT = 0;
        c.lift = 0;
        c.rot = 0;
      }
      return;
    }
    // make room for the surprise on the stage
    const a = this.act;
    if (a && (Math.abs(c.x - a.x) < 380 || Math.abs(c.x - a.x0) < 380) && c.state !== 'scoot' && c.stateT >= 0) {
      const B = this.bounds;
      const side = c.x < a.x ? -1 : 1;
      const far = 460 + Math.random() * 320;
      let tx = a.x0 + side * far;
      if (tx < B.x0 || tx > B.x1) tx = a.x0 - side * far;
      c.state = 'scoot';
      c.stateT = 0;
      c.tx = clamp(tx, B.x0, B.x1);
      c.ty = c.y;
    }
    if (c.state === 'scoot') {
      // hop quickly out of the way, then watch
      c.depth = depthAt(c.y, this.creatures.length);
      const dx = c.tx - c.x;
      c.facing = dx >= 0 ? 1 : -1;
      c.x += Math.sign(dx) * Math.min(Math.abs(dx), 420 * dt);
      c.lift = Math.abs(Math.sin(c.stateT * 12)) * 26;
      if (Math.abs(dx) < 2 || c.stateT > 2) {
        c.state = 'idle';
        c.stateT = -6;
        c.lift = 0;
        c.facing = c.x < (a?.x ?? c.x) ? 1 : -1;
      }
      return;
    }
    super.behave(c, dt);
  }

  // ------------------------------------------------------------------------------------------- drawing

  render(ctx: CanvasRenderingContext2D): void {
    if (this.bg) ctx.drawImage(this.bg as CanvasImageSource, 0, 0);
    this.def.renderBack?.(this, ctx);
    const starLit = this.open[24] && !(this.act?.day === 24 && this.act.t < 0) ? 1 : 0;
    drawRoofStar(ctx, this.W, this.t, starLit);
    this.drawDoors(ctx);
    this.drawProgress(ctx);
    const f = flockeSpot(this.W);
    const list = [...this.creatures].sort((a, b) => a.y - b.y);
    let flockeDone = false;
    for (const c of list) {
      if (!flockeDone && c.y > f.y) {
        this.drawFlocke(ctx);
        flockeDone = true;
      }
      this.drawCreature(ctx, c);
    }
    if (!flockeDone) this.drawFlocke(ctx);
    this.drawAct(ctx);
    for (const b of this.bouncers) {
      const s = 70 / Math.max(1, b.sticker.height);
      ctx.save();
      ctx.globalAlpha = clamp((1.4 - b.t) / 0.4);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.drawImage(b.sticker as CanvasImageSource, (-b.sticker.width * s) / 2, (-b.sticker.height * s) / 2, b.sticker.width * s, b.sticker.height * s);
      ctx.restore();
    }
    this.particles.render(ctx);
    this.def.renderFront?.(this, ctx);
    this.drawBubbleFlocke(ctx);
    this.drawFigureLine(ctx);
    this.drawSubtitles(ctx);
    this.fx.render(ctx);
  }

  private drawDoors(ctx: CanvasRenderingContext2D): void {
    const a = this.act;
    for (let d = 1; d <= 24; d++) {
      const r = this.doorAt(d);
      if (a && a.day === d) {
        const swing = ease.outBack(clamp(this.actT / SWING));
        drawDoorOpen(ctx, d, r, swing, (k) => {
          // light streams out; the figure has jumped out
          for (let i = 0; i < 3; i++) sparkleStar(k, r.x + r.w * (0.3 + i * 0.2), r.y + r.h * (0.3 + ((i * 0.37) % 0.5)), 6 + Math.sin(this.t * 8 + i) * 3);
        });
        if (this.actT < SWING + JUMP) {
          const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 4, r.x + r.w / 2, r.y + r.h / 2, Math.max(r.w, r.h) * 1.4);
          g.addColorStop(0, `rgba(255,240,170,${0.7 * (1 - this.actT / (SWING + JUMP))})`);
          g.addColorStop(1, 'rgba(255,240,170,0)');
          ctx.fillStyle = g;
          ctx.fillRect(r.x - r.w, r.y - r.h, r.w * 3, r.h * 3);
        }
        continue;
      }
      if (this.open[d]) {
        const sp = this.daySprites.get(d);
        drawDoorOpen(ctx, d, r, 1, (k) => {
          if (sp) miniFigure(k, sp, r, this.t);
        });
        continue;
      }
      const sh = this.shake.get(d);
      if (d === this.day && !a) this.drawToday(ctx, d, r);
      else if (sh !== undefined) {
        ctx.fillStyle = '#3a2418';
        ctx.fill(doorPath(shapeOf(d), r));
        ctx.save();
        ctx.translate(Math.sin(sh * 60) * 7 * (1 - sh / 0.6), 0);
        drawDoorFace(ctx, d, r);
        ctx.restore();
        // a little padlock
        const lx = r.x + r.w / 2;
        const ly = r.y + r.h + 4;
        ctx.save();
        ctx.globalAlpha = clamp((0.6 - sh) * 4);
        ctx.translate(lx, ly + 22);
        ctx.strokeStyle = '#6b6f80';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, -8, 10, Math.PI, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(-10, 0);
        ctx.lineTo(-10, -8);
        ctx.stroke();
        ctx.fillStyle = '#ffcf3a';
        ctx.strokeStyle = '#8a6a10';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-15, -2, 30, 24, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#3b2a1a';
        ctx.beginPath();
        ctx.arc(0, 8, 3.5, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** today's door: it wiggles and glows, more with every letter */
  private drawToday(ctx: CanvasRenderingContext2D, d: number, r: Rect): void {
    const task = TASKS[d - 1];
    const prog = this.counted.length / needed(task, this.latin);
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const glow = ctx.createRadialGradient(cx, cy, Math.min(r.w, r.h) * 0.3, cx, cy, Math.max(r.w, r.h) * 1.1);
    const ga = 0.35 + 0.35 * prog + 0.15 * Math.sin(this.t * 4);
    glow.addColorStop(0, `rgba(255,236,140,${ga})`);
    glow.addColorStop(1, 'rgba(255,236,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(r.x - r.w, r.y - r.h, r.w * 3, r.h * 3);
    const p = doorPath(shapeOf(d), r);
    ctx.fillStyle = '#3a2418';
    ctx.fill(p);
    const amp = 0.03 + 0.08 * prog + 0.12 * this.pulse + (this.giggle > 0 ? 0.08 : 0);
    const rot = Math.sin(this.t * (9 + 6 * prog)) * amp;
    const sc = 1 + 0.03 * prog + 0.08 * this.pulse + Math.sin(this.t * 3) * 0.015;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    drawDoorFace(ctx, d, r);
    ctx.strokeStyle = `rgba(255,214,60,${0.7 + 0.3 * Math.sin(this.t * 5)})`;
    ctx.lineWidth = 5;
    ctx.setLineDash([10, 8]);
    ctx.lineDashOffset = -this.t * 30;
    ctx.stroke(p);
    ctx.setLineDash([]);
    ctx.restore();
  }

  /** the band under today's door: "2 von 3", or the letters of the word */
  private drawProgress(ctx: CanvasRenderingContext2D): void {
    const task = this.task;
    if (!task || this.day === null || this.act) return;
    const r = this.doorAt(this.day);
    const latin = this.latin;
    const need = needed(task, latin);
    const have = this.counted.length;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const y = r.y + r.h + 32;
    if (task.kind === 'name' && latin) {
      const left = [...this.counted];
      const letters = [...task.word].map((ch) => {
        const i = left.indexOf(ch);
        if (i >= 0) left.splice(i, 1);
        return { ch, got: i >= 0 };
      });
      const cw = 34;
      const w = letters.length * cw + 20;
      const x0 = clamp(r.x + r.w / 2 - w / 2, 10, this.W - w - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = '#5b4b8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x0, y - 22, w, 44, 22);
      ctx.fill();
      ctx.stroke();
      ctx.font = '700 28px Fredoka, system-ui, sans-serif';
      letters.forEach((l, i) => {
        const x = x0 + 10 + cw * i + cw / 2;
        if (l.got) {
          ctx.fillStyle = '#ffd84a';
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, TAU);
          ctx.fill();
        }
        ctx.fillStyle = l.got ? '#3b2a5c' : 'rgba(59,42,92,0.35)';
        ctx.fillText(l.ch, x, y + 1);
      });
    } else {
      const text = t('{a} von {b}', { a: have, b: need });
      ctx.font = '700 28px Fredoka, system-ui, sans-serif';
      const dots = need * 20;
      const w = Math.max(ctx.measureText(text).width, dots) + 40;
      const x0 = clamp(r.x + r.w / 2 - w / 2, 10, this.W - w - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = '#5b4b8a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(x0, y - 24, w, 64, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3b2a5c';
      ctx.fillText(text, x0 + w / 2, y - 4);
      for (let i = 0; i < need; i++) {
        ctx.fillStyle = i < have ? '#ffc23a' : 'rgba(59,42,92,0.2)';
        ctx.beginPath();
        ctx.arc(x0 + w / 2 - dots / 2 + 10 + i * 20, y + 24, 7, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawAct(ctx: CanvasRenderingContext2D): void {
    const a = this.act;
    if (!a) return;
    if (a.t < 0) {
      // the figure jumps from the door onto the stage
      const u = clamp((a.t + JUMP) / JUMP);
      if (a.t < -JUMP) return;
      const r = this.doorAt(a.day);
      const sx = r.x + r.w / 2;
      const sy = r.y + r.h / 2;
      const x = lerp(sx, a.x, u);
      const y = lerp(sy, a.y, ease.inQuad(u)) - Math.sin(u * Math.PI) * 160;
      drawFig(ctx, a.sp, x, y, { s: lerp(0.35, a.S, ease.outCubic(u)), rot: u * TAU * a.dir, flip: a.dir });
      return;
    }
    GAGS[a.s.gag].draw(ctx, a, this.stage);
  }

  private drawFlocke(ctx: CanvasRenderingContext2D): void {
    const f = flockeSpot(this.W);
    const mt = this.moodT;
    let lift = 0;
    let rot = Math.sin(this.t * 2.2) * 0.04;
    if (this.mood === 'good' && mt < 0.9) lift = Math.abs(Math.sin(mt * 11)) * 30 * (1 - mt / 0.9);
    if (this.mood === 'oops' && mt < 0.7) rot += Math.sin(mt * 35) * 0.12 * (1 - mt / 0.7);
    if (this.party) {
      lift = Math.abs(Math.sin(this.t * 7)) * 40;
      rot = Math.sin(this.t * 3.5) * 0.25;
    }
    const sy = 1 + Math.sin(this.t * 3) * 0.025;
    drawFig(ctx, this.flockeSp, f.x, f.y - lift, { s: FLOCKE_S, rot, sy });
    if (this.splatT >= 0) {
      const h = this.flockeHead();
      ctx.save();
      ctx.globalAlpha = clamp((3.2 - this.splatT) / 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#b9c8e6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU;
        const rr = (i % 2 ? 22 : 32) * FLOCKE_S;
        ctx.lineTo(h.x + Math.cos(ang) * rr, h.y - lift + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // name tag
    const ny = f.y + (this.flockeSp.canvas.height - this.flockeSp.ay) * FLOCKE_S + 22;
    ctx.save();
    ctx.font = '700 28px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(40,20,60,0.8)';
    const name = t('Flocke');
    ctx.strokeText(name, f.x, Math.min(ny, 1060));
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, f.x, Math.min(ny, 1060));
    ctx.restore();
  }

  /** Flocke's speech bubble, big and readable, to the left of the house */
  private drawBubbleFlocke(ctx: CanvasRenderingContext2D): void {
    if (!this.flocke) return;
    const f = flockeSpot(this.W);
    const tipX = f.x + 24;
    const tipY = f.y - this.flockeSp.ay * FLOCKE_S - 4;
    const right = houseX0(this.W) - 14;
    const maxW = clamp(right - 16, 320, 620);
    const body = this.mood === 'joke' ? 32 : 34;
    ctx.save();
    ctx.font = `600 ${body}px Fredoka, system-ui, sans-serif`;
    const lines = wrap(ctx, this.flocke, maxW - 44);
    let tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const title = this.flockeTitle;
    ctx.font = '700 26px Fredoka, system-ui, sans-serif';
    if (title) tw = Math.max(tw, ctx.measureText(title).width);
    const lh = body * 1.25;
    const w = Math.min(maxW, tw + 44);
    const h = (title ? 34 : 0) + lines.length * lh + 30;
    const x = clamp(tipX - w * 0.35, 16, Math.max(16, right - w));
    const y = Math.max(12, tipY - 30 - h);
    const pop = this.moodT < 0.3 ? ease.outBack(this.moodT / 0.3) : 1;
    const look = { task: ['#ffffff', '#5b4b8a'], good: ['#fffbe6', '#f0b400'], oops: ['#fff0f2', '#e5484d'], joke: ['#eef7ff', '#3b6fd1'] }[this.mood];
    ctx.translate(tipX, tipY);
    ctx.scale(pop, pop);
    ctx.translate(-tipX, -tipY);
    ctx.fillStyle = look[0];
    ctx.strokeStyle = look[1];
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 26);
    ctx.moveTo(clamp(tipX - 18, x + 20, x + w - 50), y + h);
    ctx.lineTo(tipX, tipY);
    ctx.lineTo(clamp(tipX + 14, x + 40, x + w - 20), y + h);
    ctx.fill();
    ctx.stroke();
    // cover the stroke where the tail meets the box
    ctx.fillRect(clamp(tipX - 15, x + 23, x + w - 47), y + h - 4, 26, 6);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let ty = y + 15;
    if (title) {
      ctx.fillStyle = look[1];
      ctx.font = '700 26px Fredoka, system-ui, sans-serif';
      ctx.fillText(title, x + 22, ty + 15);
      ty += 34;
    }
    ctx.fillStyle = '#3b2a5c';
    ctx.font = `600 ${body}px Fredoka, system-ui, sans-serif`;
    lines.forEach((l, i) => ctx.fillText(l, x + 22, ty + lh * i + lh / 2, w - 40));
    ctx.restore();
  }

  // ------------------------------------------------------------------------------------------- saving

  /** the calendar remembers itself (loadAdvent/saveAdvent); nothing for the game save */
  async saveState(): Promise<SceneSave | null> {
    return null;
  }

  async restoreState(_raw: unknown): Promise<void> {}

  destroy(): void {
    this.speaker.stop();
    this.telling = null;
    super.destroy();
  }
}

/** breaks a text into lines that fit */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxW) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}


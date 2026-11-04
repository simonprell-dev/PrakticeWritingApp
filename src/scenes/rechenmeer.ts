// "Rechenmeer": a task stands at the top, the child writes the result on paper. Every right answer brings a sea
// animal or a plant; after 10 right answers a friendly shark swims through or dolphins jump. No time limit, no
// punishment: a wrong answer gets a hint, from the second miss a counting help, after the third the solution.
import type { Settings } from '../app/settings.ts';
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, type AnyCanvas } from '../game/canvas.ts';
import { makeGenome } from '../game/creatures/genome.ts';
import { drawDolphin, drawShark, ON_SAND, SEA_ANIMALS, seaSprite, type SeaAnimal } from '../game/creatures/seaLife.ts';
import { clamp, ease, lerp, TAU } from '../game/math.ts';
import { combineGlyphs, readAnswer, type Reading } from '../game/math/readNumber.ts';
import { drawPlant, PLANT_KINDS, type Plant, type PlantKind } from '../game/math/seaPlants.ts';
import { TaskPicker, taskText, type MathTask, type PickerSave, type TaskKind } from '../game/math/tasks.ts';
import { behavePainted, OWN_STEERING } from '../game/paint/motion.ts';
import { hashBytes, mulberry32, type Rand } from '../game/rng.ts';
import { WORLD_H } from '../game/stage.ts';
import { t, tk } from '../i18n/i18n.ts';
import { scriptOf } from '../recog/scripts.ts';
import { TIER_LABEL, TIP_TEXT } from '../recog/score.ts';
import type { ScanResult, ScannedGlyph, TipId, Tier, VisionOptions } from '../vision/types.ts';
import { aquarium, sandLine } from './aquarium.ts';
import { starCount, HabitatScene, type Creature, type HabitatDef, type HabitatSave } from './habitat.ts';
import { loadGlyph, saveGlyph, type SavedGlyph } from './saved.ts';
import type { SceneHost, Snapshot } from './scene.ts';

/** right answers until the big moment */
export const SECTION = 10;
/** seconds the shark or the dolphins stay */
export const VISIT = 8;
/** seconds the solution stays after the third miss */
export const REVEAL = 4;
/** size of the counting help */
const HELP_W = 360;
const HELP_H = 200;
/** misses until the game shows the solution */
const MAX_MISSES = 3;
/** at most this many plants stand on the sand; the oldest fades away */
export const MAX_PLANTS = 12;
/** seconds a plant needs to fade away, and to grow */
const FADE = 2;
const GROW = 1.2;

export type Outcome = 'right' | 'wrong' | 'unsure' | 'several' | 'partial' | 'none' | 'busy';

export const rechenmeer: HabitatDef = {
  ...aquarium,
  id: 'rechenmeer',
  word: [tk('Tier'), tk('Tiere')],
  count: [tk('{n} Tier'), tk('{n} Tiere')],
  makeSprite: (g, sticker) => seaSprite('clownfisch', g, sticker),
};

/** the vision options of the Rechenmeer: digits only, mirrored digits count, a script with digits */
export function rechenVisionPatch(settings: Settings): Pick<VisionOptions, 'digits' | 'noMirror' | 'script'> {
  return { digits: true, noMirror: false, script: scriptOf(settings.script).seg === 'latin' ? settings.script : 'druck' };
}

interface SavedPlant {
  kind: PlantKind;
  x: number;
  tier: Tier;
  seed: number;
  glyph: SavedGlyph;
}

export interface RechenSave extends HabitatSave {
  sea: { glyph: SavedGlyph; x: number; y: number; facing: 1 | -1; kind: SeaAnimal }[];
  picker: PickerSave;
  task: MathTask | null;
  misses: number;
  pearls: number;
  section: number;
  plants: SavedPlant[];
}

let numberId = -1;

/** a task inside a translated sentence stays left to right, also in Arabic and Hebrew (LRI … PDI) */
const ltr = (text: string) => `\u2066${text}\u2069`;

export class RechenScene extends HabitatScene {
  /** letters do not hatch here: no practice letter, no surprise bubbles */
  protected letters = false;
  readonly rand: Rand;
  picker: TaskPicker;
  task: MathTask | null = null;
  misses = 0;
  pearls = 0;
  section = 0;
  /** the digits of a scan that held only part of the result */
  pending: ScannedGlyph[] | null = null;
  plants: Plant[] = [];
  visitor: { kind: 'hai' | 'delfine'; t: number } | null = null;
  /** the solution after the third miss */
  reveal: { task: MathTask; t: number } | null = null;
  /** share of right answers that grow a plant */
  plantShare = 1 / 3;
  /** the tip given for the last right answer (tests) */
  lastTip: TipId | null = null;
  /** the kind of each sea animal */
  private kinds = new Map<number, SeaAnimal>();
  private lastAnimals: SeaAnimal[] = [];
  /** shown at the board: a hint after a miss, or a request to write again */
  note: { text: string; t: number; good: boolean } | null = null;
  /** the task changed this long ago (the board pops in) */
  taskT = 0;
  /** who took the photo: only a press on "Fertig!" judges a half number on its own */
  scanTrigger: 'manual' | 'auto' = 'manual';
  /** the task that stood on the board when the photo was taken (undefined: no photo yet) */
  private asked: MathTask | null | undefined = undefined;

  constructor(host: SceneHost, worldW: number, seed = Date.now()) {
    super(rechenmeer, host, worldW);
    this.rand = mulberry32(seed);
    this.picker = new TaskPicker(mulberry32(seed ^ 0x5bd1), this.taskKinds());
    this.fx.top = 330;
    this.nextTask();
  }

  private taskKinds(): TaskKind[] {
    return this.host.settings.math?.kinds ?? ['plus20', 'minus20'];
  }

  private nextTask(): void {
    this.task = this.picker.next();
    this.misses = 0;
    this.pending = null;
    this.taskT = 0;
  }

  bonusLetters(): string[] {
    return [];
  }

  /** the settings were changed: new task kinds apply at once */
  applySettings(): void {
    const kinds = this.taskKinds();
    this.picker = TaskPicker.from(this.picker.export(), mulberry32(Date.now() ^ 0x3c6e), kinds);
    if (this.task && !kinds.includes(this.task.kind)) this.nextTask();
  }

  beginCapture(snap: Snapshot): void {
    this.asked = this.busy() ? null : this.task;
    super.beginCapture(snap);
  }

  // ---------------------------------------------------------------- answers

  handleScan(res: ScanResult, snap: Snapshot): void {
    const fresh = res.glyphs.filter((g) => g.isNew);
    // judged against the task that was asked when the photo was taken
    const asked = this.asked !== undefined ? this.asked : this.busy() ? null : this.task;
    this.asked = undefined;
    // the digits of a half number follow the paper when it was moved
    const sh = res.shift;
    if (this.pending && sh && (sh.dx || sh.dy)) this.pending = this.pending.map((g) => ({ ...g, box: { ...g.box, x: g.box.x + sh.dx, y: g.box.y + sh.dy } }));
    if (res.newSheet) this.host.toast(t('Neues Blatt erkannt!'), 'info');
    if (!fresh.length && this.pending && this.scanTrigger === 'manual') {
      // "Fertig!" pressed again without a new digit: the half number is the answer
      this.fx.start(snap, res.glyphs, new Map(), this.W, () => null, () => {});
      this.answer([], new Map(), undefined, asked);
      this.host.progress();
      return;
    }
    if (!fresh.length) {
      this.fx.start(snap, res.glyphs, new Map(), this.W, () => null, () => {});
      if (res.glyphs.length) this.host.toast(t('Ich habe nichts Neues gefunden. Schreib noch etwas!'), 'info');
      else this.host.toast(t('Ich sehe noch keine Zahl. Schreib das Ergebnis unter die Kamera!'), 'warn');
      return;
    }
    const stickers = new Map<number, AnyCanvas>();
    for (const g of res.glyphs) stickers.set(g.id, canvasFromRGBA(g.crop));
    // where the digits fly: to the new animal when the answer is right, else onto the board
    const reading = this.task && asked === this.task ? readAnswer(fresh, this.task.result, this.pending) : null;
    const isRight = reading?.kind === 'number' && reading.value === this.task!.result;
    const spot = isRight ? this.freeSpot() : null;
    const board = { x: this.W / 2, y: 150 };
    let landed = 0;
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => (g.isNew ? (spot ?? { x: board.x + (this.rand() - 0.5) * 120, y: board.y }) : null),
      () => {
        landed++;
        if (landed < fresh.length) return;
        const out = this.answer(fresh, stickers, spot ?? undefined, asked);
        if (out !== 'right') this.particles.burst('puff', board.x, board.y + 40, 8, { color: 'rgba(255,255,255,0.8)', size: 22, speed: 140, max: 0.5 });
        this.host.progress();
      },
    );
  }

  /** a scan can not be answered while the big moment runs or the solution is shown */
  busy(): boolean {
    return !!this.visitor || !!this.reveal;
  }

  /**
   * judges the new digits of a scan; at: where a new animal or plant appears; asked: the task on the board when
   * the photo was taken (a scan of an earlier task is not judged against the next one). No new digits with a
   * half number waiting: the half number is the answer.
   */
  answer(fresh: ScannedGlyph[], stickers: Map<number, AnyCanvas>, at?: { x: number; y: number }, asked?: MathTask | null): Outcome {
    if (this.busy() || !this.task || (asked !== undefined && asked !== this.task)) {
      if (fresh.length || this.pending) this.say(t("Gleich geht's weiter!"), true);
      return 'busy';
    }
    const task = this.task;
    const waiting = this.pending;
    const r: Reading =
      !fresh.length && waiting?.length
        ? { kind: 'number', value: Number(waiting.map((g) => g.score.char).join('')), glyphs: waiting }
        : readAnswer(fresh, task.result, this.pending);
    if (r.kind === 'none') return 'none';
    if (r.kind === 'several') {
      this.pending = null;
      this.say(t('Schreib nur das Ergebnis!'), false);
      return 'several';
    }
    if (r.kind === 'unsure') {
      this.pending = null;
      this.say(t('Ich kann die Zahl nicht gut lesen. Schreib sie noch einmal deutlich!'), false);
      return 'unsure';
    }
    if (r.kind === 'partial') {
      this.pending = r.glyphs;
      this.say(t('Ist das schon die ganze Zahl? Dann drück noch einmal „Fertig!“'), true);
      return 'partial';
    }
    this.pending = null;
    this.written++;
    if (r.value !== task.result) {
      this.misses++;
      sfx.pfff();
      if (this.misses >= MAX_MISSES) {
        this.reveal = { task, t: 0 };
        this.picker.again(task);
        this.say(t('Die Lösung ist {r}.', { r: task.result }), true);
      } else this.say(t('Fast! Schau noch mal: {task}', { task: ltr(taskText(task)) }), false);
      return 'wrong';
    }
    // right
    const g = combineGlyphs(r.glyphs, numberId--);
    const sticker = canvasFromRGBA(g.crop);
    for (const d of r.glyphs) stickers.delete(d.id);
    const where = this.grow(g, sticker, at);
    this.lastTip = g.score.mirrored ? 'spiegel' : g.score.tip;
    this.feedback(g, where, `${t('Richtig!')} ${ltr(`${taskText(task)} = ${task.result}`)}`);
    this.pearls++;
    if (this.pearls >= SECTION) {
      this.task = null;
      this.visitor = { kind: this.section % 2 === 0 ? 'hai' : 'delfine', t: 0 };
      sfx.fanfare();
    } else this.nextTask();
    return 'right';
  }

  /** stars, tier and the writing tip over the new animal or plant */
  private feedback(g: ScannedGlyph, at: { x: number; y: number; r: number }, praise: string): void {
    sfx.hatch(g.score.score);
    this.particles.burst('puff', at.x, at.y, 10, { color: 'rgba(255,255,255,0.8)', size: 26, speed: 160, max: 0.6 });
    if (g.score.score >= 70) this.particles.burst('spark', at.x, at.y, 10, { color: '#fff6a8', size: 14, speed: 260, max: 0.9 });
    const n = starCount(g.score.score);
    this.particles.add({ kind: 'text', x: at.x, y: at.y - at.r - 30, vy: -40, max: 1.8, size: 34, color: '#ffd84a', text: '★'.repeat(n) + '☆'.repeat(5 - n) });
    this.particles.add({ kind: 'text', x: at.x, y: at.y - at.r - 70, vy: -40, max: 1.8, size: 30, color: '#ffffff', text: t('{tier}!', { tier: t(TIER_LABEL[g.score.tier]) }) });
    const tip = this.lastTip ?? 'super';
    this.particles.add({ kind: 'text', x: at.x, y: at.y - at.r - 110, vy: -30, max: 3, size: 28, color: tip === 'super' ? '#ffffff' : '#fff1c4', text: t(TIP_TEXT[tip]) });
    this.say(praise, true);
  }

  /** a message at the board */
  private say(text: string, good: boolean): void {
    this.note = { text, t: 0, good };
  }

  // ---------------------------------------------------------------- the sea

  /** a free place for the next animal (in the water) */
  private freeSpot(): { x: number; y: number } {
    const B = this.bounds;
    return { x: lerp(B.x0 + 80, B.x1 - 80, this.rand()), y: lerp(B.y0 + 260, B.y1 - 80, this.rand()) };
  }

  /** a right answer: a plant on the sand or a sea animal; returns where it is */
  private grow(g: ScannedGlyph, sticker: AnyCanvas, at?: { x: number; y: number }): { x: number; y: number; r: number } {
    const seed = hashBytes(g.crop.data, 13) ^ (this.written * 7919);
    if (this.rand() < this.plantShare) {
      const kind = PLANT_KINDS[Math.floor(this.rand() * PLANT_KINDS.length)];
      const x = this.plantSpot();
      this.plants.push({ kind, x, tier: g.score.tier, seed, born: this.t, glyph: g, sticker });
      const staying = this.plants.filter((p) => p.fade === undefined);
      if (staying.length > MAX_PLANTS) staying[0].fade = 0;
      return { x, y: sandLine(WORLD_H) - 100, r: 60 };
    }
    const pool = SEA_ANIMALS.filter((a) => !this.lastAnimals.includes(a));
    const kind = pool[Math.floor(this.rand() * pool.length)];
    this.lastAnimals = [...this.lastAnimals, kind].slice(-2);
    const c = this.addAnimal(kind, g, sticker, at ?? this.freeSpot());
    return { x: c.x, y: c.y, r: c.sprite.radius };
  }

  /** a place on the sand away from the other plants */
  private plantSpot(): number {
    const B = this.bounds;
    let best = lerp(B.x0, B.x1, this.rand());
    let bestD = -1;
    for (let i = 0; i < 12; i++) {
      const x = lerp(B.x0 + 40, B.x1 - 40, this.rand());
      const d = Math.min(Infinity, ...this.plants.filter((p) => p.fade === undefined).map((p) => Math.abs(p.x - x)));
      if (d > bestD) {
        bestD = d;
        best = x;
      }
    }
    return best;
  }

  private addAnimal(kind: SeaAnimal, g: ScannedGlyph, sticker: AnyCanvas, at: { x: number; y: number }): Creature {
    const genome = makeGenome(g.score.score, g.score.tier, hashBytes(g.crop.data, 13) ^ g.id, 'fish');
    const sprite = seaSprite(kind, genome, sticker);
    const y = ON_SAND.has(kind) ? sandLine(WORLD_H) - sprite.radius * 0.6 : at.y;
    const c = this.place({ glyph: g, sticker, genome, sprite }, at.x, y);
    this.kinds.set(c.id, kind);
    return c;
  }

  addCreature(g: ScannedGlyph, sticker: AnyCanvas): Creature {
    return this.addAnimal('clownfisch', g, sticker, this.freeSpot());
  }

  protected behave(c: Creature, dt: number): void {
    const m = c.sprite.motion;
    if (this.visitor?.kind === 'hai' && !(m && OWN_STEERING.has(m))) {
      // the little fish swarm around the shark
      const p = this.sharkAt();
      c.tx = clamp(p.x + Math.cos(c.phase + this.t) * 220, this.bounds.x0, this.bounds.x1);
      c.ty = clamp(p.y + Math.sin(c.phase + this.t) * 140, this.bounds.y0, this.bounds.y1);
      c.stateT = 0;
    }
    if (m && OWN_STEERING.has(m)) behavePainted(m, c, dt, this.bounds, sandLine(WORLD_H));
    else rechenmeer.behave(this, c, dt);
  }

  update(dt: number): void {
    super.update(dt);
    this.taskT += dt;
    if (this.note) {
      this.note.t += dt;
      if (this.note.t > 3.5) this.note = null;
    }
    for (const p of this.plants) if (p.fade !== undefined) p.fade += dt / FADE;
    this.plants = this.plants.filter((p) => (p.fade ?? 0) < 1);
    if (this.reveal) {
      this.reveal.t += dt;
      if (this.reveal.t > REVEAL) {
        this.reveal = null;
        this.nextTask();
      }
    }
    if (this.visitor) {
      this.visitor.t += dt;
      if (this.visitor.t > VISIT) {
        this.visitor = null;
        this.section++;
        this.pearls = 0;
        this.nextTask();
      }
    }
  }

  /** where the shark is during its visit: once across the picture */
  private sharkAt(): { x: number; y: number } {
    const k = this.visitor ? this.visitor.t / VISIT : 0;
    return { x: lerp(-400, this.W + 400, k), y: 520 + Math.sin(k * TAU) * 60 };
  }

  // ---------------------------------------------------------------- drawing

  protected renderCreatures(ctx: CanvasRenderingContext2D, list: Creature[]): void {
    const gy = sandLine(WORLD_H) + 10;
    for (const p of this.plants) drawPlant(ctx, p, gy, this.t, ease.outBack(clamp((this.t - p.born) / GROW)));
    super.renderCreatures(ctx, list);
    if (this.visitor) this.drawVisitor(ctx);
  }

  render(ctx: CanvasRenderingContext2D): void {
    super.render(ctx);
    this.drawBoard(ctx);
  }

  private drawVisitor(ctx: CanvasRenderingContext2D): void {
    const v = this.visitor!;
    if (v.kind === 'hai') {
      const p = this.sharkAt();
      drawShark(ctx, p.x, p.y, 1.1, this.t);
      return;
    }
    // dolphins: 4 jumps in a bow over the picture, one after the other
    for (let i = 0; i < 4; i++) {
      const k = (v.t - i * 0.7) / (VISIT - 3);
      if (k < 0 || k > 1) continue;
      const x = lerp(-250, this.W + 250, k);
      const y = 760 - Math.sin(k * Math.PI) * 560 + i * 30;
      const angle = -Math.cos(k * Math.PI) * 0.9;
      drawDolphin(ctx, x, y, 0.95, angle, this.t + i);
      if (Math.random() < 0.3) this.particles.add({ kind: 'spark', x: x - 120, y: y + 10, size: 10, max: 0.6, color: '#ffffff' });
    }
  }

  /** the task board at the top, the pearls, the counting help and the messages */
  private drawBoard(ctx: CanvasRenderingContext2D): void {
    // tasks read left to right in every language (the page is right to left in Arabic and Hebrew)
    ctx.save();
    ctx.direction = 'ltr';
    this.drawTask(ctx);
    ctx.restore();
    this.drawNote(ctx);
  }

  private drawTask(ctx: CanvasRenderingContext2D): void {
    const cx = this.W / 2;
    const w = 520;
    const h = 130;
    const y = 40;
    const task = this.reveal?.task ?? this.task;
    const pop = ease.outBack(clamp(this.taskT / 0.4));
    ctx.save();
    ctx.translate(cx, y + h / 2);
    ctx.scale(task ? pop : 1, task ? pop : 1);
    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = '#1f6fa8';
    ctx.lineWidth = 6;
    roundRect(ctx, -w / 2, -h / 2, w, h, 34);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 76px Fredoka, Druckvorlage, system-ui, sans-serif';
    if (task) {
      ctx.fillStyle = this.reveal ? '#1d8a3c' : '#1d2a44';
      ctx.fillText(`${taskText(task)} = ${this.reveal ? task.result : '?'}`, 0, 4);
    } else {
      ctx.font = '700 60px Fredoka, Druckvorlage, system-ui, sans-serif';
      ctx.fillStyle = '#1f6fa8';
      ctx.fillText(t('Super gerechnet!'), 0, 4);
    }
    ctx.restore();
    // pearls up to the big moment
    for (let i = 0; i < SECTION; i++) {
      const px = cx + (i - (SECTION - 1) / 2) * 40;
      const py = y + h + 30;
      const full = this.visitor ? true : i < this.pearls;
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, TAU);
      if (full) {
        const gr = ctx.createRadialGradient(px - 5, py - 5, 2, px, py, 14);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(1, '#f2d9ff');
        ctx.fillStyle = gr;
      } else ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // the counting help under the board, in the middle (the camera picture sits in the top right corner)
    if (task && (this.misses >= 2 || this.reveal)) drawHelp(ctx, task, cx - HELP_W / 2, y + h + 130);
  }

  /** the message under the board (in the page's own direction) */
  private drawNote(ctx: CanvasRenderingContext2D): void {
    const cx = this.W / 2;
    const y = 40;
    const h = 130;
    if (this.note) {
      const a = clamp(1 - (this.note.t - 2.8) / 0.7);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '600 34px Fredoka, Druckvorlage, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(this.note.text).width + 50;
      const ny = y + h + 80;
      ctx.fillStyle = this.note.good ? 'rgba(40,150,90,0.92)' : 'rgba(255,248,214,0.96)';
      roundRect(ctx, cx - tw / 2, ny - 28, tw, 56, 28);
      ctx.fill();
      ctx.fillStyle = this.note.good ? '#ffffff' : '#5a3d00';
      ctx.fillText(this.note.text, cx, ny + 2);
      ctx.restore();
    }
  }

  // ---------------------------------------------------------------- tap, count, save

  tap(x: number, y: number): boolean {
    if (super.tap(x, y)) return true;
    const gy = sandLine(WORLD_H) + 10;
    for (const p of this.plants) {
      if (p.fade !== undefined) continue;
      if (Math.abs(p.x - x) < 60 && y > gy - 220 && y < gy + 20) {
        sfx.boing();
        this.host.showCard({ glyph: p.glyph, sticker: p.sticker, name: t('Pflanze') });
        return true;
      }
    }
    return false;
  }

  count(): number {
    return this.creatures.filter((c) => !c.leaving).length + this.plants.filter((p) => p.fade === undefined).length;
  }

  countText(): string {
    const animals = this.creatures.filter((c) => !c.leaving).length;
    const plants = this.plants.filter((p) => p.fade === undefined).length;
    return `🐠 ${animals} · 🌿 ${plants} · ⭐ ${this.visitor ? SECTION : this.pearls}/${SECTION}`;
  }

  async saveState(): Promise<{ state: RechenSave; summary: string } | null> {
    const living = this.creatures.filter((c) => !c.leaving && c.glyph);
    const plants = this.plants.filter((p) => p.fade === undefined);
    if (!living.length && !plants.length && !this.pearls && !this.section) return null;
    const sea = await Promise.all(
      living.map(async (c) => ({ glyph: await saveGlyph(c.glyph!), x: Math.round(c.x), y: Math.round(c.y), facing: c.facing, kind: this.kinds.get(c.id) ?? 'clownfisch' })),
    );
    const savedPlants = await Promise.all(plants.map(async (p) => ({ kind: p.kind, x: Math.round(p.x), tier: p.tier, seed: p.seed, glyph: await saveGlyph(p.glyph) })));
    // a running visit is not kept: the game continues with the next section
    const visiting = !!this.visitor;
    const state: RechenSave = {
      creatures: [],
      away: this.album.length + this.awayBefore,
      practiceIndex: 0,
      practiceDone: 0,
      goalReached: false,
      written: this.written,
      wishesFreed: 0,
      sea,
      picker: this.picker.export(),
      task: visiting ? null : (this.reveal ? null : this.task),
      misses: this.reveal ? 0 : this.misses,
      pearls: visiting ? 0 : this.pearls,
      section: visiting ? this.section + 1 : this.section,
      plants: savedPlants,
    };
    return { state, summary: this.countText() };
  }

  async restoreState(raw: unknown): Promise<void> {
    const s = raw as RechenSave;
    this.creatures = [];
    this.plants = [];
    this.kinds.clear();
    const animals = await Promise.all((s.sea ?? []).map((c) => loadGlyph(c.glyph)));
    (s.sea ?? []).forEach((sc, i) => {
      const kind = SEA_ANIMALS.includes(sc.kind) ? sc.kind : 'clownfisch';
      const c = this.addAnimal(kind, animals[i].glyph, animals[i].sticker, { x: sc.x, y: sc.y });
      this.settle(c, sc);
      if (ON_SAND.has(kind)) c.y = sandLine(WORLD_H) - c.sprite.radius * 0.6;
    });
    const plants = await Promise.all((s.plants ?? []).map((p) => loadGlyph(p.glyph)));
    this.plants = (s.plants ?? []).map((p, i) => ({ kind: p.kind, x: p.x, tier: p.tier, seed: p.seed, born: -GROW, glyph: plants[i].glyph, sticker: plants[i].sticker }));
    this.awayBefore = s.away ?? 0;
    this.written = s.written ?? 0;
    this.picker = TaskPicker.from(s.picker, mulberry32(Date.now() ^ 0x77), this.taskKinds());
    this.section = s.section ?? 0;
    this.pearls = s.pearls ?? 0;
    this.visitor = null;
    this.reveal = null;
    this.pending = null;
    if (s.task && this.taskKinds().includes(s.task.kind)) {
      this.task = s.task;
      this.misses = s.misses ?? 0;
      this.taskT = 0;
    } else this.nextTask();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * The counting help next to the board: a twenty frame with counters for plus and minus up to 20, tens bars and
 * ones for the tasks up to 100, a field of dots for times and divided.
 */
function drawHelp(ctx: CanvasRenderingContext2D, task: MathTask, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeStyle = '#1f6fa8';
  ctx.lineWidth = 4;
  const W = HELP_W;
  const H = HELP_H;
  roundRect(ctx, x, y, W, H, 22);
  ctx.fill();
  ctx.stroke();
  const RED = '#e84a4a';
  const BLUE = '#2f7fe0';
  const dot = (px: number, py: number, r: number, color: string, crossed = false) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();
    if (crossed) {
      ctx.strokeStyle = '#1d2a44';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px - r, py - r);
      ctx.lineTo(px + r, py + r);
      ctx.stroke();
    }
  };
  if (task.kind === 'plus20' || task.kind === 'minus20') {
    // the twenty frame: two rows of ten, a gap after five
    const total = task.op === '+' ? task.a + task.b : task.a;
    for (let i = 0; i < 20; i++) {
      const col = i % 10;
      const row = Math.floor(i / 10);
      const px = x + 34 + col * 31 + (col >= 5 ? 12 : 0);
      const py = y + 70 + row * 60;
      ctx.strokeStyle = 'rgba(31,111,168,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 14, py - 26, 28, 52);
      if (i >= total) continue;
      if (task.op === '+') dot(px, py, 11, i < task.a ? RED : BLUE);
      else dot(px, py, 11, RED, i >= task.a - task.b);
    }
  } else if (task.kind === 'pm100') {
    // tens bars and ones: the first number red, the second blue (crossed out when it is taken away)
    let px = x + 22;
    const part = (n: number, color: string, crossed: boolean) => {
      for (let i = 0; i < Math.floor(n / 10); i++) {
        ctx.fillStyle = color;
        ctx.fillRect(px, y + 30, 12, 140);
        if (crossed) {
          ctx.strokeStyle = '#1d2a44';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px - 3, y + 40);
          ctx.lineTo(px + 15, y + 160);
          ctx.stroke();
        }
        px += 17;
      }
      for (let i = 0; i < n % 10; i++) dot(px + 8 + (i % 2) * 18, y + 45 + Math.floor(i / 2) * 26, 8, color, crossed);
      if (n % 10) px += 44;
      px += 10;
    };
    part(task.a, RED, false);
    part(task.b, BLUE, task.op === '−');
  } else {
    // a field of dots: rows times columns (divided: the result is the number of rows)
    const rows = task.op === '·' ? task.a : task.result;
    const cols = task.b;
    const r = Math.max(3, Math.min(8, 150 / Math.max(rows, cols, 1) / 2.4));
    const step = r * 2.4;
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) dot(x + 30 + j * step + r, y + 22 + i * step + r, r, i % 2 ? BLUE : RED);
    if (rows === 0 || cols === 0) {
      ctx.fillStyle = '#1d2a44';
      ctx.font = '600 30px Fredoka, system-ui, sans-serif';
      ctx.fillText('0', x + W / 2, y + H / 2);
    }
  }
  ctx.restore();
}


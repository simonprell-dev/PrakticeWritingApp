// Klasse gegen Riesenburg: the whole class against the giant's castle, with an intro, a sequence for
// every fallen wall and a big finale. Builds on the duel (lanes, stars, bubble piles, machines).
import { sfx } from '../game/audio.ts';
import type { AnyCanvas } from '../game/canvas.ts';
import { drawGiant, type GiantMood } from '../game/creatures/giant.ts';
import { inkGuardSprite } from '../game/creatures/inkGuard.ts';
import type { Sprite } from '../game/creatures/sprite.ts';
import { SIEGE } from '../game/duel/balance.ts';
import type { DuelEvent, Fighter, SiegeStage, TeamStats } from '../game/duel/duelSim.ts';
import { clamp, ease, hsl, lerp, TAU } from '../game/math.ts';
import { WORLD_H } from '../game/stage.ts';
import type { ScanResult, TeamId } from '../vision/types.ts';
import { DuelScene } from './duelScene.ts';
import type { SceneHost, Snapshot } from './scene.ts';

export interface SiegeResult {
  won: boolean;
  className: string;
  color: string;
  walls: number;
  wallsTotal: number;
  stats: TeamStats;
  stars: number;
  best?: { sticker: AnyCanvas; score: number; char: string };
  bravest?: { sticker: AnyCanvas; hits: number; char: string };
  seconds: number;
}

export const CLASS_COLOR = '#ff8a3d';
const GIANT_COLOR = '#8f6ee0';
const GIANT_HUE = 262;

type SeqName = 'intro' | 'wall' | 'victory' | 'timeup';

interface Seq {
  name: SeqName;
  t: number;
  dur: number;
  wall: number;
  fired: Set<number>;
}

interface Cam {
  x: number;
  y: number;
  z: number;
}

export class SiegeScene extends DuelScene {
  readonly walls: SiegeStage[];
  readonly className: string;
  readonly timeLimitSec: number;
  seq: Seq | null = null;
  cam: Cam = { x: 960, y: 540, z: 1 };
  shake = 0;
  mood: GiantMood = 'idle';
  moodUntil = 0;
  giantPop = 0;
  flag = 0;
  rise = 0;
  /** 0..1: the giant drops to the ground when his castle is gone */
  giantFall = 0;
  speech: { text: string; t: number; dur: number } | null = null;
  banner: { title: string; sub: string; t: number; dur: number } | null = null;
  countdown = -1;
  burst: { wall: number; t: number } | null = null;
  guardT = 6;
  guardCount = 0;
  stars = 0;
  wallsDown = 0;
  private finishedSent = false;

  constructor(host: SceneHost, worldW: number) {
    const st = host.settings.siege;
    super(host, worldW, {
      names: { A: st.className || 'Unsere Klasse', B: 'Riesenburg' },
      colors: { A: CLASS_COLOR, B: GIANT_COLOR },
      castle: 'mittel',
      timeLimit: 0,
    });
    this.autoFinish = false;
    this.className = st.className || 'Unsere Klasse';
    this.timeLimitSec = st.timeLimit * 60;
    this.walls = SIEGE.walls[st.size].map((w) => ({ ...w }));
    this.sim.configureSiege(this.walls);
    this.resetPile('A');
    this.resetPile('B');
    this.cam = this.home();
    this.startSeq('intro', 7.2);
  }

  // ---------------------------------------------------------------- camera

  private home(): Cam {
    return { x: this.W / 2, y: WORLD_H / 2, z: 1 };
  }

  /** zoomed view of the castle, high enough to show the giant on the keep */
  private castleView(z: number, y = 520): Cam {
    return this.clampCam({ x: this.sim.castles.B.x - 40, y, z });
  }

  private clampCam(c: Cam): Cam {
    const hw = this.W / 2 / c.z;
    const hh = WORLD_H / 2 / c.z;
    return { x: clamp(c.x, hw, this.W - hw), y: clamp(c.y, hh, WORLD_H - hh), z: c.z };
  }

  private camLerp(a: Cam, b: Cam, u: number): Cam {
    const e = ease.inOutCubic(clamp(u));
    return { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e), z: lerp(a.z, b.z, e) };
  }

  // ---------------------------------------------------------------- sequences

  get cinematic(): boolean {
    return !!this.seq;
  }

  private startSeq(name: SeqName, dur: number, wall = 0): void {
    this.seq = { name, t: 0, dur, wall, fired: new Set() };
    this.paused = true;
  }

  /** runs fn once when the sequence time passes `at` */
  private at(i: number, at: number, fn: () => void): void {
    const s = this.seq!;
    if (s.t >= at && !s.fired.has(i)) {
      s.fired.add(i);
      fn();
    }
  }

  private say(text: string, dur = 2.4): void {
    this.speech = { text, t: 0, dur };
  }

  private setMood(m: GiantMood, seconds = 0): void {
    this.mood = m;
    this.moodUntil = seconds ? this.t + seconds : 0;
  }

  private confetti(n = 60): void {
    const colors = [CLASS_COLOR, '#ffd84a', '#ff6f91', '#4fb3ff', '#7ccf6b', '#ffffff'];
    for (let i = 0; i < n; i++) {
      this.particles.add({
        kind: 'confetti',
        x: Math.random() * this.W,
        y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 120,
        vy: 120 + Math.random() * 160,
        size: 14 + Math.random() * 10,
        max: 4 + Math.random() * 2,
        color: colors[i % colors.length],
        rot: Math.random() * TAU,
        vr: (Math.random() - 0.5) * 10,
        gravity: 30,
      });
    }
  }

  private runSeq(dt: number): void {
    const s = this.seq!;
    s.t += dt;
    const t = s.t;
    const n = this.walls.length;
    const home = this.home();
    if (s.name === 'intro') {
      this.rise = ease.outBack(clamp(t / 1.4));
      this.giantPop = clamp((t - 1.5) / 0.5);
      this.cam = t < 2.9 ? this.castleView(1.35, 430) : this.camLerp(this.castleView(1.35, 430), home, (t - 2.9) / 1.2);
      if (t < 1.4 && Math.random() < 0.7) this.dust();
      this.at(0, 0, () => {
        sfx.rumble();
        this.shake = 0.8;
      });
      this.at(1, 1.6, () => {
        this.setMood('laugh', 2);
        sfx.laugh();
        this.say('Hohoho! An meiner Riesenburg kommt keiner vorbei!', 2.4);
      });
      this.at(2, 3.3, () => {
        this.banner = { title: 'Klasse gegen Riesenburg', sub: `${this.className}: Schreibt schöne Buchstaben – jeder Stern ist ein Schlag!`, t: 0, dur: 2.1 };
      });
      this.at(3, 5.0, () => {
        this.countdown = 0;
        sfx.tick();
      });
      this.at(4, 5.55, () => sfx.tick());
      this.at(5, 6.1, () => sfx.tick());
      this.at(6, 6.65, () => sfx.go());
    } else if (s.name === 'wall') {
      const k = s.wall;
      this.cam = t < 4.3 ? this.camLerp(home, this.castleView(1.3), t / 0.7) : this.camLerp(this.castleView(1.3), home, (t - 4.3) / 1.0);
      this.at(0, 0, () => {
        this.setMood('shock', 1.8);
        this.shake = 0.6;
      });
      this.at(1, 0.5, () => {
        this.burst = { wall: k, t: 0 };
        sfx.cascade();
        this.shake = 1;
      });
      this.at(2, 1.7, () => {
        const left = n - k - 1;
        this.banner = {
          title: `Mauer ${k + 1} geschafft!`,
          sub: left === 1 ? 'Noch eine Mauer bis zum Riesen!' : `Noch ${left} Mauern bis zum Riesen!`,
          t: 0,
          dur: 2.2,
        };
        sfx.fanfare();
        this.confetti(50);
      });
      this.at(3, 2.3, () => {
        this.setMood('angry', 2.2);
        sfx.grumble();
        this.say(k === n - 2 ? 'Grrr! Jetzt kommt meine allerletzte Mauer!' : `Grrr! Das war erst Mauer ${k + 1}!`, 2.2);
      });
      this.at(4, 3.5, () => {
        this.sim.nextStage();
        this.resetPile('B', 500);
        this.burst = null;
        sfx.rumble();
        this.shake = 0.5;
      });
    } else if (s.name === 'victory') {
      this.cam = t < 4.5 ? this.camLerp(home, this.castleView(1.25, 590), t / 0.8) : this.camLerp(this.castleView(1.25, 590), home, (t - 4.5) / 1.4);
      this.flag = clamp((t - 2.4) / 0.8);
      this.giantFall = clamp((t - 1.4) / 0.9);
      this.at(7, 2.1, () => {
        this.shake = 0.9;
        sfx.bonk();
        this.particles.burst('puff', this.tier(this.walls.length - 1).cx, 1000, 16, { color: 'rgba(200,180,230,0.7)', size: 36, speed: 220, max: 0.9 });
      });
      this.at(0, 0, () => {
        this.setMood('shock');
        this.shake = 1;
      });
      this.at(1, 0.4, () => {
        this.burst = { wall: n - 1, t: 0 };
        sfx.cascade();
      });
      this.at(2, 2.4, () => {
        this.setMood('defeat');
        this.say('Ihr habt gewonnen! So schöne Buchstaben habe ich noch nie gesehen!', 3.8);
      });
      this.at(3, 3.0, () => this.confetti(90));
      this.at(4, 3.4, () => {
        this.banner = { title: 'Die Riesenburg ist erobert!', sub: `${this.className} hat gewonnen!`, t: 0, dur: 4.2 };
      });
      this.at(5, 4.4, () => this.confetti(70));
      this.at(6, 5.6, () => this.confetti(70));
    } else if (s.name === 'timeup') {
      this.at(0, 0, () => {
        this.setMood('laugh', 2.5);
        sfx.laugh();
        this.say('Puh! Die Zeit ist um – meine Burg steht noch!', 2.6);
      });
      this.at(1, 1.6, () => {
        const w = this.wallsDown;
        this.banner = {
          title: 'Die Zeit ist um!',
          sub: w ? `Ihr habt ${w} von ${n} Mauern geschafft – super gekämpft!` : 'Beim nächsten Mal schafft ihr die erste Mauer!',
          t: 0,
          dur: 4,
        };
        this.confetti(40);
      });
    }
    if (s.t >= s.dur) {
      const name = s.name;
      this.seq = null;
      if (name === 'intro' || name === 'wall') {
        this.paused = false;
        this.cam = home;
      } else if (!this.finishedSent) {
        this.finishedSent = true;
        this.host.finished?.(this.siegeResult());
      }
    }
  }

  private dust(): void {
    const x = this.sim.castles.B.x + (Math.random() - 0.3) * 520;
    this.particles.add({ kind: 'puff', x, y: 1030, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 60, size: 34, max: 1.2, color: 'rgba(170,150,120,0.6)' });
  }

  // ---------------------------------------------------------------- game flow

  handleScan(res: ScanResult, snap: Snapshot): void {
    // the whole class is one team
    for (const g of res.glyphs) g.team = 'A';
    super.handleScan(res, snap);
  }

  protected onSpawn(f: Fighter | null): void {
    if (f && f.team === 'A') this.stars += f.strength;
  }

  protected onEvent(e: DuelEvent): void {
    if (e.type === 'stageClear') {
      this.wallsDown = e.stage + 1;
      this.startSeq('wall', 5.6, e.stage);
    } else if (e.type === 'castlePop' && e.team === 'B') {
      this.wallsDown = this.walls.length;
      this.startSeq('victory', 8);
    } else if (e.type === 'bubblePop' && e.team === 'B' && !this.seq && this.mood === 'idle') {
      this.setMood('shock', 0.5);
    } else if (e.type === 'pop' && e.fighter.team === 'B' && !this.seq && Math.random() < 0.4) {
      this.setMood('angry', 1);
      if (Math.random() < 0.4) sfx.grumble();
    }
  }

  private spawnGuards(dt: number): void {
    if (this.sim.stageCleared) return;
    const cfg = SIEGE.guards[Math.min(this.sim.stage, SIEGE.guards.length - 1)];
    this.guardT -= dt;
    if (this.guardT > 0) return;
    this.guardT = cfg.every * (0.8 + Math.random() * 0.4);
    const guards = this.sim.fighters.filter((f) => f.team === 'B');
    if (guards.length >= cfg.field) return;
    const counts = [0, 0, 0, 0, 0];
    for (const g of guards) counts[g.lane]++;
    // prefer lanes where the class is coming
    for (const f of this.sim.fighters) if (f.team === 'A') counts[f.lane] -= 0.5;
    let lane = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] < counts[lane] || (counts[i] === counts[lane] && Math.random() < 0.5)) lane = i;
    const stars = cfg.min + Math.floor(Math.random() * (cfg.max - cfg.min + 1));
    const holdX = this.W * SIEGE.holdAt + Math.random() * 70;
    const f = this.sim.spawn('B', SIEGE.scoreFor[stars], -1, { guard: true, holdX, lane });
    if (!f) return;
    this.guardCount++;
    this.particles.burst('puff', f.x, 640, 8, { color: 'rgba(60,40,120,0.45)', size: 22, speed: 120, max: 0.6 });
    if (this.guardCount % 3 === 1) {
      this.setMood('laugh', 1.2);
      this.say(['Wächter, los!', 'Haltet sie auf!', 'Tintenkleckse, an die Arbeit!'][Math.floor(Math.random() * 3)], 1.6);
    }
  }

  update(dt: number): void {
    if (this.seq) this.runSeq(dt);
    else if (!this.sim.over) {
      this.spawnGuards(dt);
      if (this.timeLimitSec > 0 && this.sim.time >= this.timeLimitSec) {
        this.sim.over = 'B';
        this.startSeq('timeup', 6);
      }
    }
    if (this.moodUntil && this.t > this.moodUntil) {
      this.mood = this.sim.over === 'A' ? 'defeat' : 'idle';
      this.moodUntil = 0;
    }
    if (this.speech) {
      this.speech.t += dt;
      if (this.speech.t > this.speech.dur) this.speech = null;
    }
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    if (this.countdown >= 0) {
      this.countdown += dt;
      if (this.countdown > 2.3) this.countdown = -1;
    }
    if (this.burst) {
      this.burst.t += dt;
      if (this.burst.t < 1.3) {
        const g = this.tier(this.burst.wall);
        for (let i = 0; i < 3; i++) {
          const x = g.cx + (Math.random() - 0.5) * g.w;
          const y = g.top + Math.random() * (1000 - g.top);
          this.particles.add({ kind: 'ring', x, y, size: 24 + Math.random() * 30, max: 0.35, color: hsl(GIANT_HUE + Math.random() * 120, 0.8, 0.85, 0.95) });
          if (Math.random() < 0.5) this.particles.burst('drop', x, y, 3, { color: 'rgba(220,210,255,0.9)', size: 5, speed: 200, gravity: 600, max: 0.5 });
        }
      }
    }
    this.shake = Math.max(0, this.shake - dt * 1.4);
    super.update(dt);
  }

  private siegeResult(): SiegeResult {
    const r = this.result();
    const a = r.teams[0];
    return {
      won: this.sim.over === 'A',
      className: this.className,
      color: CLASS_COLOR,
      walls: this.wallsDown,
      wallsTotal: this.walls.length,
      stats: a.stats,
      stars: this.stars,
      best: a.best,
      bravest: a.bravest,
      seconds: this.sim.time,
    };
  }

  // ---------------------------------------------------------------- drawing

  protected makeSprite(f: Fighter): Sprite {
    return f.guard ? inkGuardSprite(f.radius, f.id) : super.makeSprite(f);
  }

  protected machineX(team: TeamId): number {
    return team === 'B' ? this.W - 80 : super.machineX(team);
  }

  protected drawMachine(ctx: CanvasRenderingContext2D, team: TeamId): void {
    if (team === 'A') return;
    ctx.save();
    ctx.translate(0, (1 - this.rise) * 700);
    super.drawMachine(ctx, team);
    ctx.restore();
  }

  /** geometry of wall i (0 = front, last = the keep with the giant) */
  private tier(i: number) {
    const n = this.walls.length;
    const step = n > 3 ? 120 : 150;
    const cx = this.sim.castles.B.x + 30 + i * 46;
    const w = 300 + i * 70;
    const h = 400 + i * step;
    return { cx, w, h, top: 1000 - h };
  }

  private drawTier(ctx: CanvasRenderingContext2D, i: number, alpha = 1): void {
    const g = this.tier(i);
    const x0 = g.cx - g.w / 2;
    const light = 0.66 - i * 0.05;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = hsl(GIANT_HUE, 0.45, 0.28);
    ctx.lineWidth = 5;
    // side towers with cone roofs
    for (const sx of [0, 1]) {
      const tx = sx ? x0 + g.w - 34 : x0 + 34;
      ctx.fillStyle = hsl(GIANT_HUE, 0.35, light - 0.05);
      ctx.beginPath();
      ctx.roundRect(tx - 40, g.top - 70, 80, g.h + 70, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hsl(GIANT_HUE + 30, 0.55, 0.55);
      ctx.beginPath();
      ctx.moveTo(tx - 52, g.top - 64);
      ctx.lineTo(tx, g.top - 150);
      ctx.lineTo(tx + 52, g.top - 64);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // wall body
    const grad = ctx.createLinearGradient(0, g.top, 0, 1000);
    grad.addColorStop(0, hsl(GIANT_HUE, 0.38, light + 0.06));
    grad.addColorStop(1, hsl(GIANT_HUE, 0.38, light - 0.08));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x0 + 20, g.top, g.w - 40, g.h + 10, 14);
    ctx.fill();
    ctx.stroke();
    // bubble battlements
    const merl = Math.floor((g.w - 60) / 46);
    for (let m = 0; m < merl; m++) {
      const mx = x0 + 40 + m * 46 + 12;
      ctx.fillStyle = hsl(GIANT_HUE + m * 18, 0.6, 0.8, 0.9);
      ctx.beginPath();
      ctx.arc(mx, g.top - 4, 18, Math.PI, TAU);
      ctx.fill();
      ctx.stroke();
    }
    // windows
    ctx.fillStyle = hsl(GIANT_HUE, 0.5, 0.2, 0.85);
    for (let wy = g.top + 60; wy < 1000 - 120; wy += 130) {
      for (const wx of [g.cx - g.w * 0.18, g.cx + g.w * 0.18]) {
        ctx.beginPath();
        ctx.moveTo(wx - 16, wy + 40);
        ctx.lineTo(wx - 16, wy + 10);
        ctx.arc(wx, wy + 10, 16, Math.PI, TAU);
        ctx.lineTo(wx + 16, wy + 40);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  protected drawCastle(ctx: CanvasRenderingContext2D, team: TeamId): void {
    if (team === 'A') {
      this.drawCamp(ctx);
      return;
    }
    const n = this.walls.length;
    const shake = Math.sin(this.t * 40) * 5 * this.castleShake.B;
    ctx.save();
    ctx.translate(shake, (1 - this.rise) * 700);
    for (let i = n - 1; i >= 0; i--) {
      const standing = i >= this.sim.stage && !(this.sim.over === 'A' && i === n - 1 && this.burst);
      const bursting = this.burst && this.burst.wall === i;
      if (standing && !bursting) this.drawTier(ctx, i);
      else if (bursting) this.drawTier(ctx, i, clamp(1 - this.burst!.t / 1.2));
      if (i === n - 1) {
        const keep = this.tier(n - 1);
        const s = (n > 3 ? 0.5 : 0.56) * ease.outBack(this.giantPop);
        const gy = lerp(keep.top + 20, 975, ease.outBounce(this.giantFall));
        if (s > 0.01) drawGiant(ctx, keep.cx, gy, s, this.mood, this.t, this.flag);
      }
    }
    ctx.restore();
    ctx.save();
    ctx.translate(0, (1 - this.rise) * 700);
    this.drawPile(ctx, 'B', shake);
    ctx.restore();
  }

  /** the class camp on the left: a striped tent with the class name */
  private drawCamp(ctx: CanvasRenderingContext2D): void {
    const x = this.sim.castles.A.x - 120;
    const base = 1000;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#7a3d12';
    ctx.fillStyle = CLASS_COLOR;
    ctx.beginPath();
    ctx.moveTo(x - 130, base);
    ctx.lineTo(x, base - 260);
    ctx.lineTo(x + 130, base);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = '#ffd3b0';
    for (let i = -3; i <= 3; i += 2) {
      ctx.beginPath();
      ctx.moveTo(x, base - 260);
      ctx.lineTo(x + i * 40, base);
      ctx.lineTo(x + (i + 1) * 40, base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#5a2a0c';
    ctx.beginPath();
    ctx.moveTo(x - 34, base);
    ctx.lineTo(x, base - 90);
    ctx.lineTo(x + 34, base);
    ctx.fill();
    // flag pole with the class name
    ctx.strokeStyle = '#6b4e3a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x, base - 255);
    ctx.lineTo(x, base - 420);
    ctx.stroke();
    const wave = Math.sin(this.t * 4) * 6;
    ctx.fillStyle = CLASS_COLOR;
    ctx.strokeStyle = '#7a3d12';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, base - 420);
    ctx.quadraticCurveTo(x + 90, base - 420 + wave, x + 200, base - 405);
    ctx.lineTo(x + 200, base - 345);
    ctx.quadraticCurveTo(x + 90, base - 360 - wave, x, base - 350);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '700 26px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.className, x + 100, base - 372, 180);
    ctx.restore();
  }

  protected renderWorld(ctx: CanvasRenderingContext2D): void {
    const z = this.cam.z;
    const sx = (Math.random() - 0.5) * this.shake * 22;
    const sy = (Math.random() - 0.5) * this.shake * 22;
    ctx.save();
    ctx.translate(this.W / 2 + sx, WORLD_H / 2 + sy);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);
    super.renderWorld(ctx);
    this.drawSpeech(ctx);
    ctx.restore();
  }

  protected renderOverlay(ctx: CanvasRenderingContext2D): void {
    super.renderOverlay(ctx);
    this.drawBanner(ctx);
    this.drawCountdown(ctx);
  }

  private drawSpeech(ctx: CanvasRenderingContext2D): void {
    const sp = this.speech;
    if (!sp || this.giantPop <= 0) return;
    const a = clamp(sp.t / 0.2) * clamp((sp.dur - sp.t) / 0.3);
    const keep = this.tier(this.walls.length - 1);
    const hx = keep.cx;
    const hy = lerp(keep.top + 20, 975, ease.outBounce(this.giantFall)) + (1 - this.rise) * 700 - 170;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '700 32px Fredoka, system-ui, sans-serif';
    const w = Math.min(560, ctx.measureText(sp.text).width + 50);
    const h = 70;
    const x = clamp(hx - w - 90, 20, this.W - w - 20);
    const y = hy - h / 2;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = hsl(GIANT_HUE, 0.5, 0.35);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 30);
    ctx.moveTo(x + w - 10, y + h / 2 - 12);
    ctx.lineTo(x + w + 34, y + h / 2 + 8);
    ctx.lineTo(x + w - 10, y + h / 2 + 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = hsl(GIANT_HUE, 0.5, 0.28);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sp.text, x + w / 2, y + h / 2 + 1, w - 30);
    ctx.restore();
  }

  private drawBanner(ctx: CanvasRenderingContext2D): void {
    const b = this.banner;
    if (!b) return;
    const pop = ease.outBack(clamp(b.t / 0.35));
    const fade = clamp((b.dur - b.t) / 0.35);
    const w = Math.min(1150, this.W - 160);
    const h = 210;
    const x = this.W / 2;
    const y = 400;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, y);
    ctx.scale(pop, pop);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.strokeStyle = '#3b2a5c';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 40);
    ctx.fill();
    ctx.stroke();
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#ffd84a';
      ctx.strokeStyle = '#9a5b00';
      ctx.lineWidth = 4;
      ctx.beginPath();
      const cx = sx * (w / 2 - 70);
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5 + this.t;
        const rr = i % 2 ? 18 : 40;
        ctx.lineTo(cx + Math.cos(a) * rr, Math.sin(a) * rr - 20);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c5cff';
    ctx.font = '700 70px Fredoka, system-ui, sans-serif';
    ctx.fillText(b.title, 0, -12, w - 240);
    ctx.fillStyle = '#3b2a5c';
    ctx.font = '600 32px Fredoka, system-ui, sans-serif';
    ctx.fillText(b.sub, 0, 55, w - 80);
    ctx.restore();
  }

  private drawCountdown(ctx: CanvasRenderingContext2D): void {
    if (this.countdown < 0) return;
    const step = Math.min(3, Math.floor(this.countdown / 0.55));
    const local = this.countdown - step * 0.55;
    const text = ['3', '2', '1', 'Los!'][step];
    const s = ease.outBack(clamp(local / 0.25)) * (step === 3 ? 1.1 : 1);
    ctx.save();
    ctx.globalAlpha = step === 3 ? clamp((2.3 - this.countdown) / 0.5) : 1;
    ctx.translate(this.W / 2, 560);
    ctx.scale(s, s);
    ctx.font = `700 ${step === 3 ? 200 : 260}px Fredoka, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#3b2a5c';
    ctx.lineJoin = 'round';
    ctx.strokeText(text, 0, 0);
    ctx.fillStyle = step === 3 ? '#ffd84a' : '#ffffff';
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  protected drawHud(ctx: CanvasRenderingContext2D): void {
    if (this.seq) return;
    const gap = 60;
    const barW = Math.max(260, Math.min(520, (this.W - 760 - gap) / 2));
    const n = this.walls.length;
    // class
    let x = this.W / 2 - gap / 2 - barW;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, 24, barW, 92, 24);
    ctx.fill();
    ctx.fillStyle = CLASS_COLOR;
    ctx.font = '700 34px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(this.className, x + 22, 64, barW - 44);
    ctx.fillStyle = '#4a3b6b';
    ctx.font = '600 24px Fredoka, system-ui, sans-serif';
    ctx.fillText(`${this.sim.stats.A.written} Zeichen · ${this.stars} Sterne`, x + 22, 100);
    // giant castle
    x = this.W / 2 + gap / 2;
    const c = this.sim.castles.B;
    const left = this.sim.remaining('B');
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, 24, barW, 92, 24);
    ctx.fill();
    ctx.fillStyle = hsl(GIANT_HUE, 0.5, 0.45);
    ctx.font = '700 32px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`Mauer ${Math.min(n, this.sim.stage + 1)} von ${n}`, x + barW - 22, 64);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4a3b6b';
    ctx.font = '600 24px Fredoka, system-ui, sans-serif';
    ctx.fillText(`${left} ${left === 1 ? 'Blase' : 'Blasen'}`, x + 22, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.roundRect(x + 20, 80, barW - 40, 20, 10);
    ctx.fill();
    ctx.fillStyle = hsl(GIANT_HUE, 0.55, 0.6);
    const w = ((barW - 40) * left) / Math.max(1, c.startTotal);
    ctx.beginPath();
    ctx.roundRect(x + barW - 20 - Math.max(4, w), 80, Math.max(4, w), 20, 10);
    ctx.fill();
    ctx.restore();
    if (this.timeLimitSec > 0) {
      const leftT = Math.max(0, this.timeLimitSec - this.sim.time);
      const text = `${Math.floor(leftT / 60)}:${String(Math.floor(leftT % 60)).padStart(2, '0')}`;
      ctx.save();
      ctx.font = '700 44px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = leftT < 30 ? '#ff5470' : '#ffffff';
      ctx.strokeStyle = 'rgba(40,20,60,0.6)';
      ctx.lineWidth = 6;
      ctx.strokeText(text, this.W / 2, 170);
      ctx.fillText(text, this.W / 2, 170);
      ctx.restore();
    }
  }

  protected paint(ctx: CanvasRenderingContext2D): void {
    super.paint(ctx);
    // warm evening sky with the giant's hills
    const W = this.W;
    const sky = ctx.createLinearGradient(0, 0, 0, 430);
    sky.addColorStop(0, '#8fb8ff');
    sky.addColorStop(0.7, '#ffd1e8');
    sky.addColorStop(1, '#ffe7c4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 422);
    ctx.fillStyle = 'rgba(150,120,200,0.45)';
    ctx.beginPath();
    ctx.moveTo(W * 0.45, 422);
    for (let x = W * 0.45; x <= W; x += 40) ctx.lineTo(x, 422 - 90 - Math.sin(x * 0.006) * 50 - ((x - W * 0.45) / W) * 120);
    ctx.lineTo(W, 422);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [cx, cy] of [
      [W * 0.12, 120],
      [W * 0.32, 200],
    ]) {
      for (const [ox, oy, r] of [
        [0, 0, 40],
        [40, -16, 50],
        [85, 0, 38],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r, 0, TAU);
        ctx.fill();
      }
    }
  }
}

// "Türme bauen": every letter becomes a building block for the tower of its colour. Alien Zork carries
// the blocks from the portal with his tractor beam and clones himself when there is too much to do.
// Sometimes something funny happens on the way, and idle aliens get up to mischief.
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import { crown } from '../game/creatures/parts.ts';
import {
  drawBeam,
  drawBird,
  drawButterfly,
  drawCloud,
  drawDizzy,
  drawFlames,
  drawGumBubble,
  drawJuggle,
  drawPortal,
  drawShootingStar,
  drawTape,
  drawUfo,
} from '../game/creatures/ufo.ts';
import { clamp, ease, hsl, lerp, TAU } from '../game/math.ts';
import { Particles } from '../game/particles.ts';
import { mulberry32 } from '../game/rng.ts';
import { SpawnFx } from '../game/spawnFx.ts';
import { WORLD_H } from '../game/stage.ts';
import { mischiefPose, type FxName, type GagCue, type GagKit, type GagPose } from '../game/tower/gags.ts';
import { TOWER, towerSpacing } from '../game/tower/rules.ts';
import { blockWidth, drawBlock, drawGoalLine, drawPlinth } from '../game/tower/towerArt.ts';
import { drawSkyThings, paintSky } from '../game/tower/towerSky.ts';
import { TowerSim, type Alien, type TowerBlock, type TowerEvent, type TowerSave } from '../game/tower/towerSim.ts';
import { starsOf } from '../recog/score.ts';
import { PLAYER_IDS, type ScanResult, type ScannedGlyph } from '../vision/types.ts';
import { COUNTDOWN_SECONDS, drawBanner, drawCountdown, type Banner } from './cinema.ts';
import { hexHue, teamColor } from './duelScene.ts';
import { loadGlyph, restoredId, saveGlyph, type SavedGlyph, type SceneSave } from './saved.ts';
import type { Scene, SceneHost, Snapshot } from './scene.ts';

export interface TowerPlayerResult {
  name: string;
  color: string;
  metres: number;
  written: number;
  blocks: number;
  avgStars: number;
  best?: { sticker: AnyCanvas; score: number; char: string };
}

export interface TowerResult {
  /** index of the winning tower, null = draw */
  winner: number | null;
  reason: 'goal' | 'time';
  goal: number;
  players: TowerPlayerResult[];
  seconds: number;
  clones: number;
  gags: number;
}

/** "Türme bauen" in a saved game */
export interface TowerSceneSave {
  sim: TowerSave;
  /** the letters on the blocks */
  glyphs: SavedGlyph[];
}

/** what Zork says when the ground has sunk this many metres */
const SIGHTS = [
  { at: 4, say: 'Die Bäume werden ja ganz klein!' },
  { at: 12, say: 'Huch, wir sind in den Wolken!' },
  { at: 20, say: 'Winke, winke, Flugzeug!' },
  { at: 34, say: 'Wir sind im Weltall!' },
  { at: 46, say: 'Hallo ISS! Habt ihr Kekse?' },
  { at: 80, say: 'Da vorne ist der Mond!' },
];

export const ALIEN_NAMES = ['Zork', 'Zip', 'Zap', 'Zisch', 'Zuppi', 'Zibbel', 'Zonk', 'Zappel'];
const ALIEN_HUES = [105, 190, 300, 30, 160, 260, 340, 55];

interface AlienView {
  flash: number;
  talk: { text: string; t: number; dur: number } | null;
  /** cues of the current gag that already fired */
  gagKey: string;
  fired: Set<number>;
  tilt: number;
  blink: number;
  pose: GagPose;
}

interface Scoop {
  x: number;
  y: number;
  vy: number;
  landed: number;
}

type SeqName = 'intro' | 'victory';

export class TowerScene implements Scene {
  readonly host: SceneHost;
  sim: TowerSim;
  particles = new Particles();
  fx = new SpawnFx(this.particles);
  glyphs = new Map<number, { glyph: ScannedGlyph; sticker: AnyCanvas }>();
  names: string[];
  colors: string[];
  hues: number[];
  views = new Map<number, AlienView>();
  /** block id -> pose of a drop gag that still animates a block on its tower */
  animated = new Map<number, GagPose>();
  scoops: Scoop[] = [];
  W: number;
  t = 0;
  /** hills, ground and plinths: they sink with the ground */
  bg: AnyCanvas | null = null;
  sky: ReturnType<typeof makeCanvas> | null = null;
  /** metres the ground had sunk when the sky was painted */
  skyAt = -1;
  /** sights Zork has already called out */
  seen = 0;
  portalOpen = 0;
  portalPulse = 0;
  seq: { name: SeqName; t: number; dur: number; fired: Set<number> } | null = null;
  banner: Banner | null = null;
  countdown = -1;
  shake = 0;
  crownT = -1;
  private finishedSent = false;

  constructor(host: SceneHost, worldW: number) {
    this.host = host;
    this.W = worldW;
    const s = host.settings.tower;
    const players = s.players.slice(0, s.count);
    this.names = players.map((p) => p.name);
    this.colors = players.map((p) => teamColor(p, s.by));
    this.hues = this.colors.map(hexHue);
    this.sim = new TowerSim(players.length, TOWER.goal[s.goal], worldW, s.timeLimit * 60);
    this.fx.top = 430;
    this.resize(worldW);
    this.startSeq('intro', 5.8);
  }

  get cinematic(): boolean {
    return !!this.seq;
  }

  async saveState(): Promise<SceneSave | null> {
    if (this.sim.over || !this.sim.stats.some((s) => s.written)) return null;
    const sim = this.sim.exportState();
    const ids = new Set<number>([...sim.towers.flatMap((t) => t.blocks), ...sim.pending].map((b) => b.glyphId));
    for (const st of sim.stats) if (st.best) ids.add(st.best.glyphId);
    const kept = [...ids].map((id) => this.glyphs.get(id)).filter((g) => !!g);
    const top = Math.max(...this.sim.towers.map((t) => t.metres));
    const summary = `Höchster Turm ${top} m von ${this.sim.goal} m`;
    const state: TowerSceneSave = { sim, glyphs: await Promise.all(kept.map((g) => saveGlyph(g.glyph))) };
    return { state, summary };
  }

  async restoreState(raw: unknown): Promise<void> {
    const s = raw as TowerSceneSave;
    for (const l of await Promise.all(s.glyphs.map(loadGlyph))) this.glyphs.set(l.glyph.id, l);
    this.sim.importState(s.sim, restoredId);
    this.views.clear();
    this.seq = null;
    this.countdown = -1;
    this.portalOpen = 1;
    this.seen = SIGHTS.filter((s) => s.at <= this.sunk()).length;
    this.banner = { title: 'Weiter geht’s!', sub: 'Die Türme stehen noch – baut weiter!', t: 0, dur: 2.6 };
    const zork = this.sim.aliens[0];
    if (zork) this.talk(zork, 'Da seid ihr ja wieder!', 2.4);
  }

  resize(worldW: number): void {
    this.W = worldW;
    this.sim.resize(worldW);
    const { canvas, ctx } = makeCanvas(Math.round(worldW), WORLD_H);
    this.paint(ctx as CanvasRenderingContext2D);
    this.bg = canvas;
    this.sky = null;
  }

  /** metres the ground has sunk away (only with finish lines higher than fit on the screen) */
  private sunk(): number {
    return this.sim.lift / this.sim.ppm;
  }

  private get high(): boolean {
    return this.sim.maxLift > 0;
  }

  private drawSky(ctx: CanvasRenderingContext2D): void {
    const c = this.sunk();
    if (!this.sky || Math.abs(c - this.skyAt) > 0.25) {
      if (!this.sky) this.sky = makeCanvas(Math.round(this.W), WORLD_H);
      paintSky(this.sky.ctx, this.W, c, this.high);
      this.skyAt = c;
    }
    ctx.drawImage(this.sky.canvas as CanvasImageSource, 0, 0);
    if (this.high) drawSkyThings(ctx, this.W, c, this.t);
  }

  // ---------------------------------------------------------------- background

  private paint(ctx: CanvasRenderingContext2D): void {
    const W = this.W;
    const G = TOWER.groundY;
    const r = mulberry32(21);
    // hills (the sky is painted on its own: it changes when the ground sinks)
    for (const [dy, c, f] of [
      [70, 'rgba(120,80,170,0.55)', 0.004],
      [30, 'rgba(90,150,110,0.8)', 0.007],
    ] as const) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(0, G);
      for (let x = 0; x <= W; x += 30) ctx.lineTo(x, G - dy - Math.sin(x * f + dy) * 26 - Math.sin(x * f * 2.7) * 12);
      ctx.lineTo(W, G);
      ctx.fill();
    }
    const ground = ctx.createLinearGradient(0, G, 0, WORLD_H);
    ground.addColorStop(0, '#86d66e');
    ground.addColorStop(1, '#4f9e57');
    ctx.fillStyle = ground;
    ctx.fillRect(0, G, W, WORLD_H - G);
    for (let i = 0; i < 70; i++) {
      const x = r() * W;
      const y = G + 60 + r() * (WORLD_H - G - 70);
      ctx.fillStyle = hsl(r() * 360, 0.8, 0.78);
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe66b';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, TAU);
      ctx.fill();
    }
    this.sim.towers.forEach((tw, i) => drawPlinth(ctx, tw.x, this.names[i], this.colors[i], this.sim.towerW));
  }

  // ---------------------------------------------------------------- sequences

  private startSeq(name: SeqName, dur: number): void {
    this.seq = { name, t: 0, dur, fired: new Set() };
  }

  private at(i: number, at: number, fn: () => void): void {
    const s = this.seq!;
    if (s.t >= at && !s.fired.has(i)) {
      s.fired.add(i);
      fn();
    }
  }

  private runSeq(dt: number): void {
    const s = this.seq!;
    s.t += dt;
    const t = s.t;
    if (s.name === 'intro') {
      this.portalOpen = ease.outBack(clamp(t / 0.9));
      this.at(0, 0, () => sfx.portal());
      this.at(1, 1.0, () => {
        const a = this.sim.enterFirst();
        sfx.clone();
        this.particles.burst('spark', a.x, a.y, 14, { color: '#fff6b0', size: 14, speed: 260, max: 0.7 });
      });
      this.at(2, 1.7, () => {
        const a = this.sim.aliens[0];
        if (a) this.talk(a, 'Hallo! Ich bin Zork. Ich baue eure Türme!', 2.6);
      });
      this.at(3, 2.0, () => {
        this.banner = { title: 'Türme bauen!', sub: 'Je schöner der Buchstabe, desto höher der Baustein. Wer ist zuerst oben?', t: 0, dur: 2.2 };
      });
      this.at(4, 3.4, () => {
        this.countdown = 0;
        sfx.tick();
      });
      this.at(5, 3.95, () => sfx.tick());
      this.at(6, 4.5, () => sfx.tick());
      this.at(7, 5.05, () => sfx.go());
    } else {
      const w = this.sim.over?.winner;
      this.at(0, 0, () => {
        sfx.fanfare();
        this.crownT = 0;
        this.shake = 0.4;
      });
      this.at(1, 0.6, () => {
        const reason = this.sim.over?.reason;
        this.banner =
          w === null || w === undefined
            ? { title: 'Unentschieden!', sub: 'Die Zeit ist um – alle Türme sind gleich toll!', t: 0, dur: 4.6 }
            : {
                title: `Sieg für ${this.names[w]}!`,
                sub: reason === 'time' ? `Die Zeit ist um – mit ${this.sim.towers[w].metres} m der höchste Turm!` : `Zuerst über der Ziellinie – ${this.sim.towers[w].metres} m hoch!`,
                t: 0,
                dur: 4.6,
              };
      });
      this.at(2, 1.2, () => sfx.win());
      this.at(3, 1.0, () => this.confetti(80));
      this.at(4, 2.8, () => this.confetti(60));
      if (t > 0.8 && t < 5.5 && Math.floor(t / 0.45) !== Math.floor((t - dt) / 0.45)) {
        const x = w === null || w === undefined ? this.W / 2 : this.sim.towers[w].x;
        const y = w === null || w === undefined ? 300 : Math.max(200, this.sim.topY(w) - 150);
        this.firework(x + (Math.random() - 0.5) * 360, y - Math.random() * 120);
      }
    }
    if (s.t >= s.dur) {
      const name = s.name;
      this.seq = null;
      if (name === 'victory' && !this.finishedSent) {
        this.finishedSent = true;
        this.host.finished?.(this.result());
      }
    }
  }

  private confetti(n: number): void {
    const colors = [...this.colors, '#ffd84a', '#ffffff', '#7cdcff'];
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

  private firework(x: number, y: number): void {
    const hue = Math.random() * 360;
    this.particles.burst('spark', x, y, 22, { colors: [hsl(hue, 1, 0.75), hsl(hue + 40, 1, 0.8), '#ffffff'], size: 12, speed: 340, max: 0.9, gravity: 220 });
    this.particles.add({ kind: 'ring', x, y, size: 70, max: 0.4, color: hsl(hue, 1, 0.85, 0.9) });
    if (Math.random() < 0.5) sfx.plopp(0.6);
  }

  // ---------------------------------------------------------------- scans

  beginCapture(snap: Snapshot): void {
    this.fx.capture(snap, this.W);
  }

  cancelCapture(): void {
    this.fx.cancel();
  }

  /** tower index of a glyph's colour, or null if it belongs to no tower */
  private playerOf(g: ScannedGlyph): number | null {
    const i = g.team ? PLAYER_IDS.indexOf(g.team) : -1;
    return i >= 0 && i < this.sim.towers.length ? i : null;
  }

  handleScan(res: ScanResult, snap: Snapshot): void {
    if (this.sim.over) return;
    const stickers = new Map<number, AnyCanvas>();
    for (const g of res.glyphs) stickers.set(g.id, canvasFromRGBA(g.crop));
    const fresh = res.glyphs.filter((g) => g.isNew);
    const neutral = fresh.filter((g) => this.playerOf(g) === null).length;
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => (this.playerOf(g) === null ? null : this.sim.portalPos()),
      (g) => {
        const p = this.playerOf(g);
        if (p === null) return;
        this.glyphs.set(g.id, { glyph: g, sticker: stickers.get(g.id)! });
        this.sim.addBlock(p, g.score.score, g.id);
        this.portalPulse = 1;
        this.host.progress();
      },
      (g) => {
        const p = this.playerOf(g);
        return p === null ? '#9a9a9a' : this.colors[p];
      },
    );
    if (res.duplicates) this.host.toast(res.duplicates === 1 ? 'Diesen Zettel kenne ich schon!' : `${res.duplicates} Zeichen kenne ich schon!`, 'info');
    if (neutral) this.host.toast(`${neutral} Zeichen konnte ich keinem Turm zuordnen. Stiftfarbe prüfen!`, 'warn');
    if (!res.glyphs.length) this.host.toast('Ich sehe keine Buchstaben. Legt die Zettel unter die Kamera!', 'warn');
  }

  // ---------------------------------------------------------------- update

  private view(a: Alien): AlienView {
    let v = this.views.get(a.id);
    if (!v) {
      v = { flash: 0, talk: null, gagKey: '', fired: new Set(), tilt: 0, blink: 2 + Math.random() * 3, pose: { face: 'happy' } };
      this.views.set(a.id, v);
    }
    return v;
  }

  private talk(a: Alien, text: string, dur = 2): void {
    this.view(a).talk = { text, t: 0, dur };
  }

  private name(a: Alien): string {
    return ALIEN_NAMES[(a.n - 1) % ALIEN_NAMES.length];
  }

  /** what the current gag may know about this delivery */
  private kit(a: Alien): GagKit {
    const job = a.job!;
    const b = job.block;
    const sim = this.sim;
    const f = a.flight;
    const dir = f ? Math.sign(f.x1 - f.x0) || 1 : 1;
    const wrong = (job.tower + 1) % sim.towers.length;
    const wp = sim.dropPoint(wrong, b);
    const metres = sim.towers[job.tower].metres - (job.landed ? b.metres : 0);
    return {
      dir,
      wrongDx: wrong === job.tower ? 0 : wp.x - a.x,
      wrongDy: wrong === job.tower ? 0 : wp.y - a.y,
      stars: b.stars,
      blockH: b.h,
      room: sim.groundY() - (a.y + TOWER.hang + b.h) - 30,
      dropDist: job.dropDist,
      toGround: sim.groundY() - a.y,
      metres,
      toGoal: Math.max(0, sim.goal - metres - b.metres),
      teamName: this.names[job.tower],
    };
  }

  private poseOf(a: Alien): GagPose {
    const job = a.job;
    const g = job?.gag;
    if (job && g && job.gagT >= 0 && (g.phase === 'carry' ? this.sim.carryGagRunning(job) : a.state === 'drop')) return g.pose(job.gagT / g.dur, this.kit(a));
    if (a.state === 'mischief' && a.mischief) return mischiefPose(a.mischief.kind, this.sim.mischiefInfo(a)!);
    if (a.state === 'cheer') return { face: Math.sin(this.t * 3 + a.n) > 0 ? 'grin' : 'love', uy: -Math.abs(Math.sin(this.t * 6 + a.n)) * 18 };
    if (a.state === 'grab' || a.state === 'drop') return { face: 'focus' };
    return { face: 'happy' };
  }

  update(dt: number): void {
    this.t += dt;
    this.fx.update(dt);
    if (this.seq) this.runSeq(dt);
    this.sim.paused = this.seq?.name === 'intro';
    this.sim.step(dt);
    for (const e of this.sim.drain()) this.onEvent(e);
    this.sightseeing();
    this.animated.clear();
    for (const a of this.sim.aliens) {
      const v = this.view(a);
      v.flash = Math.max(0, v.flash - dt * 2.5);
      if (v.talk) {
        v.talk.t += dt;
        if (v.talk.t > v.talk.dur) v.talk = null;
      }
      v.tilt = lerp(v.tilt, clamp(a.vx / 1000, -0.35, 0.35), 1 - Math.exp(-dt * 6));
      v.blink -= dt;
      if (v.blink < -0.13) v.blink = 2 + Math.random() * 3;
      v.pose = this.poseOf(a);
      const job = a.job;
      const g = job?.gag;
      if (job && g && job.gagT >= 0) {
        const key = `${job.block.id}:${g.id}`;
        if (v.gagKey !== key) {
          v.gagKey = key;
          v.fired.clear();
        }
        const u = job.gagT / g.dur;
        g.cues?.forEach((c, i) => {
          if (u >= c.at && !v.fired.has(i)) {
            v.fired.add(i);
            this.cue(a, c);
          }
        });
        if (a.state === 'drop' && job.landed) this.animated.set(job.block.id, v.pose);
      }
      if (a.state === 'mischief' && a.mischief) this.mischiefAmbience(a, dt);
    }
    for (const s of this.scoops) {
      if (s.landed >= 0) {
        s.landed += dt;
        continue;
      }
      s.vy += 900 * dt;
      s.y += s.vy * dt;
      if (s.y >= this.sim.groundY() + 40) {
        s.y = this.sim.groundY() + 40;
        s.landed = 0;
        sfx.splat();
        this.particles.burst('drop', s.x, s.y, 8, { color: '#ff9fc6', size: 6, speed: 160, gravity: 500, max: 0.5 });
      }
    }
    this.scoops = this.scoops.filter((s) => s.landed < 3);
    this.particles.update(dt);
    this.portalPulse = Math.max(0, this.portalPulse - dt * 2.5);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.crownT >= 0) this.crownT += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    if (this.countdown >= 0) {
      this.countdown += dt;
      if (this.countdown > COUNTDOWN_SECONDS) this.countdown = -1;
    }
  }

  private onEvent(e: TowerEvent): void {
    switch (e.type) {
      case 'emerge': {
        sfx.portal();
        this.portalPulse = 1;
        const p = this.sim.portalPos();
        this.particles.burst('spark', p.x, p.y, 8, { color: '#e9d5ff', size: 10, speed: 180, max: 0.5 });
        break;
      }
      case 'clone': {
        this.view(e.from).flash = 1;
        sfx.clone();
        this.particles.add({ kind: 'ring', x: e.alien.x, y: e.alien.y, size: 110, max: 0.45, color: 'rgba(200,255,220,0.9)' });
        this.particles.burst('spark', e.alien.x, e.alien.y, 16, { colors: ['#fff6b0', '#b6ffcf', '#ffffff'], size: 13, speed: 280, max: 0.7 });
        // a big scan makes many clones at once: only a few of them introduce themselves
        if ([...this.views.values()].filter((v) => v.talk).length < 2) this.talk(e.alien, `Ich bin ${this.name(e.alien)}! Ich helfe!`, 1.8);
        break;
      }
      case 'assign':
        if (e.interrupted) this.talk(e.alien, e.interrupted === 'icecream' ? 'Oh, Arbeit! Das Eis muss warten.' : e.interrupted === 'nap' ? 'Huch! Ich komme!' : 'Oh, Arbeit!', 1.4);
        break;
      case 'grab':
        sfx.beam();
        break;
      case 'land': {
        const b = e.block;
        const thudCue = e.alien.job?.gag?.cues?.some((c) => c.sfx === 'thud');
        if (!thudCue) sfx.thud(b.metres / 4);
        const top = this.sim.topY(e.tower);
        const x = this.sim.towers[e.tower].x;
        this.particles.burst('puff', x, top, 10, { color: 'rgba(255,240,220,0.75)', size: 18, speed: 160, max: 0.6 });
        this.particles.add({ kind: 'text', x: x + this.sim.towerW / 2 + 50, y: top + 10, vy: -40, max: 1.6, size: 40, color: '#ffffff', text: `+${b.metres} m` });
        this.particles.add({ kind: 'text', x, y: top - 24, vy: -50, max: 1.4, size: 34, color: '#ffd84a', text: '★'.repeat(b.stars) });
        if (b.stars >= 5) {
          sfx.sparkle();
          this.particles.burst('spark', x, top + b.h / 2, 12, { color: '#fff6b0', size: 14, speed: 240, max: 0.7 });
        }
        this.host.progress();
        break;
      }
      case 'scribble':
        sfx.pfff();
        this.particles.burst('puff', e.block.x, e.block.y, 14, { color: 'rgba(200,200,215,0.8)', size: 26, speed: 90, max: 1 });
        this.particles.add({ kind: 'text', x: e.block.x, y: e.block.y - 50, vy: -30, max: 1.8, size: 40, color: '#f2f2ff', text: 'Pfff?' });
        break;
      case 'poof':
        this.particles.burst('spark', e.block.x, e.block.y, 10, { color: '#ffffff', size: 10, speed: 200, max: 0.5 });
        break;
      case 'pushBounce':
        sfx.boing();
        this.particles.burst('spark', e.alien.x, e.alien.y - 30, 6, { color: '#ffe14d', size: 12, speed: 200, max: 0.6 });
        break;
      case 'scoopDrop':
        this.scoops.push({ x: e.alien.x + 44, y: e.alien.y - 60, vy: -80, landed: -1 });
        break;
      case 'win':
        this.startSeq('victory', 7);
        break;
      case 'gag':
      case 'mischief':
        break;
    }
  }

  /** UFO position on screen (with the gag offsets) */
  private ufoAt(a: Alien): { x: number; y: number } {
    const p = this.view(a).pose;
    return { x: a.x + (p.ux ?? 0), y: a.y + (p.uy ?? 0) + this.bob(a) };
  }

  private bob(a: Alien): number {
    return a.state === 'idle' || a.state === 'mischief' || a.state === 'fetch' ? Math.sin(this.t * 2.2 + a.n * 1.7) * 6 : 0;
  }

  private blockAt(a: Alien): { x: number; y: number; b: TowerBlock } | null {
    const job = a.job;
    if (!job) return null;
    const b = job.block;
    const p = this.view(a).pose;
    if (b.state === 'placed') {
      const top = this.sim.topY(job.tower);
      return { x: b.x + (p.bx ?? 0), y: top + b.h / 2 + (p.by ?? 0), b };
    }
    const attached = b.state === 'carried' && a.state !== 'drop';
    return { x: b.x + (p.bx ?? 0) + (attached ? (p.ux ?? 0) : 0), y: b.y + (p.by ?? 0) + (attached ? (p.uy ?? 0) + this.bob(a) : 0), b };
  }

  private cue(a: Alien, c: GagCue): void {
    if (c.sfx) (sfx[c.sfx] as () => void)();
    if (c.fx) this.effect(a, c.fx);
  }

  private effect(a: Alien, name: FxName): void {
    const u = this.ufoAt(a);
    const bl = this.blockAt(a);
    const bx = bl?.x ?? u.x;
    const by = bl?.y ?? u.y + 100;
    const P = this.particles;
    switch (name) {
      case 'puff':
        P.burst('puff', u.x + 20, u.y - 30, 10, { color: 'rgba(255,255,255,0.85)', size: 20, speed: 160, max: 0.7 });
        break;
      case 'hearts':
        for (let i = 0; i < 3; i++) P.add({ kind: 'heart', x: u.x + (i - 1) * 24, y: u.y - 70, vx: (i - 1) * 20, vy: -70 - i * 15, size: 22, max: 1.4, color: '#ff4f81' });
        break;
      case 'notes':
        for (let i = 0; i < 2; i++) P.add({ kind: 'text', x: u.x + 50 + i * 26, y: u.y - 40, vx: 20, vy: -60, max: 1.3, size: 30, color: i ? '#7cdcff' : '#ffe14d', text: i ? '♫' : '♪' });
        break;
      case 'sparkles':
        P.burst('spark', bx, by, 10, { color: '#fff6b0', size: 12, speed: 160, max: 0.7 });
        break;
      case 'confetti':
        P.burst('confetti', bx, by - 30, 24, { colors: ['#ff6f91', '#ffd84a', '#7cdcff', '#8dff6b'], size: 12, speed: 260, max: 1.2, gravity: 400 });
        break;
      case 'zzz':
        P.add({ kind: 'text', x: u.x + 26, y: u.y - 80, vx: 18, vy: -40, max: 1.6, size: 26, color: '#e9e4ff', text: 'z' });
        break;
      case 'sweat':
        P.burst('drop', u.x - 22, u.y - 60, 4, { color: 'rgba(140,210,255,0.95)', size: 4, speed: 120, gravity: 500, max: 0.6 });
        break;
      case 'flash':
        P.add({ kind: 'ring', x: u.x + 58, y: u.y - 52, size: 90, max: 0.3, color: 'rgba(255,255,255,0.95)' });
        P.burst('spark', u.x + 58, u.y - 52, 8, { color: '#ffffff', size: 16, speed: 220, max: 0.35 });
        break;
      case 'rain':
        P.burst('drop', u.x, u.y - 95, 6, { color: 'rgba(110,170,255,0.9)', size: 4, speed: 40, gravity: 700, max: 0.6 });
        break;
      case 'dust':
        P.burst('puff', bx, by, 10, { color: 'rgba(220,200,170,0.7)', size: 22, speed: 160, max: 0.7 });
        break;
      case 'fireworks':
        this.firework(bx + (Math.random() - 0.5) * 160, by - 120 - Math.random() * 80);
        break;
      case 'smoke': {
        const d = a.flight ? Math.sign(a.flight.x1 - a.flight.x0) || 1 : 1;
        P.burst('puff', u.x - d * 80, u.y + 4, 8, { color: 'rgba(110,110,130,0.7)', size: 22, speed: 90, max: 0.9 });
        break;
      }
      case 'bubbles':
        P.add({ kind: 'bubble', x: u.x + (Math.random() - 0.5) * 120, y: u.y, vy: -60, size: 6 + Math.random() * 6, max: 1.4 });
        break;
      case 'speed':
        P.burst('puff', u.x, u.y, 6, { color: 'rgba(255,255,255,0.6)', size: 10, speed: 260, max: 0.4 });
        break;
      case 'teleport':
        P.add({ kind: 'ring', x: u.x, y: u.y, size: 120, max: 0.4, color: 'rgba(200,150,255,0.95)' });
        P.burst('spark', u.x, u.y, 14, { colors: ['#e9d5ff', '#b98bff', '#ffffff'], size: 12, speed: 240, max: 0.6 });
        break;
      case 'gum':
        P.burst('drop', u.x + 10, u.y - 24, 10, { color: '#ff78be', size: 6, speed: 200, gravity: 400, max: 0.5 });
        break;
      case 'crumbs':
        P.burst('drop', bx, by - (bl?.b.h ?? 40) / 2, 8, { color: '#a5743f', size: 4, speed: 120, gravity: 600, max: 0.7 });
        break;
      case 'shake':
        this.shake = 0.7;
        P.burst('puff', bx, by + (bl?.b.h ?? 40) / 2, 14, { color: 'rgba(220,200,170,0.8)', size: 26, speed: 220, max: 0.8 });
        break;
    }
  }

  /** small effects while aliens clean, nap or make music */
  private mischiefAmbience(a: Alien, dt: number): void {
    const k = a.mischief!.kind;
    const chance = (rate: number) => Math.random() < dt * rate;
    if (k === 'clean' && chance(5)) this.effect(a, 'bubbles');
    else if (k === 'nap' && chance(1.2)) this.effect(a, 'zzz');
    else if (k === 'music' && chance(1.5)) this.effect(a, 'notes');
    else if (k === 'push' && a.mischief!.phase === 1 && chance(2)) this.effect(a, 'sweat');
  }

  result(): TowerResult {
    const sim = this.sim;
    return {
      winner: sim.over?.winner ?? null,
      reason: sim.over?.reason ?? 'time',
      goal: sim.goal,
      players: sim.towers.map((tw, i) => {
        const st = sim.stats[i];
        const best = st.best ? this.glyphs.get(st.best.glyphId) : undefined;
        return {
          name: this.names[i],
          color: this.colors[i],
          metres: tw.metres,
          written: st.written,
          blocks: st.blocks,
          avgStars: st.blocks ? starsOf(st.scoreSum / st.blocks) : 0,
          best: best && st.best ? { sticker: best.sticker, score: st.best.score, char: best.glyph.score.char } : undefined,
        };
      }),
      seconds: sim.time,
      clones: sim.clones,
      gags: sim.gags,
    };
  }

  // ---------------------------------------------------------------- render

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate((Math.random() - 0.5) * this.shake * 16, (Math.random() - 0.5) * this.shake * 16);
    this.drawSky(ctx);
    if (this.bg && this.sim.lift < WORLD_H) ctx.drawImage(this.bg as CanvasImageSource, 0, this.sim.lift);
    drawGoalLine(ctx, this.W, this.sim.goal, this.sim.ppm, this.sim.groundY());
    const p = this.sim.portalPos();
    drawPortal(ctx, p.x, p.y, TOWER.portal.r, this.t, this.portalOpen, this.portalPulse);
    this.sim.towers.forEach((_, i) => this.drawTower(ctx, i));
    this.drawWaiting(ctx);
    const aliens = [...this.sim.aliens].sort((a, b) => a.y - b.y);
    for (const a of aliens) this.drawCarried(ctx, a);
    for (const a of aliens) this.drawAlien(ctx, a);
    for (const s of this.scoops) {
      ctx.save();
      ctx.globalAlpha = s.landed < 0 ? 1 : clamp(1 - (s.landed - 2) / 1);
      ctx.fillStyle = '#ff9fc6';
      ctx.strokeStyle = '#2b1d45';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (s.landed < 0) ctx.arc(s.x, s.y, 12, 0, TAU);
      else ctx.ellipse(s.x, s.y + 6, 22, 7, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    this.particles.render(ctx);
    this.drawSpeeches(ctx, aliens);
    ctx.restore();
    this.drawHud(ctx);
    this.fx.render(ctx);
    if (this.banner) drawBanner(ctx, this.W, this.banner, this.t, this.seq?.name === 'victory' ? 720 : 470);
    drawCountdown(ctx, this.W, this.countdown, 600);
  }

  private look(b: TowerBlock, deco = b.deco) {
    return {
      w: blockWidth(b.stars, this.sim.towerW),
      h: b.h,
      hue: this.hues[b.player] ?? 0,
      stars: b.stars,
      sticker: this.glyphs.get(b.glyphId)?.sticker ?? null,
      deco,
      seed: b.id * 13,
      t: this.t,
    };
  }

  private drawTower(ctx: CanvasRenderingContext2D, i: number): void {
    const tw = this.sim.towers[i];
    const lean = tw.shakeDir * tw.shake * (0.025 + 0.02 * Math.sin(this.t * 13));
    ctx.save();
    const ground = this.sim.groundY();
    ctx.translate(tw.x, ground);
    ctx.rotate(lean);
    let y = 0;
    for (const b of tw.blocks) {
      const anim = this.animated.get(b.id);
      const deco = anim?.bdeco && !b.deco.includes(anim.bdeco) ? [...b.deco, anim.bdeco] : b.deco;
      ctx.save();
      ctx.translate(anim?.bx ?? 0, y - b.h / 2 + (anim?.by ?? 0));
      ctx.rotate(b.tilt + (anim?.br ?? 0));
      if (anim?.bs) ctx.scale(anim.bs, anim.bs);
      drawBlock(ctx, this.look(b, deco));
      ctx.restore();
      y -= b.h;
    }
    ctx.restore();
    const top = ground + y;
    // height sign next to the top
    const label = `${tw.metres} m`;
    ctx.save();
    ctx.font = '700 26px Fredoka, system-ui, sans-serif';
    const w = ctx.measureText(label).width + 24;
    // with many towers there is no room beside them: the sign sits on top
    const beside = towerSpacing(this.sim.towers.length, this.W) - this.sim.towerW >= w + 110;
    const lx = beside ? tw.x + this.sim.towerW / 2 + 12 : tw.x - w / 2;
    const ly = beside ? Math.min(ground - 40, TOWER.liftFloor - 20, top + 4) : top - 28;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = this.colors[i];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(lx, ly - 18, w, 36, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b2a5c';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, lx + 12, ly + 1);
    ctx.restore();
    if (this.crownT >= 0 && this.sim.over?.winner === i) {
      const s = ease.outBack(clamp(this.crownT / 0.8));
      crown(ctx, tw.x, top - 8 - Math.sin(this.t * 3) * 4, 130 * s, Math.sin(this.t * 2) * 0.08);
    }
  }

  /** blocks coming out of the portal and waiting for an alien */
  private drawWaiting(ctx: CanvasRenderingContext2D): void {
    for (const b of this.sim.blocks) {
      if (b.state !== 'emerging' && b.state !== 'waiting') continue;
      const grabbing = b.alien && this.sim.alienById(b.alien)?.state === 'grab';
      const bob = grabbing ? 0 : Math.sin(this.t * 2.4 + b.id) * 5;
      ctx.save();
      ctx.translate(b.x, b.y + bob);
      ctx.scale(b.s, b.s);
      ctx.rotate(b.scribble ? Math.sin(this.t * 14) * 0.08 : 0);
      drawBlock(ctx, this.look(b));
      ctx.restore();
      if (b.state === 'waiting' && !grabbing && !b.scribble) {
        ctx.save();
        ctx.font = '700 24px Fredoka, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(40,20,60,0.8)';
        ctx.lineJoin = 'round';
        const sy = b.y + bob - (b.h * b.s) / 2 - 12;
        ctx.strokeText('★'.repeat(b.stars), b.x, sy);
        ctx.fillStyle = '#ffd84a';
        ctx.fillText('★'.repeat(b.stars), b.x, sy);
        ctx.restore();
      }
    }
  }

  /** tractor beam and the block it carries */
  private drawCarried(ctx: CanvasRenderingContext2D, a: Alien): void {
    const job = a.job;
    if (!job || (a.state !== 'grab' && a.state !== 'carry' && a.state !== 'drop')) return;
    const v = this.view(a);
    const p = v.pose;
    const u = this.ufoAt(a);
    const bl = this.blockAt(a)!;
    const b = bl.b;
    const s = b.state === 'waiting' ? b.s : (p.bs ?? 1);
    const landed = b.state === 'placed';
    if (!landed) {
      const top = bl.y - (b.h * s) / 2;
      drawBeam(ctx, u.x, u.y + 16, top + 4, blockWidth(b.stars, this.sim.towerW) * s + 24, (p.beam ?? 1) * (p.ua ?? 1), this.t, p.beamColor === 'rainbow');
    }
    if (b.state !== 'carried') return;
    ctx.save();
    ctx.globalAlpha = p.ba ?? 1;
    ctx.translate(bl.x, bl.y);
    ctx.rotate(b.tilt + (p.br ?? 0));
    ctx.scale(s, s);
    drawBlock(ctx, this.look(b, p.bdeco && !b.deco.includes(p.bdeco) ? [...b.deco, p.bdeco] : b.deco));
    ctx.restore();
    // extras that belong to the block
    if (p.extra === 'bird') {
      const e = p.extraP ?? 0;
      const sit = { x: bl.x + 30, y: bl.y - b.h / 2 - 10 };
      const x = e < 0.25 ? lerp(sit.x + 320, sit.x, ease.outCubic(e / 0.25)) : e > 0.75 ? lerp(sit.x, sit.x + 300, ease.inQuad((e - 0.75) / 0.25)) : sit.x;
      const y = e < 0.25 ? lerp(sit.y - 220, sit.y, ease.outCubic(e / 0.25)) : e > 0.75 ? lerp(sit.y, sit.y - 260, ease.inQuad((e - 0.75) / 0.25)) : sit.y;
      drawBird(ctx, x, y, this.t, e < 0.25 || e > 0.75);
    } else if (p.extra === 'butterfly') {
      const ang = this.t * 2.6;
      drawButterfly(ctx, bl.x + Math.cos(ang) * (blockWidth(b.stars, this.sim.towerW) / 2 + 26), bl.y + Math.sin(ang) * (b.h / 2 + 16), this.t);
    }
  }

  private drawAlien(ctx: CanvasRenderingContext2D, a: Alien): void {
    const v = this.view(a);
    const p = v.pose;
    const u = this.ufoAt(a);
    const born = a.cloneOf ? ease.outBack(clamp((this.sim.time - a.born) / 0.5)) : 1;
    const dir = a.flight ? Math.sign(a.flight.x1 - a.flight.x0) || 1 : 1;
    if (p.extra === 'cloud') drawCloud(ctx, u.x, u.y - 150, this.t);
    if (p.extra === 'shootingStar') drawShootingStar(ctx, u.x, u.y - 160, p.extraP ?? 0);
    if (p.extra === 'flames') drawFlames(ctx, u.x, u.y, dir, this.t);
    if (p.extra === 'tapeLine') drawTape(ctx, u.x + 41, u.y + 26, u.y + 26 + (this.sim.groundY() - u.y - 26) * (p.extraP ?? 0), this.sim.ppm);
    ctx.save();
    ctx.globalAlpha = p.ua ?? 1;
    ctx.translate(u.x, u.y);
    if (v.flash > 0) {
      const g = ctx.createRadialGradient(0, -10, 10, 0, -10, 130);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * v.flash})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, -10, 130, 0, TAU);
      ctx.fill();
    }
    ctx.rotate(v.tilt + (p.ur ?? 0));
    const s = (p.us ?? 1) * born * 0.95;
    ctx.scale(s, s);
    drawUfo(ctx, {
      hue: ALIEN_HUES[(a.n - 1) % ALIEN_HUES.length],
      face: p.face ?? 'happy',
      hat: p.hat,
      prop: p.prop,
      propP: p.propP,
      flag: a.job ? this.colors[a.job.tower] : undefined,
      t: this.t + a.n,
      blink: v.blink < 0,
      boss: a.n === 1,
    });
    ctx.restore();
    if (p.extra === 'juggle') drawJuggle(ctx, u.x, u.y - 80, this.t);
    if (p.extra === 'dizzyStars') drawDizzy(ctx, u.x, u.y - 92, this.t);
    if (p.extra === 'gumBubble') drawGumBubble(ctx, u.x + 12, u.y - 28, 4 + (p.extraP ?? 0) * 28);
  }

  /**
   * Speech bubbles above the UFOs; near the top of the screen they move to the side. Bubbles never
   * overlap: what the aliens say on their own (intro, clones) wins, a gag line that finds no room is skipped.
   */
  private drawSpeeches(ctx: CanvasRenderingContext2D, aliens: Alien[]): void {
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    // the rain cloud and the juggled stars sit above the UFO: bubbles go elsewhere
    for (const a of aliens) {
      const e = this.view(a).pose.extra;
      const u = this.ufoAt(a);
      if (e === 'cloud') placed.push({ x: u.x - 80, y: u.y - 195, w: 160, h: 90 });
      else if (e === 'juggle') placed.push({ x: u.x - 50, y: u.y - 145, w: 100, h: 60 });
    }
    const order = [...aliens].sort((a, b) => Number(!!this.view(b).talk) - Number(!!this.view(a).talk));
    ctx.save();
    ctx.font = '700 25px Fredoka, system-ui, sans-serif';
    for (const a of order) {
      const v = this.view(a);
      const text = v.talk?.text ?? v.pose.say;
      if (!text) continue;
      const lines: string[] = [];
      let cur = '';
      for (const word of text.split(' ')) {
        const next = cur ? `${cur} ${word}` : word;
        if (cur && ctx.measureText(next).width > 300) {
          lines.push(cur);
          cur = word;
        } else cur = next;
      }
      if (cur) lines.push(cur);
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 34;
      const h = lines.length * 30 + 20;
      const u = this.ufoAt(a);
      const cands = [
        { x: clamp(u.x - w / 2, 12, this.W - w - 12), y: u.y - 112 - h, side: 0 },
        { x: u.x + 96, y: u.y - 60 - h / 2, side: 1 },
        { x: u.x - 96 - w, y: u.y - 60 - h / 2, side: -1 },
      ];
      const free = (c: { x: number; y: number }) =>
        c.x >= 8 && c.x + w <= this.W - 8 && c.y >= 8 && !placed.some((p) => c.x < p.x + p.w + 6 && c.x + w + 6 > p.x && c.y < p.y + p.h + 6 && c.y + h + 6 > p.y);
      let c = cands.find(free);
      if (!c) {
        if (!v.talk) continue;
        c = { ...cands[0], y: Math.max(8, cands[0].y) };
      }
      placed.push({ x: c.x, y: c.y, w, h });
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.strokeStyle = '#3b2a5c';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.roundRect(c.x, c.y, w, h, 18);
      if (c.side === 0) {
        const tx = clamp(u.x, c.x + 24, c.x + w - 24);
        ctx.moveTo(tx - 12, c.y + h);
        ctx.lineTo(tx, c.y + h + 16);
        ctx.lineTo(tx + 12, c.y + h);
      } else {
        const ex = c.side > 0 ? c.x : c.x + w;
        const ty = clamp(u.y - 50, c.y + 16, c.y + h - 16);
        ctx.moveTo(ex, ty - 11);
        ctx.lineTo(ex - c.side * 18, ty + 4);
        ctx.lineTo(ex, ty + 11);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#3b2a5c';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((l, i) => ctx.fillText(l, c.x + w / 2, c.y + 25 + i * 30));
    }
    ctx.restore();
  }

  /** Zork calls out what flies by when the towers grow into the sky */
  private sightseeing(): void {
    const s = SIGHTS[this.seen];
    if (!this.high || !s || this.sunk() < s.at || this.sim.over) return;
    this.seen++;
    const zork = this.sim.aliens[0];
    if (zork) this.talk(zork, s.say, 2.6);
  }

  /** with high finish lines the goal is far above: a bar at the side shows how far every tower is */
  private drawMeter(ctx: CanvasRenderingContext2D): void {
    if (!this.high || this.seq?.name === 'intro') return;
    const x = this.W - 46;
    const y0 = 150;
    const y1 = 930;
    const at = (m: number) => lerp(y1, y0, clamp(m / this.sim.goal));
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,45,0.55)';
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x - 9, y0 - 6, 18, y1 - y0 + 12, 9);
    ctx.fill();
    ctx.stroke();
    ctx.font = '700 22px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(40,20,60,0.7)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.strokeText(`Ziel ${this.sim.goal} m`, x + 14, y0 - 30);
    ctx.fillText(`Ziel ${this.sim.goal} m`, x + 14, y0 - 30);
    this.sim.towers.forEach((tw, i) => {
      const y = at(tw.metres);
      ctx.fillStyle = this.colors[i];
      ctx.strokeStyle = '#2b1d45';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, TAU);
      ctx.fill();
      ctx.stroke();
    });
    ctx.restore();
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    this.drawMeter(ctx);
    if (this.seq || this.sim.timeLimit <= 0) return;
    const left = Math.max(0, this.sim.timeLimit - this.sim.time);
    const text = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    ctx.save();
    ctx.font = '700 44px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = left < 30 ? '#ff5470' : '#ffffff';
    ctx.strokeStyle = 'rgba(40,20,60,0.6)';
    ctx.lineWidth = 6;
    ctx.strokeText(text, this.W / 2, 62);
    ctx.fillText(text, this.W / 2, 62);
    ctx.restore();
  }

  tap(): boolean {
    return false;
  }

  destroy(): void {
    this.views.clear();
  }
}

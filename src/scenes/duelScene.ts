// Team-Duell scene: bubble-pile castles with bubble machines, five lanes, fighters with 1–5 stars.
import type { TeamSettings } from '../app/settings.ts';
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import { bubbleSprite } from '../game/creatures/bubble.ts';
import { fighterSprite } from '../game/creatures/duelFigure.ts';
import { makeGenome } from '../game/creatures/genome.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { BALANCE, laneY, pileRowY } from '../game/duel/balance.ts';
import { DuelSim, type CastleSize, type DuelEvent, type DuelSave, type Fighter, type TeamStats } from '../game/duel/duelSim.ts';
import { clamp, ease, hsl, lerp, TAU } from '../game/math.ts';
import { Particles } from '../game/particles.ts';
import { hashBytes, mulberry32 } from '../game/rng.ts';
import { SpawnFx } from '../game/spawnFx.ts';
import { WORLD_H } from '../game/stage.ts';
import { PEN_PRESETS, SLIP_PRESETS } from '../vision/color.ts';
import type { ScanResult, ScannedGlyph, TeamId } from '../vision/types.ts';
import { loadGlyph, restoredId, saveGlyph, type SavedGlyph, type SceneSave } from './saved.ts';
import type { Scene, SceneHost, Snapshot } from './scene.ts';

export interface DuelTeamResult {
  id: TeamId;
  name: string;
  color: string;
  stats: TeamStats;
  best?: { sticker: AnyCanvas; score: number; char: string };
  bravest?: { sticker: AnyCanvas; hits: number; char: string };
  avgStars: number;
}

export interface DuelResult {
  winner: TeamId | 'draw';
  teams: [DuelTeamResult, DuelTeamResult];
  seconds: number;
}

interface FighterView {
  sprite: Sprite;
  bob: number;
  lunge: number;
  /** stars shown (lags behind the real strength for the "star flies away" effect) */
  shown: number;
}

interface Falling {
  sticker: AnyCanvas;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  t: number;
}

/** a bubble of a castle pile on screen (slides down when bubbles below it pop) */
interface PileBubble {
  y: number;
  vy: number;
  squash: number;
  hue: number;
}

interface Flight {
  team: TeamId;
  column: number;
  t: number;
  hue: number;
}

/** five-pointed star: gold when the strike is still available */
function starShape(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, on: boolean): void {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.lineJoin = 'round';
  if (on) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
    g.addColorStop(0, '#fff6a8');
    g.addColorStop(1, '#ffc21a');
    ctx.fillStyle = g;
    ctx.strokeStyle = '#9a5b00';
    ctx.lineWidth = 2.5;
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.strokeStyle = 'rgba(60,40,90,0.45)';
    ctx.lineWidth = 2;
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function hexHue(hex: string): number {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return 0;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  if (mx === mn) return 0;
  let h = 0;
  if (mx === r) h = ((g - b) / (mx - mn)) % 6;
  else if (mx === g) h = (b - r) / (mx - mn) + 2;
  else h = (r - g) / (mx - mn) + 4;
  return (h * 60 + 360) % 360;
}

export function teamColor(t: TeamSettings, by: 'pen' | 'slip'): string {
  if (by === 'slip') {
    const s = SLIP_PRESETS[t.slip]?.css ?? '#ff9ec7';
    // slips can be very light; use a stronger version for drawing
    return s === '#ffffff' ? '#7a7a7a' : s;
  }
  return PEN_PRESETS[t.pen]?.css ?? '#e5484d';
}

const TEAMS = ['A', 'B'] as const;

/** the duel side of a glyph (the vision knows up to four colours) */
const sideOf = (g: ScannedGlyph): TeamId | undefined => (g.team === 'A' || g.team === 'B' ? g.team : undefined);

/** a duel (or the Riesenburg) in a saved game */
export interface DuelSceneSave {
  sim: DuelSave;
  /** the letters of the fighters still on the field and of the best and bravest ones */
  glyphs: SavedGlyph[];
}

export interface DuelConfig {
  names: Record<TeamId, string>;
  colors: Record<TeamId, string>;
  castle: CastleSize;
  /** seconds, 0 = none */
  timeLimit: number;
}

export class DuelScene implements Scene {
  readonly host: SceneHost;
  sim: DuelSim;
  particles = new Particles();
  fx = new SpawnFx(this.particles);
  views = new Map<number, FighterView>();
  glyphs = new Map<number, { glyph: ScannedGlyph; sticker: AnyCanvas }>();
  falling: Falling[] = [];
  piles: Record<TeamId, PileBubble[][]>;
  flights: Flight[] = [];
  W: number;
  t = 0;
  bg: AnyCanvas | null = null;
  names: Record<TeamId, string>;
  colors: Record<TeamId, string>;
  hues: Record<TeamId, number>;
  castleShake: Record<TeamId, number> = { A: 0, B: 0 };
  machinePuff: Record<TeamId, number> = { A: 0, B: 0 };
  castlePopT: Record<TeamId, number> = { A: -1, B: -1 };
  finishedT = -1;
  paused = false;
  /** the team duel ends by itself; the Riesenburg plays its own final sequence */
  protected autoFinish = true;

  constructor(host: SceneHost, worldW: number, config?: DuelConfig) {
    this.host = host;
    this.W = worldW;
    const d = host.settings.duel;
    const cfg: DuelConfig = config ?? {
      names: { A: d.teams[0].name, B: d.teams[1].name },
      colors: { A: teamColor(d.teams[0], d.by), B: teamColor(d.teams[1], d.by) },
      castle: d.castle,
      timeLimit: d.timeLimit * 60,
    };
    this.sim = new DuelSim(cfg.castle, worldW, cfg.timeLimit);
    this.names = cfg.names;
    this.colors = cfg.colors;
    this.hues = { A: hexHue(this.colors.A), B: hexHue(this.colors.B) };
    this.piles = { A: [], B: [] };
    this.resetPile('A');
    this.resetPile('B');
    this.resize(worldW);
  }

  /** rebuilds the on-screen pile from the simulation (new bubbles drop in from above) */
  protected resetPile(team: TeamId, dropIn = 0): void {
    this.piles[team] = this.sim.castles[team].pile.map((n) =>
      Array.from({ length: n }, (_, r) => ({ y: pileRowY(r) - dropIn * (1 + r * 0.3), vy: 0, squash: 0, hue: this.hues[team] + r * 25 })),
    );
  }

  resize(worldW: number): void {
    this.W = worldW;
    this.sim.resize(worldW);
    const { canvas, ctx } = makeCanvas(Math.round(worldW), WORLD_H);
    this.paint(ctx as CanvasRenderingContext2D);
    this.bg = canvas;
  }

  protected paint(ctx: CanvasRenderingContext2D): void {
    const W = this.W;
    const r = mulberry32(4);
    const sky = ctx.createLinearGradient(0, 0, 0, 430);
    sky.addColorStop(0, '#9fd8ff');
    sky.addColorStop(1, '#e8f6ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 440);
    for (let i = 0; i < 5; i++) {
      const x = r() * W;
      const y = 150 + r() * 160;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [ox, oy, rr] of [
        [0, 0, 40],
        [40, -16, 50],
        [85, 0, 38],
      ]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, rr, 0, TAU);
        ctx.fill();
      }
    }
    const field = ctx.createLinearGradient(0, 420, 0, WORLD_H);
    field.addColorStop(0, '#a6dd6f');
    field.addColorStop(1, '#78c25a');
    ctx.fillStyle = field;
    ctx.fillRect(0, 420, W, WORLD_H - 420);
    ctx.fillStyle = hsl(this.hues.A, 0.7, 0.6, 0.12);
    ctx.fillRect(0, 420, W / 2, WORLD_H - 420);
    ctx.fillStyle = hsl(this.hues.B, 0.7, 0.6, 0.12);
    ctx.fillRect(W / 2, 420, W / 2, WORLD_H - 420);
    const x0 = this.sim.frontEdge('A');
    const x1 = this.sim.frontEdge('B');
    for (let l = 0; l < BALANCE.lanes; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(x0, laneY(l) + 26, x1 - x0, 22, 11);
      ctx.fill();
    }
    for (let y = 450; y < WORLD_H; y += 46) {
      ctx.fillStyle = hsl(r() * 360, 0.8, 0.75);
      ctx.beginPath();
      ctx.arc(W / 2 + (r() - 0.5) * 10, y, 7, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe66b';
      ctx.beginPath();
      ctx.arc(W / 2 + (r() - 0.5) * 10, y, 3, 0, TAU);
      ctx.fill();
    }
  }

  // ---------------------------------------------------------------- scans

  beginCapture(snap: Snapshot): void {
    this.fx.capture(snap, this.W);
  }

  cancelCapture(): void {
    this.fx.cancel();
  }

  handleScan(res: ScanResult, snap: Snapshot): void {
    if (this.sim.over) return;
    const stickers = new Map<number, AnyCanvas>();
    for (const g of res.glyphs) stickers.set(g.id, canvasFromRGBA(g.crop));
    const fresh = res.glyphs.filter((g) => g.isNew);
    const neutral = fresh.filter((g) => !sideOf(g)).length;
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => {
        const team = sideOf(g);
        return team ? { x: this.sim.gateX(team), y: 620 } : null;
      },
      (g) => {
        const team = sideOf(g);
        if (!team) return;
        const sticker = stickers.get(g.id)!;
        this.glyphs.set(g.id, { glyph: g, sticker });
        const f = this.sim.spawn(team, g.score.score, g.id);
        this.onSpawn(f, g);
        if (f) {
          sfx.hatch(g.score.score);
          const y = laneY(f.lane);
          this.particles.burst('puff', f.x, y, 8, { color: 'rgba(255,255,255,0.85)', size: 22, speed: 140, max: 0.5 });
          this.particles.add({ kind: 'text', x: f.x, y: y - f.radius - 70, vy: -35, max: 1.6, size: 34, color: '#ffd84a', text: '★'.repeat(f.strength) });
        }
        this.host.progress();
      },
      (g) => {
        const team = sideOf(g);
        return team ? this.colors[team] : '#9a9a9a';
      },
    );
    if (res.duplicates) this.host.toast(res.duplicates === 1 ? 'Diesen Zettel kenne ich schon!' : `${res.duplicates} Zeichen kenne ich schon!`, 'info');
    if (neutral) this.host.toast(`${neutral} Zeichen konnte ich keinem Team zuordnen. Stiftfarbe prüfen!`, 'warn');
    if (!res.glyphs.length) this.host.toast('Ich sehe keine Zettel. Legt sie unter die Kamera!', 'warn');
  }

  protected makeSprite(f: Fighter): Sprite {
    const info = this.glyphs.get(f.glyphId);
    const g = makeGenome(f.score, info?.glyph.score.tier ?? 'nett', hashBytes(info?.glyph.crop.data ?? [f.id], 11), 'fighter', this.hues[f.team]);
    return fighterSprite(g, info?.sticker ?? null, f.radius);
  }

  protected view(f: Fighter): FighterView {
    let v = this.views.get(f.id);
    if (!v) {
      v = { sprite: this.makeSprite(f), bob: Math.random() * TAU, lunge: 0, shown: f.strength };
      this.views.set(f.id, v);
    }
    return v;
  }

  /** hook for subclasses: every simulation event */
  protected onEvent(_e: DuelEvent): void {}

  /** hook for subclasses: a letter arrived (f is null for scribbles) */
  protected onSpawn(_f: Fighter | null, _g: ScannedGlyph): void {}

  // ---------------------------------------------------------------- update

  protected machineX(team: TeamId): number {
    return this.sim.castles[team].x - this.sim.dir(team) * 185;
  }

  protected nozzle(team: TeamId): { x: number; y: number } {
    return { x: this.machineX(team) + this.sim.dir(team) * 62, y: 660 };
  }

  update(dt: number): void {
    this.t += dt;
    this.fx.update(dt);
    if (!this.paused) this.sim.step(dt);
    for (const e of this.sim.drain()) {
      this.onEvent(e);
      if (e.type === 'strike') {
        if (Math.random() < 0.7) sfx.bonk();
        const tv = this.views.get(e.target.id);
        const y = laneY(e.target.lane) - e.target.radius - 26;
        this.particles.burst('spark', e.target.x, y, 5, { color: '#ffd84a', size: 14, speed: 180, max: 0.6, gravity: 300 });
        if (tv) tv.shown = Math.max(0, e.target.strength);
        const bv = this.views.get(e.by.id);
        if (bv) bv.lunge = 1;
      } else if (e.type === 'pop') this.popFighter(e.fighter, e.exhausted);
      else if (e.type === 'bubblePop') {
        const col = this.piles[e.team][e.column];
        const b = col?.[e.row];
        const x = this.sim.columnX(e.team, e.column);
        const y = b?.y ?? pileRowY(e.row);
        col?.splice(e.row, 1);
        this.popBubble(x, y, this.hues[e.team]);
        this.castleShake[e.team] = 0.6;
        const v = this.views.get(e.by.id);
        if (v) {
          v.lunge = 1;
          v.shown = e.by.strength;
        }
      } else if (e.type === 'machineLaunch') {
        this.flights.push({ team: e.team, column: e.column, t: 0, hue: this.hues[e.team] + Math.random() * 120 });
        this.machinePuff[e.team] = 1;
        sfx.blub();
      } else if (e.type === 'bubbleLand') {
        const i = this.flights.findIndex((f) => f.team === e.team && f.column === e.column);
        const fl = i >= 0 ? this.flights.splice(i, 1)[0] : null;
        const col = this.piles[e.team][e.column];
        col.push({ y: pileRowY(col.length) - 8, vy: 0, squash: 0.6, hue: fl?.hue ?? this.hues[e.team] });
      } else if (e.type === 'castlePop') {
        this.castlePopT[e.team] = 0;
        sfx.win();
      } else if (e.type === 'scribble') {
        sfx.pfff();
        const x = this.sim.gateX(e.team);
        this.particles.burst('puff', x, 620, 14, { color: 'rgba(160,160,170,0.7)', size: 30, speed: 90, max: 1.1 });
        this.particles.add({ kind: 'text', x, y: 540, vy: -30, max: 1.8, size: 40, color: '#e9e9f2', text: 'Pfff?' });
      }
    }
    // the pile settles: bubbles above a popped one slide down
    for (const team of TEAMS) {
      for (const col of this.piles[team]) {
        col.forEach((b, r) => {
          const target = pileRowY(r);
          if (b.y < target) {
            b.vy += 1700 * dt;
            b.y += b.vy * dt;
            if (b.y >= target) {
              b.y = target;
              b.squash = Math.min(0.5, Math.abs(b.vy) / 900);
              b.vy = b.vy > 160 ? -b.vy * 0.22 : 0;
            }
          } else if (b.vy < 0) {
            b.vy += 1700 * dt;
            b.y += b.vy * dt;
            if (b.y > target) {
              b.y = target;
              b.vy = 0;
            }
          }
          b.squash = Math.max(0, b.squash - dt * 3);
        });
      }
      // castle conquered: the remaining bubbles pop one after another
      if (this.castlePopT[team] >= 0) {
        this.castlePopT[team] += dt;
        const col = this.piles[team].reduce((best, c) => (c.length > best.length ? c : best), [] as PileBubble[]);
        if (col.length && Math.random() < dt * 12) {
          const ci = this.piles[team].indexOf(col);
          const b = col.pop()!;
          this.popBubble(this.sim.columnX(team, ci), b.y, b.hue);
        }
      }
      this.castleShake[team] = Math.max(0, this.castleShake[team] - dt * 2.5);
      this.machinePuff[team] = Math.max(0, this.machinePuff[team] - dt * 2);
    }
    for (const fl of this.flights) fl.t += dt;
    for (const v of this.views.values()) v.lunge = Math.max(0, v.lunge - dt * 5);
    for (const f of this.falling) {
      f.t += dt;
      f.vy = Math.min(f.vy + 300 * dt, 120);
      f.vx *= 0.98;
      f.x += f.vx * dt + Math.sin(f.t * 5) * 0.8;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }
    this.falling = this.falling.filter((f) => f.t < 1.6);
    this.particles.update(dt);
    if (this.autoFinish && this.sim.over && this.finishedT < 0) this.finishedT = 0;
    if (this.finishedT >= 0) {
      this.finishedT += dt;
      if (this.finishedT > 2.6 && this.finishedT - dt <= 2.6) this.host.finished?.(this.result());
    }
  }

  protected popBubble(x: number, y: number, hue: number): void {
    sfx.plopp(1.2);
    this.particles.add({ kind: 'ring', x, y, size: BALANCE.pile.bubbleR * 1.5, max: 0.35, color: hsl(hue, 0.8, 0.85, 0.95) });
    this.particles.burst('drop', x, y, 9, { color: hsl(hue, 0.7, 0.85, 0.9), size: 5, speed: 240, gravity: 650, max: 0.55 });
  }

  protected popFighter(f: Fighter, exhausted?: boolean): void {
    const y = laneY(f.lane);
    sfx.plopp(f.radius / 30);
    this.particles.add({ kind: 'ring', x: f.x, y, size: f.radius * 1.4, max: 0.35, color: 'rgba(255,255,255,0.95)' });
    this.particles.burst('drop', f.x, y, 10, { color: 'rgba(210,240,255,0.95)', size: 5, speed: 260, gravity: 600, max: 0.55 });
    if (exhausted) this.particles.add({ kind: 'text', x: f.x, y: y - f.radius - 20, vy: -40, max: 1.2, size: 30, color: '#ffffff', text: 'Puh!' });
    const info = this.glyphs.get(f.glyphId);
    if (info) this.falling.push({ sticker: info.sticker, x: f.x, y: y - f.radius * 0.2, vx: (Math.random() - 0.5) * 60, vy: -120, rot: 0, vr: (Math.random() - 0.5) * 6, t: 0 });
    this.views.delete(f.id);
  }

  result(): DuelResult {
    const team = (id: TeamId, idx: 0 | 1): DuelTeamResult => {
      const st = this.sim.stats[id];
      const best = st.best ? this.glyphs.get(st.best.glyphId) : undefined;
      const brave = st.bravest ? this.glyphs.get(st.bravest.glyphId) : undefined;
      const avg = st.written ? st.scoreSum / st.written : 0;
      return {
        id,
        name: this.host.settings.duel.teams[idx].name,
        color: this.colors[id],
        stats: st,
        best: best && st.best ? { sticker: best.sticker, score: st.best.score, char: best.glyph.score.char } : undefined,
        bravest: brave && st.bravest ? { sticker: brave.sticker, hits: st.bravest.hits, char: brave.glyph.score.char } : undefined,
        avgStars: avg < 30 ? 1 : avg < 50 ? 2 : avg < 70 ? 3 : avg < 88 ? 4 : 5,
      };
    };
    return { winner: this.sim.over ?? 'draw', teams: [team('A', 0), team('B', 1)], seconds: this.sim.time };
  }

  // ---------------------------------------------------------------- render

  render(ctx: CanvasRenderingContext2D): void {
    this.renderWorld(ctx);
    this.renderOverlay(ctx);
  }

  /** HUD and scan feedback (not affected by camera moves) */
  protected renderOverlay(ctx: CanvasRenderingContext2D): void {
    this.drawHud(ctx);
    this.fx.render(ctx);
  }

  protected renderWorld(ctx: CanvasRenderingContext2D): void {
    if (this.bg) ctx.drawImage(this.bg as CanvasImageSource, 0, 0);
    for (const team of TEAMS) {
      this.drawMachine(ctx, team);
      this.drawCastle(ctx, team);
    }
    this.drawFlights(ctx);
    const fighters = [...this.sim.fighters].sort((a, b) => a.lane - b.lane);
    for (const f of fighters) this.drawFighter(ctx, f);
    for (const f of this.falling) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - (f.t - 0.9) / 0.7);
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      const s = 56 / Math.max(f.sticker.width, f.sticker.height);
      ctx.fillStyle = '#fffdf5';
      ctx.fillRect(-32, -32, 64, 64);
      ctx.drawImage(f.sticker as CanvasImageSource, (-f.sticker.width * s) / 2, (-f.sticker.height * s) / 2, f.sticker.width * s, f.sticker.height * s);
      ctx.restore();
    }
    this.particles.render(ctx);
  }

  protected drawCastle(ctx: CanvasRenderingContext2D, team: TeamId): void {
    const c = this.sim.castles[team];
    const hue = this.hues[team];
    const shake = Math.sin(this.t * 40) * 5 * this.castleShake[team];
    const left = this.sim.remaining(team) / c.startTotal;
    const baseY = BALANCE.pile.baseY;
    const cx = c.x + shake;
    // soft castle silhouette behind the bubble pile, fading as the castle loses bubbles
    if (this.castlePopT[team] < 0 || this.castlePopT[team] < 1.5) {
      const a = (0.1 + 0.3 * left) * (this.castlePopT[team] >= 0 ? clamp(1 - this.castlePopT[team] / 1.5) : 1);
      ctx.save();
      ctx.fillStyle = hsl(hue, 0.75, 0.72, a);
      ctx.strokeStyle = hsl(hue, 0.6, 0.45, a + 0.1);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(cx - 120, baseY - 300, 240, 350, 30);
      for (const sx of [-1, 1]) {
        ctx.roundRect(cx + sx * 95 - 40, baseY - 600, 80, 340, 34);
        ctx.moveTo(cx + sx * 95 - 50, baseY - 585);
        ctx.lineTo(cx + sx * 95, baseY - 665);
        ctx.lineTo(cx + sx * 95 + 50, baseY - 585);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // flag on the inner tower
      const fx = cx + this.sim.dir(team) * 95;
      const fy = baseY - 730;
      ctx.save();
      ctx.strokeStyle = '#6b4e3a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 70);
      ctx.lineTo(fx, fy - 30);
      ctx.stroke();
      ctx.fillStyle = this.colors[team];
      const wave = Math.sin(this.t * 4) * 6;
      const d = this.sim.dir(team);
      ctx.beginPath();
      ctx.moveTo(fx, fy - 30);
      ctx.quadraticCurveTo(fx + d * 40, fy - 30 + wave, fx + d * 75, fy - 15);
      ctx.lineTo(fx, fy + 5);
      ctx.fill();
      ctx.restore();
    }
    this.drawPile(ctx, team, shake);
  }

  /** the bubble pile: the wall the fighters have to pop */
  protected drawPile(ctx: CanvasRenderingContext2D, team: TeamId, shake: number): void {
    const hue = this.hues[team];
    const R = BALANCE.pile.bubbleR;
    this.piles[team].forEach((col, j) => {
      const x = this.sim.columnX(team, j) + shake;
      col.forEach((b, r) => {
        const wob = 1 + Math.sin(this.t * 2.2 + r * 1.3 + j) * 0.035;
        const s = bubbleSprite(R, Math.round(b.hue) % 360, hue, true);
        const sx = wob * (1 + b.squash * 0.25);
        const sy = wob * (1 - b.squash * 0.2);
        ctx.drawImage(s as CanvasImageSource, x - (s.width * sx) / 2, b.y - (s.height * sy) / 2 + (s.height * (1 - sy)) / 2, s.width * sx, s.height * sy);
      });
    });
  }

  protected drawMachine(ctx: CanvasRenderingContext2D, team: TeamId): void {
    const c = this.sim.castles[team];
    const d = this.sim.dir(team);
    const x = this.machineX(team);
    const hue = this.hues[team];
    const ground = 1010;
    const puff = this.machinePuff[team];
    const empty = c.tank <= 0;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#3b2a5c';
    // feet + body
    ctx.fillStyle = '#6b5a8f';
    ctx.fillRect(x - 40, ground - 16, 18, 16);
    ctx.fillRect(x + 22, ground - 16, 18, 16);
    ctx.fillStyle = hsl(hue, 0.65, 0.62);
    ctx.beginPath();
    ctx.roundRect(x - 50, ground - 120 - puff * 6, 100, 106 + puff * 6, 22);
    ctx.fill();
    ctx.stroke();
    // little face, sleepy when the tank is empty
    ctx.fillStyle = '#3b2a5c';
    for (const ex of [-16, 16]) {
      ctx.beginPath();
      if (empty) ctx.rect(x + ex - 7, ground - 82, 14, 3);
      else ctx.arc(x + ex, ground - 80, 6, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, ground - 60, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // tank (glass with soap) on the back side, the pipe runs on the battlefield side
    const tx = x - d * 14 - 30;
    const ty = ground - 300;
    const tw = 60;
    const th = 170;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 22);
    ctx.fill();
    const level = c.tankMax ? c.tank / c.tankMax : 0;
    if (level > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 22);
      ctx.clip();
      const lh = th * level;
      const g = ctx.createLinearGradient(tx, ty + th - lh, tx + tw, ty + th);
      g.addColorStop(0, hsl(hue + 40, 0.8, 0.8, 0.9));
      g.addColorStop(0.5, hsl(hue + 160, 0.8, 0.82, 0.9));
      g.addColorStop(1, hsl(hue + 280, 0.8, 0.8, 0.9));
      ctx.fillStyle = g;
      const wave = Math.sin(this.t * 3) * 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty + th - lh + wave);
      ctx.quadraticCurveTo(tx + tw / 2, ty + th - lh - wave, tx + tw, ty + th - lh + wave);
      ctx.lineTo(tx + tw, ty + th);
      ctx.lineTo(tx, ty + th);
      ctx.fill();
      // tiny bubbles in the soap
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 4; i++) {
        const by = ty + th - ((this.t * 30 + i * 40) % Math.max(10, lh));
        ctx.beginPath();
        ctx.arc(tx + 14 + i * 11, by, 3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.beginPath();
    ctx.roundRect(tx, ty, tw, th, 22);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(tx + 9, ty + 18, 7, th - 40);
    // pipe from the tank to the bubble ring
    const nz = this.nozzle(team);
    ctx.strokeStyle = '#3b2a5c';
    ctx.lineWidth = 10;
    const px = x + d * 34;
    ctx.beginPath();
    ctx.moveTo(px, ground - 120);
    ctx.lineTo(px, nz.y + 30);
    ctx.quadraticCurveTo(px, nz.y, nz.x - d * 12, nz.y);
    ctx.stroke();
    ctx.strokeStyle = hsl(hue, 0.65, 0.62);
    ctx.lineWidth = 5;
    ctx.stroke();
    // bubble ring
    ctx.strokeStyle = '#3b2a5c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(nz.x, nz.y, 10 + puff * 4, 24 + puff * 6, 0, 0, TAU);
    ctx.stroke();
    // tank label
    ctx.fillStyle = '#3b2a5c';
    ctx.font = '700 22px Fredoka, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(empty ? 'leer' : String(c.tank), tx + tw / 2, ty - 12);
    ctx.restore();
  }

  protected drawFlights(ctx: CanvasRenderingContext2D): void {
    for (const fl of this.flights) {
      const u = clamp(fl.t / BALANCE.machineFlight);
      const from = this.nozzle(fl.team);
      const col = this.piles[fl.team][fl.column];
      const ahead = this.flights.filter((o) => o !== fl && o.team === fl.team && o.column === fl.column && o.t > fl.t).length;
      const tx = this.sim.columnX(fl.team, fl.column);
      const ty = pileRowY(Math.min(BALANCE.pile.rows - 1, col.length + ahead));
      const e = ease.inOutCubic(u);
      const x = lerp(from.x, tx, e);
      const y = lerp(from.y, ty, e) - Math.sin(u * Math.PI) * 160;
      const r = BALANCE.pile.bubbleR * (0.35 + 0.65 * ease.outCubic(Math.min(1, u * 2)));
      const s = bubbleSprite(Math.round(r), Math.round(fl.hue) % 360, this.hues[fl.team], true);
      ctx.drawImage(s as CanvasImageSource, x - s.width / 2, y - s.height / 2);
    }
  }

  protected drawFighter(ctx: CanvasRenderingContext2D, f: Fighter): void {
    const v = this.view(f);
    const sp = v.sprite;
    const y = laneY(f.lane);
    const dir = f.team === 'A' ? 1 : -1;
    const walk = f.state === 'march' ? Math.abs(Math.sin(this.t * 9 + v.bob)) * 8 : 0;
    const lunge = ease.outCubic(v.lunge) * 16 * dir;
    ctx.save();
    ctx.translate(f.x + lunge + f.knock, y - walk);
    ctx.rotate(f.state === 'march' ? Math.sin(this.t * 9 + v.bob) * 0.06 : 0);
    ctx.scale(dir, 1);
    ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
    drawBadgeSticker(ctx, sp, dir);
    if (f.hitT > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = f.hitT * 1.6;
      ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
    }
    ctx.restore();
    // strength: one star per strike left (gold), used strikes stay as grey outlines
    const n = f.maxStrength;
    const r = 12;
    const gap = 24;
    const sy = y - walk - f.radius - 20;
    for (let i = 0; i < n; i++) {
      const sx = f.x + (i - (n - 1) / 2) * gap;
      const on = i < f.strength;
      starShape(ctx, sx, sy, on ? r + Math.sin(this.t * 4 + i) * 0.8 : r * 0.85, on);
    }
  }

  protected drawHud(ctx: CanvasRenderingContext2D): void {
    // the DOM HUD sits in the corners (menu/title left, camera right), so the bars share the middle
    const gap = 60;
    const barW = Math.max(260, Math.min(520, (this.W - 760 - gap) / 2));
    for (const team of TEAMS) {
      const c = this.sim.castles[team];
      const left = this.sim.remaining(team);
      const x = team === 'A' ? this.W / 2 - gap / 2 - barW : this.W / 2 + gap / 2;
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.roundRect(x, 24, barW, 92, 24);
      ctx.fill();
      ctx.fillStyle = this.colors[team];
      ctx.font = '700 34px Fredoka, system-ui, sans-serif';
      ctx.textAlign = team === 'A' ? 'left' : 'right';
      ctx.fillText(this.names[team], team === 'A' ? x + 22 : x + barW - 22, 64);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.beginPath();
      ctx.roundRect(x + 20, 80, barW - 40, 20, 10);
      ctx.fill();
      ctx.fillStyle = this.colors[team];
      const w = ((barW - 40) * left) / c.startTotal;
      ctx.beginPath();
      if (team === 'A') ctx.roundRect(x + 20, 80, Math.max(4, w), 20, 10);
      else ctx.roundRect(x + barW - 20 - Math.max(4, w), 80, Math.max(4, w), 20, 10);
      ctx.fill();
      ctx.fillStyle = '#4a3b6b';
      ctx.font = '600 24px Fredoka, system-ui, sans-serif';
      ctx.textAlign = team === 'A' ? 'right' : 'left';
      ctx.fillText(`${left} ${left === 1 ? 'Blase' : 'Blasen'}`, team === 'A' ? x + barW - 22 : x + 22, 64);
      ctx.restore();
    }
    if (this.sim.timeLimit > 0) {
      const leftT = Math.max(0, this.sim.timeLimit - this.sim.time);
      const m = Math.floor(leftT / 60);
      const s = Math.floor(leftT % 60);
      const text = `${m}:${String(s).padStart(2, '0')}`;
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

  tap(): boolean {
    return false;
  }

  /** something happened that is worth keeping */
  protected hasProgress(): boolean {
    return this.sim.stats.A.written + this.sim.stats.B.written > 0;
  }

  protected summary(): string {
    return `Noch ${this.sim.remaining('A')} : ${this.sim.remaining('B')} Blasen`;
  }

  async saveState(): Promise<SceneSave | null> {
    if (this.sim.over || !this.hasProgress()) return null;
    const sim = this.sim.exportState();
    const ids = new Set<number>(sim.fighters.map((f) => f.glyphId));
    for (const st of Object.values(sim.stats)) {
      if (st.best) ids.add(st.best.glyphId);
      if (st.bravest) ids.add(st.bravest.glyphId);
    }
    const kept = [...ids].map((id) => this.glyphs.get(id)).filter((g) => !!g);
    const summary = this.summary();
    const state: DuelSceneSave = { sim, glyphs: await Promise.all(kept.map((g) => saveGlyph(g.glyph))) };
    return { state, summary };
  }

  async restoreState(raw: unknown): Promise<void> {
    const s = raw as DuelSceneSave;
    for (const l of await Promise.all(s.glyphs.map(loadGlyph))) this.glyphs.set(l.glyph.id, l);
    this.sim.importState(s.sim, restoredId);
    // the saved game may come from a wider or narrower screen
    this.resize(this.W);
    this.views.clear();
    this.flights = [];
    this.falling = [];
    this.resetPile('A');
    this.resetPile('B');
  }

  destroy(): void {
    this.views.clear();
  }
}

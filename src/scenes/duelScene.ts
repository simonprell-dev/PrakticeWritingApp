// Team-Duell scene: two bubble castles, five lanes, fighters with the children's letters on their bellies.
import type { TeamSettings } from '../app/settings.ts';
import { sfx } from '../game/audio.ts';
import { canvasFromRGBA, makeCanvas, type AnyCanvas } from '../game/canvas.ts';
import { bubbleSprite } from '../game/creatures/bubble.ts';
import { fighterSprite } from '../game/creatures/duelFigure.ts';
import { makeGenome } from '../game/creatures/genome.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { BALANCE, laneY } from '../game/duel/balance.ts';
import { DuelSim, type Fighter, type TeamStats } from '../game/duel/duelSim.ts';
import { clamp, ease, hsl, TAU } from '../game/math.ts';
import { Particles } from '../game/particles.ts';
import { hashBytes, mulberry32 } from '../game/rng.ts';
import { SpawnFx } from '../game/spawnFx.ts';
import { WORLD_H } from '../game/stage.ts';
import { PEN_PRESETS, SLIP_PRESETS } from '../vision/color.ts';
import type { ScanResult, ScannedGlyph, TeamId } from '../vision/types.ts';
import type { Scene, SceneHost, Snapshot } from './scene.ts';

export interface DuelTeamResult {
  id: TeamId;
  name: string;
  color: string;
  stats: TeamStats;
  best?: { sticker: AnyCanvas; score: number; char: string };
  bravest?: { sticker: AnyCanvas; kills: number; char: string };
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

function hexHue(hex: string): number {
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

export class DuelScene implements Scene {
  readonly host: SceneHost;
  sim: DuelSim;
  particles = new Particles();
  fx = new SpawnFx(this.particles);
  views = new Map<number, FighterView>();
  glyphs = new Map<number, { glyph: ScannedGlyph; sticker: AnyCanvas }>();
  falling: Falling[] = [];
  W: number;
  t = 0;
  bg: AnyCanvas | null = null;
  names: Record<TeamId, string>;
  colors: Record<TeamId, string>;
  hues: Record<TeamId, number>;
  castleShake: Record<TeamId, number> = { A: 0, B: 0 };
  castlePopT: Record<TeamId, number> = { A: -1, B: -1 };
  finishedT = -1;
  paused = false;

  constructor(host: SceneHost, worldW: number) {
    this.host = host;
    this.W = worldW;
    const d = host.settings.duel;
    this.sim = new DuelSim(BALANCE.castleHp[d.castle], worldW, d.timeLimit * 60);
    this.names = { A: d.teams[0].name, B: d.teams[1].name };
    this.colors = { A: teamColor(d.teams[0], d.by), B: teamColor(d.teams[1], d.by) };
    this.hues = { A: hexHue(this.colors.A), B: hexHue(this.colors.B) };
    this.resize(worldW);
  }

  resize(worldW: number): void {
    this.W = worldW;
    this.sim.resize(worldW);
    const { canvas, ctx } = makeCanvas(Math.round(worldW), WORLD_H);
    this.paint(ctx as CanvasRenderingContext2D);
    this.bg = canvas;
  }

  private paint(ctx: CanvasRenderingContext2D): void {
    const W = this.W;
    const r = mulberry32(4);
    const sky = ctx.createLinearGradient(0, 0, 0, 430);
    sky.addColorStop(0, '#9fd8ff');
    sky.addColorStop(1, '#e8f6ff');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, 440);
    for (let i = 0; i < 5; i++) {
      const x = r() * W;
      const y = 120 + r() * 160;
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
    // team halves
    ctx.fillStyle = hsl(this.hues.A, 0.7, 0.6, 0.12);
    ctx.fillRect(0, 420, W / 2, WORLD_H - 420);
    ctx.fillStyle = hsl(this.hues.B, 0.7, 0.6, 0.12);
    ctx.fillRect(W / 2, 420, W / 2, WORLD_H - 420);
    // lanes
    for (let l = 0; l < BALANCE.lanes; l++) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.roundRect(260, laneY(l) + 26, W - 520, 22, 11);
      ctx.fill();
    }
    // middle line with flowers
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

  handleScan(res: ScanResult, snap: Snapshot): void {
    if (this.sim.over) return;
    const stickers = new Map<number, AnyCanvas>();
    for (const g of res.glyphs) stickers.set(g.id, canvasFromRGBA(g.crop));
    const fresh = res.glyphs.filter((g) => g.isNew);
    const neutral = fresh.filter((g) => !g.team).length;
    this.fx.start(
      snap,
      res.glyphs,
      stickers,
      this.W,
      (g) => (g.team ? { x: this.sim.gateX(g.team), y: 620 } : null),
      (g) => {
        if (!g.team) return;
        const sticker = stickers.get(g.id)!;
        this.glyphs.set(g.id, { glyph: g, sticker });
        const f = this.sim.spawn(g.team, g.score.score, g.id);
        if (f) {
          sfx.hatch(g.score.score);
          this.particles.burst('puff', f.x, laneY(f.lane), 8, { color: 'rgba(255,255,255,0.85)', size: 22, speed: 140, max: 0.5 });
        }
        this.host.progress();
      },
      (g) => (g.team ? this.colors[g.team] : '#9a9a9a'),
    );
    if (res.duplicates) this.host.toast(res.duplicates === 1 ? 'Diesen Zettel kenne ich schon!' : `${res.duplicates} Zeichen kenne ich schon!`, 'info');
    if (neutral) this.host.toast(`${neutral} Zeichen konnte ich keinem Team zuordnen. Stiftfarbe prüfen!`, 'warn');
    if (!res.glyphs.length) this.host.toast('Ich sehe keine Zettel. Legt sie unter die Kamera!', 'warn');
  }

  private view(f: Fighter): FighterView {
    let v = this.views.get(f.id);
    if (!v) {
      const info = this.glyphs.get(f.glyphId);
      const g = makeGenome(f.score, info?.glyph.score.tier ?? 'nett', hashBytes(info?.glyph.crop.data ?? [f.id], 11), 'fighter', this.hues[f.team]);
      v = { sprite: fighterSprite(g, info?.sticker ?? null, f.radius), bob: Math.random() * TAU, lunge: 0 };
      this.views.set(f.id, v);
    }
    return v;
  }

  update(dt: number): void {
    this.t += dt;
    this.fx.update(dt);
    if (!this.paused) this.sim.step(dt);
    for (const e of this.sim.drain()) {
      if (e.type === 'bonk') {
        if (Math.random() < 0.6) sfx.bonk();
        const y = laneY(e.target.lane);
        this.particles.burst('spark', e.target.x, y - e.target.radius * 0.3, 3, { color: '#fff2a8', size: 12, speed: 120, max: 0.35 });
        const v = this.views.get(e.by.id);
        if (v) v.lunge = 1;
      } else if (e.type === 'pop') this.pop(e.fighter);
      else if (e.type === 'castleHit') {
        this.castleShake[e.team] = 1;
        sfx.plopp(1.6);
        const c = this.sim.castles[e.team];
        this.particles.burst('drop', c.x, 600, 12, { color: hsl(this.hues[e.team], 0.8, 0.8, 0.9), size: 7, speed: 300, gravity: 700, max: 0.9 });
        this.particles.add({ kind: 'text', x: c.x, y: 380, vy: -50, max: 1.4, size: 46, color: '#ffffff', text: `-${e.damage}` });
        this.views.delete(e.fighter.id);
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
    for (const team of ['A', 'B'] as const) {
      this.castleShake[team] = Math.max(0, this.castleShake[team] - dt * 2.5);
      if (this.castlePopT[team] >= 0) this.castlePopT[team] += dt;
    }
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
    if (this.sim.over && this.finishedT < 0) this.finishedT = 0;
    if (this.finishedT >= 0) {
      this.finishedT += dt;
      if (this.finishedT > 2.4 && this.finishedT - dt <= 2.4) this.host.finished?.(this.result());
    }
  }

  private pop(f: Fighter): void {
    const y = laneY(f.lane);
    sfx.plopp(f.radius / 30);
    this.particles.add({ kind: 'ring', x: f.x, y, size: f.radius * 1.4, max: 0.35, color: 'rgba(255,255,255,0.95)' });
    this.particles.burst('drop', f.x, y, 10, { color: 'rgba(210,240,255,0.95)', size: 5, speed: 260, gravity: 600, max: 0.55 });
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
        bravest: brave && st.bravest ? { sticker: brave.sticker, kills: st.bravest.kills, char: brave.glyph.score.char } : undefined,
        avgStars: avg < 30 ? 1 : avg < 50 ? 2 : avg < 70 ? 3 : avg < 88 ? 4 : 5,
      };
    };
    return { winner: this.sim.over ?? 'draw', teams: [team('A', 0), team('B', 1)], seconds: this.sim.time };
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.bg) ctx.drawImage(this.bg as CanvasImageSource, 0, 0);
    for (const team of ['A', 'B'] as const) this.drawCastle(ctx, team);
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
    this.drawHud(ctx);
    this.fx.render(ctx);
  }

  private drawCastle(ctx: CanvasRenderingContext2D, team: TeamId): void {
    const c = this.sim.castles[team];
    const total = 27;
    const alive = this.castlePopT[team] >= 0 ? Math.max(0, total - Math.floor(this.castlePopT[team] / 0.03)) : Math.ceil((total * c.hp) / c.maxHp);
    const shake = Math.sin(this.t * 40) * 6 * this.castleShake[team];
    const hue = this.hues[team];
    // castle layout: base rows + two towers
    const spots: [number, number, number][] = [];
    const baseY = 960;
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 4 - (row > 2 ? 1 : 0); i++) spots.push([(i - 1.5 + (row % 2) * 0.5) * 62, baseY - row * 70, 40]);
    }
    for (let k = 0; k < 6; k++) spots.push([-100, baseY - 270 - k * 54, 34]);
    for (let k = 0; k < 6; k++) spots.push([100, baseY - 270 - k * 54, 34]);
    spots.sort((a, b) => b[1] - a[1]);
    // soft castle silhouette behind the bubbles, fading with the castle's health
    if (alive > 0) {
      const a = 0.12 + 0.3 * (alive / total);
      const cx = c.x + shake;
      ctx.save();
      ctx.fillStyle = hsl(hue, 0.75, 0.72, a);
      ctx.strokeStyle = hsl(hue, 0.6, 0.45, a + 0.1);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(cx - 135, baseY - 250, 270, 300, 30);
      for (const sx of [-1, 1]) {
        ctx.roundRect(cx + sx * 100 - 42, baseY - 560, 84, 340, 34);
        ctx.moveTo(cx + sx * 100 - 52, baseY - 545);
        ctx.lineTo(cx + sx * 100, baseY - 625);
        ctx.lineTo(cx + sx * 100 + 52, baseY - 545);
      }
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hsl(hue, 0.5, 0.35, a + 0.15);
      ctx.beginPath();
      ctx.moveTo(cx - 45, baseY + 50);
      ctx.lineTo(cx - 45, baseY - 40);
      ctx.arc(cx, baseY - 40, 45, Math.PI, 0);
      ctx.lineTo(cx + 45, baseY + 50);
      ctx.fill();
      ctx.restore();
    }
    for (let i = 0; i < Math.min(alive, spots.length); i++) {
      const [ox, oy, r] = spots[i];
      const wob = 1 + Math.sin(this.t * 2.5 + i) * 0.04;
      const s = bubbleSprite(Math.round(r * wob), i * 20 + hue, hue, true);
      ctx.drawImage(s as CanvasImageSource, c.x + ox + shake - s.width / 2, oy - s.height / 2);
    }
    // a popped bubble becomes a ring
    if (this.castlePopT[team] >= 0 && alive > 0 && Math.random() < 0.5) {
      const [ox, oy] = spots[Math.max(0, alive - 1)];
      this.particles.add({ kind: 'ring', x: c.x + ox, y: oy, size: 40, max: 0.3, color: 'rgba(255,255,255,0.9)' });
      if (Math.random() < 0.3) sfx.plopp(1);
    }
    // flag
    if (alive > 0) {
      // flag on the inner tower
      const fx = c.x + (team === 'A' ? 100 : -100) + shake;
      const fy = baseY - 690;
      ctx.save();
      ctx.strokeStyle = '#6b4e3a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 70);
      ctx.lineTo(fx, fy - 30);
      ctx.stroke();
      ctx.fillStyle = this.colors[team];
      ctx.beginPath();
      const wave = Math.sin(this.t * 4) * 6;
      const dir = team === 'A' ? 1 : -1;
      ctx.moveTo(fx, fy - 30);
      ctx.quadraticCurveTo(fx + dir * 40, fy - 30 + wave, fx + dir * 75, fy - 15);
      ctx.lineTo(fx, fy + 5);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawFighter(ctx: CanvasRenderingContext2D, f: Fighter): void {
    const v = this.view(f);
    const sp = v.sprite;
    const y = laneY(f.lane);
    const dir = f.team === 'A' ? 1 : -1;
    const walk = f.state === 'march' ? Math.abs(Math.sin(this.t * 9 + v.bob)) * 8 : 0;
    const lunge = ease.outCubic(v.lunge) * 14 * dir;
    ctx.save();
    ctx.translate(f.x + lunge + f.knock, y - walk);
    ctx.rotate(f.state === 'march' ? Math.sin(this.t * 9 + v.bob) * 0.06 : 0);
    ctx.scale(dir, 1);
    ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
    drawBadgeSticker(ctx, sp, dir);
    if (f.hitT > 0) {
      // flash when hit
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = f.hitT * 1.6;
      ctx.drawImage(sp.canvas as CanvasImageSource, -sp.ax, -sp.ay);
    }
    ctx.restore();
    if (f.hp < f.maxHp) {
      const w = f.radius * 1.6;
      const x = f.x - w / 2;
      const by = y - f.radius - 26;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.roundRect(x - 2, by - 2, w + 4, 12, 6);
      ctx.fill();
      ctx.fillStyle = f.hp / f.maxHp > 0.4 ? '#5be37a' : '#ffb03a';
      ctx.beginPath();
      ctx.roundRect(x, by, Math.max(2, (w * Math.max(0, f.hp)) / f.maxHp), 8, 4);
      ctx.fill();
    }
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    // the DOM HUD sits in the corners (menu/title left, camera right), so the bars share the middle
    const gap = 60;
    const barW = Math.max(260, Math.min(520, (this.W - 760 - gap) / 2));
    for (const team of ['A', 'B'] as const) {
      const c = this.sim.castles[team];
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
      const w = ((barW - 40) * c.hp) / c.maxHp;
      ctx.beginPath();
      if (team === 'A') ctx.roundRect(x + 20, 80, Math.max(4, w), 20, 10);
      else ctx.roundRect(x + barW - 20 - Math.max(4, w), 80, Math.max(4, w), 20, 10);
      ctx.fill();
      const st = this.sim.stats[team];
      ctx.fillStyle = '#4a3b6b';
      ctx.font = '600 24px Fredoka, system-ui, sans-serif';
      ctx.textAlign = team === 'A' ? 'right' : 'left';
      ctx.fillText(`${st.written} Zeichen`, team === 'A' ? x + barW - 22 : x + 22, 64);
      ctx.restore();
    }
    if (this.sim.timeLimit > 0) {
      const left = Math.max(0, this.sim.timeLimit - this.sim.time);
      const m = Math.floor(left / 60);
      const s = Math.floor(left % 60);
      ctx.save();
      ctx.font = '700 44px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = left < 30 ? '#ff5470' : '#ffffff';
      ctx.strokeStyle = 'rgba(40,20,60,0.6)';
      ctx.lineWidth = 6;
      ctx.strokeText(`${m}:${String(s).padStart(2, '0')}`, this.W / 2, 170);
      ctx.fillText(`${m}:${String(s).padStart(2, '0')}`, this.W / 2, 170);
      ctx.restore();
    }
  }

  tap(): boolean {
    return false;
  }

  destroy(): void {
    this.views.clear();
  }
}

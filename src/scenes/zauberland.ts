// "Zauberland": a pastel fairy-tale meadow with a castle on a hill. Letters hatch as fable creatures
// (mostly unicorns), princesses or castle parts; see docs/superpowers/specs/2026-11-04-zauberland-design.md.
import type { AnyCanvas } from '../game/canvas.ts';
import { Castle, castleLayout, doorOf, SLOTS, slotRect, type Layout } from '../game/castle/castle.ts';
import { archPath, CastleCache, drawBuildPop, drawGateOpen, windowRect } from '../game/castle/castleDraw.ts';
import { arcPoint, Herd, MIN_HERD, rainbowAlpha } from '../game/castle/herd.ts';
import { MEADOW_Y0, MEADOW_Y1, paintZauberland } from '../game/castle/meadow.ts';
import { sfx } from '../game/audio.ts';
import { fableSprite } from '../game/creatures/fable.ts';
import { makeGenome } from '../game/creatures/genome.ts';
import { princessBust, princessSprite } from '../game/creatures/princess.ts';
import { drawBadgeSticker, type Sprite } from '../game/creatures/sprite.ts';
import { clamp, ease, hsl, lerp, TAU } from '../game/math.ts';
import { hashBytes, mulberry32 } from '../game/rng.ts';
import type { ScannedGlyph, Tier } from '../vision/types.ts';
import { HabitatScene, type Creature, type HabitatDef, type HabitatSave } from './habitat.ts';
import { loadGlyph, saveGlyph, type SavedGlyph, type SceneSave } from './saved.ts';
import type { SceneHost, Snapshot } from './scene.ts';
import { t, tk } from '../i18n/i18n.ts';


interface Cloud {
  x: number;
  y: number;
  s: number;
  v: number;
}
interface Fly {
  x: number;
  y: number;
  phase: number;
  hue: number;
  tx: number;
  ty: number;
}

export const zauberland: HabitatDef = {
  id: 'zauberland',
  archetype: 'fable',
  word: [tk('Wesen'), tk('Wesen')],
  count: [tk('{n} Wesen'), tk('{n} Wesen')],
  makeSprite: fableSprite,
  sortY: true,
  bounds: (W) => ({ x0: 140, x1: W - 140, y0: MEADOW_Y0, y1: MEADOW_Y1 }),

  paint: paintZauberland,

  init(s) {
    const r = mulberry32(13);
    const clouds: Cloud[] = [];
    for (let i = 0; i < 5; i++) clouds.push({ x: r() * s.W, y: 60 + r() * 260, s: 0.6 + r() * 0.6, v: 6 + r() * 10 });
    const flies: Fly[] = [];
    for (let i = 0; i < 4; i++) flies.push({ x: r() * s.W, y: 660 + r() * 260, phase: r() * TAU, hue: [300, 200, 50, 160][i], tx: r() * s.W, ty: 660 + r() * 260 });
    s.amb.clouds = clouds;
    s.amb.flies = flies;
  },

  ambient(s, dt) {
    for (const c of s.amb.clouds as Cloud[]) {
      c.x += c.v * dt;
      if (c.x > s.W + 220) c.x = -220;
    }
    for (const f of s.amb.flies as Fly[]) {
      const dx = f.tx - f.x;
      const dy = f.ty - f.y;
      const d = Math.hypot(dx, dy);
      if (d < 20) {
        f.tx = Math.random() * s.W;
        f.ty = 640 + Math.random() * 300;
      }
      f.x += (dx / (d || 1)) * 60 * dt;
      f.y += (dy / (d || 1)) * 60 * dt + Math.sin(s.t * 6 + f.phase) * 1.1;
    }
  },

  renderBack(s, ctx) {
    for (const c of s.amb.clouds as Cloud[]) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      for (const [ox, oy, rr] of [
        [0, 0, 46],
        [42, -22, 58],
        [92, 0, 44],
        [44, 14, 48],
      ]) {
        ctx.beginPath();
        ctx.arc(c.x + ox * c.s, c.y + oy * c.s, rr * c.s, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    // twinkling stars
    for (let i = 0; i < 6; i++) {
      const a = 0.5 + 0.5 * Math.sin(s.t * 2 + i * 1.7);
      const x = ((i * 337) % 1000) / 1000 * s.W;
      const y = 40 + ((i * 211) % 100) * 2.2;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        const rr = k % 2 ? 2.5 : 9;
        ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
      }
      ctx.fill();
      ctx.restore();
    }
  },

  renderFront(s, ctx) {
    for (const f of s.amb.flies as Fly[]) {
      const flap = Math.abs(Math.sin(s.t * 14 + f.phase));
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.fillStyle = hsl(f.hue, 0.85, 0.72);
      for (const sx of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(sx * 9 * flap, -4, 10 * flap + 2, 12, sx * 0.4, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#4a3a5b';
      ctx.fillRect(-1.5, -10, 3, 16);
      ctx.restore();
    }
  },

  // the Zauberland scene moves everybody itself; this is only the fallback for a bare HabitatScene
  behave(s, c, dt) {
    const B = s.bounds;
    c.depth = lerp(0.72, 1.05, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    c.vx = lerp(c.vx, 0, dt * 5);
  },
};

// ---------------------------------------------------------------------------------------------------------
// The scene: what a letter becomes, the castle, the princesses, riding and the herd flight.

export type ZKind = 'fable' | 'princess' | 'part';

/** r in 0..1: 40 % fable, 30 % princess, 30 % castle part; a full castle only 4:3 fable/princess; no free room → no princess */
export function rollKind(r: number, castle: Castle): ZKind {
  if (castle.roomsFree() === 0) return castle.full() || r < 4 / 7 ? 'fable' : 'part';
  if (castle.full()) return r < 4 / 7 ? 'fable' : 'princess';
  return r < 0.4 ? 'fable' : r < 0.7 ? 'princess' : 'part';
}

const FABLE_NAMES = [tk('Einhorn'), tk('Pegasus'), tk('Glücksdrache')];
const POP_TIME = 0.6;

interface ZState {
  kind: 'fable' | 'princess';
  /** duration of the current state */
  dur: number;
  /** a princess going in plans to look out of her window */
  lookOut: boolean;
  didWindow: boolean;
  /** princess: the fable creature she walks to */
  mount: number | null;
  /** fable: the princess walking to it */
  waitFor: number | null;
  /** the creature should leave but must first come out of the castle / get down */
  wantLeave: boolean;
  seat: Sprite | null;
  bust: AnyCanvas | null;
}

export class ZauberScene extends HabitatScene {
  castle = new Castle();
  herd: Herd;
  /** princess id → id of the fable creature she rides */
  rider = new Map<number, number>();
  /** the letters of castle parts */
  partGlyphs = new Map<number, { glyph: ScannedGlyph; sticker: AnyCanvas }>();
  private zs = new Map<number, ZState>();
  private stickers = new Map<number, AnyCanvas>();
  private pending = new Map<number, ZKind>();
  private pops: { slot: number; t: number }[] = [];
  private cache = new CastleCache();
  private gateOpen = 0;
  private thirdAt: number | null = null;
  private rand: () => number;

  constructor(host: SceneHost, worldW: number, seed = Date.now()) {
    super(zauberland, host, worldW);
    this.rand = mulberry32(seed);
    this.herd = new Herd(mulberry32(seed ^ 0x9e37), this.bounds);
  }

  get layout(): Layout {
    return castleLayout(this.W);
  }

  resize(worldW: number): void {
    super.resize(worldW);
    // also called from the base constructor, before the herd exists
    this.herd?.resize(this.bounds);
  }

  kindOf(c: Creature): 'fable' | 'princess' | undefined {
    return this.zs.get(c.id)?.kind;
  }

  private roll(): ZKind {
    return rollKind(this.rand(), this.castle);
  }

  protected flightTarget(g: ScannedGlyph, snap: Snapshot): { x: number; y: number } {
    const kind = this.roll();
    this.pending.set(g.id, kind);
    const slot = kind === 'part' ? this.castle.nextSlot() : null;
    if (slot === null) return super.flightTarget(g, snap);
    const r = slotRect(this.layout, SLOTS[slot]);
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  protected hatch(g: ScannedGlyph, sticker: AnyCanvas, wish: boolean): Creature | null {
    let kind = this.pending.get(g.id) ?? this.roll();
    this.pending.delete(g.id);
    if (wish && kind === 'part') kind = 'fable';
    return this.add(kind, g, sticker);
  }

  addCreature(g: ScannedGlyph, sticker: AnyCanvas): Creature {
    return this.add('fable', g, sticker)!;
  }

  /** a letter becomes this kind; null when it became a castle part */
  add(kind: ZKind, g: ScannedGlyph, sticker: AnyCanvas): Creature | null {
    if (kind === 'part') {
      const slot = this.castle.nextSlot();
      if (slot !== null) {
        this.buildPart(slot, g, sticker);
        return null;
      }
      kind = 'fable';
    }
    if (kind === 'princess' && this.castle.roomsFree() === 0) kind = 'fable';
    const seed = hashBytes(g.crop.data, 13) ^ g.id;
    const genome = makeGenome(g.score.score, g.score.tier, seed, 'fable');
    const sprite = kind === 'princess' ? princessSprite(genome, sticker) : fableSprite(genome, sticker);
    const B = this.bounds;
    const fl = this.fx.flights.find((f) => f.glyph === g);
    const x = clamp(fl?.to.x ?? lerp(B.x0, B.x1, this.rand()), B.x0, B.x1);
    const y = clamp(fl?.to.y ?? lerp(B.y0, B.y1, this.rand()), B.y0, B.y1);
    const c = this.place({ glyph: g, sticker, genome, sprite }, x, y);
    this.zs.set(c.id, { kind, dur: 1 + this.rand() * 2, lookOut: false, didWindow: false, mount: null, waitFor: null, wantLeave: false, seat: null, bust: null });
    if (kind === 'princess') {
      const room = this.castle.assignRoom(c.id);
      if (room?.built) this.pop(room.slot);
    }
    return c;
  }

  private buildPart(slot: number, g: ScannedGlyph, sticker: AnyCanvas): void {
    this.castle.add(slot, { q: clamp(g.score.score / 100), tier: g.score.tier, glyphId: g.id });
    this.stickers.set(g.id, sticker);
    this.partGlyphs.set(g.id, { glyph: g, sticker });
    this.pop(slot);
  }

  private pop(slot: number): void {
    this.pops.push({ slot, t: 0 });
    const r = slotRect(this.layout, SLOTS[slot]);
    this.particles.burst('puff', r.x + r.w / 2, r.y + r.h, 10, { color: 'rgba(255,255,255,0.85)', size: 28, speed: 150, max: 0.7 });
    this.particles.burst('spark', r.x + r.w / 2, r.y + r.h / 2, 8, { color: '#fff6a8', size: 14, speed: 220, max: 0.8 });
    sfx.plopp();
  }

  /** the population limit marks the oldest as leaving; princesses in the castle and riders first come out */
  protected place(look: Pick<Creature, 'glyph' | 'sticker' | 'painted' | 'genome' | 'sprite'>, x: number, y: number): Creature {
    const c = super.place(look, x, y);
    for (const o of this.creatures) {
      const z = this.zs.get(o.id);
      if (o.leaving && z && !this.mayGo(o, z)) {
        o.leaving = false;
        z.wantLeave = true;
      }
    }
    return c;
  }

  private mayGo(c: Creature, z: ZState): boolean {
    if (z.kind === 'princess') return !this.rider.has(c.id) && !['inside', 'window', 'atDoor'].includes(c.state);
    return !this.ridden(c);
  }

  private ridden(m: Creature): boolean {
    for (const id of this.rider.values()) if (id === m.id) return true;
    return false;
  }

  private go(c: Creature, z: ZState): void {
    z.wantLeave = false;
    if (z.kind === 'princess') this.castle.freeRoom(c.id);
    c.state = 'idle';
    c.leaving = true;
  }

  private byId(id: number | null | undefined): Creature | undefined {
    return id === null || id === undefined ? undefined : this.creatures.find((c) => c.id === id);
  }

  /** a fable creature nobody rides, waits for or takes along in the herd */
  private free(m: Creature): boolean {
    const z = this.zs.get(m.id);
    return !!z && z.kind === 'fable' && !m.leaving && !z.wantLeave && z.waitFor === null && !this.ridden(m) && !this.herd.members.includes(m.id);
  }

  update(dt: number): void {
    super.update(dt);
    for (const p of this.pops) p.t += dt;
    this.pops = this.pops.filter((p) => p.t < POP_TIME);
    this.gateOpen = Math.max(0, this.gateOpen - dt);
    // forget creatures that are gone
    for (const id of [...this.zs.keys()]) {
      if (this.creatures.some((c) => c.id === id)) continue;
      this.zs.delete(id);
      this.rider.delete(id);
      for (const [p, m] of this.rider) if (m === id) this.rider.delete(p);
      this.castle.freeRoom(id);
    }
    const ready = this.creatures.filter((c) => {
      const z = this.zs.get(c.id);
      return z?.kind === 'fable' && !c.leaving && !z.wantLeave;
    });
    if (ready.length < MIN_HERD) this.thirdAt = null;
    else if (this.thirdAt === null) this.thirdAt = this.t;
    const was = this.herd.phase;
    this.herd.update(
      dt,
      ready.map((c) => c.id),
      this.t,
      this.thirdAt,
    );
    if (was !== 'fly' && this.herd.phase === 'fly') sfx.sparkle();
    // after the herd moved on: flyers sit on the bow, riders on their mounts (no frame of lag)
    if (this.herd.phase === 'fly')
      this.herd.members.forEach((id, k) => {
        const c = this.byId(id);
        if (c && !c.leaving) this.flock(c, k, 0);
      });
    for (const [p, m] of this.rider) {
      const pc = this.byId(p);
      const mc = this.byId(m);
      if (pc && mc) {
        pc.x = mc.x;
        pc.y = mc.y;
      }
    }
  }

  protected behave(c: Creature, dt: number): void {
    const z = this.zs.get(c.id);
    if (!z) return super.behave(c, dt);
    const B = this.bounds;
    c.depth = lerp(0.72, 1.05, clamp((c.y - B.y0) / (B.y1 - B.y0)));
    if (z.kind === 'princess') this.behavePrincess(c, z, dt);
    else this.behaveFable(c, z, dt);
  }

  /** walks towards (tx, ty); returns the distance left */
  private walk(c: Creature, tx: number, ty: number, speed: number, dt: number): number {
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return 0;
    const step = Math.min(d, speed * dt);
    c.x += (dx / d) * step;
    c.y += (dy / d) * step;
    c.vx = (dx / d) * speed;
    if (Math.abs(dx) > 4) c.facing = dx >= 0 ? 1 : -1;
    c.lift = Math.abs(Math.sin(c.age * 9)) * 4;
    c.rot = Math.sin(c.age * 9) * 0.04;
    return d - step;
  }

  private set(c: Creature, state: string, dur = 0): void {
    c.state = state;
    c.stateT = 0;
    const z = this.zs.get(c.id);
    if (z) z.dur = dur;
  }

  private behavePrincess(c: Creature, z: ZState, dt: number): void {
    const B = this.bounds;
    const door = { x: doorOf(this.layout).x, y: B.y0 };
    if (this.rider.has(c.id)) {
      const mount = this.byId(this.rider.get(c.id));
      if (!mount || mount.leaving || z.wantLeave || c.stateT > z.dur) return this.dismount(c);
      c.state = 'riding';
      c.x = mount.x;
      c.y = mount.y;
      c.depth = mount.depth;
      c.lift = mount.lift;
      c.facing = mount.facing;
      return;
    }
    if (z.wantLeave) {
      if (c.state === 'inside' || c.state === 'window') this.set(c, 'atDoor', 1.2);
      if (c.state === 'atDoor' && c.stateT < z.dur) return this.standAtDoor(c, door);
      return this.go(c, z);
    }
    if (c.state !== 'walk' && c.state !== 'toDoor' && c.state !== 'toMount') {
      c.lift = Math.max(0, c.lift - dt * 40);
      c.rot = 0;
      c.vx = lerp(c.vx, 0, Math.min(1, dt * 5));
    }
    switch (c.state) {
      case 'idle':
        if (c.stateT > z.dur) this.choose(c, z);
        break;
      case 'walk':
        if (this.walk(c, c.tx, c.ty, 70, dt) < 8 || c.stateT > 10) this.set(c, 'idle', 2 + this.rand() * 3);
        break;
      case 'toDoor':
        if (this.walk(c, door.x, door.y, 80, dt) < 10) {
          c.x = door.x;
          c.y = door.y;
          this.gateOpen = 0.8;
          this.set(c, 'inside', 1 + this.rand() * 2);
        } else if (c.stateT > 20) this.set(c, 'idle', 1);
        break;
      case 'inside':
        if (c.stateT > z.dur) {
          if (z.lookOut && !z.didWindow) this.set(c, 'window', 4 + this.rand() * 3);
          else this.set(c, 'atDoor', 2 + this.rand());
        }
        break;
      case 'window':
        if (c.stateT > z.dur) {
          z.didWindow = true;
          this.set(c, 'inside', 1 + this.rand());
        }
        break;
      case 'atDoor':
        this.standAtDoor(c, door);
        if (c.stateT > z.dur) {
          this.gateOpen = 0.6;
          this.newTarget(c, 120);
          c.ty = Math.max(c.ty, B.y0 + 60);
          this.set(c, 'walk');
        }
        break;
      case 'toMount': {
        const m = this.byId(z.mount);
        const mz = m && this.zs.get(m.id);
        if (!m || !mz || m.leaving || mz.wantLeave || mz.waitFor !== c.id || this.herd.members.includes(m.id)) {
          if (mz && mz.waitFor === c.id) mz.waitFor = null;
          z.mount = null;
          this.set(c, 'idle', 1 + this.rand() * 2);
          break;
        }
        if (this.walk(c, m.x - m.facing * 40, m.y + 4, 85, dt) < 12) {
          mz.waitFor = null;
          z.mount = null;
          this.rider.set(c.id, m.id);
          this.set(c, 'riding', 10 + this.rand() * 8);
          this.set(m, 'ridden');
          this.newTarget(m, 120);
          c.x = m.x;
          c.y = m.y;
          sfx.boing();
          this.particles.burst('heart', m.x, m.y - m.sprite.radius, 4, { color: '#ff6fa3', size: 20, speed: 90, max: 0.9, gravity: -60 });
        } else if (c.stateT > 15) {
          mz.waitFor = null;
          z.mount = null;
          this.set(c, 'idle', 1);
        }
        break;
      }
      default:
        this.set(c, 'idle', 1);
    }
  }

  private standAtDoor(c: Creature, door: { x: number; y: number }): void {
    c.state = 'atDoor';
    c.x = door.x;
    c.y = door.y;
    c.lift = 0;
    this.gateOpen = Math.max(this.gateOpen, 0.3);
  }

  private choose(c: Creature, z: ZState): void {
    const r = this.rand();
    const mounts = this.creatures.filter((m) => this.free(m));
    if (mounts.length && r < 0.3) {
      const m = mounts.reduce((a, b) => (Math.hypot(a.x - c.x, a.y - c.y) < Math.hypot(b.x - c.x, b.y - c.y) ? a : b));
      z.mount = m.id;
      this.zs.get(m.id)!.waitFor = c.id;
      this.set(m, 'wait');
      this.set(c, 'toMount');
    } else if (r < (mounts.length ? 0.65 : 0.5) && this.castle.roomOf(c.id) !== null) {
      z.lookOut = this.rand() < 0.75;
      z.didWindow = false;
      this.set(c, 'toDoor');
    } else {
      this.newTarget(c, 100);
      this.set(c, 'walk');
    }
  }

  private dismount(p: Creature): void {
    const m = this.byId(this.rider.get(p.id));
    this.rider.delete(p.id);
    const B = this.bounds;
    if (m) {
      p.x = clamp(m.x - m.facing * 60, B.x0, B.x1);
      p.y = clamp(m.y + 6, B.y0, B.y1);
      if (m.state === 'ridden') this.set(m, 'idle', 1);
    }
    p.lift = 0;
    this.set(p, 'idle', 1 + this.rand() * 2);
  }

  private behaveFable(c: Creature, z: ZState, dt: number): void {
    const B = this.bounds;
    if (z.wantLeave) {
      for (const [p, m] of [...this.rider]) if (m === c.id) this.dismount(this.byId(p)!);
      return this.go(c, z);
    }
    const k = this.herd.members.indexOf(c.id);
    if (k >= 0 && this.herd.phase !== 'idle') return this.flock(c, k, dt);
    if (c.state.startsWith('herd')) this.set(c, 'idle', 1 + this.rand());
    const winged = c.genome.variant !== 0;
    const fast = lerp(60, 95, c.genome.q);
    if (this.ridden(c)) {
      if (c.state !== 'ridden') this.set(c, 'ridden');
      if (this.walk(c, c.tx, c.ty, fast * 1.3, dt) < 15) this.newTarget(c, 120);
      c.lift = Math.abs(Math.sin(c.age * 7)) * 10;
      return;
    }
    switch (c.state) {
      case 'wait':
        c.lift = Math.max(0, c.lift - dt * 60);
        c.rot = 0;
        if (z.waitFor === null || c.stateT > 16) {
          z.waitFor = null;
          this.set(c, 'idle', 1);
        }
        break;
      case 'walk':
      case 'hop':
        if (this.walk(c, c.tx, c.ty, fast, dt) < 15 || c.stateT > 9) this.set(c, 'idle', 1.5 + this.rand() * 3);
        else if (c.state === 'hop') c.lift = Math.abs(Math.sin(c.stateT * 6)) * 36;
        break;
      case 'flutter':
        // pegasus and dragon flap up for a moment
        c.lift = Math.sin(Math.min(1, c.stateT / z.dur) * Math.PI) * 70;
        if (c.stateT > z.dur) this.set(c, 'idle', 1 + this.rand() * 2);
        break;
      default:
        c.lift = Math.max(0, c.lift - dt * 300);
        c.rot = 0;
        c.vx = lerp(c.vx, 0, Math.min(1, dt * 5));
        if (c.stateT > z.dur) {
          const r = this.rand();
          if (winged && r < 0.25) this.set(c, 'flutter', 1.6);
          else {
            c.tx = clamp(c.x + (this.rand() - 0.5) * 700, B.x0, B.x1);
            c.ty = clamp(c.y + (this.rand() - 0.5) * 140, B.y0, B.y1);
            this.set(c, r < 0.45 && c.genome.q > 0.6 ? 'hop' : 'walk');
          }
        }
    }
    c.x = clamp(c.x, B.x0 - 40, B.x1 + 40);
    c.y = clamp(c.y, B.y0, B.y1);
  }

  /** the herd: gather at one point, fly the bow together, land */
  private flock(c: Creature, k: number, dt: number): void {
    const h = this.herd;
    if (h.phase === 'gather') {
      c.state = 'herdGather';
      const gx = h.gatherPoint.x + ((k % 4) - 1.5) * 80;
      const gy = h.gatherPoint.y + Math.floor(k / 4) * 40 - 20;
      if (this.walk(c, gx, gy, 120, dt) < 25) {
        h.arrived(c.id);
        c.facing = h.gatherPoint.x < (this.bounds.x0 + this.bounds.x1) / 2 ? 1 : -1;
        c.lift = Math.abs(Math.sin(c.age * 5)) * 8;
      }
    } else if (h.phase === 'fly' && h.arc) {
      c.state = 'herdFly';
      const p = arcPoint(h.arc, h.memberU(k));
      c.x = p.x;
      c.y = p.y;
      c.lift = 0;
      c.facing = h.arc.x1 >= h.arc.x0 ? 1 : -1;
      c.rot = -p.angle * 0.35 * c.facing;
      c.depth = 0.85;
      if (c.genome.variant === 0 && Math.random() < dt * 25) {
        const col = ['#ff5a5a', '#ffe14a', '#5fd36a', '#4fb3ff', '#b06aff'][Math.floor(Math.random() * 5)];
        this.particles.add({ kind: 'spark', x: c.x - c.facing * c.sprite.radius * 0.5, y: c.y + c.sprite.radius * 0.6, size: 8 + Math.random() * 8, max: 0.7, color: col });
      }
    } else {
      c.state = 'herdLand';
      c.rot = lerp(c.rot, 0, Math.min(1, dt * 6));
      c.lift = Math.abs(Math.sin(h.t * 4)) * 10 * Math.max(0, 1 - h.t / 2);
    }
  }

  protected renderCreatures(ctx: CanvasRenderingContext2D, list: Creature[]): void {
    const L = this.layout;
    this.drawRainbow(ctx);
    const hide = this.pops.map((p) => p.slot);
    ctx.drawImage(this.cache.get(this.castle, this.W, this.stickers, hide) as CanvasImageSource, 0, 0);
    for (const p of this.pops) {
      const part = this.castle.part(p.slot);
      if (part) drawBuildPop(ctx, this.castle, L, part, this.stickers, Math.max(0.01, ease.outBack(clamp(p.t / POP_TIME))));
    }
    if (this.gateOpen > 0) drawGateOpen(ctx, L, Math.min(1, this.gateOpen * 4));
    for (const c of list) if (c.state === 'window') this.drawWindow(ctx, c);
    // flying creatures above everybody on the meadow
    const order = [...list.filter((c) => c.state !== 'herdFly'), ...list.filter((c) => c.state === 'herdFly')];
    for (const c of order) {
      const z = this.zs.get(c.id);
      if (z?.kind === 'princess' && (c.state === 'inside' || c.state === 'window' || this.rider.has(c.id))) continue;
      this.drawCreature(ctx, c);
      if (z?.kind === 'fable') for (const [p, m] of this.rider) if (m === c.id) this.drawRider(ctx, c, this.byId(p));
    }
  }

  private drawRider(ctx: CanvasRenderingContext2D, m: Creature, p: Creature | undefined): void {
    if (!p) return;
    const z = this.zs.get(p.id)!;
    z.seat ??= princessSprite(p.genome, p.sticker ?? null, 'sit');
    const seat = z.seat;
    const sp = m.sprite;
    const s = m.depth * ease.outBack(m.spawn);
    ctx.save();
    ctx.translate(m.x, m.y - m.lift);
    ctx.rotate(m.rot);
    ctx.scale(m.face * s, s);
    ctx.translate(sp.top.x - sp.ax, sp.top.y - sp.ay);
    ctx.scale(0.72, 0.72);
    ctx.drawImage(seat.canvas as CanvasImageSource, -seat.ax, -seat.ay);
    drawBadgeSticker(ctx, seat, m.face);
    ctx.restore();
  }

  private drawWindow(ctx: CanvasRenderingContext2D, c: Creature): void {
    const room = this.castle.roomOf(c.id);
    if (room === null) return;
    const z = this.zs.get(c.id)!;
    const wr = windowRect(this.layout, room);
    const r = wr.w * 0.36;
    z.bust ??= princessBust(c.genome, r);
    const b = z.bust;
    // rises into the window, waves, and sinks back down
    const up = clamp(c.stateT / 0.5) * clamp((z.dur - c.stateT) / 0.5);
    ctx.save();
    ctx.clip(archPath(wr));
    ctx.translate(wr.x + wr.w / 2, wr.y + wr.h * 0.42 + (1 - up) * wr.h);
    ctx.rotate(Math.sin(c.stateT * 3) * 0.08);
    ctx.drawImage(b as CanvasImageSource, -b.width / 2, -r * 1.5);
    ctx.restore();
  }

  private drawRainbow(ctx: CanvasRenderingContext2D): void {
    const rb = this.herd.rainbow;
    if (!rb) return;
    const alpha = rainbowAlpha(this.t - rb.born);
    if (alpha <= 0) return;
    const flying = this.herd.phase === 'fly' && this.herd.arc === rb.arc;
    const uMax = flying ? this.herd.memberU(0) : 1;
    if (uMax <= 0) return;
    const cols = ['#ff5a5a', '#ff9f3a', '#ffe14a', '#5fd36a', '#4fb3ff', '#6a6cff', '#b06aff'];
    const bw = 13;
    const dir = rb.arc.x1 >= rb.arc.x0 ? 1 : -1;
    ctx.save();
    ctx.globalAlpha = 0.72 * alpha;
    ctx.lineCap = 'round';
    ctx.lineWidth = bw + 1;
    cols.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.beginPath();
      const n = Math.max(2, Math.ceil(60 * uMax));
      for (let j = 0; j <= n; j++) {
        const p = arcPoint(rb.arc, (j / n) * uMax);
        // offset along the bow's normal so the bands stay parallel; red outside
        const off = (i - 3) * bw * dir;
        const x = p.x + Math.sin(p.angle) * off;
        const y = p.y - Math.cos(p.angle) * off;
        if (j === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  tap(x: number, y: number): boolean {
    for (const c of this.creatures) {
      if (c.state !== 'window') continue;
      const room = this.castle.roomOf(c.id);
      const wr = room !== null ? windowRect(this.layout, room) : null;
      if (wr && x >= wr.x && x <= wr.x + wr.w && y >= wr.y && y <= wr.y + wr.h) {
        this.showCreature(c);
        return true;
      }
    }
    if (super.tap(x, y)) return true;
    for (const p of this.castle.parts) {
      if (p.glyphId === null) continue;
      const r = slotRect(this.layout, SLOTS[p.slot]);
      const hit = this.partGlyphs.get(p.glyphId);
      if (hit && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        sfx.boing();
        this.host.showCard({ glyph: hit.glyph, sticker: hit.sticker, name: t('Burgteil') });
        return true;
      }
    }
    return false;
  }

  protected showCreature(c: Creature): void {
    if (!c.glyph || !c.sticker) return;
    const kind = this.zs.get(c.id)?.kind;
    const name = kind === 'princess' ? t('Prinzessin') : t(FABLE_NAMES[c.genome.variant] ?? FABLE_NAMES[0]);
    this.host.showCard({ glyph: c.glyph, sticker: c.sticker, name });
  }

  /** what is here right now, e.g. "🦄 5 · 👸 3 · 🏰 7/18" */
  countText(): string {
    const here = this.creatures.filter((c) => !c.leaving);
    const princesses = here.filter((c) => this.zs.get(c.id)?.kind === 'princess').length;
    return `🦄 ${here.length - princesses} · 👸 ${princesses} · 🏰 ${this.castle.parts.length}/${SLOTS.length}`;
  }

  count(): number {
    return super.count() + this.castle.parts.filter((p) => p.glyphId !== null).length;
  }

  async saveState(): Promise<SceneSave | null> {
    const living = this.creatures.filter((c) => !c.leaving && c.glyph);
    const away = this.album.length + this.awayBefore;
    const lettered = this.castle.parts.filter((p) => p.glyphId !== null);
    if (!living.length && !away && !lettered.length) return null;
    const n = this.count();
    const summary = t(this.def.count[n === 1 ? 0 : 1], { n });
    const creatures = await Promise.all(
      living.map(async (c) => ({
        glyph: await saveGlyph(c.glyph!),
        x: Math.round(c.x),
        y: Math.round(c.y),
        facing: c.facing,
        kind: this.zs.get(c.id)?.kind ?? 'fable',
        room: this.castle.roomOf(c.id),
      })),
    );
    const parts = await Promise.all(
      this.castle.parts.map(async (p) => {
        const pg = p.glyphId !== null ? this.partGlyphs.get(p.glyphId) : undefined;
        return { slot: p.slot, q: p.q, tier: p.tier, glyph: pg ? await saveGlyph(pg.glyph) : null };
      }),
    );
    const state: ZauberSave = {
      creatures,
      parts,
      away,
      practiceIndex: this.practiceIndex,
      practiceDone: this.practiceDone,
      goalReached: this.goalReached,
      written: this.written,
      wishesFreed: this.wishesFreed,
    };
    return { state, summary };
  }

  /** everybody comes back standing on the meadow (nobody inside, riding or flying); princesses keep their rooms */
  async restoreState(raw: unknown): Promise<void> {
    const s = raw as ZauberSave;
    const castle = new Castle();
    castle.parts = [];
    for (const p of s.parts ?? []) {
      let glyphId: number | null = null;
      if (p.glyph) {
        const { glyph, sticker } = await loadGlyph(p.glyph);
        glyphId = glyph.id;
        this.stickers.set(glyph.id, sticker);
        this.partGlyphs.set(glyph.id, { glyph, sticker });
      }
      castle.add(p.slot, { q: p.q, tier: p.tier, glyphId });
    }
    if (!castle.built(0)) castle.parts = new Castle().parts;
    this.castle = castle;
    const loaded = await Promise.all(s.creatures.map((c) => loadGlyph(c.glyph)));
    const princesses: { c: Creature; room: number | null }[] = [];
    s.creatures.forEach((sc, i) => {
      const c = this.add(sc.kind === 'princess' ? 'princess' : 'fable', loaded[i].glyph, loaded[i].sticker);
      if (!c) return;
      this.settle(c, sc);
      if (this.zs.get(c.id)?.kind === 'princess') princesses.push({ c, room: sc.room });
    });
    // rooms only once everybody is back, so nobody takes another princess's room on the way
    for (const { c } of princesses) castle.freeRoom(c.id);
    const later: Creature[] = [];
    for (const { c, room } of princesses) {
      if (room !== null && castle.built(room) && SLOTS[room].kind === 'room' && !castle.owner.has(room)) castle.owner.set(room, c.id);
      else later.push(c);
    }
    for (const c of later) castle.assignRoom(c.id);
    this.pops = [];
    this.awayBefore = s.away;
    this.practiceIndex = s.practiceIndex;
    this.practiceDone = s.practiceDone;
    this.goalReached = s.goalReached;
    this.written = s.written;
    this.wishesFreed = s.wishesFreed;
  }
}

export interface ZauberSave extends Omit<HabitatSave, 'creatures'> {
  creatures: { glyph: SavedGlyph; x: number; y: number; facing: 1 | -1; kind: 'fable' | 'princess'; room: number | null }[];
  parts: { slot: number; q: number; tier: Tier; glyph: SavedGlyph | null }[];
}

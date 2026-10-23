// "Türme bauen" simulation (pure logic, no rendering): the portal queue, alien deliveries with gags,
// clones, idle mischief, tower heights and the winner.
import { clamp, ease, lerp, TAU } from '../math.ts';
import type { Rand } from '../rng.ts';
import { GAG_BY_ID, GAGS, type Deco, type GagDef, type MischiefInfo, type MischiefKind } from './gags.ts';
import { blockStars, pxPerMetre, slotPos, TOWER, towerWidth, towerXs } from './rules.ts';

export type BlockState = 'portal' | 'emerging' | 'waiting' | 'carried' | 'placed' | 'poof';

export interface TowerBlock {
  id: number;
  glyphId: number;
  player: number;
  score: number;
  stars: number;
  metres: number;
  /** height in px */
  h: number;
  state: BlockState;
  /** seconds in the current state */
  t: number;
  /** waiting place next to the portal, -1 if none */
  slot: number;
  /** alien that takes care of it (0 = none yet) */
  alien: number;
  /** resting tilt of crooked blocks (radians) */
  tilt: number;
  deco: Deco[];
  scribble: boolean;
  /** centre and scale while it is not part of a tower (without gag offsets) */
  x: number;
  y: number;
  s: number;
}

export interface Tower {
  player: number;
  x: number;
  blocks: TowerBlock[];
  metres: number;
  /** an alien pushes the tower: wobble strength 0..1 and direction */
  shake: number;
  shakeDir: number;
}

export type AlienState = 'enter' | 'park' | 'idle' | 'mischief' | 'fetch' | 'grab' | 'carry' | 'drop' | 'cheer';

export interface Flight {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  dur: number;
  u: number;
  arc: number;
}

export interface Job {
  block: TowerBlock;
  tower: number;
  gag: GagDef | null;
  /** seconds since the gag started, -1 before */
  gagT: number;
  jumped: boolean;
  /** distance the block is lowered onto the tower */
  dropDist: number;
  dropDur: number;
  landed: boolean;
}

export interface Mischief {
  kind: MischiefKind;
  t: number;
  phase: number;
  phaseT: number;
  phaseDur: number;
  tower: number;
  side: number;
  pts: { x: number; y: number }[];
  /** icecream: seconds when the scoop falls down, -1 = it stays */
  scoopAt: number;
  scoopGone: boolean;
}

export interface Alien {
  id: number;
  /** 1 = Zork, 2.. = clones */
  n: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: AlienState;
  /** seconds in the current state */
  t: number;
  flight: Flight | null;
  job: Job | null;
  mischief: Mischief | null;
  lastMischief: MischiefKind | null;
  idleFor: number;
  /** the alien it was cloned from (0 = the original) */
  cloneOf: number;
  born: number;
}

export type TowerEvent =
  | { type: 'emerge'; block: TowerBlock }
  | { type: 'clone'; alien: Alien; from: Alien }
  | { type: 'assign'; alien: Alien; block: TowerBlock; interrupted: MischiefKind | null }
  | { type: 'grab'; alien: Alien; block: TowerBlock }
  | { type: 'gag'; alien: Alien; gag: GagDef }
  | { type: 'land'; alien: Alien; block: TowerBlock; tower: number }
  | { type: 'scribble'; block: TowerBlock }
  | { type: 'poof'; block: TowerBlock }
  | { type: 'mischief'; alien: Alien; kind: MischiefKind }
  | { type: 'pushBounce'; alien: Alien; tower: number }
  | { type: 'scoopDrop'; alien: Alien }
  | { type: 'win'; tower: number | null; reason: 'goal' | 'time' };

export interface PlayerStats {
  /** all letters, also scribbles */
  written: number;
  blocks: number;
  scoreSum: number;
  best: { glyphId: number; score: number } | null;
}

/** a block as it is kept in a saved game */
export interface SavedBlock {
  id: number;
  glyphId: number;
  player: number;
  score: number;
  stars: number;
  metres: number;
  tilt: number;
  deco: Deco[];
  scribble: boolean;
}

/** everything needed to continue a game later (plain data) */
export interface TowerSave {
  towers: { metres: number; blocks: SavedBlock[] }[];
  /** blocks still on their way: they come out of the portal again */
  pending: SavedBlock[];
  stats: PlayerStats[];
  time: number;
  timeLimit: number;
  clones: number;
  gags: number;
  aliens: number;
  nextId: number;
}

const MISCHIEF: MischiefKind[] = ['push', 'icecream', 'fly', 'clean', 'nap', 'wave', 'music'];

export class TowerSim {
  towers: Tower[];
  aliens: Alien[] = [];
  /** blocks that are not (yet) part of a tower */
  blocks: TowerBlock[] = [];
  /** blocks still inside the portal */
  queue: TowerBlock[] = [];
  stats: PlayerStats[];
  /** metres to the finish line */
  readonly goal: number;
  readonly ppm: number;
  time = 0;
  timeLimit: number;
  over: { winner: number | null; reason: 'goal' | 'time' } | null = null;
  /** the scene plays a sequence: nothing comes out of the portal */
  paused = false;
  events: TowerEvent[] = [];
  clones = 0;
  gags = 0;
  /** tests: always play this gag */
  forceGag: string | null = null;
  worldW: number;
  /** width of a tower in px (narrower with many towers) */
  towerW: number;
  private rand: Rand;
  private nextId = 1;
  private emergeCD = 0;
  private recentGags: string[] = [];

  constructor(players: number, goalMetres: number, worldW: number, timeLimitSec = 0, rand: Rand = Math.random) {
    this.worldW = worldW;
    this.goal = goalMetres;
    this.ppm = pxPerMetre(goalMetres);
    this.timeLimit = timeLimitSec;
    this.rand = rand;
    const xs = towerXs(players, worldW);
    this.towerW = towerWidth(players, worldW);
    this.towers = xs.map((x, i) => ({ player: i, x, blocks: [], metres: 0, shake: 0, shakeDir: 1 }));
    this.stats = xs.map(() => ({ written: 0, blocks: 0, scoreSum: 0, best: null }));
  }

  resize(worldW: number): void {
    this.worldW = worldW;
    const xs = towerXs(this.towers.length, worldW);
    this.towerW = towerWidth(this.towers.length, worldW);
    this.towers.forEach((t, i) => (t.x = xs[i]));
  }

  drain(): TowerEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  portalPos(): { x: number; y: number } {
    return { x: this.worldW / 2, y: TOWER.portal.y };
  }

  topY(tower: number): number {
    return TOWER.groundY - this.towers[tower].metres * this.ppm;
  }

  /** where the UFO hovers to set a block onto a tower */
  dropPoint(tower: number, b: TowerBlock): { x: number; y: number } {
    return { x: this.towers[tower].x, y: Math.max(80, this.topY(tower) - b.h - TOWER.hang - 50) };
  }

  alienById(id: number): Alien | undefined {
    return this.aliens.find((a) => a.id === id);
  }

  // ---------------------------------------------------------------- input

  /** A letter came through the portal: player index, beauty score, glyph id. */
  addBlock(player: number, score: number, glyphId: number): TowerBlock | null {
    if (this.over) return null;
    const st = this.stats[player];
    st.written++;
    const scribble = score < TOWER.minScore;
    const stars = scribble ? 0 : blockStars(score);
    const metres = TOWER.metres[stars];
    if (!scribble) {
      st.blocks++;
      st.scoreSum += score;
      if (!st.best || score > st.best.score) st.best = { glyphId, score };
    }
    const p = this.portalPos();
    const b: TowerBlock = {
      id: this.nextId++,
      glyphId,
      player,
      score,
      stars,
      metres,
      h: Math.max(2, metres) * this.ppm,
      state: 'portal',
      t: 0,
      slot: -1,
      alien: 0,
      tilt: stars === 1 ? (this.rand() - 0.5) * 0.12 : stars === 2 ? (this.rand() - 0.5) * 0.05 : 0,
      deco: [],
      scribble,
      x: p.x,
      y: p.y,
      s: 0,
    };
    this.queue.push(b);
    this.blocks.push(b);
    return b;
  }

  exportState(): TowerSave {
    const saved = (b: TowerBlock): SavedBlock => ({
      id: b.id,
      glyphId: b.glyphId,
      player: b.player,
      score: b.score,
      stars: b.stars,
      metres: b.metres,
      tilt: b.tilt,
      deco: [...b.deco],
      scribble: b.scribble,
    });
    return structuredClone({
      towers: this.towers.map((t) => ({ metres: t.metres, blocks: t.blocks.map(saved) })),
      pending: this.blocks.filter((b) => b.state !== 'poof' && b.state !== 'placed' && !b.scribble).map(saved),
      stats: this.stats,
      time: this.time,
      timeLimit: this.timeLimit,
      clones: this.clones,
      gags: this.gags,
      aliens: this.aliens.length,
      nextId: this.nextId,
    });
  }

  /** Continues a saved game: the towers stand, Zork and his clones wait, blocks on their way come again. */
  importState(s: TowerSave, glyphId: (id: number) => number = (id) => id): void {
    const p = this.portalPos();
    const block = (b: SavedBlock, state: BlockState): TowerBlock => ({
      ...structuredClone(b),
      glyphId: glyphId(b.glyphId),
      h: Math.max(2, b.metres) * this.ppm,
      state,
      t: 0,
      slot: -1,
      alien: 0,
      x: p.x,
      y: p.y,
      s: state === 'placed' ? 1 : 0,
    });
    this.towers.forEach((t, i) => {
      const st = s.towers[i];
      t.metres = st?.metres ?? 0;
      t.blocks = (st?.blocks ?? []).map((b) => ({ ...block(b, 'placed'), x: t.x }));
    });
    this.blocks = s.pending.map((b) => block(b, 'portal'));
    this.queue = [...this.blocks];
    this.stats = this.towers.map((_, i) => structuredClone(s.stats[i]) ?? { written: 0, blocks: 0, scoreSum: 0, best: null });
    for (const st of this.stats) if (st.best) st.best.glyphId = glyphId(st.best.glyphId);
    this.time = s.time;
    this.timeLimit = s.timeLimit;
    this.clones = s.clones;
    this.gags = s.gags;
    this.nextId = Math.max(this.nextId, s.nextId);
    this.over = null;
    this.events = [];
    this.aliens = [];
    for (let i = 0; i < Math.max(1, Math.min(TOWER.maxAliens, s.aliens)); i++) {
      const a = this.addAlien(p.x, p.y, i ? 1 : 0);
      const spot = this.parkSpot(a);
      a.x = spot.x;
      a.y = spot.y;
      this.goIdle(a);
    }
  }

  /** Zork flies out of the portal (the intro calls this; otherwise the first block does). */
  enterFirst(): Alien {
    const p = this.portalPos();
    const a = this.addAlien(p.x, p.y, 0);
    a.state = 'enter';
    const spot = this.parkSpot(a);
    this.fly(a, spot.x, spot.y, 60);
    return a;
  }

  // ---------------------------------------------------------------- update

  step(dt: number): void {
    if (!this.over) this.time += dt;
    if (!this.over && this.timeLimit > 0 && this.time >= this.timeLimit) this.timeUp();
    this.emerge(dt);
    for (const b of this.blocks) {
      b.t += dt;
      if (b.state === 'emerging' && b.t >= TOWER.emergeTime) this.setState(b, 'waiting');
      else if (b.state === 'waiting' && b.scribble && b.t >= 1.2) {
        this.setState(b, 'poof');
        b.slot = -1;
        this.events.push({ type: 'scribble', block: b });
      }
    }
    this.blocks = this.blocks.filter((b) => !(b.state === 'poof' && b.t > 1.2));
    if (!this.paused && !this.over) this.dispatch();
    for (const a of [...this.aliens]) this.updateAlien(a, dt);
    for (const t of this.towers) t.shake = Math.max(0, t.shake - dt * 1.5);
    this.updateBlockViews();
  }

  private setState(b: TowerBlock, s: BlockState): void {
    b.state = s;
    b.t = 0;
  }

  private emerge(dt: number): void {
    this.emergeCD -= dt;
    if (this.paused || this.over || !this.queue.length || this.emergeCD > 0) return;
    const used = new Set(this.blocks.filter((b) => b.slot >= 0).map((b) => b.slot));
    let slot = -1;
    for (let i = 0; i < TOWER.slots; i++) {
      if (!used.has(i)) {
        slot = i;
        break;
      }
    }
    if (slot < 0) return;
    const b = this.queue.shift()!;
    b.slot = slot;
    this.setState(b, 'emerging');
    this.emergeCD = TOWER.emergeGap;
    this.events.push({ type: 'emerge', block: b });
  }

  private isFree(a: Alien): boolean {
    return a.state === 'idle' || a.state === 'mischief' || a.state === 'park' || a.state === 'enter';
  }

  /** Every block next to the portal gets an alien: a free one, or a clone of a busy one. */
  private dispatch(): void {
    for (const b of this.blocks) {
      if (b.scribble || b.alien || (b.state !== 'emerging' && b.state !== 'waiting')) continue;
      const at = slotPos(b.slot, this.worldW);
      const dist = (a: Alien) => Math.hypot(a.x - at.x, a.y - at.y);
      const nearest = (list: Alien[]) => list.reduce((m, a) => (dist(a) < dist(m) ? a : m));
      const free = this.aliens.filter((a) => this.isFree(a));
      let a: Alien | null = null;
      if (free.length) a = nearest(free);
      else if (!this.aliens.length) a = this.enterFirst();
      else if (this.aliens.length < TOWER.maxAliens) {
        const busy = this.aliens.filter((o) => o.state !== 'cheer');
        if (busy.length) a = this.clone(nearest(busy));
      }
      if (!a) return;
      this.assign(a, b);
    }
  }

  private addAlien(x: number, y: number, cloneOf: number): Alien {
    const a: Alien = {
      id: this.nextId++,
      n: this.aliens.length + 1,
      x,
      y,
      vx: 0,
      vy: 0,
      state: 'idle',
      t: 0,
      flight: null,
      job: null,
      mischief: null,
      lastMischief: null,
      idleFor: 1,
      cloneOf,
      born: this.time,
    };
    this.aliens.push(a);
    return a;
  }

  private clone(src: Alien): Alien {
    const c = this.addAlien(src.x + (this.rand() < 0.5 ? -36 : 36), src.y - 12, src.id);
    this.clones++;
    this.events.push({ type: 'clone', alien: c, from: src });
    return c;
  }

  private pickGag(b: TowerBlock): GagDef | null {
    if (this.forceGag) return GAG_BY_ID.get(this.forceGag) ?? null;
    if (this.rand() >= TOWER.gagChance) return null;
    const ok = GAGS.filter((g) => (g.minStars ?? 0) <= b.stars && !this.recentGags.includes(g.id));
    if (!ok.length) return null;
    const g = ok[Math.floor(this.rand() * ok.length) % ok.length];
    this.recentGags.push(g.id);
    if (this.recentGags.length > 14) this.recentGags.shift();
    return g;
  }

  private assign(a: Alien, b: TowerBlock): void {
    const interrupted = a.state === 'mischief' && a.mischief ? a.mischief.kind : null;
    a.mischief = null;
    b.alien = a.id;
    a.job = { block: b, tower: b.player, gag: this.pickGag(b), gagT: -1, jumped: false, dropDist: 0, dropDur: TOWER.dropTime, landed: false };
    a.state = 'fetch';
    a.t = 0;
    const p = this.pickupPoint(b);
    this.fly(a, p.x, p.y, 40);
    this.events.push({ type: 'assign', alien: a, block: b, interrupted });
  }

  private pickupPoint(b: TowerBlock): { x: number; y: number } {
    const s = slotPos(b.slot, this.worldW);
    return { x: s.x, y: Math.max(70, s.y - (b.h * TOWER.waitScale) / 2 - TOWER.hang - 50) };
  }

  private fly(a: Alien, x: number, y: number, arc: number): void {
    const d = Math.hypot(x - a.x, y - a.y);
    a.flight = { x0: a.x, y0: a.y, x1: x, y1: y, dur: clamp(d / TOWER.flySpeed, TOWER.flyMin, TOWER.flyMax), u: 0, arc };
  }

  /** moves along the flight; true when it has arrived */
  private advance(a: Alien, dt: number, factor = 1): boolean {
    const f = a.flight;
    if (!f) return true;
    f.u = Math.min(1, f.u + (dt * factor) / f.dur);
    const e = ease.inOutCubic(f.u);
    a.x = lerp(f.x0, f.x1, e);
    a.y = lerp(f.y0, f.y1, e) - Math.sin(Math.PI * f.u) * f.arc;
    return f.u >= 1;
  }

  private updateAlien(a: Alien, dt: number): void {
    const px = a.x;
    const py = a.y;
    a.t += dt;
    switch (a.state) {
      case 'enter':
      case 'park':
        if (this.advance(a, dt)) this.goIdle(a);
        break;
      case 'idle':
        a.idleFor -= dt;
        if (a.idleFor <= 0 && !this.over) this.startMischief(a);
        break;
      case 'mischief':
        this.updateMischief(a, dt);
        break;
      case 'fetch': {
        const b = a.job!.block;
        if (this.advance(a, dt) && b.state === 'waiting') {
          a.state = 'grab';
          a.t = 0;
          this.events.push({ type: 'grab', alien: a, block: b });
        }
        break;
      }
      case 'grab':
        if (a.t >= TOWER.grabTime) {
          const job = a.job!;
          this.setState(job.block, 'carried');
          job.block.slot = -1;
          a.state = 'carry';
          a.t = 0;
          const d = this.carryTarget(a);
          this.fly(a, d.x, d.y, 70);
        }
        break;
      case 'carry':
        this.updateCarry(a, dt);
        break;
      case 'drop':
        this.updateDrop(a);
        break;
      case 'cheer':
        this.updateCheer(a, dt);
        break;
    }
    if (dt > 0) {
      a.vx = (a.x - px) / dt;
      a.vy = (a.y - py) / dt;
    }
  }

  /** a carry gag is running and not finished */
  carryGagRunning(job: Job): boolean {
    return !!job.gag && job.gag.phase === 'carry' && job.gagT >= 0 && job.gagT < job.gag.dur;
  }

  private updateCarry(a: Alien, dt: number): void {
    const job = a.job!;
    const f = a.flight!;
    const g = job.gag;
    let factor = 1;
    if (g && g.phase === 'carry' && job.gagT < 0 && f.u >= (g.at ?? 0.62)) {
      job.gagT = 0;
      this.gags++;
      this.events.push({ type: 'gag', alien: a, gag: g });
    }
    if (g && this.carryGagRunning(job)) {
      job.gagT = Math.min(g.dur, job.gagT + dt);
      factor = g.halt === false ? (g.speed ?? 1) : 0;
      if (g.jump && !job.jumped && job.gagT >= g.jump.at * g.dur) {
        job.jumped = true;
        f.u = Math.max(f.u, g.jump.to);
      }
    }
    const arrived = this.advance(a, dt, factor);
    if (!arrived || this.carryGagRunning(job)) return;
    // the tower may have grown or the queue moved on meanwhile: fly on to the new place
    const target = this.carryTarget(a);
    if (Math.hypot(a.x - target.x, a.y - target.y) > 3) this.fly(a, target.x, target.y, 0);
    else if (target.drop) this.startDrop(a);
  }

  /**
   * One block at a time per tower: the first alien (in the order the blocks came out of the portal)
   * goes to the drop point, the others wait next to the tower, alternately left and right.
   */
  private carryTarget(a: Alien): { x: number; y: number; drop: boolean } {
    const job = a.job!;
    const d = this.dropPoint(job.tower, job.block);
    const line = this.aliens
      .filter((o) => o.job?.tower === job.tower && (o.state === 'carry' || o.state === 'drop'))
      .sort((p, q) => Number(q.state === 'drop') - Number(p.state === 'drop') || p.job!.block.id - q.job!.block.id);
    const k = line.indexOf(a);
    if (k <= 0) return { ...d, drop: true };
    const level = Math.floor((k - 1) / 2);
    const side = k % 2 ? 1 : -1;
    return { x: clamp(d.x + side * (175 + level * 30), 90, this.worldW - 90), y: Math.max(80, d.y - 40 - level * 100), drop: false };
  }

  private startDrop(a: Alien): void {
    const job = a.job!;
    const b = job.block;
    a.state = 'drop';
    a.t = 0;
    a.flight = null;
    job.dropDist = Math.max(0, this.topY(job.tower) - b.h / 2 - (a.y + TOWER.hang + b.h / 2));
    const g = job.gag?.phase === 'drop' ? job.gag : null;
    job.dropDur = g ? g.dur : TOWER.dropTime;
    if (g) {
      job.gagT = 0;
      this.gags++;
      this.events.push({ type: 'gag', alien: a, gag: g });
    }
  }

  private updateDrop(a: Alien): void {
    const job = a.job!;
    const g = job.gag?.phase === 'drop' ? job.gag : null;
    if (g) job.gagT = Math.min(g.dur, a.t);
    const u = a.t / job.dropDur;
    if (!job.landed && u >= (g?.landAt ?? 1)) this.land(a);
    if (u < 1) return;
    if (g?.deco && !job.block.deco.includes(g.deco)) job.block.deco.push(g.deco);
    a.job = null;
    if (this.over) this.startCheer(a);
    else this.goPark(a);
  }

  private land(a: Alien): void {
    const job = a.job!;
    const b = job.block;
    const tw = this.towers[job.tower];
    job.landed = true;
    this.setState(b, 'placed');
    if (job.gag?.phase === 'carry' && job.gag.deco && !b.deco.includes(job.gag.deco)) b.deco.push(job.gag.deco);
    b.x = tw.x;
    tw.blocks.push(b);
    tw.metres += b.metres;
    this.blocks = this.blocks.filter((o) => o !== b);
    this.events.push({ type: 'land', alien: a, block: b, tower: job.tower });
    if (!this.over && tw.metres >= this.goal) this.finish(job.tower, 'goal');
  }

  private timeUp(): void {
    const best = Math.max(...this.towers.map((t) => t.metres));
    const leaders = this.towers.filter((t) => t.metres === best);
    this.finish(best > 0 && leaders.length === 1 ? leaders[0].player : null, 'time');
  }

  private finish(winner: number | null, reason: 'goal' | 'time'): void {
    this.over = { winner, reason };
    this.events.push({ type: 'win', tower: winner, reason });
    // whatever is still on its way disappears in a puff
    for (const b of this.blocks) {
      if (b.state === 'poof') continue;
      this.setState(b, 'poof');
      b.slot = -1;
      this.events.push({ type: 'poof', block: b });
    }
    this.queue = [];
    for (const a of this.aliens) {
      if (a.state === 'drop' && a.job?.landed) continue;
      a.job = null;
      this.startCheer(a);
    }
  }

  // ---------------------------------------------------------------- idle

  private parkSpot(a: Alien): { x: number; y: number } {
    const W = this.worldW;
    let best = { x: W / 2 + 300, y: 300 };
    let bestD = -1;
    for (let i = 0; i < 14; i++) {
      const x = 170 + this.rand() * (W - 340);
      const y = TOWER.sky.y0 + this.rand() * (TOWER.sky.y1 - TOWER.sky.y0);
      // keep the portal and the "Ziel" sign free
      if ((Math.abs(x - W / 2) < 220 && y < 340) || (x < 480 && Math.abs(y - TOWER.goalY) < 70)) continue;
      let d = Infinity;
      for (const o of this.aliens) if (o !== a) d = Math.min(d, Math.hypot(o.x - x, o.y - y));
      if (d > 170) return { x, y };
      if (d > bestD) {
        bestD = d;
        best = { x, y };
      }
    }
    return best;
  }

  private goPark(a: Alien): void {
    a.state = 'park';
    a.t = 0;
    const s = this.parkSpot(a);
    this.fly(a, s.x, s.y, 30);
  }

  private goIdle(a: Alien): void {
    a.state = 'idle';
    a.t = 0;
    a.flight = null;
    a.idleFor = 1.2 + this.rand() * 2.4;
  }

  private pushPoint(tower: number, side: number): { x: number; y: number } {
    const y = clamp(this.topY(tower) + 45, TOWER.sky.y0, TOWER.groundY - 70);
    return { x: this.towers[tower].x + side * (this.towerW / 2 + 66), y };
  }

  private startMischief(a: Alien): void {
    const weight: Record<MischiefKind, number> = {
      push: this.towers.some((t) => t.metres > 0) ? 3 : 1.2,
      icecream: 2,
      fly: 2,
      clean: 2,
      nap: 1.2,
      wave: 1,
      music: 1.2,
    };
    const kinds = MISCHIEF.filter((k) => k !== a.lastMischief);
    let r = this.rand() * kinds.reduce((s, k) => s + weight[k], 0);
    let kind = kinds[0];
    for (const k of kinds) {
      r -= weight[k];
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    const m: Mischief = { kind, t: 0, phase: 0, phaseT: 0, phaseDur: 4, tower: -1, side: 1, pts: [], scoopAt: -1, scoopGone: false };
    a.mischief = m;
    a.state = 'mischief';
    a.t = 0;
    a.lastMischief = kind;
    if (kind === 'push') {
      m.tower = Math.floor(this.rand() * this.towers.length) % this.towers.length;
      m.side = a.x < this.towers[m.tower].x ? -1 : 1;
      const p = this.pushPoint(m.tower, m.side);
      this.fly(a, p.x, p.y, 40);
      m.phaseDur = a.flight!.dur;
    } else if (kind === 'icecream') {
      m.phaseDur = 4.5 + this.rand() * 2;
      m.scoopAt = this.rand() < 0.4 ? m.phaseDur * (0.4 + this.rand() * 0.2) : -1;
    } else if (kind === 'fly') {
      for (let i = 0; i < 4; i++) m.pts.push({ x: 180 + this.rand() * (this.worldW - 360), y: TOWER.sky.y0 + this.rand() * (TOWER.sky.y1 - TOWER.sky.y0) });
      this.fly(a, m.pts[0].x, m.pts[0].y, 60);
    } else if (kind === 'wave') {
      this.fly(a, clamp(a.x, this.worldW / 2 - 500, this.worldW / 2 + 500), 450, 20);
      m.phaseDur = a.flight!.dur;
    } else if (kind === 'nap') m.phaseDur = 5 + this.rand() * 2;
    this.events.push({ type: 'mischief', alien: a, kind });
  }

  private nextPhase(m: Mischief, dur: number): void {
    m.phase++;
    m.phaseT = 0;
    m.phaseDur = dur;
  }

  private updateMischief(a: Alien, dt: number): void {
    const m = a.mischief!;
    m.t += dt;
    m.phaseT += dt;
    let done = false;
    if (m.kind === 'push') {
      const tw = this.towers[m.tower];
      const p = this.pushPoint(m.tower, m.side);
      if (m.phase === 0) {
        a.flight!.x1 = p.x;
        a.flight!.y1 = p.y;
        if (this.advance(a, dt)) this.nextPhase(m, 2.4);
      } else if (m.phase === 1) {
        a.x = p.x - m.side * 12 * (0.5 + 0.5 * Math.sin(m.phaseT * 14));
        a.y = p.y;
        tw.shake = 1;
        tw.shakeDir = -m.side;
        if (m.phaseT >= m.phaseDur) {
          this.nextPhase(m, 1.1);
          this.fly(a, a.x + m.side * 230, Math.max(TOWER.sky.y0, a.y - 90), 40);
          this.events.push({ type: 'pushBounce', alien: a, tower: m.tower });
        }
      } else {
        this.advance(a, dt);
        done = m.phaseT >= m.phaseDur;
      }
    } else if (m.kind === 'fly') {
      if (this.advance(a, dt)) {
        m.phase++;
        if (m.phase >= m.pts.length) done = true;
        else this.fly(a, m.pts[m.phase].x, m.pts[m.phase].y, 60);
      }
    } else if (m.kind === 'wave') {
      if (m.phase === 0) {
        if (this.advance(a, dt)) this.nextPhase(m, 2.6);
      } else done = m.phaseT >= m.phaseDur;
    } else {
      if (m.kind === 'icecream' && m.scoopAt >= 0 && !m.scoopGone && m.t >= m.scoopAt) {
        m.scoopGone = true;
        m.t = 0;
        m.phaseDur = 2.2;
        this.events.push({ type: 'scoopDrop', alien: a });
      }
      done = m.t >= m.phaseDur;
    }
    if (done) {
      a.mischief = null;
      this.goPark(a);
    }
  }

  /** normalised progress of the current mischief, for the poses */
  mischiefInfo(a: Alien): MischiefInfo | null {
    const m = a.mischief;
    if (!m) return null;
    const phased = m.kind === 'push' || m.kind === 'wave';
    const t = phased ? m.phaseT / Math.max(0.01, m.phaseDur) : m.kind === 'fly' ? m.t / 1.2 : m.t / Math.max(0.01, m.phaseDur);
    return { phase: m.phase, t: clamp(t), scoopGone: m.scoopGone };
  }

  // ---------------------------------------------------------------- celebration

  private startCheer(a: Alien): void {
    a.state = 'cheer';
    a.t = 0;
    a.flight = null;
    a.mischief = null;
  }

  private updateCheer(a: Alien, dt: number): void {
    const w = this.over?.winner;
    const cx = w === null || w === undefined ? this.worldW / 2 : this.towers[w].x;
    const cy = w === null || w === undefined ? 330 : Math.max(220, this.topY(w) - 150);
    const n = Math.max(1, this.aliens.length);
    const ang = this.time * 1.3 + this.aliens.indexOf(a) * (TAU / n);
    const r = 170 + n * 12;
    const k = 1 - Math.exp(-dt * 3);
    a.x = lerp(a.x, cx + Math.cos(ang) * r, k);
    a.y = lerp(a.y, cy + Math.sin(ang) * r * 0.4, k);
  }

  // ---------------------------------------------------------------- block positions

  private updateBlockViews(): void {
    const p = this.portalPos();
    for (const b of this.blocks) {
      if (b.state === 'poof') continue;
      if (b.state === 'portal') {
        b.x = p.x;
        b.y = p.y;
        b.s = 0;
        continue;
      }
      const slot = b.slot >= 0 ? slotPos(b.slot, this.worldW) : p;
      if (b.state === 'emerging') {
        const u = clamp(b.t / TOWER.emergeTime);
        const e = ease.outCubic(u);
        b.x = lerp(p.x, slot.x, e);
        b.y = lerp(p.y, slot.y, e) - Math.sin(Math.PI * u) * 50;
        b.s = Math.max(0.05, TOWER.waitScale * ease.outBack(u));
        continue;
      }
      const a = b.alien ? this.alienById(b.alien) : undefined;
      if (b.state === 'waiting') {
        if (a && a.state === 'grab') {
          const u = ease.inOutCubic(clamp(a.t / TOWER.grabTime));
          b.x = lerp(slot.x, a.x, u);
          b.y = lerp(slot.y, a.y + TOWER.hang + b.h / 2, u);
          b.s = lerp(TOWER.waitScale, 1, u);
        } else {
          b.x = slot.x;
          b.y = slot.y;
          b.s = TOWER.waitScale;
        }
        continue;
      }
      if (b.state === 'carried' && a?.job) {
        const job = a.job;
        const hang = a.y + TOWER.hang + b.h / 2;
        b.s = 1;
        if (a.state === 'drop') {
          const rest = this.topY(job.tower) - b.h / 2;
          b.x = this.towers[job.tower].x;
          b.y = job.gag?.phase === 'drop' ? rest : lerp(hang, rest, ease.inOutCubic(clamp(a.t / job.dropDur)));
        } else {
          b.x = a.x;
          b.y = hang;
        }
      }
    }
  }
}

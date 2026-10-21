// Team-Duell simulation (pure logic, no rendering): lanes, star strikes, bubble piles, bubble machines.
import type { TeamId } from '../../vision/types.ts';
import type { Rand } from '../rng.ts';
import { BALANCE, laneY, pileRowY } from './balance.ts';

export interface Fighter {
  id: number;
  team: TeamId;
  lane: number;
  x: number;
  /** strikes left (stars) */
  strength: number;
  maxStrength: number;
  radius: number;
  speed: number;
  score: number;
  glyphId: number;
  state: 'march' | 'fight' | 'wait' | 'siege' | 'gone';
  cool: number;
  /** strikes that landed (enemy stars and castle bubbles) */
  hits: number;
  /** visual knockback offset */
  knock: number;
  hitT: number;
  /** waiting at the gate (too many fighters) */
  queued: boolean;
  /** castle guard: walks out to holdX and defends there (Riesenburg) */
  guard: boolean;
  holdX: number;
}

/** one wall of the Riesenburg: bubbles on the pile and in the machine's tank */
export interface SiegeStage {
  pile: number;
  tank: number;
}

export interface Castle {
  team: TeamId;
  x: number;
  /** bubbles per column, column 0 faces the battlefield */
  pile: number[];
  tank: number;
  tankMax: number;
  /** machine bubbles on their way to a column */
  flying: { column: number; t: number }[];
  machineT: number;
  startTotal: number;
}

export type DuelEvent =
  | { type: 'strike'; by: Fighter; target: Fighter }
  | { type: 'pop'; fighter: Fighter; by?: Fighter; exhausted?: boolean }
  | { type: 'bubblePop'; team: TeamId; column: number; row: number; by: Fighter }
  | { type: 'machineLaunch'; team: TeamId; column: number }
  | { type: 'bubbleLand'; team: TeamId; column: number }
  | { type: 'castlePop'; team: TeamId }
  | { type: 'stageClear'; stage: number }
  | { type: 'stageStart'; stage: number }
  | { type: 'scribble'; team: TeamId; glyphId: number };

export interface TeamStats {
  written: number;
  scoreSum: number;
  best: { glyphId: number; score: number } | null;
  bravest: { glyphId: number; hits: number } | null;
  /** castle bubbles popped */
  castleDamage: number;
  fighters: number;
}

export type CastleSize = keyof typeof BALANCE.castle;

const other = (t: TeamId): TeamId => (t === 'A' ? 'B' : 'A');

export class DuelSim {
  fighters: Fighter[] = [];
  castles: Record<TeamId, Castle>;
  time = 0;
  timeLimit: number;
  over: TeamId | 'draw' | null = null;
  events: DuelEvent[] = [];
  stats: Record<TeamId, TeamStats>;
  private nextId = 1;
  private rand: Rand;
  worldW: number;
  /** Riesenburg: walls of castle B (null in the team duel) */
  stages: SiegeStage[] | null = null;
  stage = 0;
  /** the current wall is down, waiting for nextStage() */
  stageCleared = false;

  constructor(size: CastleSize, worldW: number, timeLimitSec: number, rand: Rand = Math.random) {
    this.worldW = worldW;
    this.rand = rand;
    this.timeLimit = timeLimitSec;
    const make = (team: TeamId, x: number): Castle => {
      const cfg = BALANCE.castle[size];
      const pile = new Array(BALANCE.pile.columns).fill(0);
      for (let i = 0; i < cfg.pile; i++) pile[i % pile.length]++;
      return { team, x, pile, tank: cfg.tank, tankMax: cfg.tank, flying: [], machineT: 0, startTotal: cfg.pile + cfg.tank };
    };
    this.castles = { A: make('A', BALANCE.castleInset), B: make('B', worldW - BALANCE.castleInset) };
    const empty = (): TeamStats => ({ written: 0, scoreSum: 0, best: null, bravest: null, castleDamage: 0, fighters: 0 });
    this.stats = { A: empty(), B: empty() };
  }

  /** Klasse gegen Riesenburg: castle A has no bubbles, castle B has several walls. */
  configureSiege(stages: SiegeStage[]): void {
    this.stages = stages;
    const a = this.castles.A;
    a.pile = a.pile.map(() => 0);
    a.tank = 0;
    a.tankMax = 0;
    a.flying = [];
    a.startTotal = 1;
    this.loadStage(0);
  }

  private loadStage(i: number): void {
    const st = this.stages![i];
    const c = this.castles.B;
    c.pile = new Array(BALANCE.pile.columns).fill(0);
    for (let k = 0; k < st.pile; k++) c.pile[k % c.pile.length]++;
    c.tank = st.tank;
    c.tankMax = st.tank;
    c.flying = [];
    c.machineT = 0;
    c.startTotal = st.pile + st.tank;
    this.stage = i;
    this.stageCleared = false;
  }

  /** Builds the next wall after a stage sequence; false when there is none. */
  nextStage(): boolean {
    if (!this.stages || this.stage + 1 >= this.stages.length) return false;
    this.loadStage(this.stage + 1);
    this.events.push({ type: 'stageStart', stage: this.stage });
    return true;
  }

  private castleEmptied(attacker: TeamId): void {
    if (other(attacker) === 'B' && this.stages && this.stage < this.stages.length - 1) {
      if (!this.stageCleared) {
        this.stageCleared = true;
        this.events.push({ type: 'stageClear', stage: this.stage });
      }
      return;
    }
    this.conquer(attacker);
  }

  resize(worldW: number): void {
    const dx = worldW - this.worldW;
    this.worldW = worldW;
    this.castles.B.x += dx;
    for (const f of this.fighters) if (f.team === 'B') f.x += dx;
  }

  /** walking direction of a team (A walks right) */
  dir(team: TeamId): number {
    return team === 'A' ? 1 : -1;
  }

  /** x of a pile column (column 0 faces the battlefield) */
  columnX(team: TeamId, column: number): number {
    return this.castles[team].x + this.dir(team) * BALANCE.pile.spacing * (1 - column);
  }

  /** x of the battlefield-facing surface of a castle's bubble pile */
  frontEdge(team: TeamId): number {
    return this.castles[team].x + this.dir(team) * (BALANCE.pile.spacing + BALANCE.pile.bubbleR);
  }

  gateX(team: TeamId): number {
    return this.frontEdge(team) + this.dir(team) * 60;
  }

  /** bubbles left in pile, tank and on the way */
  remaining(team: TeamId): number {
    const c = this.castles[team];
    return c.pile.reduce((a, b) => a + b, 0) + c.tank + c.flying.length;
  }

  /** Adds a letter; returns the fighter, or null for scribbles (score below the minimum). */
  spawn(team: TeamId, score: number, glyphId: number, opts: { guard?: boolean; holdX?: number; lane?: number } = {}): Fighter | null {
    const st = this.stats[team];
    st.written++;
    st.scoreSum += score;
    if (!st.best || score > st.best.score) st.best = { glyphId, score };
    if (this.over) return null;
    if (score < BALANCE.minScore) {
      this.events.push({ type: 'scribble', team, glyphId });
      return null;
    }
    const strength = BALANCE.strength(score);
    const own = this.fighters.filter((f) => f.team === team && f.state !== 'gone');
    const counts = new Array(BALANCE.lanes).fill(0);
    for (const f of own) counts[f.lane]++;
    let lane = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] < counts[lane] || (counts[i] === counts[lane] && this.rand() < 0.4)) lane = i;
    }
    if (opts.lane !== undefined) lane = opts.lane;
    const radius = BALANCE.radius(strength);
    const f: Fighter = {
      id: this.nextId++,
      team,
      lane,
      x: this.frontEdge(team) + this.dir(team) * (radius + 12),
      strength,
      maxStrength: strength,
      radius,
      speed: BALANCE.speed(strength),
      score,
      glyphId,
      state: 'march',
      cool: 0,
      hits: 0,
      knock: 0,
      hitT: 0,
      queued: own.length >= BALANCE.maxPerTeam,
      guard: !!opts.guard,
      holdX: opts.holdX ?? 0,
    };
    st.fighters++;
    this.fighters.push(f);
    return f;
  }

  private credit(f: Fighter): void {
    f.hits++;
    const st = this.stats[f.team];
    if (!st.bravest || f.hits > st.bravest.hits) st.bravest = { glyphId: f.glyphId, hits: f.hits };
  }

  private machines(dt: number): void {
    const P = BALANCE.pile;
    for (const c of Object.values(this.castles)) {
      for (const fl of c.flying) fl.t += dt;
      const landed = c.flying.filter((fl) => fl.t >= BALANCE.machineFlight);
      c.flying = c.flying.filter((fl) => fl.t < BALANCE.machineFlight);
      for (const fl of landed) {
        c.pile[fl.column] = Math.min(P.rows, c.pile[fl.column] + 1);
        this.events.push({ type: 'bubbleLand', team: c.team, column: fl.column });
      }
      if (c.tank <= 0) continue;
      c.machineT += dt;
      const planned = c.pile.map((n, j) => n + c.flying.filter((fl) => fl.column === j).length);
      const space = planned.some((n) => n < P.rows);
      if (c.machineT >= BALANCE.machineEvery && space) {
        c.machineT = 0;
        c.tank--;
        let column = 0;
        for (let j = 1; j < planned.length; j++) if (planned[j] < planned[column]) column = j;
        c.flying.push({ column, t: 0 });
        this.events.push({ type: 'machineLaunch', team: c.team, column });
      }
    }
  }

  private conquer(attacker: TeamId): void {
    if (this.over) return;
    this.over = attacker;
    this.events.push({ type: 'castlePop', team: other(attacker) });
  }

  step(dt: number): void {
    if (this.over) return;
    this.time += dt;
    this.machines(dt);
    const live = this.fighters.filter((f) => f.state !== 'gone' && !f.queued);
    for (const f of live) {
      f.knock *= Math.pow(0.02, dt);
      f.hitT = Math.max(0, f.hitT - dt);
    }
    for (let lane = 0; lane < BALANCE.lanes; lane++) {
      const inLane = live.filter((f) => f.lane === lane);
      const A = inLane.filter((f) => f.team === 'A').sort((a, b) => b.x - a.x); // front first
      const B = inLane.filter((f) => f.team === 'B').sort((a, b) => a.x - b.x);
      const frontA = A[0];
      const frontB = B[0];
      const contact = !!frontA && !!frontB && frontB.x - frontA.x <= frontA.radius + frontB.radius + 1;
      for (const [list, enemyFront] of [
        [A, frontB],
        [B, frontA],
      ] as const) {
        list.forEach((f, i) => {
          const d = this.dir(f.team);
          if (i === 0 && contact) {
            if (f.state !== 'fight') {
              f.state = 'fight';
              f.cool = BALANCE.hitEvery * 0.5;
            }
            return;
          }
          let limit = Infinity;
          if (i > 0) {
            const ahead = list[i - 1];
            limit = Math.abs(ahead.x - f.x) - (ahead.radius + f.radius) * 1.05;
          } else if (enemyFront) {
            limit = Math.abs(enemyFront.x - f.x) - (enemyFront.radius + f.radius);
          }
          // guards walk out to their defence line and hold it
          if (f.guard) {
            const toHold = d * (f.holdX - f.x);
            if (toHold <= 0.5) {
              f.state = 'wait';
              return;
            }
            limit = Math.min(limit, toHold);
          }
          // the enemy castle's bubble pile is a wall
          const toCastle = d * (this.frontEdge(other(f.team)) - f.x) - f.radius;
          limit = Math.min(limit, toCastle);
          if (i === 0 && toCastle <= 0.5) {
            if (f.state !== 'siege') {
              f.state = 'siege';
              f.cool = BALANCE.hitEvery * 0.4;
            }
            return;
          }
          const move = Math.min(f.speed * dt, Math.max(0, limit));
          f.state = move > 0.01 ? 'march' : 'wait';
          f.x += d * move;
        });
      }
      // fighter against fighter: every exchange costs both one star
      if (contact) {
        frontA.cool -= dt;
        if (frontA.cool <= 0) {
          frontA.cool += BALANCE.hitEvery;
          for (const [f, target] of [
            [frontA, frontB],
            [frontB, frontA],
          ] as const) {
            target.strength--;
            target.knock = 14 * this.dir(f.team);
            target.hitT = 0.25;
            this.credit(f);
            this.events.push({ type: 'strike', by: f, target });
          }
          for (const [f, by] of [
            [frontA, frontB],
            [frontB, frontA],
          ] as const) {
            if (f.strength <= 0) {
              f.state = 'gone';
              this.events.push({ type: 'pop', fighter: f, by });
            }
          }
          for (const f of [frontA, frontB]) if (f.state === 'fight') f.state = 'march';
          if (frontA.state !== 'gone' && frontB.state !== 'gone') {
            frontA.state = 'fight';
            frontB.state = 'fight';
          }
        }
      }
    }
    // at the enemy castle: every strike pops one bubble of the pile
    for (const f of live) {
      if (f.state !== 'siege') continue;
      f.cool -= dt;
      if (f.cool > 0) continue;
      const enemy = this.castles[other(f.team)];
      const column = enemy.pile.findIndex((n) => n > 0);
      if (column < 0) {
        if (this.remaining(enemy.team) === 0) this.castleEmptied(f.team);
        f.cool = 0.1; // wait for the machine's next bubble
        continue;
      }
      f.cool = BALANCE.hitEvery;
      const ly = laneY(f.lane);
      let row = 0;
      for (let r = 1; r < enemy.pile[column]; r++) if (Math.abs(pileRowY(r) - ly) < Math.abs(pileRowY(row) - ly)) row = r;
      enemy.pile[column]--;
      f.strength--;
      this.credit(f);
      this.stats[f.team].castleDamage++;
      this.events.push({ type: 'bubblePop', team: enemy.team, column, row, by: f });
      if (f.strength <= 0) {
        f.state = 'gone';
        this.events.push({ type: 'pop', fighter: f, exhausted: true });
      }
      if (this.remaining(enemy.team) === 0) this.castleEmptied(f.team);
    }
    // release queued fighters when there is room again
    for (const team of ['A', 'B'] as const) {
      const active = this.fighters.filter((f) => f.team === team && f.state !== 'gone' && !f.queued).length;
      if (active < BALANCE.maxPerTeam) {
        const q = this.fighters.find((f) => f.team === team && f.queued);
        if (q) q.queued = false;
      }
    }
    this.fighters = this.fighters.filter((f) => f.state !== 'gone');
    if (!this.over && this.timeLimit > 0 && this.time >= this.timeLimit) {
      const a = this.remaining('A') / this.castles.A.startTotal;
      const b = this.remaining('B') / this.castles.B.startTotal;
      this.over = Math.abs(a - b) < 0.02 ? 'draw' : a > b ? 'A' : 'B';
    }
  }

  drain(): DuelEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

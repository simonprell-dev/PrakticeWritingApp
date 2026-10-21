// Team-Duell simulation (pure logic, no rendering): lanes, fights, bubble castles, statistics.
import type { TeamId } from '../../vision/types.ts';
import type { Rand } from '../rng.ts';
import { BALANCE } from './balance.ts';

export interface Fighter {
  id: number;
  team: TeamId;
  lane: number;
  x: number;
  hp: number;
  maxHp: number;
  dps: number;
  radius: number;
  speed: number;
  score: number;
  glyphId: number;
  state: 'march' | 'fight' | 'wait' | 'gone';
  cool: number;
  kills: number;
  /** visual knockback offset */
  knock: number;
  hitT: number;
  /** waiting at the gate (too many fighters) */
  queued: boolean;
}

export interface Castle {
  team: TeamId;
  x: number;
  hp: number;
  maxHp: number;
}

export type DuelEvent =
  | { type: 'bonk'; x: number; y: number; by: Fighter; target: Fighter }
  | { type: 'pop'; fighter: Fighter; by?: Fighter }
  | { type: 'castleHit'; team: TeamId; damage: number; fighter: Fighter }
  | { type: 'castlePop'; team: TeamId }
  | { type: 'scribble'; team: TeamId; glyphId: number };

export interface TeamStats {
  written: number;
  scoreSum: number;
  best: { glyphId: number; score: number } | null;
  bravest: { glyphId: number; kills: number } | null;
  castleDamage: number;
  fighters: number;
}

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

  constructor(castleHp: number, worldW: number, timeLimitSec: number, rand: Rand = Math.random) {
    this.worldW = worldW;
    this.rand = rand;
    this.timeLimit = timeLimitSec;
    this.castles = {
      A: { team: 'A', x: BALANCE.castleInset, hp: castleHp, maxHp: castleHp },
      B: { team: 'B', x: worldW - BALANCE.castleInset, hp: castleHp, maxHp: castleHp },
    };
    const empty = (): TeamStats => ({ written: 0, scoreSum: 0, best: null, bravest: null, castleDamage: 0, fighters: 0 });
    this.stats = { A: empty(), B: empty() };
  }

  resize(worldW: number): void {
    const dx = worldW - this.worldW;
    this.worldW = worldW;
    this.castles.B.x += dx;
    for (const f of this.fighters) if (f.team === 'B') f.x += dx;
  }

  dir(team: TeamId): number {
    return team === 'A' ? 1 : -1;
  }

  gateX(team: TeamId): number {
    return this.castles[team].x + this.dir(team) * (BALANCE.castleRadius + 30);
  }

  /** Adds a letter; returns the fighter, or null for scribbles (score below the minimum). */
  spawn(team: TeamId, score: number, glyphId: number): Fighter | null {
    const st = this.stats[team];
    st.written++;
    st.scoreSum += score;
    if (!st.best || score > st.best.score) st.best = { glyphId, score };
    if (this.over) return null;
    if (score < BALANCE.minScore) {
      this.events.push({ type: 'scribble', team, glyphId });
      return null;
    }
    const q = score / 100;
    const own = this.fighters.filter((f) => f.team === team && f.state !== 'gone');
    const counts = new Array(BALANCE.lanes).fill(0);
    for (const f of own) counts[f.lane]++;
    let lane = 0;
    for (let i = 1; i < counts.length; i++) {
      if (counts[i] < counts[lane] || (counts[i] === counts[lane] && this.rand() < 0.4)) lane = i;
    }
    const hp = BALANCE.hp(q);
    const f: Fighter = {
      id: this.nextId++,
      team,
      lane,
      x: this.gateX(team),
      hp,
      maxHp: hp,
      dps: BALANCE.dps(q),
      radius: BALANCE.radius(q),
      speed: BALANCE.speed(q),
      score,
      glyphId,
      state: 'march',
      cool: 0,
      kills: 0,
      knock: 0,
      hitT: 0,
      queued: own.length >= BALANCE.maxPerTeam,
    };
    st.fighters++;
    this.fighters.push(f);
    return f;
  }

  step(dt: number): void {
    if (this.over) return;
    this.time += dt;
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
      const contact = frontA && frontB && frontB.x - frontA.x <= frontA.radius + frontB.radius + 1;
      for (const [list, enemyFront] of [
        [A, frontB],
        [B, frontA],
      ] as const) {
        list.forEach((f, i) => {
          const d = this.dir(f.team);
          if (i === 0 && contact) {
            if (f.state !== 'fight') {
              f.state = 'fight';
              f.cool = this.rand() * BALANCE.hitEvery * 0.5;
            }
            return;
          }
          // keep distance to the teammate ahead
          let limit = Infinity;
          if (i > 0) {
            const ahead = list[i - 1];
            limit = Math.abs(ahead.x - f.x) - (ahead.radius + f.radius) * 0.85;
          } else if (enemyFront) {
            limit = Math.abs(enemyFront.x - f.x) - (enemyFront.radius + f.radius);
          }
          const move = Math.min(f.speed * dt, Math.max(0, limit));
          f.state = move > 0.01 ? 'march' : 'wait';
          f.x += d * move;
        });
      }
      if (contact) {
        for (const [f, target] of [
          [frontA, frontB],
          [frontB, frontA],
        ] as const) {
          f.cool -= dt;
          if (f.cool <= 0 && f.hp > 0) {
            f.cool += BALANCE.hitEvery;
            const dmg = f.dps * BALANCE.hitEvery * (0.85 + 0.3 * this.rand());
            target.hp -= dmg;
            target.knock = 14 * this.dir(f.team);
            target.hitT = 0.25;
            this.events.push({ type: 'bonk', x: (f.x + target.x) / 2, y: 0, by: f, target });
          }
        }
        for (const [f, by] of [
          [frontA, frontB],
          [frontB, frontA],
        ] as const) {
          if (f.hp <= 0 && f.state !== 'gone') {
            f.state = 'gone';
            by.kills++;
            const bs = this.stats[by.team];
            if (!bs.bravest || by.kills > bs.bravest.kills) bs.bravest = { glyphId: by.glyphId, kills: by.kills };
            this.events.push({ type: 'pop', fighter: f, by });
          }
        }
        if (frontA.state === 'gone' || frontB.state === 'gone') {
          for (const f of [frontA, frontB]) if (f.state === 'fight') f.state = 'march';
        }
      }
    }
    // reaching the enemy castle: dive in and damage it with the remaining strength
    for (const f of live) {
      if (f.state === 'gone') continue;
      const enemy = this.castles[f.team === 'A' ? 'B' : 'A'];
      const reached = f.team === 'A' ? f.x >= enemy.x - BALANCE.castleRadius : f.x <= enemy.x + BALANCE.castleRadius;
      if (reached) {
        const damage = Math.max(1, Math.round(f.hp));
        enemy.hp = Math.max(0, enemy.hp - damage);
        this.stats[f.team].castleDamage += damage;
        f.state = 'gone';
        this.events.push({ type: 'castleHit', team: enemy.team, damage, fighter: f });
        if (enemy.hp <= 0 && !this.over) {
          this.over = f.team;
          this.events.push({ type: 'castlePop', team: enemy.team });
        }
      }
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
      const a = this.castles.A.hp / this.castles.A.maxHp;
      const b = this.castles.B.hp / this.castles.B.maxHp;
      this.over = Math.abs(a - b) < 0.02 ? 'draw' : a > b ? 'A' : 'B';
    }
  }

  drain(): DuelEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

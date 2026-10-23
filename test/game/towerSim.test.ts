import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/game/rng.ts';
import { GAGS, mischiefPose, type GagKit, type MischiefKind } from '../../src/game/tower/gags.ts';
import { blockMetres, TOWER, towerWidth } from '../../src/game/tower/rules.ts';
import { TowerSim, type TowerEvent } from '../../src/game/tower/towerSim.ts';

function run(sim: TowerSim, seconds: number, dt = 1 / 60): TowerEvent[] {
  const events: TowerEvent[] = [];
  for (let t = 0; t < seconds; t += dt) {
    sim.step(dt);
    events.push(...sim.drain());
  }
  return events;
}

const KIT: GagKit = { dir: 1, wrongDx: -400, wrongDy: 60, stars: 5, blockH: 110, room: 200, dropDist: 50, toGround: 500, metres: 12, toGoal: 20, teamName: 'Rote Raketen' };

describe('Türme bauen', () => {
  it('nicer letters make taller blocks', () => {
    expect([20, 40, 60, 80, 95].map(blockMetres)).toEqual([2, 3, 4, 6, 8]);
  });

  it('every block lands on the tower of its colour', () => {
    const sim = new TowerSim(3, 40, 1920, 0, mulberry32(1));
    sim.addBlock(0, 95, 1);
    sim.addBlock(2, 40, 2);
    sim.addBlock(0, 60, 3);
    run(sim, 20);
    expect(sim.towers.map((t) => t.metres)).toEqual([12, 0, 3]);
    expect(sim.towers[0].blocks.map((b) => b.glyphId).sort()).toEqual([1, 3]);
    expect(sim.blocks).toHaveLength(0);
    expect(sim.stats[0]).toMatchObject({ written: 2, blocks: 2, scoreSum: 155 });
  });

  it('up to eight towers fit side by side, each block still finds its tower', () => {
    for (const n of [2, 3, 4, 5, 6, 7, 8]) {
      const sim = new TowerSim(n, 40, 1920, 0, mulberry32(n));
      const xs = sim.towers.map((t) => t.x);
      const plinth = towerWidth(n, 1920) + 64;
      expect(xs[0] - plinth / 2).toBeGreaterThanOrEqual(0);
      expect(xs[n - 1] + plinth / 2).toBeLessThanOrEqual(1920);
      for (let i = 1; i < n; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThan(plinth);
    }
    const sim = new TowerSim(8, 40, 1920, 0, mulberry32(11));
    for (let p = 0; p < 8; p++) sim.addBlock(p, 40 + p * 7, p + 1);
    run(sim, 40);
    expect(sim.towers.map((t) => t.blocks.map((b) => b.glyphId))).toEqual([[1], [2], [3], [4], [5], [6], [7], [8]]);
  });

  it('a busy alien clones itself for the next block, and the clone stays to help', () => {
    const sim = new TowerSim(2, 60, 1920, 0, mulberry32(2));
    sim.addBlock(0, 50, 1);
    run(sim, 0.4);
    expect(sim.aliens).toHaveLength(1);
    sim.addBlock(1, 50, 2);
    const ev = run(sim, 0.8);
    expect(sim.aliens).toHaveLength(2);
    expect(sim.aliens[1].cloneOf).toBe(sim.aliens[0].id);
    expect(ev.some((e) => e.type === 'clone')).toBe(true);
    run(sim, 15);
    // later blocks go to the free aliens, no new clone
    sim.addBlock(0, 50, 3);
    run(sim, 0.2);
    sim.addBlock(1, 50, 4);
    run(sim, 15);
    expect(sim.aliens).toHaveLength(2);
    expect(sim.clones).toBe(1);
    expect(sim.towers.map((t) => t.metres)).toEqual([8, 8]);
  });

  it('a big scan never makes more than the maximum number of aliens', () => {
    const sim = new TowerSim(4, 60, 1920, 0, mulberry32(3));
    const sum = [0, 0, 0, 0];
    for (let i = 0; i < 20; i++) {
      const score = 20 + ((i * 37) % 75);
      sim.addBlock(i % 4, score, i + 1);
      sum[i % 4] += blockMetres(score);
    }
    // never two aliens setting a block onto the same tower at the same time
    let clash = 0;
    for (let t = 0; t < 60; t += 1 / 60) {
      sim.step(1 / 60);
      const dropping = sim.aliens.filter((a) => a.state === 'drop').map((a) => a.job!.tower);
      if (new Set(dropping).size < dropping.length) clash++;
    }
    expect(clash).toBe(0);
    expect(sim.aliens.length).toBe(TOWER.maxAliens);
    expect(sim.towers.map((t) => t.metres)).toEqual(sum);
  });

  it('the first tower over the finish line wins, then nothing new comes', () => {
    const sim = new TowerSim(2, 24, 1920, 0, mulberry32(4));
    for (let i = 0; i < 3; i++) sim.addBlock(0, 95, i + 1);
    sim.addBlock(1, 95, 10);
    const ev = run(sim, 40);
    expect(sim.over).toEqual({ winner: 0, reason: 'goal' });
    expect(sim.towers[0].metres).toBe(24);
    expect(ev.filter((e) => e.type === 'win')).toHaveLength(1);
    expect(sim.addBlock(1, 95, 11)).toBeNull();
    expect(sim.aliens.every((a) => a.state === 'cheer')).toBe(true);
  });

  it('when the time is up the tallest tower wins; equal towers are a draw', () => {
    const a = new TowerSim(2, 60, 1920, 30, mulberry32(5));
    a.addBlock(1, 95, 1);
    a.addBlock(0, 40, 2);
    run(a, 31);
    expect(a.over).toEqual({ winner: 1, reason: 'time' });
    const b = new TowerSim(3, 60, 1920, 20, mulberry32(6));
    b.addBlock(0, 60, 1);
    b.addBlock(2, 60, 2);
    run(b, 21);
    expect(b.over).toEqual({ winner: null, reason: 'time' });
  });

  it('scribbles only make "Pfff?" and build nothing', () => {
    const sim = new TowerSim(2, 40, 1920, 0, mulberry32(7));
    sim.addBlock(0, 10, 1);
    const ev = run(sim, 5);
    expect(ev.some((e) => e.type === 'scribble')).toBe(true);
    expect(sim.towers[0].metres).toBe(0);
    expect(sim.stats[0]).toMatchObject({ written: 1, blocks: 0 });
    expect(sim.blocks).toHaveLength(0);
  });

  it('has 40 different gags; each one plays to the end and the block still lands right', () => {
    expect(GAGS).toHaveLength(40);
    expect(new Set(GAGS.map((g) => g.id)).size).toBe(40);
    for (const g of GAGS) {
      const sim = new TowerSim(2, 60, 1920, 0, mulberry32(8));
      sim.forceGag = g.id;
      sim.addBlock(1, 95, 1);
      const ev = run(sim, 20);
      expect(sim.towers[1].metres, g.id).toBe(8);
      expect(ev.filter((e) => e.type === 'gag' && e.gag.id === g.id), g.id).toHaveLength(1);
      if (g.deco) expect(sim.towers[1].blocks[0].deco, g.id).toContain(g.deco);
      expect(sim.aliens[0].job, g.id).toBeNull();
    }
  });

  it('gag and mischief poses stay finite', () => {
    const finite = (p: object, id: string) => {
      for (const [k, v] of Object.entries(p)) if (typeof v === 'number') expect(Number.isFinite(v), `${id}.${k}`).toBe(true);
    };
    for (const g of GAGS) {
      for (let t = 0; t <= 1.0001; t += 0.01) finite(g.pose(t, KIT), g.id);
      for (const c of g.cues ?? []) expect(c.at >= 0 && c.at <= 1, g.id).toBe(true);
      if (g.phase === 'drop') expect(g.landAt, g.id).toBeGreaterThan(0);
    }
    const kinds: MischiefKind[] = ['push', 'icecream', 'fly', 'clean', 'nap', 'wave', 'music'];
    for (const k of kinds) for (let ph = 0; ph < 3; ph++) for (let t = 0; t <= 1; t += 0.05) finite(mischiefPose(k, { phase: ph, t, scoopGone: t > 0.5 }), k);
  });

  it('idle aliens get up to mischief, but pushing never topples a tower', () => {
    const sim = new TowerSim(2, 40, 1920, 0, mulberry32(9));
    sim.addBlock(0, 70, 1);
    const kinds = new Set<string>();
    let pushes = 0;
    for (const e of run(sim, 150)) {
      if (e.type === 'mischief') kinds.add(e.kind);
      if (e.type === 'pushBounce') pushes++;
    }
    expect(kinds.size).toBeGreaterThanOrEqual(5);
    expect(pushes).toBeGreaterThan(0);
    expect(sim.towers[0].metres).toBe(6);
    expect(sim.towers[0].blocks).toHaveLength(1);
  });

  it('a new block calls the alien back from its mischief', () => {
    const sim = new TowerSim(2, 40, 1920, 0, mulberry32(10));
    sim.enterFirst();
    run(sim, 1);
    while (sim.aliens[0].state !== 'mischief') run(sim, 0.1);
    sim.addBlock(1, 80, 1);
    const ev = run(sim, 1);
    const assign = ev.find((e) => e.type === 'assign');
    expect(assign && assign.type === 'assign' && assign.interrupted).toBeTruthy();
    expect(sim.aliens).toHaveLength(1);
    run(sim, 10);
    expect(sim.towers[1].metres).toBe(6);
  });
});

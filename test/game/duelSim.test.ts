import { describe, expect, it } from 'vitest';
import { DuelSim } from '../../src/game/duel/duelSim.ts';
import { mulberry32 } from '../../src/game/rng.ts';

function run(sim: DuelSim, seconds: number) {
  for (let t = 0; t < seconds; t += 1 / 60) sim.step(1 / 60);
}

describe('duel simulation', () => {
  it('one beautiful letter beats three mediocre ones in a row', () => {
    let wins = 0;
    for (let seed = 1; seed <= 50; seed++) {
      const sim = new DuelSim(5000, 1920, 0, mulberry32(seed));
      const hero = sim.spawn('A', 90, 1)!;
      for (let i = 0; i < 3; i++) {
        const f = sim.spawn('B', 45, 10 + i)!;
        f.lane = hero.lane;
        f.x += i * 120 * -1 * -1;
      }
      sim.fighters.filter((f) => f.team === 'B').forEach((f, i) => (f.x = sim.gateX('B') + i * 110));
      run(sim, 60);
      if (sim.stats.A.bravest?.kills === 3) wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(45);
  });

  it('scribbles do not spawn fighters but are counted', () => {
    const sim = new DuelSim(300, 1920, 0);
    expect(sim.spawn('A', 8, 1)).toBeNull();
    expect(sim.stats.A.written).toBe(1);
    expect(sim.drain().some((e) => e.type === 'scribble')).toBe(true);
  });

  it('equal teams win about equally often', () => {
    let a = 0;
    let b = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const r = mulberry32(seed);
      const sim = new DuelSim(150, 1920, 0, r);
      // both classes keep writing: a letter per team every 4 s, same score distribution
      for (let wave = 0; wave < 150 && !sim.over; wave++) {
        sim.spawn('A', 30 + Math.floor(r() * 65), wave);
        sim.spawn('B', 30 + Math.floor(r() * 65), 1000 + wave);
        for (let k = 0; k < 4 * 20; k++) sim.step(1 / 20);
      }
      if (sim.over === 'A') a++;
      else if (sim.over === 'B') b++;
    }
    expect(a + b).toBeGreaterThan(150);
    expect(Math.abs(a - b)).toBeLessThan(45);
  });

  it('a fighter reaching the castle damages it by its remaining strength', () => {
    const sim = new DuelSim(300, 1920, 0);
    const f = sim.spawn('A', 80, 1)!;
    const hp = f.hp;
    run(sim, 60);
    expect(sim.castles.B.hp).toBe(300 - Math.round(hp));
    expect(sim.stats.A.castleDamage).toBe(Math.round(hp));
  });

  it('pops the castle and ends the game', () => {
    const sim = new DuelSim(100, 1920, 0);
    for (let i = 0; i < 3; i++) sim.spawn('B', 95, i);
    run(sim, 90);
    expect(sim.over).toBe('B');
    expect(sim.castles.A.hp).toBe(0);
  });

  it('decides by castle health when the time is up', () => {
    const sim = new DuelSim(300, 1920, 30);
    sim.spawn('A', 70, 1);
    run(sim, 31);
    expect(sim.over).toBe('A');
  });
});

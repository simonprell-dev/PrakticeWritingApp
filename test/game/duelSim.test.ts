import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../src/game/duel/balance.ts';
import { DuelSim } from '../../src/game/duel/duelSim.ts';
import { mulberry32 } from '../../src/game/rng.ts';

function run(sim: DuelSim, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds; t += dt) sim.step(dt);
}

describe('duel simulation', () => {
  it('strength is the number of stars of the letter', () => {
    expect([10, 20, 40, 60, 80, 95].map((s) => (s < BALANCE.minScore ? 0 : BALANCE.strength(s)))).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('fighters subtract their stars: 5 against 2 leaves 3', () => {
    const sim = new DuelSim('gross', 1920, 0, mulberry32(1));
    const a = sim.spawn('A', 95, 1)!;
    const b = sim.spawn('B', 40, 2)!;
    b.lane = a.lane;
    run(sim, 30);
    const events = sim.drain();
    expect(events.filter((e) => e.type === 'pop' && e.fighter === b)).toHaveLength(1);
    expect(a.strength).toBeLessThanOrEqual(3);
    expect(events.filter((e) => e.type === 'strike' && e.by === a)).toHaveLength(2);
  });

  it('equal fighters both pop', () => {
    const sim = new DuelSim('gross', 1920, 0, mulberry32(2));
    const a = sim.spawn('A', 60, 1)!;
    const b = sim.spawn('B', 65, 2)!;
    b.lane = a.lane;
    run(sim, 20);
    expect(sim.fighters).toHaveLength(0);
  });

  it('every strike at the castle pops one bubble, then the fighter is exhausted', () => {
    const sim = new DuelSim('gross', 1920, 0, mulberry32(3));
    sim.castles.B.tank = 0;
    const before = sim.remaining('B');
    sim.spawn('A', 80, 1); // 4 stars
    run(sim, 60);
    const events = sim.drain();
    expect(events.filter((e) => e.type === 'bubblePop')).toHaveLength(4);
    expect(sim.remaining('B')).toBe(before - 4);
    expect(events.some((e) => e.type === 'pop' && e.exhausted)).toBe(true);
    expect(sim.stats.A.castleDamage).toBe(4);
  });

  it('the bubble machine refills the pile until the tank is empty', () => {
    const sim = new DuelSim('klein', 1920, 0);
    const c = sim.castles.A;
    c.pile = c.pile.map(() => 0);
    run(sim, (BALANCE.castle.klein.tank + 2) * BALANCE.machineEvery + 3);
    expect(c.tank).toBe(0);
    expect(c.pile.reduce((a, b) => a + b, 0)).toBe(BALANCE.castle.klein.tank);
    const ev = sim.drain();
    expect(ev.filter((e) => e.type === 'machineLaunch' && e.team === 'A')).toHaveLength(BALANCE.castle.klein.tank);
    expect(ev.filter((e) => e.type === 'bubbleLand' && e.team === 'A')).toHaveLength(BALANCE.castle.klein.tank);
  });

  it('the castle falls when pile and tank are empty', () => {
    const sim = new DuelSim('klein', 1920, 0);
    for (let i = 0; i < 8; i++) sim.spawn('B', 95, i);
    run(sim, 240);
    expect(sim.over).toBe('B');
    expect(sim.remaining('A')).toBe(0);
    expect(sim.drain().some((e) => e.type === 'castlePop' && e.team === 'A')).toBe(true);
  });

  it('scribbles do not spawn fighters but are counted', () => {
    const sim = new DuelSim('mittel', 1920, 0);
    expect(sim.spawn('A', 8, 1)).toBeNull();
    expect(sim.stats.A.written).toBe(1);
    expect(sim.drain().some((e) => e.type === 'scribble')).toBe(true);
  });

  it('equal classes win about equally often', () => {
    let a = 0;
    let b = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const r = mulberry32(seed);
      const sim = new DuelSim('klein', 1920, 0, r);
      for (let wave = 0; wave < 200 && !sim.over; wave++) {
        sim.spawn('A', 30 + Math.floor(r() * 65), wave);
        sim.spawn('B', 30 + Math.floor(r() * 65), 1000 + wave);
        for (let k = 0; k < 3 * 20; k++) sim.step(1 / 20);
      }
      if (sim.over === 'A') a++;
      else if (sim.over === 'B') b++;
    }
    // evenly matched classes take long (the time limit decides those), but neither side is favoured
    expect(a + b).toBeGreaterThan(70);
    expect(Math.abs(a - b)).toBeLessThan(25);
  });

  it('better letters win against the same number of sloppy ones', () => {
    let wins = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const r = mulberry32(seed);
      const sim = new DuelSim('klein', 1920, 0, r);
      for (let wave = 0; wave < 200 && !sim.over; wave++) {
        sim.spawn('A', 70 + Math.floor(r() * 30), wave);
        sim.spawn('B', 20 + Math.floor(r() * 40), 1000 + wave);
        for (let k = 0; k < 3 * 20; k++) sim.step(1 / 20);
      }
      if (sim.over === 'A') wins++;
    }
    expect(wins).toBeGreaterThanOrEqual(38);
  });

  it('decides by the remaining bubbles when the time is up', () => {
    const sim = new DuelSim('mittel', 1920, 40);
    sim.spawn('A', 95, 1);
    run(sim, 41);
    expect(sim.over).toBe('A');
  });
});

describe('Klasse gegen Riesenburg', () => {
  it('a fallen wall pauses for the stage sequence, the last wall wins the game', () => {
    const sim = new DuelSim('mittel', 1920, 0, mulberry32(5));
    sim.configureSiege([
      { pile: 3, tank: 0 },
      { pile: 3, tank: 0 },
    ]);
    expect(sim.remaining('B')).toBe(3);
    for (let i = 0; i < 2; i++) sim.spawn('A', 95, i);
    run(sim, 40);
    let ev = sim.drain();
    expect(ev.some((e) => e.type === 'stageClear' && e.stage === 0)).toBe(true);
    expect(sim.over).toBeNull();
    expect(sim.nextStage()).toBe(true);
    expect(sim.remaining('B')).toBe(3);
    run(sim, 40);
    ev = sim.drain();
    expect(sim.over).toBe('A');
    expect(ev.some((e) => e.type === 'castlePop' && e.team === 'B')).toBe(true);
    expect(sim.nextStage()).toBe(false);
  });

  it('guards hold their line and defend it', () => {
    const sim = new DuelSim('mittel', 1920, 0, mulberry32(6));
    sim.configureSiege([{ pile: 10, tank: 0 }]);
    const g = sim.spawn('B', 40, 1, { guard: true, holdX: 1200, lane: 2 })!;
    run(sim, 30);
    expect(Math.abs(g.x - 1200)).toBeLessThan(1);
    expect(g.state).toBe('wait');
    sim.spawn('A', 95, 2, { lane: 2 });
    run(sim, 40);
    expect(sim.fighters.includes(g)).toBe(false);
    // 5 stars - 2 for the guard = 3 bubbles popped at the castle
    expect(sim.stats.A.castleDamage).toBe(3);
  });
});

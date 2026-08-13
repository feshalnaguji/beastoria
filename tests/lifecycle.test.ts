/**
 * Life stages: pure math on age fraction. Creatures age each tick and move
 * through baby → juvenile → adult → elder. (Egg, birth, and passing arrive
 * with families in M4.)
 */
import { describe, expect, it } from 'vitest';
import { stageForAge } from '../src/sim/lifecycle';
import { SPECIES } from '../src/sim/species';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';

describe('stageForAge', () => {
  // Rabbit fractions: baby 0.12, juvenile 0.16 → adult until 0.83 → elder.
  const lifespan = 24000;

  it('maps age fractions to stages at the right boundaries', () => {
    expect(stageForAge('rabbit', 0, lifespan)).toBe('baby');
    expect(stageForAge('rabbit', lifespan * 0.11, lifespan)).toBe('baby');
    expect(stageForAge('rabbit', lifespan * 0.13, lifespan)).toBe('juvenile');
    expect(stageForAge('rabbit', lifespan * 0.3, lifespan)).toBe('adult');
    expect(stageForAge('rabbit', lifespan * 0.9, lifespan)).toBe('elder');
  });

  it('never goes past elder, even beyond lifespan', () => {
    expect(stageForAge('rabbit', lifespan * 2, lifespan)).toBe('elder');
  });
});

describe('aging in the world', () => {
  it('creatures age every tick and stages update', () => {
    const state = createWorld(21);
    const c = state.creatures[0];
    if (!c) throw new Error('no creature');
    c.ageTicks = 0;
    const before = c.ageTicks;
    tick(state, []);
    expect(c.ageTicks).toBe(before + 1);

    c.ageTicks = Math.floor(c.lifespanTicks * 0.5);
    tick(state, []);
    expect(c.stage).toBe('adult');
  });
});

describe('robins', () => {
  it('the world contains both rabbits and robins', () => {
    const state = createWorld(1);
    const species = new Set(state.creatures.map((c) => c.species));
    expect(species.has('rabbit')).toBe(true);
    expect(species.has('robin')).toBe(true);
  });

  it('robins have their own species params', () => {
    expect(SPECIES.robin).toBeDefined();
    expect(SPECIES.robin.speed).not.toBe(SPECIES.rabbit.speed);
  });

  it('the starting cast covers all four stages for the demo', () => {
    const state = createWorld(1234); // the shipped world seed
    const stages = new Set(state.creatures.map((c) => c.stage));
    for (const s of ['baby', 'juvenile', 'adult', 'elder']) {
      expect(stages.has(s as never)).toBe(true);
    }
  });
});

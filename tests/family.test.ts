/**
 * Family life: pairing, the family FSM, brooding, feeding young, dispersal,
 * gentle passing, and population caps. The heart of the terrarium.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';

function runTicks(state: WorldState, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

/** A world with exactly one eligible pair (and empty homes). */
function pairWorld(seed = 8, species: 'rabbit' | 'robin' = 'rabbit'): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  for (const h of state.homes) h.familyId = null;
  const m = spawnCreature(state, species, { x: 2000, y: 1500 }, 0.4);
  const f = spawnCreature(state, species, { x: 2080, y: 1520 }, 0.4);
  m.sex = 'm';
  f.sex = 'f';
  return state;
}

/** Tick until the (single) family reaches a phase, or fail. */
function runUntilPhase(state: WorldState, phase: string, maxTicks: number): void {
  for (let i = 0; i < maxTicks; i++) {
    tick(state, []);
    if (state.families[0]?.phase === phase) return;
  }
  throw new Error(`family never reached ${phase}`);
}

describe('state shape', () => {
  it('creatures have a sex; the world has families, homes, memorials, events', () => {
    const state = createWorld(1);
    expect(state.families).toEqual([]);
    expect(state.homes.length).toBeGreaterThan(4);
    expect(state.memorials).toEqual([]);
    expect(state.eventLog).toEqual([]);
    for (const c of state.creatures) {
      expect(['m', 'f']).toContain(c.sex);
    }
  });

  it('the starting cast has both sexes of each species (pairing is possible)', () => {
    const state = createWorld(1234);
    for (const species of ['rabbit', 'robin', 'deer', 'duck', 'koi', 'owl', 'dodo', 'phoenix'] as const) {
      const sexes = new Set(
        state.creatures.filter((c) => c.species === species).map((c) => c.sex),
      );
      expect(sexes.has('m')).toBe(true);
      expect(sexes.has('f')).toBe(true);
    }
  });
});

describe('pairing and the family FSM', () => {
  it('two nearby eligible adults pair into a courting family', () => {
    const state = pairWorld();
    runTicks(state, 600);
    expect(state.families.length).toBe(1);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    expect(fam.parentIds.length).toBe(2);
    expect(state.eventLog.some((e) => e.kind === 'paired')).toBe(true);
  });

  it('a family walks the phases in order and never skips to rearing', () => {
    const state = pairWorld();
    const seen: string[] = [];
    for (let i = 0; i < 6000; i++) {
      tick(state, []);
      const fam = state.families[0];
      if (fam && seen[seen.length - 1] !== fam.phase) seen.push(fam.phase);
      if (fam?.phase === 'rearing') break;
    }
    const rearingIdx = seen.indexOf('rearing');
    expect(rearingIdx).toBeGreaterThan(-1);
    expect(seen.slice(0, rearingIdx + 1)).toEqual([
      'courting',
      'nesting',
      'expecting',
      'rearing',
    ]);
  });

  it('nesting claims a home; children are born into the family', () => {
    const state = pairWorld();
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    expect(fam.homeId).not.toBeNull();
    expect(fam.childIds.length).toBeGreaterThanOrEqual(2);
    expect(state.eventLog.some((e) => e.kind === 'born')).toBe(true);
  });

  it('robin parents take brooding turns during expecting (egg mode alternates)', () => {
    const state = pairWorld(8, 'robin');
    const brooders = new Set<number>();
    for (let i = 0; i < 6000; i++) {
      tick(state, []);
      for (const c of state.creatures) {
        if (c.activity.id === 'brood') brooders.add(c.id);
      }
      if (state.families[0]?.phase === 'rearing') break;
    }
    expect(brooders.size).toBe(2);
    expect(state.eventLog.some((e) => e.kind === 'eggLaid')).toBe(true);
    expect(state.eventLog.some((e) => e.kind === 'hatched')).toBe(true);
  });

  // --- M13 Thread 1: live-birth gestation should not be shown as egg-brooding.
  // These pin the DESIRED behavior (a mammal mother lives her ordinary life for
  // the first ~70% of gestation, then settles home under a new 'gestate'
  // activity for the final ~30%) — the sim doesn't have this distinction yet,
  // so 4a/4b/4c are expected to FAIL until family.ts is changed (a later task).

  it('4a: a live-birth mother lives her ordinary life through early gestation (no brood pin)', () => {
    const state = pairWorld(8, 'rabbit');
    runUntilPhase(state, 'expecting', 6000);
    const fam = state.families[0];
    if (!fam || !fam.clutch) throw new Error('no clutch');
    const broodTicks = fam.clutch.broodTicksLeft;
    const lateThreshold = 0.3 * broodTicks;
    const seenActivities = new Set<string>();
    let iterations = 0;
    while (fam.clutch && fam.clutch.broodTicksLeft > lateThreshold && iterations < broodTicks + 10) {
      tick(state, []);
      iterations++;
      const mother = fam.parentIds
        .map((id) => state.creatures.find((c) => c.id === id))
        .find((c) => c?.sex === 'f');
      if (!mother) throw new Error('mother missing');
      expect(mother.activity.id).not.toBe('brood');
      seenActivities.add(mother.activity.id);
    }
    // She should be genuinely living her life via normal utility selection,
    // not merely "unpinned but stuck" — expect at least 2 distinct free
    // activities (forage/nap/wander/idle/socialize) across the window.
    expect(seenActivities.size).toBeGreaterThanOrEqual(2);
  });

  it('4b: in the final 30% of gestation she settles home under a new "gestate" activity', () => {
    const state = pairWorld(8, 'rabbit');
    runUntilPhase(state, 'expecting', 6000);
    const fam = state.families[0];
    if (!fam || !fam.clutch) throw new Error('no clutch');
    const broodTicks = fam.clutch.broodTicksLeft;
    const lateThreshold = 0.3 * broodTicks;
    const home = state.homes.find((h) => h.id === fam.homeId);
    if (!home) throw new Error('no home');
    let sawLatePhase = false;
    let lastDist = Infinity;
    for (let i = 0; i < broodTicks + 50 && fam.clutch; i++) {
      tick(state, []);
      if (!fam.clutch) break;
      if (fam.clutch.broodTicksLeft <= lateThreshold) {
        sawLatePhase = true;
        const mother = fam.parentIds
          .map((id) => state.creatures.find((c) => c.id === id))
          .find((c) => c?.sex === 'f');
        if (!mother) throw new Error('mother missing');
        expect(mother.activity.id as string).toBe('gestate');
        lastDist = Math.hypot(mother.pos.x - home.pos.x, mother.pos.y - home.pos.y);
      }
    }
    expect(sawLatePhase).toBe(true);
    expect(lastDist).toBeLessThan(40);
  });

  it('4c: the father never sits brood/gestate duty, and duty never rotates for a live-birth family', () => {
    const state = pairWorld(8, 'rabbit');
    runUntilPhase(state, 'expecting', 6000);
    const fam = state.families[0];
    if (!fam || !fam.clutch) throw new Error('no clutch');
    const broodTicks = fam.clutch.broodTicksLeft;
    const initialDutyParent = fam.dutyParent;
    for (let i = 0; i < broodTicks + 50 && fam.clutch; i++) {
      tick(state, []);
      const father = fam.parentIds
        .map((id) => state.creatures.find((c) => c.id === id))
        .find((c) => c?.sex === 'm');
      if (!father) throw new Error('father missing');
      expect(father.activity.id).not.toBe('brood');
      expect(father.activity.id as string).not.toBe('gestate');
      expect(fam.dutyParent).toBe(initialDutyParent);
    }
  });

  it('4d: a live birth emits "born" and never "eggLaid"', () => {
    const state = pairWorld(8, 'rabbit');
    runUntilPhase(state, 'rearing', 6000);
    expect(state.eventLog.some((e) => e.kind === 'born')).toBe(true);
    expect(state.eventLog.some((e) => e.kind === 'eggLaid')).toBe(false);
  });

  it('4e: a robin (egg-layer) is never seen in the live-birth "gestate" activity', () => {
    const state = pairWorld(8, 'robin');
    for (let i = 0; i < 6000; i++) {
      tick(state, []);
      for (const c of state.creatures) {
        expect(c.activity.id as string).not.toBe('gestate');
      }
      if (state.families[0]?.phase === 'rearing') break;
    }
  });

  it('hungry babies get fed by a parent (feedYoung reduces their hunger)', () => {
    const state = pairWorld();
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('family missing');
    const babies = state.creatures.filter((c) => fam.childIds.includes(c.id));
    expect(babies.length).toBeGreaterThan(0);
    for (const b of babies) b.needs.hunger = 0.9;
    runTicks(state, 1200);
    const hungers = state.creatures
      .filter((c) => fam.childIds.includes(c.id))
      .map((c) => c.needs.hunger);
    expect(Math.min(...hungers)).toBeLessThan(0.9);
  });

  it('babies stay near the family home', () => {
    const state = pairWorld();
    runTicks(state, 6000);
    const fam = state.families[0];
    if (!fam || fam.homeId === null) throw new Error('no family home');
    const home = state.homes.find((h) => h.id === fam.homeId);
    if (!home) throw new Error('home missing');
    runTicks(state, 800);
    for (const c of state.creatures) {
      if (c.familyId === fam.id && c.stage === 'baby') {
        const d = Math.hypot(c.pos.x - home.pos.x, c.pos.y - home.pos.y);
        expect(d).toBeLessThan(400);
      }
    }
  });

  it('children leave the family when they reach adulthood', () => {
    const state = pairWorld();
    runUntilPhase(state, 'rearing', 6000);
    const fam = state.families[0];
    if (!fam) throw new Error('no family');
    const childIds = [...fam.childIds];
    expect(childIds.length).toBeGreaterThan(0);
    // Fast-forward children to adulthood.
    for (const c of state.creatures) {
      if (childIds.includes(c.id)) {
        c.ageTicks = Math.floor(c.lifespanTicks * 0.5);
      }
    }
    runTicks(state, 400);
    const stillChildren = state.creatures.filter(
      (c) => childIds.includes(c.id) && c.familyId === fam.id,
    );
    expect(stillChildren.length).toBe(0);
    expect(fam.phase).toBe('emptyNest');
  });
});

describe('gentle passing', () => {
  it('an elder passes peacefully: removed, memorial planted, event logged', () => {
    const state = pairWorld();
    const elder = state.creatures[0];
    if (!elder) throw new Error('no creature');
    elder.ageTicks = elder.lifespanTicks - 50;
    runTicks(state, 800);
    expect(state.creatures.find((c) => c.id === elder.id)).toBeUndefined();
    expect(state.memorials.length).toBe(1);
    expect(state.eventLog.some((e) => e.kind === 'passed')).toBe(true);
  });
});

/** Fill the valley with unattached adult rabbits up to `total`. */
function fillRabbitsTo(state: WorldState, total: number): void {
  let i = 0;
  while (state.creatures.filter((c) => c.species === 'rabbit').length < total) {
    spawnCreature(state, 'rabbit', { x: 600 + (i % 5) * 120, y: 600 + Math.floor(i / 5) * 120 }, 0.4);
    i++;
  }
}

describe('the hard cap is a guarantee, not a tendency', () => {
  it('a valley that fills up while a pair is nest-building gets no clutch', () => {
    const state = pairWorld();
    runUntilPhase(state, 'nesting', 2000);
    fillRabbitsTo(state, 12); // rabbit hardCap
    runTicks(state, 600); // past NEST_TICKS: the clutch would be rolled here
    expect(state.creatures.filter((c) => c.species === 'rabbit').length).toBe(12);
    expect(state.families[0]?.phase).toBe('emptyNest');
    expect(state.families[0]?.clutch).toBeUndefined();
    expect(state.eventLog.some((e) => e.kind === 'born')).toBe(false);
  });

  it('a valley that fills up during gestation gets no birth', () => {
    const state = pairWorld();
    runUntilPhase(state, 'expecting', 3000);
    expect(state.families[0]?.clutch?.count).toBeGreaterThan(0);
    fillRabbitsTo(state, 12);
    runTicks(state, 800); // past broodTicks: the babies would arrive here
    expect(state.creatures.filter((c) => c.species === 'rabbit').length).toBe(12);
    expect(state.families[0]?.phase).toBe('emptyNest');
    expect(state.eventLog.some((e) => e.kind === 'born')).toBe(false);
  });
});

describe('population', () => {
  it('rabbit population never exceeds the hard cap over a long run', () => {
    const state = createWorld(77);
    for (let i = 0; i < 20000; i++) {
      tick(state, []);
      const rabbits = state.creatures.filter((c) => c.species === 'rabbit').length;
      expect(rabbits).toBeLessThanOrEqual(12);
    }
  }, 30000);
});

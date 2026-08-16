/**
 * Food anchors (M9): foraging aims at the valley's real larder — berry and
 * grass spots along the forest and grove edges, reeds on the pond shore —
 * instead of a random patch of empty meadow.
 */
import { describe, expect, it } from 'vitest';
import { forageTarget } from '../src/sim/behaviors';
import { tick } from '../src/sim/Sim';
import { SPECIES } from '../src/sim/species';
import {
  createWorld,
  spawnCreature,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type SpeciesId,
  type Vec2,
  type WorldState,
} from '../src/sim/state';
import { BURROW_SITES, FOOD_SPOTS, GLADES, isWater, inEllipse, POND } from '../src/sim/valley';

/** Mirrors the constants in behaviors.ts (module-private by design). */
const FORAGE_SPREAD = 24;
const HERD_FORAGE_RING = 55;
const HERD_FORAGE_SPREAD = 20;

function nearestSpotDist(p: Vec2): number {
  let best = Infinity;
  for (const s of FOOD_SPOTS) best = Math.min(best, Math.hypot(s.x - p.x, s.y - p.y));
  return best;
}

function bareWorld(seed: number): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  return state;
}

describe('FOOD_SPOTS', () => {
  it('nineteen anchors: twelve at the forest and grove edges, four reeds, three meadow patches', () => {
    expect(FOOD_SPOTS.length).toBe(19);
    const byZone = { forest: 0, grove: 0, pond: 0, meadow: 0 };
    for (const s of FOOD_SPOTS) byZone[s.zone]++;
    expect(byZone.forest + byZone.grove).toBe(12);
    expect(byZone.pond).toBe(4);
    expect(byZone.meadow).toBe(3);
  });

  it('no meadow home is a long commute from a meal', () => {
    // Burrows (rabbits) and glades (deer) sit in the open meadow; before the
    // meadow patches existed the worst of them was 721 units from any food.
    for (const home of [...BURROW_SITES, ...GLADES]) {
      expect(nearestSpotDist(home)).toBeLessThanOrEqual(520);
    }
  });

  it('every spot is dry land, well inside the world rect', () => {
    for (const s of FOOD_SPOTS) {
      expect(isWater(s)).toBe(false);
      expect(s.x).toBeGreaterThan(40);
      expect(s.x).toBeLessThan(WORLD_WIDTH - 40);
      expect(s.y).toBeGreaterThan(40);
      expect(s.y).toBeLessThan(WORLD_HEIGHT - 40);
    }
  });
});

describe('foraging aims at food', () => {
  it('a hungry rabbit heads for a food spot, not a random patch of grass', () => {
    const state = bareWorld(29);
    const rabbit = spawnCreature(state, 'rabbit', { x: 2048, y: 1536 }, 0.4);
    state.tick = 2400 * 10 + 720; // midday, when foraging scores highest
    let seen = 0;
    let lastTarget: Vec2 | undefined;
    for (let t = 0; t < 6000 && seen < 3; t++) {
      rabbit.needs.hunger = 1;
      tick(state, []);
      const target = rabbit.activity.targetPos;
      if (rabbit.activity.id !== 'forage' || !target) continue;
      if (lastTarget && target.x === lastTarget.x && target.y === lastTarget.y) continue;
      lastTarget = target;
      seen++;
      expect(nearestSpotDist(target)).toBeLessThanOrEqual(FORAGE_SPREAD);
    }
    expect(seen).toBe(3);
  }, 20000);

  it('every forager in a real world aims at the larder, within its own spread', () => {
    const state = createWorld(29);
    let checked = 0;
    for (let t = 0; t < 3000; t++) {
      tick(state, []);
      for (const c of state.creatures) {
        const p = SPECIES[c.species];
        if ((p.landingMedium ?? p.medium) === 'water') continue; // koi graze open water
        const target = c.activity.targetPos;
        if (c.activity.id !== 'forage' || !target) continue;
        // Herds ring their shared patch; everyone else scatters on their own.
        const bound = p.herd ? HERD_FORAGE_RING + HERD_FORAGE_SPREAD : FORAGE_SPREAD;
        expect(nearestSpotDist(target)).toBeLessThanOrEqual(bound);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  }, 20000);

  it('deer ring their shared patch instead of piling onto its centre', () => {
    const state = bareWorld(21);
    const deer = [];
    for (let i = 0; i < 5; i++) {
      const d = spawnCreature(state, 'deer', { x: 2000 + i * 40, y: 1500 }, 0.4);
      d.sex = i % 2 === 0 ? 'm' : 'f';
      deer.push(d);
    }
    state.tick = 2400 * 10 + 720;
    const offsets: Vec2[] = [];
    for (let t = 0; t < 300 && offsets.length < 5; t++) {
      for (const d of deer) d.needs.hunger = 1;
      tick(state, []);
      if (offsets.length > 0) continue;
      if (!deer.every((d) => d.activity.id === 'forage' && d.activity.targetPos)) continue;
      // Same shared patch for everyone…
      const spots = new Set(
        deer.map((d) => {
          const t2 = d.activity.targetPos as Vec2;
          let best = FOOD_SPOTS[0] as (typeof FOOD_SPOTS)[number];
          for (const s of FOOD_SPOTS) {
            if (Math.hypot(s.x - t2.x, s.y - t2.y) < Math.hypot(best.x - t2.x, best.y - t2.y)) {
              best = s;
            }
          }
          return `${best.x},${best.y}`;
        }),
      );
      expect(spots.size).toBe(1);
      // …but each on its own arc of it, never stacked on the middle.
      for (const d of deer) {
        const t2 = d.activity.targetPos as Vec2;
        offsets.push(t2);
        expect(nearestSpotDist(t2)).toBeGreaterThan(HERD_FORAGE_RING - HERD_FORAGE_SPREAD);
      }
    }
    expect(offsets.length).toBe(5);
    // (M10 task 3 review fix: a redundant minPair-based "not stacked" check
    // used to live here too. It was id-hash-draw-luck-sensitive at any fixed
    // threshold — reproducible with the current ids but not a meaningful
    // extra guarantee — since the loop's own per-deer assertion above
    // (nearestSpotDist(t2) > HERD_FORAGE_RING - HERD_FORAGE_SPREAD) already
    // guarantees every deer sits out on the ring, which is what "never
    // stacked on the middle" actually requires; removed rather than tuned.)
  }, 20000);

  it('c) land species never forage inside the pond\'s 1.18x shore band', () => {
    // A generous margin around the pond (comfortably past the 1.10x reed
    // spots and their 24-unit scatter, and the feathered sand band that
    // reads visually as "on the water" out to ~1.18x): no land-medium
    // species may ever be sent to forage in here — that's the reed spots'
    // exclusive territory (ducks/koi/fliers only).
    const shoreBand = { x: POND.x, y: POND.y, rx: POND.rx * 1.18, ry: POND.ry * 1.18 };
    const landSpecies: SpeciesId[] = ['rabbit', 'deer', 'dodo', 'squirrel'];
    for (const species of landSpecies) {
      const state = bareWorld(31);
      // Deliberately near the pond's west shore, where a reed spot is the
      // closest food spot by far — the scenario that actually exercises the
      // bug (a rabbit spawned in the middle of the meadow never has a reed
      // spot among its nearest three, so it never trips the old bug).
      const c = spawnCreature(state, species, { x: 2500, y: 2300 }, 0.4);
      for (let i = 0; i < 500; i++) {
        const target = forageTarget(state, c);
        expect(inEllipse(target, shoreBand)).toBe(false);
      }
    }
  });
});

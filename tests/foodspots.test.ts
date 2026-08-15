/**
 * Food anchors (M9): foraging aims at the valley's real larder — berry and
 * grass spots along the forest and grove edges, reeds on the pond shore —
 * instead of a random patch of empty meadow.
 */
import { describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import {
  createWorld,
  spawnCreature,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Vec2,
  type WorldState,
} from '../src/sim/state';
import { FOOD_SPOTS, isWater } from '../src/sim/valley';

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
  it('sixteen anchors: twelve at the forest and grove edges, four in the reeds', () => {
    expect(FOOD_SPOTS.length).toBe(16);
    const byZone = { forest: 0, grove: 0, pond: 0, meadow: 0 };
    for (const s of FOOD_SPOTS) byZone[s.zone]++;
    expect(byZone.forest + byZone.grove).toBe(12);
    expect(byZone.pond).toBe(4);
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
      expect(nearestSpotDist(target)).toBeLessThanOrEqual(60);
    }
    expect(seen).toBe(3);
  }, 20000);
});

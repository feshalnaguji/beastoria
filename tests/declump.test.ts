/**
 * De-clumping: creatures approaching the same target settle into a loose
 * ring, not a straight queue. Deterministic (id-hash offsets, no RNG draws).
 */
import { describe, expect, it } from 'vitest';
import { idOffsetAngle } from '../src/sim/behaviors';
import { tick } from '../src/sim/Sim';
import { createWorld, spawnCreature, type Vec2, type WorldState } from '../src/sim/state';

function minPairwise(pos: Vec2[]): number {
  let min = Infinity;
  for (let a = 0; a < pos.length; a++) {
    for (let b = a + 1; b < pos.length; b++) {
      const pa = pos[a];
      const pb = pos[b];
      if (pa && pb) min = Math.min(min, Math.hypot(pa.x - pb.x, pa.y - pb.y));
    }
  }
  return min;
}

describe('idOffsetAngle', () => {
  it('is deterministic and spreads ids around the circle', () => {
    expect(idOffsetAngle(7)).toBe(idOffsetAngle(7));
    const angles = [1, 2, 3, 4, 5, 6, 7, 8].map(idOffsetAngle);
    for (const a of angles) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(Math.PI * 2);
    }
    // At least 5 of 8 land in distinct quadrants-ish buckets (spread, not clustered).
    const buckets = new Set(angles.map((a) => Math.floor(a / (Math.PI / 2))));
    expect(buckets.size).toBeGreaterThanOrEqual(3);
  });
});

/**
 * A creature's socialize partner is its NEAREST same-species neighbour, so a
 * crowd spawned shoulder-to-shoulder simply socializes with itself and never
 * approaches anything. To exercise the approach — the leg the ring changes —
 * each seeker gets its own run: same start point, same magnet, same bearing,
 * only the creature id differs. Without the ring every one of them would come
 * to rest on the identical spot (SOCIAL_RANGE × 0.7 due west of the magnet);
 * with it, they fan out around the partner.
 */
const RING_STOP = 90 * 0.7; // SOCIAL_RANGE * 0.7 — where the approach ends

function restingOffset(seekerId: number): Vec2 {
  const state: WorldState = createWorld(13);
  state.creatures = [];
  state.families = [];
  state.tick = 2400 * 10 + 720; // midday, when socializing scores highest
  const magnet = spawnCreature(state, 'rabbit', { x: 2000, y: 1500 }, 0.45);
  // Ids are hashed into the ring angle, so vary the seeker's id per run.
  state.nextId = seekerId;
  // A JUVENILE seeker: formPairs skips it (eligibleSingle requires 'adult'),
  // so the only way it ever reaches the magnet is the socialize approach.
  const seeker = spawnCreature(state, 'rabbit', { x: 1400, y: 1500 }, 0.2);
  expect(seeker.id).toBe(seekerId);
  expect(seeker.stage).toBe('juvenile');

  for (let i = 0; i < 400; i++) {
    magnet.needs = { hunger: 0, rest: 0, social: 0 };
    seeker.needs = { hunger: 0, rest: 0, social: 1 };
    tick(state, []);
    const offset = { x: seeker.pos.x - magnet.pos.x, y: seeker.pos.y - magnet.pos.y };
    if (Math.hypot(offset.x, offset.y) <= RING_STOP) {
      expect(seeker.activity.id).toBe('socialize');
      return offset;
    }
  }
  throw new Error(`seeker ${seekerId} never reached the magnet`);
}

describe('socializing settles into a ring, not a conga line', () => {
  it('four rabbits taking the same approach come to rest on different spots', () => {
    const offsets = [101, 102, 103, 104].map(restingOffset);
    for (const o of offsets) {
      const d = Math.hypot(o.x, o.y);
      expect(d).toBeGreaterThan(30); // nobody stands on top of their partner
      expect(d).toBeLessThanOrEqual(RING_STOP + 1);
    }
    // Ring-less, all four offsets would be the identical point (-63, 0).
    let maxPair = 0;
    for (let a = 0; a < offsets.length; a++) {
      for (let b = a + 1; b < offsets.length; b++) {
        const oa = offsets[a];
        const ob = offsets[b];
        if (oa && ob) maxPair = Math.max(maxPair, Math.hypot(oa.x - ob.x, oa.y - ob.y));
      }
    }
    expect(maxPair).toBeGreaterThan(30);
  }, 20000);
});

describe('family nest-building does not stack parents on one point', () => {
  it('four lonely rabbits pair off and nest-build spread, not collinear', () => {
    const state: WorldState = createWorld(13);
    state.creatures = [];
    state.families = [];
    const magnet = spawnCreature(state, 'rabbit', { x: 2000, y: 1500 }, 0.45);
    magnet.needs = { hunger: 0, rest: 0, social: 0 };
    const seekers: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = spawnCreature(state, 'rabbit', { x: 1400 + i * 10, y: 1500 }, 0.45);
      c.needs = { hunger: 0, rest: 0, social: 1 };
      seekers.push(c.id);
    }
    state.tick = 2400 * 10 + 720; // midday
    for (let i = 0; i < 600; i++) tick(state, []);
    // These four are adults: formPairs pairs them off with each other
    // immediately (they spawn well within PAIR_RANGE), so this measures the
    // spacing of the resulting nest-gather ring points.
    const pos = state.creatures.filter((c) => seekers.includes(c.id)).map((c) => c.pos);
    expect(minPairwise(pos)).toBeGreaterThan(18);
  }, 20000);
});

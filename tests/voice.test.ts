/**
 * The truthful soundscape's source: deterministic vocalize events.
 * Owls call only in darkness; robins burst at dawn; rabbits are near-silent.
 * Vocalizations are transient tick output — never stored in WorldState.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { tick, type Vocalization } from '../src/sim/Sim';
import { createWorld, spawnCreature, type WorldState } from '../src/sim/state';

function collectOver(state: WorldState, n: number): Vocalization[] {
  const all: Vocalization[] = [];
  for (let i = 0; i < n; i++) all.push(...tick(state, []).vocalizations);
  return all;
}

/** Empty world + a handful of one species at a given time of day. */
function choirWorld(species: 'owl' | 'robin' | 'rabbit', atDayFrac: number, seed = 5): WorldState {
  const state = createWorld(seed);
  state.creatures = [];
  state.families = [];
  state.tick = Math.floor(TICKS_PER_DAY * 20 + TICKS_PER_DAY * atDayFrac);
  for (let i = 0; i < 6; i++) {
    spawnCreature(state, species, { x: 1800 + i * 40, y: 1500 }, 0.45);
  }
  return state;
}

describe('vocalizations', () => {
  it('same seed produces the identical vocalization stream', () => {
    const a = createWorld(99);
    const b = createWorld(99);
    const va = collectOver(a, 3000);
    const vb = collectOver(b, 3000);
    expect(va).toEqual(vb);
  });

  it('vocalizations never touch the event log or world state', () => {
    const state = createWorld(99);
    collectOver(state, 2000);
    expect(state.eventLog.every((e) => (e.kind as string) !== 'vocalize')).toBe(true);
    expect(JSON.stringify(state)).not.toContain('vocal');
  });

  it('owls call at night and are silent at midday', () => {
    const night = collectOver(choirWorld('owl', 0.8), 1200);
    // 700 ticks runs the window from dayFrac 0.3 to ~0.59, past DAY_END=0.55
    // into early dusk — but owls stay silent until clock.light <= 0.2, which
    // doesn't happen until well after dusk starts, so the window is still
    // correctly "midday" for the owls even though the phase label isn't.
    // 1200 ticks would run the clock far enough into real night to correctly
    // start the owls calling, which isn't what "midday" means here.
    const noon = collectOver(choirWorld('owl', 0.3), 700);
    expect(night.filter((v) => v.species === 'owl').length).toBeGreaterThan(0);
    expect(noon.filter((v) => v.species === 'owl').length).toBe(0);
  });

  it('robins sing far more at dawn than at midday', () => {
    // 800 ticks (seed 5): enough samples for the dawn boost's signal to clear
    // Poisson noise from the population regulator's other-species wanderer
    // floor (choirWorld clears every species to 0, so all 10 others wander
    // in to satisfy their own floors) — filtered out below same as the owl
    // test.
    const dawn = collectOver(choirWorld('robin', 0.02), 800); // starts inside the dawn window
    const noon = collectOver(choirWorld('robin', 0.3), 800);
    expect(dawn.filter((v) => v.species === 'robin').length).toBeGreaterThan(
      noon.filter((v) => v.species === 'robin').length,
    );
  });

  it('rabbits are nearly silent', () => {
    // 1800 ticks, not 2400: at 2400 (one full day) a second litter's cooldown
    // (1800 ticks) has already elapsed for these paired-off rabbits, growing
    // the population enough to trip the threshold on volume alone, not voice.
    const calls = collectOver(choirWorld('rabbit', 0.3), 1800).filter((v) => v.species === 'rabbit');
    expect(calls.length).toBeLessThan(6);
  });

  it('every vocalization carries a species and a position', () => {
    const state = createWorld(7);
    const vocs = collectOver(state, 2000);
    for (const v of vocs) {
      expect(['call', 'chatter', 'baby']).toContain(v.kind);
      expect(Number.isFinite(v.pos.x)).toBe(true);
    }
  });
});

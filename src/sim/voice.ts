/**
 * Deterministic vocalizations (spec §4.5): the sim decides who calls when —
 * owls in darkness, robins in the dawn chorus — and the audio layer merely
 * plays what the world already said. Transient per-tick output; never stored.
 */
import type { Clock } from './clock';
import { nextFloat } from './rng';
import { SPECIES } from './species';
import type { SpeciesId, Vec2, WorldState } from './state';

export interface Vocalization {
  species: SpeciesId;
  kind: 'call' | 'chatter' | 'baby';
  pos: Vec2;
}

const CHATTER_RATE = 1 / 300; // while socializing or courting
const BABY_BEG_RATE = 1 / 400; // hungry babies pipe up

export function collectVocalizations(state: WorldState, clock: Clock): Vocalization[] {
  const out: Vocalization[] = [];
  for (const c of state.creatures) {
    const p = SPECIES[c.species];
    // Exactly one RNG draw per creature per tick keeps the stream deterministic.
    const roll = nextFloat(state.rng);

    if (c.stage === 'baby') {
      if (c.needs.hunger > 0.5 && roll < BABY_BEG_RATE) {
        out.push({ species: c.species, kind: 'baby', pos: { x: c.pos.x, y: c.pos.y } });
      }
      continue;
    }
    if (c.stage === 'juvenile') continue;

    if (c.activity.id === 'socialize' || c.activity.id === 'court') {
      if (roll < CHATTER_RATE) {
        out.push({ species: c.species, kind: 'chatter', pos: { x: c.pos.x, y: c.pos.y } });
      }
      continue;
    }

    const dayFactor = p.diurnal
      ? 0.15 + 0.85 * clock.light // diurnal voices soften but never fully sleep
      : clock.light <= 0.2
        ? 1
        : 0; // nocturnal voices are silent in daylight
    const dawnBoost = clock.phase === 'dawn' && p.voice.dawnMult ? p.voice.dawnMult : 1;
    if (roll < p.voice.rate * dayFactor * dawnBoost) {
      out.push({ species: c.species, kind: 'call', pos: { x: c.pos.x, y: c.pos.y } });
    }
  }
  return out;
}

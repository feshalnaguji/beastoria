/**
 * Turns the sim's vocalize events into actual sound, gated by audibility,
 * throttled per species so a chorus never becomes a wall. Variant choice is
 * cosmetic randomness (Math.random is fine outside the sim boundary).
 */
import type { Vocalization } from '../sim/Sim';
import type { AudioEngine } from './AudioEngine';
import type { Mix } from './Mixer';

const MIN_GAP_MS: Record<Vocalization['kind'], number> = { call: 900, chatter: 600, baby: 500 };
const AUDIBLE_FLOOR_DB = -26;

export class CallScheduler {
  private lastPlayed = new Map<string, number>();

  constructor(private engine: AudioEngine) {}

  onTick(vocs: Vocalization[], mix: Mix, nowMs: number): void {
    for (const v of vocs) {
      const gainDb = mix.callGainDb(v.pos);
      if (gainDb <= AUDIBLE_FLOOR_DB) continue;
      const key = v.species + ':' + v.kind;
      const last = this.lastPlayed.get(key) ?? -Infinity;
      if (nowMs - last < MIN_GAP_MS[v.kind]) continue;
      this.lastPlayed.set(key, nowMs);
      this.engine.playCall(v.species, v.kind, gainDb, Math.random());
    }
  }
}

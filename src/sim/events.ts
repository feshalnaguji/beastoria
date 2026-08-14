/**
 * Sim events: the world's diary. Consumed by the welcome-back card (M7) and
 * the call scheduler (M6). Ring-buffered in WorldState.eventLog.
 */
import type { SpeciesId, Vec2, WorldState } from './state';

export type SimEventKind =
  | 'paired'
  | 'nested'
  | 'eggLaid'
  | 'born'
  | 'hatched'
  | 'passed'
  | 'wandererArrived'
  | 'reborn';

export interface SimEvent {
  kind: SimEventKind;
  tick: number;
  species: SpeciesId;
  familyId?: number;
  pos?: Vec2;
  /** How many (eggs laid, babies born). */
  count?: number;
}

const LOG_CAP = 500;

export function emit(state: WorldState, event: SimEvent): void {
  state.eventLog.push(event);
  if (state.eventLog.length > LOG_CAP) state.eventLog.shift();
}

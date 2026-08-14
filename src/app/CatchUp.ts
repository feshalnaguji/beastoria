/**
 * Offline catch-up (spec §4.6): the valley drowses at quarter speed while
 * you're away, capped at two in-game days. Same Sim.tick as live play,
 * sliced into small time budgets so the dawn overlay never janks.
 */
import { TICKS_PER_DAY } from '../sim/clock';
import type { SimEvent } from '../sim/events';
import { tick } from '../sim/Sim';
import type { WorldState } from '../sim/state';

const AWAY_RATE = 0.25; // valley runs at quarter speed while unobserved
const MS_PER_TICK = 100;
const CAP_TICKS = 2 * TICKS_PER_DAY;

export function owedTicks(elapsedMs: number): number {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.min(CAP_TICKS, Math.floor((elapsedMs * AWAY_RATE) / MS_PER_TICK));
}

export function runCatchUp(
  state: WorldState,
  ticksOwed: number,
  budgetMs: number,
  nowFn: () => number,
): { done: boolean; ticksRun: number } {
  const start = nowFn();
  let ran = 0;
  while (ran < ticksOwed) {
    tick(state, []); // vocalizations from unobserved ticks drift away unheard
    ran++;
    if (nowFn() - start >= budgetMs) break;
  }
  return { done: ran >= ticksOwed, ticksRun: ran };
}

const KIND_PHRASES: Record<SimEvent['kind'], (species: string, count: number) => string> = {
  born: (s, c) => `${c} little ${s}${c > 1 ? 's were' : ' was'} born`,
  hatched: (s, c) => `${c} ${s} egg${c > 1 ? 's' : ''} hatched`,
  eggLaid: (s, c) => `a ${s} family laid ${c} egg${c > 1 ? 's' : ''}`,
  paired: (s) => `two ${s}s became a pair`,
  nested: (s) => `a ${s} family settled into a new home`,
  passed: (s) => `an elder ${s} passed peacefully`,
  wandererArrived: (s) => `a wandering ${s} found the valley`,
  reborn: () => `the phoenix rose again from soft embers`,
};

/** Up to six warm lines about what happened after `sinceTick`. */
export function summarizeEvents(events: SimEvent[], sinceTick: number): string[] {
  const fresh = events.filter((e) => e.tick > sinceTick);
  const lines: string[] = [];
  for (const e of fresh) {
    const phrase = KIND_PHRASES[e.kind];
    lines.push(phrase(e.species, e.count ?? 1));
  }
  if (lines.length === 0) return ['The valley dozed quietly in your absence.'];
  // Keep the card cozy: first five happenings plus a gentle tail if more.
  if (lines.length > 6) {
    const extra = lines.length - 5;
    return [...lines.slice(0, 5), `…and ${extra} other little happenings.`];
  }
  return lines;
}

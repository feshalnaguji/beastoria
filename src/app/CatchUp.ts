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

const INTEREST: Record<SimEvent['kind'], number> = {
  reborn: 7, born: 6, hatched: 6, passed: 5, paired: 4, eggLaid: 3, wandererArrived: 2, nested: 1,
};
const plural = (s: string, n: number): string => (n === 1 ? s : `${s}s`);
/** One warm line per (kind, species) group; `n` = events in the group, `count` = summed babies/eggs. */
const PHRASES: Record<SimEvent['kind'], (s: string, n: number, count: number) => string> = {
  born: (s, _n, c) => `${c} little ${plural(s, c)} ${c > 1 ? 'were' : 'was'} born`,
  hatched: (s, _n, c) => `${c} ${s} ${plural('egg', c)} hatched`,
  eggLaid: (s, n, c) => n > 1 ? `${n} ${s} families laid eggs` : `a ${s} family laid ${c} ${plural('egg', c)}`,
  paired: (s, n) => n > 1 ? `${n} new ${s} pairs formed` : `two ${s}s became a pair`,
  nested: (s, n) => n > 1 ? `${n} ${s} families settled into new homes` : `a ${s} family settled into a new home`,
  passed: (s, n) => n > 1 ? `${n} elder ${s}s passed peacefully` : `an elder ${s} passed peacefully`,
  wandererArrived: (s, n) => n > 1 ? `${n} wandering ${s}s found the valley` : `a wandering ${s} found the valley`,
  reborn: () => `the phoenix rose again from soft embers`,
};

/** Drain `ticksOwed` in 8 ms slices. Uses setTimeout while the tab is hidden (rAF never fires
 * there — a hidden tab used to stall the overlay forever). Never throws: a sim error logs and
 * resolves with whatever valid state was reached. */
export function drainCatchUp(
  state: WorldState,
  ticksOwed: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    let owed = ticksOwed;
    const total = ticksOwed;
    const step = (): void => {
      try {
        const res = runCatchUp(state, owed, 8, () => performance.now());
        owed -= res.ticksRun;
        onProgress?.(total - owed, total);
        if (!res.done && owed > 0) {
          if (document.hidden) setTimeout(step, 0);
          else requestAnimationFrame(step);
          return;
        }
      } catch (err) {
        console.warn('[catchup] aborted:', err);
      }
      resolve();
    };
    step();
  });
}

/** Up to six warm lines about what happened after `sinceTick`, ranked by
 * interest (reborn > born/hatched > passed > paired > eggLaid >
 * wandererArrived > nested) and grouped by (kind, species) so repeats
 * collapse into one line ("3 rabbit families settled into new homes"). */
export function summarizeEvents(events: SimEvent[], sinceTick: number): string[] {
  const groups = new Map<string, { kind: SimEvent['kind']; species: string; n: number; count: number }>();
  for (const e of events) {
    if (e.tick <= sinceTick) continue;
    if (!(e.kind in PHRASES)) continue; // unknown kind from a tampered/future save — skip, don't crash
    const key = `${e.kind}|${e.species}`;
    const g = groups.get(key) ?? { kind: e.kind, species: e.species, n: 0, count: 0 };
    g.n++;
    g.count += e.count ?? 1;
    groups.set(key, g);
  }
  const ranked = [...groups.values()].sort((a, b) => INTEREST[b.kind] - INTEREST[a.kind]);
  if (ranked.length === 0) return ['The valley dozed quietly in your absence.'];
  const lines = ranked.map((g) => PHRASES[g.kind](g.species, g.n, g.count));
  if (lines.length <= 6) return lines;
  const hiddenEvents = ranked.slice(5).reduce((sum, g) => sum + g.n, 0);
  return [...lines.slice(0, 5), `…and ${hiddenEvents} other little happenings.`];
}

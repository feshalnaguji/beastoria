# M7 — Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The valley remembers — versioned IndexedDB saves, autosave, offline catch-up at quarter speed (capped at 2 game-days), and a "While you were away…" card, per spec §4.6. Return the next day and the ducklings hatched while you were gone.

**Architecture:** `src/persist/` is a thin layer over `idb-keyval`: `SaveFile = { version, savedAtEpochMs, sim: WorldState }` (POJO passthrough — save IS the world state). A `migrations.ts` ordered chain guards future schema changes with frozen fixtures. Catch-up runs the same `Sim.tick` in 8ms budget chunks under a dawn overlay; the eventLog delta feeds the welcome-back card. Wall-clock time (`Date.now`) is only ever touched OUTSIDE `src/sim/` (persist/app layers), preserving sim purity.

**Tech Stack:** idb-keyval (MIT, ~600B), Vitest with `fake-indexeddb` for persist tests (MIT, dev-only), existing sim.

## Global Constraints

- `src/sim/` stays pure — persistence NEVER adds imports/fields to sim modules; `WorldState` is already a serializable POJO and must round-trip `JSON.parse(JSON.stringify(state))` byte-identically (guarded by the existing determinism test).
- Save = passthrough. No transformation of WorldState on save/load beyond JSON-safe structured clone; migrations only ever ADD defaulted fields or rename keys between versions.
- Catch-up rate: owed ticks = elapsed wall ms × 0.25 × (10 ticks / 1000 ms) = `elapsedMs / 400`, hard-capped at `2 * TICKS_PER_DAY = 4800` ticks. Catch-up uses the SAME `tick()` as live play (full fidelity; vocalizations from catch-up ticks are discarded).
- Autosave: every 30s on a tick boundary + on `visibilitychange → hidden` + `pagehide`. Save failures degrade silently (console.warn once) — a blocked IndexedDB must never crash the game (same rule as audio's localStorage guard).
- Migration discipline: `SAVE_VERSION` bumps ONLY with a paired `migrations[n]` entry and a frozen fixture test. v1 is the baseline (current WorldState shape incl. `lastWandererTick`).
- Mute stays in `localStorage` (sync access needed at AudioEngine construction; the spec's `beastoria.settings` idb key is deferred until a setting actually needs idb — documented deviation).
- Tests: sim + persist only, as ever. Persist tests use `fake-indexeddb` (add as devDependency).
- Zero cost: idb-keyval and fake-indexeddb are MIT.
- Commits end with trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Key existing interfaces (do not redefine)

- `tick(state, commands): TickOutput` in `src/sim/Sim.ts`; `TICK_MS = 100`; `TICKS_PER_DAY = 2400` in clock.ts.
- `WorldState` in `src/sim/state.ts` (`{ tick, rng, nextId, creatures, families, homes, memorials, eventLog, lastWandererTick }`); `createWorld(seed)`.
- `SimEvent` kinds: paired | nested | eggLaid | born | hatched | passed | wandererArrived | reborn (`src/sim/events.ts`).
- `GameLoop` (src/app/GameLoop.ts): fixed-step accumulator calling `onTick` / `onRender(alpha)`; main.ts owns construction.
- `Renderer.sync(state)` rebuilds views idempotently per tick — after catch-up, one `sync` brings visuals current.
- `Hud` (src/ui/Hud.ts) shows the sound chip top-right; WelcomeBack card must not collide with it (place it centered).

---

### Task 1: Persist core — schema, store, migrations (TDD with fake-indexeddb)

**Files:**
- Create: `src/persist/schema.ts`, `src/persist/migrations.ts`, `src/persist/store.ts`
- Create: `tests/persist.test.ts`, `tests/fixtures/save-v1.json`
- Modify: `package.json` (deps: `idb-keyval`; devDeps: `fake-indexeddb`)

**Interfaces:**
- Produces: `SAVE_VERSION = 1`; `interface SaveFile { version: number; savedAtEpochMs: number; sim: WorldState }` (schema.ts); `migrate(raw: unknown): SaveFile | null` (migrations.ts — returns null for unrecognizable data); `saveWorld(state: WorldState, nowMs: number): Promise<void>`, `loadSave(): Promise<SaveFile | null>`, `clearSave(): Promise<void>` (store.ts, key `beastoria.save`).

- [ ] **Step 1:** `npm i idb-keyval && npm i -D fake-indexeddb`. Commit lockfile changes with the code at the end of this task.
- [ ] **Step 2: Write the failing test** — `tests/persist.test.ts`:

```ts
/**
 * Persistence: versioned SaveFile round-trip through (fake) IndexedDB,
 * migration chain from frozen fixtures, corrupt-data resilience.
 */
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';
import { migrate } from '../src/persist/migrations';
import { SAVE_VERSION } from '../src/persist/schema';
import { clearSave, loadSave, saveWorld } from '../src/persist/store';
import fixtureV1 from './fixtures/save-v1.json';

function runTicks(state: ReturnType<typeof createWorld>, n: number): void {
  for (let i = 0; i < n; i++) tick(state, []);
}

beforeEach(async () => {
  await clearSave();
});

describe('save round-trip', () => {
  it('saves and loads an identical world', async () => {
    const state = createWorld(42);
    runTicks(state, 500);
    await saveWorld(state, 1_755_000_000_000);
    const save = await loadSave();
    expect(save).not.toBeNull();
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.savedAtEpochMs).toBe(1_755_000_000_000);
    expect(JSON.stringify(save?.sim)).toBe(JSON.stringify(state));
  });

  it('a loaded world resumes exactly like an unsaved one', async () => {
    const straight = createWorld(7);
    runTicks(straight, 2000);

    const first = createWorld(7);
    runTicks(first, 1000);
    await saveWorld(first, 0);
    const save = await loadSave();
    if (!save) throw new Error('save missing');
    const resumed = save.sim;
    runTicks(resumed, 1000);
    expect(JSON.stringify(resumed)).toBe(JSON.stringify(straight));
  });

  it('clearSave leaves nothing behind', async () => {
    await saveWorld(createWorld(1), 0);
    await clearSave();
    expect(await loadSave()).toBeNull();
  });
});

describe('migrations', () => {
  it('accepts the frozen v1 fixture', () => {
    const save = migrate(fixtureV1);
    expect(save).not.toBeNull();
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.sim.creatures.length).toBeGreaterThan(0);
  });

  it('rejects garbage without throwing', () => {
    expect(migrate(null)).toBeNull();
    expect(migrate(42)).toBeNull();
    expect(migrate({ version: 999, sim: {} })).toBeNull();
    expect(migrate({ hello: 'world' })).toBeNull();
  });

  it('loadSave survives a corrupt stored value', async () => {
    const { set } = await import('idb-keyval');
    await set('beastoria.save', { junk: true });
    expect(await loadSave()).toBeNull();
  });
});
```

- [ ] **Step 3: Generate the frozen fixture** — one-off node script (do not commit the script): build `createWorld(2026)` + 300 ticks via tsx/vitest environment, wrap as `{ version: 1, savedAtEpochMs: 1755000000000, sim: <state> }`, write `tests/fixtures/save-v1.json`. Simplest: a temporary test `it.only` that writes the file with `fs.writeFileSync`, run once, delete it. The fixture is FROZEN — never regenerate it after this task (it guards migration compatibility).
- [ ] **Step 4: Run to verify failure** — `npx vitest run tests/persist.test.ts` — FAIL (modules missing).
- [ ] **Step 5: Implement.**

`src/persist/schema.ts`:

```ts
/**
 * SaveFile: the versioned envelope around WorldState (spec §4.6).
 * Save = JSON passthrough of the sim's POJO state; version bumps require
 * a migrations.ts entry + frozen fixture test, never casual edits.
 */
import type { WorldState } from '../sim/state';

export const SAVE_VERSION = 1;

export interface SaveFile {
  version: number;
  savedAtEpochMs: number;
  sim: WorldState;
}
```

`src/persist/migrations.ts`:

```ts
/**
 * Ordered migration chain: v(n) → v(n+1). Each step is a pure function.
 * migrate() walks unknown data up to SAVE_VERSION or returns null if the
 * data is unrecognizable — a bad save must never crash the game.
 */
import { SAVE_VERSION, type SaveFile } from './schema';
import type { WorldState } from '../sim/state';

/** v(n) → v(n+1) steps, indexed by source version. Empty until v2 exists. */
const STEPS: Record<number, (save: SaveFile) => SaveFile> = {};

export function migrate(raw: unknown): SaveFile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Partial<SaveFile>;
  if (
    typeof candidate.version !== 'number' ||
    candidate.version < 1 ||
    candidate.version > SAVE_VERSION ||
    typeof candidate.savedAtEpochMs !== 'number' ||
    typeof candidate.sim !== 'object' ||
    candidate.sim === null ||
    !Array.isArray((candidate.sim as WorldState).creatures)
  ) {
    return null;
  }
  let save = candidate as SaveFile;
  while (save.version < SAVE_VERSION) {
    const step = STEPS[save.version];
    if (!step) return null;
    save = step(save);
  }
  return save;
}
```

`src/persist/store.ts`:

```ts
/**
 * idb-keyval wrapper. Failures degrade to warnings — a blocked IndexedDB
 * (privacy mode) must never take the valley down.
 */
import { del, get, set } from 'idb-keyval';
import { migrate } from './migrations';
import { SAVE_VERSION, type SaveFile } from './schema';
import type { WorldState } from '../sim/state';

const SAVE_KEY = 'beastoria.save';

export async function saveWorld(state: WorldState, nowMs: number): Promise<void> {
  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAtEpochMs: nowMs,
    // Structured clone via JSON keeps the stored value detached from the live sim.
    sim: JSON.parse(JSON.stringify(state)) as WorldState,
  };
  try {
    await set(SAVE_KEY, file);
  } catch (err) {
    console.warn('[persist] save failed:', err);
  }
}

export async function loadSave(): Promise<SaveFile | null> {
  try {
    return migrate(await get(SAVE_KEY));
  } catch (err) {
    console.warn('[persist] load failed:', err);
    return null;
  }
}

export async function clearSave(): Promise<void> {
  try {
    await del(SAVE_KEY);
  } catch {
    /* nothing to clear */
  }
}
```

- [ ] **Step 6: Run tests** — `npx vitest run tests/persist.test.ts` PASS; full suite green; `npm run build`; `npm run lint`.
- [ ] **Step 7: Commit** — `feat: versioned saves — schema, idb store, migration chain, frozen v1 fixture`

---

### Task 2: Catch-up math + event summary (pure, sim-side-effect-free)

**Files:**
- Create: `src/app/CatchUp.ts`
- Test: `tests/catchup.test.ts`

**Interfaces:**
- Produces: `owedTicks(elapsedMs: number): number` (0.25× rate, capped 4800, floored, never negative); `runCatchUp(state, ticksOwed, budgetMs, nowFn): { done: boolean; ticksRun: number }` — runs up to `ticksOwed` ticks in slices bounded by `budgetMs` per call (caller re-invokes across frames); `summarizeEvents(events: SimEvent[], sinceTick: number): string[]` — human lines for the welcome-back card.

- [ ] **Step 1: Write the failing test** — `tests/catchup.test.ts`:

```ts
/**
 * Offline catch-up (spec §4.6): quarter-speed owed ticks capped at 2 game
 * days; chunked execution is equivalent to one straight run; the welcome-
 * back summary tells the story of the eventLog delta.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../src/sim/clock';
import { owedTicks, runCatchUp, summarizeEvents } from '../src/app/CatchUp';
import { tick } from '../src/sim/Sim';
import { createWorld } from '../src/sim/state';
import type { SimEvent } from '../src/sim/events';

describe('owedTicks', () => {
  it('runs at quarter speed: 400ms away = 1 tick owed', () => {
    expect(owedTicks(400)).toBe(1);
    expect(owedTicks(4000)).toBe(10);
  });
  it('caps at two game days', () => {
    expect(owedTicks(1000 * 60 * 60 * 24 * 7)).toBe(2 * TICKS_PER_DAY);
  });
  it('never goes negative or fractional', () => {
    expect(owedTicks(-5000)).toBe(0);
    expect(owedTicks(399)).toBe(0);
  });
});

describe('runCatchUp', () => {
  it('chunked catch-up equals one straight run', () => {
    const straight = createWorld(11);
    for (let i = 0; i < 3000; i++) tick(straight, []);

    const chunked = createWorld(11);
    let remaining = 3000;
    while (remaining > 0) {
      const res = runCatchUp(chunked, remaining, 1000, () => 0); // no real budget clock
      remaining -= res.ticksRun;
    }
    expect(JSON.stringify(chunked)).toBe(JSON.stringify(straight));
  });

  it('respects the time budget per slice', () => {
    const state = createWorld(11);
    let calls = 0;
    // A fake clock that exhausts the 8ms budget after 5 ticks.
    const nowFn = (): number => {
      calls++;
      return calls * 2;
    };
    const res = runCatchUp(state, 1000, 8, nowFn);
    expect(res.done).toBe(false);
    expect(res.ticksRun).toBeGreaterThan(0);
    expect(res.ticksRun).toBeLessThan(1000);
  });
});

describe('summarizeEvents', () => {
  it('tells the story since the save', () => {
    const events: SimEvent[] = [
      { kind: 'hatched', tick: 100, species: 'duck', count: 3 },
      { kind: 'hatched', tick: 900, species: 'robin', count: 2 },
      { kind: 'passed', tick: 950, species: 'rabbit' },
      { kind: 'wandererArrived', tick: 990, species: 'dodo' },
      { kind: 'reborn', tick: 995, species: 'phoenix' },
      { kind: 'born', tick: 50, species: 'rabbit', count: 4 }, // before the save — excluded
    ];
    const lines = summarizeEvents(events, 60);
    const text = lines.join('\n');
    expect(text).toContain('duck');
    expect(text).toContain('robin');
    expect(text).toContain('phoenix');
    expect(text).not.toContain('4');
    expect(lines.length).toBeLessThanOrEqual(6);
  });

  it('quiet days make a gentle line, not silence', () => {
    expect(summarizeEvents([], 0).length).toBe(1);
  });
});
```

- [ ] **Step 2: Verify failure**, then **Step 3: Implement** `src/app/CatchUp.ts`:

```ts
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
```

- [ ] **Step 4:** Tests pass; full suite; build; lint.
- [ ] **Step 5: Commit** — `feat: catch-up math and welcome-back storytelling (pure, chunk-safe)`

---

### Task 3: Autosave + boot flow + welcome-back card + dev reset

**Files:**
- Create: `src/ui/WelcomeBack.ts`
- Modify: `src/main.ts` (boot: load → migrate → catch-up → welcome card; autosave hooks), `src/app/DevPanel.ts` (a "reset valley" button calling clearSave + reload)

**Interfaces:**
- Consumes: Task 1 store, Task 2 CatchUp; `GameLoop`; `Renderer.sync`.
- Produces: boot sequence in main.ts; `showWelcomeBack(lines: string[]): void` (self-dismissing card, also closes on click).

- [ ] **Step 1: WelcomeBack card** — `src/ui/WelcomeBack.ts` (~55 lines, vanilla DOM, inline styles): centered card (max-width 340px, top 18%), warm parchment style (`rgba(252,247,235,.96)`, dark text 0x3a3a2e equivalent `#3a3a2e`, Georgia serif, border-radius 14px, soft shadow `0 8px 40px rgba(30,40,30,.35)`, padding 18px 22px), header "While you were away…", one `<p>` per line (margin 4px 0, font-size 14px), footer hint "(tap to continue)". Fades in over 400ms (opacity transition), dismisses on any pointerdown anywhere (remove element + listener), auto-dismisses after 14s. z-index 20 (above HUD chip). Export `showWelcomeBack(lines: string[]): void`; no-op if lines empty.
- [ ] **Step 2: Boot flow** in `src/main.ts` `start()` — replace `const state = createWorld(1234);` with:

```ts
  const save = await loadSave();
  const state = save ? save.sim : createWorld(1234);
  const sinceTick = state.tick;
  let owed = save ? owedTicks(Date.now() - save.savedAtEpochMs) : 0;
```

After `renderer.init` + initial `sync` + `centerOn`, and BEFORE `loop.start()`: if `owed > 0`, show a full-screen soft overlay div ("A new day drifts in…", same parchment style family, covering the canvas, opacity .92) and drain it across animation frames:

```ts
  await new Promise<void>((resolve) => {
    const drain = (): void => {
      const res = runCatchUp(state, owed, 8, () => performance.now());
      owed -= res.ticksRun;
      if (!res.done && owed > 0) requestAnimationFrame(drain);
      else resolve();
    };
    drain();
  });
  renderer.sync(state);
  showWelcomeBack(summarizeEvents(state.eventLog, sinceTick));
```

(Remove the overlay in the resolve path. Vocalizations from catch-up are discarded by design.)
- [ ] **Step 3: Autosave** — in main.ts: a tick counter in the GameLoop tick callback: every 300 ticks (30s at 1x) call `void saveWorld(state, Date.now())`. Plus:

```ts
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveWorld(state, Date.now());
  });
  window.addEventListener('pagehide', () => void saveWorld(state, Date.now()));
```

(Note: at 8x/64x dev speeds the 300-tick counter saves more often — fine and harmless.)
- [ ] **Step 4: DevPanel reset** — add a small "🌱 reset valley" button to DevPanel (follow its existing button styling): `void clearSave().then(() => location.reload());`. This is the tester's escape hatch and the user's fresh-start path.
- [ ] **Step 5:** Gates: full `npx vitest run` green; `npm run build`; `npm run lint`. Manual smoke via `npm run dev` if feasible (headless: skip, note it — the live functional review covers it post-deploy).
- [ ] **Step 6: Commit** — `feat: autosave, offline catch-up under a dawn overlay, welcome-back card, dev reset`

---

### Task 4: Milestone close-out

- [ ] **Step 1:** Full verification: `npm test` green, `npm run lint` clean, `npm run build` clean.
- [ ] **Step 2:** Update CLAUDE.md Current status: M7 done (versioned idb saves + migration chain + frozen fixture, autosave 30s/hidden/pagehide, quarter-speed catch-up capped 2 game-days under overlay, welcome-back card, dev reset); Next: M8 polish (grass sway/water shimmer/fireflies/dappled light, HUD clock, DPR cap, real-device perf pass, M5 review carry-forwards in docs/superpowers/reviews/2026-08-14-m5-visual-review.md, final deploy).
- [ ] **Step 3:** Commit `docs: M7 complete — the valley remembers` (no push; merge at branch finish).

## Self-review notes

- Spec §4.6 coverage: idb-keyval keys ✓ (save; settings deviation documented — mute stays localStorage), versioned SaveFile ✓, migration chain + frozen fixture ✓ (T1), autosave 30s/hidden/pagehide ✓ (T3), catch-up 0.25× capped 2 days, full fidelity, 8ms chunks, overlay ✓ (T2/T3), welcome-back from eventLog ✓ (T2/T3). Catch-up determinism test ✓ (T2 chunked ≡ straight; save/load replay ✓ T1).
- Type consistency: `SaveFile`/`SAVE_VERSION` (T1) consumed by store/migrations/main; `owedTicks`/`runCatchUp`/`summarizeEvents` (T2) consumed by main (T3); `showWelcomeBack` (T3).
- Risks: fake-indexeddb import order (`'fake-indexeddb/auto'` must be first import in the test file — it is); Date.now confined to main/persist (never sim); eventLog ring buffer (cap 500) means very eventful absences under-report — acceptable, the card says "little happenings".

# G2 "Shareable" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-player valley seeds with a `?valley=<seed>` share link + postcard image, a never-destructive visit mode for opening a friend's valley, and local-only naming of creatures and families.

**Architecture:** The seed and the names are *persist/app* concerns riding beside the sim state in a version-2 `SaveFile` (v1 saves migrate by stamping the legacy seed `1234`); `saveWorld` reads them from a module-level `setSaveMeta()` so no call site or existing test changes. A pure `share.ts` formats/parses the link. `main.ts`'s boot gains three branches: normal, adopt-from-link (no save yet), visit-from-link (save exists → in-memory world, saves suppressed, banner). A `NameBook` (`src/ui/names.ts`) wraps the existing name generators and is the single resolver used by the inspect card, home labels, and the welcome-back card. The share card composes a postcard from Pixi's extract API and delivers via Web Share / clipboard / download.

**Tech Stack:** TypeScript, Pixi 8 (`renderer.extract`), idb-keyval (existing), Vitest + fake-indexeddb (existing). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-19-g2-shareable-design.md` — read it first.

## Global Constraints

- **Nothing under `src/sim/` changes.** Sim events carry `familyId` but no creature id, so welcome-card naming is **family-level only** (spec §4 clarification: creature-level naming in the card would need a sim event change and is deferred).
- **Zero cost, no server, no new runtime dependencies.**
- **Child-directed posture:** names are local-only — never in the link, never rendered as text into the postcard, never transmitted. Link carries the seed only.
- **Never overwrite the child's own valley:** visit mode must never call `saveWorld` for a shared seed while a save exists; the DevPanel reset button is hidden in visit mode.
- Save format: `SAVE_VERSION` 1 → 2; migration stamps `seed: 1234` (`LEGACY_SEED`) and empty names; a frozen `tests/fixtures/save-v2.json` is added; existing tests keep passing (only additive test changes).
- Names: trimmed, internal whitespace collapsed, 1–20 chars (`NAME_MAX = 20`); blank clears the custom name.
- Link: `` `${SITE.baseUrl}?valley=${seed.toString(36)}` `` — parse accepts `^[0-9a-z]{1,7}$` and 0 ≤ n ≤ 0xffffffff only.
- Strict tsconfig + lint clean; `npm run build` clean. Run the suite as `npx vitest run --minWorkers=1 --maxWorkers=2` in the foreground on this memory-constrained machine; never background test runs.

## File Structure

- Modify: `src/persist/schema.ts` (v2 shape, `LEGACY_SEED`, `SaveNames`), `src/persist/migrations.ts` (STEPS[1], defensive defaults), `src/persist/store.ts` (`setSaveMeta`, seed/names in `saveWorld`)
- Create: `tests/fixtures/save-v2.json`; Modify: `tests/persist.test.ts` (append)
- Create: `src/app/share.ts` (pure link format/parse); Create: `tests/share.test.ts`
- Modify: `src/main.ts` (seeding, `?valley=` adopt/visit, banner, name book wiring, share wiring), `src/app/DevPanel.ts` (`allowReset` option)
- Create: `src/ui/names.ts` (`NameBook`, `normalizeName`, moved `creatureName`); Create: `tests/names.test.ts`
- Modify: `src/ui/InspectCard.ts` (display via NameBook; ✎ rename UI), `src/render/Renderer.ts` (`familyDisplayName` hook; `snapshot()`), `src/app/CatchUp.ts` (family-named phrases) + `tests/catchup.test.ts` (append)
- Create: `src/ui/postcard.ts` (canvas compositing), `src/ui/ShareCard.ts` (card + delivery); Modify: `src/ui/Hud.ts` (share pill)
- Modify: `CLAUDE.md`

---

### Task 1: Save v2 — seed + names in the save envelope

**Files:**
- Modify: `src/persist/schema.ts`, `src/persist/migrations.ts`, `src/persist/store.ts`
- Create: `tests/fixtures/save-v2.json`
- Test: `tests/persist.test.ts` (append only)

**Interfaces:**
- Produces: `SAVE_VERSION = 2`; `LEGACY_SEED = 1234`; `interface SaveNames { creatures: Record<number, string>; families: Record<number, string> }`; `SaveFile` gains `seed: number; names: SaveNames`; `emptyNames(): SaveNames`; `setSaveMeta(meta: { seed: number; names: SaveNames }): void` in `store.ts` (saveWorld snapshots `meta.names` by JSON clone at save time — callers keep mutating the same `names` object).

- [ ] **Step 1: Failing tests** — append to `tests/persist.test.ts`:

```ts
import fixtureV2 from './fixtures/save-v2.json';
import { LEGACY_SEED } from '../src/persist/schema';
import { setSaveMeta } from '../src/persist/store';

describe('save v2: seed + names', () => {
  it('migrates a v1 save by stamping the legacy seed and empty names', () => {
    const save = migrate(JSON.parse(JSON.stringify(fixtureV1)));
    expect(save?.version).toBe(SAVE_VERSION);
    expect(save?.seed).toBe(LEGACY_SEED);
    expect(save?.names).toEqual({ creatures: {}, families: {} });
  });

  it('accepts the frozen v2 fixture unchanged', () => {
    const save = migrate(JSON.parse(JSON.stringify(fixtureV2)));
    expect(save).toEqual(fixtureV2);
  });

  it('defaults a tampered v2 save that lost seed/names', () => {
    const raw = JSON.parse(JSON.stringify(fixtureV2));
    delete raw.seed;
    raw.names = { creatures: { 1: 42, 2: 'ok' } }; // non-string entry, missing families
    const save = migrate(raw);
    expect(save?.seed).toBe(LEGACY_SEED);
    expect(save?.names).toEqual({ creatures: { 2: 'ok' }, families: {} });
  });

  it('round-trips seed and names through saveWorld/loadSave', async () => {
    const state = createWorld(7);
    const names = { creatures: { 5: 'Biscuit' }, families: { 3: 'Sunny' } };
    setSaveMeta({ seed: 0xdeadbeef, names });
    await saveWorld(state, 1000);
    const loaded = await loadSave();
    expect(loaded?.seed).toBe(0xdeadbeef);
    expect(loaded?.names).toEqual(names);
    names.creatures[9] = 'Later'; // saved copy must be detached from the live object
    expect((await loadSave())?.names.creatures[9]).toBeUndefined();
  });
});
```
Run: `npx vitest run tests/persist.test.ts` → the four new tests FAIL (missing fixture/exports).

- [ ] **Step 2: `schema.ts`**

```ts
export const SAVE_VERSION = 2;
/** Every save written before v2 was created from this hardcoded seed. */
export const LEGACY_SEED = 1234;

export interface SaveNames {
  creatures: Record<number, string>;
  families: Record<number, string>;
}
export const emptyNames = (): SaveNames => ({ creatures: {}, families: {} });

export interface SaveFile {
  version: number;
  savedAtEpochMs: number;
  /** The createWorld() seed this valley was born from — what a share link carries. */
  seed: number;
  /** Player-given names, local-only (spec: never in links or postcards). */
  names: SaveNames;
  sim: WorldState;
}
```

- [ ] **Step 3: `migrations.ts`** — replace the empty `STEPS` with:

```ts
const STEPS: Record<number, (save: SaveFile) => SaveFile> = {
  // v1 → v2 (G2): every v1 valley was created from LEGACY_SEED; names start empty.
  1: (save) => ({ ...save, version: 2, seed: LEGACY_SEED, names: emptyNames() }),
};
```
and after the `while` loop add defensive defaulting (tampered/hand-edited v2 saves):

```ts
  if (typeof save.seed !== 'number' || !Number.isFinite(save.seed)) save.seed = LEGACY_SEED;
  save.names = sanitizeNames(save.names);
```
with

```ts
function sanitizeNames(raw: unknown): SaveNames {
  const out = emptyNames();
  if (typeof raw !== 'object' || raw === null) return out;
  for (const bucket of ['creatures', 'families'] as const) {
    const src = (raw as Record<string, unknown>)[bucket];
    if (typeof src !== 'object' || src === null) continue;
    for (const [id, name] of Object.entries(src as Record<string, unknown>)) {
      if (typeof name === 'string' && /^\d+$/.test(id)) out[bucket][Number(id)] = name;
    }
  }
  return out;
}
```
Import `LEGACY_SEED`, `emptyNames`, `SaveNames` from `./schema`. Note the `migrate()` guard `candidate.version > SAVE_VERSION` now allows 2.

- [ ] **Step 4: `store.ts`**

```ts
import { emptyNames, LEGACY_SEED, SAVE_VERSION, type SaveFile, type SaveNames } from './schema';

export interface SaveMeta { seed: number; names: SaveNames }
let meta: SaveMeta = { seed: LEGACY_SEED, names: emptyNames() };
/** Boot calls this once; the `names` object is shared with the NameBook and read live at each save. */
export function setSaveMeta(m: SaveMeta): void { meta = m; }
```
and in `saveWorld` build the file as `{ version: SAVE_VERSION, savedAtEpochMs: nowMs, seed: meta.seed, names: JSON.parse(JSON.stringify(meta.names)) as SaveNames, sim: … }`.

- [ ] **Step 5: Frozen v2 fixture** — generate once from the v1 fixture (PowerShell or node):

`node -e "const f=require('./tests/fixtures/save-v1.json');const o={version:2,savedAtEpochMs:f.savedAtEpochMs,seed:1234,names:{creatures:{},families:{}},sim:f.sim};require('fs').writeFileSync('tests/fixtures/save-v2.json',JSON.stringify(o,null,2)+'\n')"`

(The v2 "accepts unchanged" test relies on `migrate` being a no-op for a well-formed v2 file — sanitizeNames returns equal empty maps and the existing defensive passes are idempotent.)

- [ ] **Step 6: Verify + commit** — `npx vitest run tests/persist.test.ts` (all pass incl. the pre-existing round-trip/migration cases), `npm run lint`, `npx tsc --noEmit`. Commit: `feat: save v2 — per-valley seed + local names in the save envelope (G2 Task 1)`.

---

### Task 2: Share link module + boot flow (seeds, adopt, visit mode)

**Files:**
- Create: `src/app/share.ts`; Test: `tests/share.test.ts`
- Modify: `src/main.ts`, `src/app/DevPanel.ts`

**Interfaces:**
- Consumes: `LEGACY_SEED`, `emptyNames`, `setSaveMeta`, `suppressSaves` (Task 1 / existing); `SITE.baseUrl` from `src/content/site.ts`.
- Produces: `formatValleyUrl(seed: number): string`; `parseValleyParam(search: string): number | null`; `randomSeed(): number`; in `main.ts` the boot-scope consts `seed: number`, `visiting: boolean`, `names: SaveNames` (Tasks 4–5 wire into these; keep the names).

- [ ] **Step 1: Failing tests** — `tests/share.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatValleyUrl, parseValleyParam } from '../src/app/share';
import { SITE } from '../src/content/site';

describe('valley share links', () => {
  it('round-trips seeds through base36', () => {
    for (const seed of [0, 1, 1234, 0x7fffffff, 0xffffffff, 3141592653]) {
      const url = formatValleyUrl(seed);
      expect(url.startsWith(`${SITE.baseUrl}?valley=`)).toBe(true);
      expect(parseValleyParam(new URL(url).search)).toBe(seed);
    }
  });
  it('rejects junk and out-of-range values', () => {
    for (const s of ['', '?valley=', '?valley=hello!', '?valley=zzzzzzzz', '?valley=-5', '?other=1z']) {
      expect(parseValleyParam(s)).toBeNull();
    }
  });
});
```
Run: `npx vitest run tests/share.test.ts` → FAIL (module missing).

- [ ] **Step 2: `src/app/share.ts`**

```ts
/** Share links carry ONLY the world seed (spec: names never enter a URL). */
import { SITE } from '../content/site';

export function randomSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0; // app layer — Math.random is banned only inside src/sim
}

export function formatValleyUrl(seed: number): string {
  return `${SITE.baseUrl}?valley=${(seed >>> 0).toString(36)}`;
}

export function parseValleyParam(search: string): number | null {
  const raw = new URLSearchParams(search).get('valley');
  if (raw === null || !/^[0-9a-z]{1,7}$/.test(raw)) return null;
  const n = parseInt(raw, 36);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
}
```

- [ ] **Step 3: DevPanel option** — constructor gains a 4th param `private readonly opts: { allowReset?: boolean } = {}`; wrap the reset button creation in `if (this.opts.allowReset !== false) { … }`.

- [ ] **Step 4: Boot flow in `main.ts`** — replace the block from `const save = await loadSave();` through `const owed = …` with:

```ts
  const sharedSeed = parseValleyParam(location.search);
  const save = await loadSave();
  /** A friend's link opened by someone who already has a valley: live, in memory, never saved. */
  const visiting = sharedSeed !== null && save !== null;
  const adopting = sharedSeed !== null && save === null;
  const seed = sharedSeed ?? save?.seed ?? randomSeed();
  const fresh = visiting || save === null;
  const state = fresh ? createWorld(seed) : save.sim;
  const names = fresh ? emptyNames() : save.names;
  /** A fresh valley opens mid-morning, not at grey dawn — first screens should be sunny. */
  const MORNING_START_TICK = Math.round(0.2 * TICKS_PER_DAY);
  if (fresh) state.tick = MORNING_START_TICK;
  if (visiting) suppressSaves(); else setSaveMeta({ seed, names });
  const sinceTick = state.tick;
  const owed = save && !visiting ? owedTicks(Date.now() - save.savedAtEpochMs) : 0;
```
(Imports: `parseValleyParam, randomSeed` from './app/share'; `emptyNames` from './persist/schema'; `setSaveMeta, suppressSaves` from './persist/store'. `fresh` narrows `save` for TS in the non-fresh branch — if TS can't narrow through the boolean, use `save === null || visiting ? … : save.sim` inline.)

Then:
- `new DevPanel(state, loop, renderer, { allowReset: !visiting })`.
- Visibility handler: first line of the `visible` branch → `if (visiting) return;` (hidden branch's `saveWorld` is already a no-op under `suppressSaves`, but also skip recording `hiddenAt` when visiting).
- After `loop.start()`: replace the `if (!save)` hint with:

```ts
  if (visiting) {
    showVisitBanner();
  } else if (save === null) {
    showCard('Welcome to Beastoria', [
      ...(adopting ? ['This valley came from a friend’s link — it’s yours now.'] : []),
      'A calm little valley where creature families live their lives.',
      'Drag to look around · pinch or scroll to zoom in close.',
      'Tap any creature to meet them.',
    ]);
  }
```
and add near `showDawnOverlay`:

```ts
/** Visit mode: a friend's valley, running live but never saved over your own (spec G2 §3). */
function showVisitBanner(): void {
  const bar = document.createElement('div');
  bar.style.cssText = [...PILL_CSS, 'top:12px', 'left:50%', 'transform:translateX(-50%)', 'font-size:14px', 'white-space:nowrap'].join(';');
  bar.setAttribute('data-testid', 'visit-banner');
  bar.append('Visiting a friend’s valley · ');
  const back = document.createElement('a');
  back.href = './';
  back.textContent = '⟵ back to mine';
  back.style.cssText = 'color:#fff;text-decoration:underline;';
  bar.appendChild(back);
  document.body.appendChild(bar);
}
```
(`PILL_CSS` is exported from './ui/Hud'.)

- [ ] **Step 5: Verify + commit** — `npx vitest run tests/share.test.ts tests/persist.test.ts tests/catchup.test.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. Report a reasoned trace of the three boot branches (normal / adopt / visit). Commit: `feat: per-player seeds, ?valley= share-link parsing, adopt + visit mode boot (G2 Task 2)`.

---

### Task 3: NameBook — resolver for inspect card, home labels, welcome card

**Files:**
- Create: `src/ui/names.ts`; Test: `tests/names.test.ts`
- Modify: `src/ui/InspectCard.ts` (move `creatureName`/`familyPosition`/`CREATURE_NAMES` out; consume NameBook), `src/render/Renderer.ts:1156` (label via hook), `src/app/CatchUp.ts` + `tests/catchup.test.ts` (family-named phrases), `src/main.ts` (wire)

**Interfaces:**
- Consumes: `SaveNames` (Task 1); `familyName(id)` from Renderer; `names` const in main (Task 2).
- Produces: `NAME_MAX = 20`; `normalizeName(raw: string): string | null`; `class NameBook { constructor(readonly data: SaveNames); creature(state, c): string; family(id): string; customFamily(id): string | undefined; setCreature(id, raw): void; setFamily(id, raw): void; prune(state): void }`; `creatureName(state, c)` now exported from `names.ts`; `Renderer.familyDisplayName: (id: number) => string` (public field, default `familyName`); `Renderer.snapshot(): HTMLCanvasElement` is Task 5's, not here; `summarizeEvents(events, sinceTick, familyNameOf?: (id: number) => string | undefined)`; `InspectCard` constructor becomes `(onDismiss, names: NameBook)`.

- [ ] **Step 1: Failing tests** — `tests/names.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createWorld, spawnCreature } from '../src/sim/state';
import { NameBook, NAME_MAX, normalizeName, creatureName } from '../src/ui/names';
import { familyName } from '../src/render/Renderer';

describe('normalizeName', () => {
  it('trims, collapses whitespace, caps length, and clears blanks', () => {
    expect(normalizeName('  Biscuit  ')).toBe('Biscuit');
    expect(normalizeName('Big   Ears')).toBe('Big Ears');
    expect(normalizeName('x'.repeat(40))).toHaveLength(NAME_MAX);
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('')).toBeNull();
  });
});

describe('NameBook', () => {
  it('falls back to generated names and honours custom ones', () => {
    const state = createWorld(3);
    const c = state.creatures[0]!;
    const book = new NameBook({ creatures: {}, families: {} });
    expect(book.creature(state, c)).toBe(creatureName(state, c));
    expect(book.family(7)).toBe(familyName(7));
    book.setCreature(c.id, ' Biscuit ');
    book.setFamily(7, 'Sunny');
    expect(book.creature(state, c)).toBe('Biscuit');
    expect(book.family(7)).toBe('Sunny');
    expect(book.customFamily(7)).toBe('Sunny');
    expect(book.customFamily(8)).toBeUndefined();
    book.setCreature(c.id, '   '); // blank clears
    expect(book.creature(state, c)).toBe(creatureName(state, c));
    expect(book.data.creatures[c.id]).toBeUndefined();
  });

  it('prunes names whose creature or family is gone', () => {
    const state = createWorld(3);
    const alive = state.creatures[0]!;
    const book = new NameBook({ creatures: { [alive.id]: 'Keep', 99999: 'Gone' }, families: { 424242: 'Gone' } });
    book.prune(state);
    expect(book.data.creatures).toEqual({ [alive.id]: 'Keep' });
    expect(book.data.families).toEqual({});
  });
});
```
Run: `npx vitest run tests/names.test.ts` → FAIL.

- [ ] **Step 2: `src/ui/names.ts`** — move `CREATURE_NAMES`, `familyPosition`, and `creatureName` verbatim out of `InspectCard.ts` into this file (InspectCard then imports `creatureName` from './names'; grep for other importers of `creatureName` — none expected), and add:

```ts
import { familyName } from '../render/Renderer';
import type { SaveNames } from '../persist/schema';

export const NAME_MAX = 20;

/** Trim, collapse inner whitespace, cap at NAME_MAX; null means "no custom name". */
export function normalizeName(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return t.length > 0 ? t : null;
}

/** The single resolver for display names. `data` is the live save-side object (see setSaveMeta). */
export class NameBook {
  constructor(readonly data: SaveNames) {}
  creature(state: WorldState, c: Creature): string { return this.data.creatures[c.id] ?? creatureName(state, c); }
  family(id: number): string { return this.data.families[id] ?? familyName(id); }
  customFamily(id: number): string | undefined { return this.data.families[id]; }
  setCreature(id: number, raw: string): void { this.assign(this.data.creatures, id, raw); }
  setFamily(id: number, raw: string): void { this.assign(this.data.families, id, raw); }
  private assign(bucket: Record<number, string>, id: number, raw: string): void {
    const n = normalizeName(raw);
    if (n === null) delete bucket[id]; else bucket[id] = n;
  }
  /** Drop names for creatures/families that no longer exist. Called before each save. */
  prune(state: WorldState): void {
    const cs = new Set(state.creatures.map((c) => c.id));
    const fs = new Set(state.families.map((f) => f.id));
    for (const id of Object.keys(this.data.creatures)) if (!cs.has(Number(id))) delete this.data.creatures[Number(id)];
    for (const id of Object.keys(this.data.families)) if (!fs.has(Number(id))) delete this.data.families[Number(id)];
  }
}
```

- [ ] **Step 3: Consumers**
  - `InspectCard`: constructor `(onDismiss: () => void, names: NameBook)`; `show()` uses `this.names.creature(state, c)` for the name and `this.names.family(fam.id)` inside `creatureRole` (make `creatureRole` take the resolver: `creatureRole(state, c, familyOf: (id: number) => string)`).
  - `Renderer`: add `familyDisplayName: (id: number) => string = familyName;` and use it at the label: `` label.text = `The ${this.familyDisplayName(fam.id)} family`; `` (labels are re-set every sync, so renames show within a tick).
  - `CatchUp.summarizeEvents(events, sinceTick, familyNameOf?)`: while grouping, record `familyId` of the first event (`g.familyId = e.familyId`). When rendering a group with `n === 1` and `familyNameOf?.(g.familyId)` returns a name `f`, use: nested → `` `the ${f} family settled into a new home` ``; born → `` `the ${f} family welcomed ${c} little ${speciesPlural(s, c)}` ``; hatched → `` `${c} ${f} family ${plural('egg', c)} hatched` ``; eggLaid → `` `the ${f} family laid ${c} ${plural('egg', c)}` ``; other kinds unchanged. Append to `tests/catchup.test.ts`:

```ts
it('uses a family\'s custom name when a single event is theirs', () => {
  const events: SimEvent[] = [
    { kind: 'nested', tick: 100, species: 'rabbit', familyId: 7 },
    { kind: 'born', tick: 200, species: 'rabbit', familyId: 7, count: 3 },
    { kind: 'nested', tick: 300, species: 'deer', familyId: 8 },
  ];
  const lines = summarizeEvents(events, 60, (id) => (id === 7 ? 'Sunny' : undefined));
  expect(lines).toContain('the Sunny family welcomed 3 little rabbits');
  expect(lines).toContain('the Sunny family settled into a new home');
  expect(lines).toContain('a deer family settled into a new home');
  expect(summarizeEvents(events, 60)).toContain('3 little rabbits were born'); // no resolver → unchanged
});
```
  - `main.ts`: `const nameBook = new NameBook(names);` right after `names`; `renderer.familyDisplayName = (id) => nameBook.family(id);` after renderer init; `new InspectCard(() => dismissInspect(), nameBook)`; every `showWelcomeBack(summarizeEvents(state.eventLog, X))` → pass `(id) => nameBook.customFamily(id)` as the third arg; in the tick loop before `saveWorld` (autosave) and in the hidden/pagehide handlers call `nameBook.prune(state)` first (cheap: two Set builds per save).

- [ ] **Step 4: Verify + commit** — `npx vitest run tests/names.test.ts tests/catchup.test.ts tests/pages.test.ts tests/persist.test.ts`, lint, tsc, build. Commit: `feat: NameBook resolver — custom names in inspect card, home labels, welcome card (G2 Task 3)`.

---

### Task 4: Rename UI in the inspect card

**Files:**
- Modify: `src/ui/InspectCard.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `NameBook` (Task 3); `visiting` (Task 2).
- Produces: `InspectCard` constructor `(onDismiss, names, opts: { canRename: boolean })`; `InspectCard.isEditing(): boolean`.

- [ ] **Step 1: Editing state** — add `private editing: 'creature' | 'family' | null = null;` and `isEditing()`. In `show()`, when `this.editing !== null`, update only `doingEl` (the tick loop calls `show()` every tick; it must not clobber an open field).

- [ ] **Step 2: ✎ affordances** — when `opts.canRename`, after setting `nameEl` text append a small button `✎` (`aria-label="rename ${name}"`, font-size 13px, opacity .7, margin-left 6px, background none, border none, color inherit, cursor pointer). Clicking opens the inline editor in place of `nameEl`'s content: `<input type="text" maxlength="20" value="<current custom name or ''>" placeholder="<generated name>">` + `✓` and `✕` buttons; `Enter` saves, `Escape` cancels; the input's `keydown` and `pointerdown` call `stopPropagation()` (so Camera/DevPanel/window listeners — including the WelcomeBack dismiss-on-pointerdown — never see them; Camera already ignores INPUT targets, DevPanel's backtick toggle does not). Save → `names.setCreature(c.id, input.value)`, `editing = null`, re-render by calling `show()` with the same creature (keep `lastShown` args). Family: when the creature has a family, `roleEl` gets its own `✎` (`aria-label="rename the ${family} family"`) opening the same editor for `names.setFamily(fam.id, …)`; after saving, the home label updates on the next sync automatically (Task 3 hook).

- [ ] **Step 3: Wire** — `new InspectCard(() => dismissInspect(), nameBook, { canRename: !visiting })`. Focus the input on open (`input.focus(); input.select();`); on mobile the keyboard appears — the card is bottom-anchored with `env(safe-area-inset-bottom)` already.

- [ ] **Step 4: Verify + commit** — lint, tsc, build; `npx vitest run tests/names.test.ts` still green (no UI tests — the controller's browser pass covers rename/persist/blank-clears). Commit: `feat: rename creatures and families from the inspect card (G2 Task 4)`.

---

### Task 5: Share pill, share card, postcard

**Files:**
- Create: `src/ui/postcard.ts`, `src/ui/ShareCard.ts`
- Modify: `src/ui/Hud.ts`, `src/render/Renderer.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `formatValleyUrl` (Task 2); `seed`, `visiting` in main; `getClock`.
- Produces: `Renderer.snapshot(): HTMLCanvasElement`; `buildPostcard(frame: HTMLCanvasElement, caption: string, linkText: string): HTMLCanvasElement`; `canvasToPng(c: HTMLCanvasElement): Promise<Blob>`; `showShareCard(opts: { url: string; day: number; postcard: () => Promise<Blob> }): void`; `Hud.onShare?: () => void`.

- [ ] **Step 1: `Renderer.snapshot()`**

```ts
  /** The current frame as a canvas (Pixi extract), for the share postcard. */
  snapshot(): HTMLCanvasElement {
    return this.app.renderer.extract.canvas(this.app.stage) as HTMLCanvasElement;
  }
```

- [ ] **Step 2: `src/ui/postcard.ts`**

```ts
const WIDTH = 1200, BORDER = 24, CAPTION_H = 72;
const PAPER = '#f6f2e7', INK = '#3a4a33', INK_SOFT = '#6b7a5e';

export function buildPostcard(frame: HTMLCanvasElement, caption: string, linkText: string): HTMLCanvasElement {
  const innerW = WIDTH - BORDER * 2;
  const innerH = Math.round((frame.height / frame.width) * innerW);
  const out = document.createElement('canvas');
  out.width = WIDTH;
  out.height = innerH + BORDER * 2 + CAPTION_H;
  const g = out.getContext('2d')!;
  g.fillStyle = PAPER; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(frame, BORDER, BORDER, innerW, innerH);
  g.fillStyle = INK; g.font = '600 30px Georgia, serif'; g.textBaseline = 'middle';
  g.fillText(caption, BORDER, innerH + BORDER + CAPTION_H / 2);
  g.fillStyle = INK_SOFT; g.font = '22px Georgia, serif'; g.textAlign = 'right';
  g.fillText(linkText, WIDTH - BORDER, innerH + BORDER + CAPTION_H / 2);
  return out;
}

export function canvasToPng(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
```

- [ ] **Step 3: `src/ui/ShareCard.ts`** — a fixed, centred card (same look as WelcomeBack's: cream, Georgia, radius 14, shadow; z-index 20) that does NOT auto-dismiss; a `✕` (aria-label "close"); header "Share your valley"; a line "Friends who open this link get the same valley, from day 0."; a read-only `<input>` with the URL + **Copy link** button (`navigator.clipboard.writeText(url)` → button text "Copied!" for 1.5 s; on rejection, select the input text and say "Press Ctrl+C"); **Save postcard** button → `postcard()` → `<a download="beastoria-day-N.png" href=blobUrl>` click, revoke URL after; if `navigator.canShare?.({ files: [new File([blob], 'beastoria.png', { type: 'image/png' })] })` is true, show a **Share…** button first that calls `navigator.share({ files: [file], url, title: 'Beastoria' })` (must run in the click handler — build the blob first, then share; errors like AbortError are swallowed). Card dismisses on ✕ or Escape. Never includes names.

- [ ] **Step 4: HUD pill + wiring** — `Hud`: `onShare?: () => void`; a `🔗 share` pill (`role=button`, `tabindex=0`, `aria-label="share your valley"`, `top:96px left:12px`, click/Enter/Space → `this.onShare?.()`). In `main.ts` after `hud` exists (it needs `renderer` and `seed`):

```ts
  hud.onShare = () => {
    const day = getClock(state.tick).day;
    const url = formatValleyUrl(seed);
    showShareCard({
      url,
      day,
      postcard: () => canvasToPng(buildPostcard(renderer.snapshot(), `Beastoria · Day ${day}`, url.replace(/^https?:\/\//, ''))),
    });
  };
```

- [ ] **Step 5: Verify + commit** — lint, tsc, build; `npm run preview` + curl `/` shows the share pill markup. Commit: `feat: share pill, share card with link copy / native share, postcard image (G2 Task 5)`.

---

### Task 6: Verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1** — `npx vitest run --minWorkers=1 --maxWorkers=2` (expect 253 + new: persist 4, share 2, names 3, catchup 1 = 263 — report the real count), `npm run lint`, `npx tsc --noEmit`, `npm run build`; `git diff --stat main...HEAD -- src/sim` empty.
- [ ] **Step 2** — CLAUDE.md: Done entry **G2** (Shareable: per-player seeds + save v2 with legacy-seed migration, `?valley=` share links + postcard, adopt/visit mode, local-only creature/family naming; test count); Status: built on branch awaiting review/merge (controller flips at merge); Persistence note in Architecture: "`SaveFile` v2 = `{ version, savedAtEpochMs, seed, names, sim }`; seed/names are app/persist concerns set via `setSaveMeta()` — never in `WorldState`"; Growth-track section: G2 built, G3 next. Commit: `docs: G2 Shareable status + save v2 note (G2 Task 6)`.
- [ ] **Step 3 (controller, Playwright)** — fresh profile: `/?valley=<x>` adopts (IndexedDB save has that seed); profile with a save: `/?valley=<y>` shows the visit banner, runs, and the stored save's `savedAtEpochMs` is unchanged after 60 s + a tab-hide; share card: copy link matches `formatValleyUrl`, postcard PNG renders with caption; rename a creature and its family, reload → persisted; blank rename → generated name back; DevPanel has no reset button while visiting.

## Self-Review Notes

- Spec coverage: §1 seeds → T1/T2; §2 link + postcard → T2 (link) + T5 (card/postcard/delivery); §3 adopt/visit → T2 (banner, suppressSaves, no cards, reset hidden, visibility skip); §4 naming → T1 (storage), T3 (resolver + welcome card, family-level per constraint), T4 (UI); §5 tests → each task + T6 browser pass. Spec clarification recorded: welcome-card naming is family-level only (no creature ids on sim events).
- Type consistency: `SaveNames`/`emptyNames`/`LEGACY_SEED` (T1) used by T2/T3; `NameBook` API (T3) used by T4/main; `formatValleyUrl` (T2) used by T5; `familyDisplayName`/`snapshot` on Renderer (T3/T5).
- Known judgment calls: `setSaveMeta` module singleton instead of a `saveWorld` signature change (keeps four call sites and the persist tests untouched); `creatureName` moves to `names.ts` to avoid a circular import; visit mode disables renaming and the reset button rather than adding a second save slot.

# G3 "Child Mode" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sticky, parent-gated child mode for the family computer: fullscreen + keyboard lock, nothing leaves the valley, a hold-🔒-plus-grown-up-question exit, and a gentle play timer that ends on a sleep screen.

**Architecture:** Three pure, unit-tested modules carry all decisions — `childSettings.ts` (persisted settings + timer arithmetic), `parentGate.ts` (question generation + three-strike cooldown), `childKeys.ts` (which keys/cards to allow). A DOM controller `src/app/ChildMode.ts` owns the browser side (fullscreen, `navigator.keyboard.lock`, capture-phase key guard, context-menu/zoom/leave-page guards, heartbeat timer) and renders its cards from `src/ui/ChildCards.ts`. It talks to the rest of the app only through callbacks wired in `main.ts`; `Hud`, `DevPanel`, `ShareCard`, `AudioEngine` each gain one small hook. The sim and the save format are untouched.

**Tech Stack:** TypeScript, DOM APIs (Fullscreen, Keyboard Lock where present, `beforeunload`), Vitest (node env — pure modules only), Playwright for the controller's browser pass. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-26-g3-child-mode-design.md` — read it first.

## Global Constraints

- Nothing under `src/sim/` changes; `SaveFile` is unchanged — child state lives only in `localStorage['beastoria.child']`.
- No new dependencies. Strict tsconfig + `npm run lint` + `npm run build` clean.
- Vitest runs in the **node** environment: pure modules must not touch `window`/`document` at import time or in tested code paths (pass storage/random sources in).
- Parent gate: hold **3000 ms**; question `a × b`, `a, b ∈ 3..9`; **4** distinct options incl. the answer; **3** wrong in a row → **30 000 ms** cooldown.
- Timer choices: **15 / 30 / 45 / 60 min / no limit (null)**, default **30**; "+15 minutes"; only *visible* play time counts; persisted ≥ every 5 s and on hide/pagehide.
- Kept working in child mode: pan/zoom/tap/inspect/rename, mute chip, camera keys (arrows, `+ = - _`). Hidden: 🐾 creatures, 🔗 share, ⛶ fullscreen, 👪 child mode pills, DevPanel.
- Parent-facing copy about keyboard locking promises only: "holding Esc leaves full screen, child mode stays on" and "Ctrl+Alt+Del and power keys can't be blocked". No list of blocked shortcuts (not device-verifiable here).
- Machine note: run the suite as `npx vitest run --minWorkers=1 --maxWorkers=2` in the foreground; never background test runs.

## Review Focus

1. **Typing a creature's name while child mode is on** — letters, Backspace, Enter, Escape must reach the rename input; everything else stays swallowed. (Pinned: `shouldSwallowKey` tests, Task 1.)
2. **Private browsing / blocked storage** — `localStorage` throwing or holding junk must mean "child mode off", never a crash. (Pinned: `loadChildSettings` tests, Task 1.)
3. **"No limit" timer and zero/negative time slices** — `timerMin: null` never expires; non-positive elapsed ms is ignored. (Pinned: timer tests, Task 1.)
4. **Browsers without fullscreen (Firefox Android, iPhone)** — the tap-to-start card must be dismissible by a tap and must not reappear in a loop. (Pinned: `shouldShowTapCard` tests, Task 1.)
5. **Starting child mode with the share card or DevPanel already open** — both must close/hide immediately. (Pinned: controller browser pass, Task 5 Step 3.)

## File Structure

- Create: `src/app/childSettings.ts`, `src/app/parentGate.ts`, `src/app/childKeys.ts` (pure); `tests/child.test.ts`
- Create: `src/app/ChildMode.ts` (controller), `src/ui/ChildCards.ts` (DOM cards)
- Modify: `src/ui/Hud.ts` (child pill + `setChildMode`), `src/app/DevPanel.ts` (`setLocked`), `src/ui/ShareCard.ts` (`closeShareCard`), `src/audio/AudioEngine.ts` (`setSleeping`), `src/main.ts` (wiring), `CLAUDE.md`

---

### Task 1: Pure logic — settings, timer, gate, key/card policy

**Files:**
- Create: `src/app/childSettings.ts`, `src/app/parentGate.ts`, `src/app/childKeys.ts`
- Test: `tests/child.test.ts`

**Interfaces:**
- Produces (exact):
  - `childSettings.ts`: `interface ChildSettings { on: boolean; timerMin: number | null; playedMs: number; expired: boolean }`; `interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }`; `CHILD_KEY = 'beastoria.child'`; `TIMER_CHOICES: readonly (number | null)[] = [15, 30, 45, 60, null]`; `DEFAULT_TIMER_MIN = 30`; `offSettings(): ChildSettings`; `browserStore(): KeyValueStore | null`; `loadChildSettings(store: KeyValueStore | null): ChildSettings`; `saveChildSettings(s: ChildSettings, store: KeyValueStore | null): void`; `addPlayTime(s: ChildSettings, ms: number): boolean` (true only on the call that crosses into expiry); `setTimer(s: ChildSettings, min: number | null): void` (restarts the count); `extendTimer(s: ChildSettings, minutes: number): void`.
  - `parentGate.ts`: `interface GateQuestion { a: number; b: number; answer: number; options: number[] }`; `HOLD_MS = 3000`; `MAX_STRIKES = 3`; `COOLDOWN_MS = 30000`; `makeQuestion(rand: () => number): GateQuestion`; `interface GateState { strikes: number; lockedUntil: number }`; `newGateState(): GateState`; `gateLocked(s: GateState, nowMs: number): boolean`; `answerGate(s: GateState, q: GateQuestion, choice: number, nowMs: number): 'correct' | 'wrong' | 'locked'`.
  - `childKeys.ts`: `CAMERA_KEYS: ReadonlySet<string>`; `shouldSwallowKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }, targetTag: string | null): boolean`; `shouldShowTapCard(s: { on: boolean; expired: boolean; fullscreenEnabled: boolean; isFullscreen: boolean; overlayOpen: boolean }): boolean`.

- [ ] **Step 1: Failing tests** — create `tests/child.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  addPlayTime, CHILD_KEY, DEFAULT_TIMER_MIN, extendTimer, loadChildSettings, offSettings,
  saveChildSettings, setTimer, type ChildSettings, type KeyValueStore,
} from '../src/app/childSettings';
import { answerGate, COOLDOWN_MS, gateLocked, makeQuestion, newGateState } from '../src/app/parentGate';
import { shouldShowTapCard, shouldSwallowKey } from '../src/app/childKeys';

const memStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const seq = (xs: number[]) => { let i = 0; return () => xs[i++ % xs.length]!; };
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0; let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('child settings', () => {
  it('defaults to off, round-trips, and survives junk or a throwing store', () => {
    expect(loadChildSettings(null)).toEqual(offSettings());
    const store = memStore();
    expect(loadChildSettings(store)).toEqual(offSettings());
    const s: ChildSettings = { on: true, timerMin: 45, playedMs: 1234, expired: false };
    saveChildSettings(s, store);
    expect(loadChildSettings(store)).toEqual(s);
    store.data.set(CHILD_KEY, '{not json');
    expect(loadChildSettings(store)).toEqual(offSettings());
    store.data.set(CHILD_KEY, JSON.stringify({ on: 'yes', timerMin: -3, playedMs: 'x' }));
    expect(loadChildSettings(store)).toEqual(offSettings());
    const throwing: KeyValueStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadChildSettings(throwing)).toEqual(offSettings());
    expect(() => saveChildSettings(s, throwing)).not.toThrow();
  });

  it('accumulates play time, expires once, and handles no-limit / bad slices', () => {
    const s: ChildSettings = { on: true, timerMin: 1, playedMs: 0, expired: false };
    expect(addPlayTime(s, 0)).toBe(false);
    expect(addPlayTime(s, -500)).toBe(false);
    expect(s.playedMs).toBe(0);
    expect(addPlayTime(s, 59_000)).toBe(false);
    expect(addPlayTime(s, 1_000)).toBe(true);
    expect(s.expired).toBe(true);
    expect(addPlayTime(s, 5_000)).toBe(false); // already expired: no second crossing, no growth
    const free: ChildSettings = { on: true, timerMin: null, playedMs: 0, expired: false };
    expect(addPlayTime(free, 10 * 3_600_000)).toBe(false);
    expect(free.expired).toBe(false);
    const off = offSettings();
    expect(addPlayTime(off, 5_000)).toBe(false);
    expect(off.playedMs).toBe(0);
  });

  it('extendTimer adds minutes and un-expires; setTimer restarts the count', () => {
    const s: ChildSettings = { on: true, timerMin: 30, playedMs: 30 * 60_000, expired: true };
    extendTimer(s, 15);
    expect(s).toEqual({ on: true, timerMin: 45, playedMs: 30 * 60_000, expired: false });
    setTimer(s, 15);
    expect(s).toEqual({ on: true, timerMin: 15, playedMs: 0, expired: false });
    setTimer(s, null);
    expect(s.timerMin).toBeNull();
    extendTimer(s, 15); // no-op without a limit
    expect(s.timerMin).toBeNull();
    expect(offSettings().timerMin).toBe(DEFAULT_TIMER_MIN);
  });
});

describe('parent gate', () => {
  it('always offers four distinct options including the answer, factors 3..9', () => {
    const rand = mulberry(7);
    for (let i = 0; i < 500; i++) {
      const q = makeQuestion(rand);
      expect(q.a).toBeGreaterThanOrEqual(3); expect(q.a).toBeLessThanOrEqual(9);
      expect(q.b).toBeGreaterThanOrEqual(3); expect(q.b).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(q.a * q.b);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) expect(o).toBeGreaterThan(0);
    }
  });

  it('three wrong answers in a row lock the gate for the cooldown; a right one resets strikes', () => {
    const q = makeQuestion(seq([0.5, 0.5, 0.1, 0.9, 0.3, 0.7]));
    const wrong = q.options.find((o) => o !== q.answer)!;
    const s = newGateState();
    expect(answerGate(s, q, wrong, 0)).toBe('wrong');
    expect(answerGate(s, q, q.answer, 0)).toBe('correct');
    expect(s.strikes).toBe(0);
    expect(answerGate(s, q, wrong, 0)).toBe('wrong');
    expect(answerGate(s, q, wrong, 0)).toBe('wrong');
    expect(answerGate(s, q, wrong, 1_000)).toBe('locked');
    expect(gateLocked(s, 1_000 + COOLDOWN_MS - 1)).toBe(true);
    expect(answerGate(s, q, q.answer, 1_000 + COOLDOWN_MS - 1)).toBe('locked');
    expect(gateLocked(s, 1_000 + COOLDOWN_MS)).toBe(false);
    expect(answerGate(s, q, q.answer, 1_000 + COOLDOWN_MS)).toBe('correct');
  });
});

describe('child key and card policy', () => {
  const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) =>
    ({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

  it('lets camera keys through and swallows everything else on the page', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_']) {
      expect(shouldSwallowKey(k(key), 'CANVAS')).toBe(false);
    }
    for (const key of ['`', 'Escape', 'F5', 'Tab', 'a', ' ', 'Enter']) {
      expect(shouldSwallowKey(k(key), 'BODY')).toBe(true);
    }
    expect(shouldSwallowKey(k('ArrowLeft', { ctrlKey: true }), 'BODY')).toBe(true);
    expect(shouldSwallowKey(k('w', { ctrlKey: true }), 'BODY')).toBe(true);
  });

  it('lets typing reach a text input (rename) but not shortcuts', () => {
    for (const key of ['B', 'i', '7', ' ', 'Backspace', 'Delete', 'Enter', 'Escape', 'ArrowLeft', 'Home', 'End']) {
      expect(shouldSwallowKey(k(key), 'INPUT')).toBe(false);
    }
    expect(shouldSwallowKey(k('w', { ctrlKey: true }), 'INPUT')).toBe(true);
    expect(shouldSwallowKey(k('Tab'), 'INPUT')).toBe(true);
    expect(shouldSwallowKey(k('F5'), 'INPUT')).toBe(true);
  });

  it('shows the tap card only when it can do something and nothing else is up', () => {
    const base = { on: true, expired: false, fullscreenEnabled: true, isFullscreen: false, overlayOpen: false };
    expect(shouldShowTapCard(base)).toBe(true);
    expect(shouldShowTapCard({ ...base, on: false })).toBe(false);
    expect(shouldShowTapCard({ ...base, expired: true })).toBe(false);
    expect(shouldShowTapCard({ ...base, isFullscreen: true })).toBe(false);
    expect(shouldShowTapCard({ ...base, overlayOpen: true })).toBe(false);
    expect(shouldShowTapCard({ ...base, fullscreenEnabled: false })).toBe(false); // no fullscreen API: never loop
  });
});
```
Run: `npx vitest run tests/child.test.ts` → FAIL (modules missing).

- [ ] **Step 2: `src/app/childSettings.ts`**

```ts
/** Child-mode settings: device-local, never in the save file, never sent anywhere. */
export interface ChildSettings { on: boolean; timerMin: number | null; playedMs: number; expired: boolean }
export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void }

export const CHILD_KEY = 'beastoria.child';
export const TIMER_CHOICES: readonly (number | null)[] = [15, 30, 45, 60, null];
export const DEFAULT_TIMER_MIN = 30;

export const offSettings = (): ChildSettings => ({ on: false, timerMin: DEFAULT_TIMER_MIN, playedMs: 0, expired: false });

/** localStorage, or null where the browser forbids it (privacy modes) or there is no window (tests). */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadChildSettings(store: KeyValueStore | null): ChildSettings {
  try {
    const raw = store?.getItem(CHILD_KEY);
    if (!raw) return offSettings();
    const p = JSON.parse(raw) as Partial<Record<keyof ChildSettings, unknown>>;
    const timerOk = p.timerMin === null || (typeof p.timerMin === 'number' && p.timerMin > 0);
    const playedOk = typeof p.playedMs === 'number' && Number.isFinite(p.playedMs) && p.playedMs >= 0;
    if (typeof p.on !== 'boolean' || !timerOk || !playedOk || typeof p.expired !== 'boolean') return offSettings();
    return { on: p.on, timerMin: p.timerMin as number | null, playedMs: p.playedMs as number, expired: p.expired };
  } catch {
    return offSettings();
  }
}

export function saveChildSettings(s: ChildSettings, store: KeyValueStore | null): void {
  try {
    store?.setItem(CHILD_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: child mode simply won't be sticky this session */
  }
}

/** Adds visible play time. Returns true only on the call that crosses into expiry. */
export function addPlayTime(s: ChildSettings, ms: number): boolean {
  if (!s.on || s.expired || !(ms > 0)) return false;
  s.playedMs += ms;
  if (s.timerMin !== null && s.playedMs >= s.timerMin * 60_000) {
    s.expired = true;
    return true;
  }
  return false;
}

/** Picking a timer in the grown-ups panel starts a fresh count. */
export function setTimer(s: ChildSettings, min: number | null): void {
  s.timerMin = min;
  s.playedMs = 0;
  s.expired = false;
}

export function extendTimer(s: ChildSettings, minutes: number): void {
  if (s.timerMin === null) return;
  s.timerMin += minutes;
  s.expired = s.playedMs >= s.timerMin * 60_000;
}
```

- [ ] **Step 3: `src/app/parentGate.ts`**

```ts
/** A grown-up question a 4–8 year old can't answer by tapping around. */
export interface GateQuestion { a: number; b: number; answer: number; options: number[] }
export interface GateState { strikes: number; lockedUntil: number }

export const HOLD_MS = 3000;
export const MAX_STRIKES = 3;
export const COOLDOWN_MS = 30_000;

export function makeQuestion(rand: () => number): GateQuestion {
  const pick = () => 3 + Math.floor(rand() * 7); // 3..9
  const a = pick();
  const b = pick();
  const answer = a * b;
  const opts = new Set<number>([answer]);
  for (const c of [answer + a, answer - b, answer + 10, answer - 10, (a + 1) * b, a * (b + 1), answer + 1]) {
    if (opts.size === 4) break;
    if (c > 0) opts.add(c);
  }
  for (let n = 2; opts.size < 4; n++) opts.add(answer + n);
  const options = [...opts];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [options[i], options[j]] = [options[j]!, options[i]!];
  }
  return { a, b, answer, options };
}

export const newGateState = (): GateState => ({ strikes: 0, lockedUntil: 0 });
export const gateLocked = (s: GateState, nowMs: number): boolean => nowMs < s.lockedUntil;

export function answerGate(s: GateState, q: GateQuestion, choice: number, nowMs: number): 'correct' | 'wrong' | 'locked' {
  if (gateLocked(s, nowMs)) return 'locked';
  if (choice === q.answer) {
    s.strikes = 0;
    return 'correct';
  }
  s.strikes++;
  if (s.strikes >= MAX_STRIKES) {
    s.strikes = 0;
    s.lockedUntil = nowMs + COOLDOWN_MS;
    return 'locked';
  }
  return 'wrong';
}
```

- [ ] **Step 4: `src/app/childKeys.ts`**

```ts
/** Which keys a child may use, and when the tap-to-start card is worth showing. Pure. */
export const CAMERA_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_']);
const EDITING_KEYS = new Set(['Backspace', 'Delete', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

export function shouldSwallowKey(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  targetTag: string | null,
): boolean {
  if (e.ctrlKey || e.metaKey || e.altKey) return true;
  if (targetTag === 'INPUT' && (e.key.length === 1 || EDITING_KEYS.has(e.key))) return false; // renaming
  return !CAMERA_KEYS.has(e.key);
}

export function shouldShowTapCard(s: {
  on: boolean; expired: boolean; fullscreenEnabled: boolean; isFullscreen: boolean; overlayOpen: boolean;
}): boolean {
  return s.on && !s.expired && s.fullscreenEnabled && !s.isFullscreen && !s.overlayOpen;
}
```

- [ ] **Step 5: Verify + commit** — `npx vitest run tests/child.test.ts` (all pass), `npm run lint`, `npx tsc --noEmit`. Commit: `feat: child-mode pure logic — settings/timer, parent gate, key and card policy (G3 Task 1)`.

---

### Task 2: Controller core — start, lock, guards, sticky tap-to-start, app hooks

**Files:**
- Create: `src/app/ChildMode.ts`, `src/ui/ChildCards.ts`
- Modify: `src/ui/Hud.ts`, `src/app/DevPanel.ts`, `src/ui/ShareCard.ts`, `src/main.ts`

**Interfaces:**
- Consumes: Task 1 exports (exact names above); existing `Hud` (pills built in the constructor; the guide `<a>` is currently a local const at ~line 98 — make it a field), `DevPanel` (`root` div, window `keydown` backtick toggle, `update()` per frame), `ShareCard` (module-level `closeCurrent()`), `main.ts` (`sharedSeed`/`visiting`/`adopting`/`ownValley` boot block, `hud`, `devPanel`, `loop`).
- Produces:
  - `Hud`: `onChildMode?: () => void`; `setChildMode(on: boolean): void` (hides guide/share/fullscreen/child pills when on); `setChildModeAvailable(available: boolean): void` (hides the child pill, e.g. while visiting).
  - `DevPanel.setLocked(locked: boolean): void` (locked → root hidden and the backtick toggle ignored).
  - `ShareCard.closeShareCard(): void` (exported wrapper of `closeCurrent`).
  - `ChildCards.ts`: `showChildStartCard(opts: { touch: boolean; onStart: (timerMin: number | null) => void }): void`; `showTapCard(onTap: () => void): HTMLDivElement`.
  - `ChildMode`: `constructor(settings: ChildSettings, hooks: ChildHooks)` with `interface ChildHooks { onChange(on: boolean): void; onSleep(): void; onWake(): void }`; `get on(): boolean`; `get expired(): boolean`; `start(timerMin: number | null): void` (must be called inside a user gesture); `resumeSticky(): void` (called at boot when `settings.on`); `exit(): void`; protected-ish `overlayOpen: boolean` flag used by Tasks 3–4.

- [ ] **Step 1: App hooks**
  - `ShareCard.ts`: `export function closeShareCard(): void { closeCurrent(); }`.
  - `DevPanel.ts`: add `private locked = false;` and `setLocked(locked: boolean): void { this.locked = locked; if (locked) { this.visible = false; this.root.style.display = 'none'; } }`; in the window keydown handler, first line `if (this.locked) return;`.
  - `Hud.ts`: turn the guide link into `private guideLink: HTMLAnchorElement`; add `private childPill: HTMLDivElement` built like the share pill — text `👪 child mode`, `role=button`, `tabindex=0`, `aria-label="child mode"`, `[...PILL_CSS, 'top:138px', 'left:12px', 'cursor:pointer', 'font-size:14px']`, click / Enter / Space → `this.onChildMode?.()`; add
    ```ts
    private childAvailable = true;
    setChildModeAvailable(available: boolean): void { this.childAvailable = available; this.childPill.hidden = !available; }
    setChildMode(on: boolean): void {
      this.guideLink.hidden = on;
      this.sharePill.hidden = on;
      this.fullscreenChip.hidden = on || !document.fullscreenEnabled;
      this.childPill.hidden = on || !this.childAvailable;
    }
    ```
    (the existing `if (!document.fullscreenEnabled) ... display='none'` for the fullscreen chip becomes `this.fullscreenChip.hidden = true;` so `hidden` is the single switch).

- [ ] **Step 2: `src/ui/ChildCards.ts`** — cards share the WelcomeBack look (cream `rgba(252,247,235,.96)`, ink `#3a3a2e`, Georgia, radius 14, shadow); every card root stops `pointerdown`/`keydown` propagation.

```ts
import { TIMER_CHOICES } from '../app/childSettings';

const CARD_CSS = [
  'position:fixed', 'left:50%', 'top:50%', 'transform:translate(-50%,-50%)', 'z-index:40',
  'background:rgba(252,247,235,.97)', 'color:#3a3a2e', 'font-family:Georgia,serif',
  'border-radius:14px', 'box-shadow:0 8px 40px rgba(30,40,30,.35)', 'padding:20px 22px',
  'width:min(360px, calc(100vw - 32px))', 'box-sizing:border-box', 'font-size:14px', 'line-height:1.45',
].join(';');
export const BUTTON_CSS = 'font:14px Georgia,serif;padding:7px 14px;border-radius:999px;border:1px solid #b9b39c;background:#efe9d8;color:#3a3a2e;cursor:pointer;margin:4px 6px 0 0;';

export function makeCard(): HTMLDivElement {
  const card = document.createElement('div');
  card.style.cssText = CARD_CSS;
  card.addEventListener('pointerdown', (e) => e.stopPropagation());
  card.addEventListener('keydown', (e) => e.stopPropagation());
  document.body.appendChild(card);
  return card;
}

export function showChildStartCard(opts: { touch: boolean; onStart: (timerMin: number | null) => void }): void {
  const card = makeCard();
  const h = document.createElement('div');
  h.textContent = 'Child mode';
  h.style.cssText = 'font-weight:bold;font-size:17px;margin-bottom:6px;';
  card.append(h);
  const lines = [
    'Keeps little hands in the valley: no links, no sharing, no settings.',
    'To leave, a grown-up holds the 🔒 for 3 seconds and answers a question.',
    opts.touch
      ? 'For a full lock on a tablet: iPad — Settings › Accessibility › Guided Access (triple-click to start). Android — Settings › Security › App pinning.'
      : 'Holding Esc leaves full screen, but child mode stays on. Ctrl+Alt+Del and power keys can’t be blocked.',
  ];
  for (const t of lines) { const p = document.createElement('p'); p.textContent = t; p.style.margin = '4px 0'; card.append(p); }
  let chosen: number | null = 30;
  const row = document.createElement('div');
  row.style.margin = '10px 0 6px';
  row.append('Play time: ');
  const buttons: HTMLButtonElement[] = [];
  for (const m of TIMER_CHOICES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = m === null ? 'no limit' : `${m} min`;
    b.style.cssText = BUTTON_CSS;
    b.addEventListener('click', () => { chosen = m; paint(); });
    buttons.push(b);
    row.append(b);
  }
  const paint = () => buttons.forEach((b, i) => { b.style.background = TIMER_CHOICES[i] === chosen ? '#c9dcb6' : '#efe9d8'; });
  paint();
  card.append(row);
  const start = document.createElement('button');
  start.type = 'button';
  start.textContent = 'Start child mode';
  start.style.cssText = BUTTON_CSS + 'background:#87a96b;color:#fff;border-color:#87a96b;';
  start.addEventListener('click', () => { card.remove(); opts.onStart(chosen); });
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Not now';
  cancel.style.cssText = BUTTON_CSS;
  cancel.addEventListener('click', () => card.remove());
  card.append(start, cancel);
}

/** Full-screen "Tap to start" veil: the child's tap is the user gesture fullscreen needs. */
export function showTapCard(onTap: () => void): HTMLDivElement {
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;z-index:35;display:flex;align-items:center;justify-content:center;background:rgba(252,247,235,.9);color:#3a3a2e;font:22px Georgia,serif;cursor:pointer;';
  veil.textContent = 'Tap to start 🌿';
  veil.setAttribute('data-testid', 'child-tap');
  veil.addEventListener('pointerdown', (e) => e.stopPropagation());
  veil.addEventListener('click', () => { veil.remove(); onTap(); });
  document.body.appendChild(veil);
  return veil;
}
```

- [ ] **Step 3: `src/app/ChildMode.ts`**

```ts
import { browserStore, saveChildSettings, setTimer, offSettings, type ChildSettings } from './childSettings';
import { shouldShowTapCard, shouldSwallowKey } from './childKeys';
import { showTapCard } from '../ui/ChildCards';

export interface ChildHooks { onChange(on: boolean): void; onSleep(): void; onWake(): void }
type KeyboardLock = { lock?: (keys?: string[]) => Promise<void>; unlock?: () => void };
const keyboardApi = (): KeyboardLock | undefined => (navigator as Navigator & { keyboard?: KeyboardLock }).keyboard;

export class ChildMode {
  /** True while a child-mode overlay (tap card, gate, panel, sleep screen) is up. */
  overlayOpen = false;
  private tapCard: HTMLDivElement | null = null;
  private exiting = false;

  constructor(private settings: ChildSettings, private readonly hooks: ChildHooks) {
    window.addEventListener('keydown', this.onKeyDown, { capture: true });
    window.addEventListener('contextmenu', (e) => { if (this.settings.on) e.preventDefault(); });
    window.addEventListener('wheel', (e) => { if (this.settings.on && e.ctrlKey) e.preventDefault(); }, { passive: false });
    window.addEventListener('beforeunload', (e) => {
      if (!this.settings.on) return;
      e.preventDefault();
      e.returnValue = '';
    });
    document.addEventListener('fullscreenchange', () => this.maybeShowTapCard());
  }

  get on(): boolean { return this.settings.on; }
  get expired(): boolean { return this.settings.expired; }

  /** Must run inside a user gesture (the start card's button). */
  start(timerMin: number | null): void {
    this.settings = offSettings();
    this.settings.on = true;
    setTimer(this.settings, timerMin);
    this.persist();
    this.applyOn();
    void this.enterLock();
  }

  /** Boot with sticky child mode: lock the UI now, wait for the child's tap to go fullscreen. */
  resumeSticky(): void {
    this.applyOn();
    this.maybeShowTapCard();
    if (!document.fullscreenEnabled && !this.settings.expired) this.showTap(); // one tap to start, then never again
  }

  exit(): void {
    this.exiting = true;
    this.settings = offSettings();
    this.persist();
    this.tapCard?.remove();
    this.tapCard = null;
    keyboardApi()?.unlock?.();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    document.body.style.userSelect = '';
    this.hooks.onChange(false);
    this.exiting = false;
  }

  protected persist(): void { saveChildSettings(this.settings, browserStore()); }

  private applyOn(): void {
    document.body.style.userSelect = 'none';
    this.hooks.onChange(true);
  }

  private async enterLock(): Promise<void> {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) await document.documentElement.requestFullscreen();
      await keyboardApi()?.lock?.();
    } catch {
      /* no fullscreen / no keyboard lock (Firefox, iPhone): the in-app locks still hold */
    }
  }

  private maybeShowTapCard(): void {
    if (this.exiting) return;
    const show = shouldShowTapCard({
      on: this.settings.on, expired: this.settings.expired, fullscreenEnabled: document.fullscreenEnabled,
      isFullscreen: document.fullscreenElement !== null, overlayOpen: this.overlayOpen,
    });
    if (show) this.showTap();
  }

  private showTap(): void {
    if (this.tapCard) return;
    this.overlayOpen = true;
    this.tapCard = showTapCard(() => {
      this.tapCard = null;
      this.overlayOpen = false;
      void this.enterLock();
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.settings.on) return;
    const tag = e.target instanceof HTMLElement ? e.target.tagName : null;
    if (!shouldSwallowKey(e, tag)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
}
```

- [ ] **Step 4: `main.ts` wiring**
  - Before `const sharedSeed = parseValleyParam(location.search);` add `const childSettings = loadChildSettings(browserStore());` and change that line to `const sharedSeed = childSettings.on ? null : parseValleyParam(location.search);`, plus `if (childSettings.on && location.search.includes('valley=')) history.replaceState(null, '', location.pathname);` (child mode never visits).
  - After `devPanel` and `loop` exist (before `loop.start()`):
    ```ts
    const childMode = new ChildMode(childSettings, {
      onChange: (on) => {
        hud.setChildMode(on);
        devPanel.setLocked(on);
        if (on) { closeShareCard(); loop.setSpeed(1); }
      },
      onSleep: () => { loop.stop(); audio.setSleeping(true); },
      onWake: () => { audio.setSleeping(false); loop.start(); },
    });
    hud.setChildModeAvailable(!visiting);
    hud.onChildMode = () => showChildStartCard({
      touch: window.matchMedia('(pointer: coarse)').matches,
      onStart: (timerMin) => childMode.start(timerMin),
    });
    ```
  - After `loop.start()`: `if (childMode.on) childMode.resumeSticky();` — and the first-run hint / adopt hint only when `!childMode.on`.
  - Add `AudioEngine.setSleeping` now (main.ts calls it), exactly:
    ```ts
      /** Child-mode sleep: breathe the ambience out (and back in on wake), without touching the mute setting. */
      setSleeping(sleeping: boolean): void {
        this.ambienceBus.gain.setTargetAtTime(sleeping || !this.unlocked ? 0 : 1, this.ctx.currentTime, 0.7);
      }
    ```
    (so `src/audio/AudioEngine.ts` is also in this task's file list).

- [ ] **Step 5: Verify + commit** — `npx vitest run tests/child.test.ts`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. In the report, trace: pill → start card → Start (fullscreen + lock, pills hidden, DevPanel locked); reload → tap card → fullscreen; Esc-held exit from fullscreen → tap card again; Firefox-like (`fullscreenEnabled` false) → one tap card, never repeats. Commit: `feat: child mode start, keyboard/pointer/leave guards, sticky tap-to-start, HUD/DevPanel/share hooks (G3 Task 2)`.

---

### Task 3: Parent gate UI — hold 🔒, grown-up question, grown-ups panel

**Files:**
- Modify: `src/ui/ChildCards.ts`, `src/app/ChildMode.ts`

**Interfaces:**
- Consumes: `makeQuestion`, `answerGate`, `gateLocked`, `newGateState`, `HOLD_MS`, `COOLDOWN_MS` (Task 1); `setTimer`, `extendTimer`, `TIMER_CHOICES` (Task 1); `ChildMode.exit()`, `persist()`, `overlayOpen`, `hooks.onWake` (Task 2); `makeCard`, `BUTTON_CSS` (Task 2).
- Produces: `ChildCards.ts`: `showLockButton(onHeld: () => void): HTMLButtonElement`; `showGateQuestion(opts: { question: GateQuestion; lockedMsLeft: number; onAnswer: (choice: number) => void; onClose: () => void }): HTMLDivElement`; `showParentPanel(opts: { timerMin: number | null; onTimer: (m: number | null) => void; onPlus15: () => void; onResume: () => void; onExit: () => void }): HTMLDivElement`. `ChildMode`: the lock button is shown whenever child mode is on (created in `applyOn`, removed in `exit`).

- [ ] **Step 1: Lock button** (`showLockButton`) — a `<button type="button" aria-label="grown-ups: hold to unlock">🔒</button>` fixed at `left:12px; bottom:calc(12px + env(safe-area-inset-bottom))`, `z-index:45` (above the sleep screen and tap veil), 44×44 px round, cream background, and a progress ring drawn with `background: conic-gradient(#87a96b <deg>, #efe9d8 0)` updated by `requestAnimationFrame` while held. `pointerdown` (stopPropagation, `setPointerCapture`) starts timing; `pointerup`/`pointercancel`/`pointerleave` reset; reaching `HOLD_MS` resets the ring and calls `onHeld()`. Its own `keydown` is swallowed by the guard — touch/mouse only, by design.

- [ ] **Step 2: Question card** (`showGateQuestion`) — `makeCard()`; header "For grown-ups"; text `What is ${a} × ${b}?`; the four `options` as large buttons (`BUTTON_CSS` + `min-width:64px;font-size:18px`); a "✕" close button. If `lockedMsLeft > 0`, show "Let’s try again in a little while." instead of the buttons. Buttons call `onAnswer(choice)`.

- [ ] **Step 3: Parent panel** (`showParentPanel`) — `makeCard()`; header "Grown-ups"; a row of timer buttons from `TIMER_CHOICES` (current highlighted, click → `onTimer(m)`); **+15 minutes** (hidden when `timerMin === null`) → `onPlus15()`; **Resume** → `onResume()`; **Exit child mode** → `onExit()`.

- [ ] **Step 4: Wire in `ChildMode`**
```ts
  private gate = newGateState();
  private lockBtn: HTMLButtonElement | null = null;
  private card: HTMLDivElement | null = null;

  // in applyOn(): if (!this.lockBtn) this.lockBtn = showLockButton(() => this.openGate());
  // in exit(): this.lockBtn?.remove(); this.lockBtn = null; this.card?.remove(); this.card = null;

  private openGate(): void {
    this.card?.remove();
    this.overlayOpen = true;
    const now = Date.now();
    this.card = showGateQuestion({
      question: makeQuestion(Math.random),
      lockedMsLeft: gateLocked(this.gate, now) ? this.gate.lockedUntil - now : 0,
      onAnswer: (choice) => {
        const q = this.currentQuestion; // keep the question object passed above in a field
        const r = answerGate(this.gate, q, choice, Date.now());
        if (r === 'correct') this.openPanel();
        else this.openGate(); // wrong → fresh question; locked → the "try again" card
      },
      onClose: () => this.closeCard(),
    });
  }

  private openPanel(): void {
    this.card?.remove();
    this.card = showParentPanel({
      timerMin: this.settings.timerMin,
      onTimer: (m) => { setTimer(this.settings, m); this.persist(); this.openPanel(); },
      onPlus15: () => { extendTimer(this.settings, 15); this.persist(); this.openPanel(); },
      onResume: () => this.closeCard(),
      onExit: () => { this.closeCard(); this.exit(); },
    });
  }

  private closeCard(): void {
    this.card?.remove();
    this.card = null;
    this.overlayOpen = false;
    if (this.settings.on && !this.settings.expired) this.hooks.onWake?.(); // no-op unless asleep; see Task 4
    this.maybeShowTapCard();
  }
```
(Store the generated question in `private currentQuestion!: GateQuestion` before calling `showGateQuestion`, and read it in `onAnswer`.) Task 4 refines wake-from-sleep; in this task `onWake` is only called when leaving the sleep state, so guard it: keep a `private asleep = false` flag (set in Task 4) and call `onWake()` only if `asleep` — declare the flag now as `false`.

- [ ] **Step 5: Verify + commit** — `npx vitest run tests/child.test.ts`, lint, tsc, build. Report traces: hold <3 s resets; 3 s → question; wrong → new question; 3 wrong → "try again" card for 30 s; correct → panel; Exit → pills back, lock button gone, fullscreen/keyboard released, `beastoria.child` shows `on:false`. Commit: `feat: parent gate — hold-to-unlock, grown-up question with cooldown, grown-ups panel (G3 Task 3)`.

---

### Task 4: Gentle play timer + sleep screen

**Files:**
- Modify: `src/app/ChildMode.ts`, `src/ui/ChildCards.ts`, `src/audio/AudioEngine.ts`, `src/main.ts`

**Interfaces:**
- Consumes: `addPlayTime`, `extendTimer`, `setTimer` (Task 1); `ChildMode` hooks and `overlayOpen`, `asleep` (Tasks 2–3).
- Produces: `AudioEngine.setSleeping(sleeping: boolean): void`; `ChildCards.showSleepScreen(): HTMLDivElement`; `ChildMode` heartbeat + `sleep()/wake()`.

- [ ] **Step 1: Audio** — in `AudioEngine`:
```ts
  /** Child-mode sleep: breathe the ambience out (and back in on wake), without touching the mute setting. */
  setSleeping(sleeping: boolean): void {
    this.ambienceBus.gain.setTargetAtTime(sleeping || !this.unlocked ? 0 : 1, this.ctx.currentTime, 0.7);
  }
```
(If Task 2 already added it, leave as is.)

- [ ] **Step 2: Sleep screen** (`showSleepScreen`) — full-viewport `div`, `z-index:30` (below the 🔒 at 45 and cards at 40), background `rgba(22,32,62,.88)`, cream Georgia text centred: "The creatures are curling up to sleep 🌙" / "Time to rest too.", `data-testid="child-sleep"`; stops `pointerdown`/`click` propagation; no close control.

- [ ] **Step 3: Heartbeat in `ChildMode`**
```ts
  private beats = 0;
  private sleepScreen: HTMLDivElement | null = null;
  asleep = false;

  // constructor: setInterval(() => this.heartbeat(), 1000);
  //              document.addEventListener('visibilitychange', () => { if (document.hidden) this.persist(); });
  //              window.addEventListener('pagehide', () => this.persist());

  private heartbeat(): void {
    if (!this.settings.on || this.settings.expired || this.overlayOpen || document.hidden) return;
    const crossed = addPlayTime(this.settings, 1000);
    if (crossed) { this.persist(); this.sleep(); return; }
    if (++this.beats % 5 === 0) this.persist();
  }

  private sleep(): void {
    if (this.asleep) return;
    this.asleep = true;
    this.tapCard?.remove(); this.tapCard = null;
    this.sleepScreen = showSleepScreen();
    this.hooks.onSleep();
  }

  private wake(): void {
    if (!this.asleep) return;
    this.asleep = false;
    this.sleepScreen?.remove(); this.sleepScreen = null;
    this.hooks.onWake();
  }
```
- `resumeSticky()`: if `settings.expired` → `sleep()` instead of the tap card.
- `closeCard()` (Task 3): replace the `onWake` line with `if (!this.settings.expired) this.wake();`.
- `exit()`: call `this.wake()` before `hooks.onChange(false)`.
- The heartbeat pauses while any child overlay is up (`overlayOpen`), so time spent on the tap card or the gate doesn't count.

- [ ] **Step 4: Verify + commit** — `npx vitest run tests/child.test.ts`, lint, tsc, build. Report traces: timer expiry → sleep screen + loop stopped + ambience fading; only the 🔒 responds; +15 → wakes; picking a new timer → wakes with a fresh count; reload while expired → straight back to the sleep screen; Exit from sleep → normal mode. Commit: `feat: gentle play timer — visible-time heartbeat, calm sleep screen, ambience fade (G3 Task 4)`.

---

### Task 5: Verification + docs

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1** — `npx vitest run --minWorkers=1 --maxWorkers=2` (report the real count; expect 264 + 8), `npm run lint`, `npx tsc --noEmit`, `npm run build`, `git diff --stat main...HEAD -- src/sim` empty.
- [ ] **Step 2** — CLAUDE.md: Done entry **G3** (Child mode, date: sticky parent-gated child mode — fullscreen + keyboard lock where available, key/right-click/zoom/leave-page guards, hidden links/share/DevPanel, hold-🔒 + multiplication gate with 3-strike cooldown, gentle play timer ending on a sleep screen; test count); Status line: built on branch awaiting merge/deploy (controller flips); growth section: G3 built, G4 next. Commit: `docs: G3 Child Mode status (G3 Task 5)`.
- [ ] **Step 3 (controller, Playwright on `npm run preview`)** — start child mode via the pill with the share card and DevPanel open first (Review Focus 5 → both gone); pills hidden; backtick ignored; F5/letters swallowed while camera arrows pan; typing in the rename field works (Review Focus 1); `navigator.keyboard.lock` present and resolving in Chromium fullscreen (the key-set spike); reload → tap card → fullscreen; gate: 2.9 s hold resets, 3 s opens the question, three wrong → cooldown card, correct → panel → Exit restores the HUD and clears `localStorage['beastoria.child']`; timer: seed `localStorage` with `{on:true,timerMin:1,playedMs:59000,expired:false}`, reload, tap, wait 2 s → sleep screen, loop stopped; +15 → wakes; `?valley=` ignored while on.

## Self-Review Notes

- Spec coverage: §1 start card/touch guidance/visit exclusion → T2; §2 locks (hidden pills, DevPanel, keys incl. rename exception, contextmenu, ctrl-wheel, user-select, beforeunload) → T2; §3 sticky/tap card/`?valley=` ignored → T2 (+ expired reload → T4); §4 gate → T1 (logic) + T3 (UI); §5 timer → T1 (arithmetic) + T4 (heartbeat/sleep/audio); §6 tests → T1 + T5 browser pass incl. keyboard-lock spike.
- Types consistent across tasks: `ChildSettings`, `KeyValueStore`, `GateQuestion`, `GateState`, `ChildHooks`, card function names.
- Judgment calls: `setTimer` restarts the count (a parent choosing "30 min" means thirty more minutes); the key guard lives on `window` capture with `stopImmediatePropagation` so DevPanel/Camera never see swallowed keys; the play-time heartbeat uses wall time (1 s ticks), not sim ticks, so dev speed settings can't distort it.

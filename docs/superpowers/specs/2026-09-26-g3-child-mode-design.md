# G3 "Child Mode" — Design

**Date:** 2026-09-26 · **Status:** design approved by the user (brainstorm 2026-09-26) · **Track:**
growth & distribution, milestone 3 of 4 (binding track decisions in
`2026-08-22-growth-distribution-design.md`).

## Goal

A grown-up can hand a young child (≈4–8) the family computer with the valley running, and the
child cannot accidentally leave it, change settings, follow links out, share, or reset anything —
while an adult can get out in a few seconds. Calm, on-brand, no accounts, nothing leaves the
device.

## Binding decisions (user, 2026-09-26)

1. **Primary target: the family computer** (Windows/Mac, Chrome/Edge). The desktop fullscreen +
   keyboard lock is the core. Tablets/phones get the same in-app locks plus guidance for the OS
   lock (iPad Guided Access, Android Screen Pinning), which is the only real lock there.
2. **Parent gate = hold 🔒 for 3 s + a grown-up question** (multiplication, four answer buttons).
3. **Parental controls in G3:** a **gentle play timer** and **nothing leaves the valley**. (Sound
   limits and a renaming toggle were offered and not chosen — out of scope.)
4. **Sticky:** child mode is remembered on the device until a grown-up exits through the gate;
   any reload/reopen returns to child mode behind a tap-to-start card; the timer survives reloads.

## Honest platform limits (stated in the product, not hidden)

- **Chrome/Edge desktop:** in fullscreen, `navigator.keyboard.lock()` lets the page capture Esc and
  (per Chromium documentation) browser/system shortcuts such as Ctrl+W, Ctrl+T, Ctrl+N, Alt+Tab,
  Win. With Esc locked the browser itself requires **press-and-hold Esc** to leave fullscreen. The
  exact captured set is verified in the implementation plan's first task and the parent-facing
  copy is written from the verified list only.
- **Firefox / Safari desktop:** no Keyboard Lock — a single Esc leaves fullscreen and browser
  shortcuts work. Child mode still hides everything, swallows page-level keys, and guards
  close/reload with the browser's "Leave site?" prompt.
- **Never blockable anywhere:** Ctrl+Alt+Del, OS power/lock/sleep keys, closing the laptop lid.
- **iPhone:** no page fullscreen; **iPad:** limited; **Android:** fullscreen but home/back always
  escape. The start card shows Guided Access / Screen Pinning steps on touch devices.

## Design

### 1. Turning child mode on
- Normal mode gains a **👪 child mode** HUD pill (a new slot in the left pill column). It opens a
  card: what child mode does (two short lines), a play-timer picker (15 / 30 / 45 / 60 min /
  no limit; default 30), and **Start child mode**. On touch devices (`matchMedia('(pointer:
  coarse)')`) the card adds three-line Guided Access (iPad) and Screen Pinning (Android)
  instructions.
- The Start tap (a user gesture) requests fullscreen on `document.documentElement` and, where
  `navigator.keyboard?.lock` exists, `keyboard.lock()`; failures are tolerated (child mode still
  engages).
- Child mode cannot be started while visiting a friend's valley (the pill is hidden in visit mode).

### 2. What child mode locks
- **Hidden:** 🐾 creatures (guide link), 🔗 share, ⛶ fullscreen, 👪 child mode pills; any open share
  card is closed; the visit banner never appears (see §3).
- **Disabled:** the DevPanel entirely (the backtick toggle is ignored, so its speed controls and
  its destructive "reset valley" are unreachable).
- **Keys:** a capture-phase `keydown` guard on `window` swallows every key (`preventDefault`)
  except the camera's arrows and +/−/=/_ ; the sound chip remains clickable (a child may mute).
  While the rename editor's input has focus, printable keys, Backspace/Delete, Enter and Escape
  pass through to it (renaming stays available); everything else is still swallowed.
- **Pointer/browser:** `contextmenu` prevented; `wheel` with `ctrlKey` prevented (browser zoom);
  `user-select: none` on the body.
- **Leaving the page:** a `beforeunload` handler sets `returnValue` while child mode is on, so
  close/reload/navigation shows the browser's "Leave site?" confirmation (effective once the page
  has had a user gesture — the start/tap cards guarantee one).
- **Still allowed:** watching, panning, zooming, tapping creatures, the inspect card, renaming
  (local-only, kid-friendly — explicitly kept), mute toggle.

### 3. Sticky mode, reloads, and fullscreen loss
- Settings persist in `localStorage` under `beastoria.child`:
  `{ on: boolean, timerMin: number | null, playedMs: number, expired: boolean }`. Read failures
  (privacy modes) degrade to "off" — never crash.
- On boot with `on: true`: the app boots normally underneath, then shows a full-screen
  **"Tap to start 🌿"** card; the child's tap re-enters fullscreen + keyboard lock. The same card
  appears whenever fullscreen is lost while child mode is on (`fullscreenchange` with no
  `fullscreenElement`), e.g. after a held Esc.
- A `?valley=` parameter is ignored while child mode is on (normal own-valley boot; the parameter
  is stripped with `history.replaceState`). Visit mode never starts in child mode.

### 4. Parent gate
- A small **🔒** sits in a corner not used by the HUD (bottom-left, safe-area aware). Pressing and
  holding it for **3 s** fills a ring; releasing early resets it. On completion a card asks a
  grown-up question: `a × b` with `a, b ∈ 3..9`, four answer buttons (the correct product plus
  three distinct plausible distractors, shuffled), a new question each time the card opens.
- **Wrong answer:** a fresh question. **Three wrong answers in a row:** the gate locks for 30 s
  (the card says "Let's try again in a little while").
- **Correct answer → grown-ups panel:** change the timer, **+15 minutes**, **Resume**, and
  **Exit child mode** (releases the keyboard lock, exits fullscreen, clears `on`, resets
  `playedMs`/`expired`). The panel closes back to child mode on Resume.
- Gate logic (question generation, answer check, cooldown) is a pure module, unit-tested.

### 5. Gentle play timer
- Counts **visible play time only** (accumulated on each sim tick while the tab is visible and no
  full-screen child-mode card is up); persisted to `beastoria.child.playedMs` every ~5 s and on
  hide/pagehide, so reloads neither reset nor extend it.
- When `playedMs ≥ timerMin`, `expired` is set and the valley fades to a calm, undismissable
  sleep screen: "The creatures are curling up to sleep 🌙 — time to rest too." The game loop
  stops and the ambience fades out. Only the 🔒 gate works on this screen; **+15 minutes** or
  **Exit** resumes. `timerMin: null` = no limit.
- The sim itself is untouched: pausing is the existing `GameLoop.stop()`/`start()`; the save keeps
  autosaving on hide/pagehide as today.

### 6. Testing
- **Vitest (pure logic):** settings load/save/degrade; timer accumulation, persistence across a
  simulated reload, expiry, +15 min; gate question generation (correct answer always present,
  four distinct options, factors in range), answer checking, three-strike cooldown.
- **Playwright (controller):** start child mode → pills hidden, DevPanel backtick dead, keys
  swallowed except camera keys, right-click/ctrl-wheel suppressed; reload → tap-to-start card →
  resumes; gate: hold 3 s → question → wrong ×3 → cooldown; correct → panel → Exit restores the
  normal HUD; timer expiry with a shortened test duration → sleep screen, only the gate works;
  `?valley=` ignored in child mode.
- **Real-browser spike (plan task 1):** which keys `navigator.keyboard.lock()` actually captures
  in fullscreen on Chrome/Edge Windows; parent-facing copy is written from the observed list.

## Constraints

Zero cost; no new dependencies; nothing under `src/sim/` changes; the save format is unchanged
(child-mode state is a separate localStorage key, not in `SaveFile`); child-directed posture
unchanged (nothing leaves the device); `prefers-reduced-motion` is out of scope (still deferred).

## Out of scope (explicit)

Sound limits; renaming toggle; PINs; per-child profiles; offline/PWA caching; OS-level kiosk
modes; blocking keys the platform never exposes to web pages.

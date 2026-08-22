# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Beastoria is

A calm, nostalgic, Ghibli-like browser game: a little living world of cute-but-realistic creatures
(animals, birds, fish, extinct, mythical) living in real family structures — pairing, nesting,
laying eggs / birthing, feeding babies, growing through life stages, peacefully aging. The player
watches, pans, zooms (whole world ↔ one family), and listens to real creature voices.

**Full design spec:** `docs/superpowers/specs/2026-08-13-beastoria-v1-design.md` — read it before
any design-affecting work. The spec is the source of truth; this file is the summary.

## Locked roadmap (user decision — do not relitigate)

1. **v1 (NOW): Pure Living Terrarium** — world runs itself; watch/zoom/listen only
2. **v2: Caretaker World** — feeding, care, unlocking families (only after v1 is polished)
3. **v3: Full Management Sim** — Hayday-style economy (only after v2)
4. Far future: Stylized 3D rebuild; real-world-slow time; player-adjustable speed

## Hard constraints (user requirements)

- **Zero cost, ever:** MIT/OSS tooling only, free hosting tiers only (GitHub Pages/Vercel free),
  CC0/CC-BY/public-domain assets only. No paid services, licenses, or subscriptions.
- **Audio licensing:** CC0/PD first, CC-BY or CC-BY-SA with credit in `public/audio/LICENSES.md`
  (per-file source URL, author, license, edits; CC-BY-SA derivatives stay CC-BY-SA). **Never**
  xeno-canto or BBC Sound Effects (non-commercial licenses). Real recordings only; dodo/phoenix
  voices are designed from real relatives per spec.
- **Gentle realism:** full life cycles incl. peaceful elder passings; NO on-screen predation ever.
- **Art:** 100% code-crafted layered vector art (rigs as TS data). No AI images, no asset packs.
- **Targets:** desktop + mobile browsers, 60fps goal, touch pan/pinch.

## Commands

- `npm run dev` — Vite dev server
- `npm run build` — production build (`tsc && vite build`)
- `npm test` — Vitest (sim + persist tests only; rendering is eyeballed via DevPanel)
- `npm run lint` — ESLint incl. the sim-purity boundary rule
- Single test file: `npx vitest run tests/determinism.test.ts`
- In-game dev panel: press `~` (speed 1x/8x/64x, seed, creature inspector, FPS)

## Architecture (the one rule that matters most)

**`src/sim/` is a pure, deterministic, headless module.** It must never import Pixi/DOM or use
`Math.random`/`Date.now`/`performance.now` (lint-enforced). All randomness via seeded sfc32 in
`sim/rng.ts`; all time via tick count. Fixed 10 ticks/sec; `Sim.tick(commands[])` is the only
entry point (commands empty in v1 — they exist for v2). Renderer/audio/UI are observers that
interpolate between snapshots. Offline catch-up runs the same `Sim.tick`.

Breaking this boundary breaks saves, replay determinism, offline catch-up, and the test suite.
The CI determinism test (save-mid-run replay equivalence) guards it.

Module map: `src/app/` (GameLoop fixed-step accumulator, CatchUp, DevPanel) · `src/sim/` (state,
rng, clock, grid, movement=steering-no-A*, behaviors=utility+hysteresis, lifecycle, family FSM,
population regulator, species data defs) · `src/render/` (Renderer, Camera, LOD T0/T1/T2,
ValleyPainter bake-once terrain, RigRenderer/RigBaker/Animator, effects) · `src/rigs/` (art as
TS data: archetype skeletons quadruped/songbird/waterbird/fish; stages = parametric overrides,
never new art) · `src/audio/` (Web Audio bus graph, zoom mixer, CallScheduler consuming sim
'vocalize' events) · `src/persist/` (idb-keyval, versioned SaveFile = WorldState passthrough,
migration chain) · `src/ui/` (vanilla TS HUD, WelcomeBack).

Other invariants: creatures iterated in array order (determinism); cosmetic RNG is a separate
stream (visuals must never perturb the sim); WorldState stays a serializable POJO (save =
JSON passthrough); population balance = fertility gating vs softCap + wanderer floor failsafe +
exactly-one phoenix family (rebirth on elder passing). Saves are single-tab last-write-wins in
v1 (two open tabs overwrite each other's timeline harmlessly).

## Current status (update at each milestone / handoff)

- **Done:** M0 (skeleton+deploy), M1 (sim core: needs/behaviors/clock), M2 (painterly
  valley, zones, water avoidance, day/night grading), M3 (rig pipeline: rabbit+robin,
  stages, LOD, follow-cam), M4 (families: pairing, FSM, homes, eggs/birth, brooding
  turns, feedYoung, dispersal, gentle passing + memorials, population gating), M5 (all
  eight species: deer/duck/koi/owl/dodo/phoenix rigs + defs, movement media incl.
  swimming koi + amphibious ducks, nocturnal owls, deer herd cohesion, wanderer
  arrivals, phoenix single-family rebirth, balance property suite 6 seeds × 30 days ×
  100-day soak), M6 (sound: deterministic vocalize tick-output, real CC-licensed
  voices for 6 species + designed dodo/phoenix from real relatives, 6 ambience beds,
  Web Audio bus engine + autoplay gate + persisted mute, zoom/zone-aware mixer, call
  scheduler, HUD sound chip, LICENSES.md provenance gate), M7 (persistence: versioned
  idb saves + migration chain + frozen fixture, autosave 30s/hidden/pagehide,
  quarter-speed catch-up capped 2 game-days under overlay, welcome-back card, dev
  reset), M8 (polish: de-clump steering narrowed to nest-gather ring, memorial
  lifecycle — 2-day prune + age fade, ambient effects — grass sway/water
  shimmer/dappled light/fireflies, HUD clock + sound-chip a11y + dynamic min-zoom
  world edge, label declutter, DPR/bundle verification — bundle delta +39.29 kB,
  under the 50 kB target), M9 (alive: camera clamped so off-world background can never
  show + dt-normalized damping + deltaMode-aware wheel zoom + single render loop +
  fullscreen chip; six-frame speed-true walk bakes + bird legs + T2 threshold at 0.55;
  sim 'air' movement medium — robin/owl/phoenix fly, cross the pond, never rest on
  water — plus 19 FOOD_SPOTS forage anchors; socialize/court de-clump ring restored
  with root causes fixed — phoenix grove leash + larder, hardCap enforced at laying
  and hatching; flap/swim presentation (lift, shadow detach, duck ripple); carry/sit
  clips + activity glyphs + hatch/birth/pairing sparkles + gentle-passing fades +
  berry clusters at food spots; 135 tests), M10 (v1.2 final: sim bugs fixed (no
  freezing, no water-walking), feedMode realism (nurse/carry/self), 3 new species
  (squirrel/frog/turtle = 11 total), hatch/birth staging, tap-to-inspect card,
  animation crossfade smoothness + arrival settle, labels off, pre-M10-save home
  migration + multi-touch tap guard (final-review fix wave); 161 tests), M11 (v1.3:
  parents forage at real FOOD_SPOTS locations instead of a raw random point, carry
  errand now four visible steps (seek/pickup/carry/deliver), delivery sequenced one
  hungry baby at a time instead of an instant aggregate decrement, nurse and carry
  feeding share one FEED_RANGE radius (closes a sim/render mismatch where fed babies
  could look un-fed), baby leash tightens during any active feed/nurse hold so little
  ones visibly gather in, a new kangaroo species (12 total) with a rig-art pouch/joey
  shown during her nurse hold, an amber/milk-white feed-mote effect and step-aware
  inspect-card text so every feeding is a moment you can watch; 174 tests), M12
  (v1.4: feeding legibility via feedContactRing (mother and baby < 40 units) +
  turnToward facing + four-beat pacing (30/90/40 ticks settle/nurse/linger) +
  longer head-anchored mote bursts (3-mote staggered, 900ms) + beat-aware
  inspect-card text; real kangaroo pouch-carry sim system (`Creature.carriedBy`,
  zero-draw mount/dismount/graze-window transitions, position-derived rendering
  via Pixi reparenting into pouch rig part, decorative joey deleted); written
  reviewed rig-art recipe (silhouette/markings/shading/motion as four checkable
  dimensions, proved on rabbit/deer/robin/kangaroo); 213 tests), M13 (v1.5:
  four threads from the 2026-08-21 live review. Gestation/brood split — a
  live-birth mother (rabbit/deer/squirrel/kangaroo) now settles into her own
  `'gestate'` activity id instead of reusing egg-sitting `'brood'`, both in
  the sim (`family.ts`) and the inspect card, so she never reads as "keeping
  the eggs warm". Squirrel nursing gesture — `feedGive`/`feedTake` poses
  authored for the squirrel rig, same recipe as rabbit/deer/robin/kangaroo.
  Visible pouch mount — the kangaroo joey's `carriedBy` flip is now a real
  multi-tick errand (a `'mount'` activity id: walk to a flank point behind
  her heel, settle, climb aboard; symmetrically, a climb-out lead-in before
  dismount), with an eased render-side transition and a baked T1 mid-pose so
  it reads correctly at every zoom, replacing the old instant snap/flip. The
  `'gather'` freeze bug — babies (and nest-building parents) could get
  permanently parked in `'gather'` with no exit condition, measured at ~25%
  of the population stuck by the end of a 30,000-tick run — fixed via a
  generalized release discipline (every legitimate use of `'gather'` now
  releases itself on arrival, still excluding the mourning vigil, which
  `isMourningGather` shields at every release site including the leash/
  feed-hold branches a same-milestone fix-wave found still unguarded) plus a
  save-load self-heal migration and a 900-tick last-resort backstop; a
  30,000-tick × 3-seed property test (`tests/stuck.test.ts`) now holds it
  fixed. 238 tests)
- **Status: M13 complete, awaiting deploy + live review.** All four M13
  threads above are implemented, tested (full suite incl. the 6-seed +
  100-day-soak balance property suite), and merged, including a whole-branch
  fix wave that closed one critical (a leash/feed-hold code path that could
  silently corrupt an in-progress mourning vigil) and five important findings
  surfaced by the milestone's own final review. Not yet deployed or reviewed
  live by the user — that is the next step before v2 Caretaker World.
- **M14 candidates (deferred out of M13 scope, per the user's own decision
  recorded in this milestone's plan):** (1) feeding still reads as one
  mechanism tuned per species rather than each species' real behavior — not
  yet root-caused; needs a session to actually watch multiple species feed
  side by side and identify specifically what reads as same-y before scoping
  a fix, the way M12's brainstorm broke "recognizable" into four checkable
  dimensions rather than guessing; (2) apply the reviewed rig-art recipe
  (docs/superpowers/specs/2026-08-21-rig-art-recipe.md) to the remaining
  eight species (squirrel's nursing gesture is now done via M13 — the rest of
  its recipe pass, plus frog, turtle, duck, owl, dodo, phoenix, koi, are
  still outstanding). **Backlog item (pre-existing, out of scope, not
  blocking):** kangaroo population hardCap (8) and SHADE_SCRAPES home-site
  count (3) are mismatched (predates M12, explicitly ruled out of scope again
  in M13 per pouch-carry/mount work being independent of home-site balance) —
  consider whenever a session next touches kangaroo balance.
- **Open items awaiting user verification:** (1) mobile perf with the
  richer/heavier rig art has NOT yet been confirmed on a real device — this is
  reserved for the user's own physical-device check (same policy as M2/M3
  testing per CLAUDE.md); (2) a carried kangaroo joey is only visible at close
  zoom (T2) — at T0/T1 it renders invisibly inside its mother. This is a real,
  understood, and accepted regression from the old decorative-joey approach
  (which baked into the mother's T1 frame directly), not a bug in the pouch-
  carry mechanism itself (M12) or the mount errand built on top of it (M13),
  both of which are correct. A full fix is its own milestone-sized piece of
  work — either give `creatureLayer` a real z-sort or bake a joey-variant T1
  frame — and is unrelated to M13's mount-transition work, which only
  animates the moment of climbing in/out, not T1's joey-visibility gap.
- Live: https://feshalnaguji.github.io/beastoria/ · repo: feshalnaguji/beastoria
  (GitHub Pages auto-deploys main; CI runs tests+build)

## Working process (user-agreed)

- Build milestone by milestone (M0–M11 in spec §6); **the user reviews each milestone in the
  browser before the next begins.** Every milestone ends with `npm test` green + `npm run build`
  clean + a deployed/dev URL to look at.
- Mobile perf is tested on a real phone at M2/M3, not deferred to the end.
- New species = data (species def + rig file), not new systems.
- **Session handoff (user request):** when context grows heavy or performance degrades,
  proactively tell the user to start a fresh session and write a handoff: current milestone,
  what's done/verified, what's next, any in-flight decisions. Keep this file and the spec
  current enough that a fresh session can continue seamlessly.

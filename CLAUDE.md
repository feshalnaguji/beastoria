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
- **Audio licensing:** CC0/PD first, CC-BY with credit in `public/audio/LICENSES.md` (per-file
  source URL, author, license, edits). **Never** xeno-canto or BBC Sound Effects (non-commercial
  licenses). Real recordings only; dodo/phoenix voices are designed from real relatives per spec.
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
exactly-one phoenix family (rebirth on elder passing).

## Working process (user-agreed)

- Build milestone by milestone (M0–M8 in spec §6); **the user reviews each milestone in the
  browser before the next begins.** Every milestone ends with `npm test` green + `npm run build`
  clean + a deployed/dev URL to look at.
- Mobile perf is tested on a real phone at M2/M3, not deferred to the end.
- New species = data (species def + rig file), not new systems.
- **Session handoff (user request):** when context grows heavy or performance degrades,
  proactively tell the user to start a fresh session and write a handoff: current milestone,
  what's done/verified, what's next, any in-flight decisions. Keep this file and the spec
  current enough that a fresh session can continue seamlessly.

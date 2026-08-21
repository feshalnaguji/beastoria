# M12 — Implementation Plan (v1.4: feeding you can feel, a joey in the pouch, animals you recognize)

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context

Beastoria v1.3 (M11) shipped and was live-reviewed by the user on 2026-08-20. M11 spent a whole
milestone on feeding legibility — real forage locations, a four-step carry errand, one-at-a-time
delivery, feed motes, a shared nurse/carry radius, a tightened baby leash, and a new kangaroo
species — and the verdict was still *"feeding is not that good."* The kangaroo's joey also read
wrong, and the user asked for animals that are generally "more realistic, better looking and
recognizable."

That is the recurring lesson of this project: **technical completeness does not resolve a felt
problem.** M11 built the correct mechanism; what it did not build was a moment you can watch. M12
answers the three threads the live review opened, with the user's own diagnosis driving each.

### What the user decided (2026-08-21 brainstorm — these are rulings, do not relitigate)

**Thread A — feeding.** Offered four candidate causes, the user picked three: *"can't tell it's
happening"*, *"too fast / no pacing"*, and *"bodies look wrong"* — with their wanted shape stated
explicitly: **parent leans down, baby reaches up, heads meet at one point.** They did **not** pick
"hard to find a feeding to watch", so no markers, camera hints, or world-zoom feeding visuals.

**Thread B — kangaroo.** Offered "fix the visual reading" / "build real pouch-carry" / "drop the
decorative joey", the user chose **build real pouch-carry**: the joey climbs in, is carried while
the mother hops, pops out to graze. This knowingly reverses the M10/M11 ruling that pouch-carry
was "a new system" to avoid; CLAUDE.md allowed re-litigation "with fresh justification", and the
live review plus finding (2) below are it.

**Thread C — art.** The user selected **all four** dimensions — silhouette/proportions,
markings/detail, motion/posture, shading/depth — scoped to **"a few species, done properly"**, and
chose the species: **kangaroo, rabbit, deer, robin.** One per archetype family, both feed modes
covered, kangaroo included because pouch-carry rebuilds it anyway. M13 applies the reviewed recipe
to the remaining eight.

### The four findings that shape the work

1. **Nothing in this codebase poses one creature relative to another.** Every clip is strictly
   self-contained, and `FEED_RANGE` is **90 units** — about one adult body length. A baby is fed
   while standing a body length away, each playing its own clip.
2. **`heading` is only ever written by movement** (`turnToward` called from `movement.ts` and the
   herd pull). A stationary nursing mother keeps the heading she arrived with, and facing is just
   `Math.cos(heading) < 0` (Renderer.ts:1054). **She is frequently facing away from the baby she
   is feeding.** This is the single most concrete cause of "bodies look wrong".
3. **A joey cannot keep up with its mother.** Adult kangaroo speed is 9 units/tick (the valley's
   fastest); the baby stage multiplier is 0.55 → 4.95. She outruns the 140-unit leash in ~1.6s,
   every time. Pouch-carry is the mechanically correct answer, not just the requested one.
4. **The art pass needs no format change and costs almost nothing at runtime.** The `path` shape
   (SVG `d` via Pixi `GraphicsPath`) is already implemented and proven on beaks, fins and the
   kangaroo's tail — it is simply never used for body masses (the rabbit's entire body is one
   `roundRect`). Layered-alpha shading is already idiomatic. And `RigBaker` caches per
   `species|stage|pose`, with T1/T0 drawing a single sprite — so added shapes cost bake time once
   and per-frame cost only at T2, where few creatures are on screen.

### Intended outcome

v1.4: a feeding that plays as a moment with a beginning, middle and end; a kangaroo family that
behaves like kangaroos; and four species rebuilt to an art bar the user signs off on, with a
written recipe so M13 can apply it to the rest.

## Global constraints

- `src/sim/` purity as ever (no Pixi/DOM/`Math.random`/`Date.now`, lint-enforced); creatures
  iterated in array order; all randomness through seeded sfc32; all time through tick count.
- **Determinism is militant.** Any change to the *number or order* of RNG draws reshuffles every
  seeded world and breaks `determinism.test.ts`, `balance.test.ts` (6 seeds × 30 days + 100-day
  soak), `declump.test.ts`, `persist.test.ts`. Seeded thresholds may move only in the sim tasks
  (1, 4), each with a **justification table row** naming the root cause — the M9/M10 discipline.
  Prefer the draw-free tools `idHash` / `idOffsetAngle` (behaviors.ts:768-779) over new draws.
- `tests/feeding.test.ts` deliberately re-declares feeding constants literally (lines 32-42) so an
  accidental change fails. Changing them is allowed and expected here — update that contract file
  **with justification**, never by loosening assertions.
- `WorldState` stays a serializable POJO. New `Creature` fields must be **optional**, with a
  defensive default in `migrations.ts` — the `STEPS` chain is empty by design and stays that way
  (the M10 `NEW_HOME_SITE_GROUPS` top-up at migrations.ts:56-74 is the pattern).
- Art: 100% code-crafted vector rigs, no AI images, no asset packs. New species/behaviour flags are
  **data**, never new systems, except where this plan explicitly authorises one (Task 4).
- Render: textures baked once, no live filters, no per-frame allocation, nothing flashes — the
  gentle aesthetic binds (eases ≥ 600ms).
- Testing policy unchanged: sim + persist are tested; rendering is eyeballed by the user. Agents
  do **not** give the final visual verdict.
- Commits end with the `Co-Authored-By:` trailer. Model tiers are annotated per task
  `[impl: X / review: Y]`; re-reviews take haiku unless the fix diff is sim-behavioural.
- Work happens in an **isolated git worktree** (user's established preference this cycle).

## Key existing interfaces to reuse

- `socializeRing(partnerPos, id, landing)` — behaviors.ts:115-121. Approach point on a ring around
  a partner, id-hashed angle, `nearestRestable`-clamped, **zero RNG draws**. The exact template for
  a feeding contact ring.
- `turnToward(current, target, maxDelta)` — movement.ts:142, already exported. The facing fix.
- `moveToward(c, target, speed, medium, landing)` — movement.ts:22-43, returns `-1` on refused snap.
- `broodOffsetX/Y` on `CreatureView` — Renderer.ts:80-83 / :587-589 / :1050-1053. The sanctioned way
  to draw a creature off its sim position without touching the sim.
- `RigInstance` hand-picked part lookups (`shadow`, `shadowGraphic`, `food`) — RigRenderer.ts:11-33,
  :61-65. Exposing `pouch` is a two-line change in the same pattern.
- `applyStage` rig rebuild + the `rippleSprite` detach/reattach dance — Renderer.ts:1405-1417. The
  precedent for a reparented child surviving a stage change.
- `ExtraClipName` (format.ts:18) — opt-in per rig, unlike `ExtraClipName`'s compile-enforced sibling
  `CoreClipName`, which `tests/rigs.test.ts:18` pins across all twelve rigs.

---

## Thread A — feeding becomes a meeting

### Task 1: Parent and baby actually meet (sim) [impl: sonnet / review: opus]

**Files:** modify `src/sim/behaviors.ts`, `src/sim/family.ts` · Tests: modify `tests/feeding.test.ts`
(contract file — justified), extend `tests/balance.test.ts` if relief totals shift.

**Interfaces produced:**
- `feedContactRing(parentPos, babyId, landing): Vec2` in behaviors.ts, modelled line-for-line on
  `socializeRing`: radius `FEED_CONTACT_RANGE`, angle `idOffsetAngle(babyId)`, clamped through
  `nearestRestable`. **Zero RNG draws** — this *replaces* the leash's current two-draw ±25/±18
  scatter during a hold, so the draw count drops by two per re-gather. That is a deliberate,
  justified stream change confined to this task.
- `FEED_CONTACT_RANGE = 40` — the new radius at which hunger actually transfers, and the radius the
  contact ring targets. `FEED_RANGE = 90` is retained but demoted to the *eligibility/gather*
  radius: a baby inside 90 is pulled to the ring; only a baby inside 40 is fed. This is what stops
  feeding-at-arm's-length.
- **Facing.** During a feeding hold, each tick: the parent turns toward the nearest eligible baby
  and each in-contact baby turns toward the parent, both via `turnToward` at a gentle rate
  (`FEED_TURN = 0.12` rad/tick). Deterministic, no draws. This is the fix for finding (2).
- **Beats.** The nurse hold gains explicit steps on the existing `activity.step` field (no new
  persisted field): `0` travel home → `1` gather & settle → `2` nursing → `3` satisfied linger.
  Carry keeps `0..3` and gains `4` linger. Durations: settle 30t, nurse 90t, linger 40t
  (`NURSE_HOLD_TICKS` 80 → a 160-tick sequence ≈ 16s at 1×). `NURSE_HUNGER_RATE` is retuned so
  **total relief per hold stays ≈ 0.48**, keeping the balance suite's population dynamics intact —
  this is the guard against a longer ritual starving the valley.

- [ ] **Step 1: Failing tests.** In `tests/feeding.test.ts`: (a) during a nurse hold the mother's
      heading converges to within 0.2 rad of the bearing to her nearest baby within 40 ticks
      (fails today: heading never changes); (b) a baby at distance 70 — inside `FEED_RANGE` but
      outside `FEED_CONTACT_RANGE` — is **not** fed, and is instead pulled to a ring point within
      `FEED_CONTACT_RANGE` of the mother, then fed (fails today: fed where it stands); (c) the
      hold walks steps 0→1→2→3 with the pinned durations and total relief per baby stays within
      1e-9 of the retuned target; (d) the contact ring consumes zero RNG draws (assert
      `state.rng` is byte-identical across a re-gather).
- [ ] **Step 2:** Watch each fail for the right reason.
- [ ] **Step 3:** Implement per Interfaces.
- [ ] **Step 4:** Full suite. Produce the **justification table**: one row per seeded threshold that
      moved, naming the root cause (expected: the two removed leash draws shift every seeded world
      from the first re-gather onward; relief retune must show net-neutral). `determinism.test.ts`
      and `persist.test.ts` must pass **unchanged in kind** (same-seed equality still holds; the
      fixtures re-baseline). Lint (sim purity), build.
- [ ] **Step 5:** Commit — `feat: a feeding is a meeting — they turn to each other and touch`

### Task 2: Poses that meet — new optional clips (rigs) [impl: sonnet / review: sonnet]

**Files:** modify `src/rigs/format.ts`, `src/rigs/rabbitRig.ts`, `deerRig.ts`, `robinRig.ts`,
`kangarooRig.ts` · Tests: extend `tests/rigs.test.ts`.

**Interfaces produced:** two new **optional** clips on `ExtraClipName`: `feedGive` (the parent
lowers head/neck toward the ground-level meeting point) and `feedTake` (the baby stretches up).
They are `ExtraClipName`, **not** `CoreClipName`, deliberately: `CoreClipName` is compile-enforced
across all twelve rigs (`format.ts:86`, pinned by `tests/rigs.test.ts:18`), so making them core
would force twelve rigs of throwaway authoring in this milestone. As optional clips they are
authored only for the four Thread-C species now and completed for the rest in M13, with
`clipFor` falling back to today's `'sit'` / `'eat'` for any rig that lacks them. **This is the
join between Thread A and Thread C** — the species getting new art get the new feeding poses.

- [ ] **Step 1:** Extend `ExtraClipName`; extend `tests/rigs.test.ts` so that *if* a rig defines
      `feedGive`/`feedTake` the same structural rules apply (tracks target real parts, keyframes
      span exactly t=0..1 ascending).
- [ ] **Step 2:** Author both clips for rabbit, deer, robin, kangaroo — heads arriving at a shared
      meeting height, eased, nothing snapping.
- [ ] **Step 3:** Suite + lint + build. **Step 4:** Commit — `feat: she lowers her head, the little one reaches up`

### Task 3: You can tell it is happening (render + ui) [impl: sonnet / review: sonnet]

**Files:** modify `src/render/Renderer.ts`, `src/render/effects/Ambient.ts`, `src/ui/InspectCard.ts`.

**Interfaces produced:**
- `clipFor` gains `feedGive`/`feedTake` with graceful fallback, **and `nursing` is promoted above
  `moving`** — today `moving` outranks `nursing` (Renderer.ts:1554 before :1555). A mother in the
  hold is genuinely stationary so this rarely bites *during* nursing, but it does cost the pose on
  arrival and will bite the new settle beat, where she micro-adjusts to face her baby. Reorder it
  while we are here rather than build the new beats on top of a known-fragile ordering.
- Mote legibility: a **burst of 3 staggered motes** per `Feeding` instead of one; radius 3 → 5 px;
  lifetime 500 → 900 ms; spawned from the parent's **head** toward the baby's head rather than
  body-centre to body-centre. Pool grows 12 → 24. Still no per-frame allocation.
- Beat-aware `InspectCard` strings, one per new step (settling / nursing / resting after).
- Feeding visuals stay off at T0 by design — the user did not ask to find feedings from world zoom.

- [ ] **Step 1:** Implement. **Step 2:** Suite, lint, build (render is eyeballed, not unit-tested).
- [ ] **Step 3:** Commit — `feat: the moment reads — longer motes, truer poses, words that follow the beat`

---

## Thread B — a real joey in a real pouch

### Task 4: Pouch-carry (sim) [impl: opus / review: opus]

**Files:** modify `src/sim/state.ts`, `src/sim/species.ts`, `src/sim/behaviors.ts`,
`src/sim/family.ts`, `src/persist/migrations.ts` · Tests: new `tests/pouch.test.ts`, modify
`tests/persist.test.ts`, `tests/species.test.ts`.

This is the one new *system* in M12 and the highest-risk task in the milestone — hence opus both
sides and strict isolation from Task 1's stream changes (land Task 1 first).

**Interfaces produced:**
- `Creature.carriedBy?: number | null` — a new **optional** field (the rider's view; chosen over a
  `carrying` field on the mother so the invariant "at most one carrier" is structural, and over
  encoding in `Activity` because a carried joey must still hold its own activity). `SAVE_VERSION`
  stays 1; `migrations.ts` gains a defensive pass next to the `lastWandererTick` default that
  normalises a missing value to `null` **and clears any `carriedBy` pointing at an id no longer in
  `creatures`** (the orphaned-reference guard).
- `reproduction.pouchCarry?: true` on `SpeciesParams` — kangaroo only. Keeps this data, per the
  "new species = data" rule, and leaves the door open for M13 without new code.
- **Mount/dismount** live in `family.ts`'s `rearing` case, beside the existing leash. Mount when the
  species opts in, the child is `stage === 'baby'`, it is within `MOUNT_RANGE` of its mother, and
  nothing carries it. Dismount when the child leaves the baby stage, when the mother passes or is
  removed, or on a **graze window** — a deterministic `idHash`-phased interval during which a
  sated joey hops out to feed itself, then remounts. All transitions draw **zero** RNG.
- **Position derivation** happens inside the `applyActivity` loop, which iterates `state.creatures`
  in array order. A joey's id is always greater than its mother's (monotonic `nextId`), so it is
  always later in the array and already sees her *this tick's* position — no one-tick lag, no
  pipeline reorder. `joey.pos = mother.pos; joey.heading = mother.heading`.
- **Bypass** in three places, each guarded on `carriedBy !== null`: `applyActivity` early-returns
  before the movement `switch` (needs `activity.ticks` and `decayNeeds` to keep running — a riding
  joey still gets hungry and is still nursed); `selectBehavior` must not pick `forage`/`wander`;
  and the baby leash must not re-target a carried joey to `gather` every tick.
- `removeCreature` (family.ts:113-128) clears `carriedBy` on either party's removal.

- [ ] **Step 1: Failing tests** in `tests/pouch.test.ts`: (a) a kangaroo joey near its mother mounts
      within N ticks and thereafter its position equals hers exactly, every tick, while she hops
      across the valley (fails today: it falls behind immediately, per finding 3); (b) it dismounts
      on reaching juvenile and resumes ordinary movement; (c) a save taken mid-ride loads and
      continues carrying; a save whose `carriedBy` names a dead id loads with the joey freed
      (`persist.test.ts`, deep-cloning the frozen fixture as every test there does); (d) 2000 ticks
      of a kangaroo family consume **exactly** the RNG draws they did before this task — the
      zero-draw guarantee, asserted on `state.rng`; (e) `stuck.test.ts`-style: a carried joey always
      eventually dismounts (no permanent freeze — this is precisely the failure class that file
      exists for).
- [ ] **Step 2:** Fail right. **Step 3:** Implement. **Step 4:** Full suite + justification table
      (expectation: **no** seeded threshold moves, because every transition is draw-free — any
      movement here is a bug, not a re-baseline). Lint (sim purity — the new field must stay POJO),
      build.
- [ ] **Step 5:** Commit — `feat: the joey rides — a pouch that really carries`

### Task 5: Drawing the joey inside the pouch (render) [impl: sonnet / review: opus]

**Files:** modify `src/render/creatures/RigRenderer.ts`, `src/render/Renderer.ts`,
`src/rigs/kangarooRig.ts`, `src/ui/InspectCard.ts`.

**Interfaces produced:**
- `RigInstance` exposes the `pouch` container (two lines, exactly the existing `shadow`/`food`
  lookup pattern).
- While carried, the joey's view node is **reparented into the mother's `pouch` container** rather
  than nudged with `broodOffset`. Reparenting is chosen because **there is no creature z-sort at
  all** — `creatureLayer` never sets `sortableChildren` and views are appended in creation order
  (Renderer.ts:428/:574), so a joey born after its mother would otherwise always paint *over* her,
  and could never look tucked *inside* the pouch. Inside a rig, z-order does work (`part.z` →
  `zIndex`), which is exactly what we need.
- The kangaroo pouch splits into `pouchBack` and `pouchFront` with the joey's z between them, so
  the pouch rim genuinely overlaps the joey. **This supersedes the decorative `joey` rig part,
  which is deleted** — the real creature replaces it, ending the duplication the user saw.
- Reparenting must survive `applyStage`'s destroy-and-rebuild (Renderer.ts:1405-1417); follow the
  `rippleSprite` detach/reattach precedent.
- `pickCreature` (Renderer.ts:494-507) hit-tests raw `c.pos` within `80/zoom` — a joey sharing its
  mother's exact position would steal or break taps for both. Carried creatures are excluded from
  the hit test and reached instead through the mother's card ("carrying a joey").
- Mother plays `walk` while carrying; the joey plays `sit`.

- [ ] **Step 1:** Implement. **Step 2:** Suite (rig structure tests cover the pouch split), lint,
      build. **Step 3:** Commit — `feat: a head over the pouch rim, and it is really her joey`

---

## Thread C — animals you recognise

### Task 6: The recipe, proved on the rabbit [impl: opus / review: sonnet]

**Files:** create `docs/superpowers/specs/2026-08-21-rig-art-recipe.md`; rewrite
`src/rigs/rabbitRig.ts`.

The recipe is written **and proven on one species in the same task**, so the document describes
something real rather than an intention — then Task 7 applies it three more times and M13 applies
it eight more. No format change is needed (finding 4). The four dimensions become four concrete
rules:

- **Silhouette** — body masses move from `roundRect`/`circle` blobs to `path` shapes with
  species-true proportions. The primitive is already implemented and proven (dodo beak, duck bill,
  koi fins, kangaroo tail); it has simply never been used for a torso. Acceptance test: blacked
  out, the animal is nameable.
- **Markings** — the signature that names the species (rabbit's blaze and cotton tail, robin's red
  breast, deer's white rump and fawn spots, kangaroo's pale chest).
- **Shading & depth** — a consistent three-tone system built from layered alpha shapes: base coat,
  a darker mass along the back/underside contact, a lighter belly and rim on the sunlit side. This
  extends an idiom already in the code (the rabbit's `CREAM alpha 0.8` belly, the kangaroo tail's
  `CREAM alpha 0.4` highlight). **No gradient fill kind is added** — `ShapeFill` stays flat, so the
  format, the baker and every existing rig are untouched.
- **Motion & posture** — limbs gain upper/lower segments so gait can articulate (today `legB`/`legF`
  are single stub ellipses), plus per-species gait character in the clip keyframes and an honest
  `strideLength`.

Target density: **35–55 shapes** per rig, up from today's 9–23. Justified by finding (4): the cost
is bake time once per `species|stage|pose` and per-frame vertex cost only at T2, where few
creatures are on screen.

- [ ] **Step 1:** Write the recipe doc, including a per-dimension acceptance test and the shape
      budget. **Step 2:** Rebuild `rabbitRig` to it, keeping all seven core clips valid and adding
      Task 2's `feedGive`/`feedTake`. **Step 3:** `tests/rigs.test.ts` green (structure), lint,
      build; capture a before/after still for the user. **Step 4:** Commit —
      `feat: a rabbit you would know by its shadow`

### Task 7: Deer, robin, kangaroo to the same bar [impl: opus / review: sonnet]

**Files:** rewrite `src/rigs/deerRig.ts`, `src/rigs/robinRig.ts`, `src/rigs/kangarooRig.ts`.

Three species against the reviewed recipe — deer (large quadruped, the delicate high step), robin
(songbird, the template every other bird inherits in M13), kangaroo (hopper; **coordinate with
Task 5** — this task owns the `pouchBack`/`pouchFront` art, Task 5 owns the reparenting).

- [ ] **Step 1:** Deer. **Step 2:** Robin. **Step 3:** Kangaroo, pouch split included.
- [ ] **Step 4:** Suite, lint, build; stills for the user. **Step 5:** Commit —
      `feat: three more neighbours you would know anywhere`

### Task 8: v1.4 close-out [impl: haiku / review: none — the final review covers it]

- [ ] Update `CLAUDE.md` (status, M12 done, M13 candidate = the remaining eight species against the
      recipe). Write `docs/superpowers/reviews/2026-08-21-v1.3-user-review.md` recording the three
      threads, the user's rulings, and the findings — the M10/M11 convention.
- [ ] Full suite + `npm run lint` + `npm run build` green; deploy; hand the user a URL.
- [ ] Commit — `docs: v1.4 — the valley feeds, carries and shows its faces`

---

## Sequencing

- **Strictly sequential:** Task 1 → Task 4 (both mutate the RNG stream; isolating them keeps each
  justification table readable). Task 4 → Task 5. Task 6 → Task 7 (the recipe must be reviewed
  before it is applied three more times).
- **Parallel-safe:** Task 2 and Task 3 alongside Task 4/5 (different files, no stream risk).
  Task 6 can start as soon as Task 2 has landed `ExtraClipName`.
- **Coordination point:** Task 5 (reparenting) and Task 7 (pouch art) both touch
  `kangarooRig.ts` — Task 7 owns the art, Task 5 owns the container lookup.

## Risks

| Risk | Guard |
|---|---|
| Task 1's removed leash draws reshuffle every seeded world | Expected and confined to Task 1; justification table row; `determinism.test.ts` must still show same-seed equality, only the fixture values re-baseline |
| A longer, gentler feeding ritual starves the valley | `NURSE_HUNGER_RATE` retuned so total relief per hold is net-neutral; `balance.test.ts` 6 seeds × 30 days + 100-day soak is the gate |
| Pouch-carry silently introduces an RNG draw | Task 4 test (d) asserts the kangaroo family's draw count is **unchanged**; any movement is a bug, not a re-baseline |
| A carried joey never dismounts (the freeze class) | Task 4 test (e), modelled on `stuck.test.ts`, which exists for exactly this |
| A `carriedBy` pointing at a dead creature survives a save | Defensive pass in `migrations.ts` clears orphaned references; `persist.test.ts` covers it |
| Reparenting breaks on stage change | Follow the `rippleSprite` detach/reattach precedent (Renderer.ts:1410/:1414) |
| Richer rigs cost frame rate | Bakes are cached per `species\|stage\|pose`; T1/T0 draw one sprite; cost lands only at T2. Verify on a real phone before close-out — mobile perf is tested on device, not deferred |
| Four species look better than the other eight for a while | Accepted by the user's explicit scope choice; M13 closes it with the reviewed recipe |

## Verification

- `npm test` green (expect new `tests/pouch.test.ts`, a rewritten `tests/feeding.test.ts` contract,
  extended `rigs`/`persist`/`species` tests; ~185+ tests).
- `npm run lint` green — including the sim-purity boundary rule, which the new `carriedBy` field and
  the contact-ring maths must not breach.
- `npm run build` clean.
- Determinism gate: same-seed replay equality and the save-mid-run replay equivalence test both
  pass; every moved threshold has a justification row.
- **The user's verdict is the real gate**, per project policy: deploy and hand over a URL. Watch
  for (1) a nursing mother who turns to face her baby, lowers her head, and holds it long enough to
  read; (2) a joey riding in the pouch while its mother hops, and no second decorative joey; (3)
  four species that read as themselves. Agents do not eyeball this as the final judgment.
- Mobile perf checked on a real phone with the full 12-species population before close-out (this
  was already listed as awaiting confirmation from the 2026-08-20 review).

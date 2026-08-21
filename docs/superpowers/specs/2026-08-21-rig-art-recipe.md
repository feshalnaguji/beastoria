# The rig art recipe — how a Beastoria creature becomes recognizable

**Status:** written and proven on the rabbit in M12 task 6. Applied to deer / robin / kangaroo in
M12 task 7. The remaining eight species follow in M13.

**Scope:** this document is the checklist for rebuilding any `src/rigs/*Rig.ts`. It changes no
code outside the rig files — **no format change**: `ShapeFill` stays flat `{ color, alpha? }`,
`VectorShape` keeps its five kinds, `RigPart`/`StageStyle`/`CreatureRig` are untouched, and so are
`RigRenderer`, `RigBaker`, `Animator` and every rig not yet rewritten. A rig rebuilt to this recipe
is a drop-in replacement for the rig it replaces.

---

## Why this document exists

At the 2026-08-20 live review the user asked for animals that are "more realistic, better looking,
and recognizable," and when asked what *recognizable* concretely means, selected **all four** of:

1. silhouette / proportions
2. markings / detail
3. motion / posture
4. shading / depth

Four named dimensions is a specification, not a mood. Each one below gets a rule you can follow and
an acceptance test you can actually run — a thing to look at or a number to compute, never "make it
nicer."

## The one-line version

> A creature is recognizable when you can name it from its shadow, name it again from a single
> colour patch, believe its weight from how it moves, and see which way the sun is coming from.

---

## Rule 1 — Silhouette

**The rule.** Every load-bearing body mass — torso, head, muzzle, thigh, foot, tail — is a `path`
shape whose outline carries the species' real proportions. `roundRect` and bare `circle` are
demoted to props and features only: the ground shadow, an eye, a catchlight, a carried berry, a
nose. A torso is never a rounded rectangle again.

`path`'s `d` is standard SVG path data rendered through Pixi's `GraphicsPath` (see
`RigRenderer.drawShapes`). It is already proven in this codebase — the dodo beak, the duck bill,
the koi fins, the squirrel tail, the kangaroo tail. It has simply never been used for a torso.

Proportions come before prettiness. Get these right first, in this order:

- **Where the mass sits.** A rabbit's bulk is at the *rump*; a deer's is at the *shoulder*; a
  squirrel's is at the *tail*. Draw the torso deeper at that end and shallower at the other. A
  torso of even depth end-to-end reads as "generic animal."
- **Ground clearance.** Belly-to-ground gap is a species signature: a rabbit crouches with almost
  none, a deer stands with more than a body's depth of it.
- **Limb ratio.** Rabbit hind ≫ fore. Deer fore ≈ hind and both long. Kangaroo hind ≫≫ fore.
- **Head carriage.** Where the skull sits relative to the shoulder line, and at what angle the
  muzzle leaves it.

**Acceptance test (silhouette).** Fill every shape in the rig with black at alpha 1 and look at the
outline alone. *Can you name the animal?* If the answer needs the colours back, the silhouette
failed.

**Code-review proxy** (checkable without rendering): does any part whose drawn area is larger than
roughly 100 px² still use `roundRect` or a bare `circle` as its principal shape? If yes, the
silhouette rule was not applied.

**Worked example — the rabbit.** The rabbit's silhouette is four facts, and the rebuilt rig states
all four:

1. A **low, compact torso** with the deepest, highest point at the **rump** (body-space `y = -20`
   at `x = -18`) tapering to a shallower chest (`y = -10` at `x = 14`). Almost no belly-to-ground
   gap: the belly line sits at `y = 16` with the ground at `y = 26`.
2. **Ears longer than the head is tall.** Skull height 28 px; ear length 34 px. This is the single
   loudest silhouette cue the species has, and it must be a *ratio*, not a vibe.
3. A **rounded rump broken by the scut** — a circle of tail that pushes past the rump's rear edge,
   so even blacked out the rump is not a smooth arc.
4. **Short forelegs, folded hind legs, and a long hind foot lying flat on the ground.** The foot
   is a distinct horizontal mass from `x = -22` to `x = 0` at the ground line. This is the fact
   that separates a rabbit from every other small mammal in the valley from the side.

---

## Rule 2 — Markings

**The rule.** Every rig carries a *naming set* of markings:

- exactly **one primary marking** — the largest, highest-contrast patch, chosen so it survives being
  baked to a ~30 px sprite at LOD T1;
- **two to four secondary markings** — small, true field marks that reward zooming to T2 and are
  invisible at T1. They cost nothing at distance and are the whole reason close zoom feels
  different from far zoom.

Markings are *field marks*, not decoration. Pick them the way a field guide would: the marks a
naturalist would use to tell this animal from the one it most resembles.

**Acceptance test (markings).** Name the roster species this one is most easily confused with, then
look at both at T1 size. *Does one colour patch separate them?* If the two only separate by
outline, the primary marking is too small, too low-contrast, or in the wrong place.

**Worked example — the rabbit,** whose nearest confusable is the squirrel (same size class, same
warm-brown key, same crouch):

- **Primary — the white cotton scut.** A near-white puff at the rump, sized so it stays visible in a
  baked T1 frame, and deliberately placed to break the rump silhouette. It is the one mark that
  names a rabbit from behind, from the side, and at a distance, and it is the largest value jump
  anywhere on the animal.
- **Secondary — a pale eye ring.** A genuine wild-rabbit field mark, and it does more for
  "recognizable" at T2 than anything else on the head: it turns a dark dot into an *eye*.
- **Secondary — dark ear rims over a blush inner ear.** The ear is already the silhouette cue; the
  rim gives it an edge so it reads as an ear rather than a leaf, and the blush lining is what makes
  a rabbit ear look thin and translucent.
- **Secondary — cream chin and countershaded belly.** Real countershading, and it doubles as the
  light tone in Rule 3.

**A decision, recorded.** The task brief offered "blaze and cotton tail" as the rabbit's example
markings. The scut is kept as the primary — but the **nose blaze is deliberately rejected**. A white
blaze up the face is a *domestication* marking (Dutch and blaze-marked pet breeds); wild European
rabbits have a soft pale muzzle and chin, no stripe. Beastoria is a valley of cute-but-realistic
*wild* creatures, and a pet-rabbit blaze would read as "someone's hutch escaped" rather than "a
rabbit lives here." The rig ships the soft cream muzzle/chin patch instead, which is both true and
does the same job of lifting the face out of the body colour. The pale eye ring was added in its
place as the second T2 mark.

**Downstream note for tasks 7 and M13.** Say what each species' primary marking is *in a comment at
the top of the rig file* before drawing it. If you cannot name it in one clause, you have not
chosen one yet.

---

## Rule 3 — Shading and depth

**The rule.** A consistent **three-tone system**, built entirely from **layered flat-alpha shapes**.
No gradient fill kind is added — `ShapeFill` in `src/rigs/format.ts` stays exactly
`{ color: number; alpha?: number }`, and nothing in the format, the baker or any other rig changes.
This is an extension of an idiom the codebase already uses (the old rabbit's `CREAM alpha 0.8`
belly, the kangaroo tail's `CREAM alpha 0.4` highlight) — made systematic rather than occasional.

The three tones, declared as named constants at the top of every rig file:

| tone | role | typical use |
| --- | --- | --- |
| **base coat** | the species' local colour | the full silhouette path of every mass |
| **shade** (darker) | form shadow and contact | back mantle, underside contact band, creases, the *entire far-side limb* |
| **light** (lighter) | countershading and rim | belly, chin, and a thin rim on the sunlit edge |

Most rigs want a fourth constant, a **deep** tone used only at low alpha for creases and the
ground-contact band, because a single "dark" that works as a mantle is too light to read as a
crease.

**Paint order on a mass** — always this order, back to front:

1. base coat (full silhouette path)
2. **shade**: form mass (e.g. the darker guard-hair mantle along the spine)
3. **light**: broad countershading (belly, chin, cheek)
4. **shade**: a *thin* contact band hugging the bottom silhouette edge
5. **light**: a *thin* rim sliver hugging the top silhouette edge

Steps 2 and 5 both live on the back. That is not a contradiction, it is how painted animal art
works: a dark mantle with a lit rim sitting on top of it, at the very outer edge. Keep the rim to
2–3 px and the mantle to 4–6 px and they read as one lit form rather than two stripes.

**Sun direction is fixed: from above.** Top edges catch light, undersides go dark, ground contact
is darkest. Never light a rig from below; a valley of creatures lit from four directions reads as
broken rather than varied.

**Depth from far-side limbs.** A side-view creature has four legs, not two. Draw the off-side pair
as separate parts at negative `z` (behind the body's own graphic) filled entirely in the **shade**
tone. They cost two or three shapes each and buy more perceived depth than any other single move —
the body suddenly has a front and a back rather than being a flat card.

**The shadow part gets two ellipses, not one.** A wide soft one (`alpha ≈ 0.18`) and a tighter,
darker core under the weight-bearing mass (`alpha ≈ 0.22`). A single hard ellipse is the thing that
makes a creature look pasted onto the grass.

**Acceptance test (shading).** Two checks:

- *Value test.* Cover the top half of the creature and then the bottom half. The bottom half must
  read visibly darker. If the two halves are the same value, there is no form.
- *Flatness test.* Every part whose drawn area exceeds roughly 100 px² carries **at least two
  tones**. A single-fill torso, thigh, head, or tail fails.

---

## Rule 4 — Motion and posture

**The rule, part A — limbs articulate.** A load-bearing limb is at least two parts with a joint
between them: `upper` parented to the body at the hip/shoulder, `lower` parented to `upper` at the
knee/elbow, and for animals with a long foot (rabbit, kangaroo, deer) a third `foot` part at the
hock. Rotation happens around the part's attach point, so a two-part limb *bends* where a
one-ellipse stub can only *swing*. Single stub ellipses are the reason every quadruped in the
valley currently walks the same way.

**The rule, part B — gait character, not a generic trot.** Rabbits, hares and kangaroos **bound**:
both hind legs move together, hind feet swing past the forefeet, and there is a flight phase. Deer
**trot**: diagonal pairs, no flight phase, minimal vertical travel. Small birds **hop**: both feet
together, no leg cycle at all, all the motion in the body arc. Author the beat the species actually
has. A rig whose `walk` clip is `legF: +0.5 → -0.5`, `legB: -0.5 → +0.5` has *no* gait character —
that is the default, and after this recipe it should appear in no rig that walks.

**The rule, part C — an honest `strideLength`.** `strideLength` is the world-px distance the
creature actually travels in one full gait cycle. `Renderer.ts` divides accumulated displacement by
it to pick T1 flipbook frames and to set the T2 animator's playback rate, so a dishonest value makes
a creature moonwalk or scurry. Derive it, don't inherit it:

```
cyclesPerSecond = SPECIES[id].speed * 10 / strideLength     // sim runs at 10 ticks/sec
```

Sanity bands, by gait family:

| gait | cycles / second |
| --- | --- |
| walking quadruped (deer) | 1.2 – 2.0 |
| bounding / hopping mammal (rabbit, kangaroo, squirrel) | 1.4 – 2.4 |
| hopping small bird (robin) | 2.5 – 4.0 |
| slow walker (turtle, dodo) | 0.5 – 1.2 |

Anything outside its band is a bug worth fixing while the rig is open.

**The rule, part D — walk `durationMs` follows `strideLength`.** Author

```
walk.durationMs ≈ strideLength / (SPECIES[id].speed * 0.01)      // px per ms
```

so the renderer's playback-rate multiplier sits at ≈ 1.0 while the creature is cruising. The clip
then plays at the speed it was authored at most of the time, and — because T1 bakes six frames at
fixed normalized times — the baked flipbook shows the same poses the live T2 rig shows.

**The rule, part E — squash and land.** When a clip squashes the body (`sy < 1`) it must also
lower it (`py > 0`) by the amount that puts the feet back on the shadow line:

```
footY * sy + py ≈ groundY
```

Otherwise a sitting or sleeping creature's feet sink through the ground — which is exactly what the
old rabbit `sit` clip did (`26 → 37 × 0.85 + 3 = 34.5` against a ground line of `26`).

**The rule, part F — stage overrides never touch the load-bearing leg chain.** `StageStyle.partScale`
sets a Pixi container's scale, and container scale is **hierarchical**: scaling `hindThigh` to
`y: 0.8` shortens the shank and the foot with it and lifts the foot clear of the shadow. Put stage
proportion changes on the **head, muzzle, ears, tail and feet** — which is also where the real
juvenile cues live (a kit is a big head with stubby ears, not a rabbit with short thighs).

**Acceptance test (motion).** Three checks:

- *Articulation.* In the `walk` clip, does the `lower` segment have a `rot` track that is **not** a
  copy or a negation of the `upper`'s? If the two curves are the same shape, the joint is decorative.
- *Frame distinctness.* Sample the clip at `t = 0.25` and `t = 0.75`. The two poses must differ —
  they are two of the six frames `RigBaker` bakes for T1, and a symmetric three-key clip makes them
  pixel-twins (the M9 bug this recipe must not reintroduce).
- *Cadence.* Compute `speed * 10 / strideLength` and check it against the band table above.

---

## Shape budget

**Target: 35–55 shapes per rig**, up from today's 9–23.

**Why this is safe.** `RigBaker.bakedFrame()` caches by `species|stage|pose|poseT`, so the cost of
extra shapes at LOD T0 and T1 — where nearly every creature on screen lives — is a **one-time bake**
into a texture, after which everything is a plain sprite regardless of how many shapes went into it.
Per-frame vertex cost is paid only at **T2**, the close-up tier, and T2 is by construction the tier
where the camera is zoomed into one family and only a handful of creatures are on screen. Tripling a
rig's shape count multiplies a cost that is already near zero at the population sizes that matter.

**Why there is an upper bound at all.** Bake time is paid at first sight of each
`species|stage|pose` combination, and there are 4 stages × ~9 poses × 12 species of them. Past
roughly 55 shapes a rig starts to add visible hitching on first zoom-in without adding anything the
eye can find, and the file stops being editable by hand.

**Rough allocation that lands in range:**

| region | shapes |
| --- | --- |
| shadow | 2 |
| torso (5-step paint order) | 5 |
| head + muzzle | 12–14 |
| ears / horns / crest (pair) | 8 |
| near limbs (2× articulated) | 10–12 |
| far limbs (2× flat shade masses) | 5 |
| tail | 3 |
| carried-food prop | 2 |

---

## Contracts a rebuilt rig must not break

These are enforced by `tests/rigs.test.ts` and by the renderer, and they are the things a rewrite
most easily drops on the floor:

- **Reserved part ids.** `shadow`, `body` and `food` are looked up by name by `RigRenderer` and
  `Animator` (`pouch` too, on the kangaroo). Keep them, keep their roles.
- **All seven core clips** — `idle`, `walk`, `sleep`, `eat`, `social`, `carry`, `sit` — stay defined,
  with every track targeting a real part id and every channel's keyframes spanning `t = 0` to
  `t = 1` ascending.
- **Loop safety.** Every channel's value at `t = 1` equals its value at `t = 0`, or the clip visibly
  snaps every cycle.
- **`feedGive` / `feedTake` intent** (M12 task 2). If the rig defines them, the *gesture* must
  survive the rewrite: `feedGive` is a gentle downward lean of the head, deliberately shallower than
  `eat`'s graze dip, held while the young one arrives; `feedTake` is its mirror, the head stretching
  up and forward. If the head is restructured into several parts, reproduce the gesture on whatever
  part now plays the head's role — never leave a track pointing at a part id that no longer exists,
  and never quietly delete the clip.
- **`food` is carry-only.** The carried-morsel part stays hidden in every clip but `carry` via
  `hideInClips` — including the new `feedGive` / `feedTake`, so a nursing mother is never drawn
  holding a berry in her mouth.
- **All four life stages styled**, with every `partScale` key naming a real part.

# M14 — Rig-art pass for the remaining eight species

**Status:** ruled and scoped 2026-10-10 by the controller under the user's standing delegation
("continue and don't ask me to check anything, you proceed in your way"). M14 is one of the two
M14 candidates recorded in CLAUDE.md. The other one, feeding realism, needs a watch-and-diagnose
session first and stays deferred.

## Goal

Every creature in the valley meets the same bar as rabbit, deer, robin and kangaroo. Each rebuilt
rig follows `docs/superpowers/specs/2026-08-21-rig-art-recipe.md` (the recipe), which is binding:

- path silhouettes;
- one primary and two to four secondary field marks;
- the three-tone base/shade/light paint order (plus a deep tone);
- far-side limbs in shade;
- a two-ellipse shadow;
- articulated limbs with a species-true gait;
- 35–55 shapes per rig.

The rebuilt rigs are the eight still on the old art:
**squirrel, frog, turtle, duck, owl, dodo, phoenix, koi.**

## Hard constraints

- Only `src/rigs/<species>Rig.ts` changes for each species. There is no format, renderer, baker,
  animator or sim change.
- Every contract in the recipe's "Contracts" section holds, and `tests/rigs.test.ts` stays green:
  - reserved ids `shadow`, `body`, `food`;
  - the seven core clips, loop-safe;
  - all four stages styled;
  - the `food` `hideInClips` table by `feedMode`.
- **Every clip id the current rig defines survives**, including extras such as `flap`, `swim`,
  `feedGive` and `feedTake`. Renderer code selects clips by name.
- The overall footprint stays close to today's: the bounding box within roughly ±15%. Sprite
  sizes, shadow `y` and feed-contact distances were tuned against the current sizes.
- Exemplars to copy structure from:
  - `robinRig.ts` for birds (duck, owl, dodo, phoenix);
  - `rabbitRig.ts` and `kangarooRig.ts` for small quadrupeds (squirrel, frog, turtle);
  - the koi has no exemplar. It is a side-view fish, built with the same tone system.

## Species briefs (primary mark first)

| species | feedMode | nearest confusable | primary mark | secondary marks | silhouette facts | motion |
| --- | --- | --- | --- | --- | --- | --- |
| squirrel | nurse | rabbit | the huge bushy tail, with a frosted pale fringe, held in an S over the back | ear tufts, a pale eye ring, a crisp cream belly bib, dark hands/claws | mass at the tail, a compact body, an upright sit on its haunches, small rounded ears | a bounding gallop with the tail rippling; sits up to eat with its forepaws at its mouth. Keep the existing `feedGive`/`feedTake` gesture |
| frog | self | turtle | a dark brown temporal mask from the snout through the eye to the eardrum | a golden iris with a horizontal pupil, dorsolateral ridge lines, dark crossbars on the hind legs, a pale lemon throat | a wide flat head with bulging eyes set on top, no neck, a back sloping down to the rump, Z-folded hind legs far larger than the forelegs | the hop: hind legs extend explosively then fold; the idle throat pulses |
| turtle | self | frog | the high-contrast yellow rim of the marginal scutes against a dark olive domed carapace | a red ear patch, yellow head/neck stripes, scute seams, clawed feet | a domed carapace with scute plates, a neck that extends and retracts, stubby columnar legs, a small pointed tail | a slow diagonal walk with the head bobbing forward; the head tucks in to sleep |
| duck | carry | dodo | the drake's iridescent green head (keep the current colouring if it is a hen; match whatever the rig shows today) | a white neck ring, a blue speculum bordered in white, a curled black tail feather, orange feet | a boat-shaped body, short legs set far back, a broad flat bill | a waddle that rolls side to side; a gliding swim with paddling feet |
| owl | carry | dodo | the pale facial disc with a dark rim | huge dark eyes, a streaked breast, barred wings, a pale V brow | a big round head with no neck, an upright barrel stance, a short tail | head swivels, slow blinks, silent unhurried wingbeats |
| dodo | carry | duck | the huge pale hooked bill (yellow-green with a dark hooked tip) | bare grey face skin round the eye, a curly white tail plume, tiny yellowish wings, scaly yellow legs | plump and pear-shaped, with a heavy head, stubby wings and stout legs | a heavy waddle with a forward-leaning gait |
| phoenix | carry | robin | a long flame-gradient trailing tail, with streamers (red to orange to gold) | a crest of three eye-tipped plumes, a golden eye ring, ember-tipped flight feathers, a soft glow halo | a long elegant neck, pheasant-like proportions, a tail longer than the body | graceful and slow; the tail streamers sway with lag |
| koi | self | — (the only fish; separates from the duck on the water) | a kohaku pattern of crimson patches on white | barbels at the mouth, scale-row shimmer, translucent fin edges, a dorsal fin | a torpedo body, a deep forked tail, pectoral fins | an S-curve body undulation and a tail sweep |

## Process

- Build natively under the controller, with each rig authored by a sonnet implementer.
  Implementers:
  - run only `npx tsc --noEmit` and
    `npx vitest run tests/rigs.test.ts --minWorkers=1 --maxWorkers=1`, in the foreground, never
    in the background;
  - do not commit; the controller commits per species;
  - run at most two at a time, because the machine is short of RAM.
- The controller recaptures `?portrait=<species>` PNGs into `public/guide/portraits/` and looks
  at them at the end, so the guide pages match the new art.
- Finish with one opus whole-branch review, the full suite, lint and build, then deploy.

## Also in M14 (small, ruled)

- **Kangaroo balance backlog:** the hardCap (8) is mismatched with the number of `SHADE_SCRAPES`
  home sites (3). Ruling: leave it. It predates M12, nothing is broken, and changing it touches
  the balance suite. It is re-deferred, explicitly.

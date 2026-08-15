# v1 user review — 2026-08-15 (drives M9)

The user reviewed v1 live (post-M8 deploy) and gave this feedback, verbatim themes:

1. **Movement not realistic** — "legs are not even moving and feels like only image is gliding."
2. **De-clump ring decision** — delegated: "check and do yourself which you find best."
3. **Min-zoom** — "bit laggy"; "green area outside creatures box … very weird; creatures box
   should cover the entire desktop and nothing weird background … should appear."
4. **CC-BY-SA audio decision** — delegated: "check yourself proper."
5. **Behaviors** — "feeding and other stuff … very unreal and not clear"; overall real-life
   behaviors "not good"; wants clearer, smoother, more realistic life.
6. **Fullscreen** — "should work in full screen mode also edge-to-edge on desktop."
7. **Birds** — "birds are not flying and walking on water etc.; similar issues maybe happening
   with other creatures."

## Root causes (from three code investigations, file:line in agent reports)

- **Gliding:** T1 walk flipbook bakes two pixel-identical frames for 7/8 species (frames
  sampled at t=0.25/0.75, the symmetry points of every walk track; only koi differs).
  Default desktop zoom lands in T1 (0.35–1.0) or T0 (static); live rigs need zoom ≥ 1.0.
  Bird rigs have zero leg tracks (legs parented to root, no clip targets them). Animation
  phase is wall-clock, not velocity — >2× foot-slide even at T2.
- **"Birds walking on water":** ducks are amphibious (correct sim) but render with standing
  legs + ground shadow on the pond — no swim presentation. Land birds genuinely cannot enter
  water. No flight exists anywhere (no 'air' medium, no altitude, no wing-beat locomotion clip).
- **Green margin:** world is fully painted, but Camera.clampTarget clamps the camera *center*
  to a fixed ±200 world-px box regardless of zoom, so at min zoom (zero horizontal slack on
  16:9) a drag exposes up to ~55% of the screen of bare app background (0x87a96b, nearly the
  meadow green). Secondary: lower-left quadrant (x<1800, y>1600) holds almost no content.
- **Zoom lag:** 0.18/frame damping with no dt normalization; Pixi's own ticker renders before
  GameLoop updates the camera (one frame of built-in latency); wheel ignores deltaMode
  (Firefox line-mode ≈ dead); 4 layout-forcing reads per frame.
- **Fullscreen:** F11 already edge-to-edge (no CSS letterboxing); missing only an in-app
  requestFullscreen affordance.
- **Behavior legibility:** the sim's richest loops render as generic walking. feedYoung's
  fetch/carry/deliver steps are never read by the renderer; brood/pass/nap creatures that are
  still moving slide in a sleep pose (clipFor checks sleep before moving); forage targets a
  random empty point (no food anchors); births/hatchings/passings have no in-world moment
  (views destroyed same-frame); activity labels are T2-only debug text.

## Decisions (controller, per user delegation)

- **(2) De-clump ring:** restore the full socialize/court ring in M9 and fix the two root
  causes that made the seeded tests fragile (unattached phoenix chick free-roam; hardCap not
  actually enforced), re-baselining seeded thresholds only with documented root-cause
  justification. Determinism (save-mid-run replay) remains inviolable.
- **(4) Audio licensing:** bless CC-BY-SA. All five flagged sources are Wikimedia Commons
  recordings under CC BY-SA 3.0/4.0 — a free license (attribution + share-alike), not the
  non-commercial kind the constraint guards against. LICENSES.md already documents per-file
  provenance and licenses processed derivatives as CC-BY-SA. CLAUDE.md constraint text updated
  in M9 close-out; no swaps.
- **Flight:** implement a real 'air' medium (path may cross water; landings must be on land)
  for robin/owl/phoenix, with airborne render presentation — not a cosmetic-only flap. No new
  WorldState fields (renderer infers airborne from motion), so saves stay v2-compatible.
- **Scope guard:** v1 remains watch-only. No caretaker features (v2). "More realistic" =
  make what the sim already does visible and honest, plus flight/swim presentation.

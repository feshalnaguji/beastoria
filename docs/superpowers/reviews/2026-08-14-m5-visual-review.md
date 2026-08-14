# M5 visual review — live deploy, 2026-08-14

Reviewed by browser agent against https://feshalnaguji.github.io/beastoria/ (post-M5 merge).
**Verdict: SHIP.** All 8 species render correctly and distinctly at all LOD tiers; zero console
errors (desktop + 390×844 mobile); day/night grading correct; owls forage at night while
diurnal species nap; deer herd loosely; koi stay in the pond; families form and claim homes.

## Carry-forward polish items (target: M8, unless trivially fixed earlier)

1. **Conga-line clustering (Important, steering polish):** creatures form unnaturally straight,
   evenly spaced queues (whole-valley diagonal line; three owls stacked vertically). Likely the
   socialize/gather target logic — everyone arrives at the same stop-distance along the same
   bearing. Fix idea: per-creature angular offset (derived deterministically from creature id)
   around social/gather targets so groups form loose clumps, not lines.
2. **Label collisions (Important, render polish):** activity labels + family name labels overlap
   and clip when creatures bunch (e.g. "so…lize" truncated). Fix idea: stagger label y by
   `(id % 3) * 12` at T2, and/or hide activity labels when two labels would overlap.
3. **Memorial accumulation (watch):** 27 memorials appeared over ~9 fast-forwarded game days with
   a stable ~45 population — consistent with the locked accelerated-ambient design (lifespans
   ≈ 8–15 game days), but memorials never despawn, so long sessions will carpet the valley.
   Fix idea for M8: memorials fade/shrink after ~2 game days, or cap per-area density.
4. **World edge (Minor):** zooming past minimum shows the hard 4096×3072 rectangle against flat
   background. Verify the zoom-out clamp actually prevents this at the final camera settings.
5. **FPS readout note:** DevPanel showed 1–2 fps under automated screenshot capture (GPU
   readback stalls — capture artifact, matching console warnings). Re-check real FPS manually
   on-device during the M8 perf pass; do not trust automation-derived FPS numbers.

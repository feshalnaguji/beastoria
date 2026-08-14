# M6 functional review — live deploy, 2026-08-14

Reviewed by browser agent against https://feshalnaguji.github.io/beastoria/ (post-M6 merge, 5b153a5).
**Verdict: SHIP.** Sound chip renders and unlocks correctly (chip-first-click regression verified
fixed: unlock without accidental mute); full toggle cycle + persistence across reload works; all
21 audio .webm fetches return 200 with zero console errors and no missing-asset warnings; 20s of
active mixing produced no runtime errors; M5 visuals unregressed.

## Carry-forward (target M8)

1. **Chip testability (Minor):** the sound chip has no `aria-label`/`data-testid`, and the
   accessibility tree merges it with adjacent DevPanel controls — automated E2E clicks were
   ambiguous. Add a stable id/label to the chip (also an accessibility win).
2. Audio was verified observationally only (fetches/state/UI) — actual sound quality and mix
   levels need the user's ears; the +6dB framed boost now runs through a soft compressor
   (threshold −6dB, 4:1) rather than a brick-wall limiter — judge by ear whether it's clean.

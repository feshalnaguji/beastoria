# Audio provenance — shipping gate (spec §4.5)

Every file under `public/audio/` MUST have a row here. CC0/PD/CC-BY/CC-BY-SA/Pixabay Content
License only. **Never** xeno-canto (any license) or BBC Sound Effects, and nothing NC. All
processing used the recipe from `.superpowers/sdd/2026-08-14-m6-sound/task-2-brief.md`:
`highpass -> afftdn -> loudnorm -> libopus/aac`, one-shots trimmed ≤4s, beds 30-90s with a short
(0.4s) in/out fade for a seamless loop point. Deer call additionally pitch-shifted −4 semitones
(rubberband) per the spec's film-standard lamb-bleat fallback. Processed derivatives of CC-BY-SA
sources are themselves licensed under the same CC-BY-SA version.

## Shipped files (public/audio/)

| File | Source URL | Author | License | Edits |
|---|---|---|---|---|
| families/robin/call1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Turdus-migratorius-003.ogg | Mdf (Wikimedia username) | CC BY-SA 3.0 | American Robin (Turdus migratorius), Sandbanks Provincial Park, Ontario 2007-05, featured sound; trimmed 0.70s single chip note @5.35s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/robin/call2.webm, .m4a | https://commons.wikimedia.org/wiki/File:Turdus-migratorius-003.ogg | Mdf (Wikimedia username) | CC BY-SA 3.0 | Same source; trimmed 0.60s single chip note @14.95s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/robin/chatter1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Turdus-migratorius-003.ogg | Mdf (Wikimedia username) | CC BY-SA 3.0 | Same source; trimmed 4.0s chip-note bout @5.35s (scold/chatter series), highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/duck/call1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Mallard_(Anas_platyrhynchos)_(W1CDR0001518_BD17).ogg | Ndalyrose (Wikimedia username); British Library Wildlife Sound Collection ref W1CDR0001518 | CC BY-SA 4.0 | Mallard quack; trimmed 1.15s @4.65s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/duck/call2.webm, .m4a | https://commons.wikimedia.org/wiki/File:Mallard_(Anas_platyrhynchos)_(W1CDR0001518_BD17).ogg | Ndalyrose (Wikimedia username); British Library Wildlife Sound Collection ref W1CDR0001518 | CC BY-SA 4.0 | Same source; trimmed 1.0s quack @8.35s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/owl/call1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Strix_aluco_male.oga | Vianney Bajart (Wikimedia username Vnyyy) | CC BY-SA 4.0 | Tawny Owl (Strix aluco) male hoot, own work; trimmed 1.35s @0.15s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k. Substitute species for great horned/tawny owl per brief. |
| families/owl/call2.webm, .m4a | https://commons.wikimedia.org/wiki/File:Tawny_owl_calling_at_night_in_Tuntorp,_Brastad,_Sweden.ogg | W.carter | CC BY 4.0 | Tawny Owl calling at night, Sweden; trimmed 3.5s hoot @7.0s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/deer/call1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Lamb_bleating_and_its_mother%27s_response.flac | Yosef Ben Melamed | CC BY-SA 4.0 | Lamb bleat (film-standard deer-bleat fallback per spec §build notes); trimmed 1.2s @1.10s, highpass 200Hz, denoise, pitch-shifted −4 semitones (rubberband), loudnorm, opus 56k/aac 96k |
| families/rabbit/call1.webm, .m4a | https://pixabay.com/sound-effects/nature-quiet-thud-hits-100179/ | toddcircle (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "quiet thud hits" foley; trimmed 0.4s single soft thump @0.40s, highpass 60Hz (low-voiced foley), denoise, loudnorm, opus 56k/aac 96k |
| families/koi/call1.webm, .m4a | https://pixabay.com/sound-effects/nature-small-water-splash-374843/ | freesounds123 (Pixabay) | Pixabay Content License | "Small water splash"; trimmed 2.4s @0.60s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| families/koi/call2.webm, .m4a | https://pixabay.com/sound-effects/film-special-effects-tiny-splash-83778/ | dslrguide (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Tiny Splash"; trimmed 0.55s @0.15s, highpass 200Hz, denoise, loudnorm, opus 56k/aac 96k |
| ambience/dawn-chorus.webm, .m4a | https://pixabay.com/sound-effects/nature-dawn-chorus-scotland-74965/ | PassingPlaces (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Dawn Chorus Scotland", multi-bird morning; trimmed 64.5s @1.0s, highpass 200Hz, denoise, loudnorm I=-21, 0.4s in/out fade for loop seam, stereo opus 80k/aac 128k |
| ambience/day-meadow.webm, .m4a | https://pixabay.com/sound-effects/nature-field-meadow-insects-crickets-summer-day-notl-10-57854/ | TRP (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Field, meadow, insects, crickets, summer day, NOTL"; trimmed 55.0s @5.0s, highpass 200Hz, denoise, loudnorm I=-21, 0.4s in/out fade for loop seam, stereo opus 80k/aac 128k |
| ambience/night-crickets.webm, .m4a | https://pixabay.com/sound-effects/nature-night-crickets-ambiance-67156/ | nick121087 (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Night Crickets Ambiance"; trimmed 47.2s @0.3s, highpass 200Hz, denoise, loudnorm I=-21, 0.4s in/out fade for loop seam, stereo opus 80k/aac 128k |
| ambience/water-lap.webm, .m4a | https://pixabay.com/sound-effects/film-special-effects-gentle-lapping-lake-water-waves-cottage-24-96-180721-54836/ | TRP (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Gentle lapping lake water waves cottage"; trimmed 55.0s @1.5s, highpass 200Hz, denoise, loudnorm I=-21, 0.4s in/out fade for loop seam, stereo opus 80k/aac 128k |
| ambience/wind-soft.webm, .m4a | https://pixabay.com/sound-effects/nature-a-gentle-breeze-wind-1-14813/ | mario1298 (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "a gentle breeze, wind 1"; trimmed 55.0s @8.0s, highpass 200Hz, denoise, loudnorm I=-21, 0.4s in/out fade for loop seam, stereo opus 80k/aac 128k |
| families/dodo/call1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Dove_cooing.ogg | Fæ (Wikimedia username) | Public domain | Designed dodo voice (giant pigeon relative): dove coo trimmed 1.9s @1.0s, pitch-shifted −5 semitones (asetrate/atempo, duration preserved), highpass 60Hz, layered with a lowpassed (100Hz) +6dB sub-body copy of itself (amix weights 1/0.35) for low resonant weight, loudnorm, opus 56k/aac 96k |
| families/dodo/call2.webm, .m4a | https://commons.wikimedia.org/wiki/File:CapeTurtleDove.ogg | MilesWelsh (Wikimedia username) | CC BY-SA 3.0 | Designed dodo voice, second two-note phrase variant: Cape Turtle Dove call (full 2.87s clip), pitch-shifted −7 semitones (asetrate/atempo, duration preserved), highpass 60Hz, layered with a lowpassed (100Hz) +6dB sub-body copy of itself (amix weights 1/0.35), loudnorm, opus 56k/aac 96k |
| families/phoenix/call1.webm, .m4a | https://commons.wikimedia.org/wiki/File:Grus_canadensis_Denali_National_Park.ogg (crane) + https://commons.wikimedia.org/wiki/File:Whooper_Swan_(Cygnus_cygnus)_(W_CYGNUS_CYGNUS_R1_C6).ogg (swan) + https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Common_Loon_-_001.mp3 (loon) | Innotata (crane, Denali NP); Beeld en Geluid Collecties (swan); Thesupermat / Yellowstone NPS sound library (loon) | Public domain (crane); CC BY 4.0 (swan); Public domain (loon) | Designed phoenix voice, layered from Sandhill Crane bugle phrase (substitute for common crane — no allowed-license common crane recording found; trimmed 3.0s @0s, highpass 200Hz, leading) + Whooper Swan warmth (trimmed 3.3s @16.9s, highpass 150Hz, −6dB, delayed +120ms) + Common Loon wail (trimmed 3.0s @8.5s, highpass 300Hz, −9dB, delayed +350ms, ghosting in late); amix weights 1/0.6/0.45, gentle fade-in, loudnorm, mono opus 64k/aac 96k |
| families/phoenix/call2.webm, .m4a | https://commons.wikimedia.org/wiki/File:Grus_canadensis_Denali_National_Park.ogg (crane) + https://pixabay.com/sound-effects/nature-mourning-dove-coo-335480/ (mourning dove) | Innotata (crane, Denali NP); DRAGON-STUDIO (Pixabay, mourning dove) | Public domain (crane); Pixabay Content License (mourning dove) | Designed phoenix idle/contentment voice: Mourning Dove purr bed (trimmed 3.0s @1.8s, highpass 150Hz, −3dB) under a short Sandhill Crane bugle fragment (trimmed 0.9s @0.15s, highpass 250Hz, −4dB, delayed +300ms); amix weights 1/0.7, fade-in + fade-out, loudnorm, mono opus 64k/aac 96k |
| ambience/ember-glow.webm, .m4a | https://pixabay.com/sound-effects/film-special-effects-crackling-campfire-68477/ | CaganCelik (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Crackling Campfire"; trimmed 45.0s @2.0s for a seamless loop, lowpass 2000Hz, −12dB, 0.4s in/out fade, loudnorm I=-24 (sits quietly under everything near the phoenix grove), mono opus 56k/aac 96k |

## Skipped items (not shipped — see Task 2 report for detail)

- `families/robin/baby1` (chick begging): no CC0/CC-BY/PD/Pixabay American Robin chick-begging
  recording found in a diligent search; graceful silence used instead of a substitute.
- `families/duck/baby1` (duckling peeps): no allowed-license mallard duckling peep recording
  found; skipped per brief's explicit example.
- `families/rabbit/sniff` (optional stretch item): not sourced; skipped, optional per brief.

## Task 3 raw ingredients (unprocessed, staged in `assets_raw/`, gitignored — not shipped by this task)

These were sourced during this task's pass per the brief but are left as raw audio for Task 3
(dodo + phoenix voice design) to cut and process.

| Raw file (assets_raw/) | Source URL | Author | License | Notes |
|---|---|---|---|---|
| pigeon_dove_cooing_pd.ogg | https://commons.wikimedia.org/wiki/File:Dove_cooing.ogg | Fæ (Wikimedia username) | Public domain | Generic dove cooing, 7.9s. Pigeon coo ingredient #1 (species unspecified). |
| pigeon_cape_turtle_dove.ogg | https://commons.wikimedia.org/wiki/File:CapeTurtleDove.ogg | MilesWelsh (Wikimedia username) | CC BY-SA 3.0 | Cape Turtle Dove (Streptopelia capicola) call, 2.9s. Pigeon coo ingredient #2. |
| crane_sandhill_denali.ogg | https://commons.wikimedia.org/wiki/File:Grus_canadensis_Denali_National_Park.ogg | Innotata (Wikimedia username); recorded in Denali National Park | Public domain | Sandhill Crane (Grus canadensis) call/bugle, 6.2s. Substitute for common crane (Grus grus) — no allowed-license common crane recording found. |
| swan_whooper.ogg | https://commons.wikimedia.org/wiki/File:Whooper_Swan_(Cygnus_cygnus)_(W_CYGNUS_CYGNUS_R1_C6).ogg | Beeld en Geluid Collecties (Wikimedia username) | CC BY 4.0 | Whooper Swan (Cygnus cygnus) call, 26.8s. |
| loon_common_yellowstone.mp3 | https://commons.wikimedia.org/wiki/File:Yellowstone_sound_library_-_Common_Loon_-_001.mp3 | Thesupermat (Wikimedia username); source: Yellowstone National Park sound library | Public domain | Common Loon (Gavia immer) wail, 130.4s. |
| mourning_dove_pixabay.mp3 | https://pixabay.com/sound-effects/nature-mourning-dove-coo-335480/ | DRAGON-STUDIO (Pixabay) | Pixabay Content License | "Mourning Dove Coo", 8.1s. Contributor note confirms free commercial/personal use, credit optional. |
| campfire_crackle_pixabay.mp3 | https://pixabay.com/sound-effects/film-special-effects-crackling-campfire-68477/ | CaganCelik (Freesound) / freesound_community (Pixabay) | Pixabay Content License | "Crackling Campfire", 51.2s. |

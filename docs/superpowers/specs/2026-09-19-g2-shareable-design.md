# G2 "Shareable" — Design

**Date:** 2026-09-19 · **Status:** design approved by the user (brainstorm 2026-09-19); implementation
gated on the user's live review of M13/G1/P1 · **Track:** growth & distribution, milestone 2 of 4
(see `2026-08-22-growth-distribution-design.md` for the binding track decisions).

## Goal

Make a valley something a child can show to a friend and something that feels like *theirs*:
a share link (plus a postcard image) that lets a friend open the same valley, and the ability to
name creatures and families. Zero cost, no server, nothing collected, nothing user-typed ever
leaves the device.

## Binding decisions (user, 2026-09-19)

1. **A shared link delivers the same valley from day 0**: the link carries the world seed only.
   The recipient gets the identical valley layout and the same families-to-be, starting at day 0.
   Exact-moment replay is explicitly out of scope (fragile across sim versions, replay cost grows
   with valley age). A **postcard** image of the sharer's moment travels with the share.
2. **Children can name creatures AND families.** Names live only in the local save; they are never
   sent anywhere and never placed in a link (free text in a URL is a child-safety and abuse
   surface).
3. **Opening a friend's link never overwrites the child's own valley.** With no save present, the
   visitor adopts the shared valley as their own. With a save present, the shared valley opens in
   **visit mode** — live, in memory, never saved — with a banner and a way back. No destructive
   path exists. Multi-valley slots are a possible later milestone; visit mode can grow into them.

## Facts that shape the design

- Today `main.ts` calls `createWorld(1234)`: **every player has the identical valley**, and the seed
  is not stored in the save (only the RNG's running state is). Sharing therefore requires
  per-player seeds and a stored seed.
- The sim is pure and deterministic from `createWorld(seed)`; `Math.random` is lint-banned only
  inside `src/sim/`, so the app layer may draw a random seed.
- `SaveFile = { version, savedAtEpochMs, sim: WorldState }`, `SAVE_VERSION = 1`, with a migration
  chain in `src/persist/migrations.ts`. `store.ts` already exposes `suppressSaves()` (used by the
  dev "reset valley").
- Generated names today: creatures via `creatureName()` (hash → `CREATURE_NAMES`), families via
  `familyName(id)` (`FAMILY_NAMES` plant surnames) in `src/render/Renderer.ts` / `src/ui/InspectCard.ts`.
- The game page's `<link rel="canonical">` already points at the bare site URL, so `?valley=`
  variants will not be indexed as duplicate pages.

## Design

### 1. Per-player seeds (persist + app)

- New worlds: `seed = (Math.random() * 2 ** 32) >>> 0` in `main.ts`, passed to `createWorld(seed)`.
- `SaveFile` gains `seed: number`; `SAVE_VERSION` → 2. Migration v1→v2 stamps `seed: 1234` on every
  legacy save (those players keep their exact valley and can share it). Saves written from now on
  carry the real seed.
- `WorldState` is untouched (the seed is a persist/app concern, not sim state).

### 2. Share link + postcard (UI)

- URL format: `<SITE.baseUrl>?valley=<seed in base36>`. Parsing accepts base36 digits only; anything
  else is ignored (normal boot). A `share` module owns `formatValleyUrl(seed)` / `parseValleyParam(search)`.
- A 🔗 **share** HUD pill (below the 🐾 creatures pill) opens a small card, "Share your valley":
  the link (copy button), and a **postcard** — the current frame captured via Pixi's extract API,
  composited on a canvas with a cream border, the caption "Beastoria · Day N", and the link text
  (so the image carries the link even where links don't travel).
- Delivery: if `navigator.canShare({ files })` → native share sheet with the PNG + URL (phones);
  otherwise copy the link to the clipboard (with a "copied!" confirmation) and offer "Save postcard"
  (download). In visit mode the share button shares the *visited* valley's seed (sharing onward is
  fine — it's just a seed).
- Nothing user-typed is in the link or on the postcard except the fixed caption; custom names are
  not rendered into the postcard text (the screenshot itself may show a renamed home label — that
  is the child's own device image, shared by their own action, and acceptable).

### 3. Opening a link (app)

- `?valley=` is read in `main.ts` before `loadSave()` (after the existing `?portrait=` dispatch).
- **No save exists** → adopt: `createWorld(seed)`, morning start, normal boot, saved normally with
  that seed. The first-run hint shows; a small line notes "This valley came from a friend's link."
- **Save exists** → **visit mode**: `createWorld(seed)` in memory, morning start, `suppressSaves()`
  for the whole session, no catch-up, no welcome/hint cards, autosave/visibility/pagehide saves all
  suppressed. A persistent top banner: "Visiting a friend's valley · ⟵ back to mine" where the
  link is the bare site URL (reloads without the param). Renaming is disabled in visit mode (there
  is no save to hold names). Reloading the link re-enters visit mode; the child's own valley is
  never touched.

### 4. Naming (persist + UI)

- `SaveFile.names = { creatures: Record<number, string>, families: Record<number, string> }`
  (also added in the v2 migration as empty maps). Limits: trimmed, 1–20 characters, any printable
  text; blank/whitespace clears the custom name (falls back to the generated one).
- A `names` module (`src/ui/names.ts`) resolves display names — `creatureDisplayName(state, c,
  names)` and `familyDisplayName(id, names)` — wrapping the existing generators; all display sites
  use it: inspect card, home labels, welcome-back card, share card caption is unaffected.
- Inspect card: a small ✎ next to the name opens an inline text field (Enter/✓ saves, Esc/✕
  cancels). Tapping the family line in the inspect card ('mother of the Rowan family') opens the same
  field for the family surname.
- Welcome-back card: phrases use display names when a group involves a single named creature or
  family ("Biscuit had 3 babies", "the Sunny family settled into a new home"); otherwise unchanged.
- Housekeeping: when a creature or family no longer exists in the save (memorial pruned, family
  dissolved), its name entry is dropped on save. Names are saved with the regular autosave.
- Kid-safety posture (child-directed): names are local-only, never transmitted, never in links,
  never rendered into share images as text. No moderation needed because no one else ever sees
  them except via the child's own screenshot.

### 5. Testing

- Vitest (pure logic): v1→v2 migration stamps seed 1234 + empty names; `formatValleyUrl` /
  `parseValleyParam` round-trip and reject junk; name resolution (custom → generated fallback,
  trim/limit/blank-clears); orphan-name pruning; welcome-card naming phrases.
- Browser pass (Playwright, controller): share on desktop → link copied + postcard PNG downloadable
  and visually right; `?valley=` on a fresh profile adopts (seed stored in the save); `?valley=` on
  a profile with a save enters visit mode with the banner and **no IndexedDB write** for the whole
  visit (verify the stored save's `savedAtEpochMs` is unchanged); rename a creature and a family,
  reload, names persist; blank rename restores the generated name.

## Constraints

Zero cost, no server, no new runtime dependencies. Nothing under `src/sim/` changes. Existing
saves migrate losslessly. Child-directed posture unchanged: no data leaves the device.

## Out of scope (explicit)

Exact-moment replay links; owner or valley names in links; multi-valley slots; per-valley OG
previews (needs a server); sharing names.

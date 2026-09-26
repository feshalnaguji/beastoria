/**
 * NameBook: the single resolver for creature/family display names — custom
 * name (player-given, local-only, spec §4) or generated fallback. Wired into
 * the inspect card, home labels, and the welcome-back card (G2 task 3).
 */
import { familyName } from '../render/Renderer';
import { idHash } from '../sim/behaviors';
import type { SaveNames } from '../persist/schema';
import type { Creature, WorldState } from '../sim/state';

/** 24 gentle, nature-flavored given names — deliberately distinct from
 * Renderer's FAMILY_NAMES (plant names for the family surname) so a card
 * never reads like "Willow of the Willow family". */
const CREATURE_NAMES = [
  'Pip', 'Wren', 'Moss', 'Dew', 'Sage', 'Briar', 'Juniper', 'Fennel',
  'Thistle', 'Meadow', 'Marigold', 'Olive', 'Plum', 'Cricket', 'Sprig',
  'Acorn', 'Pebble', 'Breeze', 'Feather', 'Petal', 'Clay', 'Ember',
  'Frost', 'Lark',
];

/** This creature's index within its family's parents+children (0 for a
 * family-less wanderer) — added into the name hash so siblings in the same
 * family never land on the same list index, even though two creatures
 * elsewhere in the valley may still share a name. */
function familyPosition(state: WorldState, c: Creature): number {
  if (c.familyId === null) return 0;
  const fam = state.families.find((f) => f.id === c.familyId);
  if (!fam) return 0;
  const idx = [...fam.parentIds, ...fam.childIds].indexOf(c.id);
  return idx === -1 ? 0 : idx;
}

export function creatureName(state: WorldState, c: Creature): string {
  const idx = (idHash(c.id) + familyPosition(state, c)) % CREATURE_NAMES.length;
  return CREATURE_NAMES[idx] ?? 'Meadow';
}

export const NAME_MAX = 20;

/** Trim, collapse inner whitespace, cap at NAME_MAX; null means "no custom name". */
export function normalizeName(raw: string): string | null {
  const t = raw.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim();
  return t.length > 0 ? t : null;
}

/** The single resolver for display names. `data` is the live save-side object (see setSaveMeta). */
export class NameBook {
  constructor(readonly data: SaveNames) {}
  creature(state: WorldState, c: Creature): string { return this.data.creatures[c.id] ?? creatureName(state, c); }
  family(id: number): string { return this.data.families[id] ?? familyName(id); }
  customFamily(id: number): string | undefined { return this.data.families[id]; }
  setCreature(id: number, raw: string): void { this.assign(this.data.creatures, id, raw); }
  setFamily(id: number, raw: string): void { this.assign(this.data.families, id, raw); }
  private assign(bucket: Record<number, string>, id: number, raw: string): void {
    const n = normalizeName(raw);
    if (n === null) delete bucket[id]; else bucket[id] = n;
  }
  /** Drop names for creatures/families that no longer exist. Called before each save.
   * `keep` lists ids still remembered elsewhere (the journal), whose names must survive them. */
  prune(state: WorldState, keep?: { creatures: Set<number>; families: Set<number> }): void {
    const cs = new Set([...state.creatures.map((c) => c.id), ...(keep?.creatures ?? [])]);
    const fs = new Set([...state.families.map((f) => f.id), ...(keep?.families ?? [])]);
    for (const id of Object.keys(this.data.creatures)) if (!cs.has(Number(id))) delete this.data.creatures[Number(id)];
    for (const id of Object.keys(this.data.families)) if (!fs.has(Number(id))) delete this.data.families[Number(id)];
  }
}

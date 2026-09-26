/**
 * The valley journal (G4): a family storybook that fills itself. An observer
 * outside the sim turns sim events and creature changes into short entries on
 * each family's page. Entries are structured; their words are built when the
 * page is shown, so a renamed creature reads by its current name.
 */
import { SPECIES } from '../sim/species';
import type { Creature, LifeStage, SpeciesId, WorldState } from '../sim/state';
import type { SimEvent } from '../sim/events';

export type JournalKind =
  | 'paired'
  | 'nested'
  | 'eggs'
  | 'hatched'
  | 'born'
  | 'growing'
  | 'grown'
  | 'elder'
  | 'setOff'
  | 'passed'
  | 'reborn';

export interface JournalEntry {
  tick: number;
  kind: JournalKind;
  count?: number;
  /** The creature the entry is about, for current-name lookup. */
  creatureId?: number;
  /** Its display name when recorded — the fallback once it's gone. */
  name?: string;
  /** For 'paired': both parents (ids + names when recorded). */
  pairIds?: [number, number];
  pairNames?: [string, string];
}

export interface FamilyPage {
  familyId: number;
  species: SpeciesId;
  firstTick: number;
  lastTick: number;
  entries: JournalEntry[];
}

export interface Journal {
  pages: FamilyPage[];
}

export const MAX_PAGES = 60;
export const MAX_ENTRIES = 40;
const KINDS: ReadonlySet<string> = new Set<JournalKind>([
  'paired', 'nested', 'eggs', 'hatched', 'born', 'growing', 'grown', 'elder', 'setOff', 'passed', 'reborn',
]);

export const emptyJournal = (): Journal => ({ pages: [] });

/** Append to a family's page (creating it), keeping both caps. The page just written is never evicted. */
export function addEntry(journal: Journal, familyId: number, species: SpeciesId, entry: JournalEntry): void {
  let page = journal.pages.find((p) => p.familyId === familyId);
  if (!page) {
    page = { familyId, species, firstTick: entry.tick, lastTick: entry.tick, entries: [] };
    journal.pages.push(page);
  }
  // Generated names follow family position, so a little one can be renamed when a
  // sibling leaves — keep the name this page first used for them, so it reads as one story.
  if (entry.creatureId !== undefined) {
    const known = pageNameFor(page, entry.creatureId);
    if (known !== undefined) entry.name = known;
  }
  page.entries.push(entry);
  if (page.entries.length > MAX_ENTRIES) page.entries.splice(0, page.entries.length - MAX_ENTRIES);
  page.lastTick = Math.max(page.lastTick, entry.tick);
  while (journal.pages.length > MAX_PAGES) {
    let oldest = -1;
    for (let i = 0; i < journal.pages.length; i++) {
      const p = journal.pages[i]!;
      if (p === page) continue;
      if (oldest === -1 || p.lastTick < journal.pages[oldest]!.lastTick) oldest = i;
    }
    journal.pages.splice(oldest, 1);
  }
}

function pageNameFor(page: FamilyPage, id: number): string | undefined {
  for (const e of page.entries) {
    if (e.creatureId === id && e.name !== undefined) return e.name;
    const i = e.pairIds?.indexOf(id) ?? -1;
    if (i !== -1 && e.pairNames?.[i] !== undefined) return e.pairNames[i];
  }
  return undefined;
}

/** Every creature and family id the journal mentions — their custom names must outlive them. */
export function journalRefs(journal: Journal): { creatures: Set<number>; families: Set<number> } {
  const creatures = new Set<number>();
  const families = new Set<number>();
  for (const p of journal.pages) {
    families.add(p.familyId);
    for (const e of p.entries) {
      if (e.creatureId !== undefined) creatures.add(e.creatureId);
      for (const id of e.pairIds ?? []) creatures.add(id);
    }
  }
  return { creatures, families };
}

/** Whatever a save holds, return a valid journal (bad pages/entries are dropped, caps applied). */
export function sanitizeJournal(raw: unknown): Journal {
  const out = emptyJournal();
  const pages = (raw as { pages?: unknown } | null)?.pages;
  if (!Array.isArray(pages)) return out;
  const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const str = (v: unknown): v is string => typeof v === 'string';
  for (const p of pages as unknown[]) {
    const q = p as Partial<FamilyPage> | null;
    if (!q || !num(q.familyId) || !str(q.species) || !Object.hasOwn(SPECIES, q.species) || !Array.isArray(q.entries)) continue;
    const entries: JournalEntry[] = [];
    for (const e of q.entries as unknown[]) {
      const r = e as Partial<JournalEntry> | null;
      if (!r || !num(r.tick) || !str(r.kind) || !KINDS.has(r.kind)) continue;
      const clean: JournalEntry = { tick: r.tick, kind: r.kind };
      if (num(r.count)) clean.count = r.count;
      if (num(r.creatureId)) clean.creatureId = r.creatureId;
      if (str(r.name)) clean.name = r.name;
      if (Array.isArray(r.pairIds) && r.pairIds.length === 2 && r.pairIds.every(num)) clean.pairIds = [r.pairIds[0], r.pairIds[1]];
      if (Array.isArray(r.pairNames) && r.pairNames.length === 2 && r.pairNames.every(str)) {
        clean.pairNames = [r.pairNames[0], r.pairNames[1]];
      }
      entries.push(clean);
    }
    const kept = entries.slice(-MAX_ENTRIES);
    const ticks = kept.map((x) => x.tick);
    out.pages.push({
      familyId: q.familyId,
      species: q.species as SpeciesId,
      firstTick: num(q.firstTick) ? q.firstTick : ticks.length > 0 ? Math.min(...ticks) : 0,
      lastTick: num(q.lastTick) ? q.lastTick : ticks.length > 0 ? Math.max(...ticks) : 0,
      entries: kept,
    });
  }
  out.pages = out.pages.slice(-MAX_PAGES);
  return out;
}

const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** One entry's words. `nameFor(id, fallback)` returns the creature's current name (custom if set). */
export function entryText(e: JournalEntry, nameFor: (id: number, fallback: string) => string): string {
  const who = e.creatureId !== undefined ? nameFor(e.creatureId, e.name ?? 'A little one') : (e.name ?? 'A little one');
  const n = e.count ?? 1;
  switch (e.kind) {
    case 'paired': {
      if (!e.pairIds || !e.pairNames) return 'Two of them became a pair';
      return `${nameFor(e.pairIds[0], e.pairNames[0])} and ${nameFor(e.pairIds[1], e.pairNames[1])} became a pair`;
    }
    case 'nested':
      return 'Found a home';
    case 'eggs':
      return `Laid ${n} ${plural(n, 'egg', 'eggs')}`;
    case 'hatched':
      return `${n} little ${plural(n, 'one', 'ones')} hatched`;
    case 'born':
      return `${n} little ${plural(n, 'one was', 'ones were')} born`;
    case 'growing':
      return `${who} is growing up`;
    case 'grown':
      return `${who} is all grown up`;
    case 'elder':
      return `${who} is an elder now`;
    case 'setOff':
      return `${who} set off to start a family of their own`;
    case 'passed':
      return `${who} passed peacefully`;
    case 'reborn':
      return 'The phoenix rose again from soft embers';
  }
}

export function pageSummary(page: FamilyPage): { little: number; grown: number } {
  let little = 0;
  let grown = 0;
  for (const e of page.entries) {
    if (e.kind === 'hatched' || e.kind === 'born') little += e.count ?? 1;
    if (e.kind === 'grown') grown++;
  }
  return { little, grown };
}

const STAGE_KIND: Partial<Record<LifeStage, JournalKind>> = { juvenile: 'growing', adult: 'grown', elder: 'elder' };

interface Seen {
  familyId: number | null;
  stage: LifeStage;
  species: SpeciesId;
  name: string;
  isChild: boolean;
}

/**
 * Watches the valley between observations. Sim events that carry a family
 * become entries directly; growing up, setting off, and passing are found by
 * diffing creatures (the sim removes a creature only when it passes).
 */
export class JournalRecorder {
  private seen = new Map<number, Seen>();
  private lastTick = 0;

  constructor(
    private readonly journal: Journal,
    private readonly nameOf: (state: WorldState, c: Creature) => string,
  ) {}

  /** Baseline without recording anything (boot, or before a catch-up drain). */
  prime(state: WorldState): void {
    this.snapshot(state);
    this.lastTick = state.tick;
  }

  observe(state: WorldState): void {
    for (const e of state.eventLog) if (e.tick > this.lastTick) this.fromEvent(state, e);
    const byId = new Map(state.creatures.map((c) => [c.id, c]));
    for (const [id, prev] of this.seen) {
      const c = byId.get(id);
      if (!c) {
        if (prev.familyId !== null) {
          addEntry(this.journal, prev.familyId, prev.species, { tick: state.tick, kind: 'passed', creatureId: id, name: prev.name });
        }
        continue;
      }
      const kind = c.stage !== prev.stage ? STAGE_KIND[c.stage] : undefined;
      const familyId = c.familyId ?? prev.familyId;
      if (kind && familyId !== null) {
        addEntry(this.journal, familyId, c.species, { tick: state.tick, kind, creatureId: id, name: this.nameOf(state, c) });
      }
      // Only a grown child sets off; a little one released because its last parent passed is
      // not a departure (the passing is already on the page).
      const grown = c.stage === 'adult' || c.stage === 'elder';
      if (grown && prev.isChild && prev.familyId !== null && c.familyId !== prev.familyId) {
        addEntry(this.journal, prev.familyId, prev.species, { tick: state.tick, kind: 'setOff', creatureId: id, name: prev.name });
      }
    }
    this.snapshot(state);
    this.lastTick = state.tick;
  }

  private fromEvent(state: WorldState, e: SimEvent): void {
    if (e.familyId === undefined) return; // wanderers; 'passed' is found by the creature diff instead
    const base = { tick: e.tick };
    switch (e.kind) {
      case 'paired': {
        const fam = state.families.find((f) => f.id === e.familyId);
        const parents = (fam?.parentIds ?? [])
          .map((id) => state.creatures.find((c) => c.id === id))
          .filter((c): c is Creature => c !== undefined);
        const entry: JournalEntry = { ...base, kind: 'paired' };
        if (parents.length === 2) {
          entry.pairIds = [parents[0]!.id, parents[1]!.id];
          entry.pairNames = [this.nameOf(state, parents[0]!), this.nameOf(state, parents[1]!)];
        }
        addEntry(this.journal, e.familyId, e.species, entry);
        return;
      }
      case 'nested':
        addEntry(this.journal, e.familyId, e.species, { ...base, kind: 'nested' });
        return;
      case 'eggLaid':
        addEntry(this.journal, e.familyId, e.species, { ...base, kind: 'eggs', count: e.count ?? 1 });
        return;
      case 'hatched':
      case 'born':
        addEntry(this.journal, e.familyId, e.species, { ...base, kind: e.kind, count: e.count ?? 1 });
        return;
      case 'reborn':
        addEntry(this.journal, e.familyId, e.species, { ...base, kind: 'reborn' });
        return;
      default:
        return;
    }
  }

  private snapshot(state: WorldState): void {
    const children = new Set<number>();
    for (const f of state.families) for (const id of f.childIds) children.add(id);
    this.seen.clear();
    for (const c of state.creatures) {
      this.seen.set(c.id, {
        familyId: c.familyId,
        stage: c.stage,
        species: c.species,
        name: this.nameOf(state, c),
        isChild: children.has(c.id),
      });
    }
  }
}

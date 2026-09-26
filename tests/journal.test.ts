import { describe, expect, it } from 'vitest';
import {
  addEntry, emptyJournal, entryText, JournalRecorder, journalRefs, MAX_ENTRIES, MAX_PAGES, pageSummary, sanitizeJournal,
  type Journal,
} from '../src/app/journal';
import { createWorld, spawnCreature, type Family, type WorldState } from '../src/sim/state';
import { runCatchUp } from '../src/app/CatchUp';
import { NameBook } from '../src/ui/names';

const nameOf = (_s: WorldState, c: { id: number }) => `C${c.id}`;
const keep = (_id: number, fallback: string) => fallback;

/** A rabbit family: two adult parents and two babies, at the world's first burrow. */
function familyWorld(): { state: WorldState; fam: Family; mom: number; dad: number; kids: number[] } {
  const state = createWorld(3);
  state.creatures = [];
  state.families = [];
  state.eventLog = [];
  for (const h of state.homes) h.familyId = null;
  const home = state.homes.find((h) => h.kind === 'burrow');
  if (!home) throw new Error('no burrow');
  const mom = spawnCreature(state, 'rabbit', { ...home.pos }, 0.5);
  const dad = spawnCreature(state, 'rabbit', { x: home.pos.x + 20, y: home.pos.y }, 0.5);
  const k1 = spawnCreature(state, 'rabbit', { x: home.pos.x + 5, y: home.pos.y }, 0.01);
  const k2 = spawnCreature(state, 'rabbit', { x: home.pos.x - 5, y: home.pos.y }, 0.01);
  const fam: Family = {
    id: state.nextId++,
    species: 'rabbit',
    parentIds: [mom.id, dad.id],
    childIds: [k1.id, k2.id],
    homeId: home.id,
    phase: 'rearing',
    phaseTicks: 0,
    dutyParent: 0,
  };
  state.families.push(fam);
  for (const c of [mom, dad, k1, k2]) c.familyId = fam.id;
  home.familyId = fam.id;
  return { state, fam, mom: mom.id, dad: dad.id, kids: [k1.id, k2.id] };
}

const texts = (j: Journal) => (j.pages[0]?.entries ?? []).map((e) => entryText(e, keep));

describe('journal recorder', () => {
  it('turns family events into entries on the family page', () => {
    const { state, fam, mom, dad } = familyWorld();
    const j = emptyJournal();
    const rec = new JournalRecorder(j, nameOf);
    rec.prime(state);
    state.tick += 1;
    state.eventLog.push({ kind: 'paired', tick: state.tick, species: 'rabbit', familyId: fam.id });
    state.eventLog.push({ kind: 'nested', tick: state.tick, species: 'rabbit', familyId: fam.id });
    state.eventLog.push({ kind: 'born', tick: state.tick, species: 'rabbit', familyId: fam.id, count: 3 });
    state.eventLog.push({ kind: 'wandererArrived', tick: state.tick, species: 'deer' });
    rec.observe(state);
    expect(j.pages).toHaveLength(1);
    expect(j.pages[0]!.familyId).toBe(fam.id);
    expect(texts(j)).toEqual([`C${mom} and C${dad} became a pair`, 'Found a home', '3 little ones were born']);
    rec.observe(state); // same tick again: events are not re-recorded
    expect(j.pages[0]!.entries).toHaveLength(3);
  });

  it('records growing up, setting off (grown children only), and passing', () => {
    const { state, fam, mom, dad, kids } = familyWorld();
    const j = emptyJournal();
    const rec = new JournalRecorder(j, nameOf);
    rec.prime(state);
    const kid = state.creatures.find((c) => c.id === kids[0])!;
    kid.stage = 'juvenile';
    state.tick += 1;
    rec.observe(state);
    kid.stage = 'adult';
    kid.familyId = null;
    // An orphaned little one released by the sim is not "setting off".
    state.creatures.find((c) => c.id === kids[1])!.familyId = null;
    fam.childIds = [];
    state.creatures.find((c) => c.id === dad)!.familyId = null; // a parent leaving is NOT "setting off"
    state.tick += 1;
    rec.observe(state);
    state.creatures = state.creatures.filter((c) => c.id !== mom); // the sim only removes a creature when it passes
    state.tick += 1;
    rec.observe(state);
    expect(texts(j)).toEqual([
      `C${kid.id} is growing up`,
      `C${kid.id} is all grown up`,
      `C${kid.id} set off to start a family of their own`,
      `C${mom} passed peacefully`,
    ]);
  });

  it('shows a renamed creature by its current name', () => {
    const { state, fam, kids } = familyWorld();
    const j = emptyJournal();
    const rec = new JournalRecorder(j, nameOf);
    rec.prime(state);
    state.creatures.find((c) => c.id === kids[0])!.stage = 'juvenile';
    state.tick += 1;
    rec.observe(state);
    const entry = j.pages[0]!.entries[0]!;
    expect(entryText(entry, (id, fb) => (id === kids[0] ? 'Biscuit' : fb))).toBe('Biscuit is growing up');
    expect(pageSummary({ ...j.pages[0]!, entries: [{ tick: 1, kind: 'born', count: 3 }, { tick: 2, kind: 'grown' }] })).toEqual({
      little: 3,
      grown: 1,
    });
    void fam;
  });
});

describe('journal storage', () => {
  it('caps entries per page and pages overall, never evicting the page just written', () => {
    const j = emptyJournal();
    for (let i = 0; i < MAX_ENTRIES + 10; i++) addEntry(j, 1, 'rabbit', { tick: i, kind: 'nested' });
    expect(j.pages[0]!.entries).toHaveLength(MAX_ENTRIES);
    expect(j.pages[0]!.entries[0]!.tick).toBe(10);
    for (let f = 2; f <= MAX_PAGES + 5; f++) addEntry(j, f, 'robin', { tick: 1000 + f, kind: 'nested' });
    expect(j.pages).toHaveLength(MAX_PAGES);
    expect(j.pages.some((p) => p.familyId === 1)).toBe(false); // family 1 was least recently updated
    addEntry(j, 999, 'deer', { tick: 0, kind: 'nested' }); // a brand-new page with an old tick survives
    expect(j.pages.some((p) => p.familyId === 999)).toBe(true);
  });

  it('sanitizes junk into a valid journal', () => {
    expect(sanitizeJournal(null)).toEqual(emptyJournal());
    expect(sanitizeJournal({ pages: 'x' })).toEqual(emptyJournal());
    const out = sanitizeJournal({
      pages: [
        { familyId: 7, species: 'rabbit', firstTick: 1, lastTick: 5, entries: [{ tick: 2, kind: 'born', count: 2 }, { tick: 3, kind: 'explode' }, 'x'] },
        { familyId: 'no', species: 'rabbit', entries: [] },
        { familyId: 8, species: 'dragon', entries: [] },
        { familyId: 9, species: 'owl', entries: [{ tick: 4, kind: 'paired', pairIds: [1, 2], pairNames: ['A', 'B'] }] },
      ],
    });
    expect(out.pages.map((p) => p.familyId)).toEqual([7, 9]);
    expect(out.pages[0]!.entries).toEqual([{ tick: 2, kind: 'born', count: 2 }]);
    expect(out.pages[1]!.firstTick).toBe(4);
    expect(entryText(out.pages[1]!.entries[0]!, keep)).toBe('A and B became a pair');
  });
});

describe('journal names', () => {
  it('keeps the name a page first used for a creature, even if its generated name shifts', () => {
    const j = emptyJournal();
    addEntry(j, 1, 'rabbit', { tick: 1, kind: 'paired', pairIds: [10, 11], pairNames: ['Meadow', 'Wren'] });
    addEntry(j, 1, 'rabbit', { tick: 2, kind: 'growing', creatureId: 12, name: 'Feather' });
    addEntry(j, 1, 'rabbit', { tick: 3, kind: 'grown', creatureId: 12, name: 'Acorn' });
    addEntry(j, 1, 'rabbit', { tick: 4, kind: 'elder', creatureId: 11, name: 'Briar' });
    expect(texts(j)).toEqual([
      'Meadow and Wren became a pair', 'Feather is growing up', 'Feather is all grown up', 'Wren is an elder now',
    ]);
  });
});

describe('journal review fixes', () => {
  it('keeps custom names for creatures and families the journal still mentions', () => {
    const { state, fam, mom } = familyWorld();
    const book = new NameBook({ creatures: { [mom]: 'Biscuit', 99999: 'Gone' }, families: { [fam.id]: 'Clover', 88888: 'Old' } });
    const j = emptyJournal();
    addEntry(j, fam.id, 'rabbit', { tick: 1, kind: 'passed', creatureId: mom, name: 'Wren' });
    state.creatures = state.creatures.filter((c) => c.id !== mom);
    state.families = [];
    book.prune(state, journalRefs(j));
    expect(book.data.creatures).toEqual({ [mom]: 'Biscuit' });
    expect(book.data.families).toEqual({ [fam.id]: 'Clover' });
  });

  it('observes every drained catch-up tick', () => {
    const state = createWorld(5);
    let seen = 0;
    const res = runCatchUp(state, 25, 1e9, () => 0, () => seen++);
    expect(res.ticksRun).toBe(25);
    expect(seen).toBe(25);
  });

  it('rejects prototype keys as species in a tampered save', () => {
    const j = sanitizeJournal({ pages: [{ familyId: 1, species: 'constructor', entries: [] }, { familyId: 2, species: 'toString', entries: [] }] });
    expect(j.pages).toHaveLength(0);
  });
});

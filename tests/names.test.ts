import { describe, expect, it } from 'vitest';
import { createWorld } from '../src/sim/state';
import { NameBook, NAME_MAX, normalizeName, creatureName } from '../src/ui/names';
import { familyName } from '../src/render/Renderer';

describe('normalizeName', () => {
  it('trims, collapses whitespace, caps length, and clears blanks', () => {
    expect(normalizeName('  Biscuit  ')).toBe('Biscuit');
    expect(normalizeName('Big   Ears')).toBe('Big Ears');
    expect(normalizeName('x'.repeat(40))).toHaveLength(NAME_MAX);
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('')).toBeNull();
  });
});

describe('NameBook', () => {
  it('falls back to generated names and honours custom ones', () => {
    const state = createWorld(3);
    const c = state.creatures[0]!;
    const book = new NameBook({ creatures: {}, families: {} });
    expect(book.creature(state, c)).toBe(creatureName(state, c));
    expect(book.family(7)).toBe(familyName(7));
    book.setCreature(c.id, ' Biscuit ');
    book.setFamily(7, 'Sunny');
    expect(book.creature(state, c)).toBe('Biscuit');
    expect(book.family(7)).toBe('Sunny');
    expect(book.customFamily(7)).toBe('Sunny');
    expect(book.customFamily(8)).toBeUndefined();
    book.setCreature(c.id, '   '); // blank clears
    expect(book.creature(state, c)).toBe(creatureName(state, c));
    expect(book.data.creatures[c.id]).toBeUndefined();
  });

  it('prunes names whose creature or family is gone', () => {
    const state = createWorld(3);
    const alive = state.creatures[0]!;
    const book = new NameBook({ creatures: { [alive.id]: 'Keep', 99999: 'Gone' }, families: { 424242: 'Gone' } });
    book.prune(state);
    expect(book.data.creatures).toEqual({ [alive.id]: 'Keep' });
    expect(book.data.families).toEqual({});
  });
});

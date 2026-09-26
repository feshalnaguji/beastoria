import { describe, expect, it } from 'vitest';
import {
  addPlayTime, CHILD_KEY, DEFAULT_TIMER_MIN, extendTimer, loadChildSettings, offSettings,
  saveChildSettings, setTimer, type ChildSettings, type KeyValueStore,
} from '../src/app/childSettings';
import { answerGate, COOLDOWN_MS, gateLocked, makeQuestion, newGateState } from '../src/app/parentGate';
import { shouldShowTapCard, shouldSwallowKey } from '../src/app/childKeys';

const memStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
const seq = (xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length]!;
};
const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe('child settings', () => {
  it('defaults to off, round-trips, and survives junk or a throwing store', () => {
    expect(loadChildSettings(null)).toEqual(offSettings());
    const store = memStore();
    expect(loadChildSettings(store)).toEqual(offSettings());
    const s: ChildSettings = { on: true, timerMin: 45, playedMs: 1234, expired: false };
    saveChildSettings(s, store);
    expect(loadChildSettings(store)).toEqual(s);
    store.data.set(CHILD_KEY, '{not json');
    expect(loadChildSettings(store)).toEqual(offSettings());
    store.data.set(CHILD_KEY, JSON.stringify({ on: 'yes', timerMin: -3, playedMs: 'x' }));
    expect(loadChildSettings(store)).toEqual(offSettings());
    const throwing: KeyValueStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    expect(loadChildSettings(throwing)).toEqual(offSettings());
    expect(() => saveChildSettings(s, throwing)).not.toThrow();
  });

  it('accumulates play time, expires once, and handles no-limit / bad slices', () => {
    const s: ChildSettings = { on: true, timerMin: 1, playedMs: 0, expired: false };
    expect(addPlayTime(s, 0)).toBe(false);
    expect(addPlayTime(s, -500)).toBe(false);
    expect(s.playedMs).toBe(0);
    expect(addPlayTime(s, 59_000)).toBe(false);
    expect(addPlayTime(s, 1_000)).toBe(true);
    expect(s.expired).toBe(true);
    expect(addPlayTime(s, 5_000)).toBe(false); // already expired: no second crossing, no growth
    expect(s.playedMs).toBe(60_000);
    const free: ChildSettings = { on: true, timerMin: null, playedMs: 0, expired: false };
    expect(addPlayTime(free, 10 * 3_600_000)).toBe(false);
    expect(free.expired).toBe(false);
    const off = offSettings();
    expect(addPlayTime(off, 5_000)).toBe(false);
    expect(off.playedMs).toBe(0);
  });

  it('extendTimer adds minutes and un-expires; setTimer restarts the count', () => {
    const s: ChildSettings = { on: true, timerMin: 30, playedMs: 30 * 60_000, expired: true };
    extendTimer(s, 15);
    expect(s).toEqual({ on: true, timerMin: 45, playedMs: 30 * 60_000, expired: false });
    setTimer(s, 15);
    expect(s).toEqual({ on: true, timerMin: 15, playedMs: 0, expired: false });
    setTimer(s, null);
    expect(s.timerMin).toBeNull();
    extendTimer(s, 15); // no-op without a limit
    expect(s.timerMin).toBeNull();
    expect(offSettings().timerMin).toBe(DEFAULT_TIMER_MIN);
  });
});

describe('parent gate', () => {
  it('always offers four distinct options including the answer, factors 3..9', () => {
    const rand = mulberry(7);
    for (let i = 0; i < 500; i++) {
      const q = makeQuestion(rand);
      expect(q.a).toBeGreaterThanOrEqual(3);
      expect(q.a).toBeLessThanOrEqual(9);
      expect(q.b).toBeGreaterThanOrEqual(3);
      expect(q.b).toBeLessThanOrEqual(9);
      expect(q.answer).toBe(q.a * q.b);
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) expect(o).toBeGreaterThan(0);
    }
  });

  it('three wrong answers in a row lock the gate for the cooldown; a right one resets strikes', () => {
    const q = makeQuestion(seq([0.5, 0.5, 0.1, 0.9, 0.3, 0.7]));
    const wrong = q.options.find((o) => o !== q.answer)!;
    const s = newGateState();
    expect(answerGate(s, q, wrong, 0)).toBe('wrong');
    expect(answerGate(s, q, q.answer, 0)).toBe('correct');
    expect(s.strikes).toBe(0);
    expect(answerGate(s, q, wrong, 0)).toBe('wrong');
    expect(answerGate(s, q, wrong, 0)).toBe('wrong');
    expect(answerGate(s, q, wrong, 1_000)).toBe('locked');
    expect(gateLocked(s, 1_000 + COOLDOWN_MS - 1)).toBe(true);
    expect(answerGate(s, q, q.answer, 1_000 + COOLDOWN_MS - 1)).toBe('locked');
    expect(gateLocked(s, 1_000 + COOLDOWN_MS)).toBe(false);
    expect(answerGate(s, q, q.answer, 1_000 + COOLDOWN_MS)).toBe('correct');
  });
});

describe('child key and card policy', () => {
  const k = (key: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...mods,
  });

  it('lets camera keys through and swallows everything else on the page', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_']) {
      expect(shouldSwallowKey(k(key), 'CANVAS')).toBe(false);
    }
    for (const key of ['`', 'Escape', 'F5', 'Tab', 'a', ' ', 'Enter']) {
      expect(shouldSwallowKey(k(key), 'BODY')).toBe(true);
    }
    expect(shouldSwallowKey(k('ArrowLeft', { ctrlKey: true }), 'BODY')).toBe(true);
    expect(shouldSwallowKey(k('w', { ctrlKey: true }), 'BODY')).toBe(true);
  });

  it('lets typing reach a text input (rename) but not shortcuts', () => {
    for (const key of ['B', 'i', '7', ' ', 'Backspace', 'Delete', 'Enter', 'Escape', 'ArrowLeft', 'Home', 'End']) {
      expect(shouldSwallowKey(k(key), 'INPUT')).toBe(false);
    }
    expect(shouldSwallowKey(k('w', { ctrlKey: true }), 'INPUT')).toBe(true);
    expect(shouldSwallowKey(k('Tab'), 'INPUT')).toBe(true);
    // accents, IME and AltGr (Windows reports AltGr as Ctrl+Alt) reach the rename field…
    expect(shouldSwallowKey(k('Dead'), 'INPUT')).toBe(false);
    expect(shouldSwallowKey(k('Process'), 'INPUT')).toBe(false);
    expect(shouldSwallowKey(k('@', { ctrlKey: true, altKey: true }), 'INPUT')).toBe(false);
    // …but not outside it
    expect(shouldSwallowKey(k('@', { ctrlKey: true, altKey: true }), 'BODY')).toBe(true);
    expect(shouldSwallowKey(k('Dead'), 'BODY')).toBe(true);
    expect(shouldSwallowKey(k('F5'), 'INPUT')).toBe(true);
  });

  it('shows the tap card only when it can do something and nothing else is up', () => {
    const base = { on: true, expired: false, fullscreenEnabled: true, isFullscreen: false, overlayOpen: false };
    expect(shouldShowTapCard(base)).toBe(true);
    expect(shouldShowTapCard({ ...base, on: false })).toBe(false);
    expect(shouldShowTapCard({ ...base, expired: true })).toBe(false);
    expect(shouldShowTapCard({ ...base, isFullscreen: true })).toBe(false);
    expect(shouldShowTapCard({ ...base, overlayOpen: true })).toBe(false);
    expect(shouldShowTapCard({ ...base, fullscreenEnabled: false })).toBe(false); // no fullscreen API: never loop
  });
});

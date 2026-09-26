/** Child-mode settings: device-local, never in the save file, never sent anywhere. */
export interface ChildSettings {
  on: boolean;
  timerMin: number | null;
  playedMs: number;
  expired: boolean;
}
export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export const CHILD_KEY = 'beastoria.child';
export const TIMER_CHOICES: readonly (number | null)[] = [15, 30, 45, 60, null];
export const DEFAULT_TIMER_MIN = 30;

export const offSettings = (): ChildSettings => ({
  on: false,
  timerMin: DEFAULT_TIMER_MIN,
  playedMs: 0,
  expired: false,
});

/** localStorage, or null where the browser forbids it (privacy modes) or there is no window (tests). */
export function browserStore(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadChildSettings(store: KeyValueStore | null): ChildSettings {
  try {
    const raw = store?.getItem(CHILD_KEY);
    if (!raw) return offSettings();
    const p = JSON.parse(raw) as Partial<Record<keyof ChildSettings, unknown>>;
    const timerOk = p.timerMin === null || (typeof p.timerMin === 'number' && p.timerMin > 0);
    const playedOk = typeof p.playedMs === 'number' && Number.isFinite(p.playedMs) && p.playedMs >= 0;
    if (typeof p.on !== 'boolean' || !timerOk || !playedOk || typeof p.expired !== 'boolean') return offSettings();
    return { on: p.on, timerMin: p.timerMin as number | null, playedMs: p.playedMs as number, expired: p.expired };
  } catch {
    return offSettings();
  }
}

export function saveChildSettings(s: ChildSettings, store: KeyValueStore | null): void {
  try {
    store?.setItem(CHILD_KEY, JSON.stringify(s));
  } catch {
    /* storage blocked: child mode simply won't be sticky this session */
  }
}

/** Adds visible play time. Returns true only on the call that crosses into expiry. */
export function addPlayTime(s: ChildSettings, ms: number): boolean {
  if (!s.on || s.expired || !(ms > 0)) return false;
  s.playedMs += ms;
  if (s.timerMin !== null && s.playedMs >= s.timerMin * 60_000) {
    s.expired = true;
    return true;
  }
  return false;
}

/** Picking a timer in the grown-ups panel starts a fresh count. */
export function setTimer(s: ChildSettings, min: number | null): void {
  s.timerMin = min;
  s.playedMs = 0;
  s.expired = false;
}

export function extendTimer(s: ChildSettings, minutes: number): void {
  if (s.timerMin === null) return;
  s.timerMin += minutes;
  s.expired = s.playedMs >= s.timerMin * 60_000;
}
